# GEOX MCFT-CAP-09 Amendment-15 — Provider Snapshot Lifecycle Boundary Correction

Status: **CANDIDATE — NOT EFFECTIVE UNTIL EXACT-HEAD GOVERNANCE PROOF AND PROTECTED-MAIN MERGE**

Capability line: `MCFT-CAP-09`

Slice: `MCFT-CAP-09.S6`

Authority layer: `L2_BOUNDED_LIFECYCLE_CARRY_FORWARD`

Exact base protected main: `2cc901168ad208873ec6558a1a712fcfe887bf14`

Next authorized frontier after effectiveness: `T1R1_SCOPE_COVERAGE_COMPLETENESS_OR_DIRECT_CURRENT_ANCHOR_REFRESH_QUALIFICATION`

## 1. Purpose

Amendment-15 corrects the interpretation boundary of the Layer-2 qualification merged in PR #3137.

PR #3137 remains a valid read-only qualification showing that, at retrieval time, the published T1R1 AgLog surface contained no published Harvest/Termination or successor Planting after the Amendment-14 positive ACTIVE anchor. It did **not** establish that the T1R1 provider record was complete through the HTTP retrieval timestamp.

This amendment therefore explicitly rejects the following interpretation:

```text
T1R1 page retrieved at R
+
no published reset found
=> lifecycle ACTIVE valid through R
```

The HTTP retrieval timestamp is an availability/retrieval chronology fact. It is **not** a provider coverage watermark.

This amendment does not create current lifecycle authority, does not create a bounded ACTIVE validity interval beyond the historical positive anchor, does not create a forward lifecycle lease, does not enter phenology adjudication, does not resolve `Kc`, does not select a future `T`, and does not make EA5E2 READY.

The ordered proof layers remain:

1. `POSITIVE_LIFECYCLE_ANCHOR`
2. `BOUNDED_LIFECYCLE_CARRY_FORWARD`
3. `PHENOLOGY_TO_WATER_USE_STAGE`
4. `STAGE_TO_KC_TO_LEGAL_T`

## 2. Formal scope preserved

```text
site_id = KBS_MCSE_T1R1
field_id = field_kbs_mcse_t1r1
season_id = season_2026_corn
crop = corn
hybrid_product_code = P0306Q
provider_area_identity = T1R1
positive_lifecycle_anchor = observation 6977
```

No other treatment or replicate may substitute for this scope.

## 3. Exact predecessor authority

Amendment-14 remains the sole positive lifecycle authority presently established for this season/scope.

```text
amendment_14_merge_sha = b7c65734681b7c9b05ebd16a8faae835af01a5ed
amendment_14_blob_sha = 299e256bed5ab8c822990f34686b310da3bcf00e
positive_anchor_observation_id = 6977
positive_anchor_event_end_utc = 2026-05-27T20:40:00.000Z
positive_anchor_authority_available_to_runtime_at = 2026-08-14T12:24:43.798Z
```

Amendment-15 does not extend that ACTIVE authority to the August retrieval time.

## 4. Exact PR #3137 qualification retained, but interpretation narrowed

The merged qualification is pinned as:

```text
qualification_subject_sha = 277643b74c822ddda7638deffbc99ef26f32c7f0
qualification_workflow_run_id = 31802447763
qualification_artifact_id = 9219831976
qualification_artifact_digest = sha256:f62eb7255bbb4ea286a0071ad2b3420efd61e2f2da41870eadd502e80f05ceb0
qualification_probe_blob = 8dd32ba38f68f85b1cf8120a9b40c65c2c9e99ea
qualification_workflow_blob = 9aeef98be6b35ec7ddb2c07184dd0b44433035f5
qualification_merge_sha = 2cc901168ad208873ec6558a1a712fcfe887bf14
qualification_time_utc = 2026-08-14T12:57:09.596Z
T1R1_area_snapshot_retrieved_at = 2026-08-14T12:56:56.184Z
```

The exact proof remains useful for these limited facts:

- KBS AgLog is a first-party record surface for MCSE agronomic activities/observations;
- the provider-native `T1R1` area page is the exact spatial surface inspected for this formal scope;
- the page rendered `359` historical records and no pagination was observed;
- historical T1R1 Harvest/Termination observability had `57` positive-control records;
- after positive anchor `6977`, the published T1R1 row set contained only:
  - `7076 | 2026-06-16 | Fertilizer Application`;
  - `7095 | 2026-06-25 | Observation`;
- the probe found zero published Harvest/Termination rows after the anchor under its then-current classifier;
- the probe found zero published successor Planting rows after the anchor under its then-current classifier;
- all writes remained zero;
- Formal remained `0/24`.

