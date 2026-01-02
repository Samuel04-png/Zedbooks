export interface ExportColumn {
  header: string;
  key: string;
  formatter?: (value: unknown) => string;
}

export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn[],
  filename: string
): void {
  if (data.length === 0) {
    console.warn("No data to export");
    return;
  }

  const headers = columns.map((col) => col.header);
  
  const rows = data.map((row) =>
    columns.map((col) => {
      const value = row[col.key];
      const formattedValue = col.formatter ? col.formatter(value) : String(value ?? "");
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      const escaped = formattedValue.replace(/"/g, '""');
      if (escaped.includes(",") || escaped.includes('"') || escaped.includes("\n")) {
        return `"${escaped}"`;
      }
      return escaped;
    })
  );

  const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

  // Add BOM for Excel UTF-8 compatibility
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
}

export function formatCurrencyForExport(amount: unknown): string {
  const num = typeof amount === "number" ? amount : parseFloat(String(amount)) || 0;
  return num.toFixed(2);
}

export function formatDateForExport(date: unknown): string {
  if (!date) return "";
  try {
    return new Date(String(date)).toISOString().split("T")[0];
  } catch {
    return String(date);
  }
}

export function formatPercentForExport(value: unknown): string {
  const num = typeof value === "number" ? value : parseFloat(String(value)) || 0;
  return `${(num * 100).toFixed(2)}%`;
}
