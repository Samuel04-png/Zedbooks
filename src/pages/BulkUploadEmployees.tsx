import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";

interface CsvEmployeeRow {
  full_name?: string | null;
  employee_number?: string | null;
  position?: string | null;
  department?: string | null;
  email?: string | null;
  phone?: string | null;
  basic_salary?: string | null;
  housing_allowance?: string | null;
  transport_allowance?: string | null;
  other_allowances?: string | null;
  employment_date?: string | null;
  employment_status?: string | null;
  tpin?: string | null;
  napsa_number?: string | null;
  nhima_number?: string | null;
  bank_name?: string | null;
  bank_branch?: string | null;
  bank_account_number?: string | null;
}

const chunk = <T,>(items: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

export default function BulkUploadEmployees() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const downloadTemplate = () => {
    const headers = [
      "full_name",
      "employee_number",
      "position",
      "department",
      "email",
      "phone",
      "basic_salary",
      "housing_allowance",
      "transport_allowance",
      "other_allowances",
      "employment_date",
      "employment_status",
      "tpin",
      "napsa_number",
      "nhima_number",
      "bank_name",
      "bank_branch",
      "bank_account_number",
    ];

    const sampleRow = [
      "John Doe",
      "EMP001",
      "Software Engineer",
      "IT",
      "john@example.com",
      "+260971234567",
      "15000",
      "3000",
      "1000",
      "500",
      "2024-01-01",
      "active",
      "1234567890",
      "NAPSA123",
      "NHIMA123",
      "Zanaco",
      "Cairo Road",
      "1234567890",
    ];

    const csvContent = [headers.join(","), sampleRow.join(",")].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employee_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Template downloaded");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const parseCSV = (text: string): CsvEmployeeRow[] => {
    const lines = text.split("\n").filter((line) => line.trim());
    const headers = lines[0].split(",").map((h) => h.trim());

    return lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const obj: CsvEmployeeRow = {};
      headers.forEach((header, index) => {
        obj[header as keyof CsvEmployeeRow] = values[index] || null;
      });
      return obj;
    });
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    setIsUploading(true);

    try {
      if (!user) throw new Error("Not authenticated");

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) {
        throw new Error("No company profile found for your account");
      }

      const text = await file.text();
      const employees = parseCSV(text);

      const employeesToInsert = employees.map((emp) => ({
        userId: user.id,
        companyId: membership.companyId,
        fullName: emp.full_name || "",
        employeeNumber: emp.employee_number || "",
        position: emp.position || null,
        department: emp.department || null,
        email: emp.email || null,
        phone: emp.phone || null,
        basicSalary: emp.basic_salary ? Number(emp.basic_salary) : 0,
        housingAllowance: emp.housing_allowance ? Number(emp.housing_allowance) : 0,
        transportAllowance: emp.transport_allowance ? Number(emp.transport_allowance) : 0,
        otherAllowances: emp.other_allowances ? Number(emp.other_allowances) : 0,
        employmentDate: emp.employment_date || null,
        employmentStatus: emp.employment_status || "active",
        tpin: emp.tpin || null,
        napsaNumber: emp.napsa_number || null,
        nhimaNumber: emp.nhima_number || null,
        bankName: emp.bank_name || null,
        bankBranch: emp.bank_branch || null,
        bankAccountNumber: emp.bank_account_number || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      const employeesRef = collection(firestore, COLLECTIONS.EMPLOYEES);
      const batches = chunk(employeesToInsert, 400);

      for (const records of batches) {
        const batch = writeBatch(firestore);
        records.forEach((employee) => {
          batch.set(doc(employeesRef), employee);
        });
        await batch.commit();
      }

      toast.success(`Successfully uploaded ${employeesToInsert.length} employees`);
      navigate("/employees");
    } catch (error) {
      toast.error("Failed to upload employees. Please check your CSV format.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/employees")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Bulk Upload Employees</h1>
          <p className="text-muted-foreground">Upload multiple employees using a CSV file</p>
        </div>
      </div>

      <div className="border rounded-lg p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>Download the CSV template below</li>
            <li>Fill in your employee data following the template format</li>
            <li>
              Make sure all required fields are filled (full_name, employee_number, basic_salary,
              employment_date)
            </li>
            <li>Save your file as CSV format</li>
            <li>Upload your completed CSV file</li>
          </ol>
        </div>

        <div className="flex gap-4">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Download Template
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Upload CSV File</label>
            <Input type="file" accept=".csv" onChange={handleFileChange} disabled={isUploading} />
          </div>

          {file && <div className="text-sm text-muted-foreground">Selected file: {file.name}</div>}
        </div>

        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => navigate("/employees")}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={isUploading || !file}>
            <Upload className="mr-2 h-4 w-4" />
            {isUploading ? "Uploading..." : "Upload Employees"}
          </Button>
        </div>
      </div>
    </div>
  );
}
