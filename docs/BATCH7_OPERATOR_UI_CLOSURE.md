# GEOX Batch 7 Operator UI Closure

This branch is reserved for Batch 7 operator console queue semantics and status display closure.

## Scope

Target operator pages:

- `/operator/workbench`
- `/operator/approvals`
- `/operator/dispatch`
- `/operator/acceptance`
- `/operator/evidence`
- `/operator/devices-alerts`
- `/operator/roi-ledger`
- `/operator/field-memory`

## Goal

Convert the operator console from engineering/debug status panels into actionable operator queue workbench views.

Core requirements:

1. Unified operator-facing status labels; raw enum values must not appear in main views.
2. Unified device status/count scope across workbench and device/alert pages.
3. Operator pages should present queues, next actions, and blocking reasons before technical details.
4. Technical IDs, raw source names, manifests, checksums, and raw payloads must be default-collapsed.
5. Approvals, dispatch, acceptance, evidence, devices, ROI ledger, and field memory pages must expose next-step action guidance.

## Planned shared frontend layers

- `apps/web/src/lib/operatorStatusLabels.ts`
- `apps/web/src/lib/operatorSafeText.ts`
- `apps/web/src/lib/operatorQueueVm.ts`
- `apps/web/src/lib/operatorTechnicalDisclosure.ts`

## Out of scope

- Batch 6 customer page changes.
- Backend main-chain behavior changes unless a frontend contract bug blocks operator UI closure.
- Skill v2 or agronomy engine refactor.
