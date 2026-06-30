# docs/tasks/P3-05-Operator-Audit-Trail-Planning.md

## Purpose

P3-05 records the Operator Audit Trail Planning boundary.

This task defines a read-only audit trail model that an operator surface may later display for replay and review. It does not implement UI, routes, database objects, scheduler behavior, adapter calls, or operation behavior.

## Gate

```text
P3_05_OPERATOR_AUDIT_TRAIL_PLANNING
```

## Entry condition

```text
P3_04_DRY_RUN_REPORT_READ_MODEL_PLANNING is complete.
next_step from P3-04: P3_05_OPERATOR_AUDIT_TRAIL_PLANNING
```

## Read model identity

```text
read_model_id: operator_audit_trail_read_model_v0
read_model_kind: planning_contract
surface_ref: audit_trail_panel
mode: read_only
status: candidate
```

## Input references

```text
workflow_event_ref
preflight_ref
operator_gate_ref
dry_run_report_ref
act_task_ref
act_receipt_ref
evidence_ref
trace_ref
```

## Required output fields

```text
audit_trail_ref
workflow_id
scope_ref
event_ref
event_type
event_source
actor_ref
subject_ref
occurred_at
observed_at
sequence_key
display_order_rule
source_ref
input_refs
evidence_refs
trace_refs
read_model_version
```

## Allowed event vocabulary

```text
WORKFLOW_EVENT
PREFLIGHT_PROJECTION
OPERATOR_GATE_PROJECTION
DRY_RUN_REPORT_PROJECTION
ACT_TASK_REFERENCE
ACT_RECEIPT_REFERENCE
EVIDENCE_POINTER
TRACE_POINTER
```

## Field semantics

```text
audit_trail_ref: stable pointer for one audit trail projection
workflow_id: workflow identifier used to group displayed events
scope_ref: project, field, device, or operation scope pointer
event_ref: source event pointer
event_type: event vocabulary value copied from the source classification
event_source: source family that emitted or supplied the event pointer
actor_ref: pointer to human, system, or adapter actor when available
subject_ref: pointer to the object that the event concerns
occurred_at: event timestamp supplied by the source
observed_at: projection observation timestamp supplied by caller or source
sequence_key: explicit stable display key for chronological replay
display_order_rule: explicit rule used for chronological display
source_ref: pointer to the source record behind this row
input_refs: list of source pointers consumed by the projection
evidence_refs: list of evidence pointers shown without semantic rewrite
trace_refs: list of trace pointers used for replay
read_model_version: static read-model version string
```

## Display order rule

```text
primary_order = occurred_at ascending
secondary_order = event_ref ascending
hidden_ordering_rule = false
causal_ordering_claim = false
priority_ordering_claim = false
```

## Boundary ledger

```text
read_only_projection = true
operator_visible = true
chronological_only = true
display_order_rule_explicit = true
evidence_refs_required = true
trace_refs_required = true
creates_fact = false
creates_task = false
creates_receipt = false
creates_acceptance = false
creates_roi = false
creates_field_memory = false
starts_adapter = false
updates_model = false
causal_explanation = false
blame_assignment = false
hidden_ordering_rule = false
```

## Excluded judgment semantics

```text
risk_score
priority_score
recommendation
prescription
success_prediction
profit_prediction
blame_assignment
causal_explanation
```

## Changed files allowed in this task

```text
docs/tasks/P3-05-Operator-Audit-Trail-Planning.md
scripts/governance_acceptance/P3_05_OPERATOR_AUDIT_TRAIL_PLANNING.cjs
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P3_05_OPERATOR_AUDIT_TRAIL_PLANNING.cjs
```

## Expected result

```text
ok = true
acceptance = P3_05_OPERATOR_AUDIT_TRAIL_PLANNING
p3_04_verified = true
operator_audit_trail_verified = true
input_ref_count = 8
required_output_field_count = 17
allowed_event_count = 8
p3_05_started_as_planning_only = true
no_frontend_changed_by_this_task = true
no_runtime_changed_by_this_task = true
next_step = P3_06_OPERATOR_UX_NEGATIVE_BOUNDARY_MATRIX
```
