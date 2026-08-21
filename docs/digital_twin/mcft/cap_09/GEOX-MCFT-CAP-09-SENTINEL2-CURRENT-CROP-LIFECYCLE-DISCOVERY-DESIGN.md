# GEOX MCFT-CAP-09 — Sentinel-2 Current-Crop Lifecycle Discovery Design

Status: **CANDIDATE / DISCOVERY ONLY — NO AUTHORITY EFFECT**

Capability line: `MCFT-CAP-09`

Slice: `MCFT-CAP-09.S6`

Exact base protected main: `23f224c701dbe0b8bd56eceff3741cb1c3dc1f78`

Predecessor frontier: `CURRENT_CROP_ALTERNATIVE_SOURCE_AUTHORITY_DESIGN_REVIEW`

## 1. Purpose

This change establishes one narrow, read-only discovery path for evaluating Copernicus Sentinel-2 L2A as an **alternative current-crop evidence candidate** for the exact MCFT-CAP-09 formal scope:

```text
site_id = KBS_MCSE_T1R1
field_id = field_kbs_mcse_t1r1
season_id = season_2026_corn
crop = corn
hybrid = P0306Q / 103 RM
```

It does not modify the canonical Runtime, readiness, scheduler, provider adapter, crop context, model coefficient, persistence, database, Formal evidence writer, or O00-O23 execution path.

The objective is discovery only:

```text
SATELLITE_CURRENT_CROP_LIFECYCLE_EVIDENCE_CANDIDATE
```

The probe measures whether exact T1R1 Sentinel-2 acquisitions contain usable plot-level optical evidence and preserves enough source/spatial/time provenance for a later authority design review.

## 2. Predecessor authority and why this path is legal

Protected main at the exact base already establishes:

- KBS weather/provider transport and five-family CAP04 consumption are closed;
- Amendment-13 separates `season_lifecycle_authority`, `phenology_stage_authority`, and `crop_model_parameter_authority`;
- Amendment-15 forbids treating provider retrieval time or silence as a T1R1 lifecycle coverage watermark;
- PR #3142 establishes a reviewed public KBS **formal-scope direct-source gap**, not global KBS staleness;
- T3, T2/REX, unrelated experiments, provider silence, thermal age, imagery, or model-only phenology may not substitute automatically for T1R1 authority;
- the next legal frontier is `CURRENT_CROP_ALTERNATIVE_SOURCE_AUTHORITY_DESIGN_REVIEW`.

This candidate remains subordinate to those boundaries.

## 3. Exact spatial binding

The spatial source is the already-governed KBS MCSE plot-polygon table:

```text
source_id = KBS039-006.40
provider surface = https://lter.kbs.msu.edu/datatables/829.csv
selection = treatment T1 / replicate R1 / subplot main
CRS = EPSG:4326
frozen canonical GeoJSON semantic SHA-256 = sha256:c50671e0bad6dcfe13796d93f35cd4c7939c22c1635c09dd8c9182b0e29ff1ae
```

KBS states that data from its core database may not be published without written permission. Therefore the probe MUST NOT commit, print, upload, or otherwise emit the raw T1R1 polygon coordinates.

The probe may emit only non-reconstructive provenance such as:

```text
KBS response SHA-256
selected geometry source-text SHA-256
selected canonical GeoJSON semantic SHA-256
frozen expected semantic SHA-256
CRS
vertex count
selection identity T1/R1/main
retrieved_at
```

The exact polygon is held only in process memory for the Copernicus requests. After parsing numeric coordinates, the probe canonicalizes the selected polygon as `JSON.stringify({type:'Polygon',coordinates:[ring]})` and MUST match the frozen semantic digest above before any Copernicus request is allowed. A provider geometry change therefore fails closed rather than silently changing the formal spatial subject.

Forbidden spatial substitutions:

```text
no T3 -> T1R1 substitution
no T2/REX -> T1R1 substitution
no centroid-only fallback
no bounding-box-only promotion
no neighboring-plot fill
no geometry buffer expansion for authority
```

## 4. Copernicus source binding

Discovery uses official Copernicus Data Space Ecosystem Sentinel Hub endpoints:

```text
Catalog API:
https://sh.dataspace.copernicus.eu/catalog/v1/search

Statistical API:
https://sh.dataspace.copernicus.eu/statistics/v1

collection:
sentinel-2-l2a
```

The repository probe does **not** read or exchange long-lived OAuth client credentials. An operator obtains a short-lived Copernicus access token outside this repository code path and injects only that ephemeral bearer token at execution time. The token MUST NOT be written to repository files, workflow logs, artifacts, or acceptance output.

The only CI secret reference is:

```text
CDSE_SENTINEL_HUB_ACCESS_TOKEN
```

This is intentionally a least-privilege split: OAuth client ID/secret handling remains outside the committed probe.

## 5. Discovery time window and chronology

Initial discovery window:

```text
2026-07-01T00:00:00.000Z -> live retrieval time
```

The following chronology is mandatory:

```text
Sentinel sensing time = observation/event time
probe/API retrieval time = availability/retrieval time
```

The probe may never rewrite sensing time to retrieval time.

A later authority qualification must preserve any processing/publication latency semantics separately. This discovery does not establish a provider publication SLA or backdate runtime availability.

