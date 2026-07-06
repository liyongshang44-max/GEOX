<!-- docs/frontend-productization/PFE-5-ADMIN-CONSOLE-PRODUCTIZATION.md -->
# PFE-5 Admin Console Productization

## 0. Phase

PFE-5 productizes the Admin Console as an internal governance and readback surface.

PFE-3 completed Customer Portal productization. PFE-4 completed Operator Runtime Console productization. PFE-5 covers Admin Console only.

## 1. Goal

Admin Console is productized as an internal governance and readback surface using PFE-2 Product Design System primitives and PFE-1 page contracts.

Chinese completion statement:

```text
Admin Console 已按 PFE-1 页面契约和 PFE-2 产品设计系统，产品化为内部治理与回查控制台。
```

## 2. Source baseline

```text
docs/frontend-productization/PFE-1-PAGE-CONTRACT-REGISTER.md
docs/frontend-productization/PFE-2-DESIGN-SYSTEM-V1-COMPLETION.md
apps/web/src/layouts/AdminLayout.tsx
```

## 3. Covered routes

PFE-5 covers only the seven formal Admin Console routes below:

```text
/admin/dashboard
/admin/fields
/admin/operations
/admin/devices
/admin/evidence
/admin/skills
/admin/healthz
```

## 4. Non-goals

PFE-5 does not productize URL-only compatibility routes or future contract pages.

Out of scope:

```text
/admin/alerts
/admin/acceptance
/admin/import
/admin/operations/:operationId/debug
/admin/tenants
/admin/imports
/admin/audit
/admin/config
/admin/health
/legacy/*
/dev/*
/judge/*
/sim/*
```

PFE-5 does not modify Customer Portal, Operator Runtime Console, route topology, backend, migrations, packages/contracts, fixtures, package files, or CI workflow files.

## 5. Allowed files

```text
apps/web/src/layouts/AdminLayout.tsx
apps/web/src/features/admin/pages/AdminDashboardPage.tsx
apps/web/src/features/admin/pages/AdminFieldsPage.tsx
apps/web/src/features/admin/pages/AdminOperationsPage.tsx
apps/web/src/features/admin/pages/AdminDevicesPage.tsx
apps/web/src/features/admin/pages/AdminEvidencePage.tsx
apps/web/src/features/admin/pages/AdminSkillsPage.tsx
apps/web/src/features/admin/pages/AdminHealthzPage.tsx
apps/web/src/styles/adminControlPlane.css
docs/frontend-productization/PFE-5-ADMIN-CONSOLE-PRODUCTIZATION.md
docs/frontend-productization/PFE-5-ADMIN-SURFACE-REVIEW.md
scripts/frontend_acceptance/ACCEPTANCE_PFE_5_ADMIN_CONSOLE_PRODUCTIZATION.cjs
```

## 6. Forbidden files

```text
apps/web/src/features/customer/*
apps/web/src/features/operator/*
apps/web/src/layouts/CustomerLayout.tsx
apps/web/src/layouts/OperatorLayout.tsx
apps/web/src/app/App.tsx
apps/web/src/app/routes/*
apps/server/*
migrations/*
packages/contracts/*
fixtures/*
.github/*
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
```

## 7. AdminLayout landmark decision

PFE-5 applies the AdminLayout landmark correction.

`AdminLayout` no longer wraps page content in a page-level `<main>`. The `adminLayoutMain` container is a `<div>`, and each formal Admin page owns the page-level `<main>` through `ProductPageShell`.

This is not a route topology change and does not change Admin capabilities.

## 8. Admin vocabulary

Allowed Admin product vocabulary:

```text
Admin Console
internal governance
readback
governance readback
source identity
route naming debt
URL-only compatibility
future page deferred
read-only
unavailable
disabled
not dispatch
not live device
not production gateway
```

Forbidden positive claims are not allowed in Admin source. Negative or nonclaim copy is allowed and required.

## 9. Design system usage

PFE-5 uses PFE-2 primitives across the Admin formal pages:

```text
ProductPageShell
ProductPageHeader
ProductBoundaryBanner
ProductSectionCard
ProductMetricTile
ProductStatusBadge
ProductDataTable
ProductScopeBar
ProductEmptyState
ProductStateBlock
```

## 10. URL-only compatibility preservation

The following remain URL-only compatibility or legacy surfaces and are not promoted by PFE-5:

```text
/admin/alerts
/admin/acceptance
/admin/import
/admin/operations/:operationId/debug
```

Formal Admin navigation remains limited to the seven covered routes.

## 11. Future page deferral

The following remain future product-contract pages and are not implemented in PFE-5:

```text
/admin/tenants
/admin/imports
/admin/audit
/admin/config
/admin/health
```

`/admin/config` route naming debt is recorded on `/admin/skills`.

`/admin/health` route naming debt is recorded on `/admin/healthz`.

## 12. Acceptance

```powershell
node scripts/frontend_acceptance/ACCEPTANCE_PFE_5_ADMIN_CONSOLE_PRODUCTIZATION.cjs
pnpm run typecheck:web
pnpm run build:web
git status --short
```

GitHub CI runtime acceptance must pass before merge.

## 13. Completion statement

PFE-5 is complete when the seven formal Admin Console routes are productized as internal governance and readback surfaces, AdminLayout has no nested page-level main landmark, PFE-2 primitives are used, PFE-1 contracts remain covered, and local plus GitHub acceptance pass.
