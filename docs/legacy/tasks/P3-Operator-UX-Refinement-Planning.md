# docs/tasks/P3-Operator-UX-Refinement-Planning.md

## Purpose

P3 begins as Operator UX Refinement Planning.

This task defines the operator-facing UX planning line after P2 real-adapter preparation. It does not implement UI or runtime behavior.

## Gate

```text
P3_OPERATOR_UX_REFINEMENT_PLANNING
```

## Entry condition

```text
P2 completion review is complete.
tag: p2_completion_review_before_p3
next_step from P2 review: P3_OPERATOR_UX_REFINEMENT_PLANNING
```

## Planning problem

The operator needs a controlled workflow view for pilot preparation and later supervised operation.

The UX should expose evidence, preflight state, human gate state, dry-run report state, and trace pointers without adding new judgment semantics.

## P3 task line

```text
P3-00 Operator UX Refinement Planning
P3-01 Operator Workflow Surface Inventory
P3-02 Operator Preflight Read Model Planning
P3-03 Operator Gate Read Model Planning
P3-04 Dry Run Report Read Model Planning
P3-05 Operator Audit Trail Planning
P3-06 Operator UX Negative Boundary Matrix
P3-07 Operator UX Completion Review Before P4
```

## Candidate surfaces

```text
operator workflow index
preflight status panel
gate state panel
dry-run report panel
trace pointer panel
audit trail panel
```

## UX invariants

```text
read_only_first = true
evidence_refs_required = true
trace_pointers_required = true
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

## Scope of this task

```text
docs/tasks/P3-Operator-UX-Refinement-Planning.md
scripts/governance_acceptance/P3_OPERATOR_UX_REFINEMENT_PLANNING.cjs
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P3_OPERATOR_UX_REFINEMENT_PLANNING.cjs
```

## Expected result

```text
ok = true
acceptance = P3_OPERATOR_UX_REFINEMENT_PLANNING
p2_completion_verified = true
p3_task_count = 8
p3_started_as_planning_only = true
no_frontend_changed_by_this_task = true
no_runtime_changed_by_this_task = true
next_step = P3_01_OPERATOR_WORKFLOW_SURFACE_INVENTORY
```
