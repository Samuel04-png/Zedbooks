const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const {
  normalizeMoney,
  formatDateOnly,
  createJournalEntry,
  findAccountByName,
  findAccountByCode,
  getAccountById,
} = require("./accountingPostingService");
const accountingEngine = require("./accountingEngine");

const PAYROLL_ROLES = ["super_admin", "admin", "hr_manager", "financial_manager", "accountant"];
const PAYROLL_REVERSAL_ROLES = ["super_admin", "admin", "hr_manager", "financial_manager", "accountant"];

const normalizePayrollRunStatus = (payroll) =>
  String(payroll.payrollStatus || payroll.payroll_status || payroll.status || "")
    .toLowerCase()
    .trim();

const assertEmployeePayload = (employees) => {
  if (!Array.isArray(employees) || employees.length === 0) {
    throw new HttpsError("invalid-argument", "At least one employee is required.");
  }
};

const toPayrollDeductions = (employee) => {
  return normalizeMoney(
    Number(employee.payeDeduction ?? employee.paye_deduction ?? employee.paye ?? 0) +
    Number(employee.napsaDeduction ?? employee.napsa_deduction ?? employee.napsa_employee ?? 0) +
    Number(employee.nhimaDeduction ?? employee.nhima_deduction ?? employee.nhima_employee ?? 0) +
    Number(employee.otherDeductions ?? employee.other_deductions ?? 0),
  );
};

const toGrossSalary = (employee) => {
  if (employee.grossSalary != null) return normalizeMoney(employee.grossSalary);
  if (employee.gross_salary != null) return normalizeMoney(employee.gross_salary);

  return normalizeMoney(
    Number(employee.basicSalary ?? employee.basic_salary ?? 0) +
    Number(employee.housingAllowance ?? employee.housing_allowance ?? 0) +
    Number(employee.transportAllowance ?? employee.transport_allowance ?? 0) +
    Number(employee.otherAllowances ?? employee.other_allowances ?? 0),
  );
};

const toNetSalary = (employee, gross, deductions) => {
  if (employee.netSalary != null) return normalizeMoney(employee.netSalary);
  if (employee.net_salary != null) return normalizeMoney(employee.net_salary);
  return normalizeMoney(gross - deductions);
};

const resolvePayrollAccount = async (companyId, names, fallbackCode, requiredType, db) => {
  let account = await findAccountByName(companyId, names, db);
  if (!account && fallbackCode != null) {
    account = await findAccountByCode(companyId, fallbackCode, db);
  }
  if (!account) {
    throw new HttpsError("failed-precondition", `Required payroll account missing: ${names[0]}.`);
  }
  if (requiredType && account.accountType !== requiredType) {
    throw new HttpsError(
      "failed-precondition",
      `Payroll account ${account.accountName} must be of type ${requiredType}.`,
    );
  }
  return account;
};

const isEntryDateWithinRange = (dateValue, startDate, endDate) => {
  if (!dateValue) return false;
  if (startDate && dateValue < startDate) return false;
  if (endDate && dateValue > endDate) return false;
  return true;
};

const isLockedStatus = (status) => {
  if (!status) return false;
  return ["locked", "closed"].includes(String(status).toLowerCase());
};

const assertPeriodUnlocked = async (tx, db, companyId, entryDate) => {
  const normalizedEntryDate = formatDateOnly(entryDate);

  const periodLocksSnap = await tx.get(
    db.collection("periodLocks")
      .where("companyId", "==", companyId),
  );

  const hasExplicitLock = periodLocksSnap.docs.some((docSnap) => {
    const lock = docSnap.data();
    const isLocked = lock.isLocked === true || isLockedStatus(lock.status);
    if (!isLocked) return false;
    const startDate = String(lock.startDate || lock.start_date || "");
    const endDate = String(lock.endDate || lock.end_date || "");
    if (!startDate && !endDate) return true;
    return isEntryDateWithinRange(normalizedEntryDate, startDate || null, endDate || null);
  });

  if (hasExplicitLock) {
    throw new HttpsError(
      "failed-precondition",
      `Entry date ${normalizedEntryDate} is in a locked financial period.`,
    );
  }

  const periodsSnap = await tx.get(
    db.collection("financialPeriods")
      .where("companyId", "==", companyId),
  );

  const hasClosedPeriod = periodsSnap.docs.some((docSnap) => {
    const period = docSnap.data();
    if (!isLockedStatus(period.status)) return false;
    const startDate = String(period.startDate || period.start_date || "");
    const endDate = String(period.endDate || period.end_date || "");
    return isEntryDateWithinRange(normalizedEntryDate, startDate || null, endDate || null);
  });

  if (hasClosedPeriod) {
    throw new HttpsError(
      "failed-precondition",
      `Entry date ${normalizedEntryDate} is in a closed financial period.`,
    );
  }
};

const normalizeAdvanceStatus = (status) => String(status || "").toLowerCase();

const determineAdvanceStatus = (remainingBalance, totalAmount, monthsDeducted, monthsToRepay) => {
  if (remainingBalance <= 0.009) return "deducted";
  if (monthsToRepay > 0 && monthsDeducted >= monthsToRepay) return "deducted";
  if (remainingBalance >= totalAmount - 0.009 || monthsDeducted <= 0) return "pending";
  return "partial";
};

