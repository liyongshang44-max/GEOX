# H65 Admin Console Cleanup

H65 cleans Admin Console only.

H65 starts after H64 Customer Portal Cleanup has been merged.

AdminLayout no longer delegates to AppShell.

AdminLayout owns independent Admin Console shell.

Admin route topology remains unchanged.

Formal Admin nav includes dashboard, fields, operations, devices, evidence, runtime health, and config.

Alerts / acceptance / import / debug remain URL-only unless separately productized.

H65 does not change Customer Portal.

H65 does not change Operator Runtime Console.

H65 does not modify backend, DB, contracts, fixtures, packages.

H65 does not create facts, dispatch, AO-ACT, ROI, or Field Memory.

Preserved Admin routes:

- /admin/dashboard
- /admin/fields
- /admin/operations
- /admin/devices
- /admin/alerts
- /admin/evidence
- /admin/skills
- /admin/acceptance
- /admin/healthz
- /admin/import
- /admin/operations/:operationId/debug

Acceptance:

node scripts/frontend_acceptance/ACCEPTANCE_H65_ADMIN_CONSOLE_CLEANUP_V1.cjs
pnpm run typecheck:web
pnpm run build:web