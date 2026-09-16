# GEOX DT-02 Architecture Amendment 03 — Biological Development Stage Authority

## 0. Authority

~~~text
phase: DT-02
amendment: DT02-AMENDMENT-03
name: Biological Development Stage Authority
type: architecture governance and semantic authority freeze
baseline: 35b06a92165acc5a6598ccfefc76e4467d93da04
status: CANDIDATE_NOT_EFFECTIVE
supersedes: NONE
extends: DT02-ADR-002, DT02-ADR-012
downstream_first_binding: MCFT-CAP-09 T4R1
~~~

This amendment freezes a reusable Biological Development Stage Authority contract for Replay, Shadow-online, Controlled Field, and future Production.

It creates no Runtime start authority, production owner, database write, Formal-v5 arm, A0, O00–O23 execution, canonical fact type, public write route, or MCFT-CAP-09 completion claim.

The contract becomes effective only after exact-head governance qualification and an explicitly governed merge/effectiveness step. Until then it is a candidate.

## 1. Problem

A field Twin must be able to reason about crop development even when a provider does not publish a contemporaneous phenology label at the exact runtime boundary.

The architecture already permits model-derived crop-water-use stage context, but the reusable authority semantics are not frozen at DT-02 level. Without a common contract, downstream slices can accidentally conflate direct observed phenology, thermal-time estimate, calendar-duration estimate, remote-sensing inference, management lifecycle, crop-water-use stage, and Kc selection.

The required architecture is:

~~~text
real observations + planting/crop identity + qualified model authorities
        ↓
bounded biological-development adjudication
        ↓
epistemically explicit BiologicalStageAuthority
        ↓
explicit mapping
        ↓
singleton CropWaterUseStage authority when provable
        ↓
immutable Runtime Config pin
~~~

No provider receives monopoly authority over all biological-stage facts. Every source class must be separately qualified for the exact semantic role it supplies.

## 2. Stage authority is not lifecycle authority

Two independent questions remain independent:

~~~text
A. What developmental/biological stage is the crop in?
B. Is the governed crop/season lifecycle still active and unharvested?
~~~

Thermal accumulation, calendar age, remote sensing, or a phenology model may answer A within a bounded uncertainty contract.

They must not by themselves answer B.

A harvested or terminated crop cannot remain operationally active merely because accumulated GDD maps to a biological stage. Harvest/termination/lifecycle authority requires its own qualified evidence and policy.

## 3. Epistemic classes

Every Biological Development Stage Authority result declares exactly one epistemic class:

~~~text
DIRECT_OBSERVED_PHENOLOGY
THERMAL_MODEL_DERIVED
CALENDAR_MODEL_DERIVED
REMOTE_SENSING_DERIVED
FUSED_DERIVED
UNRESOLVED
~~~

The class is semantic authority, not display metadata.

### 3.1 DIRECT_OBSERVED_PHENOLOGY

May be established only by a source separately qualified for direct crop-stage observation at the governed field/season/zone and observation time.

Possible source classes include qualified field scouting, qualified research-station phenology observation, qualified phenocam/canopy observation with explicit stage mapping, or another separately qualified direct observation.

No source is direct merely because it is first-party, nearby, current, or agronomically plausible.

### 3.2 THERMAL_MODEL_DERIVED

May consume:

~~~text
planting/emergence authority
crop and cultivar/hybrid identity
qualified observed temperature series
frozen thermal accumulation method
qualified cultivar/crop thermal landmarks or bounded thresholds
explicit uncertainty policy
~~~

A thermal result is a model-derived biological-development estimate. It is never relabelled as a direct field observation.

### 3.3 CALENDAR_MODEL_DERIVED

May consume frozen crop-stage duration models and exact planting-time uncertainty.

Calendar age alone is not observed phenology. It remains model-derived.

### 3.4 REMOTE_SENSING_DERIVED

Requires a separately qualified source, spatial relationship, observation chronology, feature semantics, and feature-to-stage mapping.

Greenness alone must not silently become phenology, lifecycle, or Kc authority.

### 3.5 FUSED_DERIVED

May combine independently qualified stage evidence only under a frozen fusion policy.

Fusion may narrow an uncertainty set. It must not use ungoverned majority voting, confidence averaging, or source precedence to erase a real disagreement.

### 3.6 UNRESOLVED

