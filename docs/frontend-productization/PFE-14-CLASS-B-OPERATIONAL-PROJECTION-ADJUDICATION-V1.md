# PFE-14 Class-B Operational Product Projection Adjudication v1

Status: ADJUDICATION CANDIDATE / NO IMPLEMENTATION AUTHORITY  
Parent authority: `PFE-14-EVIDENCE-HEALTH-PRODUCTIZATION-QUALIFICATION-V1`  
Runtime/backend/database change: NONE

## 1. Decision rule

A Class-B field may advance to a server-provider candidate only when its product meaning can be defined from existing persisted/server-validated facts without browser inference, hidden historical assumptions, or KBS-policy duplication.

This adjudication separates **available inputs** from **authorized product semantics**.

## 2. Safe narrow provider candidates

### 2.1 `runtime_degradation_status`

Candidate product enum:

`HEALTHY | DEGRADED | UNAVAILABLE`

It must be server-owned and reuse MCFT-CAP-09 S4 Runtime Health semantics:

- missing persisted checkpoint -> `UNAVAILABLE`;
- established checkpoint plus `STALE`/`MISSING` Evidence or positive scheduler lag -> `DEGRADED`;
- established checkpoint plus `FRESH` Evidence and zero scheduler lag -> `HEALTHY`.

If the product projection has no eligibility boundary, status is `UNAVAILABLE`; the frontend must not turn `UNKNOWN` Evidence into a health conclusion.

### 2.2 `degradation_reason_codes`

Candidate deterministic server vocabulary:

1. `CHECKPOINT_NOT_ESTABLISHED`
2. `EVIDENCE_BOUNDARY_NOT_ESTABLISHED`
3. `EVIDENCE_STALE`
4. `EVIDENCE_MISSING`
5. `SCHEDULER_LAG`

Rules:

- missing prerequisite -> `UNAVAILABLE` with only missing-prerequisite reason(s);
- with prerequisites established, `STALE` and `MISSING` are mutually exclusive Evidence reasons;
- `SCHEDULER_LAG` may coexist with an Evidence degradation reason;
- `HEALTHY` returns an empty reason list;
- browser reconstruction is forbidden.

This is Runtime Health only, not crop health.

### 2.3 `forecast_status`

The server already validates the exact current `twin_forecast_run_v1` payload and its frozen enum:

`COMPLETED | BLOCKED`

The provider may expose that exact validated payload status when a current forecast exists. No object-presence heuristic is allowed.

### 2.4 `scenario_source_eligible`

The server already validates Scenario-source Forecast semantics. A provider may expose a nullable server verdict:

- `true` only when the selected Scenario-source Forecast is attached and its validated payload is Scenario-eligible;
- `false` only when the server has an explicit allowed-missing condition establishing no eligible successful Forecast in the exact Scope;
- `null` when neither condition can be established without a new assumption.

The browser must not derive this field from attachment presence.

### 2.5 `slot_window`

The S3 scheduler persistence contract is a **fixed 24-slot schedule**, not an unbounded recurring O00–O23 namespace:

- cursor persists `schedule_start_logical_time`;
- cursor persists `next_slot_index` with range `0..24`;
- slot ledger persists exact `logical_time`, `slot_id`, and scheduler `state`;
- exact Scope has a UNIQUE constraint on `slot_id`;
- slot states are `CLAIMED | RUNNING | COMPLETED | DEGRADED | FAILED`.

Therefore a server read projection may safely expose exactly 24 entries, each carrying:

- `slot_id`;
- exact logical time for this fixed schedule;
- `materialization_status = MATERIALIZED | NOT_MATERIALIZED`;
- `scheduler_state = CLAIMED | RUNNING | COMPLETED | DEGRADED | FAILED | null`;
- existing `tick_ref`, `health_ref`, `terminal_at` when a row is materialized.

`NOT_MATERIALIZED` means only “no persisted slot row”. It must never be relabeled by the frontend as `FAILED`, `MISSED`, `FUTURE`, or `BLOCKED`.

## 3. Fields that remain blocked

### 3.1 `runtime_mode`

Blocked. Adapter config contains `SHADOW_ONLINE`, but config presence is not exact-Scope Runtime Context authority.

### 3.2 `missed_slot_count`

Blocked.

`SchedulerPortV1.listMissedSlots()` intentionally returns `[]` whenever an active slot exists to preserve sequential execution. Its list length therefore cannot be reused as a universal backlog metric. A dedicated count semantic is required.

### 3.3 `backfill_status`

Blocked.

Recovery can return `CLAIMED_OLDEST_MISSED_SLOT` or `RECOVERED_EXPIRED_ACTIVE_SLOT` during an operation, but that mode is not durably persisted as product history. Current cursor/slot/lease state cannot prove origin provenance.

### 3.4 `state_status`

Blocked. Canonical State visibility exists, but no normalized product-state vocabulary is frozen. Object presence alone is not a normalized State status.

### 3.5 `refresh_after_seconds`

Blocked. Scheduler interval `3600s` is an execution cadence, not automatically a frontend refresh recommendation. Current safe behavior remains manual/user-triggered refresh until a product refresh contract exists.

## 4. Class-C fields remain Class-C

No change:

- `runtime_stage`;
- `latest_tick_started_at`;
- `restart_detected`;
- `recovery_status`.

Lease/fencing/cursor state is still not accepted as restart/recovery history.

## 5. KBS boundary

This adjudication does not change KBS source, freshness threshold, publication cadence, or publication-profile authority.

`runtime_degradation_status` consumes the server Evidence freshness verdict as an input. A future lawful MCFT-CAP-09 change to that verdict algorithm remains upstream of PFE.

## 6. Proposed next candidate

If separately qualified, the only proposed implementation successor is:

`PFE_14_IMPLEMENT_NARROW_CLASS_B_DEGRADATION_FORECAST_SLOT_PROVIDER`

Allowed fields only:

- `runtime_degradation_status`;
- `degradation_reason_codes`;
- `forecast_status`;
- `scenario_source_eligible`;
- `slot_window`.

All other Class-B and all Class-C fields remain implementation-forbidden.
