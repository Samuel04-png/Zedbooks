import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";

export default function PublicNavbar() {
  const location = useLocation();
  const isAuthPage = location.pathname === "/auth";

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <img src={`${import.meta.env.BASE_URL}zedbooklogo_transparent.png`} alt="ZedBooks Logo" className="h-10 w-auto object-contain" />
            <span className="text-xl font-bold text-primary">ZedBooks</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Home
            </Link>
            <Link
              to="/#about"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              About Us
            </Link>
            <Link
              to="/#pricing"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isAuthPage && (
            <Link to="/auth">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
          )}
          <Link to="/auth">
            <Button size="sm">
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
