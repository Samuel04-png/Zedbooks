import { toast } from "sonner";

export interface ImportColumn {
  header: string;
  key: string;
  required?: boolean;
  transform?: (value: string) => unknown;
}

export interface ImportResult<T> {
  success: boolean;
  data: T[];
  errors: string[];
  totalRows: number;
  successfulRows: number;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

export function parseCSV(content: string): string[][] {
  // Remove BOM if present
  const cleanContent = content.replace(/^\uFEFF/, "");
  
  const lines = cleanContent.split(/\r?\n/).filter((line) => line.trim());
  return lines.map(parseCSVLine);
}

export function mapCSVToData<T extends Record<string, unknown>>(
  rows: string[][],
  columns: ImportColumn[]
): ImportResult<T> {
  const result: ImportResult<T> = {
    success: false,
    data: [],
    errors: [],
    totalRows: 0,
    successfulRows: 0,
  };

  if (rows.length < 2) {
    result.errors.push("File must contain at least a header row and one data row");
    return result;
  }

  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const dataRows = rows.slice(1);
  result.totalRows = dataRows.length;

  // Map header names to column indices
  const columnMap: Record<string, number> = {};
  columns.forEach((col) => {
    const headerIndex = headers.findIndex(
      (h) => h === col.header.toLowerCase() || h === col.key.toLowerCase()
    );
    if (headerIndex !== -1) {
      columnMap[col.key] = headerIndex;
    }
  });

  // Check for required columns
  const missingRequired = columns
    .filter((col) => col.required && columnMap[col.key] === undefined)
    .map((col) => col.header);

  if (missingRequired.length > 0) {
    result.errors.push(`Missing required columns: ${missingRequired.join(", ")}`);
    return result;
  }

  // Process each data row
  dataRows.forEach((row, index) => {
    try {
      const item: Record<string, unknown> = {};
      let hasError = false;

      columns.forEach((col) => {
        const colIndex = columnMap[col.key];
        if (colIndex !== undefined && colIndex < row.length) {
          const value = row[colIndex]?.trim() || "";
          
          if (col.required && !value) {
            result.errors.push(`Row ${index + 2}: Missing required value for ${col.header}`);
            hasError = true;
            return;
          }

          item[col.key] = col.transform ? col.transform(value) : value;
        } else if (col.required) {
          result.errors.push(`Row ${index + 2}: Missing required value for ${col.header}`);
          hasError = true;
        }
      });

      if (!hasError) {
        result.data.push(item as T);
        result.successfulRows++;
      }
    } catch (error) {
      result.errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  });

  result.success = result.successfulRows > 0;
  return result;
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

export async function importFromCSV<T extends Record<string, unknown>>(
  file: File,
  columns: ImportColumn[]
): Promise<ImportResult<T>> {
  try {
    const content = await readFileAsText(file);
    const rows = parseCSV(content);
    return mapCSVToData<T>(rows, columns);
  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [error instanceof Error ? error.message : "Failed to parse file"],
      totalRows: 0,
      successfulRows: 0,
    };
  }
}

// Common transformers
export const transformers = {
  toNumber: (value: string): number => {
    const num = parseFloat(value.replace(/[^0-9.-]/g, ""));
    return isNaN(num) ? 0 : num;
  },
  toDate: (value: string): string => {
    if (!value) return "";
    try {
      const date = new Date(value);
      return date.toISOString().split("T")[0];
    } catch {
      return value;
    }
  },
  toBoolean: (value: string): boolean => {
    return ["true", "yes", "1", "y"].includes(value.toLowerCase());
  },
  trim: (value: string): string => value.trim(),
};

// Template generators
export function generateImportTemplate(columns: ImportColumn[]): void {
  const headers = columns.map((col) => col.header);
  const exampleRow = columns.map((col) => {
    if (col.key.includes("date")) return "2025-01-01";
    if (col.key.includes("amount") || col.key.includes("price") || col.key.includes("salary")) return "1000.00";
    if (col.key.includes("email")) return "example@email.com";
    if (col.key.includes("phone")) return "+260971234567";
    return `Example ${col.header}`;
  });

  const csv = [headers.join(","), exampleRow.join(",")].join("\n");
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "import-template.csv";
  link.click();
  window.URL.revokeObjectURL(url);

  toast.success("Template downloaded");
}
