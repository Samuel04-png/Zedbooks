import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Logo } from "@/components/common/Logo";
import { ByteBerryWatermark } from "@/components/common/ByteBerryWatermark";

interface AuthLayoutProps {
    children: ReactNode;
    title: string;
    subtitle: string;
    visualContent?: ReactNode;
}

export function AuthLayout({ children, title, subtitle, visualContent }: AuthLayoutProps) {
    return (
        <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 overflow-hidden bg-background">
            {/* Left Panel - Visuals */}
            <div className="hidden lg:flex relative flex-col justify-between p-12 bg-[#0F172A] text-white overflow-hidden">
                {/* Background Gradients/Blobs */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid-pattern.svg')] opacity-10" />
                    <div className="absolute -left-[20%] -top-[20%] w-[60%] h-[60%] bg-blue-600/20 rounded-full blur-[120px]" />
                    <div className="absolute -right-[20%] -bottom-[20%] w-[60%] h-[60%] bg-indigo-600/20 rounded-full blur-[120px]" />
                </div>

                {/* Logo */}
                <div className="relative z-10">
                    <Logo variant="full" size="lg" className="text-white [&_span]:text-white" />
                </div>

                {/* Central Visual */}
                <div className="relative z-10 flex-1 flex items-center justify-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="w-full max-w-md"
                    >
                        {visualContent}
                    </motion.div>
                </div>

                {/* Quote / Footer */}
                <div className="relative z-10 space-y-4">
                    <blockquote className="space-y-2">
                        <p className="text-lg font-medium text-slate-200 leading-relaxed">
                            "ZedBooks has completely transformed how we manage our organization's finances. It's not just a ledger; it's peace of mind."
                        </p>
                        <footer className="text-sm text-slate-400">
                            — Sarah M., Financial Director
                        </footer>
                    </blockquote>
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className="relative flex flex-col items-center justify-center p-6 sm:p-12 lg:p-24 bg-background">
                {/* Mobile Logo */}
                <div className="lg:hidden absolute top-6 left-6">
                    <Logo variant="full" size="md" />
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="w-full max-w-[440px] space-y-8"
                >
                    <div className="space-y-2 text-center lg:text-left">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
                        <p className="text-muted-foreground">{subtitle}</p>
                    </div>

                    <div className="bg-card/50 backdrop-blur-sm rounded-xl">
                        {children}
                    </div>
                </motion.div>

                {/* Watermark */}
                <div className="absolute bottom-4 right-4 text-xs text-muted-foreground/50">
                    <ByteBerryWatermark />
                </div>
            </div>
        </div>
    );
}
