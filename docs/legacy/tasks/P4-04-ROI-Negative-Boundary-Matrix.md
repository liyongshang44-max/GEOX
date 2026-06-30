# docs/tasks/P4-04-ROI-Negative-Boundary-Matrix.md

## Purpose

P4-04 freezes the negative boundary matrix for Policy-Controlled ROI.

The purpose is not to implement a runtime matrix. The purpose is to make every prohibited ROI path explicit, testable, and fail-closed before P4 can be completed.

P4-04 follows P4-03 ROI Read Model / Output Contract. P4-04 must preserve the P4-03 display rules, read-only projection boundary, value disclosure rules, blocked output semantics, and side-effect denial rules.

P4-04 does not implement ROI calculation, runtime routes, frontend display, database schema, scheduler behavior, adapter behavior, execution integration, recommendation logic, priority scoring, prescription logic, profit prediction, AO-ACT task creation, receipt creation, Field Memory write, or automatic formalization.

## Gate

```text
P4_04_ROI_NEGATIVE_BOUNDARY_MATRIX
```

## Entry conditions

```text
previous_gate: P4_03_ROI_READ_MODEL_OUTPUT_CONTRACT
previous_doc: docs/tasks/P4-03-ROI-Read-Model-Output-Contract.md
previous_acceptance: scripts/governance_acceptance/P4_03_ROI_READ_MODEL_OUTPUT_CONTRACT.cjs
previous_commit: c6077ab5c9505cdacb07c823397a3d5584a3d328
p4_03_status: accepted_on_main
p4_03_next_step: P4_04_ROI_NEGATIVE_BOUNDARY_MATRIX
```

## Negative boundary principle

```text
negative_boundary_must_fail_closed = true
negative_boundary_must_block_before_display = true
negative_boundary_must_preserve_fail_codes = true
negative_boundary_must_preserve_evidence_refs = true
negative_boundary_must_preserve_trace_refs = true
negative_boundary_must_preserve_provenance = true
negative_boundary_must_not_create_runtime_side_effect = true
negative_boundary_must_not_downgrade_to_recommendation = true
negative_boundary_must_not_advance_to_P5_or_P6 = true
```

## Required negative boundaries

```text
no_recommendation
no_prescription
no_priority_score
no_hidden_profit_prediction
no_success_prediction
no_execution_trigger
no_ao_act_task_creation
no_receipt_creation
no_field_memory_write
no_roi_entry_write
no_decision_cycle_advance
no_evidence_rewrite
no_trace_rewrite
no_source_ref_update
no_unbounded_source_dependency
no_operator_gate_bypass
no_frontend_state_as_source
no_dashboard_metric_as_source
```

## Negative boundary vectors

```text
source_ref_violation => BLOCK
policy_gate_violation => BLOCK
output_display_violation => BLOCK
value_disclosure_violation => BLOCK
read_only_projection_violation => BLOCK
side_effect_violation => BLOCK
evidence_integrity_violation => BLOCK
trace_integrity_violation => BLOCK
scope_boundary_violation => BLOCK
operator_gate_violation => BLOCK
semantic_leakage_violation => BLOCK
deferred_phase_violation => BLOCK
```

## Negative matrix rows

```text
no_recommendation => detect recommendation semantics in source, policy result, output, display, or explanation; result BLOCK; no fallback to suggestion
no_prescription => detect prescription or action instruction semantics; result BLOCK; no operator task created
no_priority_score => detect priority_score or ranking semantics; result BLOCK; no prioritization display
no_hidden_profit_prediction => detect hidden profit assumption or unsupported value assertion; result BLOCK; no ROI value disclosure
no_success_prediction => detect success prediction or outcome promise; result BLOCK; no desirability display
no_execution_trigger => detect execution trigger or dispatch condition; result BLOCK; no AO-ACT bridge
no_ao_act_task_creation => detect AO-ACT task payload or task creation path; result BLOCK; no task write
no_receipt_creation => detect receipt payload or receipt creation path; result BLOCK; no receipt write
no_field_memory_write => detect Field Memory payload or write path; result BLOCK; no P5 object creation
no_roi_entry_write => detect formal ROI entry write path; result BLOCK; no formalization action
no_decision_cycle_advance => detect decision_cycle advancement or state transition; result BLOCK; no cycle mutation
no_evidence_rewrite => detect evidence rewrite or evidence mutation; result BLOCK; preserve original refs only
no_trace_rewrite => detect trace rewrite or trace mutation; result BLOCK; preserve original refs only
no_source_ref_update => detect source ref update or hidden enrichment; result BLOCK; pointer refs remain unchanged
no_unbounded_source_dependency => detect unbounded source expansion or free search dependency; result BLOCK; source boundary preserved
no_operator_gate_bypass => detect bypass of explicit operator gate; result BLOCK; human gate preserved
no_frontend_state_as_source => detect frontend UI state used as ROI source; result BLOCK; UI state remains non-authoritative
no_dashboard_metric_as_source => detect dashboard metric used as ROI source; result BLOCK; dashboard remains presentation only
```

