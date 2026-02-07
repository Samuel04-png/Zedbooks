import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Save, Trash2, Settings } from "lucide-react";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface TaxBand {
  id?: string;
  band_order: number;
  min_amount: number;
  max_amount: number | null;
  rate: number;
}

interface StatutoryRate {
  id?: string;
  rate_type: string;
  employee_rate: number;
  employer_rate: number;
  cap_amount: number | null;
}

const DEFAULT_TAX_BANDS: TaxBand[] = [
  { band_order: 1, min_amount: 0, max_amount: 5100, rate: 0 },
  { band_order: 2, min_amount: 5100, max_amount: 7100, rate: 0.20 },
  { band_order: 3, min_amount: 7100, max_amount: 9200, rate: 0.30 },
  { band_order: 4, min_amount: 9200, max_amount: null, rate: 0.37 },
];

const DEFAULT_RATES: StatutoryRate[] = [
  { rate_type: "napsa", employee_rate: 0.05, employer_rate: 0.05, cap_amount: 1342 },
  { rate_type: "nhima", employee_rate: 0.01, employer_rate: 0.01, cap_amount: 250 },
  { rate_type: "pension", employee_rate: 0.05, employer_rate: 0.05, cap_amount: null },
  { rate_type: "wht_local", employee_rate: 0.15, employer_rate: 0, cap_amount: null },
  { rate_type: "wht_nonresident", employee_rate: 0.20, employer_rate: 0, cap_amount: null },
];

