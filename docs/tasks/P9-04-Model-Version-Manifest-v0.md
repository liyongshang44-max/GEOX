# docs/tasks/P9-04-Model-Version-Manifest-v0.md

## Status

```text
Status: active P9 governance task
Phase: P9 Twin Kernel Convergence / Freeze Registry / Replay Case Governance
Task: P9-04 Model Version Manifest v0
Authority source: README_MIGRATION.md
Line authority contract: docs/twin_kernel/TWIN_KERNEL_LINE_AUTHORITY_CONTRACT_V0.md
Registry: docs/twin_kernel/REPLAY_REGISTRY_V0.json
Case manifest: docs/twin_kernel/replay_cases/p8_real_evidence_closed_loop_caf009_soil_moisture_v0.json
Model version manifest: docs/twin_kernel/model_versions/p8_real_soil_moisture_model_version_manifest_v0.json
Acceptance: scripts/governance_acceptance/P9_04_MODEL_VERSION_MANIFEST_V0_ACCEPTANCE.cjs
```

## Purpose

P9-04 adds a model version manifest for the deterministic P8 real-evidence soil moisture replay case.

The P8 replay line does not use a trained ML model. It uses deterministic heuristic model versions embedded in the offline replay scripts. P9-04 records those model versions and explicitly freezes the non-learning boundary.

## Model set

```text
model_set_id = p8_real_soil_moisture_replay_model_set_v0
model_set_kind = deterministic_heuristic_replay_models
metric_kind = soil_moisture
unit = vwc_fraction
trained_model = false
external_model_dependency = false
learned_parameter_state = false
model_state_materialization = none
model_update_allowed = false
calibration_candidate_applied = false
```

## Model versions

```text
weighted_recent_mean_v1 -> state_estimation -> scripts/twin_kernel/P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs
linear_recent_window_trend_v1 -> prediction -> scripts/twin_kernel/P8_05_REAL_PREDICTION_RUN_V1.cjs
observed_window_range_mean_v1 -> state_uncertainty -> scripts/twin_kernel/P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs
state_uncertainty_growth_v1 -> prediction_uncertainty -> scripts/twin_kernel/P8_05_REAL_PREDICTION_RUN_V1.cjs
real_backtest_bias_summary_v1 -> calibration_candidate_summary -> scripts/twin_kernel/P8_08_REAL_CALIBRATION_REPORT_V1.cjs
```

## Calibration boundary

```text
calibration_candidate_only = true
applied_to_model = false
model_update_ref = null
field_memory_write_ref = null
automatic_learning_loop = false
```

## Non-goals

```text
no_runtime_code_change
no_server_route_change
no_frontend_change
no_database_migration
no_seed_change
no_replay_algorithm_change
no_prediction_algorithm_change
no_training_run
no_model_artifact_file
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
node scripts/governance_acceptance/P9_04_MODEL_VERSION_MANIFEST_V0_ACCEPTANCE.cjs
```

## Expected acceptance result

```text
ok = true
acceptance = P9_04_MODEL_VERSION_MANIFEST_V0_ACCEPTANCE
model_version_manifest_present = true
model_version_count = 5
case_manifest_points_to_model_version_manifest = true
model_update_allowed = false
calibration_candidate_applied = false
runtime_surface_changed = false
failed_assertion_count = 0
```

## Next task

```text
P9-05 Acceptance Entry Unification
```
