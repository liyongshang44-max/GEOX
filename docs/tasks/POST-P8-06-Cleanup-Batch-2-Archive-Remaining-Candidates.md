# docs/tasks/POST-P8-06-Cleanup-Batch-2-Archive-Remaining-Candidates.md

## Status

```text
Status: derived view
Authority source: docs/SSOT.md
Freeze source: README_MIGRATION.md
Base cleanup gate: POST_P8_05_REPOSITORY_CONVERGENCE_COMPLETION_REVIEW
```

## Purpose

POST-P8-06 performs cleanup batch 2 after the post-P8 convergence PR.

Batch 1 proved that historical task documents can be moved to `docs/legacy/tasks/` while preserving content and without changing runtime surfaces. Batch 2 continues that cleanup against the remaining zero-strong-reference archive candidates from `docs/legacy/POST_P8_NON_MAINLINE_ARCHIVE_PLAN.json`.

## Scope

Batch 2 moves:

```text
remaining P4 historical task docs
P5 historical task docs
P6 historical task docs
P7 historical task docs
P7 offline replay scripts
```

Destinations:

```text
docs/legacy/tasks/
scripts/legacy/replay/
```

## Maintenance command

```powershell
node scripts/maintenance/POST_P8_06_ARCHIVE_BATCH_2.cjs
```

## Acceptance command

```powershell
node scripts/governance_acceptance/POST_P8_06_CLEANUP_BATCH_2_ACCEPTANCE.cjs
```

## Batch 2 candidates

```text
docs/tasks/P4-04-ROI-Negative-Boundary-Matrix.md
docs/tasks/P4-05-ROI-Completion-Review-Before-P5.md
docs/tasks/P4-Policy-Controlled-ROI-Planning.md
docs/tasks/P5-00-Policy-Controlled-Field-Memory-Governance-Planning.md
docs/tasks/P5-01-Field-Memory-Eligibility-Source-Boundary.md
docs/tasks/P5-02-Field-Memory-Policy-Gate-Contract.md
docs/tasks/P5-03-Field-Memory-Formalization-Output-Contract.md
docs/tasks/P5-04-Field-Memory-Negative-Boundary-Matrix.md
docs/tasks/P5-05-Field-Memory-Completion-Review-Before-P6.md
docs/tasks/P6-00-Execution-System-Integration-Planning.md
docs/tasks/P6-01-Execution-Source-Boundary.md
docs/tasks/P6-02-Execution-Authorization-Gate-Contract.md
docs/tasks/P6-03-Execution-Dispatch-Output-Contract.md
docs/tasks/P6-04-Execution-Receipt-Intake-Contract.md
docs/tasks/P6-05-Execution-Audit-Trace-Contract.md
docs/tasks/P6-06-Execution-Negative-Boundary-Matrix.md
docs/tasks/P6-07-Execution-Completion-Review.md
docs/tasks/P7-00-Twin-Kernel-Minimal-Runtime-Planning.md
docs/tasks/P7-01-Twin-Evidence-Window-Contract.md
docs/tasks/P7-02-Soil-Moisture-State-Estimate-v0.md
docs/tasks/P7-03-Prediction-Run-v0.md
docs/tasks/P7-04-Backtest-Error-Report-v0.md
docs/tasks/P7-05-Calibration-Report-v0.md
docs/tasks/P7-06-Replay-Experiment-Bundle-v0.md
docs/tasks/P7-07-Twin-Kernel-Completion-Review.md
scripts/twin_kernel/P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0.cjs
scripts/twin_kernel/P7_03_PREDICTION_RUN_V0.cjs
scripts/twin_kernel/P7_04_BACKTEST_ERROR_REPORT_V0.cjs
scripts/twin_kernel/P7_05_CALIBRATION_REPORT_V0.cjs
scripts/twin_kernel/P7_06_REPLAY_EXPERIMENT_BUNDLE_V0.cjs
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
acceptance = POST_P8_06_CLEANUP_BATCH_2_ACCEPTANCE
migrated_file_count = 30
docs_tasks_sources_absent = true
legacy_destinations_present = true
p8_current_material_intact = true
runtime_surface_unchanged = true
```

## Next step

```text
POST_P8_07_MANUAL_INSPECTION_CLASSIFICATION
```

After batch 2, archive-plan zero-reference candidates are exhausted. The next cleanup step should classify manual-inspection candidates such as H53/H54 docs, legacy PowerShell scripts, and old governance acceptance files before moving or deleting them.
