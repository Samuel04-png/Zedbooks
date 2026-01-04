import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Heart, Building2, FileCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { CompanyLogoUpload } from "@/components/payroll/CompanyLogoUpload";

export default function CompanySetup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [isVatRegistered, setIsVatRegistered] = useState(false);
  const [vatRate, setVatRate] = useState("16");

  const setupMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if settings already exist
      const { data: existing } = await supabase
        .from("company_settings")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("company_settings")
          .update({
            company_name: companyName,
            is_vat_registered: isVatRegistered,
            vat_rate: parseFloat(vatRate),
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_settings").insert({
          user_id: user.id,
          company_name: companyName,
          is_vat_registered: isVatRegistered,
          vat_rate: parseFloat(vatRate),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      toast.success("Company setup complete!");
      navigate("/dashboard");
    },
    onError: (error) => {
      toast.error("Setup failed: " + error.message);
    },
  });

  const handleNext = () => {
    if (step === 1 && !companyName) {
      toast.error("Please enter your company name");
      return;
    }
    if (step < 3) {
      setStep(step + 1);
    } else {
      setupMutation.mutate();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-accent p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-background mb-4">
            <Heart className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to ZedBooks</h1>
          <p className="text-white/90">Let's set up your organization</p>
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center mb-6 gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 w-16 rounded-full transition-colors ${
                s <= step ? "bg-white" : "bg-white/30"
              }`}
            />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {step === 1 && <Building2 className="h-5 w-5" />}
              {step === 2 && <Heart className="h-5 w-5" />}
              {step === 3 && <FileCheck className="h-5 w-5" />}
              {step === 1 && "Company Information"}
              {step === 2 && "Company Branding"}
              {step === 3 && "Tax Settings"}
            </CardTitle>
            <CardDescription>
              {step === 1 && "Enter your organization's basic details"}
              {step === 2 && "Upload your company logo"}
              {step === 3 && "Configure VAT and tax settings"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Company Name *</Label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Your Organization Name"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <CompanyLogoUpload />
                <p className="text-sm text-muted-foreground">
                  Your logo will appear on invoices, payslips, and reports.
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>VAT Registered</Label>
                    <p className="text-sm text-muted-foreground">
                      Is your organization registered for VAT?
                    </p>
                  </div>
                  <Switch checked={isVatRegistered} onCheckedChange={setIsVatRegistered} />
                </div>
                {isVatRegistered && (
                  <div className="space-y-2">
                    <Label>VAT Rate (%)</Label>
                    <Input
                      type="number"
                      value={vatRate}
                      onChange={(e) => setVatRate(e.target.value)}
                      placeholder="16"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between pt-4">
              {step > 1 ? (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              ) : (
                <div />
              )}
              <Button onClick={handleNext} disabled={setupMutation.isPending}>
                {step < 3 ? (
                  <>
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                ) : setupMutation.isPending ? (
                  "Completing Setup..."
                ) : (
                  "Complete Setup"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-white/70 mt-6">
          Step {step} of 3
        </p>
      </div>
    </div>
  );
}
