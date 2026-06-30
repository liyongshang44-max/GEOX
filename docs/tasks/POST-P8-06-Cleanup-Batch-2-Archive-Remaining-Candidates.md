# docs/tasks/POST-P8-06-Repository-Wide-Cleanup-Engine.md

## Status

```text
Status: derived view
Authority source: docs/SSOT.md
Freeze source: README_MIGRATION.md
Base cleanup gate: POST_P8_05_REPOSITORY_CONVERGENCE_COMPLETION_REVIEW
```

## Purpose

POST-P8-06 replaces manual batch cleanup with a repository-wide cleanup engine.

The previous batch-by-batch approach is too slow for the current repository. The repository contains many historical docs, old acceptance scripts, old PowerShell smoke scripts, delivery artifacts, replay prototypes, and domain-specific records. A fixed 20-file or 30-file migration list does not scale.

This task introduces a mechanical cleanup planner that scans the whole tracked repository and produces a policy-driven cleanup plan.

## Method

```text
1. Read git-tracked files from git ls-files.
2. Read strong entrypoints: package.json, .github workflows, docs/SSOT.md, README_MIGRATION.md, README.md, handoff docs, script guides, and acceptance runner.
3. Scan all text files for exact-path references.
4. Classify every file into keep, archive, delete, or manual_review.
5. Generate docs/legacy/POST_P8_REPO_WIDE_CLEANUP_PLAN.json.
6. Optionally apply archive moves using the generated plan.
```

## Policy

```text
keep:
  - server runtime
  - frontend runtime
  - packages
  - database migrations
  - package.json and CI
  - docs/SSOT.md
  - README_MIGRATION.md
  - current P8 docs/scripts
  - current POST-P8 convergence docs/scripts
  - docs/REPOSITORY_HANDOFF_MAP.md
  - docs/twin_kernel/README.md

archive:
  - historical docs/tasks not current and not referenced by current files
  - old replay scripts not current and not referenced by current files
  - old PowerShell acceptance scripts not referenced by current files
  - delivery scripts/docs not referenced by current files

delete:
  - generated/cache/build artifacts if tracked and not referenced
  - empty obsolete placeholder files if tracked and not referenced

manual_review:
  - files with current references
  - unknown domain docs
  - old governance acceptance scripts with uncertain semantics
  - frontend pages/routes
  - server routes/modules
```

## Scripts

```text
scripts/maintenance/POST_P8_06_REPO_WIDE_CLEANUP_PLAN.cjs
scripts/maintenance/POST_P8_06_APPLY_REPO_WIDE_CLEANUP_PLAN.cjs
scripts/governance_acceptance/POST_P8_06_REPO_WIDE_CLEANUP_ENGINE_ACCEPTANCE.cjs
```

## Commands

Generate plan:

```powershell
node scripts/maintenance/POST_P8_06_REPO_WIDE_CLEANUP_PLAN.cjs
```

Apply archive plan:

```powershell
node scripts/maintenance/POST_P8_06_APPLY_REPO_WIDE_CLEANUP_PLAN.cjs --apply
```

Acceptance:

```powershell
node scripts/governance_acceptance/POST_P8_06_REPO_WIDE_CLEANUP_ENGINE_ACCEPTANCE.cjs
```

## Boundary

```text
no_server_runtime_change
no_frontend_change
no_database_migration_change
no_package_json_change
no_ci_change
no_current_p8_material_moved
no_current_twin_kernel_material_moved
no_current_p8_acceptance_moved
```

## Expected result

```text
ok = true
acceptance = POST_P8_06_REPO_WIDE_CLEANUP_ENGINE_ACCEPTANCE
repo_wide_plan_generated = true
tracked_file_count > 0
archive_candidate_count > 0
protected_current_material_verified = true
runtime_surface_unchanged = true
```

## Next step

```text
POST_P8_07_REPO_WIDE_CLEANUP_APPLICATION_REVIEW
```

After the whole-repo plan is generated, the next step should apply all low-risk archive moves in one migration rather than continuing manual small batches.
