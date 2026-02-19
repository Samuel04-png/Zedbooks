const crypto = require("crypto");
const admin = require("firebase-admin");
const { setGlobalOptions } = require("firebase-functions/v2");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { FieldValue } = require("firebase-admin/firestore");
const ai = require("./ai");
const notifications = require("./notifications");
const accounting = require("./accounting");
const payroll = require("./payroll");
const accountingEngine = require("./accountingEngine");

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

const COMMERCIAL_ROLES = [
  "super_admin",
  "admin",
  "financial_manager",
  "accountant",
  "assistant_accountant",
  "finance_officer",
  "bookkeeper",
  "cashier",
];

const PAYROLL_ROLES = ["super_admin", "admin", "hr_manager", "financial_manager", "accountant"];

const ACCOUNT_TYPE_RANGES = {
  Asset: [1000, 19999],
  Liability: [2000, 29999],
  Equity: [3000, 39999],
  Income: [4000, 49999],
  Expense: [5000, 99999],
};

const COA_TEMPLATES = {
  small_business: [
    // ASSETS (1000-1999)
    { code: 1000, name: "Cash", type: "Asset", description: "Cash on hand - primary" },
    { code: 1010, name: "Petty Cash", type: "Asset", description: "Small cash float for minor expenses" },
    { code: 1020, name: "Bank Account - Operating", type: "Asset", description: "Main business checking account" },
    { code: 1025, name: "Bank Account - Savings", type: "Asset", description: "Business savings account" },
    { code: 1100, name: "Accounts Receivable", type: "Asset", description: "Money owed by customers" },
    { code: 1200, name: "Inventory", type: "Asset", description: "Value of goods held for sale" },
    { code: 1300, name: "Prepaid Expenses", type: "Asset", description: "Expenses paid in advance" },
    { code: 1310, name: "Prepaid Rent", type: "Asset", description: "Rent paid in advance" },
    { code: 1320, name: "Prepaid Insurance", type: "Asset", description: "Insurance premiums paid in advance" },
    { code: 1400, name: "Fixed Assets - Equipment", type: "Asset", description: "Office and business equipment" },
    { code: 1410, name: "Fixed Assets - Vehicles", type: "Asset", description: "Company vehicles" },
    { code: 1420, name: "Fixed Assets - Furniture", type: "Asset", description: "Office furniture and fixtures" },
    { code: 1450, name: "Accumulated Depreciation - Equipment", type: "Asset", description: "Accumulated depreciation on equipment" },
    { code: 1460, name: "Accumulated Depreciation - Vehicles", type: "Asset", description: "Accumulated depreciation on vehicles" },

    // LIABILITIES (2000-2999)
    { code: 2000, name: "Accounts Payable", type: "Liability", description: "Outstanding bills to vendors" },
    { code: 2100, name: "Salaries Payable", type: "Liability", description: "Unpaid employee salaries" },
    { code: 2200, name: "Tax Payable - VAT", type: "Liability", description: "Value Added Tax collected and due" },
    { code: 2210, name: "Tax Payable - PAYE", type: "Liability", description: "Pay As You Earn tax withholding" },
    { code: 2220, name: "Tax Payable - NAPSA", type: "Liability", description: "National Pension Scheme contributions" },
    { code: 2230, name: "Tax Payable - NHIMA", type: "Liability", description: "Health insurance contributions" },
    { code: 2300, name: "Loans Payable - Short Term", type: "Liability", description: "Short-term loans and credit" },
    { code: 2310, name: "Loans Payable - Long Term", type: "Liability", description: "Long-term business loans" },
    { code: 2400, name: "Customer Deposits", type: "Liability", description: "Advance payments from customers" },
    { code: 2500, name: "Accrued Expenses", type: "Liability", description: "Expenses incurred but not yet paid" },

    // EQUITY (3000-3999)
    { code: 3000, name: "Owner's Capital", type: "Equity", description: "Capital invested by the owner" },
    { code: 3100, name: "Retained Earnings", type: "Equity", description: "Accumulated profits" },
    { code: 3200, name: "Drawings", type: "Equity", description: "Owner withdrawals from business" },
    { code: 3900, name: "Current Year Earnings", type: "Equity", description: "Profits for the current year" },

    // INCOME (4000-4999)
    { code: 4000, name: "Sales Revenue", type: "Income", description: "Income from product sales" },
    { code: 4100, name: "Service Revenue", type: "Income", description: "Income from services rendered" },
    { code: 4200, name: "Interest Income", type: "Income", description: "Interest earned on savings/investments" },
    { code: 4300, name: "Other Income", type: "Income", description: "Miscellaneous income" },
    { code: 4400, name: "Rental Income", type: "Income", description: "Income from property rentals" },

    // EXPENSES (5000-5999)
    { code: 5000, name: "Salaries Expense", type: "Expense", description: "Employee wages and salaries" },
    { code: 5010, name: "PAYE Expense", type: "Expense", description: "Employer PAYE contributions" },
    { code: 5020, name: "NAPSA Expense", type: "Expense", description: "Employer pension contributions" },
    { code: 5030, name: "NHIMA Expense", type: "Expense", description: "Employer health insurance contributions" },
    { code: 5100, name: "Rent Expense", type: "Expense", description: "Office or building rent" },
    { code: 5110, name: "Utilities - Electricity", type: "Expense", description: "Electricity bills" },
    { code: 5120, name: "Utilities - Water", type: "Expense", description: "Water bills" },
    { code: 5130, name: "Utilities - Internet", type: "Expense", description: "Internet and telecommunications" },
    { code: 5200, name: "Fuel Expense", type: "Expense", description: "Vehicle fuel costs" },
    { code: 5210, name: "Vehicle Maintenance", type: "Expense", description: "Vehicle repairs and servicing" },
    { code: 5300, name: "Office Supplies", type: "Expense", description: "General office supplies" },
    { code: 5310, name: "Stationery", type: "Expense", description: "Paper, pens, and stationery" },
    { code: 5400, name: "Professional Services", type: "Expense", description: "Consultants and professional fees" },
    { code: 5410, name: "Legal Fees", type: "Expense", description: "Attorney and legal costs" },
    { code: 5420, name: "Accounting Fees", type: "Expense", description: "Accountant and audit fees" },
    { code: 5500, name: "Marketing & Advertising", type: "Expense", description: "Promotional and advertising costs" },
    { code: 5600, name: "Travel Expense", type: "Expense", description: "Business travel costs" },
    { code: 5610, name: "Meals & Entertainment", type: "Expense", description: "Client meals and entertainment" },
    { code: 5700, name: "Insurance Expense", type: "Expense", description: "Business insurance premiums" },
    { code: 5800, name: "Bank Charges", type: "Expense", description: "Bank fees and charges" },
    { code: 5810, name: "Interest Expense", type: "Expense", description: "Interest on loans and credit" },
    { code: 5900, name: "Depreciation Expense", type: "Expense", description: "Depreciation of fixed assets" },
    { code: 5910, name: "Bad Debt Expense", type: "Expense", description: "Uncollectible customer accounts" },
    { code: 5920, name: "Repairs & Maintenance", type: "Expense", description: "General repairs and upkeep" },
    { code: 5930, name: "Training & Development", type: "Expense", description: "Employee training costs" },
    { code: 5940, name: "Licenses & Permits", type: "Expense", description: "Business licenses and permits" },
    { code: 5950, name: "Security Services", type: "Expense", description: "Security guard and alarm costs" },
    { code: 5960, name: "Cleaning Services", type: "Expense", description: "Janitorial and cleaning expenses" },
    { code: 5999, name: "Miscellaneous Expense", type: "Expense", description: "Other uncategorized expenses" },
  ],
  ngo: [
    { code: 1001, name: "Cash on Hand", type: "Asset", description: "Petty cash for daily operations" },
    { code: 1002, name: "Bank Account", type: "Asset", description: "Main bank account for grants" },
    { code: 1101, name: "Grant Receivables", type: "Asset", description: "Grants awarded but not yet received" },
    { code: 2001, name: "Accounts Payable", type: "Liability", description: "Unpaid vendor invoices" },
    { code: 3001, name: "Fund Balance", type: "Equity", description: "Net assets available for use" },
    { code: 4001, name: "Grant Income", type: "Income", description: "Revenue from grants" },
    { code: 4010, name: "Donations Income", type: "Income", description: "Private donations and gifts" },
    { code: 5001, name: "Program Expense", type: "Expense", description: "Direct costs of programs" },
    { code: 5010, name: "Staff Costs", type: "Expense", description: "Salaries and benefits for staff" },
    { code: 5020, name: "Transport Expense", type: "Expense", description: "Field travel and logistics" },
  ],
  school: [
    { code: 1001, name: "Cash on Hand", type: "Asset", description: "School office cash" },
    { code: 1002, name: "Bank Account", type: "Asset", description: "Tuition and fee deposits" },
    { code: 1101, name: "Student Receivables", type: "Asset", description: "Unpaid tuition and fees" },
    { code: 1201, name: "School Supplies", type: "Asset", description: "Books, stationery, and materials" },
    { code: 2001, name: "Accounts Payable", type: "Liability", description: "Owed to suppliers and contractors" },
    { code: 3001, name: "Institutional Equity", type: "Equity", description: "Accumulated surplus" },
    { code: 4001, name: "Tuition Revenue", type: "Income", description: "Fees from instruction" },
    { code: 4010, name: "Boarding Revenue", type: "Income", description: "Fees from boarding services" },
    { code: 5001, name: "Salaries Expense", type: "Expense", description: "Teacher and staff pay" },
    { code: 5010, name: "Teaching Materials", type: "Expense", description: "Classroom supplies" },
  ],
  restaurant: [
    { code: 1001, name: "Cash on Hand", type: "Asset", description: "Register floats and petty cash" },
    { code: 1002, name: "Bank Account", type: "Asset", description: "Business operating account" },
    { code: 1101, name: "Accounts Receivable", type: "Asset", description: "Catering or corporate accounts" },
    { code: 1201, name: "Food Inventory", type: "Asset", description: "Stock of ingredients and food" },
    { code: 2001, name: "Accounts Payable", type: "Liability", description: "Owed to food suppliers" },
    { code: 3001, name: "Owner Capital", type: "Equity", description: "Investment in the restaurant" },
    { code: 4001, name: "Food Sales", type: "Income", description: "Revenue from food service" },
    { code: 4010, name: "Beverage Sales", type: "Income", description: "Revenue from drink sales" },
    { code: 5001, name: "Salaries Expense", type: "Expense", description: "Kitchen and wait staff wages" },
    { code: 5010, name: "Cost of Goods Sold", type: "Expense", description: "Cost of food and beverage ingredients" },
    { code: 5020, name: "Utilities Expense", type: "Expense", description: "Gas, water, and electricity" },
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
        description: account.description || null,
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



const createAuditLog = async (companyId, actorUid, action, details = {}) => {
  await db.collection("auditLogs").add({
    companyId,
    actorUid,
    action,
    details,
    createdAt: FieldValue.serverTimestamp(),
  });
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

  if (!inviteeEmail) {
    throw new HttpsError("invalid-argument", "Invitee email is required.");
  }
  assertValidRole(role);

  const companyId = payload.companyId || (await pickPrimaryMembership(uid)).companyId;
  await assertCompanyRole(uid, companyId, ["super_admin", "admin"]);

  let appBaseUrl = String(process.env.APP_URL || "").trim();
  if (loginUrl) {
    try {
      const parsed = new URL(loginUrl);
      appBaseUrl = `${parsed.protocol}//${parsed.host}`;
    } catch {
      throw new HttpsError("invalid-argument", "loginUrl must be a valid URL.");
    }
  }

  if (!appBaseUrl) {
    throw new HttpsError("failed-precondition", "APP_URL is not configured and loginUrl was not provided.");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAtDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const inviteLink = `${appBaseUrl}/accept-invitation?token=${token}`;

  const existingInvitationSnap = await db
    .collection("invitations")
    .where("companyId", "==", companyId)
    .where("emailLower", "==", inviteeEmail)
    .where("status", "==", "pending")
    .limit(1)
    .get();

  const invitationRef = existingInvitationSnap.empty
    ? db.collection("invitations").doc()
    : existingInvitationSnap.docs[0].ref;

  await invitationRef.set({
    companyId,
    emailLower: inviteeEmail,
    role,
    inviteeName,
    inviteLink,
    tokenHash,
    status: "pending",
    invitedByUid: uid,
    createdAt: existingInvitationSnap.empty
      ? FieldValue.serverTimestamp()
      : existingInvitationSnap.docs[0].data().createdAt || FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAtDate),
  }, { merge: true });

  await createAuditLog(companyId, uid, "invitation_created", {
    invitationId: invitationRef.id,
    email: inviteeEmail,
    role,
  });

  const companySnap = await db.collection("companies").doc(companyId).get();
  const companyName = companySnap.exists ? companySnap.data().name || "your organization" : "your organization";
  let emailResult = { success: false };
  try {
    emailResult = await notifications.sendEmailInternal({
      to: inviteeEmail,
      subject: `You've been invited to join ${companyName}`,
      html: `
        <p>You have been invited to join <strong>${companyName}</strong>.</p>
        <p>Click the link below to accept your invitation:</p>
        <p><a href="${inviteLink}">${inviteLink}</a></p>
        <p>This invitation expires in 7 days.</p>
      `,
    });
  } catch (error) {
    console.error("Failed to send invitation email:", error);
  }

  return {
    success: true,
    invitationId: invitationRef.id,
    token,
    inviteLink,
    emailSent: Boolean(emailResult && emailResult.success),
  };
});

exports.getInvitationByToken = onCall(async (request) => {
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
    throw new HttpsError("not-found", "Invitation is invalid or already used.");
  }

  const invitationDoc = invitationSnap.docs[0];
  const invitation = invitationDoc.data();
  if (invitation.expiresAt && invitation.expiresAt.toDate() < new Date()) {
    throw new HttpsError("deadline-exceeded", "Invitation has expired.");
  }

  const companySnap = await db.collection("companies").doc(invitation.companyId).get();
  const companyName = companySnap.exists ? companySnap.data().name || null : null;

  let userExists = false;
  if (invitation.emailLower) {
    try {
      await admin.auth().getUserByEmail(invitation.emailLower);
      userExists = true;
    } catch (error) {
      if (error.code !== "auth/user-not-found") {
        console.warn("Unable to check invite user existence:", error.message || error);
      }
    }
  }

  return {
    invitationId: invitationDoc.id,
    companyId: invitation.companyId,
    companyName,
    email: invitation.emailLower || null,
    role: invitation.role || "member",
    expiresAt: invitation.expiresAt ? invitation.expiresAt.toDate().toISOString() : null,
    userExists,
    status: invitation.status || "pending",
  };
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

// --- ACCOUNTING MODULE EXPORTS ---

exports.postJournalEntry = onCall(accounting.postJournalEntry);
exports.postInvoiceToGL = onCall(accounting.postInvoiceToGL);
exports.postExpenseToGL = onCall(accounting.postExpenseToGL);
exports.postBillToGL = onCall(accounting.postBillToGL);
exports.getGLBalances = onCall(accounting.getGLBalances);
exports.getTrialBalance = onCall(accounting.getTrialBalance);

// --- END ACCOUNTING MODULE ---

exports.createPayrollDraft = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = payload.companyId;
  if (!companyId || typeof companyId !== "string") {
    throw new HttpsError("invalid-argument", "companyId is required.");
  }

  await assertCompanyRole(uid, companyId, PAYROLL_ROLES);

  // Validate dates - provide defaults if missing or invalid
  const periodStart = payload.periodStart ? formatDateOnly(payload.periodStart) : formatDateOnly(new Date());
  const periodEnd = payload.periodEnd ? formatDateOnly(payload.periodEnd) : formatDateOnly(new Date());
  const runDate = payload.runDate ? formatDateOnly(payload.runDate) : formatDateOnly(new Date());

  // Validate date logic
  if (periodStart > periodEnd) {
    throw new HttpsError("invalid-argument", "Period start date must be before or equal to period end date.");
  }

  const payrollRef = db.collection("payrollRuns").doc();
  await payrollRef.set({
    companyId,
    periodStart,
    periodEnd,
    runDate,
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

// Seed Expense Categories - Map categories to GL accounts
exports.seedExpenseCategories = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = payload.companyId;

  if (!companyId || typeof companyId !== "string") {
    throw new HttpsError("invalid-argument", "companyId is required.");
  }

  await assertCompanyRole(uid, companyId, ["super_admin", "admin"]);

  // Default expense categories matching those in frontend
  const defaultCategories = [
    "Office Supplies",
    "Travel",
    "Meals & Entertainment",
    "Utilities",
    "Rent",
    "Professional Services",
    "Marketing",
    "Equipment",
    "Software & Subscriptions",
    "Training",
    "Insurance",
    "Maintenance",
    "Other",
  ];

  const batch = db.batch();

  for (const categoryName of defaultCategories) {
    // Find or use default expense account
    // For simplicity, we'll use a generic Expense account
    // In production, you'd want specific accounts for each category
    const accountsSnap = await db.collection("chartOfAccounts")
      .where("companyId", "==", companyId)
      .where("accountType", "==", "Expense")
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (accountsSnap.empty) {
      throw new HttpsError("failed-precondition", "No active Expense accounts found. Please create Chart of Accounts first.");
    }

    const accountId = accountsSnap.docs[0].id;

    const mappingRef = db.collection("expenseCategoryMappings").doc();
    batch.set(mappingRef, {
      companyId,
      categoryName,
      accountId,
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  await createAuditLog(companyId, uid, "expense_categories_seeded", {
    categoriesCount: defaultCategories.length,
  });

  return { success: true, categoriesSeeded: defaultCategories.length };
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
    const debitAccountId = await accounting.resolveAccountIdFromSource(
      companyId,
      payroll,
      ["salaryExpenseAccountId", "debitAccountId"],
      "Expense",
    );
    const creditAccountId = await accounting.resolveAccountIdFromSource(
      companyId,
      payroll,
      ["cashAccountId", "payrollPayableAccountId", "creditAccountId"],
      "Liability",
    );

    journalEntryId = await accounting.createPostedJournalEntry({
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

// Payroll Processing Cloud Functions
exports.processPayroll = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const { payrollRunId } = request.data || {};
  return payroll.processPayroll(db, uid, payrollRunId, assertCompanyRole, createAuditLog);
});

exports.payPayroll = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const { payrollRunId, bankAccountId, paymentDate } = request.data || {};
  return payroll.payPayroll(db, uid, payrollRunId, bankAccountId, paymentDate, assertCompanyRole, createAuditLog);
});
// Export AI Functions
exports.askDeepSeek = ai.askDeepSeek;
exports.analyzeTransactionAnomaly = ai.analyzeTransactionAnomaly;

// Export Notification Functions
exports.sendEmail = notifications.sendEmail;

// Export ZRA Functions
exports.signInvoice = require("./zra").signInvoice;

// Export Accounting Functions
exports.postBillPaymentToGL = onCall(accounting.postBillPaymentToGL);
exports.postInvoicePaymentToGL = onCall(accounting.postInvoicePaymentToGL);

// Export Reporting Functions
exports.getExpenseReport = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const { companyId, startDate, endDate } = request.data || {};
  if (!companyId) throw new HttpsError("invalid-argument", "companyId is required");
  return accounting.getExpenseReport(companyId, uid, startDate, endDate, assertCompanyRole);
});

exports.getGeneralLedger = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const { companyId, accountId, startDate, endDate } = request.data || {};
  if (!companyId) throw new HttpsError("invalid-argument", "companyId is required");
  return accounting.getGeneralLedger(companyId, uid, accountId, startDate, endDate, assertCompanyRole);
});

exports.getCashFlowData = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const { companyId, startDate, endDate } = request.data || {};
  if (!companyId) throw new HttpsError("invalid-argument", "companyId is required");
  return accounting.getCashFlowData(companyId, uid, startDate, endDate, assertCompanyRole);
});

