import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Search, Shield, Clock } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { companyService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  tableName: string;
  recordId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

const toDateTimeString = (value: unknown): string => {
  if (!value) return new Date(0).toISOString();
  if (typeof value === "string") {
    const asDate = new Date(value);
    return Number.isNaN(asDate.getTime()) ? new Date(0).toISOString() : asDate.toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const timestamp = value as { toDate?: () => Date };
    if (typeof timestamp.toDate === "function") {
      return timestamp.toDate().toISOString();
    }
  }
  return new Date(0).toISOString();
};

export default function AuditLogs() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTable, setSelectedTable] = useState<string>("all");
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", user?.id],
    queryFn: async () => {
      if (!user) return [] as AuditLog[];

      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      if (!membership?.companyId) return [] as AuditLog[];

      const logsRef = collection(firestore, COLLECTIONS.AUDIT_LOGS);
      const snapshot = await getDocs(
        query(logsRef, where("companyId", "==", membership.companyId), limit(1000)),
      );

      return snapshot.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          const details = (row.details as Record<string, unknown> | null) || null;

          return {
            id: docSnap.id,
            userId: (row.actorUid ?? row.userId ?? row.user_id ?? null) as string | null,
            action: String(row.action ?? "unknown"),
            tableName: String(
              row.tableName ??
                row.table_name ??
                details?.sourceCollection ??
                details?.sourceType ??
                "-",
            ),
            recordId: (row.recordId ?? row.record_id ?? details?.sourceId ?? null) as string | null,
            oldValues: (row.oldValues ?? row.old_values ?? null) as Record<string, unknown> | null,
            newValues: (row.newValues ?? row.new_values ?? details ?? null) as Record<string, unknown> | null,
            ipAddress: (row.ipAddress ?? row.ip_address ?? null) as string | null,
            createdAt: toDateTimeString(row.createdAt ?? row.created_at),
          } satisfies AuditLog;
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    enabled: Boolean(user),
  });

  const filteredLogs = logs.filter((log) => {
    const createdDate = log.createdAt.slice(0, 10);
    if (createdDate < startDate || createdDate > endDate) return false;
    if (selectedTable !== "all" && log.tableName !== selectedTable) return false;
    if (selectedAction !== "all" && log.action !== selectedAction) return false;

    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();

    return (
      log.action.toLowerCase().includes(searchLower) ||
      log.tableName.toLowerCase().includes(searchLower) ||
      log.recordId?.toLowerCase().includes(searchLower)
    );
  });

  const uniqueTables = Array.from(new Set(logs.map((l) => l.tableName))).sort();
  const uniqueActions = Array.from(new Set(logs.map((l) => l.action))).sort();

  const getActionBadgeVariant = (action: string) => {
    switch (action.toLowerCase()) {
      case "create":
      case "insert":
        return "default" as const;
      case "update":
        return "secondary" as const;
      case "delete":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

  const exportLogs = () => {
    if (filteredLogs.length === 0) return;

    const headers = ["Timestamp", "Action", "Table", "Record ID", "User ID"];
    const rows = filteredLogs.map((log) => [
      format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss"),
      log.action,
      log.tableName,
      log.recordId || "",
      log.userId || "",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Audit Logs
          </h1>
          <p className="text-muted-foreground">Track all system activities and changes</p>
        </div>
        <Button variant="outline" onClick={exportLogs} disabled={filteredLogs.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label>Search</Label>
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Table</Label>
              <Select value={selectedTable} onValueChange={setSelectedTable}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tables</SelectItem>
                  {uniqueTables.map((table) => (
                    <SelectItem key={table} value={table}>
                      {table}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {uniqueActions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Activity Log
            </span>
            <Badge variant="outline">{filteredLogs.length} records</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Record ID</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getActionBadgeVariant(log.action)}>{log.action.toUpperCase()}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{log.tableName}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {log.recordId ? `${log.recordId.slice(0, 8)}...` : "-"}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    {log.newValues && (
                      <details className="cursor-pointer">
                        <summary className="text-sm text-muted-foreground">View changes</summary>
                        <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-auto max-h-32">
                          {JSON.stringify(log.newValues, null, 2)}
                        </pre>
                      </details>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No audit logs found for the selected criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
