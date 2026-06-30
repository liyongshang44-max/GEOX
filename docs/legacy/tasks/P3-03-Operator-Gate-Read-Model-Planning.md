# docs/tasks/P3-03-Operator-Gate-Read-Model-Planning.md

## Purpose

P3-03 records the Operator Gate Read Model Planning boundary.

This task defines a read-only operator gate model that an operator surface may later display for human-controlled pilot flow. It does not implement UI, routes, database objects, scheduler behavior, adapter calls, or execution behavior.

## Gate

```text
P3_03_OPERATOR_GATE_READ_MODEL_PLANNING
```

## Entry condition

```text
P3_02_OPERATOR_PREFLIGHT_READ_MODEL_PLANNING is complete.
next_step from P3-02: P3_03_OPERATOR_GATE_READ_MODEL_PLANNING
```

## Read model identity

```text
read_model_id: operator_gate_read_model_v0
read_model_kind: planning_contract
surface_ref: operator_gate_panel
mode: read_only
status: candidate
```

## Input references

```text
operator_ref
operator_attestation_ref
approval_ref
operation_plan_ref
act_task_ref
dry_run_flag_ref
human_gate_ref
preflight_ref
```

## Required output fields

```text
gate_ref
scope_ref
operator_id
gate_state
operator_attestation_ref
approval_ref
operation_plan_ref
act_task_ref
dry_run_only
human_gate
preflight_ref
input_refs
evidence_refs
trace_refs
checked_at
read_model_version
```

## Allowed state vocabulary

```text
NOT_EVALUATED
READY_FOR_OPERATOR_ATTESTATION
READY_FOR_OPERATOR_APPROVAL
READY_FOR_DRY_RUN_ONLY_REVIEW
BLOCKED_MISSING_OPERATOR
BLOCKED_MISSING_ATTESTATION
BLOCKED_MISSING_APPROVAL_REF
BLOCKED_MISSING_OPERATION_PLAN_REF
BLOCKED_MISSING_ACT_TASK_REF
BLOCKED_DRY_RUN_FLAG_MISMATCH
BLOCKED_HUMAN_GATE_MISMATCH
```

## Field semantics

```text
gate_ref: stable pointer for one operator gate projection
scope_ref: project, field, device, or operation scope pointer
operator_id: explicit human operator identifier from the gate source
operator_attestation_ref: pointer to operator attestation evidence
approval_ref: pointer to a human approval reference
operation_plan_ref: pointer to the operation plan referenced by the gate
act_task_ref: pointer to the AO-ACT task referenced by the gate
dry_run_only: boolean showing whether the gate is limited to dry-run flow
human_gate: boolean showing whether human gate is explicit
preflight_ref: pointer to the preflight read-model projection
input_refs: list of source pointers consumed by the projection
evidence_refs: list of evidence pointers shown without semantic rewrite
trace_refs: list of trace pointers used for replay
checked_at: projection timestamp supplied by caller or report source
read_model_version: static read-model version string
```

## Boundary ledger

```text
read_only_projection = true
operator_visible = true
evidence_refs_required = true
trace_refs_required = true
creates_fact = false
creates_approval = false
creates_task = false
creates_receipt = false
creates_acceptance = false
starts_adapter = false
updates_model = false
default_gate_inference = false
automatic_submission = false
automatic_dispatch = false
```

## Excluded judgment semantics

```text
risk_score
priority_score
recommendation
prescription
success_prediction
profit_prediction
```

## Changed files allowed in this task

```text
docs/tasks/P3-03-Operator-Gate-Read-Model-Planning.md
scripts/governance_acceptance/P3_03_OPERATOR_GATE_READ_MODEL_PLANNING.cjs
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P3_03_OPERATOR_GATE_READ_MODEL_PLANNING.cjs
```

## Expected result

```text
ok = true
acceptance = P3_03_OPERATOR_GATE_READ_MODEL_PLANNING
p3_02_verified = true
operator_gate_read_model_verified = true
input_ref_count = 8
required_output_field_count = 16
allowed_state_count = 11
p3_03_started_as_planning_only = true
no_frontend_changed_by_this_task = true
no_runtime_changed_by_this_task = true
next_step = P3_04_DRY_RUN_REPORT_READ_MODEL_PLANNING
```
