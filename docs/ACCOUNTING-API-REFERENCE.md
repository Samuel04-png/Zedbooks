# Accounting System - Quick API Reference

## Core Posting Functions

### `postJournalEntry` (Cloud Function)
**Endpoint**: `functions/postJournalEntry`

```javascript
// Callable Cloud Function
const result = await functions.httpsCallable('postJournalEntry')({
  entryDate: "2025-02-22",
  description: "Monthly rent payment",
  referenceType: "Expense",
  referenceId: "CHK-12345",
  lines: [
    { accountId: "companyId_5100", debit: 5000, credit: 0 },
    { accountId: "companyId_1020", debit: 0, credit: 5000 }
  ]
})
```

---

## Account Management Functions

### `getAccountBalance`
```javascript
const balance = await accountingPostingService.getAccountBalance({
  organizationId: "companyId123",
  accountId: "companyId_1020",
  asOfDate: "2025-02-28"
})
// Returns: 45000.00
```

### `findAccountByCode`
```javascript
const account = await accountingPostingService.findAccountByCode(
  companyId,
  "1020"
)
// Returns: { id, accountCode, accountName, accountType, ... }
```

### `findAccountByName`
```javascript
const account = await accountingPostingService.findAccountByName(
  companyId,
  ["Bank Account - Operating", "Main Bank"]
)
```

---

## Reporting Functions

### Trial Balance
```javascript
const tb = await accountingUtils.getTrialBalance({
  organizationId: "companyId123",
  asOfDate: "2025-02-28"
})
```

**Response Structure**:
```json
{
  "asOfDate": "2025-02-28",
  "accounts": [
    {
      "accountId": "...",
      "accountCode": 1020,
      "accountName": "Bank Account",
      "accountType": "Asset",
      "debits": 50000,
      "credits": 5000,
      "balance": 45000
    }
  ],
  "totalDebits": 100000,
  "totalCredits": 100000,
  "isBalanced": true
}
```

### Accounting Equation
```javascript
const eq = await accountingUtils.getAccountingEquation({
  organizationId: "companyId123",
  asOfDate: "2025-02-28"
})
```

**Response Structure**:
```json
{
  "asOfDate": "2025-02-28",
  "assets": 150000,
  "liabilities": 60000,
  "equity": 90000,
  "rightSide": 150000,
  "isBalanced": true,
  "message": "Accounting equation is balanced"
}
```

### Financial Summary
```javascript
const summary = await accountingUtils.getFinancialSummary({
  organizationId: "companyId123",
  endDate: "2025-02-28"
})
```

**Response Structure**:
```json
{
  "asOfDate": "2025-02-28",
  "incomeStatement": {
    "revenue": 150000,
    "expenses": 80000,
    "netIncome": 70000
  },
  "balanceSheet": {
    "assets": 150000,
    "liabilities": 60000,
    "equity": 90000,
    "totalLiabilitiesAndEquity": 150000
  },
  "ratios": {
    "grossProfitRate": "46.67%",
    "assetsToLiabilities": 2.5,
    "debtToEquity": 0.67
  }
}
```

### Accounts by Type
```javascript
const accounts = await accountingUtils.getAccountsByType({
  organizationId: "companyId123"
})
```

**Response Structure**:
```json
{
  "Asset": [...],
  "Liability": [...],
  "Equity": [...],
  "Income": [...],
  "Expense": [...]
}
```

### Validate All Journal Entries
```javascript
const validation = await accountingUtils.validateAllJournalEntries({
  organizationId: "companyId123"
})
```

**Response Structure**:
```json
{
  "totalEntriesChecked": 250,
  "imbalancedCount": 0,
  "isAllBalanced": true,
  "imbalancedEntries": []
}
```

---

## Financial Statement Functions

### Profit & Loss Statement
```javascript
const pl = await financialReports.getProfitAndLossStatement({
  organizationId: "companyId123",
  startDate: "2025-02-01",
  endDate: "2025-02-28"
})
```

**Response Structure**:
```json
{
  "period": {
    "startDate": "2025-02-01",
    "endDate": "2025-02-28"
  },
  "incomes": [
    { "code": 4000, "name": "Sales Revenue", "amount": 150000 }
  ],
  "totalIncome": 150000,
  "expenses": [
    { "code": 5000, "name": "Salaries", "amount": 50000 }
  ],
  "totalExpense": 80000,
  "grossProfit": 150000,
  "netIncome": 70000
}
```

### Balance Sheet
```javascript
const bs = await financialReports.getBalanceSheet({
  organizationId: "companyId123",
  asOfDate: "2025-02-28"
})
```

**Response Structure**:
```json
{
  "asOfDate": "2025-02-28",
  "assets": {
    "accounts": [...],
    "total": 150000
  },
  "liabilities": {
    "accounts": [...],
    "total": 60000
  },
  "equity": {
    "accounts": [...],
    "total": 90000
  },
  "currentYearIncome": {
    "revenue": 150000,
    "expenses": 80000,
    "netIncome": 70000
  },
  "totalLiabilitiesAndEquity": 150000,
  "isBalanced": true
}
```

### Account Transaction History
```javascript
const history = await financialReports.getAccountTransactionHistory({
  organizationId: "companyId123",
  accountId: "companyId_1020",
  startDate: "2025-01-01",
  endDate: "2025-02-28"
})
```

