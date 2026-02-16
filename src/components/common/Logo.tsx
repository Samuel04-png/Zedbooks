import { cn } from "@/lib/utils";

interface LogoProps {
    variant?: "full" | "icon" | "text";
    size?: "sm" | "md" | "lg" | "xl";
    className?: string;
}

export function Logo({ variant = "full", size = "md", className }: LogoProps) {
    const sizeClasses = {
        sm: "h-8 w-8",
        md: "h-10 w-10",
        lg: "h-12 w-12",
        xl: "h-16 w-16",
    };

    const textSizes = {
        sm: "text-base",
        md: "text-xl",
        lg: "text-2xl",
        xl: "text-3xl",
    };

    const subTextSizes = {
        sm: "text-[8px]",
        md: "text-[10px]",
        lg: "text-xs",
        xl: "text-sm",
    };

    return (
        <div className={cn("flex items-center gap-3", className)}>
            {variant !== "text" && (
                <div className={cn("relative flex items-center justify-center transition-all duration-300", sizeClasses[size])}>
                    <img
                        src={`${import.meta.env.BASE_URL}logo_new.png`}
                        alt="ZedBooks"
                        className="h-full w-full object-contain drop-shadow-sm"
                    />
                    {/* Subtle glow effect behind logo for premium feel */}
                    <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-xl -z-10 scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>
            )}

            {(variant === "full" || variant === "text") && (
                <div className="flex flex-col select-none">
                    <span className={cn("font-bold leading-none tracking-tight", textSizes[size])}>
                        ZedBooks
                    </span>
                    <span className={cn("font-medium uppercase tracking-wider opacity-60", subTextSizes[size])}>
                        Purpose Ledger
                    </span>
                </div>
            )}
        </div>
    );
}