// Export AI Functions
exports.askDeepSeek = ai.askDeepSeek;
exports.analyzeTransactionAnomaly = ai.analyzeTransactionAnomaly;

// Firestore Triggers
// Note: onInvitationCreated function removed due to Firebase deployment constraint.
// Firebase does not allow changing a function from HTTPS callable to Firestore trigger.
// Email notifications for new invitations should be handled client-side or via sendEmail callable.

const resolveCompanyIdFromPayload = async (uid, payload = {}) => {
  if (payload.companyId && typeof payload.companyId === "string") {
    return payload.companyId;
  }
  if (payload.organizationId && typeof payload.organizationId === "string") {
    return payload.organizationId;
  }
  const membership = await pickPrimaryMembership(uid);
  return membership.companyId;
};

const assertCompanyMembership = async (uid, companyId) => {
  await getMembership(uid, companyId);
  return companyId;
};

// Canonical accounting engine callables (override legacy handlers)
exports.seedDefaultChartOfAccounts = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = await resolveCompanyIdFromPayload(uid, payload);
  await assertCompanyRole(uid, companyId, ["super_admin", "admin"]);
  return accountingEngine.seedDefaultChartOfAccounts({ companyId, userId: uid, db });
});

exports.seedDefaultExpenseCategories = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = await resolveCompanyIdFromPayload(uid, payload);
  await assertCompanyRole(uid, companyId, ["super_admin", "admin"]);
  return accountingEngine.seedDefaultExpenseCategories({ companyId, userId: uid, db });
});

