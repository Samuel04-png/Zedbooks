import { Navigate, useLocation } from "react-router-dom";
import { useHasRole, AppRole, canAccessRoute } from "@/hooks/useUserRole";

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export function RoleProtectedRoute({ children, allowedRoles }: RoleProtectedRouteProps) {
  const location = useLocation();
  const { hasRole, isLoading, userRole } = useHasRole(allowedRoles || []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // If specific roles are required, check against those
  if (allowedRoles && allowedRoles.length > 0) {
    if (!hasRole) {
      return <Navigate to="/dashboard" replace state={{ from: location, unauthorized: true }} />;
    }
    return <>{children}</>;
  }

  // Otherwise, check against route-based permissions
  if (!canAccessRoute(userRole, location.pathname)) {
    return <Navigate to="/dashboard" replace state={{ from: location, unauthorized: true }} />;
  }

  return <>{children}</>;
}
