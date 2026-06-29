# docs/tasks/P6-01-Execution-Source-Boundary.md

## Purpose

P6-01 freezes the source boundary for Execution System Integration.

The purpose is not to dispatch work. The purpose is to define which refs may be considered execution sources, which refs may be used only as context, which refs must be blocked, and which minimum record fields must be present before P6 authorization gates can evaluate an execution source.

P6-01 follows P6-00 Execution System Integration Planning. P6-01 must preserve the P6-00 planning-only boundary, the P5 completion tag entry proof, the P6 task sequence, the no-P7 boundary, and the prohibition on automatic dispatch.

P6-01 does not implement runtime routes, dispatch adapters, executor services, frontend display, database schema, scheduler behavior, machine control, AO-ACT task creation, receipt creation, execution audit write, recommendation logic, priority scoring, prescription logic, profit prediction, Field Memory write, model update, automatic learning, or automatic formalization.

## Gate

```text
P6_01_EXECUTION_SOURCE_BOUNDARY
```

## Entry conditions

```text
previous_gate: P6_00_EXECUTION_SYSTEM_INTEGRATION_PLANNING
previous_doc: docs/tasks/P6-00-Execution-System-Integration-Planning.md
previous_acceptance: scripts/governance_acceptance/P6_00_EXECUTION_SYSTEM_INTEGRATION_PLANNING.cjs
previous_commit: 11c61eee14b7e84c9eea79ae2339ec5ff6bf17b8
p5_completion_tag: p5_policy_controlled_field_memory_governance_completion_before_p6
p6_00_status: accepted_on_main
p6_00_next_step: P6_01_EXECUTION_SOURCE_BOUNDARY
```

## Execution source boundary principle

```text
execution_source_must_be_explicitly_authorized = true
execution_source_must_be_traceable = true
execution_source_must_be_evidence_backed = true
execution_source_must_preserve_provenance = true
execution_source_must_preserve_scope = true
execution_source_must_preserve_operator_authorization = true
execution_source_must_preserve_executor_identity = true
execution_source_must_not_rewrite_evidence = true
execution_source_must_not_rewrite_trace = true
execution_source_must_not_create_dispatch = true
execution_source_must_not_create_ao_act_task = true
execution_source_must_not_create_receipt = true
execution_source_must_not_create_execution_audit_write = true
```

## Allowed execution source ref kinds

```text
operator_authorization_ref
authorized_ao_act_task_ref
execution_request_ref
execution_scope_ref
executor_identity_ref
dispatch_policy_ref
authorization_gate_result_ref
evidence_ref
trace_ref
provenance_ref
```

## Allowed source conditions

```text
operator_authorization_ref requires explicit_operator_approval = true
operator_authorization_ref requires authorization_timestamp = true
operator_authorization_ref requires scope_ref_present = true
authorized_ao_act_task_ref requires pre_existing_task_ref = true
authorized_ao_act_task_ref requires no_task_creation_in_P6_01 = true
execution_request_ref requires operator_authorization_ref_present = true
execution_request_ref requires execution_scope_ref_present = true
execution_scope_ref requires field_or_area_or_path_ref = true
execution_scope_ref requires scope_boundary_result_present = true
executor_identity_ref requires executor_id_present = true
executor_identity_ref requires executor_type_present = true
dispatch_policy_ref requires dispatch_policy_contract_ref = true
dispatch_policy_ref requires no_dispatch_side_effect = true
authorization_gate_result_ref requires fail_closed_result_present = true
authorization_gate_result_ref requires no_bypass_flag = true
evidence_ref requires evidence_refs_present = true
trace_ref requires trace_refs_present = true
provenance_ref requires provenance_present = true
provenance_ref requires actor_or_system_origin_present = true
provenance_ref requires source_schema_version_present = true
```

## Context-only refs

```text
p5_completion_tag_ref = context_only_entry_proof_not_execution_source
field_memory_ref = context_only_not_execution_authorization
formalization_output_ref = context_only_not_execution_authorization
roi_output_ref = context_only_not_execution_authorization
dashboard_view_ref = context_only_not_execution_authorization
frontend_state_ref = context_only_not_authority
business_closure_ref = context_only_not_execution_authorization
```

## Deferred refs

```text
dispatch_output_ref = deferred_to_P6_03_not_allowed_as_P6_01_source
receipt_ref = deferred_to_P6_04_not_allowed_as_P6_01_source
execution_audit_trace_ref = deferred_to_P6_05_not_allowed_as_P6_01_source
machine_control_ref = deferred_until_authorized_dispatch_not_allowed_as_P6_01_source
```

