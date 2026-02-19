const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");

// Helper to ensure db is initialized
const getDb = () => admin.firestore();

// Helper constants
const JOURNAL_POSTING_ROLES = [
    "super_admin",
    "admin",
    "financial_manager",
    "accountant",
    "assistant_accountant",
];

const SUPPORTED_REFERENCE_TYPES = new Set([
    "Expense",
    "Bill",
    "BillPayment",
    "Invoice",
    "InvoicePayment",
    "Payroll",
    "PayrollPayment",
    "ManualEntry",
    "OpeningBalance",
]);

const SOURCE_TO_REFERENCE_TYPE = {
    expense: "Expense",
    bill: "Bill",
    bill_payment: "BillPayment",
    invoice: "Invoice",
    invoice_payment: "InvoicePayment",
    payroll: "Payroll",
    payroll_payment: "PayrollPayment",
    manual_journal: "ManualEntry",
    opening_balance: "OpeningBalance",
};

const ACCOUNT_TYPE_RANGES = {
    Asset: [1000, 19999],
    Liability: [2000, 29999],
    Equity: [3000, 39999],
    Income: [4000, 49999],
    Expense: [5000, 99999],
};

const validateAccountTypeRange = (accountType, accountCode) => {
    const numericCode = Number(accountCode);
    if (!Number.isFinite(numericCode)) return false;
    const range = ACCOUNT_TYPE_RANGES[accountType];
    if (!range) return false;
    return numericCode >= range[0] && numericCode <= range[1];
};

const normalizeMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const formatDateOnly = (value) => {
    if (!value) return new Date().toISOString().slice(0, 10);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new HttpsError("invalid-argument", "Invalid date value.");
    }
    return date.toISOString().slice(0, 10);
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

const normalizeReferenceType = (referenceType, sourceType) => {
    const explicit = String(referenceType || "").trim();
    if (explicit) {
        if (!SUPPORTED_REFERENCE_TYPES.has(explicit)) {
            throw new HttpsError("invalid-argument", `Unsupported referenceType: ${explicit}`);
        }
        return explicit;
    }

    const sourceKey = String(sourceType || "").trim().toLowerCase();
    if (sourceKey && SOURCE_TO_REFERENCE_TYPE[sourceKey]) {
        return SOURCE_TO_REFERENCE_TYPE[sourceKey];
    }
    return "ManualEntry";
};

const assertCompanyRole = async (uid, companyId, allowedRoles) => {
    const db = getDb();
    // Simplified role check for internal function use, relies on index.js to pass context if needed
    // But since these are exported functions, we need to do the check.
    // We'll reuse the logic from index.js here or import it if we could, but for isolated file:

    // Check direct membership
    const membershipDocId = `${companyId}_${uid}`;
    const directRef = db.collection("companyUsers").doc(membershipDocId);
    const directSnap = await directRef.get();

    if (directSnap.exists && directSnap.data().status === "active") {
        if (!allowedRoles.includes(directSnap.data().role)) {
            throw new HttpsError("permission-denied", "Insufficient role.");
        }
        return directSnap.data();
    }

    throw new HttpsError("permission-denied", "No active membership.");
};

const getPrimaryCompanyIdForUser = async (uid) => {
    const db = getDb();
    const membershipSnap = await db
        .collection("companyUsers")
        .where("userId", "==", uid)
        .where("status", "==", "active")
        .limit(1)
        .get();

    if (membershipSnap.empty) {
        throw new HttpsError("failed-precondition", "No active company membership found.");
    }

    return membershipSnap.docs[0].data().companyId;
};

