import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Heart, Building2, ArrowRight, MapPin, Phone, Mail, Hash, Shield } from "lucide-react";
import { toast } from "sonner";
import { CompanyLogoUpload } from "@/components/payroll/CompanyLogoUpload";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";

type BusinessType = "sme" | "ngo" | "school" | "corporate";
type TaxType = "vat_registered" | "turnover_tax" | "non_vat" | "tax_exempt";
type OrganizationType = "business" | "non_profit";

const BUSINESS_TAX_OPTIONS: {
  value: TaxType;
  label: string;
  description: string;
}[] = [
    {
      value: "vat_registered",
      label: "VAT Registered",
      description: "For businesses with annual turnover above K800,000. 16% VAT applies.",
    },
    {
      value: "turnover_tax",
      label: "Turnover Tax",
      description: "For businesses with annual turnover below K800,000. 4% turnover tax.",
    },
    {
      value: "non_vat",
      label: "Non-VAT Registered",
      description: "Not registered for VAT. No VAT charged on sales.",
    },
  ];

const NON_PROFIT_TAX_CLASSIFICATIONS = [
  { value: "charitable", label: "Registered Charitable Organization" },
  { value: "faith_based", label: "Faith-Based Organization" },
  { value: "educational", label: "Educational Non-profit" },
  { value: "grant_funded", label: "Grant-Funded NGO" },
];

interface CompanyData {
  name: string;
  organizationType: OrganizationType;
  businessType: BusinessType;
  address: string;
  phone: string;
  email: string;
  tpin: string;
  registrationNumber: string;
  industryType: string;
  taxType: TaxType;
  taxClassification: string;
  vatRate: string;
  turnoverTaxNumber: string;
}

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

