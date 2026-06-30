# docs/tasks/P5-02-Field-Memory-Policy-Gate-Contract.md

## Purpose

P5-02 freezes the policy gate contract for Field Memory governance.

The purpose is not to write Field Memory. The purpose is to define the required fail-closed gates, fail codes, policy result vocabulary, input contract, and output contract that must exist before any eligibility source can be considered for later Field Memory formalization.

P5-02 follows P5-01 Field Memory Eligibility Source Boundary. P5-02 must preserve the allowed eligibility source ref kinds, forbidden eligibility source ref kinds, context-only refs, deferred refs, forbidden semantics, and source record contract from P5-01.

P5-02 does not implement runtime routes, read models, frontend display, database schema, scheduler behavior, adapter behavior, execution integration, recommendation logic, priority scoring, prescription logic, profit prediction, AO-ACT task creation, receipt creation, Field Memory write, model update, automatic learning, or automatic formalization.

## Gate

```text
P5_02_FIELD_MEMORY_POLICY_GATE_CONTRACT
```

## Entry conditions

```text
previous_gate: P5_01_FIELD_MEMORY_ELIGIBILITY_SOURCE_BOUNDARY
previous_doc: docs/legacy/tasks/P5-01-Field-Memory-Eligibility-Source-Boundary.md
previous_acceptance: scripts/governance_acceptance/P5_01_FIELD_MEMORY_ELIGIBILITY_SOURCE_BOUNDARY.cjs
previous_commit: f04f8bde02545c3442410ef78353c4e573d95307
p4_completion_tag: p4_policy_controlled_roi_completion_before_p5
p5_01_status: accepted_on_main
p5_01_next_step: P5_02_FIELD_MEMORY_POLICY_GATE_CONTRACT
```

## Policy gate principle

```text
field_memory_policy_gate_must_fail_closed = true
field_memory_policy_gate_must_be_traceable = true
field_memory_policy_gate_must_be_evidence_backed = true
field_memory_policy_gate_must_preserve_provenance = true
field_memory_policy_gate_must_preserve_scope = true
field_memory_policy_gate_must_preserve_operator_gate = true
field_memory_policy_gate_must_preserve_source_boundary = true
field_memory_policy_gate_must_not_rewrite_evidence = true
field_memory_policy_gate_must_not_rewrite_trace = true
field_memory_policy_gate_must_not_create_memory_write = true
field_memory_policy_gate_must_not_create_model_update = true
field_memory_policy_gate_must_not_create_execution_trigger = true
```

## Required Field Memory policy gates

```text
provenance_required
evidence_refs_required
trace_refs_required
operator_gate_required
scope_preserved
source_schema_compatible
allowed_eligibility_source_ref_kind
forbidden_eligibility_source_ref_kind_blocked
context_only_ref_not_value_source
deferred_to_p6_ref_blocked
no_recommendation_semantics
no_priority_score
no_success_prediction
no_profit_prediction
no_prescription_semantics
no_execution_trigger
no_field_memory_write
no_model_update
no_automatic_learning
```

## Gate fail codes

```text
MISSING_PROVENANCE
MISSING_EVIDENCE_REFS
MISSING_TRACE_REFS
MISSING_OPERATOR_GATE
SCOPE_NOT_PRESERVED
SOURCE_SCHEMA_INCOMPATIBLE
ELIGIBILITY_SOURCE_REF_KIND_NOT_ALLOWED
FORBIDDEN_ELIGIBILITY_SOURCE_REF_KIND_PRESENT
CONTEXT_ONLY_REF_USED_AS_VALUE_SOURCE
DEFERRED_TO_P6_REF_PRESENT
RECOMMENDATION_SEMANTICS_PRESENT
PRIORITY_SCORE_PRESENT
SUCCESS_PREDICTION_PRESENT
PROFIT_PREDICTION_PRESENT
PRESCRIPTION_SEMANTICS_PRESENT
EXECUTION_TRIGGER_PRESENT
FIELD_MEMORY_WRITE_PRESENT
MODEL_UPDATE_PRESENT
AUTOMATIC_LEARNING_PRESENT
```

