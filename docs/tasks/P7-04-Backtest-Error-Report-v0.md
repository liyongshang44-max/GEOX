# docs/tasks/P7-04-Backtest-Error-Report-v0.md

## Purpose

P7-04 creates the first minimal Twin Kernel backtest output: a read-only backtest error report v0.

The purpose is to consume the P7-03 prediction run and a fixed actuals fixture, then produce a deterministic error report JSON object. This is the first P7 task that is allowed to output `backtest_error_report`. It is not allowed to output a calibration report, replay bundle, recommendation, prescription, Field Memory write, model update, AO-ACT task, dispatch, receipt, audit write, database write, API route, or frontend authority.

P7-04 follows P7-03 Prediction Run v0. P7-04 must preserve prediction_run_ref, state_estimate_ref, evidence_window_ref, project_id, subject_ref, metric_kind, evidence_refs, trace_refs, provenance_ref, read-only behavior, and determinism hash.

P7-04 implements a minimal local Node CLI under `scripts/twin_kernel/`. The CLI reads the existing P7-02 evidence window fixture, derives the P7-03 prediction run in memory, reads a fixed actuals fixture, and prints a backtest error report JSON to stdout. It does not connect to a database, write files, write facts, write Field Memory, update models, create execution objects, create API routes, or create frontend state.

## Gate

```text
P7_04_BACKTEST_ERROR_REPORT_V0
```

## Entry conditions

```text
previous_gate: P7_03_PREDICTION_RUN_V0
previous_doc: docs/tasks/P7-03-Prediction-Run-v0.md
previous_acceptance: scripts/governance_acceptance/P7_03_PREDICTION_RUN_V0.cjs
previous_commit: 9848df3605ca3e99b49888f33fd2510fd147015a
p6_completion_tag: p6_execution_system_integration_completion
p7_03_status: accepted_on_main
p7_03_next_step: P7_04_BACKTEST_ERROR_REPORT_V0
```

## Runtime files created in P7-04

```text
scripts/twin_kernel/P7_04_BACKTEST_ERROR_REPORT_V0.cjs
scripts/twin_kernel/fixtures/P7_04_BACKTEST_ACTUALS_CAF009_SAMPLE.json
```

## Backtest error report output fields

```text
backtest_report_version
backtest_report_id
output_kind
project_id
subject_ref
sensor_ref
sensor_group_ref
input_prediction_run_ref
input_state_estimate_ref
input_evidence_window_ref
metric_kind
unit
backtest_method
generated_for_as_of_ts
compared_horizon_steps
compared_point_count
error_summary
error_by_point
actuals_ref
evidence_refs
trace_refs
provenance_ref
read_only
determinism_hash
```

## Backtest method rules

```text
method_must_be_prediction_vs_actuals_fixture_v0
method_must_use_p7_03_prediction_run_ref
method_must_preserve_input_state_estimate_ref
method_must_preserve_input_evidence_window_ref
method_must_use_fixed_actuals_fixture
method_must_match_prediction_and_actuals_by_target_ts
method_must_compute_point_level_errors
method_must_compute_metric_level_errors
method_must_compute_mae_rmse_bias_and_max_absolute_error
method_must_preserve_evidence_refs
method_must_preserve_trace_refs
method_must_preserve_provenance_ref
method_must_be_deterministic
method_must_be_read_only
method_must_not_create_calibration_report
```

## Required backtest validation gates

```text
p7_03_prediction_run_present
input_prediction_run_ref_required
input_state_estimate_ref_required
input_evidence_window_ref_required
actuals_ref_required
project_id_required
subject_ref_required
metric_kind_must_be_soil_moisture
backtest_method_required
generated_for_as_of_ts_required
compared_horizon_steps_required
compared_point_count_required
error_summary_required
mae_required
rmse_required
bias_required
max_absolute_error_required
error_by_point_required
metric_level_errors_required
evidence_refs_required
trace_refs_required
provenance_ref_required
determinism_hash_required
read_only_required
no_calibration_report_created
no_replay_bundle_created
no_runtime_db_or_frontend_change
no_execution_object_created
no_field_memory_write_created
no_model_update_created
```

