# docs/tasks/P8-03-Holdout-Window-Split-Contract.md

## Purpose

P8-03 freezes the holdout window split used by P8 real-evidence closed-loop replay.

This task does not implement a predictor, estimator, backtest, calibration, API, frontend, model update, Field Memory write, or execution object. It only defines which window may be read at each runtime phase and enforces the no-lookahead boundary.

## Gate

```text
P8_03_HOLDOUT_WINDOW_SPLIT_CONTRACT
```

## Entry conditions

```text
previous_gate = P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0
previous_doc = docs/tasks/P8-02-Real-Evidence-Window-Builder-v0.md
previous_acceptance = scripts/governance_acceptance/P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs
previous_next_step = P8_03_HOLDOUT_WINDOW_SPLIT_CONTRACT
real_evidence_window_output_kind = real_evidence_window_v0
real_evidence_window_source = raw_samples
```

## Fixed replay scope

```text
project_id = P_DEFAULT
sensor_group_id = G_CAF
sensor_id = CAF009
metric_kind = soil_moisture
problem = soil_moisture_state_estimation
```

## History window

```text
window_name = history_window
window_role = state_estimate_input_evidence
window_start_ts = 2009-06-09T00:00:00.000Z
window_end_ts = 2009-06-09T04:00:00.000Z
window_source = real_evidence_window_v0
readable_by_state_estimate_runtime = true
readable_by_prediction_runtime = true
readable_by_backtest_runtime = true
```

## Prediction window

```text
window_name = prediction_window
window_role = prediction_targets
window_start_ts = 2009-06-09T05:00:00.000Z
window_end_ts = 2009-06-09T07:00:00.000Z
horizon_steps = 3
step_ms = 3600000
readable_by_state_estimate_runtime = false
readable_by_prediction_runtime = true
readable_by_backtest_runtime = true
```

## Actual observation window

```text
window_name = actual_observation_window
window_role = holdout_actuals_for_backtest_only
window_start_ts = 2009-06-09T05:00:00.000Z
window_end_ts = 2009-06-09T07:00:00.000Z
window_source = raw_samples
readable_by_state_estimate_runtime = false
readable_by_prediction_runtime = false
readable_by_backtest_runtime = true
readable_by_calibration_runtime = true
readable_by_replay_demo_runtime = true
```

## No-lookahead rules

```text
state_estimate_runtime_must_not_read_actual_window
prediction_runtime_must_not_read_actual_window
backtest_runtime_may_read_actual_window
calibration_runtime_may_read_backtest_report
replay_demo_may_read_all_outputs
actual_window_access_allowed_only_after_prediction
prediction_target_timestamps_must_be_inside_prediction_window
actual_target_timestamps_must_overlap_prediction_target_timestamps
```

## Runtime phase access matrix

```text
state_estimate_runtime = history_window_only
prediction_runtime = history_window_and_prediction_window_only
actual_observation_runtime = actual_observation_window_only_after_prediction_contract
backtest_runtime = prediction_run_and_actual_observation_window
calibration_runtime = backtest_error_report_only
replay_demo_runtime = all_read_only_artifacts
```

## Strict prohibitions

```text
no_actual_window_read_during_state_estimate
no_actual_window_read_during_prediction
no_prediction_authorizes_action
no_recommendation
no_irrigation_advice
no_risk_level
no_severity
no_priority
no_field_memory_write
no_model_write
no_fact_write
no_execution_object
no_frontend_change
no_server_route
no_seed_change
no_db_schema_change
```

## Changed files allowed in P8-03

```text
docs/tasks/P8-03-Holdout-Window-Split-Contract.md
scripts/governance_acceptance/P8_03_HOLDOUT_WINDOW_SPLIT_CONTRACT.cjs
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P8_03_HOLDOUT_WINDOW_SPLIT_CONTRACT.cjs
```

## Expected result

```text
ok = true
acceptance = P8_03_HOLDOUT_WINDOW_SPLIT_CONTRACT
p8_02_verified = true
history_window_defined = true
prediction_window_defined = true
actual_observation_window_defined = true
no_lookahead_rule_count = 8
actual_window_access_allowed_only_after_prediction = true
changed_file_count = 2
next_step = P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1
```

## Next step

```text
P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1
```
