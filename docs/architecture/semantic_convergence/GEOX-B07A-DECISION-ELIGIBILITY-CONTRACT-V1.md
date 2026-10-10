# GEOX B-07a Decision Eligibility Contract V1

## 0. Status

B-Line B-07 begins only after overall B-06 closure.

Authoritative B-06 product head:

`1e057c25ca38ba6a8658b859bd93d2bb06ef88e7`

Authoritative B-06 overall closure validator:

`33096131433 = SUCCESS`.

B-07a is contract-first only.

It creates no production Decision Eligibility runtime.

## 1. Semantic question

Decision Eligibility answers:

> Given one CandidateDecision and the qualified decision-time inputs, may this candidate proceed toward Approval/production, and under what degraded/review/block conditions?

It does not answer:

- whether one observation is valid;
- whether the candidate is approved;
- whether an OperationPlan exists;
- whether a task is executable;
- whether execution happened or was accepted.

## 2. Normative verdicts

The only B-07 eligibility verdicts are:

- `PASS`;
- `DEGRADED`;
- `NEED_EVIDENCE`;
- `HUMAN_REVIEW`;
- `BLOCK`.

`EXPIRED` is deliberately not a verdict.

Lifecycle/time validity is represented separately by:

- `ACTIVE`;
- `NOT_YET_ACTIVE`;
- `EXPIRED`;
- `UNKNOWN`.

## 3. Evidence Qualification remains separate

B-07 must preserve the B-04 boundary:

`invalid observation != automatic action BLOCK`.

An action may remain `DEGRADED` when a source is invalid but the required decision claims remain supported by independent qualified evidence.

The canonical contract therefore records criterion assessments and the final action-level verdict separately.

It does not encode any rule saying that one invalid EvidenceQualification automatically produces `BLOCK`.

## 4. Candidate boundary

Eligibility consumes a reference to a CandidateDecision:

`inputs.candidate_ref`.

It does not embed a mutable candidate object.

The eligibility result cannot create or carry:

- approval;
- approved flag;
- OperationPlan;
- Task;
- execution authorization;
- device command.

`authority_state` is fixed to:

`ELIGIBILITY_ONLY`.

## 5. Canonical input references

The contract explicitly separates:

- EvidenceQualification refs;
- ContextSnapshot ref;
- qualified crop-stage-state ref;
- State refs;
- Forecast refs;
- Scenario refs;
- KnowledgeClaim refs;
- Policy refs;
- Permission refs;
- ActionWindow refs.

No raw evidence shortcut is part of the schema.

## 6. Eligibility criteria

The canonical criterion vocabulary covers the Amendment-01 decision factors:

- QUALIFIED_EVIDENCE;
- STATE;
- FORECAST;
- SCENARIO;
- CONTEXT;
- KNOWLEDGE_POLICY;
- PERMISSION;
- ACTION_WINDOW;
- CONSEQUENCE;
- REVERSIBILITY;
- REMAINING_UNCERTAINTY;
- INDEPENDENT_EVIDENCE_SUPPORT.

Each criterion has one assessment status:

- SATISFIED;
- DEGRADED;
- MISSING;
- REVIEW_REQUIRED;
- VIOLATED;
- UNKNOWN.

B-07a deliberately does not freeze an aggregation algorithm from criterion statuses to the final verdict. That belongs to bounded B-07 runtime work after the precursor semantics are mapped.

## 7. Historical precursor boundaries

Two existing producers are explicitly not made canonical in B-07a.

### Stage-1 formal trigger gate

Current vocabulary:

- ELIGIBLE;
- NOT_ELIGIBLE;
- NEEDS_EVIDENCE.

This mixes formal-trigger/evidence conditions and is a grandfathered precursor.

B-07a does not rename it in place or connect it to the canonical contract.

### Agronomy Judge V2

Current behavior can map some Evidence Judge verdicts directly to `BLOCKED`.

This violates the intended separation if treated as canonical action-level eligibility.

B-07a does not modify that runtime.

A later bounded B-07 phase must classify/map these semantics without assuming:

`evidence invalid -> BLOCK`.

## 8. No approval coupling

`PASS` means eligible to proceed toward the next authority boundary.

It does not mean approved.

`HUMAN_REVIEW` is an eligibility verdict saying human review is required; it is not an approval decision.

Approval remains the existing separate authority.

## 9. Machine governance

B-07a adds:

`G-B02-16-decision-eligibility-instantiation`.

At B-07a its registered production producer path set is empty.

Any production call to:

`decisionEligibilityDecisionV1Schema.parse(...)`

must fail governance until a later B-07 phase explicitly registers the producer.

This proves B-07a is contract-only.

## 10. Historical authority removal

B-07a does not remove Stage-1 or Agronomy Judge authority.

Their grandfathered `removal_target` remains B-09.

No B-09 work is authorized here.

## 11. Completion gate

B-07a is complete only when one exact product head proves:

- exact five normative verdicts PASS;
- EXPIRED rejected as verdict and accepted only as lifecycle state PASS;
- degraded-evidence / non-automatic-BLOCK fixture PASS;
- CandidateDecision remains reference-only PASS;
- downstream approval/plan/task/execution contamination rejected PASS;
- canonical input refs remain separated PASS;
- criterion vocabulary covers Amendment-01 factors PASS;
- raw-evidence shortcut rejected PASS;
- authority_state fixed to ELIGIBILITY_ONLY PASS;
- zero production DecisionEligibilityDecisionV1 producers PASS;
- negative unregistered eligibility producer rejected PASS;
- Stage-1/Agronomy Judge/Approval runtime files untouched PASS;
- all grandfathered removal targets remain B-09 PASS;
- B-06 overall regression PASS;
- B-05/B-03/B-04 regression PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.