const assertPeriodUnlocked = async (tx, companyId, entryDate, db) => {
    const normalizedEntryDate = formatDateOnly(entryDate);

    const periodLocksQuery = db
        .collection("periodLocks")
        .where("companyId", "==", companyId);
    const periodLocksSnap = await tx.get(periodLocksQuery);

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

    const periodsQuery = db
        .collection("financialPeriods")
        .where("companyId", "==", companyId);
    const periodsSnap = await tx.get(periodsQuery);

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

const assertOpeningBalanceCanBePosted = async (tx, companyId, db) => {
    const settingsRef = db.collection("companySettings").doc(companyId);
    const settingsSnap = await tx.get(settingsRef);
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    if (settings.openingBalancesPosted === true) {
        throw new HttpsError("failed-precondition", "Opening balances have already been posted.");
    }

    const existingEntriesSnap = await tx.get(
        db.collection("journalEntries")
            .where("companyId", "==", companyId)
            .where("isPosted", "==", true)
            .limit(1),
    );
    if (!existingEntriesSnap.empty) {
        throw new HttpsError(
            "failed-precondition",
            "Opening balances must be posted before any other journal entries.",
        );
    }

    return settingsRef;
};

const validateJournalLines = (lines) => {
    if (!Array.isArray(lines) || lines.length < 2) {
        throw new HttpsError("invalid-argument", "A journal entry must contain at least two lines.");
    }

    const normalized = lines.map((line, index) => {
        if (!line || typeof line !== "object") {
            throw new HttpsError("invalid-argument", `Line ${index + 1} is invalid.`);
        }
        if (!line.accountId || typeof line.accountId !== "string") {
            throw new HttpsError("invalid-argument", `Line ${index + 1} is missing accountId.`);
        }

        const debit = normalizeMoney(line.debit || 0);
        const credit = normalizeMoney(line.credit || 0);

        if (debit < 0 || credit < 0) {
            throw new HttpsError("invalid-argument", `Line ${index + 1} cannot have negative values.`);
        }

        if ((debit === 0 && credit === 0) || (debit > 0 && credit > 0)) {
            throw new HttpsError(
                "invalid-argument",
                `Line ${index + 1} must contain either a debit or a credit value.`,
            );
        }

        return {
            accountId: line.accountId,
            debit,
            credit,
            description: line.description || null,
        };
    });

    const debitTotal = normalizeMoney(normalized.reduce((sum, line) => sum + line.debit, 0));
    const creditTotal = normalizeMoney(normalized.reduce((sum, line) => sum + line.credit, 0));

    if (Math.abs(debitTotal - creditTotal) > 0.009) {
        throw new HttpsError(
            "invalid-argument",
            `Journal entry is unbalanced. Debits (${debitTotal}) must equal credits (${creditTotal}).`,
        );
    }

    return { normalized, debitTotal, creditTotal };
};

const createPostedJournalEntry = async ({
    companyId,
    entryDate,
    description,
    referenceNumber,
    referenceType,
    referenceId,
    sourceType,
    sourceId,
    createdByUid,
    lines,
    metadata,
}) => {
    const db = getDb();
    const { normalized, debitTotal, creditTotal } = validateJournalLines(lines);
    const normalizedEntryDate = formatDateOnly(entryDate);
    const normalizedReferenceType = normalizeReferenceType(referenceType, sourceType);
    const normalizedReferenceId = String(referenceId || sourceId || "").trim() || null;
    const entryRef = db.collection("journalEntries").doc();
    const lineRefs = normalized.map(() => db.collection("journalLines").doc());

    await db.runTransaction(async (tx) => {
        await assertPeriodUnlocked(tx, companyId, normalizedEntryDate, db);

        let companySettingsRef = null;
        if (normalizedReferenceType === "OpeningBalance") {
            companySettingsRef = await assertOpeningBalanceCanBePosted(tx, companyId, db);
        }

        // Verify accounts exist and belong to company
        for (const line of normalized) {
            const accountRef = db.collection("chartOfAccounts").doc(line.accountId);
            const accountSnap = await tx.get(accountRef);
            if (!accountSnap.exists) {
                throw new HttpsError("failed-precondition", `Account ${line.accountId} is invalid.`);
            }

            const account = accountSnap.data();
            const owner = account.companyId || account.organizationId || account.organization_id;
            if (owner !== companyId) {
                throw new HttpsError("failed-precondition", `Account ${line.accountId} is invalid.`);
            }

            const accountStatus = String(account.status || "").toLowerCase();
            const isInactive = account.isActive === false
                || account.is_active === false
                || accountStatus === "inactive";
            if (isInactive) {
                throw new HttpsError("failed-precondition", `Account ${line.accountId} is invalid.`);
            }
        }

        tx.set(entryRef, {
            companyId,
            entryDate: normalizedEntryDate,
            description: description || null,
            referenceNumber: referenceNumber || null,
            referenceType: normalizedReferenceType,
            referenceId: normalizedReferenceId,
            sourceType: sourceType || null,
            sourceId: normalizedReferenceId,
            isPosted: true,
            debitTotal,
            creditTotal,
            createdBy: createdByUid,
            postedBy: createdByUid,
            metadata: metadata || null,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            postedAt: FieldValue.serverTimestamp(),
        });

        normalized.forEach((line, index) => {
            tx.set(lineRefs[index], {
                companyId,
                entryId: entryRef.id,
                lineNumber: index + 1,
                accountId: line.accountId,
                debit: line.debit,
                credit: line.credit,
                description: line.description,
                entryDate: normalizedEntryDate,
                isPosted: true,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });
        });

        if (companySettingsRef) {
            tx.set(companySettingsRef, {
                companyId,
                openingBalancesPosted: true,
                openingBalancesPostedAt: FieldValue.serverTimestamp(),
                openingBalancesEntryId: entryRef.id,
                openingBalancesDate: normalizedEntryDate,
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: createdByUid,
            }, { merge: true });
        }
    });

    // Minimal audit log
    await db.collection("auditLogs").add({
        companyId,
        actorUid: createdByUid,
        action: "journal_entry_posted",
        details: { entryId: entryRef.id, debitTotal },
        createdAt: FieldValue.serverTimestamp(),
    });

    return entryRef.id;
};


// --- PUBLIC FUNCTIONS ---

const getDefaultAccountId = async (companyId, accountType) => {
    const db = getDb();
    const snap = await db.collection("chartOfAccounts")
        .where("companyId", "==", companyId)
        .where("accountType", "==", accountType)
        .where("status", "==", "active")
        .limit(1)
        .get();
    return snap.empty ? null : snap.docs[0].id;
};

const resolveAccountIdFromSource = async (companyId, sourceData, preferredFields, fallbackType) => {
    for (const field of preferredFields) {
        const value = sourceData[field];
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return getDefaultAccountId(companyId, fallbackType);
};

exports.resolveAccountIdFromSource = resolveAccountIdFromSource;
exports.createPostedJournalEntry = createPostedJournalEntry;
exports.getDefaultAccountId = getDefaultAccountId;

exports.postJournalEntry = async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");
    const payload = request.data || {};
    let companyId = String(payload.companyId || "").trim();
    if (!companyId) {
        companyId = await getPrimaryCompanyIdForUser(request.auth.uid);
    }

    const lines = payload.lines;
    const entryDate = payload.entryDate;
    const description = payload.description;
    const referenceNumber = payload.referenceNumber;
    const referenceType = payload.referenceType || payload.sourceType || "ManualEntry";
    const referenceId = payload.referenceId || payload.sourceId || null;

    await assertCompanyRole(request.auth.uid, companyId, JOURNAL_POSTING_ROLES);

    const entryId = await createPostedJournalEntry({
        companyId,
        entryDate,
        description,
        referenceNumber,
        referenceType,
        referenceId,
        sourceType: payload.sourceType || "manual_journal",
        createdByUid: request.auth.uid,
        lines,
        metadata: payload.metadata || null,
    });

    return { entryId };
};

// --- AUTO POSTING LOGIC ---

exports.postInvoiceToGL = async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");
    const { invoiceId } = request.data;
    if (!invoiceId) throw new HttpsError("invalid-argument", "invoiceId required");

    const db = getDb();
    const invoiceSnap = await db.collection("invoices").doc(invoiceId).get();
    if (!invoiceSnap.exists) throw new HttpsError("not-found", "Invoice not found");

    const invoice = invoiceSnap.data();
    const companyId = invoice.companyId;
    await assertCompanyRole(request.auth.uid, companyId, JOURNAL_POSTING_ROLES);

    if (invoice.journalEntryId) return { journalEntryId: invoice.journalEntryId, alreadyPosted: true };

    // 1. Get Accounts
    // AR Account (Asset)
    const arAccountId = await getDefaultAccountId(companyId, "Asset"); // Ideally dedicated AR account
    if (!arAccountId) throw new HttpsError("failed-precondition", "No Asset account found for AR");

    // Revenue Account (Income)
    const revenueAccountId = await getDefaultAccountId(companyId, "Income");
    if (!revenueAccountId) throw new HttpsError("failed-precondition", "No Income account found");

    // Tax Account (Liability) - Only if tax exists
    const taxAccountId = await getDefaultAccountId(companyId, "Liability"); // Ideally VAT Payable

    // 2. Calculate Amounts
    const grandTotal = normalizeMoney(invoice.total || 0); // Includes Tax
    const taxTotal = normalizeMoney(invoice.taxAmount || 0); // Need to ensure invoice has this
    const subTotal = normalizeMoney(grandTotal - taxTotal);

    const lines = [];

    // Debit AR (Customer owes us full amount)
    lines.push({ accountId: arAccountId, debit: grandTotal, credit: 0, description: `Invoice #${invoice.invoiceNumber}` });

    // Credit Revenue (Subtotal)
    lines.push({ accountId: revenueAccountId, debit: 0, credit: subTotal, description: "Sales Revenue" });

    // Credit VAT Payable (If tax exists)
    if (taxTotal > 0) {
        if (!taxAccountId) throw new HttpsError("failed-precondition", "No Liability account found for VAT");
        lines.push({ accountId: taxAccountId, debit: 0, credit: taxTotal, description: "VAT Output Tax" });
    }

    const journalEntryId = await createPostedJournalEntry({
        companyId,
        entryDate: invoice.date || new Date().toISOString(),
        description: `Invoice #${invoice.invoiceNumber}`,
        referenceNumber: invoice.invoiceNumber,
        sourceType: "invoice",
        sourceId: invoiceId, // Fixed: use invoiceId from request/scope
        createdByUid: request.auth.uid,
        lines
    });

    await db.collection("invoices").doc(invoiceId).update({
        journalEntryId,
        glPostedAt: FieldValue.serverTimestamp(),
        status: "sent" // Ensure status reflects finalized state
    });

    return { journalEntryId };
};

