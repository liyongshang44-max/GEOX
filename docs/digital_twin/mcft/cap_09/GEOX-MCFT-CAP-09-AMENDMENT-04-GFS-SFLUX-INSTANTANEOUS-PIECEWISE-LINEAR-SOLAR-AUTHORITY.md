# GEOX MCFT-CAP-09 — Amendment-04: GFS sflux Instantaneous Piecewise-Linear Solar Authority

## 1. Status and scope

```text
document_id:
GEOX-MCFT-CAP-09-AMENDMENT-04-GFS-SFLUX-INSTANTANEOUS-PIECEWISE-LINEAR-SOLAR-AUTHORITY

capability_line_id:
MCFT-CAP-09

slice_id:
MCFT-CAP-09.S6

sub_lifecycle:
S6-EA1O

base_protected_main_sha:
f7ab20326dc78612f730225424aa23545a2ee258

ea1o_c_value_rejection_blob:
9168122b61aff4bc05c05c0497a6e6150d86ac41

amendment_effect:
SOLAR_RADIATION_MODEL_DERIVED_TEMPORAL_INTEGRATION_CANDIDATE_ONLY

runtime_contract_delta:
NONE

canonical_object_contract_delta:
NONE

formal_window_started:
false
```

Amendment-04 is a narrow S6 architecture adjudication inside the existing
`S6-EA1O` External Evidence Authority lifecycle. It does not reopen S0-S5,
change the Twin kernel, alter canonical transaction families, add a Runtime
provider fetch path, authorize database writes, or start Formal O00-O23.

Its only purpose is to permit one explicitly epistemic-bounded solar-radiation
transformation to become a candidate for live qualification after both prior
attempts to establish an exact hourly average scalar failed closed.

## 2. Decisive predecessor facts

Two separate effective protected-main adjudications are authoritative:

```text
EA1O-B:
REJECTED_AS_AMENDMENT02_DIRECT_1H_SOURCE_AUTHORITY

reason:
production sflux provides 12 direct preceding-one-hour DSWRF averages and
60 multi-hour averages across the governed 72 target intervals

EA1O-C:
REJECTED_AS_AMENDMENT03_SFLUX_RECONSTRUCTION_VALUE_AUTHORITY

reason:
weighted-difference reconstruction produced 5 negative target values out of 72
under the frozen no-clipping/no-threshold policy
```

EA1O-C also independently proved a useful and separable fact:

```text
native sflux spatial candidate: PASS
actual grid: regular_gg
Gaussian N: 768
points: 4,718,592
KBS T1/R1/main centroid + all unique vertices selected one stable native point
```

Amendment-04 consumes these facts exactly. It does not reinterpret either
value-source rejection as a pass. The native-grid finding is a predecessor
spatial fact only and must still be re-proved at the later live candidate head.

## 3. Epistemic correction

The earlier EA1O-B/EA1O-C attempts sought an exact hourly average DSWRF scalar.
Amendment-04 deliberately stops making that claim.

The newly eligible solar input is instead:

```text
epistemic_class:
MODEL_DERIVED_PIECEWISE_LINEAR_FORECAST_INTERPOLATION

quality_status:
LIMITED

direct_field_equivalence:
false

model_grid_is_observation_truth:
false
```

The provider's instantaneous DSWRF forecast points remain model forecast
samples. The hourly solar input is a deterministic transformation of those
samples under an explicitly frozen within-hour interpolation assumption.

It is not:

```text
an observed hourly radiation total
a provider-issued direct hourly average
a reconstruction of hidden provider truth
a calibration result
a field measurement
```

## 4. Instantaneous endpoint candidate

For each canonical target interval ending at GFS forecast lead `f`, define:

```text
I_(f-1) = instantaneous surface DSWRF forecast at lead f-1
I_f     = instantaneous surface DSWRF forecast at lead f
```

Both endpoints must:

- come from the same exact EA1K-selected GFS cycle;
- use the sflux product family;
- be the unique live `surface DSWRF | N hour fcst` point record for their lead;
- have existed before the same Evidence freeze boundary;
- decode finite and nonnegative;
- use the same qualified native spatial extraction point.

The phrase `N hour fcst` is authorized here only as an **instantaneous endpoint
sample**. It remains forbidden to treat that record directly as an interval
average.

## 5. Frozen piecewise-linear interpolation model

For the one-hour interval `[f-1,f]`, define normalized intra-hour coordinate
`u in [0,1]` and frozen model:

```text
I_f(u) = (1-u) * I_(f-1) + u * I_f
```

The hourly mean DSWRF of this declared interpolation model is therefore exactly:

```text
H_f = integral_0^1 I_f(u) du
    = (I_(f-1) + I_f) / 2
```

