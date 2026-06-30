# docs/tasks/P6-02-Execution-Authorization-Gate-Contract.md

## Purpose

P6-02 freezes the authorization gate contract for Execution System Integration.

The purpose is not to dispatch work. The purpose is to define the fail-closed authorization gates, fail codes, result vocabulary, input contract, and output contract that must exist before an execution source may be considered for a later dispatch output contract.

P6-02 follows P6-01 Execution Source Boundary. P6-02 must preserve the allowed execution source ref kinds, source conditions, context-only refs, deferred refs, forbidden source ref kinds, forbidden semantics, and source record contract from P6-01.

P6-02 does not implement runtime routes, dispatch adapters, executor services, frontend display, database schema, scheduler behavior, machine control, AO-ACT task creation, receipt creation, execution audit write, recommendation logic, priority scoring, prescription logic, profit prediction, Field Memory write, model update, automatic learning, or automatic formalization.

## Gate

```text
P6_02_EXECUTION_AUTHORIZATION_GATE_CONTRACT
```

## Entry conditions

```text
previous_gate: P6_01_EXECUTION_SOURCE_BOUNDARY
previous_doc: docs/legacy/tasks/P6-01-Execution-Source-Boundary.md
previous_acceptance: scripts/governance_acceptance/P6_01_EXECUTION_SOURCE_BOUNDARY.cjs
previous_commit: 415110413fb7836bc9a36ec189f9760d091aae64
p5_completion_tag: p5_policy_controlled_field_memory_governance_completion_before_p6
p6_01_status: accepted_on_main
p6_01_next_step: P6_02_EXECUTION_AUTHORIZATION_GATE_CONTRACT
```

## Authorization gate principle

```text
execution_authorization_gate_must_fail_closed = true
execution_authorization_gate_must_be_traceable = true
execution_authorization_gate_must_be_evidence_backed = true
execution_authorization_gate_must_preserve_provenance = true
execution_authorization_gate_must_preserve_scope = true
execution_authorization_gate_must_preserve_operator_authorization = true
execution_authorization_gate_must_preserve_executor_identity = true
execution_authorization_gate_must_preserve_source_boundary = true
execution_authorization_gate_must_not_rewrite_evidence = true
execution_authorization_gate_must_not_rewrite_trace = true
execution_authorization_gate_must_not_create_dispatch = true
execution_authorization_gate_must_not_create_ao_act_task = true
execution_authorization_gate_must_not_create_receipt = true
execution_authorization_gate_must_not_create_execution_audit_write = true
```

## Required execution authorization gates

```text
provenance_required
evidence_refs_required
trace_refs_required
source_schema_compatible
allowed_execution_source_ref_kind
forbidden_execution_source_ref_kind_blocked
context_only_ref_not_authority
deferred_ref_not_source
operator_authorization_required
operator_authorization_scope_preserved
executor_identity_required
executor_identity_not_bypassed
execution_scope_required
dispatch_policy_required
authorization_boundary_preserved
no_recommendation_as_authorization
no_priority_score_as_authorization
no_prescription_as_authorization
no_prediction_as_authorization
no_frontend_state_as_authorization
no_automatic_dispatch
no_automatic_ao_act_task_creation
no_automatic_receipt_creation
no_machine_control_without_authorization
no_execution_audit_rewrite
no_evidence_or_trace_rewrite
```

## Authorization fail codes

```text
MISSING_PROVENANCE
MISSING_EVIDENCE_REFS
MISSING_TRACE_REFS
SOURCE_SCHEMA_INCOMPATIBLE
EXECUTION_SOURCE_REF_KIND_NOT_ALLOWED
FORBIDDEN_EXECUTION_SOURCE_REF_KIND_PRESENT
CONTEXT_ONLY_REF_USED_AS_AUTHORITY
DEFERRED_REF_USED_AS_SOURCE
MISSING_OPERATOR_AUTHORIZATION
OPERATOR_AUTHORIZATION_SCOPE_NOT_PRESERVED
MISSING_EXECUTOR_IDENTITY
EXECUTOR_IDENTITY_BYPASS_PRESENT
MISSING_EXECUTION_SCOPE
MISSING_DISPATCH_POLICY
AUTHORIZATION_BOUNDARY_NOT_PRESERVED
RECOMMENDATION_AS_AUTHORIZATION_PRESENT
PRIORITY_SCORE_AS_AUTHORIZATION_PRESENT
PRESCRIPTION_AS_AUTHORIZATION_PRESENT
PREDICTION_AS_AUTHORIZATION_PRESENT
FRONTEND_STATE_AS_AUTHORIZATION_PRESENT
AUTOMATIC_DISPATCH_PRESENT
AUTOMATIC_AO_ACT_TASK_CREATION_PRESENT
AUTOMATIC_RECEIPT_CREATION_PRESENT
MACHINE_CONTROL_WITHOUT_AUTHORIZATION_PRESENT
EXECUTION_AUDIT_REWRITE_PRESENT
EVIDENCE_OR_TRACE_REWRITE_PRESENT
```

