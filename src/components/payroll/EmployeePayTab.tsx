import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatZMW } from "@/utils/zambianTaxCalculations";

interface EmployeePayTabProps {
  form: UseFormReturn<any>;
}

export function EmployeePayTab({ form }: EmployeePayTabProps) {
  const basicSalary = Number(form.watch("basic_salary")) || 0;
  const housingAllowance = Number(form.watch("housing_allowance")) || 0;
  const transportAllowance = Number(form.watch("transport_allowance")) || 0;
  const otherAllowances = Number(form.watch("other_allowances")) || 0;
  const grossSalary = basicSalary + housingAllowance + transportAllowance + otherAllowances;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="rate_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rate Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || "monthly"}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="basic_salary"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Basic Pay (ZMW) *</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" placeholder="5000.00" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="pay_rate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pay Rate</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" placeholder="Rate per period" {...field} />
              </FormControl>
              <FormDescription>Optional alternative rate</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="border-t pt-4">
        <h3 className="text-lg font-medium mb-4">Allowances</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="housing_allowance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Housing Allowance (ZMW)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="1500.00" {...field} />
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
                  <Input type="number" step="0.01" placeholder="500.00" {...field} />
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
                  <Input type="number" step="0.01" placeholder="0.00" {...field} />
                </FormControl>
                <FormDescription>Meal, medical, or other fixed allowances</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="text-lg font-medium mb-4">Overtime Rates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="overtime_rate_multiplier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Overtime Multiplier</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" placeholder="1.5" {...field} />
                </FormControl>
                <FormDescription>e.g., 1.5 = time and a half</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* Summary Card */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-lg">Pay Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Basic Salary</p>
              <p className="text-lg font-semibold">{formatZMW(basicSalary)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Housing</p>
              <p className="text-lg font-semibold">{formatZMW(housingAllowance)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Transport</p>
              <p className="text-lg font-semibold">{formatZMW(transportAllowance)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Gross Salary</p>
              <p className="text-xl font-bold text-primary">{formatZMW(grossSalary)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
