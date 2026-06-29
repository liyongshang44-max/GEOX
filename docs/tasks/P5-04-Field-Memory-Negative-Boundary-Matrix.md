# docs/tasks/P5-04-Field-Memory-Negative-Boundary-Matrix.md

## Purpose

P5-04 freezes the negative boundary matrix for Field Memory governance.

The purpose is not to write Field Memory. The purpose is to make every prohibited P5 formalization path explicit, testable, and fail-closed before P5 completion review.

P5-04 follows P5-03 Field Memory Formalization Output Contract. P5-04 must preserve the P5-03 policy result passthrough, formalization state vocabulary, policy result mapping, allowed review payload boundary, blocked output rules, side-effect denial rules, blocked semantics, and no-runtime boundary.

P5-04 does not implement runtime routes, read models, frontend display, database schema, scheduler behavior, adapter behavior, execution integration, recommendation logic, priority scoring, prescription logic, profit prediction, AO-ACT task creation, receipt creation, Field Memory write, model update, automatic learning, or automatic formalization.

## Gate

```text
P5_04_FIELD_MEMORY_NEGATIVE_BOUNDARY_MATRIX
```

## Entry conditions

```text
previous_gate: P5_03_FIELD_MEMORY_FORMALIZATION_OUTPUT_CONTRACT
previous_doc: docs/tasks/P5-03-Field-Memory-Formalization-Output-Contract.md
previous_acceptance: scripts/governance_acceptance/P5_03_FIELD_MEMORY_FORMALIZATION_OUTPUT_CONTRACT.cjs
previous_commit: a4af4e348c47f72610bcb0b13f4b30bb87ce5b47
p4_completion_tag: p4_policy_controlled_roi_completion_before_p5
p5_03_status: accepted_on_main
p5_03_next_step: P5_04_FIELD_MEMORY_NEGATIVE_BOUNDARY_MATRIX
```

## Negative boundary principle

```text
field_memory_negative_boundary_must_fail_closed = true
field_memory_negative_boundary_must_preserve_policy_gate_result = true
field_memory_negative_boundary_must_preserve_formalization_state = true
field_memory_negative_boundary_must_preserve_fail_codes = true
field_memory_negative_boundary_must_preserve_source_refs = true
field_memory_negative_boundary_must_preserve_evidence_refs = true
field_memory_negative_boundary_must_preserve_trace_refs = true
field_memory_negative_boundary_must_preserve_operator_gate = true
field_memory_negative_boundary_must_not_create_memory_write = true
field_memory_negative_boundary_must_not_create_model_update = true
field_memory_negative_boundary_must_not_create_automatic_learning = true
field_memory_negative_boundary_must_not_create_execution_trigger = true
```

## Required negative boundary categories

```text
formalization_state_violation
review_payload_violation
blocked_output_violation
field_memory_write_violation
model_update_violation
automatic_learning_violation
execution_trigger_violation
evidence_trace_scope_integrity_violation
```

## Formalization state negative cases

```text
pass_result_shown_as_written_memory => BLOCK
block_result_shown_as_reviewable_memory => BLOCK
not_evaluated_shown_as_reviewable => BLOCK
unknown_result_shown_as_reviewable => BLOCK
source_or_scope_block_not_preserved => BLOCK
blocked_candidate_value_state_not_blocked => BLOCK
policy_result_renamed_to_memory_truth => BLOCK
```

## Review payload negative cases

```text
review_payload_contains_memory_record_body => BLOCK
review_payload_contains_knowledge_claim_body => BLOCK
review_payload_contains_model_update_payload => BLOCK
review_payload_contains_automatic_learning_payload => BLOCK
review_payload_contains_execution_payload => BLOCK
review_payload_contains_recommendation_text => BLOCK
review_payload_contains_priority_score => BLOCK
review_payload_contains_prescription => BLOCK
```

## Blocked output negative cases

```text
policy_gate_result_hidden_from_blocked_output => BLOCK
fail_codes_hidden_from_blocked_output => BLOCK
eligibility_source_refs_hidden_from_blocked_output => BLOCK
operator_gate_result_hidden_from_blocked_output => BLOCK
blocked_output_shown_as_field_memory => BLOCK
field_memory_id_created_from_blocked_output => BLOCK
field_memory_written_from_blocked_output => BLOCK
model_updated_from_blocked_output => BLOCK
execution_triggered_from_blocked_output => BLOCK
blocked_output_auto_formalized => BLOCK
```

## Side-effect negative cases

