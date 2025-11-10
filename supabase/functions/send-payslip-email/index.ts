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
  payslipData: {
    basicSalary: number;
    housingAllowance: number;
    transportAllowance: number;
    otherAllowances: number;
    grossSalary: number;
    napsa: number;
    nhima: number;
    paye: number;
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
    const { employeeName, employeeEmail, period, payslipData, password }: SendPayslipRequest = await req.json();

    // Generate HTML payslip
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
          .section { margin-bottom: 30px; }
          .info-grid { display: grid; grid-template-columns: 150px 1fr; gap: 10px; }
          .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .table th, .table td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
          .table th { background-color: #f5f5f5; font-weight: bold; }
          .total-row { font-weight: bold; background-color: #f9f9f9; }
          .net-pay { font-size: 18px; color: #2563eb; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #333; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PAYSLIP</h1>
          <p>Pay Period: ${period}</p>
        </div>

        <div class="section">
          <h3>Employee Information</h3>
          <div class="info-grid">
            <div>Name:</div><div>${employeeName}</div>
            <div>Employee No:</div><div>${payslipData.employeeNo}</div>
            <div>Position:</div><div>${payslipData.position}</div>
            <div>Department:</div><div>${payslipData.department}</div>
            <div>TPIN:</div><div>${payslipData.tpin || 'N/A'}</div>
            <div>NAPSA No:</div><div>${payslipData.napsaNo || 'N/A'}</div>
            <div>NHIMA No:</div><div>${payslipData.nhimaNo || 'N/A'}</div>
          </div>
        </div>

        <div class="section">
          <h3>Earnings</h3>
          <table class="table">
            <tr>
              <td>Basic Salary</td>
              <td style="text-align: right;">K${payslipData.basicSalary.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Housing Allowance</td>
              <td style="text-align: right;">K${payslipData.housingAllowance.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Transport Allowance</td>
              <td style="text-align: right;">K${payslipData.transportAllowance.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Other Allowances</td>
              <td style="text-align: right;">K${payslipData.otherAllowances.toFixed(2)}</td>
            </tr>
            <tr class="total-row">
              <td>Gross Salary</td>
              <td style="text-align: right;">K${payslipData.grossSalary.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div class="section">
          <h3>Deductions</h3>
          <table class="table">
            <tr>
              <td>NAPSA (5%)</td>
              <td style="text-align: right;">K${payslipData.napsa.toFixed(2)}</td>
            </tr>
            <tr>
              <td>NHIMA (1%)</td>
              <td style="text-align: right;">K${payslipData.nhima.toFixed(2)}</td>
            </tr>
            <tr>
              <td>PAYE</td>
              <td style="text-align: right;">K${payslipData.paye.toFixed(2)}</td>
            </tr>
            <tr class="total-row">
              <td>Total Deductions</td>
              <td style="text-align: right;">K${payslipData.totalDeductions.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div class="section">
          <table class="table">
            <tr class="total-row net-pay">
              <td>Net Pay</td>
              <td style="text-align: right;">K${payslipData.netSalary.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div class="section">
          <h3>Payment Details</h3>
          <div class="info-grid">
            <div>Bank:</div><div>${payslipData.bankName || 'N/A'}</div>
            <div>Account:</div><div>${payslipData.accountNumber || 'N/A'}</div>
          </div>
        </div>

        <div class="footer">
          <p><strong>This document is confidential and password-protected.</strong></p>
          <p>Password: ${password}</p>
          <p>Generated on ${new Date().toLocaleDateString('en-GB')}</p>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Payroll System <onboarding@resend.dev>",
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
