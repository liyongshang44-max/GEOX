# docs/tasks/POST-P8-04-Freeze-Index-Patch.md

## Status

```text
Status: derived view
Authority source: docs/SSOT.md
Freeze source: README_MIGRATION.md
Previous gate: POST_P8_03_FIRST_ARCHIVE_MIGRATION_BATCH
```

## Purpose

POST-P8-04 patches `README_MIGRATION.md` with the P8 freeze snapshot.

This task uses a local append-only maintenance script instead of a remote full-file rewrite. The goal is to avoid corrupting the existing migration/freeze index while still satisfying the freeze-index requirement.

## Maintenance command

```powershell
node scripts/maintenance/POST_P8_04_PATCH_README_MIGRATION_P8_FREEZE.cjs
```

## Acceptance command

```powershell
node scripts/governance_acceptance/POST_P8_04_FREEZE_INDEX_PATCH.cjs
```

## Freeze snapshot to append

```text
freeze_name = GEOX – P8 Real Evidence Closed-Loop Acceptance / Product Replay Demo Freeze Snapshot
branch = main
pr = #2146
completion_tag = p8_real_evidence_closed_loop_demo_completion
main_merge_tag = p8_real_evidence_closed_loop_demo_main_merge
merge_commit = 36fbe07528af7ace9c04d087e21f87491e30633e
completion_acceptance = scripts/governance_acceptance/P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW.cjs
```

## Frozen scope

```text
real_evidence_window_v0
real_soil_moisture_state_estimate_v1
real_soil_moisture_prediction_run_v1
real_actual_observation_window_v0
real_backtest_error_report_v1
real_calibration_report_v1
product_replay_demo_report_v0
```

## Hard boundaries

```text
no_database_write_by_replay_runtime
no_fact_write
no_field_memory_write
no_model_write
no_execution_object
no_ao_act_task
no_dispatch
no_receipt
no_frontend_authority
prediction_is_not_authorization
calibration_candidate_is_not_model_update
```

## Expected result

```text
ok = true
acceptance = POST_P8_04_FREEZE_INDEX_PATCH
readme_migration_p8_freeze_present = true
completion_tag_recorded = true
main_merge_tag_recorded = true
p8_acceptance_recorded = true
no_runtime_surface_changed = true
```

## Next step

```text
POST_P8_05_REPOSITORY_CONVERGENCE_COMPLETION_REVIEW
```
