# docs/tasks/P5-01-Field-Memory-Eligibility-Source-Boundary.md

## Purpose

P5-01 freezes the source boundary for Field Memory eligibility.

The purpose is not to write Field Memory. The purpose is to define which source refs may be used to evaluate whether material is eligible to become a later Field Memory candidate, and which source refs must be blocked before any formalization policy can consider them.

P5-01 follows P5-00 Policy-Controlled Field Memory Governance Planning. P5-01 must preserve the P5-00 governance-only boundary, the P4 completion gate, the P4 completion tag, the P5 task sequence, and the deferred-to-P6 boundary.

P5-01 does not implement runtime routes, read models, frontend display, database schema, scheduler behavior, adapter behavior, execution integration, recommendation logic, priority scoring, prescription logic, profit prediction, AO-ACT task creation, receipt creation, Field Memory write, model update, automatic learning, or automatic formalization.

## Gate

```text
P5_01_FIELD_MEMORY_ELIGIBILITY_SOURCE_BOUNDARY
```

## Entry conditions

```text
previous_gate: P5_00_POLICY_CONTROLLED_FIELD_MEMORY_GOVERNANCE_PLANNING
previous_doc: docs/legacy/tasks/P5-00-Policy-Controlled-Field-Memory-Governance-Planning.md
previous_acceptance: scripts/governance_acceptance/P5_00_POLICY_CONTROLLED_FIELD_MEMORY_GOVERNANCE_PLANNING.cjs
previous_commit: 40ad9d333050b7aae874228c3af414de4a988317
p4_completion_tag: p4_policy_controlled_roi_completion_before_p5
p5_00_status: accepted_on_main
p5_00_next_step: P5_01_FIELD_MEMORY_ELIGIBILITY_SOURCE_BOUNDARY
```

## Eligibility source boundary principle

```text
field_memory_eligibility_source_must_be_traceable = true
field_memory_eligibility_source_must_be_evidence_backed = true
field_memory_eligibility_source_must_preserve_provenance = true
field_memory_eligibility_source_must_preserve_scope = true
field_memory_eligibility_source_must_preserve_operator_gate = true
field_memory_eligibility_source_must_not_rewrite_evidence = true
field_memory_eligibility_source_must_not_rewrite_trace = true
field_memory_eligibility_source_must_not_create_memory_write = true
field_memory_eligibility_source_must_not_create_model_update = true
field_memory_eligibility_source_must_not_create_execution_trigger = true
```

## Allowed eligibility source ref kinds

```text
evidence_ref
trace_ref
provenance_ref
source_schema_compatibility_ref
policy_gate_result_ref
operator_explicit_input_ref
operator_formalization_action_ref
p4_roi_output_ref
system_derived_candidate_ref
```

## Allowed source conditions

```text
evidence_ref requires immutable_or_pointer_based_source = true
evidence_ref requires evidence_refs_present = true
evidence_ref requires provenance_present = true
trace_ref requires trace_refs_present = true
trace_ref requires trace_readback_available = true
provenance_ref requires actor_or_system_origin_present = true
provenance_ref requires tenant_project_field_scope_present = true
source_schema_compatibility_ref requires source_schema_version_present = true
source_schema_compatibility_ref requires compatibility_result_present = true
policy_gate_result_ref requires fail_closed_policy_result_present = true
operator_explicit_input_ref requires explicit_operator_action_ref = true
operator_explicit_input_ref requires audit_provenance_present = true
operator_formalization_action_ref requires explicit_operator_formalization = true
p4_roi_output_ref requires read_only_policy_controlled_output = true
p4_roi_output_ref requires no_direct_field_memory_write = true
system_derived_candidate_ref requires upstream_trace_refs_present = true
system_derived_candidate_ref requires upstream_evidence_refs_present = true
system_derived_candidate_ref requires upstream_provenance_present = true
```

## Allowed system-derived candidate refs

```text
field_state_snapshot_v1
forecast_run_v1
forecast_error_v1
calibration_replay_v1
scenario_set_v1
operator_decision_review_v0
operator_formalization_action_v0
roi_policy_gate_result_v1
roi_block_result_v1
production_ingestion_event_v0
decision_cycle_v1
```

## Context-only refs

```text
operator_review_ref = context_only_not_memory_source
operator_gate_ref = context_only_not_memory_source
p4_roi_view_ref = context_only_not_memory_source
existing_field_memory_ref = context_only_not_recursive_memory_source
retention_policy_ref = context_only_not_memory_source
suppression_policy_ref = context_only_not_memory_source
```

## Deferred refs

```text
ao_act_task_ref = deferred_to_P6_not_allowed_as_P5_eligibility_source
receipt_ref = deferred_to_P6_not_allowed_as_P5_eligibility_source
execution_audit_ref = deferred_to_P6_not_allowed_as_P5_eligibility_source
executor_feedback_ref = deferred_to_P6_not_allowed_as_P5_eligibility_source
machine_control_ref = deferred_to_P6_not_allowed_as_P5_eligibility_source
```

## Forbidden eligibility source ref kinds

