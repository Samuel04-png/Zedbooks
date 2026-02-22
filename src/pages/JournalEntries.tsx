import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, BookOpen, Eye, Loader2, Filter, Plus, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { accountingService } from "@/services/firebase/accountingService";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";
import { ManualJournalEntryForm } from "@/components/accounting/ManualJournalEntryForm";
import { toast } from "sonner";

interface JournalEntryRow {
  id: string;
  entryDate: string;
  referenceNumber: string | null;
  description: string | null;
  referenceType: string | null;
  referenceId: string | null;
  isPosted: boolean;
  isDeleted: boolean;
  isLocked: boolean;
  isReversal: boolean;
  isReversed: boolean;
  reversalEntryId: string | null;
  reversalOf: string | null;
}

interface JournalEntryLineRow {
  id: string;
  entryId: string;
  accountId: string;
  description: string | null;
  debitAmount: number;
  creditAmount: number;
}

interface AccountRow {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: string;
}

interface JournalLineWithAccount extends JournalEntryLineRow {
  account: AccountRow | null;
}

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const toDateString = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const ts = value as { toDate?: () => Date };
    if (typeof ts.toDate === "function") {
      return ts.toDate().toISOString();
    }
  }
  return "";
};

export default function JournalEntries() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedEntry, setSelectedEntry] = useState<JournalEntryRow | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: journalEntries, isLoading } = useQuery({
    queryKey: ["journal-entries", user?.id],
    queryFn: async () => {
      if (!user) return [] as JournalEntryRow[];

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) return [] as JournalEntryRow[];

      const entriesRef = collection(firestore, COLLECTIONS.JOURNAL_ENTRIES);
      const snapshot = await getDocs(
        query(entriesRef, where("companyId", "==", membership.companyId)),
      );

      return snapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            entryDate: toDateString(row.entryDate ?? row.entry_date),
            referenceNumber: (row.referenceNumber ?? row.reference_number ?? null) as string | null,
            description: (row.description ?? null) as string | null,
            referenceType: (row.referenceType ?? row.reference_type ?? null) as string | null,
            referenceId: (row.referenceId ?? row.reference_id ?? null) as string | null,
            isPosted: Boolean(row.isPosted ?? row.is_posted ?? false),
            isDeleted: Boolean(row.isDeleted ?? row.is_deleted ?? false),
            isLocked: Boolean(row.isLocked ?? row.is_locked ?? false),
            isReversal: Boolean(row.isReversal ?? row.is_reversal ?? false),
            isReversed: Boolean(row.isReversed ?? row.is_reversed ?? false),
            reversalEntryId: (row.reversalEntryId ?? row.reversal_entry_id ?? null) as string | null,
            reversalOf: (row.reversalOf ?? row.reversal_of ?? null) as string | null,
          } satisfies JournalEntryRow;
        })
        .filter((entry) => !entry.isDeleted)
        .sort((a, b) => String(b.entryDate).localeCompare(String(a.entryDate)));
    },
    enabled: Boolean(user),
  });

  const reverseMutation = useMutation({
    mutationFn: async (entry: JournalEntryRow) => {
      if (!user) throw new Error("Not authenticated");
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) throw new Error("Company context not found");

      const reason = prompt("Reason for reversal (optional):") || undefined;
      return accountingService.reverseJournalEntry({
        companyId: membership.companyId,
        journalEntryId: entry.id,
        reason,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["journal-entry-lines"] });
      queryClient.invalidateQueries({ queryKey: ["financial-reports"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-live-metrics"] });
      toast.success(`Journal entry reversed. Reversal ID: ${result.reversalEntryId}`);
      setSelectedEntry(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to reverse journal entry: ${message}`);
    },
  });

  const { data: entryLines } = useQuery({
    queryKey: ["journal-entry-lines", selectedEntry?.id],
    queryFn: async () => {
      if (!selectedEntry) return [] as JournalLineWithAccount[];

      const linesRef = collection(firestore, COLLECTIONS.JOURNAL_LINES);
      let linesSnapshot = await getDocs(
        query(linesRef, where("entryId", "==", selectedEntry.id)),
      );
      if (linesSnapshot.empty) {
        linesSnapshot = await getDocs(
          query(linesRef, where("journalEntryId", "==", selectedEntry.id)),
        );
      }

      const lines = linesSnapshot.docs.map((docSnap) => {
        const row = docSnap.data() as Record<string, unknown>;
        return {
          id: docSnap.id,
          entryId: String(row.entryId ?? row.journalEntryId ?? row.journal_entry_id ?? ""),
          accountId: String(row.accountId ?? row.account_id ?? ""),
          description: (row.description ?? null) as string | null,
          debitAmount: Number(row.debit ?? row.debitAmount ?? row.debit_amount ?? 0),
          creditAmount: Number(row.credit ?? row.creditAmount ?? row.credit_amount ?? 0),
        } satisfies JournalEntryLineRow;
      });

      const accountIds = Array.from(new Set(lines.map((line) => line.accountId).filter(Boolean)));
      const accountMap = new Map<string, AccountRow>();

      if (accountIds.length > 0) {
        const accountsRef = collection(firestore, COLLECTIONS.CHART_OF_ACCOUNTS);
        const accountChunks = chunk(accountIds, 30);
        const snapshots = await Promise.all(
          accountChunks.map((ids) => getDocs(query(accountsRef, where(documentId(), "in", ids)))),
        );

        snapshots.forEach((snapshot) => {
          snapshot.docs.forEach((docSnap) => {
            const row = docSnap.data() as Record<string, unknown>;
            accountMap.set(docSnap.id, {
              id: docSnap.id,
              accountCode: String(row.accountCode ?? row.account_code ?? ""),
              accountName: String(row.accountName ?? row.account_name ?? ""),
              accountType: String(row.accountType ?? row.account_type ?? ""),
            });
          });
        });
      }

      return lines.map((line) => ({
        ...line,
        account: accountMap.get(line.accountId) ?? null,
      }));
    },
    enabled: Boolean(selectedEntry?.id),
  });

  const filteredEntries = journalEntries?.filter((entry) => {
    const matchesSearch =
      entry.referenceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "posted" && entry.isPosted) ||
      (statusFilter === "draft" && !entry.isPosted) ||
      (statusFilter === "reversed" && entry.isReversed) ||
      (statusFilter === "reversal" && entry.isReversal);

    return Boolean(matchesSearch || (!searchTerm && matchesStatus)) && matchesStatus;
  });

  const totalDebits = entryLines?.reduce((sum, line) => sum + line.debitAmount, 0) || 0;
  const totalCredits = entryLines?.reduce((sum, line) => sum + line.creditAmount, 0) || 0;
  const canReverseEntry = (entry: JournalEntryRow) => {
    const refType = String(entry.referenceType || "").toLowerCase();
    const isPayrollEntry = refType === "payroll" || refType === "payrollpayment";
    return entry.isPosted && !entry.isReversal && !entry.isReversed && !isPayrollEntry;
  };

  const summaryStats = {
    total: journalEntries?.length || 0,
    posted: journalEntries?.filter((entry) => entry.isPosted).length || 0,
    draft: journalEntries?.filter((entry) => !entry.isPosted).length || 0,
    reversed: journalEntries?.filter((entry) => entry.isReversed || entry.isReversal).length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Journal Entries</h1>
          <p className="text-muted-foreground">View General Ledger journal entries and postings</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Manual Entry
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Total Entries
            </CardDescription>
            <CardTitle className="text-2xl">{summaryStats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Posted</CardDescription>
            <CardTitle className="text-2xl text-green-600">{summaryStats.posted}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Draft</CardDescription>
            <CardTitle className="text-2xl text-amber-600">{summaryStats.draft}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Reversal Related</CardDescription>
            <CardTitle className="text-2xl text-orange-600">{summaryStats.reversed}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by reference or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="reversed">Reversed</SelectItem>
            <SelectItem value="reversal">Reversal Entries</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Journal Entries</CardTitle>
          <CardDescription>Double-entry accounting records</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredEntries && filteredEntries.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reversal Ref</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.entryDate ? format(new Date(entry.entryDate), "dd MMM yyyy") : "-"}</TableCell>
                      <TableCell className="font-mono">{entry.referenceNumber || "-"}</TableCell>
                      <TableCell>
                        {entry.referenceType || "-"}
                        {entry.referenceId ? (
                          <p className="font-mono text-xs text-muted-foreground">{entry.referenceId}</p>
                        ) : null}
                      </TableCell>
                      <TableCell>{entry.description || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {entry.reversalEntryId || entry.reversalOf || "-"}
                      </TableCell>
                      <TableCell>
                        {entry.isReversal ? (
                          <Badge variant="secondary">Reversal</Badge>
                        ) : entry.isReversed ? (
                          <Badge variant="outline" className="text-orange-600 border-orange-600">
                            Reversed
                          </Badge>
                        ) : entry.isPosted ? (
                          <Badge className="bg-green-600">Posted</Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            Draft
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canReverseEntry(entry) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={reverseMutation.isPending}
                              onClick={() => {
                                if (!confirm("Reverse this posted journal entry? This action creates an equal and opposite entry.")) {
                                  return;
                                }
                                reverseMutation.mutate(entry);
                              }}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Reverse
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => setSelectedEntry(entry)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No journal entries found</p>
              <p className="text-sm">Journal entries are created automatically from transactions</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Journal Entry Details
            </DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Reference</p>
                  <p className="font-mono font-medium">{selectedEntry.referenceNumber || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {selectedEntry.entryDate ? format(new Date(selectedEntry.entryDate), "dd MMM yyyy") : "-"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="font-medium">{selectedEntry.description || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {selectedEntry.isReversal ? (
                    <Badge variant="secondary">Reversal</Badge>
                  ) : selectedEntry.isReversed ? (
                    <Badge variant="outline" className="text-orange-600 border-orange-600">
                      Reversed
                    </Badge>
                  ) : selectedEntry.isPosted ? (
                    <Badge className="bg-green-600">Posted</Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-600">Draft</Badge>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Locked</p>
                  {selectedEntry.isLocked ? <Badge variant="secondary">Yes</Badge> : <Badge variant="outline">No</Badge>}
                </div>
                {selectedEntry.referenceType && (
                  <div>
                    <p className="text-sm text-muted-foreground">Reference Type</p>
                    <p className="font-medium">{selectedEntry.referenceType}</p>
                  </div>
                )}
                {selectedEntry.referenceId && (
                  <div>
                    <p className="text-sm text-muted-foreground">Reference ID</p>
                    <p className="font-mono text-sm">{selectedEntry.referenceId}</p>
                  </div>
                )}
                {(selectedEntry.reversalEntryId || selectedEntry.reversalOf) && (
                  <div>
                    <p className="text-sm text-muted-foreground">Reversal Reference</p>
                    <p className="font-mono text-sm">
                      {selectedEntry.reversalEntryId || selectedEntry.reversalOf}
                    </p>
                  </div>
                )}
                {!selectedEntry.isReversal && !selectedEntry.isReversed && selectedEntry.isPosted && canReverseEntry(selectedEntry) && (
                  <div className="col-span-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={reverseMutation.isPending}
                      onClick={() => {
                        if (!confirm("Reverse this posted journal entry? This action creates an equal and opposite entry.")) {
                          return;
                        }
                        reverseMutation.mutate(selectedEntry);
                      }}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reverse Entry
                    </Button>
                  </div>
                )}
                {!selectedEntry.isReversal && !selectedEntry.isReversed && selectedEntry.isPosted && !canReverseEntry(selectedEntry) && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">
                      Payroll journal reversals are controlled from the payroll module to preserve sequence and audit trail.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-semibold mb-3">Entry Lines</h4>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entryLines?.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{line.account?.accountName || "-"}</p>
                              <p className="text-sm text-muted-foreground font-mono">{line.account?.accountCode || ""}</p>
                            </div>
                          </TableCell>
                          <TableCell>{line.description || "-"}</TableCell>
                          <TableCell className="text-right">
                            {line.debitAmount > 0 ? formatZMW(line.debitAmount) : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {line.creditAmount > 0 ? formatZMW(line.creditAmount) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell colSpan={2} className="text-right">Totals</TableCell>
                        <TableCell className="text-right">{formatZMW(totalDebits)}</TableCell>
                        <TableCell className="text-right">{formatZMW(totalCredits)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <div
                  className={`mt-4 p-3 rounded-lg ${Math.abs(totalDebits - totalCredits) < 0.01
                    ? "bg-green-50 border border-green-200"
                    : "bg-red-50 border border-red-200"
                    }`}
                >
                  {Math.abs(totalDebits - totalCredits) < 0.01 ? (
                    <p className="text-green-700 text-sm">Entry is balanced (Debits = Credits)</p>
                  ) : (
                    <p className="text-red-700 text-sm">
                      Entry is unbalanced - Difference: {formatZMW(Math.abs(totalDebits - totalCredits))}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Manual Journal Entry Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Manual Journal Entry</DialogTitle>
          </DialogHeader>
          <ManualJournalEntryForm onClose={() => setShowCreateDialog(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
