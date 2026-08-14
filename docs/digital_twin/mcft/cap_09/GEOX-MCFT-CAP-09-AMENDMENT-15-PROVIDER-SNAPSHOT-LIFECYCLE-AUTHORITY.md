# GEOX MCFT-CAP-09 Amendment-15 — Provider Snapshot Lifecycle Authority

Status: **CANDIDATE — NOT EFFECTIVE UNTIL EXACT-HEAD GOVERNANCE PROOF AND PROTECTED-MAIN MERGE**

Capability line: `MCFT-CAP-09`

Slice: `MCFT-CAP-09.S6`

Authority layer: `L2_BOUNDED_LIFECYCLE_CARRY_FORWARD`

Exact base protected main: `2cc901168ad208873ec6558a1a712fcfe887bf14`

Next authorized frontier after effectiveness: `LIFECYCLE_FORWARD_VALIDITY_OR_DIRECT_CURRENT_ANCHOR_REFRESH_QUALIFICATION`

## 1. Purpose

Amendment-15 adopts the already-qualified bounded lifecycle carry-forward from the Amendment-14 positive lifecycle anchor to one exact KBS provider snapshot.

It closes only the **snapshot-bounded** portion of Layer 2.

It does not create any forward lifecycle lease after the snapshot, does not enter phenology adjudication, does not resolve `Kc`, does not select a future `T`, and does not make EA5E2 READY.

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

Amendment-14 remains the sole positive lifecycle origin for this Layer-2 carry-forward.

```text
amendment_14_merge_sha = b7c65734681b7c9b05ebd16a8faae835af01a5ed
amendment_14_blob_sha = 299e256bed5ab8c822990f34686b310da3bcf00e
positive_anchor_observation_id = 6977
positive_anchor_event_end_utc = 2026-05-27T20:40:00.000Z
positive_anchor_authority_available_to_runtime_at = 2026-08-14T12:24:43.798Z
```

Amendment-15 does not create ACTIVE from absence. It carries forward an already-positive ACTIVE anchor only under separately qualified provider semantics.

## 4. Exact qualified Layer-2 proof

The authority adopts the PR exact-head qualification produced by merged PR #3137.

```text
qualification_subject_sha = 277643b74c822ddda7638deffbc99ef26f32c7f0
qualification_workflow_run_id = 31802447763
qualification_artifact_id = 9219831976
qualification_artifact_digest = sha256:f62eb7255bbb4ea286a0071ad2b3420efd61e2f2da41870eadd502e80f05ceb0
qualification_probe_blob = 8dd32ba38f68f85b1cf8120a9b40c65c2c9e99ea
qualification_workflow_blob = 9aeef98be6b35ec7ddb2c07184dd0b44433035f5
qualification_merge_sha = 2cc901168ad208873ec6558a1a712fcfe887bf14
qualification_time_utc = 2026-08-14T12:57:09.596Z
```

The exact proof established:

- KBS AgLog is the first-party record surface for actual MCSE field operations;
- the provider-native `T1R1` area view is the exact spatial surface for this formal scope;
- the T1R1 area view rendered `359` historical records with no pagination observed;
- T1R1 historical Harvest/Termination observability had `57` positive-control records;
- after positive anchor `6977`, the published T1R1 event set contained only:
  - `7076 | 2026-06-16 | Fertilizer Application`;
  - `7095 | 2026-06-25 | Observation`;
- published Harvest/Termination after the anchor = `0`;
- published successor Planting after the anchor = `0`;
- absence was used only to carry forward the pre-existing positive ACTIVE anchor;
- absence was not used to create ACTIVE;
- no upper bound for unpublished physical-operation publication lag was established;
- no future lifecycle lease was established;
- phenology remained unresolved;
- `Kc` remained unresolved;
- all writes remained zero;
- Formal remained `0/24`.

## 5. Adopted snapshot-bounded lifecycle authority

After Amendment-15 becomes effective, the following narrow authority is established:

```text
provider_snapshot_lifecycle_authority = {
  status: ACTIVE,
  management_lifecycle_not_biological_vitality: true,
  season_id: season_2026_corn,
  crop: corn,
  hybrid_product_code: P0306Q,
  provider_area_identity: T1R1,
  positive_anchor_observation_id: 6977,
  valid_from_event_time_utc: 2026-05-27T20:40:00.000Z,
  valid_through_provider_snapshot_utc: 2026-08-14T12:56:56.184Z,
  qualification_time_utc: 2026-08-14T12:57:09.596Z,
  authority_class: PROVIDER_RECORDED_MANAGEMENT_LIFECYCLE,
  physical_real_world_lifecycle_beyond_provider_record_claimed: false
}
```

The meaning is precisely:

> Given the Amendment-14 positive ACTIVE anchor and the qualified T1R1 AgLog lifecycle event surface, the provider-recorded management lifecycle remained ACTIVE through the exact T1R1 provider snapshot retrieved at `2026-08-14T12:56:56.184Z`.

It does **not** assert that no unreported physical termination had occurred, and it does not assert that the crop remains ACTIVE after the snapshot.

## 6. Provider snapshot chronology

The exact provider proofs are:

```text
protocol_retrieved_at = 2026-08-14T12:56:52.268Z
T1R1_area_snapshot_retrieved_at = 2026-08-14T12:56:56.184Z
global_AgLog_index_retrieved_at = 2026-08-14T12:57:08.694Z
qualification_time_utc = 2026-08-14T12:57:09.596Z
```

The provider-state validity endpoint is the exact T1R1 area snapshot retrieval time:

```text
valid_through_provider_snapshot_utc = 2026-08-14T12:56:56.184Z
```

It must not be extended to the later global-index retrieval time or qualification time.

The historical event times remain historical event times and must not be rewritten to these retrieval timestamps.

## 7. Qualified absence semantics

For this authority, absence has only one authorized role:

```text
positive ACTIVE anchor already exists
+
exact T1R1 lifecycle event view is qualified
+
historical Harvest/Termination observability is demonstrated
+
no published reset/successor planting appears between anchor and snapshot

=> carry the provider-recorded ACTIVE state to the exact provider snapshot
```

The following inverse remains forbidden:

```text
no harvest observed
=> create ACTIVE
```

The following also remains forbidden:

```text
no harvest observed at snapshot
=> ACTIVE for some future lease
```

## 8. Future lifecycle validity remains zero

Amendment-15 explicitly establishes:

```text
future_forward_validity_hours = 0
future_forward_validity_established = false
future_target_wholly_inside_lifecycle_validity_established = false
reason = NO_QUALIFIED_FORWARD_MANAGEMENT_LIFECYCLE_GUARD_BEYOND_PROVIDER_SNAPSHOT
```

No `TTL`, grace period, hold-last-value period, persistence fill, or probabilistic “unlikely to harvest” interval may be inferred from this authority.

The active KBS ANPP protocol's normal corn harvest timing may be used only as auxiliary evidence in a separately versioned adjudication. It does not, by itself, convert this snapshot state into a future lease or a 2026 field-operation commitment.

Publication-lag observations may bound what provider absence means for the past; they do not predict that no lifecycle transition will occur after the snapshot.

## 9. EA5E2 target-horizon interaction

The existing EA5E2 live-window selector requires a future exact target after setup/pre-boundary lead and searches within a bounded future horizon.

Amendment-15 does not change that target-selection contract.

Because lifecycle validity ends at the provider snapshot and future-forward validity is zero, Amendment-15 alone cannot establish any future `T` whose required lifecycle causal window is wholly inside this authority interval.

The exact remaining lifecycle blocker is therefore conceptually:

```text
CURRENT_SEASON_LIFECYCLE_FORWARD_VALIDITY_UNRESOLVED
```

This document does not modify readiness code; a separate exact-head readiness binding may adopt that blocker only after Amendment-15 is effective.

## 10. Phenology and Kc remain outside Layer 2

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

Layer 3 may not be treated as a substitute for the unresolved future lifecycle interval.

## 11. Next legal frontier

The next frontier is exactly:

`LIFECYCLE_FORWARD_VALIDITY_OR_DIRECT_CURRENT_ANCHOR_REFRESH_QUALIFICATION`

A successor may qualify one of two things:

1. a genuinely governed forward lifecycle validity source/policy that is independent of provider silence and has a finite auditable endpoint; or
2. a newer direct positive current-season anchor, after which carry-forward can be re-evaluated.

Neither path may invent a lease duration to satisfy EA5E2.

## 12. Hard nonclaims and zero-write boundary

The following remain false:

- `physical_real_world_lifecycle_beyond_provider_record_claimed = false`;
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

## 13. Effect only after exact-head proof and merge

Before exact-head governance proof and protected-main merge, Amendment-15 is a candidate with zero authority effect.

After proof and merge, only these effects become authoritative:

- the provider-recorded lifecycle for `season_2026_corn` is `ACTIVE` through `2026-08-14T12:56:56.184Z`;
- that validity ends at the exact provider snapshot;
- future lifecycle validity remains `0h / UNRESOLVED`;
- phenology and `Kc` remain unresolved;
- no future legal `T` exists under this amendment alone;
- the next frontier is `LIFECYCLE_FORWARD_VALIDITY_OR_DIRECT_CURRENT_ANCHOR_REFRESH_QUALIFICATION`;
- all Runtime, scheduler, database, activation, and Formal effects remain false.
