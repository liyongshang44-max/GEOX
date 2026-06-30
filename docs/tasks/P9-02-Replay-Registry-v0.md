# docs/tasks/P9-02-Replay-Registry-v0.md

## Status

```text
Status: active P9 governance task
Phase: P9 Twin Kernel Convergence / Freeze Registry / Replay Case Governance
Task: P9-02 Replay Registry v0
Authority source: README_MIGRATION.md
Line authority contract: docs/twin_kernel/TWIN_KERNEL_LINE_AUTHORITY_CONTRACT_V0.md
Registry: docs/twin_kernel/REPLAY_REGISTRY_V0.json
Acceptance: scripts/governance_acceptance/P9_02_REPLAY_REGISTRY_V0_ACCEPTANCE.cjs
```

## Purpose

P9-02 introduces the first machine-readable replay registry for the offline real-evidence replay line.

This task registers the existing P8 real-evidence closed-loop replay case. It does not create a new replay case, does not run the replay, does not create committed replay artifacts, and does not convert P8 artifacts into persisted Twin Kernel runtime objects.

## Registered case

```text
case_id = p8_real_evidence_closed_loop_caf009_soil_moisture_v0
line_id = offline_real_evidence_replay_kernel
completion_acceptance = scripts/governance_acceptance/P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW.cjs
completion_tag = p8_real_evidence_closed_loop_demo_completion
main_merge_tag = p8_real_evidence_closed_loop_demo_main_merge
project_id = P_DEFAULT
sensor_group_id = G_CAF
sensor_id = CAF009
metric_kind = soil_moisture
artifact_materialization = stdout_json_contract
committed_artifact_paths_required = false
```

## Artifact records

The registry records artifact kinds and generator scripts only.

```text
real_evidence_window_v0 -> scripts/twin_kernel/P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs
real_soil_moisture_state_estimate_v1 -> scripts/twin_kernel/P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs
real_soil_moisture_prediction_run_v1 -> scripts/twin_kernel/P8_05_REAL_PREDICTION_RUN_V1.cjs
real_actual_observation_window_v0 -> scripts/twin_kernel/P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0.cjs
real_backtest_error_report_v1 -> scripts/twin_kernel/P8_07_REAL_BACKTEST_ERROR_REPORT_V1.cjs
real_calibration_report_v1 -> scripts/twin_kernel/P8_08_REAL_CALIBRATION_REPORT_V1.cjs
product_replay_demo_report_v0 -> scripts/twin_kernel/P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0.cjs
```

## Non-goals

```text
no_new_replay_case
no_committed_replay_artifact_file
no_replay_execution
no_replay_algorithm_change
no_runtime_code_change
no_server_route_change
no_frontend_change
no_database_migration
no_seed_change
no_persisted_twin_object_creation
no_artifact_mapping_contract_creation
no_model_version_manifest_creation
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P9_02_REPLAY_REGISTRY_V0_ACCEPTANCE.cjs
```

## Expected acceptance result

```text
ok = true
acceptance = P9_02_REPLAY_REGISTRY_V0_ACCEPTANCE
registry_present = true
registered_case_count = 1
artifact_record_count = 7
generator_scripts_exist = true
committed_artifact_paths_required = false
runtime_surface_changed = false
failed_assertion_count = 0
```

## Next task

```text
P9-03 Replay Case Manifest v0
```
