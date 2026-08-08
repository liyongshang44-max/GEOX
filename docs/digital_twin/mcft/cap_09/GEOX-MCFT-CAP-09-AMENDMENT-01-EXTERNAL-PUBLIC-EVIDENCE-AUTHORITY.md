# GEOX MCFT-CAP-09 — Amendment-01 External Public Evidence Authority

## S6-only architecture adjudication v0.2

```text
document_id:
GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY

capability_line:
MCFT-CAP-09

affected_slice:
MCFT-CAP-09.S6

base_main:
d2c0a674ec2886ecc57b9eae084847ce31e72d58

amendment_class:
TASKBOOK_DESIGN_DEFECT_CORRECTION

scope_of_change:
S6_ONLY

S0_to_S5_reopened:
false

canonical_kernel_change:
false

canonical_object_contract_change:
false

DT02_change:
false

transaction_family_change:
false

migration_required_by_adjudication:
false

formal_window_started:
false

MCFT_CAP_09_COMPLETE:
false
```

## 1. Decisive ruling

MCFT-CAP-09.S6 may not start the Formal O00–O23 window by reusing the CAP-08
Replay scope identity or the controlled-synthetic crop-stage schedule as if they
were External Formal Reality authority.

CAP-08 exact-SHA/R2 remains the semantic predecessor authority for the unchanged
canonical Runtime. It does not require reuse of the CAP-08 Replay field identity,
fixture device identities, Replay provider identities, controlled-synthetic
geometry, or synthetic crop-stage schedule.

```text
CAP08_KERNEL_AUTHORITY_REUSED = YES
CAP08_REPLAY_SCOPE_IDENTITY_REQUIRED = NO
EXTERNAL_SCOPE_FRESH_BOOTSTRAP_REQUIRED = YES
CROSS_SCOPE_CANONICAL_STITCHING_FORBIDDEN = YES
C8_SYNTHETIC_CROP_CONTEXT_FORMAL_AUTHORIZED = NO
EXTERNAL_FORMAL_REALITY_AUTHORITY_REQUIRED = YES
EXTERNAL_SOURCE_BINDING_AUTHORITY_REQUIRED = YES
EXTERNAL_CROP_CONTEXT_AUTHORITY_REQUIRED = YES
LIVE_DEVICE_GATEWAY_REQUIRED = NO
PUBLIC_EXTERNAL_OBSERVATION_ALLOWED = YES
FIELD_VALIDITY_CLAIM_ALLOWED = NO
```

S6 therefore gains an entry-authority lifecycle inside S6. This is not a new
capability slice and does not reopen S0–S5.

## 2. Existing defect being corrected

The merged Formal helper currently derives scope and Runtime configuration from
MCFT-00 artifacts whose Reality Binding is explicitly a
`CONTROLLED_SYNTHETIC_REPLAY_PROXY`. The current helper also reads
`fixtures/mcft/water_state/replay_v1/configuration_context.json` while rejecting
crop-stage context whose limitations contain `synthetic`, `fixture`, or
`replay`. The referenced context explicitly declares itself a controlled
synthetic schedule and not field-verified phenology.

The resulting Formal startup path is intentionally fail-closed. Amendment-01
does not weaken that guard. It replaces the invalid Formal entry authority with
an External Formal Reality authority that can be proven without relabelling
Replay or synthetic truth.

## 3. Authority graph

```text
CAP-08 exact-SHA / R2
        |
        | canonical kernel / semantic predecessor only
        v
S6 External Formal Reality Authority
        |
        +-- External Site Authority
        +-- External Crop Context Authority
        +-- External Source Binding Matrix
        +-- Model Configuration Prior Authority
        +-- External Evidence Authority Package
                |
                v
       governed collector / canonicalizer
                |
                v
       restricted Formal Evidence writer
                |
                v
             public.facts
                |
                v
      existing S2/S3/S4/S5 Runtime core
                |
                v
             O00 ... O23
```

The Internet collector is never part of the Twin kernel. Runtime continues to
consume governed database Evidence only.

## 4. Supporting authorities; no new canonical object family

The following are `GOVERNANCE_INPUT / SUPPORTING_AUTHORITY`, not DT-02 history
objects and not Runtime lineage members:

