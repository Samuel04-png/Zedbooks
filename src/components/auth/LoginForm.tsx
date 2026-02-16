import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Mail, Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { authService } from "@/services/firebase";
import { toast } from "sonner";
import { AuthLayout } from "./AuthLayout";

// --- Visual Content for "Confidence" Theme ---
const LoginVisuals = () => (
    <div className="relative w-full h-full flex flex-col items-center justify-center space-y-6">
        {/* Floating Card 1: Payroll Summary */}
        <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="absolute top-1/4 -left-12 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-xl w-64 shadow-2xl"
        >
            <div className="flex items-center gap-3 mb-3">
                <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                    <p className="text-xs text-slate-300">Payroll Status</p>
                    <p className="text-sm font-semibold text-white">Processed Successfully</p>
                </div>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full w-full bg-emerald-500" />
            </div>
        </motion.div>

        {/* Floating Card 2: Revenue Chart Snippet */}
        <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 p-6 rounded-2xl w-full max-w-sm shadow-2xl relative z-10"
        >
            <div className="flex justify-between items-end mb-4">
                <div>
                    <p className="text-sm text-slate-400">Total Revenue</p>
                    <p className="text-3xl font-bold text-white">K 245,000</p>
                </div>
                <div className="text-emerald-400 text-sm font-medium">+12.5%</div>
            </div>
            <div className="flex items-end gap-2 h-24">
                {[40, 65, 50, 80, 55, 90, 75].map((h, i) => (
                    <div
                        key={i}
                        className="flex-1 bg-blue-500/20 rounded-t-sm relative overflow-hidden group"
                    >
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${h}%` }}
                            transition={{ delay: 0.8 + i * 0.1, duration: 1 }}
                            className="absolute bottom-0 w-full bg-gradient-to-t from-blue-600 to-cyan-400 w-full"
                        />
                    </div>
                ))}
            </div>
        </motion.div>
    </div>
);

// --- Form Logic ---
const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
    onForgotPassword: () => void;
    onSignup: () => void;
    onLoginSuccess: () => void;
}

export function LoginForm({ onForgotPassword, onSignup, onLoginSuccess }: LoginFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginFormValues) => {
        setIsLoading(true);
        try {
            await authService.signIn(data.email, data.password);
            toast.success("Welcome back!");
            onLoginSuccess();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to log in";
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Welcome back"
            subtitle="Sign in to continue to your dashboard"
            visualContent={<LoginVisuals />}
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-1">
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="email"
                            type="email"
                            placeholder="name@company.com"
                            className="pl-10"
                            {...register("email")}
                        />
                    </div>
                    {errors.email && (
                        <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <button
                            type="button"
                            onClick={onForgotPassword}
                            className="text-sm text-primary hover:underline font-medium"
                        >
                            Forgot Password?
                        </button>
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            className="pl-10"
                            {...register("password")}
                        />
                    </div>
                    {errors.password && (
                        <p className="text-sm text-destructive">{errors.password.message}</p>
                    )}
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Signing in...
                        </>
                    ) : (
                        "Sign In"
                    )}
                </Button>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                            Or continue with
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" disabled className="w-full">
                        Google
                    </Button>
                    <Button variant="outline" disabled className="w-full">
                        Microsoft
                    </Button>
                </div>

                <div className="text-center text-sm text-muted-foreground mt-6">
                    Don't have an account?{" "}
                    <button
                        type="button"
                        onClick={onSignup}
                        className="text-primary hover:underline font-medium"
                    >
                        Sign up
                    </button>
                </div>
            </form>
        </AuthLayout>
    );
}
