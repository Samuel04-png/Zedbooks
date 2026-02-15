import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { assertFirebaseConfigured, firebaseStorage } from "@/integrations/firebase/client";

export const storageService = {
  async uploadCompanyLogo(companyId: string, file: File): Promise<string> {
    assertFirebaseConfigured();

    const extension = file.name.split(".").pop() ?? "png";
    const objectPath = `company-logos/${companyId}/logo.${extension}`;
    const storageRef = ref(firebaseStorage, objectPath);

    try {
      await uploadBytes(storageRef, file, {
        contentType: file.type,
      });
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";

      if (code === "storage/bucket-not-found") {
        throw new Error("Firebase Storage is not enabled for this project. Open Firebase Console > Storage > Get Started.");
      }

      throw error;
    }

    return getDownloadURL(storageRef);
  },
};
