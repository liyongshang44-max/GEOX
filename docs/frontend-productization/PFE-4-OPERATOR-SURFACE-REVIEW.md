<!-- docs/frontend-productization/PFE-4-OPERATOR-SURFACE-REVIEW.md -->
# PFE-4 Operator Surface Review

## 0. Status

PFE-4 covers 13 Operator Runtime Console surfaces. Each surface is a read-only review surface. Later accessibility, responsive, screenshot, and visual-regression work remains in later PFE phases.

## 1. Surface matrix

| route | implementation file | Product primitives | boundary status | nonclaim status | state coverage |
|---|---|---|---|---|---|
| `/operator/twin` | `apps/web/src/features/operator/pages/OperatorTwinOverviewPage.tsx` | ProductPageShell; ProductPageHeader; ProductBoundaryBanner; ProductSectionCard; ProductMetricTile; ProductStatusBadge; ProductDataTable; ProductScopeBar; ProductLoadingState; ProductErrorState; ProductEmptyState | read-only review | not connected / not online / not started / disabled | loading / error / empty |
| `/operator/fields` | `apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx`; `apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx` | ProductPageShell; ProductPageHeader; ProductBoundaryBanner; ProductSectionCard; ProductMetricTile; ProductStatusBadge; ProductDataTable; ProductScopeBar; ProductEmptyState | field selector only | not field management | no-field / no-data |
| `/operator/fields/:fieldId` | `apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx`; `apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx` | ProductPageShell; ProductPageHeader; ProductBoundaryBanner; ProductSectionCard; ProductMetricTile; ProductStatusBadge; ProductScopeBar | field-scoped review | review only | adapter states |
| `/operator/fields/:fieldId/state` | `apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx`; `apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx` | ProductPageShell; ProductPageHeader; ProductBoundaryBanner; ProductSectionCard; ProductMetricTile; ProductStatusBadge; ProductScopeBar | state review | no online estimation claim | adapter states |
| `/operator/fields/:fieldId/evidence` | `apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx`; `apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx` | ProductPageShell; ProductPageHeader; ProductBoundaryBanner; ProductSectionCard; ProductMetricTile; ProductStatusBadge; ProductScopeBar | evidence review | review only | adapter states |
| `/operator/fields/:fieldId/forecast` | `apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx`; `apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx` | ProductPageShell; ProductPageHeader; ProductBoundaryBanner; ProductSectionCard; ProductMetricTile; ProductStatusBadge; ProductScopeBar | forecast review | not a recommendation | adapter states |
| `/operator/fields/:fieldId/scenario` | `apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx`; `apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx` | ProductPageShell; ProductPageHeader; ProductBoundaryBanner; ProductSectionCard; ProductMetricTile; ProductStatusBadge; ProductScopeBar | scenario review | review only | adapter states |
| `/operator/fields/:fieldId/residual` | `apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx`; `apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx` | ProductPageShell; ProductPageHeader; ProductBoundaryBanner; ProductSectionCard; ProductMetricTile; ProductStatusBadge; ProductScopeBar | residual review | not value proof / not causal proof | adapter states |
| `/operator/fields/:fieldId/calibration` | `apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx`; `apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx` | ProductPageShell; ProductPageHeader; ProductBoundaryBanner; ProductSectionCard; ProductMetricTile; ProductStatusBadge; ProductScopeBar | calibration review | not model update | adapter states |
| `/operator/fields/:fieldId/health` | `apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx`; `apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx` | ProductPageShell; ProductPageHeader; ProductBoundaryBanner; ProductSectionCard; ProductMetricTile; ProductStatusBadge; ProductScopeBar | health review | not live monitoring | local states |
| `/operator/fields/:fieldId/audit` | `apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx`; `apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx` | ProductPageShell; ProductPageHeader; ProductBoundaryBanner; ProductSectionCard; ProductMetricTile; ProductStatusBadge; ProductScopeBar | audit readback | not a business conclusion | trace-missing state |
| `/operator/twin/gateway-demo` | `apps/web/src/features/operator/pages/OperatorGatewayDemoViewerPage.tsx`; `apps/web/src/features/operator/replayDemo/ReplayDemoPage.tsx` | ProductPageShell; ProductPageHeader; ProductBoundaryBanner; ProductSectionCard; ProductMetricTile; ProductStatusBadge; ProductScopeBar; ProductLoadingState; ProductErrorState | replay demo readback | checked-in snapshot / not online | loading / error |
| `/operator/pilot` | `apps/web/src/layouts/OperatorLayout.tsx`; `apps/web/src/features/operator/pilotReadiness/OperatorPilotPage.tsx` | ProductPageShell; ProductPageHeader; ProductBoundaryBanner; ProductSectionCard; ProductMetricTile; ProductStatusBadge; ProductDataTable; ProductScopeBar | readiness review | not started / disabled | local rows |

## 2. Route ownership decision

PFE-4 keeps route topology unchanged.

```json
{
  "operator_pilot_cleanup": "deferred"
}
```

`/operator/pilot` remains rendered through the current layout-level path handling. PFE-4 productizes the surface without changing the URL or route table.

## 3. Remaining gaps

PFE-4 does not claim live runtime, live device connectivity, production gateway connectivity, field pilot execution, accessibility certification, responsive certification, screenshot baseline, or visual regression baseline.
