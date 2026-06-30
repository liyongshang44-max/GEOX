# docs/tasks/POST-P8-09-Manual-Review-Group-Decision.md

## Status

```text
Status: decision view
Authority source: docs/SSOT.md
Freeze source: README_MIGRATION.md
Previous gate: POST_P8_08_MANUAL_REVIEW_CLASSIFICATION_ACCEPTANCE_SAFE
```

## Purpose

POST-P8-09 converts the POST-P8-08 manual-review classification report into group-level cleanup decisions.

This task does not move files. It does not delete files. It does not rewrite references. Its only output is a deterministic decision report that says which groups are protected, which groups require split review, and which groups may become later archive candidates under stricter gates.

## Input

```text
docs/legacy/POST_P8_MANUAL_REVIEW_CLASSIFICATION_REPORT.json
```

## Output

```text
docs/legacy/POST_P8_MANUAL_REVIEW_GROUP_DECISION_REPORT.json
```

## Decision categories

```text
protect_no_move
keep_pending_owner_review
archive_candidate_after_reference_audit
split_required_before_action
```

## Maintenance command

```powershell
node scripts/maintenance/POST_P8_09_DECIDE_MANUAL_REVIEW_GROUPS.cjs
```

## Acceptance command

```powershell
node scripts/governance_acceptance/POST_P8_09_MANUAL_REVIEW_GROUP_DECISION_ACCEPTANCE.cjs
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
acceptance = POST_P8_09_MANUAL_REVIEW_GROUP_DECISION_ACCEPTANCE
decision_report_generated = true
source_group_count = decision_group_count
archive_now_count = 0
protected_anchor_decision_verified = true
unknown_group_split_required = true
failed_assertion_count = 0
```

## Next step

```text
POST_P8_10_GROUP_SCOPED_CLEANUP_PLAN
```

POST-P8-10 may choose one low-risk group and design a group-scoped plan. It must not restart broad automatic migration.
