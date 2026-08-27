# GEOX B-06c Legacy Recommendation → CandidateDecision Compatibility Adapter V1

## 0. Status

B-Line bounded B-06 candidate-adapter phase stacked exactly on completed B-06b product head:

`26541ca05a3ba4b3b463fa6e940912d2b76f2cba`

This phase creates a pure compatibility capability only.

It does not rewire current recommendation producers or consumers.

## 1. Scope

B-06c covers the historical recommendation fact families:

- `recommendation_v1`;
- `decision_recommendation_v1`.

They may be projected into:

`CandidateDecisionV1`

only as:

`source_class = LEGACY_RECOMMENDATION`

and:

`authority_state = CANDIDATE_ONLY`.

## 2. Canonical action source

The adapter requires the legacy top-level `action_type`.

It does not substitute `suggested_action.action_type` as canonical action type.

This matters because current legacy producers can carry a high-level action such as:

`IRRIGATE`

while the nested suggested action may carry a more operational compatibility value such as:

`irrigation.start`.

B-06c preserves the high-level candidate semantic and refuses to use a nested operational action label to expand authority.

## 3. Evidence boundary

Legacy recommendation `evidence_refs` are not equivalent to canonical `EvidenceQualificationV1` references.

The adapter never promotes them.

Canonical `evidence_qualification_refs` must be supplied explicitly.

If legacy evidence refs exist, the projection records:

`LEGACY_EVIDENCE_REFS_NOT_PROMOTED_TO_CANONICAL_QUALIFICATION`.

## 4. Context / Calculation boundary

The adapter does not derive or default:

- ContextSnapshot authority;
- Crop Stage authority;
- CalculationResult authority.

Those refs must be supplied explicitly if available.

This keeps B-06c downstream of B-03/B-05/B-06b rather than creating another context/calculation brain.

## 5. Candidate-like status only

`decision_recommendation_v1` must explicitly carry:

`proposed` or `candidate`.

Any missing/approved/rejected/executed status fails closed.

Historical `recommendation_v1` may lack a status field. B-06c may preserve that older shape only as candidate compatibility and records:

`LEGACY_RECOMMENDATION_STATUS_ABSENT`.

If a recommendation_v1 explicitly carries a non-candidate status, it fails closed.

## 6. Downstream authority contamination is rejected

A source carrying non-empty downstream authority such as:

- approval request/decision identity;
- operation-plan identity;
- task/dispatch identity;
- receipt identity;
- downstream-created booleans;

is rejected rather than collapsed back into CandidateDecision.

Therefore a customer/read-model object that already includes downstream chain state cannot be reused as canonical candidate input.

B-06c is intended for source recommendation payload semantics only.

## 7. Parameters boundary

Only scalar values from legacy `suggested_action.parameters` may enter `parameters_hint`.

Nested objects/arrays are omitted and explicitly limited.

CandidateDecision's existing downstream-authority-key guard still applies, so keys such as `approved`, `eligibility`, `task_id` or `execute_now` fail contract validation.

## 8. Timestamp / scope authority

Canonical scope and `created_at` are explicit adapter inputs.

The adapter does not choose between legacy payload timestamps and fact occurrence timestamps.

If legacy `created_ts` exists, it is not silently promoted as canonical created-at authority.

Any explicit source scope that conflicts with supplied canonical scope fails closed.

## 9. No runtime wiring

The adapter is registered as:

`REGISTERED_CAPABILITY_ISLAND / MANUAL / INTENTIONAL_NONE`.

It has no route, job, approval, plan or runtime consumer.

B-06c does not modify:

- Agronomy Agent;
- Decision Engine;
- Rule Engine;
- recommendation persistence;
- approval-request builder;
- operation_plan_v1;
- prescription;
- Decision Eligibility;
- AO-ACT/task/dispatch/execution;
- MCFT provider/scheduler/Formal/Twin persistence/schema/binding.

## 10. Machine governance

`G-B02-15-candidate-decision-instantiation` is updated to allow exactly the B-06c adapter path.

Any additional CandidateDecision producer remains forbidden unless separately registered.

`G-B02-14-calculation-result-instantiation` remains exactly the B-06b adapter path.

## 11. Historical authority

B-06c does not remove historical recommendation authority and does not disable any producer.

Actual historical authority removal remains B-09 only after replacement, shadow comparison, divergence inventory and consumer migration.

## 12. Completion gate

B-06c is complete only when one exact product head proves:

- decision_recommendation_v1 proposed -> CandidateDecisionV1 PASS;
- canonical action uses top-level candidate action rather than nested operational label PASS;
- legacy evidence refs are not promoted to canonical EvidenceQualification refs PASS;
- downstream plan/task/receipt contamination fails closed PASS;
- non-candidate decision_recommendation status fails closed PASS;
- historical recommendation_v1 missing status remains explicit compatibility limitation PASS;
- nested parameters are not promoted PASS;
- downstream-authority parameters fail contract validation PASS;
- source-scope mismatch fails closed PASS;
- exact CandidateDecision producer set = B-06c adapter only PASS;
- exact CalculationResult producer set remains B-06b adapter only PASS;
- adapter has no production runtime consumer PASS;
- B-06b/B-06a/B-05/B-03/B-04 regression boundaries PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.
