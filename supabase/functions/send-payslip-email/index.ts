import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendPayslipRequest {
  employeeName: string;
  employeeEmail: string;
  period: string;
  companyName: string;
  companyLogoUrl?: string;
  payslipData: {
    basicSalary: number;
    housingAllowance: number;
    transportAllowance: number;
    otherAllowances: number;
    additionalEarnings: number;
    grossSalary: number;
    napsa: number;
    nhima: number;
    paye: number;
    advancesDeducted: number;
    totalDeductions: number;
    netSalary: number;
    employeeNo: string;
    position: string;
    department: string;
    tpin: string;
    napsaNo: string;
    nhimaNo: string;
    bankName: string;
    accountNumber: string;
  };
  password: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { employeeName, employeeEmail, period, companyName, companyLogoUrl, payslipData, password }: SendPayslipRequest = await req.json();

    console.log("Sending payslip email to:", employeeEmail);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
          .payslip { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; }
          .header-content { display: flex; justify-content: space-between; align-items: center; }
          .company-info { display: flex; align-items: center; gap: 15px; }
          .company-logo { width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
          .company-logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
          .payslip-title { text-align: right; }
          .payslip-title h1 { margin: 0; font-size: 28px; }
          .payslip-title p { margin: 5px 0 0; opacity: 0.9; }
          .content { padding: 30px; }
          .section { margin-bottom: 25px; }
          .section-title { font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #f9fafb; border-radius: 8px; padding: 15px; }
          .info-item { display: flex; justify-content: space-between; }
          .info-label { color: #6b7280; }
          .info-value { font-weight: 600; }
          .table { width: 100%; border-collapse: collapse; }
          .table td { padding: 12px 15px; border-bottom: 1px solid #e5e7eb; }
          .table .label { color: #6b7280; }
          .table .amount { text-align: right; font-weight: 500; }
          .table .total-row { background: #f0fdf4; font-weight: 600; }
          .table .total-row.deduction { background: #fef2f2; }
          .net-pay-box { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; border-radius: 8px; padding: 20px; display: flex; justify-content: space-between; align-items: center; }
          .net-pay-label { font-size: 14px; opacity: 0.9; }
          .net-pay-sublabel { font-size: 12px; opacity: 0.7; }
          .net-pay-amount { font-size: 32px; font-weight: bold; }
          .footer { background: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb; }
          .footer p { margin: 5px 0; font-size: 12px; color: #6b7280; }
          .password-box { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 10px 15px; display: inline-block; margin: 10px 0; }
          .password-box strong { color: #92400e; }
        </style>
      </head>
      <body>
        <div class="payslip">
          <div class="header">
            <div class="header-content">
              <div class="company-info">
                <div class="company-logo">
                  ${companyLogoUrl ? `<img src="${companyLogoUrl}" alt="Logo" />` : `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V7l8-4v18M13 21V3l6 4v14M9 9v.01M9 12v.01M9 15v.01M9 18v.01"/></svg>`}
                </div>
                <div>
                  <h2 style="margin: 0; font-size: 20px;">${companyName}</h2>
                </div>
              </div>
              <div class="payslip-title">
                <h1>PAYSLIP</h1>
                <p>${period}</p>
              </div>
            </div>
          </div>

          <div class="content">
            <div class="section">
              <div class="section-title">Employee Details</div>
              <div class="info-grid">
                <div class="info-item"><span class="info-label">Name:</span><span class="info-value">${employeeName}</span></div>
                <div class="info-item"><span class="info-label">Employee No:</span><span class="info-value">${payslipData.employeeNo}</span></div>
                <div class="info-item"><span class="info-label">Position:</span><span class="info-value">${payslipData.position || 'N/A'}</span></div>
                <div class="info-item"><span class="info-label">Department:</span><span class="info-value">${payslipData.department || 'N/A'}</span></div>
                <div class="info-item"><span class="info-label">TPIN:</span><span class="info-value">${payslipData.tpin || 'N/A'}</span></div>
                <div class="info-item"><span class="info-label">NAPSA No:</span><span class="info-value">${payslipData.napsaNo || 'N/A'}</span></div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
              <div class="section">
                <div class="section-title">Earnings</div>
                <table class="table">
                  <tr><td class="label">Basic Salary</td><td class="amount">K${payslipData.basicSalary.toFixed(2)}</td></tr>
                  <tr><td class="label">Housing Allowance</td><td class="amount">K${payslipData.housingAllowance.toFixed(2)}</td></tr>
                  <tr><td class="label">Transport Allowance</td><td class="amount">K${payslipData.transportAllowance.toFixed(2)}</td></tr>
                  <tr><td class="label">Other Allowances</td><td class="amount">K${payslipData.otherAllowances.toFixed(2)}</td></tr>
                  ${payslipData.additionalEarnings > 0 ? `<tr><td class="label">Additional Earnings</td><td class="amount">K${payslipData.additionalEarnings.toFixed(2)}</td></tr>` : ''}
                  <tr class="total-row"><td class="label">Gross Pay</td><td class="amount">K${payslipData.grossSalary.toFixed(2)}</td></tr>
                </table>
              </div>

              <div class="section">
                <div class="section-title">Deductions</div>
                <table class="table">
                  <tr><td class="label">NAPSA (5%)</td><td class="amount">K${payslipData.napsa.toFixed(2)}</td></tr>
                  <tr><td class="label">NHIMA (1%)</td><td class="amount">K${payslipData.nhima.toFixed(2)}</td></tr>
                  <tr><td class="label">PAYE</td><td class="amount">K${payslipData.paye.toFixed(2)}</td></tr>
                  ${payslipData.advancesDeducted > 0 ? `<tr><td class="label">Advances</td><td class="amount">K${payslipData.advancesDeducted.toFixed(2)}</td></tr>` : ''}
                  <tr class="total-row deduction"><td class="label">Total Deductions</td><td class="amount">K${payslipData.totalDeductions.toFixed(2)}</td></tr>
                </table>
              </div>
            </div>

            <div class="net-pay-box">
              <div>
                <div class="net-pay-label">Net Pay</div>
                <div class="net-pay-sublabel">Amount payable to employee</div>
              </div>
              <div class="net-pay-amount">K${payslipData.netSalary.toFixed(2)}</div>
            </div>

            ${payslipData.bankName ? `
            <div class="section" style="margin-top: 20px;">
              <div class="section-title">Payment Details</div>
              <div class="info-grid" style="grid-template-columns: 1fr;">
                <div class="info-item"><span class="info-label">Bank:</span><span class="info-value">${payslipData.bankName}</span></div>
                <div class="info-item"><span class="info-label">Account:</span><span class="info-value">${payslipData.accountNumber || 'N/A'}</span></div>
              </div>
            </div>
            ` : ''}
          </div>

          <div class="footer">
            <p><strong>This payslip is confidential and password-protected.</strong></p>
            <div class="password-box">
              <strong>Password: ${password}</strong>
            </div>
            <p>Generated on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: `${companyName} Payroll <onboarding@resend.dev>`,
      to: [employeeEmail],
      subject: `Your Payslip for ${period}`,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending payslip email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
