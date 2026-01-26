import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DepreciationResult {
  asset_id: string;
  asset_name: string;
  asset_number: string;
  depreciation_amount: number;
  new_nbv: number;
  method: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { company_id, period_month, user_id, post_to_gl = true } = await req.json();

    if (!company_id || !period_month || !user_id) {
      throw new Error("Missing required parameters: company_id, period_month, user_id");
    }

    console.log(`[Depreciation] Running for company ${company_id}, period ${period_month}`);

    // Parse period
    const periodDate = new Date(period_month + "-01");
    const periodStart = new Date(periodDate.getFullYear(), periodDate.getMonth(), 1);
    const periodEnd = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0);
    
    const periodStartStr = periodStart.toISOString().split("T")[0];
    const periodEndStr = periodEnd.toISOString().split("T")[0];

    // Check if depreciation already run for this period
    const { data: existingRun } = await supabaseClient
      .from("asset_depreciation")
      .select("id")
      .eq("period_start", periodStartStr)
      .limit(1);

    if (existingRun && existingRun.length > 0) {
      throw new Error(`Depreciation already run for ${period_month}. Delete existing records first.`);
    }

    // Get all active fixed assets for this company
    const { data: assets, error: assetsError } = await supabaseClient
      .from("fixed_assets")
      .select(`
        *,
        asset_categories (
          depreciation_method,
          depreciation_rate,
          useful_life_years,
          depreciation_account_id,
          accumulated_depreciation_account_id
        )
      `)
      .eq("company_id", company_id)
      .eq("is_deleted", false)
      .in("status", ["active"]);

    if (assetsError) throw assetsError;

    console.log(`[Depreciation] Found ${assets?.length || 0} active assets`);

    const results: DepreciationResult[] = [];
    const depreciationEntries: any[] = [];
    const assetUpdates: any[] = [];
    let totalDepreciation = 0;

    for (const asset of assets || []) {
      const purchaseCost = Number(asset.purchase_cost) || 0;
      const residualValue = Number(asset.residual_value) || 0;
      const currentNBV = Number(asset.net_book_value) ?? purchaseCost;
      const usefulLifeMonths = Number(asset.useful_life_months) || 60;
      
      // Skip if already fully depreciated
      if (currentNBV <= residualValue) {
        console.log(`[Depreciation] Skipping ${asset.asset_number} - fully depreciated`);
        continue;
      }

      // Determine depreciation method (asset override or category default)
      const method = asset.depreciation_method || asset.asset_categories?.depreciation_method || "straight_line";
      const rate = Number(asset.depreciation_rate) || Number(asset.asset_categories?.depreciation_rate) || 20;

      let monthlyDepreciation = 0;

      if (method === "straight_line") {
        // Straight-line: (Cost - Residual) / Useful Life in months
        monthlyDepreciation = (purchaseCost - residualValue) / usefulLifeMonths;
      } else if (method === "reducing_balance") {
        // Reducing balance: NBV * Annual Rate / 12
        monthlyDepreciation = (currentNBV * (rate / 100)) / 12;
      }

      // Don't depreciate below residual value
      const maxDepreciation = currentNBV - residualValue;
      monthlyDepreciation = Math.min(monthlyDepreciation, maxDepreciation);
      monthlyDepreciation = Math.round(monthlyDepreciation * 100) / 100;

      if (monthlyDepreciation <= 0) continue;

      const newNBV = Math.round((currentNBV - monthlyDepreciation) * 100) / 100;
      const newAccumDepreciation = Math.round((Number(asset.accumulated_depreciation || 0) + monthlyDepreciation) * 100) / 100;

      depreciationEntries.push({
        asset_id: asset.id,
        period_start: periodStartStr,
        period_end: periodEndStr,
        depreciation_amount: monthlyDepreciation,
        accumulated_depreciation: newAccumDepreciation,
        net_book_value: newNBV,
        is_posted: post_to_gl,
        posted_at: post_to_gl ? new Date().toISOString() : null,
        posted_by: post_to_gl ? user_id : null,
      });

      assetUpdates.push({
        id: asset.id,
        accumulated_depreciation: newAccumDepreciation,
        net_book_value: newNBV,
        last_depreciation_date: periodEndStr,
        status: newNBV <= residualValue ? "fully_depreciated" : "active",
      });

      results.push({
        asset_id: asset.id,
        asset_name: asset.name,
        asset_number: asset.asset_number,
        depreciation_amount: monthlyDepreciation,
        new_nbv: newNBV,
        method,
      });

      totalDepreciation += monthlyDepreciation;
    }

    console.log(`[Depreciation] Calculated ${results.length} entries, total: ${totalDepreciation}`);

    // Insert depreciation records
    if (depreciationEntries.length > 0) {
      const { error: insertError } = await supabaseClient
        .from("asset_depreciation")
        .insert(depreciationEntries);

      if (insertError) throw insertError;

      // Update asset records
      for (const update of assetUpdates) {
        const { id, ...updateData } = update;
        await supabaseClient
          .from("fixed_assets")
          .update(updateData)
          .eq("id", id);
      }

      // Create GL journal entry if post_to_gl is true
      if (post_to_gl && totalDepreciation > 0) {
        // Create journal entry
        const { data: journalEntry, error: journalError } = await supabaseClient
          .from("journal_entries")
          .insert({
            user_id,
            company_id,
            entry_date: periodEndStr,
            reference_number: `DEP-${period_month}`,
            description: `Monthly depreciation for ${periodStart.toLocaleString("default", { month: "long", year: "numeric" })}`,
            is_posted: true,
            is_locked: true,
          })
          .select()
          .single();

        if (journalError) throw journalError;

        console.log(`[Depreciation] Created journal entry: ${journalEntry.id}`);

        // Get depreciation expense and accumulated depreciation accounts
        const { data: accounts } = await supabaseClient
          .from("chart_of_accounts")
          .select("id, account_code, account_name, account_type")
          .eq("company_id", company_id)
          .in("account_code", ["5100", "1200"]) // Typical codes for Dep Expense and Accum Dep
          .limit(2);

        // Create journal lines (simplified - debit expense, credit accum dep)
        // In production, this would use category-specific accounts
        if (accounts && accounts.length >= 2) {
          const expenseAccount = accounts.find(a => a.account_type === "Expense") || accounts[0];
          const accumDepAccount = accounts.find(a => a.account_type === "Asset") || accounts[1];

          await supabaseClient.from("journal_entry_lines").insert([
            {
              journal_entry_id: journalEntry.id,
              account_id: expenseAccount.id,
              description: "Monthly depreciation expense",
              debit_amount: totalDepreciation,
              credit_amount: 0,
            },
            {
              journal_entry_id: journalEntry.id,
              account_id: accumDepAccount.id,
              description: "Accumulated depreciation",
              debit_amount: 0,
              credit_amount: totalDepreciation,
            },
          ]);
        }

        // Link depreciation records to journal
        for (const entry of depreciationEntries) {
          await supabaseClient
            .from("asset_depreciation")
            .update({ journal_entry_id: journalEntry.id })
            .eq("asset_id", entry.asset_id)
            .eq("period_start", periodStartStr);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      period: period_month,
      assets_processed: results.length,
      total_depreciation: totalDepreciation,
      posted_to_gl: post_to_gl,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Depreciation] Error:", error);
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
