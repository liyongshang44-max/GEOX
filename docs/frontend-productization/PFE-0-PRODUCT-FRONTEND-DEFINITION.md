<!-- docs/frontend-productization/PFE-0-PRODUCT-FRONTEND-DEFINITION.md -->
# PFE-0 Product Frontend Definition & Audit

## 0. Phase

PFE-0 Product Frontend Definition & Audit / PFE-0 产品前端定义与审计.

PFE-0 is the first phase of Product Frontend Excellence. It establishes the audit baseline for the product frontend line after H67, F0-A, F1, F2, F0-B, and the R1-R5 runtime-readiness handoff documents.

PFE-0 does not define routes from memory. PFE-0 audits the current repository route inventory.

## 1. Goal

PFE-0 answers one product-front-end question:

```text
Which current GEOX frontend routes and surfaces are formal v1 pages, formal sub-surfaces, export / print secondary surfaces, URL-only compatibility surfaces, future product-contract pages, or do-not-build pages?
```

The output of PFE-0 is a stable audit baseline for PFE-1 through PFE-13.

The final PFE line goal is:

```text
A role-separated, bilingual, accessible, responsive, visually coherent, regression-testable, demo-ready, boundary-safe enterprise product frontend.
```

中文目标：

```text
一个角色分离、支持中英文、可访问、响应式、视觉一致、可回归测试、可演示、边界安全的企业级产品前端。
```

## 2. Non-goals

PFE-0 is not a page repair phase.

PFE-0 is not frontend source refactoring.

PFE-0 is not route topology work.

PFE-0 is not UI redesign.

PFE-0 is not accessibility repair.

PFE-0 is not responsive repair.

PFE-0 is not Playwright coverage.

PFE-0 is not visual regression automation.

PFE-0 is not runtime readiness.

PFE-0 is not Silicon-Valley-grade completion.

PFE-0 does not start the app, call backend APIs, call the database, write facts, mutate source data, add packages, add migrations, create recommendations, enable AO-ACT, compute ROI, write Field Memory, or start field pilot execution.

## 3. Source-of-truth priority

PFE-0 audits the repository using this source-of-truth priority:

1. `apps/web/src/app/App.tsx`
2. `apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx`
3. `apps/web/src/app/routes/fieldsRoutes.tsx`
4. `apps/web/src/app/routes/customerOperationsRoutes.tsx`
5. `docs/frontend-productization/H67-FRONTEND-ROUTE-SURFACE-MANIFEST.md`
6. `docs/frontend-productization/F0-A-PAGE-GAP-REGISTER.md`
7. `docs/frontend-productization/F0-B-FRONTEND-PRODUCTIZATION-FREEZE.md`

PFE-0 treats H67 as the frozen formal route manifest, F0-A as the page gap and route classification register, and F0-B as the frontend-productization freeze and runtime-readiness handoff declaration.

If a short task list conflicts with the current repository route inventory, PFE-0 follows the repository inventory and records the classification explicitly.

## 4. Surface classification vocabulary

PFE-0 uses six classifications.

### formal v1 page

A current Product Frontend v1 page that belongs to a formal role-separated surface.

Examples include `/customer/dashboard`, `/customer/fields`, `/customer/operations`, `/customer/reports`, `/operator/twin`, `/operator/fields`, `/operator/twin/gateway-demo`, `/operator/pilot`, `/admin/dashboard`, `/admin/fields`, `/admin/operations`, `/admin/devices`, `/admin/evidence`, `/admin/skills`, and `/admin/healthz`.

### formal sub-surface

A child page, detail page, tab, or field-scoped surface under a formal page family.

Examples include `/customer/fields/:fieldId`, `/customer/operations/:operationId`, `/operator/fields/:fieldId`, and the Operator Field Runtime tabs for state, evidence, forecast, scenario, residual, calibration, health, and audit.

### export / print secondary surface

A user-visible delivery, export, print, or report handoff surface that is not a primary product page.

Examples include `/customer/export`, `/customer/fields/:fieldId/export`, and `/customer/operations/:operationId/export`.

### URL-only compatibility

A reachable route that must not be promoted into formal navigation or treated as a current formal product page.

Examples include `/admin/alerts`, `/admin/acceptance`, `/admin/import`, `/admin/operations/:operationId/debug`, `/legacy/*`, `/judge/*`, `/sim/*`, `/settings`, and `/dev`.