exports.postExpenseToGL = async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");
    const { expenseId } = request.data;
    if (!expenseId) throw new HttpsError("invalid-argument", "expenseId required");

    const db = getDb();
    const expenseSnap = await db.collection("expenses").doc(expenseId).get();
    if (!expenseSnap.exists) throw new HttpsError("not-found", "Expense not found");

    const expense = expenseSnap.data();
    const companyId = expense.companyId;
    await assertCompanyRole(request.auth.uid, companyId, JOURNAL_POSTING_ROLES);

    if (expense.journalEntryId) return { journalEntryId: expense.journalEntryId, alreadyPosted: true };

    const amount = normalizeMoney(expense.amount || 0);

    // 1. Determine Debit Account (Expense Category)
    const expenseAccountId = await getExpenseAccountForCategory(companyId, expense.category);
    if (!expenseAccountId) throw new HttpsError("failed-precondition", "No Expense account found");

    // 2. Determine Credit Account (Payment Source)
    let creditAccountId;
    const method = (expense.payment_method || "").toLowerCase();

    if (method.includes("cash")) {
        // Find Cash Account (Asset, code usually 1000-1099)
        // Hardcoded query for now, ideally search by name or dedicated type
        creditAccountId = await getDefaultAccountId(companyId, "Asset");
    } else if (method.includes("bank") || method.includes("card") || method.includes("transfer")) {
        // Find Bank Account (Asset)
        creditAccountId = await getDefaultAccountId(companyId, "Asset");
    } else {
        // Default to Accounts Payable (Liability) if "Credit" or unknown
        creditAccountId = await getDefaultAccountId(companyId, "Liability");
    }

    if (!creditAccountId) throw new HttpsError("failed-precondition", "No Credit account found for payment method");

    const lines = [
        { accountId: expenseAccountId, debit: amount, credit: 0, description: expense.description },
        { accountId: creditAccountId, debit: 0, credit: amount, description: `Payment via ${expense.payment_method}` }
    ];

    const journalEntryId = await createPostedJournalEntry({
        companyId,
        entryDate: expense.expense_date || new Date().toISOString(),
        description: expense.description || "Expense",
        referenceNumber: expense.reference_number,
        sourceType: "expense",
        sourceId: expenseId,
        createdByUid: request.auth.uid,
        lines
    });

    await db.collection("expenses").doc(expenseId).update({
        journalEntryId,
        glPostedAt: FieldValue.serverTimestamp()
    });

    return { journalEntryId };
};

