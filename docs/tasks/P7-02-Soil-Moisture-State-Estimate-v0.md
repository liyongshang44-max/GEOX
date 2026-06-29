# docs/tasks/P7-02-Soil-Moisture-State-Estimate-v0.md

## Purpose

P7-02 creates the first minimal Twin Kernel runtime output: a read-only soil moisture state estimate v0.

The purpose is to consume a P7-01 Twin Evidence Window Contract and produce a deterministic state estimate JSON object. This is the first P7 task that is allowed to output `state_estimate`. It is not allowed to output a prediction run, backtest report, calibration report, replay bundle, recommendation, prescription, Field Memory write, model update, AO-ACT task, dispatch, receipt, audit write, database write, or frontend authority.

P7-02 follows P7-01 Twin Evidence Window Contract. P7-02 must preserve evidence_window_ref, project_id, subject_ref, metric_refs, evidence_refs, trace_refs, provenance_ref, read-only behavior, and determinism hash.

P7-02 implements a minimal local Node CLI under `scripts/twin_kernel/`. The CLI reads a fixture evidence window JSON and prints a state estimate JSON to stdout. It does not connect to a database, write files, write facts, write Field Memory, update models, create execution objects, create API routes, or create frontend state.

## Gate

```text
P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0
```

## Entry conditions

```text
previous_gate: P7_01_TWIN_EVIDENCE_WINDOW_CONTRACT
previous_doc: docs/tasks/P7-01-Twin-Evidence-Window-Contract.md
previous_acceptance: scripts/governance_acceptance/P7_01_TWIN_EVIDENCE_WINDOW_CONTRACT.cjs
previous_commit: 71389510e1c10ca71c2ddaefa5548bc91879bfd5
p6_completion_tag: p6_execution_system_integration_completion
p7_01_status: accepted_on_main
p7_01_next_step: P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0
```

## Runtime files created in P7-02

```text
scripts/twin_kernel/P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0.cjs
scripts/twin_kernel/fixtures/P7_02_EVIDENCE_WINDOW_CAF009_SAMPLE.json
```

## State estimate output fields

```text
state_estimate_version
state_estimate_id
output_kind
project_id
subject_ref
sensor_ref
sensor_group_ref
as_of_ts
input_evidence_window_ref
metric_kind
unit
estimate_method
estimate_value
estimate_by_metric
sample_count
coverage_ratio
coverage_quality_label
uncertainty
confidence_basis
quality_flags
evidence_refs
trace_refs
provenance_ref
read_only
determinism_hash
```

## State estimate method rules

```text
method_must_be_latest_window_mean_by_metric_v0
method_must_use_soil_moisture_metric_refs_only
method_must_use_existing_evidence_window_samples
method_must_preserve_evidence_window_ref
method_must_preserve_evidence_refs
method_must_preserve_trace_refs
method_must_preserve_provenance_ref
method_must_output_uncertainty_from_coverage_and_dispersion
method_must_output_confidence_basis
method_must_be_deterministic
method_must_be_read_only
method_must_not_create_prediction_run
```

## Required state estimate validation gates

```text
p7_01_evidence_window_contract_present
input_evidence_window_ref_required
project_id_required
subject_ref_required
metric_kind_must_be_soil_moisture
metric_refs_required
samples_required
numeric_metric_values_required
as_of_ts_required
estimate_value_required
estimate_by_metric_required
uncertainty_required
confidence_basis_required
evidence_refs_required
trace_refs_required
provenance_ref_required
determinism_hash_required
read_only_required
no_prediction_run_created
no_runtime_db_or_frontend_change
no_execution_object_created
no_field_memory_write_created
no_model_update_created
```

## State estimate fail codes

```text
MISSING_P7_01_EVIDENCE_WINDOW_CONTRACT
MISSING_INPUT_EVIDENCE_WINDOW_REF
MISSING_PROJECT_ID
MISSING_SUBJECT_REF
METRIC_KIND_NOT_SOIL_MOISTURE
MISSING_METRIC_REFS
MISSING_SAMPLES
MISSING_NUMERIC_METRIC_VALUES
MISSING_AS_OF_TS
MISSING_ESTIMATE_VALUE
MISSING_ESTIMATE_BY_METRIC
MISSING_UNCERTAINTY
MISSING_CONFIDENCE_BASIS
MISSING_EVIDENCE_REFS
MISSING_TRACE_REFS
MISSING_PROVENANCE_REF
MISSING_DETERMINISM_HASH
READ_ONLY_FLAG_MISSING
PREDICTION_RUN_CREATED
RUNTIME_DB_OR_FRONTEND_CHANGE_PRESENT
EXECUTION_OBJECT_CREATED
FIELD_MEMORY_WRITE_CREATED
MODEL_UPDATE_CREATED
```

## State estimate result vocabulary

```text
PASS = state_estimate_generated_and_validated
BLOCK = state_estimate_generation_or_validation_failed
NOT_EVALUATED = treated_as_BLOCK
UNKNOWN = treated_as_BLOCK
```

## State estimate state vocabulary

