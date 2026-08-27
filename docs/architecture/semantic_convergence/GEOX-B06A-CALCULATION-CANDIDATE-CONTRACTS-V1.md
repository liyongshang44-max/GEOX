# GEOX B-06a CalculationResult + CandidateDecision Contracts V1

## 0. Status

B-Line bounded B-06 contract phase.

Stacked exactly on B-05 overall completion head:

`f240d76c38cb3f839556f768b578745f7b38627d`

This phase does not rewire any decision producer.

## 1. Frozen semantic split

B-06a freezes:

```text
Decision calculator
-> CalculationResultV1

Decision Runtime / compatibility adapter
-> CandidateDecisionV1

CandidateDecision
!= Decision Eligibility
!= Approval
!= ApprovedOperationPlan
!= ExecutableTask
```

This follows the existing Decision/Plan v0 rule that a detailed proposal is still only a candidate for execution.

## 2. CalculationResultV1

A CalculationResult contains:

- scope;
- calculator identity/version;
- EvidenceQualification refs;
- ContextSnapshot ref;
- crop-stage-state ref;
- structured scalar outputs;
- trace refs;
- assumptions;
- uncertainty;
- limitations;
- decision/evaluation time.

Its authority is fixed:

`CALCULATION_ONLY`.

The schema has no proposed action, eligibility, approval, plan or task field.

## 3. CandidateDecisionV1

A CandidateDecision contains:

- scope;
- source/provenance class;
- proposed action;
- non-executable parameter hints;
- optional action-spec ref;
- qualified-input/calculation refs;
- confidence;
- reasons;
- limitations;
- decision/creation time.

Its authority is fixed:

`CANDIDATE_ONLY`.

## 4. Candidate source lattice

B-06a reserves explicit source classes required by the frozen migration:

- `DECISION_RUNTIME`;
- `LEGACY_RECOMMENDATION`;
- `LEGACY_DECISION_PLAN`;
- `LEGACY_PRESCRIPTION_ACTION_SPEC`;
- `LEGACY_OPERATION_PLAN_PROPOSAL`.

The presence of a source class does not activate an adapter.

## 5. No downstream authority smuggling

CandidateDecision is strict and has no fields for:

- Decision Eligibility;
- Approval;
- ApprovedOperationPlan;
- task;
- execution.

`parameters_hint` is scalar-only and rejects keys that encode downstream authority, including approval, eligibility, execution, task or authorization tokens.

Therefore a proposed action cannot become executable merely because it contains detailed parameters.

## 6. B-08 boundary

B-06a deliberately does not add typed MCFT State/Forecast/Scenario, ADR or LLM ports.

Those are B-08 concerns.

No MCFT/ADR/LLM runtime binding is created here.

## 7. Machine governance

B-02 adds zero-producer guards:

- `G-B02-14-calculation-result-instantiation`;
- `G-B02-15-candidate-decision-instantiation`.

Both start with no registered production paths.

Any later CalculationResult or CandidateDecision producer must be explicitly registered in a bounded B-06 phase.

## 8. Existing historical objects remain unchanged

B-06a does not modify:

- recommendation_v1;
- decision_recommendation_v1;
- decision_plan_v0;
- prescription;
- operation_plan_v1;
- Agronomy Rule Engine;
- Agronomy Judge;
- Agronomy Agent;
- Decision Engine;
- approval/task/execution paths.

Historical authority remains visible until B-09 migration prerequisites.

## 9. Completion gate

B-06a is complete only when one exact product head proves:

- CalculationResultV1 contract PASS;
- calculator cannot smuggle candidate/approval authority PASS;
- CandidateDecisionV1 contract PASS;
- CandidateDecision remains CANDIDATE_ONLY PASS;
- extra Eligibility/Approval/Plan/Task/Execution fields rejected PASS;
- downstream authority keys in parameters_hint rejected PASS;
- legacy recommendation/decision-plan/prescription source classes remain candidate-only PASS;
- B-02 governance PASS with zero production CalculationResult/CandidateDecision producers;
- B-05 regression boundary PASS;
- B-03/B-04 regression boundary PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.
