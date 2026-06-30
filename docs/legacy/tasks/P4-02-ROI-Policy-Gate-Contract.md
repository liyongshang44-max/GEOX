# docs/tasks/P4-02-ROI-Policy-Gate-Contract.md

## Purpose

P4-02 freezes the policy gate contract for Policy-Controlled ROI.

The purpose is not to implement a runtime gate. The purpose is to define the required ROI policy gates, their fail-closed behavior, their fail codes, and the minimum input/output contract that later P4 tasks must obey before any ROI value can become operator-visible.

P4-02 follows P4-01 ROI Source Boundary Reconciliation. P4-02 must use the allowed source ref kinds, forbidden source ref kinds, context-only refs, and deferred refs frozen by P4-01.

P4-02 does not implement ROI calculation, ROI read model, frontend display, runtime route, database schema, scheduler behavior, adapter behavior, execution integration, recommendation logic, priority scoring, prescription logic, profit prediction, AO-ACT task creation, receipt creation, Field Memory write, or automatic formalization.

## Gate

```text
P4_02_ROI_POLICY_GATE_CONTRACT
```

## Entry conditions

```text
previous_gate: P4_01_ROI_SOURCE_BOUNDARY_RECONCILIATION
previous_doc: docs/tasks/P4-01-ROI-Source-Boundary-Reconciliation.md
previous_acceptance: scripts/governance_acceptance/P4_01_ROI_SOURCE_BOUNDARY_RECONCILIATION.cjs
previous_commit: f6bdd572685403a87faa268a70cc86c027f348b2
p4_01_status: accepted_on_main
p4_01_next_step: P4_02_ROI_POLICY_GATE_CONTRACT
```

## Policy gate principle

```text
roi_policy_gate_must_fail_closed = true
roi_policy_gate_must_be_traceable = true
roi_policy_gate_must_be_evidence_backed = true
roi_policy_gate_must_preserve_source_boundary = true
roi_policy_gate_must_preserve_operator_visible_boundary = true
roi_policy_gate_must_not_rewrite_evidence = true
roi_policy_gate_must_not_rewrite_trace = true
roi_policy_gate_must_not_create_runtime_side_effect = true
roi_policy_gate_must_not_create_business_semantics = true
```

## Required ROI policy gates

```text
provenance_required
evidence_refs_required
trace_refs_required
source_schema_compatible
allowed_source_ref_kind
forbidden_source_ref_kind_blocked
scope_preserved
operator_visible_boundary_preserved
no_recommendation_semantics
no_execution_trigger
no_priority_score
no_profit_prediction
no_prescription_semantics
no_field_memory_write
no_receipt_creation
no_ao_act_task_creation
```

## Gate fail codes

```text
MISSING_PROVENANCE
MISSING_EVIDENCE_REFS
MISSING_TRACE_REFS
SOURCE_SCHEMA_INCOMPATIBLE
SOURCE_REF_KIND_NOT_ALLOWED
FORBIDDEN_SOURCE_REF_KIND_PRESENT
SCOPE_NOT_PRESERVED
OPERATOR_VISIBLE_BOUNDARY_VIOLATED
RECOMMENDATION_SEMANTICS_PRESENT
EXECUTION_TRIGGER_PRESENT
PRIORITY_SCORE_PRESENT
PROFIT_PREDICTION_PRESENT
PRESCRIPTION_SEMANTICS_PRESENT
FIELD_MEMORY_WRITE_PRESENT
RECEIPT_CREATION_PRESENT
AO_ACT_TASK_CREATION_PRESENT
```

## Gate contract matrix

```text
provenance_required => pass_if provenance_ref present on every source_ref_record; fail_code MISSING_PROVENANCE; fail_result BLOCK
evidence_refs_required => pass_if evidence_refs non_empty on every evidence-backed source; fail_code MISSING_EVIDENCE_REFS; fail_result BLOCK
trace_refs_required => pass_if trace_refs non_empty on every system-derived or operator-derived source; fail_code MISSING_TRACE_REFS; fail_result BLOCK
source_schema_compatible => pass_if source_schema_version_or_contract_ref is compatible; fail_code SOURCE_SCHEMA_INCOMPATIBLE; fail_result BLOCK
allowed_source_ref_kind => pass_if every source ref kind is allowed by P4-01; fail_code SOURCE_REF_KIND_NOT_ALLOWED; fail_result BLOCK
forbidden_source_ref_kind_blocked => pass_if no forbidden or deferred source ref kind is used as a value source; fail_code FORBIDDEN_SOURCE_REF_KIND_PRESENT; fail_result BLOCK
scope_preserved => pass_if tenant/project/field/scope boundary is preserved; fail_code SCOPE_NOT_PRESERVED; fail_result BLOCK
operator_visible_boundary_preserved => pass_if operator-visible boundary is explicit and unchanged; fail_code OPERATOR_VISIBLE_BOUNDARY_VIOLATED; fail_result BLOCK
no_recommendation_semantics => pass_if ROI output contains no recommendation semantics; fail_code RECOMMENDATION_SEMANTICS_PRESENT; fail_result BLOCK
no_execution_trigger => pass_if ROI output cannot trigger execution; fail_code EXECUTION_TRIGGER_PRESENT; fail_result BLOCK
no_priority_score => pass_if ROI output contains no priority score; fail_code PRIORITY_SCORE_PRESENT; fail_result BLOCK
no_profit_prediction => pass_if ROI output contains no hidden or asserted profit prediction; fail_code PROFIT_PREDICTION_PRESENT; fail_result BLOCK
no_prescription_semantics => pass_if ROI output contains no prescription semantics; fail_code PRESCRIPTION_SEMANTICS_PRESENT; fail_result BLOCK
no_field_memory_write => pass_if ROI gate cannot write Field Memory; fail_code FIELD_MEMORY_WRITE_PRESENT; fail_result BLOCK
no_receipt_creation => pass_if ROI gate cannot create receipt records; fail_code RECEIPT_CREATION_PRESENT; fail_result BLOCK
no_ao_act_task_creation => pass_if ROI gate cannot create AO-ACT tasks; fail_code AO_ACT_TASK_CREATION_PRESENT; fail_result BLOCK
```

