import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from "lucide-react";
import { ImportColumn, ImportResult, importFromCSV, generateImportTemplate } from "@/utils/importFromExcel";

interface ImportDialogProps<T extends Record<string, unknown>> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  columns: ImportColumn[];
  onImport: (data: T[]) => Promise<void>;
  templateName?: string;
}

type ImportStep = "upload" | "preview" | "importing" | "complete";

export function ImportDialog<T extends Record<string, unknown>>({
  open,
  onOpenChange,
  title,
  description,
  columns,
  onImport,
  templateName = "import-template",
}: ImportDialogProps<T>) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [result, setResult] = useState<ImportResult<T> | null>(null);
  const [importing, setImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const importResult = await importFromCSV<T>(file, columns);
    setResult(importResult);
    setStep("preview");
  };

  const handleImport = async () => {
    if (!result || result.data.length === 0) return;

    setImporting(true);
    setImportError(null);
    setStep("importing");

    try {
      await onImport(result.data);
      setImportComplete(true);
      setStep("complete");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Import failed");
      setStep("preview");
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStep("upload");
    setResult(null);
    setImportComplete(false);
    setImportError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    generateImportTemplate(columns);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Drop your CSV file here</p>
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="text-sm font-medium">Need a template?</p>
                <p className="text-xs text-muted-foreground">
                  Download our CSV template with the correct headers
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Template
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Expected columns:</p>
              <div className="flex flex-wrap gap-1">
                {columns.map((col) => (
                  <Badge
                    key={col.key}
                    variant={col.required ? "default" : "outline"}
                  >
                    {col.header}
                    {col.required && " *"}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === "preview" && result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div>
                <p className="font-medium">Import Preview</p>
                <p className="text-sm text-muted-foreground">
                  {result.successfulRows} of {result.totalRows} rows ready to import
                </p>
              </div>
              {result.success ? (
                <Badge variant="default" className="bg-success">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Valid
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Has Errors
                </Badge>
              )}
            </div>

            {result.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">
                    Found {result.errors.length} error(s):
                  </p>
                  <ScrollArea className="h-24">
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {result.errors.slice(0, 10).map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                      {result.errors.length > 10 && (
                        <li>...and {result.errors.length - 10} more</li>
                      )}
                    </ul>
                  </ScrollArea>
                </AlertDescription>
              </Alert>
            )}

            {importError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{importError}</AlertDescription>
              </Alert>
            )}

            {result.data.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Preview (first 5 rows):</p>
                <ScrollArea className="h-40 border rounded">
                  <div className="p-2 text-xs font-mono">
                    {result.data.slice(0, 5).map((row, i) => (
                      <div key={i} className="py-1 border-b last:border-0">
                        {JSON.stringify(row, null, 0).slice(0, 100)}...
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        {step === "importing" && (
          <div className="py-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-lg font-medium">Importing data...</p>
            <p className="text-sm text-muted-foreground">
              Please wait while we process your data
            </p>
          </div>
        )}

        {step === "complete" && (
          <div className="py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
            <p className="text-lg font-medium">Import Complete!</p>
            <p className="text-sm text-muted-foreground">
              Successfully imported {result?.successfulRows || 0} records
            </p>
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={!result?.success || result.data.length === 0}
              >
                Import {result?.successfulRows || 0} Records
              </Button>
            </>
          )}

          {step === "complete" && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