## Backtest fail codes

```text
MISSING_P7_03_PREDICTION_RUN
MISSING_INPUT_PREDICTION_RUN_REF
MISSING_INPUT_STATE_ESTIMATE_REF
MISSING_INPUT_EVIDENCE_WINDOW_REF
MISSING_ACTUALS_REF
MISSING_PROJECT_ID
MISSING_SUBJECT_REF
METRIC_KIND_NOT_SOIL_MOISTURE
MISSING_BACKTEST_METHOD
MISSING_GENERATED_FOR_AS_OF_TS
MISSING_COMPARED_HORIZON_STEPS
MISSING_COMPARED_POINT_COUNT
MISSING_ERROR_SUMMARY
MISSING_MAE
MISSING_RMSE
MISSING_BIAS
MISSING_MAX_ABSOLUTE_ERROR
MISSING_ERROR_BY_POINT
MISSING_METRIC_LEVEL_ERRORS
MISSING_EVIDENCE_REFS
MISSING_TRACE_REFS
MISSING_PROVENANCE_REF
MISSING_DETERMINISM_HASH
READ_ONLY_FLAG_MISSING
CALIBRATION_REPORT_CREATED
REPLAY_BUNDLE_CREATED
RUNTIME_DB_OR_FRONTEND_CHANGE_PRESENT
EXECUTION_OBJECT_CREATED
FIELD_MEMORY_WRITE_CREATED
MODEL_UPDATE_CREATED
```

## Backtest result vocabulary

```text
PASS = backtest_error_report_generated_and_validated
BLOCK = backtest_error_report_generation_or_validation_failed
NOT_EVALUATED = treated_as_BLOCK
UNKNOWN = treated_as_BLOCK
```

## Backtest state vocabulary

```text
BACKTEST_ERROR_REPORT_READY_FOR_CALIBRATION_CONTRACT
BACKTEST_ERROR_REPORT_BLOCKED_VALIDATION_FAILED
BACKTEST_ERROR_REPORT_BLOCKED_NOT_EVALUATED
BACKTEST_ERROR_REPORT_BLOCKED_UNKNOWN
BACKTEST_ERROR_REPORT_BLOCKED_MISSING_PREDICTION_RUN
BACKTEST_ERROR_REPORT_BLOCKED_MISSING_ACTUALS
BACKTEST_ERROR_REPORT_BLOCKED_TRACEABILITY
BACKTEST_ERROR_REPORT_BLOCKED_SIDE_EFFECT
```

## Allowed runtime side effects

```text
read_evidence_window_fixture
read_actuals_fixture
compute_prediction_run_in_memory
match_prediction_to_actuals
compute_point_level_error_metrics
compute_metric_level_error_metrics
compute_summary_error_metrics
compute_determinism_hash
print_json_to_stdout
```

## Prohibited backtest semantics

```text
calibration_report_from_backtest_v0
replay_bundle_from_backtest_v0
model_update_from_backtest_v0
automatic_learning_from_backtest_v0
field_memory_write_from_backtest_v0
recommendation_from_backtest_v0
prescription_from_backtest_v0
irrigation_advice_from_backtest_v0
profit_prediction_from_backtest_v0
yield_prediction_from_backtest_v0
ao_act_task_from_backtest_v0
dispatch_from_backtest_v0
receipt_write_from_backtest_v0
audit_write_from_backtest_v0
frontend_state_as_backtest_authority
evidence_rewrite_from_backtest_v0
trace_rewrite_from_backtest_v0
prediction_rewrite_from_backtest_v0
actuals_rewrite_from_backtest_v0
p8_or_later_expansion
```

## P7-05 handoff