exports.getGLBalances = async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");
    const { companyId, startDate, endDate } = request.data;

    const db = getDb();
    let query = db.collection("journalLines")
        .where("companyId", "==", companyId)
        .where("isPosted", "==", true);

    if (startDate) query = query.where("entryDate", ">=", formatDateOnly(startDate));
    if (endDate) query = query.where("entryDate", "<=", formatDateOnly(endDate));

    const snap = await query.get();

    // Aggregate in memory (Firestore restriction workaround)
    const balances = {}; // accountId -> { debit, credit }

    snap.forEach(doc => {
        const d = doc.data();
        if (!balances[d.accountId]) balances[d.accountId] = { debit: 0, credit: 0 };
        balances[d.accountId].debit += d.debit;
        balances[d.accountId].credit += d.credit;
    });

    // Enrich with account names
    const results = [];
    for (const [accId, totals] of Object.entries(balances)) {
        const accSnap = await db.collection("chartOfAccounts").doc(accId).get();
        if (accSnap.exists) {
            const acc = accSnap.data();
            results.push({
                accountId: accId,
                accountCode: acc.accountCode,
                accountName: acc.accountName,
                accountType: acc.accountType,
                debitTotal: totals.debit,
                creditTotal: totals.credit
            });
        }
    }

    return results;
};

