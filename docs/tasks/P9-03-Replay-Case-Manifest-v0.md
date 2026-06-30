# docs/tasks/P9-03-Replay-Case-Manifest-v0.md

## Status

```text
Status: active P9 governance task
Phase: P9 Twin Kernel Convergence / Freeze Registry / Replay Case Governance
Task: P9-03 Replay Case Manifest v0
Authority source: README_MIGRATION.md
Line authority contract: docs/twin_kernel/TWIN_KERNEL_LINE_AUTHORITY_CONTRACT_V0.md
Registry: docs/twin_kernel/REPLAY_REGISTRY_V0.json
Case manifest: docs/twin_kernel/replay_cases/p8_real_evidence_closed_loop_caf009_soil_moisture_v0.json
Acceptance: scripts/governance_acceptance/P9_03_REPLAY_CASE_MANIFEST_V0_ACCEPTANCE.cjs
```

## Purpose

P9-03 adds a case-level manifest for the existing P8 real-evidence closed-loop replay case.

The replay registry answers which replay cases exist. The replay case manifest answers what one case is: its source line, fixed data scope, data precondition, runtime chain, artifact policy, determinism policy, and hard boundaries.

## Registered case manifest

```text
case_id = p8_real_evidence_closed_loop_caf009_soil_moisture_v0
schema_version = replay_case_manifest_v0
source_line_id = offline_real_evidence_replay_kernel
case_class = existing_real_evidence_closed_loop_replay
project_id = P_DEFAULT
sensor_group_id = G_CAF
sensor_id = CAF009
metric_kind = soil_moisture
source_table = raw_samples
expected_interval_ms = 3600000
artifact_materialization = stdout_json_contract
committed_artifact_paths_required = false
```

## Runtime chain

The manifest records the existing P8 chain only.

```text
1 -> scripts/twin_kernel/P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs -> real_evidence_window_v0
2 -> scripts/twin_kernel/P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs -> real_soil_moisture_state_estimate_v1
3 -> scripts/twin_kernel/P8_05_REAL_PREDICTION_RUN_V1.cjs -> real_soil_moisture_prediction_run_v1
4 -> scripts/twin_kernel/P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0.cjs -> real_actual_observation_window_v0
5 -> scripts/twin_kernel/P8_07_REAL_BACKTEST_ERROR_REPORT_V1.cjs -> real_backtest_error_report_v1
6 -> scripts/twin_kernel/P8_08_REAL_CALIBRATION_REPORT_V1.cjs -> real_calibration_report_v1
7 -> scripts/twin_kernel/P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0.cjs -> product_replay_demo_report_v0
```

## Non-goals

```text
no_new_replay_case
no_replay_execution
no_replay_algorithm_change
no_committed_replay_artifact_file
no_data_prep_script
no_raw_samples_seed
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
node scripts/governance_acceptance/P9_03_REPLAY_CASE_MANIFEST_V0_ACCEPTANCE.cjs
```

## Expected acceptance result

```text
ok = true
acceptance = P9_03_REPLAY_CASE_MANIFEST_V0_ACCEPTANCE
case_manifest_present = true
registry_points_to_case_manifest = true
runtime_chain_step_count = 7
generator_scripts_exist = true
committed_artifact_paths_required = false
runtime_surface_changed = false
failed_assertion_count = 0
```

## Next task

```text
P9-04 Model Version Manifest v0
```