This is exact with respect to the **declared piecewise-linear forecast model**.
It is not claimed to be exact with respect to the unknown continuous physical
radiation trajectory or a hidden provider interval-average field.

No midpoint invention, spline, higher-order fit, persistence assumption or
weather-dependent heuristic is authorized.

## 6. Solar-energy conversion

For each one-hour target interval:

```text
H_f unit:
W/m^2

Rs_f = H_f * 0.0036

Rs_f unit:
MJ/m^2/hour
```

The factor `0.0036` is the already-frozen hourly flux-to-energy conversion used
by the EA1I ET0 authority chain.

The later future ET0 builder may consume `Rs_f` only after EA1O-D live
qualification becomes effective and the resulting provenance/quality metadata
is frozen into the Formal authority chain.

## 7. Support endpoint rule

The canonical target interval remains exactly T+1h through T+72h. To calculate
72 adjacent hourly intervals, the candidate requires 73 instantaneous endpoint
samples:

```text
canonical_lead_start = L
canonical_lead_end   = L + 71
support_lead         = L - 1
required endpoint leads = support_lead ... canonical_lead_end
```

The support endpoint:

- is always required;
- must be from the same exact GFS cycle;
- must have existed before the same Evidence freeze boundary;
- is provenance/support input only;
- is not a 73rd canonical future-weather point;
- may not shift target valid times.

If `support_lead=0`, the live qualifier must prove the eligible sflux F000
instantaneous endpoint exists and satisfies the same semantic/transport rules.
If it does not, the candidate fails closed; it may not borrow from another
cycle.

## 8. Same-cycle and chronology invariants

All existing chronology rules remain hard:

```text
future_weather_assumption.source_cycle
== future_et0_assumption.source_cycle
```

The later qualifier may not:

```text
wait for a future source object
select a newer radiation-only cycle
borrow an endpoint from another cycle
rewrite issue time
rewrite valid time
retrospectively replace a frozen endpoint
```

All 73 required endpoint objects/indexes must be genuinely available before the
same EA1K qualification tick boundary.

## 9. Source-record identity

EA1O-C observed the production sflux instantaneous/average DSWRF family under
GRIB2 local parameter identity:

```text
discipline = 0
parameterCategory = 4
parameterNumber = 192
paramId = 260087
shortName = sdswrf
name = Surface downward short-wave radiation flux
```

The later qualifier must re-prove the actual live GRIB2 identity. `shortName`
alone is not authority.

For an instantaneous endpoint, the decoder-level role must also prove:

```text
typeOfLevel = surface
stepType = instant
forecast lead identity = requested endpoint lead
units = W/m^2-equivalent ecCodes radiation-flux units
```

The `.idx` selector remains the unique semantic record:

```text
DSWRF:surface:<lead> hour fcst
```

No first-record-wins, static line number, stale byte offset, average-record
substitution or parameter-name-only selector is permitted.

## 10. Packing and value rules

EA1O-D must record live packing metadata for every selected instantaneous
message, including at least:

```text
packingType
bitsPerValue
binaryScaleFactor
decimalScaleFactor
```

Packing metadata is provenance/diagnostic evidence. Because Amendment-04 does
not subtract packed averages, no weighted-difference repair logic is relevant.

Hard value rules are:

```text
every instantaneous endpoint finite
every instantaneous endpoint >= 0
every derived H_f finite
every derived H_f >= 0
every derived Rs_f finite
every derived Rs_f >= 0
negative clipping forbidden
zero thresholding forbidden
silent imputation forbidden
pgrb2 DSWRF fallback forbidden
```

Any failure fails closed.

## 11. Native spatial authority

EA1O-C's spatial PASS is predecessor evidence, not permission to skip reproof.
EA1O-D must live-reprove the sflux native grid and KBS extraction against the
instantaneous endpoint messages.

The candidate method remains:

```text
ECCODES_NEAREST_NATIVE_GRID_POINT
```

The KBS T1/R1/main polygon centroid and every unique vertex must select the same
native point for every required endpoint message, with stable live grid
definition, index and coordinate.

The following remain forbidden:

```text
silent pgrb2 0.25-degree coordinate reuse
silent pgrb2/sflux grid equivalence
interpolation between native spatial grid points
model-grid-as-observation-truth upgrade
```

## 12. Formal Evidence epistemic metadata

If EA1O-D eventually passes and becomes effective, any Formal
`future_et0_assumption_v1` built from this solar path must carry provenance and
limitations sufficient to distinguish it from direct provider hourly truth.

At minimum the transformation metadata must identify:

```text
source product = GFS sflux
source role = instantaneous surface DSWRF endpoint samples
temporal transformation = PIECEWISE_LINEAR_ENDPOINT_INTEGRATION_V1
hourly mean formula = (I_(f-1)+I_f)/2
energy conversion = *0.0036 MJ/m^2/hour
quality.status = LIMITED
direct_field_equivalence = false
```

