# docs/tasks/POST-P8-07-Repo-Wide-Cleanup-Application-Review.md

## Status

```text
Status: derived view
Authority source: docs/SSOT.md
Freeze source: README_MIGRATION.md
Previous gate: POST_P8_06_REPO_WIDE_CLEANUP_ENGINE_ACCEPTANCE
```

## Purpose

POST-P8-07 verifies the applied repository-wide low-risk cleanup batch.

POST-P8-06 verifies the cleanup engine and generated plan. POST-P8-07 verifies the actual application result after `POST_P8_06_APPLY_REPO_WIDE_CLEANUP_PLAN.cjs --apply` has moved the safe archive candidates.

## Applied batch

```text
safe_candidate_count = 42
legacy_task_doc_moves = 6
legacy_powershell_script_moves = 32
legacy_delivery_script_moves = 4
```

## Required evidence

```text
docs/legacy/POST_P8_REPO_WIDE_CLEANUP_PLAN.json
```

## Acceptance command

```powershell
node scripts/governance_acceptance/POST_P8_07_REPO_WIDE_CLEANUP_APPLICATION_REVIEW.cjs
```

## Expected result

```text
ok = true
acceptance = POST_P8_07_REPO_WIDE_CLEANUP_APPLICATION_REVIEW
applied_candidate_count = 42
sources_absent = true
destinations_present = true
current_anchors_intact = true
runtime_surface_unchanged = true
repo_wide_cleanup_application_verified = true
```

## Boundary

```text
no_apps_change
no_packages_change
no_db_change
no_ci_change
no_package_json_change
no_current_p8_material_moved
no_current_twin_kernel_material_moved
no_governance_acceptance_scripts_moved
```

## Next step

```text
POST_P8_08_MANUAL_REVIEW_CLASSIFICATION_PLAN
```

After this gate, the next cleanup pass should not expand automatic migration. It should classify the remaining manual-review set and decide whether specific groups should become protected, archived with script rewrites, or left in place.
