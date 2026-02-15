# Firebase Architecture Blueprint

## Core Platform
- Authentication: Firebase Authentication (email/password, email verification, password reset, invite acceptance).
- Database: Cloud Firestore with company-scoped collections and role-aware access rules.
- Functions: Firebase Cloud Functions (callable) for secured business logic.
- Storage: Firebase Storage for company and payroll assets.

## Collection Model
- `companies`
- `users`
- `companyUsers`
- `companySettings`
- `invitations`
- `chartOfAccounts`
- `journalEntries`
- `journalLines`
- `invoices`
- `invoiceItems`
- `bills`
- `expenses`
- `payrollRuns`
- `payrollItems`
- `payrollAdditions`
- `payrollJournals`
- `employees`
- `projects`
- `projectExpenses`
- `products`
- `priceLists`
- `inventoryItems`
- `stockMovements`
- `bankAccounts`
- `bankTransactions`
- `financialYears`
- `financialPeriods`
- `periodLocks`
- `auditLogs`
- `notifications`

## Accounting Controls
- Double-entry validation enforced in callable posting functions.
- Journal posting rejects unbalanced entries.
- GL-driven reporting based on posted journal lines.
- Account numbering guardrails enforced by type ranges.

## Security Model
- JWT-authenticated callable functions only.
- Company membership checks on all privileged operations.
- Role-based checks in both functions and Firestore rules.
- Cross-company data access denied by rule predicates.

## Operational Notes
- Keep writes company-scoped (`companyId` on business documents).
- Prefer callable functions for sensitive state transitions.
- Keep UI data access in service-layer abstractions.
- Maintain Firestore indexes for query-heavy dashboards.
