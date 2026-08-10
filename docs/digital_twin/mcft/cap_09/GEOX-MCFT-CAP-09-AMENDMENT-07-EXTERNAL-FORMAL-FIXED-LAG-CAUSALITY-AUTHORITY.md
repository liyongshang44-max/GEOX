# GEOX MCFT-CAP-09 Amendment-07 — External Formal Fixed-Lag Causality Authority

Status: Candidate amendment; not effective until exact-head proof passes and this candidate merges to protected `main`.

Capability line: `MCFT-CAP-09`

Slice: `MCFT-CAP-09.S6`

Frontier correction: `S6-AMENDMENT-07-EXTERNAL-FORMAL-FIXED-LAG-CAUSALITY-AUTHORITY`

Base protected main at candidate start: `5facf874b8f11f8613ddd106a45d4033a6f44ae5`

## 1. Purpose

This amendment closes an operational causality contradiction discovered during `S6-EA5E2-COLLECTOR-RUNTIME-SCHEDULE-READINESS` design.

The contradiction is specific to the real External Formal path:

1. CAP-03 continuation semantics require `observed_rainfall_v1` and `historical_et0_estimate_v1` to represent the exact interval `(T-1h, T]` for logical tick `T`.
2. The current generic continuation window also requires `available_to_runtime_at <= T` and `ingested_at <= T`.
3. The frozen KBS raw-hourly source uses its provider `datetime_utc` as the exact hourly interval end. The value for an interval ending at `T` cannot be final before the interval ends, and the qualified live source has positive publication latency.
4. EA4 recovery proved this with the original source unchanged: at probe start `2026-08-09T05:47:28.938254Z`, the latest KBS raw-hourly row was `2026-08-09T04:00:00Z`. The frozen KBS raw-hourly freshness authority permits up to 6 hours of age.

Therefore a final observed interval ending at `T` cannot, in the general live case, also be durably retained, canonicalized and ingested before `T` without either inventing data or falsifying time.

This amendment forbids both shortcuts.

## 2. Authority precedence and narrow scope

When effective, Amendment-07 supersedes only the External Formal S6 interpretation of:

- exact-hour observed rainfall / historical ET0 availability cutoff;
- collector/runtime wall-clock ordering for those delayed exact-hour observations;
- scheduler eligibility for the External Formal 24-hour qualification window.

It does **not** supersede or mutate:

- CAP-02 frozen hourly water-balance math;
- CAP-03 exact event-time and exact interval semantics;
- historical Replay evidence-window defaults;
- S5 replay or historical CAP04 behavior;
- Amendment-01 source identity or epistemic boundaries;
- Amendment-05 exact five-source binding profile;
- Amendment-05 future-forcing causal availability rule;
- Amendment-06 selected logical epoch or its 24 explicit Runtime Config pins;
- EA5E1 immutable Formal Window Input Manifest;
- append-only persistence rules;
- Recommendation / Approval / AO-ACT / Dispatch boundaries.

Any implementation that changes generic historical behavior by default is outside this amendment.

## 3. Frozen selected logical epoch remains unchanged

Amendment-06 remains authoritative for logical slot identity:

```text
epoch_id = mcft_cap09_external_formal_window_epoch_20260811t170000z_v1
O00       = 2026-08-11T17:00:00.000Z
O23       = 2026-08-12T16:00:00.000Z
EA5E V3 readiness deadline = 2026-08-11T05:00:00.000Z
```

For every slot `Oxx`, let its exact logical boundary be `T`.

Each selected Runtime Config must still satisfy:

```text
config.effective_logical_time == T
config.logical_time           == T
config.as_of                  == T
```

The EA5E1 manifest's exact `runtime_config_ref` + `runtime_config_hash` pin for that slot remains the only legal Runtime Config authority.

No re-timestamping of Runtime Config is authorized.

## 4. Fixed-lag External Formal wall-clock profile

The External Formal qualification path adopts a deterministic fixed-lag observer profile:

```text
scheduler_eligibility_lag_hours = 7
runtime_observer_minute_utc     = 17
minimum_ingestion_margin_minutes = 5
```

For logical slot `T`:

```text
pre-boundary causal collector target     = T - 00:30
late exact-hour collector scheduled      = T + 06:30
late exact-hour evidence cutoff          = T + 07:12
runtime observer nominal time            = T + 07:17
```

