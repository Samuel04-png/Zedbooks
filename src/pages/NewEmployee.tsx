import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
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
import { useAuth } from "@/contexts/AuthContext";
import { authService, companyService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";

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
  const { user } = useAuth();
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

  const onSubmit = async (data: EmployeeFormData) => {
    setIsSubmitting(true);
    try {
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) {
        toast.error("No company profile found for your account");
        return;
      }

      const employeeRef = await addDoc(collection(firestore, COLLECTIONS.EMPLOYEES), {
        // Personal
        employeeNumber: data.employee_number,
        nrcNumber: data.nrc_number || null,
        tpin: data.tpin || null,
        napsaNumber: data.napsa_number || null,
        nhimaNumber: data.nhima_number || null,
        fullName: data.full_name,
        dateOfBirth: data.date_of_birth || null,
        gender: data.gender || null,
        nationality: data.nationality || null,
        maritalStatus: data.marital_status || null,
        phone: data.phone || null,
        address: data.address || null,
        email: data.email || null,
        department: data.department || null,
        division: data.division || null,
        position: data.position || null,
        jobGrade: data.job_grade || null,
        costCentre: data.cost_centre || null,
        
        // Engagement
        contractType: data.contract_type || null,
        employmentStatus: data.employment_status || "active",
        employmentDate: data.employment_date,
        contractEndDate: data.contract_end_date || null,
        hasGratuity: data.has_gratuity || false,
        gratuityRate: data.gratuity_rate ? Number(data.gratuity_rate) : 0,
        bankName: data.bank_name || null,
        bankBranch: data.bank_branch || null,
        bankAccountNumber: data.bank_account_number || null,
        
        // Pay
        basicSalary: Number(data.basic_salary),
        housingAllowance: data.housing_allowance ? Number(data.housing_allowance) : 0,
        transportAllowance: data.transport_allowance ? Number(data.transport_allowance) : 0,
        otherAllowances: data.other_allowances ? Number(data.other_allowances) : 0,
        
        userId: user.id,
        companyId: membership.companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create payroll profile with default settings
      const isConsultant = data.contract_type === "consultant";
      await setDoc(doc(firestore, COLLECTIONS.EMPLOYEE_PAYROLL_PROFILES, `${membership.companyId}_${employeeRef.id}`), {
        employeeId: employeeRef.id,
        companyId: membership.companyId,
        rateType: data.rate_type,
        payRate: data.pay_rate ? Number(data.pay_rate) : null,
        overtimeRateMultiplier: data.overtime_rate_multiplier ? Number(data.overtime_rate_multiplier) : 1.5,
        currency: data.currency,
        applyPaye: !isConsultant,
        applyNapsa: !isConsultant,
        applyNhima: !isConsultant,
        isConsultant: isConsultant,
        applyWht: isConsultant,
        consultantType: isConsultant ? "local" : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Send invite email if option is checked and email is provided
      if (data.send_invite && data.email) {
        try {
          await authService.sendInvitation({
            inviteeName: data.full_name,
            email: data.email,
            role: "staff",
            loginUrl: `${window.location.origin}/auth`,
          });
        } catch (err) {
          const companyName = companySettings?.companyName || "ZedBooks";
          toast.warning(`Employee created, but invite setup failed for ${companyName}`);
        }
      }

      toast.success("Employee created successfully");
      // Navigate to payroll setup for this employee
      navigate(`/employees/${employeeRef.id}/payroll-setup`);
    } catch (error) {
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