## Policy result vocabulary

```text
PASS = all_required_gates_passed
BLOCK = one_or_more_required_gates_failed
NOT_EVALUATED = treated_as_BLOCK
UNKNOWN = treated_as_BLOCK
```

## Fail-closed aggregation rules

```text
all_required_gates_must_pass = true
any_failed_gate_blocks_field_memory = true
missing_gate_evaluation_blocks_field_memory = true
unknown_gate_result_blocks_field_memory = true
policy_gate_side_effect_blocks_field_memory = true
```

## Policy input contract fields

```text
policy_gate_contract_version
field_memory_policy_evaluation_id
policy_evaluated_at
eligibility_source_ref_records
operator_gate_ref
scope_ref
policy_context_ref
retention_suppression_context_ref
```

## Eligibility source record fields

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

## Policy output contract fields

```text
field_memory_policy_gate_result
passed_gates
blocked_gates
fail_codes
eligibility_source_ref_record_refs
operator_gate_result
scope_boundary_result
evaluation_trace_ref
policy_contract_version
```

## Blocked Field Memory policy semantics

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

## P5-03 handoff

```text
next_gate: P5_03_FIELD_MEMORY_FORMALIZATION_OUTPUT_CONTRACT
p5_03_must_use_policy_gate_result_vocabulary = true
p5_03_must_show_blocked_candidate_as_blocked_not_memory = true
p5_03_must_preserve_fail_codes = true
p5_03_must_preserve_eligibility_source_ref_record_refs = true
p5_03_must_preserve_operator_gate_result = true
p5_03_must_not_create_field_memory_write = true
p5_03_must_not_create_model_update = true
p5_03_must_not_create_automatic_learning = true
p5_03_must_not_create_execution_trigger = true
```

## Changed files allowed in P5-02

```text
docs/tasks/P5-02-Field-Memory-Policy-Gate-Contract.md
scripts/governance_acceptance/P5_02_FIELD_MEMORY_POLICY_GATE_CONTRACT.cjs
```

## Directories forbidden in P5-02

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
p5_02_is_governance_only = true
p5_02_changes_frontend = false
p5_02_changes_runtime = false
p5_02_changes_routes = false
p5_02_changes_db = false
p5_02_changes_scheduler = false
p5_02_changes_adapter = false
p5_02_changes_execution = false
p5_02_creates_field_memory_write_path = false
p5_02_creates_field_memory_read_model = false
p5_02_creates_model_update = false
p5_02_creates_automatic_learning = false
p5_02_creates_recommendation = false
p5_02_creates_priority_score = false
p5_02_creates_profit_prediction = false
p5_02_creates_prescription = false
p5_02_creates_ao_act_task = false
p5_02_creates_receipt = false
p5_02_extends_to_p6 = false
p5_02_extends_to_p7_or_later = false
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
node scripts/governance_acceptance/P5_02_FIELD_MEMORY_POLICY_GATE_CONTRACT.cjs
```

## Expected result

```text
ok = true
acceptance = P5_02_FIELD_MEMORY_POLICY_GATE_CONTRACT
p5_01_verified = true
p4_completion_tag_verified = true
required_policy_gate_count = 19
fail_code_count = 19
policy_result_vocabulary_count = 4
aggregation_rule_count = 5
policy_input_contract_field_count = 8
eligibility_source_record_contract_field_count = 12
policy_output_contract_field_count = 9
blocked_semantic_count = 17
secondary_review_required = true
changed_file_count = 2
no_frontend_changed_by_this_task = true
no_runtime_changed_by_this_task = true
no_db_changed_by_this_task = true
no_execution_changed_by_this_task = true
next_step = P5_03_FIELD_MEMORY_FORMALIZATION_OUTPUT_CONTRACT
```

## Next step

```text
P5_03_FIELD_MEMORY_FORMALIZATION_OUTPUT_CONTRACT
```