export default function PayrollSettings() {
  const queryClient = useQueryClient();
  const [taxBands, setTaxBands] = useState<TaxBand[]>([]);
  const [rates, setRates] = useState<StatutoryRate[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch company ID
  const { data: companyId } = useQuery({
    queryKey: ["user-company-id"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();
      return data?.company_id;
    },
  });

  // Fetch PAYE tax bands
  const { data: existingBands, isLoading: bandsLoading } = useQuery({
    queryKey: ["paye-tax-bands", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("paye_tax_bands")
        .select("*")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("band_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Fetch statutory rates
  const { data: existingRates, isLoading: ratesLoading } = useQuery({
    queryKey: ["statutory-rates", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("payroll_statutory_rates")
        .select("*")
        .eq("company_id", companyId)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Initialize state from database or defaults
  if (!isInitialized && !bandsLoading && !ratesLoading) {
    if (existingBands && existingBands.length > 0) {
      setTaxBands(existingBands.map(b => ({
        id: b.id,
        band_order: b.band_order,
        min_amount: Number(b.min_amount),
        max_amount: b.max_amount ? Number(b.max_amount) : null,
        rate: Number(b.rate),
      })));
    } else {
      setTaxBands(DEFAULT_TAX_BANDS);
    }

    if (existingRates && existingRates.length > 0) {
      setRates(existingRates.map(r => ({
        id: r.id,
        rate_type: r.rate_type,
        employee_rate: Number(r.employee_rate),
        employer_rate: Number(r.employer_rate),
        cap_amount: r.cap_amount ? Number(r.cap_amount) : null,
      })));
    } else {
      setRates(DEFAULT_RATES);
    }
    setIsInitialized(true);
  }

  // Save PAYE bands
  const saveBandsMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company ID");
      
      // Soft delete existing
      await supabase
        .from("paye_tax_bands")
        .update({ is_active: false })
        .eq("company_id", companyId);

      // Insert new
      const bandsToInsert = taxBands.map((band, index) => ({
        company_id: companyId,
        band_order: index + 1,
        min_amount: band.min_amount,
        max_amount: band.max_amount,
        rate: band.rate,
        is_active: true,
      }));

      const { error } = await supabase.from("paye_tax_bands").insert(bandsToInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("PAYE tax bands saved successfully");
      queryClient.invalidateQueries({ queryKey: ["paye-tax-bands"] });
    },
    onError: () => {
      toast.error("Failed to save tax bands");
    },
  });

  // Save statutory rates
  const saveRatesMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company ID");
      
      // Soft delete existing
      await supabase
        .from("payroll_statutory_rates")
        .update({ is_active: false })
        .eq("company_id", companyId);

      // Insert new
      const ratesToInsert = rates.map((rate) => ({
        company_id: companyId,
        rate_type: rate.rate_type,
        employee_rate: rate.employee_rate,
        employer_rate: rate.employer_rate,
        cap_amount: rate.cap_amount,
        is_active: true,
      }));

      const { error } = await supabase.from("payroll_statutory_rates").insert(ratesToInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Statutory rates saved successfully");
      queryClient.invalidateQueries({ queryKey: ["statutory-rates"] });
    },
    onError: () => {
      toast.error("Failed to save statutory rates");
    },
  });

  const addTaxBand = () => {
    const lastBand = taxBands[taxBands.length - 1];
    setTaxBands([...taxBands, {
      band_order: taxBands.length + 1,
      min_amount: lastBand?.max_amount || 0,
      max_amount: null,
      rate: 0,
    }]);
  };

  const removeTaxBand = (index: number) => {
    setTaxBands(taxBands.filter((_, i) => i !== index));
  };

  const updateBand = (index: number, field: keyof TaxBand, value: number | null) => {
    const updated = [...taxBands];
    updated[index] = { ...updated[index], [field]: value };
    setTaxBands(updated);
  };

  const updateRate = (index: number, field: keyof StatutoryRate, value: number | null) => {
    const updated = [...rates];
    updated[index] = { ...updated[index], [field]: value };
    setRates(updated);
  };

  const getRateLabel = (type: string) => {
    switch (type) {
      case "napsa": return "NAPSA";
      case "nhima": return "NHIMA";
      case "pension": return "Pension";
      case "wht_local": return "WHT (Local Consultant)";
      case "wht_nonresident": return "WHT (Non-Resident)";
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payroll Settings</h1>
          <p className="text-muted-foreground">Configure PAYE tax bands and statutory rates</p>
        </div>
        <Settings className="h-8 w-8 text-muted-foreground" />
      </div>

      <Tabs defaultValue="paye" className="space-y-4">
        <TabsList>
          <TabsTrigger value="paye">PAYE Tax Bands</TabsTrigger>
          <TabsTrigger value="statutory">Statutory Rates</TabsTrigger>
        </TabsList>

        <TabsContent value="paye">
          <Card>
            <CardHeader>
              <CardTitle>PAYE Tax Bands (Monthly)</CardTitle>
              <CardDescription>
                Configure the progressive tax bands for Pay As You Earn calculations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Band</TableHead>
                    <TableHead>Min Amount (ZMW)</TableHead>
                    <TableHead>Max Amount (ZMW)</TableHead>
                    <TableHead>Rate (%)</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxBands.map((band, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">Band {index + 1}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={band.min_amount}
                          onChange={(e) => updateBand(index, "min_amount", Number(e.target.value))}
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={band.max_amount ?? ""}
                          onChange={(e) => updateBand(index, "max_amount", e.target.value ? Number(e.target.value) : null)}
                          placeholder="∞"
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={band.rate * 100}
                          onChange={(e) => updateBand(index, "rate", Number(e.target.value) / 100)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTaxBand(index)}
                          disabled={taxBands.length <= 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-between">
                <Button variant="outline" onClick={addTaxBand}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Band
                </Button>
                <Button onClick={() => saveBandsMutation.mutate()} disabled={saveBandsMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {saveBandsMutation.isPending ? "Saving..." : "Save Tax Bands"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statutory">
          <Card>
            <CardHeader>
              <CardTitle>Statutory Contribution Rates</CardTitle>
              <CardDescription>
                Configure NAPSA, NHIMA, Pension, and WHT rates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contribution Type</TableHead>
                    <TableHead>Employee Rate (%)</TableHead>
                    <TableHead>Employer Rate (%)</TableHead>
                    <TableHead>Cap Amount (ZMW)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rates.map((rate, index) => (
                    <TableRow key={rate.rate_type}>
                      <TableCell className="font-medium">{getRateLabel(rate.rate_type)}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={rate.employee_rate * 100}
                          onChange={(e) => updateRate(index, "employee_rate", Number(e.target.value) / 100)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={rate.employer_rate * 100}
                          onChange={(e) => updateRate(index, "employer_rate", Number(e.target.value) / 100)}
                          className="w-24"
                          disabled={rate.rate_type.startsWith("wht")}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={rate.cap_amount ?? ""}
                          onChange={(e) => updateRate(index, "cap_amount", e.target.value ? Number(e.target.value) : null)}
                          placeholder="No cap"
                          className="w-32"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-end">
                <Button onClick={() => saveRatesMutation.mutate()} disabled={saveRatesMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {saveRatesMutation.isPending ? "Saving..." : "Save Rates"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
