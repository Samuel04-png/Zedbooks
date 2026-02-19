import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { applyActionCode, verifyPasswordResetCode } from "firebase/auth";
import { firebaseAuth, isFirebaseConfigured } from "@/integrations/firebase/client";
import { authService, companyService } from "@/services/firebase";

// Import new Auth Components
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { VerifyEmail } from "@/components/auth/VerifyEmail";

type AuthView = "login" | "signup" | "forgot-password" | "reset-password" | "verify-email";

export default function Auth() {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authView, setAuthView] = useState<AuthView>("login");

  // State for specific flows
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [resetActionCode, setResetActionCode] = useState<string | null>(null);

  // Invite handling
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  const checkCompanySetupAndRedirect = useCallback(async (userId: string) => {
    try {
      try {
        await authService.ensureCurrentMembership();
      } catch {
        // Continue with best-effort lookup
      }

      const membership = await companyService.getPrimaryMembershipByUser(userId);
      if (!membership) {
        navigate("/setup", { replace: true });
        return;
      }

      const settings = await companyService.getCompanySettings(membership.companyId);
      if (!settings?.companyName) {
        navigate("/setup", { replace: true });
        return;
      }

      navigate("/dashboard", { replace: true });
    } catch (error) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  const acceptInvitationIfPresent = useCallback(async (token: string) => {
    try {
      await authService.acceptInvitation(token);
      toast.success("Invitation accepted. Your company access is configured.");
      // Clear token from storage after successful use
      sessionStorage.removeItem("pendingInviteToken");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to accept invitation";
      // Don't show error if it's just "user already in company" or similar benign errors
      // But since we can't easily parse that here without error codes, we'll show it.
      // Ideally backend returns structured error codes.
      toast.error(`Invitation link error: ${message}`);
    }

    // Clean up URL
    const url = new URL(window.location.href);
    url.searchParams.delete("token");
    url.searchParams.delete("invite");
    window.history.replaceState({}, "", url.toString());
    setInviteToken(null);
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const mode = searchParams.get("mode");
    const oobCode = searchParams.get("oobCode");
    const tokenFromUrl = searchParams.get("token") || searchParams.get("invite");
    const requestedView = searchParams.get("view");

    // Persist token if found in URL
    if (tokenFromUrl) {
      setInviteToken(tokenFromUrl);
      sessionStorage.setItem("pendingInviteToken", tokenFromUrl);
    } else {
      // Check storage for pending token
      const storedToken = sessionStorage.getItem("pendingInviteToken");
      if (storedToken) {
        setInviteToken(storedToken);
      }
    }

    let mounted = true;

    const clearAuthQueryParams = () => {
      const url = new URL(window.location.href);
      ["mode", "oobCode", "apiKey", "lang", "continueUrl"].forEach((key) => url.searchParams.delete(key));
      window.history.replaceState({}, "", url.toString());
    };

    const initializeAuthView = async () => {
      if (!isFirebaseConfigured) {
        setIsCheckingAuth(false);
        return;
      }

      // Handle Password Reset Mode
      if (mode === "resetPassword" && oobCode) {
        try {
          await verifyPasswordResetCode(firebaseAuth, oobCode);
          if (mounted) {
            setResetActionCode(oobCode);
            setAuthView("reset-password");
          }
        } catch (error) {
          toast.error("Invalid or expired password reset link.");
          setAuthView("login");
        } finally {
          if (mounted) setIsCheckingAuth(false);
        }
        return;
      }

      // Handle Email Verification Mode
      if (mode === "verifyEmail" && oobCode) {
        try {
          await applyActionCode(firebaseAuth, oobCode);
          toast.success("Email verified successfully. You can now log in.");
          clearAuthQueryParams();
          setAuthView("login");
        } catch (error) {
          toast.error("Email verification link is invalid or expired.");
          setAuthView("login");
        }
        if (mounted) setIsCheckingAuth(false);
        return;
      }

      // Check Current User
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        // Check for token from URL OR storage
        const tokenToProcess = tokenFromUrl || sessionStorage.getItem("pendingInviteToken");
        if (tokenToProcess) {
          await acceptInvitationIfPresent(tokenToProcess);
        }
        await checkCompanySetupAndRedirect(currentUser.uid);
      } else if (mounted) {
        if (requestedView === "signup") {
          setAuthView("signup");
        } else if (requestedView === "login") {
          setAuthView("login");
        }
        setIsCheckingAuth(false);
      }
    };

    void initializeAuthView();

    // Listen for auth state changes
    const subscription = authService.onAuthStateChanged(async (authUser) => {
      if (!mounted) return;
      if (!authUser) {
        setIsCheckingAuth(false);
        return;
      }

      // Check for token from URL OR storage
      const tokenToProcess = tokenFromUrl || sessionStorage.getItem("pendingInviteToken");
      if (tokenToProcess) {
        await acceptInvitationIfPresent(tokenToProcess);
      }
      // Small delay to ensure Firestore is ready
      setTimeout(() => {
        void checkCompanySetupAndRedirect(authUser.uid);
      }, 500);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [acceptInvitationIfPresent, checkCompanySetupAndRedirect]);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // --- Render Views ---

  if (authView === "login") {
    return (
      <LoginForm
        onForgotPassword={() => setAuthView("forgot-password")}
        onSignup={() => setAuthView("signup")}
        onLoginSuccess={() => {
          // Logic handled in onAuthStateChanged, but we can do extra logic here if needed
        }}
      />
    );
  }

  if (authView === "signup") {
    return (
      <SignupForm
        onLogin={() => setAuthView("login")}
        onSignupSuccess={(email) => {
          setPendingVerificationEmail(email);
          setAuthView("verify-email");
        }}
      />
    );
  }

  if (authView === "forgot-password") {
    return <ForgotPasswordForm onLogin={() => setAuthView("login")} />;
  }

  if (authView === "reset-password" && resetActionCode) {
    return <ResetPasswordForm actionCode={resetActionCode} onLogin={() => setAuthView("login")} />;
  }

  if (authView === "verify-email") {
    return <VerifyEmail email={pendingVerificationEmail} onLogin={() => setAuthView("login")} />;
  }

  // Default fallback
  return (
    <LoginForm
      onForgotPassword={() => setAuthView("forgot-password")}
      onSignup={() => setAuthView("signup")}
      onLoginSuccess={() => { }}
    />
  );
}