exports.getTrialBalance = async (request) => {
    // Re-uses logic usually, or just calls getGLBalances with no start date
    // Simplified for brevity
    return exports.getGLBalances(request);
};

// --- HELPER: Resolve Category to Account ---
const getExpenseAccountForCategory = async (companyId, categoryName) => {
    if (!categoryName) return getDefaultAccountId(companyId, "Expense");

    const db = getDb();
    // Try to find a mapping
    // We assume a collection "expenseCategoryMappings" where docId = `${companyId}_${sanitizedCategory}`
    // Or query by fields.
    const mappingSnap = await db.collection("expenseCategoryMappings")
        .where("companyId", "==", companyId)
        .where("categoryName", "==", categoryName)
        .limit(1)
        .get();

    if (!mappingSnap.empty) {
        return mappingSnap.docs[0].data().accountId;
    }

    // Fallback: Check if there is an account with the EXACT NAME as the category
    const accountSnap = await db.collection("chartOfAccounts")
        .where("companyId", "==", companyId)
        .where("accountName", "==", categoryName)
        .limit(1)
        .get();

    if (!accountSnap.empty) {
        return accountSnap.docs[0].id;
    }

    return getDefaultAccountId(companyId, "Expense");
};

exports.postBillToGL = async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");
    const { billId } = request.data;
    if (!billId) throw new HttpsError("invalid-argument", "billId required");

    const db = getDb();
    const billSnap = await db.collection("bills").doc(billId).get();
    if (!billSnap.exists) throw new HttpsError("not-found", "Bill not found");

    const bill = billSnap.data();
    const companyId = bill.companyId;
    await assertCompanyRole(request.auth.uid, companyId, JOURNAL_POSTING_ROLES);

    if (bill.journalEntryId) return { journalEntryId: bill.journalEntryId, alreadyPosted: true };

    const amount = normalizeMoney(bill.amount || bill.total || 0);

    // 1. Debit: Expense / Asset
    // Use category if available, or fallback
    const debitAccountId = await getExpenseAccountForCategory(companyId, bill.category);
    if (!debitAccountId) throw new HttpsError("failed-precondition", "No Expense account found");

    // 2. Credit: Accounts Payable
    const creditAccountId = await getDefaultAccountId(companyId, "Liability"); // Ideally dedicated AP account
    if (!creditAccountId) throw new HttpsError("failed-precondition", "No Accounts Payable account found");

    const lines = [
        { accountId: debitAccountId, debit: amount, credit: 0, description: bill.description || "Bill Expense" },
        { accountId: creditAccountId, debit: 0, credit: amount, description: `Bill #${bill.billNumber || billId}` }
    ];

    const journalEntryId = await createPostedJournalEntry({
        companyId,
        entryDate: bill.billDate || bill.date || new Date().toISOString(),
        description: `Bill from ${bill.vendorName || "Vendor"}`,
        referenceNumber: bill.billNumber,
        sourceType: "bill",
        sourceId: billId,
        createdByUid: request.auth.uid,
        lines
    });

    await db.collection("bills").doc(billId).update({
        journalEntryId,
        glPostedAt: FieldValue.serverTimestamp(),
        status: "posted"
    });

    return { journalEntryId };
};