// Backward-compatible alias
exports.seedExpenseCategories = exports.seedDefaultExpenseCategories;

exports.recordExpense = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = await resolveCompanyIdFromPayload(uid, payload);
  await assertCompanyRole(uid, companyId, COMMERCIAL_ROLES);
  return accountingEngine.recordExpense({
    data: payload,
    userId: uid,
    companyId,
    db,
  });
});

exports.createBill = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = await resolveCompanyIdFromPayload(uid, payload);
  await assertCompanyRole(uid, companyId, COMMERCIAL_ROLES);
  return accountingEngine.createBill({
    data: payload,
    userId: uid,
    companyId,
    db,
  });
});

exports.payBill = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = await resolveCompanyIdFromPayload(uid, payload);
  await assertCompanyRole(uid, companyId, COMMERCIAL_ROLES);
  return accountingEngine.payBill({
    data: payload,
    userId: uid,
    companyId,
    db,
  });
});

exports.updateOverdueBills = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = await resolveCompanyIdFromPayload(uid, payload);
  await assertCompanyRole(uid, companyId, COMMERCIAL_ROLES);
  return accountingEngine.updateOverdueBills({ companyId, db });
});

exports.createInvoice = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = await resolveCompanyIdFromPayload(uid, payload);
  await assertCompanyRole(uid, companyId, COMMERCIAL_ROLES);
  return accountingEngine.createInvoice({
    data: payload,
    userId: uid,
    companyId,
    db,
  });
});

