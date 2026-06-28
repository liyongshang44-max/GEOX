# docs/tasks/TWIN-KERNEL-NEXT-TASK-LINE.md

## Stage

```text
Twin Kernel v1 Completion / Operator Workflow & Productionization Prep
```

## Baseline

PR #2113 `TK13 formalization layer` is closed and merged into `main`.

```text
merge_commit_sha: 15ae86f21cd0fb7f337895db8ca26bf9a5cca743
```

This document freezes the next task line after TK13. It is the repository baseline for the next GEOX / Twin Kernel implementation phase.

## Completed

```text
formal object skeleton
provenance contract
system-derived object chain
persisted runtime chain
trace read model
read-only trace page
source schema compatibility
decision_stage semantic correction
formal ROI v0
formal Field Memory v0
explicit formalization routes
ROI / Field Memory trace pointer refs
formalization boundary verification
execution-to-learning trace closure v0
```

## Not completed

```text
production ingestion
real operator workflow
production UX
multi-scope regression
production ROI computation
production Field Memory policy
operator-side formalization UX
acceptance script idempotency
execution-to-learning business closure
multi-field / multi-season / multi-crop validation
```

## Phase constraint

The next phase must not expand the Twin Kernel core ontology unless a later task explicitly changes this document.

The kernel chain is considered established at the trace and explicit formalization layer. The next work must turn that chain into repeatable, operable, and production-preparable workflow.

## Execution order

```text
TK13.1  Task Line Freeze & Acceptance Idempotency
TK14    Operator Workflow v0
TK15    Production Ingestion v0
TK16    Multi-scope Regression Harness
TK17    Production UX v0
TK18    Execution-to-Learning Business Closure v0
```

## TK13.1 — Task Line Freeze & Acceptance Idempotency

### Goal

Freeze the post-TK13 task line and make TK13 acceptance repeatable.

### Required changes

```text
docs/tasks/TWIN-KERNEL-NEXT-TASK-LINE.md
docs/tasks/TK13-Formalization-Layer-v0.md
scripts/governance_acceptance/TK13_FORMALIZATION_LAYER_V0.cjs
```

### Acceptance

```powershell
node scripts/governance_acceptance/TK13_FORMALIZATION_LAYER_V0.cjs
node scripts/governance_acceptance/TK13_FORMALIZATION_LAYER_V0.cjs
```

Both consecutive runs must return `ok: true`.

The second run must not fail because a previous TK13 acceptance run already advanced a deterministic `decision_cycle_id` to `CALIBRATED`.

### Boundary

```text
Do not add business capability.
Do not change Twin Kernel semantics.
Do not change UI.
Only freeze the task line and make the acceptance fixture repeatable.
```

## TK14 — Operator Workflow v0

### Goal

Turn explicit formalization routes into a minimal real operator workflow while preserving human explicit input.

### Objects

```text
operator_session_v0
operator_decision_review_v0
operator_formalization_action_v0
```

### Interfaces

```text
GET current decision cycles that need formalization
POST operator review
POST explicit ROI formalization through an operator action
POST explicit Field Memory formalization through an operator action
```

### Acceptance

```text
Trace readback exposes missing formalization.
Operator explicitly reviews the decision cycle.
Operator explicitly formalizes ROI.
Operator explicitly formalizes Field Memory.
Trace advances from ACCEPTED to CALIBRATED.
All boundary_flags remain false for automatic writes and model updates.
```

### Boundary

```text
No automatic recommendation.
No automatic approval.
No automatic task creation.
No automatic Field Memory creation.
No automatic model update.
```

## TK15 — Production Ingestion v0

### Goal

Connect the smoke / acceptance chain to production-shaped ingestion input rather than only hand-built objects.

### Required changes

```text
docs/tasks/TK15-Production-Ingestion-v0.md
apps/server/src/routes/v1/production_ingestion.ts or existing Monitor / facts pipeline integration
scripts/governance_acceptance/TK15_PRODUCTION_INGESTION_V0.cjs
```

### Acceptance

```text
A production-shaped observation / receipt / verification ref input is accepted.
The system generates a traceable object chain.
Trace readback displays the source refs.
No automatic business decision is produced.
```

### Boundary

```text
Ingestion contract only.
No production UX.
No automatic agronomic judgment.
No automatic execution.
```

## TK16 — Multi-scope Regression Harness

### Goal

Extend regression from one default scope into multiple project / group / field / season / crop scopes.

### Fixture requirements

```text
At least 3 project/group/field scopes.
At least 2 seasons.
At least 2 crops.
```

### Acceptance

```text
Pointer refs do not cross fields.
Decision cycles do not cross seasons.
Field Memory records do not cross crops.
Determinism hash remains stable for each fixture.
```

### Boundary

```text
No performance optimization.
No large-scale import.
Only scope isolation and regression.
```

## TK17 — Production UX v0

### Goal

Move the trace experience from engineering readback toward operator usability without weakening read-only trace boundaries.

### Required constraints

```text
Trace page remains read-only.
Operator workflow page is separate.
Explicit formalization action is not triggered from the trace read-only page.
No automatic recommendation, execution, priority, or risk scoring appears in UI.
```

## TK18 — Execution-to-Learning Business Closure v0

### Goal

Make the execution-to-learning business loop valid, not only trace-visible.

### Business chain

```text
receipt
verification
acceptance
field_learning_candidate
explicit field_memory formalization
```

### Acceptance

```text
A real receipt ref exists.
A verification ref exists.
An acceptance ref exists.
A learning candidate exists.
Field Memory is explicitly formalized.
trace current_stage = CALIBRATED
model_updated = false
automatic_field_memory_created = false
```

### Boundary

```text
Field Memory may be formalized.
The model must not auto-update.
A learning candidate must not automatically become a production policy.
```
