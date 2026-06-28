# docs/tasks/TK9-Source-Index-Compatibility-and-Decision-Stage-Hotfix-v1.md

## Purpose

TK9 fixes two issues exposed by the local persisted Twin Kernel API readback smoke test.

First, the local source-index tables are not fully aligned with the current Twin Kernel route assumptions. `field_index_v1` may carry only `tenant_id` and `field_id`, while the Twin Kernel snapshot route joins by `tenant_id`, `project_id`, `group_id`, and `field_id`. `water_state_estimate_index_v1` may carry `updated_at`, `created_at`, and `root_zone_soil_moisture_percent`, while the current snapshot route/builder expects `computed_at` and `soil_moisture_percent` aliases.

Second, `decision_cycle_v1.current_stage` can currently persist `ROI_FORMALIZED` even when `external_refs_json.roi_entry_id` is null. That is misleading because ROI has not been formally written. The read model already exposes `missing_formalization`, but the persisted `current_stage` should also avoid claiming the incomplete stage.

## Boundary

TK9 is a hotfix, not a new Twin Kernel object.

It does not create recommendations, approvals, operation plans, AO-ACT tasks, receipts, acceptance records, ROI entries, Field Memory entries, or model updates.

It only adds source-index compatibility columns/backfills and a `decision_cycle_v1` trigger that normalizes `current_stage` at insert/update time.

## Source-index compatibility

The migration adds and backfills:

- `field_index_v1.project_id`
- `field_index_v1.group_id`
- `water_state_estimate_index_v1.computed_at`
- `water_state_estimate_index_v1.soil_moisture_percent`

The backfill preserves existing entered/collected source-index data. It does not fabricate agronomic readings. It maps already existing source fields into compatibility aliases:

- `field_index_v1.project_id/group_id` comes from water, sensing, or weather source-index rows for the same `tenant_id/field_id`.
- `computed_at` comes from `updated_at` or `created_at`.
- `soil_moisture_percent` comes from `root_zone_soil_moisture_percent`.

## Decision-stage semantics

The migration installs `tk9_normalize_decision_cycle_current_stage_v1()` and trigger `tk9_decision_cycle_current_stage_normalize_v1`.

The normalized rule is:

> `current_stage` equals the last contiguous completed stage, not the first incomplete stage.

Therefore, if a decision cycle has:

- `ACCEPTED.complete = true`
- `ROI_FORMALIZED.complete = false`
- `MEMORY_CANDIDATE_CREATED.complete = true`
- `CALIBRATED.complete = true`

then the persisted `current_stage` becomes `ACCEPTED`, not `ROI_FORMALIZED`.

The state machine still preserves the complete/incomplete facts, so the read model can continue surfacing:

- `ROI_FORMALIZATION_MISSING`
- `FORMAL_FIELD_MEMORY_MISSING`
- `H58_FORMAL_WRITE_NOT_CREATED_BY_TWIN_KERNEL`

## Acceptance expectation

`TK9_SOURCE_INDEX_AND_DECISION_STAGE_HOTFIX_V1` passes if:

- the migration exists;
- compatibility columns are declared;
- source-index backfill uses existing rows and existing timestamps/readings;
- the decision-stage trigger is declared;
- `current_stage` is normalized to the last contiguous completed stage;
- the migration does not create downstream business objects.

## Next local smoke expectation

After applying TK9 migration and rebuilding server if needed, a new persisted TK1→TK6 chain should satisfy:

```text
field_state_snapshot_v1.status = SNAPSHOT_READY
water_state_estimate_index_v1.available = true
decision_cycle_v1.current_stage != ROI_FORMALIZED when roi_entry_id is null
GET /api/v1/twin-kernel/traces/:decision_cycle_id returns ok=true
missing_formalization still includes ROI/Formal Field Memory gaps
```
