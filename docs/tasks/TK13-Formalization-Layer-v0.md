# docs/tasks/TK13-Formalization-Layer-v0.md

## Purpose

TK13 adds the first explicit formalization layer for the Twin Kernel chain.

It addresses the formal gaps exposed by trace readback:

```text
ROI_FORMALIZATION_MISSING
FORMAL_FIELD_MEMORY_MISSING
```

This is not an autonomous execution step. It is an explicit formal write surface called by a human or external formalization workflow.

## Scope

TK13 adds:

1. `roi_entry_v1` table.
2. `field_memory_v1` table.
3. `POST /api/v1/twin-kernel/formalizations/roi`.
4. `POST /api/v1/twin-kernel/formalizations/field-memory`.
5. Runtime acceptance for explicit formalization against an existing persisted decision cycle.

## Boundary

TK13 does not create recommendations, approvals, operation plans, AO-ACT tasks, receipts, or acceptance records.

TK13 does not update model parameters.

The new routes update only formalization records and pointer refs on the selected `decision_cycle_v1`.

## ROI route

```text
POST /api/v1/twin-kernel/formalizations/roi
```

Required fields:

```text
decision_cycle_id
formalized_by
formalized_at
```

Optional fields:

```text
roi_summary
evidence_refs
```

The route writes an idempotent `roi_entry_v1` row and updates `decision_cycle_v1.external_refs_json.roi_entry_id`.

## Field Memory route

```text
POST /api/v1/twin-kernel/formalizations/field-memory
```

Required fields:

```text
decision_cycle_id
formalized_by
formalized_at
```

Optional fields:

```text
memory_statement
evidence_refs
```

The route writes an idempotent `field_memory_v1` row and updates `decision_cycle_v1.external_refs_json.field_memory_id`.

`field_memory_v1.model_update_created` remains `false`.

## Decision cycle update semantics

The formalization routes update pointer refs and state-machine completion only for:

```text
ROI_FORMALIZED
FORMAL_MEMORY_WRITTEN
```

They do not change forecast, scenario, calibration, or learning objects.

## TK13.1 freeze note

TK13 is closed after PR #2113 and is now treated as an established Twin Kernel formalization layer.

```text
merge_commit_sha: 15ae86f21cd0fb7f337895db8ca26bf9a5cca743
next_task_line: docs/tasks/TWIN-KERNEL-NEXT-TASK-LINE.md
stage: Twin Kernel v1 Completion / Operator Workflow & Productionization Prep
```

TK13.1 does not expand the Twin Kernel ontology and does not add business capability. It only freezes the next task line and makes the TK13 acceptance fixture repeatable.

## Acceptance command

```powershell
node scripts/governance_acceptance/TK13_FORMALIZATION_LAYER_V0.cjs
```

Runtime preconditions:

1. API server is running.
2. TK1 through TK13 migrations are applied.
3. The persisted TK10 chain exists.
4. Existing `field_learning_candidate_id = flc_c23a3ace34c48ce59c205110` is available.

The acceptance creates a separate TK13 decision cycle, formalizes ROI and Field Memory on that cycle, and verifies trace readback. It does not mutate the original TK10 decision cycle.

## TK13.1 acceptance idempotency

The TK13 acceptance must be safe to run repeatedly.

```powershell
node scripts/governance_acceptance/TK13_FORMALIZATION_LAYER_V0.cjs
node scripts/governance_acceptance/TK13_FORMALIZATION_LAYER_V0.cjs
```

Both consecutive runs must return `ok: true`.

The acceptance fixture must generate run-scoped `external_refs` so each run creates a fresh deterministic `decision_cycle_id`. The second run must not fail because a previous run already advanced a deterministic decision cycle to `CALIBRATED`.

This idempotency rule is limited to the acceptance fixture. It does not change route semantics, formalization object semantics, or Twin Kernel state-machine semantics.
