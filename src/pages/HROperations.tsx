
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { collection, getDocs, query, where } from "firebase/firestore";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { firestore } from "@/integrations/firebase/client";
import { companyService, hrService } from "@/services/firebase";
import { COLLECTIONS } from "@/services/firebase/collectionNames";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface EmployeeRow {
  id: string;
  fullName: string;
  userId: string | null;
  status: string;
}

interface LeaveTypeRow {
  id: string;
  name: string;
  code: string;
  defaultDays: number;
  isActive: boolean;
}

interface LeaveRequestRow {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: string;
  requestedBy: string | null;
}

interface AttendanceRow {
  id: string;
  employeeId: string;
  employeeName: string;
  attendanceDate: string;
  status: string;
  totalHours: number;
  overtimeHours: number;
  isManual: boolean;
}

interface DisciplinaryRow {
  id: string;
  employeeId: string;
  employeeName: string;
  actionType: string;
  severity: string;
  incidentDate: string;
  reason: string;
  status: string;
}

const MANAGER_ROLES = new Set([
  "super_admin",
  "admin",
  "hr_manager",
  "financial_manager",
  "accountant",
]);

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const statusClass = (status: string) => {
  const normalized = String(status || "").toLowerCase();
  if (["approved", "present", "active", "resolved"].includes(normalized)) {
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  }
  if (["pending"].includes(normalized)) {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
  }
  if (["rejected", "cancelled", "terminated"].includes(normalized)) {
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  }
  if (["suspension", "suspended"].includes(normalized)) {
    return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
  }
  return "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200";
};

