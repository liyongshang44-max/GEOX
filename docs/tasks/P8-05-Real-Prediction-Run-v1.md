# docs/tasks/P8-05-Real-Prediction-Run-v1.md

## Purpose

P8-05 implements a deterministic real-evidence prediction run for the P8 closed-loop replay.

The runtime reads the P8-04 real state estimate and the P8-02 history evidence window, then emits a read-only `real_soil_moisture_prediction_run_v1` object for the frozen prediction window. It does not read the actual observation window.

## Gate

```text
P8_05_REAL_PREDICTION_RUN_V1
```

## Entry conditions

```text
previous_gate = P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1
previous_doc = docs/tasks/P8-04-Real-State-Estimate-Runtime-v1.md
previous_acceptance = scripts/governance_acceptance/P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs
previous_next_step = P8_05_REAL_PREDICTION_RUN_V1
input_state_estimate_kind = real_soil_moisture_state_estimate_v1
input_evidence_window_kind = real_evidence_window_v0
```

## Runtime files created in P8-05

```text
scripts/twin_kernel/P8_05_REAL_PREDICTION_RUN_V1.cjs
scripts/governance_acceptance/P8_05_REAL_PREDICTION_RUN_V1.cjs
docs/tasks/P8-05-Real-Prediction-Run-v1.md
```

## Fixed replay scope

```text
project_id = P_DEFAULT
sensor_group_id = G_CAF
sensor_id = CAF009
metric_kind = soil_moisture
problem = soil_moisture_state_estimation
```

## Input contract

```text
input_state_estimate_kind = real_soil_moisture_state_estimate_v1
input_state_estimate_source = scripts/twin_kernel/P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs
input_evidence_window_kind = real_evidence_window_v0
input_evidence_window_source = scripts/twin_kernel/P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs
input_history_window_start_ts = 2009-06-09T00:00:00.000Z
input_history_window_end_ts = 2009-06-09T04:00:00.000Z
```

## Prediction window contract

```text
prediction_window_start_ts = 2009-06-09T05:00:00.000Z
prediction_window_end_ts = 2009-06-09T07:00:00.000Z
horizon_steps = 3
step_ms = 3600000
target_timestamp_count = 3
target_timestamps = 2009-06-09T05:00:00.000Z,2009-06-09T06:00:00.000Z,2009-06-09T07:00:00.000Z
```

## Output object kind

```text
real_soil_moisture_prediction_run_v1
```

## Required output fields

```text
prediction_run_id
output_kind
project_id
subject_ref
sensor_ref
sensor_group_ref
metric_kind
unit
prediction_method
generated_for_as_of_ts
prediction_window_start_ts
prediction_window_end_ts
horizon_steps
step_ms
input_state_estimate_ref
input_evidence_window_ref
starting_estimate_value
prediction_points
uncertainty_model
evidence_refs
source_query_ref
trace_refs
read_only
determinism_hash
```

## Prediction method

```text
method_name = linear_recent_window_trend_v1
method_reads_history_window_only = true
method_reads_state_estimate = true
method_uses_recent_metric_slope = true
method_outputs_metric_level_predictions = true
method_outputs_aggregate_predictions = true
method_outputs_uncertainty = true
method_does_not_update_model = true
```

## No-lookahead runtime rules

```text
prediction_runtime_must_read_history_window_only
prediction_runtime_must_read_state_estimate_only
prediction_runtime_must_not_read_actual_observation_window
prediction_runtime_must_not_read_backtest_report
prediction_runtime_must_not_read_calibration_report
prediction_runtime_must_not_write_model_state
prediction_runtime_must_not_authorize_action
```

## Runtime strict prohibitions

```text
no_actual_window_query
no_backtest_query
no_calibration_query
no_fixture_fallback
no_database_mutation
no_schema_change
no_seed_change
no_fact_write
no_field_memory_write
no_model_write
no_execution_object
no_recommendation
no_irrigation_advice
no_action_authorization
no_frontend_change
no_server_route
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P8_05_REAL_PREDICTION_RUN_V1.cjs
```

## Expected result

```text
ok = true
acceptance = P8_05_REAL_PREDICTION_RUN_V1
p8_04_verified = true
reads_real_state_estimate_output = true
prediction_window_verified = true
does_not_query_actual_window = true
prediction_points_count = 3
prediction_values_numeric = true
uncertainty_present = true
evidence_refs_preserved = true
source_query_ref_preserved = true
read_only = true
determinism_stable = true
changed_file_count = 3
next_step = P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0
```

## Next step

```text
P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0
```
