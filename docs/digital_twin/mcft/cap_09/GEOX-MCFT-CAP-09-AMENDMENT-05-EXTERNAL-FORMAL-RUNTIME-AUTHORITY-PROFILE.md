# GEOX-MCFT-CAP-09 Amendment-05 — External Formal Runtime Authority Profile

Status: **EA5 architecture adjudication candidate; not effective until merged to protected `main` with its exact-boundary Gate PASS.**

Baseline protected main: `c5f10a0628aba158463e7c4d4e151ed14b60ff79`

This amendment is subordinate to the effective MCFT-CAP-09 Taskbook and Amendment-01. It does not reopen S0–S5, does not change the mathematical kernels frozen by MCFT-CAP-01 through CAP-08, does not authorize any commercial/control-loop connection, and does not start Formal O00–O23.

## 1. Why this amendment is required

EA5A proved that the intended Neon Formal main database is fresh and uncontaminated. A separate repository audit then found that the historical Runtime bootstrap/configuration path is still explicitly Replay-scoped in several places:

1. the historical bootstrap Runtime Config compiler is pinned to MCFT-00 Replay Reality/Source/Geometry authority;
2. historical A0 members carry `CONTROLLED_SYNTHETIC_REPLAY_PROXY` and Runtime Health carries `runtime_mode = REPLAY`;
3. CAP-03 observation selection authorizes the historical `soil_obs_c8_20cm_v1` binding and a 200-mm point-to-root-zone operator;
4. CAP-02/CAP-03/CAP-04 execution config payloads contain frozen Replay-era configuration-context and controlled-model parameter identities;
5. the current S6 Formal runner reads one fixed `runtime_config_ref/hash` from `GEOX_MCFT_CAP09_S6_CANONICAL_INPUT_JSON`, while CAP-04 requires the effective Runtime Config logical time to equal each actual tick logical time and requires an exact parent-config chain.

These are valid historical Replay contracts. They are **not** valid External Formal Reality authority.

The correction is additive. Historical Replay objects, validators, hashes, fixtures, and completed acceptance evidence remain unchanged.

## 2. Core ruling

External Formal execution SHALL use an explicit **External Formal Runtime Authority Profile**.

The profile separates:

- canonical Reality / Source / Evidence authority;
- model-parameter prior provenance;
- non-canonical compatibility execution views used only to invoke the already-frozen mathematical kernels.

A compatibility execution view is not canonical Reality authority and is never permitted to rewrite External Evidence epistemic classes.

## 3. Formal source binding IDs

EA5 Authority V3 SHALL freeze stable binding IDs for the five External Evidence families. The authorized V1 IDs are:

| Role | Canonical type | Formal binding ID |
|---|---|---|
| soil moisture | `soil_moisture_observation_v1` | `kbs_lter_variate25_vwc_100mm_v1` |
| observed rainfall | `observed_rainfall_v1` | `kbs_lter_raw_hourly_rain_mm_v1` |
| historical reference ET | `historical_et0_estimate_v1` | `kbs_lter_asce_short_reference_et_hourly_v1` |
| future weather | `future_weather_assumption_v1` | `noaa_ncep_gfs_pgrb2_kbs_nearest_72h_v1` |
| future reference ET | `future_et0_assumption_v1` | `noaa_ncep_gfs_asce_short_reference_et_same_cycle_72h_v1` |

A collector/decoder implementation may not invent a different live binding ID and still claim Formal eligibility.

The five epistemic classes remain exactly:

- soil: `OBSERVED`;
- rainfall: `OBSERVED`;
- historical ET0: `ESTIMATED`;
- future weather: `ASSUMED`;
- future ET0: `ASSUMED`.

No source qualification or successful fetch can upgrade these classes.

## 4. Soil observation authority and representativeness

The External soil source remains KBS Current Weather variate endpoint 25:

- measurement depth: 100 mm;
- quantity: volumetric water content;
- canonical unit: fraction;
- spatial support: `NEAR_SITE_POINT_SUPPORT`;
- direct field equivalence: false;
- direct root-zone equivalence: false;
- root-zone representativeness: `PARTIAL`.

