# docs/tasks/P8-04-Real-State-Estimate-Runtime-v1.md

## Purpose

P8-04 implements the first real-evidence state estimate runtime for the P8 closed-loop replay.

The runtime reads the P8-02 `real_evidence_window_v0` object, estimates the current soil moisture state for the fixed CAF009 / G_CAF scope, and emits a deterministic read-only `real_soil_moisture_state_estimate_v1` object.

## Gate

```text
P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1
```

## Entry conditions

```text
previous_gate = P8_03_HOLDOUT_WINDOW_SPLIT_CONTRACT
previous_doc = docs/tasks/P8-03-Holdout-Window-Split-Contract.md
previous_acceptance = scripts/governance_acceptance/P8_03_HOLDOUT_WINDOW_SPLIT_CONTRACT.cjs
previous_next_step = P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1
input_window_kind = real_evidence_window_v0
```

## Runtime files created in P8-04

```text
scripts/twin_kernel/P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs
scripts/governance_acceptance/P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs
docs/tasks/P8-04-Real-State-Estimate-Runtime-v1.md
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
input_output_kind = real_evidence_window_v0
input_source = scripts/twin_kernel/P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs
input_window_start_ts = 2009-06-09T00:00:00.000Z
input_window_end_ts = 2009-06-09T04:00:00.000Z
input_must_include_evidence_points = true
input_must_include_evidence_refs = true
input_must_include_source_query_ref = true
```

## Output object kind

```text
real_soil_moisture_state_estimate_v1
```

## Required output fields

```text
state_estimate_id
output_kind
project_id
subject_ref
sensor_ref
sensor_group_ref
metric_kind
unit
estimate_method
estimate_value
estimate_by_metric
uncertainty
confidence
uncertainty_width
coverage_summary
metric_refs
evidence_refs
source_query_ref
trace_refs
input_evidence_window_ref
read_only
determinism_hash
```

## Estimation method

```text
method_name = weighted_recent_mean_v1
method_reads_history_window_only = true
method_uses_metric_values = true
method_weighting = later_observations_receive_higher_weight
method_outputs_metric_level_estimates = true
method_outputs_aggregate_estimate = true
method_outputs_uncertainty = true
```

## No-lookahead runtime rules

```text
state_estimate_runtime_must_read_history_window_only
state_estimate_runtime_must_not_read_prediction_window
state_estimate_runtime_must_not_read_actual_observation_window
state_estimate_runtime_must_not_read_later_observations
state_estimate_runtime_must_not_read_backtest_report
state_estimate_runtime_must_not_read_calibration_report
```

## Runtime strict prohibitions

```text
no_actual_window_query
no_prediction_query
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
no_frontend_change
no_server_route
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs
```

## Expected result

```text
ok = true
acceptance = P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1
p8_03_verified = true
reads_real_evidence_window_output = true
does_not_query_actual_window = true
estimate_value_numeric = true
uncertainty_present = true
evidence_refs_preserved = true
source_query_ref_preserved = true
read_only = true
determinism_stable = true
changed_file_count = 3
next_step = P8_05_REAL_PREDICTION_RUN_V1
```

## Next step

```text
P8_05_REAL_PREDICTION_RUN_V1
```
