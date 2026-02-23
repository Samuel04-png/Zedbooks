# Double-Entry Accounting System Documentation

## Overview

This application implements a complete **double-entry accounting system** using Firebase Cloud Functions and Firestore. The system ensures every transaction is recorded in at least two accounts (debit and credit) to maintain the accounting equation: **Assets = Liabilities + Equity**.

---

## Database Schema

### 1. Chart of Accounts (`chartOfAccounts` Collection)

Stores all general ledger accounts with hierarchical structure support.

```
Document ID: {companyId}_{accountCode}
Fields:
├── companyId (String, FK → companies)
├── accountCode (Integer)              // e.g., 1001, 5050
├── accountName (String)               // e.g., "Cash", "Salaries Expense"
├── accountType (Enum)                 // Asset | Liability | Equity | Income | Expense
├── description (String, optional)     // Account description
├── parentAccountId (String, optional) // For account hierarchy
├── isActive (Boolean, default: true)  // Soft delete flag
├── isSystem (Boolean)                 // True if created from template
├── templateKey (String)               // small_business | ngo | school | restaurant
├── createdAt (Timestamp)
├── updatedAt (Timestamp)
└── status (String)                    // active | inactive
```

**Account Type Ranges:**
- **Asset**: 1000-1999
- **Liability**: 2000-2999
- **Equity**: 3000-3999
- **Income**: 4000-4999
- **Expense**: 5000-9999

### 2. Journal Entries (`journalEntries` Collection)

Records of transactions posted to the general ledger.

```
Document ID: Auto-generated UUID
Fields:
├── companyId (String, FK → companies)
├── date (String)                      // YYYY-MM-DD format
├── description (String)               // Transaction description
├── referenceType (String)             // Expense | Bill | Invoice | etc.
├── referenceId (String)               // External ID (invoice #, check #, etc.)
├── totalAmount (Decimal)              // Total debits/credits
├── debitTotal (Decimal)
├── creditTotal (Decimal)
├── isBalanced (Boolean)               // Always true (validated on creation)
├── isPosted (Boolean, default: true)
├── createdBy (String)                 // User ID who posted
├── createdAt (Timestamp)
├── updatedAt (Timestamp)
└── metadata (Object, optional)        // Custom data
```

### 3. Journal Lines (`journalLines` Collection)

Individual line items within a journal entry (always at least 2 per entry).

```
Document ID: Auto-generated UUID
Fields:
├── companyId (String, FK → companies)
├── journalEntryId (String, FK → journalEntries)
├── accountId (String, FK → chartOfAccounts)
├── lineNumber (Integer)               // 1, 2, 3...
├── debitAmount (Decimal)              // Debit side
├── creditAmount (Decimal)             // Credit side
├── description (String, optional)     // Line-specific description
├── entryDate (String)                 // YYYY-MM-DD (inherited from entry)
├── isPosted (Boolean, default: true)
├── createdAt (Timestamp)
└── updatedAt (Timestamp)
```

---

## Core Services

### accountingPostingService.js

**Primary Posting Module** - Handles journal entry creation and validation.

#### Key Functions:

**1. `createJournalEntry()`**
```javascript
await createJournalEntry({
  organizationId: "companyId123",
  entryDate: "2025-02-22",
  description: "Monthly rent payment",
  referenceType: "Expense",        // or "Invoice", "Bill", etc.
  referenceId: "CHK-12345",         // Optional: check number, invoice #
  lines: [
    { 
      accountId: "companyId_5100",  // Rent Expense
      debit: 5000,
      credit: 0
    },
    { 
      accountId: "companyId_1020",  // Bank Account
      debit: 0,
      credit: 5000
    }
  ],
  createdBy: "uid_of_user",
  tx: firestoreTransaction      // Required for atomic operation
})
```

**Validation Rules:**
- Minimum 2 lines per entry
- Total debits MUST equal total credits (balanced)
- Each line must be either debit OR credit (not both)
- All accounts must:
  - Belong to the company
  - Be active
  - Be in correct numbering range for their type
- Entry date cannot be in a locked financial period

