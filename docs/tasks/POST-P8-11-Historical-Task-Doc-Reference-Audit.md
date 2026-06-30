# docs/tasks/POST-P8-11-Historical-Task-Doc-Reference-Audit.md

## Status

```text
Status: audit view
Authority source: docs/SSOT.md
Freeze source: README_MIGRATION.md
Previous gate: POST_P8_10_GROUP_SCOPED_CLEANUP_PLAN_ACCEPTANCE
```

## Purpose

POST-P8-11 audits references for the selected POST-P8-10 group:

```text
historical_task_doc
```

This task does not move files. It does not delete files. It does not rewrite references. It only reports exact references from repository files to the 48 planned source files.

## Input

```text
docs/legacy/POST_P8_10_HISTORICAL_TASK_DOC_CLEANUP_PLAN.json
```

## Output

```text
docs/legacy/POST_P8_11_HISTORICAL_TASK_DOC_REFERENCE_AUDIT_REPORT.json
```

## Maintenance command

```powershell
node scripts/maintenance/POST_P8_11_AUDIT_HISTORICAL_TASK_DOC_REFERENCES.cjs
```

## Acceptance command

```powershell
node scripts/governance_acceptance/POST_P8_11_HISTORICAL_TASK_DOC_REFERENCE_AUDIT_ACCEPTANCE.cjs
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
audit_report_only
```

## Expected result

```text
ok = true
acceptance = POST_P8_11_HISTORICAL_TASK_DOC_REFERENCE_AUDIT_ACCEPTANCE
selected_group = historical_task_doc
audited_file_count = 48
move_now_allowed = false
failed_assertion_count = 0
```

## Next step

```text
POST_P8_12_HISTORICAL_TASK_DOC_ARCHIVE_DECISION
```

POST-P8-12 may decide whether a subset can move, based on the reference audit. It must not apply movement unless a separate move acceptance exists.
