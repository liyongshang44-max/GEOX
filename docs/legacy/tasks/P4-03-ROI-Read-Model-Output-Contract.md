# docs/tasks/P4-03-ROI-Read-Model-Output-Contract.md

## Purpose

P4-03 freezes the read model and output contract for Policy-Controlled ROI.

The purpose is not to implement a read model. The purpose is to define the fields, status vocabulary, blocked-display behavior, and read-only projection boundary that later P4 tasks must obey before any ROI output can become operator-visible.

P4-03 follows P4-02 ROI Policy Gate Contract. P4-03 must preserve the P4-02 policy result vocabulary and fail-closed behavior.

P4-03 does not implement ROI calculation, runtime routes, frontend display, database schema, scheduler behavior, adapter behavior, execution integration, recommendation logic, priority scoring, prescription logic, profit prediction, AO-ACT task creation, receipt creation, Field Memory write, or automatic formalization.

## Gate

```text
P4_03_ROI_READ_MODEL_OUTPUT_CONTRACT
```

## Entry conditions

```text
previous_gate: P4_02_ROI_POLICY_GATE_CONTRACT
previous_doc: docs/tasks/P4-02-ROI-Policy-Gate-Contract.md
previous_acceptance: scripts/governance_acceptance/P4_02_ROI_POLICY_GATE_CONTRACT.cjs
previous_commit: b8341272a990494ebba483ff644bb3837b89ec34
p4_02_status: accepted_on_main
p4_02_next_step: P4_03_ROI_READ_MODEL_OUTPUT_CONTRACT
```

## Output contract principle

```text
roi_output_must_be_read_only = true
roi_output_must_preserve_policy_gate_result = true
roi_output_must_preserve_fail_codes = true
roi_output_must_preserve_source_ref_record_refs = true
roi_output_must_preserve_evidence_refs = true
roi_output_must_preserve_trace_refs = true
roi_output_must_preserve_provenance = true
roi_output_must_preserve_operator_visible_boundary = true
roi_output_must_not_create_runtime_side_effect = true
roi_output_must_not_become_recommendation = true
```

## Policy result passthrough

```text
PASS
BLOCK
NOT_EVALUATED
UNKNOWN
```

P4-03 must not rename policy results into business desirability terms. `NOT_EVALUATED` and `UNKNOWN` are blocked for display purposes.

## ROI output fields

```text
roi_output_contract_version
roi_view_id
scope_ref
policy_evaluation_ref
policy_gate_result
display_state
display_reason_codes
passed_gates
blocked_gates
fail_codes
source_ref_record_refs
evidence_refs
trace_refs
provenance_ref
operator_visible_boundary_result
read_only
```

These are contract fields, not a runtime schema. P4-03 does not create a package type, database table, API response, frontend model, or materialized read model.

## Display state vocabulary

```text
ROI_VISIBLE_POLICY_PASSED
ROI_BLOCKED_POLICY_FAILED
ROI_BLOCKED_NOT_EVALUATED
ROI_BLOCKED_UNKNOWN
ROI_BLOCKED_SOURCE_BOUNDARY
```

## Display rules

```text
PASS => display_state ROI_VISIBLE_POLICY_PASSED; may show read-only ROI payload only if all value source refs remain allowed
BLOCK => display_state ROI_BLOCKED_POLICY_FAILED; must preserve fail_codes; must not show ROI value payload as valid
NOT_EVALUATED => display_state ROI_BLOCKED_NOT_EVALUATED; must not show ROI value payload
UNKNOWN => display_state ROI_BLOCKED_UNKNOWN; must not show ROI value payload
SOURCE_REF_KIND_NOT_ALLOWED => display_state ROI_BLOCKED_SOURCE_BOUNDARY; must preserve fail_code
FORBIDDEN_SOURCE_REF_KIND_PRESENT => display_state ROI_BLOCKED_SOURCE_BOUNDARY; must preserve fail_code
blocked_semantic_fail_code => display_state ROI_BLOCKED_POLICY_FAILED; must not convert blocked output into recommendation
```

## Read-only projection boundary

