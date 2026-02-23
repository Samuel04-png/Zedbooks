/**
 * ACCOUNTING UTILITIES MODULE
 * 
 * Comprehensive helper functions for the double-entry accounting system.
 * This module provides:
 * - Trial Balance calculation
 * - Financial statement helpers
 * - Account hierarchy navigation
 * - Batch posting operations
 * - Accounting equation validation
 */

const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");

const getDb = () => admin.firestore();

/**
 * Calculate trial balance for a given company
 * Returns all accounts with their balances as of a specific date
 */
const getTrialBalance = async ({
  organizationId,
  companyId,
  asOfDate = null,
  db = getDb(),
}) => {
  const scopedCompanyId = companyId || organizationId;
  if (!scopedCompanyId) {
    throw new HttpsError("invalid-argument", "organizationId/companyId is required.");
  }

  const ownerFields = ["companyId", "organizationId", "organization_id"];
  const accountsById = new Map();

  // Fetch all accounts for the company
  for (const ownerField of ownerFields) {
    const snapshot = await db
      .collection("chartOfAccounts")
      .where(ownerField, "==", scopedCompanyId)
      .where("isActive", "==", true)
      .limit(2000)
      .get();

    snapshot.docs.forEach((docSnap) => {
      if (!accountsById.has(docSnap.id)) {
        accountsById.set(docSnap.id, {
          id: docSnap.id,
          ...docSnap.data(),
        });
      }
    });
  }

  // Fetch all journal lines
  let linesQuery = db
    .collection("journalLines")
    .where("companyId", "==", scopedCompanyId)
    .where("isPosted", "==", true);

  if (asOfDate) {
    const formattedDate = formatDateOnly(asOfDate);
    linesQuery = linesQuery.where("entryDate", "<=", formattedDate);
  }

  const linesSnap = await linesQuery.get();

  // Calculate balance for each account
  const balances = {};
  linesSnap.forEach((docSnap) => {
    const line = docSnap.data();
    const accountId = line.accountId || line.account_id;
    if (!accountId) return;

    if (!balances[accountId]) {
      balances[accountId] = { debits: 0, credits: 0 };
    }

    balances[accountId].debits += Number(line.debitAmount ?? line.debit ?? 0);
    balances[accountId].credits += Number(line.creditAmount ?? line.credit ?? 0);
  });

  // Build trial balance with account details
  const trialBalance = [];
  let totalDebits = 0;
  let totalCredits = 0;

  for (const [accountId, account] of accountsById) {
    const { debits, credits } = balances[accountId] || { debits: 0, credits: 0 };
    
    let balance = 0;
    if (account.accountType === "Asset" || account.accountType === "Expense") {
      balance = debits - credits;
    } else {
      balance = credits - debits;
    }

    // Only include accounts with activity or balance
    if (Math.abs(balance) > 0.001) {
      trialBalance.push({
        accountId,
        accountCode: account.accountCode || account.code,
        accountName: account.accountName || account.name,
        accountType: account.accountType || account.type,
        debits: normalizeMoney(debits),
        credits: normalizeMoney(credits),
        balance: normalizeMoney(balance),
      });

      totalDebits += debits;
      totalCredits += credits;
    }
  }

  // Sort by account code
  trialBalance.sort((a, b) => (a.accountCode || 0) - (b.accountCode || 0));

  return {
    asOfDate: asOfDate ? formatDateOnly(asOfDate) : new Date().toISOString().slice(0, 10),
    accounts: trialBalance,
    totalDebits: normalizeMoney(totalDebits),
    totalCredits: normalizeMoney(totalCredits),
    isBalanced: Math.abs(normalizeMoney(totalDebits) - normalizeMoney(totalCredits)) < 0.01,
  };
};

/**
 * Calculate accounting equation: Assets = Liabilities + Equity
 * Used to verify the integrity of the accounting system
 */
const getAccountingEquation = async ({
  organizationId,
  companyId,
  asOfDate = null,
  db = getDb(),
}) => {
  const trialBalance = await getTrialBalance({
    organizationId,
    companyId,
    asOfDate,
    db,
  });

  let assets = 0;
  let liabilities = 0;
  let equity = 0;

  trialBalance.accounts.forEach((account) => {
    if (account.accountType === "Asset") {
      assets += account.balance;
    } else if (account.accountType === "Liability") {
      liabilities += account.balance;
    } else if (account.accountType === "Equity") {
      equity += account.balance;
    }
  });

  const leftSide = normalizeMoney(assets);
  const rightSide = normalizeMoney(liabilities + equity);
  const isBalanced = Math.abs(leftSide - rightSide) < 0.01;

  return {
    asOfDate: trialBalance.asOfDate,
    assets: leftSide,
    liabilities: normalizeMoney(liabilities),
    equity: normalizeMoney(equity),
    rightSide,
    isBalanced,
    message: isBalanced
      ? "Accounting equation is balanced"
      : `Imbalance detected: Assets (${leftSide}) != Liabilities + Equity (${rightSide})`,
  };
};

/**
 * Get financial statement summary (P&L and Balance Sheet data)
 */