**Response Structure**:
```json
{
  "account": {
    "id": "...",
    "code": 1020,
    "name": "Bank Account",
    "type": "Asset"
  },
  "transactions": [
    {
      "date": "2025-01-15",
      "debit": 5000,
      "credit": 0,
      "description": "Deposit",
      "entryId": "...",
      "runningBalance": 45000
    }
  ],
  "finalBalance": 45000
}
```

### Accounts Receivable Aging
```javascript
const aging = await financialReports.getAccountsReceivableAging({
  organizationId: "companyId123",
  asOfDate: "2025-02-28"
})
```

**Response Structure**:
```json
{
  "asOfDate": "2025-02-28",
  "byCustomer": [
    {
      "customer": "ABC Corp",
      "current": 5000,
      "days30": 8000,
      "days60": 0,
      "days90": 0,
      "over90": 0,
      "total": 13000
    }
  ],
  "summary": {
    "current": 25000,
    "days30": 15000,
    "days60": 5000,
    "days90": 0,
    "over90": 0,
    "total": 45000
  }
}
```

---

## Account Type Reference

| Type | Code Range | Debit/Credit | Balance Formula |
|------|------------|--------------|-----------------|
| **Asset** | 1000-1999 | Debit (+) | Debits - Credits |
| **Liability** | 2000-2999 | Credit (+) | Credits - Debits |
| **Equity** | 3000-3999 | Credit (+) | Credits - Debits |
| **Income** | 4000-4999 | Credit (+) | Credits - Debits |
| **Expense** | 5000-9999 | Debit (+) | Debits - Credits |

---

## Common Account Codes

### Assets (1000-1999)
| Code | Name |
|------|------|
| 1000 | Cash |
| 1010 | Petty Cash |
| 1020 | Bank Account - Operating |
| 1100 | Accounts Receivable |
| 1200 | Inventory |
| 1300 | Prepaid Expenses |
| 1400 | Fixed Assets - Equipment |
| 1410 | Fixed Assets - Vehicles |

### Liabilities (2000-2999)
| Code | Name |
|------|------|
| 2000 | Accounts Payable |
| 2100 | Salaries Payable |
| 2200 | Tax Payable - VAT |
| 2210 | Tax Payable - PAYE |
| 2300 | Loans Payable - Short Term |

### Equity (3000-3999)
| Code | Name |
|------|------|
| 3000 | Owner's Capital |
| 3100 | Retained Earnings |
| 3200 | Drawings |
| 3900 | Current Year Earnings |

### Income (4000-4999)
| Code | Name |
|------|------|
| 4000 | Sales Revenue |
| 4100 | Service Revenue |
| 4200 | Interest Income |
| 4300 | Other Income |

### Expenses (5000-9999)
| Code | Name |
|------|------|
| 5000 | Salaries Expense |
| 5010 | PAYE Expense |
| 5100 | Rent Expense |
| 5110 | Electricity Expense |
| 5200 | Fuel Expense |
| 5300 | Office Supplies |
| 5400 | Professional Services |
| 5500 | Marketing & Advertising |
| 5700 | Insurance Expense |
| 5800 | Bank Charges |
| 5900 | Depreciation Expense |
| 5999 | Miscellaneous Expense |

---

## Error Codes

| Error Code | HTTP Status | Description |
|-----------|----------|-------------|
| `invalid-argument` | 400 | Invalid input (validation failed) |
| `not-found` | 404 | Account or document not found |
| `permission-denied` | 403 | Insufficient access rights |
| `failed-precondition` | 412 | Account inactive, period locked, unbalanced |
| `unauthenticated` | 401 | User not authenticated |

---

## Module Imports

```javascript
// In Cloud Functions (backend)
const accountingPostingService = require('./accountingPostingService')
const accountingUtils = require('./accountingUtils')
const financialReports = require('./financialReports')

// Extract specific functions
const { createJournalEntry, getAccountBalance } = accountingPostingService
const { getTrialBalance, getAccountingEquation } = accountingUtils
const { getProfitAndLossStatement, getBalanceSheet } = financialReports
```

---

## Quick Integration Example

```javascript
// 1. Post an invoice to GL
const entryId = await createJournalEntry({
  organizationId: companyId,
  entryDate: new Date().toISOString().slice(0, 10),
  description: "Invoice INV-001",
  referenceType: "Invoice",
  referenceId: "INV-001",
  lines: [
    { accountId: `${companyId}_1100`, debit: 10000, credit: 0 },  // AR
    { accountId: `${companyId}_4100`, debit: 0, credit: 10000 }   // Service Income
  ],
  createdBy: userId,
  tx: transaction
})

// 2. Check AR balance
const arBalance = await getAccountBalance({
  organizationId: companyId,
  accountId: `${companyId}_1100`
})

// 3. Generate statements
const pl = await getProfitAndLossStatement({
  organizationId: companyId,
  startDate: "2025-02-01",
  endDate: "2025-02-28"
})

const bs = await getBalanceSheet({
  organizationId: companyId,
  asOfDate: "2025-02-28"
})

console.log(`Net Income: ${pl.netIncome}`)
console.log(`Total Assets: ${bs.assets.total}`)
```

---

**For detailed documentation**, see [ACCOUNTING-SYSTEM.md](./ACCOUNTING-SYSTEM.md)
