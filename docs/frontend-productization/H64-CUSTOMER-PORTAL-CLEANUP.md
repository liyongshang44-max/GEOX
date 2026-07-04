# H64 Customer Portal Cleanup

H64 cleans Customer Portal only.

H64 starts after H63 Pilot Readiness Product Surface has been merged.

Customer route table owns page selection. CustomerLayout no longer substitutes children by pathname.

CustomerLayout remains shell-only. It owns customer shell, customer navigation, route title and subtitle, account scope display, read-only text guard, legacy index redirects, and the export print-only shell.

Customer navigation includes dashboard, fields, operations, reports, and export.

Evidence Summary route is not introduced in H64.

H64 does not change App route topology.

H64 does not modify backend, DB, contracts, fixtures, packages, Operator Console, or Admin Console.

H64 does not expose dispatch, AO-ACT, approval, debug, ROI Ledger, or Field Memory in the customer shell.

Preserved customer routes:

- `/customer/dashboard`
- `/customer/fields`
- `/customer/fields/:fieldId`
- `/customer/fields/:fieldId/export`
- `/customer/operations`
- `/customer/operations/:operationId`
- `/customer/operations/:operationId/export`
- `/customer/reports`
- `/customer/export`

Acceptance:

```powershell
node scripts/frontend_acceptance/ACCEPTANCE_H64_CUSTOMER_PORTAL_CLEANUP_V1.cjs
pnpm run typecheck:web
pnpm run build:web
```
