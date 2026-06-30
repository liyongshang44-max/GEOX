# docs/twin_kernel/README.md

## Status

```text
Status: domain reference
Authority source: docs/SSOT.md
Freeze source: README_MIGRATION.md
```

## Purpose

This file separates the two Twin lines that now exist in the repository.

It is not a repository-level SSOT. It is a domain reference that helps implementers avoid mixing production-shaped persisted Twin runtime with offline replay experiments.

## Line 1: Server Persisted Twin Kernel

```text
line_id = server_persisted_twin_kernel
runtime_shape = production-shaped persisted API runtime
primary_routes = apps/server/src/routes/v1/twin_kernel.ts
module_registry = apps/server/src/modules/twin_kernel/registerTwinKernelModule.ts
domain_code = apps/server/src/domain/twin_kernel/**
database_contract = apps/server/db/migrations/*twin* and related TK migrations
acceptance_anchor = scripts/governance_acceptance/TK10_PERSISTED_TWIN_TRACE_RUNTIME_ACCEPTANCE_V1.cjs
```

This line writes deterministic system-derived Twin objects through API routes and database tables:

```text
field_state_snapshot_v1
forecast_run_v1
scenario_set_v1
calibration_replay_v1
forecast_error_v1
field_learning_candidate_v1
decision_cycle_v1
twin_trace_v1_read_model
```

Boundary:

```text
no_direct_recommendation_execution
no_direct_ao_act_task_authorization
no_field_memory_write_by_kernel_without_formal_gate
no_model_update_by_default
no_frontend_authority
```

## Line 2: Offline Real-Evidence Replay Kernel

```text
line_id = offline_real_evidence_replay_kernel
runtime_shape = local offline deterministic replay scripts
primary_docs = docs/tasks/P8-*.md
primary_scripts = scripts/twin_kernel/P8_*.cjs
completion_acceptance = scripts/governance_acceptance/P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW.cjs
completion_tag = p8_real_evidence_closed_loop_demo_completion
main_merge_tag = p8_real_evidence_closed_loop_demo_main_merge
```

This line reads real `raw_samples` evidence and produces deterministic JSON artifacts:

```text
real_evidence_window_v0
real_soil_moisture_state_estimate_v1
real_soil_moisture_prediction_run_v1
real_actual_observation_window_v0
real_backtest_error_report_v1
real_calibration_report_v1
product_replay_demo_report_v0
```

Boundary:

```text
runtime_read_only
no_db_write_by_replay_runtime
no_fact_write
no_field_memory_write
no_model_write
no_execution_object
no_ao_act_task
no_dashboard_authority
prediction_is_not_authorization
calibration_candidate_is_not_model_update
```

## Reconciliation rule

Future work must declare which line it extends.

If a task needs both lines, it must first introduce a reconciliation contract covering:

```text
source_data_contract
artifact_mapping
model_version_mapping
case_manifest
persistence_policy
read_only_vs_write_boundary
acceptance_entrypoint
```

No task may silently make P8 offline replay artifacts behave as persisted server Twin objects, and no task may silently make persisted server Twin routes depend on P8 local replay scripts.
