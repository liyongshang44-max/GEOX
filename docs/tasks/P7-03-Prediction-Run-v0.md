# docs/tasks/P7-03-Prediction-Run-v0.md

## Purpose

P7-03 creates the first minimal Twin Kernel prediction output: a read-only prediction run v0.

The purpose is to consume the P7-02 soil moisture state estimate and the preserved P7-01 evidence window reference chain, then produce a deterministic short-horizon prediction run JSON object. This is the first P7 task that is allowed to output `prediction_run`. It is not allowed to output a backtest report, calibration report, replay bundle, recommendation, prescription, Field Memory write, model update, AO-ACT task, dispatch, receipt, audit write, database write, API route, or frontend authority.

P7-03 follows P7-02 Soil Moisture State Estimate v0. P7-03 must preserve state_estimate_ref, input_evidence_window_ref, project_id, subject_ref, metric_kind, evidence_refs, trace_refs, provenance_ref, read-only behavior, and determinism hash.

P7-03 implements a minimal local Node CLI under `scripts/twin_kernel/`. The CLI reads the existing P7-02 fixture evidence window, derives the P7-02 state estimate in memory, and prints a prediction run JSON to stdout. It does not connect to a database, write files, write facts, write Field Memory, update models, create execution objects, create API routes, or create frontend state.

## Gate

```text
P7_03_PREDICTION_RUN_V0
```

## Entry conditions

```text
previous_gate: P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0
previous_doc: docs/tasks/P7-02-Soil-Moisture-State-Estimate-v0.md
previous_acceptance: scripts/governance_acceptance/P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0.cjs
previous_commit: 4c7aacb216f5a40ce015618d6a8cccf296838248
p6_completion_tag: p6_execution_system_integration_completion
p7_02_status: accepted_on_main
p7_02_next_step: P7_03_PREDICTION_RUN_V0
```

## Runtime files created in P7-03

```text
scripts/twin_kernel/P7_03_PREDICTION_RUN_V0.cjs
```

## Prediction run output fields

```text
prediction_run_version
prediction_run_id
output_kind
project_id
subject_ref
sensor_ref
sensor_group_ref
input_state_estimate_ref
input_evidence_window_ref
metric_kind
unit
prediction_method
generated_for_as_of_ts
horizon_steps
step_ms
starting_estimate_value
prediction_points
uncertainty_model
evidence_refs
trace_refs
provenance_ref
read_only
determinism_hash
```

## Prediction method rules

```text
method_must_be_linear_recent_window_trend_v0
method_must_use_p7_02_state_estimate_ref
method_must_use_p7_01_evidence_window_ref
method_must_use_soil_moisture_metric_refs_only
method_must_use_existing_evidence_window_samples
method_must_output_three_prediction_steps
method_must_output_metric_level_predictions
method_must_output_uncertainty_growth
method_must_preserve_evidence_refs
method_must_preserve_trace_refs
method_must_preserve_provenance_ref
method_must_be_deterministic
method_must_be_read_only
method_must_not_create_backtest_report
```

## Required prediction run validation gates

```text
p7_02_state_estimate_present
input_state_estimate_ref_required
input_evidence_window_ref_required
project_id_required
subject_ref_required
metric_kind_must_be_soil_moisture
prediction_method_required
generated_for_as_of_ts_required
horizon_steps_required
step_ms_required
prediction_points_required
prediction_points_count_required
prediction_by_metric_required
uncertainty_model_required
evidence_refs_required
trace_refs_required
provenance_ref_required
determinism_hash_required
read_only_required
no_backtest_report_created
no_calibration_report_created
no_replay_bundle_created
no_runtime_db_or_frontend_change
no_execution_object_created
no_field_memory_write_created
no_model_update_created
```

## Prediction run fail codes

```text
MISSING_P7_02_STATE_ESTIMATE
MISSING_INPUT_STATE_ESTIMATE_REF
MISSING_INPUT_EVIDENCE_WINDOW_REF
MISSING_PROJECT_ID
MISSING_SUBJECT_REF
METRIC_KIND_NOT_SOIL_MOISTURE
MISSING_PREDICTION_METHOD
MISSING_GENERATED_FOR_AS_OF_TS
MISSING_HORIZON_STEPS
MISSING_STEP_MS
MISSING_PREDICTION_POINTS
INVALID_PREDICTION_POINT_COUNT
MISSING_PREDICTION_BY_METRIC
MISSING_UNCERTAINTY_MODEL
MISSING_EVIDENCE_REFS
MISSING_TRACE_REFS
MISSING_PROVENANCE_REF
MISSING_DETERMINISM_HASH
READ_ONLY_FLAG_MISSING
BACKTEST_REPORT_CREATED
CALIBRATION_REPORT_CREATED
REPLAY_BUNDLE_CREATED
RUNTIME_DB_OR_FRONTEND_CHANGE_PRESENT
EXECUTION_OBJECT_CREATED
FIELD_MEMORY_WRITE_CREATED
MODEL_UPDATE_CREATED
```

## Prediction run result vocabulary

```text
PASS = prediction_run_generated_and_validated
BLOCK = prediction_run_generation_or_validation_failed
NOT_EVALUATED = treated_as_BLOCK
UNKNOWN = treated_as_BLOCK
```

## Prediction run state vocabulary

