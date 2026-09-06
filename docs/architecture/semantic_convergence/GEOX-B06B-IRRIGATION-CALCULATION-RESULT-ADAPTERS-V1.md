# GEOX B-06b Irrigation CalculationResult Compatibility Adapters V1

## 0. Status

B-Line bounded B-06 adapter phase stacked exactly on completed B-06a product head:

`a2f6d64663492ce964bc6ca7d687f17dc51eae99`

This phase adds a pure compatibility projection capability. It does not rewire any current runtime consumer.

## 1. Scope

B-06b covers exactly two existing deterministic irrigation calculators:

- `irrigation_requirement_skill_v1`;
- `irrigation_deficit_skill_v1`.

Their existing outputs remain unchanged.

B-06b adds a pure adapter that projects already-computed outputs into:

`CalculationResultV1`

with:

`authority_state = CALCULATION_ONLY`.

## 2. Evidence authority boundary

Legacy skill `evidence_refs` are not equivalent to canonical `EvidenceQualificationV1` references.

Therefore the adapter never copies:

`legacy output.evidence_refs -> evidence_qualification_refs`.

Canonical qualification refs must be supplied explicitly by the caller.

This prevents raw/legacy evidence identity from being silently upgraded into qualified Evidence authority.

## 3. Requirement-skill mapping

The requirement adapter may project deterministic calculation facts including:

- requirement detected;
- net irrigation requirement;
- gross irrigation requirement;
- rain credit;
- ET0 adjustment.

Legacy default use remains visible through explicit `assumptions` and `limitations`.

Missing/invalid soil moisture is retained as a limitation and raises calculation uncertainty; it is not repaired into Evidence authority.

## 4. Deficit-skill mixed semantic boundary

The legacy deficit skill returns:

- deficit detected;
- deficit level;
- `recommended_amount`.

The first two are deterministic calculation facts.

`recommended_amount` is recommendation-like/candidate-like output and therefore is deliberately not promoted into `CalculationResultV1`.

The canonical projection records:

`LEGACY_RECOMMENDED_AMOUNT_NOT_PROMOTED_TO_CALCULATION_RESULT`

as an explicit limitation.

This is the key B-06b semantic correction:

`legacy mixed calculator output != canonical calculation authority`.

## 5. No runtime wiring

The adapter is registered as:

`REGISTERED_CAPABILITY_ISLAND / MANUAL / INTENTIONAL_NONE`.

It has no route, job, module-registration or production runtime consumer.

B-06b does not change:

- Agronomy Judge;
- Decision Engine;
- Agronomy Agent;
- Rule Engine;
- recommendation_v1 / decision_recommendation_v1;
- decision_plan_v0;
- prescription;
- operation_plan_v1;
- Decision Eligibility;
- approval;
- AO-ACT;
- task/dispatch/execution;
- MCFT provider/scheduler/Formal/Twin persistence/schema/binding.

## 6. Machine governance

`G-B02-14-calculation-result-instantiation` is updated from zero registered paths to exactly the B-06b adapter path.

Any additional production `CalculationResultV1` instantiation remains forbidden unless separately registered.

`G-B02-15-candidate-decision-instantiation` remains unchanged with zero registered paths.

No `CandidateDecisionV1` producer is activated in B-06b.

## 7. Historical authority

Existing calculator and mixed-authority paths remain visible.

B-06b does not remove authority from any historical producer.

Actual historical semantic-authority removal remains B-09 only after replacement, shadow comparison, divergence inventory and consumer migration.

## 8. Completion gate

B-06b is complete only when one exact product head proves:

- requirement output -> CalculationResultV1 PASS;
- legacy Evidence refs are not promoted to EvidenceQualification refs PASS;
- legacy defaults are explicit assumptions/limitations PASS;
- missing soil moisture remains explicit/high-uncertainty PASS;
- deficit output excludes `recommended_amount` from CalculationResultV1 PASS;
- invalid canonical timestamp fails closed PASS;
- B-02 governance PASS;
- exact CalculationResult producer set = B-06b adapter only PASS;
- no CandidateDecision producer activated PASS;
- adapter has no production runtime consumer PASS;
- B-06a/B-05/B-03/B-04 regression boundaries PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.