```text
GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V1.json
GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V1.json
GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1.json
GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json
GEOX-MCFT-CAP-09-S6-FORMAL-EXTERNAL-EVIDENCE-PACKAGE-V1.json
```

They answer only: which real public research site is represented; which crop is
proved for the current season; which model water-use stage is derived as-of the
Formal boundary; where the five Formal Evidence families come from; what their
spatial/temporal/quality limitations are; and how they normalize into existing
Evidence contracts.

## 5. External Formal scope

The Formal scope must be newly bootstrapped and must not reuse `field_c8_demo`.
The final qualified site determines the concrete IDs.

```text
tenant_id: tenant_mcft_external
project_id: project_mcft_cap09
group_id: group_public_research
field_id: field_<qualified_site_id>
season_id: season_2026_corn
zone_id: zone_<qualified_site_id>_formal_v1
```

No canonical State, Forecast, Scenario, Checkpoint, Health or lineage member may
be stitched from the Replay scope into this new scope. CAP-08 is consumed only
as predecessor semantic authority and model-prior provenance.

## 6. Fail-closed site qualification

A site may become `QUALIFIED_FORMAL_SITE` only if all of the following are
machine-evidenced:

1. Stable authoritative site identity and coordinates.
2. Exact current-season crop identity resolves to corn for the 2026 Formal season.
3. Current phenology source exists and its retrieval/provenance can be audited.
4. Contemporaneous observed soil-moisture source exists.
5. Observed rainfall source exists.
6. Observed meteorology sufficient for reference ET exists.
7. Forecast authority supplies at least 72 hourly points.
8. Source latency and release timing satisfy Formal ingress.
9. Provider provenance and use policy are recorded.
10. Raw source payload or exact provider response can be hashed/audited.
11. Spatial relationship between site, station, sensor and model zone is governed.
12. No model/satellite/interpolated value is labelled `OBSERVED` sensor truth.
13. The source can be consumed without rewriting event, issue or retrieval time.
14. The full qualification is reproducible at the exact candidate head.

Allowed outcomes only:

```text
QUALIFIED_FORMAL_SITE
NOT_QUALIFIED
INCOMPLETE_AUTHORITY
```

Geographic proximity alone is never field truth.

## 7. Current candidate rulings

### 7.1 US-Ne1

US-Ne1 is rejected for the 2026 corn Formal scope. Current AmeriFlux site
metadata states that since 2022 the field is a strict no-till maize-soybean
rotation with maize in odd years and soybean in even years. Therefore 2026 is
soybean and conflicts with the frozen corn water-use configuration.

```text
US-Ne1:
  qualification: NOT_QUALIFIED
  reason: CURRENT_SEASON_CROP_IDENTITY_MISMATCH
```

### 7.2 US-KM1

US-KM1 remains the preferred candidate because current AmeriFlux metadata
identifies KBS Marshall Farms Corn at 42.4376, -85.3287, reports data collection
from 2009-present, describes no-till continuous corn from 2010 onward, and
associates the `kelloggcorn` PhenoCam.

Long-term management identity is not sufficient by itself to prove the exact
2026 season or contemporaneous soil-moisture authority.

```text
US-KM1:
  site_identity: PASS
  historical_management_identity: PASS_CONTINUOUS_CORN_CANDIDATE
  current_2026_crop_identity: PENDING_CURRENT_SEASON_CORROBORATION
  phenocam_source_identity: PASS
  current_phenology_availability: PENDING_QUALIFICATION
  soil_moisture_formal_authority: PENDING
  rainfall_met_authority: PENDING_QUALIFICATION
  final_qualification: NOT_YET_ESTABLISHED
```

If soil-moisture or current-season crop authority cannot be established, the
site is rejected rather than weakening the Gate.

## 8. Formal Evidence source semantics

### 8.1 Soil moisture

Target existing type: `soil_moisture_observation_v1`.

Required semantics:

```text
epistemic_class: OBSERVED
quantity_kind: VOLUMETRIC_WATER_CONTENT
canonical_unit: fraction
spatial_support: POINT
direct_state_equivalence: false
root_zone_representativeness: PARTIAL
```

The record must retain sensor/station coordinates, measurement depth, source
identity, provider QC, raw unit, conversion, event time, retrieval time, raw
payload hash, adapter version and limitations. Satellite, model, interpolation
or forecast soil moisture cannot be relabelled OBSERVED.