```text
write_field_memory => BLOCK
create_field_memory_id => BLOCK
update_model => BLOCK
train_model => BLOCK
create_execution_trigger => BLOCK
create_ao_act_task => BLOCK
create_receipt => BLOCK
rewrite_evidence => BLOCK
rewrite_trace => BLOCK
```

## Field Memory write negative cases

```text
formalization_output_used_as_memory_record => BLOCK
candidate_review_saved_as_memory => BLOCK
pass_result_auto_writes_memory => BLOCK
operator_review_auto_writes_memory => BLOCK
retention_context_creates_memory => BLOCK
existing_memory_mutated_by_candidate => BLOCK
```

## Model and automatic learning negative cases

```text
policy_result_updates_model => BLOCK
formalization_output_updates_model => BLOCK
candidate_payload_trains_model => BLOCK
automatic_learning_payload_created => BLOCK
model_update_ref_emitted_as_output => BLOCK
feedback_loop_promotes_candidate_to_model => BLOCK
```

## Execution negative cases

```text
execution_trigger_created => BLOCK
ao_act_task_created => BLOCK
receipt_created => BLOCK
machine_control_ref_created => BLOCK
executor_feedback_ref_consumed_as_memory_source => BLOCK
execution_audit_ref_consumed_as_memory_source => BLOCK
```

## Evidence trace scope negative cases

```text
evidence_refs_rewritten => BLOCK
trace_refs_rewritten => BLOCK
provenance_synthesized_without_source => BLOCK
scope_changed_during_formalization => BLOCK
operator_gate_bypassed => BLOCK
source_refs_enriched_without_trace => BLOCK
unbounded_source_summary_created => BLOCK
```

## Required block result fields

```text
negative_boundary_name
negative_case_id
negative_category
expected_result
formalization_state
candidate_value_state
fail_code_or_reason
source_evidence_trace_refs
operator_gate_ref
read_only
```

## P5-05 handoff

```text
next_gate: P5_05_FIELD_MEMORY_COMPLETION_REVIEW_BEFORE_P6
p5_05_must_verify_p5_00 = true
p5_05_must_verify_p5_01 = true
p5_05_must_verify_p5_02 = true
p5_05_must_verify_p5_03 = true
p5_05_must_verify_p5_04 = true
p5_05_must_freeze_completion_boundary = true
p5_05_must_authorize_P6_entry_only_after_completion = true
suggested_completion_tag: p5_policy_controlled_field_memory_governance_completion_before_p6
```

## Changed files allowed in P5-04

```text
docs/tasks/P5-04-Field-Memory-Negative-Boundary-Matrix.md
scripts/governance_acceptance/P5_04_FIELD_MEMORY_NEGATIVE_BOUNDARY_MATRIX.cjs
```

## Directories forbidden in P5-04

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
p5_04_is_governance_only = true
p5_04_changes_frontend = false
p5_04_changes_runtime = false
p5_04_changes_routes = false
p5_04_changes_db = false
p5_04_changes_scheduler = false
p5_04_changes_adapter = false
p5_04_changes_execution = false
p5_04_creates_field_memory_write_path = false
p5_04_creates_field_memory_read_model = false
p5_04_creates_field_memory_record = false
p5_04_creates_model_update = false
p5_04_creates_automatic_learning = false
p5_04_creates_recommendation = false
p5_04_creates_priority_score = false
p5_04_creates_profit_prediction = false
p5_04_creates_prescription = false
p5_04_creates_ao_act_task = false
p5_04_creates_receipt = false
p5_04_extends_to_p6 = false
p5_04_extends_to_p7_or_later = false
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
node scripts/governance_acceptance/P5_04_FIELD_MEMORY_NEGATIVE_BOUNDARY_MATRIX.cjs
```

## Expected result

```text
ok = true
acceptance = P5_04_FIELD_MEMORY_NEGATIVE_BOUNDARY_MATRIX
p5_03_verified = true
p4_completion_tag_verified = true
negative_boundary_category_count = 8
formalization_state_negative_case_count = 7
review_payload_negative_case_count = 8
blocked_output_negative_case_count = 10
side_effect_negative_case_count = 9
field_memory_write_negative_case_count = 6
model_learning_negative_case_count = 6
execution_negative_case_count = 6
evidence_trace_scope_negative_case_count = 7
block_result_field_count = 10
secondary_review_required = true
changed_file_count = 2
no_frontend_changed_by_this_task = true
no_runtime_changed_by_this_task = true
no_db_changed_by_this_task = true
no_execution_changed_by_this_task = true
next_step = P5_05_FIELD_MEMORY_COMPLETION_REVIEW_BEFORE_P6
```

## Next step

```text
P5_05_FIELD_MEMORY_COMPLETION_REVIEW_BEFORE_P6
```