export default function CompanySetup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);

  const [companyData, setCompanyData] = useState<CompanyData>({
    name: "",
    organizationType: "business",
    businessType: "sme",
    address: "",
    phone: "",
    email: "",
    tpin: "",
    registrationNumber: "",
    industryType: "",
    taxType: "non_vat",
    taxClassification: "",
    vatRate: "16",
    turnoverTaxNumber: "",
  });

  const updateField = <K extends keyof CompanyData>(field: K, value: CompanyData[K]) => {
    setCompanyData(prev => ({ ...prev, [field]: value }));
  };

  const handleOrganizationTypeChange = (value: OrganizationType) => {
    setCompanyData((prev) => ({
      ...prev,
      organizationType: value,
      taxType: value === "business"
        ? (prev.taxType === "tax_exempt" ? "non_vat" : prev.taxType)
        : "tax_exempt",
      taxClassification: value === "business" ? "" : prev.taxClassification,
      turnoverTaxNumber: value === "business" ? prev.turnoverTaxNumber : "",
    }));
  };

  // Validate TPIN format (10 digits)
  const validateTPIN = (tpin: string): boolean => {
    return /^\d{10}$/.test(tpin);
  };

  const setupMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) throw new Error("No company associated with user");

      const isVatRegistered = companyData.organizationType === "business" && companyData.taxType === "vat_registered";
      const taxClassification =
        companyData.organizationType === "business"
          ? companyData.taxType
          : companyData.taxClassification;

      await companyService.completeCompanySetup({
        companyId: membership.companyId,
        name: companyData.name,
        organizationType: companyData.organizationType,
        businessType: companyData.businessType,
        taxType: companyData.organizationType === "business" ? companyData.taxType : "tax_exempt",
        taxClassification,
        address: companyData.address || undefined,
        phone: companyData.phone || undefined,
        email: companyData.email || undefined,
        tpin: companyData.tpin || undefined,
        registrationNumber: companyData.registrationNumber || undefined,
        industryType: companyData.industryType || undefined,
        logoUrl: companyLogoUrl,
        isVatRegistered,
        vatRate: isVatRegistered ? parseFloat(companyData.vatRate) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      queryClient.invalidateQueries({ queryKey: ["company"] });
      toast.success("Company setup complete!");
      navigate("/dashboard");
    },
    onError: (error) => {
      toast.error("Setup failed: " + error.message);
    },
  });

  const validateStep = (): boolean => {
    switch (step) {
      case 1:
        if (!companyData.name) {
          toast.error("Please enter your company name");
          return false;
        }
        if (!companyData.phone) {
          toast.error("Phone number is required");
          return false;
        }
        if (!companyData.email) {
          toast.error("Email is required");
          return false;
        }
        if (!companyData.tpin) {
          toast.error("TPIN is required for ZRA compliance");
          return false;
        }
        if (!validateTPIN(companyData.tpin)) {
          toast.error("TPIN must be exactly 10 digits");
          return false;
        }
        return true;
      case 2:
        if (!companyLogoUrl) {
          toast.error("Company logo is required");
          return false;
        }
        return true;
      case 3:
        if (companyData.organizationType === "business" && companyData.taxType === "turnover_tax" && !companyData.turnoverTaxNumber) {
          toast.error("Please enter your Turnover Tax number");
          return false;
        }
        if (companyData.organizationType === "non_profit" && !companyData.taxClassification) {
          toast.error("Please select a non-profit tax classification");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateStep()) return;

    if (step < 3) {
      setStep(step + 1);
    } else {
      setupMutation.mutate();
    }
  };

  const getStepIcon = () => {
    switch (step) {
      case 1: return <Building2 className="h-5 w-5" />;
      case 2: return <Heart className="h-5 w-5" />;
      case 3: return <Shield className="h-5 w-5" />;
      default: return null;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 1: return "Company Information";
      case 2: return "Company Branding";
      case 3: return "Tax Registration";
      default: return "";
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 1: return "Enter your organization's registration details";
      case 2: return "Upload your company logo";
      case 3: return companyData.organizationType === "business"
        ? "Configure your business tax registration type"
        : "Select your non-profit tax classification";
      default: return "";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden p-4">
      {/* Background blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -left-[10%] -top-[10%] w-[40%] h-[40%] bg-blue-900/5 rounded-full blur-3xl" />
        <div className="absolute -right-[10%] -bottom-[10%] w-[40%] h-[40%] bg-indigo-900/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-xl relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-sm mb-4 border border-border/50">
            <Heart className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome to ZedBooks</h1>
          <p className="text-slate-500">Let's set up your organization for ZRA compliance</p>
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center mb-6 gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 w-16 rounded-full transition-all duration-300 ${s <= step ? "bg-primary" : "bg-slate-200"
                }`}
            />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStepIcon()}
              {getStepTitle()}
            </CardTitle>
            <CardDescription>{getStepDescription()}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Company Name *</Label>
                  <Input
                    value={companyData.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="Your Organization Name"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label>Organization Type *</Label>
                  <Select
                    value={companyData.organizationType}
                    onValueChange={(v) => handleOrganizationTypeChange(v as OrganizationType)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select organization type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="non_profit">Non-profit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Business Type *</Label>
                  <Select
                    value={companyData.businessType}
                    onValueChange={(v) => updateField("businessType", v as BusinessType)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select business type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sme">SME (Small & Medium Enterprise)</SelectItem>
                      <SelectItem value="corporate">Corporate</SelectItem>
                      <SelectItem value="ngo">NGO (Non-Governmental Organization)</SelectItem>
                      <SelectItem value="school">School / Educational Institution</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      TPIN *
                    </Label>
                    <Input
                      value={companyData.tpin}
                      onChange={(e) => updateField("tpin", e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="1234567890"
                      maxLength={10}
                    />
                    <p className="text-xs text-muted-foreground">10-digit TPIN from ZRA</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Registration Number</Label>
                    <Input
                      value={companyData.registrationNumber}
                      onChange={(e) => updateField("registrationNumber", e.target.value)}
                      placeholder="e.g., 123456789"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Industry Type</Label>
                  <Select
                    value={companyData.industryType}
                    onValueChange={(v) => updateField("industryType", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRY_TYPES.map((industry) => (
                        <SelectItem key={industry} value={industry.toLowerCase()}>
                          {industry}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Physical Address
                  </Label>
                  <Input
                    value={companyData.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    placeholder="Street address, City"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      Phone *
                    </Label>
                    <Input
                      value={companyData.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      placeholder="+260 XXX XXX XXX"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      Email *
                    </Label>
                    <Input
                      type="email"
                      value={companyData.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      placeholder="company@example.com"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <CompanyLogoUpload onUploaded={setCompanyLogoUrl} />
                <p className="text-sm text-muted-foreground">
                  Your logo will appear on invoices, payslips, and reports. This is required.
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-base font-medium">
                    {companyData.organizationType === "business"
                      ? "Tax Registration Type *"
                      : "Non-profit Tax Classification *"}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {companyData.organizationType === "business"
                      ? "Select your company's tax registration status with ZRA"
                      : "Select your non-profit tax classification based on ZRA guidance"}
                  </p>

                  {companyData.organizationType === "business" ? (
                    <div className="grid gap-3">
                      {BUSINESS_TAX_OPTIONS.map((option) => (
                        <div
                          key={option.value}
                          className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${companyData.taxType === option.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                            }`}
                          onClick={() => updateField("taxType", option.value)}
                        >
                          <div
                            className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center ${companyData.taxType === option.value
                                ? "border-primary"
                                : "border-muted-foreground"
                              }`}
                          >
                            {companyData.taxType === option.value && (
                              <div className="w-2 h-2 rounded-full bg-primary" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{option.label}</p>
                            <p className="text-sm text-muted-foreground">{option.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Select
                      value={companyData.taxClassification}
                      onValueChange={(value) => updateField("taxClassification", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select non-profit classification" />
                      </SelectTrigger>
                      <SelectContent>
                        {NON_PROFIT_TAX_CLASSIFICATIONS.map((classification) => (
                          <SelectItem key={classification.value} value={classification.value}>
                            {classification.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {companyData.organizationType === "business" && companyData.taxType === "vat_registered" && (
                  <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                    <Label>VAT Rate (%)</Label>
                    <Input
                      type="number"
                      value={companyData.vatRate}
                      onChange={(e) => updateField("vatRate", e.target.value)}
                      placeholder="16"
                    />
                    <p className="text-sm text-muted-foreground">
                      Standard VAT rate in Zambia is 16%. This will be applied to all taxable sales.
                    </p>
                  </div>
                )}

                {companyData.organizationType === "business" && companyData.taxType === "turnover_tax" && (
                  <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                    <Label>Turnover Tax Number</Label>
                    <Input
                      value={companyData.turnoverTaxNumber}
                      onChange={(e) => updateField("turnoverTaxNumber", e.target.value)}
                      placeholder="TOT-XXXXXXXX"
                    />
                    <p className="text-sm text-muted-foreground">
                      Your Turnover Tax registration number from ZRA
                    </p>
                  </div>
                )}

                <div className="p-4 border rounded-lg bg-amber-500/10 border-amber-500/20">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    <strong>Important:</strong> {companyData.organizationType === "business"
                      ? "Your tax type determines how invoices are processed."
                      : "Your non-profit classification is stored for compliance and reporting."
                    }
                    {companyData.organizationType === "business" && companyData.taxType === "vat_registered" &&
                      " VAT invoices will be submitted to ZRA Smart Invoice for approval."
                    }
                  </p>
                </div>
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

        <p className="text-center text-sm text-slate-400 mt-6">
          Step {step} of 3
        </p>
      </div>
    </div>
  );
}
