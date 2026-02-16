import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Heart,
  Shield,
  ArrowRight,
  MapPin,
  Phone,
  Mail,
  Hash,
  CheckCircle2,
  Upload
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CompanyLogoUpload } from "@/components/payroll/CompanyLogoUpload";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { AuthLayout } from "@/components/auth/AuthLayout";

// --- Types & Constants ---
type BusinessType = "sme" | "ngo" | "school" | "corporate";
type TaxType = "vat_registered" | "turnover_tax" | "non_vat" | "tax_exempt";
type OrganizationType = "business" | "non_profit";

const INDUSTRY_TYPES = [
  "Agriculture", "Construction", "Education", "Financial Services",
  "Healthcare", "Hospitality", "Information Technology", "Manufacturing",
  "Mining", "Non-Profit", "Professional Services", "Retail",
  "Transportation", "Wholesale", "Other"
];

const BUSINESS_TAX_OPTIONS: { value: TaxType; label: string; description: string }[] = [
  { value: "vat_registered", label: "VAT Registered", description: "Turnover > K800k. 16% VAT." },
  { value: "turnover_tax", label: "Turnover Tax", description: "Turnover < K800k. 4% Tax." },
  { value: "non_vat", label: "Non-VAT Registered", description: "Not registered for VAT." },
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

// --- Visual Content Components ---
const Step1Visuals = () => (
  <div className="relative w-full h-full flex flex-col items-center justify-center space-y-6">
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-indigo-500/10 backdrop-blur-md border border-indigo-500/20 p-8 rounded-full"
    >
      <Building2 className="h-16 w-16 text-indigo-400" />
    </motion.div>
    <div className="text-center max-w-xs">
      <h3 className="text-xl font-semibold text-white">Organization Profile</h3>
      <p className="text-sm text-slate-400 mt-2">Setting up your digital headquarters.</p>
    </div>
  </div>
);

const Step2Visuals = () => (
  <div className="relative w-full h-full flex flex-col items-center justify-center space-y-6">
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-pink-500/10 backdrop-blur-md border border-pink-500/20 p-8 rounded-full"
    >
      <Heart className="h-16 w-16 text-pink-400" />
    </motion.div>
    <div className="text-center max-w-xs">
      <h3 className="text-xl font-semibold text-white">Brand Identity</h3>
      <p className="text-sm text-slate-400 mt-2">Make your invoices and reports stand out.</p>
    </div>
  </div>
);

const Step3Visuals = () => (
  <div className="relative w-full h-full flex flex-col items-center justify-center space-y-6">
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-emerald-500/10 backdrop-blur-md border border-emerald-500/20 p-8 rounded-full"
    >
      <Shield className="h-16 w-16 text-emerald-400" />
    </motion.div>
    <div className="text-center max-w-xs">
      <h3 className="text-xl font-semibold text-white">Compliance & Tax</h3>
      <p className="text-sm text-slate-400 mt-2">Ensuring ZRA compliance from day one.</p>
    </div>
  </div>
);

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

  const setupMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) throw new Error("No company associated with user");

      const isVatRegistered = companyData.organizationType === "business" && companyData.taxType === "vat_registered";
      const taxClassification = companyData.organizationType === "business"
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
      toast.success("Setup complete!");
      navigate("/dashboard");
    },
    onError: (error) => toast.error("Setup failed: " + error.message),
  });

  const validateStep = (): boolean => {
    if (step === 1) {
      if (!companyData.name) return !!toast.error("Company Name is required");
      if (!companyData.phone) return !!toast.error("Phone is required");
      if (!companyData.email) return !!toast.error("Email is required");
      if (!companyData.tpin || !/^\d{10}$/.test(companyData.tpin)) return !!toast.error("Valid 10-digit TPIN required");
    }
    if (step === 2 && !companyLogoUrl) return !!toast.error("Logo is required");
    if (step === 3) {
      if (companyData.organizationType === "business" && companyData.taxType === "turnover_tax" && !companyData.turnoverTaxNumber)
        return !!toast.error("Turnover Tax Number required");
      if (companyData.organizationType === "non_profit" && !companyData.taxClassification)
        return !!toast.error("Classification required");
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step < 3) setStep(step + 1);
    else setupMutation.mutate();
  };

  // Dynamic Visuals
  const currentVisual = step === 1 ? <Step1Visuals /> : step === 2 ? <Step2Visuals /> : <Step3Visuals />;

  const stepTitle = step === 1 ? "Organization Details" : step === 2 ? "Upload Identity" : "Tax Configuration";
  const stepSubtitle = `Step ${step} of 3`;

  return (
    <AuthLayout
      title={stepTitle}
      subtitle={stepSubtitle}
      visualContent={
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full"
          >
            {currentVisual}
          </motion.div>
        </AnimatePresence>
      }
    >
      <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
        {step === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Acme Corp"
                  className="pl-10"
                  value={companyData.name}
                  onChange={e => updateField("name", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Org Type</Label>
                <Select
                  value={companyData.organizationType}
                  onValueChange={(v: any) => updateField("organizationType", v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="non_profit">Non-Profit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Business Type</Label>
                <Select
                  value={companyData.businessType}
                  onValueChange={(v: any) => updateField("businessType", v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sme">SME</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="ngo">NGO</SelectItem>
                    <SelectItem value="school">School</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>TPIN (10 Digits)</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="1234567890"
                  className="pl-10"
                  value={companyData.tpin}
                  onChange={e => updateField("tpin", e.target.value.replace(/\D/g, "").slice(0, 10))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="+260..."
                    className="pl-10"
                    value={companyData.phone}
                    onChange={e => updateField("phone", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="info@..."
                    className="pl-10"
                    value={companyData.email}
                    onChange={e => updateField("email", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Industry</Label>
              <Select
                value={companyData.industryType}
                onValueChange={(v) => updateField("industryType", v)}
              >
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {INDUSTRY_TYPES.map(t => <SelectItem key={t} value={t.toLowerCase()}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 text-center">
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 bg-slate-50/50">
              <CompanyLogoUpload onUploaded={setCompanyLogoUrl} />
            </div>
            <p className="text-sm text-muted-foreground">
              Upload your official organization logo. This will be displayed on all your financial documents.
            </p>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {companyData.organizationType === "business" ? (
              <div className="space-y-4">
                <Label>Select Tax Category</Label>
                <div className="grid gap-3">
                  {BUSINESS_TAX_OPTIONS.map((opt) => (
                    <div
                      key={opt.value}
                      onClick={() => updateField("taxType", opt.value)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${companyData.taxType === opt.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/50"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${companyData.taxType === opt.value ? "border-primary" : "border-slate-400"
                          }`}>
                          {companyData.taxType === opt.value && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {companyData.taxType === "vat_registered" && (
                  <div className="space-y-2 pt-2">
                    <Label>VAT Rate (%)</Label>
                    <Input type="number" value={companyData.vatRate} onChange={e => updateField("vatRate", e.target.value)} />
                  </div>
                )}
                {companyData.taxType === "turnover_tax" && (
                  <div className="space-y-2 pt-2">
                    <Label>Turnover Tax ID</Label>
                    <Input placeholder="TOT-..." value={companyData.turnoverTaxNumber} onChange={e => updateField("turnoverTaxNumber", e.target.value)} />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Label>Non-Profit Classification</Label>
                <Select
                  value={companyData.taxClassification}
                  onValueChange={v => updateField("taxClassification", v)}
                >
                  <SelectTrigger><SelectValue placeholder="Select classification..." /></SelectTrigger>
                  <SelectContent>
                    {NON_PROFIT_TAX_CLASSIFICATIONS.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </motion.div>
        )}

        <div className="flex justify-between pt-6 border-t mt-6">
          {step > 1 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>Back</Button>
          ) : <div />}

          <Button onClick={handleNext} disabled={setupMutation.isPending} className="px-8">
            {step < 3 ? (
              <>Next <ArrowRight className="ml-2 h-4 w-4" /></>
            ) : (
              setupMutation.isPending ? "Completing..." : "Complete Setup"
            )}
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
