# docs/tasks/TK4-Calibration-Replay-and-Forecast-Error-v1.md

# TK4 — Calibration Replay and Forecast Error v1

TK4 introduces two formal Twin Kernel objects:

- `calibration_replay_v1`
- `forecast_error_v1`

This task converts a persisted `scenario_set_v1` plus observed verification evidence into deterministic replay and forecast-error records. It does not update a model, write Field Memory, write ROI, create a learning candidate, create a decision cycle, request approval, or create an execution task.

## Position in the original Twin Kernel line

Original task line:

```text
TK0 → TK1 → TK2 → TK3 → TK4 → TK5 → TK6
```

Current position:

```text
TK0 ✅ Twin Kernel Preflight
TK1 ✅ field_state_snapshot_v1
TK2 ✅ forecast_run_v1
TK3 ✅ scenario_set_v1
TK4 ⬅️ calibration_replay_v1 + forecast_error_v1
TK5 未开始：field_learning_candidate_v1 → formal Field Memory
TK6 未开始：decision_cycle_v1 / human-in-the-loop loop
```

## Input boundary

TK4 may read only formal Twin Kernel objects from the prior stages:

- `scenario_set_v1`
- `forecast_run_v1`

TK4 may also accept observed verification values or external evidence references in the request payload. TK4 must not read raw telemetry directly.

## Output objects

`calibration_replay_v1` records the replay context and the predicted-versus-observed comparison.

`forecast_error_v1` records the specific error result derived from the replay.

Minimum `calibration_replay_v1` fields:

- `calibration_replay_id`
- `forecast_run_id`
- `scenario_set_id`
- `tenant_id`
- `project_id`
- `group_id`
- `field_id`
- `as_of_ts`
- `selected_option_id`
- `status`
- `input_refs_json`
- `predicted_json`
- `observed_json`
- `error_summary_json`
- `reason_candidates_json`
- `evidence_refs_json`
- `blocking_reasons_json`
- `determinism_hash`
- `created_at`

Minimum `forecast_error_v1` fields:

- `forecast_error_id`
- `calibration_replay_id`
- `forecast_run_id`
- `scenario_set_id`
- `tenant_id`
- `project_id`
- `group_id`
- `field_id`
- `as_of_ts`
- `error_metric`
- `error_value`
- `error_direction`
- `predicted_json`
- `observed_json`
- `evidence_refs_json`
- `blocking_reasons_json`
- `determinism_hash`
- `created_at`

## TK4 scope

TK4 calculates error evidence. It does not act on that error.

The first version supports water-state response error only:

- predicted water response
- observed water response
- absolute error
- direction
- reason candidates

## Hard boundaries

TK4 must not:

- write `field_learning_candidate_v1`
- write Field Memory records
- write ROI records
- write `decision_cycle_v1`
- create recommendations
- create approvals
- create operation plans
- create AO-ACT tasks
- create `/api/v1/actions/*` tasks
- create execution receipts
- mutate `forecast_run_v1`
- mutate `scenario_set_v1`

## Acceptance

Run:

```powershell
node scripts/governance_acceptance/TK4_CALIBRATION_REPLAY_AND_FORECAST_ERROR_V1_ACCEPTANCE.cjs
```

Expected result:

```text
ok = true
acceptance = TK4_CALIBRATION_REPLAY_AND_FORECAST_ERROR_V1_ACCEPTANCE
calibration_replay_v1_present = true
forecast_error_v1_present = true
field_learning_candidate_v1_missing = true
decision_cycle_v1_missing = true
no_forbidden_writes = true
```

## Done

TK4 is done when the repository has schema migrations, deterministic builders, registered routes, and acceptance proving that replay and error records exist without creating learning candidates, Field Memory, ROI, decision cycles, approvals, or execution tasks.