The External observation operator authority is:

`POINT_100MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1`

with `H = 1` only as the already-established scalar observation-model approximation. `H = 1` does **not** claim direct state equivalence.

The existing sensor and representativeness uncertainty parameters may be consumed only as `MODEL_PRIOR_FROM_CAP08 / NOT_FIELD_CALIBRATED`. They are not KBS field calibration.

The historical `soil_obs_c8_20cm_v1` binding and `POINT_200MM...` operator are forbidden in the External Formal canonical authority path.

## 5. Model-parameter provenance is not Reality truth class

Historical constants such as root-zone depth, hydraulic fractions, runoff/drainage parameters, process uncertainty, scenario application efficiency, and stress threshold may remain numerically identical when they are already authorized as model priors by EA2.

Their authority classification for the External Formal path is:

`MODEL_PRIOR_FROM_CAP08`

with:

`field_calibration_status = NOT_FIELD_CALIBRATED`.

A historical internal parameter marker such as `CONTROLLED_SYNTHETIC` may remain inside a **non-canonical compatibility execution view** only to satisfy the frozen kernel contract. It MUST NOT be interpreted as the truth class of KBS Reality or External Evidence.

External canonical Runtime Config, State, Forecast, Checkpoint, Health, lineage, Evidence Window, and their envelopes MUST NOT carry `CONTROLLED_SYNTHETIC_REPLAY_PROXY` or claim `runtime_mode = REPLAY`.

## 6. External canonical bootstrap Runtime Config

EA5 SHALL create a canonical External bootstrap Runtime Config whose authority graph is bound to:

- the exact six-key External scope;
- EA2 Formal Site Authority;
- EA2 Formal Reality Binding;
- EA2 Formal Source Binding Matrix plus this Amendment-05 binding-ID authority;
- EA2 Formal Crop Context Authority;
- EA4 Recovery Authority;
- EA5A fresh Neon Formal database authority;
- CAP08 model-kernel/configuration priors only as model priors.

The config MUST expose an honest External authority profile and MUST NOT reuse the MCFT-00 Reality Binding identity or `field_c8_demo` identity.

## 7. External A0 bootstrap profile

The existing deterministic A0 mathematics and nine-member canonical object graph may be reused.

The A0 builder SHALL accept an explicit authority profile. Historical callers that omit the profile retain byte-for-byte Replay behavior.

The External profile SHALL use at minimum:

- `runtime_mode = SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY`;
- `MODEL_PRIOR_FROM_CAP08`;
- `NOT_FIELD_CALIBRATED`;
- `EXTERNAL_PUBLIC_RESEARCH_SCOPE`;
- `POINT_100MM_NEAR_SITE_OBSERVATION_PARTIAL_ROOT_ZONE_REPRESENTATIVENESS`;
- `A0_BOOTSTRAP_ONLY`.

It SHALL NOT emit `CONTROLLED_SYNTHETIC_REPLAY_PROXY` or `runtime_mode = REPLAY` in External canonical members.

The initial State remains:

- confidence status `NOT_ESTABLISHED` until the already-governed confidence layer establishes otherwise;
- recommendation input ineligible;
- action input ineligible.

External Reality does not grant action authority.

## 8. External CAP-04 hourly Runtime Config chain

The Formal 24-hour window SHALL use exactly 24 effective Runtime Config pins, one per O00–O23 logical hour.

The chain rule is:

- External A0 bootstrap Runtime Config is the predecessor of O00 config;
- each O(n) config is the exact parent of O(n+1) config;
- each config `effective_logical_time` equals its slot logical time;
- every ref and determinism hash is frozen before O00;
- implicit “latest config” lookup is forbidden.

The existing CAP-04 24-config chain semantics are reused; only the canonical authority source/profile is External Formal.

## 9. Non-canonical compatibility execution view

To avoid rewriting frozen CAP-02/CAP-03/CAP-04 mathematics, an External Formal execution resolver MAY derive an in-memory compatibility execution view from an External canonical Runtime Config.

Requirements:

- source canonical config ref/hash must match exactly;
- External Reality/source/config/geometry refs/hashes must remain exact;
- External crop-stage context ref/hash must remain exact;
- External soil observation binding ID and 100-mm operator authority must remain exact;
- model-prior numerical values may map to the historical kernel parameter fields;
- the compatibility view is never committed as External Reality authority;
- it may not change Evidence epistemic class, source record identity, quality, freshness, availability time, or limitations.

## 10. Evidence selection profile

Formal Runtime Evidence ingress/selection SHALL be configured with the five authorized Formal binding IDs.

At minimum:

- soil assimilation must accept only `kbs_lter_variate25_vwc_100mm_v1` for the External profile;
- the historical C8 soil binding must be rejected in External Formal scope;
- future-weather/future-ET forcing must use the exact authorized GFS binding pair from the same cycle;
- unauthorized binding IDs fail closed even when record type and scope otherwise match.

No cross-source stitching is implied by matching record types.

## 11. Crop-stage context

External Formal execution SHALL use the EA2 Formal Crop Context Authority and exact as-of stage derivation.

The Replay fixture path `fixtures/mcft/water_state/replay_v1/configuration_context.json` is not External crop-stage authority.

Any compatibility execution view that internally retains a historical contract field MUST be overridden/derived from the External crop authority before canonical State/Forecast construction and MUST NOT leak the Replay fixture ref/hash into External canonical source/evidence refs.

## 12. Formal runner input contract

One fixed Runtime Config ref/hash may not be reused across O00–O23.

`GEOX_MCFT_CAP09_S6_CANONICAL_INPUT_JSON` SHALL be replaced or versioned into a **Formal Window Input Manifest** that contains non-time-varying execution authority plus an exact 24-slot Runtime Config ref/hash map.

At execution time the runner SHALL:

1. select exactly the target slot;
2. select exactly that slot’s pre-frozen Runtime Config ref/hash;
3. verify config logical time equals slot logical time;
4. verify parent config ref/hash equals the previous persisted State config authority;
5. fail closed on any missing/duplicate/mismatched slot pin.

Manual hourly Secret mutation is not an authorized mechanism.

## 13. Collector and Runtime scheduling separation

Runtime continues to consume governed database Evidence only.

A collector/canonicalizer/ingress job must complete before a slot can consume fresh External Evidence. Runtime never fetches KBS or NOAA directly.

The final O00 readiness Gate SHALL prove a schedule ordering that leaves an explicit ingestion margin before the Runtime observer minute. A slot with insufficient fresh Evidence blocks/fails under existing Runtime rules; it does not wait for future provider files or fetch from Runtime.

## 14. Durable raw authority retention

Amendment-01 remains controlling: raw authority retention must precede decode/canonicalization.

EA4 runner-local temporary retention is qualification evidence only and is not durable Formal retention.

EA5 must establish a durable, private, hash-addressed retention receipt before the corresponding canonical Evidence record may be appended to Formal `facts`.

The raw payload itself must not be committed to the public repository or emitted in public acceptance JSON.

## 15. EA5 internal sequence after this amendment

The legal internal sequence is:

1. **EA5A** — fresh Formal Neon DB exact-head preflight — completed candidate/effectiveness predecessor;
2. **EA5B** — External Formal Runtime Authority Profile + binding/profile implementation qualification;
3. **EA5C** — durable raw retention + restricted canonical External Evidence ingress;
4. **EA5D** — External canonical bootstrap config + A0 bootstrap + 24-config chain persistence;
5. **EA5E** — post-bootstrap DB preflight + Formal Window Input Manifest + collector/runtime schedule readiness + Formal Authority V3 effectiveness.

Only after EA5E is effective may O00 be enabled.

## 16. Hard nonclaims

This amendment does not authorize:

- Formal Evidence writes by itself;
- A0 bootstrap by itself;
- O00–O23 start;
- recommendation or action eligibility;
- AO-ACT, approval, dispatch, execution, acceptance, ROI, Field Memory, or the original GEOX commercial closed loop;
- field calibration;
- direct field/root-zone equivalence for the KBS 100-mm point observation;
- Runtime Internet access;
- source substitution;
- confidence upgrade;
- model activation;
- MCFT-CAP-09 completion.