### future product-contract page

A future route or surface that may be productized only after a separate product contract, route ownership statement, boundary copy, and acceptance gate.

Examples include `/operator/evidence`, `/operator/health`, `/operator/settings`, `/customer/evidence-summary`, `/admin/tenants`, `/admin/imports`, `/admin/audit`, `/admin/config`, and `/admin/health`.

### do-not-build page

A forbidden formal product surface for the current product line.

Examples include Customer Dispatch, Customer AO-ACT, Customer ROI Ledger, Customer Field Memory, Operator Dispatch Console, Operator AO-ACT Control, Operator Live Device Monitor, Operator Production Gateway Online, Operator Field Pilot Execution, Admin Debug Formal Page, Admin Acceptance Formal Nav Page, and Legacy Dev Tools Formal Page.

Do-not-build pages are not backlog items. They are formal-surface prohibitions unless a later governance decision explicitly replaces this classification.

## 5. Role-separated product surfaces

PFE-0 preserves the three role-separated product surfaces.

### Customer Portal

Customer Portal is customer-visible reporting only.

Customer Portal has no operational command surface, no admin route ownership, no debug route in formal navigation, no internal value ledger route in formal navigation, and no long-term field memory route in formal navigation.

### Operator Runtime Console

Operator Runtime Console is a read-only review surface.

Operator Runtime Console may be replay-backed or checked-in snapshot-backed where applicable. It has no live device claim, no production gateway online claim, no field pilot execution claim, no controlled execution enabled, no recommendation creation claim, no fact persistence claim from these surfaces, no value ledger mutation claim, and no long-term field record mutation claim.

### Admin Console

Admin Console is an internal governance and readback shell.

Admin Console formal navigation excludes debug, import, and acceptance. URL-only compatibility routes may remain reachable, but they are not formal nav items and not formal v1 product pages.

## 6. Product frontend quality dimensions

PFE-0 records quality dimensions for every audited route or surface, but PFE-0 does not repair them.

The audit dimensions are:

```text
locale status
accessibility status
responsive status
empty/loading/error state status
screenshot / visual baseline status
release status
next PFE owner phase
```

PFE-0 can mark a dimension as inherited baseline, partial, registered gap, manual-only baseline, URL-only, blocked, future-contract required, or do-not-build. These marks are audit statements, not repair claims.

## 7. PFE phase handoff

PFE-0 hands off the route and page audit matrix to later Product Frontend Excellence phases.

Expected ownership mapping:

```text
PFE-1: information architecture and product navigation cleanup
PFE-2: product design system and shared surface primitives
PFE-3: Customer Portal productization
PFE-4: Operator Runtime Console productization
PFE-5: Admin Console productization
PFE-6: empty, loading, error, and degraded-state hardening
PFE-7: responsive viewport hardening
PFE-8: accessibility hardening
PFE-9: visual baseline and screenshot smoke discipline
PFE-10: demo-mode and review-mode hardening
PFE-11: regression test coverage and route smoke gates
PFE-12: boundary and nonclaim copy hardening
PFE-13: Product Frontend Excellence release gate
```

Future phases must not use PFE-0 to add routes, promote URL-only compatibility routes, or convert do-not-build pages into backlog.

## 8. Completion definition

PFE-0 is complete when:

```text
PFE-0 definition doc exists.
PFE-0 page audit matrix exists.
Source-of-truth priority is declared.
Classification vocabulary is declared.
Customer Portal routes are audited.
Operator Runtime Console routes are audited.
Admin Console formal and URL-only compatibility routes are audited.
Future product-contract pages are recorded.
Do-not-build pages are recorded.
Every audited surface has PFE owner phase mapping.
PFE-0 acceptance passes.
No apps/web/src changes are included.
No apps/server changes are included.
No migrations changes are included.
No packages/contracts changes are included.
No fixtures changes are included.
No package changes are included.
```

## 9. Accepted statement after PFE-0

After PFE-0, the only allowed completion statement is:

```text
The current frontend route/page inventory has been audited, classified, and bounded for the Product Frontend Excellence line.
```

中文：

```text
当前前端 route / page / surface 已经完成产品前端线的审计、分类和边界冻结。
```

PFE-0 must not claim GEOX is already a Silicon-Valley-grade product frontend, pages are finally productized, accessibility is complete, responsive behavior is complete, visual regression is automated, demo mode is complete, runtime is live, or field pilot can start.
