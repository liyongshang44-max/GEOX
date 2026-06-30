# docs/tasks/POST-P8-17.md

## Status

Status: apply gate recheck view

Previous gate: POST_P8_16_HISTORICAL_TASK_DOC_OWNER_CONFIRMATION_ACCEPTANCE

## Purpose

POST-P8-17 rechecks the historical_task_doc gate state after POST-P8-14, POST-P8-15, and POST-P8-16.

This task does not move files.

This task does not delete files.

This task does not change references.

This task only creates a recheck report.

## Commands

node scripts/maintenance/POST_P8_17_RECHECK_HISTORICAL_TASK_DOC_APPLY_GATE.cjs

node scripts/governance_acceptance/POST_P8_17_HISTORICAL_TASK_DOC_APPLY_GATE_RECHECK_ACCEPTANCE.cjs

## Expected result

owner_confirmation_recorded = true

preview_counts_matched = true

runtime_surface_diff_zero = false

post_update_audit_would_be_zero = false

archive_move_gate_separate = false

apply_gate_open = false

apply_allowed = false

failed_assertion_count = 0

## Next step

POST_P8_18_HISTORICAL_TASK_DOC_RUNTIME_SURFACE_DIFF_CHECK
