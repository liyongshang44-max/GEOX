# docs/tasks/P9-06-Replay-Artifact-Mapping-Contract-v0.md

## Status

```text
Status: active P9 governance task
Phase: P9 Twin Kernel Convergence / Freeze Registry / Replay Case Governance
Task: P9-06 Replay Artifact Mapping Contract v0
Authority source: README_MIGRATION.md
Line authority contract: docs/twin_kernel/TWIN_KERNEL_LINE_AUTHORITY_CONTRACT_V0.md
Registry: docs/twin_kernel/REPLAY_REGISTRY_V0.json
Case manifest: docs/twin_kernel/replay_cases/p8_real_evidence_closed_loop_caf009_soil_moisture_v0.json
Model version manifest: docs/twin_kernel/model_versions/p8_real_soil_moisture_model_version_manifest_v0.json
Mapping contract: docs/twin_kernel/REPLAY_ARTIFACT_MAPPING_CONTRACT_V0.json
Acceptance: scripts/governance_acceptance/P9_06_REPLAY_ARTIFACT_MAPPING_CONTRACT_V0_ACCEPTANCE.cjs
```

## Purpose

P9-06 introduces a declarative mapping contract from the offline P8 replay artifact line to possible persisted server Twin Kernel object classes.

This task does not execute a mapping. It does not write database rows. It does not create persisted Twin Kernel objects. It does not make P8 artifacts equivalent to server runtime state.

## Mapping rule

```text
p8_artifacts_are_not_persisted_twin_objects = true
candidate_mapping_only = true
future_adapter_required = true
automatic_materialization_allowed = false
db_write_allowed = false
fact_write_allowed = false
field_memory_write_allowed = false
model_update_allowed = false
ao_act_task_allowed = false
```

## Source artifact coverage

```text
real_evidence_window_v0 -> field_state_snapshot_v1
real_soil_moisture_state_estimate_v1 -> field_state_snapshot_v1
real_soil_moisture_prediction_run_v1 -> forecast_run_v1
real_actual_observation_window_v0 -> calibration_replay_v1
real_backtest_error_report_v1 -> forecast_error_v1
real_calibration_report_v1 -> field_learning_candidate_v1
product_replay_demo_report_v0 -> twin_trace_v1_read_model
```

## Compatibility caveat

```text
P8 prediction is 3 hourly steps.
Persisted forecast_run_v1 is seven-day water-state forecast shaped.
```

Therefore P9-06 requires a future adapter before any materialization or persistence is allowed.

## Non-goals

```text
no_mapping_execution
no_runtime_code_change
no_server_route_change
no_frontend_change
no_database_migration
no_seed_change
no_replay_algorithm_change
no_prediction_algorithm_change
no_training_run
no_model_state_write
no_model_update
no_calibration_application
no_field_memory_write
no_db_write
no_fact_write
no_ao_act_task
no_dispatch
no_receipt
no_persisted_twin_object_creation
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P9_06_REPLAY_ARTIFACT_MAPPING_CONTRACT_V0_ACCEPTANCE.cjs
```

## Expected acceptance result

```text
ok = true
acceptance = P9_06_REPLAY_ARTIFACT_MAPPING_CONTRACT_V0_ACCEPTANCE
mapping_contract_present = true
mapping_record_count = 7
all_source_artifacts_mapped = true
all_mappings_non_executable = true
all_writes_forbidden = true
runtime_surface_changed = false
failed_assertion_count = 0
```

## Next task

```text
P9-07 Twin Kernel Convergence Completion Review
```