```text
PREDICTION_RUN_READY_FOR_BACKTEST_CONTRACT
PREDICTION_RUN_BLOCKED_VALIDATION_FAILED
PREDICTION_RUN_BLOCKED_NOT_EVALUATED
PREDICTION_RUN_BLOCKED_UNKNOWN
PREDICTION_RUN_BLOCKED_MISSING_STATE_ESTIMATE
PREDICTION_RUN_BLOCKED_UNSUPPORTED_METRIC
PREDICTION_RUN_BLOCKED_TRACEABILITY
PREDICTION_RUN_BLOCKED_SIDE_EFFECT
```

## Allowed runtime side effects

```text
read_fixture_json
compute_state_estimate_in_memory
compute_metric_level_trend
compute_prediction_points
compute_uncertainty_growth
compute_determinism_hash
print_json_to_stdout
```

## Prohibited prediction run semantics

```text
backtest_report_from_prediction_run_v0
calibration_report_from_prediction_run_v0
replay_bundle_from_prediction_run_v0
irrigation_advice_from_prediction_run_v0
recommendation_from_prediction_run_v0
prescription_from_prediction_run_v0
profit_prediction_from_prediction_run_v0
yield_prediction_from_prediction_run_v0
field_memory_write_from_prediction_run_v0
model_update_from_prediction_run_v0
automatic_learning_from_prediction_run_v0
ao_act_task_from_prediction_run_v0
dispatch_from_prediction_run_v0
receipt_write_from_prediction_run_v0
audit_write_from_prediction_run_v0
frontend_state_as_prediction_run_authority
evidence_rewrite_from_prediction_run_v0
trace_rewrite_from_prediction_run_v0
state_estimate_rewrite_from_prediction_run_v0
p8_or_later_expansion
```

## P7-04 handoff

```text
next_gate: P7_04_BACKTEST_ERROR_REPORT_V0
p7_04_must_use_prediction_run_ref = true
p7_04_must_preserve_input_state_estimate_ref = true
p7_04_must_preserve_input_evidence_window_ref = true
p7_04_must_preserve_project_id = true
p7_04_must_preserve_subject_ref = true
p7_04_must_preserve_metric_kind = true
p7_04_must_preserve_evidence_refs = true
p7_04_must_preserve_trace_refs = true
p7_04_must_output_backtest_error_report = true
p7_04_must_not_output_calibration_report = true
p7_04_must_not_write_field_memory = true
p7_04_must_not_update_model = true
p7_04_must_not_create_execution_object = true
```

## Changed files allowed in P7-03

```text
docs/tasks/P7-03-Prediction-Run-v0.md
scripts/governance_acceptance/P7_03_PREDICTION_RUN_V0.cjs
scripts/twin_kernel/P7_03_PREDICTION_RUN_V0.cjs
```

## Directories forbidden in P7-03

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
p7_03_creates_prediction_run_runtime = true
p7_03_reuses_p7_02_fixture_input = true
p7_03_changes_frontend = false
p7_03_changes_server_runtime = false
p7_03_changes_routes = false
p7_03_changes_db = false
p7_03_changes_scheduler = false
p7_03_changes_adapter = false
p7_03_changes_execution = false
p7_03_creates_twin_kernel_package = false
p7_03_creates_backtest_report = false
p7_03_creates_calibration_report = false
p7_03_creates_replay_bundle = false
p7_03_creates_dispatch_adapter = false
p7_03_creates_executor_service = false
p7_03_creates_ao_act_task = false
p7_03_creates_receipt_write = false
p7_03_creates_audit_write = false
p7_03_creates_machine_control = false
p7_03_creates_field_memory_write = false
p7_03_creates_model_update = false
p7_03_creates_automatic_learning = false
p7_03_creates_recommendation = false
p7_03_creates_prescription = false
p7_03_creates_profit_prediction = false
p7_03_extends_to_p8_or_later = false
```

## Secondary review requirement

```text
secondary_review_required = true
secondary_review_must_refetch_created_files = true
secondary_review_must_run_prediction_runtime = true
secondary_review_must_verify_counts = true
secondary_review_must_verify_changed_files = true
secondary_review_must_verify_no_db_or_frontend_or_execution_change = true
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P7_03_PREDICTION_RUN_V0.cjs
```

## Runtime command

```powershell
node scripts/twin_kernel/P7_03_PREDICTION_RUN_V0.cjs
```

## Expected result

```text
ok = true
acceptance = P7_03_PREDICTION_RUN_V0
p7_02_verified = true
p6_completion_tag_verified = true
prediction_run_runtime_verified = true
prediction_run_output_field_count = 23
prediction_method_rule_count = 14
prediction_run_validation_gate_count = 26
prediction_run_fail_code_count = 26
prediction_run_result_vocabulary_count = 4
prediction_run_state_count = 8
allowed_runtime_side_effect_count = 7
prohibited_prediction_run_semantic_count = 20
p7_04_handoff_rule_count = 14
secondary_review_required = true
changed_file_count = 3
no_frontend_changed_by_this_task = true
no_server_runtime_changed_by_this_task = true
no_db_changed_by_this_task = true
no_execution_changed_by_this_task = true
next_step = P7_04_BACKTEST_ERROR_REPORT_V0
```

## Next step

```text
P7_04_BACKTEST_ERROR_REPORT_V0
```
