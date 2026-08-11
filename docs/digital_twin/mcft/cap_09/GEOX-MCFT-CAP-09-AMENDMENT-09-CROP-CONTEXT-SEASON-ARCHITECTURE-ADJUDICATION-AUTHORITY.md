# GEOX MCFT-CAP-09 Amendment-09 — Crop-Context / Season Architecture Adjudication Authority

Status: **Candidate amendment; not effective until exact-head governance proof passes and this candidate merges to protected `main`.**

Capability line: `MCFT-CAP-09`

Slice: `MCFT-CAP-09.S6`

Frontier correction: `S6-CROP-CONTEXT-SEASON-ARCHITECTURE-ADJUDICATION-UNDER-AMENDMENT-08`

Base protected main at candidate start: `f753f2bdaa68f64de623dd1b0a0e7da65d0f1eef`

## 1. Purpose

This amendment adjudicates the crop-context / season authority gap exposed by the effective successor whole-window viability proof.

The protected-main scanner has already proved, under the current frozen EA2 crop-context authority, that:

```text
latest complete current-season O00 = 2026-08-11T22:00:00.000Z
latest complete current-season O23 = 2026-08-12T21:00:00.000Z
latest possible 36h-lead selection effectiveness = 2026-08-10T10:00:00.000Z
Amendment-08 effectiveness = 2026-08-11T02:33:13.000Z
result = NO_CURRENT_SEASON_SUCCESSOR_EPOCH
```

That result is authoritative for the **current EA2 planting-date + six-FAO-variant consensus authority**. It does not authorize extending `MID`, inventing `LATE`, using future observations, rescuing an expired epoch, or silently changing season identity.

Amendment-01, however, already permits a strictly as-of crop-context derivation to consume contemporaneous phenology evidence when such evidence is independently qualified. The current protected-main EA1J/EA2 authority has not established an observed biological stage or field phenology observation; it deliberately uses planting-date uncertainty plus all six FAO-56 maize-grain stage-length variants as a conservative model prior.

The architecture therefore needs one explicit fail-closed decision tree before any new crop/season authority can exist.

## 2. Authority precedence and narrow scope

When effective, Amendment-09 supersedes only the missing post-`NO_CURRENT_SEASON_SUCCESSOR_EPOCH` architecture decision.

It does **not** supersede or weaken:

- the effective MCFT-CAP-09 Taskbook;
- Amendment-01 External Public Evidence Authority;
- Amendment-05 External Formal Runtime Authority Profile;
- Amendment-06 actual-UTC epoch rebase, 36-hour minimum lead, immutable-history and `O00-12h` readiness rules;
- Amendment-07 fixed-lag External Formal causality;
- Amendment-08 Implementation / Operational Activation Qualification separation and successor ordering;
- the effective EA2 six-key Formal scope and planting authority;
- the existing EA2 prohibition on future observations, full-season ex-post normalization, false planting-time precision, single-FAO-region best-fit substitution, and CAP08 synthetic stage dates;
- KBS Raw Hourly maximum age `<=6h`;
- exact five-family source bindings;
- append-only Formal persistence;
- Recommendation / Approval / AO-ACT / Dispatch boundaries.

This amendment creates no new canonical object family, performs no provider GET, and authorizes no database, raw-object, scheduler, Runtime Config or canonical Runtime write.

## 3. Frozen current protected-main facts

The current Formal Crop Context Authority remains:

```text
site_id   = KBS_MCSE_T1R1
field_id  = field_kbs_mcse_t1r1
season_id = season_2026_corn
crop      = corn
planting possible UTC window = [2026-05-11T04:00:00Z, 2026-05-12T04:00:00Z)
```

Its epistemic status remains:

```text
crop identity = CURRENT_SEASON_MANAGEMENT_METADATA
observed biological stage claimed = false
field phenology observation claimed = false
V/R stage truth claimed = false
```

Its stage prior remains all six published FAO-56 maize-grain stage-length variants carried together, not one selected regional row.

The EA1J GDD policy also remains:

```text
stage_determinative = false
HYBRID_SPECIFIC_GDD_TO_STAGE_THRESHOLDS_NOT_YET_BOUND_FOR_KBS_T1
silent hybrid / relative-maturity assumption = forbidden
```

Therefore none of the following is current stage authority by itself:

- elapsed calendar days since planting;
- one FAO variant selected after the fact;
- management-operation dates;
- a generic maize relative-maturity number;
- an unbound hybrid assumption;
- near-site phenology with no governed spatial relationship;
- a future observation later than the authority time.

## 4. Core ruling — two legal branches only

After Amendment-09 becomes effective, the crop-context / season recovery lifecycle has exactly two legal branches.

### Branch A — current-season contemporaneous phenology reproof

A new current-season crop-context authority MAY be separately qualified for the existing `season_2026_corn` only if exact-head proof establishes a contemporaneous, as-of phenology evidence package and a deterministic conservative mapping into the existing model stage codes:

```text
INITIAL
DEVELOPMENT
MID
LATE
```