## Blocked output payloads

```text
recommendation_payload
prescription_payload
priority_score_payload
profit_prediction_payload
success_prediction_payload
execution_trigger_payload
ao_act_task_payload
receipt_payload
field_memory_payload
roi_entry_write_payload
decision_cycle_advance_payload
evidence_rewrite_payload
trace_rewrite_payload
source_ref_update_payload
unbounded_source_summary_payload
```

## Integrity denial rules

```text
evidence_refs_are_pointer_or_read_refs_only = true
trace_refs_are_pointer_or_read_refs_only = true
provenance_refs_are_pointer_or_read_refs_only = true
source_ref_records_are_read_refs_only = true
operator_visible_boundary_is_read_ref_only = true
blocked_result_must_preserve_original_refs = true
blocked_result_must_not_synthesize_refs = true
blocked_result_must_not_delete_refs = true
```

## Side-effect denial rules

```text
cannot_create_ao_act_task = true
cannot_create_receipt = true
cannot_write_field_memory = true
cannot_write_roi_entry = true
cannot_advance_decision_cycle = true
cannot_update_source_refs = true
cannot_update_trace_refs = true
cannot_update_evidence_refs = true
```

## Block result contract

```text
block_result_required = true
block_result_must_include_boundary_name = true
block_result_must_include_vector = true
block_result_must_include_fail_code_or_reason = true
block_result_must_include_source_ref_record_refs_when_available = true
block_result_must_include_evidence_refs_when_available = true
block_result_must_include_trace_refs_when_available = true
block_result_must_include_provenance_ref_when_available = true
block_result_must_be_read_only = true
```

## P4-05 handoff

```text
next_gate: P4_05_ROI_COMPLETION_REVIEW_BEFORE_P5
p4_05_must_verify_p4_00 = true
p4_05_must_verify_p4_01 = true
p4_05_must_verify_p4_02 = true
p4_05_must_verify_p4_03 = true
p4_05_must_verify_p4_04 = true
p4_05_must_freeze_completion_boundary = true
p4_05_must_authorize_P5_entry_only_after_completion = true
suggested_completion_tag: p4_policy_controlled_roi_completion_before_p5
```

## Changed files allowed in P4-04

```text
docs/tasks/P4-04-ROI-Negative-Boundary-Matrix.md
scripts/governance_acceptance/P4_04_ROI_NEGATIVE_BOUNDARY_MATRIX.cjs
```

## Directories forbidden in P4-04

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
p4_04_is_governance_only = true
p4_04_changes_frontend = false
p4_04_changes_runtime = false
p4_04_changes_routes = false
p4_04_changes_db = false
p4_04_changes_scheduler = false
p4_04_changes_adapter = false
p4_04_changes_execution = false
p4_04_creates_roi_calculation = false
p4_04_creates_roi_read_model_implementation = false
p4_04_creates_roi_write_path = false
p4_04_creates_recommendation = false
p4_04_creates_priority_score = false
p4_04_creates_profit_prediction = false
p4_04_creates_prescription = false
p4_04_creates_ao_act_task = false
p4_04_creates_receipt = false
p4_04_writes_field_memory = false
p4_04_extends_to_p5 = false
p4_04_extends_to_p6 = false
p4_04_extends_to_p7_or_later = false
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P4_04_ROI_NEGATIVE_BOUNDARY_MATRIX.cjs
```

## Expected result

```text
ok = true
acceptance = P4_04_ROI_NEGATIVE_BOUNDARY_MATRIX
p4_03_verified = true
negative_boundary_count = 18
negative_vector_count = 12
negative_matrix_row_count = 18
blocked_output_payload_count = 15
integrity_denial_rule_count = 8
side_effect_denial_rule_count = 8
block_result_contract_field_count = 9
changed_file_count = 2
no_frontend_changed_by_this_task = true
no_runtime_changed_by_this_task = true
no_db_changed_by_this_task = true
no_execution_changed_by_this_task = true
next_step = P4_05_ROI_COMPLETION_REVIEW_BEFORE_P5
```

## Next step

```text
P4_05_ROI_COMPLETION_REVIEW_BEFORE_P5
```
