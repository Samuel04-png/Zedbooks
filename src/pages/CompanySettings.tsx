import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { CompanyLogoUpload } from "@/components/payroll/CompanyLogoUpload";

export default function CompanySettings() {
  const queryClient = useQueryClient();
  const [companyName, setCompanyName] = useState("");
  const [isVatRegistered, setIsVatRegistered] = useState(false);
  const [vatRate, setVatRate] = useState(16);

  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.company_name || "");
      setIsVatRegistered(settings.is_vat_registered || false);
      setVatRate(settings.vat_rate || 16);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (settings) {
        const { error } = await supabase
          .from("company_settings")
          .update({
            company_name: companyName,
            is_vat_registered: isVatRegistered,
            vat_rate: vatRate,
          })
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_settings").insert({
          company_name: companyName,
          is_vat_registered: isVatRegistered,
          vat_rate: vatRate,
          user_id: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      toast.success("Settings saved successfully");
    },
    onError: (error) => {
      toast.error("Failed to save settings: " + error.message);
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Company Settings</h1>
        <p className="text-muted-foreground">
          Manage your company information and tax settings
        </p>
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
            <CardDescription>
              Configure VAT registration for ZRA compliance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>VAT Registered</Label>
                <p className="text-sm text-muted-foreground">
                  Are you registered for VAT with ZRA?
                </p>
              </div>
              <Switch
                checked={isVatRegistered}
                onCheckedChange={setIsVatRegistered}
              />
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
                <p className="text-xs text-muted-foreground">
                  Standard Zambian VAT rate is 16%
                </p>
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