This amendment does not itself establish such a stage.

The successor lifecycle is:

```text
S6-EA9A-CURRENT-SEASON-CONTEMPORANEOUS-PHENOLOGY-QUALIFICATION
```

Allowed EA9A terminal results are only:

```text
CURRENT_SEASON_CONTEMPORANEOUS_STAGE_AUTHORITY_ESTABLISHED
CURRENT_SEASON_PHENOLOGY_AUTHORITY_NOT_ESTABLISHED
```

A PASS result must create a separately versioned supporting authority; it may not mutate the existing EA2 authority in place.

### Branch B — new natural-season authority adjudication

If EA9A returns `CURRENT_SEASON_PHENOLOGY_AUTHORITY_NOT_ESTABLISHED`, or if a qualified current-season stage cannot support a future conservative 24-slot window, the current `season_2026_corn` lifecycle remains fail-closed.

The only next crop/season architecture branch is:

```text
S6-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION
```

A future natural season requires a new season identity and fresh external crop/planting/crop-context authority. Amendment-09 does **not** create that season, choose its crop, or authorize its bootstrap.

There is no third branch that prolongs the current model stage or re-labels the existing season merely to preserve a Formal window.

## 5. EA9A contemporaneous phenology evidence requirements

EA9A may become effective only when all stage-determinative evidence is auditable and available as-of the authority time.

At minimum the package must prove:

1. exact provider/source identity and stable retrieval path;
2. explicit temporal identity for every consumed observation;
3. `available_to_runtime_at <= authority_time` for every stage-determinative observation;
4. raw payload/object retention or an immutable auditable provider-object digest before normalization when Amendment-01 requires retention;
5. governed spatial relationship to `KBS_MCSE_T1R1` / `field_kbs_mcse_t1r1`;
6. exact crop/season relationship to `season_2026_corn`;
7. deterministic adapter/algorithm identity and version;
8. deterministic mapping from source evidence to one or more candidate model stages;
9. uncertainty envelope for source, spatial support, timing and mapping;
10. explicit limitations and epistemic class;
11. no future-observation use;
12. no full-season ex-post normalization;
13. no hidden single-hybrid, single-FAO-variant or relative-maturity assumption;
14. reproducible exact-head proof.

A source identity alone is insufficient. A camera name, station name, image stream, management log, GDD series, or crop label does not become stage authority until its spatial and semantic mapping is separately qualified.

## 6. Allowed evidence roles

Amendment-01 remains controlling for the kinds of contemporaneous information that may participate in an as-of crop-context derivation.

### 6.1 Direct provider phenology observation

A provider observation that explicitly records crop phenology may be stage-determinative only when its field/plot relationship, observation time, vocabulary, provenance and mapping to the four GEOX model water-use stages are frozen.

The source's own biological vocabulary must be preserved. Mapping it to `INITIAL / DEVELOPMENT / MID / LATE` does not silently upgrade GEOX to V-stage/R-stage ground truth.

### 6.2 PhenoCam / image-derived phenology

PhenoCam or another image source may be stage-determinative only after a separate qualification freezes:

- exact camera/site identity;
- governed relationship to the Formal field/zone;
- ROI identity;
- source object/image timestamps;
- raw/object digests;
- image/GCC or other feature extraction algorithm;
- mapping algorithm from the extracted signal to the four model stages;
- uncertainty and confidence rules;
- as-of operation with no future-image normalization.

A full-season GCC curve normalized after the season is not authorized for Formal as-of stage proof.

### 6.3 GDD

GDD remains corroborative under the current EA1J authority and is **not stage-determinative by default**.

To make GDD stage-determinative would require a separate authority proving at minimum the exact 2026 T1 crop material/hybrid identity, the applicable thermal-time method and base/cutoff temperatures, stage thresholds, uncertainty, and exact source meteorology. Amendment-09 does not grant that authority.

### 6.4 Current-season management metadata

Planting and other management records may continue to establish crop identity and temporal constraints. They are not biological-stage observations unless the provider explicitly records phenology and that semantics is separately qualified.

## 7. Conservative mapping and transition-guard rule

A new current-season authority may not simply replace the old six-FAO envelope with one point estimate.

EA9A must produce a conservative stage set from all admissible as-of evidence and uncertainty. To become one model-stage authority for a target logical time `T`, the proof must establish one identical model stage across the complete uncertainty envelope throughout:

```text
T - 6h ... T + 30h
```

The 30-hour forward guard remains an `ASSUMED_STAGE_TRANSITION_GUARD`; it may use only information available at the authority time. Future observations are forbidden.

If the evidence cannot conservatively exclude a stage transition in that interval, the result is fail-closed:

```text
STAGE_TRANSITION_RISK
```

If admissible evidence maps to more than one model stage, the result is fail-closed:

```text
CROP_WATER_USE_STAGE_NO_CONSERVATIVE_CONSENSUS
```

The proof must expose the uncertainty components that control the decision rather than hide them behind a single confidence score.

## 8. Relationship to the existing EA2 authority

