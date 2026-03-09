# Accounting System - Quick Start Guide

## For Developers

### 1. Posting a Journal Entry

```javascript
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase-config";

// Post an invoice to GL
const postInvoice = httpsCallable(functions, "postInvoiceToGL");

try {
  const result = await postInvoice({
    invoiceNumber: "INV-20250222-001",
    invoiceDate: "2025-02-22",
    customerId: "customer_id_123",
    customerName: "ABC Corporation",
    lineItems: [
      {
        description: "Consulting Services - February",
        quantity: 40,
        unitPrice: 150,
        amount: 6000,
        accountCode: 4100  // Service Revenue
      },
      {
        description: "Software License",
        quantity: 1,
        unitPrice: 2000,
        amount: 2000,
        accountCode: 4160  // Software Sales
      }
    ],
    totalAmount: 8000,
    totalTax: 0
  });

  console.log("Invoice posted:", result.data);
} catch (error) {
  console.error("Error posting invoice:", error.message);
}
```

### 2. Getting Account Balance

```javascript
const getBalance = httpsCallable(functions, "getAccountBalance");

const balance = await getBalance({
  accountId: "company_1100",  // Accounts Receivable
  asOfDate: "2025-02-28"
});

console.log(`AR Balance: $${balance.data}`);
```

### 3. Viewing Trial Balance

```javascript
const getTrialBalance = httpsCallable(
  functions, 
  "getAccountingTrialBalance"
);

const result = await getTrialBalance({
  asOfDate: "2025-02-28"
});

const { accounts, totalDebits, totalCredits, isBalanced } = result.data;

console.log("Trial Balance as of 2025-02-28");
console.log("================================");
accounts.forEach(account => {
  console.log(
    `${account.accountCode.toString().padEnd(6)} | ` +
    `${account.accountName.padEnd(30)} | ` +
    `DR: $${account.debits.toFixed(2).padStart(10)} | ` +
    `CR: $${account.credits.toFixed(2).padStart(10)} | ` +
    `Balance: $${account.balance.toFixed(2).padStart(12)}`
  );
});
console.log("================================");
console.log(`Total Debits:  $${totalDebits.toFixed(2)}`);
console.log(`Total Credits: $${totalCredits.toFixed(2)}`);
console.log(`Balanced: ${isBalanced ? "✅ YES" : "❌ NO"}`);
```

### 4. Generating P&L Statement

```javascript
const getPL = httpsCallable(
  functions,
  "getProfitAndLossStatement"
);

const result = await getPL({
  startDate: "2025-02-01",
  endDate: "2025-02-28"
});

const { incomes, totalIncome, expenses, totalExpense, netIncome } = result.data;

console.log("Profit & Loss Statement");
console.log("February 1 - February 28, 2025");
console.log("================================");
console.log("\nREVENUE:");
incomes.forEach(income => {
  console.log(`  ${income.name.padEnd(30)} $${income.amount.toFixed(2).padStart(12)}`);
});
console.log(`  ${"TOTAL REVENUE".padEnd(30)} $${totalIncome.toFixed(2).padStart(12)}`);

console.log("\nEXPENSES:");
expenses.forEach(expense => {
  console.log(`  ${expense.name.padEnd(30)} $${expense.amount.toFixed(2).padStart(12)}`);
});
console.log(`  ${"TOTAL EXPENSES".padEnd(30)} $${totalExpense.toFixed(2).padStart(12)}`);

console.log("================================");
console.log(`  ${"NET INCOME".padEnd(30)} $${netIncome.toFixed(2).padStart(12)}`);
```

### 5. Generating Balance Sheet

