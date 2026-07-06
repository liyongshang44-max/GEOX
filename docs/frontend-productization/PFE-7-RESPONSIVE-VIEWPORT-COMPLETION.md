<!-- docs/frontend-productization/PFE-7-RESPONSIVE-VIEWPORT-COMPLETION.md -->
# PFE-7 Responsive / Viewport Completion

## 0. Phase

PFE-7 establishes the responsive viewport baseline for formal Product Frontend v1 surfaces.

This phase is viewport completion for the formal web frontend. It is not visual regression, pixel certification, native mobile app work, or full browser/device matrix completion.

## 1. Goal

Formal Product Frontend v1 surfaces are usable across defined desktop, laptop, tablet, and mobile-narrow viewport classes without horizontal page overflow, inaccessible navigation, unreadable tables, clipped controls, or broken export/print layout.

Chinese completion statement:

```text
Customer、Operator、Admin 正式产品面已经完成桌面宽屏、标准桌面、笔记本、平板、窄屏移动视口基线。
```

## 2. Source baseline

```text
PFE-3 Customer Portal Productization
PFE-4 Operator Runtime Console Productization
PFE-5 Admin Console Productization
PFE-6 Accessibility & Keyboard Compliance
```

PFE-7 preserves PFE-3/PFE-4/PFE-5 product semantics and PFE-6 accessibility/keyboard semantics.

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

Supporting surfaces and components:

```text
/login
Customer shell navigation
Operator shell navigation
Admin shell navigation
Breadcrumbs
LocaleToggle
ProductPageShell
ProductDataTable
ProductMetricTile
ProductSectionCard
ProductBoundaryBanner
ProductStateBlock
Export / print report surfaces
```

## 4. Viewport classes

```text
desktop-wide:      1440px
desktop-standard:  1280px
laptop:            1024px
tablet:             768px
mobile-narrow:      390px
```

Optional lowest check:

```text
mobile-min:         360px
```

## 5. Non-goals

PFE-7 does not change route topology, add routes, delete routes, add product capability, change backend, change migrations, change contracts, change fixtures, change package files, introduce UI libraries, add test dependencies, complete visual regression, complete a browser/device matrix, build a native mobile app, or redo PFE-3/PFE-4/PFE-5 productization.

## 6. Allowed files

```text
apps/web/src/styles/productDesignSystem.css
apps/web/src/styles/accessibility.css
apps/web/src/styles/customerShell.css
apps/web/src/styles/customerDashboard.css
apps/web/src/styles/customerReport.css
apps/web/src/styles/operatorShell.css
apps/web/src/styles/operatorTwin.css
apps/web/src/styles/operatorFieldRuntime.css
apps/web/src/styles/operatorReplayDemo.css
apps/web/src/styles/operatorPilotReadiness.css
apps/web/src/styles/adminShell.css
apps/web/src/styles/adminControlPlane.css
apps/web/src/styles/reportPrint.css
apps/web/src/styles/responsive.css
apps/web/src/styles.css
docs/frontend-productization/PFE-7-RESPONSIVE-VIEWPORT-COMPLETION.md
docs/frontend-productization/PFE-7-VIEWPORT-MATRIX.md
docs/frontend-productization/PFE-7-ROUTE-VIEWPORT-WALKTHROUGH.md
docs/frontend-productization/PFE-7-RESPONSIVE-ISSUE-REGISTER.md
scripts/frontend_acceptance/ACCEPTANCE_PFE_7_RESPONSIVE_VIEWPORT_COMPLETION.cjs
```

## 7. Forbidden files

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
```

`apps/web/src/app/App.tsx` is not changed in PFE-7.

## 8. Responsive policy

PFE-7 uses responsive stacking, wrapping, local table scroll regions, long-token wrapping, and export/print preservation. It does not hide critical governance information to fit narrow screens.

Forbidden responsive shortcuts:

```text
body overflow-x hidden as a fake fix
app shell overflow-x hidden as a fake fix
ProductPageShell overflow-x hidden as a fake fix
display none on product-critical boundary/status/skip/table classes
```

## 9. Shell policy

Customer, Operator, and Admin shell navigation must remain reachable at 1440, 1280, 1024, 768, and 390 viewport classes. Shell navigation may stack, wrap, or use reachable local scroll patterns, but it must not change route inventory or promote future routes.

Admin route decisions from PFE-5 remain unchanged: URL-only compatibility routes are not promoted, and `/admin/config` plus `/admin/health` remain deferred route naming debt.

## 10. Table policy

ProductDataTable keeps PFE-6 caption, header, region, and keyboard focus semantics. PFE-7 adds/keeps local horizontal scroll with `overflow-x: auto`, touch scrolling, mobile notes, and long-cell wrapping.

## 11. Export / print policy

Export and print routes keep screen responsive behavior and preserve `reportPrint.css` print media. Print controls and return links remain keyboard reachable on screen. PFE-7 does not add debug controls to export routes.

## 12. Completion statement

PFE-7 is complete when formal Customer, Operator, and Admin product surfaces have a responsive viewport baseline across desktop-wide, desktop-standard, laptop, tablet, and mobile-narrow classes. Shells, navigation, grids, tables, side rails, export/print surfaces, and accessibility focus behavior must remain usable without route or capability changes.
