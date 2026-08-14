# GEOX MCFT-CAP-09 — KBS Public Current-Crop Source Gap Adjudication

Status: **CANDIDATE — SOURCE-GAP ADJUDICATION ONLY**

Capability line: `MCFT-CAP-09`

Slice: `MCFT-CAP-09.S6`

Exact base protected main: `5977e9c46e86ced14ef03fe072dc868f9b5f8a7a`

Frontier: `DIRECT_CURRENT_ANCHOR_PUBLIC_SOURCE_GAP_ADJUDICATION`

## 1. Question

After the merged direct-current-anchor discovery proved that the current public KBS AgLog surface contains no qualifying near-current T1/T1R1 crop-bound anchor or direct phenology candidate for `season_2026_corn`, does another reviewed **public KBS current-season surface** establish the missing formal-scope current crop / phenology authority?

This adjudication is deliberately narrower than a claim that no private, unpublished, internal, or future KBS source exists.

## 2. Exact predecessor proof

Protected main already contains merged PR #3141:

- exact discovery head: `a9ad12774de09cedcc02ed56638d06c1327975cf`
- exact live workflow run: `31811734761`
- latest T1R1 AgLog observation reviewed: `#7095`, `2026-06-25`
- global latest AgLog observation reviewed: `#7148`, `2026-08-13`
- direct positive current-season T1/T1R1 crop-bound candidate count: `0`
- provider-direct phenology candidate count: `0`
- `#6931` Planting false-reset positive control: PASS
- lifecycle authority established by that discovery: `false`
- phenology authority established by that discovery: `false`
- crop-model parameter authority established by that discovery: `false`
- all writes: `0`
- Formal: `0/24`

The merged main SHA carrying that proof is the exact base of this adjudication.

## 3. Reviewed public KBS source surfaces

### 3.1 AgLog current observation surface

AgLog is demonstrably current in 2026. The predecessor live proof reviewed every relevant current-season T1/T1R1 detail reachable through the current area/global observation surfaces and found no new qualifying direct crop-bound current anchor or direct phenology observation after the previously reviewed `#7095` boundary.

Therefore AgLog currentness is not the blocker. The formal-scope direct fact is absent from the reviewed current public surface.

### 3.2 Seeds and Planting Date / planting-origin surfaces

KBS public planting records establish the 2026 season origin and the `corn / P0306Q` identity already governed by predecessor authority.

They do not by themselves establish present lifecycle state, present phenology, or a current crop-model parameter.

Qualification: `SEASON_ORIGIN_ONLY`.

### 3.3 MCSE annual crop biomass

Public KBS table:

`https://lter.kbs.msu.edu/datatables/39`

The public table is a direct species/biomass observation class, but its published data availability currently extends through September 2025, not the 2026 formal season.

Qualification: `DIRECT_CROP_OBSERVATION_CLASS_NOT_CURRENT_2026`.

### 3.4 MCSE annual crop stand counts

Public KBS table:

`https://lter.kbs.msu.edu/datatables/172`

This is a direct species / stand-development observation class. The reviewed public surface does not expose a 2026 T1R1 observation usable for the formal scope.

Qualification: `DIRECT_CROP_OBSERVATION_CLASS_NO_2026_FORMAL_SCOPE_ROW_IDENTIFIED`.

### 3.5 MCSE agronomic yields and precision-yield surfaces

Public KBS tables:

- `https://lter.kbs.msu.edu/datatables/51`
- `https://lter.kbs.msu.edu/datatables/828`

These are direct harvest/yield observation classes. Their public data availability currently reaches July 2025 and October 2025 respectively. They do not provide a 2026 T1R1 current-season crop/phenology observation.

Qualification: `HARVEST_CLASS_NOT_CURRENT_2026`.

### 3.6 GLBRC phenology

Public KBS table:

`https://lter.kbs.msu.edu/datatables/514`

This is a true direct phenology table, but it belongs to the **GLBRC Biofuel Cropping System Experiment**, not the MCSE T1R1 formal scope, and its public data availability ends in October 2017.

Qualification: `DIRECT_PHENOLOGY_CLASS_REJECT_FORMAL_SCOPE_AND_TIME_MISMATCH`.

### 3.7 REX ANPP / REX plant surfaces

Public KBS table:

`https://lter.kbs.msu.edu/datatables/794`

