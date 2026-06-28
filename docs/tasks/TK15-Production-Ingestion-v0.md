# docs/tasks/TK15-Production-Ingestion-v0.md

## Purpose

TK15 adds the first production-shaped ingestion contract for Twin Kernel v1.

It accepts production source references and maps them into a traceable `decision_cycle_v1` pointer chain.

TK15 is not production UX, not agronomic judgment, and not autonomous execution.

## Scope

TK15 adds:

```text
production_ingestion_event_v0
POST /api/v1/twin-kernel/production-ingestion/source-refs
scripts/governance_acceptance/TK15_PRODUCTION_INGESTION_V0.cjs
```

## Source contract

The ingestion route accepts a production-shaped source ref envelope:

```json
{
  "field_learning_candidate_id": "flc_...",
  "source_system": "production_adapter_name",
  "source_event_id": "external_event_id",
  "occurred_at": "2026-06-28T02:00:00.000Z",
  "ingested_by": "operator_or_adapter_id",
  "ingested_at": "2026-06-28T02:01:00.000Z",
  "source_refs": {
    "recommendation_ref_id": "external_rec_ref",
    "approval_ref_id": "external_approval_ref",
    "operation_plan_ref_id": "external_plan_ref",
    "task_ref_id": "external_task_ref",
    "receipt_ref_id": "external_receipt_ref",
    "observation_ref_id": "external_observation_ref",
    "acceptance_ref_id": "external_acceptance_ref",
    "verification_ref_id": "external_verification_ref"
  }
}
```

## Mapping

The route maps production refs into `decision_cycle_v1.external_refs_json`:

```text
recommendation_ref_id       -> recommendation_id
approval_ref_id             -> approval_id
operation_plan_ref_id       -> operation_plan_id
task_ref_id                 -> act_task_id
receipt_ref_id              -> receipt_id
observation_ref_id          -> as_executed_id
acceptance_ref_id           -> acceptance_id
verification_ref_id         -> post_irrigation_verification_id
```

The route stores the raw source refs and the mapped external refs in `production_ingestion_event_v0`.

## Boundary

TK15 does not create:

```text
recommendation objects
approval objects
operation plan objects
AO-ACT task objects
receipt objects
acceptance objects
ROI entries
Field Memory entries
operator reviews
model updates
```

The mapped IDs are pointer refs only.

The route returns:

```text
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

## Route

```text
POST /api/v1/twin-kernel/production-ingestion/source-refs
```

Required fields:

```text
field_learning_candidate_id
source_system
ingested_by
ingested_at
source_refs
```

Optional fields:

```text
source_event_id
occurred_at
```

If `source_event_id` is omitted, the route derives a deterministic source event id from the source system, field learning candidate, source refs, and ingestion time.

## Acceptance command

```powershell
node scripts/governance_acceptance/TK15_PRODUCTION_INGESTION_V0.cjs
```

Runtime preconditions:

1. API server is running.
2. TK1 through TK15 migrations are applied.
3. The persisted TK10 field learning candidate exists.
4. Existing `field_learning_candidate_id = flc_c23a3ace34c48ce59c205110` is available.

## Acceptance expectation

The acceptance must verify:

```text
production_ingestion_event_v0 is written
source refs are mapped into decision_cycle_v1.external_refs_json
trace readback displays the mapped source refs as pointer_refs
trace current_stage remains a human-gated decision-cycle stage
ROI_FORMALIZATION_MISSING remains visible
FORMAL_FIELD_MEMORY_MISSING remains visible
model_updated = false
automatic_recommendation_created = false
automatic_approval_created = false
automatic_task_created = false
automatic_receipt_created = false
automatic_acceptance_created = false
automatic_roi_created = false
automatic_field_memory_created = false
```

## Non-goals

```text
No production UX.
No agronomic judgment.
No automatic recommendation.
No automatic approval.
No automatic dispatch.
No automatic receipt creation.
No automatic acceptance creation.
No production ROI calculation.
No production Field Memory policy.
No model update.
```
