# docs/tasks/P6-04-Execution-Receipt-Intake-Contract.md

## Purpose

P6-04 freezes the receipt intake contract for Execution System Integration.

The purpose is not to write receipts. The purpose is to define how an external or executor-submitted execution receipt may be accepted for validation as a read-only intake object, while preserving dispatch output context, authorization evidence, executor identity, and fail-closed governance.

P6-04 follows P6-03 Execution Dispatch Output Contract. P6-04 must preserve the dispatch output contract as context only, must not treat dispatch output as execution completion, must require a receipt to be external or executor-submitted, and must preserve authorization evaluation refs, dispatch output refs, and executor identity.

P6-04 does not implement runtime routes, dispatch adapters, executor services, frontend display, database schema, scheduler behavior, machine control, AO-ACT task creation, receipt creation, receipt persistence, execution audit write, recommendation logic, priority scoring, prescription logic, profit prediction, Field Memory write, model update, automatic learning, or automatic formalization.

## Gate

```text
P6_04_EXECUTION_RECEIPT_INTAKE_CONTRACT
```

## Entry conditions

```text
previous_gate: P6_03_EXECUTION_DISPATCH_OUTPUT_CONTRACT
previous_doc: docs/tasks/P6-03-Execution-Dispatch-Output-Contract.md
previous_acceptance: scripts/governance_acceptance/P6_03_EXECUTION_DISPATCH_OUTPUT_CONTRACT.cjs
previous_commit: 5253e0b15e966fb52fb1b3dd776eee8579426d98
p5_completion_tag: p5_policy_controlled_field_memory_governance_completion_before_p6
p6_03_status: accepted_on_main
p6_03_next_step: P6_04_EXECUTION_RECEIPT_INTAKE_CONTRACT
```

## Receipt intake principle

```text
receipt_intake_must_be_read_only = true
receipt_intake_must_be_external_or_executor_submitted = true
receipt_intake_must_preserve_dispatch_output_ref = true
receipt_intake_must_preserve_authorization_evaluation_ref = true
receipt_intake_must_preserve_executor_identity = true
receipt_intake_must_preserve_execution_scope = true
receipt_intake_must_preserve_evidence_refs = true
receipt_intake_must_preserve_trace_refs = true
receipt_intake_must_preserve_provenance = true
receipt_intake_must_not_treat_dispatch_output_as_execution_done = true
receipt_intake_must_not_create_receipt_record = true
receipt_intake_must_not_create_execution_audit_write = true
receipt_intake_must_not_create_dispatch_adapter = true
receipt_intake_must_not_create_ao_act_task = true
```

## Allowed receipt intake source ref kinds

```text
executor_submitted_receipt_ref
external_system_receipt_ref
operator_submitted_receipt_ref
machine_reported_receipt_ref
dispatch_output_ref
authorization_evaluation_ref
executor_identity_ref
evidence_ref
trace_ref
provenance_ref
```

## Allowed receipt source conditions

```text
executor_submitted_receipt_ref requires executor_identity_ref_present = true
executor_submitted_receipt_ref requires submitted_at_present = true
executor_submitted_receipt_ref requires dispatch_output_ref_present = true
external_system_receipt_ref requires external_system_id_present = true
external_system_receipt_ref requires import_trace_ref_present = true
operator_submitted_receipt_ref requires operator_id_present = true
operator_submitted_receipt_ref requires manual_evidence_refs_present = true
machine_reported_receipt_ref requires telemetry_source_ref_present = true
machine_reported_receipt_ref requires no_machine_control_side_effect = true
dispatch_output_ref requires dispatch_output_state_present = true
dispatch_output_ref requires dispatch_output_is_context_not_completion = true
authorization_evaluation_ref requires authorization_gate_result_present = true
authorization_evaluation_ref requires fail_codes_preserved_if_blocked = true
executor_identity_ref requires executor_id_present = true
executor_identity_ref requires executor_type_present = true
evidence_ref requires evidence_refs_present = true
trace_ref requires trace_refs_present = true
provenance_ref requires provenance_present = true
provenance_ref requires actor_or_system_origin_present = true
provenance_ref requires source_schema_version_present = true
```

## Required receipt intake validation gates

