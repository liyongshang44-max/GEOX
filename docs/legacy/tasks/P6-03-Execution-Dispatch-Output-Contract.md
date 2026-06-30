# docs/tasks/P6-03-Execution-Dispatch-Output-Contract.md

## Purpose

P6-03 freezes the dispatch output contract for Execution System Integration.

The purpose is not to dispatch work. The purpose is to define how an execution authorization gate result may be represented as a read-only dispatch-output contract for later phases of P6 without creating a dispatch adapter, AO-ACT task, receipt, execution audit write, machine control instruction, or runtime side effect.

P6-03 follows P6-02 Execution Authorization Gate Contract. P6-03 must preserve the authorization result vocabulary, authorization evaluation reference, fail codes, execution source refs, operator authorization result, executor identity result, scope result, dispatch policy result, and fail-closed behavior from P6-02.

P6-03 does not implement runtime routes, dispatch adapters, executor services, frontend display, database schema, scheduler behavior, machine control, AO-ACT task creation, receipt creation, execution audit write, recommendation logic, priority scoring, prescription logic, profit prediction, Field Memory write, model update, automatic learning, or automatic formalization.

## Gate

```text
P6_03_EXECUTION_DISPATCH_OUTPUT_CONTRACT
```

## Entry conditions

```text
previous_gate: P6_02_EXECUTION_AUTHORIZATION_GATE_CONTRACT
previous_doc: docs/legacy/tasks/P6-02-Execution-Authorization-Gate-Contract.md
previous_acceptance: scripts/governance_acceptance/P6_02_EXECUTION_AUTHORIZATION_GATE_CONTRACT.cjs
previous_commit: 17b71da756bec86f8e39beb3c9363c7c49271bc3
p5_completion_tag: p5_policy_controlled_field_memory_governance_completion_before_p6
p6_02_status: accepted_on_main
p6_02_next_step: P6_03_EXECUTION_DISPATCH_OUTPUT_CONTRACT
```

## Dispatch output principle

```text
dispatch_output_must_be_read_only = true
dispatch_output_must_preserve_authorization_gate_result = true
dispatch_output_must_preserve_authorization_evaluation_ref = true
dispatch_output_must_preserve_fail_codes = true
dispatch_output_must_preserve_execution_source_refs = true
dispatch_output_must_preserve_operator_authorization = true
dispatch_output_must_preserve_executor_identity = true
dispatch_output_must_preserve_execution_scope = true
dispatch_output_must_preserve_dispatch_policy = true
dispatch_output_must_not_create_dispatch_adapter = true
dispatch_output_must_not_create_ao_act_task = true
dispatch_output_must_not_create_receipt = true
dispatch_output_must_not_create_execution_audit_write = true
dispatch_output_must_not_create_machine_control = true
```

## Authorization result passthrough

```text
PASS
BLOCK
NOT_EVALUATED
UNKNOWN
```

P6-03 must not rename authorization results into dispatch completion, executor acceptance, field execution, machine command, receipt, or audit truth. `PASS` permits only a dispatch-output contract state. `PASS` does not dispatch.

## Dispatch output state vocabulary

```text
DISPATCH_OUTPUT_READY_AUTHORIZED
DISPATCH_OUTPUT_BLOCKED_AUTHORIZATION_FAILED
DISPATCH_OUTPUT_BLOCKED_NOT_EVALUATED
DISPATCH_OUTPUT_BLOCKED_UNKNOWN
DISPATCH_OUTPUT_BLOCKED_SOURCE_BOUNDARY
DISPATCH_OUTPUT_BLOCKED_OPERATOR_AUTHORIZATION
DISPATCH_OUTPUT_BLOCKED_EXECUTOR_IDENTITY
DISPATCH_OUTPUT_BLOCKED_SIDE_EFFECT
```

## Dispatch intent state vocabulary

```text
READY_NOT_DISPATCHED
BLOCKED_NOT_DISPATCHED
NOT_EVALUATED_NOT_DISPATCHED
UNKNOWN_NOT_DISPATCHED
```

## Authorization result mapping

```text
PASS => dispatch_output_state DISPATCH_OUTPUT_READY_AUTHORIZED; dispatch_intent_state READY_NOT_DISPATCHED
BLOCK => dispatch_output_state DISPATCH_OUTPUT_BLOCKED_AUTHORIZATION_FAILED; dispatch_intent_state BLOCKED_NOT_DISPATCHED
NOT_EVALUATED => dispatch_output_state DISPATCH_OUTPUT_BLOCKED_NOT_EVALUATED; dispatch_intent_state NOT_EVALUATED_NOT_DISPATCHED
UNKNOWN => dispatch_output_state DISPATCH_OUTPUT_BLOCKED_UNKNOWN; dispatch_intent_state UNKNOWN_NOT_DISPATCHED
```

## Dispatch output fields

```text
dispatch_output_contract_version
dispatch_output_id
authorization_evaluation_ref
execution_authorization_gate_result
dispatch_output_state
dispatch_intent_state
execution_source_ref_record_refs
operator_authorization_ref
operator_authorization_result
executor_identity_ref
executor_identity_result
execution_scope_ref
dispatch_policy_ref
passed_gates
blocked_gates
fail_codes
evidence_refs
trace_refs
provenance_ref
read_only
```

