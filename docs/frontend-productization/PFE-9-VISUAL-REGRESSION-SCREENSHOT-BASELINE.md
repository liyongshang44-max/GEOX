<!-- docs/frontend-productization/PFE-9-VISUAL-REGRESSION-SCREENSHOT-BASELINE.md -->
# PFE-9 Visual Regression & Screenshot Baseline

## 0. Phase

PFE-9 Visual Regression & Screenshot Baseline.

PFE-9 establishes a review-safe screenshot manifest and visual review baseline for Formal Product Frontend v1. It is not a page redesign, pixel certification, browser matrix, device matrix, production monitor, or mobile app visual QA phase.

## 1. Completion statement

Formal Customer, Operator, and Admin product surfaces have a documented screenshot manifest, viewport-based visual review matrix, capture script, visual issue register, and static acceptance gate. CI runtime audit remains green, and visual baseline artifacts can be reviewed without route, backend, package, or capability changes.

Chinese completion statement:

```text
Customer、Operator、Admin 正式产品面已经建立截图 manifest、按视口组织的视觉审查矩阵、截图捕获脚本、视觉问题登记表和静态验收门禁；CI runtime audit 保持通过，并且不改 route、backend、package 或产品能力。
```

## 2. Source baseline

PFE-9 follows the completed PFE-6, PFE-7, and PFE-8 baselines:

```text
PFE-6 Accessibility & Keyboard Compliance
PFE-7 Responsive / Viewport Completion
PFE-8 Empty / Loading / Error State Completion
```

The repository already has a Playwright-based runtime page audit that starts the web frontend, visits routes, captures screenshots, and writes a runtime audit report. PFE-9 does not replace that audit. It defines a stable product screenshot manifest and an explicit visual review policy around it.

## 3. Covered surfaces

Customer Portal:

```text
/customer/dashboard
/customer/fields
/customer/fields/:fieldId
/customer/fields/:fieldId/export
/customer/operations
/customer/operations/:operationId
/customer/operations/:operationId/export
/customer/reports
/customer/export
```

Operator Runtime Console:

```text
/operator/twin
/operator/fields
/operator/fields/:fieldId
/operator/fields/:fieldId/state
/operator/fields/:fieldId/evidence
/operator/fields/:fieldId/forecast
/operator/fields/:fieldId/scenario
/operator/fields/:fieldId/residual
/operator/fields/:fieldId/calibration
/operator/fields/:fieldId/health
/operator/fields/:fieldId/audit
/operator/twin/gateway-demo
/operator/pilot
```

Admin Console:

```text
/admin/dashboard
/admin/fields
/admin/operations
/admin/devices
/admin/evidence
/admin/skills
/admin/healthz
```

Supporting:

```text
/login
Product primitives
export / print surfaces
focus-visible sample
responsive narrow viewport sample
```

## 4. Viewport policy

PFE-9 reuses the PFE-7 viewport classes:

```text
desktop-wide:      1440px
desktop-standard:  1280px
laptop:            1024px
tablet:             768px
mobile-narrow:      390px
```

Full manifest coverage records all five viewport classes. The checked baseline subset uses:

```text
desktopWide: 1440px
tablet: 768px
mobileNarrow: 390px
```

## 5. Manifest policy

The manifest is the source of truth for visual capture:

```text
docs/frontend-productization/PFE-9-SCREENSHOT-MANIFEST.json
```

It records route, concrete capture path, surface, baseline subset flag, viewport set, and review assertions. It must include Customer 9, Operator 13, Admin 7, and `/login`.

## 6. Baseline subset policy

PFE-9 v1 does not commit all route/viewport PNG files. It defines:

```text
Level 1: full route screenshot manifest
Level 2: checked baseline subset
```

The checked subset covers role shells, report/list/detail/export surfaces, field runtime, gateway demo, pilot readiness, admin governance, healthz, and login.

## 7. Artifact policy

Capture output is artifact-first:

```text
docs/audit/pfe-9-screenshots/**/*.png
docs/audit/PFE_9_VISUAL_REVIEW_REPORT.md
```

PFE-9 v1 does not commit full PNG baselines. The capture script may write local artifacts for manual review or CI artifact collection.

## 8. Non-goals

PFE-9 does not change route topology, add routes, remove routes, add product capability, change backend behavior, change migrations, change contracts, change fixtures, change package files, add dependencies, introduce a new visual-regression service, perform full pixel-perfect certification, perform full browser-matrix QA, perform full device-matrix QA, perform native mobile visual QA, or redo PFE-6 / PFE-7 / PFE-8.

## 9. Allowed files

```text
docs/frontend-productization/PFE-9-VISUAL-REGRESSION-SCREENSHOT-BASELINE.md
docs/frontend-productization/PFE-9-SCREENSHOT-MANIFEST.json
docs/frontend-productization/PFE-9-VISUAL-REVIEW-MATRIX.md
docs/frontend-productization/PFE-9-VISUAL-ISSUE-REGISTER.md
scripts/frontend_acceptance/ACCEPTANCE_PFE_9_VISUAL_REGRESSION_SCREENSHOT_BASELINE.cjs
scripts/frontend_acceptance/CAPTURE_PFE_9_SCREENSHOTS.cjs
```

Style and page files are allowed only if screenshot review exposes a clear layout, clipping, state, or print problem. PFE-9 v1 starts without page or CSS edits.

## 10. Forbidden files

```text
apps/server/*
migrations/*
packages/contracts/*
fixtures/*
.github/*
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
apps/web/src/app/routes/*
apps/web/src/app/App.tsx
apps/web/src/app/AppShell.tsx
```

## 11. Capture policy

The capture script must read the screenshot manifest, use existing Playwright runtime capability, apply the same local browser session context convention as the runtime audit, capture route + viewport screenshots, and write a visual review report. It must not write facts, change backend state, add dependencies, or require a database for the static acceptance gate.

## 12. Review policy

PFE-9 blocks blank screenshots, visible route runtime failures, persistent loading, page-level horizontal overflow, missing primary shell navigation, clipped main content, missing page heading, unsafe role copy, missing export/print safe content, and hidden focus indicators in samples.

Non-blocking items include minor spacing polish, small wrapping differences, font anti-aliasing differences, browser print dialog behavior, full screen-reader matrix, full mobile-navigation redesign, and pixel tuning.

## 13. Acceptance

Static acceptance:

```powershell
node scripts/frontend_acceptance/ACCEPTANCE_PFE_9_VISUAL_REGRESSION_SCREENSHOT_BASELINE.cjs
```

Manual or CI artifact capture when runtime is available:

```powershell
node scripts/frontend_acceptance/CAPTURE_PFE_9_SCREENSHOTS.cjs
```

Standard project checks:

```powershell
pnpm run typecheck:web
pnpm run build:web
git status --short
```
