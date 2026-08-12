# PFE-14 Class-B Operational Product Projection Adjudication v1

Status: ADJUDICATION CANDIDATE / NO IMPLEMENTATION AUTHORITY  
Parent authority: `PFE-14-EVIDENCE-HEALTH-PRODUCTIZATION-QUALIFICATION-V1`  
Runtime/backend/database change: NONE

## 1. Decision rule

A Class-B field may advance to a server-provider candidate only when its product meaning can be defined from existing persisted/server-validated facts without browser inference, hidden historical assumptions, or KBS-policy duplication.

This adjudication deliberately separates **available inputs** from **authorized product semantics**.

## 2. Safe narrow provider candidates

### 2.1 `runtime_degradation_status`

Candidate product enum:

`HEALTHY | DEGRADED | UNAVAILABLE`

It must be server-owned and reuse the already-frozen MCFT-CAP-09 S4 Runtime Health semantics:

- missing persisted checkpoint -> `UNAVAILABLE`;
- established checkpoint plus `STALE`/`MISSING` Evidence or positive scheduler lag -> `DEGRADED`;
- established checkpoint plus `FRESH` Evidence and zero scheduler lag -> `HEALTHY`.

If the operational product projection has no eligibility boundary, product status is `UNAVAILABLE`; the frontend must not turn `UNKNOWN` Evidence into a health conclusion.

### 2.2 `degradation_reason_codes`

Candidate server vocabulary, deterministic order:

1. `CHECKPOINT_NOT_ESTABLISHED`
2. `EVIDENCE_BOUNDARY_NOT_ESTABLISHED`
3. `EVIDENCE_STALE`
4. `EVIDENCE_MISSING`
5. `SCHEDULER_LAG`

Rules:

- `UNAVAILABLE` due to missing checkpoint or boundary returns only the missing-prerequisite reason(s);
- with prerequisites established, `STALE` and `MISSING` are mutually exclusive Evidence reasons;
- `SCHEDULER_LAG` may coexist with an Evidence degradation reason;
- `HEALTHY` returns an empty reason list;
- browser reconstruction is forbidden.

This vocabulary is a product read projection over existing inputs; it is not a crop-health claim.

### 2.3 `forecast_status`

The server already validates the exact current `twin_forecast_run_v1` payload and its frozen enum:

`COMPLETED | BLOCKED`

The provider may expose that exact validated payload status when a current forecast exists. No object-presence heuristic is allowed.

### 2.4 `scenario_source_eligible`

The server already validates Scenario-source Forecast semantics. A provider may expose a nullable server verdict from the validated Scenario-source attachment:

- `true` only when the selected Scenario-source Forecast is attached and its validated payload is Scenario-eligible;
- `false` only when the server has an explicit allowed-missing reason establishing that no successful eligible Forecast exists in the exact Scope;
- `null` when the product projection cannot establish either condition without adding a new assumption.

The browser must not derive this field from attachment presence.

## 3. Fields that remain blocked

### 3.1 `runtime_mode`

The immutable adapter config contains `SHADOW_ONLINE`, but product binding to the active exact Scope remains unauthorized. Config presence is not Runtime Context authority.

### 3.2 `missed_slot_count`

Blocked.

Current `SchedulerPortV1.listMissedSlots()` intentionally returns an empty list whenever an active slot exists to preserve sequential execution. Therefore its list length is not a universal backlog count. A dedicated server semantic must be designed before this field can be implemented.

### 3.3 `backfill_status`

Blocked.

The recovery service can return `CLAIMED_OLDEST_MISSED_SLOT` or `RECOVERED_EXPIRED_ACTIVE_SLOT` during an operation, but that mode is not durably persisted as product history. Current cursor/slot/lease state cannot prove whether an active slot originated from normal claim or backfill.

### 3.4 `state_status`

Blocked.

Canonical `posterior_state` / State collection visibility exists, but no normalized product-state vocabulary is frozen. Object presence alone is not a normalized State status.

### 3.5 O00–O23 product slot state

Blocked pending explicit logical-time window identity.

Persisted slot rows have exact `logical_time`, `slot_id`, and state, but `slot_id` is only O00–O23 and recurs across logical time. A 24-slot product strip must first define which exact logical-time window it represents. An absent row may be shown only as data absence after a window contract exists; it must not be labeled FAILED/MISSED by inference.

### 3.6 `refresh_after_seconds`

Blocked.

The scheduler interval is 3600 seconds, but execution interval is not automatically a frontend refresh recommendation. Product refresh policy requires a separate contract; current safe behavior remains manual/user-triggered refresh.

## 4. Class-C fields remain Class-C

No change:

- `runtime_stage`;
- `latest_tick_started_at`;
- `restart_detected`;
- `recovery_status`.

Lease/fencing/cursor state is still not accepted as restart/recovery history.

## 5. KBS boundary

This adjudication does not change KBS source, freshness threshold, publication cadence, or publication-profile authority.

`runtime_degradation_status` consumes the server Evidence freshness verdict as an input. If MCFT-CAP-09 later lawfully changes how that verdict is produced, the PFE product contract remains unchanged.

## 6. Proposed next candidate

If this adjudication is separately qualified, the only proposed implementation successor is:

`PFE_14_IMPLEMENT_NARROW_CLASS_B_DEGRADATION_FORECAST_PROVIDER`

Allowed fields only:

- `runtime_degradation_status`;
- `degradation_reason_codes`;
- `forecast_status`;
- `scenario_source_eligible`.

All other Class-B and all Class-C fields remain implementation-forbidden.
