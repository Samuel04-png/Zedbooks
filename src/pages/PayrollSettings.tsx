import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { firestore } from "@/integrations/firebase/client";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Save, Settings, Trash2 } from "lucide-react";

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

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function PayrollSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [taxBands, setTaxBands] = useState<TaxBand[]>([]);
  const [rates, setRates] = useState<StatutoryRate[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const companyQuery = useQuery({
    queryKey: ["payroll-settings-company-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      return membership?.companyId ?? null;
    },
    enabled: Boolean(user),
  });

  const companyId = companyQuery.data ?? null;

  const { data: existingBands, isLoading: bandsLoading } = useQuery({
    queryKey: ["paye-tax-bands", companyId],
    queryFn: async () => {
      if (!companyId) return [] as TaxBand[];

      const ref = collection(firestore, COLLECTIONS.PAYE_TAX_BANDS);
      const snapshot = await getDocs(query(ref, where("companyId", "==", companyId)));

      return snapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            band_order: toNumber(row.bandOrder ?? row.band_order, 0),
            min_amount: toNumber(row.minAmount ?? row.min_amount, 0),
            max_amount: toNullableNumber(row.maxAmount ?? row.max_amount),
            rate: toNumber(row.rate, 0),
            is_active: Boolean(row.isActive ?? row.is_active ?? true),
          };
        })
        .filter((band) => band.is_active)
        .sort((a, b) => a.band_order - b.band_order)
        .map(({ is_active: _isActive, ...band }) => band);
    },
    enabled: Boolean(companyId),
  });

  const { data: existingRates, isLoading: ratesLoading } = useQuery({
    queryKey: ["statutory-rates", companyId],
    queryFn: async () => {
      if (!companyId) return [] as StatutoryRate[];

      const ref = collection(firestore, COLLECTIONS.PAYROLL_STATUTORY_RATES);
      const snapshot = await getDocs(query(ref, where("companyId", "==", companyId)));

      return snapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            rate_type: String(row.rateType ?? row.rate_type ?? ""),
            employee_rate: toNumber(row.employeeRate ?? row.employee_rate, 0),
            employer_rate: toNumber(row.employerRate ?? row.employer_rate, 0),
            cap_amount: toNullableNumber(row.capAmount ?? row.cap_amount),
            is_active: Boolean(row.isActive ?? row.is_active ?? true),
          };
        })
        .filter((rate) => rate.is_active)
        .map(({ is_active: _isActive, ...rate }) => rate);
    },
    enabled: Boolean(companyId),
  });

  useEffect(() => {
    if (isInitialized) return;
    if (bandsLoading || ratesLoading) return;

    if (existingBands && existingBands.length > 0) {
      setTaxBands(existingBands);
    } else {
      setTaxBands(DEFAULT_TAX_BANDS);
    }

    if (existingRates && existingRates.length > 0) {
      setRates(existingRates);
    } else {
      setRates(DEFAULT_RATES);
    }

    setIsInitialized(true);
  }, [isInitialized, bandsLoading, ratesLoading, existingBands, existingRates]);

  const saveBandsMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company context found");

      const ref = collection(firestore, COLLECTIONS.PAYE_TAX_BANDS);
      const existingSnapshot = await getDocs(query(ref, where("companyId", "==", companyId)));

      const batch = writeBatch(firestore);
      existingSnapshot.docs.forEach((docSnap) => {
        batch.set(docSnap.ref, { isActive: false, updatedAt: serverTimestamp() }, { merge: true });
      });

      taxBands.forEach((band, index) => {
        const nextRef = doc(collection(firestore, COLLECTIONS.PAYE_TAX_BANDS));
        batch.set(nextRef, {
          companyId,
          bandOrder: index + 1,
          minAmount: Number(band.min_amount),
          maxAmount: band.max_amount === null ? null : Number(band.max_amount),
          rate: Number(band.rate),
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
    },
    onSuccess: () => {
      toast.success("PAYE tax bands saved successfully");
      queryClient.invalidateQueries({ queryKey: ["paye-tax-bands", companyId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save tax bands");
    },
  });

  const saveRatesMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company context found");

      const ref = collection(firestore, COLLECTIONS.PAYROLL_STATUTORY_RATES);
      const existingSnapshot = await getDocs(query(ref, where("companyId", "==", companyId)));

      const batch = writeBatch(firestore);
      existingSnapshot.docs.forEach((docSnap) => {
        batch.set(docSnap.ref, { isActive: false, updatedAt: serverTimestamp() }, { merge: true });
      });

      rates.forEach((rate) => {
        const nextRef = doc(collection(firestore, COLLECTIONS.PAYROLL_STATUTORY_RATES));
        batch.set(nextRef, {
          companyId,
          rateType: rate.rate_type,
          employeeRate: Number(rate.employee_rate),
          employerRate: Number(rate.employer_rate),
          capAmount: rate.cap_amount === null ? null : Number(rate.cap_amount),
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
    },
    onSuccess: () => {
      toast.success("Statutory rates saved successfully");
      queryClient.invalidateQueries({ queryKey: ["statutory-rates", companyId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save statutory rates");
    },
  });

  const addTaxBand = () => {
    const lastBand = taxBands[taxBands.length - 1];
    setTaxBands([
      ...taxBands,
      {
        band_order: taxBands.length + 1,
        min_amount: lastBand?.max_amount || 0,
        max_amount: null,
        rate: 0,
      },
    ]);
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
      case "napsa":
        return "NAPSA";
      case "nhima":
        return "NHIMA";
      case "pension":
        return "Pension";
      case "wht_local":
        return "WHT (Local Consultant)";
      case "wht_nonresident":
        return "WHT (Non-Resident)";
      default:
        return type;
    }
  };

  const isLoading = companyQuery.isLoading || bandsLoading || ratesLoading;

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
                Configure the progressive tax bands for Pay As You Earn calculations.
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
                          onChange={(event) => updateBand(index, "min_amount", Number(event.target.value))}
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={band.max_amount ?? ""}
                          onChange={(event) =>
                            updateBand(index, "max_amount", event.target.value ? Number(event.target.value) : null)
                          }
                          placeholder="inf"
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={band.rate * 100}
                          onChange={(event) => updateBand(index, "rate", Number(event.target.value) / 100)}
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
                <Button variant="outline" onClick={addTaxBand} disabled={!companyId || isLoading}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Band
                </Button>
                <Button
                  onClick={() => saveBandsMutation.mutate()}
                  disabled={saveBandsMutation.isPending || !companyId || isLoading}
                >
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
                Configure NAPSA, NHIMA, Pension, and WHT rates.
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
                          onChange={(event) => updateRate(index, "employee_rate", Number(event.target.value) / 100)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={rate.employer_rate * 100}
                          onChange={(event) => updateRate(index, "employer_rate", Number(event.target.value) / 100)}
                          className="w-24"
                          disabled={rate.rate_type.startsWith("wht")}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={rate.cap_amount ?? ""}
                          onChange={(event) =>
                            updateRate(index, "cap_amount", event.target.value ? Number(event.target.value) : null)
                          }
                          placeholder="No cap"
                          className="w-32"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-end">
                <Button
                  onClick={() => saveRatesMutation.mutate()}
                  disabled={saveRatesMutation.isPending || !companyId || isLoading}
                >
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
