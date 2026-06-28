# docs/tasks/TK17-Production-UX-v0.md

## Purpose

TK17 adds the first production UX shell for the completed Twin Kernel v1 operator workflow.

It exposes a browser page that lets an operator explicitly run the production ingestion and formalization workflow that was already proven by TK15, TK14, TK13, and TK16.

TK17 is not a new Twin Kernel semantic task.

## Scope

TK17 adds:

```text
apps/web/src/api/twinKernelProductionWorkflow.ts
apps/web/src/features/operator/pages/OperatorProductionWorkflowPage.tsx
scripts/frontend_acceptance/TK17_PRODUCTION_UX_V0.cjs
docs/tasks/TK17-Production-UX-v0.md
```

TK17 updates:

```text
apps/web/src/app/App.tsx
apps/web/src/layouts/OperatorLayout.tsx
```

## Route

```text
/operator/twin/production-workflow
```

The route is registered inside the existing operator shell.

The existing read-only trace route remains:

```text
/operator/twin/traces/:decisionCycleId
```

## UX chain

The page exposes explicit operator buttons for:

```text
POST /api/v1/twin-kernel/production-ingestion/source-refs
GET  /api/v1/twin-kernel/operator-workflow/decision-cycles
POST /api/v1/twin-kernel/operator-workflow/sessions
POST /api/v1/twin-kernel/operator-workflow/reviews
POST /api/v1/twin-kernel/operator-workflow/formalization-actions/roi
POST /api/v1/twin-kernel/operator-workflow/formalization-actions/field-memory
GET  /api/v1/twin-kernel/traces/:decision_cycle_id
```

Every write is operator-triggered.

The page does not auto-run the workflow.

## Boundary

TK17 does not add or change backend routes.

TK17 does not add migrations.

TK17 does not add domain objects.

TK17 does not change `decision_cycle_v1` semantics.

TK17 does not change the trace read model.

TK17 does not create:

```text
recommendation objects
approval objects
operation plan objects
AO-ACT tasks
receipts
acceptance records
production ROI calculations
production Field Memory policy
model updates
```

The page can call existing explicit formalization endpoints only after the operator opens a session and writes a review.

## Acceptance command

```powershell
node scripts/frontend_acceptance/TK17_PRODUCTION_UX_V0.cjs
```

## Acceptance expectation

The acceptance verifies:

```text
production workflow page exists
production workflow API client exists
operator route is registered
operator navigation contains the production workflow entry
trace readback page remains read-only
no AO-ACT endpoint is referenced
no dispatch endpoint is referenced
no approval creation endpoint is referenced
no receipt creation endpoint is referenced
no acceptance creation endpoint is referenced
no model update endpoint is referenced
```

## Non-goals

```text
No production ROI computation.
No production Field Memory policy.
No automatic operator workflow execution.
No automatic dispatch.
No automatic task creation.
No backend semantic change.
```
