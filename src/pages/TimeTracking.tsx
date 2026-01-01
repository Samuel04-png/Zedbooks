import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Clock, Users, Search } from "lucide-react";

interface Contractor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  specialty: string | null;
  hourly_rate: number;
  daily_rate: number;
  tpin: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  is_active: boolean;
}

interface TimeEntry {
  id: string;
  contractor_id: string | null;
  employee_id: string | null;
  project_name: string | null;
  description: string | null;
  work_date: string;
  hours_worked: number;
  hourly_rate: number;
  total_amount: number;
  status: string | null;
  contractor?: { name: string };
  employee?: { full_name: string };
}

const TimeTracking = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isContractorDialogOpen, setIsContractorDialogOpen] = useState(false);
  const [isTimeEntryDialogOpen, setIsTimeEntryDialogOpen] = useState(false);
  const [newContractor, setNewContractor] = useState({
    name: "",
    email: "",
    phone: "",
    specialty: "",
    hourly_rate: 0,
    daily_rate: 0,
    tpin: "",
    bank_name: "",
    bank_account_number: "",
  });
  const [newTimeEntry, setNewTimeEntry] = useState({
    contractor_id: "",
    project_name: "",
    description: "",
    work_date: new Date().toISOString().split("T")[0],
    hours_worked: 0,
    hourly_rate: 0,
  });

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: contractors = [], isLoading: contractorsLoading } = useQuery({
    queryKey: ["contractors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contractors")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Contractor[];
    },
    enabled: !!user,
  });

  const { data: timeEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ["time-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          *,
          contractor:contractors(name)
        `)
        .order("work_date", { ascending: false });
      if (error) throw error;
      return data as TimeEntry[];
    },
    enabled: !!user,
  });

  const addContractorMutation = useMutation({
    mutationFn: async (contractor: typeof newContractor) => {
      const { error } = await supabase.from("contractors").insert({
        ...contractor,
        user_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contractors"] });
      toast.success("Contractor added successfully");
      setIsContractorDialogOpen(false);
      setNewContractor({
        name: "",
        email: "",
        phone: "",
        specialty: "",
        hourly_rate: 0,
        daily_rate: 0,
        tpin: "",
        bank_name: "",
        bank_account_number: "",
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const addTimeEntryMutation = useMutation({
    mutationFn: async (entry: typeof newTimeEntry) => {
      const totalAmount = entry.hours_worked * entry.hourly_rate;
      const { error } = await supabase.from("time_entries").insert({
        ...entry,
        contractor_id: entry.contractor_id || null,
        total_amount: totalAmount,
        user_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      toast.success("Time entry recorded");
      setIsTimeEntryDialogOpen(false);
      setNewTimeEntry({
        contractor_id: "",
        project_name: "",
        description: "",
        work_date: new Date().toISOString().split("T")[0],
        hours_worked: 0,
        hourly_rate: 0,
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateEntryStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("time_entries")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      toast.success("Status updated");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const filteredContractors = contractors.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.specialty?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZM", {
      style: "currency",
      currency: "ZMW",
    }).format(amount);
  };

  const totalPendingAmount = timeEntries
    .filter(e => e.status === "pending")
    .reduce((sum, e) => sum + e.total_amount, 0);

  const totalHoursThisMonth = timeEntries
    .filter(e => {
      const entryDate = new Date(e.work_date);
      const now = new Date();
      return entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, e) => sum + e.hours_worked, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Time & Contractors</h1>
          <p className="text-muted-foreground">Manage contractors and track time entries</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Contractors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contractors.filter(c => c.is_active).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours This Month</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHoursThisMonth.toFixed(1)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Entries</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{timeEntries.filter(e => e.status === "pending").length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Amount</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPendingAmount)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="contractors">
        <TabsList>
          <TabsTrigger value="contractors">Contractors</TabsTrigger>
          <TabsTrigger value="time-entries">Time Entries</TabsTrigger>
        </TabsList>

        <TabsContent value="contractors" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contractors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Dialog open={isContractorDialogOpen} onOpenChange={setIsContractorDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Contractor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Contractor</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={newContractor.name}
                      onChange={(e) => setNewContractor({ ...newContractor, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={newContractor.email}
                      onChange={(e) => setNewContractor({ ...newContractor, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={newContractor.phone}
                      onChange={(e) => setNewContractor({ ...newContractor, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Specialty</Label>
                    <Input
                      value={newContractor.specialty}
                      onChange={(e) => setNewContractor({ ...newContractor, specialty: e.target.value })}
                      placeholder="e.g., IT Consultant, Trainer"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hourly Rate (ZMW)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newContractor.hourly_rate}
                      onChange={(e) => setNewContractor({ ...newContractor, hourly_rate: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Daily Rate (ZMW)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newContractor.daily_rate}
                      onChange={(e) => setNewContractor({ ...newContractor, daily_rate: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>TPIN</Label>
                    <Input
                      value={newContractor.tpin}
                      onChange={(e) => setNewContractor({ ...newContractor, tpin: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Name</Label>
                    <Input
                      value={newContractor.bank_name}
                      onChange={(e) => setNewContractor({ ...newContractor, bank_name: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Bank Account Number</Label>
                    <Input
                      value={newContractor.bank_account_number}
                      onChange={(e) => setNewContractor({ ...newContractor, bank_account_number: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setIsContractorDialogOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => addContractorMutation.mutate(newContractor)}
                    disabled={!newContractor.name}
                  >
                    Add Contractor
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-6">
              {contractorsLoading ? (
                <p>Loading contractors...</p>
              ) : filteredContractors.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No contractors found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Specialty</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead className="text-right">Hourly Rate</TableHead>
                      <TableHead className="text-right">Daily Rate</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContractors.map((contractor) => (
                      <TableRow key={contractor.id}>
                        <TableCell className="font-medium">{contractor.name}</TableCell>
                        <TableCell>{contractor.specialty || "-"}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {contractor.email && <div>{contractor.email}</div>}
                            {contractor.phone && <div>{contractor.phone}</div>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(contractor.hourly_rate)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(contractor.daily_rate)}</TableCell>
                        <TableCell>
                          <Badge variant={contractor.is_active ? "secondary" : "outline"}>
                            {contractor.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time-entries" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isTimeEntryDialogOpen} onOpenChange={setIsTimeEntryDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Record Time
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Time Entry</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Contractor</Label>
                    <Select
                      value={newTimeEntry.contractor_id}
                      onValueChange={(value) => {
                        const contractor = contractors.find(c => c.id === value);
                        setNewTimeEntry({
                          ...newTimeEntry,
                          contractor_id: value,
                          hourly_rate: contractor?.hourly_rate || 0,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select contractor" />
                      </SelectTrigger>
                      <SelectContent>
                        {contractors.filter(c => c.is_active).map((contractor) => (
                          <SelectItem key={contractor.id} value={contractor.id}>
                            {contractor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Project Name</Label>
                    <Input
                      value={newTimeEntry.project_name}
                      onChange={(e) => setNewTimeEntry({ ...newTimeEntry, project_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Work Date</Label>
                    <Input
                      type="date"
                      value={newTimeEntry.work_date}
                      onChange={(e) => setNewTimeEntry({ ...newTimeEntry, work_date: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Hours Worked</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={newTimeEntry.hours_worked}
                        onChange={(e) => setNewTimeEntry({ ...newTimeEntry, hours_worked: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Hourly Rate (ZMW)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newTimeEntry.hourly_rate}
                        onChange={(e) => setNewTimeEntry({ ...newTimeEntry, hourly_rate: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={newTimeEntry.description}
                      onChange={(e) => setNewTimeEntry({ ...newTimeEntry, description: e.target.value })}
                      placeholder="Work performed"
                    />
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between text-sm">
                      <span>Total Amount:</span>
                      <span className="font-bold">{formatCurrency(newTimeEntry.hours_worked * newTimeEntry.hourly_rate)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setIsTimeEntryDialogOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => addTimeEntryMutation.mutate(newTimeEntry)}
                    disabled={newTimeEntry.hours_worked <= 0}
                  >
                    Record Entry
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-6">
              {entriesLoading ? (
                <p>Loading time entries...</p>
              ) : timeEntries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No time entries found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Contractor</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{new Date(entry.work_date).toLocaleDateString()}</TableCell>
                        <TableCell>{entry.contractor?.name || "-"}</TableCell>
                        <TableCell>{entry.project_name || "-"}</TableCell>
                        <TableCell className="text-right">{entry.hours_worked}</TableCell>
                        <TableCell className="text-right">{formatCurrency(entry.hourly_rate)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(entry.total_amount)}</TableCell>
                        <TableCell>
                          <Badge variant={
                            entry.status === "paid" ? "secondary" :
                            entry.status === "approved" ? "default" : "outline"
                          }>
                            {entry.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {entry.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateEntryStatus.mutate({ id: entry.id, status: "approved" })}
                            >
                              Approve
                            </Button>
                          )}
                          {entry.status === "approved" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateEntryStatus.mutate({ id: entry.id, status: "paid" })}
                            >
                              Mark Paid
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TimeTracking;
