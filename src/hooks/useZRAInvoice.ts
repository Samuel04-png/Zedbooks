import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { callFunction } from "@/services/firebase/functionsService";

interface ZRASubmitResponse {
  success: boolean;
  zra_invoice_number?: string;
  qr_code?: string;
  verification_url?: string;
  error?: string;
  message?: string;
}

interface ZRAStatusResponse {
  success: boolean;
  status?: string;
  zra_invoice_number?: string;
  verification_url?: string;
  message?: string;
}

export function useZRAInvoice(invoiceId?: string) {
  const queryClient = useQueryClient();

  const { data: zraStatus, isLoading: isLoadingStatus } = useQuery({
    queryKey: ["zra-status", invoiceId],
    queryFn: async (): Promise<ZRAStatusResponse | null> => {
      if (!invoiceId) return null;
      return callFunction<{ action: string; invoiceId: string }, ZRAStatusResponse>("zraSmartInvoice", {
        action: "check_status",
        invoiceId,
      });
    },
    enabled: !!invoiceId,
  });

  const submitToZRA = useMutation({
    mutationFn: async (invoice_id: string): Promise<ZRASubmitResponse> => {
      return callFunction<{ action: string; invoiceId: string }, ZRASubmitResponse>("zraSmartInvoice", {
        action: "submit_invoice",
        invoiceId: invoice_id,
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Invoice submitted to ZRA: ${data.zra_invoice_number ?? "Submitted"}`);
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

  const retryPending = useMutation({
    mutationFn: async () => {
      return callFunction<{ action: string }, { processed: number; success: boolean }>("zraSmartInvoice", {
        action: "retry_pending",
      });
    },
    onSuccess: (data) => {
      toast.success(`Processed ${data.processed ?? 0} pending invoices`);
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
