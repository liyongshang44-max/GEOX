<!-- docs/frontend-productization/PFE-8-EMPTY-LOADING-ERROR-STATE-COMPLETION.md -->
# PFE-8 Empty / Loading / Error State Completion

## 0. Phase

PFE-8 Empty / Loading / Error State Completion.

PFE-8 completes explicit state expression for Formal Product Frontend v1. It is not responsive work, visual regression, screenshot baseline, backend error classification, monitoring, or recovery workflow implementation.

## 1. Completion statement

Formal Customer, Operator, and Admin product surfaces have explicit empty, loading, unavailable, permission-limited, degraded, blocked, future/url-only/do-not-build, and safe error states.

Chinese completion statement:

```text
Customer、Operator、Admin 正式产品面已经完成空态、加载态、不可用态、权限受限态、降级态和安全错误态基线。
```

## 2. Source baseline

```text
PFE-2 Product Design System primitives
PFE-6 Accessibility & Keyboard Compliance
PFE-7 Responsive / Viewport Completion
```

PFE-8 builds on existing ProductEmptyState, ProductLoadingState, ProductErrorState, ProductStateBlock, and ProductDataTable behavior.

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

Supporting surfaces:

```text
/login
CustomerLayout
OperatorLayout
AdminLayout
Product primitives
route fallback
runtime text guard
export / print surfaces
```

## 4. State taxonomy

PFE-8 fixes this taxonomy:

```text
loading
empty
unavailable
permissionLimited
degraded
error
blocked
future
urlOnly
doNotBuild
replayBacked
notConnected
notOnline
disabled
```

## 5. Non-goals

PFE-8 does not change route topology, add routes, remove routes, add product capability, change backend behavior, change migrations, change contracts, change fixtures, change package files, introduce dependencies, create visual regression, create screenshot baselines, redo responsive work, rewrite global error boundaries, or change Customer / Operator / Admin product boundaries.

## 6. Allowed files

```text
apps/web/src/design-system/product/ProductEmptyState.tsx
apps/web/src/design-system/product/ProductLoadingState.tsx
apps/web/src/design-system/product/ProductErrorState.tsx
apps/web/src/design-system/product/ProductStateBlock.tsx
apps/web/src/design-system/product/ProductDataTable.tsx
apps/web/src/design-system/product/index.ts
apps/web/src/styles/productDesignSystem.css
apps/web/src/styles/responsive.css
apps/web/src/styles/accessibility.css
apps/web/src/styles/customerReport.css
apps/web/src/styles/customerDashboard.css
apps/web/src/styles/operatorFieldRuntime.css
apps/web/src/styles/operatorReplayDemo.css
apps/web/src/styles/operatorPilotReadiness.css
apps/web/src/styles/adminControlPlane.css
apps/web/src/views/LoginPage.tsx
apps/web/src/features/customer/pages/*
apps/web/src/features/fields/pages/FieldReportPage.tsx
apps/web/src/features/fields/pages/FieldReportExportPage.tsx
apps/web/src/features/operations/pages/OperationReportPage.tsx
apps/web/src/features/operator/pages/*
apps/web/src/features/operator/fieldRuntime/*
apps/web/src/features/operator/replayDemo/*
apps/web/src/features/operator/pilotReadiness/*
apps/web/src/features/admin/pages/*
docs/frontend-productization/PFE-8-EMPTY-LOADING-ERROR-STATE-COMPLETION.md
docs/frontend-productization/PFE-8-STATE-MATRIX.md
docs/frontend-productization/PFE-8-STATE-COPY-GUIDE.md
docs/frontend-productization/PFE-8-STATE-ISSUE-REGISTER.md
scripts/frontend_acceptance/ACCEPTANCE_PFE_8_EMPTY_LOADING_ERROR_STATE_COMPLETION.cjs
```

Cautiously allowed only for safe visible fallback, without route topology changes:

```text
apps/web/src/app/App.tsx
apps/web/src/app/AppShell.tsx
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

## 8. Product primitive policy

ProductEmptyState must expose status semantics, polite live announcement, state kind metadata, and optional surface metadata. Its nextSafeAction slot is not a default mutation action.

ProductLoadingState must expose visible loading copy, polite live announcement, and busy semantics. It must not render an unreadable spinner-only state or fake progress guarantee.

ProductErrorState must expose alert semantics and safe message copy. It must not render raw diagnostic details, private payload details, credentials, implementation stack text, or internal debug strings.

ProductStateBlock must keep status semantics for normal states and alert semantics for error / blocked.

ProductDataTable must render a semantic empty state when rows are absent.

## 9. Surface state policy

Customer state copy must use customer-safe report language. It may mention authorized scope, report unavailable, report entries absent, export unavailable, and temporary unavailability. It must not expose internal governance vocabulary or implementation details.

Operator state copy must use runtime review and readback language. It may mention source unavailable, replay-backed source, adapter degraded, forecast evidence missing, calibration residuals absent, and gateway snapshot unavailable. It must not offer dispatch, automatic approval, field pilot start, device control, or production-online claims.

Admin state copy must use internal governance and readback language. It may mention governance rows absent, readback unavailable, source degraded, route naming debt deferred, and service action disabled. It must not become an operations console.

## 10. Completion definition

PFE-8 is complete when formal product routes and supporting states use explicit state primitives or documented equivalent state blocks; state copy is role-safe; safe error text does not leak internals; empty and unavailable are distinguished; loading states are readable; and the PFE-8 static gate plus existing CI runtime audit pass.
