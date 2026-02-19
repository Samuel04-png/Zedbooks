const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const {
  normalizeMoney,
  formatDateOnly,
  isActiveAccount,
  createJournalEntry,
  getAccountById,
  findAccountByName,
  findAccountByCode,
} = require("./accountingPostingService");

const DEFAULT_CHART_OF_ACCOUNTS = [
  // Assets
  { code: 1000, name: "Cash", type: "Asset", parentName: null },
  { code: 1010, name: "Bank Accounts", type: "Asset", parentName: null },
  { code: 1011, name: "Bank - StanChart", type: "Asset", parentName: "Bank Accounts" },
  { code: 1012, name: "Bank - Zanaco", type: "Asset", parentName: "Bank Accounts" },
  { code: 1013, name: "Bank - Default", type: "Asset", parentName: "Bank Accounts" },
  { code: 1020, name: "Mobile Money", type: "Asset", parentName: null },
  { code: 1021, name: "Airtel Money", type: "Asset", parentName: "Mobile Money" },
  { code: 1022, name: "MTN Money", type: "Asset", parentName: "Mobile Money" },
  { code: 1030, name: "Accounts Receivable", type: "Asset", parentName: null },
  { code: 1040, name: "Inventory", type: "Asset", parentName: null },
  { code: 1050, name: "Equipment", type: "Asset", parentName: null },
  { code: 1060, name: "Vehicles", type: "Asset", parentName: null },
  { code: 1070, name: "Prepaid Expenses", type: "Asset", parentName: null },
  // Liabilities
  { code: 2000, name: "Accounts Payable", type: "Liability", parentName: null },
  { code: 2010, name: "Salaries Payable", type: "Liability", parentName: null },
  { code: 2020, name: "Loan Payable", type: "Liability", parentName: null },
  { code: 2030, name: "Tax Payable", type: "Liability", parentName: null },
  { code: 2031, name: "PAYE Payable", type: "Liability", parentName: "Tax Payable" },
  { code: 2032, name: "NAPSA Payable", type: "Liability", parentName: "Tax Payable" },
  { code: 2033, name: "NHIMA Payable", type: "Liability", parentName: "Tax Payable" },
  // Equity
  { code: 3000, name: "Owner Capital", type: "Equity", parentName: null },
  { code: 3010, name: "Retained Earnings", type: "Equity", parentName: null },
  { code: 3020, name: "Owner Drawings", type: "Equity", parentName: null },
  // Income
  { code: 4000, name: "Sales Revenue", type: "Income", parentName: null },
  { code: 4010, name: "Service Revenue", type: "Income", parentName: null },
  { code: 4020, name: "Consulting Income", type: "Income", parentName: null },
  { code: 4030, name: "Project Income", type: "Income", parentName: null },
  { code: 4040, name: "Training Income", type: "Income", parentName: null },
  { code: 4050, name: "Product Sales", type: "Income", parentName: null },
  { code: 4060, name: "Wholesale Sales", type: "Income", parentName: null },
  { code: 4070, name: "Retail Sales", type: "Income", parentName: null },
  { code: 4080, name: "Professional Service Income", type: "Income", parentName: null },
  { code: 4090, name: "Installation Income", type: "Income", parentName: null },
  { code: 4100, name: "Maintenance Income", type: "Income", parentName: null },
  { code: 4110, name: "Subscription Income", type: "Income", parentName: null },
  { code: 4120, name: "Tuition Fees Income", type: "Income", parentName: null },
  { code: 4130, name: "Registration Fees", type: "Income", parentName: null },
  { code: 4140, name: "Exam Fees", type: "Income", parentName: null },
  { code: 4150, name: "Hostel Fees", type: "Income", parentName: null },
  { code: 4160, name: "Software Sales", type: "Income", parentName: null },
  { code: 4170, name: "Licensing Income", type: "Income", parentName: null },
  { code: 4180, name: "Support & Maintenance Income", type: "Income", parentName: null },
  { code: 4190, name: "Commission Income", type: "Income", parentName: null },
  { code: 4200, name: "Rental Income", type: "Income", parentName: null },
  { code: 4210, name: "Interest Income", type: "Income", parentName: null },
  { code: 4220, name: "Miscellaneous Income", type: "Income", parentName: null },
  // Expenses
  { code: 5000, name: "Fuel Expense", type: "Expense", parentName: null },
  { code: 5001, name: "Transport Expense", type: "Expense", parentName: null },
  { code: 5002, name: "Travel Expense", type: "Expense", parentName: null },
  { code: 5003, name: "Vehicle Maintenance", type: "Expense", parentName: null },
  { code: 5004, name: "Motor Vehicle Insurance", type: "Expense", parentName: null },
  { code: 5005, name: "Parking Fees", type: "Expense", parentName: null },
  { code: 5010, name: "Electricity Expense", type: "Expense", parentName: null },
  { code: 5011, name: "Water Expense", type: "Expense", parentName: null },
  { code: 5012, name: "Internet Expense", type: "Expense", parentName: null },
  { code: 5013, name: "Telephone Expense", type: "Expense", parentName: null },
  { code: 5014, name: "Airtime Expense", type: "Expense", parentName: null },
  { code: 5020, name: "Stationery Expense", type: "Expense", parentName: null },
  { code: 5021, name: "Printing & Photocopying", type: "Expense", parentName: null },
  { code: 5022, name: "Office Supplies", type: "Expense", parentName: null },
  { code: 5023, name: "Office Cleaning", type: "Expense", parentName: null },
  { code: 5024, name: "Office Maintenance", type: "Expense", parentName: null },
  { code: 5030, name: "Rent Expense", type: "Expense", parentName: null },
  { code: 5031, name: "Building Maintenance", type: "Expense", parentName: null },
  { code: 5032, name: "Security Services", type: "Expense", parentName: null },
  { code: 5040, name: "Salaries Expense", type: "Expense", parentName: null },
  { code: 5041, name: "Staff Welfare", type: "Expense", parentName: null },
  { code: 5042, name: "Staff Training", type: "Expense", parentName: null },
  { code: 5043, name: "Staff Transport Allowance", type: "Expense", parentName: null },
  { code: 5044, name: "Staff Meals", type: "Expense", parentName: null },
  { code: 5045, name: "Overtime Expense", type: "Expense", parentName: null },
  { code: 5050, name: "Advertising Expense", type: "Expense", parentName: null },
  { code: 5051, name: "Marketing Expense", type: "Expense", parentName: null },
  { code: 5052, name: "Promotion Expense", type: "Expense", parentName: null },
  { code: 5053, name: "Branding & Design", type: "Expense", parentName: null },
  { code: 5060, name: "Legal Fees", type: "Expense", parentName: null },
  { code: 5061, name: "Accounting Fees", type: "Expense", parentName: null },
  { code: 5062, name: "Consultancy Fees", type: "Expense", parentName: null },
  { code: 5063, name: "Audit Fees", type: "Expense", parentName: null },
  { code: 5070, name: "Software Subscriptions", type: "Expense", parentName: null },
  { code: 5071, name: "Website Hosting", type: "Expense", parentName: null },
  { code: 5072, name: "Domain Renewal", type: "Expense", parentName: null },
  { code: 5073, name: "IT Support", type: "Expense", parentName: null },
  { code: 5080, name: "Bank Charges", type: "Expense", parentName: null },
  { code: 5081, name: "Loan Interest Expense", type: "Expense", parentName: null },
  { code: 5082, name: "Transaction Fees", type: "Expense", parentName: null },
  { code: 5083, name: "Mobile Money Charges", type: "Expense", parentName: null },
  { code: 5090, name: "Inventory Purchases", type: "Expense", parentName: null },
  { code: 5091, name: "Packaging Materials", type: "Expense", parentName: null },
  { code: 5092, name: "Delivery Costs", type: "Expense", parentName: null },
  { code: 5093, name: "Courier Services", type: "Expense", parentName: null },
  { code: 5100, name: "Licenses & Permits", type: "Expense", parentName: null },
  { code: 5101, name: "Regulatory Fees", type: "Expense", parentName: null },
  { code: 5102, name: "Penalties & Fines", type: "Expense", parentName: null },
  { code: 5110, name: "Miscellaneous Expense", type: "Expense", parentName: null },
];

const DEFAULT_EXPENSE_CATEGORY_MAPPINGS = [
  ["Fuel", 5000],
  ["Transport", 5001],
  ["Travel", 5002],
  ["Vehicle Maintenance", 5003],
  ["Motor Vehicle Ins", 5004],
  ["Parking", 5005],
  ["Electricity", 5010],
  ["Water", 5011],
  ["Internet", 5012],
  ["Telephone", 5013],
  ["Airtime", 5014],
  ["Stationery", 5020],
  ["Printing", 5021],
  ["Office Supplies", 5022],
  ["Office Cleaning", 5023],
  ["Office Maintenance", 5024],
  ["Rent", 5030],
  ["Building Maintenance", 5031],
  ["Security", 5032],
  ["Staff Welfare", 5041],
  ["Staff Training", 5042],
  ["Staff Transport", 5043],
  ["Staff Meals", 5044],
  ["Overtime", 5045],
  ["Advertising", 5050],
  ["Marketing", 5051],
  ["Promotion", 5052],
  ["Branding & Design", 5053],
  ["Legal Fees", 5060],
  ["Accounting Fees", 5061],
  ["Consultancy", 5062],
  ["Audit Fees", 5063],
  ["Software", 5070],
  ["Website Hosting", 5071],
  ["Domain Renewal", 5072],
  ["IT Support", 5073],
  ["Bank Charges", 5080],
  ["Loan Interest", 5081],
  ["Transaction Fees", 5082],
  ["Mobile Money Charges", 5083],
  ["Inventory", 5090],
  ["Packaging", 5091],
  ["Delivery", 5092],
  ["Courier", 5093],
  ["Licenses & Permits", 5100],
  ["Regulatory Fees", 5101],
  ["Fines & Penalties", 5102],
  ["Miscellaneous", 5110],
];

const CASH_AND_BANK_ACCOUNT_NAMES = [
  "Cash",
  "Bank - Default",
  "Bank - StanChart",
  "Bank - Zanaco",
  "Airtel Money",
  "MTN Money",
];

