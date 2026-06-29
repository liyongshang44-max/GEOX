# docs/tasks/P3-02-Operator-Preflight-Read-Model-Planning.md

## Purpose

P3-02 records the Operator Preflight Read Model Planning boundary.

This task defines the read-only preflight model that an operator surface may later display before supervised pilot flow. It does not implement a route, component, database object, scheduler, adapter call, or execution path.

## Gate

```text
P3_02_OPERATOR_PREFLIGHT_READ_MODEL_PLANNING
```

## Entry condition

```text
P3_01_OPERATOR_WORKFLOW_SURFACE_INVENTORY is complete.
next_step from P3-01: P3_02_OPERATOR_PREFLIGHT_READ_MODEL_PLANNING
```

## Read model identity

```text
read_model_id: operator_preflight_read_model_v0
read_model_kind: planning_contract
surface_ref: preflight_status_panel
mode: read_only
status: candidate
```

## Input references

```text
adapter_capability_manifest_ref
adapter_registry_audit_ref
negative_runtime_matrix_ref
sandbox_harness_ref
operator_gate_schema_ref
dry_run_harness_ref
operation_plan_ref
act_task_ref
```

## Required output fields

```text
preflight_ref
scope_ref
adapter_type
action_type
operator_gate_required
matrix_preflight_required
sandbox_ack_required
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
BLOCKED_MISSING_REFERENCE
BLOCKED_SCHEMA_MISMATCH
BLOCKED_MATRIX_FAILURE
BLOCKED_SANDBOX_FAILURE
```

## Field semantics

```text
preflight_ref: stable pointer for one read-model projection
scope_ref: project, field, device, or operation scope pointer
adapter_type: adapter family string from capability manifest
action_type: intended operator-visible action category
operator_gate_required: boolean showing whether human gate fields are required
matrix_preflight_required: boolean showing whether negative runtime matrix must be available
sandbox_ack_required: boolean showing whether loopback sandbox acknowledgement is required
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
```

## Excluded semantics

```text
risk_score
priority_score
recommendation
prescription
approval_default
auto_submit
auto_dispatch
success_prediction
profit_prediction
```

## Changed files allowed in this task

```text
docs/tasks/P3-02-Operator-Preflight-Read-Model-Planning.md
scripts/governance_acceptance/P3_02_OPERATOR_PREFLIGHT_READ_MODEL_PLANNING.cjs
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P3_02_OPERATOR_PREFLIGHT_READ_MODEL_PLANNING.cjs
```

## Expected result

```text
ok = true
acceptance = P3_02_OPERATOR_PREFLIGHT_READ_MODEL_PLANNING
p3_01_verified = true
preflight_read_model_verified = true
input_ref_count = 8
required_output_field_count = 12
allowed_state_count = 6
p3_02_started_as_planning_only = true
no_frontend_changed_by_this_task = true
no_runtime_changed_by_this_task = true
next_step = P3_03_OPERATOR_GATE_READ_MODEL_PLANNING
```
