# docs/tasks/P7-01-Twin-Evidence-Window-Contract.md

## Purpose

P7-01 freezes the Twin Evidence Window Contract for P7 Twin Kernel Minimal Runtime.

The purpose is not to estimate field state. The purpose is to define the read-only, replayable, deterministic input window that later P7 tasks may use to produce a soil moisture state estimate, prediction run, backtest error report, calibration report, and replay experiment bundle.

P7-01 follows P7-00 Twin Kernel Minimal Runtime Planning. P7-01 must preserve the P7 narrow target: soil moisture twin v0. P7-01 must use existing raw samples or evidence refs, require project and subject scope, require a time window, require metric refs, preserve evidence refs and trace refs, and avoid state estimate or prediction creation.

P7-01 does not implement a twin runtime package, CLI, API route, database schema, frontend, execution adapter, state estimator, prediction run, backtest report, calibration report, replay bundle, AO-ACT task, receipt write, audit write, Field Memory write, model update, or automatic learning.

## Gate

```text
P7_01_TWIN_EVIDENCE_WINDOW_CONTRACT
```

## Entry conditions

```text
previous_gate: P7_00_TWIN_KERNEL_MINIMAL_RUNTIME_PLANNING
previous_doc: docs/legacy/tasks/P7-00-Twin-Kernel-Minimal-Runtime-Planning.md
previous_acceptance: scripts/governance_acceptance/P7_00_TWIN_KERNEL_MINIMAL_RUNTIME_PLANNING.cjs
previous_commit: e3a50dfde49635f4f65a8841b839f691bf5fc710
p6_completion_tag: p6_execution_system_integration_completion
p7_00_status: accepted_on_main
p7_00_next_step: P7_01_TWIN_EVIDENCE_WINDOW_CONTRACT
```

## Evidence window principles

```text
evidence_window_must_be_read_only = true
evidence_window_must_be_replayable = true
evidence_window_must_be_deterministic = true
evidence_window_must_preserve_project_id = true
evidence_window_must_preserve_subject_ref = true
evidence_window_must_preserve_time_window = true
evidence_window_must_preserve_metric_refs = true
evidence_window_must_preserve_sample_refs = true
evidence_window_must_preserve_evidence_refs = true
evidence_window_must_preserve_trace_refs = true
evidence_window_must_include_coverage_summary = true
evidence_window_must_include_gap_summary = true
evidence_window_must_include_determinism_hash = true
evidence_window_must_not_create_state_estimate = true
evidence_window_must_not_create_prediction_run = true
```

## Allowed evidence source kinds

```text
raw_sample_ref
raw_sample_window_ref
sensor_metric_ref
sensor_group_ref
fact_ref
evidence_ref
trace_ref
provenance_ref
```

## Evidence window contract fields

```text
evidence_window_contract_version
evidence_window_id
project_id
subject_ref
sensor_ref
sensor_group_ref
metric_refs
metric_kind
unit
window_start_ts
window_end_ts
expected_interval_ms
observed_interval_summary
sample_count
expected_sample_count
coverage_ratio
gap_summary
quality_flags
source_ref_kind
source_ref_ids
evidence_refs
trace_refs
provenance_ref
determinism_hash
```

These are contract fields, not a database schema, API response schema, package type, runtime object, or frontend model. P7-01 does not create or modify runtime implementation paths.

## Required evidence window validation gates

```text
project_id_required
subject_ref_required
window_start_required
window_end_required
window_order_valid
metric_refs_required
soil_moisture_metric_present
source_ref_kind_allowed
source_ref_ids_required
sample_count_required
expected_sample_count_required
expected_interval_ms_required
coverage_ratio_required
coverage_ratio_bounded
observed_interval_summary_required
gap_summary_required
evidence_refs_required
trace_refs_required
provenance_ref_required
determinism_hash_required
read_only_boundary_preserved
no_state_estimate_created
no_prediction_run_created
no_runtime_or_db_or_frontend_change
```

## Evidence window fail codes

```text
MISSING_PROJECT_ID
MISSING_SUBJECT_REF
MISSING_WINDOW_START
MISSING_WINDOW_END
INVALID_WINDOW_ORDER
MISSING_METRIC_REFS
SOIL_MOISTURE_METRIC_MISSING
SOURCE_REF_KIND_NOT_ALLOWED
MISSING_SOURCE_REF_IDS
MISSING_SAMPLE_COUNT
MISSING_EXPECTED_SAMPLE_COUNT
MISSING_EXPECTED_INTERVAL_MS
MISSING_COVERAGE_RATIO
COVERAGE_RATIO_OUT_OF_RANGE
MISSING_OBSERVED_INTERVAL_SUMMARY
MISSING_GAP_SUMMARY
MISSING_EVIDENCE_REFS
MISSING_TRACE_REFS
MISSING_PROVENANCE_REF
MISSING_DETERMINISM_HASH
READ_ONLY_BOUNDARY_VIOLATED
STATE_ESTIMATE_CREATED
PREDICTION_RUN_CREATED
RUNTIME_OR_DB_OR_FRONTEND_CHANGE_PRESENT
```

## Coverage summary fields

```text
sample_count
expected_sample_count
coverage_ratio
missing_sample_count
max_gap_ms
gap_count
observed_interval_min_ms
observed_interval_max_ms
observed_interval_median_ms
coverage_quality_label
```

## Evidence window result vocabulary