```javascript
const getBS = httpsCallable(functions, "getBalanceSheet");

const result = await getBS({
  asOfDate: "2025-02-28"
});

const { assets, liabilities, equity, isBalanced } = result.data;

console.log("Balance Sheet");
console.log("As of February 28, 2025");
console.log("================================");
console.log("\nASSETS:");
assets.accounts.forEach(account => {
  console.log(`  ${account.name.padEnd(40)} $${account.balance.toFixed(2).padStart(12)}`);
});
console.log(`  ${"TOTAL ASSETS".padEnd(40)} $${assets.total.toFixed(2).padStart(12)}`);

console.log("\nLIABILITIES:");
liabilities.accounts.forEach(account => {
  console.log(`  ${account.name.padEnd(40)} $${account.balance.toFixed(2).padStart(12)}`);
});
console.log(`  ${"TOTAL LIABILITIES".padEnd(40)} $${liabilities.total.toFixed(2).padStart(12)}`);

console.log("\nEQUITY:");
equity.accounts.forEach(account => {
  console.log(`  ${account.name.padEnd(40)} $${account.balance.toFixed(2).padStart(12)}`);
});
console.log(`  ${"TOTAL EQUITY".padEnd(40)} $${equity.total.toFixed(2).padStart(12)}`);

console.log("================================");
console.log(`TOTAL LIABILITIES + EQUITY:    $${(liabilities.total + equity.total).toFixed(2).padStart(12)}`);
console.log(`Balanced: ${isBalanced ? "✅" : "❌"}`);
```

### 6. Validation & Integrity Check

```javascript
const validateJournal = httpsCallable(
  functions,
  "validateAllJournalEntries"
);

const result = await validateJournal();

console.log(`Total Entries Checked: ${result.data.totalEntriesChecked}`);
console.log(`All Balanced: ${result.data.isAllBalanced ? "✅ YES" : "⚠️ ISSUES FOUND"}`);

if (result.data.imbalancedCount > 0) {
  console.warn(`\nImbalanced Entries: ${result.data.imbalancedCount}`);
  result.data.imbalancedEntries.forEach(entry => {
    console.warn(`  Entry ${entry.entryId}: DR ${entry.totalDebits} != CR ${entry.totalCredits}`);
  });
}
```

### 7. Accounting Equation Check

```javascript
const checkEquation = httpsCallable(
  functions,
  "getAccountingEquation"
);

const result = await checkEquation({
  asOfDate: "2025-02-28"
});

console.log("Accounting Equation Check");
console.log("=========================");
console.log(`Assets:        $${result.data.assets.toFixed(2).padStart(12)}`);
console.log(`Liabilities:   $${result.data.liabilities.toFixed(2).padStart(12)}`);
console.log(`+ Equity:      $${result.data.equity.toFixed(2).padStart(12)}`);
console.log(`= Right Side:  $${result.data.rightSide.toFixed(2).padStart(12)}`);
console.log(`\nStatus: ${result.data.message}`);
```

### 8. AR Aging Report

```javascript
const getAging = httpsCallable(
  functions,
  "getAccountsReceivableAging"
);

const result = await getAging({
  asOfDate: "2025-02-28"
});

console.log("Accounts Receivable Aging");
console.log("As of February 28, 2025");
console.log("========================");
console.log(
  "Customer".padEnd(30) +
  " Current".padStart(12) +
  " 30 Days".padStart(12) +
  " 60 Days".padStart(12) +
  " 90 Days".padStart(12) +
  " 90+ Days".padStart(12) +
  " Total".padStart(12)
);
console.log("-".repeat(104));

result.data.byCustomer.forEach(row => {
  console.log(
    row.customer.padEnd(30) +
    `$${row.current.toFixed(2).padStart(10)} ` +
    `$${row.days30.toFixed(2).padStart(10)} ` +
    `$${row.days60.toFixed(2).padStart(10)} ` +
    `$${row.days90.toFixed(2).padStart(10)} ` +
    `$${row.over90.toFixed(2).padStart(10)} ` +
    `$${row.total.toFixed(2).padStart(10)}`
  );
});

console.log("-".repeat(104));
const s = result.data.summary;
console.log(
  "TOTAL".padEnd(30) +
  `$${s.current.toFixed(2).padStart(10)} ` +
  `$${s.days30.toFixed(2).padStart(10)} ` +
  `$${s.days60.toFixed(2).padStart(10)} ` +
  `$${s.days90.toFixed(2).padStart(10)} ` +
  `$${s.over90.toFixed(2).padStart(10)} ` +
  `$${s.total.toFixed(2).padStart(10)}`
);
```