const setPayrollItemsStatus = async ({ tx, db, payrollRunId, status, uid }) => {
  let payrollItemsSnap = await tx.get(
    db.collection("payrollItems").where("payrollRunId", "==", payrollRunId),
  );
  if (payrollItemsSnap.empty) {
    payrollItemsSnap = await tx.get(
      db.collection("payrollItems").where("payroll_run_id", "==", payrollRunId),
    );
  }

  payrollItemsSnap.docs.forEach((docSnap) => {
    tx.set(docSnap.ref, {
      payrollStatus: status,
      payroll_status: status,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
      updated_by: uid,
    }, { merge: true });
  });
};

const applyPayrollAdvanceDeductions = async ({
  tx,
  db,
  companyId,
  payrollRunId,
  uid,
}) => {
  const payrollItemsSnap = await tx.get(
    db.collection("payrollItems").where("payrollRunId", "==", payrollRunId),
  );
  if (payrollItemsSnap.empty) return;

  const advancesSnap = await tx.get(
    db.collection("advances").where("companyId", "==", companyId),
  );
  if (advancesSnap.empty) return;

  const advancesByEmployee = new Map();
  advancesSnap.docs.forEach((docSnap) => {
    const advance = docSnap.data();
    const employeeId = String(advance.employee_id || advance.employeeId || "").trim();
    if (!employeeId) return;

    const status = normalizeAdvanceStatus(advance.status);
    if (!["pending", "partial"].includes(status)) return;

    const bucket = advancesByEmployee.get(employeeId) || [];
    bucket.push({
      docSnap,
      data: { ...advance },
    });
    advancesByEmployee.set(employeeId, bucket);
  });

  advancesByEmployee.forEach((bucket) => {
    bucket.sort((left, right) => {
      const leftDate = String(left.data.date_to_deduct || left.data.dateToDeduct || "");
      const rightDate = String(right.data.date_to_deduct || right.data.dateToDeduct || "");
      return leftDate.localeCompare(rightDate);
    });
  });

  for (const payrollItemDoc of payrollItemsSnap.docs) {
    const payrollItem = payrollItemDoc.data();
    const employeeId = String(payrollItem.employeeId || payrollItem.employee_id || "").trim();
    if (!employeeId) continue;

    let deductionBudget = normalizeMoney(
      payrollItem.advancesDeducted
      ?? payrollItem.advances_deducted
      ?? 0,
    );
    if (deductionBudget <= 0) continue;

    const employeeAdvances = advancesByEmployee.get(employeeId) || [];
    for (const advanceEntry of employeeAdvances) {
      if (deductionBudget <= 0) break;

      const advance = advanceEntry.data;
      const remainingBalance = normalizeMoney(
        advance.remaining_balance
        ?? advance.remainingBalance
        ?? advance.amount
        ?? 0,
      );
      if (remainingBalance <= 0) continue;

      const deductionAmount = normalizeMoney(Math.min(remainingBalance, deductionBudget));
      if (deductionAmount <= 0) continue;

      const monthlyDeduction = normalizeMoney(
        advance.monthly_deduction
        ?? advance.monthlyDeduction
        ?? 0,
      );
      const previousMonthsDeducted = Number(
        advance.months_deducted
        ?? advance.monthsDeducted
        ?? 0,
      );
      const monthsToRepay = Number(
        advance.months_to_repay
        ?? advance.monthsToRepay
        ?? 0,
      );
      const monthIncrement = monthlyDeduction > 0
        ? Math.max(1, Math.round(deductionAmount / monthlyDeduction))
        : 1;
      const nextMonthsDeducted = previousMonthsDeducted + monthIncrement;
      const nextRemainingBalance = normalizeMoney(remainingBalance - deductionAmount);
      const isFullyRepaid = nextRemainingBalance <= 0.009
        || (monthsToRepay > 0 && nextMonthsDeducted >= monthsToRepay);
      const statusBefore = normalizeAdvanceStatus(advance.status) || "pending";
      const statusAfter = isFullyRepaid ? "deducted" : "partial";

      tx.set(advanceEntry.docSnap.ref, {
        remaining_balance: Math.max(0, nextRemainingBalance),
        remainingBalance: Math.max(0, nextRemainingBalance),
        months_deducted: nextMonthsDeducted,
        monthsDeducted: nextMonthsDeducted,
        status: statusAfter,
        last_deducted_payroll_run_id: payrollRunId,
        last_deducted_at: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
        updated_by: uid,
      }, { merge: true });

      const deductionLogRef = db.collection("payrollAdvanceDeductions").doc();
      tx.set(deductionLogRef, {
        companyId,
        payrollRunId,
        payroll_run_id: payrollRunId,
        employeeId,
        employee_id: employeeId,
        advanceId: advanceEntry.docSnap.id,
        advance_id: advanceEntry.docSnap.id,
        deductionAmount,
        deduction_amount: deductionAmount,
        monthIncrement,
        month_increment: monthIncrement,
        previousRemainingBalance: remainingBalance,
        previous_remaining_balance: remainingBalance,
        newRemainingBalance: Math.max(0, nextRemainingBalance),
        new_remaining_balance: Math.max(0, nextRemainingBalance),
        previousMonthsDeducted,
        previous_months_deducted: previousMonthsDeducted,
        newMonthsDeducted: nextMonthsDeducted,
        new_months_deducted: nextMonthsDeducted,
        statusBefore,
        status_before: statusBefore,
        statusAfter,
        status_after: statusAfter,
        isReversed: false,
        is_reversed: false,
        createdBy: uid,
        created_by: uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      advanceEntry.data = {
        ...advance,
        remaining_balance: Math.max(0, nextRemainingBalance),
        remainingBalance: Math.max(0, nextRemainingBalance),
        months_deducted: nextMonthsDeducted,
        monthsDeducted: nextMonthsDeducted,
        status: statusAfter,
      };

      deductionBudget = normalizeMoney(deductionBudget - deductionAmount);
    }
  }
};

const reversePayrollAdvanceDeductions = async ({
  tx,
  db,
  companyId,
  payrollRunId,
  uid,
  reversalJournalEntryId = null,
}) => {
  let deductionsSnap = await tx.get(
    db.collection("payrollAdvanceDeductions").where("payrollRunId", "==", payrollRunId),
  );
  if (deductionsSnap.empty) {
    deductionsSnap = await tx.get(
      db.collection("payrollAdvanceDeductions").where("payroll_run_id", "==", payrollRunId),
    );
  }
  if (deductionsSnap.empty) return;

  for (const deductionDoc of deductionsSnap.docs) {
    const deduction = deductionDoc.data();
    if (deduction.isReversed === true || deduction.is_reversed === true) {
      continue;
    }

    const advanceId = String(deduction.advanceId || deduction.advance_id || "").trim();
    const deductionAmount = normalizeMoney(deduction.deductionAmount ?? deduction.deduction_amount ?? 0);
    const monthIncrement = Number(deduction.monthIncrement ?? deduction.month_increment ?? 0) || 1;
    if (!advanceId || deductionAmount <= 0) {
      tx.set(deductionDoc.ref, {
        isReversed: true,
        is_reversed: true,
        reversedAt: FieldValue.serverTimestamp(),
        reversedBy: uid,
        reversed_by: uid,
        reversalJournalEntryId: reversalJournalEntryId || null,
        reversal_journal_entry_id: reversalJournalEntryId || null,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      continue;
    }

    const advanceRef = db.collection("advances").doc(advanceId);
    const advanceSnap = await tx.get(advanceRef);
    if (!advanceSnap.exists) {
      tx.set(deductionDoc.ref, {
        reversalSkipped: true,
        reversal_skipped: true,
        reversalSkipReason: `Advance ${advanceId} not found`,
        reversal_skip_reason: `Advance ${advanceId} not found`,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      continue;
    }

    const advance = advanceSnap.data();
    const advanceOwner = String(advance.companyId || advance.organizationId || "").trim();
    if (advanceOwner !== companyId) {
      tx.set(deductionDoc.ref, {
        reversalSkipped: true,
        reversal_skipped: true,
        reversalSkipReason: `Advance ${advanceId} belongs to another organization`,
        reversal_skip_reason: `Advance ${advanceId} belongs to another organization`,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      continue;
    }

    const currentRemainingBalance = normalizeMoney(
      advance.remaining_balance ??
      advance.remainingBalance ??
      advance.amount ??
      0,
    );
    const advanceAmount = normalizeMoney(advance.amount ?? advance.total_amount ?? currentRemainingBalance);
    const currentMonthsDeducted = Number(advance.months_deducted ?? advance.monthsDeducted ?? 0);
    const monthsToRepay = Number(advance.months_to_repay ?? advance.monthsToRepay ?? 0);

    const restoredRemainingBalance = normalizeMoney(
      Math.min(advanceAmount, currentRemainingBalance + deductionAmount),
    );
    const restoredMonthsDeducted = Math.max(0, currentMonthsDeducted - monthIncrement);
    const restoredStatus = determineAdvanceStatus(
      restoredRemainingBalance,
      advanceAmount,
      restoredMonthsDeducted,
      monthsToRepay,
    );

    tx.set(advanceRef, {
      remaining_balance: restoredRemainingBalance,
      remainingBalance: restoredRemainingBalance,
      months_deducted: restoredMonthsDeducted,
      monthsDeducted: restoredMonthsDeducted,
      status: restoredStatus,
      last_reversed_payroll_run_id: payrollRunId,
      last_reversal_journal_entry_id: reversalJournalEntryId || null,
      last_reversal_at: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
      updated_by: uid,
    }, { merge: true });

    tx.set(deductionDoc.ref, {
      isReversed: true,
      is_reversed: true,
      reversedAt: FieldValue.serverTimestamp(),
      reversedBy: uid,
      reversed_by: uid,
      reversalJournalEntryId: reversalJournalEntryId || null,
      reversal_journal_entry_id: reversalJournalEntryId || null,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
};

const savePayrollDraft = async (
  db,
  uid,
  payload,
  assertCompanyRole,
  createAuditLog,
) => {
  const companyId = String(payload.companyId || "").trim();
  if (!companyId) {
    throw new HttpsError("invalid-argument", "companyId is required.");
  }

  await assertCompanyRole(uid, companyId, PAYROLL_ROLES);

  const periodStart = formatDateOnly(payload.periodStart || payload.period_start);
  const periodEnd = formatDateOnly(payload.periodEnd || payload.period_end);
  const runDate = formatDateOnly(payload.runDate || payload.run_date || new Date().toISOString());
  const periodLabel = payload.periodLabel || payload.period_label || null;
  const employees = payload.employees || [];
  const additions = Array.isArray(payload.additions) ? payload.additions : [];

  if (periodStart > periodEnd) {
    throw new HttpsError("invalid-argument", "period_start must be before or equal to period_end.");
  }

  assertEmployeePayload(employees);

  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;

  const normalizedEmployees = employees.map((employee) => {
    const grossSalary = toGrossSalary(employee);
    const deductions = toPayrollDeductions(employee);
    const netSalary = toNetSalary(employee, grossSalary, deductions);
    totalGross = normalizeMoney(totalGross + grossSalary);
    totalDeductions = normalizeMoney(totalDeductions + deductions);
    totalNet = normalizeMoney(totalNet + netSalary);

    return {
      employeeId: employee.employeeId || employee.employee_id || null,
      employeeName: employee.employeeName || employee.employee_name || employee.full_name || "Employee",
      grossSalary,
      payeDeduction: normalizeMoney(employee.payeDeduction ?? employee.paye_deduction ?? employee.paye ?? 0),
      napsaDeduction: normalizeMoney(employee.napsaDeduction ?? employee.napsa_deduction ?? employee.napsa_employee ?? 0),
      nhimaDeduction: normalizeMoney(employee.nhimaDeduction ?? employee.nhima_deduction ?? employee.nhima_employee ?? 0),
      otherDeductions: normalizeMoney(employee.otherDeductions ?? employee.other_deductions ?? 0),
      netSalary,
      basicSalary: normalizeMoney(employee.basicSalary ?? employee.basic_salary ?? 0),
      housingAllowance: normalizeMoney(employee.housingAllowance ?? employee.housing_allowance ?? 0),
      transportAllowance: normalizeMoney(employee.transportAllowance ?? employee.transport_allowance ?? 0),
      otherAllowances: normalizeMoney(employee.otherAllowances ?? employee.other_allowances ?? 0),
      advancesDeducted: normalizeMoney(employee.advancesDeducted ?? employee.advances_deducted ?? 0),
    };
  });

  const payrollRunId = await db.runTransaction(async (tx) => {
    const payrollRunRef = db.collection("payrollRuns").doc();
    tx.set(payrollRunRef, {
      companyId,
      organizationId: companyId,
      periodStart,
      period_start: periodStart,
      periodEnd,
      period_end: periodEnd,
      periodLabel,
      period_label: periodLabel,
      runDate,
      run_date: runDate,
      notes: payload.notes || null,
      totalGross,
      total_gross: totalGross,
      totalDeductions,
      total_deductions: totalDeductions,
      totalNet,
      total_net: totalNet,
      status: "Draft",
      payrollStatus: "draft",
      payroll_status: "draft",
      journalEntryId: null,
      journal_entry_id: null,
      paymentJournalEntryId: null,
      payment_journal_entry_id: null,
      reversalJournalEntryId: null,
      reversal_journal_entry_id: null,
      paymentReversalJournalEntryId: null,
      payment_reversal_journal_entry_id: null,
      paymentReversalReason: null,
      payment_reversal_reason: null,
      paymentReversedBy: null,
      payment_reversed_by: null,
      paymentReversedAt: null,
      payment_reversed_at: null,
      reversalReferenceId: null,
      reversal_reference_id: null,
      reversalReason: null,
      reversal_reason: null,
      reversedBy: null,
      reversed_by: null,
      reversedAt: null,
      reversed_at: null,
      reversalDate: null,
      reversal_date: null,
      createdBy: uid,
      created_by: uid,
      updatedBy: uid,
      updated_by: uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    normalizedEmployees.forEach((employee) => {
      const payrollEmployeeRef = db.collection("payrollEmployees").doc();
      tx.set(payrollEmployeeRef, {
        companyId,
        organizationId: companyId,
        payrollRunId: payrollRunRef.id,
        payroll_run_id: payrollRunRef.id,
        employeeId: employee.employeeId,
        employee_id: employee.employeeId,
        employeeName: employee.employeeName,
        employee_name: employee.employeeName,
        grossSalary: employee.grossSalary,
        gross_salary: employee.grossSalary,
        payeDeduction: employee.payeDeduction,
        paye_deduction: employee.payeDeduction,
        napsaDeduction: employee.napsaDeduction,
        napsa_deduction: employee.napsaDeduction,
        nhimaDeduction: employee.nhimaDeduction,
        nhima_deduction: employee.nhimaDeduction,
        otherDeductions: employee.otherDeductions,
        other_deductions: employee.otherDeductions,
        netSalary: employee.netSalary,
        net_salary: employee.netSalary,
        createdAt: FieldValue.serverTimestamp(),
      });

      // Keep compatibility with existing PayrollDetail/Approval pages.
      const payrollItemRef = db.collection("payrollItems").doc();
      tx.set(payrollItemRef, {
        companyId,
        payrollRunId: payrollRunRef.id,
        employeeId: employee.employeeId,
        basicSalary: employee.basicSalary,
        housingAllowance: employee.housingAllowance,
        transportAllowance: employee.transportAllowance,
        otherAllowances: employee.otherAllowances,
        grossSalary: employee.grossSalary,
        paye: employee.payeDeduction,
        napsaEmployee: employee.napsaDeduction,
        napsaEmployer: 0,
        nhimaEmployee: employee.nhimaDeduction,
        nhimaEmployer: 0,
        advancesDeducted: employee.advancesDeducted,
        totalDeductions: normalizeMoney(
          employee.payeDeduction + employee.napsaDeduction + employee.nhimaDeduction +
          employee.otherDeductions + employee.advancesDeducted,
        ),
        netSalary: employee.netSalary,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    additions.forEach((addition) => {
      const additionRef = db.collection("payrollAdditions").doc();
      tx.set(additionRef, {
        companyId,
        payrollRunId: payrollRunRef.id,
        employeeId: addition.employeeId || addition.employee_id || null,
        type: addition.type || null,
        name: addition.name || null,
        amount: normalizeMoney(addition.amount || 0),
        totalAmount: normalizeMoney(addition.totalAmount ?? addition.total_amount ?? 0),
        monthsToPay: Number(addition.monthsToPay ?? addition.months_to_pay ?? 0) || null,
        monthlyDeduction: normalizeMoney(addition.monthlyDeduction ?? addition.monthly_deduction ?? 0) || null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return payrollRunRef.id;
  });

  await createAuditLog(companyId, uid, "payroll_draft_saved", {
    payrollRunId,
    employees: normalizedEmployees.length,
    totalGross,
    totalDeductions,
    totalNet,
  });

  return { payrollRunId, status: "Draft" };
};

const processPayroll = async (
  db,
  uid,
  payrollRunId,
  assertCompanyRole,
  createAuditLog,
) => {
  if (!payrollRunId || typeof payrollRunId !== "string") {
    throw new HttpsError("invalid-argument", "payrollRunId is required.");
  }

  const payrollRef = db.collection("payrollRuns").doc(payrollRunId);
  const payrollSnap = await payrollRef.get();
  if (!payrollSnap.exists) {
    throw new HttpsError("not-found", "Payroll run not found.");
  }

  const payroll = payrollSnap.data();
  const companyId = payroll.companyId;
  await assertCompanyRole(uid, companyId, PAYROLL_ROLES);

  const status = normalizePayrollRunStatus(payroll);
  if (!["draft", "trial"].includes(status)) {
    throw new HttpsError(
      "failed-precondition",
      "Payroll must be in Draft or Trial status before processing.",
    );
  }

  const totalGross = normalizeMoney(payroll.totalGross ?? payroll.total_gross ?? 0);
  const totalDeductions = normalizeMoney(payroll.totalDeductions ?? payroll.total_deductions ?? 0);
  let totalNet = normalizeMoney(payroll.totalNet ?? payroll.total_net ?? totalGross - totalDeductions);
  const expectedNet = normalizeMoney(totalGross - totalDeductions);
  if (Math.abs(totalNet - expectedNet) > 0.01) {
    totalNet = expectedNet;
  }

  if (totalGross <= 0) {
    throw new HttpsError("failed-precondition", "Payroll total gross must be greater than zero.");
  }

  const salariesExpense = await resolvePayrollAccount(
    companyId,
    ["Salaries Expense"],
    5040,
    "Expense",
    db,
  );
  const salariesPayable = await resolvePayrollAccount(
    companyId,
    ["Salaries Payable"],
    2010,
    "Liability",
    db,
  );
  const payePayable = totalDeductions > 0
    ? await resolvePayrollAccount(companyId, ["PAYE Payable"], 2031, "Liability", db)
    : null;

  const periodEnd = formatDateOnly(payroll.periodEnd || payroll.period_end || payroll.runDate || new Date().toISOString());
  const periodLabel = payroll.periodLabel || payroll.period_label || `${payroll.periodStart || payroll.period_start} to ${payroll.periodEnd || payroll.period_end}`;

  const journalEntryId = await db.runTransaction(async (tx) => {
    await assertPeriodUnlocked(tx, db, companyId, periodEnd);

    const lines = [
      {
        accountId: salariesExpense.id,
        debitAmount: totalGross,
        creditAmount: 0,
        description: `Salaries expense for ${periodLabel}`,
      },
      {
        accountId: salariesPayable.id,
        debitAmount: 0,
        creditAmount: totalNet,
        description: "Salaries payable to employees",
      },
    ];

    if (payePayable && totalDeductions > 0) {
      lines.push({
        accountId: payePayable.id,
        debitAmount: 0,
        creditAmount: totalDeductions,
        description: "Payroll deductions payable (PAYE/NAPSA/NHIMA)",
      });
    }

    const createdJournalEntryId = await createJournalEntry({
      companyId,
      entryDate: periodEnd,
      description: `Payroll: ${periodLabel}`,
      referenceType: "Payroll",
      referenceId: payrollRunId,
      lines,
      createdBy: uid,
      db,
      tx,
    });

    tx.update(payrollRef, {
      totalNet,
      total_net: totalNet,
      status: "Processed",
      payrollStatus: "processed",
      payroll_status: "processed",
      journalEntryId: createdJournalEntryId,
      journal_entry_id: createdJournalEntryId,
      processedAt: FieldValue.serverTimestamp(),
      processed_at: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
      updated_by: uid,
    });

    await applyPayrollAdvanceDeductions({
      tx,
      db,
      companyId,
      payrollRunId,
      uid,
    });

    await setPayrollItemsStatus({
      tx,
      db,
      payrollRunId,
      status: "processed",
      uid,
    });

    return createdJournalEntryId;
  });

  await createAuditLog(companyId, uid, "payroll_processed", { payrollRunId, journalEntryId });

  return { payrollRunId, journalEntryId, status: "Processed" };
};

const paySalaries = async (
  db,
  uid,
  payrollRunId,
  paymentAccountId,
  paymentDate,
  assertCompanyRole,
  createAuditLog,
) => {
  if (!payrollRunId || typeof payrollRunId !== "string") {
    throw new HttpsError("invalid-argument", "payrollRunId is required.");
  }

  const payrollRef = db.collection("payrollRuns").doc(payrollRunId);
  const payrollSnap = await payrollRef.get();
  if (!payrollSnap.exists) {
    throw new HttpsError("not-found", "Payroll run not found.");
  }

  const payroll = payrollSnap.data();
  const companyId = payroll.companyId;
  await assertCompanyRole(uid, companyId, PAYROLL_ROLES);

  const status = String(payroll.payrollStatus || payroll.payroll_status || payroll.status || "").toLowerCase();
  if (status !== "processed") {
    throw new HttpsError("failed-precondition", "Payroll must be Processed before salary payment.");
  }

  const paymentAccount = await getAccountById(companyId, paymentAccountId, null, db);
  if (paymentAccount.accountType !== "Asset") {
    throw new HttpsError("failed-precondition", "paymentAccountId must be an Asset account.");
  }

  const salariesPayable = await resolvePayrollAccount(
    companyId,
    ["Salaries Payable"],
    2010,
    "Liability",
    db,
  );

  const totalNet = normalizeMoney(payroll.totalNet ?? payroll.total_net ?? 0);
  if (totalNet <= 0) {
    throw new HttpsError("failed-precondition", "Payroll net amount must be greater than zero.");
  }

  const normalizedPaymentDate = formatDateOnly(paymentDate || new Date().toISOString());
  const periodLabel = payroll.periodLabel || payroll.period_label || payroll.periodEnd || payroll.period_end;

  const journalEntryId = await db.runTransaction(async (tx) => {
    await assertPeriodUnlocked(tx, db, companyId, normalizedPaymentDate);

    const createdJournalEntryId = await createJournalEntry({
      companyId,
      entryDate: normalizedPaymentDate,
      description: `Salary Payment: ${periodLabel}`,
      referenceType: "PayrollPayment",
      referenceId: payrollRunId,
      lines: [
        {
          accountId: salariesPayable.id,
          debitAmount: totalNet,
          creditAmount: 0,
          description: "Salaries payable cleared",
        },
        {
          accountId: paymentAccountId,
          debitAmount: 0,
          creditAmount: totalNet,
          description: "Salaries paid from cash/bank",
        },
      ],
      createdBy: uid,
      db,
      tx,
    });

    tx.update(payrollRef, {
      status: "Paid",
      payrollStatus: "paid",
      payroll_status: "paid",
      paymentJournalEntryId: createdJournalEntryId,
      payment_journal_entry_id: createdJournalEntryId,
      paidAt: FieldValue.serverTimestamp(),
      paid_at: FieldValue.serverTimestamp(),
      paymentDate: normalizedPaymentDate,
      payment_date: normalizedPaymentDate,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
      updated_by: uid,
    });

    await setPayrollItemsStatus({
      tx,
      db,
      payrollRunId,
      status: "paid",
      uid,
    });

    return createdJournalEntryId;
  });

  await createAuditLog(companyId, uid, "payroll_paid", { payrollRunId, journalEntryId });

  return { payrollRunId, journalEntryId, status: "Paid" };
};

const assertJournalEntryReversible = async (db, companyId, journalEntryId) => {
  const entryRef = db.collection("journalEntries").doc(journalEntryId);
  const entrySnap = await entryRef.get();
  if (!entrySnap.exists) {
    throw new HttpsError("not-found", `Journal entry ${journalEntryId} was not found.`);
  }

  const entry = entrySnap.data();
  const owner = entry.companyId || entry.organizationId;
  if (owner !== companyId) {
    throw new HttpsError("permission-denied", "Journal entry does not belong to this organization.");
  }

  if (entry.isPosted === false || entry.is_posted === false) {
    throw new HttpsError("failed-precondition", "Only posted journal entries can be reversed.");
  }

  if (entry.isReversal === true || entry.reversalOf || entry.reversal_of) {
    throw new HttpsError("failed-precondition", "Reversal entries cannot be reversed again.");
  }

  if (entry.isReversed === true || entry.reversalEntryId || entry.reversal_entry_id) {
    throw new HttpsError("failed-precondition", `Journal entry ${journalEntryId} has already been reversed.`);
  }
};

const reversePayrollPayment = async (
  db,
  uid,
  payrollRunId,
  reason,
  reversalDate,
  assertCompanyRole,
  createAuditLog,
) => {
  if (!payrollRunId || typeof payrollRunId !== "string") {
    throw new HttpsError("invalid-argument", "payrollRunId is required.");
  }

  const normalizedReason = String(reason || "").trim();
  if (!normalizedReason) {
    throw new HttpsError("invalid-argument", "reason is required for payroll payment reversal.");
  }

  const normalizedReversalDate = formatDateOnly(reversalDate || new Date().toISOString());
  const payrollRef = db.collection("payrollRuns").doc(payrollRunId);
  const payrollSnap = await payrollRef.get();
  if (!payrollSnap.exists) {
    throw new HttpsError("not-found", "Payroll run not found.");
  }

  const payroll = payrollSnap.data();
  const companyId = payroll.companyId;
  await assertCompanyRole(uid, companyId, PAYROLL_REVERSAL_ROLES);

  const status = normalizePayrollRunStatus(payroll);
  if (status === "reversed") {
    throw new HttpsError("failed-precondition", "Payroll has already been fully reversed.");
  }

  if (status !== "paid") {
    throw new HttpsError(
      "failed-precondition",
      "Only paid payroll runs can reverse salary payment.",
    );
  }

  const paymentJournalEntryId = String(
    payroll.paymentJournalEntryId ||
    payroll.payment_journal_entry_id ||
    "",
  ).trim();
  if (!paymentJournalEntryId) {
    throw new HttpsError(
      "failed-precondition",
      "Payroll is marked paid but has no payment journal entry.",
    );
  }

  await db.runTransaction(async (tx) => {
    await assertPeriodUnlocked(tx, db, companyId, normalizedReversalDate);
  });

  const paymentEntryRef = db.collection("journalEntries").doc(paymentJournalEntryId);
  const paymentEntrySnap = await paymentEntryRef.get();
  if (!paymentEntrySnap.exists) {
    throw new HttpsError("failed-precondition", "Payroll payment journal is missing.");
  }

  const paymentEntry = paymentEntrySnap.data();
  const paymentEntryOwner = paymentEntry.companyId || paymentEntry.organizationId;
  if (paymentEntryOwner !== companyId) {
    throw new HttpsError("permission-denied", "Payroll payment journal does not belong to this organization.");
  }

  if (paymentEntry.isPosted === false || paymentEntry.is_posted === false) {
    throw new HttpsError("failed-precondition", "Only posted payroll payment journals can be reversed.");
  }

  if (paymentEntry.isReversal === true || paymentEntry.reversalOf || paymentEntry.reversal_of) {
    throw new HttpsError("failed-precondition", "Payroll payment journal is already a reversal entry.");
  }

  let paymentReversalJournalEntryId = String(
    paymentEntry.reversalEntryId ||
    paymentEntry.reversal_entry_id ||
    "",
  ).trim() || null;

  if (!paymentReversalJournalEntryId) {
    const reversalResult = await accountingEngine.reverseJournalEntry({
      data: {
        journalEntryId: paymentJournalEntryId,
        reason: normalizedReason,
        reversalDate: normalizedReversalDate,
        allowPayrollReversal: true,
      },
      userId: uid,
      companyId,
      db,
    });
    paymentReversalJournalEntryId = reversalResult.reversalEntryId;
  }

  await db.runTransaction(async (tx) => {
    await assertPeriodUnlocked(tx, db, companyId, normalizedReversalDate);

    const currentPayrollSnap = await tx.get(payrollRef);
    if (!currentPayrollSnap.exists) {
      throw new HttpsError("not-found", "Payroll run not found.");
    }

    const currentPayroll = currentPayrollSnap.data();
    const currentStatus = normalizePayrollRunStatus(currentPayroll);
    if (currentStatus === "reversed") {
      throw new HttpsError("failed-precondition", "Payroll has already been fully reversed.");
    }

    tx.set(payrollRef, {
      status: "Payment Reversed",
      payrollStatus: "payment_reversed",
      payroll_status: "payment_reversed",
      paymentReversalJournalEntryId,
      payment_reversal_journal_entry_id: paymentReversalJournalEntryId,
      paymentReversalReason: normalizedReason,
      payment_reversal_reason: normalizedReason,
      paymentReversedBy: uid,
      payment_reversed_by: uid,
      paymentReversedAt: FieldValue.serverTimestamp(),
      payment_reversed_at: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
      updated_by: uid,
    }, { merge: true });

    await setPayrollItemsStatus({
      tx,
      db,
      payrollRunId,
      status: "payment_reversed",
      uid,
    });

    if (paymentReversalJournalEntryId) {
      tx.set(
        db.collection("payrollJournals").doc(`${payrollRunId}_${paymentReversalJournalEntryId}`),
        {
          companyId,
          payrollRunId,
          payroll_run_id: payrollRunId,
          journalEntryId: paymentReversalJournalEntryId,
          journal_entry_id: paymentReversalJournalEntryId,
          journalType: "payroll_payment_reversal",
          description: "Payroll payment reversal",
          createdBy: uid,
          created_by: uid,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  });

  await createAuditLog(companyId, uid, "payroll_payment_reversed", {
    payrollRunId,
    paymentJournalEntryId,
    paymentReversalJournalEntryId,
    reversalDate: normalizedReversalDate,
    reason: normalizedReason,
  });

  return {
    payrollRunId,
    paymentJournalEntryId,
    paymentReversalJournalEntryId,
    status: "Payment Reversed",
  };
};

const reversePayroll = async (
  db,
  uid,
  payrollRunId,
  reason,
  reversalDate,
  assertCompanyRole,
  createAuditLog,
) => {
  if (!payrollRunId || typeof payrollRunId !== "string") {
    throw new HttpsError("invalid-argument", "payrollRunId is required.");
  }

  const normalizedReason = String(reason || "").trim();
  if (!normalizedReason) {
    throw new HttpsError("invalid-argument", "reason is required for payroll reversal.");
  }

  const normalizedReversalDate = formatDateOnly(reversalDate || new Date().toISOString());
  const payrollRef = db.collection("payrollRuns").doc(payrollRunId);
  const payrollSnap = await payrollRef.get();
  if (!payrollSnap.exists) {
    throw new HttpsError("not-found", "Payroll run not found.");
  }

  const payroll = payrollSnap.data();
  const companyId = payroll.companyId;
  await assertCompanyRole(uid, companyId, PAYROLL_REVERSAL_ROLES);

  const status = normalizePayrollRunStatus(payroll);
  if (status === "reversed" || payroll.reversedAt || payroll.reversed_at || payroll.reversalJournalEntryId || payroll.reversal_journal_entry_id) {
    throw new HttpsError("failed-precondition", "Payroll has already been reversed.");
  }

  if (status === "paid") {
    throw new HttpsError(
      "failed-precondition",
      "Reverse payroll payment first before reversing payroll accrual.",
    );
  }

  if (!["processed", "final", "payment_reversed"].includes(status)) {
    throw new HttpsError(
      "failed-precondition",
      "Only processed or payment-reversed payroll runs can be reversed.",
    );
  }

  const payrollJournalEntryId = String(
    payroll.journalEntryId ||
    payroll.journal_entry_id ||
    payroll.glJournalId ||
    payroll.gl_journal_id ||
    "",
  ).trim();

  if (!payrollJournalEntryId) {
    throw new HttpsError("failed-precondition", "Payroll has no posted accrual journal entry to reverse.");
  }

  const paymentJournalEntryId = String(
    payroll.paymentJournalEntryId ||
    payroll.payment_journal_entry_id ||
    "",
  ).trim() || null;

  await db.runTransaction(async (tx) => {
    await assertPeriodUnlocked(tx, db, companyId, normalizedReversalDate);
  });

  await assertJournalEntryReversible(db, companyId, payrollJournalEntryId);
  let paymentReversalJournalEntryId = null;
  if (paymentJournalEntryId) {
    const paymentEntryRef = db.collection("journalEntries").doc(paymentJournalEntryId);
    const paymentEntrySnap = await paymentEntryRef.get();
    if (!paymentEntrySnap.exists) {
      throw new HttpsError(
        "failed-precondition",
        "Payroll payment journal is missing. Resolve this inconsistency before reversal.",
      );
    }

    const paymentEntry = paymentEntrySnap.data();
    const paymentEntryOwner = paymentEntry.companyId || paymentEntry.organizationId;
    if (paymentEntryOwner !== companyId) {
      throw new HttpsError("permission-denied", "Payroll payment journal does not belong to this organization.");
    }

    if (paymentEntry.isPosted === false || paymentEntry.is_posted === false) {
      throw new HttpsError("failed-precondition", "Only posted payroll payment journals can be reversed.");
    }

    if (paymentEntry.isReversal === true || paymentEntry.reversalOf || paymentEntry.reversal_of) {
      throw new HttpsError("failed-precondition", "Payroll payment journal is already a reversal entry.");
    }

    paymentReversalJournalEntryId = String(
      paymentEntry.reversalEntryId ||
      paymentEntry.reversal_entry_id ||
      payroll.paymentReversalJournalEntryId ||
      payroll.payment_reversal_journal_entry_id ||
      "",
    ).trim() || null;

    if (!paymentReversalJournalEntryId) {
      throw new HttpsError(
        "failed-precondition",
        "Payroll payment is still active. Reverse payroll payment first.",
      );
    }
  }

  const accrualReversal = await accountingEngine.reverseJournalEntry({
    data: {
      journalEntryId: payrollJournalEntryId,
      reason: normalizedReason,
      reversalDate: normalizedReversalDate,
      allowPayrollReversal: true,
    },
    userId: uid,
    companyId,
    db,
  });

  const reversalJournalEntryId = accrualReversal.reversalEntryId;

  await db.runTransaction(async (tx) => {
    await assertPeriodUnlocked(tx, db, companyId, normalizedReversalDate);

    const currentPayrollSnap = await tx.get(payrollRef);
    if (!currentPayrollSnap.exists) {
      throw new HttpsError("not-found", "Payroll run not found.");
    }

    const currentPayroll = currentPayrollSnap.data();
    const currentStatus = normalizePayrollRunStatus(currentPayroll);
    if (currentStatus === "reversed") {
      throw new HttpsError("failed-precondition", "Payroll has already been reversed.");
    }

    tx.set(payrollRef, {
      status: "Reversed",
      payrollStatus: "reversed",
      payroll_status: "reversed",
      reversalJournalEntryId,
      reversal_journal_entry_id: reversalJournalEntryId,
      paymentReversalJournalEntryId: paymentReversalJournalEntryId,
      payment_reversal_journal_entry_id: paymentReversalJournalEntryId,
      reversalReferenceId: reversalJournalEntryId,
      reversal_reference_id: reversalJournalEntryId,
      reversalReason: normalizedReason,
      reversal_reason: normalizedReason,
      reversedBy: uid,
      reversed_by: uid,
      reversedAt: FieldValue.serverTimestamp(),
      reversed_at: FieldValue.serverTimestamp(),
      reversalDate: normalizedReversalDate,
      reversal_date: normalizedReversalDate,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
      updated_by: uid,
    }, { merge: true });

    await setPayrollItemsStatus({
      tx,
      db,
      payrollRunId,
      status: "reversed",
      uid,
    });

    await reversePayrollAdvanceDeductions({
      tx,
      db,
      companyId,
      payrollRunId,
      uid,
      reversalJournalEntryId,
    });

    if (reversalJournalEntryId) {
      tx.set(
        db.collection("payrollJournals").doc(`${payrollRunId}_${reversalJournalEntryId}`),
        {
          companyId,
          payrollRunId,
          payroll_run_id: payrollRunId,
          journalEntryId: reversalJournalEntryId,
          journal_entry_id: reversalJournalEntryId,
          journalType: "payroll_reversal",
          description: "Payroll accrual reversal",
          createdBy: uid,
          created_by: uid,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    if (paymentReversalJournalEntryId) {
      tx.set(
        db.collection("payrollJournals").doc(`${payrollRunId}_${paymentReversalJournalEntryId}`),
        {
          companyId,
          payrollRunId,
          payroll_run_id: payrollRunId,
          journalEntryId: paymentReversalJournalEntryId,
          journal_entry_id: paymentReversalJournalEntryId,
          journalType: "payroll_payment_reversal",
          description: "Payroll payment reversal",
          createdBy: uid,
          created_by: uid,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  });

  await createAuditLog(companyId, uid, "payroll_reversed", {
    payrollRunId,
    payrollJournalEntryId,
    paymentJournalEntryId,
    reversalJournalEntryId,
    paymentReversalJournalEntryId,
    reversalDate: normalizedReversalDate,
    reason: normalizedReason,
  });

  return {
    payrollRunId,
    payrollJournalEntryId,
    paymentJournalEntryId,
    reversalJournalEntryId,
    paymentReversalJournalEntryId,
    status: "Reversed",
  };
};

module.exports = {
  savePayrollDraft,
  processPayroll,
  paySalaries,
  payPayroll: paySalaries,
  reversePayrollPayment,
  reversePayroll,
};
