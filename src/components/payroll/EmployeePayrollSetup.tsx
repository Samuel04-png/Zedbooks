import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Plus, Trash2, AlertCircle, Save } from "lucide-react";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { Badge } from "@/components/ui/badge";

interface EmployeePayrollSetupProps {
  employeeId: string;
  employeeName: string;
  contractType?: string;
  basicSalary: number;
  onClose?: () => void;
}

interface Allowance {
  id?: string;
  allowance_type: string;
  allowance_name: string;
  amount: number;
  is_taxable: boolean;
}

const ALLOWANCE_TYPES = [
  { value: "housing", label: "Housing Allowance" },
  { value: "transport", label: "Transport Allowance" },
  { value: "meal", label: "Meal Allowance" },
  { value: "medical", label: "Medical Allowance" },
  { value: "phone", label: "Phone Allowance" },
  { value: "fuel", label: "Fuel Allowance" },
  { value: "education", label: "Education Allowance" },
  { value: "custom", label: "Custom Allowance" },
];

export function EmployeePayrollSetup({
  employeeId,
  employeeName,
  contractType,
  basicSalary,
  onClose,
}: EmployeePayrollSetupProps) {
  const queryClient = useQueryClient();
  const isConsultant = contractType === "consultant";

  const [profile, setProfile] = useState({
    apply_paye: !isConsultant,
    apply_napsa: !isConsultant,
    apply_nhima: !isConsultant,
    pension_enabled: false,
    pension_employee_rate: 5,
    pension_employer_rate: 5,
    is_consultant: isConsultant,
    consultant_type: "local" as "local" | "non_resident",
    apply_wht: isConsultant,
    rate_type: "monthly",
    currency: "ZMW",
  });

  const [allowances, setAllowances] = useState<Allowance[]>([]);
  const [newAllowance, setNewAllowance] = useState<Allowance>({
    allowance_type: "housing",
    allowance_name: "Housing Allowance",
    amount: 0,
    is_taxable: true,
  });

  // Fetch existing profile
  const { data: existingProfile } = useQuery({
    queryKey: ["employee-payroll-profile", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_payroll_profiles")
        .select("*")
        .eq("employee_id", employeeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing allowances
  const { data: existingAllowances } = useQuery({
    queryKey: ["employee-allowances", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_allowances")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (existingProfile) {
      setProfile({
        apply_paye: existingProfile.apply_paye ?? !isConsultant,
        apply_napsa: existingProfile.apply_napsa ?? !isConsultant,
        apply_nhima: existingProfile.apply_nhima ?? !isConsultant,
        pension_enabled: existingProfile.pension_enabled ?? false,
        pension_employee_rate: existingProfile.pension_employee_rate ?? 5,
        pension_employer_rate: existingProfile.pension_employer_rate ?? 5,
        is_consultant: existingProfile.is_consultant ?? isConsultant,
        consultant_type: (existingProfile.consultant_type as "local" | "non_resident") ?? "local",
        apply_wht: existingProfile.apply_wht ?? isConsultant,
        rate_type: existingProfile.rate_type ?? "monthly",
        currency: existingProfile.currency ?? "ZMW",
      });
    }
  }, [existingProfile, isConsultant]);

  useEffect(() => {
    if (existingAllowances) {
      setAllowances(existingAllowances.map(a => ({
        id: a.id,
        allowance_type: a.allowance_type,
        allowance_name: a.allowance_name,
        amount: Number(a.amount),
        is_taxable: a.is_taxable,
      })));
    }
  }, [existingAllowances]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      // Upsert payroll profile
      const { error: profileError } = await supabase
        .from("employee_payroll_profiles")
        .upsert({
          employee_id: employeeId,
          company_id: userProfile?.company_id,
          ...profile,
        }, { onConflict: "employee_id" });

      if (profileError) throw profileError;

      // Handle allowances
      // First, soft-delete removed allowances
      if (existingAllowances) {
        const existingIds = existingAllowances.map(a => a.id);
        const currentIds = allowances.filter(a => a.id).map(a => a.id);
        const removedIds = existingIds.filter(id => !currentIds.includes(id));
        
        if (removedIds.length > 0) {
          await supabase
            .from("employee_allowances")
            .update({ is_active: false })
            .in("id", removedIds);
        }
      }

      // Upsert allowances
      for (const allowance of allowances) {
        if (allowance.id) {
          await supabase
            .from("employee_allowances")
            .update({
              allowance_type: allowance.allowance_type,
              allowance_name: allowance.allowance_name,
              amount: allowance.amount,
              is_taxable: allowance.is_taxable,
            })
            .eq("id", allowance.id);
        } else {
          await supabase
            .from("employee_allowances")
            .insert({
              employee_id: employeeId,
              company_id: userProfile?.company_id,
              allowance_type: allowance.allowance_type,
              allowance_name: allowance.allowance_name,
              amount: allowance.amount,
              is_taxable: allowance.is_taxable,
            });
        }
      }
    },
    onSuccess: () => {
      toast.success("Payroll setup saved successfully");
      queryClient.invalidateQueries({ queryKey: ["employee-payroll-profile", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["employee-allowances", employeeId] });
      onClose?.();
    },
    onError: (error) => {
      toast.error("Failed to save payroll setup");
      console.error(error);
    },
  });

  const addAllowance = () => {
    if (newAllowance.amount > 0) {
      setAllowances([...allowances, { ...newAllowance }]);
      setNewAllowance({
        allowance_type: "housing",
        allowance_name: "Housing Allowance",
        amount: 0,
        is_taxable: true,
      });
    }
  };

  const removeAllowance = (index: number) => {
    setAllowances(allowances.filter((_, i) => i !== index));
  };

  const totalAllowances = allowances.reduce((sum, a) => sum + a.amount, 0);
  const grossSalary = basicSalary + totalAllowances;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Payroll Setup</h2>
          <p className="text-muted-foreground">{employeeName}</p>
        </div>
        <Badge variant={isConsultant ? "secondary" : "default"}>
          {isConsultant ? "Consultant" : "Employee"}
        </Badge>
      </div>

      {/* Earnings Section */}
      <Card>
        <CardHeader>
          <CardTitle>Earnings Assignment</CardTitle>
          <CardDescription>Configure allowances for this employee</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span>Basic Pay</span>
            <span className="font-semibold">{formatZMW(basicSalary)}</span>
          </div>

          {allowances.map((allowance, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <span className="font-medium">{allowance.allowance_name}</span>
                {!allowance.is_taxable && (
                  <Badge variant="outline" className="ml-2 text-xs">Non-taxable</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{formatZMW(allowance.amount)}</span>
                <Button variant="ghost" size="sm" onClick={() => removeAllowance(index)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 p-3 border rounded-lg bg-muted/50">
            <Select
              value={newAllowance.allowance_type}
              onValueChange={(value) => {
                const type = ALLOWANCE_TYPES.find(t => t.value === value);
                setNewAllowance({
                  ...newAllowance,
                  allowance_type: value,
                  allowance_name: type?.label || value,
                });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALLOWANCE_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={newAllowance.amount || ""}
              onChange={(e) => setNewAllowance({ ...newAllowance, amount: Number(e.target.value) })}
            />
            <div className="flex items-center gap-2">
              <Switch
                checked={newAllowance.is_taxable}
                onCheckedChange={(checked) => setNewAllowance({ ...newAllowance, is_taxable: checked })}
              />
              <Label className="text-sm">Taxable</Label>
            </div>
            <Button onClick={addAllowance} disabled={newAllowance.amount <= 0}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>

          <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg font-semibold">
            <span>Gross Salary</span>
            <span className="text-lg">{formatZMW(grossSalary)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Statutory Deductions */}
      <Card>
        <CardHeader>
          <CardTitle>Statutory Deductions</CardTitle>
          <CardDescription>Configure which deductions apply to this employee</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConsultant && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Consultants are subject to Withholding Tax (WHT) instead of PAYE, NAPSA, and NHIMA.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label className="font-medium">Apply PAYE</Label>
                <p className="text-sm text-muted-foreground">Pay As You Earn tax</p>
              </div>
              <Switch
                checked={profile.apply_paye}
                onCheckedChange={(checked) => setProfile({ ...profile, apply_paye: checked })}
                disabled={isConsultant}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label className="font-medium">Apply NAPSA</Label>
                <p className="text-sm text-muted-foreground">5% of gross (max K1,342)</p>
              </div>
              <Switch
                checked={profile.apply_napsa}
                onCheckedChange={(checked) => setProfile({ ...profile, apply_napsa: checked })}
                disabled={isConsultant}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label className="font-medium">Apply NHIMA</Label>
                <p className="text-sm text-muted-foreground">1% of basic (max K250)</p>
              </div>
              <Switch
                checked={profile.apply_nhima}
                onCheckedChange={(checked) => setProfile({ ...profile, apply_nhima: checked })}
                disabled={isConsultant}
              />
            </div>
          </div>

          {/* Pension */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label className="font-medium">Pension Enabled</Label>
                <p className="text-sm text-muted-foreground">Optional pension contribution</p>
              </div>
              <Switch
                checked={profile.pension_enabled}
                onCheckedChange={(checked) => setProfile({ ...profile, pension_enabled: checked })}
              />
            </div>

            {profile.pension_enabled && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <Label>Employee Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={profile.pension_employee_rate}
                    onChange={(e) => setProfile({ ...profile, pension_employee_rate: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Employer Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={profile.pension_employer_rate}
                    onChange={(e) => setProfile({ ...profile, pension_employer_rate: Number(e.target.value) })}
                  />
                </div>
              </div>
            )}
          </div>

          {/* WHT for Consultants */}
          {isConsultant && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between p-4 border rounded-lg mb-4">
                <div>
                  <Label className="font-medium">Apply Withholding Tax (WHT)</Label>
                  <p className="text-sm text-muted-foreground">Tax on consultancy payments</p>
                </div>
                <Switch
                  checked={profile.apply_wht}
                  onCheckedChange={(checked) => setProfile({ ...profile, apply_wht: checked })}
                />
              </div>

              {profile.apply_wht && (
                <div>
                  <Label>Consultant Type</Label>
                  <Select
                    value={profile.consultant_type}
                    onValueChange={(value: "local" | "non_resident") => 
                      setProfile({ ...profile, consultant_type: value })
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local Consultant (15% WHT)</SelectItem>
                      <SelectItem value="non_resident">Non-Resident (20% WHT - Final Tax)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? "Saving..." : "Save Payroll Setup"}
        </Button>
      </div>
    </div>
  );
}
