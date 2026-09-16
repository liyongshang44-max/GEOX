# GEOX B-09ae IRRIGATE STATE Calculation Shadow Binding Decision Package V1

## Status

Base:

`9c758d4951c5e54d5571b14f438dd7ddfd49b84d`

Decision:

`DEC-BLINE-IRRIGATE-STATE-CALCULATION-SHADOW-BINDING-001`

Status:

`RECOMMENDED_NOT_AUTHORIZED`

B-09ae proposes how the bounded IRRIGATE Candidate may acquire canonical
CalculationResult support for the STATE criterion without depending on MCFT.

It does not implement the binding.

## Core correction

Current B-09j Candidate has:

`calculation_result_refs = []`.

B-07c requires explicit canonical CalculationResult refs before it may map:

- WATER_DEFICIT → STATE=SATISFIED
- PASS → STATE=VIOLATED

The Agronomy Judge cannot automatically supply those refs because it reruns irrigation
skills later from a separate API request.

A later recomputation is not automatically the original Candidate basis.

## Same-source calculation basis

The formal product recommendation fact already persists:

`skill_trace.skill_id = irrigation_requirement_skill_v1`

and:

`skill_trace.outputs.requirement`

from the exact computation that produced the recommendation Candidate.

B-09ae therefore recommends using the same immutable
`decision_recommendation_v1` source fact already bound by B-09j.

The requirement output is projected through the existing B-06b:

`projectIrrigationRequirementCalculationResultV1`

adapter.

Legacy `skill_trace.evidence_refs` are not promoted. Canonical
EvidenceQualification refs must come from the exact B-09j/B-09h continuity set.

## Calculation identity

Recommended identity policy:

`SOURCE_FACT_SCOPE_CALCULATOR_SHA256_V1`

Material:

- policy version;
- tenant;
- project;
- group;
- immutable recommendation source fact_id;
- calculator_ref = irrigation_requirement_skill_v1.

Output:

`calculation_sfsha256_<64hex>`

Legacy recommendation_id is not CalculationResult identity authority.

## Time and Context

Until the separately gated B-09y/Context work is authorized:

- Candidate context_snapshot_ref remains null;
- Candidate decision_time remains null;
- projected CalculationResult context_snapshot_ref remains null;
- projected CalculationResult decision_time remains null.

For deterministic shadow projection only, the immutable recommendation source
`fact.occurred_at` may be used as CalculationResult `evaluated_at`.

This is persistence time only.

It is not promoted to canonical decision_time or original computation-time authority.

## Judge congruence

The existing B-07c producer should remain the criterion producer. B-09ae does not create
a third criterion producer.

However, before a CalculationResult ref is supplied to B-07c, the Agronomy Judge request
must be proven congruent with the persisted recommendation skill inputs.

Required exact fields:

- soil_moisture;
- target_soil_moisture;
- root_zone_depth_mm;
- rain_forecast_mm_72h;
- et0_mm_72h;
- crop_stage;
- application_efficiency.

Tenant/project/group/field/season/recommendation identity must also match.

Omitted values may not be silently defaulted to claim equivalence.

If the inputs differ, STATE is not bound.

## Expected deterministic result

A persisted IRRIGATE recommendation on this bounded path is emitted only when the
irrigation requirement skill reported requirement_detected=true.

Therefore, for an exact-congruent non-blocked Judge recomputation, the expected verdict is:

`WATER_DEFICIT`.

If the exact same normalized inputs produce PASS, that is a semantic mismatch and must
fail closed rather than emit STATE=VIOLATED against the original Candidate basis.

If Evidence Judge blocks the evaluation, B-07c may emit its existing
QUALIFIED_EVIDENCE=MISSING precursor, but STATE remains unbound.

## Why not use latest JudgeResult

There is no:

`latest JudgeResult -> Candidate STATE`

rule.

A later JudgeResult may reflect changed soil moisture, weather, crop stage or other
inputs. It is a re-evaluation, not proof of the original Candidate basis.

## B02 boundary

The B-06b CalculationResult adapter currently has:

`new_runtime_consumer_creation = FORBIDDEN`.

Therefore implementation requires explicit B02 topology registration.

A later implementation would need to register:

1. B-09j shadow as a consumer of B-06b CalculationResult projection;
2. persisted recommendation skill_trace → CalculationResult shadow;
3. CalculationResult ref → existing B-07c precursor.

B-07e remains disconnected.

## MCFT boundary

This STATE shadow design does not require MCFT.

It does not create or bind canonical Forecast.

Forecast remains a separate B-09w criterion frozen until MCFT-9 completion and separate
integration authorization.

## Authorization effect

Accepting B-09ae would authorize only the shadow binding design/implementation and its B02
edges.

It would not authorize:

- later/changed Judge output as Candidate basis;
- a third criterion producer;
- decision_time implementation;
- Context binding;
- real policy declaration;
- B-07e connection;
- MCFT integration;
- Approval/Execution changes;
- migration or authority removal.

## Non-effects

B-09ae changes no runtime, schema, DB, route, graph edge, CalculationResult instance,
Candidate binding, STATE criterion binding, B-07e connection, MCFT implementation or
historical authority.
