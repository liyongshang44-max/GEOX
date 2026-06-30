# docs/tasks/P8-10-Real-Evidence-Closed-Loop-Completion-Review.md

## Purpose

P8-10 completes the P8 Real Evidence Closed-Loop Acceptance / Product Replay Demo task line.

This gate performs the final completion review. It verifies that the P8 branch moved from P7 fixture-only replay to a real-evidence, read-only, externally understandable replay demo using real `raw_samples` evidence, holdout prediction, real actual observations, backtest error, calibration candidates, and product replay narrative.

This task does not create another runtime stage. It only reviews the P8 artifact chain and reruns acceptance gates.

## Gate

```text
P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW
```

## Entry conditions

```text
previous_gate = P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0
previous_doc = docs/tasks/P8-09-Product-Replay-Demo-Report-v0.md
previous_acceptance = scripts/governance_acceptance/P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0.cjs
previous_next_step = P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW
input_product_replay_demo_kind = product_replay_demo_report_v0
```

## Files created in P8-10

```text
docs/tasks/P8-10-Real-Evidence-Closed-Loop-Completion-Review.md
scripts/governance_acceptance/P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW.cjs
```

## Completed P8 gates

```text
P8_00_REAL_EVIDENCE_CLOSED_LOOP_PLANNING
P8_01_REAL_EVIDENCE_SOURCE_CONTRACT
P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0
P8_03_HOLDOUT_WINDOW_SPLIT_CONTRACT
P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1
P8_05_REAL_PREDICTION_RUN_V1
P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0
P8_07_REAL_BACKTEST_ERROR_REPORT_V1
P8_08_REAL_CALIBRATION_REPORT_V1
P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0
```

## Final artifact chain

```text
real_evidence_window_v0
real_soil_moisture_state_estimate_v1
real_soil_moisture_prediction_run_v1
real_actual_observation_window_v0
real_backtest_error_report_v1
real_calibration_report_v1
product_replay_demo_report_v0
```

## Fixed replay scope

```text
problem = soil_moisture_state_estimation
project_id = P_DEFAULT
sensor_group_id = G_CAF
sensor_id = CAF009
metric_kind = soil_moisture
```

## Final window contract

```text
history_window_start_ts = 2009-06-09T00:00:00.000Z
history_window_end_ts = 2009-06-09T04:00:00.000Z
prediction_window_start_ts = 2009-06-09T05:00:00.000Z
prediction_window_end_ts = 2009-06-09T07:00:00.000Z
actual_observation_window_start_ts = 2009-06-09T05:00:00.000Z
actual_observation_window_end_ts = 2009-06-09T07:00:00.000Z
expected_interval_ms = 3600000
```

## Completion verification targets

```text
real_evidence_window_verified
state_estimate_verified
prediction_run_verified
actual_observation_window_verified
backtest_error_report_verified
calibration_report_verified
product_replay_demo_verified
db_read_only_verified
field_memory_write_absent
model_write_absent
execution_object_absent
frontend_authority_absent
```

## Runtime and surface prohibitions

```text
no_database_mutation
no_schema_change
no_seed_change
no_fact_write
no_field_memory_write
no_model_write
no_execution_object
no_ao_act_task
no_dispatch
no_receipt
no_audit_write
no_frontend_change
no_server_route
no_dashboard_authority
no_recommendation
no_action_authorization
no_automatic_learning_loop
```

## Changed file boundary

```text
allowed_path_prefix = docs/tasks/P8-
allowed_path_prefix = scripts/governance_acceptance/P8_
allowed_path_prefix = scripts/twin_kernel/P8_
forbidden_path_prefix = apps/web/
forbidden_path_prefix = apps/server/
forbidden_path_prefix = db/
forbidden_path_prefix = prisma/
forbidden_path_prefix = migrations/
forbidden_path_prefix = seeds/
```

## Completion tag

```text
p8_real_evidence_closed_loop_demo_completion
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW.cjs
```

## Expected result

```text
ok = true
acceptance = P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW
real_evidence_window_verified = true
state_estimate_verified = true
prediction_run_verified = true
actual_observation_window_verified = true
backtest_error_report_verified = true
calibration_report_verified = true
product_replay_demo_verified = true
db_read_only_verified = true
field_memory_write_absent = true
model_write_absent = true
execution_object_absent = true
frontend_authority_absent = true
completion_tag = p8_real_evidence_closed_loop_demo_completion
```

## Final status

```text
P8 Real Evidence Closed-Loop Acceptance / Product Replay Demo = COMPLETE
```
