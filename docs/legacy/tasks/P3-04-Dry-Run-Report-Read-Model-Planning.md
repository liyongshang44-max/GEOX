# docs/tasks/P3-04-Dry-Run-Report-Read-Model-Planning.md

## Purpose

P3-04 records the Dry Run Report Read Model Planning boundary.

This task defines a read-only report model that an operator surface may later display for dry-run review. It does not implement UI, routes, database objects, scheduler behavior, adapter calls, or production operation behavior.

## Gate

```text
P3_04_DRY_RUN_REPORT_READ_MODEL_PLANNING
```

## Entry condition

```text
P3_03_OPERATOR_GATE_READ_MODEL_PLANNING is complete.
next_step from P3-03: P3_04_DRY_RUN_REPORT_READ_MODEL_PLANNING
```

## Read model identity

```text
read_model_id: dry_run_report_read_model_v0
read_model_kind: planning_contract
surface_ref: dry_run_report_panel
mode: read_only
status: candidate
```

## Input references

```text
dry_run_report_ref
dry_run_case_ref
deterministic_hash_ref
matrix_preflight_ref
sandbox_ack_ref
operator_gate_ref
operation_plan_ref
act_task_ref
```

## Required output fields

```text
dry_run_ref
scope_ref
case_count
failed_case_count
matrix_preflight_ok
sandbox_ack_observed
report_hash
operator_gate_ref
operation_plan_ref
act_task_ref
input_refs
evidence_refs
trace_refs
checked_at
read_model_version
```

## Allowed state vocabulary

```text
NOT_EVALUATED
READY_FOR_OPERATOR_REVIEW
BLOCKED_MISSING_DRY_RUN_REPORT
BLOCKED_MISSING_CASE_REF
BLOCKED_MISSING_HASH_REF
BLOCKED_MATRIX_PREFLIGHT_REF
BLOCKED_SANDBOX_ACK_REF
BLOCKED_OPERATOR_GATE_REF
```

## Field semantics

```text
dry_run_ref: stable pointer for one dry-run report projection
scope_ref: project, field, device, or operation scope pointer
case_count: number of cases declared by the dry-run source
failed_case_count: number of failed dry-run cases reported by the dry-run source
matrix_preflight_ok: boolean copied from dry-run report source
sandbox_ack_observed: boolean copied from dry-run report source
report_hash: deterministic dry-run report hash pointer or value
operator_gate_ref: pointer to the operator gate read-model projection
operation_plan_ref: pointer to the operation plan referenced by the report
act_task_ref: pointer to the AO-ACT task referenced by the report
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
creates_task = false
creates_receipt = false
creates_acceptance = false
creates_roi = false
creates_field_memory = false
starts_adapter = false
updates_model = false
production_operation_claim = false
```

## Excluded judgment semantics

```text
risk_score
priority_score
recommendation
prescription
success_prediction
profit_prediction
performance_grade
```

## Changed files allowed in this task

```text
docs/tasks/P3-04-Dry-Run-Report-Read-Model-Planning.md
scripts/governance_acceptance/P3_04_DRY_RUN_REPORT_READ_MODEL_PLANNING.cjs
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P3_04_DRY_RUN_REPORT_READ_MODEL_PLANNING.cjs
```

## Expected result

```text
ok = true
acceptance = P3_04_DRY_RUN_REPORT_READ_MODEL_PLANNING
p3_03_verified = true
dry_run_report_read_model_verified = true
input_ref_count = 8
required_output_field_count = 15
allowed_state_count = 8
p3_04_started_as_planning_only = true
no_frontend_changed_by_this_task = true
no_runtime_changed_by_this_task = true
next_step = P3_05_OPERATOR_AUDIT_TRAIL_PLANNING
```
