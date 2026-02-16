import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { Loader2, Mail, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services/firebase";
import { toast } from "sonner";
import { AuthLayout } from "./AuthLayout";

// --- Visual Content for "Security" Theme ---
const SecurityVisuals = () => (
    <div className="relative w-full h-full flex flex-col items-center justify-center space-y-8">
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 p-8 rounded-full shadow-2xl relative"
        >
            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse" />
            <ShieldCheck className="h-24 w-24 text-blue-400 relative z-10" />
        </motion.div>

        <div className="text-center space-y-2 max-w-xs">
            <h3 className="text-xl font-semibold text-white">Secure Account Recovery</h3>
            <p className="text-sm text-slate-400">
                We use industry-standard encryption to verify your identity and protect your data.
            </p>
        </div>
    </div>
);

// --- Form Logic ---
const forgotPasswordSchema = z.object({
    email: z.string().email("Invalid email address"),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

interface ForgotPasswordFormProps {
    onLogin: () => void;
}

export function ForgotPasswordForm({ onLogin }: ForgotPasswordFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<ForgotPasswordValues>({
        resolver: zodResolver(forgotPasswordSchema),
    });

    const onSubmit = async (data: ForgotPasswordValues) => {
        setIsLoading(true);
        try {
            await authService.sendResetPasswordEmail(data.email);
            toast.success("Reset link sent! Please check your inbox.");
            reset();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to send reset link";
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Forgot Password?"
            subtitle="No worries, we'll send you reset instructions."
            visualContent={<SecurityVisuals />}
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
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

                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending Link...
                        </>
                    ) : (
                        "Send Reset Link"
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
