const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");

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

const JOURNAL_EPSILON = 0.001;

const normalizeMoney = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
};

const formatDateOnly = (value) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpsError("invalid-argument", "Invalid date value.");
  }
  return date.toISOString().slice(0, 10);
};

const isActiveAccount = (account) => {
  if (!account) return false;
  if (account.isActive === false) return false;
  if (account.is_active === false) return false;
  if (account.status === "inactive") return false;
  return true;
};

const accountBelongsToCompany = (account, companyId) => {
  const owner = account.companyId || account.organizationId || account.organization_id;
  return owner === companyId;
};

const normalizeJournalLine = (line, index) => {
  if (!line || typeof line !== "object") {
    throw new HttpsError("invalid-argument", `Line ${index + 1} is invalid.`);
  }

  const accountId = String(line.accountId || line.account_id || "").trim();
  if (!accountId) {
    throw new HttpsError("invalid-argument", `Line ${index + 1} is missing accountId.`);
  }

  const debitAmount = normalizeMoney(line.debitAmount ?? line.debit_amount ?? line.debit ?? 0);
  const creditAmount = normalizeMoney(line.creditAmount ?? line.credit_amount ?? line.credit ?? 0);

  if (debitAmount < 0 || creditAmount < 0) {
    throw new HttpsError("invalid-argument", `Line ${index + 1} cannot be negative.`);
  }

  if ((debitAmount === 0 && creditAmount === 0) || (debitAmount > 0 && creditAmount > 0)) {
    throw new HttpsError(
      "invalid-argument",
      `Line ${index + 1} must contain exactly one side (debit or credit).`,
    );
  }

  return {
    accountId,
    debitAmount,
    creditAmount,
    description: line.description ? String(line.description) : null,
  };
};

const validateJournalLines = (lines) => {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new HttpsError("invalid-argument", "Journal entry requires at least 2 lines.");
  }

  const normalized = lines.map((line, index) => normalizeJournalLine(line, index));
  const totalDebits = normalizeMoney(normalized.reduce((sum, line) => sum + line.debitAmount, 0));
  const totalCredits = normalizeMoney(normalized.reduce((sum, line) => sum + line.creditAmount, 0));

  if (Math.abs(totalDebits - totalCredits) > JOURNAL_EPSILON) {
    throw new HttpsError(
      "failed-precondition",
      `Journal entry is unbalanced. Debits: ${totalDebits}, Credits: ${totalCredits}`,
    );
  }

  return { normalized, totalDebits, totalCredits };
};

const assertReferenceType = (referenceType) => {
  if (!referenceType) {
    throw new HttpsError("invalid-argument", "referenceType is required.");
  }

  if (!SUPPORTED_REFERENCE_TYPES.has(referenceType)) {
    throw new HttpsError("invalid-argument", `Unsupported reference type: ${referenceType}`);
  }
};

const getDb = () => admin.firestore();

const getAccountById = async (companyId, accountId, tx, db = getDb()) => {
  const accountRef = db.collection("chartOfAccounts").doc(accountId);
  const accountSnap = tx ? await tx.get(accountRef) : await accountRef.get();

  if (!accountSnap.exists) {
    throw new HttpsError("not-found", `Account ${accountId} not found.`);
  }

  const account = accountSnap.data();
  if (!accountBelongsToCompany(account, companyId)) {
    throw new HttpsError("permission-denied", `Account ${accountId} is not in this organization.`);
  }

  if (!isActiveAccount(account)) {
    throw new HttpsError("failed-precondition", `Account ${accountId} is inactive.`);
  }

  return {
    id: accountSnap.id,
    ...account,
  };
};

const findAccountByName = async (companyId, names, db = getDb()) => {
  for (const name of names) {
    const snapshot = await db
      .collection("chartOfAccounts")
      .where("companyId", "==", companyId)
      .where("accountName", "==", name)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      const row = docSnap.data();
      if (isActiveAccount(row)) {
        return { id: docSnap.id, ...row };
      }
    }
  }

  return null;
};