Any unresolved mapping, source conflict, temporal gap, scope mismatch, or non-singleton stage set remains fail-closed.

## 4. BiologicalStageAuthorityV1 contract

The architecture freezes the following semantic packet. It is an immutable authority input and does not by itself create a new canonical fact type.

~~~yaml
BiologicalStageAuthorityV1:
  authority_id: deterministic
  authority_version: required
  scope:
    tenant_id: required
    project_id: required
    group_id: required
    field_id: required
    season_id: required
    zone_id: required
  crop_code: required
  cultivar_or_hybrid_id: string | null
  as_of_logical_time: required canonical UTC instant
  valid_from: canonical UTC instant
  valid_until: canonical UTC instant
  epistemic_class:
    DIRECT_OBSERVED_PHENOLOGY |
    THERMAL_MODEL_DERIVED |
    CALENDAR_MODEL_DERIVED |
    REMOTE_SENSING_DERIVED |
    FUSED_DERIVED |
    UNRESOLVED
  biological_stage_system: required
  candidate_biological_stages: non-empty ordered set
  resolved_biological_stage: string | null
  observed_biological_stage_claimed: boolean
  evidence_refs: exact ordered refs
  evidence_hashes: exact ordered hashes
  method_ref: required
  method_hash: required
  uncertainty_contract_ref: required
  uncertainty_contract_hash: required
  limitation_codes: ordered set
  determinism_hash: required
~~~

Rules:

~~~text
candidate set size = 1
  may resolve one biological-stage estimate if all source/mapping/temporal rules pass

candidate set size > 1
  resolved_biological_stage = null

epistemic_class = DIRECT_OBSERVED_PHENOLOGY
  observed_biological_stage_claimed may be true only if direct-observation qualification passes

all derived classes
  observed_biological_stage_claimed = false

epistemic_class = UNRESOLVED
  resolved_biological_stage = null
~~~

An arbitrary floating confidence score is not authority. Numeric confidence is forbidden unless a separately calibrated and governed confidence model exists.

## 5. Thermal-time contract

A thermal authority must pin all of:

~~~text
temperature source identity and spatial class
temperature observation time semantics
daily-extrema or other thermal input semantics
temperature units
base temperature
upper/lower caps or floors
accumulation formula
planting/emergence time uncertainty
missing-day bounds
duplicate/conflicting observation policy
cultivar/crop thermal landmark source
landmark uncertainty
future-observation prohibition
as-of availability chronology
~~~

For corn Base-50 GDD/GDU, a downstream binding may adopt the existing proven pattern:

~~~text
Tmax capped at 86°F
Tmin floored at 50°F
daily GDU =
  max(0, ((min(Tmax,86) + max(Tmin,50))/2) - 50)
~~~

but the method must still be explicitly bound and hashed by the downstream authority.

Forbidden shortcuts:

~~~text
relative-maturity days -> GDU conversion without an explicit qualified mapping
sibling/related hybrid threshold transfer
dealer or generic threshold silently promoted to exact-hybrid truth
hourly mean relabelled as daily extrema
missing temperature silently imputed
future weather used as observed thermal accumulation
linear interpolation from planting to black layer treated as phenology truth
~~~

## 6. Temporal and availability rules

Observation occurrence time and Runtime availability time remain distinct.

A stage authority at logical time T may consume only evidence that was available under its declared source chronology at or before T.

Future observations and full-season ex-post normalization are forbidden for real-time authority.

Every authority has a finite validity interval. A stage result must be re-adjudicated when the validity interval expires, new material stage evidence becomes available, a lifecycle termination/harvest event appears, a model/config/source authority changes, or the Runtime requests a logical time outside the frozen interval.

## 7. Conservative uncertainty collapse

Derived stage authority is established only when all permitted uncertainty collapses to one stage under the frozen policy.

~~~text
all permitted source/planting/model/threshold bounds
evaluated over the required temporal guard
        ↓
candidate stage set
        ↓
exactly one stage
  => resolved derived stage

more than one stage
  => UNRESOLVED
~~~

A most-likely stage is not sufficient for production authority unless a future separately governed probabilistic-stage policy explicitly authorizes it.

## 8. Biological stage and crop-water-use stage remain separate

The architecture freezes two semantic outputs:

