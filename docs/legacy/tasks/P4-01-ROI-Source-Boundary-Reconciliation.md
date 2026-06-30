# docs/tasks/P4-01-ROI-Source-Boundary-Reconciliation.md

## Purpose

P4-01 freezes the source boundary for Policy-Controlled ROI.

The purpose is not to calculate ROI. The purpose is to define which source refs may be used by a future ROI policy gate and which source refs must be blocked before any ROI output can be considered traceable, evidence-backed, and policy-controlled.

P4-01 continues the P4 planning sequence after P4-00. It does not implement runtime routes, read models, frontend surfaces, database schema, scheduler behavior, adapters, execution integration, recommendation logic, priority scoring, prescription logic, profit prediction, AO-ACT tasks, receipts, Field Memory writes, or automatic formalization.

## Gate

```text
P4_01_ROI_SOURCE_BOUNDARY_RECONCILIATION
```

## Entry conditions

```text
previous_gate: P4_POLICY_CONTROLLED_ROI_PLANNING
previous_doc: docs/legacy/tasks/P4-Policy-Controlled-ROI-Planning.md
previous_acceptance: scripts/governance_acceptance/P4_POLICY_CONTROLLED_ROI_PLANNING.cjs
previous_commit: 7fb55a690cfff90ef81a9f62e45809552cd38cba
p4_00_status: accepted_on_main
p4_00_next_step: P4_01_ROI_SOURCE_BOUNDARY_RECONCILIATION
```

## Source boundary principle

```text
roi_source_must_be_traceable = true
roi_source_must_be_evidence_backed = true
roi_source_must_be_system_derived_or_explicitly_audited = true
roi_source_must_preserve_scope = true
roi_source_must_preserve_provenance = true
roi_source_must_preserve_trace_refs = true
roi_source_must_preserve_evidence_refs = true
roi_source_must_not_rewrite_evidence = true
roi_source_must_not_rewrite_trace = true
roi_source_must_not_create_business_semantics = true
```

## Allowed ROI source ref kinds

```text
evidence_ref
trace_ref
provenance_ref
source_schema_compatibility_ref
system_derived_object_ref
operator_explicit_input_ref
operator_formalization_action_ref
```

These are ref kinds, not a runtime schema. P4-01 freezes the policy boundary. Later P4 tasks may convert this boundary into a contract or runtime gate only if that later task explicitly authorizes implementation.

## Allowed source ref conditions

```text
evidence_ref requires immutable_or_pointer_based_source = true
evidence_ref requires evidence_refs_present = true
evidence_ref requires provenance_present = true
evidence_ref requires scope_present = true
trace_ref requires trace_refs_present = true
trace_ref requires trace_readback_available = true
provenance_ref requires actor_or_system_origin_present = true
provenance_ref requires tenant_project_field_scope_present = true
source_schema_compatibility_ref requires source_schema_version_present = true
source_schema_compatibility_ref requires compatibility_result_present = true
system_derived_object_ref requires upstream_trace_refs_present = true
system_derived_object_ref requires upstream_evidence_refs_present = true
operator_explicit_input_ref requires explicit_operator_action_ref = true
operator_explicit_input_ref requires audit_provenance_present = true
operator_explicit_input_ref requires no_hidden_assumption = true
operator_formalization_action_ref requires explicit_operator_formalization = true
operator_formalization_action_ref requires read_only_reference = true
```

## Allowed system-derived object refs

```text
field_state_snapshot_v1
forecast_run_v1
scenario_set_v1
calibration_replay_v1
forecast_error_v1
field_learning_candidate_v1
decision_cycle_v1
production_ingestion_event_v0
operator_session_v0
operator_decision_review_v0
operator_formalization_action_v0
```

These objects may be referenced only when they retain scope, evidence refs, trace refs, and provenance. They do not become ROI semantics by themselves.

## Context-only refs

```text
operator_gate_ref = context_only_not_value_source
operator_review_ref = context_only_not_value_source
existing_roi_entry_ref = context_only_not_recursive_roi_source
business_closure_ref = context_only_not_value_source
```

Context-only refs may help identify where an ROI policy decision sits in the operator workflow. They must not be used as independent numerical ROI source inputs unless a later P4 policy gate explicitly permits that usage.

## Deferred refs

```text
field_memory_ref = deferred_to_P5_not_allowed_as_P4_ROI_source
receipt_ref = deferred_to_P6_not_allowed_as_P4_ROI_source
ao_act_task_ref = deferred_to_P6_not_allowed_as_P4_ROI_source
execution_audit_ref = deferred_to_P6_not_allowed_as_P4_ROI_source
```

