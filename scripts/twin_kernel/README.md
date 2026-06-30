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

P8 runtime expects the CAF009 history and holdout windows to already exist in local Postgres `raw_samples`.

The replay runtime must not seed those rows itself.

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

A data-prep script may write `raw_samples`, but it must be clearly classified as acceptance data setup, not replay runtime.
