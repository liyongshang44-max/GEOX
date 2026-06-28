# docs/tasks/TWIN-KERNEL-Trace-Read-Model-API-Readback.md

# TWIN_KERNEL_TRACE_READ_MODEL_OR_API_READBACK

This task converts the runtime trace proven by `TWIN_KERNEL_RUNTIME_VALUE_TRACE_ACCEPTANCE` into a read-only API readback surface.

It does not add a new formal object, a new seed dataset, a new database table, or a frontend page.

## Route

```text
GET /api/v1/twin-kernel/traces/:decision_cycle_id
```

## Purpose

Given a persisted `decision_cycle_v1` ID, the API must read back the full Twin Kernel chain:

```text
field_state_snapshot_v1
forecast_run_v1
scenario_set_v1
calibration_replay_v1
forecast_error_v1
field_learning_candidate_v1
decision_cycle_v1
```

The route returns a `twin_trace_v1_read_model` response that separates:

```text
entered_collected
system_derived
human_confirmed
pointer_refs
answers
```

## Boundary

The route is read-only.

It must not:

- insert or update Twin Kernel objects
- create recommendations
- create approvals
- create operation plans
- create tasks
- create receipts
- create acceptance records
- write ROI
- write Field Memory
- update models
- call Twin Kernel builders

It reads only persisted rows and assembles a trace read model.

## Missing linked objects

If `decision_cycle_v1` exists but one or more linked TK objects are missing, the route must return:

```json
{
  "ok": false,
  "error": "TWIN_TRACE_LINKED_OBJECTS_MISSING"
}
```

with the missing object names.

## Current-stage display rule

`decision_cycle_v1.current_stage` remains the persisted TK6 state-machine field.

The trace read model additionally exposes:

```text
answers.decision_cycle.missing_formalization
```

This prevents UI/API consumers from overinterpreting `current_stage` when ROI or formal Field Memory are intentionally absent.

## Acceptance command

```powershell
node scripts/governance_acceptance/TWIN_KERNEL_TRACE_READ_MODEL_API_READBACK.cjs
```

## Expected result

```json
{
  "ok": true,
  "acceptance": "TWIN_KERNEL_TRACE_READ_MODEL_API_READBACK",
  "trace_route_registered": true,
  "trace_route_read_only": true,
  "full_tk_chain_readback_declared": true,
  "provenance_read_model_declared": true,
  "missing_formalization_declared": true,
  "forbidden_auto_write_boundary_preserved": true
}
```
