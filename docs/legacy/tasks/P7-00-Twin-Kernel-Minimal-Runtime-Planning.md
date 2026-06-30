# docs/tasks/P7-00-Twin-Kernel-Minimal-Runtime-Planning.md

## Purpose

P7-00 opens P7 Twin Kernel Minimal Runtime as a new user-authorized stage after P6 completion.

P7 is not an automatic extension of P6. P7 is opened only because the user explicitly decided to design the next task line after P6 was completed and tagged.

The purpose of P7 is to move GEOX from a governance-closed execution boundary system toward a minimal, replayable, and calibratable agricultural digital twin kernel.

The P7 target is intentionally narrow: soil moisture twin v0. The first closed loop is Evidence Window → State Estimate → Prediction Run → Backtest Error Report → Calibration Report → Replay Experiment Bundle.

P7-00 itself is planning-only. P7-00 does not implement a twin runtime, package, CLI, API route, database schema, frontend, execution adapter, AO-ACT task, receipt write, audit write, Field Memory write, model update, or automatic learning.

## Gate

```text
P7_00_TWIN_KERNEL_MINIMAL_RUNTIME_PLANNING
```

## Entry conditions

```text
previous_stage: P6_EXECUTION_SYSTEM_INTEGRATION
previous_completion_gate: P6_07_EXECUTION_COMPLETION_REVIEW
previous_completion_commit: f7e8f88bc905b62f5f4a26ef2e049813763ac84d
previous_completion_tag: p6_execution_system_integration_completion
p6_completion_status: accepted_on_main_and_tagged
p7_opened_by_user_decision: true
p7_not_automatic_extension_of_p6: true
```

## P7 task sequence

```text
P7_00_TWIN_KERNEL_MINIMAL_RUNTIME_PLANNING
P7_01_TWIN_EVIDENCE_WINDOW_CONTRACT
P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0
P7_03_PREDICTION_RUN_V0
P7_04_BACKTEST_ERROR_REPORT_V0
P7_05_CALIBRATION_REPORT_V0
P7_06_REPLAY_EXPERIMENT_BUNDLE_V0
P7_07_TWIN_KERNEL_COMPLETION_REVIEW
```

## P7 capability targets

```text
evidence_window_contract
soil_moisture_state_estimate_v0
prediction_run_v0
backtest_error_report_v0
calibration_report_v0
replay_experiment_bundle_v0
```

## P7 data scope

```text
caf_sensor_data_allowed
existing_raw_samples_allowed
existing_evidence_refs_allowed
project_id_required
subject_ref_required
time_window_required
soil_moisture_metric_required
```

## P7 runtime boundary principles

```text
p7_runtime_must_be_read_only = true
p7_runtime_must_be_deterministic = true
p7_runtime_must_be_replayable = true
p7_runtime_must_preserve_evidence_refs = true
p7_runtime_must_preserve_trace_refs = true
p7_runtime_must_output_state_estimate = true
p7_runtime_must_output_prediction_run = true
p7_runtime_must_output_backtest_error_report = true
p7_runtime_must_output_calibration_report = true
p7_runtime_must_output_replay_bundle = true
p7_runtime_must_not_create_execution_authorization = true
p7_runtime_must_not_create_prescription = true
p7_runtime_must_not_write_field_memory = true
p7_runtime_must_not_update_model = true
```

## P7 non-goals

```text
automatic_irrigation_advice
automatic_prescription
automatic_execution
automatic_dispatch
ao_act_task_creation
receipt_creation
receipt_write
audit_write
field_memory_write
model_update
automatic_learning
profit_prediction
yield_prediction
roi_generation
frontend_authority
runtime_api_route
database_schema_or_migration
executor_service
machine_control
operator_authorization_change
p6_boundary_reinterpretation
unbounded_multi_crop_model
```

## P7 completion definition

```text
p7_complete_only_after_p7_07_accepted_on_main = true
p7_completion_tag_required_after_acceptance = true
p7_must_generate_evidence_window_contract = true
p7_must_generate_state_estimate = true
p7_must_generate_prediction_run = true
p7_must_generate_backtest_error_report = true
p7_must_generate_calibration_report = true
p7_must_generate_replay_experiment_bundle = true
p7_must_preserve_read_only_boundary = true
p7_must_preserve_no_execution_boundary = true
p7_must_preserve_no_field_memory_write = true
p7_must_preserve_no_model_update = true
```

