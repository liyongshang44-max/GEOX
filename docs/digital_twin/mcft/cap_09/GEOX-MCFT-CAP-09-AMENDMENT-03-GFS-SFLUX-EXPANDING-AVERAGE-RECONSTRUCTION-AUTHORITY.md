# GEOX MCFT-CAP-09 — Amendment-03: GFS sflux Expanding-Average Reconstruction Authority

## 1. Status and scope

```text
document_id:
GEOX-MCFT-CAP-09-AMENDMENT-03-GFS-SFLUX-EXPANDING-AVERAGE-RECONSTRUCTION-AUTHORITY

capability_line_id:
MCFT-CAP-09

slice_id:
MCFT-CAP-09.S6

sub_lifecycle:
S6-EA1O

base_protected_main_sha:
9c59d92c74738639429d636c92f854b5120382d0

amendment_01_blob:
41270b888e15e4d9a6c9a34e1fa3f70e957a275e

amendment_02_blob:
3ec68f7a33274ff96c5f613154b4357d2b057fd1

ea1o_b_fail_close_blob:
cd817199ed16ce429cf99743ffebcaf7fe562053

amendment_effect:
SOLAR_RADIATION_TEMPORAL_RECONSTRUCTION_CANDIDATE_ONLY

runtime_contract_delta:
NONE

canonical_object_contract_delta:
NONE

formal_window_started:
false
```

Amendment-03 is a narrow S6 architecture adjudication inside the existing
`S6-EA1O` External Evidence Authority lifecycle. It does not reopen S0-S5,
change the shared Twin kernel, change canonical transaction semantics, create a
Runtime provider fetch path, authorize database writes, or start Formal
O00-O23.

Its only purpose is to permit one explicitly defined temporal reconstruction
algorithm to become a **candidate for later live qualification** after EA1O-B
proved that the Amendment-02 direct-one-hour source requirement cannot be met
by the production GFS sflux inventory.

## 2. Decisive predecessor fact

EA1O-B executed Amendment-02 against one exact current production GFS cycle and
then re-proved the result at its final PR head. The effective protected-main
adjudication established:

```text
required target intervals: 72
observed direct preceding-one-hour surface DSWRF averages: 12
observed multi-hour surface DSWRF averages: 60
observed average-window lengths: 1,2,3,4,5,6 hours
N-hour forecast DSWRF records present: 72
source objects available before freeze boundary: 72/72
```

The production inventory follows six-hour-block expanding-average semantics,
for example:

```text
F005 -> 0-5 hour ave fcst
F006 -> 0-6 hour ave fcst
F007 -> 6-7 hour ave fcst
F011 -> 6-11 hour ave fcst
F012 -> 6-12 hour ave fcst
F013 -> 12-13 hour ave fcst
```

Therefore Amendment-02's direct-only candidate was correctly rejected as:

```text
REJECTED_AS_AMENDMENT02_DIRECT_1H_SOURCE_AUTHORITY
```

That rejection remains authoritative. Amendment-03 does not reinterpret it as
a pass and does not authorize the separate `N hour fcst` record as an hourly
average.

## 3. Narrow temporal-reconstruction candidate

For the future-ET0 solar-radiation input only, Amendment-03 permits later
qualification of one candidate algorithm over the **average** surface DSWRF
records from `gfs.tCCz.sfluxgrbfFFF.grib2`.

For forecast lead `f`, define the six-hour block start:

```text
b = 6 * floor((f - 1) / 6)
n = f - b
```

Thus `n` is in `1..6` and the eligible average record for `f` must have exactly:

```text
startStep = b
endStep   = f
stepType  = avg
parameter = surface DSWRF
```

Let `A_f` be the decoded average DSWRF value for that exact provider record.
The candidate hourly value `H_f` is frozen as:

```text
if n == 1:
    H_f = A_f

if n > 1:
    H_f = n * A_f - (n - 1) * A_(f-1)
```

The predecessor average `A_(f-1)` is eligible only when it belongs to the same
six-hour block and has exactly:

```text
startStep = b
endStep   = f - 1
stepType  = avg
parameter = surface DSWRF
```

