# docs/tasks/POST-P8-13-Historical-Task-Doc-Reference-Update-Plan.md

## Status

```text
Status: plan view
Previous gate: POST_P8_12_HISTORICAL_TASK_DOC_ARCHIVE_DECISION_ACCEPTANCE
```

## Purpose

POST-P8-13 creates a deterministic reference update plan for the selected group:

```text
historical_task_doc
```

POST-P8-12 concluded that all 48 planned files are blocked by exact references. Therefore this task creates a future update plan only.

This task does not move files. It does not delete files. It does not change references.

## Input

```text
docs/legacy/POST_P8_11_HISTORICAL_TASK_DOC_REFERENCE_AUDIT_REPORT.json
docs/legacy/POST_P8_12_HISTORICAL_TASK_DOC_ARCHIVE_DECISION_REPORT.json
```

## Output

```text
docs/legacy/POST_P8_13_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PLAN.json
```

## Commands

```powershell
node scripts/maintenance/POST_P8_13_PLAN_HISTORICAL_TASK_DOC_REFERENCE_UPDATE.cjs
node scripts/governance_acceptance/POST_P8_13_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PLAN_ACCEPTANCE.cjs
```

## Expected result

```text
ok = true
selected_group = historical_task_doc
reference_update_file_count = 48
reference_update_exact_reference_count = 585
reference_update_apply_allowed = false
failed_assertion_count = 0
```

## Next step

```text
POST_P8_14_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_APPLY_GATE
```