const slugify = (value) => String(value || "")
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

const getDb = (db) => db || admin.firestore();

const getAccountDocIdByCode = (companyId, accountCode) => `${companyId}_${Number(accountCode)}`;

const isEntryDateWithinRange = (dateValue, startDate, endDate) => {
  if (!dateValue) return false;
  if (startDate && dateValue < startDate) return false;
  if (endDate && dateValue > endDate) return false;
  return true;
};

const toIsoTimestamp = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return null;
};

const isLockedStatus = (status) => {
  if (!status) return false;
  return ["locked", "closed"].includes(String(status).toLowerCase());
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

const assertPositiveAmount = (value, fieldName) => {
  const amount = normalizeMoney(value);
  if (amount <= 0) {
    throw new HttpsError("invalid-argument", `${fieldName} must be greater than zero.`);
  }
  return amount;
};

const assertAssetPaymentAccount = async (tx, db, companyId, accountId) => {
  const account = await getAccountById(companyId, accountId, tx, db);
  if (String(account.accountType || "").toLowerCase() !== "asset") {
    throw new HttpsError("failed-precondition", "Payment account must be an active Asset account.");
  }
  return account;
};

const resolveSystemAccount = async ({
  companyId,
  names,
  fallbackCode,
  db,
  requiredType = null,
}) => {
  let account = await findAccountByName(companyId, names, db);
  if (!account && fallbackCode != null) {
    account = await findAccountByCode(companyId, fallbackCode, db);
  }
  if (!account) {
    throw new HttpsError(
      "failed-precondition",
      `Required account not configured: ${names[0] || fallbackCode}.`,
    );
  }
  if (requiredType && account.accountType !== requiredType) {
    throw new HttpsError(
      "failed-precondition",
      `Account ${account.accountName} must be of type ${requiredType}.`,
    );
  }
  return account;
};

const getCategoryMappingByIdOrName = async (tx, db, companyId, input) => {
  const categoryId = String(input.categoryId || input.category_id || "").trim();
  const categoryName = String(input.categoryName || input.category_name || input.category || "").trim();

  if (categoryId) {
    const categoryRef = db.collection("expenseCategoryMappings").doc(categoryId);
    const categorySnap = await tx.get(categoryRef);
    if (!categorySnap.exists) {
      throw new HttpsError("not-found", "Expense category not found.");
    }
    const category = categorySnap.data();
    const owner = category.companyId || category.organizationId;
    if (owner !== companyId) {
      throw new HttpsError("permission-denied", "Category does not belong to this organization.");
    }
    if (category.isActive === false || category.status === "inactive") {
      throw new HttpsError("failed-precondition", "Expense category is inactive.");
    }

    return { id: categorySnap.id, ...category };
  }

  if (!categoryName) {
    throw new HttpsError("invalid-argument", "categoryId/categoryName is required.");
  }

  const categoryQuery = db
    .collection("expenseCategoryMappings")
    .where("companyId", "==", companyId)
    .where("categoryName", "==", categoryName)
    .limit(1);
  const categorySnap = await tx.get(categoryQuery);
  if (categorySnap.empty) {
    throw new HttpsError("not-found", `Expense category '${categoryName}' not found.`);
  }

  const docSnap = categorySnap.docs[0];
  const category = docSnap.data();
  if (category.isActive === false || category.status === "inactive") {
    throw new HttpsError("failed-precondition", "Expense category is inactive.");
  }

  return { id: docSnap.id, ...category };
};

const resolveExpenseAccountId = async (tx, db, companyId, category) => {
  const linkedAccountId = category.linkedExpenseAccountId || category.linked_expense_account_id || category.accountId;
  if (linkedAccountId) {
    const account = await getAccountById(companyId, String(linkedAccountId), tx, db);
    return account.id;
  }

  if (category.accountCode) {
    const codeAccount = await findAccountByCode(companyId, category.accountCode, db);
    if (codeAccount) return codeAccount.id;
  }

  const fallback = await findAccountByName(companyId, ["Miscellaneous Expense"], db);
  if (!fallback) {
    throw new HttpsError("failed-precondition", "No linked expense account configured for category.");
  }

  return fallback.id;
};

const adjustLinkedBankAccountBalance = async ({
  tx,
  db,
  companyId,
  paymentAccountId,
  deltaAmount,
}) => {
  const queries = [
    db.collection("bankAccounts")
      .where("companyId", "==", companyId)
      .where("chartAccountId", "==", paymentAccountId)
      .limit(1),
    db.collection("bankAccounts")
      .where("companyId", "==", companyId)
      .where("glAccountId", "==", paymentAccountId)
      .limit(1),
  ];

  for (const bankQuery of queries) {
    const bankSnap = await tx.get(bankQuery);
    if (!bankSnap.empty) {
      const bankDoc = bankSnap.docs[0];
      const bank = bankDoc.data();
      const currentBalance = Number(bank.currentBalance ?? bank.current_balance ?? 0);
      tx.update(bankDoc.ref, {
        currentBalance: normalizeMoney(currentBalance + deltaAmount),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }
  }

  const directDoc = db.collection("bankAccounts").doc(paymentAccountId);
  const directSnap = await tx.get(directDoc);
  if (directSnap.exists) {
    const bank = directSnap.data();
    const currentBalance = Number(bank.currentBalance ?? bank.current_balance ?? 0);
    tx.update(directDoc, {
      currentBalance: normalizeMoney(currentBalance + deltaAmount),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
};

const createBankTransaction = ({
  tx,
  db,
  companyId,
  accountId,
  amount,
  transactionDate,
  direction,
  description,
  referenceType,
  referenceId,
  createdBy,
}) => {
  const ref = db.collection("bankTransactions").doc();
  tx.set(ref, {
    companyId,
    organizationId: companyId,
    accountId,
    amount: normalizeMoney(amount),
    transactionDate: formatDateOnly(transactionDate),
    direction,
    description: description || null,
    referenceType,
    referenceId,
    isReconciled: false,
    createdBy,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
};

const updateCounterDocument = async ({
  tx,
  db,
  collectionName,
  docId,
  companyId,
  increments,
  userId,
}) => {
  const ref = db.collection(collectionName).doc(docId);
  const snap = await tx.get(ref);
  if (!snap.exists) return false;

  const row = snap.data();
  const owner = row.companyId || row.organizationId;
  if (owner !== companyId) return false;

  const payload = {
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: userId,
    updated_by: userId,
  };

  Object.entries(increments).forEach(([key, value]) => {
    if (!value) return;
    payload[key] = FieldValue.increment(value);
  });

  tx.set(ref, payload, { merge: true });
  return true;
};

const findInventoryItemByProductId = async ({
  tx,
  db,
  companyId,
  productId,
}) => {
  const directRef = db.collection("inventoryItems").doc(productId);
  const directSnap = await tx.get(directRef);
  if (directSnap.exists) {
    const row = directSnap.data();
    const owner = row.companyId || row.organizationId;
    if (owner === companyId) {
      return { ref: directRef, data: row };
    }
  }

  const inventoryQueries = [
    db.collection("inventoryItems")
      .where("companyId", "==", companyId)
      .where("productId", "==", productId)
      .limit(1),
    db.collection("inventoryItems")
      .where("companyId", "==", companyId)
      .where("product_id", "==", productId)
      .limit(1),
    db.collection("inventoryItems")
      .where("companyId", "==", companyId)
      .where("itemId", "==", productId)
      .limit(1),
  ];

  for (const inventoryQuery of inventoryQueries) {
    const snap = await tx.get(inventoryQuery);
    if (!snap.empty) {
      return { ref: snap.docs[0].ref, data: snap.docs[0].data() };
    }
  }

  return null;
};

const resolveProductIdForInvoiceLine = async ({
  tx,
  db,
  companyId,
  lineItem,
}) => {
  const explicitProductId = String(
    lineItem.productId
      || lineItem.product_id
      || lineItem.inventoryItemId
      || lineItem.inventory_item_id
      || "",
  ).trim();
  if (explicitProductId) {
    return explicitProductId;
  }

  const description = String(lineItem.description || "").trim();
  if (!description) return null;

  const productSnap = await tx.get(
    db.collection("products")
      .where("companyId", "==", companyId)
      .where("name", "==", description)
      .limit(1),
  );
  if (productSnap.empty) return null;

  return productSnap.docs[0].id;
};

const adjustInventoryForInvoiceLineItems = async ({
  tx,
  db,
  companyId,
  userId,
  invoiceId,
  invoiceDate,
  lineItems,
}) => {
  for (const item of lineItems) {
    const quantity = normalizeMoney(Number(item.quantity ?? 1));
    if (quantity <= 0) continue;

    const productId = await resolveProductIdForInvoiceLine({
      tx,
      db,
      companyId,
      lineItem: item,
    });
    if (!productId) continue;

    const inventoryItem = await findInventoryItemByProductId({
      tx,
      db,
      companyId,
      productId,
    });
    if (!inventoryItem) {
      throw new HttpsError(
        "failed-precondition",
        `Inventory item not found for product ${productId}.`,
      );
    }

    const currentQty = Number(
      inventoryItem.data.currentQuantity
      ?? inventoryItem.data.current_quantity
      ?? inventoryItem.data.quantityOnHand
      ?? inventoryItem.data.quantity_on_hand
      ?? inventoryItem.data.quantity
      ?? inventoryItem.data.stockOnHand
      ?? 0,
    );
    const newQty = normalizeMoney(currentQty - quantity);

    tx.set(inventoryItem.ref, {
      currentQuantity: newQty,
      current_quantity: newQty,
      quantityOnHand: newQty,
      quantity_on_hand: newQty,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
      updated_by: userId,
    }, { merge: true });

    const movementRef = db.collection("stockMovements").doc();
    tx.set(movementRef, {
      companyId,
      organizationId: companyId,
      inventoryItemId: inventoryItem.ref.id,
      productId,
      quantity,
      direction: "outflow",
      movementType: "issue",
      movementDate: formatDateOnly(invoiceDate),
      referenceType: "Invoice",
      referenceId: invoiceId,
      description: `Invoice stock issue - ${item.description || productId}`,
      createdBy: userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
};

const generateInvoiceNumber = () => {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const nonce = String(now.getTime()).slice(-6);
  return `INV-${stamp}-${nonce}`;
};

const generateQuotationNumber = () => {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const nonce = String(now.getTime()).slice(-6);
  return `QTN-${stamp}-${nonce}`;
};

const upsertAccountDoc = (batch, db, companyId, row) => {
  const docId = getAccountDocIdByCode(companyId, row.code);
  const ref = db.collection("chartOfAccounts").doc(docId);

  batch.set(ref, {
    companyId,
    organizationId: companyId,
    accountCode: row.code,
    accountName: row.name,
    accountType: row.type,
    parentAccountCode: row.parentCode || null,
    status: "active",
    isActive: true,
    isSystem: true,
    isSystemAccount: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
};

const createAuditLog = (batch, db, companyId, userId, action, details = {}) => {
  const logRef = db.collection("auditLogs").doc();
  batch.set(logRef, {
    companyId,
    organizationId: companyId,
    actorUid: userId,
    action,
    details,
    createdAt: FieldValue.serverTimestamp(),
  });
};

const seedDefaultChartOfAccounts = async ({ companyId, userId, db: dbArg }) => {
  if (!companyId) {
    throw new HttpsError("invalid-argument", "companyId is required.");
  }
  const db = getDb(dbArg);
  const batch = db.batch();

  const accountByName = new Map(DEFAULT_CHART_OF_ACCOUNTS.map((row) => [row.name, row]));
  DEFAULT_CHART_OF_ACCOUNTS.forEach((row) => {
    if (row.parentName) {
      const parent = accountByName.get(row.parentName);
      if (parent) {
        row.parentCode = parent.code;
      }
    }
    upsertAccountDoc(batch, db, companyId, row);
  });

  DEFAULT_CHART_OF_ACCOUNTS.forEach((row) => {
    if (!row.parentCode) return;
    const childRef = db.collection("chartOfAccounts").doc(getAccountDocIdByCode(companyId, row.code));
    const parentDocId = getAccountDocIdByCode(companyId, row.parentCode);
    batch.set(childRef, {
      parentAccountId: parentDocId,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  if (userId) {
    createAuditLog(batch, db, companyId, userId, "chart_of_accounts_seeded", {
      accountsSeeded: DEFAULT_CHART_OF_ACCOUNTS.length,
    });
  }

  await batch.commit();

  return {
    success: true,
    accountsSeeded: DEFAULT_CHART_OF_ACCOUNTS.length,
  };
};

const seedDefaultExpenseCategories = async ({ companyId, userId, db: dbArg }) => {
  if (!companyId) {
    throw new HttpsError("invalid-argument", "companyId is required.");
  }
  const db = getDb(dbArg);
  const batch = db.batch();

  for (const [categoryName, accountCode] of DEFAULT_EXPENSE_CATEGORY_MAPPINGS) {
    const accountDocId = getAccountDocIdByCode(companyId, accountCode);
    const accountRef = db.collection("chartOfAccounts").doc(accountDocId);
    const accountSnap = await accountRef.get();
    if (!accountSnap.exists) {
      throw new HttpsError(
        "failed-precondition",
        `Expense account ${accountCode} missing. Seed chart of accounts first.`,
      );
    }

    const categoryId = `${companyId}_${slugify(categoryName)}`;
    const mappingRef = db.collection("expenseCategoryMappings").doc(categoryId);
    batch.set(mappingRef, {
      companyId,
      organizationId: companyId,
      categoryName,
      linkedExpenseAccountId: accountDocId,
      linked_expense_account_id: accountDocId,
      accountId: accountDocId,
      accountCode,
      isActive: true,
      status: "active",
      createdBy: userId || null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  if (userId) {
    createAuditLog(batch, db, companyId, userId, "expense_categories_seeded", {
      categoriesSeeded: DEFAULT_EXPENSE_CATEGORY_MAPPINGS.length,
    });
  }

  await batch.commit();

  return {
    success: true,
    categoriesSeeded: DEFAULT_EXPENSE_CATEGORY_MAPPINGS.length,
  };
};

const recordExpense = async ({
  data,
  userId,
  companyId,
  db: dbArg,
}) => {
  const db = getDb(dbArg);
  const amount = assertPositiveAmount(data.amount, "Expense amount");
  const paymentMethod = String(data.paymentMethod || data.payment_method || "Cash");
  const paymentAccountId = String(data.paymentAccountId || data.payment_account_id || "").trim();
  if (!paymentAccountId) {
    throw new HttpsError("invalid-argument", "paymentAccountId is required.");
  }

  const expenseDate = formatDateOnly(data.expenseDate || data.expense_date || new Date().toISOString());

  return db.runTransaction(async (tx) => {
    await assertPeriodUnlocked(tx, companyId, expenseDate, db);

    const category = await getCategoryMappingByIdOrName(tx, db, companyId, data);
    const expenseAccountId = await resolveExpenseAccountId(tx, db, companyId, category);
    await assertAssetPaymentAccount(tx, db, companyId, paymentAccountId);

    const expenseRef = db.collection("expenses").doc();
    tx.set(expenseRef, {
      companyId,
      organizationId: companyId,
      amount,
      categoryId: category.id,
      category_id: category.id,
      categoryName: category.categoryName,
      category: category.categoryName,
      paymentMethod,
      payment_method: paymentMethod,
      paymentAccountId,
      payment_account_id: paymentAccountId,
      expenseDate,
      expense_date: expenseDate,
      description: data.description || null,
      receiptUrl: data.receiptUrl || data.receipt_url || null,
      receipt_url: data.receiptUrl || data.receipt_url || null,
      journalEntryId: null,
      journal_entry_id: null,
      createdBy: userId,
      created_by: userId,
      updatedBy: userId,
      updated_by: userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const journalEntryId = await createJournalEntry({
      companyId,
      entryDate: expenseDate,
      description: `Expense: ${category.categoryName}${data.description ? ` - ${data.description}` : ""}`,
      referenceType: "Expense",
      referenceId: expenseRef.id,
      lines: [
        {
          accountId: expenseAccountId,
          debitAmount: amount,
          creditAmount: 0,
          description: `${category.categoryName} expense`,
        },
        {
          accountId: paymentAccountId,
          debitAmount: 0,
          creditAmount: amount,
          description: `Paid via ${paymentMethod}`,
        },
      ],
      createdBy: userId,
      db,
      tx,
    });

    tx.update(expenseRef, {
      journalEntryId,
      journal_entry_id: journalEntryId,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
      updated_by: userId,
    });

    createBankTransaction({
      tx,
      db,
      companyId,
      accountId: paymentAccountId,
      amount,
      transactionDate: expenseDate,
      direction: "outflow",
      description: data.description || `Expense payment - ${category.categoryName}`,
      referenceType: "Expense",
      referenceId: expenseRef.id,
      createdBy: userId,
    });

    await adjustLinkedBankAccountBalance({
      tx,
      db,
      companyId,
      paymentAccountId,
      deltaAmount: -amount,
    });

    return { expenseId: expenseRef.id, journalEntryId };
  });
};

const createBill = async ({ data, userId, companyId, db: dbArg }) => {
  const db = getDb(dbArg);
  const amount = assertPositiveAmount(data.amount, "Bill amount");
  const billDate = formatDateOnly(data.billDate || data.bill_date || new Date().toISOString());
  const dueDate = formatDateOnly(data.dueDate || data.due_date || billDate);

  return db.runTransaction(async (tx) => {
    await assertPeriodUnlocked(tx, companyId, billDate, db);

    const category = await getCategoryMappingByIdOrName(tx, db, companyId, data);
    const expenseAccountId = await resolveExpenseAccountId(tx, db, companyId, category);
    const vendorEntityId = String(
      data.vendorId || data.vendor_id || data.supplierId || data.supplier_id || "",
    ).trim() || null;
    const apAccount = await resolveSystemAccount({
      companyId,
      names: ["Accounts Payable"],
      fallbackCode: 2000,
      db,
      requiredType: "Liability",
    });

    const billRef = db.collection("bills").doc();
    tx.set(billRef, {
      companyId,
      organizationId: companyId,
      supplierId: vendorEntityId,
      vendorId: vendorEntityId,
      amount,
      total: amount,
      amountPaid: 0,
      amount_paid: 0,
      categoryId: category.id,
      category_id: category.id,
      categoryName: category.categoryName,
      billDate,
      bill_date: billDate,
      dueDate,
      due_date: dueDate,
      description: data.description || null,
      status: "Unpaid",
      documentUrl: data.documentUrl || data.document_url || null,
      journalEntryId: null,
      journal_entry_id: null,
      createdBy: userId,
      created_by: userId,
      updatedBy: userId,
      updated_by: userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const journalEntryId = await createJournalEntry({
      companyId,
      entryDate: billDate,
      description: `Bill: ${data.description || "Supplier Bill"}`,
      referenceType: "Bill",
      referenceId: billRef.id,
      lines: [
        {
          accountId: expenseAccountId,
          debitAmount: amount,
          creditAmount: 0,
          description: "Bill expense recorded",
        },
        {
          accountId: apAccount.id,
          debitAmount: 0,
          creditAmount: amount,
          description: "Accounts payable created",
        },
      ],
      createdBy: userId,
      db,
      tx,
    });

    tx.update(billRef, {
      journalEntryId,
      journal_entry_id: journalEntryId,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
      updated_by: userId,
    });

    if (vendorEntityId) {
      await updateCounterDocument({
        tx,
        db,
        collectionName: "vendors",
        docId: vendorEntityId,
        companyId,
        userId,
        increments: {
          totalBilled: amount,
          total_billed: amount,
          outstandingPayables: amount,
          outstanding_payables: amount,
        },
      });
    }

    return { billId: billRef.id, journalEntryId };
  });
};

const payBill = async ({ data, userId, companyId, db: dbArg }) => {
  const db = getDb(dbArg);
  const paymentAmount = assertPositiveAmount(data.amount, "Bill payment amount");
  const paymentDate = formatDateOnly(data.paymentDate || data.payment_date || new Date().toISOString());
  const paymentAccountId = String(data.paymentAccountId || data.payment_account_id || "").trim();

  if (!paymentAccountId) {
    throw new HttpsError("invalid-argument", "paymentAccountId is required.");
  }

  const billId = String(data.billId || data.bill_id || "").trim();
  if (!billId) {
    throw new HttpsError("invalid-argument", "billId is required.");
  }

  return db.runTransaction(async (tx) => {
    await assertPeriodUnlocked(tx, companyId, paymentDate, db);

    const billRef = db.collection("bills").doc(billId);
    const billSnap = await tx.get(billRef);
    if (!billSnap.exists) {
      throw new HttpsError("not-found", "Bill not found.");
    }

    const bill = billSnap.data();
    const owner = bill.companyId || bill.organizationId;
    if (owner !== companyId) {
      throw new HttpsError("permission-denied", "Bill does not belong to this organization.");
    }
    const vendorEntityId = String(
      bill.vendorId || bill.vendor_id || bill.supplierId || bill.supplier_id || "",
    ).trim() || null;

    const billTotal = Number(bill.amount ?? bill.total ?? 0);
    const amountPaid = Number(bill.amountPaid ?? bill.amount_paid ?? 0);
    const remaining = normalizeMoney(billTotal - amountPaid);
    if (paymentAmount - remaining > 0.001) {
      throw new HttpsError(
        "invalid-argument",
        `Payment amount exceeds outstanding balance of ${remaining}.`,
      );
    }

    await assertAssetPaymentAccount(tx, db, companyId, paymentAccountId);
    const apAccount = await resolveSystemAccount({
      companyId,
      names: ["Accounts Payable"],
      fallbackCode: 2000,
      db,
      requiredType: "Liability",
    });

    const paymentRef = db.collection("billPayments").doc();
    tx.set(paymentRef, {
      companyId,
      organizationId: companyId,
      billId,
      bill_id: billId,
      amount: paymentAmount,
      paymentDate,
      payment_date: paymentDate,
      paymentAccountId,
      payment_account_id: paymentAccountId,
      notes: data.notes || null,
      journalEntryId: null,
      journal_entry_id: null,
      createdBy: userId,
      created_by: userId,
      createdAt: FieldValue.serverTimestamp(),
    });

    const journalEntryId = await createJournalEntry({
      companyId,
      entryDate: paymentDate,
      description: `Bill Payment: ${data.notes || bill.description || billId}`,
      referenceType: "BillPayment",
      referenceId: paymentRef.id,
      lines: [
        {
          accountId: apAccount.id,
          debitAmount: paymentAmount,
          creditAmount: 0,
          description: "Accounts payable settled",
        },
        {
          accountId: paymentAccountId,
          debitAmount: 0,
          creditAmount: paymentAmount,
          description: "Bill payment outflow",
        },
      ],
      createdBy: userId,
      db,
      tx,
    });

    tx.update(paymentRef, {
      journalEntryId,
      journal_entry_id: journalEntryId,
    });

    const newAmountPaid = normalizeMoney(amountPaid + paymentAmount);
    let newStatus = "Partially Paid";
    if (newAmountPaid >= billTotal - 0.001) {
      newStatus = "Paid";
    } else if (String(bill.dueDate || bill.due_date || "") < new Date().toISOString().slice(0, 10)) {
      newStatus = "Overdue";
    }

    tx.update(billRef, {
      amountPaid: newAmountPaid,
      amount_paid: newAmountPaid,
      status: newStatus,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
      updated_by: userId,
    });

    createBankTransaction({
      tx,
      db,
      companyId,
      accountId: paymentAccountId,
      amount: paymentAmount,
      transactionDate: paymentDate,
      direction: "outflow",
      description: data.notes || `Bill payment ${billId}`,
      referenceType: "BillPayment",
      referenceId: paymentRef.id,
      createdBy: userId,
    });

    await adjustLinkedBankAccountBalance({
      tx,
      db,
      companyId,
      paymentAccountId,
      deltaAmount: -paymentAmount,
    });

    if (vendorEntityId) {
      await updateCounterDocument({
        tx,
        db,
        collectionName: "vendors",
        docId: vendorEntityId,
        companyId,
        userId,
        increments: {
          totalPaid: paymentAmount,
          total_paid: paymentAmount,
          outstandingPayables: -paymentAmount,
          outstanding_payables: -paymentAmount,
        },
      });
    }

    return { paymentId: paymentRef.id, journalEntryId, billStatus: newStatus };
  });
};

const createInvoice = async ({ data, userId, companyId, db: dbArg }) => {
  const db = getDb(dbArg);
  const invoiceDate = formatDateOnly(data.invoiceDate || data.invoice_date || new Date().toISOString());
  const dueDate = formatDateOnly(data.dueDate || data.due_date || invoiceDate);

  const lineItems = Array.isArray(data.lineItems) ? data.lineItems : Array.isArray(data.line_items) ? data.line_items : [];
  if (!lineItems.length) {
    throw new HttpsError("invalid-argument", "Invoice requires at least one line item.");
  }

  const computedSubtotal = normalizeMoney(lineItems.reduce((sum, item) => {
    const quantity = Number(item.quantity ?? 1);
    const unitPrice = Number(item.unitPrice ?? item.unit_price ?? item.rate ?? 0);
    return sum + normalizeMoney(quantity * unitPrice);
  }, 0));

  const taxAmount = normalizeMoney(data.taxAmount ?? data.tax_amount ?? 0);
  const totalAmount = normalizeMoney(
    data.totalAmount ?? data.total_amount ?? computedSubtotal + taxAmount,
  );

  const revenueAccountIdInput = String(data.revenueAccountId || data.revenue_account_id || "").trim();
  const status = String(data.status || "Unpaid");

  return db.runTransaction(async (tx) => {
    await assertPeriodUnlocked(tx, companyId, invoiceDate, db);

    let revenueAccount;
    if (revenueAccountIdInput) {
      revenueAccount = await getAccountById(companyId, revenueAccountIdInput, tx, db);
      if (revenueAccount.accountType !== "Income") {
        throw new HttpsError("failed-precondition", "Revenue account must be an Income account.");
      }
    } else {
      revenueAccount = await resolveSystemAccount({
        companyId,
        names: ["Sales Revenue", "Service Revenue"],
        fallbackCode: 4000,
        db,
        requiredType: "Income",
      });
    }

    const arAccount = await resolveSystemAccount({
      companyId,
      names: ["Accounts Receivable"],
      fallbackCode: 1030,
      db,
      requiredType: "Asset",
    });
    const customerEntityId = String(data.customerId || data.customer_id || "").trim() || null;

    const invoiceNumber = String(data.invoiceNumber || data.invoice_number || "").trim() || generateInvoiceNumber();

    const existingInvoiceQuery = db
      .collection("invoices")
      .where("companyId", "==", companyId)
      .where("invoiceNumber", "==", invoiceNumber)
      .limit(1);
    const existingInvoiceSnap = await tx.get(existingInvoiceQuery);
    if (!existingInvoiceSnap.empty) {
      throw new HttpsError("already-exists", `Invoice number ${invoiceNumber} already exists.`);
    }

    const invoiceRef = db.collection("invoices").doc();
    tx.set(invoiceRef, {
      companyId,
      organizationId: companyId,
      invoiceNumber,
      invoice_number: invoiceNumber,
      customerId: customerEntityId,
      invoiceDate,
      invoice_date: invoiceDate,
      dueDate,
      due_date: dueDate,
      subtotal: computedSubtotal,
      taxAmount,
      tax_amount: taxAmount,
      totalAmount,
      total: totalAmount,
      total_amount: totalAmount,
      amountPaid: 0,
      amount_paid: 0,
      status,
      notes: data.notes || null,
      revenueAccountId: revenueAccount.id,
      revenue_account_id: revenueAccount.id,
      quotationId: data.quotationId || data.quotation_id || null,
      quotation_id: data.quotationId || data.quotation_id || null,
      journalEntryId: null,
      journal_entry_id: null,
      createdBy: userId,
      created_by: userId,
      updatedBy: userId,
      updated_by: userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    lineItems.forEach((item) => {
      const quantity = Number(item.quantity ?? 1);
      const unitPrice = Number(item.unitPrice ?? item.unit_price ?? item.rate ?? 0);
      const productId = String(
        item.productId
        || item.product_id
        || item.inventoryItemId
        || item.inventory_item_id
        || "",
      ).trim() || null;
      const itemRef = db.collection("invoiceItems").doc();
      tx.set(itemRef, {
        companyId,
        organizationId: companyId,
        invoiceId: invoiceRef.id,
        invoice_id: invoiceRef.id,
        description: item.description || "",
        productId,
        product_id: productId,
        quantity,
        unitPrice,
        unit_price: unitPrice,
        lineTotal: normalizeMoney(quantity * unitPrice),
        line_total: normalizeMoney(quantity * unitPrice),
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    const journalEntryId = await createJournalEntry({
      companyId,
      entryDate: invoiceDate,
      description: `Invoice #${invoiceNumber} - ${data.customerName || data.customer_name || "Customer"}`,
      referenceType: "Invoice",
      referenceId: invoiceRef.id,
      lines: [
        {
          accountId: arAccount.id,
          debitAmount: totalAmount,
          creditAmount: 0,
          description: "Accounts receivable recognized",
        },
        {
          accountId: revenueAccount.id,
          debitAmount: 0,
          creditAmount: totalAmount,
          description: "Revenue recognized",
        },
      ],
      createdBy: userId,
      db,
      tx,
    });

    tx.update(invoiceRef, {
      journalEntryId,
      journal_entry_id: journalEntryId,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
      updated_by: userId,
    });

    const quotationId = String(data.quotationId || data.quotation_id || "").trim();
    if (quotationId) {
      const quotationRef = db.collection("quotations").doc(quotationId);
      const quotationSnap = await tx.get(quotationRef);
      if (quotationSnap.exists) {
        tx.update(quotationRef, {
          status: "Accepted",
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: userId,
          updated_by: userId,
        });
      }
    }

    if (customerEntityId) {
      await updateCounterDocument({
        tx,
        db,
        collectionName: "customers",
        docId: customerEntityId,
        companyId,
        userId,
        increments: {
          totalInvoiced: totalAmount,
          total_invoiced: totalAmount,
          outstandingBalance: totalAmount,
          outstanding_balance: totalAmount,
        },
      });
    }

    await adjustInventoryForInvoiceLineItems({
      tx,
      db,
      companyId,
      userId,
      invoiceId: invoiceRef.id,
      invoiceDate,
      lineItems,
    });

    return { invoiceId: invoiceRef.id, journalEntryId, invoiceNumber };
  });
};

const recordInvoicePayment = async ({ data, userId, companyId, db: dbArg }) => {
  const db = getDb(dbArg);
  const invoiceId = String(data.invoiceId || data.invoice_id || "").trim();
  if (!invoiceId) {
    throw new HttpsError("invalid-argument", "invoiceId is required.");
  }

  const paymentAmount = assertPositiveAmount(data.amount, "Invoice payment amount");
  const paymentDate = formatDateOnly(data.paymentDate || data.payment_date || new Date().toISOString());
  const paymentAccountId = String(data.paymentAccountId || data.payment_account_id || "").trim();
  if (!paymentAccountId) {
    throw new HttpsError("invalid-argument", "paymentAccountId is required.");
  }

  return db.runTransaction(async (tx) => {
    await assertPeriodUnlocked(tx, companyId, paymentDate, db);

    const invoiceRef = db.collection("invoices").doc(invoiceId);
    const invoiceSnap = await tx.get(invoiceRef);
    if (!invoiceSnap.exists) {
      throw new HttpsError("not-found", "Invoice not found.");
    }

    const invoice = invoiceSnap.data();
    const owner = invoice.companyId || invoice.organizationId;
    if (owner !== companyId) {
      throw new HttpsError("permission-denied", "Invoice does not belong to this organization.");
    }
    const customerEntityId = String(invoice.customerId || invoice.customer_id || "").trim() || null;

    const invoiceTotal = Number(invoice.totalAmount ?? invoice.total ?? invoice.total_amount ?? 0);
    const amountPaid = Number(invoice.amountPaid ?? invoice.amount_paid ?? 0);
    const remaining = normalizeMoney(invoiceTotal - amountPaid);
    if (paymentAmount - remaining > 0.001) {
      throw new HttpsError(
        "invalid-argument",
        `Payment exceeds outstanding balance of ${remaining}.`,
      );
    }

    await assertAssetPaymentAccount(tx, db, companyId, paymentAccountId);
    const arAccount = await resolveSystemAccount({
      companyId,
      names: ["Accounts Receivable"],
      fallbackCode: 1030,
      db,
      requiredType: "Asset",
    });

    const paymentRef = db.collection("invoicePayments").doc();
    tx.set(paymentRef, {
      companyId,
      organizationId: companyId,
      invoiceId,
      invoice_id: invoiceId,
      amount: paymentAmount,
      paymentDate,
      payment_date: paymentDate,
      paymentAccountId,
      payment_account_id: paymentAccountId,
      notes: data.notes || null,
      journalEntryId: null,
      journal_entry_id: null,
      createdBy: userId,
      created_by: userId,
      createdAt: FieldValue.serverTimestamp(),
    });

    const journalEntryId = await createJournalEntry({
      companyId,
      entryDate: paymentDate,
      description: `Invoice Payment: ${invoice.invoiceNumber || invoiceId}`,
      referenceType: "InvoicePayment",
      referenceId: paymentRef.id,
      lines: [
        {
          accountId: paymentAccountId,
          debitAmount: paymentAmount,
          creditAmount: 0,
          description: "Cash/Bank received",
        },
        {
          accountId: arAccount.id,
          debitAmount: 0,
          creditAmount: paymentAmount,
          description: "Accounts receivable settled",
        },
      ],
      createdBy: userId,
      db,
      tx,
    });

    tx.update(paymentRef, {
      journalEntryId,
      journal_entry_id: journalEntryId,
    });

    const newAmountPaid = normalizeMoney(amountPaid + paymentAmount);
    let newStatus = "Partially Paid";
    if (newAmountPaid >= invoiceTotal - 0.001) {
      newStatus = "Paid";
    }

    tx.update(invoiceRef, {
      amountPaid: newAmountPaid,
      amount_paid: newAmountPaid,
      status: newStatus,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
      updated_by: userId,
    });

    createBankTransaction({
      tx,
      db,
      companyId,
      accountId: paymentAccountId,
      amount: paymentAmount,
      transactionDate: paymentDate,
      direction: "inflow",
      description: data.notes || `Invoice payment ${invoice.invoiceNumber || invoiceId}`,
      referenceType: "InvoicePayment",
      referenceId: paymentRef.id,
      createdBy: userId,
    });

    await adjustLinkedBankAccountBalance({
      tx,
      db,
      companyId,
      paymentAccountId,
      deltaAmount: paymentAmount,
    });

    if (customerEntityId) {
      await updateCounterDocument({
        tx,
        db,
        collectionName: "customers",
        docId: customerEntityId,
        companyId,
        userId,
        increments: {
          totalReceived: paymentAmount,
          total_received: paymentAmount,
          outstandingBalance: -paymentAmount,
          outstanding_balance: -paymentAmount,
        },
      });
    }

    return { paymentId: paymentRef.id, journalEntryId, invoiceStatus: newStatus };
  });
};

const createQuotation = async ({ data, userId, companyId, db: dbArg }) => {
  const db = getDb(dbArg);
  const quotationDate = formatDateOnly(data.quotationDate || data.quotation_date || new Date().toISOString());
  const validUntil = formatDateOnly(data.validUntil || data.valid_until || quotationDate);
  const lineItems = Array.isArray(data.lineItems) ? data.lineItems : Array.isArray(data.line_items) ? data.line_items : [];
  if (!lineItems.length) {
    throw new HttpsError("invalid-argument", "Quotation requires at least one line item.");
  }

  const subtotal = normalizeMoney(lineItems.reduce((sum, item) => {
    const quantity = Number(item.quantity ?? 1);
    const unitPrice = Number(item.unitPrice ?? item.unit_price ?? item.rate ?? 0);
    return sum + normalizeMoney(quantity * unitPrice);
  }, 0));
  const taxAmount = normalizeMoney(data.taxAmount ?? data.tax_amount ?? 0);
  const totalAmount = normalizeMoney(data.totalAmount ?? data.total_amount ?? subtotal + taxAmount);
  const quotationNumber = String(data.quotationNumber || data.quotation_number || "").trim() || generateQuotationNumber();
  const status = String(data.status || "Draft");

  return db.runTransaction(async (tx) => {
    const quotationRef = db.collection("quotations").doc();
    tx.set(quotationRef, {
      companyId,
      organizationId: companyId,
      quotationNumber,
      quotation_number: quotationNumber,
      customerId: data.customerId || data.customer_id || null,
      quotationDate,
      quotation_date: quotationDate,
      validUntil,
      valid_until: validUntil,
      subtotal,
      taxAmount,
      tax_amount: taxAmount,
      totalAmount,
      total_amount: totalAmount,
      status,
      notes: data.notes || null,
      createdBy: userId,
      created_by: userId,
      updatedBy: userId,
      updated_by: userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    lineItems.forEach((item) => {
      const quantity = Number(item.quantity ?? 1);
      const unitPrice = Number(item.unitPrice ?? item.unit_price ?? item.rate ?? 0);
      const lineRef = db.collection("quotationLineItems").doc();
      tx.set(lineRef, {
        companyId,
        organizationId: companyId,
        quotationId: quotationRef.id,
        quotation_id: quotationRef.id,
        description: item.description || "",
        quantity,
        unitPrice,
        unit_price: unitPrice,
        lineTotal: normalizeMoney(quantity * unitPrice),
        line_total: normalizeMoney(quantity * unitPrice),
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    // Compatibility mirror for existing estimates/sales order pages.
    const mirrorRef = db.collection("salesOrders").doc();
    tx.set(mirrorRef, {
      companyId,
      customerId: data.customerId || data.customer_id || null,
      orderType: "quote",
      quotationId: quotationRef.id,
      orderNumber: quotationNumber,
      orderDate: quotationDate,
      validUntil,
      subtotal,
      vatAmount: taxAmount,
      total: totalAmount,
      status: status.toLowerCase(),
      notes: data.notes || null,
      lineItems,
      createdBy: userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { quotationId: quotationRef.id, quotationNumber };
  });
};

const updateOverdueBills = async ({ companyId, db: dbArg }) => {
  const db = getDb(dbArg);
  const today = new Date().toISOString().slice(0, 10);
  const billSnap = await db
    .collection("bills")
    .where("companyId", "==", companyId)
    .get();

  if (billSnap.empty) return { updated: 0 };

  const batch = db.batch();
  let updated = 0;

  billSnap.docs.forEach((docSnap) => {
    const bill = docSnap.data();
    const status = String(bill.status || "");
    if (!["Unpaid", "Partially Paid"].includes(status)) return;

    const dueDate = String(bill.dueDate || bill.due_date || "");
    if (!dueDate || dueDate >= today) return;

    batch.set(docSnap.ref, {
      status: "Overdue",
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    updated += 1;
  });

  if (updated > 0) {
    await batch.commit();
  }

  return { updated };
};

const reverseJournalEntry = async ({
  data,
  userId,
  companyId,
  db: dbArg,
}) => {
  const db = getDb(dbArg);
  const journalEntryId = String(data.journalEntryId || data.entryId || "").trim();
  if (!journalEntryId) {
    throw new HttpsError("invalid-argument", "journalEntryId is required.");
  }

  const reason = String(data.reason || "").trim() || null;
  const reversalDate = formatDateOnly(
    data.reversalDate || data.entryDate || new Date().toISOString(),
  );

  return db.runTransaction(async (tx) => {
    await assertPeriodUnlocked(tx, companyId, reversalDate, db);

    const entryRef = db.collection("journalEntries").doc(journalEntryId);
    const entrySnap = await tx.get(entryRef);
    if (!entrySnap.exists) {
      throw new HttpsError("not-found", "Journal entry not found.");
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
      throw new HttpsError("failed-precondition", "Journal entry has already been reversed.");
    }

    let linesSnap = await tx.get(
      db.collection("journalLines")
        .where("companyId", "==", companyId)
        .where("entryId", "==", journalEntryId),
    );

    if (linesSnap.empty) {
      linesSnap = await tx.get(
        db.collection("journalLines")
          .where("companyId", "==", companyId)
          .where("journalEntryId", "==", journalEntryId),
      );
    }

    if (linesSnap.empty || linesSnap.docs.length < 2) {
      throw new HttpsError(
        "failed-precondition",
        "Journal entry must contain at least two lines to reverse.",
      );
    }

    const reversalLines = linesSnap.docs.map((docSnap, index) => {
      const line = docSnap.data();
      const accountId = String(line.accountId || "").trim();
      if (!accountId) {
        throw new HttpsError("failed-precondition", `Journal line ${index + 1} has no accountId.`);
      }

      const debitAmount = normalizeMoney(line.debitAmount ?? line.debit ?? 0);
      const creditAmount = normalizeMoney(line.creditAmount ?? line.credit ?? 0);
      if (debitAmount <= 0 && creditAmount <= 0) {
        throw new HttpsError("failed-precondition", `Journal line ${index + 1} has no amount.`);
      }

      return {
        accountId,
        debitAmount: creditAmount,
        creditAmount: debitAmount,
        description: line.description || `Reversal line ${index + 1}`,
      };
    });

    const reversalEntryId = await createJournalEntry({
      companyId,
      entryDate: reversalDate,
      description: reason
        ? `Reversal of ${journalEntryId}: ${reason}`
        : `Reversal of ${journalEntryId}`,
      referenceType: "ManualEntry",
      referenceId: journalEntryId,
      lines: reversalLines,
      createdBy: userId,
      db,
      tx,
      metadata: {
        isReversal: true,
        reversalOf: journalEntryId,
        reason,
        originalReferenceType: entry.referenceType || entry.reference_type || null,
      },
    });

    const entryReferenceType = String(entry.referenceType || entry.reference_type || "");
    const entryReferenceId = String(entry.referenceId || entry.reference_id || "").trim();

    if (entryReferenceType === "BillPayment" && entryReferenceId) {
      const paymentRef = db.collection("billPayments").doc(entryReferenceId);
      const paymentSnap = await tx.get(paymentRef);
      if (paymentSnap.exists) {
        const payment = paymentSnap.data();
        const paymentOwner = payment.companyId || payment.organizationId;
        if (paymentOwner === companyId) {
          if (payment.isReversed === true || payment.is_reversed === true) {
            throw new HttpsError("failed-precondition", "Bill payment has already been reversed.");
          }

          const paymentAmount = normalizeMoney(payment.amount ?? 0);
          const paymentAccountId = String(payment.paymentAccountId || payment.payment_account_id || "").trim();
          const billId = String(payment.billId || payment.bill_id || "").trim();

          tx.set(paymentRef, {
            isReversed: true,
            is_reversed: true,
            reversedAt: FieldValue.serverTimestamp(),
            reversedBy: userId,
            reversed_by: userId,
            reversalEntryId,
            reversal_entry_id: reversalEntryId,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: userId,
            updated_by: userId,
          }, { merge: true });

          if (billId && paymentAmount > 0) {
            const billRef = db.collection("bills").doc(billId);
            const billSnap = await tx.get(billRef);
            if (billSnap.exists) {
              const bill = billSnap.data();
              const billOwner = bill.companyId || bill.organizationId;
              if (billOwner === companyId) {
                const billTotal = normalizeMoney(bill.amount ?? bill.total ?? bill.total_amount ?? 0);
                const currentPaid = normalizeMoney(bill.amountPaid ?? bill.amount_paid ?? 0);
                const newAmountPaid = normalizeMoney(Math.max(0, currentPaid - paymentAmount));
                const newStatus = newAmountPaid >= billTotal - 0.001
                  ? "Paid"
                  : newAmountPaid > 0
                    ? "Partially Paid"
                    : "Unpaid";

                tx.set(billRef, {
                  amountPaid: newAmountPaid,
                  amount_paid: newAmountPaid,
                  status: newStatus,
                  updatedAt: FieldValue.serverTimestamp(),
                  updatedBy: userId,
                  updated_by: userId,
                }, { merge: true });

                const vendorEntityId = String(bill.vendorId || bill.vendor_id || "").trim();
                if (vendorEntityId) {
                  await updateCounterDocument({
                    tx,
                    db,
                    collectionName: "vendors",
                    docId: vendorEntityId,
                    companyId,
                    userId,
                    increments: {
                      totalPaid: -paymentAmount,
                      total_paid: -paymentAmount,
                      outstandingPayables: paymentAmount,
                      outstanding_payables: paymentAmount,
                    },
                  });
                }
              }
            }
          }

          if (paymentAccountId && paymentAmount > 0) {
            await adjustLinkedBankAccountBalance({
              tx,
              db,
              companyId,
              paymentAccountId,
              deltaAmount: paymentAmount,
            });

            createBankTransaction({
              tx,
              db,
              companyId,
              accountId: paymentAccountId,
              amount: paymentAmount,
              transactionDate: reversalDate,
              direction: "inflow",
              description: `Reversal - Bill payment ${entryReferenceId}`,
              referenceType: "BillPaymentReversal",
              referenceId: entryReferenceId,
              createdBy: userId,
            });
          }
        }
      }
    }

    if (entryReferenceType === "InvoicePayment" && entryReferenceId) {
      const paymentRef = db.collection("invoicePayments").doc(entryReferenceId);
      const paymentSnap = await tx.get(paymentRef);
      if (paymentSnap.exists) {
        const payment = paymentSnap.data();
        const paymentOwner = payment.companyId || payment.organizationId;
        if (paymentOwner === companyId) {
          if (payment.isReversed === true || payment.is_reversed === true) {
            throw new HttpsError("failed-precondition", "Invoice payment has already been reversed.");
          }

          const paymentAmount = normalizeMoney(payment.amount ?? 0);
          const paymentAccountId = String(payment.paymentAccountId || payment.payment_account_id || "").trim();
          const invoiceId = String(payment.invoiceId || payment.invoice_id || "").trim();

          tx.set(paymentRef, {
            isReversed: true,
            is_reversed: true,
            reversedAt: FieldValue.serverTimestamp(),
            reversedBy: userId,
            reversed_by: userId,
            reversalEntryId,
            reversal_entry_id: reversalEntryId,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: userId,
            updated_by: userId,
          }, { merge: true });

          if (invoiceId && paymentAmount > 0) {
            const invoiceRef = db.collection("invoices").doc(invoiceId);
            const invoiceSnap = await tx.get(invoiceRef);
            if (invoiceSnap.exists) {
              const invoice = invoiceSnap.data();
              const invoiceOwner = invoice.companyId || invoice.organizationId;
              if (invoiceOwner === companyId) {
                const invoiceTotal = normalizeMoney(
                  invoice.totalAmount ?? invoice.total_amount ?? invoice.total ?? 0,
                );
                const currentPaid = normalizeMoney(invoice.amountPaid ?? invoice.amount_paid ?? 0);
                const newAmountPaid = normalizeMoney(Math.max(0, currentPaid - paymentAmount));
                const newStatus = newAmountPaid >= invoiceTotal - 0.001
                  ? "Paid"
                  : newAmountPaid > 0
                    ? "Partially Paid"
                    : "Unpaid";

                tx.set(invoiceRef, {
                  amountPaid: newAmountPaid,
                  amount_paid: newAmountPaid,
                  status: newStatus,
                  updatedAt: FieldValue.serverTimestamp(),
                  updatedBy: userId,
                  updated_by: userId,
                }, { merge: true });

                const customerEntityId = String(invoice.customerId || invoice.customer_id || "").trim();
                if (customerEntityId) {
                  await updateCounterDocument({
                    tx,
                    db,
                    collectionName: "customers",
                    docId: customerEntityId,
                    companyId,
                    userId,
                    increments: {
                      totalReceived: -paymentAmount,
                      total_received: -paymentAmount,
                      outstandingBalance: paymentAmount,
                      outstanding_balance: paymentAmount,
                    },
                  });
                }
              }
            }
          }

          if (paymentAccountId && paymentAmount > 0) {
            await adjustLinkedBankAccountBalance({
              tx,
              db,
              companyId,
              paymentAccountId,
              deltaAmount: -paymentAmount,
            });

            createBankTransaction({
              tx,
              db,
              companyId,
              accountId: paymentAccountId,
              amount: paymentAmount,
              transactionDate: reversalDate,
              direction: "outflow",
              description: `Reversal - Invoice payment ${entryReferenceId}`,
              referenceType: "InvoicePaymentReversal",
              referenceId: entryReferenceId,
              createdBy: userId,
            });
          }
        }
      }
    }

    tx.set(entryRef, {
      isReversed: true,
      reversedAt: FieldValue.serverTimestamp(),
      reversedBy: userId,
      reversalEntryId,
      reversal_entry_id: reversalEntryId,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
      updated_by: userId,
    }, { merge: true });

    linesSnap.docs.forEach((lineDoc) => {
      tx.set(lineDoc.ref, {
        isReversed: true,
        reversalEntryId,
        reversal_entry_id: reversalEntryId,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    tx.set(db.collection("journalEntries").doc(reversalEntryId), {
      isReversal: true,
      reversalOf: journalEntryId,
      reversal_of: journalEntryId,
      reversalReason: reason,
      reversal_reason: reason,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
      updated_by: userId,
    }, { merge: true });

    return { originalEntryId: journalEntryId, reversalEntryId };
  });
};

const deleteChartOfAccount = async ({
  data,
  companyId,
  db: dbArg,
}) => {
  const db = getDb(dbArg);
  const accountId = String(data.accountId || "").trim();
  if (!accountId) {
    throw new HttpsError("invalid-argument", "accountId is required.");
  }

  return db.runTransaction(async (tx) => {
    const accountRef = db.collection("chartOfAccounts").doc(accountId);
    const accountSnap = await tx.get(accountRef);
    if (!accountSnap.exists) {
      throw new HttpsError("not-found", "Account not found.");
    }

    const account = accountSnap.data();
    const owner = account.companyId || account.organizationId;
    if (owner !== companyId) {
      throw new HttpsError("permission-denied", "Account does not belong to this organization.");
    }

    if (account.isSystemAccount === true || account.isSystem === true) {
      throw new HttpsError("failed-precondition", "System accounts cannot be deleted.");
    }

    const directChildrenSnap = await tx.get(
      db.collection("chartOfAccounts")
        .where("companyId", "==", companyId)
        .where("parentAccountId", "==", accountId)
        .limit(1),
    );
    if (!directChildrenSnap.empty) {
      throw new HttpsError("failed-precondition", "Account has child accounts and cannot be deleted.");
    }

    const legacyChildrenSnap = await tx.get(
      db.collection("chartOfAccounts")
        .where("companyId", "==", companyId)
        .where("parent_account_id", "==", accountId)
        .limit(1),
    );
    if (!legacyChildrenSnap.empty) {
      throw new HttpsError("failed-precondition", "Account has child accounts and cannot be deleted.");
    }

    const journalLinesSnap = await tx.get(
      db.collection("journalLines")
        .where("companyId", "==", companyId)
        .where("accountId", "==", accountId)
        .limit(1),
    );
    if (!journalLinesSnap.empty) {
      throw new HttpsError("failed-precondition", "Account has journal history and cannot be deleted.");
    }

    const expenseCategoryLinks = await tx.get(
      db.collection("expenseCategoryMappings")
        .where("companyId", "==", companyId)
        .where("linkedExpenseAccountId", "==", accountId)
        .limit(1),
    );
    if (!expenseCategoryLinks.empty) {
      throw new HttpsError(
        "failed-precondition",
        "Account is linked to an expense category and cannot be deleted.",
      );
    }

    tx.delete(accountRef);
    return { deleted: true, accountId };
  });
};

const getChartAccounts = async (companyId, db) => {
  const snap = await db
    .collection("chartOfAccounts")
    .where("companyId", "==", companyId)
    .get();

  const accounts = snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })).filter((row) => isActiveAccount(row));

  const byId = new Map(accounts.map((account) => [account.id, account]));
  return { accounts, byId };
};

const getJournalLinesForRange = async ({ companyId, startDate, endDate, db }) => {
  let linesQuery = db
    .collection("journalLines")
    .where("companyId", "==", companyId)
    .where("isPosted", "==", true);

  if (startDate) {
    linesQuery = linesQuery.where("entryDate", ">=", formatDateOnly(startDate));
  }
  if (endDate) {
    linesQuery = linesQuery.where("entryDate", "<=", formatDateOnly(endDate));
  }

  const snap = await linesQuery.get();
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

const aggregateByAccount = (lines) => {
  const totals = new Map();
  lines.forEach((line) => {
    const accountId = line.accountId;
    if (!accountId) return;
    const current = totals.get(accountId) || { debit: 0, credit: 0 };
    current.debit += Number(line.debitAmount ?? line.debit ?? 0);
    current.credit += Number(line.creditAmount ?? line.credit ?? 0);
    totals.set(accountId, current);
  });
  return totals;
};

const toClosingBalance = (accountType, debitTotal, creditTotal) => {
  if (accountType === "Asset" || accountType === "Expense") {
    return normalizeMoney(debitTotal - creditTotal);
  }
  return normalizeMoney(creditTotal - debitTotal);
};

const getProfitLossReport = async ({
  companyId,
  startDate,
  endDate,
  db: dbArg,
}) => {
  const db = getDb(dbArg);
  const normalizedStart = formatDateOnly(startDate);
  const normalizedEnd = formatDateOnly(endDate);

  const { accounts } = await getChartAccounts(companyId, db);
  const lines = await getJournalLinesForRange({
    companyId,
    startDate: normalizedStart,
    endDate: normalizedEnd,
    db,
  });
  const totalsByAccount = aggregateByAccount(lines);

  const income = [];
  const expenses = [];
  let totalIncome = 0;
  let totalExpenses = 0;

  accounts
    .filter((account) => account.accountType === "Income" || account.accountType === "Expense")
    .sort((a, b) => Number(a.accountCode || 0) - Number(b.accountCode || 0))
    .forEach((account) => {
      const totals = totalsByAccount.get(account.id) || { debit: 0, credit: 0 };
      if (account.accountType === "Income") {
        const balance = normalizeMoney(totals.credit - totals.debit);
        income.push({
          accountId: account.id,
          accountCode: String(account.accountCode || ""),
          accountName: account.accountName,
          balance,
        });
        totalIncome = normalizeMoney(totalIncome + balance);
      } else {
        const balance = normalizeMoney(totals.debit - totals.credit);
        expenses.push({
          accountId: account.id,
          accountCode: String(account.accountCode || ""),
          accountName: account.accountName,
          balance,
        });
        totalExpenses = normalizeMoney(totalExpenses + balance);
      }
    });

  return {
    startDate: normalizedStart,
    endDate: normalizedEnd,
    income,
    expenses,
    totalIncome,
    totalExpenses,
    netProfitLoss: normalizeMoney(totalIncome - totalExpenses),
  };
};

const getBalanceSheetReport = async ({
  companyId,
  asOfDate,
  db: dbArg,
}) => {
  const db = getDb(dbArg);
  const normalizedAsOfDate = formatDateOnly(asOfDate);
  const { accounts } = await getChartAccounts(companyId, db);
  const lines = await getJournalLinesForRange({
    companyId,
    startDate: null,
    endDate: normalizedAsOfDate,
    db,
  });
  const totalsByAccount = aggregateByAccount(lines);

  const assets = [];
  const liabilities = [];
  const equity = [];
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

  accounts.forEach((account) => {
    if (!["Asset", "Liability", "Equity"].includes(account.accountType)) return;
    const totals = totalsByAccount.get(account.id) || { debit: 0, credit: 0 };
    const balance = toClosingBalance(account.accountType, totals.debit, totals.credit);

    const row = {
      accountId: account.id,
      accountCode: String(account.accountCode || ""),
      accountName: account.accountName,
      balance,
    };

    if (account.accountType === "Asset") {
      assets.push(row);
      totalAssets = normalizeMoney(totalAssets + balance);
    } else if (account.accountType === "Liability") {
      liabilities.push(row);
      totalLiabilities = normalizeMoney(totalLiabilities + balance);
    } else {
      equity.push(row);
      totalEquity = normalizeMoney(totalEquity + balance);
    }
  });

  return {
    asOfDate: normalizedAsOfDate,
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    liabilitiesPlusEquity: normalizeMoney(totalLiabilities + totalEquity),
    isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) <= 0.01,
  };
};

const getTrialBalanceReport = async ({
  companyId,
  startDate = null,
  endDate = null,
  db: dbArg,
}) => {
  const db = getDb(dbArg);
  const normalizedStart = startDate ? formatDateOnly(startDate) : null;
  const normalizedEnd = endDate ? formatDateOnly(endDate) : null;
  const { accounts } = await getChartAccounts(companyId, db);
  const lines = await getJournalLinesForRange({
    companyId,
    startDate: normalizedStart,
    endDate: normalizedEnd,
    db,
  });
  const totalsByAccount = aggregateByAccount(lines);

  const rows = accounts
    .sort((a, b) => {
      if (a.accountType === b.accountType) return Number(a.accountCode || 0) - Number(b.accountCode || 0);
      return String(a.accountType || "").localeCompare(String(b.accountType || ""));
    })
    .map((account) => {
      const totals = totalsByAccount.get(account.id) || { debit: 0, credit: 0 };
      const totalDebits = normalizeMoney(totals.debit);
      const totalCredits = normalizeMoney(totals.credit);

      return {
        accountId: account.id,
        accountCode: String(account.accountCode || ""),
        accountName: account.accountName,
        accountType: account.accountType,
        totalDebits,
        totalCredits,
        closingBalance: toClosingBalance(account.accountType, totalDebits, totalCredits),
      };
    });

  const totalDebits = normalizeMoney(rows.reduce((sum, row) => sum + row.totalDebits, 0));
  const totalCredits = normalizeMoney(rows.reduce((sum, row) => sum + row.totalCredits, 0));

  return {
    startDate: normalizedStart,
    endDate: normalizedEnd,
    rows,
    totalDebits,
    totalCredits,
    isBalanced: Math.abs(totalDebits - totalCredits) <= 0.01,
  };
};

const getGeneralLedgerReport = async ({
  companyId,
  accountId,
  startDate,
  endDate,
  db: dbArg,
}) => {
  if (!accountId) {
    throw new HttpsError("invalid-argument", "accountId is required.");
  }
  const db = getDb(dbArg);
  const normalizedStart = formatDateOnly(startDate);
  const normalizedEnd = formatDateOnly(endDate);
  const account = await getAccountById(companyId, accountId, null, db);

  let linesQuery = db
    .collection("journalLines")
    .where("companyId", "==", companyId)
    .where("accountId", "==", accountId)
    .where("isPosted", "==", true)
    .where("entryDate", ">=", normalizedStart)
    .where("entryDate", "<=", normalizedEnd);

  const linesSnap = await linesQuery.get();
  const lines = linesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

  const entryIds = [...new Set(lines.map((line) => String(line.entryId || line.journalEntryId || "")).filter(Boolean))];
  const entryMap = new Map();
  await Promise.all(entryIds.map(async (entryId) => {
    const snap = await db.collection("journalEntries").doc(entryId).get();
    if (snap.exists) {
      entryMap.set(entryId, snap.data());
    }
  }));

  const debitNormal = account.accountType === "Asset" || account.accountType === "Expense";
  let runningBalance = 0;

  const rows = lines
    .sort((a, b) => {
      if (a.entryDate === b.entryDate) {
        return String(toIsoTimestamp(a.createdAt) || "").localeCompare(String(toIsoTimestamp(b.createdAt) || ""));
      }
      return String(a.entryDate || "").localeCompare(String(b.entryDate || ""));
    })
    .map((line) => {
      const debit = normalizeMoney(line.debitAmount ?? line.debit ?? 0);
      const credit = normalizeMoney(line.creditAmount ?? line.credit ?? 0);
      runningBalance = debitNormal
        ? normalizeMoney(runningBalance + debit - credit)
        : normalizeMoney(runningBalance + credit - debit);

      const entry = entryMap.get(String(line.entryId || line.journalEntryId || ""));
      return {
        entryDate: String(line.entryDate || ""),
        description: entry?.description || line.description || null,
        referenceType: entry?.referenceType || null,
        referenceId: entry?.referenceId || null,
        debitAmount: debit,
        creditAmount: credit,
        runningBalance,
      };
    });

  return {
    accountId,
    accountCode: String(account.accountCode || ""),
    accountName: account.accountName,
    startDate: normalizedStart,
    endDate: normalizedEnd,
    rows,
  };
};

const getCashFlowReport = async ({
  companyId,
  startDate,
  endDate,
  db: dbArg,
}) => {
  const db = getDb(dbArg);
  const normalizedStart = formatDateOnly(startDate);
  const normalizedEnd = formatDateOnly(endDate);
  const { accounts } = await getChartAccounts(companyId, db);
  const cashAccounts = accounts.filter(
    (account) => account.accountType === "Asset" && CASH_AND_BANK_ACCOUNT_NAMES.includes(account.accountName),
  );

  if (!cashAccounts.length) {
    return {
      startDate: normalizedStart,
      endDate: normalizedEnd,
      rows: [],
    };
  }

  const accountMap = new Map(cashAccounts.map((account) => [account.id, account.accountName]));
  const rows = [];

  const accountChunks = [];
  for (let index = 0; index < cashAccounts.length; index += 10) {
    accountChunks.push(cashAccounts.slice(index, index + 10));
  }

  for (const chunk of accountChunks) {
    let linesQuery = db
      .collection("journalLines")
      .where("companyId", "==", companyId)
      .where("accountId", "in", chunk.map((account) => account.id))
      .where("isPosted", "==", true)
      .where("entryDate", ">=", normalizedStart)
      .where("entryDate", "<=", normalizedEnd);
    const linesSnap = await linesQuery.get();
    linesSnap.docs.forEach((docSnap) => rows.push({ id: docSnap.id, ...docSnap.data() }));
  }

  const entryIds = [...new Set(rows.map((line) => String(line.entryId || line.journalEntryId || "")).filter(Boolean))];
  const entries = new Map();
  await Promise.all(entryIds.map(async (entryId) => {
    const snap = await db.collection("journalEntries").doc(entryId).get();
    if (snap.exists) entries.set(entryId, snap.data());
  }));

  const resultRows = rows
    .map((line) => {
      const entry = entries.get(String(line.entryId || line.journalEntryId || ""));
      return {
        entryDate: String(line.entryDate || ""),
        description: entry?.description || line.description || null,
        referenceType: entry?.referenceType || null,
        moneyIn: normalizeMoney(line.debitAmount ?? line.debit ?? 0),
        moneyOut: normalizeMoney(line.creditAmount ?? line.credit ?? 0),
        account: accountMap.get(line.accountId) || null,
      };
    })
    .sort((a, b) => b.entryDate.localeCompare(a.entryDate));

  return {
    startDate: normalizedStart,
    endDate: normalizedEnd,
    rows: resultRows,
  };
};

const getExpenseReport = async ({
  companyId,
  startDate,
  endDate,
  db: dbArg,
}) => {
  const db = getDb(dbArg);
  const normalizedStart = formatDateOnly(startDate);
  const normalizedEnd = formatDateOnly(endDate);
  const { accounts, byId } = await getChartAccounts(companyId, db);
  const expenseAccountIds = accounts.filter((account) => account.accountType === "Expense").map((account) => account.id);

  if (!expenseAccountIds.length) {
    return {
      startDate: normalizedStart,
      endDate: normalizedEnd,
      rows: [],
    };
  }

  const grouped = new Map();
  const accountChunks = [];
  for (let index = 0; index < expenseAccountIds.length; index += 10) {
    accountChunks.push(expenseAccountIds.slice(index, index + 10));
  }

  for (const accountChunk of accountChunks) {
    let queryRef = db
      .collection("journalLines")
      .where("companyId", "==", companyId)
      .where("accountId", "in", accountChunk)
      .where("isPosted", "==", true)
      .where("entryDate", ">=", normalizedStart)
      .where("entryDate", "<=", normalizedEnd);
    const linesSnap = await queryRef.get();

    const entryIds = [...new Set(linesSnap.docs.map((docSnap) => String(docSnap.data().entryId || docSnap.data().journalEntryId || "")).filter(Boolean))];
    const entryMap = new Map();
    await Promise.all(entryIds.map(async (entryId) => {
      const entrySnap = await db.collection("journalEntries").doc(entryId).get();
      if (entrySnap.exists) entryMap.set(entryId, entrySnap.data());
    }));

    linesSnap.docs.forEach((docSnap) => {
      const line = docSnap.data();
      const account = byId.get(line.accountId);
      if (!account) return;
      const entry = entryMap.get(String(line.entryId || line.journalEntryId || ""));
      const groupKey = [
        account.accountName,
        String(line.entryDate || ""),
        String(entry?.description || line.description || ""),
        String(entry?.referenceType || ""),
      ].join("|");

      const current = grouped.get(groupKey) || {
        expenseAccount: account.accountName,
        entryDate: String(line.entryDate || ""),
        description: entry?.description || line.description || null,
        referenceType: entry?.referenceType || null,
        amount: 0,
      };
      current.amount = normalizeMoney(
        current.amount + Number(line.debitAmount ?? line.debit ?? 0) - Number(line.creditAmount ?? line.credit ?? 0),
      );
      grouped.set(groupKey, current);
    });
  }

  const rows = [...grouped.values()].sort((a, b) => b.entryDate.localeCompare(a.entryDate));
  return {
    startDate: normalizedStart,
    endDate: normalizedEnd,
    rows,
  };
};

const getDashboardLiveMetrics = async ({ companyId, db: dbArg }) => {
  const db = getDb(dbArg);
  const today = new Date();
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-31`;
  const { accounts, byId } = await getChartAccounts(companyId, db);
  const linesThisMonth = await getJournalLinesForRange({
    companyId,
    startDate: monthStart,
    endDate: monthEnd,
    db,
  });
  const allLines = await getJournalLinesForRange({
    companyId,
    startDate: null,
    endDate: null,
    db,
  });

  const bankDefault = accounts.find((account) => account.accountName === "Bank - Default")
    || accounts.find((account) => account.accountCode === 1013);
  const apAccount = accounts.find((account) => account.accountName === "Accounts Payable")
    || accounts.find((account) => account.accountCode === 2000);
  const arAccount = accounts.find((account) => account.accountName === "Accounts Receivable")
    || accounts.find((account) => account.accountCode === 1030);

  const totalExpensesThisMonth = normalizeMoney(linesThisMonth.reduce((sum, line) => {
    const account = byId.get(line.accountId);
    if (!account || account.accountType !== "Expense") return sum;
    return sum + Number(line.debitAmount ?? line.debit ?? 0) - Number(line.creditAmount ?? line.credit ?? 0);
  }, 0));

  const bankBalance = bankDefault
    ? normalizeMoney(allLines
      .filter((line) => line.accountId === bankDefault.id)
      .reduce((sum, line) => sum + Number(line.debitAmount ?? line.debit ?? 0) - Number(line.creditAmount ?? line.credit ?? 0), 0))
    : 0;

  const outstandingPayables = apAccount
    ? normalizeMoney(allLines
      .filter((line) => line.accountId === apAccount.id)
      .reduce((sum, line) => sum + Number(line.creditAmount ?? line.credit ?? 0) - Number(line.debitAmount ?? line.debit ?? 0), 0))
    : 0;

  const outstandingReceivables = arAccount
    ? normalizeMoney(allLines
      .filter((line) => line.accountId === arAccount.id)
      .reduce((sum, line) => sum + Number(line.debitAmount ?? line.debit ?? 0) - Number(line.creditAmount ?? line.credit ?? 0), 0))
    : 0;

  const monthlyIncome = normalizeMoney(linesThisMonth.reduce((sum, line) => {
    const account = byId.get(line.accountId);
    if (!account || account.accountType !== "Income") return sum;
    return sum + Number(line.creditAmount ?? line.credit ?? 0) - Number(line.debitAmount ?? line.debit ?? 0);
  }, 0));

  const monthlyExpenses = normalizeMoney(linesThisMonth.reduce((sum, line) => {
    const account = byId.get(line.accountId);
    if (!account || account.accountType !== "Expense") return sum;
    return sum + Number(line.debitAmount ?? line.debit ?? 0) - Number(line.creditAmount ?? line.credit ?? 0);
  }, 0));

  return {
    month: monthStart.slice(0, 7),
    totalExpensesThisMonth,
    bankDefaultBalance: bankBalance,
    outstandingAccountsPayable: outstandingPayables,
    outstandingAccountsReceivable: outstandingReceivables,
    monthlyProfit: normalizeMoney(monthlyIncome - monthlyExpenses),
    monthlyIncome,
    monthlyExpenses,
  };
};

module.exports = {
  DEFAULT_CHART_OF_ACCOUNTS,
  DEFAULT_EXPENSE_CATEGORY_MAPPINGS,
  seedDefaultChartOfAccounts,
  seedDefaultExpenseCategories,
  recordExpense,
  createBill,
  payBill,
  updateOverdueBills,
  createInvoice,
  recordInvoicePayment,
  createQuotation,
  reverseJournalEntry,
  deleteChartOfAccount,
  getProfitLossReport,
  getBalanceSheetReport,
  getTrialBalanceReport,
  getGeneralLedgerReport,
  getCashFlowReport,
  getExpenseReport,
  getDashboardLiveMetrics,
};
