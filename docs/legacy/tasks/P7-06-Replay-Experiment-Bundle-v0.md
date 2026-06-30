# docs/tasks/P7-06-Replay-Experiment-Bundle-v0.md

## Purpose

P7-06 creates a read-only replay experiment bundle v0 from the P7-05 calibration report.

The output is allowed to output `replay_experiment_bundle` only. It packages existing artifact refs, fixture refs, runtime commands, acceptance commands, and a no-write policy. It must not write model, write Field Memory, create execution output, create API routes, create DB schema, or create frontend authority.

## Gate

```text
P7_06_REPLAY_EXPERIMENT_BUNDLE_V0
```

## Entry conditions

```text
previous_gate: P7_05_CALIBRATION_REPORT_V0
previous_doc: docs/legacy/tasks/P7-05-Calibration-Report-v0.md
previous_acceptance: scripts/governance_acceptance/P7_05_CALIBRATION_REPORT_V0.cjs
previous_commit: 9df61364cc5ef526da47b3a8f166116c93cc5afe
p6_completion_tag: p6_execution_system_integration_completion
p7_05_status: accepted_on_main
p7_05_next_step: P7_06_REPLAY_EXPERIMENT_BUNDLE_V0
```

## Runtime files created in P7-06

```text
scripts/twin_kernel/P7_06_REPLAY_EXPERIMENT_BUNDLE_V0.cjs
```

## Replay bundle output fields

```text
replay_bundle_version
replay_bundle_id
output_kind
project_id
subject_ref
sensor_ref
sensor_group_ref
input_calibration_report_ref
input_backtest_error_report_ref
input_prediction_run_ref
input_state_estimate_ref
input_evidence_window_ref
metric_kind
unit
replay_method
generated_for_as_of_ts
artifact_chain
runtime_manifest
input_fixture_refs
calibration_applied
evidence_refs
trace_refs
provenance_ref
read_only
determinism_hash
```

## Replay method rules

```text
method_must_be_read_only_cli_chain_manifest_v0
method_must_use_p7_05_calibration_report_ref
method_must_preserve_backtest_error_report_ref
method_must_preserve_prediction_run_ref
method_must_preserve_state_estimate_ref
method_must_preserve_evidence_window_ref
method_must_emit_artifact_chain
method_must_emit_runtime_manifest
method_must_emit_input_fixture_refs
method_must_emit_acceptance_commands
method_must_mark_calibration_applied_false
method_must_be_deterministic
method_must_be_read_only
method_must_not_write_any_runtime_state
```

## Required replay validation gates

```text
p7_05_calibration_report_present
input_calibration_report_ref_required
input_backtest_error_report_ref_required
input_prediction_run_ref_required
input_state_estimate_ref_required
input_evidence_window_ref_required
project_id_required
subject_ref_required
metric_kind_must_be_soil_moisture
replay_method_required
artifact_chain_required
artifact_chain_count_required
runtime_manifest_required
runtime_commands_required
acceptance_commands_required
input_fixture_refs_required
write_policy_required
write_policy_all_false
calibration_applied_must_be_false
evidence_refs_required
trace_refs_required
provenance_ref_required
determinism_hash_required
read_only_required
no_model_write
no_db_or_frontend_change
no_execution_object_created
no_field_memory_write_created
```

## Replay fail codes

```text
MISSING_P7_05_CALIBRATION_REPORT
MISSING_INPUT_CALIBRATION_REPORT_REF
MISSING_INPUT_BACKTEST_ERROR_REPORT_REF
MISSING_INPUT_PREDICTION_RUN_REF
MISSING_INPUT_STATE_ESTIMATE_REF
MISSING_INPUT_EVIDENCE_WINDOW_REF
MISSING_PROJECT_ID
MISSING_SUBJECT_REF
METRIC_KIND_NOT_SOIL_MOISTURE
MISSING_REPLAY_METHOD
MISSING_ARTIFACT_CHAIN
INVALID_ARTIFACT_CHAIN_COUNT
MISSING_RUNTIME_MANIFEST
MISSING_RUNTIME_COMMANDS
MISSING_ACCEPTANCE_COMMANDS
MISSING_INPUT_FIXTURE_REFS
MISSING_WRITE_POLICY
WRITE_POLICY_NOT_FALSE
CALIBRATION_APPLIED_NOT_FALSE
MISSING_EVIDENCE_REFS
MISSING_TRACE_REFS
MISSING_PROVENANCE_REF
MISSING_DETERMINISM_HASH
READ_ONLY_FLAG_MISSING
MODEL_WRITE_CREATED
DB_OR_FRONTEND_CHANGE_PRESENT
EXECUTION_OBJECT_CREATED
FIELD_MEMORY_WRITE_CREATED
```

## Replay result vocabulary

