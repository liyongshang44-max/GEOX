# GEOX MCFT-CAP-09 Amendment-17 — T3R1 Formal Successor Scope Authority

Status: CANDIDATE — EFFECTIVE ONLY WHEN MERGED TO PROTECTED `main`

Exact predecessor protected main: `6081a363a665b7882bbca7592213ee49395872d7`

## 1. Purpose

This amendment authorizes a successor Formal scope candidate for MCFT-CAP-09 at KBS MCSE T3R1. It does not rewrite the historical T1R1 Formal authority and it does not itself activate the runtime, write the Formal database, start EA5E2, or start O00–O23.

The successor exists because the current T1R1 crop-model parameter authority cannot produce one invariant scalar Kc at the present boundary, while independently qualified T3R1 evidence supports a unique MID water-use stage and therefore the governed `Kc = 1.15` over a bounded legal window.

## 2. Historical authority preservation

The following protected-main authorities remain immutable historical predecessors:

- `GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V1.json` — T1R1;
- `GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V1.json` — T1R1;
- `GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json` — T1R1.

No T1R1 fact, canonical state, forecast, runtime config, database row, evidence artifact, or provider observation may be relabelled as T3R1.

## 3. Successor scope

The candidate successor identity is:

- site: `KBS_MCSE_T3R1`;
- provider treatment: `T3` / Reduced Input;
- replicate: `R1`;
- field: `field_kbs_mcse_t3r1`;
- season: `season_2026_corn`;
- zone: `zone_kbs_mcse_t3r1_crop_formal_v1`;
- crop: corn;
- hybrid: Pioneer P0306Q;
- planting observation: KBS AgLog `6966`;
- planting local date: `2026-05-20` in `America/Detroit`;
- crop-only geometry semantic hash: `sha256:4672b5f28484a05e00d93de8c53b9c7b2bdbcc250f48959a4b85b768d2ed3f3a`.

The whole T3R1 plot is not crop-only. The central prairie strip remains excluded. The successor zone is the separately qualified conservative crop-only polygon, not the provider whole-plot polygon.

## 4. Independent authority axes

Amendment-13 separation remains controlling.

### 4.1 Management lifecycle

The current T3R1 lifecycle is consumed from the protected-main Amendment-16 persistent-state qualification. ACTIVE means governed management-season lifecycle, not a fresh biological observation. Provider silence is not evidence and HTTP retrieval time is not a provider coverage watermark.

### 4.2 Crop water-use stage

Stage is re-derived from the frozen six FAO56 maize-grain duration variants, the full local-calendar-day planting-time uncertainty, `T-6h` backward stability, and `T+30h` forward transition guard. No single regional variant may be selected as a best fit.

### 4.3 Kc

Kc is resolved only after one unique stage exists across every frozen variant and every planting-time boundary. The numeric value must be read from `mcft_crop_water_use_corn_v1` in the frozen MCFT-00 configuration matrix. No Kc may be inferred from lifecycle, NDVI, satellite greenness, or an unmapped phenology token.

## 5. Reused source authority

The existing Formal source binding matrix remains reusable because its weather/soil/model-grid bindings are explicitly near-site/model support and do not claim T1R1 field equivalence. This amendment does not promote any KBS weather station, soil point, GFS pgrb2 grid, or GFS sflux grid to direct T3R1 field truth.

## 6. Fresh bootstrap rule

A T3R1 runtime activation requires a fresh bootstrap. Cross-scope canonical stitching is forbidden.

The existing Formal database contains T1R1 canonical/runtime state and therefore may not be treated as a fresh T3R1 database. T1R1 data must remain preserved as historical evidence; T3R1 must start from a zero-state Formal database satisfying the governed fresh-database preflight.

## 7. Two-step activation boundary

Merging this amendment and the V2 authority documents establishes only a successor authority candidate. The active runtime remains T1R1 until a separate exact-main runtime-rebind change atomically updates the consumed scope and authority pins and passes its focused gate.

Therefore, after this amendment alone:

- `formal_successor_authority = QUALIFIED_CANDIDATE` may be true;
- `active_runtime_scope = T3R1` must remain false;
- `EA5E2 operational activation` remains false;
- database/runtime/scheduler/Formal Evidence writes remain unauthorized;
- Formal execution remains `0/24`.

## 8. Fail-closed conditions

The successor authority is not eligible for runtime rebind if any of the following is unresolved or contradictory at the exact target boundary:

- lifecycle is not ACTIVE/RESOLVED/VALID;
- crop-only geometry hash differs from the qualified hash;
- planting identity differs from KBS observation 6966 / 2026-05-20 / P0306Q / R1;
- stage is not one unique frozen-stage value over the required guard interval;
- Kc does not resolve uniquely from the frozen configuration matrix;
- a future observation is required to make the result pass;
- the remaining unique-stage target window cannot contain the required Formal qualification interval.

## 9. Nonclaims

This amendment makes no field-calibration claim, no direct field soil truth claim, no root-zone observation truth claim, no model-grid observation claim, no observed biological-stage claim, no satellite lifecycle claim, no T1R1-to-T3R1 data migration claim, and no MCFT-CAP-09 completion claim.
