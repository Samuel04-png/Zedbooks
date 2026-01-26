import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ZRAInvoiceRequest {
  invoice_id: string;
  company_tpin: string;
  customer_tpin?: string;
  invoice_number: string;
  invoice_date: string;
  subtotal: number;
  vat_amount: number;
  total: number;
  items: {
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }[];
}

interface ZRAResponse {
  success: boolean;
  zra_invoice_number?: string;
  qr_code?: string;
  verification_url?: string;
  error?: string;
  message?: string;
}

// Mock ZRA API - simulates ZRA Smart Invoice API behavior
async function mockZRASubmission(request: ZRAInvoiceRequest): Promise<ZRAResponse> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

  // Simulate occasional API failures (10% chance)
  if (Math.random() < 0.1) {
    return {
      success: false,
      error: "ZRA_SERVICE_UNAVAILABLE",
      message: "ZRA Smart Invoice service is temporarily unavailable. Invoice queued for retry.",
    };
  }

  // Validate TPIN format (10 digits)
  if (!request.company_tpin || !/^\d{10}$/.test(request.company_tpin)) {
    return {
      success: false,
      error: "INVALID_TPIN",
      message: "Company TPIN must be exactly 10 digits",
    };
  }

  // Generate mock ZRA invoice number
  const dateCode = request.invoice_date.replace(/-/g, "").slice(2);
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const zraInvoiceNumber = `ZRA${dateCode}${randomSuffix}`;

  // Generate mock QR code data (base64 encoded JSON)
  const qrData = {
    zra_number: zraInvoiceNumber,
    tpin: request.company_tpin,
    total: request.total,
    vat: request.vat_amount,
    date: request.invoice_date,
    verification_url: `https://zra.org.zm/verify/${zraInvoiceNumber}`,
  };
  const qrCode = btoa(JSON.stringify(qrData));

  console.log(`[ZRA Mock] Invoice ${request.invoice_number} submitted successfully`);
  console.log(`[ZRA Mock] Generated ZRA Number: ${zraInvoiceNumber}`);

  return {
    success: true,
    zra_invoice_number: zraInvoiceNumber,
    qr_code: qrCode,
    verification_url: `https://zra.org.zm/verify/${zraInvoiceNumber}`,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, ...payload } = await req.json();

    console.log(`[ZRA Smart Invoice] Action: ${action}`);

    switch (action) {
      case "submit_invoice": {
        const { invoice_id } = payload;

        // Get invoice details with company info
        const { data: invoice, error: invoiceError } = await supabaseClient
          .from("invoices")
          .select(`
            *,
            invoice_items (*),
            customers (name, tpin)
          `)
          .eq("id", invoice_id)
          .single();

        if (invoiceError || !invoice) {
          throw new Error(`Invoice not found: ${invoiceError?.message}`);
        }

        // Get company TPIN
        const { data: company, error: companyError } = await supabaseClient
          .from("companies")
          .select("tpin, name, tax_type")
          .eq("id", invoice.company_id)
          .single();

        if (companyError || !company?.tpin) {
          throw new Error("Company TPIN not configured. Please update company settings.");
        }

        if (company.tax_type !== "vat_registered") {
          throw new Error("Only VAT-registered companies can submit to ZRA Smart Invoice");
        }

        // Prepare ZRA request
        const zraRequest: ZRAInvoiceRequest = {
          invoice_id,
          company_tpin: company.tpin,
          customer_tpin: invoice.customers?.tpin || undefined,
          invoice_number: invoice.invoice_number,
          invoice_date: invoice.invoice_date,
          subtotal: invoice.subtotal,
          vat_amount: invoice.vat_amount || 0,
          total: invoice.total,
          items: (invoice.invoice_items || []).map((item: any) => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            amount: item.amount,
          })),
        };

        // Submit to ZRA (mock)
        const zraResponse = await mockZRASubmission(zraRequest);

        // Update invoice with ZRA response
        if (zraResponse.success) {
          await supabaseClient
            .from("invoices")
            .update({
              zra_invoice_number: zraResponse.zra_invoice_number,
              zra_qr_code: zraResponse.qr_code,
              zra_submission_status: "approved",
              zra_submitted_at: new Date().toISOString(),
            })
            .eq("id", invoice_id);

          console.log(`[ZRA] Invoice ${invoice.invoice_number} approved: ${zraResponse.zra_invoice_number}`);
        } else {
          // Queue for retry
          await supabaseClient
            .from("invoices")
            .update({
              zra_submission_status: "pending",
            })
            .eq("id", invoice_id);

          console.log(`[ZRA] Invoice ${invoice.invoice_number} queued for retry`);
        }

        return new Response(JSON.stringify(zraResponse), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "check_status": {
        const { invoice_id } = payload;

        const { data: invoice } = await supabaseClient
          .from("invoices")
          .select("zra_invoice_number, zra_qr_code, zra_submission_status, zra_submitted_at")
          .eq("id", invoice_id)
          .single();

        return new Response(JSON.stringify({
          success: true,
          status: invoice?.zra_submission_status || "not_submitted",
          zra_invoice_number: invoice?.zra_invoice_number,
          zra_qr_code: invoice?.zra_qr_code,
          submitted_at: invoice?.zra_submitted_at,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "retry_pending": {
        // Get all pending invoices and retry submission
        const { data: pendingInvoices } = await supabaseClient
          .from("invoices")
          .select("id, invoice_number")
          .eq("zra_submission_status", "pending")
          .eq("is_deleted", false);

        const results = [];
        for (const inv of pendingInvoices || []) {
          // Recursive call to submit each pending invoice
          try {
            const { data: invoice } = await supabaseClient
              .from("invoices")
              .select(`*, invoice_items (*), customers (name, tpin)`)
              .eq("id", inv.id)
              .single();

            const { data: company } = await supabaseClient
              .from("companies")
              .select("tpin")
              .eq("id", invoice.company_id)
              .single();

            if (company?.tpin) {
              const zraRequest: ZRAInvoiceRequest = {
                invoice_id: inv.id,
                company_tpin: company.tpin,
                customer_tpin: invoice.customers?.tpin,
                invoice_number: invoice.invoice_number,
                invoice_date: invoice.invoice_date,
                subtotal: invoice.subtotal,
                vat_amount: invoice.vat_amount || 0,
                total: invoice.total,
                items: (invoice.invoice_items || []).map((item: any) => ({
                  description: item.description,
                  quantity: item.quantity,
                  unit_price: item.unit_price,
                  amount: item.amount,
                })),
              };

              const response = await mockZRASubmission(zraRequest);
              if (response.success) {
                await supabaseClient
                  .from("invoices")
                  .update({
                    zra_invoice_number: response.zra_invoice_number,
                    zra_qr_code: response.qr_code,
                    zra_submission_status: "approved",
                    zra_submitted_at: new Date().toISOString(),
                  })
                  .eq("id", inv.id);
              }
              results.push({ invoice_id: inv.id, ...response });
            }
          } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            results.push({ invoice_id: inv.id, success: false, error: errorMessage });
          }
        }

        return new Response(JSON.stringify({
          success: true,
          processed: results.length,
          results,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({
          success: false,
          error: "Unknown action",
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("[ZRA Smart Invoice] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