```text
projection_is_read_only = true
projection_may_materialize_only_from_policy_output_contract = true
projection_must_not_query_unbounded_sources = true
projection_must_not_write_roi_entry = true
projection_must_not_write_field_memory = true
projection_must_not_create_receipt = true
projection_must_not_create_ao_act_task = true
projection_must_not_advance_decision_cycle = true
```

P4-03 does not authorize implementation of a read-only projection. It only freezes the boundary that a later task must obey if a projection is explicitly authorized.

## ROI value disclosure rules

```text
roi_value_may_be_present_only_when_policy_gate_result_PASS = true
roi_value_must_reference_source_ref_record_refs = true
roi_value_must_not_include_hidden_profit_assumption = true
roi_value_must_not_include_priority_score = true
roi_value_must_not_include_success_prediction = true
roi_value_must_not_include_recommendation = true
roi_value_must_not_include_prescription = true
roi_value_must_be_read_only = true
```

## Blocked output semantics

```text
recommendation
priority_score
success_prediction
profit_prediction
hidden_profit_assumption
prescription
execution_trigger
ao_act_task_payload
receipt_payload
field_memory_payload
operator_action_instruction
automatic_formalization_marker
evidence_rewrite_payload
trace_rewrite_payload
unbounded_source_summary
```

## Side-effect denial

```text
roi_output_cannot_trigger_ao_act_task = true
roi_output_cannot_create_receipt = true
roi_output_cannot_write_field_memory = true
roi_output_cannot_write_roi_entry = true
roi_output_cannot_advance_decision_cycle = true
roi_output_cannot_update_source_refs = true
roi_output_cannot_update_trace_refs = true
roi_output_cannot_update_evidence_refs = true
```

## P4-04 handoff

```text
next_gate: P4_04_ROI_NEGATIVE_BOUNDARY_MATRIX
p4_04_must_cover_forbidden_output_semantics = true
p4_04_must_cover_display_rule_violations = true
p4_04_must_cover_read_only_projection_violations = true
p4_04_must_cover_value_disclosure_violations = true
p4_04_must_cover_side_effect_denial_violations = true
p4_04_must_preserve_no_recommendation_boundary = true
p4_04_must_preserve_no_execution_trigger_boundary = true
```

## Changed files allowed in P4-03

```text
docs/tasks/P4-03-ROI-Read-Model-Output-Contract.md
scripts/governance_acceptance/P4_03_ROI_READ_MODEL_OUTPUT_CONTRACT.cjs
```

## Directories forbidden in P4-03

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
p4_03_is_governance_only = true
p4_03_changes_frontend = false
p4_03_changes_runtime = false
p4_03_changes_routes = false
p4_03_changes_db = false
p4_03_changes_scheduler = false
p4_03_changes_adapter = false
p4_03_changes_execution = false
p4_03_creates_roi_calculation = false
p4_03_creates_roi_read_model_implementation = false
p4_03_creates_roi_write_path = false
p4_03_creates_recommendation = false
p4_03_creates_priority_score = false
p4_03_creates_profit_prediction = false
p4_03_creates_prescription = false
p4_03_creates_ao_act_task = false
p4_03_creates_receipt = false
p4_03_writes_field_memory = false
p4_03_extends_to_p5 = false
p4_03_extends_to_p6 = false
p4_03_extends_to_p7_or_later = false
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P4_03_ROI_READ_MODEL_OUTPUT_CONTRACT.cjs
```

## Expected result

```text
ok = true
acceptance = P4_03_ROI_READ_MODEL_OUTPUT_CONTRACT
p4_02_verified = true
policy_result_passthrough_count = 4
roi_output_field_count = 16
display_state_count = 5
display_rule_count = 7
read_only_projection_rule_count = 8
value_disclosure_rule_count = 8
blocked_output_semantic_count = 15
side_effect_denial_count = 8
changed_file_count = 2
no_frontend_changed_by_this_task = true
no_runtime_changed_by_this_task = true
no_db_changed_by_this_task = true
no_execution_changed_by_this_task = true
next_step = P4_04_ROI_NEGATIVE_BOUNDARY_MATRIX
```

## Next step

```text
P4_04_ROI_NEGATIVE_BOUNDARY_MATRIX
```
