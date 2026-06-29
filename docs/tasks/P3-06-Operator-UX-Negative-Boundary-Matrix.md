# docs/tasks/P3-06-Operator-UX-Negative-Boundary-Matrix.md

## Purpose

P3-06 records the Operator UX Negative Boundary Matrix.

This task consolidates the negative UX boundaries for the operator workflow surfaces defined in P3. It is a planning and governance matrix only. It does not implement UI, routes, database objects, scheduler behavior, adapter calls, writes, or operation behavior.

## Gate

```text
P3_06_OPERATOR_UX_NEGATIVE_BOUNDARY_MATRIX
```

## Entry condition

```text
P3_05_OPERATOR_AUDIT_TRAIL_PLANNING is complete.
next_step from P3-05: P3_06_OPERATOR_UX_NEGATIVE_BOUNDARY_MATRIX
```

## Covered surfaces

```text
operator_workflow_index
preflight_status_panel
operator_gate_panel
dry_run_report_panel
trace_pointer_panel
audit_trail_panel
```

## Matrix entries

```text
M01: no runtime route is introduced by P3 UX planning
M02: no frontend component is introduced by P3 UX planning
M03: no database table or migration is introduced by P3 UX planning
M04: no write path is authorized from any operator surface
M05: no task creation is authorized from any operator surface
M06: no receipt creation is authorized from any operator surface
M07: no ranking, scoring, or priority ordering is authorized
M08: no risk, severity, recommendation, or prescription label is authorized
M09: no hidden ordering rule is authorized
M10: no causal explanation or blame assignment is authorized
M11: no evidence pointer rewrite is authorized
M12: no production operation claim is authorized
```

## Required positive boundaries

```text
read_only_projection_required = true
operator_visible_required = true
evidence_refs_required = true
trace_refs_required = true
explicit_display_order_required = true
pointer_first_required = true
```

## Surface-to-matrix coverage

```text
operator_workflow_index: M01,M02,M03,M04,M07,M08,M09,M11
preflight_status_panel: M01,M02,M03,M04,M05,M07,M08,M11
operator_gate_panel: M01,M02,M03,M04,M05,M07,M08,M11
dry_run_report_panel: M01,M02,M03,M04,M07,M08,M10,M12
trace_pointer_panel: M01,M02,M03,M04,M08,M10,M11
audit_trail_panel: M01,M02,M03,M04,M07,M09,M10,M11
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

## Changed files allowed in this task

```text
docs/tasks/P3-06-Operator-UX-Negative-Boundary-Matrix.md
scripts/governance_acceptance/P3_06_OPERATOR_UX_NEGATIVE_BOUNDARY_MATRIX.cjs
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P3_06_OPERATOR_UX_NEGATIVE_BOUNDARY_MATRIX.cjs
```

## Expected result

```text
ok = true
acceptance = P3_06_OPERATOR_UX_NEGATIVE_BOUNDARY_MATRIX
p3_05_verified = true
operator_ux_negative_matrix_verified = true
surface_count = 6
matrix_entry_count = 12
coverage_row_count = 6
p3_06_started_as_planning_only = true
no_frontend_changed_by_this_task = true
no_runtime_changed_by_this_task = true
next_step = P3_07_OPERATOR_UX_COMPLETION_REVIEW_BEFORE_P4
```
