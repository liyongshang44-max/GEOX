# docs/tasks/P4-Policy-Controlled-ROI-Planning.md

## Purpose

P4-00 defines the planning charter for Policy-Controlled ROI.

P4 starts after P3 Operator UX Refinement Planning completion. P4 does not continue Operator UX runtime work. P4 does not implement frontend runtime, execution runtime, database writes, scheduler behavior, adapter calls, recommendation logic, priority scoring, profit prediction, or automatic formalization.

The purpose of P4 is to govern ROI as a policy-controlled, traceable, evidence-backed object boundary before any ROI value can appear in operator-visible surfaces or downstream execution context.

## Gate

```text
P4_POLICY_CONTROLLED_ROI_PLANNING
```

## Entry conditions

```text
p3_completion_commit: b905c1bd2fefd39867e8b51c8f8d094dd1e57542
p3_completion_tag: p3_operator_ux_completion_before_p4
p3_completion_gate: P3_07_OPERATOR_UX_COMPLETION_REVIEW_BEFORE_P4
p3_completion_pr: 2144
p3_completion_status: closed_merged_on_main
p3_was_planning_only: true
p4_entry_condition_from_p3: P3_07_OPERATOR_UX_COMPLETION_REVIEW_BEFORE_P4 accepted on main
```

## Frozen phase line

```text
P4 Policy-Controlled ROI
P5 Policy-Controlled Field Memory Governance
P6 Execution System Integration
```

P4 must complete before P5 begins. P5 must complete before P6 begins. This task does not authorize P7, P8, P9, or any unbounded later phase.

## P4 stage boundary

```text
stage_name: P4 Policy-Controlled ROI
stage_type: governance_planning_first
primary_object_boundary: ROI
policy_control_required: true
traceability_required: true
evidence_refs_required: true
trace_refs_required: true
provenance_required: true
system_derived_object_chain_required: true
operator_visible_boundary_must_be_explicit: true
read_only_output_required_by_default: true
```

## P4-00 scope

```text
Define P4 as Policy-Controlled ROI.
Confirm P4 starts from ROI policy governance, not Operator UX runtime implementation.
Confirm P4-00 is planning only.
Confirm only governance documentation and governance acceptance are changed by this task.
Confirm later P4 tasks must explicitly authorize any runtime/read-model change before implementation.
Confirm P4 cannot create recommendations, priorities, prescriptions, profit predictions, AO-ACT tasks, receipts, Field Memory writes, or decision-cycle advancement.
```

## P4-00 non-goals

```text
No ROI calculation implementation.
No ROI dashboard metric implementation.
No operator frontend implementation.
No runtime route implementation.
No database schema or migration.
No scheduler behavior.
No adapter behavior.
No write path.
No AO-ACT integration.
No Field Memory write.
No recommendation engine.
No priority scoring.
No prescription generation.
No profit prediction.
No automatic formal ROI.
No automatic decision advancement.
```

## ROI source boundary to be reconciled in P4-01

```text
allowed_source_refs_to_freeze: pending_P4_01
forbidden_source_refs_to_freeze: pending_P4_01
traceable_source_chain_required: true
evidence_backed_source_required: true
system_derived_object_required: true
manual_untraceable_claim_allowed: false
hidden_profit_assumption_allowed: false
recommendation_ref_allowed_as_roi_input: false
priority_score_allowed_as_roi_input: false
success_prediction_allowed_as_roi_input: false
production_operation_claim_allowed_without_trace: false
```

P4-00 records that the source boundary must be reconciled next. It does not freeze the final allowlist or denylist itself.

## ROI policy gates to be defined in P4-02

```text
provenance_required
evidence_refs_required
trace_refs_required
source_schema_compatible
operator_visible_boundary_preserved
no_recommendation_semantics
no_execution_trigger
no_priority_score
no_profit_prediction
no_prescription_semantics
```

P4-00 records the expected policy-gate area. Final gate names and exact pass/fail rules must be frozen by P4-02.

## ROI read model and output contract to be defined in P4-03

```text
roi_output_fields: pending_P4_03
roi_status_vocabulary: pending_P4_03
roi_visible_when_policy_passed: pending_P4_03
roi_blocked_when_policy_failed: pending_P4_03
read_only_projection_allowed_only_if_explicitly_authorized_by_later_P4_task: true
```

P4-00 does not authorize runtime/read-model implementation. It only allows a later P4 task to decide whether a limited read-only projection is in scope.

## Negative boundary matrix to be defined in P4-04

```text
no_recommendation
no_prescription
no_priority_score
no_hidden_profit_prediction
no_execution_trigger
no_evidence_rewrite
no_trace_rewrite
no_unbounded_source_dependency
no_operator_gate_bypass
no_ao_act_task_creation
no_receipt_creation
no_field_memory_write
```

## Completion review to be performed in P4-05

```text
p4_completion_review_required: true
p5_entry_allowed_only_after_p4_completion_review: true
suggested_completion_tag: p4_policy_controlled_roi_completion_before_p5
final_completion_tag_must_be_frozen_by_P4_05: true
small_pr_tag_allowed: false
```

## Directories allowed in P4-00

```text
docs/tasks/
scripts/governance_acceptance/
```

## Files allowed in P4-00

```text
docs/tasks/P4-Policy-Controlled-ROI-Planning.md
scripts/governance_acceptance/P4_POLICY_CONTROLLED_ROI_PLANNING.cjs
```

## Directories forbidden in P4-00

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
p4_00_is_planning_only = true
p4_00_changes_frontend = false
p4_00_changes_runtime = false
p4_00_changes_routes = false
p4_00_changes_db = false
p4_00_changes_scheduler = false
p4_00_changes_adapter = false
p4_00_changes_execution = false
p4_00_creates_roi_calculation = false
p4_00_creates_roi_read_model = false
p4_00_creates_roi_write_path = false
p4_00_creates_operator_surface = false
p4_00_creates_recommendation = false
p4_00_creates_priority = false
p4_00_creates_profit_prediction = false
p4_00_creates_prescription = false
p4_00_creates_ao_act_task = false
p4_00_creates_receipt = false
p4_00_writes_field_memory = false
p4_00_extends_to_p5 = false
p4_00_extends_to_p6 = false
p4_00_extends_to_p7_or_later = false
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P4_POLICY_CONTROLLED_ROI_PLANNING.cjs
```

## Expected result

```text
ok = true
acceptance = P4_POLICY_CONTROLLED_ROI_PLANNING
p3_completion_verified = true
p4_phase_line_verified = true
p4_00_planning_only = true
allowed_changed_file_count = 2
no_frontend_changed_by_this_task = true
no_runtime_changed_by_this_task = true
no_db_changed_by_this_task = true
no_execution_changed_by_this_task = true
next_step = P4_01_ROI_SOURCE_BOUNDARY_RECONCILIATION
```

## Next step

```text
P4_01_ROI_SOURCE_BOUNDARY_RECONCILIATION
```