Interpretation:

- `T` remains the model logical time and exact interval boundary.
- `T + 07:17` is the nominal real UTC wall-clock observer time for that logical slot.
- A slot is not scheduler-eligible before the wall-clock hour whose `floor(now_utc_to_hour) - 7h == T`.
- This fixed eligibility lag is intentional authority, not an initial missed-slot catch-up.
- After eligibility, normal one-slot-at-a-time / oldest-first missed-slot behavior remains required.
- Accelerated time and multi-slot initial replay remain forbidden.

This profile is explicitly a **fixed-lag shadow-online qualification**, not a claim of low-latency real-time state estimation.

## 5. Two-phase collector ordering

### 5.1 Pre-boundary causal phase

Before logical boundary `T`, the collector must durably retain raw bytes, canonicalize and ingress the evidence that can honestly exist before `T`:

1. `soil_moisture_observation_v1`
2. `future_weather_assumption_v1`
3. `future_et0_assumption_v1`

These records remain subject to the original logical-time causal cutoff:

```text
event / issued time <= T
available_to_runtime_at <= T
ingested_at <= T
```

Soil must still be a real observation whose event time is inside the authorized observation window ending at `T`.

Future Weather and Future ET0 must still satisfy Amendment-05 and CAP04 forcing rules:

```text
issued_at <= T
available_to_runtime_at <= T
valid_from == T
valid_to == T + 72h
exactly 72 hourly points
same latest complete GFS cycle for weather and ET0
GFS source cycle genuinely available before the pre-boundary freeze
no future-file waiting
no cross-cycle substitution
no future evidence leakage
```

Amendment-07 does not permit delayed or post-`T` Future Forcing to become eligible.

### 5.2 Delayed exact-hour observation phase

After `T`, the collector may ingest only the two exact-hour KBS-derived records whose final interval cannot honestly be known before `T`:

1. `observed_rainfall_v1`
2. `historical_et0_estimate_v1`

The delayed collector is scheduled at `T + 06:30`.

The frozen EA4 KBS raw-hourly source freshness authority is 6 hours. Therefore, at the delayed collector's scheduled start, a source still passing that authority must have a latest provider hour at least later than the target boundary by 30 minutes. The collector must nevertheless explicitly locate the exact target hour; continuity is never assumed.

For these two records:

```text
interval_start == T - 1h
interval_end   == T
event_time     == T
```

must remain true.

The following are forbidden:

- shifting provider `datetime_utc` forward or backward;
- relabeling an older interval as `(T-1h, T]`;
- copying a previous value into the target hour;
- interpolation or persistence fill;
- fabricating `available_to_runtime_at` or `ingested_at` before actual collection;
- changing `OBSERVED` rainfall or `ESTIMATED` historical ET0 epistemic class.

If the exact target provider hour is missing, the slot is not runnable.

## 6. External-only late-availability cutoff

For the External Formal path only, the continuation evidence-window implementation may accept an explicit `exact_interval_availability_cutoff_time`.

For logical slot `T`, the only authorized value is:

```text
exact_interval_availability_cutoff_time = T + 07:12
```

This cutoff may apply only to:

```text
observed_rainfall_v1
historical_et0_estimate_v1
```

For those two types:

```text
event_time <= T
interval must still be exactly (T-1h, T]
available_to_runtime_at <= T + 07:12
ingested_at <= T + 07:12
```

For every other evidence type, including Soil and both Future Forcing families, the existing cutoff remains `T`.

The generic / historical default remains equivalent to:

```text
exact_interval_availability_cutoff_time = T
```

No global weakening of replay causality is authorized.

## 7. Runtime observer and ingestion margin

The nominal Runtime observer is `T + 07:17`.

The exact delayed-evidence cutoff `T + 07:12` creates a frozen minimum five-minute ingestion margin before the nominal observer.

A scheduled workflow start is not proof of collector completion. The Runtime path must fail closed unless the database proves, before candidate math and before canonical runtime persistence:

- all five exact binding families are present;
- Soil and both Future Forcing families were available and ingested no later than `T`;
- Rainfall and Historical ET0 match the exact `(T-1h, T]` interval and were available and ingested no later than `T + 07:12`;
- Future Weather and Future ET0 form one exact same-cycle 72-hour pair valid from `T`;
- all source bindings, scope, epistemic classes, hashes and provenance remain exact;
- raw durable-retention receipts exist before canonicalization;
- the EA5E1 slot Runtime Config ref/hash pin is exact.