```text
receipt_source_kind_allowed
receipt_source_external_or_executor_submitted
receipt_submitted_at_required
receipt_dispatch_output_ref_required
receipt_authorization_evaluation_ref_required
receipt_executor_identity_required
receipt_execution_scope_preserved
receipt_evidence_refs_required
receipt_trace_refs_required
receipt_provenance_required
receipt_source_schema_compatible
dispatch_output_context_only_not_completion
blocked_dispatch_output_not_valid_receipt_completion
operator_submitted_receipt_requires_manual_evidence
machine_reported_receipt_requires_telemetry_source
executor_identity_not_bypassed
receipt_payload_no_success_claim_without_evidence
receipt_payload_no_profit_or_yield_claim
receipt_payload_no_recommendation_or_prescription
receipt_payload_no_model_update
receipt_payload_no_execution_audit_write
receipt_payload_no_evidence_or_trace_rewrite
```

## Receipt intake fail codes

```text
RECEIPT_SOURCE_KIND_NOT_ALLOWED
RECEIPT_NOT_EXTERNAL_OR_EXECUTOR_SUBMITTED
MISSING_RECEIPT_SUBMITTED_AT
MISSING_DISPATCH_OUTPUT_REF
MISSING_AUTHORIZATION_EVALUATION_REF
MISSING_EXECUTOR_IDENTITY
EXECUTION_SCOPE_NOT_PRESERVED
MISSING_EVIDENCE_REFS
MISSING_TRACE_REFS
MISSING_PROVENANCE
SOURCE_SCHEMA_INCOMPATIBLE
DISPATCH_OUTPUT_USED_AS_COMPLETION
BLOCKED_DISPATCH_OUTPUT_USED_AS_VALID_COMPLETION
OPERATOR_SUBMITTED_RECEIPT_MISSING_MANUAL_EVIDENCE
MACHINE_REPORTED_RECEIPT_MISSING_TELEMETRY_SOURCE
EXECUTOR_IDENTITY_BYPASS_PRESENT
SUCCESS_CLAIM_WITHOUT_EVIDENCE
PROFIT_OR_YIELD_CLAIM_PRESENT
RECOMMENDATION_OR_PRESCRIPTION_PRESENT
MODEL_UPDATE_PRESENT
EXECUTION_AUDIT_WRITE_PRESENT
EVIDENCE_OR_TRACE_REWRITE_PRESENT
```

## Receipt intake result vocabulary

```text
PASS = all_required_receipt_intake_gates_passed
BLOCK = one_or_more_required_receipt_intake_gates_failed
NOT_EVALUATED = treated_as_BLOCK
UNKNOWN = treated_as_BLOCK
```

## Receipt intake state vocabulary

```text
RECEIPT_INTAKE_ACCEPTED_FOR_AUDIT_TRACE_CONTRACT
RECEIPT_INTAKE_BLOCKED_VALIDATION_FAILED
RECEIPT_INTAKE_BLOCKED_NOT_EVALUATED
RECEIPT_INTAKE_BLOCKED_UNKNOWN
RECEIPT_INTAKE_BLOCKED_SOURCE_KIND
RECEIPT_INTAKE_BLOCKED_DISPATCH_CONTEXT
RECEIPT_INTAKE_BLOCKED_EXECUTOR_IDENTITY
RECEIPT_INTAKE_BLOCKED_SIDE_EFFECT
```

## Receipt intake contract fields

```text
receipt_intake_contract_version
receipt_intake_id
receipt_source_ref
receipt_source_kind
receipt_submitted_at
receipt_received_at
dispatch_output_ref
authorization_evaluation_ref
execution_authorization_gate_result
dispatch_output_state
dispatch_intent_state
executor_identity_ref
execution_scope_ref
evidence_refs
trace_refs
provenance_ref
receipt_intake_result
receipt_intake_state
fail_codes
read_only
```

These are contract fields, not a runtime schema. P6-04 does not create a package type, database table, API response, frontend model, read model, receipt record, receipt write, execution audit trace, or write path.

## Receipt payload boundary rules

