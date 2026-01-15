import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, ArrowLeft, Chrome, Phone, Mail, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
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

const phoneSchema = z.object({
  phone: z.string().min(10, "Phone number must be at least 10 digits").regex(/^\+?[0-9]+$/, "Invalid phone number format"),
});

const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits"),
});

type AuthView = "login" | "forgot-password" | "reset-password" | "phone-login" | "verify-otp";
type LoginMethod = "email" | "phone";

export default function Auth() {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [authView, setAuthView] = useState<AuthView>("login");
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("email");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({
    organizationName: "",
    email: "",
    password: "",
  });
  const [resetEmail, setResetEmail] = useState("");
  const [newPasswordForm, setNewPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [phoneForm, setPhoneForm] = useState({ phone: "" });
  const [otpForm, setOtpForm] = useState({ otp: "" });

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth`,
        },
      });

      if (error) {
        toast.error(error.message);
      }
    } catch (error) {
      toast.error("Failed to sign in with Google");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  useEffect(() => {
    // Check URL for password recovery token
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get("access_token");
    const type = hashParams.get("type");
    
    if (accessToken && type === "recovery") {
      setAuthView("reset-password");
      setIsCheckingAuth(false);
      return;
    }

    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        checkCompanySetupAndRedirect(session.user.id);
      } else {
        setIsCheckingAuth(false);
      }
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && authView !== "reset-password") {
        // Defer the redirect to avoid deadlock
        setTimeout(() => {
          checkCompanySetupAndRedirect(session.user.id);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, authView]);

  const checkCompanySetupAndRedirect = async (userId: string) => {
    // Check if company settings exist
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
  };

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
        toast.success("Logged in successfully");
        // Auth state change handler will redirect
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
          emailRedirectTo: `${window.location.origin}/setup`,
          data: {
            organization_name: validated.organizationName,
          },
        },
      });

      if (error) {
        toast.error(error.message);
      } else if (data.user) {
        toast.success("Account created successfully!");
        // Redirect to setup page for new users
        navigate("/setup");
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

  const handlePhoneSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = phoneSchema.parse(phoneForm);
      
      // Ensure phone number starts with +
      const formattedPhone = validated.phone.startsWith('+') 
        ? validated.phone 
        : `+${validated.phone}`;

      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("OTP sent to your phone!");
        setAuthView("verify-otp");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Failed to send OTP");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = otpSchema.parse(otpForm);
      
      const formattedPhone = phoneForm.phone.startsWith('+') 
        ? phoneForm.phone 
        : `+${phoneForm.phone}`;

      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: validated.otp,
        type: "sms",
      });

      if (error) {
        toast.error(error.message);
      } else if (data.session) {
        toast.success("Phone verified successfully!");
        // Auth state change handler will redirect
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Failed to verify OTP");
      }
    } finally {
      setIsLoading(false);
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

  // Loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-accent p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-background mb-4">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">ZedBooks</h1>
            <p className="text-white/90">Checking authentication...</p>
          </div>

          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-64 mt-2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (authView === "verify-otp") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-accent p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-background mb-4">
              <Heart className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">ZedBooks</h1>
            <p className="text-white/90">Accountability with Purpose</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Verify Phone Number</CardTitle>
              <CardDescription>Enter the 6-digit code sent to {phoneForm.phone}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">Verification Code</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="123456"
                    maxLength={6}
                    value={otpForm.otp}
                    onChange={(e) => setOtpForm({ otp: e.target.value.replace(/\D/g, '') })}
                    required
                    className="text-center text-2xl tracking-widest"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify Code"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setAuthView("login");
                    setOtpForm({ otp: "" });
                  }}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Login
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-white/70 mt-6">
            For Zambian NGOs &middot; PAYE, NAPSA, NHIMA compliant
          </p>
        </div>
      </div>
    );
  }

  if (authView === "forgot-password") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-accent p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-background mb-4">
              <Heart className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">ZedBooks</h1>
            <p className="text-white/90">Accountability with Purpose</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
              <CardDescription>Enter your email to receive a password reset link</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setAuthView("login")}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Login
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-white/70 mt-6">
            For Zambian NGOs &middot; PAYE, NAPSA, NHIMA compliant
          </p>
        </div>
      </div>
    );
  }

  if (authView === "reset-password") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-accent p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-background mb-4">
              <Heart className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">ZedBooks</h1>
            <p className="text-white/90">Accountability with Purpose</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Set New Password</CardTitle>
              <CardDescription>Enter your new password below</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPasswordForm.password}
                    onChange={(e) =>
                      setNewPasswordForm({ ...newPasswordForm, password: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={newPasswordForm.confirmPassword}
                    onChange={(e) =>
                      setNewPasswordForm({ ...newPasswordForm, confirmPassword: e.target.value })
                    }
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-white/70 mt-6">
            For Zambian NGOs &middot; PAYE, NAPSA, NHIMA compliant
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-accent p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-background mb-4">
            <Heart className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">ZedBooks</h1>
          <p className="text-white/90">Accountability with Purpose</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Sign in to your account or create a new one</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <div className="space-y-4">
                  {/* Social Login Buttons */}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                    disabled={isGoogleLoading}
                  >
                    {isGoogleLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Chrome className="h-4 w-4 mr-2" />
                    )}
                    {isGoogleLoading ? "Signing in..." : "Continue with Google"}
                  </Button>

                  {/* Login Method Toggle */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={loginMethod === "email" ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setLoginMethod("email")}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </Button>
                    <Button
                      type="button"
                      variant={loginMethod === "phone" ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setLoginMethod("phone")}
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Phone
                    </Button>
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator className="w-full" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        Or continue with {loginMethod}
                      </span>
                    </div>
                  </div>

                  {loginMethod === "email" ? (
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-email">Email</Label>
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="your.email@example.com"
                          value={loginForm.email}
                          onChange={(e) =>
                            setLoginForm({ ...loginForm, email: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="login-password">Password</Label>
                        <Input
                          id="login-password"
                          type="password"
                          value={loginForm.password}
                          onChange={(e) =>
                            setLoginForm({ ...loginForm, password: e.target.value })
                          }
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          "Sign In"
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="link"
                        className="w-full text-sm"
                        onClick={() => setAuthView("forgot-password")}
                      >
                        Forgot password?
                      </Button>
                    </form>
                  ) : (
                    <form onSubmit={handlePhoneSignIn} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="+260971234567"
                          value={phoneForm.phone}
                          onChange={(e) =>
                            setPhoneForm({ phone: e.target.value })
                          }
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Include country code (e.g., +260 for Zambia)
                        </p>
                      </div>
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending OTP...
                          </>
                        ) : (
                          "Send Verification Code"
                        )}
                      </Button>
                    </form>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="signup">
                <div className="space-y-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                    disabled={isGoogleLoading}
                  >
                    {isGoogleLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Chrome className="h-4 w-4 mr-2" />
                    )}
                    {isGoogleLoading ? "Signing up..." : "Continue with Google"}
                  </Button>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator className="w-full" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        Or continue with email
                      </span>
                    </div>
                  </div>

                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Organization Name</Label>
                      <Input
                        id="signup-name"
                        placeholder="Your NGO Name"
                        value={signupForm.organizationName}
                        onChange={(e) =>
                          setSignupForm({
                            ...signupForm,
                            organizationName: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="your.email@example.com"
                        value={signupForm.email}
                        onChange={(e) =>
                          setSignupForm({ ...signupForm, email: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        value={signupForm.password}
                        onChange={(e) =>
                          setSignupForm({ ...signupForm, password: e.target.value })
                        }
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        "Create Account"
                      )}
                    </Button>
                  </form>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-white/70 mt-6">
          For Zambian NGOs &middot; PAYE, NAPSA, NHIMA compliant
        </p>
      </div>
    </div>
  );
}
