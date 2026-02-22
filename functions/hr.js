const {HttpsError} = require("firebase-functions/v2/https");
const {FieldValue} = require("firebase-admin/firestore");
const {
  formatDateOnly,
  normalizeMoney,
} = require("./accountingPostingService");

const HR_MANAGE_ROLES = new Set([
  "super_admin",
  "admin",
  "hr_manager",
  "financial_manager",
  "accountant",
]);

const DEFAULT_LEAVE_TYPES = [
  {
    code: "annual",
    name: "Annual Leave",
    defaultDaysPerYear: 24,
    isPaid: true,
    requiresApproval: true,
  },
  {
    code: "sick",
    name: "Sick Leave",
    defaultDaysPerYear: 12,
    isPaid: true,
    requiresApproval: true,
  },
  {
    code: "maternity",
    name: "Maternity Leave",
    defaultDaysPerYear: 90,
    isPaid: true,
    requiresApproval: true,
  },
  {
    code: "paternity",
    name: "Paternity Leave",
    defaultDaysPerYear: 10,
    isPaid: true,
    requiresApproval: true,
  },
  {
    code: "compassionate",
    name: "Compassionate Leave",
    defaultDaysPerYear: 7,
    isPaid: true,
    requiresApproval: true,
  },
  {
    code: "study",
    name: "Study Leave",
    defaultDaysPerYear: 5,
    isPaid: false,
    requiresApproval: true,
  },
  {
    code: "unpaid",
    name: "Unpaid Leave",
    defaultDaysPerYear: 365,
    isPaid: false,
    requiresApproval: true,
  },
];

const stringValue = (value) => String(value || "").trim();

const slugify = (value) => stringValue(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

const toIsoString = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw new HttpsError("invalid-argument", "Invalid date/time value.");
  }
  return date.toISOString();
};

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return numeric;
};

const assertCompanyOwned = (row, companyId, entityName) => {
  const owner = row.companyId || row.organizationId || row.organization_id;
  if (owner !== companyId) {
    throw new HttpsError(
      "permission-denied",
      `${entityName} does not belong to this organization.`,
    );
  }
};

const isManageRole = (role) => HR_MANAGE_ROLES.has(String(role || ""));

const getEmployeeById = async (db, companyId, employeeId, tx = null) => {
  const employeeRef = db.collection("employees").doc(employeeId);
  const employeeSnap = tx ? await tx.get(employeeRef) : await employeeRef.get();
  if (!employeeSnap.exists) {
    throw new HttpsError("not-found", "Employee not found.");
  }
  const employee = employeeSnap.data();
  assertCompanyOwned(employee, companyId, "Employee");
  return {id: employeeSnap.id, ...employee};
};

const resolveActorEmployeeId = async ({
  db,
  companyId,
  uid,
  actorRole,
  requestedEmployeeId,
}) => {
  const requestedId = stringValue(requestedEmployeeId);
  if (isManageRole(actorRole)) {
    if (!requestedId) {
      throw new HttpsError(
        "invalid-argument",
        "employeeId is required for manager actions.",
      );
    }
    await getEmployeeById(db, companyId, requestedId, null);
    return requestedId;
  }

  if (requestedId) {
    const employee = await getEmployeeById(db, companyId, requestedId, null);
    const employeeUid = stringValue(employee.userId || employee.user_id);
    if (!employeeUid || employeeUid !== uid) {
      throw new HttpsError(
        "permission-denied",
        "You can only submit attendance/leave for your own employee profile.",
      );
    }
    return requestedId;
  }

  const ownerFields = ["companyId", "organizationId", "organization_id"];
  const uidFields = ["userId", "user_id"];

  for (const ownerField of ownerFields) {
    for (const uidField of uidFields) {
      const snapshot = await db
        .collection("employees")
        .where(ownerField, "==", companyId)
        .where(uidField, "==", uid)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        return snapshot.docs[0].id;
      }
    }
  }

  throw new HttpsError(
    "failed-precondition",
    "No employee profile is linked to your account.",
  );
};

const calculateBusinessDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new HttpsError("invalid-argument", "Invalid leave date range.");
  }
  if (end < start) {
    throw new HttpsError(
      "invalid-argument",
      "leave end date cannot be earlier than start date.",
    );
  }

  let total = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) total += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  if (total <= 0) {
    throw new HttpsError(
      "invalid-argument",
      "Leave request must include at least one working day.",
    );
  }

  return total;
};

const getLeaveBalanceDocId = (companyId, employeeId, leaveTypeId, year) =>
  `${companyId}_${employeeId}_${leaveTypeId}_${year}`;

const attendanceDocId = (companyId, employeeId, dateKey) =>
  `${companyId}_${employeeId}_${dateKey}`;

const computeDurationHours = (startIso, endIso) => {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new HttpsError("invalid-argument", "Invalid attendance timestamp.");
  }
  if (end <= start) {
    throw new HttpsError(
      "invalid-argument",
      "Clock-out time must be later than clock-in time.",
    );
  }
  return normalizeMoney((end.getTime() - start.getTime()) / (60 * 60 * 1000));
};

const assertLeaveTypeOwned = (leaveType, companyId) => {
  assertCompanyOwned(leaveType, companyId, "Leave type");
  if (leaveType.isActive === false || leaveType.is_active === false) {
    throw new HttpsError("failed-precondition", "Leave type is inactive.");
  }
};

const seedDefaultLeaveTypes = async ({db, companyId, userId}) => {
  if (!companyId) {
    throw new HttpsError("invalid-argument", "companyId is required.");
  }

  const batch = db.batch();
  DEFAULT_LEAVE_TYPES.forEach((typeDef) => {
    const typeId = `${companyId}_${typeDef.code}`;
    const ref = db.collection("leaveTypes").doc(typeId);
    batch.set(ref, {
      companyId,
      organizationId: companyId,
      code: typeDef.code,
      name: typeDef.name,
      description: null,
      defaultDaysPerYear: typeDef.defaultDaysPerYear,
      default_days_per_year: typeDef.defaultDaysPerYear,
      isPaid: typeDef.isPaid,
      is_paid: typeDef.isPaid,
      requiresApproval: typeDef.requiresApproval,
      requires_approval: typeDef.requiresApproval,
      isActive: true,
      is_active: true,
      createdBy: userId || null,
      created_by: userId || null,
      updatedBy: userId || null,
      updated_by: userId || null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true});
  });

  await batch.commit();
  return {success: true, leaveTypesSeeded: DEFAULT_LEAVE_TYPES.length};
};

const upsertLeaveType = async ({
  db,
  companyId,
  userId,
  data,
}) => {
  const name = stringValue(data.name);
  if (!name) {
    throw new HttpsError("invalid-argument", "Leave type name is required.");
  }

  const defaultDays = toNumber(
    data.defaultDaysPerYear ?? data.default_days_per_year,
    0,
  );
  if (defaultDays < 0) {
    throw new HttpsError(
      "invalid-argument",
      "defaultDaysPerYear cannot be negative.",
    );
  }

  const code = slugify(data.code || name);
  if (!code) {
    throw new HttpsError("invalid-argument", "Leave type code is required.");
  }

  const leaveTypeId = stringValue(data.leaveTypeId || data.leave_type_id)
    || `${companyId}_${code}`;
  const leaveTypeRef = db.collection("leaveTypes").doc(leaveTypeId);

  await leaveTypeRef.set({
    companyId,
    organizationId: companyId,
    code,
    name,
    description: stringValue(data.description) || null,
    defaultDaysPerYear: defaultDays,
    default_days_per_year: defaultDays,
    isPaid: data.isPaid !== false,
    is_paid: data.isPaid !== false,
    requiresApproval: data.requiresApproval !== false,
    requires_approval: data.requiresApproval !== false,
    isActive: data.isActive !== false,
    is_active: data.isActive !== false,
    updatedBy: userId,
    updated_by: userId,
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: userId,
    created_by: userId,
    createdAt: FieldValue.serverTimestamp(),
  }, {merge: true});

  return {leaveTypeId, success: true};
};

