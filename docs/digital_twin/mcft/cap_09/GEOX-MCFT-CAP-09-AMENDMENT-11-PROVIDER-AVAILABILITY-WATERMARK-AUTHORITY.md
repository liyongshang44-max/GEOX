# GEOX MCFT-CAP-09 Amendment-11 — Provider Availability Watermark Authority

Status: **CANDIDATE — NOT EFFECTIVE UNTIL EXACT-HEAD PROOF AND PROTECTED-MAIN MERGE**

Capability line: `MCFT-CAP-09`

Slice: `MCFT-CAP-09.S6`

Base protected main at candidate start: `a2224d597e523ca1060f2172c7f9052c5fd0bdbe`

## 1. Decisive ruling

Amendment-11 corrects the External Formal temporal authority after real KBS qualification established that the governed Raw Hourly product is an **hourly-resolution observation product delivered by a daily-batch provider**.

The following Amendment-07 values are superseded as authority and become historical qualification parameters only:

```text
scheduler_eligibility_lag_hours = 7
late collector = T+06:30
exact evidence cutoff = T+07:12
runtime observer = T+07:17
```

They MUST NOT be used as normative evidence-admission, scheduler-eligibility, or Runtime-observer authority after this amendment becomes effective.

Amendment-07 remains historically correct that the qualification was a `fixed-lag shadow-online qualification`; the 7-hour lag was derived from the then-frozen 6-hour machine-freshness threshold, not from an agronomic SLA, product SLA, or KBS publication SLA.

## 2. Preserved temporal and epistemic invariants

Amendment-11 does not relax factual identity or causality. These Amendment-07 rules remain authoritative:

```text
interval_start/end must remain exact T semantics
event_time must not be rewritten
available_to_runtime_at must be actual chronology
ingested_at must be actual chronology
no future leakage
no interpolation
no persistence fill
no source substitution
raw retention before canonicalization
```

For `observed_rainfall_v1` and `historical_et0_estimate_v1` at logical boundary `T`:

```text
interval_start == T - 1h
interval_end   == T
event_time     == T
```

No older row may be relabeled as exact T. No post-hoc synthetic value may fill a missing exact interval.

## 3. KBS daily-batch provider semantics

The governed KBS Raw Hourly source is frozen for MCFT-CAP-09 as:

```text
observation_resolution = hourly
provider_publication_cadence = daily_batch
publication_unit = multi-hour batch
```

The product name `Raw Hourly` describes observation resolution; it does not establish hourly publication cadence.

Publication delay changes when GEOX could know an observation. It does not change what interval the observation describes.

Therefore these concepts are distinct and must remain distinct:

```text
phenomenon/event time
provider availability / first-seen time
retrieval time
ingress time
Runtime evidence snapshot time
```

## 4. Supersession of the <=6h delayed admission gate

The historical EA1H/EA4 rule:

```text
kbs_raw_hourly_age <= 6h
```

is retained only as:

```text
historical / online-freshness diagnostic
```

It is **not** authoritative delayed-evidence eligibility.

Specifically:

```text
kbs_raw_hourly_age <= 6h
!= late authoritative evidence eligibility
```

No KBS official hourly publication SLA was established by the predecessor qualification. The 6-hour value MUST NOT be represented as a provider publication SLA.

Delayed exact-interval evidence eligibility is instead:

```text
exact frozen source identity
+ exact T interval identity
+ raw retained before canonicalization
+ actual first_seen/retrieved/available/ingested chronology retained
+ valid quality under the frozen source contract
+ no identity conflict / duplicate conflict
```

Age alone MUST NOT invalidate an otherwise exact authoritative-late observation.

## 5. Provider Availability Watermark V1

The External Formal scheduler SHALL use:

```text
PROVIDER_AVAILABILITY_WATERMARK_V1
```

For candidate logical slot `T`, the slot is evidence-eligible iff all of the following are true.

### 5.1 Pre-boundary causal families

```text
soil_moisture_observation_v1
future_weather_assumption_v1
future_et0_assumption_v1
```

must satisfy their existing causal rule:

```text
available_to_runtime_at <= T
ingested_at <= T
```

Future Weather and Future ET0 must remain the exact same complete GFS cycle, issued and actually available before `T`, with the frozen 72-hour validity contract. Post-T future-forcing capture is not authorized.

### 5.2 Delayed exact-interval families

```text
observed_rainfall_v1
historical_et0_estimate_v1
```

must both actually exist for exactly `(T-1h, T]`, with real raw-retention and availability/ingress chronology.

They are eligible when present in the governed evidence snapshot; there is no fixed `T+432` normative cutoff.

### 5.3 Runtime Config and crop

```text
exact Runtime Config authority(T) valid
exact crop authority(T) valid
```

Amendment-11 creates no crop authority and modifies no crop authority.

## 6. Evidence snapshot authority

`PostgresExternalFormalEvidenceSourceV1` and the External continuation builder are authorized to accept an explicit:

```text
evidence_snapshot_time
```

The snapshot has role-specific use:

```text
soil                    cutoff = T
future weather          cutoff = T
future ET0              cutoff = T
rainfall                cutoff = evidence_snapshot_time
historical ET0          cutoff = evidence_snapshot_time
```

The snapshot time MUST be an actual execution/read snapshot and MUST NOT precede any admitted delayed record's real availability or ingress chronology.

