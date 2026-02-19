import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Trash2, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { accountingService } from "@/services/firebase/accountingService";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { collection, getDocs, query, where } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { toast } from "sonner";

interface JournalLine {
    accountId: string;
    debit: number;
    credit: number;
    description: string;
}

interface Account {
    id: string;
    accountCode: string;
    accountName: string;
    accountType: string;
}

interface ManualJournalEntryFormProps {
    onClose: () => void;
}

export function ManualJournalEntryForm({ onClose }: ManualJournalEntryFormProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
    const [referenceNumber, setReferenceNumber] = useState("");
    const [description, setDescription] = useState("");
    const [lines, setLines] = useState<JournalLine[]>([
        { accountId: "", debit: 0, credit: 0, description: "" },
        { accountId: "", debit: 0, credit: 0, description: "" },
    ]);

    const { data: accounts = [] } = useQuery({
        queryKey: ["chart-of-accounts", user?.id],
        queryFn: async () => {
            if (!user) return [] as Account[];
            const membership = await companyService.getPrimaryMembershipByUser(user.id);
            if (!membership?.companyId) return [] as Account[];

            const accountsRef = collection(firestore, COLLECTIONS.CHART_OF_ACCOUNTS);
            const snapshot = await getDocs(
                query(
                    accountsRef,
                    where("companyId", "==", membership.companyId),
                    where("status", "==", "active")
                )
            );

            return snapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    accountCode: String(data.accountCode || ""),
                    accountName: String(data.accountName || ""),
                    accountType: String(data.accountType || ""),
                } as Account;
            }).sort((a, b) => a.accountCode.localeCompare(b.accountCode));
        },
        enabled: Boolean(user),
    });

    const { data: companyId } = useQuery({
        queryKey: ["manual-journal-company-id", user?.id],
        queryFn: async () => {
            if (!user) return null;
            const membership = await companyService.getPrimaryMembershipByUser(user.id);
            return membership?.companyId ?? null;
        },
        enabled: Boolean(user),
    });

    const postMutation = useMutation({
        mutationFn: async (data: {
            companyId: string;
            entryDate: string;
            referenceNumber: string;
            description: string;
            referenceType: "ManualEntry";
            sourceType: "manual_journal";
            lines: JournalLine[];
        }) => {
            return accountingService.postJournalEntry(data);
        },
        onSuccess: () => {
            toast.success("Manual journal entry created successfully!");
            queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
            onClose();
        },
        onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : "Failed to create journal entry";
            toast.error(message);
        },
    });

    const addLine = () => {
        setLines([...lines, { accountId: "", debit: 0, credit: 0, description: "" }]);
    };

    const removeLine = (index: number) => {
        if (lines.length > 2) {
            setLines(lines.filter((_, i) => i !== index));
        }
    };

    const updateLine = (index: number, field: keyof JournalLine, value: string | number) => {
        const newLines = [...lines];
        if (field === "debit" || field === "credit") {
            newLines[index][field] = Number(value) || 0;
        } else {
            newLines[index][field] = value as string;
        }
        setLines(newLines);
    };

    const totalDebits = lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredits = lines.reduce((sum, line) => sum + line.credit, 0);
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;
    const difference = Math.abs(totalDebits - totalCredits);

    const canPost = isBalanced && totalDebits > 0 && lines.every(line =>
        line.accountId && (line.debit > 0 || line.credit > 0) && !(line.debit > 0 && line.credit > 0)
    );

    const handlePost = () => {
        if (!canPost) return;
        if (!companyId) {
            toast.error("No company context found.");
            return;
        }

        postMutation.mutate({
            companyId,
            entryDate,
            referenceNumber,
            description,
            referenceType: "ManualEntry",
            sourceType: "manual_journal",
            lines: lines.filter(line => line.accountId && (line.debit > 0 || line.credit > 0)),
        });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="entry-date">Entry Date *</Label>
                    <Input
                        id="entry-date"
                        type="date"
                        value={entryDate}
                        onChange={(e) => setEntryDate(e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="reference">Reference Number</Label>
                    <Input
                        id="reference"
                        placeholder="e.g., ADJ-001"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                    />
                </div>
                <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="description">Description</Label>
                    <Input
                        id="description"
                        placeholder="Brief description of entry"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[300px]">Account</TableHead>
                            <TableHead>Line Description</TableHead>
                            <TableHead className="text-right w-[120px]">Debit</TableHead>
                            <TableHead className="text-right w-[120px]">Credit</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {lines.map((line, index) => (
                            <TableRow key={index}>
                                <TableCell>
                                    <Select
                                        value={line.accountId}
                                        onValueChange={(value) => updateLine(index, "accountId", value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select account" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {accounts.map((account) => (
                                                <SelectItem key={account.id} value={account.id}>
                                                    {account.accountCode} - {account.accountName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>
                                    <Input
                                        placeholder="Line description"
                                        value={line.description}
                                        onChange={(e) => updateLine(index, "description", e.target.value)}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="text-right"
                                        value={line.debit || ""}
                                        onChange={(e) => updateLine(index, "debit", e.target.value)}
                                        disabled={line.credit > 0}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="text-right"
                                        value={line.credit || ""}
                                        onChange={(e) => updateLine(index, "credit", e.target.value)}
                                        disabled={line.debit > 0}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeLine(index)}
                                        disabled={lines.length <= 2}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        <TableRow className="bg-muted/50">
                            <TableCell colSpan={2} className="font-semibold">
                                Total
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                                {formatZMW(totalDebits)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                                {formatZMW(totalCredits)}
                            </TableCell>
                            <TableCell></TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>

            <Button variant="outline" onClick={addLine} className="w-full gap-2">
                <Plus className="h-4 w-4" />
                Add Line
            </Button>

            <div
                className={`p-4 rounded-lg border-2 ${isBalanced
                        ? "bg-green-50 border-green-500 text-green-700"
                        : "bg-red-50 border-red-500 text-red-700"
                    }`}
            >
                {isBalanced ? (
                    <div className="flex items-center justify-between">
                        <span className="font-semibold">Entry is balanced</span>
                        <span>Debits = Credits = {formatZMW(totalDebits)}</span>
                    </div>
                ) : (
                    <div className="space-y-1">
                        <div className="font-semibold">Warning: Entry is not balanced</div>
                        <div className="text-sm">
                            Debits: {formatZMW(totalDebits)} | Credits: {formatZMW(totalCredits)} | Difference: {formatZMW(difference)}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose} disabled={postMutation.isPending}>
                    Cancel
                </Button>
                <Button onClick={handlePost} disabled={!canPost || postMutation.isPending}>
                    {postMutation.isPending ? "Posting..." : "Post Entry"}
                </Button>
            </div>
        </div>
    );
}