REX ANPP is an MCSE-associated crop biomass source, but it is a Rain Exclusion Experiment source associated with T2 footprints and its published crop biomass observation is from 2024. It is not a 2026 T1R1 authority source.

Qualification: `MCSE_ASSOCIATED_BUT_FORMAL_SCOPE_AND_TIME_MISMATCH`.

### 3.8 2026 P0306Q out-of-scope positive control

KBS AgLog material surface:

`https://aglog.kbs.msu.edu/materials/392`

The public material transaction history contains a 2026-05-20 planting of Pioneer `P0306Q` in Main Site **T3** replications. This proves the KBS public provider surface is capable of publishing current-2026 P0306Q agronomic facts.

It may not substitute for T1R1.

Qualification: `CURRENT_PROVIDER_POSITIVE_CONTROL_FORMAL_SCOPE_MISMATCH`.

This positive control is important: the adjudicated gap is not `KBS_PUBLIC_DATA_STALE`. It is the narrower formal-scope gap `NO_REVIEWED_PUBLIC_2026_T1R1_DIRECT_CURRENT_CROP_OR_PHENOLOGY_AUTHORITY`.

## 4. Exact adjudication

For the reviewed public KBS source set:

```text
reviewed_public_kbs_current_2026_data_exists = true
reviewed_public_kbs_p0306q_2026_data_exists = true
reviewed_public_kbs_t1r1_direct_current_crop_authority_established = false
reviewed_public_kbs_t1r1_direct_phenology_authority_established = false
reviewed_public_kbs_t1r1_current_crop_model_parameter_authority_established = false
```

The exact source-gap conclusion is:

```text
KBS_PUBLIC_CURRENT_SEASON_DIRECT_T1R1_CROP_AUTHORITY_GAP_ESTABLISHED_FOR_REVIEWED_PUBLIC_SURFACES
```

This means the reviewed public KBS surfaces do not supply the direct current formal-scope fact required to close the current lifecycle / phenology / model-parameter blocker.

It does **not** mean:

- KBS has no private or internal current data;
- KBS will never publish a qualifying T1R1 row;
- a T3 or T2 observation may be substituted for T1R1;
- thermal age, maturity rating, planting age, remote imagery, or provider silence may manufacture phenology;
- a non-KBS source is automatically authorized by this adjudication.

## 5. No source substitution

The 2026 T3/P0306Q positive control cannot be promoted to T1R1 authority merely because it shares provider, crop, hybrid, season, or nearby geography.

Any future use of a different treatment, replicate, experiment, remote-sensing product, scouting source, extension observation, or third-party agronomic source requires its own exact source/spatial/time/crop/mapping authority before it can affect Runtime readiness.

No spatial interpolation, treatment substitution, crop-stage inference, persistence fill, or model-only phenology is authorized here.

## 6. Current readiness effect

This adjudication creates no lifecycle, phenology, Kc, legal-T, scheduler, Runtime, persistence, database, or Formal authority.

The current fail-closed state remains:

```text
season_lifecycle_authority.status = UNRESOLVED
phenology_stage_authority.status = UNRESOLVED
crop_model_parameter_authority.status = UNRESOLVED
crop_model_parameter.kc = null
EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false
Formal = 0/24
```

## 7. Next frontier

The KBS-public direct-source discovery loop should stop here unless a new qualifying T1R1 provider fact appears.

The next legal frontier is:

```text
CURRENT_CROP_ALTERNATIVE_SOURCE_AUTHORITY_DESIGN_REVIEW
```

That review may inventory independent real agronomic sources and determine whether any source class can be separately authorized for current crop lifecycle / phenology without violating source binding, spatial identity, chronology, or no-substitution constraints.

Discovery of an alternative source is candidate generation only. No alternative source becomes authority merely because it is agronomically plausible.

## 8. Hard nonclaims

- no T3 -> T1R1 substitution;
- no T2/REX -> T1R1 substitution;
- no GLBRC -> MCSE substitution;
- no imagery -> direct phenology substitution;
- no planting-age or GDD-only current-stage inference;
- no provider-silence lifecycle lease;
- no crop-model coefficient invention;
- no Runtime writes;
- no database writes;
- no scheduler writes;
- no persistence authority;
- no EA5E2 GO;
- Formal remains `0/24`.
