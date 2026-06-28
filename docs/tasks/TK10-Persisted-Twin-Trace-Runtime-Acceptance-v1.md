# docs/tasks/TK10-Persisted-Twin-Trace-Runtime-Acceptance-v1.md

## Purpose

TK10 converts the manually verified persisted Twin Kernel smoke test into a repeatable runtime acceptance script.

The goal is not to add a new Twin Kernel object, not to seed business data, and not to create a product UI. The goal is to verify that an already prepared runtime environment can execute the full persisted Twin Kernel chain and read it back as a trace.

The runtime chain is:

```text
source index rows
  -> POST /api/v1/twin-kernel/field-state-snapshots
  -> POST /api/v1/twin-kernel/forecast-runs
  -> POST /api/v1/twin-kernel/scenario-sets
  -> POST /api/v1/twin-kernel/calibration-replays
  -> POST /api/v1/twin-kernel/field-learning-candidates
  -> POST /api/v1/twin-kernel/decision-cycles
  -> GET  /api/v1/twin-kernel/traces/:decision_cycle_id
```

## Boundary

TK10 does not create or modify database schema.

TK10 does not insert source-index seed data.

TK10 does not create recommendations, approvals, operation plans, AO-ACT tasks, receipts, acceptance records, ROI entries, Field Memory entries, or model updates.

The runtime script only calls existing Twin Kernel API endpoints and validates their persisted outputs.

## Runtime preconditions

The local server must be running.

The source-index rows for the selected scope must already exist.

The TK1 through TK9 migrations must already be applied.

Default scope:

```text
tenant_id = tenantA
project_id = projectA
group_id = groupA
field_id = field_c8_demo
season_id = season_2026_demo
as_of_ts = 2026-06-28T00:00:00.000Z
```

The defaults match the local persisted smoke test. They can be overridden by environment variables.

## Environment variables

```text
TWIN_KERNEL_BASE_URL
TK10_TENANT_ID
TK10_PROJECT_ID
TK10_GROUP_ID
TK10_FIELD_ID
TK10_SEASON_ID
TK10_AS_OF_TS
TK10_SELECTED_OPTION_ID
TK10_OBSERVED_AT
TK10_POST_SOIL_MOISTURE_PERCENT
TK10_OBSERVED_WATER_STATE
TK10_VERIFICATION_REF_ID
TK10_ACCEPTANCE_ID
TK10_POST_IRRIGATION_VERIFICATION_ID
TK10_FORMAL_EVIDENCE_REF_ID
TK10_FIELD_MEMORY_GATE_ROUTE
TK10_RECOMMENDATION_ID
TK10_APPROVAL_ID
TK10_OPERATION_PLAN_ID
TK10_ACT_TASK_ID
TK10_RECEIPT_ID
TK10_AS_EXECUTED_ID
```

## Acceptance assertions

The script passes only if:

1. `field_state_snapshot_v1.status = SNAPSHOT_READY`.
2. The snapshot shows source-index evidence as entered/collected data.
3. `forecast_run_v1.status = FORECAST_READY`.
4. `scenario_set_v1.status = SCENARIO_SET_READY`.
5. `calibration_replay_v1.status = CALIBRATION_REPLAY_READY`.
6. `forecast_error_v1` is created or read back from its deterministic ID.
7. `field_learning_candidate_v1.candidate_status = LEARNING_CANDIDATE_READY`.
8. `decision_cycle_v1.cycle_status = DECISION_CYCLE_READY`.
9. `decision_cycle_v1.current_stage = ACCEPTED` when `roi_entry_id` and `field_memory_id` are absent.
10. `GET /api/v1/twin-kernel/traces/:decision_cycle_id` returns `object_type = twin_trace_v1_read_model`.
11. The trace is read-only.
12. The trace contains all seven system-derived objects.
13. The trace continues to expose `ROI_FORMALIZATION_MISSING`, `FORMAL_FIELD_MEMORY_MISSING`, and `H58_FORMAL_WRITE_NOT_CREATED_BY_TWIN_KERNEL`.
14. The boundary flags still show no automatic downstream writes.

## Failure semantics

If the selected source-index rows are missing, the script must fail with a source/snapshot readiness error instead of silently creating seed data.

If the server is not running, the script must fail with an API connectivity error.

If downstream write flags are ever true, the script must fail.

## Command

```powershell
node scripts/governance_acceptance/TK10_PERSISTED_TWIN_TRACE_RUNTIME_ACCEPTANCE_V1.cjs
```
