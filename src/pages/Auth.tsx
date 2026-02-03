import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Lock, Loader2, RefreshCw, Mail, ArrowRight } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = z.object({
  organizationName: z.string().min(1, "Organization name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().min(10, "Phone number must be at least 10 digits").regex(/^\+?[0-9]+$/, "Invalid phone number format"),
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
  const [hasSubmittedForm, setHasSubmittedForm] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({
    organizationName: "",
    email: "",
    password: "",
    phone: "",
  });
  const [resetEmail, setResetEmail] = useState("");
  const [newPasswordForm, setNewPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const checkCompanySetupAndRedirect = useCallback(async (userId: string) => {
    const { data: settings } = await supabase
      .from("company_settings")
      .select("id, company_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (!settings || !settings.company_name) {
      navigate("/setup");
    } else {
      navigate("/dashboard");
    }
  }, [navigate]);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get("access_token");
    const type = hashParams.get("type");

    if (accessToken && type === "recovery") {
      setAuthView("reset-password");
      setIsCheckingAuth(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        checkCompanySetupAndRedirect(session.user.id);
      } else {
        setIsCheckingAuth(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && hasSubmittedForm && authView !== "reset-password" && authView !== "verify-email") {
        setTimeout(() => {
          checkCompanySetupAndRedirect(session.user.id);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, authView, hasSubmittedForm, checkCompanySetupAndRedirect]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = loginSchema.parse(loginForm);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) {
        toast.error(error.message);
      } else if (data.session) {
        setHasSubmittedForm(true);
        toast.success("Logged in successfully");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Failed to log in");
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
      const { data, error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: {
            organization_name: validated.organizationName,
            phone: validated.phone,
          },
        },
      });

      if (error) {
        toast.error(error.message);
      } else if (data.user) {
        if (data.user.identities && data.user.identities.length === 0) {
          toast.error("An account with this email already exists");
        } else {
          setPendingVerificationEmail(validated.email);
          setAuthView("verify-email");
          toast.success("Verification email sent! Please check your inbox.");
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Failed to create account");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerificationEmail = async () => {
    if (resendCooldown > 0) return;

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingVerificationEmail,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Verification email resent!");
        setResendCooldown(60);
      }
    } catch (error) {
      toast.error("Failed to resend verification email");
    } finally {
      setIsResending(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = resetEmailSchema.parse({ email: resetEmail });
      const { error } = await supabase.auth.resetPasswordForEmail(validated.email, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password reset email sent! Check your inbox.");
        setAuthView("login");
        setResetEmail("");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Failed to send reset email");
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
      const { error } = await supabase.auth.updateUser({
        password: validated.password,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password updated successfully!");
        setAuthView("login");
        setNewPasswordForm({ password: "", confirmPassword: "" });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Failed to update password");
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
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-pink-400 via-rose-400 to-orange-300">
          <div className="absolute -left-32 -top-32 w-96 h-96 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full opacity-80" />
          <div className="absolute left-20 top-1/4 w-64 h-64 bg-gradient-to-br from-rose-400 to-pink-400 rounded-full opacity-70" />
          <div className="absolute -left-16 bottom-1/4 w-80 h-80 bg-gradient-to-tr from-orange-400 to-rose-400 rounded-full opacity-75" />
          <div className="absolute right-10 bottom-10 w-48 h-48 bg-gradient-to-br from-pink-300 to-rose-300 rounded-full opacity-60" />
        </div>

        {/* Right side - Verification content */}
        <div className="flex-1 flex items-center justify-center p-8 bg-white">
          <div className="w-full max-w-md text-center">
            <div className="mx-auto w-20 h-20 bg-gradient-to-r from-pink-500 to-orange-400 rounded-full flex items-center justify-center mb-6">
              <Mail className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Verify Your Email</h1>
            <p className="text-gray-500 mb-6">
              We've sent a verification link to<br />
              <span className="font-medium text-gray-900">{pendingVerificationEmail}</span>
            </p>

            <div className="bg-gray-50 p-4 rounded-xl mb-6">
              <p className="text-sm text-gray-600">
                Click the link in your email to verify your account. Check your spam folder if you don't see it.
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full mb-4 rounded-full"
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
      </div>
    );
  }

  // Forgot password view
  if (authView === "forgot-password") {
    return (
      <div className="min-h-screen flex">
        {/* Left side - Gradient blob design */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-pink-400 via-rose-400 to-orange-300">
          <div className="absolute -left-32 -top-32 w-96 h-96 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full opacity-80" />
          <div className="absolute left-20 top-1/4 w-64 h-64 bg-gradient-to-br from-rose-400 to-pink-400 rounded-full opacity-70" />
          <div className="absolute -left-16 bottom-1/4 w-80 h-80 bg-gradient-to-tr from-orange-400 to-rose-400 rounded-full opacity-75" />
          <div className="absolute right-10 bottom-10 w-48 h-48 bg-gradient-to-br from-pink-300 to-rose-300 rounded-full opacity-60" />
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
                  className="pl-12 h-12 rounded-full border-gray-200 focus:border-pink-400 focus:ring-pink-400"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 rounded-full bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 text-white font-semibold"
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
      </div>
    );
  }

  // Reset password view
  if (authView === "reset-password") {
    return (
      <div className="min-h-screen flex">
        {/* Left side - Gradient blob design */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-pink-400 via-rose-400 to-orange-300">
          <div className="absolute -left-32 -top-32 w-96 h-96 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full opacity-80" />
          <div className="absolute left-20 top-1/4 w-64 h-64 bg-gradient-to-br from-rose-400 to-pink-400 rounded-full opacity-70" />
          <div className="absolute -left-16 bottom-1/4 w-80 h-80 bg-gradient-to-tr from-orange-400 to-rose-400 rounded-full opacity-75" />
          <div className="absolute right-10 bottom-10 w-48 h-48 bg-gradient-to-br from-pink-300 to-rose-300 rounded-full opacity-60" />
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
                  className="pl-12 h-12 rounded-full border-gray-200 focus:border-pink-400 focus:ring-pink-400"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="password"
                  placeholder="Confirm Password"
                  value={newPasswordForm.confirmPassword}
                  onChange={(e) => setNewPasswordForm({ ...newPasswordForm, confirmPassword: e.target.value })}
                  className="pl-12 h-12 rounded-full border-gray-200 focus:border-pink-400 focus:ring-pink-400"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 rounded-full bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 text-white font-semibold"
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
      </div>
    );
  }

  // Main login/signup view
  return (
    <div className="min-h-screen flex">
      {/* Left side - Gradient blob design */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-pink-400 via-rose-400 to-orange-300">
        <div className="absolute -left-32 -top-32 w-96 h-96 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full opacity-80" />
        <div className="absolute left-20 top-1/4 w-64 h-64 bg-gradient-to-br from-rose-400 to-pink-400 rounded-full opacity-70" />
        <div className="absolute -left-16 bottom-1/4 w-80 h-80 bg-gradient-to-tr from-orange-400 to-rose-400 rounded-full opacity-75" />
        <div className="absolute right-10 bottom-10 w-48 h-48 bg-gradient-to-br from-pink-300 to-rose-300 rounded-full opacity-60" />
      </div>

      {/* Right side - Forms */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <Tabs defaultValue="login" className="w-full">
            <TabsContent value="login">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">User Login</h1>
                <p className="text-gray-500">Welcome back! Please sign in to continue.</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    className="pl-12 h-12 rounded-full border-gray-200 focus:border-pink-400 focus:ring-pink-400"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="pl-12 h-12 rounded-full border-gray-200 focus:border-pink-400 focus:ring-pink-400"
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
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 rounded-full bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 text-white font-semibold shadow-lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "LOGIN"
                  )}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setAuthView("forgot-password")}
                    className="text-sm text-gray-500 hover:text-pink-500"
                  >
                    Forgot Username / Password?
                  </button>
                </div>
              </form>

              <div className="mt-8 text-center">
                <TabsList className="bg-transparent">
                  <TabsTrigger value="signup" className="text-gray-600 hover:text-pink-500">
                    Create Your Account <ArrowRight className="h-4 w-4 ml-1 inline" />
                  </TabsTrigger>
                </TabsList>
              </div>
            </TabsContent>

            <TabsContent value="signup">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h1>
                <p className="text-gray-500">Start your free trial today</p>
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Organization Name"
                    value={signupForm.organizationName}
                    onChange={(e) => setSignupForm({ ...signupForm, organizationName: e.target.value })}
                    className="pl-12 h-12 rounded-full border-gray-200 focus:border-pink-400 focus:ring-pink-400"
                  />
                </div>

                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="email"
                    placeholder="Email Address"
                    value={signupForm.email}
                    onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                    className="pl-12 h-12 rounded-full border-gray-200 focus:border-pink-400 focus:ring-pink-400"
                  />
                </div>

                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="tel"
                    placeholder="Phone Number (e.g., +260...)"
                    value={signupForm.phone}
                    onChange={(e) => setSignupForm({ ...signupForm, phone: e.target.value })}
                    className="pl-12 h-12 rounded-full border-gray-200 focus:border-pink-400 focus:ring-pink-400"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={signupForm.password}
                    onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                    className="pl-12 h-12 rounded-full border-gray-200 focus:border-pink-400 focus:ring-pink-400"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 rounded-full bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 text-white font-semibold shadow-lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "CREATE ACCOUNT"
                  )}
                </Button>
              </form>

              <div className="mt-8 text-center">
                <TabsList className="bg-transparent">
                  <TabsTrigger value="login" className="text-gray-600 hover:text-pink-500">
                    Already have an account? Login
                  </TabsTrigger>
                </TabsList>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-8 text-center">
            <Link to="/" className="text-sm text-gray-500 hover:text-pink-500">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
