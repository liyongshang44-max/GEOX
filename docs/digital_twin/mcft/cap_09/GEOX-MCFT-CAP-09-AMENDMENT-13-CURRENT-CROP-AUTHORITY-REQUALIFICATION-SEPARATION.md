# GEOX MCFT-CAP-09 Amendment-13 — Current Crop Authority Requalification Separation

Status: **CANDIDATE — NOT EFFECTIVE UNTIL EXACT-HEAD GOVERNANCE PROOF AND PROTECTED-MAIN MERGE**

Capability line: `MCFT-CAP-09`

Slice: `MCFT-CAP-09.S6`

Candidate frontier: `S6-CURRENT-CROP-AUTHORITY-REQUALIFICATION-SEPARATION`

Exact base protected main: `1e0b9ae19965e6cfc9f9a538b7299a8afd84fd60`

## 1. Purpose

Amendment-13 corrects one narrow authority-model coupling exposed after the External Formal evidence/runtime engineering blockers were closed on exact protected main.

The current crop authority path has been treating failure to derive one conservative four-stage phenology code as if it invalidated the entire current season lifecycle and therefore implied that no future legal target `T` exists. That implication is stronger than the MCFT-CAP-09 Taskbook requires and stronger than the External Formal runtime mathematics require.

This amendment separates three authority dimensions that must no longer be collapsed into one boolean crop-validity result:

1. `season_lifecycle_authority` — whether the governed management season is `ACTIVE`, `TERMINATED`, or `UNRESOLVED`;
2. `phenology_stage_authority` — whether one governed `INITIAL / DEVELOPMENT / MID / LATE` crop-water-use stage is `RESOLVED` or remains `UNRESOLVED`;
3. `crop_model_parameter_authority` — whether the numeric crop-model inputs actually consumed by the runtime, presently including `Kc`, are legally `RESOLVED` or remain `UNRESOLVED`.

A legal authority state may therefore be:

```text
season_lifecycle.status = ACTIVE
phenology_stage.status = UNRESOLVED
crop_model_parameter.status = UNRESOLVED
```

Such a state means the season remains a valid managed-season identity while the runtime still fails closed because a required crop-model parameter has not been established. It does **not** authorize a Formal tick with an invented stage or `Kc`.

## 2. Exact predecessor facts preserved

This amendment is additive except for the narrow supersession in Section 4. It preserves the exact historical facts and adjudications already present on the base protected main, including:

- the current MCFT-CAP-09 Taskbook;
- Amendment-01 External Public Evidence authority;
- Amendment-08 implementation-versus-operational-activation separation;
- Amendment-09 crop-context / season architecture adjudication;
- Amendment-10 bounded P0306 thermal proxy authority;
- Amendment-11 provider-availability watermark authority;
- Amendment-12 signed ET0 model-consumption authority;
- EA1J crop-water-use-stage authority;
- EA2 formal crop-context authority;
- the EA9A exact `P0306Q / 103 RM` current-season source/hybrid result;
- the EA9A bounded-GDD terminal result;
- the EA9B historical new-natural-season snapshot.

In particular, Amendment-13 does **not** rewrite the historical bounded-GDD result. The proof that the then-qualified conservative accumulated Base-50 GDD interval did not establish the safe `LATE` threshold remains true and immutable.

The historical EA9B result that no qualifying post-`2026-05-11` T1/T1R1 Planting candidate was observed in its bounded provider snapshot also remains true. It was a time-scoped snapshot, not a global absence claim.

## 3. Why the authority split is required

The MCFT-CAP-09 Stage 1B objective is online-runtime correctness under real External Evidence. The governed season identifier is part of scope and provenance. It is not itself an algebraic forecast input.

The current CAP04 water-balance path, however, consumes crop evapotranspiration demand through a numeric crop coefficient `Kc`; the current EA5E2 observer derives that coefficient from the resolved four-stage crop context. Therefore the present implementation has a real model-input dependency, but that dependency is narrower than `the season itself must cease to be authoritative whenever four-stage consensus fails`.

The correct fail-closed distinction is:

```text
season identity/lifecycle may remain valid
AND
phenology may remain unresolved
AND
EA5E2 may still be NO-GO because required model parameter authority is unresolved
```

Amendment-13 changes no water-balance equation, no `Kc` value, no crop-stage mapping, and no CAP04 semantics.

## 4. Narrow supersession of Amendment-09 implication

Amendment-13 supersedes **only** the following implication of the current Amendment-09 recovery architecture:

```text
four-stage phenology non-consensus
=> current season authority invalid / no future legal T
=> new-natural-season evidence is the only legal crop-authority continuation
```

