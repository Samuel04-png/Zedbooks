import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Lock, Loader2, RefreshCw, Mail, Building2 } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { firebaseAuth, isFirebaseConfigured } from "@/integrations/firebase/client";
import { authService, companyService } from "@/services/firebase";
import { ByteBerryWatermark } from "@/components/common/ByteBerryWatermark";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = z.object({
  organizationName: z.string().min(1, "Organization name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().min(10, "Phone number must be at least 10 digits").regex(/^\+?[0-9]+$/, "Invalid phone number format"),
  organizationType: z.enum(["business", "non_profit"]),
  taxClassification: z.string().min(1, "Tax classification is required"),
  tpin: z.string().regex(/^\d{10}$/, "TPIN must be exactly 10 digits"),
});

const resetEmailSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const newPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type AuthView = "login" | "forgot-password" | "reset-password" | "verify-email";

export default function Auth() {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [authView, setAuthView] = useState<AuthView>("login");
  const [rememberMe, setRememberMe] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({
    organizationName: "",
    email: "",
    password: "",
    phone: "",
    organizationType: "business" as "business" | "non_profit",
    taxClassification: "",
    tpin: "",
  });
  const [resetEmail, setResetEmail] = useState("");
  const [newPasswordForm, setNewPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [resetActionCode, setResetActionCode] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const checkCompanySetupAndRedirect = useCallback(async (userId: string) => {
    try {
      try {
        await authService.ensureCurrentMembership();
      } catch {
        // Continue with best-effort lookup below.
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
      // Default to dashboard on error
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  const acceptInvitationIfPresent = useCallback(async (token: string) => {
    try {
      await authService.acceptInvitation(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to accept invitation";
      toast.error(`Invitation link error: ${message}`);
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("invite");
    window.history.replaceState({}, "", url.toString());
    setInviteToken(null);
    toast.success("Invitation accepted. Your company access and role are now configured.");
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const mode = searchParams.get("mode");
    const oobCode = searchParams.get("oobCode");
    const tokenFromUrl = searchParams.get("invite");
    setInviteToken(tokenFromUrl);
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

      if (mode === "resetPassword" && oobCode) {
        try {
          await verifyPasswordResetCode(firebaseAuth, oobCode);
          if (mounted) {
            setResetActionCode(oobCode);
            setAuthView("reset-password");
          }
        } catch (error) {
          toast.error("Invalid or expired password reset link.");
        } finally {
          if (mounted) {
            setIsCheckingAuth(false);
          }
        }
        return;
      }

      if (mode === "verifyEmail" && oobCode) {
        try {
          await applyActionCode(firebaseAuth, oobCode);
          toast.success("Email verified successfully. You can now log in.");
          clearAuthQueryParams();
        } catch (error) {
          toast.error("Email verification link is invalid or expired.");
        }
      }

      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        if (tokenFromUrl) {
          await acceptInvitationIfPresent(tokenFromUrl);
        }
        await checkCompanySetupAndRedirect(currentUser.uid);
      } else if (mounted) {
        setIsCheckingAuth(false);
      }
    };

    void initializeAuthView();

    const subscription = authService.onAuthStateChanged(async (authUser) => {
      if (!mounted) return;

      if (!authUser) {
        setIsCheckingAuth(false);
        return;
      }

      if (tokenFromUrl) {
        await acceptInvitationIfPresent(tokenFromUrl);
      }

      setTimeout(() => {
        void checkCompanySetupAndRedirect(authUser.uid);
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [acceptInvitationIfPresent, checkCompanySetupAndRedirect]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = loginSchema.parse(loginForm);
      const credential = await authService.signIn(validated.email, validated.password);
      if (!credential.user.emailVerified) {
        setPendingVerificationEmail(validated.email);
        setAuthView("verify-email");
        toast.error("Please verify your email before signing in.");
        await authService.logout();
      } else {
        toast.success("Logged in successfully");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        const message = error instanceof Error ? error.message : "Failed to log in";
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = signupSchema.parse(signupForm);
      await authService.signUp({
        email: validated.email,
        password: validated.password,
        organizationName: validated.organizationName,
        phone: validated.phone,
        organizationType: validated.organizationType,
        taxClassification: validated.taxClassification,
        tpin: validated.tpin,
      });

      setPendingVerificationEmail(validated.email);
      setAuthView("verify-email");
      toast.success("Verification email sent! Please check your inbox.");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        const message = error instanceof Error ? error.message : "Failed to create account";
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerificationEmail = async () => {
    if (resendCooldown > 0) return;

    setIsResending(true);
    try {
      await authService.resendVerificationEmail();
      toast.success("Verification email resent!");
      setResendCooldown(60);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to resend verification email";
      toast.error(message);
    } finally {
      setIsResending(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = resetEmailSchema.parse({ email: resetEmail });
      await authService.sendResetPasswordEmail(validated.email);
      toast.success("Password reset email sent! Check your inbox.");
      setAuthView("login");
      setResetEmail("");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        const message = error instanceof Error ? error.message : "Failed to send reset email";
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = newPasswordSchema.parse(newPasswordForm);
      if (!resetActionCode) {
        toast.error("Invalid password reset session. Request a new reset link.");
        return;
      }

      await confirmPasswordReset(firebaseAuth, resetActionCode, validated.password);
      toast.success("Password updated successfully!");
      setAuthView("login");
      setNewPasswordForm({ password: "", confirmPassword: "" });
      setResetActionCode(null);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        const message = error instanceof Error ? error.message : "Failed to update password";
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

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

  // Email verification view
  if (authView === "verify-email") {
    return (
      <div className="min-h-screen flex">
        {/* Left side - Gradient blob design */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900">
          <div className="absolute -left-32 -top-32 w-96 h-96 bg-blue-900/20 rounded-full blur-3xl opacity-20" />
          <div className="absolute left-20 top-1/4 w-64 h-64 bg-indigo-900/20 rounded-full blur-3xl opacity-20" />
          <div className="absolute -left-16 bottom-1/4 w-80 h-80 bg-slate-800/20 rounded-full blur-3xl opacity-20" />
          <div className="absolute right-10 bottom-10 w-48 h-48 bg-blue-800/20 rounded-full blur-3xl opacity-20" />

          {/* Logo overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="h-16 w-16 rounded-2xl bg-white/5 backdrop-blur-sm flex items-center justify-center border border-white/10">
                  <img src="/zedbooklogo_transparent.png" alt="ZedBooks Logo" className="h-10 w-10 object-contain" />
                </div>
              </div>
              <h2 className="text-4xl font-bold tracking-tight">ZedBooks</h2>
              <p className="text-white/60 mt-2 font-medium">Accountability with Purpose</p>
            </div>
          </div>
        </div>

        {/* Right side - Verification content */}
        <div className="flex-1 flex items-center justify-center p-8 bg-white">
          <div className="w-full max-w-md text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Verify Your Email</h1>
            <p className="text-gray-500 mb-6">
              We've sent a verification link to<br />
              <span className="font-medium text-gray-900">{pendingVerificationEmail}</span>
            </p>

            <div className="bg-muted p-4 rounded-lg mb-6 border border-border">
              <p className="text-sm text-muted-foreground">
                Click the link in your email to verify your account. Check your spam folder if you don't see it.
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full mb-4 rounded-md border-input hover:bg-accent"
              onClick={handleResendVerificationEmail}
              disabled={isResending || resendCooldown > 0}
            >
              {isResending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resending...
                </>
              ) : resendCooldown > 0 ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Resend in {resendCooldown}s
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Resend Verification Email
                </>
              )}
            </Button>

            <Button
              variant="link"
              onClick={() => setAuthView("login")}
              className="text-gray-500"
            >
              Back to Login
            </Button>
          </div>
        </div>
        <ByteBerryWatermark className="text-slate-400/40 hover:text-primary" />
      </div>
    );
  }

  // Forgot password view
  if (authView === "forgot-password") {
    return (
      <div className="min-h-screen flex">
        {/* Left side - Gradient blob design */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900">
          <div className="absolute -left-32 -top-32 w-96 h-96 bg-blue-900/20 rounded-full blur-3xl opacity-20" />
          <div className="absolute left-20 top-1/4 w-64 h-64 bg-indigo-900/20 rounded-full blur-3xl opacity-20" />
          <div className="absolute -left-16 bottom-1/4 w-80 h-80 bg-slate-800/20 rounded-full blur-3xl opacity-20" />
          <div className="absolute right-10 bottom-10 w-48 h-48 bg-blue-800/20 rounded-full blur-3xl opacity-20" />

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="h-16 w-16 rounded-2xl bg-white/5 backdrop-blur-sm flex items-center justify-center border border-white/10">
                  <Building2 className="h-10 w-10 text-white" />
                </div>
              </div>
              <h2 className="text-4xl font-bold tracking-tight">ZedBooks</h2>
              <p className="text-white/60 mt-2 font-medium">Accountability with Purpose</p>
            </div>
          </div>
        </div>

        {/* Right side - Form */}
        <div className="flex-1 flex items-center justify-center p-8 bg-white">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Reset Password</h1>
              <p className="text-gray-500">Enter your email to receive a reset link</p>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="email"
                  placeholder="Email Address"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="pl-12 h-11 rounded-md border-input focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm transition-all"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Send Reset Link"
                )}
              </Button>

              <Button
                type="button"
                variant="link"
                onClick={() => setAuthView("login")}
                className="w-full text-gray-500"
              >
                Back to Login
              </Button>
            </form>
          </div>
        </div>
        <ByteBerryWatermark className="text-slate-400/40 hover:text-primary" />
      </div>
    );
  }

  // Reset password view
  if (authView === "reset-password") {
    return (
      <div className="min-h-screen flex">
        {/* Left side - Gradient blob design */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900">
          <div className="absolute -left-32 -top-32 w-96 h-96 bg-blue-900/20 rounded-full blur-3xl opacity-20" />
          <div className="absolute left-20 top-1/4 w-64 h-64 bg-indigo-900/20 rounded-full blur-3xl opacity-20" />
          <div className="absolute -left-16 bottom-1/4 w-80 h-80 bg-slate-800/20 rounded-full blur-3xl opacity-20" />
          <div className="absolute right-10 bottom-10 w-48 h-48 bg-blue-800/20 rounded-full blur-3xl opacity-20" />

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                  <Building2 className="h-10 w-10 text-white" />
                </div>
              </div>
              <h2 className="text-4xl font-bold">ZedBooks</h2>
              <p className="text-white/80 mt-2">Accountability with Purpose</p>
            </div>
          </div>
        </div>

        {/* Right side - Form */}
        <div className="flex-1 flex items-center justify-center p-8 bg-white">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Password</h1>
              <p className="text-gray-500">Enter your new password below</p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="password"
                  placeholder="New Password"
                  value={newPasswordForm.password}
                  onChange={(e) => setNewPasswordForm({ ...newPasswordForm, password: e.target.value })}
                  className="pl-12 h-11 rounded-md border-input focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="password"
                  placeholder="Confirm Password"
                  value={newPasswordForm.confirmPassword}
                  onChange={(e) => setNewPasswordForm({ ...newPasswordForm, confirmPassword: e.target.value })}
                  className="pl-12 h-11 rounded-md border-input focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm transition-all"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Update Password"
                )}
              </Button>
            </form>
          </div>
        </div>
        <ByteBerryWatermark className="text-slate-400/40 hover:text-primary" />
      </div>
    );
  }

  // Main login/signup view
  return (
    <div className="min-h-screen flex">
      {/* Left side - Gradient blob design */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900">
        <div className="absolute -left-32 -top-32 w-96 h-96 bg-blue-900/20 rounded-full blur-3xl opacity-20" />
        <div className="absolute left-20 top-1/4 w-64 h-64 bg-indigo-900/20 rounded-full blur-3xl opacity-20" />
        <div className="absolute -left-16 bottom-1/4 w-80 h-80 bg-slate-800/20 rounded-full blur-3xl opacity-20" />
        <div className="absolute right-10 bottom-10 w-48 h-48 bg-blue-800/20 rounded-full blur-3xl opacity-20" />

        {/* Logo overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-16 w-16 rounded-2xl bg-white/5 backdrop-blur-sm flex items-center justify-center border border-white/10">
                <img src="/logo_new.png" alt="ZedBooks Logo" className="h-12 w-auto object-contain" />
              </div>
            </div>
            <h2 className="text-4xl font-bold tracking-tight">ZedBooks</h2>
            <p className="text-white/60 mt-2 font-medium">Accountability with Purpose</p>
          </div>
        </div>
      </div>

      {/* Right side - Forms */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <img src="/logo_new.png" alt="ZedBooks Logo" className="h-8 w-auto object-contain" />
            </div>
            <span className="text-xl font-bold">ZedBooks</span>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 rounded-lg bg-muted p-1">
              <TabsTrigger value="login" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground">
                Login
              </TabsTrigger>
              <TabsTrigger value="signup" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground">
                Sign Up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
                <p className="text-gray-500">Sign in to continue to your dashboard</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    className="pl-12 h-11 rounded-md border-input focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="pl-12 h-11 rounded-md border-input focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    />
                    <Label htmlFor="remember" className="text-sm text-gray-600">
                      Remember me
                    </Label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAuthView("forgot-password")}
                    className="text-sm text-primary hover:text-primary/80 font-medium"
                  >
                    Forgot Password?
                  </button>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm transition-all"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "LOGIN"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h1>
                <p className="text-gray-500">Start your free trial today</p>
              </div>

              {inviteToken && (
                <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Invitation detected. Sign up with the invited email to join your company workspace.
                </div>
              )}

              <form onSubmit={handleSignup} className="space-y-4">
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Organization Name"
                    value={signupForm.organizationName}
                    onChange={(e) => setSignupForm({ ...signupForm, organizationName: e.target.value })}
                    className="pl-12 h-11 rounded-md border-input focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <Select
                  value={signupForm.organizationType}
                  onValueChange={(value) =>
                    setSignupForm({
                      ...signupForm,
                      organizationType: value as "business" | "non_profit",
                      taxClassification: "",
                    })
                  }
                >
                  <SelectTrigger className="h-11 rounded-md border-input focus:ring-2 focus:ring-primary/20 px-4">
                    <SelectValue placeholder="Organization Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="non_profit">Non-profit</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={signupForm.taxClassification}
                  onValueChange={(value) => setSignupForm({ ...signupForm, taxClassification: value })}
                >
                  <SelectTrigger className="h-11 rounded-md border-input focus:ring-2 focus:ring-primary/20 px-4">
                    <SelectValue
                      placeholder={
                        signupForm.organizationType === "business"
                          ? "Business Tax Type"
                          : "Non-profit Tax Classification"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {signupForm.organizationType === "business" ? (
                      <>
                        <SelectItem value="vat_registered">VAT Registered</SelectItem>
                        <SelectItem value="turnover_tax">Turnover Tax</SelectItem>
                        <SelectItem value="non_vat">Non-VAT</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="tax_exempt">Tax Exempt</SelectItem>
                        <SelectItem value="grant_funded">Grant Funded</SelectItem>
                        <SelectItem value="charitable">Charitable Organization</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>

                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="email"
                    placeholder="Email Address"
                    value={signupForm.email}
                    onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                    className="pl-12 h-11 rounded-md border-input focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="relative">
                  <Input
                    type="text"
                    placeholder="TPIN (10 digits)"
                    value={signupForm.tpin}
                    onChange={(e) =>
                      setSignupForm({ ...signupForm, tpin: e.target.value.replace(/\D/g, "").slice(0, 10) })
                    }
                    className="h-11 rounded-md border-input focus:ring-2 focus:ring-primary/20 px-4"
                  />
                </div>

                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="tel"
                    placeholder="Phone Number (e.g., +260...)"
                    value={signupForm.phone}
                    onChange={(e) => setSignupForm({ ...signupForm, phone: e.target.value })}
                    className="pl-12 h-11 rounded-md border-input focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={signupForm.password}
                    onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                    className="pl-12 h-11 rounded-md border-input focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm transition-all"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "CREATE ACCOUNT"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-8 text-center">
            <Link to="/" className="text-sm text-gray-500 hover:text-orange-500">
              Back to Home
            </Link>
          </div>
        </div>
        <ByteBerryWatermark />
      </div>
    </div>
  );
}