```text
PASS = all_required_evidence_window_gates_passed
BLOCK = one_or_more_required_evidence_window_gates_failed
NOT_EVALUATED = treated_as_BLOCK
UNKNOWN = treated_as_BLOCK
```

## Evidence window state vocabulary

```text
EVIDENCE_WINDOW_READY_FOR_STATE_ESTIMATE_CONTRACT
EVIDENCE_WINDOW_BLOCKED_VALIDATION_FAILED
EVIDENCE_WINDOW_BLOCKED_NOT_EVALUATED
EVIDENCE_WINDOW_BLOCKED_UNKNOWN
EVIDENCE_WINDOW_BLOCKED_MISSING_SCOPE
EVIDENCE_WINDOW_BLOCKED_COVERAGE
EVIDENCE_WINDOW_BLOCKED_TRACEABILITY
EVIDENCE_WINDOW_BLOCKED_SIDE_EFFECT
```

## Boundary rules

```text
evidence_window_may_reference_existing_raw_samples = true
evidence_window_may_reference_existing_facts = true
evidence_window_may_reference_existing_evidence_refs = true
evidence_window_may_reference_existing_trace_refs = true
evidence_window_may_compute_coverage_summary = true
evidence_window_may_compute_gap_summary = true
evidence_window_may_compute_determinism_hash = true
evidence_window_must_not_write_facts = true
evidence_window_must_not_write_db = true
evidence_window_must_not_write_field_memory = true
evidence_window_must_not_update_model = true
evidence_window_must_not_generate_recommendation = true
evidence_window_must_not_generate_prescription = true
evidence_window_must_not_create_execution_object = true
```

## Prohibited evidence window semantics

```text
state_estimate_from_evidence_window_contract
prediction_run_from_evidence_window_contract
backtest_report_from_evidence_window_contract
calibration_report_from_evidence_window_contract
replay_bundle_from_evidence_window_contract
field_memory_write_from_evidence_window
model_update_from_evidence_window
automatic_learning_from_evidence_window
recommendation_from_evidence_window
prescription_from_evidence_window
profit_prediction_from_evidence_window
yield_prediction_from_evidence_window
ao_act_task_from_evidence_window
dispatch_from_evidence_window
receipt_write_from_evidence_window
audit_write_from_evidence_window
frontend_state_as_evidence_window_authority
evidence_rewrite_from_evidence_window
trace_rewrite_from_evidence_window
p8_or_later_expansion
```

## P7-02 handoff

```text
next_gate: P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0
p7_02_must_use_evidence_window_contract = true
p7_02_must_preserve_evidence_window_ref = true
p7_02_must_preserve_project_id = true
p7_02_must_preserve_subject_ref = true
p7_02_must_preserve_metric_refs = true
p7_02_must_preserve_evidence_refs = true
p7_02_must_preserve_trace_refs = true
p7_02_must_output_state_estimate = true
p7_02_must_not_output_prediction_run = true
p7_02_must_not_write_field_memory = true
p7_02_must_not_update_model = true
p7_02_must_not_create_execution_object = true
```

## Changed files allowed in P7-01

```text
docs/tasks/P7-01-Twin-Evidence-Window-Contract.md
scripts/governance_acceptance/P7_01_TWIN_EVIDENCE_WINDOW_CONTRACT.cjs
```

## Directories forbidden in P7-01

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
p7_01_is_governance_contract_only = true
p7_01_changes_frontend = false
p7_01_changes_runtime = false
p7_01_changes_routes = false
p7_01_changes_db = false
p7_01_changes_scheduler = false
p7_01_changes_adapter = false
p7_01_changes_execution = false
p7_01_creates_twin_kernel_package = false
p7_01_creates_state_estimator = false
p7_01_creates_prediction_run = false
p7_01_creates_backtest_report = false
p7_01_creates_calibration_report = false
p7_01_creates_replay_bundle = false
p7_01_creates_dispatch_adapter = false
p7_01_creates_executor_service = false
p7_01_creates_ao_act_task = false
p7_01_creates_receipt_write = false
p7_01_creates_audit_write = false
p7_01_creates_machine_control = false
p7_01_creates_field_memory_write = false
p7_01_creates_model_update = false
p7_01_creates_automatic_learning = false
p7_01_creates_recommendation = false
p7_01_creates_prescription = false
p7_01_creates_profit_prediction = false
p7_01_extends_to_p8_or_later = false
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
node scripts/governance_acceptance/P7_01_TWIN_EVIDENCE_WINDOW_CONTRACT.cjs
```

## Expected result

```text
ok = true
acceptance = P7_01_TWIN_EVIDENCE_WINDOW_CONTRACT
p7_00_verified = true
p6_completion_tag_verified = true
evidence_window_principle_count = 15
allowed_evidence_source_kind_count = 8
evidence_window_contract_field_count = 24
evidence_window_validation_gate_count = 24
evidence_window_fail_code_count = 24
coverage_summary_field_count = 10
evidence_window_result_vocabulary_count = 4
evidence_window_state_count = 8
boundary_rule_count = 14
prohibited_evidence_window_semantic_count = 20
p7_02_handoff_rule_count = 13
secondary_review_required = true
changed_file_count = 2
no_frontend_changed_by_this_task = true
no_runtime_changed_by_this_task = true
no_db_changed_by_this_task = true
no_execution_changed_by_this_task = true
next_step = P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0
```

## Next step

```text
P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0
```