```text
receipt_payload_may_reference_dispatch_output = true
receipt_payload_may_reference_authorization_evaluation = true
receipt_payload_may_reference_executor_identity = true
receipt_payload_may_reference_execution_scope = true
receipt_payload_may_reference_evidence_and_trace = true
receipt_payload_must_not_assert_success_without_evidence = true
receipt_payload_must_not_assert_profit_or_yield = true
receipt_payload_must_not_create_recommendation = true
receipt_payload_must_not_create_prescription = true
receipt_payload_must_not_update_model = true
receipt_payload_must_not_write_execution_audit = true
receipt_payload_must_not_rewrite_evidence_or_trace = true
```

## Prohibited receipt intake semantics

```text
dispatch_output_as_execution_done
blocked_dispatch_output_as_completed_execution
receipt_auto_created_from_dispatch_output
receipt_persisted_by_intake_contract
execution_audit_write_from_receipt_intake
executor_identity_bypass
machine_control_from_receipt
success_claim_without_evidence
profit_prediction_from_receipt
yield_claim_from_receipt
recommendation_from_receipt
priority_score_from_receipt
prescription_from_receipt
field_memory_write_from_receipt
model_update_from_receipt
automatic_learning_from_receipt
evidence_rewrite_from_receipt
trace_rewrite_from_receipt
frontend_state_as_receipt_source
p7_or_later_expansion
```

## P6-05 handoff

```text
next_gate: P6_05_EXECUTION_AUDIT_TRACE_CONTRACT
p6_05_must_use_receipt_intake_contract = true
p6_05_must_preserve_receipt_intake_ref = true
p6_05_must_preserve_dispatch_output_ref = true
p6_05_must_preserve_authorization_evaluation_ref = true
p6_05_must_preserve_executor_identity = true
p6_05_must_preserve_evidence_refs = true
p6_05_must_preserve_trace_refs = true
p6_05_must_not_create_receipt_write = true
p6_05_must_not_create_dispatch_adapter = true
p6_05_must_not_create_ao_act_task = true
p6_05_must_not_rewrite_evidence_or_trace = true
```

## Changed files allowed in P6-04

```text
docs/tasks/P6-04-Execution-Receipt-Intake-Contract.md
scripts/governance_acceptance/P6_04_EXECUTION_RECEIPT_INTAKE_CONTRACT.cjs
```

## Directories forbidden in P6-04

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
p6_04_is_governance_only = true
p6_04_changes_frontend = false
p6_04_changes_runtime = false
p6_04_changes_routes = false
p6_04_changes_db = false
p6_04_changes_scheduler = false
p6_04_changes_adapter = false
p6_04_changes_execution = false
p6_04_creates_dispatch_adapter = false
p6_04_creates_executor_service = false
p6_04_creates_dispatch_payload = false
p6_04_creates_adapter_request = false
p6_04_creates_ao_act_task = false
p6_04_creates_receipt_record = false
p6_04_creates_receipt_write = false
p6_04_creates_execution_audit_write = false
p6_04_creates_machine_control = false
p6_04_creates_field_memory_write = false
p6_04_creates_model_update = false
p6_04_creates_automatic_learning = false
p6_04_creates_recommendation = false
p6_04_creates_priority_score = false
p6_04_creates_profit_prediction = false
p6_04_creates_prescription = false
p6_04_extends_to_p7_or_later = false
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
node scripts/governance_acceptance/P6_04_EXECUTION_RECEIPT_INTAKE_CONTRACT.cjs
```

## Expected result

```text
ok = true
acceptance = P6_04_EXECUTION_RECEIPT_INTAKE_CONTRACT
p6_03_verified = true
p5_completion_tag_verified = true
allowed_receipt_intake_source_ref_kind_count = 10
allowed_receipt_source_condition_count = 20
receipt_intake_validation_gate_count = 22
receipt_intake_fail_code_count = 22
receipt_intake_result_vocabulary_count = 4
receipt_intake_state_count = 8
receipt_intake_contract_field_count = 20
receipt_payload_boundary_rule_count = 12
prohibited_receipt_intake_semantic_count = 20
p6_05_handoff_rule_count = 12
secondary_review_required = true
changed_file_count = 2
no_frontend_changed_by_this_task = true
no_runtime_changed_by_this_task = true
no_db_changed_by_this_task = true
no_execution_changed_by_this_task = true
next_step = P6_05_EXECUTION_AUDIT_TRACE_CONTRACT
```

## Next step

```text
P6_05_EXECUTION_AUDIT_TRACE_CONTRACT
```
