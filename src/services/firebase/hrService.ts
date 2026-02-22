import { callFunction } from "@/services/firebase/functionsService";

export interface LeaveTypeInput {
  companyId: string;
  leaveTypeId?: string;
  name: string;
  code?: string;
  description?: string;
  defaultDaysPerYear?: number;
  isPaid?: boolean;
  requiresApproval?: boolean;
  isActive?: boolean;
}

export interface LeaveBalanceInput {
  companyId: string;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  entitledDays?: number;
  carriedForwardDays?: number;
  accruedDays?: number;
  usedDays?: number;
  note?: string;
}

export interface LeaveRequestInput {
  companyId: string;
  employeeId?: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface LeaveReviewInput {
  companyId: string;
  leaveRequestId: string;
  action: "approve" | "reject" | "cancel";
  reviewNote?: string;
}

export interface AttendanceClockInput {
  companyId: string;
  employeeId?: string;
  action: "clock_in" | "clock_out";
  timestamp?: string;
  notes?: string;
}

export interface AttendanceAdjustmentInput {
  companyId: string;
  employeeId: string;
  attendanceDate: string;
  status?: string;
  totalHours?: number;
  overtimeHours?: number;
  clockInTime?: string | null;
  clockOutTime?: string | null;
  notes?: string;
}

export interface DisciplinaryInput {
  companyId: string;
  employeeId: string;
  actionType: "warning" | "suspension" | "termination";
  severity: "low" | "medium" | "high" | "critical";
  incidentDate: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  reason: string;
  description?: string;
}

export interface ResolveDisciplinaryInput {
  companyId: string;
  recordId: string;
  resolutionStatus: "resolved" | "cancelled";
  resolutionNote?: string;
}

export const hrService = {
  async seedDefaultLeaveTypes(input: { companyId: string }): Promise<{
    success: boolean;
    leaveTypesSeeded: number;
  }> {
    return callFunction<typeof input, { success: boolean; leaveTypesSeeded: number }>(
      "seedDefaultLeaveTypes",
      input,
    );
  },

  async saveLeaveType(input: LeaveTypeInput): Promise<{
    success: boolean;
    leaveTypeId: string;
  }> {
    return callFunction<LeaveTypeInput, { success: boolean; leaveTypeId: string }>(
      "saveLeaveType",
      input,
    );
  },

  async setLeaveBalance(input: LeaveBalanceInput): Promise<{
    success: boolean;
    balanceId: string;
    availableDays: number;
  }> {
    return callFunction<LeaveBalanceInput, {
      success: boolean;
      balanceId: string;
      availableDays: number;
    }>("setLeaveBalance", input);
  },

  async submitLeaveRequest(input: LeaveRequestInput): Promise<{
    success: boolean;
    leaveRequestId: string;
    totalDays: number;
    status: "pending";
  }> {
    return callFunction<LeaveRequestInput, {
      success: boolean;
      leaveRequestId: string;
      totalDays: number;
      status: "pending";
    }>("submitLeaveRequest", input);
  },

  async reviewLeaveRequest(input: LeaveReviewInput): Promise<{
    success: boolean;
    leaveRequestId: string;
    status: string;
  }> {
    return callFunction<LeaveReviewInput, {
      success: boolean;
      leaveRequestId: string;
      status: string;
    }>("reviewLeaveRequest", input);
  },

  async clockAttendance(input: AttendanceClockInput): Promise<{
    success: boolean;
    attendanceRecordId: string;
    status: string;
    totalHours: number;
    overtimeHours: number;
  }> {
    return callFunction<AttendanceClockInput, {
      success: boolean;
      attendanceRecordId: string;
      status: string;
      totalHours: number;
      overtimeHours: number;
    }>("clockAttendance", input);
  },

  async adjustAttendance(input: AttendanceAdjustmentInput): Promise<{
    success: boolean;
    attendanceRecordId: string;
    status: string;
    totalHours: number;
    overtimeHours: number;
  }> {
    return callFunction<AttendanceAdjustmentInput, {
      success: boolean;
      attendanceRecordId: string;
      status: string;
      totalHours: number;
      overtimeHours: number;
    }>("adjustAttendance", input);
  },

  async logDisciplinaryRecord(input: DisciplinaryInput): Promise<{
    success: boolean;
    disciplinaryRecordId: string;
    actionType: string;
    status: string;
  }> {
    return callFunction<DisciplinaryInput, {
      success: boolean;
      disciplinaryRecordId: string;
      actionType: string;
      status: string;
    }>("logDisciplinaryRecord", input);
  },

  async resolveDisciplinaryRecord(input: ResolveDisciplinaryInput): Promise<{
    success: boolean;
    disciplinaryRecordId: string;
    status: string;
  }> {
    return callFunction<ResolveDisciplinaryInput, {
      success: boolean;
      disciplinaryRecordId: string;
      status: string;
    }>("resolveDisciplinaryRecord", input);
  },
};
