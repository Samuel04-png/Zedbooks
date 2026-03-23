import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Building2, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { companyService, storageService } from "@/services/firebase";
import { isFirebaseConfigured } from "@/integrations/firebase/client";

interface CompanyLogoUploadProps {
  onUploaded?: (logoUrl: string | null) => void;
  companyName?: string;
  onCompanyNameChange?: (companyName: string) => void;
}

interface CompanyLogoSettings {
  companyId: string;
  companyName: string;
  logoUrl: string | null;
}

export function CompanyLogoUpload({
  onUploaded,
  companyName,
  onCompanyNameChange,
}: CompanyLogoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [companyNameInput, setCompanyNameInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isControlledName = typeof companyName === "string" && typeof onCompanyNameChange === "function";

  const { data: brandContext } = useQuery({
    queryKey: ["company-settings", user?.id],
    queryFn: async (): Promise<CompanyLogoSettings | null> => {
      if (!user || !isFirebaseConfigured) return null;

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) return null;

      const [companyResult, companySettingsResult] = await Promise.allSettled([
        companyService.getCompanyById(membership.companyId),
        companyService.getCompanySettings(membership.companyId),
      ]);

      const company = companyResult.status === "fulfilled" ? companyResult.value : null;
      const companySettings = companySettingsResult.status === "fulfilled"
        ? companySettingsResult.value
        : null;

      return {
        companyId: membership.companyId,
        companyName: companySettings?.companyName || company?.name || companyName || "",
        logoUrl: companySettings?.logoUrl || company?.logoUrl || null,
      };
    },
    enabled: Boolean(user),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ logoUrl, companyName }: { logoUrl?: string | null; companyName?: string }) => {
      if (!brandContext?.companyId) throw new Error("No company linked to current user.");

      await companyService.updateCompanyBasics({
        companyId: brandContext.companyId,
        logoUrl,
        name: companyName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      queryClient.invalidateQueries({ queryKey: ["company"] });
      toast.success("Settings updated successfully");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to update settings";
      toast.error(message);
    },
  });

  useEffect(() => {
    if (onUploaded) {
      onUploaded(brandContext?.logoUrl || null);
    }
  }, [brandContext?.logoUrl, onUploaded]);

  useEffect(() => {
    if (!isControlledName) {
      setCompanyNameInput(brandContext?.companyName || companyName || "");
    }
  }, [brandContext?.companyName, companyName, isControlledName]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!brandContext?.companyId) {
      toast.error("No company linked to this user.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setIsUploading(true);

    try {
      const logoUrl = await storageService.uploadCompanyLogo(brandContext.companyId, file);
      await updateMutation.mutateAsync({ logoUrl });
      onUploaded?.(logoUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload logo";
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCompanyNameBlur = () => {
    const nextName = isControlledName ? companyName : companyNameInput;
    const trimmed = nextName?.trim() || "";
    if (!trimmed || !brandContext?.companyId || trimmed === brandContext.companyName) return;
    updateMutation.mutate({ companyName: trimmed });
  };

  const currentCompanyName = isControlledName ? companyName : companyNameInput;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted">
          {brandContext?.logoUrl ? (
            <img src={brandContext.logoUrl} alt="Company Logo" className="h-full w-full object-contain" />
          ) : (
            <Building2 className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-2">
          <Label>Company Logo</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || !brandContext?.companyId}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Logo
              </>
            )}
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Company Name</Label>
        <Input
          value={currentCompanyName || ""}
          placeholder="Enter company name"
          onChange={(e) => {
            const nextValue = e.target.value;
            if (isControlledName) {
              onCompanyNameChange?.(nextValue);
            } else {
              setCompanyNameInput(nextValue);
            }
          }}
          onBlur={handleCompanyNameBlur}
        />
      </div>
    </div>
  );
}