## Authorization result vocabulary

```text
PASS = all_required_authorization_gates_passed
BLOCK = one_or_more_required_authorization_gates_failed
NOT_EVALUATED = treated_as_BLOCK
UNKNOWN = treated_as_BLOCK
```

## Fail-closed aggregation rules

```text
all_required_authorization_gates_must_pass = true
any_failed_authorization_gate_blocks_dispatch = true
missing_authorization_gate_evaluation_blocks_dispatch = true
unknown_authorization_gate_result_blocks_dispatch = true
authorization_gate_side_effect_blocks_dispatch = true
```

## Authorization input contract fields

```text
authorization_gate_contract_version
execution_authorization_evaluation_id
policy_evaluated_at
execution_source_ref_records
operator_authorization_ref
executor_identity_ref
execution_scope_ref
dispatch_policy_ref
evidence_refs
trace_refs
provenance_ref
source_boundary_result
```

## Authorization output contract fields

```text
execution_authorization_gate_result
authorization_state
passed_gates
blocked_gates
fail_codes
execution_source_ref_record_refs
operator_authorization_result
executor_identity_result
execution_scope_result
dispatch_policy_result
evaluation_trace_ref
read_only
```

## Authorization state vocabulary

```text
EXECUTION_AUTHORIZED_FOR_DISPATCH_CONTRACT
EXECUTION_BLOCKED_POLICY_FAILED
EXECUTION_BLOCKED_NOT_EVALUATED
EXECUTION_BLOCKED_UNKNOWN
EXECUTION_BLOCKED_SOURCE_BOUNDARY
EXECUTION_BLOCKED_OPERATOR_AUTHORIZATION
EXECUTION_BLOCKED_EXECUTOR_IDENTITY
```

## Blocked authorization semantics

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
dispatch_payload_creation
ao_act_task_payload_creation
receipt_payload_creation
```

## P6-03 handoff

```text
next_gate: P6_03_EXECUTION_DISPATCH_OUTPUT_CONTRACT
p6_03_must_use_authorization_result_vocabulary = true
p6_03_must_include_authorization_evaluation_ref = true
p6_03_must_preserve_fail_codes = true
p6_03_must_preserve_execution_source_ref_record_refs = true
p6_03_must_preserve_operator_authorization_result = true
p6_03_must_preserve_executor_identity_result = true
p6_03_must_not_create_dispatch_adapter = true
p6_03_must_not_create_ao_act_task = true
p6_03_must_not_create_receipt = true
p6_03_must_not_create_execution_audit_write = true
```

## Changed files allowed in P6-02

```text
docs/tasks/P6-02-Execution-Authorization-Gate-Contract.md
scripts/governance_acceptance/P6_02_EXECUTION_AUTHORIZATION_GATE_CONTRACT.cjs
```

## Directories forbidden in P6-02

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
p6_02_is_governance_only = true
p6_02_changes_frontend = false
p6_02_changes_runtime = false
p6_02_changes_routes = false
p6_02_changes_db = false
p6_02_changes_scheduler = false
p6_02_changes_adapter = false
p6_02_changes_execution = false
p6_02_creates_dispatch_adapter = false
p6_02_creates_executor_service = false
p6_02_creates_dispatch_payload = false
p6_02_creates_ao_act_task = false
p6_02_creates_receipt = false
p6_02_creates_execution_audit_write = false
p6_02_creates_machine_control = false
p6_02_creates_field_memory_write = false
p6_02_creates_model_update = false
p6_02_creates_automatic_learning = false
p6_02_creates_recommendation = false
p6_02_creates_priority_score = false
p6_02_creates_profit_prediction = false
p6_02_creates_prescription = false
p6_02_extends_to_p7_or_later = false
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
node scripts/governance_acceptance/P6_02_EXECUTION_AUTHORIZATION_GATE_CONTRACT.cjs
```

## Expected result

```text
ok = true
acceptance = P6_02_EXECUTION_AUTHORIZATION_GATE_CONTRACT
p6_01_verified = true
p5_completion_tag_verified = true
required_authorization_gate_count = 26
authorization_fail_code_count = 26
authorization_result_vocabulary_count = 4
aggregation_rule_count = 5
authorization_input_contract_field_count = 12
authorization_output_contract_field_count = 12
authorization_state_count = 7
blocked_authorization_semantic_count = 22
p6_03_handoff_rule_count = 11
secondary_review_required = true
changed_file_count = 2
no_frontend_changed_by_this_task = true
no_runtime_changed_by_this_task = true
no_db_changed_by_this_task = true
no_execution_changed_by_this_task = true
next_step = P6_03_EXECUTION_DISPATCH_OUTPUT_CONTRACT
```

## Next step

```text
P6_03_EXECUTION_DISPATCH_OUTPUT_CONTRACT
```
