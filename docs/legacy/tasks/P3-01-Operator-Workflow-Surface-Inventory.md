# docs/tasks/P3-01-Operator-Workflow-Surface-Inventory.md

## Purpose

P3-01 records the operator workflow surface inventory.

This task is an inventory and planning task only. It identifies candidate operator-facing workflow surfaces, their input references, output shape, evidence requirements, and governance boundaries. It does not implement UI or runtime behavior.

## Gate

```text
P3_01_OPERATOR_WORKFLOW_SURFACE_INVENTORY
```

## Entry condition

```text
P3_OPERATOR_UX_REFINEMENT_PLANNING is complete.
next_step from P3 planning: P3_01_OPERATOR_WORKFLOW_SURFACE_INVENTORY
```

## Inventory scope

```text
docs/tasks/P3-01-Operator-Workflow-Surface-Inventory.md
scripts/governance_acceptance/P3_01_OPERATOR_WORKFLOW_SURFACE_INVENTORY.cjs
```

## Candidate surfaces

### operator_workflow_index

```text
surface_id: operator_workflow_index
surface_kind: index
status: candidate
primary_use: show operator workflow entries by trace pointer
input_refs: production_ingestion_event_ref, decision_cycle_ref, operation_plan_ref, act_task_ref
output_shape: read_only_rows
required_fields: workflow_id, scope_ref, stage, evidence_refs, trace_refs, updated_at
boundary: no ranking, no scoring, no action trigger
```

### preflight_status_panel

```text
surface_id: preflight_status_panel
surface_kind: panel
status: candidate
primary_use: show preflight readiness facts before supervised pilot flow
input_refs: matrix_result_ref, adapter_manifest_ref, sandbox_harness_ref
output_shape: read_only_status_block
required_fields: preflight_ref, checked_at, check_result, evidence_refs, trace_refs
boundary: no risk label, no priority label, no recommendation
```

### operator_gate_panel

```text
surface_id: operator_gate_panel
surface_kind: panel
status: candidate
primary_use: show explicit human gate fields and approval pointers
input_refs: operator_ref, approval_ref, operation_plan_ref, act_task_ref
output_shape: read_only_gate_block
required_fields: operator_id, gate_state, attestation_ref, approval_ref, trace_refs
boundary: no implicit approval, no default approval, no auto submission
```

### dry_run_report_panel

```text
surface_id: dry_run_report_panel
surface_kind: panel
status: candidate
primary_use: show dry-run report facts and loopback result pointers
input_refs: dry_run_report_ref, deterministic_hash_ref, sandbox_ack_ref
output_shape: read_only_report_block
required_fields: dry_run_ref, matrix_preflight_ok, sandbox_ack_observed, report_hash, trace_refs
boundary: no success prediction, no performance grade, no production execution claim
```

### trace_pointer_panel

```text
surface_id: trace_pointer_panel
surface_kind: panel
status: candidate
primary_use: show evidence and trace references without interpretation
input_refs: evidence_ref, trace_ref, source_ref
output_shape: pointer_list
required_fields: ref_kind, ref_id, source, created_at
boundary: no semantic rewrite, no summarization, no derived judgment
```

### audit_trail_panel

```text
surface_id: audit_trail_panel
surface_kind: panel
status: candidate
primary_use: show chronological operator-visible events for replay
input_refs: workflow_event_ref, operator_gate_ref, dry_run_report_ref
output_shape: chronological_rows
required_fields: event_ref, event_type, occurred_at, actor_ref, trace_refs
boundary: no causal explanation, no blame assignment, no hidden ordering rule
```

## Inventory invariants

```text
surface_count = 6
read_only_inventory = true
evidence_refs_required = true
trace_refs_required = true
pointer_first = true
operator_gate_visible = true
dry_run_report_visible = true
new_judgment_semantics = false
```

## Planning boundary ledger

```text
frontend_changed_by_this_task = false
runtime_changed_by_this_task = false
route_changed_by_this_task = false
db_changed_by_this_task = false
scheduler_changed_by_this_task = false
model_changed_by_this_task = false
live_operation_authorized_by_this_task = false
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P3_01_OPERATOR_WORKFLOW_SURFACE_INVENTORY.cjs
```

## Expected result

```text
ok = true
acceptance = P3_01_OPERATOR_WORKFLOW_SURFACE_INVENTORY
p3_planning_verified = true
surface_inventory_verified = true
surface_count = 6
p3_01_started_as_inventory_only = true
no_frontend_changed_by_this_task = true
no_runtime_changed_by_this_task = true
next_step = P3_02_OPERATOR_PREFLIGHT_READ_MODEL_PLANNING
```
