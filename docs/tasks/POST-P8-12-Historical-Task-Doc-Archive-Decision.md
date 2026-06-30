# docs/tasks/POST-P8-12-Historical-Task-Doc-Archive-Decision.md

## Status

```text
Status: decision view
Authority source: docs/SSOT.md
Freeze source: README_MIGRATION.md
Previous gate: POST_P8_11_HISTORICAL_TASK_DOC_REFERENCE_AUDIT_ACCEPTANCE
```

## Purpose

POST-P8-12 converts the POST-P8-11 reference audit into a deterministic archive decision for the selected group:

```text
historical_task_doc
```

The audit result shows every planned file still has exact references. Therefore this task must not authorize movement.

This task does not move files. It does not delete files. It does not rewrite references. It only records the decision boundary.

## Input

```text
docs/legacy/POST_P8_11_HISTORICAL_TASK_DOC_REFERENCE_AUDIT_REPORT.json
```

## Output

```text
docs/legacy/POST_P8_12_HISTORICAL_TASK_DOC_ARCHIVE_DECISION_REPORT.json
```

## Maintenance command

```powershell
node scripts/maintenance/POST_P8_12_DECIDE_HISTORICAL_TASK_DOC_ARCHIVE.cjs
```

## Acceptance command

```powershell
node scripts/governance_acceptance/POST_P8_12_HISTORICAL_TASK_DOC_ARCHIVE_DECISION_ACCEPTANCE.cjs
```

## Boundary

```text
no_file_move
no_delete
no_reference_rewrite
no_runtime_change
no_frontend_change
no_database_change
no_package_or_ci_change
decision_report_only
```

## Expected result

```text
ok = true
acceptance = POST_P8_12_HISTORICAL_TASK_DOC_ARCHIVE_DECISION_ACCEPTANCE
selected_group = historical_task_doc
decision_file_count = 48
blocked_by_exact_reference_count = 48
archive_move_allowed = false
failed_assertion_count = 0
```

## Next step

```text
POST_P8_13_HISTORICAL_TASK_DOC_REFERENCE_REWRITE_PLAN
```

POST-P8-13 may create a reference rewrite plan. It must still not rewrite references or move files until a separate apply gate exists.