The following claims are **not** established by PR #3137:

```text
T1R1_SCOPE_COVERAGE_COMPLETE_THROUGH_RETRIEVAL = false
T1R1_PUBLICATION_LAG_UPPER_BOUND_ESTABLISHED = false
ACTIVE_VALID_THROUGH_RETRIEVAL_TIME = false
CURRENT_RUNTIME_LIFECYCLE_AUTHORITY_ESTABLISHED = false
FUTURE_FORWARD_VALIDITY_ESTABLISHED = false
```

## 5. Correct semantic result of the snapshot proof

The only lifecycle-relevant positive conclusion authorized from the PR #3137 snapshot is:

```text
NO_PUBLISHED_RESET_OBSERVED_AS_OF_RETRIEVAL = true
```

with chronology:

```text
T1R1_area_snapshot_retrieved_at = 2026-08-14T12:56:56.184Z
global_AgLog_index_retrieved_at = 2026-08-14T12:57:08.694Z
qualification_time_utc = 2026-08-14T12:57:09.596Z
```

These are retrieval/availability times. They are not lifecycle event times and they are not provider coverage watermarks.

The correct logical form is:

```text
positive ACTIVE anchor exists at 6977
+
T1R1 page retrieved at R
+
no published reset was found in the retrieved representation

=> NO_PUBLISHED_RESET_OBSERVED_AS_OF_RETRIEVAL
```

It is forbidden to transform this into:

```text
=> ACTIVE_VALID_THROUGH_R
```

unless a separately qualified, scope-specific coverage-completeness and publication-latency authority establishes that the provider record is complete through an event-time watermark W.

## 6. Scope-specific coverage completeness is unresolved

The T1R1 latest published row observed by the merged qualification was:

```text
2026-06-25 | observation 7095 | Observation
```

The area page was retrieved on 2026-08-14, roughly fifty days later.

`area.proof.retrieved_at` proves only when the runtime obtained the page representation. It does not prove that all T1R1 physical/agronomic operations through that timestamp had already been authored or published.

The global AgLog having newer rows elsewhere does not establish T1R1 scope completeness.

Historical Harvest positive controls establish **observability** of Harvest on the provider surface. They do not establish a bounded event-to-publication SLA.

The merged proof itself already reported:

```text
unpublished_physical_operation_lag_upper_bound_established = false
```

Therefore:

```text
T1R1_SCOPE_SPECIFIC_COVERAGE_WATERMARK = UNRESOLVED
T1R1_PUBLICATION_COMPLETENESS = UNRESOLVED
T1R1_PUBLICATION_LAG_UPPER_BOUND = UNRESOLVED
```

## 7. Reset classifier is not sufficient for authority adoption

PR #3137 classified reset/successor events from `observation_type` only.

KBS Expanded AgLog exposes `observation_type` and `comment` as distinct semantics. A row such as:

```text
observation_type = Observation
comment = Corn harvested ...
```

would not be safely excluded by a classifier that scans only `observation_type`.

Therefore the PR #3137 zero-reset result remains descriptive evidence only.

Before any carry-forward authority may be adopted, a successor qualification must do one of the following:

1. fetch and classify the detail/comment semantics for every relevant post-anchor T1R1 row; or
2. establish a provider taxonomy authority proving that all lifecycle-reset events are guaranteed to use a qualified `observation_type` class.

Until one of those is proven:

```text
RESET_SEMANTIC_CLASSIFICATION_COMPLETE = false
```

## 8. Same-day observation ID is not event chronology

PR #3137 used provider observation ID ordering as an enumeration convenience for same-day rows.

No authority currently proves:

```text
provider_observation_id increasing
=
physical event time increasing
```

Therefore observation ID ordering may not be consumed as lifecycle authority chronology.

Any successor qualification must use provider event-time semantics where available, or conservatively treat same-day ordering as unresolved. It may not infer physical chronology from numeric ID monotonicity.

## 9. No bounded lifecycle carry-forward authority is adopted

After Amendment-15 becomes effective, the lifecycle authority remains:

```text
historical_positive_active_anchor_authority = Amendment-14 / observation 6977
current_runtime_lifecycle_authority_established = false
bounded_active_validity_interval_beyond_anchor_established = false
no_published_reset_observed_as_of_retrieval = true
scope_specific_coverage_completeness_established = false
publication_lag_upper_bound_established = false
reset_semantic_classification_complete = false
```

No `valid_through_provider_snapshot_utc` lifecycle authority exists.

