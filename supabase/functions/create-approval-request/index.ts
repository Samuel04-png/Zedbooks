import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateApprovalRequest {
  workflow_type: string;
  record_table: string;
  record_id: string;
  amount?: number;
  notes?: string;
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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { workflow_type, record_table, record_id, amount, notes }: CreateApprovalRequest = await req.json();

    // Get user's company_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: 'User company not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the appropriate workflow based on amount
    const { data: workflow, error: workflowError } = await supabase
      .from('approval_workflows')
      .select('*')
      .eq('company_id', profile.company_id)
      .eq('workflow_type', workflow_type)
      .eq('is_active', true)
      .lte('min_amount', amount || 0)
      .order('min_amount', { ascending: false })
      .limit(1)
      .single();

    // Default to accountant if no workflow found
    const approverRole = workflow?.required_role || 'accountant';

    // Create the approval request
    const { data: approvalRequest, error: createError } = await supabase
      .from('approval_requests')
      .insert({
        company_id: profile.company_id,
        workflow_type,
        record_table,
        record_id,
        requested_by: user.id,
        current_approver_role: approverRole,
        amount,
        notes,
        status: 'pending'
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    // Update the record's approval status
    await supabase
      .from(record_table)
      .update({ approval_status: 'pending' })
      .eq('id', record_id);

    // Notify users with the required role
    const { data: approvers } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', approverRole);

    if (approvers) {
      for (const approver of approvers) {
        await supabase.rpc('create_notification', {
          p_user_id: approver.user_id,
          p_title: 'Approval Required',
          p_message: `A ${workflow_type} request requires your approval`,
          p_type: 'approval_required',
          p_related_table: record_table,
          p_related_id: record_id,
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      approval_request: approvalRequest 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error creating approval request:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
