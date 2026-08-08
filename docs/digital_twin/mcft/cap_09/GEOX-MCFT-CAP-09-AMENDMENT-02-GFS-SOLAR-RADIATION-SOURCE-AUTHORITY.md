# GEOX MCFT-CAP-09 — Amendment-02: GFS Solar-Radiation Source Authority

## 1. Status and scope

```text
document_id:
GEOX-MCFT-CAP-09-AMENDMENT-02-GFS-SOLAR-RADIATION-SOURCE-AUTHORITY

capability_line_id:
MCFT-CAP-09

slice_id:
MCFT-CAP-09.S6

sub_lifecycle:
S6-EA1O

base_protected_main_sha:
3d46d38206f27d5d7abe2ec24577979ab29c68f8

amendment_01_blob:
41270b888e15e4d9a6c9a34e1fa3f70e957a275e

ea1n_fail_close_blob:
607af693cd2f7d8d80e18d5308c16e128d397e44

amendment_effect:
SOLAR_RADIATION_INPUT_ROLE_SOURCE_EXCEPTION_ONLY

runtime_contract_delta:
NONE

canonical_object_contract_delta:
NONE

formal_window_started:
false
```

Amendment-02 is a narrow architecture correction inside the existing S6
External Evidence Authority lifecycle. It does not reopen S0–S5, change the
shared Twin kernel, change canonical transaction semantics, create a new
Runtime source, or start Formal O00–O23.

## 2. Why Amendment-02 is required

Amendment-01 froze NOAA/NCEP GFS 0.25-degree hourly output as the primary
72-hour future-weather authority. EA1K–EA1M subsequently froze production
chronology, hourly normalization semantics and the exact `pgrb2.0p25` model
node used for that candidate authority.

EA1N then executed the real value-level path and fail-closed the
`pgrb2.0p25` DSWRF rolling-average reconstruction:

```text
PGRB2_0P25_ROLLING_AVERAGE_WEIGHTED_DIFFERENCE
-> REJECTED_AS_EXACT_HOURLY_SCALAR_AUTHORITY
```

The decisive evidence showed that the F020 reconstructed hourly DSWRF was
negative, that the negative magnitude was inside the propagated GRIB2
quantization interval, and that physical zero was also inside that interval.
Therefore provider-packed rolling averages did not identify one unique
physically valid hourly scalar without clipping, zero-thresholding or another
new inference rule. The same-grid `pgrb2b.0p25` inventory contained no surface
DSWRF escape hatch.

A lower supporting authority may not silently replace Amendment-01's frozen
0.25-degree source with a different GFS product. A separately adjudicated
architecture amendment is therefore required before another source product may
be considered for the solar-radiation role.

## 3. Narrow source exception

Amendment-02 preserves Amendment-01 for the primary future-weather package and
creates one conditional exception only for the solar-radiation input used to
derive `future_et0_assumption_v1`.

The candidate product is:

```text
provider: NOAA/NCEP
model: GFS
candidate_product: gfs.tCCz.sfluxgrbfFFF.grib2
candidate_role: FUTURE_ET0_SOLAR_RADIATION_INPUT
candidate_parameter: surface DSWRF
required_statistical_semantics: DIRECT_PRECEDING_ONE_HOUR_AVERAGE
canonical_source_unit: W/m^2
```

The NCEP product inventory currently identifies the GFS surface-flux product
through FH384. Its FH001 inventory contains two distinct surface DSWRF records:

```text
surface DSWRF | 0-1 hour ave | Downward Short-Wave Radiation Flux [W/m^2]
surface DSWRF | 1 hour fcst  | Downward Short-Wave Radiation Flux [W/m^2]
```

Only the direct preceding-one-hour average is an eligible source candidate for
ASCE hourly reference-ET solar energy. The separate `1 hour fcst` DSWRF record
is not interchangeable and is not authorized by this amendment.

The NCEP static inventory is design evidence only. It does not prove current
live object availability, exact-head chronology, current GRIB geometry, exact
record uniqueness, spatial support, or value-level qualification.

## 4. Preserved authority for all other roles

Amendment-02 does not replace the GFS 0.25-degree future-weather authority as a
whole.

Unless separately adjudicated later, the following remain governed by the
already-frozen `pgrb2.0p25` authority chain:

```text
future-weather cycle selection and publication chronology
future-weather 72-point T+1h ... T+72h boundary
future precipitation authority candidate
2 m temperature
2 m humidity
10 m wind components
other pgrb2 roles already qualified by EA1K-EA1M/EA1N
```

The only source-product exception created here is the solar-radiation input
needed by future ET0.

## 5. Same-cycle invariant

Amendment-01's same-cycle invariant remains hard:

