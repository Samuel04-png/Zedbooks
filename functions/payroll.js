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

const PAYROLL_ROLES = ["super_admin", "admin", "hr_manager", "financial_manager", "accountant"];

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

      tx.set(advanceEntry.docSnap.ref, {
        remaining_balance: Math.max(0, nextRemainingBalance),
        remainingBalance: Math.max(0, nextRemainingBalance),
        months_deducted: nextMonthsDeducted,
        monthsDeducted: nextMonthsDeducted,
        status: isFullyRepaid ? "deducted" : "partial",
        last_deducted_payroll_run_id: payrollRunId,
        last_deducted_at: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
        updated_by: uid,
      }, { merge: true });

      advanceEntry.data = {
        ...advance,
        remaining_balance: Math.max(0, nextRemainingBalance),
        remainingBalance: Math.max(0, nextRemainingBalance),
        months_deducted: nextMonthsDeducted,
        monthsDeducted: nextMonthsDeducted,
        status: isFullyRepaid ? "deducted" : "partial",
      };

      deductionBudget = normalizeMoney(deductionBudget - deductionAmount);
    }
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

  const status = String(payroll.payrollStatus || payroll.payroll_status || payroll.status || "").toLowerCase();
  if (status !== "draft") {
    throw new HttpsError("failed-precondition", "Payroll must be in Draft status before processing.");
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

    return createdJournalEntryId;
  });

  await createAuditLog(companyId, uid, "payroll_paid", { payrollRunId, journalEntryId });

  return { payrollRunId, journalEntryId, status: "Paid" };
};

module.exports = {
  savePayrollDraft,
  processPayroll,
  paySalaries,
  payPayroll: paySalaries,
};
