# GEOX MCFT-CAP-09 — KBS Public Current-Season Authority Candidate Screen

Status: **CANDIDATE / SOURCE SCREEN ONLY — NO AUTHORITY EFFECT**

Capability line: `MCFT-CAP-09`

Slice: `MCFT-CAP-09.S6`

Exact base protected main: `23f224c701dbe0b8bd56eceff3741cb1c3dc1f78`

Predecessor frontier: `CURRENT_CROP_ALTERNATIVE_SOURCE_AUTHORITY_DESIGN_REVIEW`

## Purpose

This screen narrows the repository-known KBS public current-season crop-source search space. It does not create lifecycle, phenology, Kc, readiness, activation, persistence, or Formal authority.

The question is deliberately stricter than "does KBS publish agricultural data?":

```text
Can this public source produce an exact formal-scope T1/T1R1 + 2026 corn/P0306Q fact
that is a positive biological/current-crop or provider-direct phenology fact,
or can it form a legally reviewable composite authority candidate with already-qualified season identity?
```

Sources that are stale, wrong-experiment, wrong-treatment, generic imagery, spatial-only, or merely duplicate/mirror another source are removed from the current authority candidate set. Multiple public views over one underlying AgLog event family count as one source family, not independent corroboration.

## Repository-known surfaces screened

The screen combines the source inventory, EA1 source qualification matrix, #3141 direct-current-anchor discovery, and #3142 public-source-gap adjudication.

Screened KBS public surfaces/families:

1. `KBS_AGLOG_MCSE_LIVE_FAMILY`
   - live AgLog observations
   - exact T1R1 area history
   - KBS004 narrative/expanded public mirrors
2. `KBS004_SEEDS_AND_PLANTING_DATE`
3. `KBS_AGLOG_MATERIAL_P0306Q`
4. `KBS_MCSE_2026_PLOT_MAP`
5. `KBS039_MCSE_PLOT_POLYGONS`
6. `KBS136_MCSE_PLOT_CENTERS`
7. `KBS019_ANNUAL_CROP_BIOMASS`
8. `KBS030_ANNUAL_CROP_STAND_COUNTS`
9. `KBS020_AGRONOMIC_YIELDS`
10. `KBS037_PROCESSED_GEOREFERENCED_YIELD`
11. `KBS092_GLBRC_PHENOLOGY`
12. `KBS140_REX_ANPP`
13. `KBS_GIS_SATELLITE_AND_PUBLIC_IMAGE_SURFACES`

CDSE/Sentinel-2 is intentionally outside this KBS-native screen.

## Retention rule

A source remains in the candidate-capable source-family set only if its provider semantics can support a formal-scope positive lifecycle/current-crop biological fact or provider-direct phenology fact, including a bounded composite binding to already-qualified `P0306Q` season identity.

The following do not qualify by themselves:

- current-season crop labels without a biological observation;
- T3/P0306Q positive controls;
- generic imagery;
- field geometry/centroids;
- historical pre-2026 biomass/yield/stand data;
- GLBRC phenology;
- REX manipulated footprints;
- model/GDD inference;
- provider silence.

## Narrowed result

The only KBS public source family that remains structurally capable of producing a future formal-scope authority candidate is:

`KBS_AGLOG_MCSE_LIVE_FAMILY`

because it provides the event/area/detail semantics needed to bind T1/T1R1 observations to current-season crop identity.

The latest T1R1 observation remains `7095` on `2026-06-25`. The current live screen does **not** validate it as a qualifying positive biological/current-crop fact and finds no provider-direct phenology token. It therefore stays descriptive history only for this screen.

The KBS-native result is deliberately split into two statements:

```text
candidate-capable KBS source families = [KBS_AGLOG_MCSE_LIVE_FAMILY]
current qualifying authority candidates = []
```

This preserves the one KBS source family that can legally produce a future exact-scope candidate without pretending that its present rows already solve current lifecycle or phenology.

## Explicit eliminations

### KBS004 Seeds and Planting Date

Origin/mirror source only. Treatment-level planting identity is not a current biological observation and is weaker than the live AgLog origin record.

### P0306Q material history

A useful current-2026 positive control exists, but the known 2026 P0306Q transaction is T3. No T3 -> T1R1 substitution is authorized. The material-history page is also an index/view over the same AgLog transaction family, so it is not counted as an independent authority source even if a future T1 transaction appears there.

### MCSE 2026 plot map

Retained only as supporting crop/site identity. It does not observe living crop state or phenology.

### KBS039 polygons / KBS136 centers

Retained only as spatial support. They carry no crop-state or phenology fact.

### KBS019 biomass

Direct crop biomass class, but public current data do not reach the 2026 formal season.

### KBS030 stand counts

Direct stand-observation class, but no 2026 T1R1 row is identified.

### KBS020 agronomic yields

Harvest/termination evidence class, but current public rows do not reach the 2026 corn harvest.

### KBS037 processed georeferenced yield

Useful historical P0306Q/T1 precision-harvest evidence, but not 2026.

### KBS092 phenology

Direct phenology semantics, but GLBRC rather than MCSE T1R1 and not current.

### KBS140 REX ANPP

Direct biomass observation, but manipulated REX/T2 scope and stale relative to 2026.

### KBS GIS/public imagery

No repository-known KBS-native public product currently provides exact T1R1/P0306Q direct phenology. External CDSE review is separate.

## Nonclaims

```text
current_runtime_lifecycle_authority_established = false
phenology_authority_established = false
crop_model_parameter_authority_established = false
EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false
Formal = 0/24
authority_effect = NONE
```

The practical result is: keep the AgLog family as the only KBS source family worth watching for a new direct T1R1 crop/phenology fact; there is no qualifying current KBS-native public authority candidate in the live screen.