The current EA2 authority remains immutable historical authority.

A successful EA9A authority is additive and shall identify:

- the existing EA2 authority ref/hash it supersedes **for future startup derivation only**;
- the exact authority time;
- exact source refs/hashes;
- exact mapping algorithm/version;
- the conservative model stage and uncertainty envelope;
- the 6-hour backward stability proof;
- the 30-hour forward transition-guard proof;
- the first logical time at which the new authority may be consumed.

It must not rewrite the previous `MID` result, old Runtime Config crop-context hashes, old A06A epoch, or any historical fact.

A successful current-season reproof also does not automatically prove that a full future O00–O23 window exists.

## 9. Mandatory post-reproof whole-window scan

Even after `CURRENT_SEASON_CONTEMPORANEOUS_STAGE_AUTHORITY_ESTABLISHED`, no successor epoch may be selected directly.

After both:

```text
EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = true
and
new crop-context authority = effective
```

a separately exact-qualified whole-window scanner must evaluate every candidate O00–O23 under the new authority.

It must preserve:

- exact 24 hourly slots;
- Amendment-06 36-hour minimum selection lead;
- `O00-12h` EA5E3 readiness deadline;
- exact actual-UTC clock;
- per-slot `T-6h ... T+30h` conservative guard;
- no future observations;
- no epoch selection before scan PASS.

Allowed outcomes are:

```text
CURRENT_SEASON_SUCCESSOR_WINDOW_AVAILABLE
NO_CURRENT_SEASON_SUCCESSOR_EPOCH
```

If the second result persists, Branch B is required. The stage authority is not stretched again.

## 10. New natural-season branch semantics

EA9B is an architecture adjudication, not an automatic rollover.

A new natural season must establish at minimum:

- a new immutable `season_id`;
- authoritative current-season crop identity;
- authoritative planting/emergence timing at the precision actually provided;
- a fresh crop-context authority under Amendment-01 semantics;
- source and spatial bindings appropriate to that season;
- a decision on whether the existing physical field/zone identity remains valid;
- a fresh canonical bootstrap authority for the new six-key scope if the season key changes;
- explicit prohibition on cross-season State/Forecast/Checkpoint/lineage stitching;
- append-only retention of all `season_2026_corn` history.

The old 2026 A0, Runtime Config chains, manifests and scheduler history may remain audit history but are not new-season canonical parent authority unless a later explicit amendment proves a cross-season bootstrap rule. Amendment-09 creates no such rule.

## 11. Operational Activation remains independent and mandatory

Amendment-09 does not alter Amendment-08.

Current state remains:

```text
EA5E2_IMPLEMENTATION_QUALIFIED = true
EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false
EA5E3 = false
Formal execution = 0/24
```

Current-season phenology qualification work may proceed as preparatory governance/qualification work while provider activation is independently fail-closed.

However, no successor whole-window scan used for epoch selection may become selection authority until Operational Activation is effective, and no successor epoch may be frozen before both activation and the applicable crop-context authority are effective.

## 12. Explicitly forbidden rescue paths

The following remain forbidden:

- extending `MID` because the old window expired;
- declaring `LATE` from elapsed calendar time alone;
- choosing one FAO row because it creates a convenient window;
- treating management operations as biological-stage truth;
- assuming a hybrid or relative maturity not proved for the exact 2026 T1 season;
- making GDD stage-determinative without separate exact authority;
- future PhenoCam/image observations;
- full-season ex-post PhenoCam/GCC normalization;
- future observation rewrite;
- provider timestamp relabeling;
- backdating stage authority or epoch-selection effectiveness;
- old A06A epoch rescue, shifting or initial catch-up;
- shortened Formal duration;
- fabricated new season identity;
- cross-season canonical stitching;
- source substitution;
- accelerated Formal clock.

## 13. Effect if exact-head proof passes and this amendment merges

Only after exact-head governance proof passes and this candidate merges to protected `main`:

```text
amendment_09_effective = true
crop_context_season_architecture_adjudicated = true
current_season_stage_extended = false
current_season_late_stage_created = false
current_season_phenology_reproof_authorized = true
current_season_phenology_reproof_effective = false
new_natural_season_created = false
successor_epoch_selected = false
runtime_config_persistence_authorized = false
formal_database_write_authorized = false
formal_raw_object_write_authorized = false
scheduler_write_authorized = false
canonical_runtime_write_authorized = false
EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false
EA5E3 = false
Formal execution = 0/24
MCFT-CAP-09 completed = false
```

Next legal primary successor:

```text
S6-EA9A-CURRENT-SEASON-CONTEMPORANEOUS-PHENOLOGY-QUALIFICATION
```

Parallel operational successor remains:

```text
S6-EA5E2-OPERATIONAL-ACTIVATION-QUALIFICATION-UNDER-AMENDMENT-08
```

If EA9A cannot establish a conservative current-season authority, the next architecture successor is:

```text
S6-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION
```

No stage, season, epoch or Formal execution authority is created by Amendment-09 itself.
