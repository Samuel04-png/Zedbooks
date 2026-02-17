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
    sourceType,
    sourceId,
    createdByUid,
    lines,
    metadata,
}) => {
    const db = getDb();
    const { normalized, debitTotal, creditTotal } = validateJournalLines(lines);
    const normalizedEntryDate = formatDateOnly(entryDate);
    const entryRef = db.collection("journalEntries").doc();
    const lineRefs = normalized.map(() => db.collection("journalLines").doc());

    await db.runTransaction(async (tx) => {
        // Verify accounts exist and belong to company
        for (const line of normalized) {
            const accountRef = db.collection("chartOfAccounts").doc(line.accountId);
            const accountSnap = await tx.get(accountRef);
            if (!accountSnap.exists || accountSnap.data().companyId !== companyId) {
                throw new HttpsError("failed-precondition", `Account ${line.accountId} is invalid.`);
            }
        }

        tx.set(entryRef, {
            companyId,
            entryDate: normalizedEntryDate,
            description: description || null,
            referenceNumber: referenceNumber || null,
            sourceType: sourceType || null,
            sourceId: sourceId || null,
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
    const { companyId, lines, entryDate, description, referenceNumber } = request.data;
    if (!companyId) throw new HttpsError("invalid-argument", "companyId required");

    await assertCompanyRole(request.auth.uid, companyId, JOURNAL_POSTING_ROLES);

    const entryId = await createPostedJournalEntry({
        companyId,
        entryDate,
        description,
        referenceNumber,
        sourceType: "manual_journal",
        createdByUid: request.auth.uid,
        lines,
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
