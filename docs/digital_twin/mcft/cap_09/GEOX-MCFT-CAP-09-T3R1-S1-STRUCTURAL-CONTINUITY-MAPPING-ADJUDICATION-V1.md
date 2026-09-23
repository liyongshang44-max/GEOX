# GEOX MCFT-CAP-09 — T3R1 Sentinel-1 structural continuity mapping adjudication v1

Status: **candidate adjudication; no lifecycle authority created**

Exact protected-main base: `23f224c701dbe0b8bd56eceff3741cb1c3dc1f78`

## Result

The 2026-07-31 and 2026-08-12 Sentinel-1C observations form a valid same-repeat-viewing-geometry comparison candidate:

- both are `S1C`;
- both are `ASCENDING`;
- both start at `23:39:57Z`;
- absolute orbit difference is exactly `175`;
- elapsed time is exactly `12` days;
- exact T3R1 conservative crop-only subzone coverage is `1.0` for both observations.

ESA documents Sentinel-1's nominal repeat cycle as 12 days / 175 orbits. Therefore this pair is materially stronger than comparing arbitrary SAR scenes from different tracks or missions.

Observed exact-scope changes from 2026-07-31 to 2026-08-12:

- VV: `-11.1529512405 dB -> -10.6204833984 dB` (`+0.5324678421 dB`)
- VH: `-15.6723871231 dB -> -14.2721424103 dB` (`+1.4002447128 dB`)
- VH/VV linear ratio: `0.3532290757 -> 0.4313542545` (`+0.0781251788`, about `+22.1%`)

There is therefore no observed same-track backscatter collapse between the strict 2026-07-30 Sentinel-2 standing-crop reference and the 2026-08-12 S1C repeat observation. This is accepted as a **structural-continuity candidate**.

The 2026-08-13 S1D exact-scope observation has full valid coverage, but it is a different mission / orbit geometry and is not numerically differenced against the S1C pair.

## Why this does not establish lifecycle ACTIVE

The scientific literature supports multitemporal Sentinel-1 VV/VH/VH:VV as crop-structure, phenology and harvest-sensitive observables. It also retains important confounders: soil moisture, surface roughness, crop water content, architecture and acquisition geometry. Published harvest-detection methods generally use time series, ground truth, trained rules/models and/or coherence; a single uncalibrated same-field intensity series is not a deterministic harvest-exclusion authority.

Relevant primary / peer-reviewed references:

- ESA Sentinel-1 operations: 12-day repeat cycle, 175 orbits per cycle.
- Nasirzadehdizaji et al. (2021), *Sentinel-1 interferometric coherence and backscattering analysis for crop monitoring*, Computers and Electronics in Agriculture 185, 106118, DOI `10.1016/j.compag.2021.106118`.
- Vreugdenhil et al. / related Netherlands crop-monitoring work: Sentinel-1 crop backscatter and VH/VV respond to crop development; maize harvest can produce abrupt backscatter decreases, but wet soil can obscure the expected harvest reduction. Remote Sensing 11(16), 1887, DOI `10.3390/rs11161887`.
- Wang et al. (2022), *Parcel-based summer maize mapping and phenology estimation combined using Sentinel-2 and time series Sentinel-1 data*, IJAEOG 108, 102720, DOI `10.1016/j.jag.2022.102720`.

The governance boundary is stricter still. Amendment-13 defines `season_lifecycle_authority` as a governed management-season statement, explicitly independent from biological vitality / stage. It requires a separately qualified lifecycle policy and forbids deriving ACTIVE merely from absence of a termination record. Amendment-15 further rejects treating retrieval silence as a coverage watermark.

Therefore this adjudication accepts:

`S1C_SAME_TRACK_STRUCTURAL_CONTINUITY = RESOLVED_CANDIDATE`

but rejects:

`SAR => DIRECT_STANDING_CROP_TRUTH`

`SAR => HARVEST_EXCLUDED`

`SAR => MANAGEMENT_SEASON_ACTIVE`

`SAR => BOUNDED_FORWARD_LIFECYCLE_LEASE`

## Preserved T3R1 candidate facts

This adjudication does not reopen or weaken the independently qualified T3R1 candidate facts:

- 2026-05-20 current-season Pioneer P0306Q planting candidate;
- conservative crop-only geometry candidate;
- unique `MID` water-use-stage candidate over the qualified window;
- `Kc = 1.15` candidate;
- strict 2026-07-30 Sentinel-2 standing-crop observation candidate.

The unresolved axis remains only the current management-season lifecycle.

## Next frontier

`T3R1_DIRECT_CURRENT_POSITIVE_LIFECYCLE_ANCHOR_OR_SCOPE_COMPLETE_LIFECYCLE_POLICY_REQUIRED`

The next successor must produce either a direct current positive lifecycle observation with governed management semantics, or a separately qualified scope-complete lifecycle policy. It may not obtain GO by inventing a SAR threshold, reusing a stage guard as a lifecycle TTL, treating AgLog silence as completeness, or relabeling observation availability time as lifecycle event time.

All runtime, database, scheduler and Formal writes remain zero. Formal remains `0/24`.
