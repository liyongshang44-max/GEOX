# GEOX MCFT-CAP-09 Amendment-10 — P0306 bounded thermal proxy authority

Status: **CANDIDATE — NOT EFFECTIVE UNTIL EXACT-HEAD PROOF AND PROTECTED-MAIN MERGE**

Capability line: `MCFT-CAP-09`

Slice: `MCFT-CAP-09.S6`

Candidate frontier: `S6-AMENDMENT-10-P0306-BOUNDED-THERMAL-TRANSFER-AUTHORITY`

Exact base protected main: `9e9f358bc57799c7ec1a29d177076b7256bf163f`

## 1. Purpose

Amendment-10 is a narrow additive authority for one unresolved current-season question: whether the exact 2026 KBS T1 hybrid `P0306Q / 103 RM` may be evaluated with a **bounded thermal proxy interval** after the original exact-product threshold search terminated fail-closed.

This amendment does **not** declare any `P0306AM` number to be a `P0306Q` point threshold. It does **not** establish a crop-water-use stage. It only authorizes a separately proved successor qualification to consume a deliberately conservative proxy interval while carrying the proxy uncertainty all the way through the stage decision.

The historical #3049 result remains true: exact first-party `P0306Q` GDU-to-silk and GDU-to-physiological-maturity threshold authority was not established under the enumerated sources available to that slice.

The historical #3050 result also remains true: no post-2026-05-11 T1/T1R1 natural-season planting candidate was observed in that exact snapshot.

