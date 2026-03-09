/**
 * FINANCIAL REPORTS MODULE
 * 
 * Provides comprehensive financial reporting functionality:
 * - Profit & Loss Statement
 * - Balance Sheet
 * - Cash Flow Analysis
 * - Account Transaction Details
 * - Aging Analysis
 */

const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");

const getDb = () => admin.firestore();

/**
 * Generate Profit & Loss Statement for a period
 */
const getProfitAndLossStatement = async ({
  organizationId,
  companyId,
  startDate,
  endDate,
  db = getDb(),
}) => {
  const scopedCompanyId = companyId || organizationId;
  if (!scopedCompanyId) {
    throw new HttpsError("invalid-argument", "organizationId/companyId is required.");
  }
  if (!startDate || !endDate) {
    throw new HttpsError("invalid-argument", "startDate and endDate are required.");
  }

  const formattedStartDate = formatDateOnly(startDate);
  const formattedEndDate = formatDateOnly(endDate);

  // Fetch Income accounts
  const incomeSnap = await db
    .collection("chartOfAccounts")
    .where("companyId", "==", scopedCompanyId)
    .where("accountType", "==", "Income")
    .where("isActive", "==", true)
    .get();

  // Fetch Expense accounts
  const expenseSnap = await db
    .collection("chartOfAccounts")
    .where("companyId", "==", scopedCompanyId)
    .where("accountType", "==", "Expense")
    .where("isActive", "==", true)
    .get();

  const calculateAccountBalance = async (accountId) => {
    const linesSnap = await db
      .collection("journalLines")
      .where("companyId", "==", scopedCompanyId)
      .where("accountId", "==", accountId)
      .where("isPosted", "==", true)
      .where("entryDate", ">=", formattedStartDate)
      .where("entryDate", "<=", formattedEndDate)
      .get();

    let debits = 0;
    let credits = 0;
    linesSnap.forEach((doc) => {
      const line = doc.data();
      debits += Number(line.debitAmount ?? line.debit ?? 0);
      credits += Number(line.creditAmount ?? line.credit ?? 0);
    });

    return { debits, credits };
  };

  // Calculate income
  const incomes = [];
  let totalIncome = 0;
  for (const doc of incomeSnap.docs) {
    const account = doc.data();
    const { debits, credits } = await calculateAccountBalance(doc.id);
    const balance = normalizeMoney(credits - debits); // Income: credits are positive
    incomes.push({
      code: account.accountCode,
      name: account.accountName,
      amount: balance,
    });
    totalIncome += balance;
  }

  // Calculate expenses
  const expenses = [];
  let totalExpense = 0;
  for (const doc of expenseSnap.docs) {
    const account = doc.data();
    const { debits, credits } = await calculateAccountBalance(doc.id);
    const balance = normalizeMoney(debits - credits); // Expense: debits are positive
    expenses.push({
      code: account.accountCode,
      name: account.accountName,
      amount: balance,
    });
    totalExpense += balance;
  }

  const grossProfit = normalizeMoney(totalIncome);
  const netIncome = normalizeMoney(totalIncome - totalExpense);

  return {
    period: {
      startDate: formattedStartDate,
      endDate: formattedEndDate,
    },
    incomes: incomes.sort((a, b) => (a.code || 0) - (b.code || 0)),
    totalIncome: normalizeMoney(totalIncome),
    expenses: expenses.sort((a, b) => (a.code || 0) - (b.code || 0)),
    totalExpense: normalizeMoney(totalExpense),
    grossProfit,
    netIncome,
  };
};

/**
 * Generate Balance Sheet as of a specific date
 */
