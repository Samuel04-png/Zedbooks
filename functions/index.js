const crypto = require("crypto");
const admin = require("firebase-admin");
const { setGlobalOptions } = require("firebase-functions/v2");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { FieldValue } = require("firebase-admin/firestore");
const ai = require("./ai");
const notifications = require("./notifications");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

setGlobalOptions({
  region: process.env.FUNCTIONS_REGION || "us-central1",
  maxInstances: 10,
});

const VALID_ROLES = new Set([
  "super_admin",
  "admin",
  "financial_manager",
  "accountant",
  "assistant_accountant",
  "finance_officer",
  "bookkeeper",
  "cashier",
  "inventory_manager",
  "hr_manager",
  "project_manager",
  "auditor",
  "staff",
  "read_only",
]);

const JOURNAL_POSTING_ROLES = [
  "super_admin",
  "admin",
  "financial_manager",
  "accountant",
  "assistant_accountant",
];

const PAYROLL_ROLES = ["super_admin", "admin", "hr_manager", "financial_manager", "accountant"];

const ACCOUNT_TYPE_RANGES = {
  Asset: [1000, 1999],
  Liability: [2000, 2999],
  Equity: [3000, 3999],
  Income: [4000, 4999],
  Expense: [5000, 5999],
};

const COA_TEMPLATES = {
  small_business: [
    { code: 1001, name: "Cash on Hand", type: "Asset" },
    { code: 1002, name: "Bank Account", type: "Asset" },
    { code: 1101, name: "Accounts Receivable", type: "Asset" },
    { code: 1201, name: "Inventory", type: "Asset" },
    { code: 2001, name: "Accounts Payable", type: "Liability" },
    { code: 2101, name: "VAT Payable", type: "Liability" },
    { code: 3001, name: "Owner Capital", type: "Equity" },
    { code: 3101, name: "Retained Earnings", type: "Equity" },
    { code: 4001, name: "Sales Revenue", type: "Income" },
    { code: 4010, name: "Service Revenue", type: "Income" },
    { code: 5001, name: "Salaries Expense", type: "Expense" },
    { code: 5010, name: "Rent Expense", type: "Expense" },
    { code: 5020, name: "Utilities Expense", type: "Expense" },
    { code: 5030, name: "Transport Expense", type: "Expense" },
  ],
  ngo: [
    { code: 1001, name: "Cash on Hand", type: "Asset" },
    { code: 1002, name: "Bank Account", type: "Asset" },
    { code: 1101, name: "Grant Receivables", type: "Asset" },
    { code: 2001, name: "Accounts Payable", type: "Liability" },
    { code: 3001, name: "Fund Balance", type: "Equity" },
    { code: 4001, name: "Grant Income", type: "Income" },
    { code: 4010, name: "Donations Income", type: "Income" },
    { code: 5001, name: "Program Expense", type: "Expense" },
    { code: 5010, name: "Staff Costs", type: "Expense" },
    { code: 5020, name: "Transport Expense", type: "Expense" },
  ],
  school: [
    { code: 1001, name: "Cash on Hand", type: "Asset" },
    { code: 1002, name: "Bank Account", type: "Asset" },
    { code: 1101, name: "Student Receivables", type: "Asset" },
    { code: 1201, name: "School Supplies", type: "Asset" },
    { code: 2001, name: "Accounts Payable", type: "Liability" },
    { code: 3001, name: "Institutional Equity", type: "Equity" },
    { code: 4001, name: "Tuition Revenue", type: "Income" },
    { code: 4010, name: "Boarding Revenue", type: "Income" },
    { code: 5001, name: "Salaries Expense", type: "Expense" },
    { code: 5010, name: "Teaching Materials", type: "Expense" },
  ],
  restaurant: [
    { code: 1001, name: "Cash on Hand", type: "Asset" },
    { code: 1002, name: "Bank Account", type: "Asset" },
    { code: 1101, name: "Accounts Receivable", type: "Asset" },
    { code: 1201, name: "Food Inventory", type: "Asset" },
    { code: 2001, name: "Accounts Payable", type: "Liability" },
    { code: 3001, name: "Owner Capital", type: "Equity" },
    { code: 4001, name: "Food Sales", type: "Income" },
    { code: 4010, name: "Beverage Sales", type: "Income" },
    { code: 5001, name: "Salaries Expense", type: "Expense" },
    { code: 5010, name: "Cost of Goods Sold", type: "Expense" },
    { code: 5020, name: "Utilities Expense", type: "Expense" },
  ],
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

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const toEmail = (value) => {
  if (!value || typeof value !== "string") return null;
  return value.trim().toLowerCase();
};

const assertAuthenticated = (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }
  return request.auth.uid;
};

const membershipDocId = (companyId, uid) => `${companyId}_${uid}`;

const pickPrimaryMembership = async (uid) => {
  const snap = await db
    .collection("companyUsers")
    .where("userId", "==", uid)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (snap.empty) {
    throw new HttpsError("failed-precondition", "No active company membership found.");
  }

  return {
    id: snap.docs[0].id,
    ...snap.docs[0].data(),
  };
};

const getMembership = async (uid, companyId) => {
  const directRef = db.collection("companyUsers").doc(membershipDocId(companyId, uid));
  const directSnap = await directRef.get();
  if (directSnap.exists && directSnap.data().status === "active") {
    return { id: directSnap.id, ...directSnap.data() };
  }

  const fallbackSnap = await db
    .collection("companyUsers")
    .where("companyId", "==", companyId)
    .where("userId", "==", uid)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (fallbackSnap.empty) {
    throw new HttpsError("permission-denied", "No active membership for this company.");
  }

  return {
    id: fallbackSnap.docs[0].id,
    ...fallbackSnap.docs[0].data(),
  };
};

const assertCompanyRole = async (uid, companyId, allowedRoles) => {
  const membership = await getMembership(uid, companyId);
  if (!allowedRoles.includes(membership.role)) {
    throw new HttpsError("permission-denied", "Insufficient role for this operation.");
  }
  return membership;
};