export default function HROperations() {
  const { user } = useAuth();
  const { data: userRole } = useUserRole();
  const queryClient = useQueryClient();
  const isManager = MANAGER_ROLES.has(String(userRole || ""));

  const [leaveRequestForm, setLeaveRequestForm] = useState({
    employeeId: "self",
    leaveTypeId: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    reason: "",
  });
  const [leaveBalanceForm, setLeaveBalanceForm] = useState({
    employeeId: "",
    leaveTypeId: "",
    year: new Date().getFullYear(),
    entitledDays: 0,
    carriedForwardDays: 0,
    accruedDays: 0,
    usedDays: 0,
    note: "",
  });
  const [attendanceForm, setAttendanceForm] = useState({
    employeeId: "self",
    attendanceDate: new Date().toISOString().slice(0, 10),
    status: "present",
    totalHours: 8,
    overtimeHours: 0,
    notes: "",
  });
  const [disciplinaryForm, setDisciplinaryForm] = useState({
    employeeId: "",
    actionType: "warning" as "warning" | "suspension" | "termination",
    severity: "medium" as "low" | "medium" | "high" | "critical",
    incidentDate: new Date().toISOString().slice(0, 10),
    reason: "",
    description: "",
  });

  const { data: companyId } = useQuery({
    queryKey: ["hr-company-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const membership = await companyService.getPrimaryMembershipByUser(user.id);
      return membership?.companyId ?? null;
    },
    enabled: Boolean(user),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["hr-employees", companyId],
    queryFn: async () => {
      if (!companyId) return [] as EmployeeRow[];
      const snap = await getDocs(query(collection(firestore, COLLECTIONS.EMPLOYEES), where("companyId", "==", companyId)));
      return snap.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            fullName: String(row.fullName ?? row.full_name ?? "Employee"),
            userId: (row.userId ?? row.user_id ?? null) as string | null,
            status: String(row.employmentStatus ?? row.employment_status ?? "active"),
          } satisfies EmployeeRow;
        })
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
    },
    enabled: Boolean(companyId),
  });

  const employeeById = useMemo(() => {
    const map = new Map<string, EmployeeRow>();
    employees.forEach((employee) => map.set(employee.id, employee));
    return map;
  }, [employees]);

  const currentEmployee = useMemo(() => {
    if (!user) return null;
    return employees.find((employee) => employee.userId === user.id) ?? null;
  }, [employees, user]);

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ["hr-leave-types", companyId],
    queryFn: async () => {
      if (!companyId) return [] as LeaveTypeRow[];
      const snap = await getDocs(query(collection(firestore, COLLECTIONS.LEAVE_TYPES), where("companyId", "==", companyId)));
      return snap.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            name: String(row.name ?? ""),
            code: String(row.code ?? ""),
            defaultDays: toNumber(row.defaultDaysPerYear ?? row.default_days_per_year, 0),
            isActive: Boolean(row.isActive ?? row.is_active ?? true),
          } satisfies LeaveTypeRow;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: Boolean(companyId),
  });

  const leaveTypeById = useMemo(() => {
    const map = new Map<string, LeaveTypeRow>();
    leaveTypes.forEach((leaveType) => map.set(leaveType.id, leaveType));
    return map;
  }, [leaveTypes]);

  const { data: leaveRequests = [] } = useQuery({
    queryKey: ["hr-leave-requests", companyId, employees, leaveTypes],
    queryFn: async () => {
      if (!companyId) return [] as LeaveRequestRow[];
      const snap = await getDocs(query(collection(firestore, COLLECTIONS.LEAVE_REQUESTS), where("companyId", "==", companyId)));
      return snap.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          const employeeId = String(row.employeeId ?? row.employee_id ?? "");
          const leaveTypeId = String(row.leaveTypeId ?? row.leave_type_id ?? "");
          return {
            id: docSnap.id,
            employeeId,
            employeeName: employeeById.get(employeeId)?.fullName ?? employeeId,
            leaveTypeId,
            leaveTypeName: leaveTypeById.get(leaveTypeId)?.name ?? leaveTypeId,
            startDate: String(row.startDate ?? row.start_date ?? ""),
            endDate: String(row.endDate ?? row.end_date ?? ""),
            totalDays: toNumber(row.totalDays ?? row.total_days ?? 0),
            reason: String(row.reason ?? ""),
            status: String(row.status ?? "pending"),
            requestedBy: (row.requestedBy ?? row.requested_by ?? null) as string | null,
          } satisfies LeaveRequestRow;
        })
        .sort((a, b) => b.startDate.localeCompare(a.startDate));
    },
    enabled: Boolean(companyId),
  });

  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ["hr-attendance-records", companyId, employees],
    queryFn: async () => {
      if (!companyId) return [] as AttendanceRow[];
      const snap = await getDocs(query(collection(firestore, COLLECTIONS.ATTENDANCE_RECORDS), where("companyId", "==", companyId)));
      return snap.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          const employeeId = String(row.employeeId ?? row.employee_id ?? "");
          return {
            id: docSnap.id,
            employeeId,
            employeeName: employeeById.get(employeeId)?.fullName ?? employeeId,
            attendanceDate: String(row.attendanceDate ?? row.attendance_date ?? ""),
            status: String(row.status ?? "present"),
            totalHours: toNumber(row.totalHours ?? row.total_hours, 0),
            overtimeHours: toNumber(row.overtimeHours ?? row.overtime_hours, 0),
            isManual: Boolean(row.isManual ?? row.is_manual ?? false),
          } satisfies AttendanceRow;
        })
        .sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate));
    },
    enabled: Boolean(companyId),
  });

  const { data: disciplinaryRecords = [] } = useQuery({
    queryKey: ["hr-disciplinary-records", companyId, employees],
    queryFn: async () => {
      if (!companyId) return [] as DisciplinaryRow[];
      const snap = await getDocs(query(collection(firestore, COLLECTIONS.DISCIPLINARY_RECORDS), where("companyId", "==", companyId)));
      return snap.docs
        .map((docSnap) => {
          const row = docSnap.data() as Record<string, unknown>;
          const employeeId = String(row.employeeId ?? row.employee_id ?? "");
          return {
            id: docSnap.id,
            employeeId,
            employeeName: employeeById.get(employeeId)?.fullName ?? employeeId,
            actionType: String(row.actionType ?? row.action_type ?? ""),
            severity: String(row.severity ?? "medium"),
            incidentDate: String(row.incidentDate ?? row.incident_date ?? ""),
            reason: String(row.reason ?? ""),
            status: String(row.status ?? "active"),
          } satisfies DisciplinaryRow;
        })
        .sort((a, b) => b.incidentDate.localeCompare(a.incidentDate));
    },
    enabled: Boolean(companyId),
  });

  const seedLeaveTypesMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No active company context");
      return hrService.seedDefaultLeaveTypes({ companyId });
    },
    onSuccess: () => {
      toast.success("Default leave types seeded.");
      queryClient.invalidateQueries({ queryKey: ["hr-leave-types", companyId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submitLeaveRequestMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No active company context");
      if (!leaveRequestForm.leaveTypeId) throw new Error("Leave type is required.");
      if (!leaveRequestForm.reason.trim()) throw new Error("Reason is required.");

      const payload: {
        companyId: string;
        leaveTypeId: string;
        startDate: string;
        endDate: string;
        reason: string;
        employeeId?: string;
      } = {
        companyId,
        leaveTypeId: leaveRequestForm.leaveTypeId,
        startDate: leaveRequestForm.startDate,
        endDate: leaveRequestForm.endDate,
        reason: leaveRequestForm.reason.trim(),
      };

      if (isManager && leaveRequestForm.employeeId && leaveRequestForm.employeeId !== "self") {
        payload.employeeId = leaveRequestForm.employeeId;
      }

      return hrService.submitLeaveRequest(payload);
    },
    onSuccess: () => {
      toast.success("Leave request submitted.");
      setLeaveRequestForm((prev) => ({
        ...prev,
        leaveTypeId: "",
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        reason: "",
      }));
      queryClient.invalidateQueries({ queryKey: ["hr-leave-requests", companyId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reviewLeaveRequestMutation = useMutation({
    mutationFn: async ({ leaveRequestId, action }: { leaveRequestId: string; action: "approve" | "reject" | "cancel" }) => {
      if (!companyId) throw new Error("No active company context");
      return hrService.reviewLeaveRequest({ companyId, leaveRequestId, action });
    },
    onSuccess: (_, variables) => {
      toast.success(`Leave request ${variables.action}d.`);
      queryClient.invalidateQueries({ queryKey: ["hr-leave-requests", companyId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setLeaveBalanceMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No active company context");
      if (!leaveBalanceForm.employeeId || !leaveBalanceForm.leaveTypeId) {
        throw new Error("Employee and leave type are required.");
      }
      return hrService.setLeaveBalance({
        companyId,
        employeeId: leaveBalanceForm.employeeId,
        leaveTypeId: leaveBalanceForm.leaveTypeId,
        year: leaveBalanceForm.year,
        entitledDays: leaveBalanceForm.entitledDays,
        carriedForwardDays: leaveBalanceForm.carriedForwardDays,
        accruedDays: leaveBalanceForm.accruedDays,
        usedDays: leaveBalanceForm.usedDays,
        note: leaveBalanceForm.note || undefined,
      });
    },
    onSuccess: () => toast.success("Leave balance saved."),
    onError: (error: Error) => toast.error(error.message),
  });

  const clockAttendanceMutation = useMutation({
    mutationFn: async (action: "clock_in" | "clock_out") => {
      if (!companyId) throw new Error("No active company context");
      const payload: { companyId: string; action: "clock_in" | "clock_out"; employeeId?: string } = {
        companyId,
        action,
      };
      if (isManager && attendanceForm.employeeId && attendanceForm.employeeId !== "self") {
        payload.employeeId = attendanceForm.employeeId;
      }
      return hrService.clockAttendance(payload);
    },
    onSuccess: (_, action) => {
      toast.success(action === "clock_in" ? "Clock-in recorded." : "Clock-out recorded.");
      queryClient.invalidateQueries({ queryKey: ["hr-attendance-records", companyId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const adjustAttendanceMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No active company context");
      if (!isManager) throw new Error("Only HR managers can adjust attendance.");
      if (!attendanceForm.employeeId || attendanceForm.employeeId === "self") {
        throw new Error("Employee is required for manual adjustment.");
      }
      return hrService.adjustAttendance({
        companyId,
        employeeId: attendanceForm.employeeId,
        attendanceDate: attendanceForm.attendanceDate,
        status: attendanceForm.status,
        totalHours: attendanceForm.totalHours,
        overtimeHours: attendanceForm.overtimeHours,
        notes: attendanceForm.notes || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Attendance adjusted.");
      queryClient.invalidateQueries({ queryKey: ["hr-attendance-records", companyId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const logDisciplinaryMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No active company context");
      if (!disciplinaryForm.employeeId || !disciplinaryForm.reason.trim()) {
        throw new Error("Employee and reason are required.");
      }
      return hrService.logDisciplinaryRecord({
        companyId,
        employeeId: disciplinaryForm.employeeId,
        actionType: disciplinaryForm.actionType,
        severity: disciplinaryForm.severity,
        incidentDate: disciplinaryForm.incidentDate,
        effectiveFrom: disciplinaryForm.incidentDate,
        reason: disciplinaryForm.reason.trim(),
        description: disciplinaryForm.description.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Disciplinary record logged.");
      setDisciplinaryForm({
        employeeId: "",
        actionType: "warning",
        severity: "medium",
        incidentDate: new Date().toISOString().slice(0, 10),
        reason: "",
        description: "",
      });
      queryClient.invalidateQueries({ queryKey: ["hr-disciplinary-records", companyId] });
      queryClient.invalidateQueries({ queryKey: ["hr-employees", companyId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resolveDisciplinaryMutation = useMutation({
    mutationFn: async ({ recordId, resolutionStatus }: { recordId: string; resolutionStatus: "resolved" | "cancelled" }) => {
      if (!companyId) throw new Error("No active company context");
      return hrService.resolveDisciplinaryRecord({ companyId, recordId, resolutionStatus });
    },
    onSuccess: (_, variables) => {
      toast.success(`Record ${variables.resolutionStatus}.`);
      queryClient.invalidateQueries({ queryKey: ["hr-disciplinary-records", companyId] });
      queryClient.invalidateQueries({ queryKey: ["hr-employees", companyId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const pendingLeave = leaveRequests.filter((item) => item.status.toLowerCase() === "pending").length;
  const activeDiscipline = disciplinaryRecords.filter((item) => item.status.toLowerCase() === "active").length;
  const today = new Date().toISOString().slice(0, 10);
  const attendanceToday = attendanceRecords.filter((item) => item.attendanceDate === today).length;

  const canCancelLeaveRequest = (request: LeaveRequestRow) => {
    if (isManager) return true;
    return request.requestedBy === user?.id;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">HR Operations</h1>
          <p className="text-muted-foreground">Leave, attendance, and disciplinary workflows.</p>
        </div>
        {isManager && (
          <Button
            variant="outline"
            onClick={() => seedLeaveTypesMutation.mutate()}
            disabled={seedLeaveTypesMutation.isPending}
          >
            Seed Default Leave Types
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Employees</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{employees.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Leave</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{pendingLeave}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Attendance Today</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{attendanceToday}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Discipline</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{activeDiscipline}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="leave" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 md:w-[520px]">
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="disciplinary">Disciplinary</TabsTrigger>
        </TabsList>

        <TabsContent value="leave" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Leave Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[380px] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead className="text-right">Days</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveTypes.map((leaveType) => (
                        <TableRow key={leaveType.id}>
                          <TableCell className="font-medium">{leaveType.name}</TableCell>
                          <TableCell>{leaveType.code}</TableCell>
                          <TableCell className="text-right">{leaveType.defaultDays}</TableCell>
                          <TableCell>
                            <Badge className={statusClass(leaveType.isActive ? "active" : "inactive")}>
                              {leaveType.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {leaveTypes.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                            No leave types found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Leave Requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 rounded-md border p-3">
                  {isManager && (
                    <div className="space-y-2">
                      <Label>Employee</Label>
                      <Select
                        value={leaveRequestForm.employeeId}
                        onValueChange={(value) =>
                          setLeaveRequestForm((prev) => ({ ...prev, employeeId: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Self or select employee" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="self">Self</SelectItem>
                          {employees.map((employee) => (
                            <SelectItem key={employee.id} value={employee.id}>
                              {employee.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {!isManager && (
                    <p className="text-sm text-muted-foreground">
                      Requesting as: {currentEmployee?.fullName || "linked employee profile"}
                    </p>
                  )}

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Leave Type</Label>
                      <Select
                        value={leaveRequestForm.leaveTypeId}
                        onValueChange={(value) =>
                          setLeaveRequestForm((prev) => ({ ...prev, leaveTypeId: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select leave type" />
                        </SelectTrigger>
                        <SelectContent>
                          {leaveTypes
                            .filter((leaveType) => leaveType.isActive)
                            .map((leaveType) => (
                              <SelectItem key={leaveType.id} value={leaveType.id}>
                                {leaveType.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={leaveRequestForm.startDate}
                        onChange={(e) =>
                          setLeaveRequestForm((prev) => ({ ...prev, startDate: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={leaveRequestForm.endDate}
                        onChange={(e) =>
                          setLeaveRequestForm((prev) => ({ ...prev, endDate: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Textarea
                      value={leaveRequestForm.reason}
                      onChange={(e) =>
                        setLeaveRequestForm((prev) => ({ ...prev, reason: e.target.value }))
                      }
                      placeholder="Reason for leave"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => submitLeaveRequestMutation.mutate()}
                      disabled={submitLeaveRequestMutation.isPending}
                    >
                      Submit Leave Request
                    </Button>
                  </div>
                </div>

                {isManager && (
                  <div className="space-y-3 rounded-md border p-3">
                    <h3 className="text-sm font-semibold">Set Leave Balance</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Employee</Label>
                        <Select
                          value={leaveBalanceForm.employeeId}
                          onValueChange={(value) =>
                            setLeaveBalanceForm((prev) => ({ ...prev, employeeId: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select employee" />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.map((employee) => (
                              <SelectItem key={employee.id} value={employee.id}>
                                {employee.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Leave Type</Label>
                        <Select
                          value={leaveBalanceForm.leaveTypeId}
                          onValueChange={(value) =>
                            setLeaveBalanceForm((prev) => ({ ...prev, leaveTypeId: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select leave type" />
                          </SelectTrigger>
                          <SelectContent>
                            {leaveTypes.map((leaveType) => (
                              <SelectItem key={leaveType.id} value={leaveType.id}>
                                {leaveType.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Year</Label>
                        <Input
                          type="number"
                          value={leaveBalanceForm.year}
                          onChange={(e) =>
                            setLeaveBalanceForm((prev) => ({ ...prev, year: toNumber(e.target.value, new Date().getFullYear()) }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Entitled</Label>
                        <Input
                          type="number"
                          value={leaveBalanceForm.entitledDays}
                          onChange={(e) =>
                            setLeaveBalanceForm((prev) => ({ ...prev, entitledDays: toNumber(e.target.value, 0) }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Carry Forward</Label>
                        <Input
                          type="number"
                          value={leaveBalanceForm.carriedForwardDays}
                          onChange={(e) =>
                            setLeaveBalanceForm((prev) => ({ ...prev, carriedForwardDays: toNumber(e.target.value, 0) }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Accrued</Label>
                        <Input
                          type="number"
                          value={leaveBalanceForm.accruedDays}
                          onChange={(e) =>
                            setLeaveBalanceForm((prev) => ({ ...prev, accruedDays: toNumber(e.target.value, 0) }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Used</Label>
                        <Input
                          type="number"
                          value={leaveBalanceForm.usedDays}
                          onChange={(e) =>
                            setLeaveBalanceForm((prev) => ({ ...prev, usedDays: toNumber(e.target.value, 0) }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Note</Label>
                        <Input
                          value={leaveBalanceForm.note}
                          onChange={(e) =>
                            setLeaveBalanceForm((prev) => ({ ...prev, note: e.target.value }))
                          }
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={() => setLeaveBalanceMutation.mutate()} disabled={setLeaveBalanceMutation.isPending}>
                        Save Leave Balance
                      </Button>
                    </div>
                  </div>
                )}

                <div className="max-h-[300px] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Days</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.employeeName}</TableCell>
                          <TableCell>{request.leaveTypeName}</TableCell>
                          <TableCell>{request.startDate} to {request.endDate}</TableCell>
                          <TableCell className="text-right">{request.totalDays}</TableCell>
                          <TableCell>
                            <Badge className={statusClass(request.status)}>{request.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {request.status.toLowerCase() === "pending" && isManager && (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => reviewLeaveRequestMutation.mutate({ leaveRequestId: request.id, action: "approve" })}>Approve</Button>
                                <Button size="sm" variant="destructive" onClick={() => reviewLeaveRequestMutation.mutate({ leaveRequestId: request.id, action: "reject" })}>Reject</Button>
                              </div>
                            )}
                            {request.status.toLowerCase() === "pending" && !isManager && canCancelLeaveRequest(request) && (
                              <Button size="sm" variant="outline" onClick={() => reviewLeaveRequestMutation.mutate({ leaveRequestId: request.id, action: "cancel" })}>Cancel</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {leaveRequests.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No leave requests found.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Attendance Actions</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {isManager && (
                  <div className="space-y-2">
                    <Label>Employee</Label>
                    <Select value={attendanceForm.employeeId} onValueChange={(value) => setAttendanceForm((prev) => ({ ...prev, employeeId: value }))}>
                      <SelectTrigger><SelectValue placeholder="Self or employee" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="self">Self</SelectItem>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>{employee.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {!isManager && !currentEmployee && (
                  <p className="text-sm text-amber-700 dark:text-amber-300">No employee profile is linked to your user.</p>
                )}
                <div className="flex gap-2">
                  <Button onClick={() => clockAttendanceMutation.mutate("clock_in")} disabled={clockAttendanceMutation.isPending || (!isManager && !currentEmployee)}>Clock In</Button>
                  <Button variant="outline" onClick={() => clockAttendanceMutation.mutate("clock_out")} disabled={clockAttendanceMutation.isPending || (!isManager && !currentEmployee)}>Clock Out</Button>
                </div>

                {isManager && (
                  <div className="space-y-3 rounded-md border p-3">
                    <h3 className="text-sm font-semibold">Manual Attendance Adjustment</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input type="date" value={attendanceForm.attendanceDate} onChange={(e) => setAttendanceForm((prev) => ({ ...prev, attendanceDate: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={attendanceForm.status} onValueChange={(value) => setAttendanceForm((prev) => ({ ...prev, status: value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="present">Present</SelectItem>
                            <SelectItem value="absent">Absent</SelectItem>
                            <SelectItem value="leave">Leave</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Total Hours</Label>
                        <Input type="number" value={attendanceForm.totalHours} onChange={(e) => setAttendanceForm((prev) => ({ ...prev, totalHours: toNumber(e.target.value, 0) }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Overtime Hours</Label>
                        <Input type="number" value={attendanceForm.overtimeHours} onChange={(e) => setAttendanceForm((prev) => ({ ...prev, overtimeHours: toNumber(e.target.value, 0) }))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Input value={attendanceForm.notes} onChange={(e) => setAttendanceForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Manual adjustment note" />
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={() => adjustAttendanceMutation.mutate()} disabled={adjustAttendanceMutation.isPending}>Save Adjustment</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Attendance Records</CardTitle></CardHeader>
              <CardContent>
                <div className="max-h-[520px] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead className="text-right">OT</TableHead>
                        <TableHead>Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{record.attendanceDate}</TableCell>
                          <TableCell className="font-medium">{record.employeeName}</TableCell>
                          <TableCell><Badge className={statusClass(record.status)}>{record.status}</Badge></TableCell>
                          <TableCell className="text-right">{record.totalHours.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{record.overtimeHours.toFixed(2)}</TableCell>
                          <TableCell>{record.isManual ? "Manual" : "Clock"}</TableCell>
                        </TableRow>
                      ))}
                      {attendanceRecords.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No attendance records found.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="disciplinary" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Log Disciplinary Record</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {!isManager && (
                  <p className="text-sm text-muted-foreground">Read-only view. HR manager/admin roles can log and resolve records.</p>
                )}
                {isManager && (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Employee</Label>
                        <Select value={disciplinaryForm.employeeId} onValueChange={(value) => setDisciplinaryForm((prev) => ({ ...prev, employeeId: value }))}>
                          <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                          <SelectContent>
                            {employees.map((employee) => (
                              <SelectItem key={employee.id} value={employee.id}>{employee.fullName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Action</Label>
                        <Select value={disciplinaryForm.actionType} onValueChange={(value) => setDisciplinaryForm((prev) => ({ ...prev, actionType: value as "warning" | "suspension" | "termination" }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="warning">Warning</SelectItem>
                            <SelectItem value="suspension">Suspension</SelectItem>
                            <SelectItem value="termination">Termination</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Severity</Label>
                        <Select value={disciplinaryForm.severity} onValueChange={(value) => setDisciplinaryForm((prev) => ({ ...prev, severity: value as "low" | "medium" | "high" | "critical" }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Incident Date</Label>
                        <Input type="date" value={disciplinaryForm.incidentDate} onChange={(e) => setDisciplinaryForm((prev) => ({ ...prev, incidentDate: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Reason</Label>
                      <Textarea value={disciplinaryForm.reason} onChange={(e) => setDisciplinaryForm((prev) => ({ ...prev, reason: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea value={disciplinaryForm.description} onChange={(e) => setDisciplinaryForm((prev) => ({ ...prev, description: e.target.value }))} />
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={() => logDisciplinaryMutation.mutate()} disabled={logDisciplinaryMutation.isPending}>Log Record</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Disciplinary Records</CardTitle></CardHeader>
              <CardContent>
                <div className="max-h-[520px] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {disciplinaryRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{record.incidentDate}</TableCell>
                          <TableCell className="font-medium">{record.employeeName}</TableCell>
                          <TableCell>{record.actionType}</TableCell>
                          <TableCell>{record.severity}</TableCell>
                          <TableCell><Badge className={statusClass(record.status)}>{record.status}</Badge></TableCell>
                          <TableCell className="max-w-[220px] truncate">{record.reason}</TableCell>
                          <TableCell className="text-right">
                            {isManager && record.status.toLowerCase() === "active" && (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => resolveDisciplinaryMutation.mutate({ recordId: record.id, resolutionStatus: "resolved" })}>Resolve</Button>
                                <Button size="sm" variant="destructive" onClick={() => resolveDisciplinaryMutation.mutate({ recordId: record.id, resolutionStatus: "cancelled" })}>Cancel</Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {disciplinaryRecords.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No disciplinary records found.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
