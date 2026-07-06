<!-- docs/frontend-productization/PFE-10-PERFORMANCE-BUDGET-BUNDLE-HYGIENE.md -->
# PFE-10 Performance Budget & Bundle Hygiene

## 0. Phase

PFE-10 Performance Budget & Bundle Hygiene.

PFE-10 establishes a build-output performance budget and bundle hygiene gate for Formal Product Frontend v1. It is not Lighthouse scoring, real-user monitoring, service worker work, server performance work, or a new visual regression phase.

## 1. Completion statement

Formal Product Frontend v1 has a build-output performance budget and bundle hygiene baseline. The web build output is measured, JS/CSS/raw/gzip/asset-count budgets are documented and gated, and future bundle growth cannot pass silently.

Chinese completion statement:

```text
正式产品前端 v1 已经建立构建产物性能预算与 bundle 卫生基线；web 构建产物会被度量，JS/CSS/raw/gzip/asset-count 预算已经文档化并纳入门禁，后续 bundle 膨胀不能静默通过。
```

## 2. Source baseline

PFE-10 follows the completed product frontend phases:

```text
PFE-6 Accessibility & Keyboard Compliance
PFE-7 Responsive / Viewport Completion
PFE-8 Empty / Loading / Error State Completion
PFE-9 Visual Regression & Screenshot Baseline
```

The web app already uses Vite build output under `apps/web/dist`. PFE-10 measures that output directly with Node built-ins and does not add a bundle analyzer dependency.

## 3. Covered surfaces

PFE-10 covers the formal product frontend as a build artifact:

```text
Customer 9 routes
Operator 13 routes
Admin 7 routes
/login
Product primitives
shell layouts
export / print surfaces
PFE-9 screenshot and capture scripts
```

PFE-10 does not work route-by-route unless the budget checker exposes a concrete problem.

## 4. Budget policy

The budget config is:

```text
docs/frontend-productization/PFE-10-BUNDLE-BUDGET.json
```

It records:

```text
build output directory
JS raw total
JS gzip total
largest JS raw
largest JS gzip
CSS raw total
CSS gzip total
largest CSS raw
largest CSS gzip
JS asset count
CSS asset count
total asset count
```

Budget values are not eternal design truth. They are a current-main baseline with review headroom. Later budget changes must be explicit and tracked in the issue register.

## 5. Bundle hygiene policy

PFE-10 fixes these rules:

```text
package and lockfile changes are out of scope
route topology changes are out of scope
backend, migration, contract, and fixture changes are out of scope
CI workflow changes are out of scope
Product primitives must remain feature-agnostic
shared shell must not directly pull feature implementation weight
acceptance and audit scripts must not enter the web runtime bundle
docs and audit artifacts must not be imported by runtime code
build output must be measurable by the checker
```

## 6. Build-output policy

The checker reads `apps/web/dist` after `pnpm run build:web`. If the directory is missing, the checker fails with an explicit build-first message.

The checker writes a local review report to:

```text
docs/audit/PFE_10_BUNDLE_BUDGET_REPORT.md
```

This report is an artifact, not a source file requirement for this PR.

## 7. Non-goals

PFE-10 does not add routes, remove routes, add product capability, change backend behavior, change migrations, change contracts, change fixtures, change package files, add dependencies, change CI workflow, introduce Lighthouse score gates, introduce real-user monitoring, add service worker or offline mode, add server-side rendering, or redo PFE-3 through PFE-9.

## 8. Allowed files

```text
docs/frontend-productization/PFE-10-PERFORMANCE-BUDGET-BUNDLE-HYGIENE.md
docs/frontend-productization/PFE-10-BUNDLE-BUDGET.json
docs/frontend-productization/PFE-10-BUNDLE-MATRIX.md
docs/frontend-productization/PFE-10-BUNDLE-ISSUE-REGISTER.md
scripts/frontend_acceptance/ACCEPTANCE_PFE_10_PERFORMANCE_BUDGET_BUNDLE_HYGIENE.cjs
scripts/frontend_acceptance/CHECK_PFE_10_WEB_BUNDLE_BUDGET.cjs
```

Page, CSS, layout, and Vite files are allowed only after a concrete budget failure is measured and reviewed. PFE-10 v1 starts without runtime source changes.

## 9. Forbidden files

```text
apps/server/*
migrations/*
packages/contracts/*
fixtures/*
.github/*
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
apps/web/package.json
apps/web/src/app/routes/*
apps/web/dist/*
docs/audit/*.png
docs/audit/**/*.png
```

## 10. Budget checker policy

The checker must use only Node built-ins, read the budget JSON, recursively inspect `apps/web/dist`, calculate raw and gzip sizes, identify the largest JS and CSS assets, count JS/CSS/all assets, write a review report, and fail if a budget is exceeded.

## 11. Acceptance

Static acceptance:

```powershell
node scripts/frontend_acceptance/ACCEPTANCE_PFE_10_PERFORMANCE_BUDGET_BUNDLE_HYGIENE.cjs
```

Build-output budget check:

```powershell
pnpm run build:web
node scripts/frontend_acceptance/CHECK_PFE_10_WEB_BUNDLE_BUDGET.cjs
```

Standard project checks:

```powershell
pnpm run typecheck:web
git status --short
```

## 12. Completion boundary

PFE-10 can claim build-output budget and bundle hygiene baseline. It cannot claim Lighthouse certification, production performance monitoring, real-user performance collection, browser performance matrix, device performance matrix, server performance optimization, or pixel-level visual performance tuning.