## Proposed P7 runtime location

```text
packages/twin-kernel/
scripts/twin_kernel/
docs/tasks/
scripts/governance_acceptance/
```

These locations are proposed for later P7 implementation tasks. P7-00 does not create or modify runtime package directories.

## P7-01 handoff

```text
next_gate: P7_01_TWIN_EVIDENCE_WINDOW_CONTRACT
p7_01_must_define_evidence_window_contract = true
p7_01_must_use_existing_raw_samples_or_evidence_refs = true
p7_01_must_require_project_id = true
p7_01_must_require_subject_ref = true
p7_01_must_require_time_window = true
p7_01_must_require_metric_refs = true
p7_01_must_preserve_evidence_refs = true
p7_01_must_preserve_trace_refs = true
p7_01_must_not_create_state_estimate = true
p7_01_must_not_create_prediction_run = true
```

## Changed files allowed in P7-00

```text
docs/tasks/P7-00-Twin-Kernel-Minimal-Runtime-Planning.md
scripts/governance_acceptance/P7_00_TWIN_KERNEL_MINIMAL_RUNTIME_PLANNING.cjs
```

## Directories forbidden in P7-00

```text
apps/web/
apps/server/
apps/executor/
packages/twin-kernel/
packages/contracts/
packages/
db/
migrations/
scripts/twin_kernel/
scripts/demo_seed/
scripts/runtime/
```

## Boundary assertions

```text
p7_00_is_planning_only = true
p7_00_opens_p7_by_user_decision = true
p7_00_is_not_p6_extension = true
p7_00_changes_frontend = false
p7_00_changes_runtime = false
p7_00_changes_routes = false
p7_00_changes_db = false
p7_00_changes_scheduler = false
p7_00_changes_adapter = false
p7_00_changes_execution = false
p7_00_creates_twin_kernel_package = false
p7_00_creates_state_estimator = false
p7_00_creates_prediction_run = false
p7_00_creates_backtest_report = false
p7_00_creates_calibration_report = false
p7_00_creates_replay_bundle = false
p7_00_creates_dispatch_adapter = false
p7_00_creates_executor_service = false
p7_00_creates_ao_act_task = false
p7_00_creates_receipt_write = false
p7_00_creates_audit_write = false
p7_00_creates_machine_control = false
p7_00_creates_field_memory_write = false
p7_00_creates_model_update = false
p7_00_creates_automatic_learning = false
p7_00_creates_recommendation = false
p7_00_creates_prescription = false
p7_00_creates_profit_prediction = false
```

## Secondary review requirement

```text
secondary_review_required = true
secondary_review_must_refetch_created_files = true
secondary_review_must_verify_counts = true
secondary_review_must_verify_changed_files = true
secondary_review_must_verify_no_runtime_or_db_or_frontend_or_execution_change = true
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P7_00_TWIN_KERNEL_MINIMAL_RUNTIME_PLANNING.cjs
```

## Expected result

```text
ok = true
acceptance = P7_00_TWIN_KERNEL_MINIMAL_RUNTIME_PLANNING
p6_completion_tag_verified = true
p7_opened_by_user_decision = true
p7_task_sequence_count = 8
p7_capability_target_count = 6
p7_data_scope_count = 7
p7_runtime_boundary_principle_count = 14
p7_non_goal_count = 22
p7_completion_definition_count = 12
proposed_runtime_location_count = 4
p7_01_handoff_rule_count = 11
secondary_review_required = true
changed_file_count = 2
no_frontend_changed_by_this_task = true
no_runtime_changed_by_this_task = true
no_db_changed_by_this_task = true
no_execution_changed_by_this_task = true
next_step = P7_01_TWIN_EVIDENCE_WINDOW_CONTRACT
```

## Next step

```text
P7_01_TWIN_EVIDENCE_WINDOW_CONTRACT
```