exports.recordInvoicePayment = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = await resolveCompanyIdFromPayload(uid, payload);
  await assertCompanyRole(uid, companyId, COMMERCIAL_ROLES);
  return accountingEngine.recordInvoicePayment({
    data: payload,
    userId: uid,
    companyId,
    db,
  });
});

exports.createQuotation = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = await resolveCompanyIdFromPayload(uid, payload);
  await assertCompanyRole(uid, companyId, COMMERCIAL_ROLES);
  return accountingEngine.createQuotation({
    data: payload,
    userId: uid,
    companyId,
    db,
  });
});

exports.reverseJournalEntry = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = await resolveCompanyIdFromPayload(uid, payload);
  await assertCompanyRole(uid, companyId, JOURNAL_POSTING_ROLES);
  const result = await accountingEngine.reverseJournalEntry({
    data: payload,
    userId: uid,
    companyId,
    db,
  });
  await createAuditLog(companyId, uid, "journal_entry_reversed", result);
  return result;
});

exports.deleteChartOfAccount = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = await resolveCompanyIdFromPayload(uid, payload);
  await assertCompanyRole(uid, companyId, ["super_admin", "admin"]);
  const result = await accountingEngine.deleteChartOfAccount({
    data: payload,
    companyId,
    db,
  });
  await createAuditLog(companyId, uid, "chart_of_account_deleted", {
    accountId: payload.accountId,
  });
  return result;
});