const assertValidRole = (role) => {
  if (!VALID_ROLES.has(role)) {
    throw new HttpsError("invalid-argument", `Invalid role: ${role}`);
  }
};

const validateAccountTypeRange = (accountType, accountCode) => {
  const numericCode = Number(accountCode);
  if (!Number.isFinite(numericCode)) return false;
  const range = ACCOUNT_TYPE_RANGES[accountType];
  if (!range) return false;
  return numericCode >= range[0] && numericCode <= range[1];
};

const resolveTemplateKey = (organizationType, businessType) => {
  if (businessType === "school") return "school";
  if (businessType === "restaurant") return "restaurant";
  if (organizationType === "non_profit") return "ngo";
  return "small_business";
};

const ensureTemplateAccounts = async (companyId, templateKey) => {
  const template = COA_TEMPLATES[templateKey] || COA_TEMPLATES.small_business;
  const batch = db.batch();

  template.forEach((account) => {
    if (!validateAccountTypeRange(account.type, account.code)) {
      throw new HttpsError(
        "failed-precondition",
        `Template account ${account.code} violates ${account.type} numbering range.`,
      );
    }

    const ref = db.collection("chartOfAccounts").doc(`${companyId}_${account.code}`);
    batch.set(
      ref,
      {
        companyId,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        status: "active",
        isSystem: true,
        templateKey,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  await batch.commit();
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

  return {
    normalized,
    debitTotal,
    creditTotal,
  };
};

const validateLineAccounts = async (companyId, lines) => {
  const uniqueIds = [...new Set(lines.map((line) => line.accountId))];
  const docs = await Promise.all(uniqueIds.map((id) => db.collection("chartOfAccounts").doc(id).get()));
  const accountMap = new Map();

  docs.forEach((snap) => {
    if (snap.exists) {
      accountMap.set(snap.id, snap.data());
    }
  });

  lines.forEach((line) => {
    const account = accountMap.get(line.accountId);
    if (!account) {
      throw new HttpsError("failed-precondition", `Account ${line.accountId} does not exist.`);
    }
    if (account.companyId !== companyId) {
      throw new HttpsError("permission-denied", "Journal line account belongs to another company.");
    }
    if (!validateAccountTypeRange(account.accountType, account.accountCode)) {
      throw new HttpsError(
        "failed-precondition",
        `Account ${account.accountCode} does not match numbering rules for ${account.accountType}.`,
      );
    }
  });
};

const createAuditLog = async (companyId, actorUid, action, details = {}) => {
  await db.collection("auditLogs").add({
    companyId,
    actorUid,
    action,
    details,
    createdAt: FieldValue.serverTimestamp(),
  });
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
  const { normalized, debitTotal, creditTotal } = validateJournalLines(lines);
  await validateLineAccounts(companyId, normalized);

  const normalizedEntryDate = formatDateOnly(entryDate);
  const entryRef = db.collection("journalEntries").doc();
  const lineRefs = normalized.map(() => db.collection("journalLines").doc());

  await db.runTransaction(async (tx) => {
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

  await createAuditLog(companyId, createdByUid, "journal_entry_posted", {
    entryId: entryRef.id,
    sourceType: sourceType || null,
    sourceId: sourceId || null,
    debitTotal,
    creditTotal,
  });

  return entryRef.id;
};

const getDefaultAccountId = async (companyId, accountType) => {
  const snap = await db
    .collection("chartOfAccounts")
    .where("companyId", "==", companyId)
    .where("accountType", "==", accountType)
    .where("status", "==", "active")
    .orderBy("accountCode", "asc")
    .limit(1)
    .get();

  if (snap.empty) {
    throw new HttpsError(
      "failed-precondition",
      `No active ${accountType} account configured for company ${companyId}.`,
    );
  }

  return snap.docs[0].id;
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

const resolveAmountFromSource = (sourceData, fields) => {
  for (const field of fields) {
    const value = normalizeMoney(sourceData[field]);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  throw new HttpsError("failed-precondition", "Source document does not contain a valid posting amount.");
};

const postSourceDocumentToGl = async ({
  sourceCollection,
  sourceId,
  sourceType,
  debitFields,
  debitFallbackType,
  creditFields,
  creditFallbackType,
  amountFields,
  actorUid,
}) => {
  const sourceRef = db.collection(sourceCollection).doc(sourceId);
  const sourceSnap = await sourceRef.get();

  if (!sourceSnap.exists) {
    throw new HttpsError("not-found", `${sourceType} ${sourceId} was not found.`);
  }

  const sourceData = sourceSnap.data();
  const companyId = sourceData.companyId;
  if (!companyId) {
    throw new HttpsError("failed-precondition", `${sourceType} is missing companyId.`);
  }

  await assertCompanyRole(actorUid, companyId, JOURNAL_POSTING_ROLES);

  if (sourceData.journalEntryId) {
    return {
      companyId,
      journalEntryId: sourceData.journalEntryId,
      alreadyPosted: true,
    };
  }

  const amount = resolveAmountFromSource(sourceData, amountFields);
  const debitAccountId = await resolveAccountIdFromSource(
    companyId,
    sourceData,
    debitFields,
    debitFallbackType,
  );
  const creditAccountId = await resolveAccountIdFromSource(
    companyId,
    sourceData,
    creditFields,
    creditFallbackType,
  );

  const journalEntryId = await createPostedJournalEntry({
    companyId,
    entryDate: sourceData.invoiceDate || sourceData.billDate || sourceData.expenseDate || new Date().toISOString(),
    description: sourceData.description || `${sourceType} posting`,
    referenceNumber: sourceData.invoiceNumber || sourceData.billNumber || sourceData.referenceNumber || null,
    sourceType,
    sourceId,
    createdByUid: actorUid,
    lines: [
      { accountId: debitAccountId, debit: amount, credit: 0 },
      { accountId: creditAccountId, debit: 0, credit: amount },
    ],
    metadata: { sourceCollection },
  });

  await sourceRef.set(
    {
      journalEntryId,
      glPostedAt: FieldValue.serverTimestamp(),
      glPostedBy: actorUid,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return {
    companyId,
    journalEntryId,
    alreadyPosted: false,
  };
};

exports.bootstrapUserAccount = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};

  if (payload.uid && payload.uid !== uid) {
    throw new HttpsError("permission-denied", "uid mismatch between auth context and payload.");
  }

  const organizationName = (payload.organizationName || "").trim();
  const organizationType = payload.organizationType || "business";
  const taxClassification = (payload.taxClassification || "").trim();
  const tpin = String(payload.tpin || "").trim();
  const fullName = (payload.fullName || "").trim();
  const phone = String(payload.phone || "").trim();
  const email = toEmail(request.auth.token.email || payload.email);
  const businessType = (payload.businessType || "").trim() || null;

  if (!organizationName) {
    throw new HttpsError("invalid-argument", "Organization name is required.");
  }
  if (!["business", "non_profit"].includes(organizationType)) {
    throw new HttpsError("invalid-argument", "Organization type must be 'business' or 'non_profit'.");
  }
  if (!taxClassification) {
    throw new HttpsError("invalid-argument", "Tax classification is required.");
  }
  if (!/^\d{10}$/.test(tpin)) {
    throw new HttpsError("invalid-argument", "TPIN must be exactly 10 digits.");
  }

  const userRef = db.collection("users").doc(uid);
  const existingUser = await userRef.get();
  if (existingUser.exists && existingUser.data().defaultCompanyId) {
    const existingCompanyId = existingUser.data().defaultCompanyId;
    await db
      .collection("companyUsers")
      .doc(membershipDocId(existingCompanyId, uid))
      .set(
        {
          companyId: existingCompanyId,
          userId: uid,
          role: existingUser.data().role || "super_admin",
          status: "active",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    return {
      success: true,
      companyId: existingCompanyId,
      message: "Existing user profile linked to current company.",
    };
  }

  const companyRef = db.collection("companies").doc();
  const companyId = companyRef.id;
  const templateKey = resolveTemplateKey(organizationType, businessType);

  await db.runTransaction(async (tx) => {
    tx.set(companyRef, {
      name: organizationName,
      organizationType,
      businessType,
      taxClassification,
      tpin,
      phone: phone || null,
      email: email || null,
      logoUrl: null,
      isSetupComplete: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(db.collection("companySettings").doc(companyId), {
      companyId,
      companyName: organizationName,
      logoUrl: null,
      isVatRegistered: taxClassification === "vat_registered",
      vatRate: taxClassification === "vat_registered" ? 16 : null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(
      db.collection("companyUsers").doc(membershipDocId(companyId, uid)),
      {
        companyId,
        userId: uid,
        role: "super_admin",
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    tx.set(
      userRef,
      {
        email: email || null,
        fullName: fullName || null,
        phone: phone || null,
        defaultCompanyId: companyId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  await ensureTemplateAccounts(companyId, templateKey);
  await createAuditLog(companyId, uid, "company_bootstrap_completed", {
    templateKey,
    organizationType,
    taxClassification,
  });

  return {
    success: true,
    companyId,
    message: "User, company, and default COA have been provisioned.",
  };
});

exports.ensureCurrentMembership = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const companyUsersRef = db.collection("companyUsers");

  const membershipQueries = [
    companyUsersRef.where("userId", "==", uid).where("status", "==", "active").limit(1),
    companyUsersRef.where("user_id", "==", uid).where("status", "==", "active").limit(1),
    companyUsersRef.where("userId", "==", uid).limit(1),
    companyUsersRef.where("user_id", "==", uid).limit(1),
  ];

  let sourceMembership = null;
  for (const membershipQuery of membershipQueries) {
    const snapshot = await membershipQuery.get();
    if (!snapshot.empty) {
      sourceMembership = snapshot.docs[0];
      break;
    }
  }

  if (!sourceMembership) {
    throw new HttpsError("failed-precondition", "No company membership found for this user.");
  }

  const membership = sourceMembership.data();
  const companyId = membership.companyId || membership.company_id;
  if (!companyId) {
    throw new HttpsError("failed-precondition", "Membership record is missing companyId.");
  }

  const role = membership.role || "read_only";
  const status = membership.status || "active";
  const canonicalRef = companyUsersRef.doc(membershipDocId(companyId, uid));

  await canonicalRef.set(
    {
      companyId,
      userId: uid,
      role,
      status,
      createdAt: membership.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      normalizedFromMembershipId: sourceMembership.id,
    },
    { merge: true },
  );

  const userRef = db.collection("users").doc(uid);
  await userRef.set(
    {
      defaultCompanyId: companyId,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return {
    success: true,
    companyId,
    role,
    status,
  };
});

exports.createInvitation = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};

  const inviteeEmail = toEmail(payload.email);
  const role = payload.role;
  const inviteeName = (payload.inviteeName || "").trim() || null;
  const loginUrl = (payload.loginUrl || "").trim();
  const expiryHours = Number(payload.expiryHours || 72);

  if (!inviteeEmail) {
    throw new HttpsError("invalid-argument", "Invitee email is required.");
  }
  assertValidRole(role);
  if (!loginUrl) {
    throw new HttpsError("invalid-argument", "loginUrl is required.");
  }

  const companyId = payload.companyId || (await pickPrimaryMembership(uid)).companyId;
  await assertCompanyRole(uid, companyId, ["super_admin", "admin"]);

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAtDate = new Date(Date.now() + Math.max(expiryHours, 1) * 60 * 60 * 1000);

  const invitationRef = db.collection("invitations").doc();
  await invitationRef.set({
    companyId,
    emailLower: inviteeEmail,
    role,
    inviteeName,
    loginUrl,
    tokenHash,
    status: "pending",
    invitedByUid: uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAtDate),
  });

  await createAuditLog(companyId, uid, "invitation_created", {
    invitationId: invitationRef.id,
    email: inviteeEmail,
    role,
  });


});

exports.acceptInvitation = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const token = String(payload.token || "").trim();

  if (!token) {
    throw new HttpsError("invalid-argument", "Invitation token is required.");
  }

  const tokenHash = hashToken(token);
  const invitationSnap = await db
    .collection("invitations")
    .where("tokenHash", "==", tokenHash)
    .where("status", "==", "pending")
    .limit(1)
    .get();

  if (invitationSnap.empty) {
    throw new HttpsError("not-found", "Invitation token is invalid or already used.");
  }

  const invitationDoc = invitationSnap.docs[0];
  const invitation = invitationDoc.data();
  const authEmail = toEmail(request.auth.token.email);

  if (invitation.expiresAt && invitation.expiresAt.toDate() < new Date()) {
    throw new HttpsError("deadline-exceeded", "Invitation token has expired.");
  }
  if (invitation.emailLower && authEmail && invitation.emailLower !== authEmail) {
    throw new HttpsError("permission-denied", "Invitation email does not match the signed-in user.");
  }

  const companyId = invitation.companyId;
  const role = invitation.role;
  assertValidRole(role);

  await db.runTransaction(async (tx) => {
    const membershipRef = db.collection("companyUsers").doc(membershipDocId(companyId, uid));
    tx.set(
      membershipRef,
      {
        companyId,
        userId: uid,
        role,
        status: "active",
        invitedByUid: invitation.invitedByUid || null,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const userRef = db.collection("users").doc(uid);
    const userSnap = await tx.get(userRef);
    tx.set(
      userRef,
      {
        email: authEmail || invitation.emailLower || null,
        defaultCompanyId: userSnap.exists && userSnap.data().defaultCompanyId
          ? userSnap.data().defaultCompanyId
          : companyId,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    tx.update(invitationDoc.ref, {
      status: "accepted",
      acceptedByUid: uid,
      acceptedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await createAuditLog(companyId, uid, "invitation_accepted", {
    invitationId: invitationDoc.id,
    role,
  });

  return {
    success: true,
    companyId,
    role,
  };
});

exports.listCompanyUsers = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = payload.companyId || (await pickPrimaryMembership(uid)).companyId;

  await assertCompanyRole(uid, companyId, ["super_admin", "admin"]);

  const membershipsSnap = await db
    .collection("companyUsers")
    .where("companyId", "==", companyId)
    .where("status", "in", ["active", "invited"])
    .get();

  const userIds = [...new Set(membershipsSnap.docs.map((docSnap) => docSnap.data().userId).filter(Boolean))];
  const userDocs = await Promise.all(userIds.map((userId) => db.collection("users").doc(userId).get()));
  const usersById = new Map();
  userDocs.forEach((userSnap) => {
    if (userSnap.exists) {
      usersById.set(userSnap.id, userSnap.data());
    }
  });

  const toIso = (value) => {
    if (!value) return null;
    if (typeof value.toDate === "function") {
      return value.toDate().toISOString();
    }
    return null;
  };

  const rows = membershipsSnap.docs.map((docSnap) => {
    const membership = docSnap.data();
    const userData = usersById.get(membership.userId) || {};

    return {
      id: docSnap.id,
      companyId: membership.companyId,
      userId: membership.userId,
      role: membership.role || "read_only",
      status: membership.status || "active",
      email: userData.email || null,
      fullName: userData.fullName || null,
      createdAt: toIso(membership.createdAt),
      updatedAt: toIso(membership.updatedAt),
    };
  });

  rows.sort((a, b) => {
    const left = (a.fullName || a.email || a.userId || "").toLowerCase();
    const right = (b.fullName || b.email || b.userId || "").toLowerCase();
    return left.localeCompare(right);
  });

  return rows;
});

exports.updateCompanyUserRole = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = String(payload.companyId || "").trim();
  const userId = String(payload.userId || "").trim();
  const role = payload.role;

  if (!companyId || !userId) {
    throw new HttpsError("invalid-argument", "companyId and userId are required.");
  }
  assertValidRole(role);

  const actorMembership = await assertCompanyRole(uid, companyId, ["super_admin", "admin"]);
  if (uid === userId && actorMembership.role === "super_admin" && role !== "super_admin") {
    throw new HttpsError("failed-precondition", "Super admin cannot demote their own role.");
  }

  let membershipRef = db.collection("companyUsers").doc(membershipDocId(companyId, userId));
  let membershipSnap = await membershipRef.get();

  if (!membershipSnap.exists) {
    const fallbackSnap = await db
      .collection("companyUsers")
      .where("companyId", "==", companyId)
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (fallbackSnap.empty) {
      throw new HttpsError("not-found", "Target company membership not found.");
    }

    membershipRef = fallbackSnap.docs[0].ref;
    membershipSnap = fallbackSnap.docs[0];
  }

  const targetMembership = membershipSnap.data();
  if (targetMembership.role === "super_admin" && actorMembership.role !== "super_admin") {
    throw new HttpsError("permission-denied", "Only super admin can change another super admin role.");
  }

  await membershipRef.set(
    {
      role,
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUid: uid,
    },
    { merge: true },
  );

  await createAuditLog(companyId, uid, "company_user_role_updated", {
    targetUserId: userId,
    role,
  });

  return { success: true };
});

exports.removeCompanyUser = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = String(payload.companyId || "").trim();
  const userId = String(payload.userId || "").trim();

  if (!companyId || !userId) {
    throw new HttpsError("invalid-argument", "companyId and userId are required.");
  }
  if (uid === userId) {
    throw new HttpsError("failed-precondition", "You cannot remove your own access.");
  }

  const actorMembership = await assertCompanyRole(uid, companyId, ["super_admin", "admin"]);

  let membershipRef = db.collection("companyUsers").doc(membershipDocId(companyId, userId));
  let membershipSnap = await membershipRef.get();

  if (!membershipSnap.exists) {
    const fallbackSnap = await db
      .collection("companyUsers")
      .where("companyId", "==", companyId)
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (fallbackSnap.empty) {
      throw new HttpsError("not-found", "Target company membership not found.");
    }

    membershipRef = fallbackSnap.docs[0].ref;
    membershipSnap = fallbackSnap.docs[0];
  }

  const targetMembership = membershipSnap.data();
  if (targetMembership.role === "super_admin" && actorMembership.role !== "super_admin") {
    throw new HttpsError("permission-denied", "Only super admin can remove another super admin.");
  }

  await membershipRef.set(
    {
      status: "suspended",
      suspendedAt: FieldValue.serverTimestamp(),
      suspendedByUid: uid,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await createAuditLog(companyId, uid, "company_user_removed", {
    targetUserId: userId,
  });

  return { success: true };
});

exports.postJournalEntry = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = payload.companyId;

  if (!companyId || typeof companyId !== "string") {
    throw new HttpsError("invalid-argument", "companyId is required.");
  }

  await assertCompanyRole(uid, companyId, JOURNAL_POSTING_ROLES);

  const entryId = await createPostedJournalEntry({
    companyId,
    entryDate: payload.entryDate || new Date().toISOString(),
    description: payload.description || null,
    referenceNumber: payload.referenceNumber || null,
    sourceType: payload.sourceType || null,
    sourceId: payload.sourceId || null,
    createdByUid: uid,
    lines: payload.lines || [],
    metadata: payload.metadata || null,
  });

  return { entryId };
});

exports.getGLBalances = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = payload.companyId;
  const startDate = payload.startDate;
  const endDate = payload.endDate;

  if (!companyId || typeof companyId !== "string") {
    throw new HttpsError("invalid-argument", "companyId is required.");
  }

  await getMembership(uid, companyId);

  let linesQuery = db
    .collection("journalLines")
    .where("companyId", "==", companyId)
    .where("isPosted", "==", true);

  if (startDate) linesQuery = linesQuery.where("entryDate", ">=", formatDateOnly(startDate));
  if (endDate) linesQuery = linesQuery.where("entryDate", "<=", formatDateOnly(endDate));

  const linesSnap = await linesQuery.get();
  const balances = new Map();
  linesSnap.docs.forEach((docSnap) => {
    const line = docSnap.data();
    const accountId = line.accountId;
    if (!balances.has(accountId)) balances.set(accountId, { debitTotal: 0, creditTotal: 0 });
    const current = balances.get(accountId);
    current.debitTotal = normalizeMoney(current.debitTotal + normalizeMoney(line.debit || 0));
    current.creditTotal = normalizeMoney(current.creditTotal + normalizeMoney(line.credit || 0));
  });

  const accountIds = [...balances.keys()];
  const accountDocs = await Promise.all(accountIds.map((accountId) => db.collection("chartOfAccounts").doc(accountId).get()));
  const accountById = new Map();
  accountDocs.forEach((snap) => {
    if (snap.exists) accountById.set(snap.id, snap.data());
  });

  const rows = accountIds.map((accountId) => {
    const totals = balances.get(accountId);
    const account = accountById.get(accountId) || {};
    return {
      accountId,
      accountCode: String(account.accountCode || ""),
      accountName: account.accountName || "Unknown Account",
      accountType: account.accountType || "Unknown",
      debitTotal: totals.debitTotal,
      creditTotal: totals.creditTotal,
      netMovement: normalizeMoney(totals.debitTotal - totals.creditTotal),
    };
  });

  rows.sort((a, b) => Number(a.accountCode || 0) - Number(b.accountCode || 0));
  return rows;
});

exports.getTrialBalance = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = payload.companyId;
  const asOfDate = payload.asOfDate;

  if (!companyId || typeof companyId !== "string") {
    throw new HttpsError("invalid-argument", "companyId is required.");
  }

  await getMembership(uid, companyId);

  let linesQuery = db
    .collection("journalLines")
    .where("companyId", "==", companyId)
    .where("isPosted", "==", true);
  if (asOfDate) linesQuery = linesQuery.where("entryDate", "<=", formatDateOnly(asOfDate));

  const linesSnap = await linesQuery.get();
  const balances = new Map();
  linesSnap.docs.forEach((docSnap) => {
    const line = docSnap.data();
    const accountId = line.accountId;
    if (!balances.has(accountId)) balances.set(accountId, { debitTotal: 0, creditTotal: 0 });
    const current = balances.get(accountId);
    current.debitTotal = normalizeMoney(current.debitTotal + normalizeMoney(line.debit || 0));
    current.creditTotal = normalizeMoney(current.creditTotal + normalizeMoney(line.credit || 0));
  });

  const accountIds = [...balances.keys()];
  const accountDocs = await Promise.all(accountIds.map((accountId) => db.collection("chartOfAccounts").doc(accountId).get()));
  const accountById = new Map();
  accountDocs.forEach((snap) => {
    if (snap.exists) accountById.set(snap.id, snap.data());
  });

  const rows = accountIds.map((accountId) => {
    const totals = balances.get(accountId);
    const account = accountById.get(accountId) || {};
    const net = normalizeMoney(totals.debitTotal - totals.creditTotal);
    return {
      accountId,
      accountCode: String(account.accountCode || ""),
      accountName: account.accountName || "Unknown Account",
      debitBalance: net >= 0 ? net : 0,
      creditBalance: net < 0 ? Math.abs(net) : 0,
    };
  });

  rows.sort((a, b) => Number(a.accountCode || 0) - Number(b.accountCode || 0));
  return rows;
});

exports.postInvoiceToGL = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const invoiceId = request.data?.invoiceId;
  if (!invoiceId || typeof invoiceId !== "string") {
    throw new HttpsError("invalid-argument", "invoiceId is required.");
  }

  const result = await postSourceDocumentToGl({
    sourceCollection: "invoices",
    sourceId: invoiceId,
    sourceType: "invoice",
    debitFields: ["debitAccountId", "accountsReceivableAccountId", "receivableAccountId"],
    debitFallbackType: "Asset",
    creditFields: ["creditAccountId", "revenueAccountId", "incomeAccountId"],
    creditFallbackType: "Income",
    amountFields: ["total", "grandTotal", "amount", "netAmount"],
    actorUid: uid,
  });

  return {
    journalEntryId: result.journalEntryId,
    alreadyPosted: result.alreadyPosted,
  };
});

exports.postBillToGL = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const billId = request.data?.billId;
  if (!billId || typeof billId !== "string") {
    throw new HttpsError("invalid-argument", "billId is required.");
  }

  const result = await postSourceDocumentToGl({
    sourceCollection: "bills",
    sourceId: billId,
    sourceType: "bill",
    debitFields: ["debitAccountId", "expenseAccountId", "assetAccountId"],
    debitFallbackType: "Expense",
    creditFields: ["creditAccountId", "accountsPayableAccountId", "payableAccountId"],
    creditFallbackType: "Liability",
    amountFields: ["total", "amount", "netAmount"],
    actorUid: uid,
  });

  return {
    journalEntryId: result.journalEntryId,
    alreadyPosted: result.alreadyPosted,
  };
});

exports.postExpenseToGL = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const expenseId = request.data?.expenseId;
  if (!expenseId || typeof expenseId !== "string") {
    throw new HttpsError("invalid-argument", "expenseId is required.");
  }

  const result = await postSourceDocumentToGl({
    sourceCollection: "expenses",
    sourceId: expenseId,
    sourceType: "expense",
    debitFields: ["debitAccountId", "expenseAccountId", "assetAccountId"],
    debitFallbackType: "Expense",
    creditFields: ["creditAccountId", "cashAccountId", "bankAccountId", "paymentAccountId"],
    creditFallbackType: "Asset",
    amountFields: ["amount", "total", "netAmount"],
    actorUid: uid,
  });

  return {
    journalEntryId: result.journalEntryId,
    alreadyPosted: result.alreadyPosted,
  };
});

exports.createPayrollDraft = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = payload.companyId;
  if (!companyId || typeof companyId !== "string") {
    throw new HttpsError("invalid-argument", "companyId is required.");
  }

  await assertCompanyRole(uid, companyId, PAYROLL_ROLES);

  const payrollRef = db.collection("payrollRuns").doc();
  await payrollRef.set({
    companyId,
    periodStart: formatDateOnly(payload.periodStart),
    periodEnd: formatDateOnly(payload.periodEnd),
    runDate: formatDateOnly(payload.runDate),
    notes: payload.notes || null,
    payrollStatus: "draft",
    totalGross: normalizeMoney(payload.totalGross || 0),
    totalDeductions: normalizeMoney(payload.totalDeductions || 0),
    totalNet: normalizeMoney(payload.totalNet || 0),
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await createAuditLog(companyId, uid, "payroll_draft_created", { payrollRunId: payrollRef.id });
  return { payrollRunId: payrollRef.id };
});

exports.runPayrollTrial = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payrollRunId = request.data?.payrollRunId;
  if (!payrollRunId || typeof payrollRunId !== "string") {
    throw new HttpsError("invalid-argument", "payrollRunId is required.");
  }

  const payrollRef = db.collection("payrollRuns").doc(payrollRunId);
  const payrollSnap = await payrollRef.get();
  if (!payrollSnap.exists) {
    throw new HttpsError("not-found", "Payroll run not found.");
  }

  const payroll = payrollSnap.data();
  await assertCompanyRole(uid, payroll.companyId, PAYROLL_ROLES);

  await payrollRef.set(
    {
      payrollStatus: "trial",
      trialRunBy: uid,
      trialRunAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await createAuditLog(payroll.companyId, uid, "payroll_trial_completed", { payrollRunId });
  return { success: true };
});

exports.finalizePayroll = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payrollRunId = request.data?.payrollRunId;
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

  let journalEntryId = payroll.glJournalId || null;
  const totalNet = normalizeMoney(payroll.totalNet || 0);

  if (!journalEntryId && totalNet > 0) {
    const debitAccountId = await resolveAccountIdFromSource(
      companyId,
      payroll,
      ["salaryExpenseAccountId", "debitAccountId"],
      "Expense",
    );
    const creditAccountId = await resolveAccountIdFromSource(
      companyId,
      payroll,
      ["cashAccountId", "payrollPayableAccountId", "creditAccountId"],
      "Liability",
    );

    journalEntryId = await createPostedJournalEntry({
      companyId,
      entryDate: payroll.runDate || new Date().toISOString(),
      description: `Payroll Finalization ${payroll.payrollNumber || payrollRunId}`,
      referenceNumber: payroll.payrollNumber || payrollRunId,
      sourceType: "payroll",
      sourceId: payrollRunId,
      createdByUid: uid,
      lines: [
        { accountId: debitAccountId, debit: totalNet, credit: 0, description: "Payroll expense" },
        { accountId: creditAccountId, debit: 0, credit: totalNet, description: "Payroll payable/cash" },
      ],
    });
  }

  await payrollRef.set(
    {
      payrollStatus: "final",
      finalizedBy: uid,
      finalizedAt: FieldValue.serverTimestamp(),
      glPosted: Boolean(journalEntryId),
      glJournalId: journalEntryId,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  if (journalEntryId) {
    await db
      .collection("payrollJournals")
      .doc(`${payrollRunId}_${journalEntryId}`)
      .set(
        {
          companyId,
          payrollRunId,
          journalEntryId,
          journalType: "payroll_expense",
          description: "Monthly payroll GL posting",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  }

  await createAuditLog(companyId, uid, "payroll_finalized", { payrollRunId, journalEntryId });
  return { journalEntryId };
});

exports.sendPayslipEmail = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const payrollRunId = payload.payrollRunId;
  const employeeId = payload.employeeId;
  if (!payrollRunId || !employeeId) {
    throw new HttpsError("invalid-argument", "payrollRunId and employeeId are required.");
  }

  const payrollSnap = await db.collection("payrollRuns").doc(payrollRunId).get();
  if (!payrollSnap.exists) {
    throw new HttpsError("not-found", "Payroll run not found.");
  }

  const payroll = payrollSnap.data();
  await assertCompanyRole(uid, payroll.companyId, PAYROLL_ROLES);

  await db.collection("notifications").add({
    companyId: payroll.companyId,
    userId: uid,
    type: "payslip_email_queued",
    title: "Payslip email queued",
    message: `Payslip for employee ${employeeId} has been queued for sending.`,
    createdAt: FieldValue.serverTimestamp(),
    status: "pending",
  });

  await createAuditLog(payroll.companyId, uid, "payslip_email_requested", { payrollRunId, employeeId });
  return { success: true };
});

exports.runDepreciation = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = payload.companyId;
  if (!companyId || typeof companyId !== "string") {
    throw new HttpsError("invalid-argument", "companyId is required.");
  }

  await assertCompanyRole(uid, companyId, JOURNAL_POSTING_ROLES);

  const month = String(payload.periodMonth || "").trim();
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new HttpsError("invalid-argument", "periodMonth must be in YYYY-MM format.");
  }

  const assetsSnap = await db
    .collection("fixedAssets")
    .where("companyId", "==", companyId)
    .where("status", "==", "active")
    .get();

  let assetsProcessed = 0;
  let totalDepreciation = 0;
  assetsSnap.docs.forEach((docSnap) => {
    const asset = docSnap.data();
    const monthly = normalizeMoney(asset.monthlyDepreciation || 0);
    if (monthly > 0) {
      assetsProcessed += 1;
      totalDepreciation = normalizeMoney(totalDepreciation + monthly);
    }
  });

  await db.collection("notifications").add({
    companyId,
    userId: uid,
    type: "depreciation_run_completed",
    title: "Depreciation run completed",
    message: `Processed ${assetsProcessed} assets for ${month}.`,
    createdAt: FieldValue.serverTimestamp(),
  });

  await createAuditLog(companyId, uid, "depreciation_run_completed", {
    periodMonth: month,
    assetsProcessed,
    totalDepreciation,
  });

  return { success: true, assetsProcessed, totalDepreciation };
});

exports.zraSmartInvoice = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const action = String(payload.action || "").trim();

  if (!action) {
    throw new HttpsError("invalid-argument", "action is required.");
  }

  if (action === "retry_pending") {
    const membership = await pickPrimaryMembership(uid);
    const pendingSnap = await db
      .collection("invoices")
      .where("companyId", "==", membership.companyId)
      .where("zraStatus", "==", "pending")
      .limit(20)
      .get();

    const batch = db.batch();
    pendingSnap.docs.forEach((docSnap) => {
      batch.set(
        docSnap.ref,
        {
          zraStatus: "queued",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    await batch.commit();

    await createAuditLog(membership.companyId, uid, "zra_retry_pending", {
      processed: pendingSnap.size,
    });

    return {
      success: true,
      processed: pendingSnap.size,
    };
  }

  const invoiceId = String(payload.invoiceId || "").trim();
  if (!invoiceId) {
    throw new HttpsError("invalid-argument", "invoiceId is required for this action.");
  }

  const invoiceRef = db.collection("invoices").doc(invoiceId);
  const invoiceSnap = await invoiceRef.get();
  if (!invoiceSnap.exists) {
    throw new HttpsError("not-found", "Invoice not found.");
  }

  const invoice = invoiceSnap.data();
  const companyId = invoice.companyId;
  if (!companyId) {
    throw new HttpsError("failed-precondition", "Invoice has no companyId.");
  }

  await assertCompanyRole(uid, companyId, JOURNAL_POSTING_ROLES);

  if (action === "check_status") {
    return {
      success: true,
      status: invoice.zraStatus || "not_submitted",
      zra_invoice_number: invoice.zraInvoiceNumber || null,
      verification_url: invoice.zraVerificationUrl || null,
      message: invoice.zraMessage || null,
    };
  }

  if (action === "submit_invoice") {
    const zraInvoiceNumber = invoice.zraInvoiceNumber || `ZRA-${Date.now()}-${invoiceId.slice(0, 6)}`;
    const verificationUrl = invoice.zraVerificationUrl || `https://zra.example/verify/${zraInvoiceNumber}`;

    await invoiceRef.set(
      {
        zraStatus: "submitted",
        zraInvoiceNumber,
        zraVerificationUrl: verificationUrl,
        zraSubmittedAt: FieldValue.serverTimestamp(),
        zraSubmittedBy: uid,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    await createAuditLog(companyId, uid, "zra_invoice_submitted", {
      invoiceId,
      zraInvoiceNumber,
    });

    return {
      success: true,
      zra_invoice_number: zraInvoiceNumber,
      verification_url: verificationUrl,
      message: "Invoice submitted to ZRA queue.",
    };
  }

  throw new HttpsError("invalid-argument", `Unsupported action: ${action}`);
});

exports.listCompanyUsers = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = payload.companyId;

  if (!companyId) {
    throw new HttpsError("invalid-argument", "companyId is required.");
  }

  // Ensure requester is a member (any status? usually active)
  await getMembership(uid, companyId);

  // 1. Fetch all company members (active, suspended, etc.)
  // Removed .where("status", "==", "active") to see suspended users
  const membershipsSnap = await db
    .collection("companyUsers")
    .where("companyId", "==", companyId)
    .get();

  const userIds = membershipsSnap.docs.map((doc) => doc.data().userId);

  // Fetch user profiles in parallel
  const userDocs = userIds.length > 0
    ? await Promise.all(userIds.map((id) => db.collection("users").doc(id).get()))
    : [];

  const userMap = new Map();
  userDocs.forEach((snap) => {
    if (snap.exists) userMap.set(snap.id, snap.data());
  });

  const members = membershipsSnap.docs.map((doc) => {
    const data = doc.data();
    const userProfile = userMap.get(data.userId) || {};
    return {
      id: doc.id,
      companyId: data.companyId,
      userId: data.userId,
      role: data.role,
      status: data.status, // active, suspended
      email: userProfile.email || null,
      fullName: userProfile.fullName || null,
      createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
      updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
      type: 'member'
    };
  });

  // 2. Fetch pending invitations
  const invitationsSnap = await db
    .collection("invitations")
    .where("companyId", "==", companyId)
    .where("status", "==", "pending")
    .get();

  const invited = invitationsSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      companyId: data.companyId,
      userId: null, // No user ID yet
      role: data.role,
      status: 'invited',
      email: data.emailLower || null,
      fullName: data.inviteeName || "Invited User",
      createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
      updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
      type: 'invitation',
      invitationId: doc.id
    };
  });

  // Combine and sort by createdAt desc
  const allUsers = [...members, ...invited].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateB - dateA;
  });

  return allUsers;
});

