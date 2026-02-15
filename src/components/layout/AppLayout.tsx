import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { ProtectedRoute } from "./ProtectedRoute";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu } from "lucide-react";
import { ByteBerryWatermark } from "@/components/common/ByteBerryWatermark";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <ProtectedRoute>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <SidebarInset className="flex-1">
            {/* Mobile Header with Menu Trigger */}
            <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:hidden">
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
            <main className="flex flex-col gap-4 p-4 md:p-6 lg:p-8">
              {children}
            </main>

            {/* Watermark - Global */}
            <ByteBerryWatermark />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