P4-01 must not decide P5 Field Memory Governance or P6 Execution System Integration. These refs remain blocked as ROI sources during P4 source reconciliation.

## Forbidden ROI source ref kinds

```text
untraceable_manual_claim
hidden_profit_assumption
recommendation_ref
priority_score_ref
success_prediction_ref
production_operation_claim_ref
prescription_ref
execution_trigger_ref
ao_act_task_ref
receipt_ref
field_memory_ref
dashboard_metric_ref
frontend_state_ref
free_text_summary_ref
unverified_causal_explanation_ref
model_update_ref
autonomous_policy_promotion_ref
```

## Forbidden semantics

```text
recommendation
priority_score
success_prediction
profit_prediction
hidden_profit_assumption
prescription
execution_trigger
automatic_formal_roi
automatic_field_memory_write
automatic_ao_act_task_creation
automatic_receipt_creation
evidence_rewrite
trace_rewrite
unbounded_source_dependency
operator_gate_bypass
```

## Source decision matrix

```text
traceable_evidence_backed_system_derived_ref = allowed
traceable_evidence_backed_explicit_operator_input_ref = allowed
schema_compatible_raw_or_pointer_evidence_ref = allowed
context_only_operator_workflow_ref = context_only
existing_roi_entry_ref = context_only
field_memory_ref = blocked_until_P5
receipt_ref = blocked_until_P6
ao_act_task_ref = blocked_until_P6
recommendation_ref = blocked
priority_score_ref = blocked
success_prediction_ref = blocked
production_operation_claim_ref = blocked
untraceable_manual_claim = blocked
hidden_profit_assumption = blocked
```

## Minimal source ref record contract for later P4 tasks

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
derivation_role
policy_boundary_result
```

P4-01 records the minimum contract shape for later tasks. It does not create a runtime contract package or database table.

## P4-02 handoff

```text
next_gate: P4_02_ROI_POLICY_GATE_CONTRACT
p4_02_must_use_allowed_source_ref_kinds = true
p4_02_must_use_forbidden_source_ref_kinds = true
p4_02_must_block_untraceable_manual_claim = true
p4_02_must_block_hidden_profit_assumption = true
p4_02_must_block_recommendation_ref = true
p4_02_must_block_priority_score_ref = true
p4_02_must_block_success_prediction_ref = true
p4_02_must_block_production_operation_claim_ref = true
```

## Changed files allowed in P4-01

```text
docs/tasks/P4-01-ROI-Source-Boundary-Reconciliation.md
scripts/governance_acceptance/P4_01_ROI_SOURCE_BOUNDARY_RECONCILIATION.cjs
```

## Directories forbidden in P4-01

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
p4_01_is_governance_only = true
p4_01_changes_frontend = false
p4_01_changes_runtime = false
p4_01_changes_routes = false
p4_01_changes_db = false
p4_01_changes_scheduler = false
p4_01_changes_adapter = false
p4_01_changes_execution = false
p4_01_creates_roi_calculation = false
p4_01_creates_roi_read_model = false
p4_01_creates_roi_write_path = false
p4_01_creates_recommendation = false
p4_01_creates_priority_score = false
p4_01_creates_profit_prediction = false
p4_01_creates_prescription = false
p4_01_creates_ao_act_task = false
p4_01_creates_receipt = false
p4_01_writes_field_memory = false
p4_01_extends_to_p5 = false
p4_01_extends_to_p6 = false
p4_01_extends_to_p7_or_later = false
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P4_01_ROI_SOURCE_BOUNDARY_RECONCILIATION.cjs
```

## Expected result

```text
ok = true
acceptance = P4_01_ROI_SOURCE_BOUNDARY_RECONCILIATION
p4_00_verified = true
allowed_source_ref_kind_count = 7
allowed_system_derived_object_ref_count = 11
context_only_ref_count = 4
deferred_ref_count = 4
forbidden_source_ref_kind_count = 17
forbidden_semantic_count = 15
changed_file_count = 2
no_frontend_changed_by_this_task = true
no_runtime_changed_by_this_task = true
no_db_changed_by_this_task = true
no_execution_changed_by_this_task = true
next_step = P4_02_ROI_POLICY_GATE_CONTRACT
```

## Next step

```text
P4_02_ROI_POLICY_GATE_CONTRACT
```
