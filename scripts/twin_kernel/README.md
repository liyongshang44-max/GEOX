# scripts/twin_kernel/README.md

## Status

```text
Status: derived view
Authority source: docs/SSOT.md
Domain reference: docs/twin_kernel/README.md
Freeze source: README_MIGRATION.md
```

## Purpose

This directory contains offline Twin replay scripts. It is not the server persisted Twin Kernel runtime.

The current completed line is P8 Real Evidence Closed-Loop Acceptance / Product Replay Demo.

## Current P8 replay entrypoint

```text
scripts/governance_acceptance/P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW.cjs
```

## P8 runtime chain

```text
P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs
P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs
P8_05_REAL_PREDICTION_RUN_V1.cjs
P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0.cjs
P8_07_REAL_BACKTEST_ERROR_REPORT_V1.cjs
P8_08_REAL_CALIBRATION_REPORT_V1.cjs
P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0.cjs
```

## P8 manual data precondition

P8 runtime expects the CAF009 history and holdout windows to already exist in local Postgres raw_samples.

The replay runtime must not create those rows itself.

```text
history_window = 2009-06-09T00:00:00.000Z -> 2009-06-09T04:00:00.000Z
actual_window = 2009-06-09T05:00:00.000Z -> 2009-06-09T07:00:00.000Z
sensor_id = CAF009
sensor_group_id = G_CAF
project_id = P_DEFAULT
metric_kind = soil_moisture
```

## Boundary

```text
not_server_runtime
not_api_route
not_frontend_state
not_field_memory_writer
not_model_writer
not_execution_authority
not_ao_act_task_creator
```

## Future P9 direction

Future replay harness work should add explicit case manifests and data-prep contracts before adding more replay cases.

A data-prep script may write raw_samples, but it must be clearly classified as acceptance data setup, not replay runtime.

---

## P9-02 Replay Registry v0

Registry:

```text
docs/twin_kernel/REPLAY_REGISTRY_V0.json
```

Acceptance:

```text
scripts/governance_acceptance/P9_02_REPLAY_REGISTRY_V0_ACCEPTANCE.cjs
```

Registered P8 replay case:

```text
case_id = p8_real_evidence_closed_loop_caf009_soil_moisture_v0
artifact_materialization = stdout_json_contract
committed_artifact_paths_required = false
```

The registry records artifact kinds and generator scripts only. It does not require committed replay output files and it does not make offline replay artifacts persisted server Twin Kernel objects.

---

## P9-03 Replay Case Manifest v0

Case manifest:

```text
docs/twin_kernel/replay_cases/p8_real_evidence_closed_loop_caf009_soil_moisture_v0.json
```

Acceptance:

```text
scripts/governance_acceptance/P9_03_REPLAY_CASE_MANIFEST_V0_ACCEPTANCE.cjs
```

Manifest properties:

```text
case_manifest_schema_version = replay_case_manifest_v0
case_manifest_does_not_execute_replay = true
committed_artifact_paths_required = false
```

The manifest records the fixed P8 data scope, runtime chain, artifact policy, determinism policy, and hard boundaries. It does not run replay scripts, create committed artifact files, or create persisted Twin Kernel objects.

---

## P9-04 Model Version Manifest v0

Model version manifest:

```text
docs/twin_kernel/model_versions/p8_real_soil_moisture_model_version_manifest_v0.json
```

Acceptance:

```text
scripts/governance_acceptance/P9_04_MODEL_VERSION_MANIFEST_V0_ACCEPTANCE.cjs
```

Registered model set:

```text
model_set_kind = deterministic_heuristic_replay_models
weighted_recent_mean_v1
linear_recent_window_trend_v1
state_uncertainty_growth_v1
real_backtest_bias_summary_v1
automatic_learning_loop = false
model_update_allowed = false
calibration_candidate_applied = false
```

The model version manifest records deterministic replay model versions only. It does not train a model, create a model artifact file, write model state, apply calibration candidates, or change replay algorithms.

---

## P9-05 Acceptance Entry Unification

Acceptance entrypoints manifest:

```text
docs/twin_kernel/ACCEPTANCE_ENTRYPOINTS_V0.json
```

Unified runner:

```text
suite_id = p9-twin-kernel
run_command = node scripts/acceptance/run_acceptance.cjs --suite p9-twin-kernel
list_command = node scripts/acceptance/run_acceptance.cjs --suite p9-twin-kernel --list
default_suite_preserved = legacy
```

The unified suite lists and runs the P9 governance acceptance chain from P9-00 through P9-05. It does not change replay scripts, server runtime, database schema, frontend state, or model state.

---

## P9-06 Replay Artifact Mapping Contract v0

Mapping contract:

```text
docs/twin_kernel/REPLAY_ARTIFACT_MAPPING_CONTRACT_V0.json
```

Acceptance:

```text
scripts/governance_acceptance/P9_06_REPLAY_ARTIFACT_MAPPING_CONTRACT_V0_ACCEPTANCE.cjs
```

Mapping rule:

```text
candidate_mapping_only = true
not_executable_without_future_adapter
p8_artifacts_are_not_persisted_twin_objects = true
automatic_materialization_allowed = false
```

The mapping contract describes possible future target object classes only. It does not execute mappings, write persisted Twin Kernel objects, write facts, update models, create Field Memory, or create AO-ACT tasks.