// Canonical payroll handlers (draft does not post GL; process does)
exports.createPayrollDraft = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = await resolveCompanyIdFromPayload(uid, payload);
  await assertCompanyRole(uid, companyId, PAYROLL_ROLES);
  return payroll.savePayrollDraft(
    db,
    uid,
    { ...payload, companyId },
    assertCompanyRole,
    createAuditLog,
  );
});

exports.processPayroll = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const payrollRunId = String(payload.payrollRunId || payload.payroll_run_id || "");
  return payroll.processPayroll(db, uid, payrollRunId, assertCompanyRole, createAuditLog);
});

exports.payPayroll = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const payrollRunId = String(payload.payrollRunId || payload.payroll_run_id || "");
  const paymentAccountId = String(payload.paymentAccountId || payload.bankAccountId || "");
  const paymentDate = payload.paymentDate || payload.payment_date || null;
  return payroll.paySalaries(
    db,
    uid,
    payrollRunId,
    paymentAccountId,
    paymentDate,
    assertCompanyRole,
    createAuditLog,
  );
});

// Backward-compatible alias for existing UI action naming.
exports.finalizePayroll = exports.processPayroll;

// Journal-only reporting and dashboard metrics
exports.getProfitLossReport = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = await resolveCompanyIdFromPayload(uid, payload);
  await assertCompanyMembership(uid, companyId);
  return accountingEngine.getProfitLossReport({
    companyId,
    startDate: payload.startDate,
    endDate: payload.endDate,
    db,
  });
});

