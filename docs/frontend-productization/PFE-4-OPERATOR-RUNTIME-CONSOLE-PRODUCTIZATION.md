<!-- docs/frontend-productization/PFE-4-OPERATOR-RUNTIME-CONSOLE-PRODUCTIZATION.md -->
# PFE-4 Operator Runtime Console Productization

## 0. Phase

PFE-4 productizes the Operator Runtime Console as a read-only runtime review surface.

It follows the PFE-1 page contracts and reuses PFE-2 Product Design System v1 primitives. It does not make GEOX a live runtime system.

## 1. Goal

Operator Runtime Console is productized as a read-only runtime review surface using PFE-2 Product Design System primitives and PFE-1 page contracts.

Chinese completion statement:

```text
Operator Runtime Console 已按 PFE-1 页面契约和 PFE-2 产品设计系统，产品化为只读运行审查控制台。
```

## 2. Source baseline

```text
docs/frontend-productization/PFE-0-PRODUCT-FRONTEND-DEFINITION.md
docs/frontend-productization/PFE-0-PAGE-AUDIT-MATRIX.md
docs/frontend-productization/PFE-1-PAGE-CONTRACT-REGISTER.md
docs/frontend-productization/PFE-2-DESIGN-SYSTEM-V1-COMPLETION.md
```

## 3. Covered routes

PFE-4 covers only the Operator Runtime Console surfaces below:

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

## 4. Non-goals

PFE-4 does not implement live runtime, live device connectivity, production gateway connectivity, field pilot execution, controlled execution, dispatch, approval mutation, facts writing, recommendation creation, ROI writing, Field Memory writing, model update, or backend changes.

PFE-4 does not modify Customer Portal, Admin Console, backend, migrations, packages/contracts, fixtures, package files, or CI workflow files.

PFE-4 does not add `/operator/evidence`, `/operator/health`, or `/operator/settings`.

## 5. Allowed files

```text
apps/web/src/features/operator/pages/OperatorTwinOverviewPage.tsx
apps/web/src/features/operator/pages/OperatorGatewayDemoViewerPage.tsx
apps/web/src/features/operator/replayDemo/ReplayDemoPage.tsx
apps/web/src/features/operator/fieldRuntime/*
apps/web/src/features/operator/pilotReadiness/*
docs/frontend-productization/PFE-4-OPERATOR-RUNTIME-CONSOLE-PRODUCTIZATION.md
docs/frontend-productization/PFE-4-OPERATOR-SURFACE-REVIEW.md
scripts/frontend_acceptance/ACCEPTANCE_PFE_4_OPERATOR_RUNTIME_CONSOLE_PRODUCTIZATION.cjs
```

The actual repository uses `FieldRuntimeRoutePage` and `FieldRuntimeLayout` for the canonical `/operator/fields/*` route family. PFE-4 productizes that existing route family instead of inventing new route ownership.

## 6. Forbidden files

```text
apps/web/src/features/customer/*
apps/web/src/features/admin/*
apps/web/src/layouts/CustomerLayout.tsx
apps/web/src/layouts/AdminLayout.tsx
apps/server/*
migrations/*
packages/contracts/*
fixtures/*
.github/*
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
apps/web/src/app/App.tsx
apps/web/src/app/routes/*
```

## 7. Operator vocabulary

Allowed visible Operator vocabulary:

```text
Operator Runtime Console
Read-only runtime review
Replay-backed
Checked-in snapshot
Review only
Source identity
Trace readback
Not connected
Not online
Not started
Disabled
Unavailable
No data
Requires review
```

Forbidden positive claims:

```text
Live runtime is online
Production gateway is online
Live device is connected
Field pilot has started
Operator can dispatch
Operator can create AO-ACT
Operator can approve recommendations
Operator can write facts
Operator can write ROI
Operator can write Field Memory
Model learning is active
Autonomous operation is available
```

The negative/nonclaim forms are allowed and required.

## 8. Design system usage

PFE-4 uses PFE-2 primitives across the Operator Runtime Console implementation:

```text
ProductPageShell
ProductPageHeader
ProductBoundaryBanner
ProductSectionCard
ProductMetricTile
ProductStatusBadge
ProductDataTable
ProductEmptyState
ProductLoadingState
ProductErrorState
ProductScopeBar
```

## 9. Field Runtime tab requirements

Each field runtime tab remains route-scoped and read-only.

```text
Overview: field identity, overview cards, source metadata, read-only boundary.
State: state review, confidence/use eligibility, evidence summary, no online estimation claim.
Evidence: source identities, timestamps, coverage gaps, no evidence writer.
Forecast: horizon, assumptions, uncertainty, forecast-not-recommendation boundary.
Scenario: scenario comparison, assumptions, scenario-not-dispatch boundary.
Residual: verification review, error bands, verification-not-ROI and not-causal-proof boundary.
Calibration: calibration review, replay context, review-not-model-update boundary.
Health: health review, freshness, not-live-monitoring boundary.
Audit: audit readback, route identity, trace references, no business conclusion.
```

## 10. Gateway Demo requirements

`/operator/twin/gateway-demo` is a demo-ready technical readback surface. It must repeatedly show:

```text
Replay-backed
Checked-in snapshot
Not live gateway
Production Gateway: Not online
Live Device: Not connected
Traceability readback
```

It must not show gateway controls, device controls, task controls, or production gateway online claims.

## 11. Pilot Readiness requirements

`/operator/pilot` is readiness review only. It must show:

```text
Readiness criteria
Blocked states
Field Pilot: Not started
Controlled Execution: Disabled
AO-ACT: Disabled
Review packet / planning status
```

It must not show pilot start controls, task creation controls, authorization mutation, or field pilot execution claims.

## 12. Route ownership decision

PFE-4 chooses Option A:

```json
{
  "operator_pilot_cleanup": "deferred"
}
```

Reason: the current repository renders `/operator/pilot` through `OperatorLayout` pathname handling. PFE-4 productizes the page while preserving route topology. Route ownership cleanup can be handled later as PFE-4-B.

## 13. Acceptance

```powershell
node scripts/frontend_acceptance/ACCEPTANCE_PFE_4_OPERATOR_RUNTIME_CONSOLE_PRODUCTIZATION.cjs
pnpm run typecheck:web
pnpm run build:web
git status --short
```

GitHub CI must also pass if runtime page audit remains enabled.

## 14. Completion statement

PFE-4 is complete when the 13 Operator Runtime Console surfaces are productized as read-only, replay-backed/runtime-review pages, use PFE-2 Product Design System primitives, preserve PFE-1 page contracts, and pass local plus GitHub acceptance.
