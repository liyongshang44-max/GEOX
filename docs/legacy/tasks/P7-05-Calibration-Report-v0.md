# docs/tasks/P7-05-Calibration-Report-v0.md

## Purpose

P7-05 creates a read-only calibration report v0 from the P7-04 backtest error report.

The output is allowed to output `calibration_report` only. It may describe unapplied calibration candidates derived from backtest bias. It must not apply parameters, write a model, write Field Memory, create replay output, create execution output, create API routes, or create frontend authority.

## Gate

```text
P7_05_CALIBRATION_REPORT_V0
```

## Entry conditions

```text
previous_gate: P7_04_BACKTEST_ERROR_REPORT_V0
previous_doc: docs/legacy/tasks/P7-04-Backtest-Error-Report-v0.md
previous_acceptance: scripts/governance_acceptance/P7_04_BACKTEST_ERROR_REPORT_V0.cjs
previous_commit: e5eb8705474993e4aeee2c24e92ff710c1b7f4e0
p6_completion_tag: p6_execution_system_integration_completion
p7_04_status: accepted_on_main
p7_04_next_step: P7_05_CALIBRATION_REPORT_V0
```

## Runtime files created in P7-05

```text
scripts/twin_kernel/P7_05_CALIBRATION_REPORT_V0.cjs
```

## Calibration report output fields

```text
calibration_report_version
calibration_report_id
output_kind
project_id
subject_ref
sensor_ref
sensor_group_ref
input_backtest_error_report_ref
input_prediction_run_ref
input_state_estimate_ref
input_evidence_window_ref
metric_kind
unit
calibration_method
generated_for_as_of_ts
calibration_basis
error_summary
calibration_parameters
calibration_by_metric
evidence_refs
trace_refs
provenance_ref
read_only
determinism_hash
```

## Calibration method rules

```text
method_must_be_backtest_bias_summary_v0
method_must_use_p7_04_backtest_error_report_ref
method_must_preserve_prediction_run_ref
method_must_preserve_state_estimate_ref
method_must_preserve_evidence_window_ref
method_must_compute_aggregate_bias_candidate
method_must_compute_aggregate_scale_candidate
method_must_compute_metric_level_candidates
method_must_mark_applied_to_model_false
method_must_set_model_update_ref_null
method_must_preserve_evidence_refs
method_must_preserve_trace_refs
method_must_preserve_provenance_ref
method_must_be_deterministic
method_must_be_read_only
method_must_not_apply_calibration
```

## Required calibration validation gates

```text
p7_04_backtest_error_report_present
input_backtest_error_report_ref_required
input_prediction_run_ref_required
input_state_estimate_ref_required
input_evidence_window_ref_required
project_id_required
subject_ref_required
metric_kind_must_be_soil_moisture
calibration_method_required
calibration_basis_required
error_summary_required
calibration_parameters_required
aggregate_bias_candidate_required
aggregate_scale_candidate_required
applied_to_model_must_be_false
model_update_ref_must_be_null
calibration_by_metric_required
metric_level_candidates_required
evidence_refs_required
trace_refs_required
provenance_ref_required
determinism_hash_required
read_only_required
no_model_write
no_replay_bundle_created
no_db_or_frontend_change
no_execution_object_created
no_field_memory_write_created
```

## Calibration fail codes

```text
MISSING_P7_04_BACKTEST_ERROR_REPORT
MISSING_INPUT_BACKTEST_ERROR_REPORT_REF
MISSING_INPUT_PREDICTION_RUN_REF
MISSING_INPUT_STATE_ESTIMATE_REF
MISSING_INPUT_EVIDENCE_WINDOW_REF
MISSING_PROJECT_ID
MISSING_SUBJECT_REF
METRIC_KIND_NOT_SOIL_MOISTURE
MISSING_CALIBRATION_METHOD
MISSING_CALIBRATION_BASIS
MISSING_ERROR_SUMMARY
MISSING_CALIBRATION_PARAMETERS
MISSING_AGGREGATE_BIAS_CANDIDATE
MISSING_AGGREGATE_SCALE_CANDIDATE
APPLIED_TO_MODEL_NOT_FALSE
MODEL_UPDATE_REF_NOT_NULL
MISSING_CALIBRATION_BY_METRIC
MISSING_METRIC_LEVEL_CANDIDATES
MISSING_EVIDENCE_REFS
MISSING_TRACE_REFS
MISSING_PROVENANCE_REF
MISSING_DETERMINISM_HASH
READ_ONLY_FLAG_MISSING
MODEL_WRITE_CREATED
REPLAY_BUNDLE_CREATED
DB_OR_FRONTEND_CHANGE_PRESENT
EXECUTION_OBJECT_CREATED
FIELD_MEMORY_WRITE_CREATED
```

## Calibration result vocabulary

```text
PASS = calibration_report_generated_and_validated
BLOCK = calibration_report_generation_or_validation_failed
NOT_EVALUATED = treated_as_BLOCK
UNKNOWN = treated_as_BLOCK
```

