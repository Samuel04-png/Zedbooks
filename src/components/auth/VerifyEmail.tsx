import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, Mail, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authService } from "@/services/firebase";
import { toast } from "sonner";
import { AuthLayout } from "./AuthLayout";

// --- Visual Content ---
const VerifyVisuals = () => (
    <div className="relative w-full h-full flex flex-col items-center justify-center space-y-8">
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="bg-blue-900/40 backdrop-blur-xl border border-blue-500/30 p-8 rounded-full shadow-2xl relative"
        >
            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse" />
            <Mail className="h-24 w-24 text-blue-400 relative z-10" />
        </motion.div>

        <div className="text-center space-y-2 max-w-xs">
            <h3 className="text-xl font-semibold text-white">Check Your Inbox</h3>
            <p className="text-sm text-slate-400">
                We've sent a secure verification link to your email address.
            </p>
        </div>
    </div>
);

interface VerifyEmailProps {
    email: string;
    onLogin: () => void;
}

export function VerifyEmail({ email, onLogin }: VerifyEmailProps) {
    const [isResending, setIsResending] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    const handleResend = async () => {
        if (resendCooldown > 0) return;
        setIsResending(true);
        try {
            await authService.resendVerificationEmail();
            toast.success("Verification email resent!");
            setResendCooldown(60);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to resend";
            toast.error(message);
        } finally {
            setIsResending(false);
        }
    };

    return (
        <AuthLayout
            title="Verify Your Email"
            subtitle={`We've sent a link to ${email}`}
            visualContent={<VerifyVisuals />}
        >
            <div className="space-y-6 text-center">
                <div className="bg-muted/50 p-4 rounded-lg border border-border text-sm text-muted-foreground text-left">
                    <p>
                        Click the link in the email we sent to verify your account. If you don't see it, check your spam folder.
                    </p>
                </div>

                <Button
                    onClick={handleResend}
                    disabled={isResending || resendCooldown > 0}
                    className="w-full"
                    variant="outline"
                >
                    {isResending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Resending...
                        </>
                    ) : resendCooldown > 0 ? (
                        <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Resend in {resendCooldown}s
                        </>
                    ) : (
                        "Resend Verification Email"
                    )}
                </Button>

                <button
                    type="button"
                    onClick={onLogin}
                    className="text-primary hover:underline font-medium text-sm"
                >
                    Back to Login
                </button>
            </div>
        </AuthLayout>
    );
}
