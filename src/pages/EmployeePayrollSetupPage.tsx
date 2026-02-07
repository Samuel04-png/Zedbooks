import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { EmployeePayrollSetup } from "@/components/payroll/EmployeePayrollSetup";
import { LoadingState } from "@/components/ui/LoadingState";

export default function EmployeePayrollSetupPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
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
        employeeId={employee.id}
        employeeName={employee.full_name}
        contractType={employee.contract_type || undefined}
        basicSalary={Number(employee.basic_salary)}
        onClose={() => navigate("/employees")}
      />
    </div>
  );
}
