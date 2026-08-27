# GEOX B-06d Rule Engine → CandidateDecision Compatibility Adapter V1

## 0. Status

B-Line bounded B-06 candidate-adapter phase stacked exactly on completed B-06c product head:

`cae164a925c02a5a1d675648eb784085a4b28c11`

This phase creates a pure compatibility capability only.

It does not invoke, modify, rewire or replace the Rule Engine.

## 1. Scope

B-06d covers the direct Rule Engine output:

`AgronomyRecommendationV2`

from:

`apps/server/src/domain/agronomy/rule_engine.ts`.

This object is not the same runtime shape as persisted `recommendation_v1` / `decision_recommendation_v1`, so it receives a separate bounded adapter.

The projection output is:

`CandidateDecisionV1`

with:

`source_class = LEGACY_RECOMMENDATION`

and:

`authority_state = CANDIDATE_ONLY`.

## 2. What is promoted

Only the legacy question:

`what action should be considered?`

is projected.

The Rule Engine action type is retained only when it is one of the contract-defined recommendation actions:

- `IRRIGATE`;
- `FERTILIZE`;
- `INSPECT`;
- `WAIT`.

Confidence and reasons may be carried as candidate metadata.

## 3. What is deliberately not promoted

B-06d does not reinterpret the following as canonical authority:

- legacy `crop_code` -> ContextSnapshot;
- legacy `crop_stage` -> QualifiedCropStageState;
- legacy telemetry refs -> EvidenceQualification refs;
- legacy expected effect -> action parameters;
- legacy skill trace -> canonical interpretation/calculation basis;
- legacy snapshot id -> canonical ContextSnapshot ref.

Those canonical refs must be supplied explicitly by the adapter caller.

## 4. Empty parameter hint is intentional

`AgronomyRecommendationV2` carries an action type and expected effects, but no canonical action-parameter contract.

B-06d therefore emits:

`parameters_hint = {}`

instead of manufacturing an amount, timing window, device requirement or execution setting.

This prevents recommendation semantics from becoming an execution specification.

## 5. Fail-closed rules

The adapter fails closed when:

- recommendation id is missing;
- crop code is missing;
- crop stage is missing;
- rule id is missing;
- action type is outside the frozen AgronomyRecommendationV2 action set;
- confidence is not finite or is outside `[0,1]`;
- canonical field scope is absent;
- canonical timestamps fail CandidateDecision contract validation.

## 6. No runtime wiring

The adapter is registered as:

`REGISTERED_CAPABILITY_ISLAND / MANUAL / INTENTIONAL_NONE`.

It has no route, job, Rule Engine call-site, approval, prescription, plan, task or execution consumer.

B-06d does not modify:

- `rule_engine.ts`;
- Agronomy Agent;
- Decision Engine;
- persisted recommendation writers;
- Operator Twin scenario writers;
- prescription;
- approval;
- operation plan;
- Decision Eligibility;
- AO-ACT/task/dispatch/execution;
- MCFT provider/scheduler/Formal/Twin persistence/schema/binding.

## 7. Machine governance

`G-B02-15-candidate-decision-instantiation` permits exactly two B-06 adapter paths after B-06d:

- B-06c legacy recommendation fact adapter;
- B-06d Rule Engine recommendation adapter.

Any third CandidateDecision producer remains forbidden unless explicitly registered in a later bounded B-06 phase.

CalculationResult governance remains unchanged from B-06b.

## 8. Historical authority

The existing `rule-engine-recommendation` producer remains visible as a grandfathered duplicate with:

`removal_target = B-09`.

B-06d does not remove, disable or redirect it.

Actual historical authority removal remains B-09 only.

## 9. Completion gate

B-06d is complete only when one exact product head proves:

- AgronomyRecommendationV2 -> CandidateDecisionV1 PASS;
- candidate authority remains CANDIDATE_ONLY PASS;
- action type restricted to the legacy contract set PASS;
- legacy telemetry refs are not promoted to EvidenceQualification refs PASS;
- expected effects are not promoted to action parameters PASS;
- legacy crop code/stage do not become canonical Context/Stage authority PASS;
- invalid confidence fails closed PASS;
- missing canonical field scope fails closed PASS;
- canonical provenance refs remain caller-explicit PASS;
- legacy skill trace is not promoted implicitly PASS;
- exact CandidateDecision producer set = B-06c + B-06d adapters only PASS;
- exact CalculationResult producer set remains B-06b adapter only PASS;
- adapter has no production runtime consumer PASS;
- B-06c/B-06b/B-06a/B-05/B-03/B-04 regression boundaries PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.