exports.getBalanceSheetReport = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = await resolveCompanyIdFromPayload(uid, payload);
  await assertCompanyMembership(uid, companyId);
  return accountingEngine.getBalanceSheetReport({
    companyId,
    asOfDate: payload.asOfDate,
    db,
  });
});

exports.getTrialBalanceReport = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = await resolveCompanyIdFromPayload(uid, payload);
  await assertCompanyMembership(uid, companyId);
  return accountingEngine.getTrialBalanceReport({
    companyId,
    startDate: payload.startDate || null,
    endDate: payload.endDate || null,
    db,
  });
});

exports.getGeneralLedgerReport = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = await resolveCompanyIdFromPayload(uid, payload);
  await assertCompanyMembership(uid, companyId);
  return accountingEngine.getGeneralLedgerReport({
    companyId,
    accountId: payload.accountId,
    startDate: payload.startDate,
    endDate: payload.endDate,
    db,
  });
});

exports.getCashFlowReport = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = await resolveCompanyIdFromPayload(uid, payload);
  await assertCompanyMembership(uid, companyId);
  return accountingEngine.getCashFlowReport({
    companyId,
    startDate: payload.startDate,
    endDate: payload.endDate,
    db,
  });
});

exports.getExpenseReport = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = await resolveCompanyIdFromPayload(uid, payload);
  await assertCompanyMembership(uid, companyId);
  return accountingEngine.getExpenseReport({
    companyId,
    startDate: payload.startDate,
    endDate: payload.endDate,
    db,
  });
});

// Backward-compatible aliases
exports.getGeneralLedger = exports.getGeneralLedgerReport;
exports.getCashFlowData = exports.getCashFlowReport;

exports.getDashboardLiveMetrics = onCall(async (request) => {
  const uid = assertAuthenticated(request);
  const payload = request.data || {};
  const companyId = await resolveCompanyIdFromPayload(uid, payload);
  await assertCompanyMembership(uid, companyId);
  return accountingEngine.getDashboardLiveMetrics({ companyId, db });
});
