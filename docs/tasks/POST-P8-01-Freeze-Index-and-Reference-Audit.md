# docs/tasks/POST-P8-01-Freeze-Index-and-Reference-Audit.md

## Status

```text
Status: derived view
Authority source: docs/SSOT.md
Freeze source: README_MIGRATION.md
Previous gate: POST_P8_REPOSITORY_CONVERGENCE_ACCEPTANCE
```

## Purpose

POST-P8-01 starts the mechanical reference audit required before moving, archiving, or deleting non-mainline repository material.

The repository has many old task docs, acceptance scripts, PowerShell smoke scripts, demo seeds, delivery scripts, and frontend/runtime assets. They must not be deleted merely because they look old. A candidate may be moved or deleted only after a reference audit proves that it is not part of current governance, CI, package scripts, runtime route registration, acceptance runners, or freeze evidence.

## P8 freeze snapshot to register in README_MIGRATION

The P8 freeze snapshot must be added to `README_MIGRATION.md` in this convergence line before the cleanup queue is considered complete.

```text
freeze_name = P8 Real Evidence Closed-Loop Acceptance / Product Replay Demo
branch = main
pr = #2146
completion_tag = p8_real_evidence_closed_loop_demo_completion
main_merge_tag = p8_real_evidence_closed_loop_demo_main_merge
merge_commit = 36fbe07528af7ace9c04d087e21f87491e30633e
completion_acceptance = scripts/governance_acceptance/P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW.cjs
```

Frozen P8 scope:

```text
real_evidence_window_v0
real_soil_moisture_state_estimate_v1
real_soil_moisture_prediction_run_v1
real_actual_observation_window_v0
real_backtest_error_report_v1
real_calibration_report_v1
product_replay_demo_report_v0
```

Hard P8 boundaries:

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

## Reference audit inputs

```text
package_json = package.json
github_actions = .github/workflows/ci.yml
acceptance_runner = scripts/acceptance/run_acceptance.cjs
repository_ssot = docs/SSOT.md
freeze_index = README_MIGRATION.md
handoff_map = docs/REPOSITORY_HANDOFF_MAP.md
twin_lineage_reference = docs/twin_kernel/README.md
script_entry_guide = scripts/README.md
offline_replay_script_guide = scripts/twin_kernel/README.md
```

## Candidate scan groups

```text
docs_tasks = docs/tasks/**
scripts_root_powershell = scripts/*.ps1
scripts_twin_kernel = scripts/twin_kernel/**
scripts_governance_acceptance = scripts/governance_acceptance/**
scripts_delivery = scripts/DELIVERY/**
frontend_pages = apps/web/**
server_routes = apps/server/src/routes/**
```

## Cleanup policy

```text
no_delete_in_post_p8_01
no_move_in_post_p8_01
reference_audit_only
candidate_status_is_advisory
```

## Acceptance command

```powershell
node scripts/governance_acceptance/POST_P8_01_FREEZE_INDEX_AND_REFERENCE_AUDIT.cjs
```

## Expected result

```text
ok = true
acceptance = POST_P8_01_FREEZE_INDEX_AND_REFERENCE_AUDIT
reference_audit_generated = true
candidate_scan_completed = true
strong_reference_sources_checked = true
no_delete_performed = true
no_runtime_surface_changed = true
```

## Next step

```text
POST_P8_02_NON_MAINLINE_ARCHIVE_PLAN
```