After Amendment-13 becomes effective:

- four-stage phenology non-consensus means `phenology_stage_authority.status = UNRESOLVED` unless another separately governed phenology authority resolves it;
- it does **not**, by itself, determine `season_lifecycle_authority.status`;
- it does **not**, by itself, prove `ACTIVE`;
- it does **not**, by itself, prove `TERMINATED`;
- it does **not**, by itself, authorize a model `Kc`;
- it does **not** make a new natural season the only continuation path.

Amendment-09 remains authoritative for all other preserved restrictions, including no future leakage, no silent season relabelling, no cross-season state stitching, no invented phenology, and no automatic successor epoch selection.

## 5. Three-axis authority contract

The authorized successor `S6-CURRENT-CROP-AUTHORITY-REQUALIFICATION` must emit the following conceptual authority contract or an exact schema-equivalent version:

```text
season_lifecycle_authority = {
  status: ACTIVE | TERMINATED | UNRESOLVED,
  management_lifecycle_not_biological_vitality: true,
  authority_ref: ...,
  authority_hash: ...,
  as_of_time: ...
}

phenology_stage_authority = {
  status: RESOLVED | UNRESOLVED,
  stage: INITIAL | DEVELOPMENT | MID | LATE | null,
  authority_ref: ...,
  authority_hash: ...,
  as_of_time: ...
}

crop_model_parameter_authority = {
  status: RESOLVED | UNRESOLVED,
  kc: number | null,
  authority_ref: ...,
  authority_hash: ...,
  as_of_time: ...
}
```

The three axes are independently adjudicated. No status may be inferred merely from another axis being unresolved.

`season_lifecycle_authority.status = ACTIVE` is a governed management-season lifecycle statement. It is not a claim that the crop is biologically alive, not harvested, healthy, or at any specific V/R or crop-water-use stage unless those claims are separately established.

## 6. Current authority effect immediately after Amendment-13 merge

Amendment-13 itself performs no live provider requalification. Therefore, if this amendment passes exact-head proof and is merged to protected main, the newly separated current statuses are initially:

```text
current_season_lifecycle_status = UNRESOLVED
current_phenology_stage_status = UNRESOLVED
current_crop_model_parameter_status = UNRESOLVED
```

This amendment does **not** declare `season_2026_corn` to be `ACTIVE`.

This amendment does **not** declare `season_2026_corn` to be `TERMINATED`.

This amendment does **not** establish `INITIAL`, `DEVELOPMENT`, `MID`, or `LATE`.

This amendment does **not** establish a new `Kc`.

The next legal crop-authority successor becomes:

`S6-CURRENT-CROP-AUTHORITY-REQUALIFICATION`

The existing EA9B natural-season evidence requalification remains a legal branch, but it is no longer the only legal crop-authority continuation merely because current-season phenology is unresolved.

## 7. Allowed current-crop requalification input classes

The successor may examine only separately governed, auditable evidence and must preserve its as-of chronology. Candidate input classes include:

### 7.1 Direct current-season KBS phenology evidence

A directly attributable KBS observation may be requalified when it has sufficient source identity, spatial identity, event-time semantics, availability chronology, and crop/season linkage.

Examples worth discovering include explicit provider observations such as tasseling, silking, dent, physiological maturity, harvest, termination, or an equivalent directly described crop event.

The existence of a label does not itself authorize a four-stage mapping. Any mapping must be separately governed.

Existing qualified mapping evidence may be reused only within its exact established scope. In particular, an exact silking/R1 landmark may support the already-governed `MID` interpretation, and physiological maturity/R6-or-later before harvest may support the already-governed `LATE` interpretation. Tasseling, dent, or other events may not be automatically promoted to one of the four stages without separate mapping authority.

### 7.2 Other trustworthy KBS current-season observations

Other KBS current-season observations may become authority candidates only through a separate exact qualification of source identity, spatial applicability, temporal semantics, crop/season linkage, and stage/model mapping.

No observation becomes stage-determinative merely because it is contemporaneous.

### 7.3 Versioned bounded composite current-season authority

A separately versioned successor may combine governed planting authority, thermal accumulation, and direct observations if and only if:

- every consumed source is individually authorized;
- planting timestamp uncertainty is retained;
- thermal uncertainty is retained;
- direct-observation uncertainty and mapping uncertainty are retained;
- no future observation is used for an earlier as-of decision;
- no full-season ex-post normalization is used;
- no related-product point threshold is silently transferred to `P0306Q`;
- the historical six-FAO-variant authority is not overwritten or rewritten;
- the historical bounded-GDD terminal proof is not rewritten;
- the resulting stage or model parameter is invariant over the complete permitted uncertainty set, otherwise it remains unresolved.