## Forbidden execution source ref kinds

```text
recommendation_ref
priority_score_ref
prescription_ref
profit_prediction_ref
success_prediction_ref
field_memory_ref
formalization_output_ref
frontend_state_ref
dashboard_metric_ref
automatic_dispatch_ref
automatic_ao_act_task_ref
automatic_receipt_ref
unauthorized_ao_act_task_ref
machine_control_ref
receipt_ref
execution_audit_rewrite_ref
executor_identity_bypass_ref
untraceable_manual_command
evidence_rewrite_ref
trace_rewrite_ref
p7_or_later_ref
```

## Forbidden execution source semantics

```text
recommendation_as_authorization
priority_score_as_authorization
prescription_as_authorization
profit_prediction_as_authorization
success_prediction_as_authorization
field_memory_as_authorization
formalization_output_as_authorization
frontend_state_as_authorization
dashboard_metric_as_authorization
automatic_dispatch
automatic_ao_act_task_creation
automatic_receipt_creation
machine_control_without_authorization
executor_identity_bypass
receipt_as_execution_source
audit_trace_rewrite
evidence_rewrite
trace_rewrite
unbounded_source_summary
```

## Execution source record contract

```text
ref_kind
ref_id
object_type
scope_ref
occurred_at_or_created_at
source_schema_version_or_contract_ref
operator_authorization_ref
executor_identity_ref
evidence_refs
trace_refs
provenance_ref
authorization_boundary_result
source_boundary_result
```

The source record contract is planning-only. P6-01 does not create a package type, database table, API response, frontend model, read model, dispatch payload, AO-ACT task, receipt, execution audit trace, or write path.

## P6-02 handoff

```text
next_gate: P6_02_EXECUTION_AUTHORIZATION_GATE_CONTRACT
p6_02_must_use_allowed_execution_source_ref_kinds = true
p6_02_must_block_forbidden_execution_source_ref_kinds = true
p6_02_must_treat_context_only_refs_as_non_authority = true
p6_02_must_block_deferred_refs_as_sources = true
p6_02_must_preserve_operator_authorization = true
p6_02_must_preserve_executor_identity = true
p6_02_must_not_create_dispatch = true
p6_02_must_not_create_ao_act_task = true
p6_02_must_not_create_receipt = true
```

## Changed files allowed in P6-01

```text
docs/tasks/P6-01-Execution-Source-Boundary.md
scripts/governance_acceptance/P6_01_EXECUTION_SOURCE_BOUNDARY.cjs
```

## Directories forbidden in P6-01

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
p6_01_is_governance_only = true
p6_01_changes_frontend = false
p6_01_changes_runtime = false
p6_01_changes_routes = false
p6_01_changes_db = false
p6_01_changes_scheduler = false
p6_01_changes_adapter = false
p6_01_changes_execution = false
p6_01_creates_dispatch_adapter = false
p6_01_creates_executor_service = false
p6_01_creates_ao_act_task = false
p6_01_creates_receipt = false
p6_01_creates_execution_audit_write = false
p6_01_creates_machine_control = false
p6_01_creates_field_memory_write = false
p6_01_creates_model_update = false
p6_01_creates_automatic_learning = false
p6_01_creates_recommendation = false
p6_01_creates_priority_score = false
p6_01_creates_profit_prediction = false
p6_01_creates_prescription = false
p6_01_extends_to_p7_or_later = false
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
node scripts/governance_acceptance/P6_01_EXECUTION_SOURCE_BOUNDARY.cjs
```

## Expected result

```text
ok = true
acceptance = P6_01_EXECUTION_SOURCE_BOUNDARY
p6_00_verified = true
p5_completion_tag_verified = true
allowed_execution_source_ref_kind_count = 10
allowed_source_condition_count = 20
context_only_ref_count = 7
deferred_ref_count = 4
forbidden_execution_source_ref_kind_count = 21
forbidden_execution_semantic_count = 19
execution_source_record_field_count = 13
p6_02_handoff_rule_count = 9
secondary_review_required = true
changed_file_count = 2
no_frontend_changed_by_this_task = true
no_runtime_changed_by_this_task = true
no_db_changed_by_this_task = true
no_execution_changed_by_this_task = true
next_step = P6_02_EXECUTION_AUTHORIZATION_GATE_CONTRACT
```

## Next step

```text
P6_02_EXECUTION_AUTHORIZATION_GATE_CONTRACT
```
