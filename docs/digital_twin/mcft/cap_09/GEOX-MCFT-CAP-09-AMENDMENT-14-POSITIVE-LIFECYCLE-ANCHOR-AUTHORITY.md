# GEOX MCFT-CAP-09 Amendment-14 — Positive Lifecycle Anchor Authority

Status: **CANDIDATE — NOT EFFECTIVE UNTIL EXACT-HEAD GOVERNANCE PROOF AND PROTECTED-MAIN MERGE**

Capability line: `MCFT-CAP-09`

Slice: `MCFT-CAP-09.S6`

Authority layer: `L1_POSITIVE_LIFECYCLE_ANCHOR`

Exact base protected main: `bf82b7c67f56d7814912c5b84fbe392c08496274`

Next authorized frontier after effectiveness: `BOUNDED_LIFECYCLE_CARRY_FORWARD_FROM_OBS6977`

## 1. Purpose

Amendment-14 adopts one already-qualified, narrowly bounded positive management-season lifecycle anchor for the existing formal crop scope. It does not perform lifecycle carry-forward, phenology adjudication, crop-coefficient adjudication, future-`T` selection, Runtime modification, or Operational Activation.

The four proof layers remain strictly ordered:

1. `POSITIVE_LIFECYCLE_ANCHOR`
2. `BOUNDED_LIFECYCLE_CARRY_FORWARD`
3. `PHENOLOGY_TO_WATER_USE_STAGE`
4. `STAGE_TO_KC_TO_LEGAL_T`

Amendment-14 closes only Layer 1.

## 2. Formal scope preserved

The adopted anchor is scoped only to:

```text
site_id = KBS_MCSE_T1R1
field_id = field_kbs_mcse_t1r1
season_id = season_2026_corn
crop = corn
hybrid_product_code = P0306Q
provider_area_identity = T1R1
planting_observation_id = 6931
positive_management_observation_id = 6977
```

No T4 or other field/replicate may substitute for this scope.

## 3. Exact qualified predecessor proof

The authority adopts the exact-head qualification produced by merged PR #3135.

```text
qualification_subject_sha = c4d8e4429cc3c037b80d246aab80887d86003692
qualification_workflow_run_id = 31800131893
qualification_artifact_id = 9218942740
qualification_artifact_digest = sha256:aac5dda23bc777c3e8a74202cb09a3ce4307e15b6989f57c3213ded2ce026ee9
qualification_probe_blob = 693de6289a0a5cc0191e9c46f122258cb87e4079
qualification_workflow_blob = bde3e7805a72a4ef5a5205ee260dcd954eeb11f4
qualification_merge_sha = bf82b7c67f56d7814912c5b84fbe392c08496274
```

The exact proof established all of the following:

- planting observation `6931` directly supplies the governed `corn / P0306Q` season origin;
- observation `6977` directly supplies a positive managed activity fact on T1 all replicates, including T1R1;
- observation `6977` itself does **not** contain a direct `corn` or `P0306Q` token;
- the T1R1 AgLog interval between `6931` and `6977` is used only to preserve the already-positive season identity and contains no intervening reset event;
- absence was not used to create ACTIVE;
- thermal evidence was not used to create ACTIVE;
- phenology remained unresolved;
- `Kc` remained unresolved;
- all writes remained zero;
- Formal remained `0/24`.

## 4. Evidence roles are not interchangeable

The authority adopts the exact composite role separation proved by #3135.

### 4.1 Planting observation 6931

`6931` supplies:

- season origin;
- crop identity `corn`;
- hybrid identity `P0306Q`;
- the existing governed planting-date authority.

It does **not** by itself prove that the season was still ACTIVE on 2026-05-27 or on 2026-08-14.

### 4.2 Positive management observation 6977

`6977` supplies:

- a positive management activity fact;
- `Herbicide Application` semantics;
- T1 all-replicate spatial coverage including T1R1;
- a real provider-local operation window;
- a governed historical event-time window after timezone conversion;
- real current-runtime availability chronology from the exact qualification proof.

`6977` does not independently supply crop/hybrid identity and is therefore not a standalone crop authority.

### 4.3 Bounded T1R1 event-log continuity

The bounded event log supplies only identity continuity from the positive crop-bound season origin to the later positive management activity.

The qualified bounded interval contained:

```text
6927 | 2026-05-11 | Soil Preparation, Mechanical Weed Control
6931 | 2026-05-11 | Planting
6977 | 2026-05-27 | Herbicide Application
```

The qualified interval had `intervening_reset_candidate_count = 0`.

This absence result is allowed only because it is located **between two positive facts** and is used only to reject an intervening season reset. It is not a positive ACTIVE fact by itself.

## 5. Exact lifecycle anchor authority

After Amendment-14 becomes effective, the following narrow authority is established:

```text
season_lifecycle_anchor_authority = {
  status: ACTIVE,
  management_lifecycle_not_biological_vitality: true,
  season_id: season_2026_corn,
  crop: corn,
  hybrid_product_code: P0306Q,
  provider_area_identity: T1R1,
  positive_anchor_observation_id: 6977,
  anchor_event_time_window_utc: {
    start_inclusive: 2026-05-27T18:35:00.000Z,
    end_inclusive: 2026-05-27T20:40:00.000Z
  },
  authority_available_to_runtime_at: 2026-08-14T12:24:43.798Z,
  source_qualification_subject_sha: c4d8e4429cc3c037b80d246aab80887d86003692,
  source_qualification_artifact_digest: sha256:aac5dda23bc777c3e8a74202cb09a3ce4307e15b6989f57c3213ded2ce026ee9
}
```