### 8.2 Rainfall

Target existing type: `observed_rainfall_v1`.

Gauge observation must retain interval start/end and ingestion/availability
semantics. A station outside the exact field is classified as
`NEAR_SITE_METEOROLOGICAL_SUPPORT`, never `FIELD_POINT_PRECIPITATION_TRUTH`.

### 8.3 Historical reference ET

Target existing type: `historical_et0_estimate_v1`, canonical unit
`mm_per_hour`.

Amendment-01 freezes the derivation authority to:

```text
algorithm_id: ASCE_STANDARDIZED_REFERENCE_ET_SHORT_HOURLY_V1
reference_surface: SHORT_CROP_GRASS_REFERENCE
output_quantity: REFERENCE_EVAPOTRANSPIRATION
output_unit: mm_per_hour
```

Required observed meteorological inputs are air temperature, humidity or dew
point, solar radiation, wind and pressure/elevation as required by the frozen
implementation. Input references, units, QC, gap handling, wind-height
adjustment, radiation terms, algorithm version and output hash are mandatory.
Missing required meteorology fails the ET0 derivation for that interval; it is
not silently imputed unless a separately frozen imputation rule is later
adjudicated.

This algorithm choice is new S6 supporting authority. It is not claimed to have
been implemented or field-validated by CAP-08.

### 8.4 Future weather

Primary future authority is NOAA/NCEP GFS 0.25-degree hourly output. HRRR is not
accepted as the primary 72-hour authority because operational HRRR reaches 48h
only on its extended cycles.

For a tick boundary `T`, the canonical 72-point series is exactly:

```text
point[0]  = T + 1h
...
point[71] = T + 72h
```

The selected GFS cycle must be the latest complete cycle whose required files
were genuinely published/retrievable before the Evidence freeze boundary.
`issued_at`, `retrieved_at`, `ingested_at` and `available_to_runtime_at` must all
preserve real chronology. Forecast lead times may be selected/interpolated only
by a frozen method; valid times may never be rewritten to fabricate freshness.

Required provenance includes model, cycle, forecast lead, source file/object,
grid cell, interpolation rule, retrieval time and raw/object digest.

### 8.5 Future reference ET

`future_et0_assumption_v1` is derived from the same exact GFS cycle used by
`future_weather_assumption_v1`, using
`ASCE_STANDARDIZED_REFERENCE_ET_SHORT_HOURLY_V1`.

```text
future_weather_assumption.source_cycle
==
future_et0_assumption.source_cycle
```

Input-variable digest, cycle, grid/interpolation method, derivation algorithm,
version and output digest are frozen per produced assumption.

## 9. Crop context authority

Crop context is not an observed biological stage unless the provider explicitly
supplies that stage. The S6 supporting authority is:

```text
FORMAL_DERIVED_CROP_WATER_USE_STAGE_CONTEXT_V1
```

It maps current crop identity and contemporaneous phenology evidence into the
existing model stages only:

```text
INITIAL
DEVELOPMENT
MID
LATE
```

It does not claim V-stage/R-stage ground truth.

The derivation is strictly as-of:

```text
crop_stage_derivation_as_of = T_authority
all observation inputs.available_to_runtime_at <= T_authority
future PhenoCam observations = FORBIDDEN
full-season ex-post normalization = FORBIDDEN
```

Inputs may include PhenoCam GCC available as-of the authority time, GDD
corroboration and current-season management metadata. Every result records
source refs/hashes, ROI, algorithm/version, inputs, confidence and limitations.

Before O00, the current derived stage must show at least 6h backward stability.
The required >=30h forward guard is explicitly an
`ASSUMED_STAGE_TRANSITION_GUARD`; it may use only information available as-of
the guard boundary and may not use future observations. If transition risk is
material, Formal startup fails with `STAGE_TRANSITION_RISK`.

## 10. Model configuration prior

The existing CAP-08 numerical soil-hydraulic and crop-water-use parameters may
be reused only as:

```text
MODEL_PRIOR_FROM_CAP08
MODEL_PRIOR_NOT_FIELD_CALIBRATED
NOT_SITE_SOIL_TRUTH
NOT_MODEL_ACTIVATION
```

No S6 Amendment claim upgrades the existing controlled configuration into a
field-calibrated parameter set. Stage 1B closes online-runtime correctness, not
agronomic field accuracy.