const setLeaveBalance = async ({
  db,
  companyId,
  userId,
  data,
}) => {
  const employeeId = stringValue(data.employeeId || data.employee_id);
  const leaveTypeId = stringValue(data.leaveTypeId || data.leave_type_id);
  const year = Number(data.year || new Date().getFullYear());

  if (!employeeId || !leaveTypeId || !Number.isFinite(year)) {
    throw new HttpsError(
      "invalid-argument",
      "employeeId, leaveTypeId, and year are required.",
    );
  }

  return db.runTransaction(async (tx) => {
    await getEmployeeById(db, companyId, employeeId, tx);

    const leaveTypeRef = db.collection("leaveTypes").doc(leaveTypeId);
    const leaveTypeSnap = await tx.get(leaveTypeRef);
    if (!leaveTypeSnap.exists) {
      throw new HttpsError("not-found", "Leave type not found.");
    }
    const leaveType = leaveTypeSnap.data();
    assertLeaveTypeOwned(leaveType, companyId);

    const balanceId = getLeaveBalanceDocId(
      companyId,
      employeeId,
      leaveTypeId,
      year,
    );
    const balanceRef = db.collection("leaveBalances").doc(balanceId);
    const currentSnap = await tx.get(balanceRef);
    const current = currentSnap.exists ? currentSnap.data() : {};

    const entitledDays = toNumber(
      data.entitledDays ?? data.entitled_days,
      toNumber(
        current.entitledDays ?? current.entitled_days,
        toNumber(
          leaveType.defaultDaysPerYear || leaveType.default_days_per_year,
          0,
        ),
      ),
    );
    const carriedForwardDays = toNumber(
      data.carriedForwardDays ?? data.carried_forward_days,
      toNumber(current.carriedForwardDays ?? current.carried_forward_days, 0),
    );
    const accruedDays = toNumber(
      data.accruedDays ?? data.accrued_days,
      toNumber(current.accruedDays ?? current.accrued_days, 0),
    );
    const usedDays = toNumber(
      data.usedDays ?? data.used_days,
      toNumber(current.usedDays ?? current.used_days, 0),
    );

    if (
      entitledDays < 0 ||
      carriedForwardDays < 0 ||
      accruedDays < 0 ||
      usedDays < 0
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Leave balance values cannot be negative.",
      );
    }

    const availableDays = normalizeMoney(
      entitledDays + carriedForwardDays + accruedDays - usedDays,
    );

    const beforeBalance = {
      entitledDays: toNumber(current.entitledDays ?? current.entitled_days, 0),
      carriedForwardDays: toNumber(
        current.carriedForwardDays ?? current.carried_forward_days,
        0,
      ),
      accruedDays: toNumber(current.accruedDays ?? current.accrued_days, 0),
      usedDays: toNumber(current.usedDays ?? current.used_days, 0),
      availableDays: toNumber(
        current.availableDays ?? current.available_days,
        0,
      ),
    };

    const nextBalance = {
      entitledDays,
      carriedForwardDays,
      accruedDays,
      usedDays,
      availableDays,
    };

    tx.set(balanceRef, {
      companyId,
      organizationId: companyId,
      employeeId,
      employee_id: employeeId,
      leaveTypeId,
      leave_type_id: leaveTypeId,
      year,
      entitledDays,
      entitled_days: entitledDays,
      carriedForwardDays,
      carried_forward_days: carriedForwardDays,
      accruedDays,
      accrued_days: accruedDays,
      usedDays,
      used_days: usedDays,
      availableDays,
      available_days: availableDays,
      updatedBy: userId,
      updated_by: userId,
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: userId,
      created_by: userId,
      createdAt: FieldValue.serverTimestamp(),
    }, {merge: true});

    const ledgerRef = db.collection("leaveLedger").doc();
    tx.set(ledgerRef, {
      companyId,
      organizationId: companyId,
      employeeId,
      employee_id: employeeId,
      leaveTypeId,
      leave_type_id: leaveTypeId,
      year,
      transactionType: "adjustment",
      transaction_type: "adjustment",
      beforeBalance,
      afterBalance: nextBalance,
      note: stringValue(data.note) || "Manual leave balance adjustment",
      createdBy: userId,
      created_by: userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {balanceId, availableDays, success: true};
  });
};

const submitLeaveRequest = async ({
  db,
  companyId,
  userId,
  actorRole,
  data,
}) => {
  const leaveTypeId = stringValue(data.leaveTypeId || data.leave_type_id);
  const startDate = formatDateOnly(data.startDate || data.start_date);
  const endDate = formatDateOnly(data.endDate || data.end_date);
  const reason = stringValue(data.reason);

  if (!leaveTypeId || !reason) {
    throw new HttpsError(
      "invalid-argument",
      "leaveTypeId and reason are required.",
    );
  }

  const employeeId = await resolveActorEmployeeId({
    db,
    companyId,
    uid: userId,
    actorRole,
    requestedEmployeeId: data.employeeId || data.employee_id,
  });

  const leaveTypeRef = db.collection("leaveTypes").doc(leaveTypeId);
  const leaveTypeSnap = await leaveTypeRef.get();
  if (!leaveTypeSnap.exists) {
    throw new HttpsError("not-found", "Leave type not found.");
  }
  assertLeaveTypeOwned(leaveTypeSnap.data(), companyId);

  const totalDays = calculateBusinessDays(startDate, endDate);
  const leaveRequestRef = db.collection("leaveRequests").doc();
  await leaveRequestRef.set({
    companyId,
    organizationId: companyId,
    employeeId,
    employee_id: employeeId,
    leaveTypeId,
    leave_type_id: leaveTypeId,
    startDate,
    start_date: startDate,
    endDate,
    end_date: endDate,
    totalDays,
    total_days: totalDays,
    reason,
    status: "pending",
    requestedBy: userId,
    requested_by: userId,
    requestedAt: FieldValue.serverTimestamp(),
    requested_at: FieldValue.serverTimestamp(),
    reviewedBy: null,
    reviewed_by: null,
    reviewedAt: null,
    reviewed_at: null,
    reviewNote: null,
    review_note: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    leaveRequestId: leaveRequestRef.id,
    totalDays,
    status: "pending",
    success: true,
  };
};

const reviewLeaveRequest = async ({
  db,
  companyId,
  userId,
  actorRole,
  data,
}) => {
  const leaveRequestId = stringValue(data.leaveRequestId || data.leave_request_id);
  const action = stringValue(data.action).toLowerCase();
  const reviewNote = stringValue(data.reviewNote || data.review_note) || null;

  if (!leaveRequestId) {
    throw new HttpsError("invalid-argument", "leaveRequestId is required.");
  }
  if (!["approve", "reject", "cancel"].includes(action)) {
    throw new HttpsError(
      "invalid-argument",
      "Action must be approve, reject, or cancel.",
    );
  }

  return db.runTransaction(async (tx) => {
    const requestRef = db.collection("leaveRequests").doc(leaveRequestId);
    const requestSnap = await tx.get(requestRef);
    if (!requestSnap.exists) {
      throw new HttpsError("not-found", "Leave request not found.");
    }
    const leaveRequest = requestSnap.data();
    assertCompanyOwned(leaveRequest, companyId, "Leave request");

    const currentStatus = stringValue(leaveRequest.status).toLowerCase();
    if (currentStatus !== "pending") {
      throw new HttpsError(
        "failed-precondition",
        "Only pending leave requests can be updated.",
      );
    }

    const isManager = isManageRole(actorRole);
    const isRequester = stringValue(
      leaveRequest.requestedBy || leaveRequest.requested_by,
    ) === userId;

    if (action === "cancel") {
      if (!isManager && !isRequester) {
        throw new HttpsError(
          "permission-denied",
          "Only managers or the requester can cancel a leave request.",
        );
      }
    } else if (!isManager) {
      throw new HttpsError(
        "permission-denied",
        "Only HR managers/admins can approve or reject leave requests.",
      );
    }

    const nextStatus = action === "approve" ?
      "approved" :
      action === "reject" ?
      "rejected" :
      "cancelled";

    if (nextStatus === "approved") {
      const leaveTypeId = stringValue(
        leaveRequest.leaveTypeId || leaveRequest.leave_type_id,
      );
      const employeeId = stringValue(
        leaveRequest.employeeId || leaveRequest.employee_id,
      );
      const startDate = stringValue(
        leaveRequest.startDate || leaveRequest.start_date,
      );
      const requestedDays = toNumber(
        leaveRequest.totalDays || leaveRequest.total_days,
        0,
      );
      const year = Number(startDate.slice(0, 4) || new Date().getFullYear());
      const leaveTypeRef = db.collection("leaveTypes").doc(leaveTypeId);
      const leaveTypeSnap = await tx.get(leaveTypeRef);
      if (!leaveTypeSnap.exists) {
        throw new HttpsError("not-found", "Leave type not found.");
      }
      const leaveType = leaveTypeSnap.data();
      assertLeaveTypeOwned(leaveType, companyId);

      const balanceId = getLeaveBalanceDocId(
        companyId,
        employeeId,
        leaveTypeId,
        year,
      );
      const balanceRef = db.collection("leaveBalances").doc(balanceId);
      const balanceSnap = await tx.get(balanceRef);
      const existing = balanceSnap.exists ? balanceSnap.data() : {};

      const entitledDays = toNumber(
        existing.entitledDays ?? existing.entitled_days,
        toNumber(
          leaveType.defaultDaysPerYear ?? leaveType.default_days_per_year,
          0,
        ),
      );
      const carriedForwardDays = toNumber(
        existing.carriedForwardDays ?? existing.carried_forward_days,
        0,
      );
      const accruedDays = toNumber(existing.accruedDays ?? existing.accrued_days, 0);
      const usedDays = toNumber(existing.usedDays ?? existing.used_days, 0);
      const availableDays = normalizeMoney(
        entitledDays + carriedForwardDays + accruedDays - usedDays,
      );

      if (availableDays < requestedDays) {
        throw new HttpsError(
          "failed-precondition",
          `Insufficient leave balance. Available ${availableDays}, requested ${requestedDays}.`,
        );
      }

      const nextUsedDays = normalizeMoney(usedDays + requestedDays);
      const nextAvailableDays = normalizeMoney(availableDays - requestedDays);
      tx.set(balanceRef, {
        companyId,
        organizationId: companyId,
        employeeId,
        employee_id: employeeId,
        leaveTypeId,
        leave_type_id: leaveTypeId,
        year,
        entitledDays,
        entitled_days: entitledDays,
        carriedForwardDays,
        carried_forward_days: carriedForwardDays,
        accruedDays,
        accrued_days: accruedDays,
        usedDays: nextUsedDays,
        used_days: nextUsedDays,
        availableDays: nextAvailableDays,
        available_days: nextAvailableDays,
        updatedBy: userId,
        updated_by: userId,
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: userId,
        created_by: userId,
        createdAt: FieldValue.serverTimestamp(),
      }, {merge: true});

      const ledgerRef = db.collection("leaveLedger").doc();
      tx.set(ledgerRef, {
        companyId,
        organizationId: companyId,
        employeeId,
        employee_id: employeeId,
        leaveTypeId,
        leave_type_id: leaveTypeId,
        year,
        leaveRequestId,
        leave_request_id: leaveRequestId,
        transactionType: "leave_used",
        transaction_type: "leave_used",
        deltaUsedDays: requestedDays,
        delta_used_days: requestedDays,
        deltaAvailableDays: -requestedDays,
        delta_available_days: -requestedDays,
        beforeBalance: {
          usedDays,
          availableDays,
        },
        afterBalance: {
          usedDays: nextUsedDays,
          availableDays: nextAvailableDays,
        },
        note: reviewNote || "Leave approval deduction",
        createdBy: userId,
        created_by: userId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    tx.set(requestRef, {
      status: nextStatus,
      reviewedBy: userId,
      reviewed_by: userId,
      reviewedAt: FieldValue.serverTimestamp(),
      reviewed_at: FieldValue.serverTimestamp(),
      reviewNote,
      review_note: reviewNote,
      updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true});

    return {
      leaveRequestId,
      status: nextStatus,
      success: true,
    };
  });
};

const clockAttendance = async ({
  db,
  companyId,
  userId,
  actorRole,
  data,
}) => {
  const action = stringValue(data.action).toLowerCase();
  if (!["clock_in", "clock_out"].includes(action)) {
    throw new HttpsError(
      "invalid-argument",
      "action must be clock_in or clock_out.",
    );
  }

  const employeeId = await resolveActorEmployeeId({
    db,
    companyId,
    uid: userId,
    actorRole,
    requestedEmployeeId: data.employeeId || data.employee_id,
  });
  const timestampIso = toIsoString(data.timestamp || data.clockTime || null);
  const dateKey = formatDateOnly(timestampIso);
  const recordId = attendanceDocId(companyId, employeeId, dateKey);

  return db.runTransaction(async (tx) => {
    const recordRef = db.collection("attendanceRecords").doc(recordId);
    const recordSnap = await tx.get(recordRef);
    const existing = recordSnap.exists ? recordSnap.data() : {};
    const sessions = Array.isArray(existing.sessions) ? [...existing.sessions] : [];

    if (action === "clock_in") {
      const hasOpen = sessions.some((session) => !session.outAt);
      if (hasOpen) {
        throw new HttpsError(
          "failed-precondition",
          "Cannot clock in because there is already an open attendance session.",
        );
      }
      sessions.push({
        inAt: timestampIso,
        outAt: null,
        hours: 0,
      });
    } else {
      const openIndex = sessions.findIndex((session) => !session.outAt);
      if (openIndex < 0) {
        throw new HttpsError(
          "failed-precondition",
          "Cannot clock out because there is no open attendance session.",
        );
      }

      const openSession = sessions[openIndex];
      const hours = computeDurationHours(openSession.inAt, timestampIso);
      sessions[openIndex] = {
        ...openSession,
        outAt: timestampIso,
        hours,
      };
    }

    const totalHours = normalizeMoney(
      sessions.reduce((sum, session) => sum + toNumber(session.hours, 0), 0),
    );
    const overtimeHours = normalizeMoney(Math.max(totalHours - 8, 0));
    const firstClockIn = sessions.length ? sessions[0].inAt : null;
    const lastClockOut = sessions.length ? sessions[sessions.length - 1].outAt : null;

    tx.set(recordRef, {
      companyId,
      organizationId: companyId,
      employeeId,
      employee_id: employeeId,
      attendanceDate: dateKey,
      attendance_date: dateKey,
      sessions,
      clockInTime: firstClockIn,
      clock_in_time: firstClockIn,
      clockOutTime: lastClockOut,
      clock_out_time: lastClockOut,
      totalHours,
      total_hours: totalHours,
      overtimeHours,
      overtime_hours: overtimeHours,
      status: totalHours > 0 ? "present" : "absent",
      notes: stringValue(data.notes) || existing.notes || null,
      isManual: existing.isManual === true,
      is_manual: existing.is_manual === true,
      updatedBy: userId,
      updated_by: userId,
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: existing.createdBy || userId,
      created_by: existing.created_by || userId,
      createdAt: existing.createdAt || FieldValue.serverTimestamp(),
    }, {merge: true});

    return {
      attendanceRecordId: recordId,
      status: action === "clock_in" ? "clocked_in" : "clocked_out",
      totalHours,
      overtimeHours,
      success: true,
    };
  });
};

const adjustAttendance = async ({
  db,
  companyId,
  userId,
  actorRole,
  data,
}) => {
  if (!isManageRole(actorRole)) {
    throw new HttpsError(
      "permission-denied",
      "Only HR managers/admins can adjust attendance records.",
    );
  }

  const employeeId = stringValue(data.employeeId || data.employee_id);
  const attendanceDate = formatDateOnly(data.attendanceDate || data.attendance_date);
  if (!employeeId) {
    throw new HttpsError("invalid-argument", "employeeId is required.");
  }
  await getEmployeeById(db, companyId, employeeId, null);

  const totalHours = normalizeMoney(toNumber(data.totalHours ?? data.total_hours, 0));
  const overtimeHours = normalizeMoney(
    toNumber(data.overtimeHours ?? data.overtime_hours, Math.max(totalHours - 8, 0)),
  );
  const status = stringValue(data.status).toLowerCase() || "present";
  const recordId = attendanceDocId(companyId, employeeId, attendanceDate);

  await db.collection("attendanceRecords").doc(recordId).set({
    companyId,
    organizationId: companyId,
    employeeId,
    employee_id: employeeId,
    attendanceDate,
    attendance_date: attendanceDate,
    status,
    totalHours,
    total_hours: totalHours,
    overtimeHours,
    overtime_hours: overtimeHours,
    clockInTime: data.clockInTime || data.clock_in_time || null,
    clock_in_time: data.clockInTime || data.clock_in_time || null,
    clockOutTime: data.clockOutTime || data.clock_out_time || null,
    clock_out_time: data.clockOutTime || data.clock_out_time || null,
    notes: stringValue(data.notes) || null,
    isManual: true,
    is_manual: true,
    updatedBy: userId,
    updated_by: userId,
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: userId,
    created_by: userId,
    createdAt: FieldValue.serverTimestamp(),
  }, {merge: true});

  return {
    attendanceRecordId: recordId,
    status,
    totalHours,
    overtimeHours,
    success: true,
  };
};

const logDisciplinaryRecord = async ({
  db,
  companyId,
  userId,
  actorRole,
  data,
}) => {
  if (!isManageRole(actorRole)) {
    throw new HttpsError(
      "permission-denied",
      "Only HR managers/admins can log disciplinary records.",
    );
  }

  const employeeId = stringValue(data.employeeId || data.employee_id);
  const actionType = stringValue(data.actionType || data.action_type).toLowerCase();
  const severity = stringValue(data.severity || "medium").toLowerCase();
  const reason = stringValue(data.reason);

  if (!employeeId || !actionType || !reason) {
    throw new HttpsError(
      "invalid-argument",
      "employeeId, actionType, and reason are required.",
    );
  }
  if (!["warning", "suspension", "termination"].includes(actionType)) {
    throw new HttpsError(
      "invalid-argument",
      "actionType must be warning, suspension, or termination.",
    );
  }

  return db.runTransaction(async (tx) => {
    const employee = await getEmployeeById(db, companyId, employeeId, tx);
    const recordRef = db.collection("disciplinaryRecords").doc();
    const incidentDate = formatDateOnly(
      data.incidentDate || data.incident_date || new Date().toISOString(),
    );
    const effectiveFrom = formatDateOnly(
      data.effectiveFrom || data.effective_from || incidentDate,
    );
    const effectiveTo = data.effectiveTo || data.effective_to ?
      formatDateOnly(data.effectiveTo || data.effective_to) :
      null;

    tx.set(recordRef, {
      companyId,
      organizationId: companyId,
      employeeId,
      employee_id: employeeId,
      employeeName: employee.fullName || employee.full_name || null,
      employee_name: employee.fullName || employee.full_name || null,
      actionType,
      action_type: actionType,
      severity,
      incidentDate,
      incident_date: incidentDate,
      effectiveFrom,
      effective_from: effectiveFrom,
      effectiveTo,
      effective_to: effectiveTo,
      reason,
      description: stringValue(data.description) || null,
      status: "active",
      issuedBy: userId,
      issued_by: userId,
      resolvedBy: null,
      resolved_by: null,
      resolvedAt: null,
      resolved_at: null,
      resolutionNote: null,
      resolution_note: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (actionType === "suspension" || actionType === "termination") {
      const employmentStatus = actionType === "termination" ?
        "terminated" :
        "suspended";
      tx.set(db.collection("employees").doc(employeeId), {
        employmentStatus,
        employment_status: employmentStatus,
        statusChangedAt: FieldValue.serverTimestamp(),
        status_changed_at: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, {merge: true});
    }

    return {
      disciplinaryRecordId: recordRef.id,
      actionType,
      status: "active",
      success: true,
    };
  });
};

const resolveDisciplinaryRecord = async ({
  db,
  companyId,
  userId,
  actorRole,
  data,
}) => {
  if (!isManageRole(actorRole)) {
    throw new HttpsError(
      "permission-denied",
      "Only HR managers/admins can resolve disciplinary records.",
    );
  }

  const recordId = stringValue(data.recordId || data.disciplinaryRecordId);
  const resolutionStatus = stringValue(
    data.resolutionStatus || data.resolution_status,
  ).toLowerCase();
  const resolutionNote = stringValue(
    data.resolutionNote || data.resolution_note,
  ) || null;

  if (!recordId || !["resolved", "cancelled"].includes(resolutionStatus)) {
    throw new HttpsError(
      "invalid-argument",
      "recordId and valid resolutionStatus are required.",
    );
  }

  return db.runTransaction(async (tx) => {
    const recordRef = db.collection("disciplinaryRecords").doc(recordId);
    const recordSnap = await tx.get(recordRef);
    if (!recordSnap.exists) {
      throw new HttpsError("not-found", "Disciplinary record not found.");
    }
    const record = recordSnap.data();
    assertCompanyOwned(record, companyId, "Disciplinary record");

    tx.set(recordRef, {
      status: resolutionStatus,
      resolvedBy: userId,
      resolved_by: userId,
      resolvedAt: FieldValue.serverTimestamp(),
      resolved_at: FieldValue.serverTimestamp(),
      resolutionNote,
      resolution_note: resolutionNote,
      updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true});

    const actionType = stringValue(record.actionType || record.action_type).toLowerCase();
    const employeeId = stringValue(record.employeeId || record.employee_id);
    if (
      employeeId &&
      actionType === "suspension" &&
      resolutionStatus === "resolved"
    ) {
      tx.set(db.collection("employees").doc(employeeId), {
        employmentStatus: "active",
        employment_status: "active",
        statusChangedAt: FieldValue.serverTimestamp(),
        status_changed_at: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, {merge: true});
    }

    return {
      disciplinaryRecordId: recordId,
      status: resolutionStatus,
      success: true,
    };
  });
};

module.exports = {
  seedDefaultLeaveTypes,
  upsertLeaveType,
  setLeaveBalance,
  submitLeaveRequest,
  reviewLeaveRequest,
  clockAttendance,
  adjustAttendance,
  logDisciplinaryRecord,
  resolveDisciplinaryRecord,
};
