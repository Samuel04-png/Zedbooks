import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { isFirebaseConfigured } from "@/integrations/firebase/client";

export function useCompanySettings() {
  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ["company-settings", user?.id],
    queryFn: async () => {
      if (!user || !isFirebaseConfigured) return null;

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership) return null;

      return companyService.getCompanySettings(membership.companyId);
    },
    enabled: isAuthenticated && Boolean(user),
  });
}
