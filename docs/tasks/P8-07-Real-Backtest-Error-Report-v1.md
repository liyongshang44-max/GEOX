# docs/tasks/P8-07-Real-Backtest-Error-Report-v1.md

## Purpose

P8-07 implements the real backtest error report for the P8 closed-loop replay.

The runtime reads the P8-05 prediction run and the P8-06 actual observation window, compares predicted values against real holdout observations, and emits a deterministic read-only `real_backtest_error_report_v1` object.

This task does not update the prediction, state estimate, model, Field Memory, facts, execution objects, frontend, server routes, schema, or seed data.

## Gate

```text
P8_07_REAL_BACKTEST_ERROR_REPORT_V1
```

## Entry conditions

```text
previous_gate = P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0
previous_doc = docs/tasks/P8-06-Real-Actual-Observation-Window-v0.md
previous_acceptance = scripts/governance_acceptance/P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0.cjs
previous_next_step = P8_07_REAL_BACKTEST_ERROR_REPORT_V1
input_prediction_run_kind = real_soil_moisture_prediction_run_v1
input_actual_observation_window_kind = real_actual_observation_window_v0
```

## Runtime files created in P8-07

```text
scripts/twin_kernel/P8_07_REAL_BACKTEST_ERROR_REPORT_V1.cjs
scripts/governance_acceptance/P8_07_REAL_BACKTEST_ERROR_REPORT_V1.cjs
docs/tasks/P8-07-Real-Backtest-Error-Report-v1.md
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
input_prediction_run_kind = real_soil_moisture_prediction_run_v1
input_prediction_run_source = scripts/twin_kernel/P8_05_REAL_PREDICTION_RUN_V1.cjs
input_actual_observation_window_kind = real_actual_observation_window_v0
input_actual_observation_window_source = scripts/twin_kernel/P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0.cjs
compared_window_start_ts = 2009-06-09T05:00:00.000Z
compared_window_end_ts = 2009-06-09T07:00:00.000Z
```

## Output object kind

```text
real_backtest_error_report_v1
```

## Required output fields

```text
backtest_error_report_id
output_kind
project_id
subject_ref
sensor_ref
sensor_group_ref
metric_kind
unit
backtest_method
generated_for_as_of_ts
compared_window_start_ts
compared_window_end_ts
compared_horizon_steps
compared_point_count
compared_metric_count
input_prediction_run_ref
input_actual_observation_window_ref
input_state_estimate_ref
input_evidence_window_ref
error_summary
error_by_point
evidence_refs
actual_refs
source_query_refs
trace_refs
read_only
determinism_hash
```

## Error metrics

```text
point_mae
point_rmse
point_bias
point_max_absolute_error
metric_mae
metric_rmse
metric_bias
metric_max_absolute_error
coverage_compared_point_count
coverage_compared_metric_count
```

## Comparison rules

```text
compare_prediction_target_ts_to_actual_ts
compare_aggregate_predicted_value_to_aggregate_actual_value
compare_metric_predicted_value_to_metric_actual_value
require_all_prediction_targets_have_actual_points
require_all_prediction_metric_refs_have_actual_values
preserve_prediction_refs
preserve_actual_refs
preserve_source_query_refs
```

## Runtime strict prohibitions

```text
no_prediction_mutation
no_actual_window_mutation
no_state_estimate_mutation
no_calibration_write
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
no_frontend_change
no_server_route
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P8_07_REAL_BACKTEST_ERROR_REPORT_V1.cjs
```

## Expected result

```text
ok = true
acceptance = P8_07_REAL_BACKTEST_ERROR_REPORT_V1
p8_06_verified = true
prediction_vs_actual_verified = true
error_summary_present = true
error_by_point_count = 3
compared_metric_count_positive = true
evidence_refs_preserved = true
actual_refs_preserved = true
source_query_refs_preserved = true
read_only = true
determinism_stable = true
changed_file_count = 3
next_step = P8_08_REAL_CALIBRATION_REPORT_V1
```

## Next step

```text
P8_08_REAL_CALIBRATION_REPORT_V1
```
