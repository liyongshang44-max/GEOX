# docs/tasks/POST-P8-08-Manual-Review-Classification-Plan.md

## Status

```text
Status: derived view
Authority source: docs/SSOT.md
Freeze source: README_MIGRATION.md
Previous gate: POST_P8_07_REPO_WIDE_CLEANUP_APPLICATION_REVIEW
```

## Purpose

POST-P8-08 classifies the remaining repository cleanup `manual_review` set after the low-risk cleanup batch.

POST-P8-06 introduced the repo-wide cleanup engine. POST-P8-07 verified the first applied low-risk archive batch. The remaining set is not safe for automatic movement. This task generates a deterministic classification report so later cleanup passes can be scoped by group rather than by ad-hoc file picking.

## Input

```text
docs/legacy/POST_P8_REPO_WIDE_CLEANUP_PLAN.json
```

## Output

```text
docs/legacy/POST_P8_MANUAL_REVIEW_CLASSIFICATION_REPORT.json
```

The output is generated locally by the maintenance script and should be committed as cleanup planning evidence once reviewed.

## Classification groups

```text
runtime_surface
frontend_surface
database_or_migration
package_or_ci
current_governance_acceptance
current_p8_or_twin_anchor
domain_reference_doc
historical_governance_acceptance
historical_task_doc
generated_or_legacy_evidence
unknown_manual_review
```

## Maintenance command

```powershell
node scripts/maintenance/POST_P8_08_CLASSIFY_MANUAL_REVIEW_SET.cjs
```

## Acceptance command

```powershell
node scripts/governance_acceptance/POST_P8_08_MANUAL_REVIEW_CLASSIFICATION_ACCEPTANCE.cjs
```

## Boundary

```text
no_file_move
no_delete
no_runtime_change
no_frontend_change
no_database_change
no_package_or_ci_change
no_acceptance_rewire
classification_only
```

## Expected result

```text
ok = true
acceptance = POST_P8_08_MANUAL_REVIEW_CLASSIFICATION_ACCEPTANCE
manual_review_report_generated = true
manual_review_count > 0
classified_manual_review_count = manual_review_count
runtime_surface_group_present = true
current_anchor_group_present = true
historical_group_present = true
no_runtime_surface_changed = true
```

## Next step

```text
POST_P8_09_MANUAL_REVIEW_GROUP_DECISION
```

POST-P8-09 should decide which groups become protected, which groups are archive candidates with stricter policy, and which groups remain in place.
