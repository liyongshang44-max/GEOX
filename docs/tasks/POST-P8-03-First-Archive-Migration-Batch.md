# docs/tasks/POST-P8-03-First-Archive-Migration-Batch.md

## Status

```text
Status: derived view
Authority source: docs/SSOT.md
Freeze source: README_MIGRATION.md
Previous gate: POST_P8_02_NON_MAINLINE_ARCHIVE_PLAN
```

## Purpose

POST-P8-03 performs the first small archive migration batch for historical non-mainline task documents.

This task migrates only historical `docs/tasks/P1-*` through early `P4-*` task documents that POST-P8-02 selected as archive candidates with zero strong references.

The migration preserves file contents by moving files locally from `docs/tasks/` to `docs/legacy/tasks/`. It does not rewrite historical document bodies.

## Migration script

```powershell
node scripts/maintenance/POST_P8_03_ARCHIVE_FIRST_BATCH.cjs
```

## Acceptance command

```powershell
node scripts/governance_acceptance/POST_P8_03_FIRST_ARCHIVE_MIGRATION_BATCH.cjs
```

## First batch

```text
docs/tasks/P1-Completion-Review-Before-P2.md -> docs/legacy/tasks/P1-Completion-Review-Before-P2.md
docs/tasks/P2-01-Adapter-Contract-Reconciliation.md -> docs/legacy/tasks/P2-01-Adapter-Contract-Reconciliation.md
docs/tasks/P2-02-Adapter-Capability-Manifest-and-Registry-Audit.md -> docs/legacy/tasks/P2-02-Adapter-Capability-Manifest-and-Registry-Audit.md
docs/tasks/P2-03-Safe-Real-Adapter-Sandbox-Harness.md -> docs/legacy/tasks/P2-03-Safe-Real-Adapter-Sandbox-Harness.md
docs/tasks/P2-04-Production-Ingestion-Adapter-Boundary.md -> docs/legacy/tasks/P2-04-Production-Ingestion-Adapter-Boundary.md
docs/tasks/P2-05-Real-Adapter-Negative-Runtime-Matrix.md -> docs/legacy/tasks/P2-05-Real-Adapter-Negative-Runtime-Matrix.md
docs/tasks/P2-06-Operator-Controlled-Pilot-Dry-Run.md -> docs/legacy/tasks/P2-06-Operator-Controlled-Pilot-Dry-Run.md
docs/tasks/P2-Completion-Review-Before-P3.md -> docs/legacy/tasks/P2-Completion-Review-Before-P3.md
docs/tasks/P2-Real-Adapter-Integration-Planning.md -> docs/legacy/tasks/P2-Real-Adapter-Integration-Planning.md
docs/tasks/P3-01-Operator-Workflow-Surface-Inventory.md -> docs/legacy/tasks/P3-01-Operator-Workflow-Surface-Inventory.md
docs/tasks/P3-02-Operator-Preflight-Read-Model-Planning.md -> docs/legacy/tasks/P3-02-Operator-Preflight-Read-Model-Planning.md
docs/tasks/P3-03-Operator-Gate-Read-Model-Planning.md -> docs/legacy/tasks/P3-03-Operator-Gate-Read-Model-Planning.md
docs/tasks/P3-04-Dry-Run-Report-Read-Model-Planning.md -> docs/legacy/tasks/P3-04-Dry-Run-Report-Read-Model-Planning.md
docs/tasks/P3-05-Operator-Audit-Trail-Planning.md -> docs/legacy/tasks/P3-05-Operator-Audit-Trail-Planning.md
docs/tasks/P3-06-Operator-UX-Negative-Boundary-Matrix.md -> docs/legacy/tasks/P3-06-Operator-UX-Negative-Boundary-Matrix.md
docs/tasks/P3-07-Operator-UX-Completion-Review-Before-P4.md -> docs/legacy/tasks/P3-07-Operator-UX-Completion-Review-Before-P4.md
docs/tasks/P3-Operator-UX-Refinement-Planning.md -> docs/legacy/tasks/P3-Operator-UX-Refinement-Planning.md
docs/tasks/P4-01-ROI-Source-Boundary-Reconciliation.md -> docs/legacy/tasks/P4-01-ROI-Source-Boundary-Reconciliation.md
docs/tasks/P4-02-ROI-Policy-Gate-Contract.md -> docs/legacy/tasks/P4-02-ROI-Policy-Gate-Contract.md
docs/tasks/P4-03-ROI-Read-Model-Output-Contract.md -> docs/legacy/tasks/P4-03-ROI-Read-Model-Output-Contract.md
```

## Boundary

```text
no_server_runtime_change
no_frontend_change
no_database_migration_change
no_package_json_change
no_ci_change
no_content_rewrite
no_current_p8_material_moved
no_current_twin_kernel_material_moved
```

## Expected result

```text
ok = true
acceptance = POST_P8_03_FIRST_ARCHIVE_MIGRATION_BATCH
migrated_file_count = 20
source_paths_absent = true
destination_paths_present = true
no_runtime_surface_changed = true
```

## Next step

```text
POST_P8_04_FREEZE_INDEX_PATCH
```

The next step should register the P8 freeze snapshot in `README_MIGRATION.md` after this first archive batch proves the cleanup process is safe.
