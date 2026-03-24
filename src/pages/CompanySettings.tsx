import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CompanyLogoUpload } from "@/components/payroll/CompanyLogoUpload";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";

type OrganizationType = "business" | "non_profit";

const BUSINESS_TYPES = [
  { value: "sme", label: "SME" },
  { value: "ngo", label: "NGO" },
  { value: "school", label: "School" },
  { value: "corporate", label: "Corporate" },
];

const INDUSTRY_TYPES = [
  "Agriculture",
  "Construction",
  "Education",
  "Financial Services",
  "Healthcare",
  "Hospitality",
  "Information Technology",
  "Manufacturing",
  "Mining",
  "Non-Profit",
  "Professional Services",
  "Retail",
  "Transportation",
  "Wholesale",
  "Other",
];

const BUSINESS_TAX_OPTIONS = [
  { value: "vat_registered", label: "VAT Registered" },
  { value: "turnover_tax", label: "Turnover Tax" },
  { value: "non_vat", label: "Non-VAT Registered" },
];

const NON_PROFIT_TAX_CLASSIFICATIONS = [
  { value: "charitable", label: "Registered Charitable Organization" },
  { value: "faith_based", label: "Faith-Based Organization" },
  { value: "educational", label: "Educational Non-profit" },
  { value: "grant_funded", label: "Grant-Funded NGO" },
];

interface CompanySettingsForm {
  name: string;
  organizationType: OrganizationType;
  businessType: string;
  industryType: string;
  registrationNumber: string;
  tpin: string;
  email: string;
  phone: string;
  address: string;
  taxType: string;
  taxClassification: string;
  vatRate: number;
}

