import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  employeeName: string;
  employeeEmail: string;
  companyName: string;
  temporaryPassword: string;
  loginUrl: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for verification
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user identity using getClaims
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("Auth error:", claimsError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Check user role - only HR, Admin, or Super Admin can send invites
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (roleError) {
      console.error("Role check error:", roleError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allowedRoles = ['admin', 'hr_manager', 'super_admin'];
    const hasAllowedRole = roleData?.some(r => allowedRoles.includes(r.role));
    
    if (!hasAllowedRole) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Only HR, Admin, or Super Admin can send employee invites.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's company for validation
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.company_id) {
      console.error("Profile error:", profileError);
      return new Response(
        JSON.stringify({ error: 'User company not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { employeeName, employeeEmail, companyName, temporaryPassword, loginUrl }: InviteRequest = await req.json();

    // Validate employee exists in user's company
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id, email, company_id')
      .eq('email', employeeEmail)
      .eq('company_id', profile.company_id)
      .single();

    if (employeeError || !employee) {
      return new Response(
        JSON.stringify({ error: 'Employee not found in your company' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending invite email to ${employeeEmail} for company ${profile.company_id}`);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "ZedBooks <onboarding@resend.dev>",
        to: [employeeEmail],
        subject: `Welcome to ${companyName} - Your ZedBooks Account`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #2563eb, #7c3aed); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to ZedBooks</h1>
              <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">Accountability with Purpose</p>
            </div>
            
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #1f2937; margin-top: 0;">Hello ${employeeName},</h2>
              
              <p>You've been added as an employee at <strong>${companyName}</strong>. Your account has been created and you can now access the ZedBooks system.</p>
              
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #374151;">Your Login Credentials</h3>
                <p style="margin: 5px 0;"><strong>Email:</strong> ${employeeEmail}</p>
                <p style="margin: 5px 0;"><strong>Temporary Password:</strong> ${temporaryPassword}</p>
              </div>
              
              <p style="color: #dc2626; font-weight: 500;">⚠️ Please change your password immediately after your first login.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${loginUrl}" style="background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Login to ZedBooks</a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px;">If you have any questions, please contact your administrator.</p>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
              <p>This email was sent by ZedBooks on behalf of ${companyName}</p>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", data);
      throw new Error(data.message || "Failed to send email");
    }

    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending invite email:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});