Generic Replay and historical continuation defaults remain unchanged. This is an additive External Formal adapter correction, not a CAP-02/CAP-03/CAP-04 mathematical change.

## 7. EA5E2 rolling qualification capture

EA5E2 qualification SHALL stop using the workflow shape:

```text
workflow_dispatch
-> choose future T
-> wait fixed 7h
-> hope exact KBS T appears
```

The authorized qualification shape is:

```text
actual hourly pre-boundary capture
-> for upcoming T capture soil + same-cycle GFS future weather/ET0 before T
-> private transient raw retention + isolated qualification DB/package
-> retain rolling candidate packages for approximately 36h

KBS daily batch detected
-> scan retained causal candidate T values
-> intersect crop-legal T values
-> require exact KBS T rainfall/historical-ET0 row
-> assemble exact five evidence families
-> DB-only Runtime observer using evidence_snapshot_time
-> EA5E2 qualification
```

A pre-boundary package may qualify only if its soil/GFS evidence was actually acquired and frozen before its target `T`.

Batch arrival MUST NOT authorize retroactive post-T acquisition of soil/GFS followed by relabeling as pre-boundary evidence. That would be replay/post-hoc reconstruction and is forbidden for this qualification.

Qualification candidate retention is not Formal canonical persistence and creates no Formal authority by itself.

## 8. Formal 24-hour scheduler rule

Formal Stage 1B still requires **24 actual UTC hourly scheduler boundaries**. Amendment-11 does not authorize accelerated execution.

The persistent scheduler operates one slot per actual scheduler boundary and selects:

```text
oldest(
  T where
    not terminally executed
    and pre-boundary causal package valid
    and delayed exact-interval watermark satisfied
    and exact Runtime Config authority(T) valid
    and exact crop authority(T) valid
)
```

It must preserve:

```text
persistent cursor
lease / fencing
restart recovery
missed-slot detection
oldest-first backfill
actual database evidence
no future leakage
one-slot-at-a-time canonical commit
```

The scheduler clock remains actual UTC wall clock. Provider batch arrival advances evidence availability; it does not replace the scheduler clock.

## 9. Online vs authoritative-late source role

For MCFT-CAP-09 Stage 1B:

```text
KBS Raw Hourly = AUTHORITATIVE_LATE / nearline observation source
```

A future separately qualified live source may serve:

```text
ONLINE operational evidence
```

KBS Current Weather or any other candidate is not automatically substituted. A future source must independently prove complete frozen inputs, identity, quality, temporal semantics and any ET0 derivation authority before it can enter Runtime.

No source substitution is authorized by Amendment-11.

## 10. Crop authority effect

```text
crop_authority_effect = NONE
```

Amendment-11 addresses only:

```text
KBS timing semantics
scheduler eligibility
evidence availability
EA5E2 qualification orchestration
```

It does not resolve or bypass:

```text
CURRENT_CROP_AUTHORITY_HAS_NO_FUTURE_LEGAL_TARGET
```

Amendment-09 and Amendment-10 remain authoritative for crop/season salvage and bounded proxy behavior. No MID extension, fabricated LATE stage, single-variant FAO selection, or automatic P0306 stage establishment is authorized here.

## 11. Preserved kernel boundary

The following are explicitly unchanged:

```text
CAP-02 water-balance math
CAP-03 exact event-time / interval semantics
CAP-04 candidate math and forcing semantics
canonical object contracts
transaction families
append-only persistence
lineage / checkpoint semantics
historical Replay behavior
Recommendation / Approval / AO-ACT / Dispatch boundaries
```

Only External Formal adapter, qualification orchestration and scheduler evidence-eligibility semantics may change under this authority.

## 12. Effect if exact-head proof passes and this amendment merges to protected main

Only after exact-head governance proof passes and the candidate merges to protected `main`:

```text
amendment_11_effective = true
provider_availability_watermark_v1_authorized = true
fixed_lag_7h_normative_authority = false
t_plus_0630_collector_normative_authority = false
t_plus_0712_cutoff_normative_authority = false
t_plus_0717_observer_normative_authority = false
kbs_raw_hourly_le_6h_delayed_admission_authority = false
kbs_raw_hourly_le_6h_freshness_diagnostic_retained = true
evidence_snapshot_time_external_adapter_authorized = true
rolling_preboundary_qualification_capture_authorized = true
batch_triggered_candidate_intersection_authorized = true
formal_actual_hour_scheduler_required = true
formal_oldest_eligible_watermark_required = true
crop_authority_effect = NONE
source_substitution_authorized = false
future_forcing_post_T_availability_authorized = false
time_relabeling_authorized = false
formal_window_started = false
formal_execution_count = 0/24
EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false
EA5E3 = false
MCFT-CAP-09 completed = false
```

Next implementation frontier:

```text
S6-EA5E2-PROVIDER-WATERMARK-EXTERNAL-ADAPTER-AND-ROLLING-QUALIFICATION
```

## 13. Hard nonclaims

This amendment does not claim that:

- every delayed KBS row is valid merely because it exists;
- daily publication timing is a guaranteed provider SLA;
- KBS Current Weather is qualified for full hourly ASCE ET0;
- historical data may be fetched after T and represented as pre-boundary causal evidence;
- crop authority is established;
- Formal O00 may start immediately;
- the 24 actual-hour Stage 1B proof may be compressed;
- Runtime may call public providers;
- raw retention, source identity, exact interval identity, quality or chronology checks may be skipped.
