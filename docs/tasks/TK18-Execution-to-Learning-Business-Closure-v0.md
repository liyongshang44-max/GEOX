# docs/tasks/TK18-Execution-to-Learning-Business-Closure-v0.md

## Purpose

TK18 adds a read-only business closure surface for the Twin Kernel v1 execution-to-learning chain.

It answers whether one `decision_cycle_v1` has a complete production-ingestion-to-formal-learning chain.

TK18 does not add new Twin Kernel semantics.

## Scope

TK18 adds:

```text
apps/server/src/routes/v1/twin_kernel_business_closure.ts
GET /api/v1/twin-kernel/business-closures/:decision_cycle_id
scripts/governance_acceptance/TK18_EXECUTION_TO_LEARNING_BUSINESS_CLOSURE_V0.cjs
docs/tasks/TK18-Execution-to-Learning-Business-Closure-v0.md
```

TK18 updates:

```text
apps/server/src/modules/twin_kernel/registerTwinKernelModule.ts
```

## Read model

The closure route reads existing objects:

```text
decision_cycle_v1
production_ingestion_event_v0
operator_session_v0
operator_decision_review_v0
operator_formalization_action_v0
roi_entry_v1
field_memory_v1
field_learning_candidate_v1
```

It returns one `execution_to_learning_business_closure_v0` object.

## Closure criteria

A business closure is complete when:

```text
production ingestion is present
execution pointer refs are present
operator session is present
operator review is present
ROI was formalized through operator action
Field Memory was written through operator action
trace stage reaches CALIBRATED
forbidden automatic writes remain absent
model_update_created remains false
```

## Boundary

TK18 is read-only.

TK18 does not add a migration.

TK18 does not create recommendations, approvals, operation plans, tasks, receipts, acceptance records, ROI entries, Field Memory entries, or model updates.

TK18 does not change the trace read model.

TK18 does not change `decision_cycle_v1` state-machine semantics.

## Route

```text
GET /api/v1/twin-kernel/business-closures/:decision_cycle_id
```

Response markers:

```text
object_type = execution_to_learning_business_closure_v0
read_only = true
write_ready = false
downstream_write_ready = false
automatic_business_decision_created = false
automatic_recommendation_created = false
automatic_approval_created = false
automatic_task_created = false
automatic_receipt_created = false
automatic_acceptance_created = false
automatic_roi_created = false
automatic_field_memory_created = false
model_update_created = false
```

## Acceptance command

```powershell
node scripts/governance_acceptance/TK18_EXECUTION_TO_LEARNING_BUSINESS_CLOSURE_V0.cjs
```

Runtime preconditions:

1. API server is running.
2. TK1 through TK15 migrations are applied.
3. TK13 through TK18 routes are registered.
4. Existing `field_learning_candidate_id = flc_c23a3ace34c48ce59c205110` is available.

## Acceptance expectation

The acceptance must verify:

```text
TK15 production ingestion writes source refs
TK14 operator workflow writes session and review
TK14 explicit ROI action writes ROI entry
TK14 explicit Field Memory action writes Field Memory
TK13 trace reaches CALIBRATED
TK18 closure route returns business_closure_complete = true
TK18 closure route is read-only
model_update_created = false
forbidden automatic writes remain absent
```

## Non-goals

```text
No production ROI computation.
No production Field Memory policy.
No automatic operator workflow execution.
No automatic dispatch.
No backend semantic change.
```
