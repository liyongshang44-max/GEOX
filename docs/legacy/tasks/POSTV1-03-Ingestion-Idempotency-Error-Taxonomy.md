# docs/tasks/POSTV1-03-Ingestion-Idempotency-Error-Taxonomy.md

## Purpose

POSTV1-03 hardens production ingestion repeatability and diagnosis inside P1 Production Hardening.

This task converts the existing TK15 production ingestion route from a happy-path source-ref writer into a safer production interface.

## Phase

```text
Post-Twin-Kernel-v1 Productionization
P1 Production Hardening
```

## Repository second audit result

Before implementation, repository facts were:

```text
POSTV1-01 Production Hardening Baseline is complete.
POSTV1-02 Strong Multi-Scope Fixture Pack is complete.
POSTV1-03 has no merged PR.
production_ingestion_event_v0 already exists.
POST /api/v1/twin-kernel/production-ingestion/source-refs already exists.
The route already maps production_source_refs_v0 into decision_cycle_v1.
```

The audit also found these hardening gaps:

```text
Duplicate source_system + source_event_id had no explicit duplicate response semantics.
Conflicting duplicate source events could reuse the same production_ingestion_event_id.
Errors were string-only and lacked a structured error envelope.
source_refs accepted malformed non-object input by collapsing it to an empty object.
```

## Scope

POSTV1-03 changes:

```text
apps/server/src/routes/v1/twin_kernel_production_ingestion.ts
docs/tasks/POSTV1-03-Ingestion-Idempotency-Error-Taxonomy.md
scripts/governance_acceptance/POSTV1_03_INGESTION_IDEMPOTENCY_ERROR_TAXONOMY.cjs
```

## Runtime behavior

The production ingestion route now exposes explicit idempotency behavior:

```text
first valid source_system + source_event_id write → normal write response
duplicate with same field_learning_candidate_id and same source_refs → stable idempotent replay
duplicate with same source_system + source_event_id but conflicting candidate or source_refs → 409 SOURCE_EVENT_ID_CONFLICT
```

The stable duplicate response returns:

```text
idempotent_replay = true
duplicate_source_event = true
stable_duplicate_response = true
write_ready = false
```

A normal first write returns:

```text
idempotent_replay = false
duplicate_source_event = false
stable_duplicate_response = false
write_ready = true
```

## Error taxonomy

The route now returns a structured error envelope while preserving the existing `error` string field.

```json
{
  "ok": false,
  "object_type": "production_ingestion_event_v0",
  "error": "ERROR_CODE",
  "error_code": "ERROR_CODE",
  "structured_error": {
    "code": "ERROR_CODE",
    "status": 400,
    "category": "production_ingestion",
    "details": {}
  }
}
```

POSTV1-03 covers these errors:

```text
FIELD_LEARNING_CANDIDATE_ID_REQUIRED
SOURCE_SYSTEM_REQUIRED
INGESTED_BY_REQUIRED
INGESTED_AT_REQUIRED
INVALID_INGESTED_AT
INVALID_OCCURRED_AT
MALFORMED_SOURCE_REFS
FIELD_LEARNING_CANDIDATE_NOT_FOUND
SOURCE_EVENT_ID_CONFLICT
```

The route can also emit internal integrity errors if previously linked dependent rows are missing:

```text
FORECAST_ERROR_NOT_FOUND
CALIBRATION_REPLAY_NOT_FOUND
SCENARIO_SET_NOT_FOUND
FORECAST_RUN_NOT_FOUND
DUPLICATE_DECISION_CYCLE_NOT_FOUND
```

## source_refs boundary

`source_refs`, `sourceRefs`, `production_source_refs`, and `productionSourceRefs` must be either absent or a plain object.

Nested object or array values are rejected as malformed source refs.

This keeps production source references pointer-like and prevents adapter payloads from smuggling business documents into the Twin Kernel ingestion route.

## Boundary

```text
No new production adapter.
No migration.
No UI.
No new domain object.
No automatic business decision.
No recommendation creation.
No approval creation.
No AO-ACT task creation.
No receipt creation.
No acceptance creation.
No ROI formalization.
No Field Memory formalization.
No model update.
No change to operator formalization semantics.
```

## Acceptance command

```powershell
node scripts/governance_acceptance/POSTV1_03_INGESTION_IDEMPOTENCY_ERROR_TAXONOMY.cjs
```

Required runtime:

```text
API server running on TWIN_KERNEL_BASE_URL or http://127.0.0.1:3001
A persisted field_learning_candidate_v1 fixture, defaulting to TK15's candidate id.
```

## Expected result

```text
ok = true
acceptance = POSTV1_03_INGESTION_IDEMPOTENCY_ERROR_TAXONOMY
idempotent_duplicate_verified = true
conflict_duplicate_rejected = true
structured_error_count >= 8
next_step = POSTV1-04_ROUTE_NEGATIVE_RUNTIME_MATRIX
```

## Remaining P1 tasks after POSTV1-03

```text
POSTV1-04 Route Negative Runtime Matrix
POSTV1-05 DB Index / Query Cost Audit
POSTV1-06 Docker Startup / Migration Runner Baseline
```