## Fail-closed aggregation rules

```text
all_required_gates_must_pass = true
any_failed_gate_blocks_roi = true
missing_gate_evaluation_blocks_roi = true
unknown_gate_result_blocks_roi = true
policy_gate_side_effect_blocks_roi = true
```

## Policy result vocabulary

```text
PASS = all_required_gates_passed
BLOCK = one_or_more_required_gates_failed
NOT_EVALUATED = treated_as_BLOCK
UNKNOWN = treated_as_BLOCK
```

## Policy gate evaluation input contract

```text
policy_gate_contract_version
policy_evaluation_id
policy_evaluated_at
source_ref_records
operator_visible_boundary_ref
scope_ref
policy_context_ref
```

The `source_ref_records` field must use the minimum source ref record contract from P4-01:

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

## Policy gate output contract

```text
policy_gate_result
passed_gates
blocked_gates
fail_codes
source_ref_record_refs
operator_visible_boundary_result
evaluation_trace_ref
policy_contract_version
```

The output contract is a governance planning contract only. P4-02 does not create a package type, database table, runtime response, read model, or UI surface.

## Blocked semantics

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

## P4-03 handoff

```text
next_gate: P4_03_ROI_READ_MODEL_OUTPUT_CONTRACT
p4_03_must_use_policy_gate_result_vocabulary = true
p4_03_must_show_blocked_roi_as_blocked_not_recommendation = true
p4_03_must_preserve_fail_codes = true
p4_03_must_preserve_source_ref_record_refs = true
p4_03_must_not_create_execution_trigger = true
p4_03_must_not_create_field_memory_write = true
p4_03_must_not_create_receipt = true
p4_03_must_not_create_ao_act_task = true
```

## Changed files allowed in P4-02

```text
docs/tasks/P4-02-ROI-Policy-Gate-Contract.md
scripts/governance_acceptance/P4_02_ROI_POLICY_GATE_CONTRACT.cjs
```

## Directories forbidden in P4-02

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
p4_02_is_governance_only = true
p4_02_changes_frontend = false
p4_02_changes_runtime = false
p4_02_changes_routes = false
p4_02_changes_db = false
p4_02_changes_scheduler = false
p4_02_changes_adapter = false
p4_02_changes_execution = false
p4_02_creates_roi_calculation = false
p4_02_creates_roi_read_model = false
p4_02_creates_roi_write_path = false
p4_02_creates_recommendation = false
p4_02_creates_priority_score = false
p4_02_creates_profit_prediction = false
p4_02_creates_prescription = false
p4_02_creates_ao_act_task = false
p4_02_creates_receipt = false
p4_02_writes_field_memory = false
p4_02_extends_to_p5 = false
p4_02_extends_to_p6 = false
p4_02_extends_to_p7_or_later = false
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P4_02_ROI_POLICY_GATE_CONTRACT.cjs
```

## Expected result

```text
ok = true
acceptance = P4_02_ROI_POLICY_GATE_CONTRACT
p4_01_verified = true
required_policy_gate_count = 16
fail_code_count = 16
aggregation_rule_count = 5
policy_result_vocabulary_count = 4
policy_input_contract_field_count = 7
source_ref_record_contract_field_count = 11
policy_output_contract_field_count = 8
blocked_semantic_count = 15
changed_file_count = 2
no_frontend_changed_by_this_task = true
no_runtime_changed_by_this_task = true
no_db_changed_by_this_task = true
no_execution_changed_by_this_task = true
next_step = P4_03_ROI_READ_MODEL_OUTPUT_CONTRACT
```

## Next step

```text
P4_03_ROI_READ_MODEL_OUTPUT_CONTRACT
```
