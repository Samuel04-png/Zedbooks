import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { toast } from "sonner";
import { ArrowLeft, Mail, Save, ChevronRight } from "lucide-react";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EmployeePersonalTab } from "@/components/payroll/EmployeePersonalTab";
import { EmployeeEngagementTab } from "@/components/payroll/EmployeeEngagementTab";
import { EmployeePayTab } from "@/components/payroll/EmployeePayTab";

const employeeSchema = z.object({
  // Personal Details
  employee_number: z.string().min(1, "Employee number is required"),
  nrc_number: z.string().optional(),
  tpin: z.string().optional(),
  napsa_number: z.string().optional(),
  nhima_number: z.string().optional(),
  full_name: z.string().min(1, "Full name is required"),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  nationality: z.string().optional(),
  marital_status: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  department: z.string().optional(),
  division: z.string().optional(),
  position: z.string().optional(),
  job_grade: z.string().optional(),
  cost_centre: z.string().optional(),
  
  // Engagement
  contract_type: z.string().optional(),
  employment_status: z.string().default("active"),
  employment_date: z.string().min(1, "Employment date is required"),
  contract_end_date: z.string().optional(),
  currency: z.string().default("ZMW"),
  pay_point: z.string().optional(),
  bank_name: z.string().optional(),
  bank_branch: z.string().optional(),
  bank_account_number: z.string().optional(),
  has_gratuity: z.boolean().default(false),
  gratuity_rate: z.string().optional(),
  
  // Pay
  rate_type: z.string().default("monthly"),
  basic_salary: z.string().min(1, "Basic salary is required"),
  pay_rate: z.string().optional(),
  housing_allowance: z.string().optional(),
  transport_allowance: z.string().optional(),
  other_allowances: z.string().optional(),
  overtime_rate_multiplier: z.string().optional(),
  
  // Options
  send_invite: z.boolean().default(false),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

export default function NewEmployee() {
  const navigate = useNavigate();
  const { data: companySettings } = useCompanySettings();
  const [activeTab, setActiveTab] = React.useState("personal");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      employment_status: "active",
      has_gratuity: false,
      send_invite: false,
      currency: "ZMW",
      rate_type: "monthly",
      nationality: "Zambian",
    },
  });

  const generateTemporaryPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const onSubmit = async (data: EmployeeFormData) => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      const { data: employee, error } = await supabase.from("employees").insert([{
        // Personal
        employee_number: data.employee_number,
        nrc_number: data.nrc_number || null,
        tpin: data.tpin || null,
        napsa_number: data.napsa_number || null,
        nhima_number: data.nhima_number || null,
        full_name: data.full_name,
        date_of_birth: data.date_of_birth || null,
        gender: data.gender || null,
        nationality: data.nationality || null,
        marital_status: data.marital_status || null,
        phone: data.phone || null,
        address: data.address || null,
        email: data.email || null,
        department: data.department || null,
        division: data.division || null,
        position: data.position || null,
        job_grade: data.job_grade || null,
        cost_centre: data.cost_centre || null,
        
        // Engagement
        contract_type: data.contract_type || null,
        employment_status: data.employment_status || 'active',
        employment_date: data.employment_date,
        contract_end_date: data.contract_end_date || null,
        has_gratuity: data.has_gratuity || false,
        gratuity_rate: data.gratuity_rate ? Number(data.gratuity_rate) : 0,
        bank_name: data.bank_name || null,
        bank_branch: data.bank_branch || null,
        bank_account_number: data.bank_account_number || null,
        
        // Pay
        basic_salary: Number(data.basic_salary),
        housing_allowance: data.housing_allowance ? Number(data.housing_allowance) : 0,
        transport_allowance: data.transport_allowance ? Number(data.transport_allowance) : 0,
        other_allowances: data.other_allowances ? Number(data.other_allowances) : 0,
        
        user_id: user.id,
        company_id: profile?.company_id,
      }]).select().single();

      if (error) {
        toast.error("Failed to create employee");
        console.error(error);
        return;
      }

      // Create payroll profile with default settings
      const isConsultant = data.contract_type === "consultant";
      await supabase.from("employee_payroll_profiles").insert({
        employee_id: employee.id,
        company_id: profile?.company_id,
        rate_type: data.rate_type,
        pay_rate: data.pay_rate ? Number(data.pay_rate) : null,
        overtime_rate_multiplier: data.overtime_rate_multiplier ? Number(data.overtime_rate_multiplier) : 1.5,
        currency: data.currency,
        apply_paye: !isConsultant,
        apply_napsa: !isConsultant,
        apply_nhima: !isConsultant,
        is_consultant: isConsultant,
        apply_wht: isConsultant,
        consultant_type: isConsultant ? "local" : null,
      });

      // Send invite email if option is checked and email is provided
      if (data.send_invite && data.email) {
        const tempPassword = generateTemporaryPassword();
        try {
          const { error: inviteError } = await supabase.functions.invoke("send-employee-invite", {
            body: {
              employeeName: data.full_name,
              employeeEmail: data.email,
              companyName: companySettings?.company_name || "ZedBooks",
              temporaryPassword: tempPassword,
              loginUrl: `${window.location.origin}/auth`,
            },
          });

          if (inviteError) {
            toast.warning("Employee created but invite email failed to send");
          }
        } catch (err) {
          toast.warning("Employee created but invite email failed to send");
        }
      }

      toast.success("Employee created successfully");
      // Navigate to payroll setup for this employee
      navigate(`/employees/${employee.id}/payroll-setup`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to create employee");
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextTab = () => {
    if (activeTab === "personal") setActiveTab("engagement");
    else if (activeTab === "engagement") setActiveTab("pay");
  };

  const prevTab = () => {
    if (activeTab === "pay") setActiveTab("engagement");
    else if (activeTab === "engagement") setActiveTab("personal");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/employees")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Add New Employee</h1>
          <p className="text-muted-foreground">Complete the onboarding form in 3 steps</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="personal" className="flex items-center gap-2">
                <span className="hidden sm:inline">1.</span> Personal Details
              </TabsTrigger>
              <TabsTrigger value="engagement" className="flex items-center gap-2">
                <span className="hidden sm:inline">2.</span> Engagement
              </TabsTrigger>
              <TabsTrigger value="pay" className="flex items-center gap-2">
                <span className="hidden sm:inline">3.</span> Pay
              </TabsTrigger>
            </TabsList>

            <Card>
              <CardContent className="pt-6">
                <TabsContent value="personal" className="mt-0">
                  <EmployeePersonalTab form={form} />
                </TabsContent>

                <TabsContent value="engagement" className="mt-0">
                  <EmployeeEngagementTab form={form} />
                </TabsContent>

                <TabsContent value="pay" className="mt-0">
                  <EmployeePayTab form={form} />
                </TabsContent>
              </CardContent>
            </Card>

            {/* Send Invite Option */}
            {activeTab === "pay" && (
              <Card>
                <CardHeader>
                  <CardTitle>Employee Invite</CardTitle>
                  <CardDescription>Send login credentials to the employee</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label>Send Invite Email</Label>
                        <p className="text-sm text-muted-foreground">
                          Send login credentials to employee's email
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={form.watch("send_invite")}
                      onCheckedChange={(checked) => form.setValue("send_invite", checked)}
                      disabled={!form.watch("email")}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={prevTab}
                disabled={activeTab === "personal"}
              >
                Previous
              </Button>
              
              <div className="flex gap-2">
                {activeTab !== "pay" ? (
                  <Button type="button" onClick={nextTab}>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={isSubmitting}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSubmitting ? "Saving..." : "Save & Setup Payroll"}
                  </Button>
                )}
              </div>
            </div>
          </Tabs>
        </form>
      </Form>
    </div>
  );
}