```text
STATE_ESTIMATE_READY_FOR_PREDICTION_CONTRACT
STATE_ESTIMATE_BLOCKED_VALIDATION_FAILED
STATE_ESTIMATE_BLOCKED_NOT_EVALUATED
STATE_ESTIMATE_BLOCKED_UNKNOWN
STATE_ESTIMATE_BLOCKED_MISSING_EVIDENCE_WINDOW
STATE_ESTIMATE_BLOCKED_UNSUPPORTED_METRIC
STATE_ESTIMATE_BLOCKED_TRACEABILITY
STATE_ESTIMATE_BLOCKED_SIDE_EFFECT
```

## Allowed runtime side effects

```text
read_fixture_json
compute_metric_level_summary
compute_window_level_estimate
compute_uncertainty_summary
compute_determinism_hash
print_json_to_stdout
```

## Prohibited state estimate semantics

```text
prediction_run_from_state_estimate_v0
backtest_report_from_state_estimate_v0
calibration_report_from_state_estimate_v0
replay_bundle_from_state_estimate_v0
irrigation_advice_from_state_estimate_v0
recommendation_from_state_estimate_v0
prescription_from_state_estimate_v0
profit_prediction_from_state_estimate_v0
yield_prediction_from_state_estimate_v0
field_memory_write_from_state_estimate_v0
model_update_from_state_estimate_v0
automatic_learning_from_state_estimate_v0
ao_act_task_from_state_estimate_v0
dispatch_from_state_estimate_v0
receipt_write_from_state_estimate_v0
audit_write_from_state_estimate_v0
frontend_state_as_state_estimate_authority
evidence_rewrite_from_state_estimate_v0
trace_rewrite_from_state_estimate_v0
p8_or_later_expansion
```

## P7-03 handoff

```text
next_gate: P7_03_PREDICTION_RUN_V0
p7_03_must_use_state_estimate_ref = true
p7_03_must_preserve_input_evidence_window_ref = true
p7_03_must_preserve_project_id = true
p7_03_must_preserve_subject_ref = true
p7_03_must_preserve_metric_kind = true
p7_03_must_preserve_evidence_refs = true
p7_03_must_preserve_trace_refs = true
p7_03_must_output_prediction_run = true
p7_03_must_not_output_backtest_report = true
p7_03_must_not_write_field_memory = true
p7_03_must_not_update_model = true
p7_03_must_not_create_execution_object = true
```

## Changed files allowed in P7-02

```text
docs/tasks/P7-02-Soil-Moisture-State-Estimate-v0.md
scripts/governance_acceptance/P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0.cjs
scripts/twin_kernel/P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0.cjs
scripts/twin_kernel/fixtures/P7_02_EVIDENCE_WINDOW_CAF009_SAMPLE.json
```

## Directories forbidden in P7-02

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
p7_02_creates_state_estimate_runtime = true
p7_02_creates_fixture_input = true
p7_02_changes_frontend = false
p7_02_changes_server_runtime = false
p7_02_changes_routes = false
p7_02_changes_db = false
p7_02_changes_scheduler = false
p7_02_changes_adapter = false
p7_02_changes_execution = false
p7_02_creates_twin_kernel_package = false
p7_02_creates_prediction_run = false
p7_02_creates_backtest_report = false
p7_02_creates_calibration_report = false
p7_02_creates_replay_bundle = false
p7_02_creates_dispatch_adapter = false
p7_02_creates_executor_service = false
p7_02_creates_ao_act_task = false
p7_02_creates_receipt_write = false
p7_02_creates_audit_write = false
p7_02_creates_machine_control = false
p7_02_creates_field_memory_write = false
p7_02_creates_model_update = false
p7_02_creates_automatic_learning = false
p7_02_creates_recommendation = false
p7_02_creates_prescription = false
p7_02_creates_profit_prediction = false
p7_02_extends_to_p8_or_later = false
```

## Secondary review requirement

```text
secondary_review_required = true
secondary_review_must_refetch_created_files = true
secondary_review_must_run_state_estimate_runtime = true
secondary_review_must_verify_counts = true
secondary_review_must_verify_changed_files = true
secondary_review_must_verify_no_db_or_frontend_or_execution_change = true
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0.cjs
```

## Runtime command

```powershell
node scripts/twin_kernel/P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0.cjs
```

## Expected result

```text
ok = true
acceptance = P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0
p7_01_verified = true
p6_completion_tag_verified = true
state_estimate_runtime_verified = true
fixture_verified = true
state_estimate_output_field_count = 25
state_estimate_method_rule_count = 12
state_estimate_validation_gate_count = 23
state_estimate_fail_code_count = 23
state_estimate_result_vocabulary_count = 4
state_estimate_state_count = 8
allowed_runtime_side_effect_count = 6
prohibited_state_estimate_semantic_count = 20
p7_03_handoff_rule_count = 13
secondary_review_required = true
changed_file_count = 4
no_frontend_changed_by_this_task = true
no_server_runtime_changed_by_this_task = true
no_db_changed_by_this_task = true
no_execution_changed_by_this_task = true
next_step = P7_03_PREDICTION_RUN_V0
```

## Next step

```text
P7_03_PREDICTION_RUN_V0
```

