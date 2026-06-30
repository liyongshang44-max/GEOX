# docs/tasks/P8-08-Real-Calibration-Report-v1.md

## Purpose

P8-08 implements the real calibration report for the P8 closed-loop replay.

The runtime reads the P8-07 real backtest error report and emits a deterministic read-only `real_calibration_report_v1` object. The report summarizes bias and scale candidates, but it does not update any model, write Field Memory, write facts, create execution objects, change frontend, change server routes, change schema, or change seed data.

## Gate

```text
P8_08_REAL_CALIBRATION_REPORT_V1
```

## Entry conditions

```text
previous_gate = P8_07_REAL_BACKTEST_ERROR_REPORT_V1
previous_doc = docs/tasks/P8-07-Real-Backtest-Error-Report-v1.md
previous_acceptance = scripts/governance_acceptance/P8_07_REAL_BACKTEST_ERROR_REPORT_V1.cjs
previous_next_step = P8_08_REAL_CALIBRATION_REPORT_V1
input_backtest_error_report_kind = real_backtest_error_report_v1
```

## Runtime files created in P8-08

```text
scripts/twin_kernel/P8_08_REAL_CALIBRATION_REPORT_V1.cjs
scripts/governance_acceptance/P8_08_REAL_CALIBRATION_REPORT_V1.cjs
docs/tasks/P8-08-Real-Calibration-Report-v1.md
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
input_backtest_error_report_kind = real_backtest_error_report_v1
input_backtest_error_report_source = scripts/twin_kernel/P8_07_REAL_BACKTEST_ERROR_REPORT_V1.cjs
calibration_basis_window_start_ts = 2009-06-09T05:00:00.000Z
calibration_basis_window_end_ts = 2009-06-09T07:00:00.000Z
calibration_basis_points = 3
```

## Output object kind

```text
real_calibration_report_v1
```

## Required output fields

```text
calibration_report_id
output_kind
project_id
subject_ref
sensor_ref
sensor_group_ref
metric_kind
unit
calibration_method
generated_for_as_of_ts
input_backtest_error_report_ref
input_prediction_run_ref
input_actual_observation_window_ref
input_state_estimate_ref
input_evidence_window_ref
calibration_basis
error_summary
calibration_parameters
calibration_by_metric
evidence_refs
actual_refs
source_query_refs
trace_refs
read_only
determinism_hash
```

## Calibration parameter fields

```text
method
applied_to_model
aggregate_additive_bias_correction_candidate
aggregate_multiplicative_scale_candidate
metric_adjustment_count
model_update_ref
field_memory_write_ref
```

## Calibration by metric fields

```text
metric_ref
compared_point_count
bias
mae
mean_predicted_value
mean_actual_value
additive_bias_correction_candidate
multiplicative_scale_candidate
```

## Calibration boundary rules

```text
calibration_may_read_backtest_error_report
calibration_must_not_read_raw_samples_directly
calibration_must_not_rerun_prediction_as_authority
calibration_must_not_update_model
calibration_must_not_write_field_memory
calibration_must_not_create_execution_object
calibration_candidates_are_not_applied
calibration_candidates_are_not_authorization
```

## Runtime strict prohibitions

```text
no_model_update
no_model_write
no_field_memory_write
no_fact_write
no_execution_object
no_recommendation
no_irrigation_advice
no_action_authorization
no_database_mutation
no_schema_change
no_seed_change
no_frontend_change
no_server_route
no_dispatch
no_receipt
no_audit_write
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P8_08_REAL_CALIBRATION_REPORT_V1.cjs
```

## Expected result

```text
ok = true
acceptance = P8_08_REAL_CALIBRATION_REPORT_V1
p8_07_verified = true
reads_backtest_error_report = true
calibration_parameters_present = true
calibration_by_metric_non_empty = true
applied_to_model_false = true
model_update_absent = true
field_memory_write_absent = true
read_only = true
determinism_stable = true
changed_file_count = 3
next_step = P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0
```

## Next step

```text
P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0
```