// --- BILL PAYMENT POSTING ---
exports.postBillPaymentToGL = async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");
    const { billId, paymentAmount, paymentDate, paymentMethod, bankAccountId } = request.data;

    if (!billId) throw new HttpsError("invalid-argument", "billId required");
    if (!paymentAmount || paymentAmount <= 0) throw new HttpsError("invalid-argument", "paymentAmount must be positive");

    const db = getDb();
    const billSnap = await db.collection("bills").doc(billId).get();
    if (!billSnap.exists) throw new HttpsError("not-found", "Bill not found");

    const bill = billSnap.data();
    const companyId = bill.companyId;
    await assertCompanyRole(request.auth.uid, companyId, JOURNAL_POSTING_ROLES);

    const amount = normalizeMoney(paymentAmount);

    // 1. Find Accounts Payable account (Liability)
    const apAccountId = await getDefaultAccountId(companyId, "Liability");
    if (!apAccountId) throw new HttpsError("failed-precondition", "No Accounts Payable account found");

    // 2. Find Bank/Cash account (Asset)
    let creditAccountId = bankAccountId;
    if (!creditAccountId) {
        creditAccountId = await getDefaultAccountId(companyId, "Asset");
    }
    if (!creditAccountId) throw new HttpsError("failed-precondition", "No payment account found");

    const lines = [
        { accountId: apAccountId, debit: amount, credit: 0, description: `Bill Payment #${bill.billNumber || billId}` },
        { accountId: creditAccountId, debit: 0, credit: amount, description: `Payment via ${paymentMethod || 'Bank'}` }
    ];

    const journalEntryId = await createPostedJournalEntry({
        companyId,
        entryDate: paymentDate || new Date().toISOString(),
        description: `Bill Payment #${bill.billNumber || billId}`,
        referenceNumber: bill.billNumber,
        sourceType: "bill_payment",
        sourceId: billId,
        createdByUid: request.auth.uid,
        lines
    });

    // Update bill payment tracking
    const currentPaid = bill.amountPaid || 0;
    const newTotalPaid = normalizeMoney(currentPaid + amount);
    const totalAmount = normalizeMoney(bill.totalAmount || bill.amount || 0);

    let paymentStatus = "Unpaid";
    if (newTotalPaid >= totalAmount) {
        paymentStatus = "Paid";
    } else if (newTotalPaid > 0) {
        paymentStatus = "Partially Paid";
    }

    await db.collection("bills").doc(billId).update({
        amountPaid: newTotalPaid,
        remainingBalance: normalizeMoney(totalAmount - newTotalPaid),
        paymentStatus,
        lastPaymentDate: paymentDate || new Date().toISOString().split('T')[0],
        updatedAt: FieldValue.serverTimestamp()
    });

    // Record payment in billPayments collection
    await db.collection("billPayments").add({
        companyId,
        billId,
        paymentDate: paymentDate || new Date().toISOString().split('T')[0],
        amountPaid: amount,
        paymentMethod: paymentMethod || null,
        bankAccountId: creditAccountId,
        journalEntryId,
        createdBy: request.auth.uid,
        createdAt: FieldValue.serverTimestamp()
    });

    return { journalEntryId, paymentStatus };
};

// --- INVOICE PAYMENT POSTING ---
exports.postInvoicePaymentToGL = async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");
    const { invoiceId, paymentAmount, paymentDate, paymentMethod, bankAccountId } = request.data;

    if (!invoiceId) throw new HttpsError("invalid-argument", "invoiceId required");
    if (!paymentAmount || paymentAmount <= 0) throw new HttpsError("invalid-argument", "paymentAmount must be positive");

    const db = getDb();
    const invoiceSnap = await db.collection("invoices").doc(invoiceId).get();
    if (!invoiceSnap.exists) throw new HttpsError("not-found", "Invoice not found");

    const invoice = invoiceSnap.data();
    const companyId = invoice.companyId;
    await assertCompanyRole(request.auth.uid, companyId, JOURNAL_POSTING_ROLES);

    const amount = normalizeMoney(paymentAmount);

    // 1. Find Bank/Cash account (Asset) - Debit this
    let debitAccountId = bankAccountId;
    if (!debitAccountId) {
        debitAccountId = await getDefaultAccountId(companyId, "Asset");
    }
    if (!debitAccountId) throw new HttpsError("failed-precondition", "No bank account found");

    // 2. Find Accounts Receivable account (Asset) - Credit this
    const arAccountId = await getDefaultAccountId(companyId, "Asset");
    if (!arAccountId) throw new HttpsError("failed-precondition", "No AR account found");

    const lines = [
        { accountId: debitAccountId, debit: amount, credit: 0, description: `Payment received via ${paymentMethod || 'Bank'}` },
        { accountId: arAccountId, debit: 0, credit: amount, description: `Invoice Payment #${invoice.invoiceNumber}` }
    ];

    const journalEntryId = await createPostedJournalEntry({
        companyId,
        entryDate: paymentDate || new Date().toISOString(),
        description: `Invoice Payment #${invoice.invoiceNumber}`,
        referenceNumber: invoice.invoiceNumber,
        sourceType: "invoice_payment",
        sourceId: invoiceId,
        createdByUid: request.auth.uid,
        lines
    });

    // Update invoice payment tracking
    const currentReceived = invoice.amountReceived || 0;
    const newTotalReceived = normalizeMoney(currentReceived + amount);
    const totalAmount = normalizeMoney(invoice.total || 0);

    let paymentStatus = "Unpaid";
    if (newTotalReceived >= totalAmount) {
        paymentStatus = "Paid";
    } else if (newTotalReceived > 0) {
        paymentStatus = "Partially Paid";
    }

    await db.collection("invoices").doc(invoiceId).update({
        amountReceived: newTotalReceived,
        remainingBalance: normalizeMoney(totalAmount - newTotalReceived),
        paymentStatus,
        lastPaymentDate: paymentDate || new Date().toISOString().split('T')[0],
        updatedAt: FieldValue.serverTimestamp()
    });

    // Record payment in invoicePayments collection
    await db.collection("invoicePayments").add({
        companyId,
        invoiceId,
        paymentDate: paymentDate || new Date().toISOString().split('T')[0],
        amountReceived: amount,
        paymentMethod: paymentMethod || null,
        bankAccountId: debitAccountId,
        journalEntryId,
        createdBy: request.auth.uid,
        createdAt: FieldValue.serverTimestamp()
    });

    return { journalEntryId, paymentStatus };
};

