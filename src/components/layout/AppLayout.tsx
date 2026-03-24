import { ReactNode, Suspense, lazy, useEffect, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { ProtectedRoute } from "./ProtectedRoute";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu } from "lucide-react";
import { ByteBerryWatermark } from "@/components/common/ByteBerryWatermark";
import { warmCommonRoutes } from "@/lib/pagePreloaders";
import { useLocation } from "react-router-dom";

interface AppLayoutProps {
  children: ReactNode;
}

const DeferredAIAssistant = lazy(() =>
  import("@/components/ai/AIAssistant").then((module) => ({
    default: module.AIAssistant,
  })),
);

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [shouldLoadAssistant, setShouldLoadAssistant] = useState(false);

  useEffect(() => {
    if (shouldLoadAssistant) return;

    let timeoutId: number | null = null;
    let idleId: number | null = null;
    const mountAssistant = () => setShouldLoadAssistant(true);

    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(mountAssistant, { timeout: 2000 });
    } else {
      timeoutId = window.setTimeout(mountAssistant, 1400);
    }

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      if (idleId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [shouldLoadAssistant]);

  useEffect(() => {
    let timeoutId: number | null = null;
    let idleId: number | null = null;
    const warmRoutes = () => warmCommonRoutes(location.pathname);

    timeoutId = window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(warmRoutes, { timeout: 1200 });
        return;
      }

      warmRoutes();
    }, 250);

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      if (idleId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [location.pathname]);

  return (
    <ProtectedRoute>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <SidebarInset className="relative flex-1 overflow-hidden bg-[linear-gradient(180deg,rgba(15,23,42,0.03)_0%,rgba(255,255,255,0.98)_22%,rgba(248,250,252,1)_100%)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.09),transparent_68%)]" />
            {/* Mobile Header with Menu Trigger */}
            <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border/60 bg-background/92 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:hidden">
              <SidebarTrigger className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                  <span className="text-xs font-bold">Z</span>
                </div>
                <span className="font-semibold text-foreground">ZedBooks</span>
              </div>
            </header>
            <main className="relative mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">
              {children}
            </main>

            {/* Watermark - Global */}
            <ByteBerryWatermark />

            {/* AI Assistant - Global */}
            {shouldLoadAssistant ? (
              <Suspense fallback={null}>
                <DeferredAIAssistant />
              </Suspense>
            ) : null}
          </SidebarInset>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