**2. `getAccountBalance()`**
```javascript
const balance = await getAccountBalance({
  organizationId: "companyId123",
  accountId: "companyId_1020",    // Bank Account
  asOfDate: "2025-02-22",          // Optional: calculates as of date
})
// Returns: 45000.00

// Balance Calculation Logic:
// ├─ For Assets & Expenses
// │  └─ Balance = SUM(Debits) - SUM(Credits)
// └─ For Liabilities, Equity, Income
//    └─ Balance = SUM(Credits) - SUM(Debits)
```

**3. `findAccountByCode()`, `findAccountByName()`**
```javascript
const account = await findAccountByCode(companyId, "1020");
const account = await findAccountByName(companyId, ["Bank Account - Operating"]);
```

---

### accountingEngine.js

**Extended Accounting Functions** - Higher-level operations and integrations.

```javascript
// Post invoice to GL
await postInvoiceToGL({
  companyId,
  invoiceId,
  invoiceNumber,
  invoiceDate,
  customerId,
  customerName,
  lineItems: [
    { 
      description,
      quantity,
      unitPrice,
      accountCode,        // Product Sales: 4000
      taxAmount
    }
  ],
  totalAmount,
  totalTax,
  createdBy
})

// Post bill to GL
await postBillToGL({...})

// Post expense to GL
await postExpenseToGL({...})
```

---

### accountingUtils.js

**Analysis and Reporting Module** - Financial analysis functions.

#### Key Functions:

**1. `getTrialBalance()`**
```javascript
const tb = await getTrialBalance({
  organizationId: "companyId123",
  asOfDate: "2025-02-22"  // Optional
})
// Returns:
{
  asOfDate: "2025-02-22",
  accounts: [
    {
      accountId: "...",
      accountCode: 1020,
      accountName: "Bank Account - Operating",
      accountType: "Asset",
      debits: 50000.00,
      credits: 5000.00,
      balance: 45000.00
    },
    ...
  ],
  totalDebits: 100000.00,
  totalCredits: 100000.00,
  isBalanced: true
}
```

**2. `getAccountingEquation()`**
Validates: **Assets = Liabilities + Equity**
```javascript
const eq = await getAccountingEquation({
  organizationId,
  asOfDate: "2025-02-22"
})
// Returns:
{
  assets: 150000.00,
  liabilities: 60000.00,
  equity: 90000.00,
  rightSide: 150000.00,
  isBalanced: true
}
```

**3. `getAccountsByType()`**
```javascript
const accounts = await getAccountsByType({
  organizationId
})
// Returns:
{
  Asset: [...],
  Liability: [...],
  Equity: [...],
  Income: [...],
  Expense: [...]
}
```

**4. `validateAllJournalEntries()`**
```javascript
const validation = await validateAllJournalEntries({
  organizationId
})
// Returns:
{
  totalEntriesChecked: 250,
  imbalancedCount: 0,
  isAllBalanced: true,
  imbalancedEntries: []
}
```

---

### financialReports.js

**Financial Statement Generation Module**

#### Key Functions:

**1. `getProfitAndLossStatement()`**
```javascript
const pl = await getProfitAndLossStatement({
  organizationId,
  startDate: "2025-01-01",
  endDate: "2025-02-28"
})
// Returns:
{
  period: { startDate, endDate },
  incomes: [
    { code: 4000, name: "Sales Revenue", amount: 150000.00 },
    ...
  ],
  totalIncome: 150000.00,
  expenses: [
    { code: 5000, name: "Salaries", amount: 50000.00 },
    ...
  ],
  totalExpense: 80000.00,
  netIncome: 70000.00
}
```

**2. `getBalanceSheet()`**
```javascript
const bs = await getBalanceSheet({
  organizationId,
  asOfDate: "2025-02-28"
})
// Returns:
{
  asOfDate: "2025-02-28",
  assets: {
    accounts: [{ code, name, balance }],
    total: 150000.00
  },
  liabilities: {
    accounts: [...],
    total: 60000.00
  },
  equity: {
    accounts: [...],
    total: 90000.00
  },
  currentYearIncome: {
    revenue: 150000.00,
    expenses: 80000.00,
    netIncome: 70000.00
  },
  totalLiabilitiesAndEquity: 150000.00,
  isBalanced: true
}
```

