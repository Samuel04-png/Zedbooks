import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { CompanyLogoUpload } from "@/components/payroll/CompanyLogoUpload";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";

export default function CompanySettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [isVatRegistered, setIsVatRegistered] = useState(false);
  const [vatRate, setVatRate] = useState(16);

  const { data: membership } = useQuery({
    queryKey: ["primary-membership", user?.id],
    queryFn: async () => {
      if (!user) return null;
      return companyService.getPrimaryMembershipByUser(user.id);
    },
    enabled: Boolean(user),
  });

  const companyId = membership?.companyId;

  const { data: settings, isLoading } = useQuery({
    queryKey: ["company-settings", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      return companyService.getCompanySettings(companyId);
    },
    enabled: Boolean(companyId),
  });

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.companyName || "");
      setIsVatRegistered(Boolean(settings.isVatRegistered));
      setVatRate(Number(settings.vatRate ?? 16));
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) {
        throw new Error("No company linked to your account.");
      }

      await companyService.updateCompanyBasics({
        companyId,
        name: companyName,
      });

      await setDoc(
        doc(firestore, COLLECTIONS.COMPANY_SETTINGS, companyId),
        {
          companyId,
          companyName,
          isVatRegistered,
          vatRate: isVatRegistered ? vatRate : null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings", companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-settings", user?.id] });
      toast.success("Settings saved successfully");
    },
    onError: (error) => {
      toast.error("Failed to save settings: " + (error instanceof Error ? error.message : "Unknown error"));
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Company Settings</h1>
        <p className="text-muted-foreground">Manage your company information and tax settings</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
            <CardDescription>Basic company details and branding</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Enter company name"
              />
            </div>
            <div className="space-y-2">
              <Label>Company Logo</Label>
              <CompanyLogoUpload />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>VAT / Tax Settings</CardTitle>
            <CardDescription>Configure VAT registration for ZRA compliance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>VAT Registered</Label>
                <p className="text-sm text-muted-foreground">Are you registered for VAT with ZRA?</p>
              </div>
              <Switch checked={isVatRegistered} onCheckedChange={setIsVatRegistered} />
            </div>

            {isVatRegistered && (
              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="vat-rate">VAT Rate (%)</Label>
                <Input
                  id="vat-rate"
                  type="number"
                  value={vatRate}
                  onChange={(e) => setVatRate(Number(e.target.value))}
                  min={0}
                  max={100}
                />
                <p className="text-xs text-muted-foreground">Standard Zambian VAT rate is 16%</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