No future observation may be consumed for an earlier as-of decision.

## 6. First-pass spectral/statistical surface

The first pass is deliberately small:

```text
B04 = red
B08 = NIR
SCL = Sentinel-2 L2A Scene Classification Layer
dataMask = source-valid pixel mask
spatial resolution = 10 m for statistical aggregation
```

Per acquisition day, the probe records:

```text
scene/item IDs
sensing_time
scene-level eo:cloud_cover (sorting/context only)
plot clear fraction
plot clear-land fraction
plot vegetated fraction
plot mean NDVI over clear-land pixels
SCL cloud shadow fraction
SCL medium cloud fraction
SCL high cloud fraction
SCL thin cirrus fraction
SCL snow/ice fraction
statistics response digest
statistics retrieved_at
```

Scene-level cloud cover is never treated as plot clear fraction.

The clear-land computation excludes cloud shadow, medium/high cloud, cirrus, snow/ice, and water. NDVI is summarized only over clear-land pixels by a weighted-mean derivation from the Statistical API result.

A descriptive `plot_clear_land_fraction >= 0.5` screen may be used only to identify acquisitions worth human/next-stage inspection. It is not a lifecycle, phenology, stage, or Kc mapping threshold.

## 7. Scene binding ambiguity

The probe groups Catalog items by UTC acquisition day before requesting one-day plot statistics.

If more than one intersecting Sentinel-2 Catalog item exists on the same UTC day:

```text
scene_binding_ambiguity = true
```

The statistics remain discovery evidence for that day only. They may not be relabelled as belonging uniquely to one scene without a separately qualified exact-scene selection mechanism.

## 8. What this discovery may answer

It may support later review of questions such as:

```text
Was the exact T1R1 plot optically observable on a given acquisition?
Was a substantial fraction of the plot classified as vegetation?
Does the clear-land NDVI trajectory show persistence, senescence, or abrupt removal-like change?
Are there clear acquisitions near the current date worth deeper source adjudication?
```

These are evidence-candidate questions only.

## 9. What this discovery may NOT answer

This change does not authorize any of the following claims:

```text
Sentinel vegetation => season_lifecycle ACTIVE
NDVI decline => harvested/TERMINATED
NDVI value => V/R biological stage
NDVI trajectory => INITIAL/DEVELOPMENT/MID/LATE water-use stage
Sentinel state => Kc
scene cloud cover => plot clear fraction
remote sensing => direct provider phenology replacement
```

In particular:

```text
current_season_lifecycle_authority_established = false
current_phenology_authority_established = false
current_crop_model_parameter_authority_established = false
Kc_resolved = false
future_legal_T_established = false
EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false
Formal = 0/24
```

## 10. Raw-data and artifact boundary

The immutable workflow artifact may contain only the sanitized discovery JSON.

It MUST NOT contain:

```text
raw KBS geometry CSV
T1R1 polygon coordinates
OAuth client ID
OAuth client secret
access token
raw Sentinel imagery
raw Copernicus API bodies
```

Response digests and derived plot statistics are allowed.

## 11. Exact implementation boundary

This candidate is intentionally limited to four files:

1. `docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-SENTINEL2-CURRENT-CROP-LIFECYCLE-DISCOVERY-DESIGN.md`
2. `scripts/runtime_acceptance/PROBE_MCFT_CAP_09_SENTINEL2_CURRENT_CROP_LIFECYCLE_DISCOVERY.mjs`
3. `scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_SENTINEL2_CURRENT_CROP_LIFECYCLE_DISCOVERY.cjs`
4. `.github/workflows/mcft-cap-09-sentinel2-current-crop-lifecycle-discovery.yml`

No Runtime or data-plane file belongs in this candidate.

## 12. Workflow execution model

Static exact-boundary governance proof runs on PR/push without secrets.

The live Sentinel-2 probe runs only through explicit `workflow_dispatch` with `run_live=true`. This prevents a missing CI secret from turning a design-only PR into a misleading source failure and prevents routine PR events from spending external API quota.

A live run is valid discovery evidence only when:

```text
exact subject SHA is recorded
KBS restricted geometry is fetched live
frozen T1R1 semantic geometry digest matches
an externally obtained short-lived Copernicus bearer token is injected and accepted
Catalog returns intersecting sentinel-2-l2a scenes
Statistical API returns plot-level outputs
sanitized artifact is uploaded
```

A static PASS does not count as a live Sentinel-2 discovery PASS.

## 13. Successor decision boundary

After a successful live artifact is inspected, the next review is:

```text
SATELLITE_SOURCE_SPATIAL_TIME_CROP_AND_MAPPING_ADJUDICATION
```

That review must decide separately:

1. source identity and product semantics;
2. exact T1R1 spatial applicability;
3. sensing/processing/retrieval chronology;
4. whether the optical signal supports lifecycle evidence at all;
5. whether it can distinguish standing crop from other vegetation/background effects;
6. whether any biological phenology mapping is scientifically and operationally defensible;
7. whether any water-use-stage or Kc mapping exists under separately governed evidence.

Until that successor passes its own exact proof and protected-main authority adoption, `authority_effect = NONE`.
