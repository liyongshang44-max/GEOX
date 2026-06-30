# docs/tasks/P8-06-Real-Actual-Observation-Window-v0.md

## Purpose

P8-06 implements the holdout actual observation window for the P8 real-evidence closed-loop replay.

The runtime reads real `raw_samples` for the frozen actual observation window after the prediction run contract exists. It emits a deterministic read-only `real_actual_observation_window_v0` object that will be used by P8-07 backtest. It does not change the prediction, state estimate, model, Field Memory, facts, execution objects, frontend, server routes, schema, or seed data.

## Gate

```text
P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0
```

## Entry conditions

```text
previous_gate = P8_05_REAL_PREDICTION_RUN_V1
previous_doc = docs/tasks/P8-05-Real-Prediction-Run-v1.md
previous_acceptance = scripts/governance_acceptance/P8_05_REAL_PREDICTION_RUN_V1.cjs
previous_next_step = P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0
input_prediction_run_kind = real_soil_moisture_prediction_run_v1
actual_window_access_allowed_only_after_prediction = true
```

## Runtime files created in P8-06

```text
scripts/twin_kernel/P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0.cjs
scripts/governance_acceptance/P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0.cjs
docs/tasks/P8-06-Real-Actual-Observation-Window-v0.md
```

## Fixed replay scope

```text
project_id = P_DEFAULT
sensor_group_id = G_CAF
sensor_id = CAF009
metric_kind = soil_moisture
problem = soil_moisture_state_estimation
```

## Actual observation window contract

```text
actual_observation_window_start_ts = 2009-06-09T05:00:00.000Z
actual_observation_window_end_ts = 2009-06-09T07:00:00.000Z
expected_interval_ms = 3600000
expected_timestamp_count = 3
expected_target_timestamps = 2009-06-09T05:00:00.000Z,2009-06-09T06:00:00.000Z,2009-06-09T07:00:00.000Z
source_table = raw_samples
```

## Output object kind

```text
real_actual_observation_window_v0
```

## Required output fields

```text
actual_observation_window_id
output_kind
project_id
subject_ref
sensor_ref
sensor_group_ref
metric_kind
unit
actual_window_start_ts
actual_window_end_ts
expected_interval_ms
sample_count
metric_count
metric_refs
coverage_summary
actual_points
actual_refs
source_query_ref
trace_refs
input_prediction_run_ref
read_only
determinism_hash
```

## Source query requirements

```text
source_table = raw_samples
source_group_table = sensor_groups
source_membership_table = sensor_group_members
query_filters_project_id = true
query_filters_sensor_group_id = true
query_filters_sensor_id = true
query_filters_metric_kind = true
query_filters_actual_window_start_ts = true
query_filters_actual_window_end_ts = true
query_orders_by_ts_metric_sample_ref = true
query_uses_read_only_transaction = true
```

## Holdout rules

```text
actual_window_may_be_read_only_after_prediction_run
actual_window_must_not_change_prediction_run
actual_window_must_not_change_state_estimate
actual_window_must_not_write_backtest_report
actual_window_must_preserve_raw_sample_refs
actual_window_must_preserve_source_query_ref
```

## Runtime strict prohibitions

```text
no_prediction_mutation
no_state_estimate_mutation
no_backtest_write
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
node scripts/governance_acceptance/P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0.cjs
```

## Expected result

```text
ok = true
acceptance = P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0
p8_05_verified = true
actual_window_verified = true
actual_points_count = 3
does_not_mutate_prediction = true
source_query_ref_present = true
actual_refs_non_empty = true
read_only = true
determinism_stable = true
changed_file_count = 3
next_step = P8_07_REAL_BACKTEST_ERROR_REPORT_V1
```

## Next step

```text
P8_07_REAL_BACKTEST_ERROR_REPORT_V1
```