const getBalanceSheet = async ({
  organizationId,
  companyId,
  asOfDate,
  db = getDb(),
}) => {
  const scopedCompanyId = companyId || organizationId;
  if (!scopedCompanyId) {
    throw new HttpsError("invalid-argument", "organizationId/companyId is required.");
  }

  const formattedDate = formatDateOnly(asOfDate);

  const fetchAccountsAndCalculateBalance = async (accountType) => {
    const accountsSnap = await db
      .collection("chartOfAccounts")
      .where("companyId", "==", scopedCompanyId)
      .where("accountType", "==", accountType)
      .where("isActive", "==", true)
      .get();

    const accounts = [];
    let total = 0;

    for (const doc of accountsSnap.docs) {
      const account = doc.data();
      const linesSnap = await db
        .collection("journalLines")
        .where("companyId", "==", scopedCompanyId)
        .where("accountId", "==", doc.id)
        .where("isPosted", "==", true)
        .where("entryDate", "<=", formattedDate)
        .get();

      let debits = 0;
      let credits = 0;
      linesSnap.forEach((line) => {
        const data = line.data();
        debits += Number(data.debitAmount ?? data.debit ?? 0);
        credits += Number(data.creditAmount ?? data.credit ?? 0);
      });

      let balance = 0;
      if (accountType === "Asset" || accountType === "Expense") {
        balance = normalizeMoney(debits - credits);
      } else {
        balance = normalizeMoney(credits - debits);
      }

      if (Math.abs(balance) > 0.001) {
        accounts.push({
          code: account.accountCode,
          name: account.accountName,
          balance,
        });
        total += balance;
      }
    }

    return {
      accounts: accounts.sort((a, b) => (a.code || 0) - (b.code || 0)),
      total: normalizeMoney(total),
    };
  };

  const assets = await fetchAccountsAndCalculateBalance("Asset");
  const liabilities = await fetchAccountsAndCalculateBalance("Liability");
  const equity = await fetchAccountsAndCalculateBalance("Equity");
  const income = await fetchAccountsAndCalculateBalance("Income");
  const expense = await fetchAccountsAndCalculateBalance("Expense");

  const netIncome = normalizeMoney(income.total - expense.total);
  const totalEquityAndNI = normalizeMoney(equity.total + netIncome);
  const totalLiabilitiesAndEquity = normalizeMoney(liabilities.total + totalEquityAndNI);

  return {
    asOfDate: formattedDate,
    assets: {
      accounts: assets.accounts,
      total: assets.total,
    },
    liabilities: {
      accounts: liabilities.accounts,
      total: liabilities.total,
    },
    equity: {
      accounts: equity.accounts,
      total: equity.total,
    },
    currentYearIncome: {
      revenue: income.total,
      expenses: expense.total,
      netIncome,
    },
    totalLiabilitiesAndEquity,
    isBalanced: Math.abs(assets.total - totalLiabilitiesAndEquity) < 0.01,
  };
};

/**
 * Get detailed transaction history for an account
 */
const getAccountTransactionHistory = async ({
  organizationId,
  companyId,
  accountId,
  startDate = null,
  endDate = null,
  db = getDb(),
}) => {
  const scopedCompanyId = companyId || organizationId;
  if (!scopedCompanyId || !accountId) {
    throw new HttpsError("invalid-argument", "organizationId/companyId and accountId are required.");
  }

  // Verify account exists and belongs to company
  const accountSnap = await db.collection("chartOfAccounts").doc(accountId).get();
  if (!accountSnap.exists) {
    throw new HttpsError("not-found", "Account not found.");
  }
  const account = accountSnap.data();
  if (account.companyId !== scopedCompanyId) {
    throw new HttpsError("permission-denied", "Account does not belong to this company.");
  }

  let query = db
    .collection("journalLines")
    .where("companyId", "==", scopedCompanyId)
    .where("accountId", "==", accountId)
    .where("isPosted", "==", true);

  if (startDate) {
    query = query.where("entryDate", ">=", formatDateOnly(startDate));
  }
  if (endDate) {
    query = query.where("entryDate", "<=", formatDateOnly(endDate));
  }

  const linesSnap = await query.orderBy("entryDate", "asc").get();

  const transactions = [];
  let runningBalance = 0;

  for (const doc of linesSnap.docs) {
    const line = doc.data();
    const debit = Number(line.debitAmount ?? line.debit ?? 0);
    const credit = Number(line.creditAmount ?? line.credit ?? 0);

    // Calculate running balance based on account type
    if (account.accountType === "Asset" || account.accountType === "Expense") {
      runningBalance += debit - credit;
    } else {
      runningBalance += credit - debit;
    }

    transactions.push({
      date: line.entryDate,
      debit,
      credit,
      description: line.description,
      entryId: line.journalEntryId,
      runningBalance: normalizeMoney(runningBalance),
    });
  }

  return {
    account: {
      id: accountId,
      code: account.accountCode,
      name: account.accountName,
      type: account.accountType,
    },
    transactions,
    finalBalance: normalizeMoney(runningBalance),
  };
};

