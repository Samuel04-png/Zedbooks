import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, FileText, Eye, Edit, Send } from "lucide-react";
import { Link } from "react-router-dom";

export default function Invoices() {
  const [searchQuery, setSearchQuery] = useState("");

  const invoices = [
    { id: "INV-001", date: "2025-10-28", customer: "World Vision Zambia", amount: "ZMW 15,000.00", status: "Paid", dueDate: "2025-11-28" },
    { id: "INV-002", date: "2025-10-25", customer: "UNICEF", amount: "ZMW 32,500.00", status: "Pending", dueDate: "2025-11-25" },
    { id: "INV-003", date: "2025-10-20", customer: "Red Cross", amount: "ZMW 8,750.00", status: "Overdue", dueDate: "2025-10-30" },
    { id: "INV-004", date: "2025-10-18", customer: "Plan International", amount: "ZMW 22,400.00", status: "Paid", dueDate: "2025-11-18" },
    { id: "INV-005", date: "2025-10-15", customer: "Save the Children", amount: "ZMW 18,900.00", status: "Pending", dueDate: "2025-11-15" },
    { id: "INV-006", date: "2025-10-12", customer: "Oxfam", amount: "ZMW 45,000.00", status: "Paid", dueDate: "2025-11-12" },
    { id: "INV-007", date: "2025-10-10", customer: "Care International", amount: "ZMW 12,300.00", status: "Draft", dueDate: "2025-11-10" },
    { id: "INV-008", date: "2025-10-05", customer: "MSF Zambia", amount: "ZMW 67,850.00", status: "Overdue", dueDate: "2025-10-25" },
  ];

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Paid":
        return "default";
      case "Pending":
        return "secondary";
      case "Overdue":
        return "destructive";
      case "Draft":
        return "outline";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Invoices</h1>
          <p className="text-muted-foreground">Manage customer invoices and payments</p>
        </div>
        <Link to="/invoices/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Invoice
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Invoices</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search invoices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.id}</TableCell>
                  <TableCell>{invoice.date}</TableCell>
                  <TableCell>{invoice.customer}</TableCell>
                  <TableCell>{invoice.dueDate}</TableCell>
                  <TableCell className="font-medium">{invoice.amount}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(invoice.status)}>
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