---

## Common Account Codes

### Assets
| Code | Name |
|------|------|
| 1000 | Cash |
| 1020 | Bank Account - Operating |
| 1025 | Bank Account - Savings |
| 1100 | Accounts Receivable |
| 1200 | Inventory |

### Liabilities
| Code | Name |
|------|------|
| 2000 | Accounts Payable |
| 2100 | Salaries Payable |
| 2200 | Tax Payable - VAT |
| 2210 | Tax Payable - PAYE |

### Equity
| Code | Name |
|------|------|
| 3000 | Owner's Capital |
| 3100 | Retained Earnings |
| 3200 | Drawings |

### Income
| Code | Name |
|------|------|
| 4000 | Sales Revenue |
| 4100 | Service Revenue |
| 4200 | Interest Income |

### Expenses
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

---

## Error Handling

```javascript
try {
  const result = await postEntry({...});
} catch (error) {
  const code = error.code;  // e.g., "invalid-argument", "failed-precondition"
  const message = error.message;

  switch (code) {
    case "invalid-argument":
      console.error("Invalid input:", message);
      // Show validation error to user
      break;
    case "not-found":
      console.error("Resource not found:", message);
      // Show missing data error
      break;
    case "failed-precondition":
      console.error("Cannot process:", message);
      // Show business rule error (unbalanced, locked period, etc.)
      break;
    case "permission-denied":
      console.error("Access denied:", message);
      // Show authorization error
      break;
    default:
      console.error("Unexpected error:", message);
  }
}
```

---

## React Component Example

```typescript
import React, { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase-config";

export function TrialBalanceReport() {
  const [trialBalance, setTrialBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTrialBalance = async () => {
      try {
        setLoading(true);
        const getTrialBalance = httpsCallable(
          functions,
          "getAccountingTrialBalance"
        );
        const result = await getTrialBalance({
          asOfDate: new Date().toISOString().slice(0, 10),
        });
        setTrialBalance(result.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTrialBalance();
  }, []);

  if (loading) return <div>Loading trial balance...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!trialBalance) return <div>No data</div>;

  return (
    <div>
      <h2>Trial Balance as of {trialBalance.asOfDate}</h2>
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Account Name</th>
            <th>Type</th>
            <th>Debits</th>
            <th>Credits</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          {trialBalance.accounts.map((account) => (
            <tr key={account.accountId}>
              <td>{account.accountCode}</td>
              <td>{account.accountName}</td>
              <td>{account.accountType}</td>
              <td>${account.debits.toFixed(2)}</td>
              <td>${account.credits.toFixed(2)}</td>
              <td>${account.balance.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={3}>TOTALS</th>
            <th>${trialBalance.totalDebits.toFixed(2)}</th>
            <th>${trialBalance.totalCredits.toFixed(2)}</th>
            <th>
              {trialBalance.isBalanced ? "✅ BALANCED" : "❌ UNBALANCED"}
            </th>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
```

---

## Testing Checklist

- [ ] Post an invoice to GL
- [ ] Post an expense to GL
- [ ] Verify trial balance is balanced
- [ ] Generate P&L statement
- [ ] Generate balance sheet
- [ ] Check accounting equation
- [ ] Validate all journal entries
- [ ] View account transaction history
- [ ] Generate AR aging report
- [ ] Check error handling with bad data

---

## Performance Notes

- Trial balance queries are optimized with indexes
- Large companies (1000+ transactions) should use date filters
- Monthly close operations should be done with `asOfDate` parameter
- Batch operations can be performed via Firestore's batch API

---

For more detailed information, see:
- [ACCOUNTING-SYSTEM.md](./docs/ACCOUNTING-SYSTEM.md) - Full documentation
- [ACCOUNTING-API-REFERENCE.md](./docs/ACCOUNTING-API-REFERENCE.md) - API reference