/**
 * Get accounts receivable aging analysis
 */
const getAccountsReceivableAging = async ({
  organizationId,
  companyId,
  asOfDate,
  db = getDb(),
}) => {
  const scopedCompanyId = companyId || organizationId;
  if (!scopedCompanyId) {
    throw new HttpsError("invalid-argument", "organizationId/companyId is required.");
  }

  const formattedDate = formatDateOnly(asOfDate);
  const currentDate = new Date(formattedDate);

  // Find AR account (typically code 1030 or 1100)
  const arAccountSnap = await db
    .collection("chartOfAccounts")
    .where("companyId", "==", scopedCompanyId)
    .where("accountType", "==", "Asset")
    .where("isActive", "==", true)
    .get();

  const arAccounts = arAccountSnap.docs.filter((doc) => {
    const account = doc.data();
    const name = (account.accountName || "").toLowerCase();
    return name.includes("receivable") || name.includes("ar") || name.includes("customer");
  });

  const agingByCustomer = {};

  for (const arDoc of arAccounts) {
    const linesSnap = await db
      .collection("journalLines")
      .where("companyId", "==", scopedCompanyId)
      .where("accountId", "==", arDoc.id)
      .where("isPosted", "==", true)
      .where("entryDate", "<=", formattedDate)
      .get();

    linesSnap.forEach((lineDoc) => {
      const line = lineDoc.data();
      const entryDate = new Date(line.entryDate);
      const daysDue = Math.floor((currentDate - entryDate) / (1000 * 60 * 60 * 24));
      const description = line.description || "Unknown Customer";

      const amount = line.debitAmount - line.creditAmount;
      if (amount <= 0) return; // Skip credits

      if (!agingByCustomer[description]) {
        agingByCustomer[description] = {
          current: 0,
          days30: 0,
          days60: 0,
          days90: 0,
          over90: 0,
          total: 0,
        };
      }

      if (daysDue <= 30) agingByCustomer[description].current += amount;
      else if (daysDue <= 60) agingByCustomer[description].days30 += amount;
      else if (daysDue <= 90) agingByCustomer[description].days60 += amount;
      else if (daysDue <= 120) agingByCustomer[description].days90 += amount;
      else agingByCustomer[description].over90 += amount;

      agingByCustomer[description].total += amount;
    });
  }

  // Format output
  const aging = Object.entries(agingByCustomer).map(([customer, buckets]) => ({
    customer,
    current: normalizeMoney(buckets.current),
    days30: normalizeMoney(buckets.days30),
    days60: normalizeMoney(buckets.days60),
    days90: normalizeMoney(buckets.days90),
    over90: normalizeMoney(buckets.over90),
    total: normalizeMoney(buckets.total),
  }));

  const summary = {
    current: 0,
    days30: 0,
    days60: 0,
    days90: 0,
    over90: 0,
    total: 0,
  };

  aging.forEach((entry) => {
    summary.current += entry.current;
    summary.days30 += entry.days30;
    summary.days60 += entry.days60;
    summary.days90 += entry.days90;
    summary.over90 += entry.over90;
    summary.total += entry.total;
  });

  return {
    asOfDate: formattedDate,
    byCustomer: aging.sort((a, b) => b.total - a.total),
    summary: {
      current: normalizeMoney(summary.current),
      days30: normalizeMoney(summary.days30),
      days60: normalizeMoney(summary.days60),
      days90: normalizeMoney(summary.days90),
      over90: normalizeMoney(summary.over90),
      total: normalizeMoney(summary.total),
    },
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
  getProfitAndLossStatement,
  getBalanceSheet,
  getAccountTransactionHistory,
  getAccountsReceivableAging,
};