## Calibration state vocabulary

```text
CALIBRATION_REPORT_READY_FOR_REPLAY_BUNDLE_CONTRACT
CALIBRATION_REPORT_BLOCKED_VALIDATION_FAILED
CALIBRATION_REPORT_BLOCKED_NOT_EVALUATED
CALIBRATION_REPORT_BLOCKED_UNKNOWN
CALIBRATION_REPORT_BLOCKED_MISSING_BACKTEST_REPORT
CALIBRATION_REPORT_BLOCKED_TRACEABILITY
CALIBRATION_REPORT_BLOCKED_SIDE_EFFECT
CALIBRATION_REPORT_BLOCKED_MODEL_WRITE_ATTEMPT
```

## Allowed runtime side effects

```text
read_evidence_window_fixture
read_actuals_fixture
compute_backtest_report_in_memory
compute_aggregate_calibration_candidate
compute_metric_level_calibration_candidates
compute_determinism_hash
print_json_to_stdout
```

## Prohibited calibration semantics

```text
model_write_from_calibration_v0
replay_bundle_from_calibration_v0
automatic_learning_from_calibration_v0
field_memory_write_from_calibration_v0
recommendation_from_calibration_v0
prescription_from_calibration_v0
ao_act_task_from_calibration_v0
dispatch_from_calibration_v0
receipt_write_from_calibration_v0
audit_write_from_calibration_v0
frontend_state_as_calibration_authority
p8_or_later_expansion
```

## P7-06 handoff

```text
next_gate: P7_06_REPLAY_EXPERIMENT_BUNDLE_V0
p7_06_must_use_calibration_report_ref = true
p7_06_must_preserve_input_backtest_error_report_ref = true
p7_06_must_preserve_input_prediction_run_ref = true
p7_06_must_preserve_input_state_estimate_ref = true
p7_06_must_preserve_input_evidence_window_ref = true
p7_06_must_preserve_project_id = true
p7_06_must_preserve_subject_ref = true
p7_06_must_preserve_metric_kind = true
p7_06_must_preserve_evidence_refs = true
p7_06_must_preserve_trace_refs = true
p7_06_must_output_replay_experiment_bundle = true
p7_06_must_not_write_model = true
p7_06_must_not_write_field_memory = true
p7_06_must_not_create_execution_object = true
```

## Changed files allowed in P7-05

```text
docs/tasks/P7-05-Calibration-Report-v0.md
scripts/governance_acceptance/P7_05_CALIBRATION_REPORT_V0.cjs
scripts/twin_kernel/P7_05_CALIBRATION_REPORT_V0.cjs
```

## Directories forbidden in P7-05

```text
apps/web/
apps/server/
apps/executor/
packages/
db/
migrations/
scripts/demo_seed/
scripts/runtime/
```

## Boundary assertions

```text
p7_05_creates_calibration_report_runtime = true
p7_05_reuses_p7_04_backtest_report = true
p7_05_changes_frontend = false
p7_05_changes_server_runtime = false
p7_05_changes_routes = false
p7_05_changes_db = false
p7_05_changes_execution = false
p7_05_creates_model_write = false
p7_05_creates_replay_bundle = false
p7_05_creates_field_memory_write = false
p7_05_creates_automatic_learning = false
p7_05_creates_recommendation = false
p7_05_extends_to_p8_or_later = false
```

## Secondary review requirement

```text
secondary_review_required = true
secondary_review_must_refetch_created_files = true
secondary_review_must_run_calibration_runtime = true
secondary_review_must_verify_counts = true
secondary_review_must_verify_changed_files = true
secondary_review_must_verify_no_db_or_frontend_or_execution_change = true
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P7_05_CALIBRATION_REPORT_V0.cjs
```

## Runtime command

```powershell
node scripts/twin_kernel/P7_05_CALIBRATION_REPORT_V0.cjs
```

## Expected result

```text
ok = true
acceptance = P7_05_CALIBRATION_REPORT_V0
p7_04_verified = true
p6_completion_tag_verified = true
calibration_report_runtime_verified = true
calibration_report_output_field_count = 24
calibration_method_rule_count = 16
calibration_validation_gate_count = 28
calibration_fail_code_count = 28
calibration_result_vocabulary_count = 4
calibration_state_count = 8
allowed_runtime_side_effect_count = 7
prohibited_calibration_semantic_count = 12
p7_06_handoff_rule_count = 15
secondary_review_required = true
changed_file_count = 3
no_frontend_changed_by_this_task = true
no_server_runtime_changed_by_this_task = true
no_db_changed_by_this_task = true
no_execution_changed_by_this_task = true
next_step = P7_06_REPLAY_EXPERIMENT_BUNDLE_V0
```

## Next step

```text
P7_06_REPLAY_EXPERIMENT_BUNDLE_V0
```