~~~text
Biological Development Stage
        ↓ explicit governed mapping
Crop Water-Use Stage
        ↓ exact configuration lookup
Kc
~~~

The mapping may be partial.

For example, a biological R1/R6 thermal landmark may narrow the water-use stage set without defining every boundary. A downstream authority must preserve ambiguity when biological evidence cannot distinguish MID from LATE.

A singleton biological stage does not automatically imply a singleton water-use stage unless the mapping contract says so.

A singleton water-use stage is required before stage-specific Kc may be selected.

## 9. Runtime integration

The Stage Authority Resolver belongs upstream of immutable Runtime Config construction.

~~~text
qualified Evidence adapters
        ↓
Stage Authority Resolver
        ↓
BiologicalStageAuthorityV1
        ↓
Water-Use Stage Mapper
        ↓
singleton stage or FAIL-CLOSED
        ↓
Runtime Config compiler
        ↓
exact stage-authority determinism hash pinned
~~~

Replay, Shadow-online, Controlled Field, and Production must use the same semantic resolver and mapping contracts. Only evidence ingress/availability adapters may vary.

For each Formal logical hour, the Runtime Config chain must pin the exact stage authority applicable at that hour. A prior stage may not be carried beyond its validity interval merely to preserve a 24-hour run.

## 10. Source plurality without source substitution

KBS, or any other provider, is not a universal truth monopoly.

A provider can be authoritative only for the exact facts and semantic roles its source qualification establishes.

Different qualified sources may supply different axes:

~~~text
planting / harvest / management event     -> management-event authority
station temperature                       -> thermal-input authority
cultivar specification                    -> thermal-landmark authority
field scouting                            -> direct phenology authority
remote sensing                            -> separately mapped canopy/phenology evidence
calendar/FAO model                        -> model-stage prior
~~~

Sharing crop, hybrid, site, provider, or geography does not authorize cross-scope substitution.

## 11. Conflict policy

When direct observation and a derived model disagree:

~~~text
do not rewrite either source
do not silently pick the model
do not silently pick the observation
do not average stage codes
~~~

The result is governed by an explicit adjudication policy. In the absence of such a policy, the operational stage becomes UNRESOLVED and the disagreement is retained as evidence for model/source review.

## 12. MCFT-CAP-09 first binding

The first downstream binding is authorized to evaluate T4R1 / season_2026_corn / hybrid 43-96P using the new contract.

That binding may reuse historical CAP-09 thermal qualification patterns, but it must independently pin:

~~~text
T4R1 planting authority
43-96P product identity
43-96P thermal-landmark source authority
T4R1-appropriate observed temperature source
Base-50 method
missing-data bounds
harvest/termination guard
thermal-landmark -> biological-stage mapping
biological-stage -> crop-water-use-stage mapping
validity interval
~~~

It must not reuse P0306Q numeric thresholds or T1R1 stage results.

## 13. Nonclaims

This amendment does not claim T4R1 stage resolved, 43-96P thermal threshold qualified, current T4R1 lifecycle active, Kc resolved, runtime-start eligible, production owner active, Formal-v5 armed, A0 authorized, O00–O23 authorized, observed biological stage established, or MCFT-CAP-09 complete.

## 14. Exact candidate changed-file boundary

This architecture candidate is limited to:

~~~text
docs/digital_twin/GEOX-DT-02-ARCHITECTURE-AMENDMENT-03-BIOLOGICAL-STAGE-AUTHORITY.md
docs/digital_twin/GEOX-DT-02-ARCHITECTURE-DECISION-REGISTER.json
scripts/governance_acceptance/ACCEPTANCE_DT_02_ARCHITECTURE_AMENDMENT_03.cjs
.github/workflows/dt-02-architecture-amendment-03-biological-stage-authority.yml
~~~

Forbidden in this candidate: apps/server/**, apps/web/**, database migration, Runtime mutation, provider write, scheduler mutation, production owner activation, Formal execution, A0/O00 execution, handoff mutation, and B-Line mutation.

## 15. Candidate claim

Before a separate effectiveness step, the maximum claim is:

~~~text
DT02_BIOLOGICAL_STAGE_AUTHORITY_CONTRACT_CANDIDATE_QUALIFIED
NO_RUNTIME_IMPLEMENTATION
NO_PRODUCTION_ACTIVATION
~~~