`quality.status=PASS` is not authorized for the solar temporal transformation
under Amendment-04.

Runtime compatibility is unchanged: Runtime consumes the final canonical
`future_et0_assumption_v1 -> et0_mm_per_hour` series and does not consume raw or
intermediate DSWRF values.

## 13. Required EA1O-D live qualification

The first legal successor after Amendment-04 becomes effective is:

```text
EA1O-D LIVE SFLUX INSTANTANEOUS PIECEWISE-LINEAR SOLAR QUALIFICATION
```

At one exact candidate head and one governed tick boundary T, EA1O-D must prove:

1. the exact EA1K-selected GFS cycle and 72 canonical target valid times;
2. exactly one required support endpoint plus the 72 target endpoints;
3. all 73 endpoint `.idx` and GRIB objects existed before T;
4. unique live `surface DSWRF | <lead> hour fcst` selection for every endpoint;
5. exact Range retrieval of only each selected GRIB message;
6. pinned decoder identity and successful decode;
7. live GRIB2 numeric parameter identity, surface role, instantaneous step type,
   lead identity, units and packing metadata;
8. all 73 endpoint values finite and nonnegative;
9. the Section-5 piecewise-linear model and `H_f=(I_(f-1)+I_f)/2` exactly;
10. `Rs_f=H_f*0.0036` exactly;
11. all 72 derived H/Rs values finite and nonnegative with no repair;
12. current live sflux native grid definition;
13. stable nearest-native KBS T1/R1/main spatial consensus across all 73
    endpoint messages;
14. explicit `MODEL_DERIVED_PIECEWISE_LINEAR_FORECAST_INTERPOLATION` and
    `quality.status=LIMITED` candidate semantics;
15. hash-only/public-safe evidence with no raw KBS polygon, raw `.idx`, raw GRIB,
    decoded endpoint sequence or derived solar sequence publication.

Any failed item fails closed.

## 14. Optional consistency diagnostics

EA1O-D may compare the integrated instantaneous-derived solar sequence against
provider average DSWRF records for diagnostic purposes only, provided that:

- those average records are not used to scale or repair the candidate sequence;
- no arbitrary pass threshold is introduced without a separate authority;
- diagnostic disagreement cannot be hidden;
- the candidate's epistemic class remains `MODEL_DERIVED` regardless of
  agreement.

This diagnostic is not required to establish direct-field equivalence and can
never establish such equivalence.

## 15. Preserved authority for other future-weather roles

Amendment-04 changes no temperature, humidity, wind or precipitation source
rule. `pgrb2.0p25` remains the primary future-weather family for those roles as
already governed by the EA1K-EA1N chain.

The sflux exception remains confined to the solar-radiation derivation input
for `future_et0_assumption_v1`.

## 16. Frozen prohibitions

```text
NO_EA1O_B_REINTERPRETATION_AS_PASS
NO_EA1O_C_REINTERPRETATION_AS_PASS
NO_N_HOUR_FCST_AS_DIRECT_INTERVAL_AVERAGE
NO_HIDDEN_HOURLY_TRUTH_CLAIM
NO_CROSS_CYCLE_ENDPOINT_PAIR
NO_FUTURE_FILE_WAIT
NO_VALID_TIME_REWRITE
NO_NEGATIVE_CLIPPING
NO_ZERO_THRESHOLDING
NO_SILENT_IMPUTATION
NO_PGRB2_DSWRF_FALLBACK
NO_SILENT_PGRB2_SFLUX_GRID_EQUIVALENCE
NO_SPATIAL_INTERPOLATION
NO_RUNTIME_PROVIDER_FETCH
NO_DATABASE_WRITE_IN_AMENDMENT_04
NO_FORMAL_EVIDENCE_WRITE_IN_AMENDMENT_04
NO_FUTURE_ET0_EXECUTION_IN_AMENDMENT_04
NO_QUALITY_PASS_FOR_THIS_SOLAR_TRANSFORMATION
NO_EA2_START
NO_FORMAL_O00_O23_START
NO_MCFT_CAP09_COMPLETION_CLAIM
```

## 17. Effectiveness and next legal action

Amendment-04 becomes effective only after protected-main merge under repository
delivery policy. Its merge authorizes only the instantaneous-endpoint
piecewise-linear temporal transformation as a candidate for live qualification.

It does not qualify the 73 endpoint messages, does not create Formal solar or
ET0 Evidence, and does not authorize EA2.

Only a passing and effective EA1O-D exact-head qualification may establish the
next source/value/spatial/transformation candidate and permit the S6 authority
chain to consider advancing to EA2.
