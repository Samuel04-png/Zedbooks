# ZedBooks Application Architecture and Data Flow

> Last audited: 2026-02-22
> Scope: current implementation in this repository (frontend, Firestore rules, and Cloud Functions)
> Purpose: route map, data ownership, write paths, cross-module flow, and outstanding gaps

---

## Table of Contents

1. [Navigation Structure](#1-navigation-structure)
2. [All Pages and Routes](#2-all-pages-and-routes)
3. [Firestore Collections and Permission Model](#3-firestore-collections-and-permission-model)
4. [Page to Data Write Paths (CRUD)](#4-page-to-data-write-paths-crud)
5. [Cross-Page Data Dependencies and Current Status](#5-cross-page-data-dependencies-and-current-status)
6. [Permission and Access Audit](#6-permission-and-access-audit)
7. [Cloud Functions Backend](#7-cloud-functions-backend)
8. [Role-Based Access Control](#8-role-based-access-control)
9. [Action Items and Recommendations](#9-action-items-and-recommendations)
10. [How the App Works End to End](#10-how-the-app-works-end-to-end)
11. [Appendix: File Structure Reference](#11-appendix-file-structure-reference)

---

## 1. Navigation Structure

The sidebar (`src/components/layout/AppSidebar.tsx`) is organized into 10 sections:

| # | Section | Pages |
|---|---------|-------|
| 1 | Overview | Dashboard |
| 2 | Sales and Receivables | Customers, Invoices, Accounts Receivable, Estimates, Sales Orders |
| 3 | Purchasing and Payables | Vendors, Bills, Accounts Payable, Purchase Orders, Expenses |
| 4 | Inventory and Assets | Products and Services, Inventory, Fixed Assets, Depreciation |
| 5 | Banking | Bank Accounts, Reconciliation |
| 6 | People | Employees, Payroll, Advances, Time and Contractors |
| 7 | Projects and Grants | Projects, Donors and Grants |
| 8 | Accounting | Chart of Accounts, Journal Entries, Opening Balances, Financial Periods |
| 9 | Reports | Financial Reports, Payroll Reports, ZRA Compliance, Tax Calculator |
| 10 | Administration | Users and Roles, Audit Logs, Payroll Settings, Company Settings |

Pages not in sidebar (route-only):
- `/`
- `/auth`
- `/accept-invitation`
- `/setup`
- `/invoices/new`
- `/quotations/new`
- `/employees/new`
- `/employees/:id/edit`
- `/employees/bulk-upload`
- `/employees/:id/payroll-setup`
- `/payroll/new`
- `/payroll/:id`
- `/payroll/:id/approve`
- `/payroll/:runId/payslip/:employeeId`
- `/projects/:projectId/expenses`
- `/projects/:projectId/activity-log`

---

## 2. All Pages and Routes

### Public pages

| Route | Page File | Description |
|-------|-----------|-------------|
| `/` | `Landing.tsx` | Marketing landing page |
| `/auth` | `Auth.tsx` | Login and registration |
| `/accept-invitation` | `AcceptInvitation.tsx` | Invitation acceptance flow |

### Protected pages (auth required)

| Route | Page File | Description |
|-------|-----------|-------------|
| `/setup` | `CompanySetup.tsx` | Company setup wizard |
| `/dashboard` | `Dashboard.tsx` | Role-specific dashboards |

### Role-protected pages (auth plus role checks)

| Route | Page File |
|-------|-----------|
| `/customers` | `Customers.tsx` |
| `/invoices` | `Invoices.tsx` |
| `/invoices/new` | `NewInvoice.tsx` |
| `/accounts-receivable` | `AccountsReceivable.tsx` |
| `/estimates` | `Estimates.tsx` |
| `/sales-orders` | `SalesOrders.tsx` |
| `/quotations/new` | `NewQuotation.tsx` |
| `/vendors` | `Vendors.tsx` |
| `/bills` | `Bills.tsx` |
| `/accounts-payable` | `AccountsPayable.tsx` |
| `/purchase-orders` | `PurchaseOrders.tsx` |
| `/expenses` | `Expenses.tsx` |
| `/products` | `Products.tsx` |
| `/inventory` | `Inventory.tsx` |
| `/fixed-assets` | `FixedAssets.tsx` |
| `/asset-depreciation` | `AssetDepreciation.tsx` |
| `/bank-accounts` | `BankAccounts.tsx` |
| `/reconciliation` | `Reconciliation.tsx` |
| `/employees` | `Employees.tsx` |
| `/employees/new` | `NewEmployee.tsx` |
| `/employees/:id/edit` | `EditEmployee.tsx` |
| `/employees/bulk-upload` | `BulkUploadEmployees.tsx` |
| `/employees/:id/payroll-setup` | `EmployeePayrollSetupPage.tsx` |
| `/payroll` | `Payroll.tsx` |
| `/payroll/new` | `NewPayrollRun.tsx` |
| `/payroll/:id` | `PayrollDetail.tsx` |
| `/payroll/:id/approve` | `PayrollApproval.tsx` |
| `/payroll/:runId/payslip/:employeeId` | `Payslip.tsx` |
| `/advances` | `Advances.tsx` |
| `/time-tracking` | `TimeTracking.tsx` |
| `/projects` | `Projects.tsx` |
| `/projects/:projectId/expenses` | `ProjectExpenses.tsx` |
| `/projects/:projectId/activity-log` | `ProjectActivityLog.tsx` |
| `/donors` | `Donors.tsx` |
| `/chart-of-accounts` | `ChartOfAccounts.tsx` |
| `/journal-entries` | `JournalEntries.tsx` |
| `/opening-balances` | `OpeningBalances.tsx` |
| `/financial-periods` | `FinancialPeriods.tsx` |
| `/reports` | `FinancialReports.tsx` |
| `/payroll-reports` | `PayrollReports.tsx` |
| `/zra-compliance` | `ZRACompliance.tsx` |
| `/tax-calculator` | `TaxCalculator.tsx` |

### Route-level explicit admin role checks

| Route | Allowed Roles |
|-------|---------------|
| `/company-settings` | `super_admin`, `admin` |
| `/users` | `super_admin`, `admin` |
| `/payroll-settings` | `super_admin`, `admin` |
| `/audit-logs` | `super_admin`, `admin`, `auditor` |
| `/financial-periods` | `super_admin`, `admin`, `financial_manager`, `accountant`, `assistant_accountant`, `finance_officer`, `bookkeeper` |
| `/opening-balances` | `super_admin`, `admin`, `financial_manager`, `accountant` |

---

## 3. Firestore Collections and Permission Model

### Current counts

- `src/services/firebase/collectionNames.ts`: 52 collection constants
- `firestore.rules`: 54 collection matches
- Rules-only collections (not in constants): `billItems`, `expenseCategoryMappings`

### Role groups in Firestore rules

| Group | Roles |
|------|------|
| `canManageCompany` | `super_admin`, `admin` |
| `canManageAccounting` | `super_admin`, `admin`, `financial_manager`, `accountant`, `assistant_accountant`, `finance_officer`, `bookkeeper` |
| `canManageCommercial` | `super_admin`, `admin`, `financial_manager`, `accountant`, `assistant_accountant`, `finance_officer`, `bookkeeper`, `cashier` |
| `canManagePayroll` | `super_admin`, `admin`, `financial_manager`, `accountant`, `hr_manager` |
| `canManageProjects` | `super_admin`, `admin`, `financial_manager`, `accountant`, `project_manager` |
| `canManageInventory` | `super_admin`, `admin`, `financial_manager`, `accountant`, `assistant_accountant`, `inventory_manager`, `bookkeeper`, `cashier` |
| `canViewAudit` | `super_admin`, `admin`, `financial_manager`, `auditor` |

### Collections that block client writes completely

| Collection | Read | Create/Update/Delete |
|-----------|------|----------------------|
| `journalEntries` | company member | blocked (function-only) |
| `journalLines` | company member | blocked (function-only) |
| `auditLogs` | audit roles | blocked |
| `companyUsers` | own/member | blocked (function-only) |
| `userRoles` | own/member | blocked |
| `invitations` | blocked | blocked (function-only) |
| `notifications` | company member | blocked |

### Collections with delete blocked (`allow delete: if false`)

- `companies`
- `companySettings`
- `chartOfAccounts` (client delete blocked; deletion handled via callable with validations)
- `invoices`
- `bills`
- `expenses`
- `payrollRuns`

---

## 4. Page to Data Write Paths (CRUD)

### Callable-backed transactional writes (current state)

| Module/Page | Primary Write Path | Result |
|-------------|--------------------|--------|
| New Invoice (`NewInvoice.tsx`) | `accountingService.createInvoice` | Creates invoice, items, journal entry, customer rollups, inventory movement |
| Bills (`Bills.tsx`) | `createBill`, `payBill` | Creates bill, bill payment, journal entries, vendor rollups, bank transactions |
| Expenses (`Expenses.tsx`) | `recordExpense` | Creates expense, journal entry, bank transaction |
| Chart of Accounts (`ChartOfAccounts.tsx`) | `deleteChartOfAccount` | Safe delete with backend checks (system account, children, journal history) |
| Journal Entries (`JournalEntries.tsx`) | `postJournalEntry`, `reverseJournalEntry` | Controlled posting/reversal |
| Opening Balances (`OpeningBalances.tsx`) | `postJournalEntry` | Journal-backed opening balances |
| Payroll (`NewPayrollRun.tsx`, `PayrollDetail.tsx`) | `createPayrollDraft`, `runPayrollTrial`, `finalizePayroll` | Draft then processing journal entry |
| Payroll payment (`payrollService`) | `payPayroll`, `reversePayrollPayment` callables | Creates and reverses payroll payment journal entries |
| Payroll accrual reversal (`PayrollDetail.tsx`) | `reversePayroll` callable | Reverses payroll accrual journal after payment reversal (if paid) |

### Direct Firestore writes still used

- Master/reference CRUD:
  - `Customers.tsx`, `Vendors.tsx`, `Products.tsx`, `Inventory.tsx`, `Projects.tsx`, `ProjectExpenses.tsx`, `Employees.tsx`, `Advances.tsx`, `TimeTracking.tsx`, `PurchaseOrders.tsx`, `Estimates.tsx`
- Hybrid page:
  - `Expenses.tsx`: create via callable, non-posted edit via direct `setDoc`
- Administration/settings:
  - `CompanySettings.tsx`, `FinancialPeriods.tsx`, `Reconciliation.tsx`

### Reversal paths implemented

- Invoices page: reverse posted invoice journal entries (guarded if payments exist)
- Bills page: reverse posted bill journal entries (guarded if payments exist)
- Expenses page: reverse posted expense journal entries
- Accounts Receivable and Accounts Payable pages: reverse payment journal entries
- Backend reversal side effects now update payment flags, parent invoice/bill paid amounts, customer/vendor counters, and linked bank balances

---

## 5. Cross-Page Data Dependencies and Current Status

### Sales flow

`Customers -> Invoices -> Accounts Receivable -> Financial Reports`

Implemented:
- Invoice creation posts to GL immediately and updates customer totals (`totalInvoiced`, `outstandingBalance`)
- Invoice payment posting logic exists in backend (`recordInvoicePayment`) and updates AR, customer totals, bank transactions, and bank balances
- Payment reversal now rolls those changes back safely

Notes:
- Current Accounts Receivable page is strong on visibility and reversal; payment capture UX is limited compared to Bills page
- Inventory deduction from invoices is implemented when line items map to products (product id or description-name match)

### Purchasing flow

`Vendors -> Bills -> Accounts Payable -> Financial Reports`

Implemented:
- Bill creation posts to GL and updates vendor totals
- Bill payment creates payment record, GL entry, bank transaction, bank balance update, and vendor rollup updates
- Bill payment reversal reverses all linked effects

### Expenses flow

`Expenses -> GL Posting -> Financial Reports`

Implemented:
- Expense recording is function-backed and always posts journal entry in the same transaction
- Bank transactions and linked bank account balances are updated automatically
- Posted expenses can be reversed from the UI

### Inventory flow

`Products <-> Inventory -> Sales`

Implemented:
- Invoice posting can decrement inventory and create `stockMovements`

Remaining gap:
- Product linkage from `NewInvoice.tsx` is currently description-centric, so inventory deduction depends on product resolution

### Payroll flow

`Employees -> Payroll Draft -> Process Payroll -> Payslips`

Implemented:
- Draft save does not create journal entry
- Processing creates payroll journal entry
- Salary payment callable exists (`payPayroll`) for payment posting
- Paid payroll now follows a two-step reversal sequence:
  - reverse payment (`reversePayrollPayment`) -> status `payment_reversed`
  - reverse accrual (`reversePayroll`) -> status `reversed`
- Advance deductions are now applied and statuses are updated (`pending/partial/deducted`)
- Payroll reversal now restores advance deductions using deduction audit logs (`payrollAdvanceDeductions`)
- Period locks are enforced in payroll processing/payment paths

### Projects flow

`Projects -> Project Expenses -> Reporting`

Remaining gaps:
- Project expense posting to GL is still not automatic
- Time entries still do not auto-calculate project costing into accounting entries
- Donors are still derived from `projects` (no dedicated `donors` collection)

### Banking and accounting controls

Implemented:
- Expense, bill payment, invoice payment, and payment reversals write `bankTransactions` and update linked `bankAccounts.currentBalance`
- Period locks are enforced in accounting and payroll callables, including journal reversals

---

## 6. Permission and Access Audit

### Resolved since prior audit

1. `finance_officer` and `bookkeeper` can now write `chartOfAccounts` by rule (`canManageAccounting` updated)
2. `bookkeeper` can now write `fixedAssets`
3. `cashier` was added to `canManageInventory`
4. `OpeningBalances` route now exists and is in sidebar
5. Core financial transactions moved to callable flows

### Remaining permission and UX mismatches

1. Some master-data pages still use direct Firestore writes and should migrate to callable-backed writes for consistent transactional validation
2. More pages still expose delete actions that should be role-gated in the UI to avoid avoidable permission errors

### Delete behavior summary

- Hard-blocked by rules (`if false`): invoices, bills, expenses, payroll runs, chart of accounts (client side)
- Admin-only by rules (`canManageCompany`): customers, vendors, products, employees, projects, and other master data collections

---

## 7. Cloud Functions Backend

Current backend files under `functions/`:

- `index.js` (callable exports)
- `accounting.js` (legacy accounting callable handlers)
- `accountingEngine.js` (current transactional accounting engine)
- `accountingPostingService.js` (journal/account helper layer)
- `payroll.js` (draft/process/pay payroll logic)
- `ai.js`
- `notifications.js`
- `zra.js`

Key callable groups in use:

- Accounting transactions: `createInvoice`, `recordInvoicePayment`, `createBill`, `payBill`, `recordExpense`, `reverseJournalEntry`, `deleteChartOfAccount`
- Payroll lifecycle: `createPayrollDraft`, `processPayroll`, `payPayroll` (`finalizePayroll` alias)
- Reporting from journal data: profit and loss, balance sheet, trial balance, general ledger, cash flow, dashboard live metrics
- User management and invitations: invitation create/accept/list/update/remove/suspend/reactivate paths

Note:
- Duplicate callable export declarations in `functions/index.js` were cleaned up; canonical payroll and reporting exports are now single-source.

---

## 8. Role-Based Access Control

Auth and authorization flow:

1. User signs in through Firebase Auth
2. `useUserRole` resolves role from `companyUsers` and fallback `userRoles`
3. `RoleProtectedRoute` gates route access in UI
4. `AppSidebar` filters visible navigation using `canAccessRoute`
5. Firestore rules enforce final read/write authorization server-side

Supported roles (priority order):

1. `super_admin`
2. `admin`
3. `financial_manager`
4. `accountant`
5. `bookkeeper`
6. `assistant_accountant`
7. `finance_officer`
8. `hr_manager`
9. `project_manager`
10. `inventory_manager`
11. `cashier`
12. `auditor`
13. `staff`
14. `read_only`

---

## 9. Action Items and Recommendations

### Critical

1. Add or restore clear invoice payment capture UX in Accounts Receivable that calls `recordInvoicePayment` directly (backend is ready)
2. Continue replacing remaining direct Firestore financial writes with callable-backed transactional flows
3. Finish hiding/disabling admin-only delete actions across all remaining pages

### Important

4. Normalize invoice line item product linkage in `NewInvoice.tsx` (pass explicit `productId`) so inventory deduction is deterministic
5. Wire project expenses and time costs into GL posting flow if they are meant to affect financial statements
6. Maintain single-source callable exports in `functions/index.js` as new functions are added

### Minor

7. Consider a dedicated `donors` collection instead of deriving from `projects`
8. Consider separating estimates from sales orders into distinct collections to reduce coupling risk
9. Keep dashboard query usage constrained to predefined query maps (current allow-list is a good baseline)

---

## 10. How the App Works End to End

### From a company perspective

1. A company is created and configured (`companies`, `companySettings`)
2. Chart of accounts and expense categories are seeded
3. Operational modules create source transactions:
   - Sales: invoices and invoice payments
   - Purchasing: bills and bill payments
   - Expenses: direct expense posting
   - Payroll: draft -> process -> pay
4. Each transactional event posts balanced journal entries in Firestore journal collections
5. Reports and dashboard financial metrics read from journal data and account structures
6. Banking reflects movement from transactional posting and reversal events via `bankTransactions` and linked account balance updates

### From an end user perspective

1. User signs in and gets role-scoped navigation
2. User records operational events in relevant modules
3. System posts accounting entries in the same backend transaction (for callable-backed flows)
4. User sees immediate downstream impact across AP/AR, dashboards, and reports
5. If needed, authorized users reverse posted entries instead of deleting financial history

### Core accounting behavior

- Every posted transaction creates at least two journal lines
- Debits and credits remain balanced by engine validation
- Reversal uses contra entries, preserving audit trail
- Financial periods can block backdated posting/editing in locked ranges

---

## 11. Appendix: File Structure Reference

```
src/
|- App.tsx
|- contexts/AuthContext.tsx
|- hooks/
|  |- useUserRole.ts
|  |- useCompanySettings.ts
|  |- useDepreciationRunner.ts
|- services/firebase/
|  |- collectionNames.ts
|  |- accountingService.ts
|  |- payrollService.ts
|  |- dashboardService.ts
|  |- functionsService.ts
|  |- companyService.ts
|  |- authService.ts
|  |- types.ts
|- components/layout/
|  |- AppLayout.tsx
|  |- AppSidebar.tsx
|  |- ProtectedRoute.tsx
|  |- RoleProtectedRoute.tsx
|- pages/  (54 TSX files)

functions/
|- index.js
|- accounting.js
|- accountingEngine.js
|- accountingPostingService.js
|- payroll.js
|- ai.js
|- notifications.js
|- zra.js
```