const findAccountByCode = async (companyId, accountCode, db = getDb()) => {
  const snapshot = await db
    .collection("chartOfAccounts")
    .where("companyId", "==", companyId)
    .where("accountCode", "==", Number(accountCode))
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const docSnap = snapshot.docs[0];
  const row = docSnap.data();
  if (!isActiveAccount(row)) return null;

  return { id: docSnap.id, ...row };
};

const createJournalEntry = async ({
  organizationId,
  companyId,
  entryDate,
  description,
  referenceType,
  referenceId,
  lines,
  createdBy,
  db = getDb(),
  tx,
  metadata = null,
}) => {
  const scopedCompanyId = companyId || organizationId;
  if (!scopedCompanyId) {
    throw new HttpsError("invalid-argument", "organizationId/companyId is required.");
  }
  if (!createdBy) {
    throw new HttpsError("invalid-argument", "createdBy is required.");
  }
  if (!tx) {
    throw new HttpsError("failed-precondition", "createJournalEntry requires an active transaction.");
  }

  assertReferenceType(referenceType);

  const { normalized, totalDebits, totalCredits } = validateJournalLines(lines);
  const normalizedEntryDate = formatDateOnly(entryDate);

  for (const line of normalized) {
    await getAccountById(scopedCompanyId, line.accountId, tx, db);
  }

  const journalEntryRef = db.collection("journalEntries").doc();

  tx.set(journalEntryRef, {
    companyId: scopedCompanyId,
    organizationId: scopedCompanyId,
    entryDate: normalizedEntryDate,
    description: description || null,
    referenceType,
    reference_type: referenceType,
    referenceId: referenceId || null,
    reference_id: referenceId || null,
    totalAmount: totalDebits,
    debitTotal: totalDebits,
    creditTotal: totalCredits,
    isBalanced: true,
    isPosted: true,
    metadata,
    createdBy,
    postedBy: createdBy,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    postedAt: FieldValue.serverTimestamp(),
  });

  normalized.forEach((line, index) => {
    const lineRef = db.collection("journalLines").doc();
    tx.set(lineRef, {
      companyId: scopedCompanyId,
      organizationId: scopedCompanyId,
      entryId: journalEntryRef.id,
      journalEntryId: journalEntryRef.id,
      lineNumber: index + 1,
      accountId: line.accountId,
      debit: line.debitAmount,
      credit: line.creditAmount,
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount,
      description: line.description || null,
      entryDate: normalizedEntryDate,
      isPosted: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return journalEntryRef.id;
};

const getAccountBalance = async ({
  accountId,
  organizationId,
  companyId,
  asOfDate = null,
  db = getDb(),
}) => {
  const scopedCompanyId = companyId || organizationId;
  if (!scopedCompanyId) {
    throw new HttpsError("invalid-argument", "organizationId/companyId is required.");
  }
  if (!accountId) {
    throw new HttpsError("invalid-argument", "accountId is required.");
  }

  const account = await getAccountById(scopedCompanyId, accountId, null, db);

  let linesQuery = db
    .collection("journalLines")
    .where("companyId", "==", scopedCompanyId)
    .where("accountId", "==", accountId)
    .where("isPosted", "==", true);

  if (asOfDate) {
    linesQuery = linesQuery.where("entryDate", "<=", formatDateOnly(asOfDate));
  }

  const linesSnap = await linesQuery.get();
  let totalDebits = 0;
  let totalCredits = 0;

  linesSnap.forEach((docSnap) => {
    const line = docSnap.data();
    totalDebits += Number(line.debitAmount ?? line.debit ?? 0);
    totalCredits += Number(line.creditAmount ?? line.credit ?? 0);
  });

  if (account.accountType === "Asset" || account.accountType === "Expense") {
    return normalizeMoney(totalDebits - totalCredits);
  }

  return normalizeMoney(totalCredits - totalDebits);
};

module.exports = {
  SUPPORTED_REFERENCE_TYPES,
  normalizeMoney,
  formatDateOnly,
  isActiveAccount,
  createJournalEntry,
  getAccountBalance,
  getAccountById,
  findAccountByName,
  findAccountByCode,
};
