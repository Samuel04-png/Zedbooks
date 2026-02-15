import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { EmployeePayrollSetup } from "@/components/payroll/EmployeePayrollSetup";
import { LoadingState } from "@/components/ui/LoadingState";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";

export default function EmployeePayrollSetupPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

      const data = employeeSnap.data() as Record<string, unknown>;
      const companyId = (data.companyId ?? data.company_id) as string | undefined;
      if (companyId && companyId !== membership.companyId) return null;

      return {
        id: employeeSnap.id,
        ...data,
      } as Record<string, unknown>;
    },
    enabled: Boolean(id && user),
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (!employee) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Employee not found</p>
        <Button variant="link" onClick={() => navigate("/employees")}>
          Go back to employees
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/employees")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Employees
        </Button>
      </div>

      <EmployeePayrollSetup
        employeeId={String(employee.id)}
        employeeName={String(employee.fullName ?? employee.full_name ?? "Employee")}
        contractType={String(employee.contractType ?? employee.contract_type ?? "") || undefined}
        basicSalary={Number(employee.basicSalary ?? employee.basic_salary ?? 0)}
        onClose={() => navigate("/employees")}
      />
    </div>
  );
}
