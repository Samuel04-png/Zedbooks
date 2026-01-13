import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationRequest {
  transaction_date: string;
  company_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { transaction_date, company_id }: ValidationRequest = await req.json();

    // Check if the date is in a locked period
    const { data: isLocked, error: lockError } = await supabase
      .rpc('is_period_locked', {
        check_date: transaction_date,
        check_company_id: company_id
      });

    if (lockError) {
      throw lockError;
    }

    // Check if date is in the future (beyond today)
    const transactionDate = new Date(transaction_date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const isFutureDate = transactionDate > today;

    // Get the period lock details if locked
    let lockDetails = null;
    if (isLocked) {
      const { data: lockInfo } = await supabase
        .from('period_locks')
        .select('period_start, period_end, lock_reason')
        .eq('company_id', company_id)
        .eq('is_active', true)
        .lte('period_start', transaction_date)
        .gte('period_end', transaction_date)
        .single();
      
      lockDetails = lockInfo;
    }

    return new Response(JSON.stringify({ 
      is_valid: !isLocked && !isFutureDate,
      is_locked: isLocked,
      is_future_date: isFutureDate,
      lock_details: lockDetails,
      message: isLocked 
        ? `This date falls within a locked period (${lockDetails?.period_start} to ${lockDetails?.period_end}). ${lockDetails?.lock_reason || ''}`
        : isFutureDate 
          ? 'Future-dated transactions are not allowed'
          : 'Date is valid'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error validating date:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