### 7.4 Positive lifecycle termination evidence

A qualified harvest/termination observation may establish:

`season_lifecycle_authority.status = TERMINATED`

only when its source, spatial scope, event time, availability chronology, crop/season linkage, and termination semantics are separately qualified.

Absence of a termination row does not automatically prove `ACTIVE`. An `ACTIVE` lifecycle result requires a separately qualified lifecycle policy with bounded provider coverage through the authority time and explicit absence semantics sufficient for that lifecycle claim. If coverage or semantics are insufficient, lifecycle remains `UNRESOLVED`.

## 8. EA5E2 readiness must depend on the actual required authority

Amendment-13 does not weaken EA5E2. It requires the successor readiness model to fail closed at the narrowest true dependency.

The successor implementation must distinguish at least:

```text
CURRENT_SEASON_LIFECYCLE_TERMINATED
CURRENT_SEASON_LIFECYCLE_UNRESOLVED
REQUIRED_CROP_MODEL_PARAMETER_AUTHORITY_UNRESOLVED
```

When unresolved phenology is the reason the currently required crop-model parameter cannot be established, the result must carry the explicit diagnostic cause:

`REQUIRED_PHENOLOGY_STAGE_UNRESOLVED`

The legacy blocker:

`CURRENT_CROP_AUTHORITY_HAS_NO_FUTURE_LEGAL_TARGET`

must not remain the authoritative interpretation **solely because the historical six-model phenology consensus has no future common stage** after the Amendment-13 successor is implemented.

Until that successor implementation and its exact-head proof are merged, existing live dispatch remains blocked. A stale implementation-era blocker string has no authority to convert an unresolved stage into a lifecycle termination claim.

If a separately governed crop-model parameter authority can ever be established without a unique four-stage label, that possibility requires its own exact authority and proof. Amendment-13 does not authorize such a parameter shortcut.

## 9. Real historical season runtime-correctness qualification

A season that has genuinely terminated must not be pretended to be an online active crop merely to keep MCFT-CAP-09 testable.

Amendment-13 therefore permits a future, separately governed design review for the proof class:

`REAL_HISTORICAL_SEASON_RUNTIME_CORRECTNESS_QUALIFICATION`

Such a proof class may be useful for validating External Formal source binding, chronology, evidence-window construction, model execution, replay determinism, and other operational-correctness properties against a real completed season.

It may **not** by itself substitute for:

- current live Operational Activation;
- actual wall-clock provider-availability behavior where that behavior is the property under test;
- the Formal `O00–O23` live window required by the effective task/activation authority;
- live scheduler qualification;
- a current active-season claim.

This amendment authorizes only the design/audit route. It does not make historical-season qualification effective and does not change Formal completion criteria.

## 10. Fail-closed and chronology rules preserved

All existing External Formal temporal and source-safety rules remain unchanged, including:

- exact `interval_start/end` semantics;
- no event-time rewriting;
- real `available_to_runtime_at` chronology;
- real `ingested_at` chronology;
- no future leakage;
- no interpolation;
- no persistence fill;
- no source substitution;
- raw retention before canonicalization where required;
- no retroactive post-T acquisition for pre-boundary evidence;
- no cross-season canonical state/forecast/checkpoint lineage stitching without separate authority.

## 11. Write and activation boundary

Amendment-13 is authority-only. It authorizes no data-plane effect.

The following remain false after Amendment-13 alone:

- `current_season_active_established = false`;
- `current_season_terminated_established = false`;
- `current_phenology_stage_resolved = false`;
- `current_crop_model_parameter_resolved = false`;
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

Before exact-head proof and protected-main merge, this document is a candidate with no authority effect.

If the exact Amendment-13 governance proof passes and the candidate is merged to protected `main`, only the following becomes effective:

- the three-axis current-crop authority separation is authoritative;
- phenology non-consensus alone no longer invalidates the management-season lifecycle authority;
- current lifecycle, phenology, and crop-model-parameter statuses remain `UNRESOLVED` pending live requalification;
- `S6-CURRENT-CROP-AUTHORITY-REQUALIFICATION` is authorized as the next narrow current-crop successor;
- EA9B natural-season requalification remains legal in parallel when real provider evidence supports it;
- a future separately governed historical-real-season runtime-correctness design review is permitted;
- no Runtime behavior, model coefficient, persistence, operational activation, or Formal execution is authorized by this amendment alone.
