import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApprovalRequest {
  approval_id: string;
  action: 'approve' | 'reject';
  rejection_reason?: string;
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

    const { approval_id, action, rejection_reason }: ApprovalRequest = await req.json();

    // Get the approval request
    const { data: approvalRequest, error: approvalError } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('id', approval_id)
      .single();

    if (approvalError || !approvalRequest) {
      return new Response(JSON.stringify({ error: 'Approval request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has the required role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const approverRoles = ['super_admin', 'admin', 'financial_manager', 'accountant'];
    if (!userRole || !approverRoles.includes(userRole.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update the approval request
    const updateData = action === 'approve' 
      ? { status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() }
      : { status: 'rejected', approved_by: user.id, approved_at: new Date().toISOString(), rejection_reason };

    const { error: updateError } = await supabase
      .from('approval_requests')
      .update(updateData)
      .eq('id', approval_id);

    if (updateError) {
      throw updateError;
    }

    // Update the original record's approval status
    const { error: recordUpdateError } = await supabase
      .from(approvalRequest.record_table)
      .update({ 
        approval_status: action === 'approve' ? 'approved' : 'rejected',
        is_locked: action === 'approve' 
      })
      .eq('id', approvalRequest.record_id);

    if (recordUpdateError) {
      console.error('Error updating record:', recordUpdateError);
    }

    // Create notification for the requester
    const { error: notifError } = await supabase.rpc('create_notification', {
      p_user_id: approvalRequest.requested_by,
      p_title: action === 'approve' ? 'Request Approved' : 'Request Rejected',
      p_message: `Your ${approvalRequest.workflow_type} request has been ${action === 'approve' ? 'approved' : 'rejected'}${rejection_reason ? `: ${rejection_reason}` : ''}`,
      p_type: action === 'approve' ? 'success' : 'error',
      p_related_table: approvalRequest.record_table,
      p_related_id: approvalRequest.record_id,
    });

    if (notifError) {
      console.error('Error creating notification:', notifError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Request ${action === 'approve' ? 'approved' : 'rejected'} successfully` 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing approval:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
