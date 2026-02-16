import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { Loader2, Lock, ShieldCheck, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmPasswordReset } from "firebase/auth";
import { firebaseAuth } from "@/integrations/firebase/client";
import { toast } from "sonner";
import { AuthLayout } from "./AuthLayout";

// --- Visual Content for "Security" Theme ---
const ResetVisuals = () => (
    <div className="relative w-full h-full flex flex-col items-center justify-center space-y-8">
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="bg-emerald-900/40 backdrop-blur-xl border border-emerald-500/30 p-8 rounded-full shadow-2xl relative"
        >
            <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
            <ShieldCheck className="h-24 w-24 text-emerald-400 relative z-10" />
        </motion.div>

        <div className="text-center space-y-2 max-w-xs">
            <h3 className="text-xl font-semibold text-white">Reset Credentials</h3>
            <p className="text-sm text-slate-400">
                Create a strong password to ensure your organization's data remains secure.
            </p>
        </div>
    </div>
);

// --- Form Logic ---
const resetPasswordSchema = z
    .object({
        password: z.string().min(6, "Password must be at least 6 characters"),
        confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
    });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

interface ResetPasswordFormProps {
    actionCode: string;
    onLogin: () => void;
}

export function ResetPasswordForm({ actionCode, onLogin }: ResetPasswordFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ResetPasswordValues>({
        resolver: zodResolver(resetPasswordSchema),
    });

    const onSubmit = async (data: ResetPasswordValues) => {
        setIsLoading(true);
        try {
            await confirmPasswordReset(firebaseAuth, actionCode, data.password);
            toast.success("Password updated successfully!");
            onLogin(); // Go to login after success
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to update password";
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Set New Password"
            subtitle="Enter your new password below."
            visualContent={<ResetVisuals />}
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="password">New Password</Label>
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

                <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="••••••••"
                            className="pl-10"
                            {...register("confirmPassword")}
                        />
                    </div>
                    {errors.confirmPassword && (
                        <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                    )}
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Updating...
                        </>
                    ) : (
                        "Update Password"
                    )}
                </Button>

                <div className="text-center text-sm">
                    <button
                        type="button"
                        onClick={onLogin}
                        className="text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2 mx-auto"
                    >
                        ← Back to Login
                    </button>
                </div>
            </form>
        </AuthLayout>
    );
}
