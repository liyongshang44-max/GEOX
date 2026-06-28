# docs/tasks/TK2-Forecast-Run-v1.md

# TK2 — Forecast Run v1

TK2 introduces the second formal Twin Kernel output object: `forecast_run_v1`.

This task converts a persisted `field_state_snapshot_v1` into a deterministic seven-day water-state forecast run. It does not create scenarios, recommendations, approvals, action tasks, ROI entries, Field Memory entries, calibration records, forecast-error records, learning candidates, or decision cycles.

## Position in the Twin Kernel line

TK0 proved the repository baseline.

TK1 added `field_state_snapshot_v1`, the first formal state snapshot object.

TK2 adds `forecast_run_v1`, the first formal forecast object.

TK2 answers only:

- which snapshot was forecasted
- what model version was used
- what seven-day water-state risk timeline was produced
- what uncertainty applies
- what assumptions were used
- whether the same input produces the same deterministic hash

TK2 does not answer which action option should be selected. That belongs to `scenario_set_v1` in TK3.

## Input boundary

TK2 may read only:

- `field_state_snapshot_v1`

TK2 must not read raw telemetry directly. It must use the snapshot produced by TK1 as the state boundary.

## Output object

`forecast_run_v1` is a persisted Twin Kernel forecast table.

Minimum required fields:

- `forecast_run_id`
- `snapshot_id`
- `tenant_id`
- `project_id`
- `group_id`
- `field_id`
- `as_of_ts`
- `horizon_days`
- `model_version`
- `status`
- `input_refs_json`
- `forecast_points_json`
- `risk_timeline_json`
- `uncertainty_json`
- `assumptions_json`
- `blocking_reasons_json`
- `determinism_hash`
- `created_at`

## Forecast v1 scope

The first forecast is intentionally narrow:

- horizon: 7 days
- domain: water-state risk only
- input: one `field_state_snapshot_v1`
- output: deterministic risk timeline

It must not include yield forecasts, nitrogen forecasts, disease forecasts, price forecasts, profit forecasts, prescriptions, task payloads, dispatch records, approval records, or recommendation semantics.

## Hard boundaries

TK2 must not:

- insert into `scenario_set_v1`
- insert into `decision_recommendation_index_v1`
- create recommendation facts
- create approval records
- create operation plans
- create AO-ACT tasks
- create `/api/v1/actions/*` tasks
- create execution receipts
- write ROI records
- write Field Memory records
- write calibration records
- write forecast-error records
- write learning candidates
- write decision cycles

## Acceptance

Run:

```powershell
node scripts/governance_acceptance/TK2_FORECAST_RUN_V1_ACCEPTANCE.cjs
```

Expected result:

```text
ok = true
acceptance = TK2_FORECAST_RUN_V1_ACCEPTANCE
forecast_run_v1_present = true
field_state_snapshot_v1_present = true
scenario_set_v1_missing = true
no_forbidden_writes = true
```

## Done

TK2 is done when the repository has a forecast schema migration, a deterministic forecast builder, registered forecast-run routes, and a governance acceptance script proving that `forecast_run_v1` exists without creating scenario, recommendation, execution, ROI, Field Memory, calibration, forecast-error, learning, or decision-cycle objects.
