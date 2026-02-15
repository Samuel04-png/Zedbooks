import { cn } from "@/lib/utils";

interface ByteBerryWatermarkProps {
    className?: string;
}

export function ByteBerryWatermark({ className }: ByteBerryWatermarkProps) {
    return (
        <a
            href="https://byteandberry.com/"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                "fixed bottom-4 right-4 z-50 flex items-center gap-1 text-xs font-medium text-muted-foreground/40 hover:text-primary transition-all duration-200 bg-background/50 hover:bg-background px-2 py-1 rounded-full backdrop-blur-[2px]",
                className
            )}
            aria-label="Made by Byte & Berry - Visit Website"
        >
            <span>Made by Byte & Berry</span>
        </a>
    );
}