**3. `getAccountTransactionHistory()`**
```javascript
const history = await getAccountTransactionHistory({
  organizationId,
  accountId: "companyId_1020",
  startDate: "2025-01-01",
  endDate: "2025-02-28"
})
// Returns:
{
  account: { id, code, name, type },
  transactions: [
    {
      date: "2025-01-15",
      debit: 5000.00,
      credit: 0,
      description: "Deposit",
      entryId: "...",
      runningBalance: 45000.00
    },
    ...
  ],
  finalBalance: 45000.00
}
```

**4. `getAccountsReceivableAging()`**
```javascript
const aging = await getAccountsReceivableAging({
  organizationId,
  asOfDate: "2025-02-28"
})
// Returns:
{
  asOfDate: "2025-02-28",
  byCustomer: [
    {
      customer: "ABC Corp",
      current: 5000.00,
      days30: 8000.00,
      days60: 0,
      days90: 0,
      over90: 0,
      total: 13000.00
    },
    ...
  ],
  summary: {
    current: 25000.00,
    days30: 15000.00,
    days60: 5000.00,
    days90: 0,
    over90: 0,
    total: 45000.00
  }
}
```

---

## Chart of Accounts Seeding

### Available Templates

When a company is created via `bootstrapUserAccount()`, accounts are automatically seeded based on organization type:

**1. Small Business** (Default)
- Complete chart for retail/service businesses
- 80+ accounts covering all areas

**2. NGO** (Non-Profit Organizations)
- Nonprofit-specific accounts
- Grant income, program expenses, fund balance

**3. School** (Educational Institutions)
- Student receivables, tuition revenue
- Boarding services, teaching materials

**4. Restaurant** (Food Service)
- Food inventory, beverage sales
- Kitchen staff, cost of goods sold

### Seeding Process

```javascript
// Triggered on company creation in index.js
await ensureTemplateAccounts(companyId, templateKey)

// Seeds all accounts from COA_TEMPLATES[templateKey]
// Document ID format: {companyId}_{accountCode}
```

---

## Usage Examples

### Example 1: Post a Simple Invoice

```javascript
// 1. Create debit (AR) and credit (Service Income)
const entryId = await createJournalEntry({
  organizationId: companyId,
  entryDate: "2025-02-22",
  description: "Invoice INV-001 to ABC Corp",
  referenceType: "Invoice",
  referenceId: "INV-001",
  lines: [
    {
      accountId: `${companyId}_1030`,  // Accounts Receivable
      debit: 10000,
      credit: 0
    },
    {
      accountId: `${companyId}_4010`,  // Service Revenue
      debit: 0,
      credit: 10000
    }
  ],
  createdBy: uid,
  tx: transaction
})
```

### Example 2: Check Account Balance

```javascript
const balance = await getAccountBalance({
  organizationId: companyId,
  accountId: `${companyId}_1030`,  // AR
  asOfDate: "2025-02-28"
})
console.log(`AR Balance: ${balance}`)  // 25000.00
```

### Example 3: Generate Monthly Financial Statements

```javascript
const pl = await getProfitAndLossStatement({
  organizationId: companyId,
  startDate: "2025-02-01",
  endDate: "2025-02-28"
})

const bs = await getBalanceSheet({
  organizationId: companyId,
  asOfDate: "2025-02-28"
})

const tb = await getTrialBalance({
  organizationId: companyId,
  asOfDate: "2025-02-28"
})

console.log(`Net Income: ${pl.netIncome}`)
console.log(`Total Assets: ${bs.assets.total}`)
console.log(`Is TB Balanced: ${tb.isBalanced}`)
```

---

## Transaction Flow

### Posting a Journal Entry (with Transaction Safety)

