# docs/tasks/POST-P8-00-Repository-Convergence-Planning.md

## Status

```text
Status: derived view
Authority source: docs/SSOT.md
Freeze source: README_MIGRATION.md
```

## Purpose

This task starts the post-P8 repository convergence pass.

The goal is to reduce handoff pollution before P9 begins. The repository already contains production-shaped server runtime assets, persisted Twin Kernel assets, offline P8 replay assets, historical Sprint material, governance acceptance scripts, frontend pages, and commercial pilot gates. Without a convergence layer, future implementers may treat historical files as current entrypoints or mix the persisted Twin Kernel line with the offline replay line.

This task does not delete code, does not move runtime files, does not change frontend, does not change server routes, and does not change database migrations. It creates clear current-entry maps and marks non-mainline material for later classification before any deletion is attempted.

## Problems addressed

```text
problem_1 = too_many_repository_entrypoints
problem_2 = twin_kernel_lineage_split_between_server_persisted_kernel_and_offline_p8_replay
problem_3 = historical_docs_and_scripts_are_not_classified_for_handoff
problem_4 = deletion_without_reference_audit_would_be_unsafe
```

## Convergence scope

```text
create_repository_handoff_map
create_twin_kernel_domain_reference
create_scripts_entry_guides
create_non_mainline_candidate_inventory
create_acceptance_gate_for_convergence_docs
```

## Non-goals

```text
no_runtime_semantic_change
no_server_route_change
no_frontend_change
no_database_migration
no_script_deletion_yet
no_document_deletion_yet
no_ci_rewiring_yet
no_new_repository_level_ssot
```

## Deletion policy

Files may be deleted only after a later acceptance proves all of the following:

```text
not_imported_by_runtime
not_referenced_by_package_json
not_referenced_by_github_actions
not_referenced_by_current_acceptance_entrypoints
not_referenced_by_docs_ssot
not_referenced_by_readme_migration_as_freeze_evidence
replacement_or_archive_path_declared
```

## Expected outputs

```text
docs/REPOSITORY_HANDOFF_MAP.md
docs/twin_kernel/README.md
docs/legacy/POST_P8_NON_MAINLINE_CANDIDATES.md
scripts/README.md
scripts/twin_kernel/README.md
scripts/governance_acceptance/POST_P8_REPOSITORY_CONVERGENCE_ACCEPTANCE.cjs
```

## Acceptance command

```powershell
node scripts/governance_acceptance/POST_P8_REPOSITORY_CONVERGENCE_ACCEPTANCE.cjs
```

## Completion criteria

```text
ok = true
acceptance = POST_P8_REPOSITORY_CONVERGENCE_ACCEPTANCE
handoff_map_present = true
twin_lineage_reference_present = true
script_entry_guides_present = true
non_mainline_candidate_inventory_present = true
no_competing_ssot_created = true
no_runtime_surface_changed = true
```