Amendment-10 is possible only because a later evidence-only adjudication (#3051) established additional evidence that had not been authorized for use by #3049.

## 2. Frozen predecessor evidence

The following predecessor facts are consumed without mutation:

- Amendment-09 blob: `422f60257039e0f674171c218a7ff0a2fd7dc1b2`.
- EA9A source/hybrid blob: `0e1f809c4bf63b09f4e44431ce507e3b74a966af`.
- EA9A exact-P0306Q thermal-threshold blob: `a4be8bea8fd31f2d451bd49b24da67a2ec3210df`.
- EA9B new-natural-season adjudication blob: `0e5752ff903663037b6399d68aca1290b2828e7f`.
- P0306 genetic-background / thermal-equivalence evidence-adjudication blob: `fdcac3109d2a17a1a4f5593fd690552c4b9e93b0`.

The exact supported #3051 live proof is frozen as:

- subject head: `bdee9a2ada93caaf8b1335ccb2d0e8f03796c8d3`;
- workflow run: `31493280142`;
- artifact: `9101896188`;
- artifact digest: `sha256:76fdf0b34a2c56072649e44fb5f797c843f1aeef60d15f22f6c1d2dddd1f61d1`;
- result: `P0306_BOUNDED_THERMAL_TRANSFER_POLICY_ADJUDICATION_SUPPORTED`.

The supported proof established the following bounded evidence facts, not point-threshold truth:

1. exact 2026 material remains `P0306Q / 103 RM`;
2. Bayer explicitly binds `P0306Q` and `P0306AMXT` at 103 RM as the same genetic background in the enumerated trial description;
3. Pioneer defines a hybrid family as products with the same base genetics and separately warns that products in the same genetic family with different technology traits may differ by two to three days in maturity;
4. the archived Pioneer 2020 guide mirror associates both `P0306AM` and `P0306AMXT` with CRM `103`, Silk CRM `101`, and Physiological CRM `104`;
5. the same historical table does **not** show exact thermal identity: Canadian Heat Units are `3100` for `P0306AM` and `3125` for `P0306AMXT`;
6. one secondary independent Pioneer sales representative source associates `P0306AM` with `1330` Base-50 GDU to silk and `2500` Base-50 GDU to physiological maturity;
7. no exact `P0306Q` or exact `P0306AMXT` GDU point threshold was established by #3051;
8. Canadian Heat Units were not converted to Base-50 GDU;
9. the secondary `1330/2500` values were not stage-determinative and were not transferred to `P0306Q` by #3051.

## 3. Ruling: point transfer remains forbidden

The following claims remain forbidden:

- `P0306Q GDU-to-silk = 1330`;
- `P0306Q GDU-to-physiological-maturity = 2500`;
- `P0306AM = P0306AMXT = P0306Q` as exact thermal identities;
- conversion of the `3100/3125` Canadian Heat Unit values into Base-50 GDU values;
- treating CRM `103`, Silk CRM `101`, or Physiological CRM `104` as direct Base-50 GDU thresholds;
- declaring a biological V/R stage from the proxy alone;
- declaring `INITIAL`, `DEVELOPMENT`, `MID`, or `LATE` from the proxy alone.

Therefore:

`related_product_point_threshold_transfer_authorized = false`

`exact_p0306q_product_specific_threshold_authority_established = false`

## 4. Narrow additive authority: bounded proxy interval

Amendment-10 authorizes one new **qualification input class** only:

`ASSUMED_P0306Q_BOUNDED_THERMAL_PROXY_V1`

The central candidate values remain evidence from the secondary `P0306AM` source, not target-product truth:

- candidate GDU to silk center = `1330`;
- candidate GDU to physiological maturity center = `2500`.

Pioneer current Base-50 semantics cap daily thermal accumulation using a 50°F lower reference and 86°F upper reference. Under that formula the theoretical maximum daily Base-50 accumulation is `36 GDU/day`. Pioneer also warns that products in the same genetic family with different technology traits may differ by up to three maturity days in the cited guidance.

For this amendment only, the successor qualification must therefore carry the deliberately conservative engineering review bound:

`proxy_timing_uncertainty_days = ±3`

`maximum_base50_gdu_per_day = 36`

`proxy_threshold_uncertainty_gdu = ±108`

The resulting allowed proxy intervals are:

- silk proxy interval: `[1222, 1438] GDU`;
- physiological-maturity proxy interval: `[2392, 2608] GDU`.

These intervals are **not product specifications**. `±108 GDU` is a conservative qualification envelope derived from the maximum Base-50 accumulation possible across the allowed three-day maturity displacement. It must never be emitted or described as Pioneer-provided `P0306Q` threshold uncertainty.

The non-zero `3100` versus `3125` Canadian Heat Unit difference remains a mandatory counterexample to any exact-equivalence interpretation.

## 5. Epistemic class

Any successor use of the interval must classify it as:

`ASSUMED_BOUNDED_PROXY`

It may not be classified as:

- `OBSERVED`;
- `DIRECT_PROVIDER_PRODUCT_THRESHOLD`;
- `FIRST_PARTY_P0306Q_THRESHOLD`;
- `EXACT_P0306Q_THERMAL_AUTHORITY`.

The proxy may only support a model-stage result if the final result is invariant over the full allowed uncertainty set.

## 6. Required successor qualification

After Amendment-10 becomes effective, the only current-season salvage successor authorized by this amendment is:

`S6-EA9A-P0306Q-BOUNDED-GDD-STAGE-QUALIFICATION`

That successor must separately prove all of the following:

1. the exact KBS T1 planting authority and its full local-calendar-day timestamp uncertainty are preserved;
2. Base-50 GDD is calculated only from governed KBS meteorology available under the exact as-of evidence policy;
3. missing or delayed meteorology is carried as uncertainty or causes fail-closed; it may not be silently filled from future observations;
4. the full silk interval `[1222,1438]` and physiological-maturity interval `[2392,2608]` are carried rather than their centers;
5. no Canadian Heat Unit conversion is used;
6. no RM-to-GDU conversion is used;
7. no future observation or full-season ex-post normalization is used;
8. Amendment-09 `T-6h ... T+30h` backward-stability / forward-transition guard remains active;
9. an explicit, independently governed mapping from the thermal landmarks to the four permitted crop-water-use model stages (`INITIAL`, `DEVELOPMENT`, `MID`, `LATE`) is present before any stage can be established;
10. that mapping must not equate silking directly with an FAO water-use-stage boundary or physiological maturity directly with the beginning of `LATE` unless a separate authority explicitly supports that mapping;
11. **every** permitted combination of planting-time uncertainty, meteorological uncertainty, bounded thermal proxy thresholds, and transition-guard time must resolve to one identical four-stage code;
12. otherwise the successor must terminate fail-closed with no current-season stage authority.

This means Amendment-10 deliberately does not guarantee that the current season can be rescued. It only makes the bounded test legal.

## 7. Relationship to EA9B

The EA9B time-gated natural-season path remains valid and append-only.

After Amendment-10 becomes effective, current routing is:

- primary bounded current-season test: `S6-EA9A-P0306Q-BOUNDED-GDD-STAGE-QUALIFICATION`;
- fallback on any non-conservative or unresolved result: `S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION`;
- parallel operational line: `S6-EA5E2-OPERATIONAL-ACTIVATION-QUALIFICATION-UNDER-AMENDMENT-08`.

A later exact direct `P0306Q` threshold or direct field-phenology source may still be separately requalified. It does not retroactively rewrite #3049 or #3051.

## 8. Write and execution boundary

Amendment-10 authorizes no data-plane or runtime write.

The following remain false:

- `database_write_authorized = false`;
- `formal_evidence_write_authorized = false`;
- `formal_raw_object_write_authorized = false`;
- `runtime_config_persistence_authorized = false`;
- `scheduler_write_authorized = false`;
- `canonical_runtime_write_authorized = false`;
- `successor_epoch_selected = false`;
- `EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false`;
- `EA5E3 = false`;
- `Formal execution = 0/24`;
- `MCFT-CAP-09 completed = false`.

## 9. Effect only after exact-head proof and protected-main merge

Before exact-head proof and protected-main merge, this document is a candidate with no authority effect.

If the exact Amendment-10 governance proof passes and the candidate is merged to protected `main`, the following limited effect becomes true:

- `P0306_BOUNDED_THERMAL_PROXY_QUALIFICATION_AUTHORIZED = true`;
- `P0306_POINT_THRESHOLD_TRANSFER_AUTHORIZED = false`;
- `CURRENT_SEASON_STAGE_AUTHORITY_ESTABLISHED = false`;
- next bounded current-season successor = `S6-EA9A-P0306Q-BOUNDED-GDD-STAGE-QUALIFICATION`;
- fallback remains `S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION`;
- Formal remains `0/24`.