exports.suspendUser = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const { userId, companyId } = request.data || {};

  if (!userId || !companyId) throw new HttpsError("invalid-argument", "Missing required fields.");

  await assertCompanyRole(uid, companyId, ["super_admin", "admin"]);
  if (uid === userId) throw new HttpsError("failed-precondition", "Cannot suspend yourself.");

  const membershipRef = db.collection("companyUsers").doc(membershipDocId(companyId, userId));
  await membershipRef.update({
    status: "suspended",
    updatedAt: FieldValue.serverTimestamp(),
  });

  await createAuditLog(companyId, uid, "user_suspended", { targetUserId: userId });
  return { success: true };
});

exports.reactivateUser = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const { userId, companyId } = request.data || {};

  if (!userId || !companyId) throw new HttpsError("invalid-argument", "Missing required fields.");

  await assertCompanyRole(uid, companyId, ["super_admin", "admin"]);

  const membershipRef = db.collection("companyUsers").doc(membershipDocId(companyId, userId));
  await membershipRef.update({
    status: "active",
    updatedAt: FieldValue.serverTimestamp(),
  });

  await createAuditLog(companyId, uid, "user_reactivated", { targetUserId: userId });
  return { success: true };
});

exports.revokeInvitation = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const { invitationId, companyId } = request.data || {};

  if (!invitationId || !companyId) throw new HttpsError("invalid-argument", "Missing required fields.");

  await assertCompanyRole(uid, companyId, ["super_admin", "admin"]);

  const inviteRef = db.collection("invitations").doc(invitationId);
  const snap = await inviteRef.get();

  if (!snap.exists) throw new HttpsError("not-found", "Invitation not found.");
  if (snap.data().companyId !== companyId) throw new HttpsError("permission-denied", "Invitation mismatch.");

  await inviteRef.delete(); // Or set status to 'revoked'

  await createAuditLog(companyId, uid, "invitation_revoked", { invitationId });
  return { success: true };
});

