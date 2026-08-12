# PFE-14 Class-B Operational Product Projection Qualification v1

Status: QUALIFIED / NARROW PROVIDER IMPLEMENTATION AUTHORIZED / S4 NOT EFFECTIVE  
Qualified subject: `d3bb7a4ff8509899981b41efe724a2c6b74540f5`  
Protected-main merge: NONE

## 1. Exact-head proof

The corrected Class-B adjudication is accepted only for exact subject `d3bb7a4ff8509899981b41efe724a2c6b74540f5`.

- focused adjudication run `31607280419`: PASS;
- standard CI run `31607280420`: PASS;
- build/typecheck/server selfcheck: PASS;
- frontend Runtime page audit: PASS;
- full acceptance suite: PASS;
- Commercial MVP0 release gate: PASS.

No protected-main merge is claimed.

## 2. Qualification effect

This qualification authorizes exactly one later implementation candidate:

`PFE_14_IMPLEMENT_NARROW_CLASS_B_DEGRADATION_FORECAST_SLOT_PROVIDER`

The implementation may additively extend the existing GET-only endpoint:

`GET /api/v1/operator/twin/fields/:field_id/runtime/operational-summary`

for exactly five server-owned product fields:

1. `runtime_degradation_status`;
2. `degradation_reason_codes`;
3. `forecast_status`;
4. `scenario_source_eligible`;
5. `slot_window`.

No new route or HTTP method is authorized. No frontend consumption is authorized by this qualification.

## 3. Required server semantics

`runtime_degradation_status` must reuse the persisted-checkpoint + Evidence freshness + scheduler-lag Runtime Health semantics. A scheduler terminal row is not a checkpoint substitute.

`forecast_status` must come from an already validated canonical Forecast graph, not object-presence heuristics.

`scenario_source_eligible` must distinguish a validated current Scenario-source Forecast from a merely scenario-capable Forecast. It must remain nullable when the server cannot establish the product verdict.

`slot_window` is one fixed 24-entry schedule identified by persisted `schedule_start_logical_time` plus ordered O00–O23 at PT1H. Persisted states are copied exactly. An absent row is only `NOT_MATERIALIZED`; it is never FAILED, MISSED, FUTURE or BLOCKED by inference.

## 4. Still forbidden

This qualification does not authorize implementation of:

- `runtime_mode`;
- `missed_slot_count`;
- `backfill_status`;
- `state_status`;
- `refresh_after_seconds`;
- `runtime_stage`;
- `latest_tick_started_at`;
- `restart_detected`;
- `recovery_status`.

Generic Class-B implementation authority remains false. Only the named five-field provider candidate is authorized.

No database schema change, canonical write, scheduler claim/recovery call, KBS source/freshness/cadence change, Runtime action, AO-ACT, dispatch, model activation, frontend product activation, Shadow-online label or PFE-14 S4 effectiveness is authorized.