## 11. Raw-source provenance before canonicalization

Required chain:

```text
external provider
  -> raw provider response/object
  -> raw payload/object sha256
  -> source metadata snapshot
  -> governed adapter normalization
  -> canonical Evidence semantic hash
  -> restricted Formal ingress
  -> public.facts
```

Every External Formal Evidence record must retain or reference provider,
station/site/model identity, provider record or object identifier, event/issue
time, retrieval time, raw digest, adapter id/version, conversion/derivation id,
canonical payload/hash, use policy and limitations.

Fetch-transform-discard of the raw authority is forbidden.

## 12. Formal External Evidence Package

A package may set `formal_eligible=true` only when all referenced supporting
authorities are effective and every required source qualification is PASS.

```text
formal_external_evidence_package_v1:
  site_authority: {ref, hash}
  reality_binding: {ref, hash}
  crop_context: {ref, hash}
  source_bindings: {ref, hash}
  model_prior: {ref, hash}
  soil_moisture: {provider, source_ref, support_class, qualification}
  rainfall: {provider, source_ref, support_class, qualification}
  historical_et0: {input_source_refs, method, qualification}
  future_weather: {provider, model, cycle, horizon_hours: 72, qualification}
  future_et0: {source_weather_ref, method, qualification}
  package_status: QUALIFIED_FOR_FORMAL_INGRESS
```

No partial package may start the Formal window.

## 13. S6 internal delivery lifecycle

These are S6 sub-lifecycles, not capability slices:

```text
S6-EA0  Taskbook Amendment / Architecture Adjudication
S6-EA1  External Site and Source Qualification
S6-EA2  Formal Reality / Source / Crop Authority Freeze
S6-EA3  External Collector + Canonicalizer Candidate
S6-EA4  Live Source Exact-Head Qualification
S6-EA5  Formal Authority V3 + Database Preflight
S6       Formal O00–O23 actual UTC window
S6       Final exact-SHA / R2 effectiveness
```

S6-EA0 has Runtime delta 0, migration delta 0, canonical-object delta 0,
database-write delta 0, Formal Evidence write 0, and does not start the Formal
window. Delivery-control-plane routing may be changed only if current
repository policy proves it is required; such routing changes cannot grant
Runtime, Evidence, database or completion authority.

## 14. Existing Hard Acceptance remains binding

HA-01 through HA-24 in the CAP-09 Taskbook are retained without deletion or
semantic weakening. External Evidence qualification is entry proof for S6, not
replacement acceptance.

In addition, S6 External Authority qualification must cover at least:

```text
A  Taskbook/authority correction
B  CAP-08 semantic predecessor reuse
C  External site identity
D  exact 2026 crop identity
E  as-of crop-stage derivation
F  soil-moisture source authority
G  rainfall authority
H  observed met / hourly ET0 derivation
I  72h GFS future weather
J  72h future ET0 same-cycle authority
K  raw provider provenance
L  temporal eligibility / release latency
M  spatial-support limitations
N  fresh-scope Formal Reality Binding
O  Formal bootstrap/preflight
P  O00–O23 online closure
Q  frozen nonclaims
R  exact-SHA / R2 effectiveness
```

## 15. Frozen nonclaims

```text
NO_GEOX_LIVE_DEVICE_GATEWAY
NO_SYNTHETIC_SENSOR_TRUTH_IN_FORMAL
NO_REPLAY_DATA_PROMOTED_TO_FORMAL
NO_EXTERNAL_DATA_TIME_REWRITE
NO_PUBLIC_SOURCE_PROXIMITY_EQUALS_FIELD_TRUTH
NO_CROSS_SCOPE_CANONICAL_STITCHING
NO_FIELD_CALIBRATED_SOIL_MODEL
NO_FIELD_VALIDITY_PROVEN
NO_PRODUCTION_DEPLOYMENT
NO_AUTOMATIC_RECOMMENDATION
NO_AUTOMATIC_APPROVAL
NO_AO_ACT
NO_DISPATCH
NO_MODEL_ACTIVATION
NO_ACTIVE_MODEL_PARAMETER_CHANGE
NO_MINIMUM_COMPLETE_FIELD_TWIN_COMPLETE
NO_MCFT_CAP_09_COMPLETION_FROM_AMENDMENT
```
