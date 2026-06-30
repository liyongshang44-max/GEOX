# docs/tasks/POST-P8-18.md

## Status

Status: apply bundle

Previous gate: POST_P8_17_HISTORICAL_TASK_DOC_APPLY_GATE_RECHECK_ACCEPTANCE

## Purpose

POST-P8-18 applies the historical_task_doc reference update bundle.

This task updates exact references from the POST-P8-13 plan, moves the 48 selected historical task documents to their planned destinations, and writes one apply report.

## Commands

node scripts/maintenance/POST_P8_18_APPLY_HISTORICAL_TASK_DOC_BUNDLE.cjs

node scripts/governance_acceptance/POST_P8_18_HISTORICAL_TASK_DOC_APPLY_BUNDLE_ACCEPTANCE.cjs

## Expected result

moved_file_count = 48

reference_update_plan_item_count = 371

old_exact_reference_count_after = 0

new_exact_reference_count_after = 585

missing_destination_file_count = 0

remaining_source_file_count = 0

runtime_surface_diff_count = 0

failed_assertion_count = 0
