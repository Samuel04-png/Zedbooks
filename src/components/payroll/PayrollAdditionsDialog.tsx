import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, DollarSign, Clock, Gift, CreditCard } from "lucide-react";

interface PayrollAddition {
  id: string;
  employee_id: string;
  type: "earning" | "bonus" | "overtime" | "advance";
  name: string;
  amount: number;
  total_amount?: number;
  months_to_pay?: number;
  monthly_deduction?: number;
}

interface PayrollAdditionsDialogProps {
  employees: Array<{ id: string; full_name: string; employee_number: string }>;
  additions: PayrollAddition[];
  onAddition: (addition: Omit<PayrollAddition, "id">) => void;
  onRemove: (id: string) => void;
}

export function PayrollAdditionsDialog({
  employees,
  additions,
  onAddition,
  onRemove,
}: PayrollAdditionsDialogProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"earning" | "bonus" | "overtime" | "advance">("earning");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [monthsToPay, setMonthsToPay] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [hours, setHours] = useState("");

  const resetForm = () => {
    setSelectedEmployee("");
    setName("");
    setAmount("");
    setMonthsToPay("");
    setHourlyRate("");
    setHours("");
  };

  const handleAdd = () => {
    if (!selectedEmployee) return;

    let additionData: Omit<PayrollAddition, "id">;

    if (type === "overtime") {
      const totalAmount = Number(hourlyRate) * Number(hours);
      additionData = {
        employee_id: selectedEmployee,
        type,
        name: name || "Overtime",
        amount: totalAmount,
      };
    } else if (type === "advance") {
      const totalAdvance = Number(amount);
      const months = Number(monthsToPay) || 1;
      const monthlyDeduction = Math.ceil(totalAdvance / months);
      additionData = {
        employee_id: selectedEmployee,
        type,
        name: name || "Advance",
        amount: monthlyDeduction,
        total_amount: totalAdvance,
        months_to_pay: months,
        monthly_deduction: monthlyDeduction,
      };
    } else {
      additionData = {
        employee_id: selectedEmployee,
        type,
        name: name || (type === "bonus" ? "Bonus" : "Additional Earning"),
        amount: Number(amount),
      };
    }

    onAddition(additionData);
    resetForm();
    setOpen(false);
  };

  const getTypeIcon = (t: string) => {
    switch (t) {
      case "earning": return <DollarSign className="h-4 w-4" />;
      case "bonus": return <Gift className="h-4 w-4" />;
      case "overtime": return <Clock className="h-4 w-4" />;
      case "advance": return <CreditCard className="h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Earnings/Deductions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Payroll Items</DialogTitle>
          <DialogDescription>
            Assign earnings, bonuses, overtime, or advances to employees
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as PayrollAddition["type"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="earning">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Custom Earning
                  </div>
                </SelectItem>
                <SelectItem value="bonus">
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4" />
                    Bonus
                  </div>
                </SelectItem>
                <SelectItem value="overtime">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Overtime
                  </div>
                </SelectItem>
                <SelectItem value="advance">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Advance (Deduction)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Employee</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                type === "earning" ? "e.g., Commission"
                : type === "bonus" ? "e.g., Performance Bonus"
                : type === "overtime" ? "e.g., Weekend Overtime"
                : "e.g., Salary Advance"
              }
            />
          </div>

          {type === "overtime" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Hourly Rate (K)</Label>
                <Input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Hours Worked</Label>
                <Input
                  type="number"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="0"
                />
              </div>
              {hourlyRate && hours && (
                <div className="col-span-2 p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Overtime Pay</p>
                  <p className="text-lg font-semibold">K{(Number(hourlyRate) * Number(hours)).toFixed(2)}</p>
                </div>
              )}
            </div>
          ) : type === "advance" ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Advance Amount (K)</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Months to Repay</Label>
                <Input
                  type="number"
                  min="1"
                  value={monthsToPay}
                  onChange={(e) => setMonthsToPay(e.target.value)}
                  placeholder="e.g., 3"
                />
              </div>
              {amount && monthsToPay && (
                <div className="p-3 bg-muted rounded-lg space-y-1">
                  <p className="text-sm text-muted-foreground">Monthly Deduction</p>
                  <p className="text-lg font-semibold">K{Math.ceil(Number(amount) / Number(monthsToPay)).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    To be deducted from net pay over {monthsToPay} month(s)
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Amount (K)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!selectedEmployee}>
              Add to Payroll
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Show current additions */}
      {additions.length > 0 && (
        <div className="mt-4 border rounded-lg">
          <div className="p-3 border-b bg-muted/50">
            <h4 className="font-medium text-sm">Pending Additions ({additions.length})</h4>
          </div>
          <div className="divide-y max-h-48 overflow-y-auto">
            {additions.map((addition) => {
              const employee = employees.find((e) => e.id === addition.employee_id);
              return (
                <div key={addition.id} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(addition.type)}
                    <div>
                      <p className="font-medium text-sm">{addition.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {employee?.full_name} • K{addition.amount.toFixed(2)}
                        {addition.type === "advance" && ` per month for ${addition.months_to_pay} months`}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => onRemove(addition.id)}
                  >
                    Remove
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Dialog>
  );
}