/**
 * Get Expense Report - Category breakdown with percentages
 */
const getExpenseReport = async (companyId, uid, startDate, endDate, assertRoleFn) => {
    const db = getDb();

    // Validate access
    if (assertRoleFn) {
        await assertRoleFn(uid, companyId, ["super_admin", "admin", "financial_manager", "accountant", "assistant_accountant"]);
    }

    // Query all expense accounts
    const accountsSnapshot = await db
        .collection("chartOfAccounts")
        .where("companyId", "==", companyId)
        .where("accountType", "==", "Expense")
        .where("status", "==", "active")
        .get();

    if (accountsSnapshot.empty) {
        return [];
    }

    const expenseAccounts = accountsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    // Query journal lines for date range
    let linesQuery = db
        .collection("journalLines")
        .where("companyId", "==", companyId)
        .where("isPosted", "==", true);

    if (startDate) {
        linesQuery = linesQuery.where("entryDate", ">=", startDate);
    }
    if (endDate) {
        linesQuery = linesQuery.where("entryDate", "<=", endDate);
    }

    const linesSnapshot = await linesQuery.get();

    // Calculate totals
    const accountTotals = {};
    let grandTotal = 0;

    expenseAccounts.forEach(account => {
        accountTotals[account.id] = {
            accountCode: account.accountCode,
            accountName: account.accountName,
            total: 0
        };
    });

    linesSnapshot.docs.forEach(doc => {
        const line = doc.data();
        if (accountTotals[line.accountId]) {
            const debit = Number(line.debit || 0);
            const credit = Number(line.credit || 0);
            const netExpense = debit - credit;
            accountTotals[line.accountId].total += netExpense;
            grandTotal += netExpense;
        }
    });

    // Build result
    return Object.values(accountTotals)
        .filter(account => account.total > 0)
        .map(account => ({
            accountCode: String(account.accountCode),
            accountName: account.accountName,
            total: normalizeMoney(account.total),
            percentage: grandTotal > 0 ? normalizeMoney((account.total / grandTotal) * 100) : 0
        }))
        .sort((a, b) => b.total - a.total);
};

/**
 * Get General Ledger - Transaction history with running balance
 */
const getGeneralLedger = async (companyId, uid, accountId, startDate, endDate, assertRoleFn) => {
    const db = getDb();

    // Validate access
    if (assertRoleFn) {
        await assertRoleFn(uid, companyId, ["super_admin", "admin", "financial_manager", "accountant", "assistant_accountant"]);
    }

    // Build query
    let query = db
        .collection("journalLines")
        .where("companyId", "==", companyId)
        .where("isPosted", "==", true);

    if (accountId) {
        query = query.where("accountId", "==", accountId);
    }
    if (startDate) {
        query = query.where("entryDate", ">=", startDate);
    }
    if (endDate) {
        query = query.where("entryDate", "<=", endDate);
    }

    query = query.orderBy("entryDate", "asc");

    const linesSnapshot = await query.get();

    if (linesSnapshot.empty) {
        return [];
    }

    // Get account info
    const accountIds = [...new Set(linesSnapshot.docs.map(doc => doc.data().accountId))];
    const accountsSnapshot = await db
        .collection("chartOfAccounts")
        .where(admin.firestore.FieldPath.documentId(), "in", accountIds.slice(0, 10))
        .get();

    const accountInfo = {};
    accountsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        accountInfo[doc.id] = {
            accountType: data.accountType,
            accountCode: data.accountCode,
            accountName: data.accountName
        };
    });

    // Calculate running balance
    const transactions = [];
    let runningBalance = 0;

    linesSnapshot.docs.forEach(doc => {
        const line = doc.data();
        const account = accountInfo[line.accountId] || {};
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);

        const isDebitNormal = account.accountType === "Asset" || account.accountType === "Expense";

        if (isDebitNormal) {
            runningBalance += debit - credit;
        } else {
            runningBalance += credit - debit;
        }

        transactions.push({
            date: line.entryDate,
            description: line.description || "No description",
            reference: line.entryId || "",
            debit: normalizeMoney(debit),
            credit: normalizeMoney(credit),
            runningBalance: normalizeMoney(runningBalance)
        });
    });

    return transactions;
};