```text
PASS = replay_experiment_bundle_generated_and_validated
BLOCK = replay_experiment_bundle_generation_or_validation_failed
NOT_EVALUATED = treated_as_BLOCK
UNKNOWN = treated_as_BLOCK
```

## Replay state vocabulary

```text
REPLAY_BUNDLE_READY_FOR_P7_COMPLETION_REVIEW
REPLAY_BUNDLE_BLOCKED_VALIDATION_FAILED
REPLAY_BUNDLE_BLOCKED_NOT_EVALUATED
REPLAY_BUNDLE_BLOCKED_UNKNOWN
REPLAY_BUNDLE_BLOCKED_MISSING_CALIBRATION_REPORT
REPLAY_BUNDLE_BLOCKED_TRACEABILITY
REPLAY_BUNDLE_BLOCKED_SIDE_EFFECT
REPLAY_BUNDLE_BLOCKED_WRITE_ATTEMPT
```

## Allowed runtime side effects

```text
read_evidence_window_fixture
read_actuals_fixture
compute_calibration_report_in_memory
build_artifact_chain
build_runtime_manifest
compute_determinism_hash
print_json_to_stdout
```

## Prohibited replay semantics

```text
model_write_from_replay_bundle_v0
automatic_learning_from_replay_bundle_v0
field_memory_write_from_replay_bundle_v0
recommendation_from_replay_bundle_v0
prescription_from_replay_bundle_v0
ao_act_task_from_replay_bundle_v0
dispatch_from_replay_bundle_v0
receipt_write_from_replay_bundle_v0
audit_write_from_replay_bundle_v0
frontend_state_as_replay_authority
p8_or_later_expansion
runtime_state_mutation_from_replay_bundle_v0
```

## P7-07 handoff

```text
next_gate: P7_07_TWIN_KERNEL_COMPLETION_REVIEW
p7_07_must_use_replay_experiment_bundle_ref = true
p7_07_must_verify_p7_01_to_p7_06_chain = true
p7_07_must_verify_read_only_runtime = true
p7_07_must_verify_determinism = true
p7_07_must_verify_no_db_change = true
p7_07_must_verify_no_frontend_change = true
p7_07_must_verify_no_execution_object = true
p7_07_must_verify_no_field_memory_write = true
p7_07_must_verify_no_model_write = true
p7_07_must_output_completion_review = true
p7_07_must_not_open_p8 = true
```

## Changed files allowed in P7-06

```text
docs/tasks/P7-06-Replay-Experiment-Bundle-v0.md
scripts/governance_acceptance/P7_06_REPLAY_EXPERIMENT_BUNDLE_V0.cjs
scripts/twin_kernel/P7_06_REPLAY_EXPERIMENT_BUNDLE_V0.cjs
```

## Directories forbidden in P7-06

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
p7_06_creates_replay_experiment_bundle_runtime = true
p7_06_reuses_p7_05_calibration_report = true
p7_06_changes_frontend = false
p7_06_changes_server_runtime = false
p7_06_changes_routes = false
p7_06_changes_db = false
p7_06_changes_execution = false
p7_06_creates_model_write = false
p7_06_creates_field_memory_write = false
p7_06_creates_automatic_learning = false
p7_06_creates_recommendation = false
p7_06_extends_to_p8_or_later = false
```

## Secondary review requirement

```text
secondary_review_required = true
secondary_review_must_refetch_created_files = true
secondary_review_must_run_replay_runtime = true
secondary_review_must_verify_counts = true
secondary_review_must_verify_changed_files = true
secondary_review_must_verify_no_db_or_frontend_or_execution_change = true
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P7_06_REPLAY_EXPERIMENT_BUNDLE_V0.cjs
```

## Runtime command

```powershell
node scripts/twin_kernel/P7_06_REPLAY_EXPERIMENT_BUNDLE_V0.cjs
```

## Expected result

```text
ok = true
acceptance = P7_06_REPLAY_EXPERIMENT_BUNDLE_V0
p7_05_verified = true
p6_completion_tag_verified = true
replay_bundle_runtime_verified = true
replay_bundle_output_field_count = 25
replay_method_rule_count = 14
replay_validation_gate_count = 28
replay_fail_code_count = 28
replay_result_vocabulary_count = 4
replay_state_count = 8
allowed_runtime_side_effect_count = 7
prohibited_replay_semantic_count = 12
p7_07_handoff_rule_count = 12
secondary_review_required = true
changed_file_count = 3
no_frontend_changed_by_this_task = true
no_server_runtime_changed_by_this_task = true
no_db_changed_by_this_task = true
no_execution_changed_by_this_task = true
next_step = P7_07_TWIN_KERNEL_COMPLETION_REVIEW
```

## Next step

```text
P7_07_TWIN_KERNEL_COMPLETION_REVIEW
```
