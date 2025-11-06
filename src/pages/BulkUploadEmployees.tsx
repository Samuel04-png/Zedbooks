import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Upload, Download } from "lucide-react";
import { toast } from "sonner";

export default function BulkUploadEmployees() {
  const navigate = useNavigate();
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
    toast.success("Template downloaded");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split("\n").filter(line => line.trim());
    const headers = lines[0].split(",").map(h => h.trim());
    
    return lines.slice(1).map(line => {
      const values = line.split(",").map(v => v.trim());
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || null;
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
      const text = await file.text();
      const employees = parseCSV(text);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const employeesToInsert = employees.map(emp => ({
        user_id: user.id,
        full_name: emp.full_name,
        employee_number: emp.employee_number,
        position: emp.position || null,
        department: emp.department || null,
        email: emp.email || null,
        phone: emp.phone || null,
        basic_salary: parseFloat(emp.basic_salary),
        housing_allowance: emp.housing_allowance ? parseFloat(emp.housing_allowance) : 0,
        transport_allowance: emp.transport_allowance ? parseFloat(emp.transport_allowance) : 0,
        other_allowances: emp.other_allowances ? parseFloat(emp.other_allowances) : 0,
        employment_date: emp.employment_date,
        employment_status: emp.employment_status || "active",
        tpin: emp.tpin || null,
        napsa_number: emp.napsa_number || null,
        nhima_number: emp.nhima_number || null,
        bank_name: emp.bank_name || null,
        bank_branch: emp.bank_branch || null,
        bank_account_number: emp.bank_account_number || null,
      }));

      const { error } = await supabase
        .from("employees")
        .insert(employeesToInsert);

      if (error) throw error;

      toast.success(`Successfully uploaded ${employeesToInsert.length} employees`);
      navigate("/employees");
    } catch (error) {
      console.error(error);
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
            <li>Make sure all required fields are filled (full_name, employee_number, basic_salary, employment_date)</li>
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
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </div>

          {file && (
            <div className="text-sm text-muted-foreground">
              Selected file: {file.name}
            </div>
          )}
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