```text
future_weather_assumption.source_cycle
== future_et0_assumption.source_cycle
```

If `sflux` later qualifies, its DSWRF record must come from the same exact GFS
cycle selected for the corresponding `future_weather_assumption_v1`.

No cross-cycle substitution, latest-radiation-only substitution, future-cycle
wait, issue-time rewrite, valid-time rewrite or retrospective fresher-object
replacement is allowed.

## 6. Separate source-object and spatial provenance

A mixed GFS product bundle is permitted only at provenance level; it is not
spatial equivalence.

The future ET0 derivation must preserve per-input provenance sufficient to show:

```text
provider
model
cycle
product family
source object/file identity
forecast lead
parameter
statistical-processing window
retrieval time
availability time
raw/object digest
native grid definition
selected native grid point
selection/interpolation rule
spatial support class
adapter/decoder version
limitations
```

The solar-radiation source object/grid must not be relabelled as the EA1M
`pgrb2.0p25` node.

## 7. Spatial authority must be re-frozen

The NCEP products page labels `gfs.tCCz.sfluxgrbfFFF.grib2` separately from the
0.25-degree global longitude-latitude products. Amendment-02 therefore does not
freeze a numerical sflux grid coordinate from static documentation.

Before source qualification, EA1O must live-prove the current production GRIB
geometry and freeze the solar-radiation spatial extraction authority from the
actual provider object.

Until that proof passes:

```text
sflux_spatial_authority: NOT_QUALIFIED
sflux_source_authority: NOT_QUALIFIED
future_et0_solar_role_authorized_for_formal: false
```

The later spatial authority must retain:

```text
direct_field_equivalence: false
model_grid_is_observation_truth: false
silent_pgrb2_sflux_grid_equivalence: forbidden
silent_interpolation: forbidden
```

If interpolation is ever required, it must be separately frozen and tested;
Amendment-02 does not authorize it.

## 8. Required EA1O live qualification

A successor exact-head qualification must prove, for one tick boundary `T`:

1. the same GFS cycle selected by the governed production chronology;
2. all required sflux source objects for T+1h through T+72h were genuinely
   available before the Evidence freeze boundary;
3. no wait for future publication and no rewritten availability time;
4. exactly one eligible surface DSWRF direct one-hour-average record per target
   interval;
5. the `1 hour fcst` DSWRF record is not selected as the hourly-average input;
6. the current production GRIB native geometry and exact spatial extraction
   rule;
7. 72 ordered target intervals exactly T+1h through T+72h;
8. finite physical values with no negative clipping or zero-thresholding;
9. hash-only/public-safe diagnostic output with no raw provider object or
   decoded value publication.

A failed item fails closed. It does not fall back to the rejected pgrb2 DSWRF
reconstruction.

## 9. Canonical and Runtime compatibility

This amendment changes source provenance for one derivation input only.

The existing canonical replay Evidence envelope already permits governed source
and canonical payload provenance, while the Runtime future-forcing selector
consumes:

```text
future_weather_assumption_v1 -> precipitation_mm
future_et0_assumption_v1      -> et0_mm_per_hour
```

Runtime does not require direct solar-radiation consumption. Therefore this
amendment requires no canonical object schema change, no Runtime selector
change and no transaction-family change. Any later implementation that needs
such a change must stop and obtain a separate architecture adjudication.

## 10. Frozen prohibitions

```text
NO_SILENT_AMENDMENT_01_OVERRIDE
NO_SILENT_PGRB2_SFLUX_EQUIVALENCE
NO_CROSS_CYCLE_SOLAR_SUBSTITUTION
NO_FUTURE_FILE_WAIT
NO_VALID_TIME_REWRITE
NO_NEGATIVE_CLIPPING
NO_ZERO_THRESHOLDING
NO_SILENT_IMPUTATION
NO_UNQUALIFIED_INTERPOLATION
NO_RUNTIME_PROVIDER_FETCH
NO_DATABASE_WRITE_IN_EA1O_AMENDMENT
NO_FORMAL_EVIDENCE_WRITE_IN_EA1O_AMENDMENT
NO_FUTURE_ET0_EXECUTION_IN_EA1O_AMENDMENT
NO_FORMAL_O00_O23_START
NO_MCFT_CAP09_COMPLETION_CLAIM
```

## 11. Effectiveness and next legal action

This amendment becomes effective only after protected-main merge under the
repository delivery policy. Its merge does not qualify sflux.

The first legal successor action is:

```text
EA1O-B LIVE SFLUX SOURCE + SPATIAL QUALIFICATION
```

Only after that exact-head proof passes may the S6 source authority chain use
the qualified direct one-hour DSWRF series as an input to future ET0 candidate
construction.