No arithmetic may cross a six-hour block boundary.

## 4. Support-lead rule

The canonical future-weather interval remains exactly T+1h through T+72h and
continues to use the exact cycle selected by governed EA1K chronology.

If the canonical first target lead begins after the first hour of its six-hour
block, one preceding support lead is required solely to reconstruct the first
target interval:

```text
canonical_lead_start = L
block_start = 6 * floor((L - 1) / 6)

if L - block_start == 1:
    support_lead = NONE
else:
    support_lead = L - 1
```

A support lead:

- must come from the same exact GFS cycle;
- must have been genuinely available before the same Evidence freeze boundary;
- is provenance/support input only and is not an extra canonical forecast point;
- may not shift the 72 target valid times;
- may not be borrowed from a previous or newer cycle.

## 5. Why this requires a new architecture amendment

The weighted-difference operation is an inference rule. Amendment-02 did not
authorize it for sflux, and EA1O-B explicitly preserved:

```text
sflux_expanding_window_reconstruction_requires_separate_architecture_authority
```

The operation therefore cannot be introduced by a lower-level probe, adapter,
collector, or implementation PR.

Amendment-03 authorizes only the **candidate algorithm definition** above. It
does not establish that the decoded/reconstructed 72-hour sequence is valid,
nonnegative, spatially qualified, or fit for Formal Evidence.

## 6. Packing and quantization boundary

EA1N previously demonstrated why algebra over provider-packed rolling averages
cannot be treated as exact merely because the equation is algebraically valid.
The later EA1O-C live qualification must inspect the actual GRIB2 packing
metadata for every selected sflux average message.

For a GRIB2 field whose decoded physical-value quantum is `q`, the probe must
retain the half-quantum diagnostic bound:

```text
epsilon = q / 2
```

For a reconstructed interval with `n > 1`, it must also report the propagated
bound:

```text
epsilon_H <= n * epsilon_f + (n - 1) * epsilon_(f-1)
```

This propagated bound is diagnostic only. It may not be used to clip, replace,
threshold, or silently repair a reconstructed value.

The later qualification must fail closed if any reconstructed candidate value
is non-finite or negative. A negative candidate remains a failure even when its
magnitude is within the propagated quantization bound. Physical zero being
inside an uncertainty interval is not authority to substitute zero.

## 7. Same-cycle and chronology invariants

All Amendment-01/02 chronology rules remain hard:

```text
future_weather_assumption.source_cycle
== future_et0_assumption.source_cycle
```

The later reconstruction qualification must consume the exact EA1K-selected
cycle and freeze boundary. It may not:

```text
wait for a future source object
select a newer radiation-only cycle
rewrite issue time
rewrite valid time
borrow a support record from another cycle
retrospectively replace a previously frozen object
```

## 8. Source-record selection rules

For each required target/support lead, the eligible source is the unique
surface DSWRF `avg` record whose GRIB start/end steps match the block rule in
Section 3.

The separate provider record:

```text
surface DSWRF | N hour fcst
```

remains forbidden as the interval-average input.

No first-record-wins rule, line-number pin, static inventory offset, or
parameter-name-only selection is permitted. Exact live `.idx` byte offsets and
GRIB message semantics must be proven at the exact candidate head.

## 9. Spatial authority remains unqualified

Amendment-03 does not revive the spatial stage skipped by EA1O-B.

NCEP identifies `gfs.tCCz.sfluxgrbfFFF.grib2` as the separate GFS T1534
Semi-Lagrangian product family. It is not the EA1M `pgrb2.0p25` longitude-
latitude grid authority.

EA1O-C must therefore live-prove the current sflux native GRIB geometry and
freeze the exact KBS T1/R1 extraction rule from real provider messages.
Until that succeeds:

```text
sflux_source_authority: NOT_QUALIFIED
sflux_spatial_authority: NOT_QUALIFIED
future_et0_solar_role_authorized_for_formal: false
```

The following remain frozen:

```text
direct_field_equivalence: false
model_grid_is_observation_truth: false
silent_pgrb2_sflux_grid_equivalence: forbidden
silent_interpolation: forbidden
```