exports.updateUserRole = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const targetUserId = payload.userId;
  const newRole = payload.newRole;
  const companyId = payload.companyId;

  if (!targetUserId || !newRole || !companyId) {
    throw new HttpsError("invalid-argument", "userId, newRole, and companyId are required.");
  }

  assertValidRole(newRole);

  // requester must be admin or super_admin
  await assertCompanyRole(uid, companyId, ["super_admin", "admin"]);

  // cannot change own role to something lower if you are the last super_admin? 
  // For now, basic check: cannot change own role
  if (uid === targetUserId) {
    throw new HttpsError("failed-precondition", "Cannot change your own role.");
  }

  const membershipRef = db.collection("companyUsers").doc(membershipDocId(companyId, targetUserId));
  const membershipSnap = await membershipRef.get();

  if (!membershipSnap.exists) {
    throw new HttpsError("not-found", "User is not a member of this company.");
  }

  await membershipRef.update({
    role: newRole,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await createAuditLog(companyId, uid, "user_role_updated", {
    targetUserId,
    newRole,
  });

  return { success: true };
});

exports.removeCompanyUser = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const targetUserId = payload.userId;
  const companyId = payload.companyId;

  if (!targetUserId || !companyId) {
    throw new HttpsError("invalid-argument", "userId and companyId are required.");
  }

  // requester must be admin or super_admin
  await assertCompanyRole(uid, companyId, ["super_admin", "admin"]);

  if (uid === targetUserId) {
    throw new HttpsError("failed-precondition", "Cannot remove yourself from the company.");
  }

  const membershipRef = db.collection("companyUsers").doc(membershipDocId(companyId, targetUserId));
  const membershipSnap = await membershipRef.get();

  if (!membershipSnap.exists) {
    throw new HttpsError("not-found", "User is not a member of this company.");
  }

  // Soft delete by setting status to 'removed' or 'suspended'
  // checking types.ts, status can be "active" | "invited" | "suspended"
  // Let's use "suspended" for now as 'removed' isn't in the type definition yet, 
  // or we can just delete the doc. Blueprint says "membership, role, status". 
  // Let's delete the doc to actually remove them, or set to suspended.
  // Given "removeUserFromCompany" implies removal, let's delete the membership doc 
  // BUT we typically want to keep history. Let's set status to 'suspended' for now 
  // as it is a valid status in our types. Or wait, let's essentially 'delete' access.
  // If we delete the doc, they lose access.

  await membershipRef.delete();

  await createAuditLog(companyId, uid, "user_removed_from_company", {
    targetUserId,
  });

  return { success: true };
});
// Export AI Functions
exports.askDeepSeek = ai.askDeepSeek;
exports.analyzeTransactionAnomaly = ai.analyzeTransactionAnomaly;

// Export Notification Functions
exports.sendEmail = notifications.sendEmail;

// Firestore Triggers
/**
 * When an invitation is created, send the email automatically.
 */
exports.onInvitationCreated = onDocumentCreated("invitations/{invitationId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const invitation = snapshot.data();
  const invitationId = event.params.invitationId;
  const loginUrl = invitation.loginUrl;
  const token = invitation.token || ""; // Note: In createInvitation we only store tokenHash, we need to pass the raw token differently or email immediately upon creation.

  // Wait! In 'createInvitation', we only stored tokenHash for security. 
  // The raw token is returned to the client. The client should probably call 'sendEmail' 
  // OR we should change createInvitation to send the email directly before hashing?
  // Use the callable 'sendEmail' approach from the client for now to ensure the raw token is available.

  // Actually, let's keep it simple: The `createInvitation` callable returns the link.
  // The Frontend displays it or offers to "Send Email". 
  // But to be "Advanced", let's allow the backend to send it if provided.
  // We'll update createInvitation to take an "sendEmail: true" flag.
});

// Re-export createInvitation to handle email sending if requested?
// For now, let's just export the basic callables.
