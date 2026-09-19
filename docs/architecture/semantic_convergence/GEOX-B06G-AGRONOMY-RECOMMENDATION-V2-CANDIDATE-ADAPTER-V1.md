# GEOX B-06g AgronomyRecommendationV2 → CandidateDecision Compatibility Adapter V1

## 0. Status

B-Line bounded B-06 candidate-producer coverage phase stacked exactly on completed B-06f product head:

`31f23e507b7310456b619dc9f86b8371edcc26ed`

This phase adds a pure compatibility adapter for the legacy rule-engine output:

`AgronomyRecommendationV2`.

No rule-engine caller or runtime consumer is rewired.

## 1. Why B-06g exists

The B-06 completion audit found that the legacy Operator scenario writer emits `decision_recommendation_v1` and is already covered by B-06c.

The remaining registered decision-candidate producer not covered by a canonical adapter is:

`apps/server/src/domain/agronomy/rule_engine.ts`

which returns:

`AgronomyRecommendationV2`.

B-06c cannot accept this object because it is explicitly scoped to `recommendation_v1 / decision_recommendation_v1`.

## 2. Candidate boundary

B-06g projects valid rule-engine output into:

`CandidateDecisionV1`

with:

`source_class = LEGACY_RECOMMENDATION`

and:

`authority_state = CANDIDATE_ONLY`.

It creates no:

- Decision Eligibility;
- approval;
- operation plan;
- task;
- execution authority.

## 3. Runtime action allowlist

The TypeScript contract declares:

- IRRIGATE;
- FERTILIZE;
- INSPECT;
- WAIT.

The rule engine currently casts a generic skill-returned string into that type, so compile-time typing alone is insufficient.

B-06g performs a runtime allowlist check.

Unexpected values including SPRAY, EXECUTE or OTHER fail closed.

## 4. Crop and stage boundary

The legacy rule engine contains historical stage-normalization/default behavior.

Therefore:

- `source.crop_stage` is never canonical CropStage authority;
- `source.crop_code` is never canonical declared Context authority.

Canonical ContextSnapshot and crop-stage-state refs remain explicit adapter inputs.

The source recommendation does not embed canonical field scope, so canonical field scope is also explicit adapter input.

No scope is inferred from crop/stage labels.

## 5. Evidence boundary

Legacy rule-engine evidence surfaces include:

- `evidence_basis.snapshot_id`;
- `evidence_basis.telemetry_refs`;
- `skill_trace.evidence_refs`.

They remain legacy provenance only.

They are never promoted into:

`evidence_qualification_refs`.

The legacy snapshot id is not promoted into:

`context_snapshot_ref`.

Canonical EvidenceQualification and ContextSnapshot refs must be supplied explicitly.

## 6. Calculation boundary

`expected_effect` is recommendation-shaped expected outcome metadata.

B-06g does not convert it into a canonical CalculationResult.

Canonical `calculation_result_refs` remain explicit adapter inputs.

The output `parameters_hint` remains empty.

## 7. Confidence / reasons boundary

Candidate confidence may use the source recommendation's scalar confidence only when finite and inside `[0,1]`.

Invalid confidence becomes null plus an explicit limitation.

SkillTrace confidence does not override candidate confidence.

The contract-defined `reasons` field is authoritative for compatibility projection.

The runtime-only `reason_codes` extension does not replace it.

## 8. Downstream contamination

If an extended runtime object already carries approval/plan/task/dispatch/receipt authority fields or flags, B-06g fails closed instead of collapsing the object back into CandidateDecision.

## 9. No runtime wiring

The adapter is registered as:

`REGISTERED_CAPABILITY_ISLAND / MANUAL / INTENTIONAL_NONE`.

It does not modify:

- rule_engine;
- Agronomy Agent;
- decision engine;
- Operator legacy routes;
- approval/plan/task paths;
- MCFT implementation.

Historical producer authority remains unchanged until B-09.

## 10. Machine governance

`G-B02-15-candidate-decision-instantiation` expands to exactly five registered CandidateDecision adapter paths:

1. B-06c legacy recommendation;
2. B-06d decision plan;
3. B-06e prescription action spec;
4. B-06f operation-plan candidate view;
5. B-06g AgronomyRecommendationV2.

Any sixth CandidateDecision producer remains forbidden until explicitly registered.

CalculationResult governance remains unchanged.

## 11. B-06 coverage implication

After B-06g, every currently registered `decision.candidate` producer family has an explicit compatibility path into the common CandidateDecision lattice:

- Agronomy Agent recommendation -> B-06c;
- decision-engine recommendation -> B-06c;
- legacy Operator scenario recommendation -> B-06c;
- rule-engine AgronomyRecommendationV2 -> B-06g;
- decision_plan_v0 -> B-06d;
- prescription action spec -> B-06e;
- grandfathered Agronomy Agent direct operation plan -> B-06f candidate view after authority classification.

This does not remove any historical authority. B-09 remains the only removal phase.

## 12. Completion gate

B-06g is complete only when one exact product head proves:

- valid AgronomyRecommendationV2 -> CANDIDATE_ONLY PASS;
- runtime action allowlist exact PASS;
- crop/stage labels do not gain canonical authority PASS;
- snapshot/telemetry refs remain legacy provenance PASS;
- SkillTrace evidence/confidence do not gain canonical authority PASS;
- expected_effect is not promoted to CalculationResult PASS;
- invalid confidence is not promoted PASS;
- required source fields fail closed PASS;
- downstream contamination fails closed PASS;
- canonical field scope remains explicit PASS;
- contract reasons win over runtime reason_codes extension PASS;
- exact CandidateDecision producer set = five registered adapters PASS;
- sixth unregistered CandidateDecision producer rejected PASS;
- B-06g has no production runtime consumer PASS;
- rule_engine and its runtime callers remain untouched PASS;
- B-06f/B-06e/B-06d/B-06c/B-06b/B-06a/B-05/B-03/B-04 regressions PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.

Only after those gates may the overall bounded B-06 candidate-producer convergence be adjudicated for closure.