```text
untraceable_manual_memory_claim
recommendation_ref
priority_score_ref
success_prediction_ref
profit_prediction_ref
prescription_ref
execution_trigger_ref
ao_act_task_ref
receipt_ref
execution_audit_ref
executor_feedback_ref
machine_control_ref
model_update_ref
automatic_learning_ref
frontend_state_ref
dashboard_metric_ref
free_text_summary_ref
unverified_causal_explanation_ref
evidence_rewrite_ref
trace_rewrite_ref
operator_gate_bypass_ref
```

## Forbidden eligibility semantics

```text
recommendation
priority_score
success_prediction
profit_prediction
prescription
execution_trigger
ao_act_task_payload
receipt_payload
field_memory_write_payload
model_update_payload
automatic_learning_payload
automatic_formalization_marker
evidence_rewrite_payload
trace_rewrite_payload
unbounded_source_summary
operator_gate_bypass
untraceable_memory_claim
```

## Eligibility source decision matrix

```text
traceable_evidence_backed_source_ref = allowed
traceable_policy_gate_result_ref = allowed
traceable_operator_explicit_input_ref = allowed
traceable_operator_formalization_action_ref = allowed
read_only_p4_roi_output_ref = allowed
system_derived_candidate_with_upstream_refs = allowed
operator_review_ref = context_only
operator_gate_ref = context_only
existing_field_memory_ref = context_only
retention_policy_ref = context_only
suppression_policy_ref = context_only
ao_act_task_ref = blocked_until_P6
receipt_ref = blocked_until_P6
execution_audit_ref = blocked_until_P6
executor_feedback_ref = blocked_until_P6
machine_control_ref = blocked_until_P6
recommendation_ref = blocked
priority_score_ref = blocked
success_prediction_ref = blocked
profit_prediction_ref = blocked
prescription_ref = blocked
model_update_ref = blocked
automatic_learning_ref = blocked
untraceable_manual_memory_claim = blocked
```

## Eligibility source record contract

```text
ref_kind
ref_id
object_type
scope_ref
occurred_at_or_created_at
source_schema_version_or_contract_ref
evidence_refs
trace_refs
provenance_ref
operator_gate_ref
eligibility_boundary_result
derivation_role
```

The source record contract is planning-only. P5-01 does not create a package type, database table, API response, frontend model, read model, or write path.

## P5-02 handoff

```text
next_gate: P5_02_FIELD_MEMORY_POLICY_GATE_CONTRACT
p5_02_must_use_allowed_eligibility_source_ref_kinds = true
p5_02_must_use_forbidden_eligibility_source_ref_kinds = true
p5_02_must_block_untraceable_manual_memory_claim = true
p5_02_must_block_recommendation_ref = true
p5_02_must_block_priority_score_ref = true
p5_02_must_block_success_prediction_ref = true
p5_02_must_block_profit_prediction_ref = true
p5_02_must_block_prescription_ref = true
p5_02_must_block_model_update_ref = true
p5_02_must_block_automatic_learning_ref = true
p5_02_must_block_execution_refs_until_P6 = true
```

## Changed files allowed in P5-01

```text
docs/tasks/P5-01-Field-Memory-Eligibility-Source-Boundary.md
scripts/governance_acceptance/P5_01_FIELD_MEMORY_ELIGIBILITY_SOURCE_BOUNDARY.cjs
```

## Directories forbidden in P5-01

```text
apps/web/
apps/server/
apps/executor/
packages/contracts/
packages/
db/
migrations/
scripts/demo_seed/
scripts/runtime/
```

## Boundary assertions

```text
p5_01_is_governance_only = true
p5_01_changes_frontend = false
p5_01_changes_runtime = false
p5_01_changes_routes = false
p5_01_changes_db = false
p5_01_changes_scheduler = false
p5_01_changes_adapter = false
p5_01_changes_execution = false
p5_01_creates_field_memory_write_path = false
p5_01_creates_field_memory_read_model = false
p5_01_creates_model_update = false
p5_01_creates_automatic_learning = false
p5_01_creates_recommendation = false
p5_01_creates_priority_score = false
p5_01_creates_profit_prediction = false
p5_01_creates_prescription = false
p5_01_creates_ao_act_task = false
p5_01_creates_receipt = false
p5_01_extends_to_p6 = false
p5_01_extends_to_p7_or_later = false
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
node scripts/governance_acceptance/P5_01_FIELD_MEMORY_ELIGIBILITY_SOURCE_BOUNDARY.cjs
```

## Expected result

```text
ok = true
acceptance = P5_01_FIELD_MEMORY_ELIGIBILITY_SOURCE_BOUNDARY
p5_00_verified = true
p4_completion_tag_verified = true
allowed_eligibility_source_ref_kind_count = 9
allowed_source_condition_count = 18
allowed_system_derived_candidate_ref_count = 11
context_only_ref_count = 6
deferred_ref_count = 5
forbidden_eligibility_source_ref_kind_count = 21
forbidden_eligibility_semantic_count = 17
decision_matrix_row_count = 24
eligibility_source_record_field_count = 12
secondary_review_required = true
changed_file_count = 2
no_frontend_changed_by_this_task = true
no_runtime_changed_by_this_task = true
no_db_changed_by_this_task = true
no_execution_changed_by_this_task = true
next_step = P5_02_FIELD_MEMORY_POLICY_GATE_CONTRACT
```

## Next step

```text
P5_02_FIELD_MEMORY_POLICY_GATE_CONTRACT
```
