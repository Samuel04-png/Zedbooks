import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ZRASubmitResponse {
  success: boolean;
  zra_invoice_number?: string;
  qr_code?: string;
  verification_url?: string;
  error?: string;
  message?: string;
}

export function useZRAInvoice(invoiceId?: string) {
  const queryClient = useQueryClient();

  // Get ZRA status for an invoice
  const { data: zraStatus, isLoading: isLoadingStatus } = useQuery({
    queryKey: ["zra-status", invoiceId],
    queryFn: async () => {
      if (!invoiceId) return null;

      const { data, error } = await supabase.functions.invoke("zra-smart-invoice", {
        body: { action: "check_status", invoice_id: invoiceId },
      });

      if (error) throw error;
      return data;
    },
    enabled: !!invoiceId,
  });

  // Submit invoice to ZRA
  const submitToZRA = useMutation({
    mutationFn: async (invoice_id: string): Promise<ZRASubmitResponse> => {
      const { data, error } = await supabase.functions.invoke("zra-smart-invoice", {
        body: { action: "submit_invoice", invoice_id },
      });

      if (error) throw error;
      return data as ZRASubmitResponse;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Invoice submitted to ZRA: ${data.zra_invoice_number}`);
        queryClient.invalidateQueries({ queryKey: ["invoices"] });
        queryClient.invalidateQueries({ queryKey: ["zra-status"] });
      } else {
        toast.warning(data.message || "Invoice queued for ZRA submission");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to submit to ZRA");
    },
  });

  // Retry pending invoices
  const retryPending = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("zra-smart-invoice", {
        body: { action: "retry_pending" },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Processed ${data.processed} pending invoices`);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["zra-status"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to retry pending invoices");
    },
  });

  return {
    zraStatus,
    isLoadingStatus,
    submitToZRA,
    retryPending,
    isSubmitting: submitToZRA.isPending,
    isRetrying: retryPending.isPending,
  };
}