const getFinancialSummary = async ({
  organizationId,
  companyId,
  startDate = null,
  endDate = null,
  db = getDb(),
}) => {
  const scopedCompanyId = companyId || organizationId;
  if (!scopedCompanyId) {
    throw new HttpsError("invalid-argument", "organizationId/companyId is required.");
  }

  const trialBalance = await getTrialBalance({
    organizationId: scopedCompanyId,
    asOfDate: endDate,
    db,
  });

  let revenue = 0;
  let expenses = 0;
  let assets = 0;
  let liabilities = 0;
  let equity = 0;

  trialBalance.accounts.forEach((account) => {
    const { accountType, balance } = account;
    if (accountType === "Income") revenue += balance;
    else if (accountType === "Expense") expenses += balance;
    else if (accountType === "Asset") assets += balance;
    else if (accountType === "Liability") liabilities += balance;
    else if (accountType === "Equity") equity += balance;
  });

  const netIncome = normalizeMoney(revenue - expenses);
  const totalLiabilitiesAndEquity = normalizeMoney(liabilities + equity + netIncome);

  return {
    asOfDate: trialBalance.asOfDate,
    // Income Statement
    incomeStatement: {
      revenue: normalizeMoney(revenue),
      expenses: normalizeMoney(expenses),
      netIncome,
    },
    // Balance Sheet
    balanceSheet: {
      assets: normalizeMoney(assets),
      liabilities: normalizeMoney(liabilities),
      equity: normalizeMoney(equity),
      totalLiabilitiesAndEquity,
    },
    // Ratios
    ratios: {
      grossProfitRate: revenue !== 0 ? ((revenue - expenses) / revenue * 100).toFixed(2) + "%" : "N/A",
      assetsToLiabilities: liabilities !== 0 ? (assets / liabilities).toFixed(2) : "N/A",
      debtToEquity: equity !== 0 ? (liabilities / equity).toFixed(2) : "N/A",
    },
  };
};

/**
 * Get accounts grouped by type for reporting
 */
const getAccountsByType = async ({
  organizationId,
  companyId,
  db = getDb(),
}) => {
  const scopedCompanyId = companyId || organizationId;
  if (!scopedCompanyId) {
    throw new HttpsError("invalid-argument", "organizationId/companyId is required.");
  }

  const ownerFields = ["companyId", "organizationId", "organization_id"];
  const accountsByType = {
    Asset: [],
    Liability: [],
    Equity: [],
    Income: [],
    Expense: [],
  };

  for (const ownerField of ownerFields) {
    const snapshot = await db
      .collection("chartOfAccounts")
      .where(ownerField, "==", scopedCompanyId)
      .where("isActive", "==", true)
      .limit(2000)
      .get();

    snapshot.docs.forEach((docSnap) => {
      const account = docSnap.data();
      const type = account.accountType || account.type;
      if (accountsByType[type]) {
        accountsByType[type].push({
          id: docSnap.id,
          ...account,
        });
      }
    });
  }

  // Sort each type by account code
  Object.keys(accountsByType).forEach((type) => {
    accountsByType[type].sort((a, b) => (a.accountCode || 0) - (b.accountCode || 0));
  });

  return accountsByType;
};

/**
 * Validate that all journal entries are in balance
 */
const validateAllJournalEntries = async ({
  organizationId,
  companyId,
  db = getDb(),
}) => {
  const scopedCompanyId = companyId || organizationId;
  if (!scopedCompanyId) {
    throw new HttpsError("invalid-argument", "organizationId/companyId is required.");
  }

  const entriesSnap = await db
    .collection("journalEntries")
    .where("companyId", "==", scopedCompanyId)
    .where("isPosted", "==", true)
    .get();

  const imbalancedEntries = [];
  const EPSILON = 0.01;

  for (const docSnap of entriesSnap.docs) {
    const entry = docSnap.data();
    const entryId = docSnap.id;

    const linesSnap = await db
      .collection("journalLines")
      .where("journalEntryId", "==", entryId)
      .get();

    let totalDebits = 0;
    let totalCredits = 0;

    linesSnap.forEach((lineSnap) => {
      const line = lineSnap.data();
      totalDebits += Number(line.debitAmount ?? line.debit ?? 0);
      totalCredits += Number(line.creditAmount ?? line.credit ?? 0);
    });

    const balance = normalizeMoney(totalDebits - totalCredits);
    if (Math.abs(balance) > EPSILON) {
      imbalancedEntries.push({
        entryId,
        date: entry.date || entry.entryDate,
        description: entry.description,
        totalDebits: normalizeMoney(totalDebits),
        totalCredits: normalizeMoney(totalCredits),
        imbalance: balance,
      });
    }
  }

  return {
    totalEntriesChecked: entriesSnap.size,
    imbalancedCount: imbalancedEntries.length,
    isAllBalanced: imbalancedEntries.length === 0,
    imbalancedEntries,
  };
};

/**
 * Helper function: normalize money to 2 decimal places
 */
const normalizeMoney = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
};

/**
 * Helper function: format date to YYYY-MM-DD
 */
const formatDateOnly = (value) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpsError("invalid-argument", "Invalid date value.");
  }
  return date.toISOString().slice(0, 10);
};

module.exports = {
  getTrialBalance,
  getAccountingEquation,
  getFinancialSummary,
  getAccountsByType,
  validateAllJournalEntries,
  normalizeMoney,
  formatDateOnly,
};