```text
next_gate: P7_05_CALIBRATION_REPORT_V0
p7_05_must_use_backtest_error_report_ref = true
p7_05_must_preserve_input_prediction_run_ref = true
p7_05_must_preserve_input_state_estimate_ref = true
p7_05_must_preserve_input_evidence_window_ref = true
p7_05_must_preserve_project_id = true
p7_05_must_preserve_subject_ref = true
p7_05_must_preserve_metric_kind = true
p7_05_must_preserve_evidence_refs = true
p7_05_must_preserve_trace_refs = true
p7_05_must_output_calibration_report = true
p7_05_must_not_write_model_update = true
p7_05_must_not_write_field_memory = true
p7_05_must_not_create_execution_object = true
```

## Changed files allowed in P7-04

```text
docs/tasks/P7-04-Backtest-Error-Report-v0.md
scripts/governance_acceptance/P7_04_BACKTEST_ERROR_REPORT_V0.cjs
scripts/twin_kernel/P7_04_BACKTEST_ERROR_REPORT_V0.cjs
scripts/twin_kernel/fixtures/P7_04_BACKTEST_ACTUALS_CAF009_SAMPLE.json
```

## Directories forbidden in P7-04

```text
apps/web/
apps/server/
apps/executor/
packages/twin-kernel/
packages/contracts/
packages/
db/
migrations/
scripts/demo_seed/
scripts/runtime/
```

## Boundary assertions

```text
p7_04_creates_backtest_error_report_runtime = true
p7_04_creates_actuals_fixture_input = true
p7_04_reuses_p7_03_prediction_run = true
p7_04_changes_frontend = false
p7_04_changes_server_runtime = false
p7_04_changes_routes = false
p7_04_changes_db = false
p7_04_changes_scheduler = false
p7_04_changes_adapter = false
p7_04_changes_execution = false
p7_04_creates_twin_kernel_package = false
p7_04_creates_calibration_report = false
p7_04_creates_replay_bundle = false
p7_04_creates_dispatch_adapter = false
p7_04_creates_executor_service = false
p7_04_creates_ao_act_task = false
p7_04_creates_receipt_write = false
p7_04_creates_audit_write = false
p7_04_creates_machine_control = false
p7_04_creates_field_memory_write = false
p7_04_creates_model_update = false
p7_04_creates_automatic_learning = false
p7_04_creates_recommendation = false
p7_04_creates_prescription = false
p7_04_creates_profit_prediction = false
p7_04_extends_to_p8_or_later = false
```

## Secondary review requirement

```text
secondary_review_required = true
secondary_review_must_refetch_created_files = true
secondary_review_must_run_backtest_runtime = true
secondary_review_must_verify_counts = true
secondary_review_must_verify_changed_files = true
secondary_review_must_verify_no_db_or_frontend_or_execution_change = true
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P7_04_BACKTEST_ERROR_REPORT_V0.cjs
```

## Runtime command

```powershell
node scripts/twin_kernel/P7_04_BACKTEST_ERROR_REPORT_V0.cjs
```

## Expected result

```text
ok = true
acceptance = P7_04_BACKTEST_ERROR_REPORT_V0
p7_03_verified = true
p6_completion_tag_verified = true
backtest_error_report_runtime_verified = true
backtest_error_report_output_field_count = 24
backtest_method_rule_count = 15
backtest_validation_gate_count = 30
backtest_fail_code_count = 30
backtest_result_vocabulary_count = 4
backtest_state_count = 8
allowed_runtime_side_effect_count = 9
prohibited_backtest_semantic_count = 20
p7_05_handoff_rule_count = 14
secondary_review_required = true
changed_file_count = 4
no_frontend_changed_by_this_task = true
no_server_runtime_changed_by_this_task = true
no_db_changed_by_this_task = true
no_execution_changed_by_this_task = true
next_step = P7_05_CALIBRATION_REPORT_V0
```

## Next step

```text
P7_05_CALIBRATION_REPORT_V0
```
