# docs/tasks/POST-P8-10-Group-Scoped-Cleanup-Plan.md

## Status

```text
Status: plan view
Authority source: docs/SSOT.md
Freeze source: README_MIGRATION.md
Previous gate: POST_P8_09_GROUP_DECISION_ACCEPTANCE_SAFE
```

## Purpose

POST-P8-10 creates a group-scoped cleanup plan for exactly one low-risk group from the POST-P8-09 decision report.

This task selects:

```text
historical_task_doc
```

Reason:

```text
POST-P8-09 decision = archive_candidate_after_reference_audit
file_count = 48
archive_now_allowed = false
```

This task does not move files. It does not delete files. It does not rewrite references. It only creates a deterministic plan for later review.

## Input

```text
docs/legacy/POST_P8_MANUAL_REVIEW_CLASSIFICATION_REPORT.json
docs/legacy/POST_P8_MANUAL_REVIEW_GROUP_DECISION_REPORT.json
```

## Output

```text
docs/legacy/POST_P8_10_HISTORICAL_TASK_DOC_CLEANUP_PLAN.json
```

## Maintenance command

```powershell
node scripts/maintenance/POST_P8_10_PLAN_HISTORICAL_TASK_DOC_CLEANUP.cjs
```

## Acceptance command

```powershell
node scripts/governance_acceptance/POST_P8_10_GROUP_SCOPED_CLEANUP_PLAN_ACCEPTANCE.cjs
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
plan_only
```

## Expected result

```text
ok = true
acceptance = POST_P8_10_GROUP_SCOPED_CLEANUP_PLAN_ACCEPTANCE
selected_group = historical_task_doc
planned_file_count = 48
apply_now_allowed = false
failed_assertion_count = 0
```

## Next step

```text
POST_P8_11_HISTORICAL_TASK_DOC_REFERENCE_AUDIT
```

POST-P8-11 may audit exact references for the selected group. It must still not move files until the reference audit passes.