/**
 * Get Cash Flow Data - Operating, Investing, Financing activities
 */
const getCashFlowData = async (companyId, uid, startDate, endDate, assertRoleFn) => {
    const db = getDb();

    // Validate access
    if (assertRoleFn) {
        await assertRoleFn(uid, companyId, ["super_admin", "admin", "financial_manager", "accountant", "assistant_accountant"]);
    }

    // Query cash/bank accounts (1000-1099)
    const cashAccountsSnapshot = await db
        .collection("chartOfAccounts")
        .where("companyId", "==", companyId)
        .where("accountType", "==", "Asset")
        .where("status", "==", "active")
        .get();

    const cashAccounts = cashAccountsSnapshot.docs
        .filter(doc => {
            const code = doc.data().accountCode;
            return code >= 1000 && code <= 1099;
        })
        .map(doc => doc.id);

    if (cashAccounts.length === 0) {
        return {
            operating: { inflows: 0, outflows: 0, net: 0 },
            investing: { inflows: 0, outflows: 0, net: 0 },
            financing: { inflows: 0, outflows: 0, net: 0 },
            netIncrease: 0,
            openingBalance: 0,
            closingBalance: 0
        };
    }

    // Query journal lines for cash accounts
    let linesQuery = db
        .collection("journalLines")
        .where("companyId", "==", companyId)
        .where("accountId", "in", cashAccounts.slice(0, 10))
        .where("isPosted", "==", true);

    if (startDate) {
        linesQuery = linesQuery.where("entryDate", ">=", startDate);
    }
    if (endDate) {
        linesQuery = linesQuery.where("entryDate", "<=", endDate);
    }

    const linesSnapshot = await linesQuery.get();

    // Simplified cash flow categorization
    let operating = { inflows: 0, outflows: 0, net: 0 };
    let investing = { inflows: 0, outflows: 0, net: 0 };
    let financing = { inflows: 0, outflows: 0, net: 0 };

    linesSnapshot.docs.forEach(doc => {
        const line = doc.data();
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);
        const netChange = debit - credit; // Positive = cash in, Negative = cash out

        // Simple category assignment  based on description
        const desc = (line.description || "").toLowerCase();

        if (desc.includes("loan") || desc.includes("capital") || desc.includes("equity")) {
            if (netChange > 0) {
                financing.inflows += netChange;
            } else {
                financing.outflows += Math.abs(netChange);
            }
        } else if (desc.includes("asset") || desc.includes("equipment") || desc.includes("vehicle")) {
            if (netChange > 0) {
                investing.inflows += netChange;
            } else {
                investing.outflows += Math.abs(netChange);
            }
        } else {
            // Default to operating
            if (netChange > 0) {
                operating.inflows += netChange;
            } else {
                operating.outflows += Math.abs(netChange);
            }
        }
    });

    operating.net = operating.inflows - operating.outflows;
    investing.net = investing.inflows - investing.outflows;
    financing.net = financing.inflows - financing.outflows;

    const netIncrease = operating.net + investing.net + financing.net;

    return {
        operating: {
            inflows: normalizeMoney(operating.inflows),
            outflows: normalizeMoney(operating.outflows),
            net: normalizeMoney(operating.net)
        },
        investing: {
            inflows: normalizeMoney(investing.inflows),
            outflows: normalizeMoney(investing.outflows),
            net: normalizeMoney(investing.net)
        },
        financing: {
            inflows: normalizeMoney(financing.inflows),
            outflows: normalizeMoney(financing.outflows),
            net: normalizeMoney(financing.net)
        },
        netIncrease: normalizeMoney(netIncrease),
        openingBalance: 0, // Would need separate calculation
        closingBalance: normalizeMoney(netIncrease)
    };
};

// All functions are exported using exports.functionName = async... syntax throughout the file
// No need for module.exports = {} block

