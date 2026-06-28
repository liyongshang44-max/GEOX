# docs/tasks/TK1-Field-State-Snapshot-v1.md

# TK1 — Field State Snapshot v1

TK1 introduces the first formal Twin Kernel output object: `field_state_snapshot_v1`.

This task converts scoped Operator Twin source-index evidence into a persistent, deterministic field-state snapshot. It does not create forecasts, scenarios, recommendations, approvals, action tasks, ROI entries, Field Memory entries, calibration records, or learning candidates.

## Position in the Twin Kernel line

TK0 proved the repository baseline and confirmed that no formal Twin Kernel objects existed.

TK1 is the first kernel object. It answers only:

- what state this field is estimated to be in at `as_of_ts`
- which source indexes contributed to that estimate
- what evidence references support it
- what confidence and blocking reasons apply
- whether the same inputs reproduce the same deterministic hash

TK1 does not answer what will happen over seven days. That belongs to `forecast_run_v1` in TK2.

## Input boundary

TK1 may read only scoped source indexes:

- `field_index_v1`
- `water_state_estimate_index_v1`
- `soil_moisture_sensing_window_index_v1`
- `weather_forecast_index_v1`

Every read must be constrained by:

- `tenant_id`
- `project_id`
- `group_id`
- `field_id`

## Output object

`field_state_snapshot_v1` is a persisted kernel snapshot table.

Minimum required fields:

- `snapshot_id`
- `tenant_id`
- `project_id`
- `group_id`
- `field_id`
- `season_id`
- `as_of_ts`
- `status`
- `state_vector_json`
- `confidence_json`
- `evidence_refs_json`
- `source_indexes_json`
- `blocking_reasons_json`
- `determinism_hash`
- `created_at`

## Snapshot state vector v1

The first state vector is intentionally narrow. It only covers field identity, water state, sensing coverage, and weather forecast version.

It must not include yield estimates, nitrogen status, disease risk, profit, prescription, task, dispatch, or recommendation semantics.

## Hard boundaries

TK1 must not:

- insert into `decision_recommendation_index_v1`
- create recommendation facts
- create approval records
- create operation plans
- create AO-ACT tasks
- create `/api/v1/actions/*` tasks
- create execution receipts
- write ROI records
- write Field Memory records
- write forecast runs
- write scenario sets
- write calibration or learning records

## Acceptance

Run:

```powershell
node scripts/governance_acceptance/TK1_FIELD_STATE_SNAPSHOT_V1_ACCEPTANCE.cjs
```

Expected result:

```text
ok = true
acceptance = TK1_FIELD_STATE_SNAPSHOT_V1_ACCEPTANCE
field_state_snapshot_v1_present = true
forecast_run_v1_missing = true
scenario_set_v1_missing = true
no_forbidden_writes = true
```

## Done

TK1 is done when the repository has a typed builder, a registered write route, a schema migration, and a governance acceptance script proving that `field_state_snapshot_v1` exists without creating downstream decision, execution, ROI, Field Memory, forecast, scenario, calibration, or learning objects.