## 10. Required EA1O-C live qualification

The first legal successor after Amendment-03 becomes effective is:

```text
EA1O-C LIVE SFLUX EXPANDING-AVERAGE RECONSTRUCTION + SPATIAL QUALIFICATION
```

At one exact candidate head and one governed tick boundary T, EA1O-C must prove:

1. the exact EA1K-selected GFS cycle and 72 target valid times;
2. all target and any required support sflux objects existed before T;
3. unique live surface DSWRF average-record semantics for every target/support
   lead;
4. six-hour-block identity and no cross-block arithmetic;
5. exact Range retrieval of only the selected GRIB messages;
6. pinned decoder identity and successful decode;
7. `startStep`, `endStep`, `stepType`, units and packing metadata from each live
   message;
8. the frozen Section-3 reconstruction exactly, with no alternative formula;
9. all 72 reconstructed target values finite and nonnegative with no clipping,
   thresholding, fallback or imputation;
10. quantization diagnostics for every reconstructed interval;
11. current production sflux native-grid definition;
12. one explicit nearest-native-point spatial rule for the current KBS
    T1/R1/main polygon, with no silent pgrb2 coordinate reuse or interpolation;
13. stable spatial selection across all required source messages;
14. hash-only/public-safe evidence with no raw KBS polygon, raw `.idx`, raw GRIB
    payload or decoded DSWRF sequence publication.

Any failed item fails closed.

## 11. Preserved authority for other future-weather roles

Amendment-03 changes no other future-weather source or normalization rule.
`pgrb2.0p25` remains the primary GFS future-weather family for the roles already
qualified by the EA1K-EA1N chain, including temperature, humidity, wind and the
separately adjudicated precipitation candidate.

The sflux exception remains confined to the solar-radiation derivation input
for `future_et0_assumption_v1`.

## 12. Canonical and Runtime compatibility

This amendment changes only an eligible source-normalization candidate before
Formal Evidence construction. Runtime continues to consume canonical:

```text
future_weather_assumption_v1 -> precipitation_mm
future_et0_assumption_v1      -> et0_mm_per_hour
```

Runtime does not consume raw/reconstructed DSWRF and remains forbidden from
fetching public providers. No canonical object family, Runtime forcing selector,
transaction family, migration, or persistence semantic is changed here.

## 13. Frozen prohibitions

```text
NO_SILENT_AMENDMENT_02_OVERRIDE
NO_DIRECT_ONLY_REJECTION_REINTERPRETATION_AS_PASS
NO_N_HOUR_FCST_AS_INTERVAL_AVERAGE
NO_CROSS_BLOCK_RECONSTRUCTION
NO_CROSS_CYCLE_RECONSTRUCTION
NO_FUTURE_FILE_WAIT
NO_VALID_TIME_REWRITE
NO_NEGATIVE_CLIPPING
NO_ZERO_THRESHOLDING
NO_SILENT_IMPUTATION
NO_PGRB2_DSWRF_FALLBACK
NO_SILENT_PGRB2_SFLUX_GRID_EQUIVALENCE
NO_UNQUALIFIED_INTERPOLATION
NO_RUNTIME_PROVIDER_FETCH
NO_DATABASE_WRITE_IN_AMENDMENT_03
NO_FORMAL_EVIDENCE_WRITE_IN_AMENDMENT_03
NO_FUTURE_ET0_EXECUTION_IN_AMENDMENT_03
NO_EA2_START
NO_FORMAL_O00_O23_START
NO_MCFT_CAP09_COMPLETION_CLAIM
```

## 14. Effectiveness and next legal action

Amendment-03 becomes effective only after protected-main merge under the
repository delivery policy. Its merge authorizes the reconstruction algorithm
as a candidate for live qualification only.

It does not qualify sflux, does not freeze the sflux grid, and does not permit
future ET0 construction or Formal Evidence ingress.

Only a passing EA1O-C exact-head live qualification may establish a successor
source/spatial authority candidate and permit the S6 authority chain to consider
advancing to EA2.