These are contract fields, not a runtime schema. P6-03 does not create a package type, database table, API response, frontend model, read model, dispatch payload, adapter request, AO-ACT task, receipt, execution audit trace, or write path.

## Ready output rules

```text
ready_output_requires_PASS_authorization = true
ready_output_must_preserve_authorization_evaluation_ref = true
ready_output_must_preserve_execution_source_ref_record_refs = true
ready_output_must_preserve_operator_authorization_result = true
ready_output_must_preserve_executor_identity_result = true
ready_output_must_preserve_execution_scope_ref = true
ready_output_must_preserve_dispatch_policy_ref = true
ready_output_must_remain_ready_not_dispatched = true
ready_output_must_not_create_adapter_request = true
ready_output_must_not_create_ao_act_task = true
ready_output_must_not_create_receipt = true
ready_output_must_not_create_execution_audit_write = true
```

## Blocked output rules

```text
blocked_output_must_show_authorization_gate_result = true
blocked_output_must_show_fail_codes = true
blocked_output_must_preserve_authorization_evaluation_ref = true
blocked_output_must_preserve_execution_source_ref_record_refs = true
blocked_output_must_preserve_operator_authorization_result = true
blocked_output_must_preserve_executor_identity_result = true
blocked_output_must_not_show_as_ready_to_dispatch = true
blocked_output_must_not_create_dispatch_payload = true
blocked_output_must_not_create_adapter_request = true
blocked_output_must_not_create_ao_act_task = true
blocked_output_must_not_create_receipt = true
blocked_output_must_not_create_execution_audit_write = true
```

## Prohibited dispatch output payloads

```text
dispatch_adapter_request_payload
executor_service_request_payload
machine_control_payload
ao_act_task_payload
receipt_payload
execution_audit_write_payload
field_execution_status_payload
executor_acceptance_payload
recommendation_payload
priority_score_payload
prescription_payload
profit_prediction_payload
success_prediction_payload
field_memory_write_payload
model_update_payload
automatic_learning_payload
automatic_dispatch_marker
evidence_rewrite_payload
trace_rewrite_payload
operator_authorization_bypass_payload
```

## P6-04 handoff

```text
next_gate: P6_04_EXECUTION_RECEIPT_INTAKE_CONTRACT
p6_04_must_use_dispatch_output_contract = true
p6_04_must_accept_only_dispatch_output_refs_as_context = true
p6_04_must_not_treat_dispatch_output_as_execution_done = true
p6_04_must_require_receipt_to_be_external_or_executor_submitted = true
p6_04_must_preserve_authorization_evaluation_ref = true
p6_04_must_preserve_dispatch_output_ref = true
p6_04_must_preserve_executor_identity = true
p6_04_must_not_create_dispatch_adapter = true
p6_04_must_not_create_ao_act_task = true
p6_04_must_not_create_execution_audit_write = true
```

## Changed files allowed in P6-03

```text
docs/tasks/P6-03-Execution-Dispatch-Output-Contract.md
scripts/governance_acceptance/P6_03_EXECUTION_DISPATCH_OUTPUT_CONTRACT.cjs
```

## Directories forbidden in P6-03

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
p6_03_is_governance_only = true
p6_03_changes_frontend = false
p6_03_changes_runtime = false
p6_03_changes_routes = false
p6_03_changes_db = false
p6_03_changes_scheduler = false
p6_03_changes_adapter = false
p6_03_changes_execution = false
p6_03_creates_dispatch_adapter = false
p6_03_creates_executor_service = false
p6_03_creates_dispatch_payload = false
p6_03_creates_adapter_request = false
p6_03_creates_ao_act_task = false
p6_03_creates_receipt = false
p6_03_creates_execution_audit_write = false
p6_03_creates_machine_control = false
p6_03_creates_field_memory_write = false
p6_03_creates_model_update = false
p6_03_creates_automatic_learning = false
p6_03_creates_recommendation = false
p6_03_creates_priority_score = false
p6_03_creates_profit_prediction = false
p6_03_creates_prescription = false
p6_03_extends_to_p7_or_later = false
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
node scripts/governance_acceptance/P6_03_EXECUTION_DISPATCH_OUTPUT_CONTRACT.cjs
```

## Expected result

```text
ok = true
acceptance = P6_03_EXECUTION_DISPATCH_OUTPUT_CONTRACT
p6_02_verified = true
p5_completion_tag_verified = true
authorization_result_passthrough_count = 4
dispatch_output_state_count = 8
dispatch_intent_state_count = 4
authorization_result_mapping_count = 4
dispatch_output_field_count = 20
ready_output_rule_count = 12
blocked_output_rule_count = 12
prohibited_dispatch_output_payload_count = 20
p6_04_handoff_rule_count = 11
secondary_review_required = true
changed_file_count = 2
no_frontend_changed_by_this_task = true
no_runtime_changed_by_this_task = true
no_db_changed_by_this_task = true
no_execution_changed_by_this_task = true
next_step = P6_04_EXECUTION_RECEIPT_INTAKE_CONTRACT
```

## Next step

```text
P6_04_EXECUTION_RECEIPT_INTAKE_CONTRACT
```
