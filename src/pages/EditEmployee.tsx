import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";

const employeeSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  employee_number: z.string().min(1, "Employee number is required"),
  position: z.string().optional(),
  department: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  basic_salary: z.string().min(1, "Basic salary is required"),
  housing_allowance: z.string().optional(),
  transport_allowance: z.string().optional(),
  other_allowances: z.string().optional(),
  employment_date: z.string().min(1, "Employment date is required"),
  employment_status: z.enum(["active", "inactive", "terminated"]),
  tpin: z.string().optional(),
  napsa_number: z.string().optional(),
  nhima_number: z.string().optional(),
  bank_name: z.string().optional(),
  bank_branch: z.string().optional(),
  bank_account_number: z.string().optional(),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

const toDateInputValue = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const timestamp = value as { toDate?: () => Date };
    if (typeof timestamp.toDate === "function") {
      return timestamp.toDate().toISOString().slice(0, 10);
    }
  }
  return "";
};

export default function EditEmployee() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();

  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee", id, user?.id],
    queryFn: async () => {
      if (!id || !user) return null;

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) return null;

      const employeeRef = doc(firestore, COLLECTIONS.EMPLOYEES, id);
      const employeeSnap = await getDoc(employeeRef);
      if (!employeeSnap.exists()) return null;

      const row = employeeSnap.data() as Record<string, unknown>;
      const companyId = (row.companyId ?? row.company_id) as string | undefined;
      if (companyId && companyId !== membership.companyId) return null;

      return {
        id: employeeSnap.id,
        ...row,
      } as Record<string, unknown>;
    },
    enabled: Boolean(id && user),
  });

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
  });

  useEffect(() => {
    if (employee) {
      form.reset({
        full_name: String(employee.fullName ?? employee.full_name ?? ""),
        employee_number: String(employee.employeeNumber ?? employee.employee_number ?? ""),
        position: String(employee.position ?? ""),
        department: String(employee.department ?? ""),
        email: String(employee.email ?? ""),
        phone: String(employee.phone ?? ""),
        basic_salary: String(employee.basicSalary ?? employee.basic_salary ?? ""),
        housing_allowance: String(employee.housingAllowance ?? employee.housing_allowance ?? 0),
        transport_allowance: String(employee.transportAllowance ?? employee.transport_allowance ?? 0),
        other_allowances: String(employee.otherAllowances ?? employee.other_allowances ?? 0),
        employment_date: toDateInputValue(employee.employmentDate ?? employee.employment_date),
        employment_status: String(
          employee.employmentStatus ?? employee.employment_status ?? "active",
        ) as "active" | "inactive" | "terminated",
        tpin: String(employee.tpin ?? ""),
        napsa_number: String(employee.napsaNumber ?? employee.napsa_number ?? ""),
        nhima_number: String(employee.nhimaNumber ?? employee.nhima_number ?? ""),
        bank_name: String(employee.bankName ?? employee.bank_name ?? ""),
        bank_branch: String(employee.bankBranch ?? employee.bank_branch ?? ""),
        bank_account_number: String(
          employee.bankAccountNumber ?? employee.bank_account_number ?? "",
        ),
      });
    }
  }, [employee, form]);

  const onSubmit = async (data: EmployeeFormData) => {
    try {
      if (!id || !user) {
        toast.error("You must be logged in");
        return;
      }

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) {
        toast.error("No company profile found for your account");
        return;
      }

      await setDoc(
        doc(firestore, COLLECTIONS.EMPLOYEES, id),
        {
          companyId: membership.companyId,
          employeeNumber: data.employee_number,
          fullName: data.full_name,
          position: data.position || null,
          department: data.department || null,
          email: data.email || null,
          phone: data.phone || null,
          basicSalary: Number(data.basic_salary),
          housingAllowance: data.housing_allowance ? Number(data.housing_allowance) : 0,
          transportAllowance: data.transport_allowance ? Number(data.transport_allowance) : 0,
          otherAllowances: data.other_allowances ? Number(data.other_allowances) : 0,
          employmentDate: data.employment_date,
          employmentStatus: data.employment_status,
          tpin: data.tpin || null,
          napsaNumber: data.napsa_number || null,
          nhimaNumber: data.nhima_number || null,
          bankName: data.bank_name || null,
          bankBranch: data.bank_branch || null,
          bankAccountNumber: data.bank_account_number || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      toast.success("Employee updated successfully");
      navigate("/employees");
    } catch (error) {
      toast.error("Failed to update employee");
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/employees")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Employee</h1>
          <p className="text-muted-foreground">Update employee information</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Personal Information */}
          <div className="border rounded-lg p-6 space-y-6">
            <h2 className="text-xl font-semibold">Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employee_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee Number *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employment_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employment Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employment_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employment Status *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="terminated">Terminated</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Salary Information */}
          <div className="border rounded-lg p-6 space-y-6">
            <h2 className="text-xl font-semibold">Salary Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="basic_salary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Basic Salary (ZMW) *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="housing_allowance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Housing Allowance (ZMW)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="transport_allowance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transport Allowance (ZMW)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="other_allowances"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Other Allowances (ZMW)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Statutory Information */}
          <div className="border rounded-lg p-6 space-y-6">
            <h2 className="text-xl font-semibold">Statutory Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="tpin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>TPIN</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="napsa_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NAPSA Number</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nhima_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NHIMA Number</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Bank Information */}
          <div className="border rounded-lg p-6 space-y-6">
            <h2 className="text-xl font-semibold">Bank Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="bank_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bank Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bank_branch"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bank_account_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Number</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate("/employees")}>
              Cancel
            </Button>
            <Button type="submit">Update Employee</Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
