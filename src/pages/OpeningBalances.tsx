import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { accountingService } from "@/services/firebase/accountingService";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { collection, getDocs, query, where } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";
import { formatZMW } from "@/utils/zambianTaxCalculations";
import { toast } from "sonner";

interface Account {
    id: string;
    accountCode: string;
    accountName: string;
    accountType: string;
}

interface OpeningBalance {
    accountId: string;
    balance: number;
}

export default function OpeningBalances() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [step, setStep] = useState(1);
    const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
    const [balances, setBalances] = useState<OpeningBalance[]>([]);
    const [selectedAccount, setSelectedAccount] = useState("");
    const [selectedBalance, setSelectedBalance] = useState("");

    const { data: accounts = [], isLoading } = useQuery({
        queryKey: ["chart-of-accounts-opening", user?.id],
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
        queryKey: ["opening-balances-company-id", user?.id],
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
            description: string;
            referenceType: "OpeningBalance";
            sourceType: "opening_balance";
            lines: Array<{ accountId: string; debit: number; credit: number; description: string }>;
        }) => {
            return accountingService.postJournalEntry(data);
        },
        onSuccess: () => {
            toast.success("Opening balances posted successfully!");
            queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
            navigate("/chart-of-accounts");
        },
        onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : "Failed to post opening balances";
            toast.error(message);
        },
    });

    const addBalance = () => {
        if (!selectedAccount || !selectedBalance || parseFloat(selectedBalance) === 0) return;

        const existing = balances.find(b => b.accountId === selectedAccount);
        if (existing) {
            toast.error("This account already has an opening balance");
            return;
        }

        setBalances([...balances, {
            accountId: selectedAccount,
            balance: parseFloat(selectedBalance),
        }]);
        setSelectedAccount("");
        setSelectedBalance("");
    };

    const removeBalance = (accountId: string) => {
        setBalances(balances.filter(b => b.accountId !== accountId));
    };

    const updateBalance = (accountId: string, newBalance: number) => {
        setBalances(balances.map(b =>
            b.accountId === accountId ? { ...b, balance: newBalance } : b
        ));
    };

    // Calculate totals by account type
    const getAccountType = (accountId: string) => {
        return accounts.find(a => a.id === accountId)?.accountType || "";
    };

    const totalAssets = balances
        .filter(b => getAccountType(b.accountId) === "Asset")
        .reduce((sum, b) => sum + b.balance, 0);

    const totalLiabilities = balances
        .filter(b => getAccountType(b.accountId) === "Liability")
        .reduce((sum, b) => sum + b.balance, 0);

    const totalEquity = balances
        .filter(b => getAccountType(b.accountId) === "Equity")
        .reduce((sum, b) => sum + b.balance, 0);

    const difference = totalAssets - (totalLiabilities + totalEquity);
    const isBalanced = Math.abs(difference) < 0.01;

    const handlePost = () => {
        if (!companyId) {
            toast.error("No company context found.");
            return;
        }

        if (!isBalanced && !window.confirm(
            `The accounting equation is not balanced. A journal entry of ${formatZMW(Math.abs(difference))} will be auto-posted to Retained Earnings to balance the books. Continue?`
        )) {
            return;
        }

        // Build journal lines
        const lines = balances.map(b => {
            const accountType = getAccountType(b.accountId);
            const account = accounts.find(a => a.id === b.accountId);

            // Assets and Expenses have debit balances
            // Liabilities, Equity, and Income have credit balances
            if (accountType === "Asset" || accountType === "Expense") {
                return {
                    accountId: b.accountId,
                    debit: Math.abs(b.balance),
                    credit: 0,
                    description: `Opening balance for ${account?.accountName}`,
                };
            } else {
                return {
                    accountId: b.accountId,
                    debit: 0,
                    credit: Math.abs(b.balance),
                    description: `Opening balance for ${account?.accountName}`,
                };
            }
        });

        // Add auto-balancing entry to Retained Earnings if needed
        if (!isBalanced) {
            const retainedEarningsAccount = accounts.find(a =>
                a.accountName.toLowerCase().includes("retained earnings") ||
                a.accountCode === "3010"
            );

            if (retainedEarningsAccount) {
                lines.push({
                    accountId: retainedEarningsAccount.id,
                    debit: difference < 0 ? Math.abs(difference) : 0,
                    credit: difference > 0 ? Math.abs(difference) : 0,
                    description: "Auto-balancing entry for opening balances",
                });
            } else {
                toast.error("Retained Earnings account is required to auto-balance opening entries.");
                return;
            }
        }

        postMutation.mutate({
            companyId,
            entryDate,
            description: "Opening balances",
            referenceType: "OpeningBalance",
            sourceType: "opening_balance",
            lines,
        });
    };

    const progress = (step / 3) * 100;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Opening Balances</h1>
                    <p className="text-muted-foreground">
                        Enter your initial account balances when migrating from another system
                    </p>
                </div>
            </div>

            <Progress value={progress} className="h-2" />

            {step === 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Step 1: Entry Date</CardTitle>
                        <CardDescription>
                            Select the date for your opening balances. This is typically your go-live date or the start of your fiscal year.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="entry-date">Opening Balance Date *</Label>
                            <Input
                                id="entry-date"
                                type="date"
                                value={entryDate}
                                onChange={(e) => setEntryDate(e.target.value)}
                            />
                        </div>

                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                All opening balances will be posted with this date. Make sure this date is before any other transactions in your system.
                            </AlertDescription>
                        </Alert>

                        <div className="flex justify-end">
                            <Button onClick={() => setStep(2)} className="gap-2">
                                Next: Enter Balances
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {step === 2 && (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Step 2: Enter Account Balances</CardTitle>
                            <CardDescription>
                                Add opening balances for each account. Enter positive values for all balance types.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2 space-y-2">
                                    <Label>Account</Label>
                                    <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select account" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {accounts.map((account) => (
                                                <SelectItem key={account.id} value={account.id}>
                                                    {account.accountCode} - {account.accountName} ({account.accountType})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Balance</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={selectedBalance}
                                            onChange={(e) => setSelectedBalance(e.target.value)}
                                        />
                                        <Button onClick={addBalance} type="button">Add</Button>
                                    </div>
                                </div>
                            </div>

                            {balances.length > 0 && (
                                <div className="border rounded-lg">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Account</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead className="text-right">Balance</TableHead>
                                                <TableHead className="w-[50px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {balances.map((balance) => {
                                                const account = accounts.find(a => a.id === balance.accountId);
                                                return (
                                                    <TableRow key={balance.accountId}>
                                                        <TableCell>
                                                            {account?.accountCode} - {account?.accountName}
                                                        </TableCell>
                                                        <TableCell>{account?.accountType}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                className="text-right w-32 ml-auto"
                                                                value={balance.balance}
                                                                onChange={(e) => updateBalance(balance.accountId, parseFloat(e.target.value) || 0)}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => removeBalance(balance.accountId)}
                                                            >
                                                                x
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="flex justify-between">
                        <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>
                        <Button
                            onClick={() => setStep(3)}
                            disabled={balances.length === 0}
                            className="gap-2"
                        >
                            Next: Review
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Step 3: Review & Post</CardTitle>
                            <CardDescription>
                                Review your opening balances and verify the accounting equation
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardDescription>Total Assets</CardDescription>
                                        <CardTitle className="text-2xl">{formatZMW(totalAssets)}</CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardDescription>Total Liabilities</CardDescription>
                                        <CardTitle className="text-2xl">{formatZMW(totalLiabilities)}</CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardDescription>Total Equity</CardDescription>
                                        <CardTitle className="text-2xl">{formatZMW(totalEquity)}</CardTitle>
                                    </CardHeader>
                                </Card>
                            </div>

                            <div
                                className={`p-4 rounded-lg border-2 ${isBalanced
                                        ? "bg-green-50 border-green-500"
                                        : "bg-amber-50 border-amber-500"
                                    }`}
                            >
                                {isBalanced ? (
                                    <div className="flex items-center gap-2 text-green-700">
                                        <CheckCircle2 className="h-5 w-5" />
                                        <div>
                                            <div className="font-semibold">Equation is balanced!</div>
                                            <div className="text-sm">Assets = Liabilities + Equity</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-2 text-amber-700">
                                        <AlertCircle className="h-5 w-5 mt-0.5" />
                                        <div>
                                            <div className="font-semibold">Equation is not balanced</div>
                                            <div className="text-sm">
                                                Difference: {formatZMW(Math.abs(difference))}
                                            </div>
                                            <div className="text-sm mt-1">
                                                This will be automatically balanced to Retained Earnings when posted.
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    Once posted, these opening balances will create a journal entry dated {entryDate}.
                                    Make sure this is correct before proceeding.
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>

                    <div className="flex justify-between">
                        <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>
                        <Button
                            onClick={handlePost}
                            disabled={postMutation.isPending || balances.length === 0}
                        >
                            {postMutation.isPending ? "Posting..." : "Post Opening Balances"}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
