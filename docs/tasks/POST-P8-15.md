# docs/tasks/POST-P8-15.md

## Status

```text
Status: preview view
Previous gate: POST_P8_14_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_APPLY_GATE_ACCEPTANCE
```

## Purpose

POST-P8-15 creates a report from the POST-P8-13 plan and POST-P8-14 gate.

## Commands

```powershell
node scripts/maintenance/POST_P8_15_PREVIEW_HISTORICAL_TASK_DOC_REFERENCE_UPDATE.cjs
node scripts/governance_acceptance/POST_P8_15_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PREVIEW_ACCEPTANCE.cjs
```

## Expected result

```text
ok = true
selected_group = historical_task_doc
reference_update_file_count = 48
reference_update_plan_item_count = 371
expected_exact_reference_count = 585
observed_exact_reference_count = 585
affected_referencing_file_count = 75
apply_allowed = false
failed_assertion_count = 0
```
