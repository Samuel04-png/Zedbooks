
export type VATType = "A" | "B" | "C1" | "C2" | "C3" | "D" | "E" | "F" | "R1" | "R2" | "S";

export interface ZRAInvoiceFields {
    isB2B: boolean;
    customerTPIN?: string;
    customerVATType?: VATType;
    exportCountry?: string; // For export invoices
    currencyCode: string; // ZMW, USD, etc.
    exchangeRate?: number;
    zraStatus: "draft" | "pending" | "submitted" | "failed";
    zraInvoiceNumber?: string;
    zraQrCode?: string;
    zraVsdcDate?: string;
}

export const VAT_TYPES: { code: VATType; description: string; rate: number }[] = [
    { code: "A", description: "Standard Rate", rate: 16.0 },
    { code: "B", description: "Minimum Taxable Value", rate: 16.0 },
    { code: "C1", description: "Exports", rate: 0.0 },
    { code: "C2", description: "Zero Rated", rate: 0.0 },
    { code: "C3", description: "Reverse VAT", rate: 0.0 },
    { code: "D", description: "Exempt", rate: 0.0 },
    { code: "S", description: "Suspended", rate: 0.0 },
];
