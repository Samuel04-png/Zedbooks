import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Search, BookOpen, Eye, Loader2, Filter } from "lucide-react";
import { format } from "date-fns";
import { formatZMW } from "@/utils/zambianTaxCalculations";

export default function JournalEntries() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedEntry, setSelectedEntry] = useState<any>(null);

  const { data: journalEntries, isLoading } = useQuery({
    queryKey: ["journal-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("is_deleted", false)
        .order("entry_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: entryLines } = useQuery({
    queryKey: ["journal-entry-lines", selectedEntry?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entry_lines")
        .select(`
          *,
          chart_of_accounts (
            account_code,
            account_name,
            account_type
          )
        `)
        .eq("journal_entry_id", selectedEntry?.id);

      if (error) throw error;
      return data;
    },
    enabled: !!selectedEntry?.id,
  });

  const filteredEntries = journalEntries?.filter(entry => {
    const matchesSearch = 
      entry.reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === "all" || 
      (statusFilter === "posted" && entry.is_posted) ||
      (statusFilter === "draft" && !entry.is_posted);
    
    return matchesSearch && matchesStatus;
  });

  const totalDebits = entryLines?.reduce((sum, line) => sum + Number(line.debit_amount || 0), 0) || 0;
  const totalCredits = entryLines?.reduce((sum, line) => sum + Number(line.credit_amount || 0), 0) || 0;

  const summaryStats = {
    total: journalEntries?.length || 0,
    posted: journalEntries?.filter(e => e.is_posted).length || 0,
    draft: journalEntries?.filter(e => !e.is_posted).length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Journal Entries</h1>
          <p className="text-muted-foreground">View General Ledger journal entries and postings</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      </div>

      {/* Filters */}
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
          </SelectContent>
        </Select>
      </div>

      {/* Journal Entries Table */}
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
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{format(new Date(entry.entry_date), "dd MMM yyyy")}</TableCell>
                      <TableCell className="font-mono">{entry.reference_number || "-"}</TableCell>
                      <TableCell>{entry.description || "-"}</TableCell>
                      <TableCell>
                        {entry.is_posted ? (
                          <Badge className="bg-green-600">Posted</Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">Draft</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEntry(entry)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
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

      {/* Entry Details Dialog */}
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
              {/* Entry Header */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Reference</p>
                  <p className="font-mono font-medium">{selectedEntry.reference_number || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">{format(new Date(selectedEntry.entry_date), "dd MMM yyyy")}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="font-medium">{selectedEntry.description || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {selectedEntry.is_posted ? (
                    <Badge className="bg-green-600">Posted</Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-600">Draft</Badge>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Locked</p>
                  {selectedEntry.is_locked ? (
                    <Badge variant="secondary">Yes</Badge>
                  ) : (
                    <Badge variant="outline">No</Badge>
                  )}
                </div>
              </div>

              {/* Entry Lines */}
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
                      {entryLines?.map((line: any) => (
                        <TableRow key={line.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{line.chart_of_accounts?.account_name || "-"}</p>
                              <p className="text-sm text-muted-foreground font-mono">
                                {line.chart_of_accounts?.account_code}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{line.description || "-"}</TableCell>
                          <TableCell className="text-right">
                            {Number(line.debit_amount) > 0 ? formatZMW(Number(line.debit_amount)) : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(line.credit_amount) > 0 ? formatZMW(Number(line.credit_amount)) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell colSpan={2} className="text-right">Totals</TableCell>
                        <TableCell className="text-right">{formatZMW(totalDebits)}</TableCell>
                        <TableCell className="text-right">{formatZMW(totalCredits)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                
                {/* Balance Check */}
                <div className={`mt-4 p-3 rounded-lg ${totalDebits === totalCredits ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  {totalDebits === totalCredits ? (
                    <p className="text-green-700 text-sm flex items-center gap-2">
                      ✓ Entry is balanced (Debits = Credits)
                    </p>
                  ) : (
                    <p className="text-red-700 text-sm flex items-center gap-2">
                      ✗ Entry is unbalanced - Difference: {formatZMW(Math.abs(totalDebits - totalCredits))}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
