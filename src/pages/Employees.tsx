import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { companyService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";

interface EmployeeRecord {
  id: string;
  employeeNumber: string;
  fullName: string;
  position: string | null;
  department: string | null;
  basicSalary: number;
  employmentStatus: string;
}

export default function Employees() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: userRole } = useUserRole();
  const canDeleteEmployees = userRole === "super_admin" || userRole === "admin";

  const { data: employees, isLoading, refetch } = useQuery({
    queryKey: ["employees", user?.id],
    queryFn: async () => {
      if (!user) return [] as EmployeeRecord[];

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) return [] as EmployeeRecord[];

      const employeesRef = collection(firestore, COLLECTIONS.EMPLOYEES);
      const snapshot = await getDocs(query(employeesRef, where("companyId", "==", membership.companyId)));

      const rows = snapshot.docs.map((docSnap) => {
        const row = docSnap.data() as Record<string, unknown>;

        return {
          id: docSnap.id,
          employeeNumber: String(row.employeeNumber ?? row.employee_number ?? ""),
          fullName: String(row.fullName ?? row.full_name ?? ""),
          position: (row.position as string | null) ?? null,
          department: (row.department as string | null) ?? null,
          basicSalary: Number(row.basicSalary ?? row.basic_salary ?? 0),
          employmentStatus: String(row.employmentStatus ?? row.employment_status ?? "active"),
        } satisfies EmployeeRecord;
      });

      rows.sort((a, b) => a.fullName.localeCompare(b.fullName));
      return rows;
    },
    enabled: Boolean(user),
  });

  const handleDelete = async (id: string) => {
    if (!canDeleteEmployees) {
      toast.error("Only Admin users can delete employee records.");
      return;
    }
    if (!confirm("Are you sure you want to delete this employee?")) return;

    try {
      await deleteDoc(doc(firestore, COLLECTIONS.EMPLOYEES, id));
      toast.success("Employee deleted successfully");
      refetch();
    } catch (error) {
      toast.error("Failed to delete employee");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Employees</h1>
          <p className="text-muted-foreground">Manage your employee records</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/employees/bulk-upload")}>
            <Upload className="mr-2 h-4 w-4" />
            Bulk Upload
          </Button>
          <Button onClick={() => navigate("/employees/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Basic Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees?.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.employeeNumber}</TableCell>
                  <TableCell>{employee.fullName}</TableCell>
                  <TableCell>{employee.position || "-"}</TableCell>
                  <TableCell>{employee.department || "-"}</TableCell>
                  <TableCell>{formatZMW(employee.basicSalary)}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        employee.employmentStatus === "active"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                      }`}
                    >
                      {employee.employmentStatus}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/employees/${employee.id}/edit`)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {canDeleteEmployees && (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(employee.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {employees?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No employees found. Add your first employee to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