```
1. Validate Input Data
   ├─ Check at least 2 lines
   ├─ Verify all accounts belong to company
   ├─ Confirm accounts are active
   └─ Verify debits = credits

2. Begin Transaction
   └─ Get firestore.runTransaction()

3. Create Journal Entry Document
   ├─ Set basic fields (date, description, reference)
   ├─ Store totals for reporting
   └─ Mark as isPosted = true

4. Create Journal Line Documents
   ├─ For each line in the entry
   ├─ Link to journal entry
   ├─ Store debit/credit amounts
   └─ Copy entry date for querying

5. Commit Transaction
   └─ All-or-nothing atomicity

6. Return Entry ID
   └─ Ready for reference in other systems
```

---

## Financial Period Locking

Prevent posting to locked/closed periods:

```javascript
// In accounting.js - assertPeriodUnlocked()
// Checks if financialPeriods doc has status "locked" or "closed"
// Throws error if attempting to post to locked period
```

---

## Validation Rules Summary

| Rule | Validation | Error Message |
|------|-----------|-----------------|
| Minimum lines | Must have ≥ 2 lines | "Journal entry requires at least 2 lines" |
| Balanced | Debits = Credits | "Journal entry is unbalanced. Debits: X, Credits: Y" |
| Single side | Each line is debit OR credit | "Must contain exactly one side (debit or credit)" |
| Account exists | Account doc must exist | "Account {id} not found" |
| Company owned | Account.companyId = transaction company | "Account is not in this organization" |
| Account active | Account.isActive or !is_active | "Account {id} is inactive" |
| Account type | Code in correct range | "Account code violates {Type} numbering range" |
| No negative | Debit/credit ≥ 0 | "Cannot be negative" |
| Entry date | In unlocked financial period | "Unable to post: period is locked" |

---

## Best Practices

### 1. **Always Use Transactions**
```javascript
await db.runTransaction(async (tx) => {
  await createJournalEntry({
    ...,
    tx  // Pass transaction context
  })
})
```

### 2. **Normalize Money Values**
```javascript
const amount = normalizeMoney(inputValue)  // Always 2 decimals
```

### 3. **Verify Posting**
```javascript
const validation = await validateAllJournalEntries({ organizationId })
if (!validation.isAllBalanced) {
  console.warn("Found imbalanced entries:", validation.imbalancedEntries)
}
```

### 4. **Check Accounting Equation Periodically**
```javascript
const eq = await getAccountingEquation({ organizationId })
if (!eq.isBalanced) {
  console.error("CRITICAL: Accounting equation violated!")
}
```

### 5. **Use Trial Balance for Month-End Close**
```javascript
const tb = await getTrialBalance({
  organizationId,
  asOfDate: monthEndDate
})
// Verify totals before generating financial statements
```

---

## Firestore Indexes Required

The system will automatically optimize queries with:

```
Collection: journalLines
├─ (companyId, isPosted, entryDate)     [ASC]
├─ (companyId, accountId, isPosted)     [ASC]
└─ (companyId, accountId, entryDate)    [ASC]

Collection: chartOfAccounts
├─ (companyId, isActive, accountType)   [ASC]
└─ (companyId, accountType)             [ASC]
```

---

## Error Handling

All functions throw `HttpsError` with proper error codes:

```javascript
// Examples
new HttpsError("invalid-argument", "...")    // 400
new HttpsError("not-found", "...")           // 404
new HttpsError("permission-denied", "...")   // 403
new HttpsError("failed-precondition", "...")  // 412
new HttpsError("unauthenticated", "...")     // 401
```

---

## Summary

This double-entry accounting system provides:

✅ **Data Integrity** - Transactions are atomic, validated, and balanced
✅ **Flexibility** - Multiple COA templates, custom accounts, hierarchies
✅ **Reporting** - Trial balance, P&L, balance sheet, aging analysis
✅ **Audit Trail** - CreatedBy, timestamps, reference tracking
✅ **Security** - Company scoping, role-based access (via Firebase Auth)
✅ **Scalability** - Firestore native, batching, transaction support

All accounting operations maintain the fundamental equation: **Assets = Liabilities + Equity**