The meaning of `ACTIVE` is only:

> the governed `season_2026_corn` management lifecycle was positively established as active during the qualified 6977 managed-operation anchor window.

It does not mean the crop was biologically healthy, unharvested at all later times, or at any particular phenology stage.

## 6. Event time and availability chronology must remain distinct

The lifecycle anchor event occurred in the historical window:

```text
2026-05-27T18:35:00.000Z .. 2026-05-27T20:40:00.000Z
```

The exact qualification did not establish a historical publication timestamp for the provider record. Therefore the authority uses the conservative, actually observed runtime availability:

```text
authority_available_to_runtime_at = 2026-08-14T12:24:43.798Z
```

The event-time fact must not be rewritten to the availability time.

The availability time must not be backdated to the event time.

No historical Formal tick or historical runtime decision before `2026-08-14T12:24:43.798Z` may claim that this authority was available then.

A later, separately authorized carry-forward proof may consume this historical positive anchor after its real runtime availability, but it may not manufacture retroactive availability.

## 7. Layer-1 validity is deliberately not carry-forward validity

Amendment-14 does **not** establish that the current season remains ACTIVE at the Amendment-14 merge time.

It does **not** establish a current lifecycle `valid_until` beyond the positive anchor window.

The post-Amendment-14 state is therefore intentionally:

```text
positive_lifecycle_anchor.status = ACTIVE
positive_lifecycle_anchor.event_time_window = 2026-05-27T18:35:00Z .. 20:40:00Z
current_lifecycle_as_of_now.status = UNRESOLVED
phenology_stage.status = UNRESOLVED
crop_model_parameter.status = UNRESOLVED
Kc = null
EA5E2 = BLOCKED
```

The next legal layer is exactly:

`BOUNDED_LIFECYCLE_CARRY_FORWARD_FROM_OBS6977`

That successor must separately qualify provider coverage, reset/termination observability, bounded absence semantics, and a finite carry-forward endpoint.

## 8. Absence semantics remain fail-closed

Amendment-14 authorizes no statement of the form:

```text
no harvest row observed
=> ACTIVE
```

It authorizes no statement of the form:

```text
planting + thermal accumulation
=> ACTIVE today
```

The only positive lifecycle basis is the qualified composite intersection:

```text
crop-bound planting origin 6931
+
positive managed activity 6977
+
bounded no-reset identity continuity between those two positive facts
```

Any absence after `6977` belongs exclusively to Layer 2 and has zero authority effect until separately qualified.

## 9. Phenology and model-parameter authority remain unresolved

Amendment-14 establishes no phenology semantic and no four-stage crop-water-use code.

It therefore establishes none of:

- `INITIAL`;
- `DEVELOPMENT`;
- `MID`;
- `LATE`.

Thermal/GDD evidence is not consumed by Amendment-14.

The existing exact R1/silking and R6/physiological-maturity mapping boundaries remain unchanged.

`crop_model_parameter_authority.status` remains `UNRESOLVED` and `Kc` remains `null`.

No new crop coefficient is introduced.

## 10. EA5E2 effect

Amendment-14 does not make EA5E2 READY.

It only replaces the absence of any positive lifecycle anchor with a governed historical positive anchor.

Until Layer 2 establishes a bounded current lifecycle interval and Layers 3–4 establish a legal stage, `Kc`, and future `T`, EA5E2 remains fail-closed.

No readiness code or Runtime behavior is modified by this amendment.

## 11. Hard nonclaims and write boundary

The following remain false after Amendment-14 alone:

- `current_lifecycle_active_as_of_amendment14_time = false`;
- `bounded_lifecycle_carry_forward_established = false`;
- `current_phenology_stage_resolved = false`;
- `current_crop_model_parameter_resolved = false`;
- `future_legal_t_established = false`;
- `database_write_authorized = false`;
- `formal_evidence_write_authorized = false`;
- `raw_object_write_authorized = false`;
- `runtime_config_write_authorized = false`;
- `scheduler_write_authorized = false`;
- `canonical_runtime_write_authorized = false`;
- `successor_epoch_selected = false`;
- `EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false`;
- `EA5E3 = false`;
- `Formal execution = 0/24`;
- `MCFT-CAP-09 completed = false`.

## 12. Effect only after exact-head proof and protected-main merge

Before exact-head governance proof and protected-main merge, this document is a candidate with no authority effect.

After proof and merge, only the following becomes effective:

- the 6931→6977 composite chain is adopted as a positive `ACTIVE` lifecycle anchor for `season_2026_corn` at the qualified 6977 event window;
- the real runtime availability boundary is `2026-08-14T12:24:43.798Z` and may not be backdated;
- no lifecycle status after the 6977 anchor window is established;
- no phenology stage is established;
- no `Kc` is established;
- no future legal `T` is established;
- `BOUNDED_LIFECYCLE_CARRY_FORWARD_FROM_OBS6977` becomes the next authorized frontier;
- all data-plane, scheduler, activation, and Formal effects remain false.