If any requirement fails, no State / Forecast / Checkpoint / lineage record set may be committed for that slot.

## 8. Scheduler semantics

EA5E2 implementation must not reuse the current zero-lag scheduler eligibility unmodified for Formal execution.

The External Formal scheduler path must enforce:

```text
eligible_logical_hour <= floor(actual_utc_now_to_hour) - 7h
```

while preserving real wall-clock lease timestamps and one-slot-at-a-time oldest-first recovery.

The eligibility lag may be implemented as an additive adapter or an explicit option whose default is zero. Historical and non-External callers must retain their current zero-lag behavior.

During Amendment-07 and EA5E2 qualification, Formal scheduler slot/cursor writes remain forbidden. Scheduler rows must stay `0/0` until later authority explicitly enables Formal O00 execution.

## 9. Operational collector implementation obligations for EA5E2

EA5E2 is not complete merely because this schedule is documented.

Before EA5E2 may close, exact-head proof must demonstrate an implementation path that can:

1. perform real provider GETs outside Runtime;
2. durably retain every raw provider object privately before decode/canonicalization;
3. derive the exact five canonical Evidence families under their frozen source bindings;
4. persist through the restricted append-only Formal ingress seam;
5. keep provider fetch capability out of Runtime;
6. bind the pre-boundary phase and delayed exact-hour phase to the same target slot `T`;
7. prove the delayed exact target KBS hour rather than infer it;
8. prove same-cycle Future Weather / Future ET0;
9. hand Runtime only database Evidence plus the exact EA5E1 config pin;
10. fail closed on source delay, workflow jitter, missing raw retention, missing family, hash mismatch, wrong scope, wrong epoch, wrong slot, wrong config, or insufficient ingestion margin.

A readiness-only proof may exercise provider GETs and private transient qualification data, but it must not write Formal DB facts, R2 Formal raw objects, scheduler rows, or canonical runtime records until later authority permits the operational collector.

## 10. Source and epistemic boundaries remain frozen

No source substitution is authorized.

The frozen bindings remain:

```text
soil        = kbs_lter_variate25_vwc_100mm_v1
rainfall    = kbs_lter_raw_hourly_rain_mm_v1
historical ET0 = kbs_lter_asce_short_reference_et_hourly_v1
future weather = noaa_ncep_gfs_pgrb2_kbs_nearest_72h_v1
future ET0     = noaa_ncep_gfs_asce_short_reference_et_same_cycle_72h_v1
```

Epistemic classes remain:

```text
Soil         OBSERVED
Rainfall     OBSERVED
Historical ET0 ESTIMATED
Future Weather ASSUMED
Future ET0     ASSUMED
```

The fixed-lag availability correction is not an epistemic upgrade.

## 11. Effect if exact-head proof passes and this amendment merges to protected main

Only after exact-head proof passes and this candidate merges to protected `main`:

```text
amendment_07_effective = true
external_formal_fixed_lag_profile_authorized = true
scheduler_eligibility_lag_hours = 7
late_exact_interval_cutoff_authorized = true
late_exact_interval_cutoff_types = [observed_rainfall_v1, historical_et0_estimate_v1]
future_forcing_post_logical_time_availability_authorized = false
time_relabeling_authorized = false
source_substitution_authorized = false
EA5E1 remains effective
EA5E2 development remains authorized under Amendment-07
ea5e2_complete = false
ea5e3_effective = false
formal_o00_start_authorized = false
formal_window_started = false
formal_execution_count = 0/24
MCFT-CAP-09 completed = false
```

The next legal successor is:

```text
S6-EA5E2-COLLECTOR-RUNTIME-SCHEDULE-READINESS-UNDER-AMENDMENT-07
```

## 12. Hard nonclaims

Amendment-07 does not claim:

- low-latency real-time state estimation;
- any source substitution;
- any time relabeling;
- any weakening of Future Forcing causality;
- any historical Replay semantic change;
- any Formal DB write;
- any Formal R2 raw-object write;
- any scheduler slot/cursor write;
- any O00 execution;
- EA5E2 completion;
- EA5E3 effectiveness;
- EA5E completion;
- MCFT-CAP-09 completion.
