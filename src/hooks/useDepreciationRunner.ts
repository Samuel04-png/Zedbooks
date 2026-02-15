import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { companyService, payrollService } from "@/services/firebase";

interface DepreciationResult {
  success: boolean;
  period: string;
  assets_processed: number;
  total_depreciation: number;
  posted_to_gl: boolean;
  results: {
    asset_id: string;
    asset_name: string;
    asset_number: string;
    depreciation_amount: number;
    new_nbv: number;
    method: string;
  }[];
  error?: string;
}

interface RunDepreciationParams {
  periodMonth: string;
  postToGL?: boolean;
}

export function useDepreciationRunner() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const runDepreciation = useMutation({
    mutationFn: async ({ periodMonth, postToGL = true }: RunDepreciationParams): Promise<DepreciationResult> => {
      if (!user) throw new Error("Not authenticated");

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) throw new Error("No company found");

      const data = await payrollService.runDepreciation({
        companyId: membership.companyId,
        periodMonth,
        postToGL,
      });

      return {
        success: data.success,
        period: periodMonth,
        assets_processed: data.assetsProcessed,
        total_depreciation: data.totalDepreciation,
        posted_to_gl: Boolean(postToGL),
        results: [],
      };
    },
    onSuccess: (data) => {
      toast.success(
        `Depreciation completed: ${data.assets_processed} assets, K${data.total_depreciation.toFixed(2)} total`,
      );
      queryClient.invalidateQueries({ queryKey: ["asset-depreciation"] });
      queryClient.invalidateQueries({ queryKey: ["fixed-assets"] });
      queryClient.invalidateQueries({ queryKey: ["depreciable-assets"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to run depreciation");
    },
  });

  return {
    runDepreciation,
    isRunning: runDepreciation.isPending,
    lastResult: runDepreciation.data,
  };
}