export default function CompanySettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [formData, setFormData] = useState<CompanySettingsForm>({
    name: "",
    organizationType: "business",
    businessType: "sme",
    industryType: "",
    registrationNumber: "",
    tpin: "",
    email: "",
    phone: "",
    address: "",
    taxType: "non_vat",
    taxClassification: "",
    vatRate: 16,
  });

  const updateField = <K extends keyof CompanySettingsForm>(field: K, value: CompanySettingsForm[K]) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const { data: membership } = useQuery({
    queryKey: ["primary-membership", user?.id],
    queryFn: async () => {
      if (!user) return null;
      return companyService.getPrimaryMembershipByUser(user.id);
    },
    enabled: Boolean(user),
  });

  const companyId = membership?.companyId;

  const { data: company, isLoading: isCompanyLoading } = useQuery({
    queryKey: ["company", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      return companyService.getCompanyById(companyId);
    },
    enabled: Boolean(companyId),
  });

  const { data: settings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ["company-settings", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      return companyService.getCompanySettings(companyId);
    },
    enabled: Boolean(companyId),
  });

  useEffect(() => {
    if (!company && !settings) return;

    setFormData({
      name: company?.name || settings?.companyName || "",
      organizationType: company?.organizationType ?? "business",
      businessType: company?.businessType || "sme",
      industryType: company?.industryType || "",
      registrationNumber: company?.registrationNumber || "",
      tpin: company?.tpin || "",
      email: company?.email || "",
      phone: company?.phone || "",
      address: company?.address || "",
      taxType: company?.taxType || (settings?.isVatRegistered ? "vat_registered" : "non_vat"),
      taxClassification: company?.taxClassification || "",
      vatRate: Number(settings?.vatRate ?? 16),
    });
  }, [company, settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) {
        throw new Error("No company linked to your account.");
      }

      const normalizedName = formData.name.trim();
      if (!normalizedName) {
        throw new Error("Company name is required.");
      }

      const normalizedTpin = formData.tpin.replace(/\D/g, "");
      if (normalizedTpin && normalizedTpin.length !== 10) {
        throw new Error("TPIN must be exactly 10 digits.");
      }

      const normalizedTaxType = formData.organizationType === "business"
        ? formData.taxType
        : "tax_exempt";
      const normalizedTaxClassification = formData.organizationType === "business"
        ? formData.taxType
        : formData.taxClassification || null;
      const isVatRegistered = formData.organizationType === "business" && formData.taxType === "vat_registered";

      await companyService.updateCompanyBasics({
        companyId,
        name: normalizedName,
        organizationType: formData.organizationType,
        businessType: formData.organizationType === "business" ? formData.businessType : null,
        industryType: formData.industryType || null,
        registrationNumber: formData.registrationNumber || null,
        tpin: normalizedTpin || null,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        taxType: normalizedTaxType,
        taxClassification: normalizedTaxClassification,
        isVatRegistered,
        vatRate: isVatRegistered ? formData.vatRate : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company"] });
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      toast.success("Company settings updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to save settings: " + (error instanceof Error ? error.message : "Unknown error"));
    },
  });

  if (isCompanyLoading || isSettingsLoading) {
    return <div>Loading...</div>;
  }

  const isBusiness = formData.organizationType === "business";
  const showVatRate = isBusiness && formData.taxType === "vat_registered";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Company Settings</h1>
        <p className="text-muted-foreground">Manage your company profile, contacts, and tax settings</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>Update how your company appears across invoices and reports</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CompanyLogoUpload
              companyName={formData.name}
              onCompanyNameChange={(value) => updateField("name", value)}
              autoSaveCompanyName={false}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact & Registration</CardTitle>
            <CardDescription>Maintain the official details used across the system</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="organization-type">Organization Type</Label>
              <Select
                value={formData.organizationType}
                onValueChange={(value: OrganizationType) => updateField("organizationType", value)}
              >
                <SelectTrigger id="organization-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="non_profit">Non-Profit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isBusiness && (
              <div className="space-y-2">
                <Label htmlFor="business-type">Business Type</Label>
                <Select
                  value={formData.businessType}
                  onValueChange={(value) => updateField("businessType", value)}
                >
                  <SelectTrigger id="business-type">
                    <SelectValue placeholder="Select business type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="industry-type">Industry</Label>
              <Select
                value={formData.industryType || "unselected"}
                onValueChange={(value) => updateField("industryType", value === "unselected" ? "" : value)}
              >
                <SelectTrigger id="industry-type">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unselected">Not specified</SelectItem>
                  {INDUSTRY_TYPES.map((industry) => (
                    <SelectItem key={industry} value={industry}>
                      {industry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="registration-number">Registration Number</Label>
              <Input
                id="registration-number"
                value={formData.registrationNumber}
                onChange={(e) => updateField("registrationNumber", e.target.value)}
                placeholder="Enter registration number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tpin">TPIN</Label>
              <Input
                id="tpin"
                value={formData.tpin}
                onChange={(e) => updateField("tpin", e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10-digit TPIN"
                inputMode="numeric"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-email">Company Email</Label>
              <Input
                id="company-email"
                type="email"
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="company@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-phone">Phone Number</Label>
              <Input
                id="company-phone"
                value={formData.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="Enter company phone number"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="company-address">Address</Label>
              <Textarea
                id="company-address"
                value={formData.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="Enter registered address"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Tax Settings</CardTitle>
            <CardDescription>Keep your company tax profile aligned with setup and reporting</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {isBusiness ? (
              <div className="space-y-2">
                <Label htmlFor="tax-type">Tax Type</Label>
                <Select
                  value={formData.taxType}
                  onValueChange={(value) => updateField("taxType", value)}
                >
                  <SelectTrigger id="tax-type">
                    <SelectValue placeholder="Select tax type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TAX_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="tax-classification">Tax Classification</Label>
                <Select
                  value={formData.taxClassification || "unselected"}
                  onValueChange={(value) => updateField("taxClassification", value === "unselected" ? "" : value)}
                >
                  <SelectTrigger id="tax-classification">
                    <SelectValue placeholder="Select classification" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unselected">Not specified</SelectItem>
                    {NON_PROFIT_TAX_CLASSIFICATIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="vat-status">VAT Status</Label>
              <Input
                id="vat-status"
                value={showVatRate ? "VAT Registered" : "VAT Not Registered"}
                readOnly
              />
            </div>

            {showVatRate && (
              <div className="space-y-2">
                <Label htmlFor="vat-rate">VAT Rate (%)</Label>
                <Input
                  id="vat-rate"
                  type="number"
                  value={formData.vatRate}
                  onChange={(e) => updateField("vatRate", Number(e.target.value) || 0)}
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