The August retrieval timestamp remains evidence availability chronology only.

## 10. Future lifecycle validity remains zero

Amendment-15 explicitly establishes:

```text
future_forward_validity_hours = 0
future_forward_validity_established = false
future_target_wholly_inside_lifecycle_validity_established = false
```

No `TTL`, grace period, hold-last-value period, persistence fill, planned-harvest heuristic, thermal/GDD inference, or probabilistic “unlikely to harvest” interval may be inferred from this amendment.

The KBS ANPP protocol's normal corn harvest timing may remain auxiliary context only. It is not a 2026 field-operation commitment and does not establish future lifecycle validity.

## 11. Exact remaining Layer-2 blocker

The primary blocker is now earlier than the previously named `+3h` problem:

```text
T1R1_SCOPE_COVERAGE_COMPLETENESS_UNRESOLVED
```

This means the system has not established the right endpoint of a bounded lifecycle validity interval even for the past interval leading to the August retrieval.

Only after scope-specific completeness/publication semantics are qualified may a successor decide whether absence can carry the historical ACTIVE anchor to a finite past/current watermark.

Only after that may any future-validity question be considered.

## 12. Next legal frontier

The next frontier is exactly:

`T1R1_SCOPE_COVERAGE_COMPLETENESS_OR_DIRECT_CURRENT_ANCHOR_REFRESH_QUALIFICATION`

Two paths are legal:

1. **Coverage path** — qualify a T1R1-specific event-time coverage watermark, publication completeness/latency semantics, and complete reset classification; then compute a bounded validity endpoint from those facts.
2. **Direct-current-anchor path** — obtain a new direct positive current-season T1R1 lifecycle observation with real event/availability chronology and use that as a refreshed positive anchor.

If KBS cannot provide the coverage/publication authority, the preferred path is `DIRECT_CURRENT_ANCHOR_REFRESH`, not an invented carry-forward lease.

## 13. Phenology and Kc remain outside Layer 2

After Amendment-15 alone:

```text
phenology_stage.status = UNRESOLVED
phenology_stage.stage = null
crop_model_parameter.status = UNRESOLVED
crop_model_parameter.parameter = Kc
crop_model_parameter.kc = null
```

Thermal/GDD is not consumed as lifecycle authority.

No R1/R3/R5/R6, silking, dent, maturity, or other phenology semantic is adjudicated by this amendment.

## 14. Hard nonclaims and zero-write boundary

The following remain false:

- `current_runtime_lifecycle_authority_established = false`;
- `bounded_active_validity_interval_beyond_anchor_established = false`;
- `scope_specific_coverage_completeness_established = false`;
- `publication_lag_upper_bound_established = false`;
- `reset_semantic_classification_complete = false`;
- `future_forward_validity_established = false`;
- `future_legal_t_established = false`;
- `phenology_stage_resolved = false`;
- `crop_model_parameter_resolved = false`;
- `Kc_resolved = false`;
- `EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false`;
- `database_write_authorized = false`;
- `formal_evidence_write_authorized = false`;
- `raw_object_write_authorized = false`;
- `runtime_config_write_authorized = false`;
- `scheduler_write_authorized = false`;
- `canonical_runtime_write_authorized = false`;
- `formal_window_started = false`;
- `Formal execution = 0/24`;
- `MCFT-CAP-09 completed = false`.

## 15. Effect only after exact-head proof and merge

Before exact-head governance proof and protected-main merge, Amendment-15 is a candidate with zero authority effect.

After proof and merge, only these effects become authoritative:

- PR #3137's snapshot result is formally interpreted as `NO_PUBLISHED_RESET_OBSERVED_AS_OF_RETRIEVAL`, not lifecycle ACTIVE valid through retrieval;
- HTTP retrieval time is explicitly forbidden as a lifecycle coverage watermark;
- Amendment-14 remains the latest positive ACTIVE lifecycle authority;
- T1R1 scope-specific coverage completeness remains unresolved;
- publication-lag upper bound remains unresolved;
- reset semantic classification remains incomplete until comment/detail or provider taxonomy is qualified;
- same-day observation ID ordering is not lifecycle event chronology;
- future lifecycle validity remains `0h / UNRESOLVED`;
- phenology and `Kc` remain unresolved;
- no future legal `T` exists under this amendment alone;
- the next frontier is `T1R1_SCOPE_COVERAGE_COMPLETENESS_OR_DIRECT_CURRENT_ANCHOR_REFRESH_QUALIFICATION`;
- all Runtime, scheduler, database, activation, and Formal effects remain false.
