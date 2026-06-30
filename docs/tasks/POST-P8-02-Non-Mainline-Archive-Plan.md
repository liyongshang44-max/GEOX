# docs/tasks/POST-P8-02-Non-Mainline-Archive-Plan.md

## Status

```text
Status: derived view
Authority source: docs/SSOT.md
Freeze source: README_MIGRATION.md
Previous gate: POST_P8_01_FREEZE_INDEX_AND_REFERENCE_AUDIT
```

## Purpose

POST-P8-02 turns the POST-P8-01 reference audit into an explicit archive plan.

This task still does not move or delete files. It produces a deterministic local plan from `docs/legacy/POST_P8_REFERENCE_AUDIT_REPORT.json`, separating candidates into current references, protected historical records, archive candidates, and unknown items that require manual inspection.

The purpose is to avoid arbitrary cleanup and make the first actual migration batch auditable.

## Required input

```text
docs/legacy/POST_P8_REFERENCE_AUDIT_REPORT.json
```

This report is generated locally by:

```powershell
node scripts/governance_acceptance/POST_P8_01_FREEZE_INDEX_AND_REFERENCE_AUDIT.cjs
```

## Generated output

```text
docs/legacy/POST_P8_NON_MAINLINE_ARCHIVE_PLAN.json
```

This generated output is local audit evidence. It should not be committed unless a later PR intentionally freezes a cleanup batch.

## Archive-plan rules

A candidate may enter the archive candidate list only when:

```text
strong_reference_count = 0
classification contains candidate_for_archive
file is not P8 current replay material
file is not POST-P8 convergence material
file is not server runtime
file is not frontend runtime
file is not database migration
```

## Non-goals

```text
no_delete
no_move
no_runtime_change
no_frontend_change
no_migration_change
no_package_json_change
no_ci_change
```

## Acceptance command

```powershell
node scripts/governance_acceptance/POST_P8_02_NON_MAINLINE_ARCHIVE_PLAN.cjs
```

## Expected result

```text
ok = true
acceptance = POST_P8_02_NON_MAINLINE_ARCHIVE_PLAN
archive_plan_generated = true
archive_candidate_count >= 0
manual_inspection_count >= 0
no_delete_performed = true
no_runtime_surface_changed = true
```

## Next step

```text
POST_P8_03_FIRST_ARCHIVE_MIGRATION_BATCH
```

POST-P8-03 may move the first small batch of archive candidates to `docs/legacy/` or `scripts/legacy/` only if POST-P8-02 produces explicit candidates and the migration acceptance verifies replacements.
