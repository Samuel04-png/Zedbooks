import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  periodMonth: string; // Format: YYYY-MM
  postToGL?: boolean;
}

export function useDepreciationRunner() {
  const queryClient = useQueryClient();

  const runDepreciation = useMutation({
    mutationFn: async ({ periodMonth, postToGL = true }: RunDepreciationParams): Promise<DepreciationResult> => {
      // Get current user and company
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) throw new Error("No company found");

      const { data, error } = await supabase.functions.invoke("run-depreciation", {
        body: {
          company_id: profile.company_id,
          period_month: periodMonth,
          user_id: user.id,
          post_to_gl: postToGL,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data as DepreciationResult;
    },
    onSuccess: (data) => {
      toast.success(
        `Depreciation completed: ${data.assets_processed} assets, K${data.total_depreciation.toFixed(2)} total`
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
