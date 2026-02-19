import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/services/firebase/authService";
import { callFunction } from "@/services/firebase/functionsService";

interface InvitationPreview {
  invitationId: string;
  companyId: string;
  companyName: string | null;
  email: string | null;
  role: string;
  expiresAt: string | null;
  userExists: boolean;
  status: string;
}

export default function AcceptInvitation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoading: isAuthLoading } = useAuth();
  const token = (searchParams.get("token") || "").trim();

  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadInvitation = async () => {
      if (!token) {
        setErrorMessage("Invitation token is missing.");
        setIsLoading(false);
        return;
      }

      try {
        const preview = await callFunction<{ token: string }, InvitationPreview>(
          "getInvitationByToken",
          { token },
        );
        setInvitation(preview);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invitation is invalid or expired.";
        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadInvitation();
  }, [token]);

  useEffect(() => {
    const accept = async () => {
      if (!user || !token) return;
      setIsAccepting(true);
      try {
        await authService.acceptInvitation(token);
        toast.success("Invitation accepted. Redirecting to dashboard.");
        navigate("/dashboard", { replace: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to accept invitation.";
        toast.error(message);
      } finally {
        setIsAccepting(false);
      }
    };

    if (!isAuthLoading && user) {
      void accept();
    }
  }, [isAuthLoading, navigate, token, user]);

  if (isLoading || isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading invitation...</span>
        </div>
      </div>
    );
  }

  if (errorMessage || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation Error</CardTitle>
            <CardDescription>{errorMessage || "Invitation not found."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/auth")} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{isAccepting ? "Accepting invitation..." : "Redirecting..."}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Organization Invitation</CardTitle>
          <CardDescription>
            You were invited to join {invitation.companyName || "this organization"} as {invitation.role}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {invitation.email && (
            <p className="text-sm text-muted-foreground">Email: {invitation.email}</p>
          )}
          {invitation.expiresAt && (
            <p className="text-sm text-muted-foreground">
              Expires: {new Date(invitation.expiresAt).toLocaleString()}
            </p>
          )}
          <div className="pt-4 space-y-2">
            <Button
              className="w-full"
              onClick={() => navigate(`/auth?token=${encodeURIComponent(token)}${invitation.userExists ? "" : "&view=signup"}`)}
            >
              {invitation.userExists ? "Continue to Login" : "Create Account to Accept"}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
