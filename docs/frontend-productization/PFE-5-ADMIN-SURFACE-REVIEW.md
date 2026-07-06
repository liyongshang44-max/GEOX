<!-- docs/frontend-productization/PFE-5-ADMIN-SURFACE-REVIEW.md -->
# PFE-5 Admin Surface Review

## 0. Status

PFE-5 covers seven formal Admin Console surfaces. Each surface is an internal governance and readback page using PFE-2 Product Design System primitives.

Later accessibility, responsive, screenshot, and visual-regression hardening remain later PFE work.

## 1. Surface matrix

| route | implementation file | product primitives used | boundary status | nonclaim status | route naming debt | state coverage | later gaps |
|---|---|---|---|---|---|---|---|
| `/admin/dashboard` | `apps/web/src/features/admin/pages/AdminDashboardPage.tsx` | ProductPageShell; ProductPageHeader; ProductBoundaryBanner; ProductSectionCard; ProductMetricTile; ProductStatusBadge; ProductDataTable; ProductScopeBar; ProductStateBlock | governance overview | not dispatch; not production gateway; not customer report UI | URL-only routes preserved; future pages deferred | future state block; route compatibility table | PFE-6/PFE-7/PFE-9 |
| `/admin/fields` | `apps/web/src/features/admin/pages/AdminFieldsPage.tsx` | ProductPageShell; ProductPageHeader; ProductBoundaryBanner; ProductSectionCard; ProductMetricTile; ProductStatusBadge; ProductDataTable; ProductScopeBar; ProductEmptyState | field governance readback | not customer report; not dispatch | none | empty/unavailable copy | PFE-6/PFE-7/PFE-9 |
| `/admin/operations` | `apps/web/src/features/admin/pages/AdminOperationsPage.tsx` | ProductPageShell; ProductPageHeader; ProductBoundaryBanner; ProductSectionCard; ProductMetricTile; ProductStatusBadge; ProductDataTable; ProductScopeBar; ProductEmptyState; ProductStateBlock | operation governance readback | not dispatch; not AO-ACT control | none | blocked/degraded state copy | PFE-6/PFE-7/PFE-9 |
| `/admin/devices` | `apps/web/src/features/admin/pages/AdminDevicesPage.tsx` | ProductPageShell; ProductPageHeader; ProductBoundaryBanner; ProductSectionCard; ProductMetricTile; ProductStatusBadge; ProductDataTable; ProductScopeBar; ProductEmptyState; ProductStateBlock | device inventory readback | not live device monitor; not production gateway action | none | offline/unavailable state copy | PFE-6/PFE-7/PFE-9 |
| `/admin/evidence` | `apps/web/src/features/admin/pages/AdminEvidencePage.tsx` | ProductPageShell; ProductPageHeader; ProductBoundaryBanner; ProductSectionCard; ProductMetricTile; ProductStatusBadge; ProductDataTable; ProductScopeBar; ProductEmptyState; ProductStateBlock | evidence governance readback | not facts writer; no raw mutation | none | missing/source-unavailable state copy | PFE-6/PFE-7/PFE-9 |
| `/admin/skills` | `apps/web/src/features/admin/pages/AdminSkillsPage.tsx` | ProductPageShell; ProductPageHeader; ProductBoundaryBanner; ProductSectionCard; ProductMetricTile; ProductStatusBadge; ProductDataTable; ProductScopeBar; ProductEmptyState; ProductStateBlock | skills and config readback | not skill execution; not production control | `/admin/config` not promoted | future state block | PFE-6/PFE-7/PFE-9 |
| `/admin/healthz` | `apps/web/src/features/admin/pages/AdminHealthzPage.tsx` | ProductPageShell; ProductPageHeader; ProductBoundaryBanner; ProductSectionCard; ProductMetricTile; ProductStatusBadge; ProductDataTable; ProductScopeBar; ProductEmptyState; ProductStateBlock | health readback | not production readiness proof; not live monitoring | `/admin/health` not promoted | degraded/unavailable/future state copy | PFE-6/PFE-7/PFE-9 |

## 2. Landmark review

`apps/web/src/layouts/AdminLayout.tsx` uses a `<div className="adminLayoutMain">` container. Page-level main landmarks are owned by each formal Admin page through `ProductPageShell`.

## 3. Compatibility and future pages

URL-only compatibility routes remain outside formal Admin productization:

```text
/admin/alerts
/admin/acceptance
/admin/import
/admin/operations/:operationId/debug
```

Future product-contract pages remain deferred:

```text
/admin/tenants
/admin/imports
/admin/audit
/admin/config
/admin/health
```
