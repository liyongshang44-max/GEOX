# docs/tasks/TK14-Operator-Workflow-v0.md

## Purpose

TK14 adds the first minimal operator workflow for Twin Kernel v1.

It turns TK13 explicit formalization routes into an operator-facing backend workflow while preserving the human-in-the-loop boundary.

TK14 is not a production UX task. It is a backend workflow and runtime acceptance task.

## Scope

TK14 adds:

```text
operator_session_v0
operator_decision_review_v0
operator_formalization_action_v0
GET  /api/v1/twin-kernel/operator-workflow/decision-cycles
POST /api/v1/twin-kernel/operator-workflow/sessions
POST /api/v1/twin-kernel/operator-workflow/reviews
POST /api/v1/twin-kernel/operator-workflow/formalization-actions/roi
POST /api/v1/twin-kernel/operator-workflow/formalization-actions/field-memory
scripts/governance_acceptance/TK14_OPERATOR_WORKFLOW_V0.cjs
```

## Boundary

TK14 does not modify the read-only Twin Trace page.

TK14 does not create recommendations, approvals, operation plans, AO-ACT tasks, receipts, acceptance records, production ROI policy, production Field Memory policy, or model updates.

TK14 does not make Twin Kernel autonomous.

All formalization remains explicit and operator-originated.

## Operator decision queue

```text
GET /api/v1/twin-kernel/operator-workflow/decision-cycles
```

The queue returns persisted `decision_cycle_v1` rows that are ready for operator formalization.

A decision cycle is eligible when:

```text
cycle_status = DECISION_CYCLE_READY
external_refs_json.acceptance_id exists
roi_entry_id is missing OR field_memory_id is missing
```

The queue is read-only.

## Operator session

```text
POST /api/v1/twin-kernel/operator-workflow/sessions
```

Required fields:

```text
decision_cycle_id
operator_id
```

Optional fields:

```text
opened_at
```

The route writes `operator_session_v0`.

It does not formalize ROI or Field Memory.

## Operator review

```text
POST /api/v1/twin-kernel/operator-workflow/reviews
```

Required fields:

```text
operator_session_id
reviewed_by
reviewed_at
```

Optional fields:

```text
review_status
review_notes
```

Allowed `review_status` values:

```text
REVIEWED
NEEDS_FORMALIZATION
NO_ACTION
```

The route writes `operator_decision_review_v0`.

It captures a point-in-time decision snapshot and missing formalization state.

It does not formalize ROI or Field Memory.

## Operator formalization action: ROI

```text
POST /api/v1/twin-kernel/operator-workflow/formalization-actions/roi
```

Required fields:

```text
operator_session_id
operator_review_id
formalized_by
formalized_at
```

Optional fields:

```text
roi_summary
evidence_refs
```

The route writes:

```text
roi_entry_v1
operator_formalization_action_v0
```

The route updates only `decision_cycle_v1.external_refs_json.roi_entry_id` and the formalization state-machine stage.

## Operator formalization action: Field Memory

```text
POST /api/v1/twin-kernel/operator-workflow/formalization-actions/field-memory
```

Required fields:

```text
operator_session_id
operator_review_id
formalized_by
formalized_at
```

Optional fields:

```text
memory_statement
evidence_refs
```

The route writes:

```text
field_memory_v1
operator_formalization_action_v0
```

The route updates only `decision_cycle_v1.external_refs_json.field_memory_id` and the formalization state-machine stages.

`field_memory_v1.model_update_created` remains `false`.

## Acceptance command

```powershell
node scripts/governance_acceptance/TK14_OPERATOR_WORKFLOW_V0.cjs
```

Runtime preconditions:

1. API server is running.
2. TK1 through TK14 migrations are applied.
3. The persisted TK10 field learning candidate exists.
4. Existing `field_learning_candidate_id = flc_c23a3ace34c48ce59c205110` is available.

## Acceptance expectation

The acceptance must verify:

```text
operator decision queue sees a decision cycle requiring formalization
operator opens a session
operator writes a review
operator explicitly formalizes ROI
operator explicitly formalizes Field Memory
trace current_stage = CALIBRATED
ROI_FORMALIZATION_MISSING is cleared
FORMAL_FIELD_MEMORY_MISSING is cleared
model_updated = false
automatic_roi_created = false
automatic_field_memory_created = false
automatic_task_created = false
```

## Non-goals

```text
No UI.
No production ingestion.
No production ROI calculation.
No production Field Memory policy.
No automatic approval.
No automatic dispatch.
No automatic model update.
```
