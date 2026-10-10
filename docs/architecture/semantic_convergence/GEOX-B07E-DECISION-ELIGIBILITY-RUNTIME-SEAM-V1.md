# GEOX B-07e Decision Eligibility Runtime Seam V1

## Status

B-07e is stacked exactly on completed B-07d product head:

`168e5c8a33edc29f18b810ad7223d5ec511b6bfa`.

B-07d established the canonical deterministic final evaluator.

B-07e establishes the canonical domain runtime seam that consumes a real `CandidateDecisionV1`, proves candidate/input continuity, and calls that evaluator.

It does not expose an HTTP route and does not connect Approval, OperationPlan, Task, execution, or MCFT.

## Candidate is the authority for identity and scope

The runtime seam accepts the full CandidateDecision object and validates it with the B-06 contract.

The following values are derived only from the candidate:

- `candidate_ref`;
- `scope`;
- `context_snapshot_ref`;
- `crop_stage_state_ref`;
- `decision_time`.

The caller cannot independently supply or override them.

This prevents the same candidate from being re-evaluated under a different field, season, context, or stage identity.

## Candidate evidence continuity

Every canonical EvidenceQualification ref that supported CandidateDecision creation must still exist in the runtime eligibility EvidenceQualification input set.

Additional qualified evidence may be supplied for eligibility.

But candidate basis evidence cannot silently disappear.

## Canonical criterion support closure

Every `criterion.support_ref` must belong to the union of explicit canonical runtime refs or canonical Candidate basis refs:

- EvidenceQualification;
- ContextSnapshot;
- crop-stage state;
- State;
- Forecast;
- Scenario;
- KnowledgeClaim;
- Policy;
- Permission;
- ActionWindow;
- Candidate CalculationResult refs;
- Candidate interpretation refs.

Legacy source refs are deliberately excluded.

Therefore raw/legacy facts cannot be smuggled directly into final eligibility criteria.

## Policy action applicability

The runtime policy explicitly declares:

`applicable_action_types`.

The candidate's canonical `proposed_action.action_type` must appear in that set.

There is no implicit cross-action policy reuse.

The policy ref must still be present in canonical `inputs.policy_refs` through the B-07d evaluator.

## Temporal continuity

`evaluated_at` must not precede CandidateDecision `created_at`.

If CandidateDecision carries `decision_time`, the evaluation must not precede it.

The eligibility result inherits CandidateDecision `decision_time`.

## Runtime topology

The B-07e seam is the only explicitly registered consumer of the B-07d evaluator.

Topology:

`CandidateDecisionV1 + canonical refs + eligibility criteria + explicit policy`

`-> decision_eligibility_runtime_v1`

`-> decision_eligibility_evaluator_v1`

`-> DecisionEligibilityDecisionV1`.

This is a domain runtime seam, not an externally activated route.

Activation remains manual/capability-island.

## Governance

The B-07d producer changes:

`new_runtime_consumer_creation: FORBIDDEN`

to:

`ALLOWED_ONLY_BY_EXPLICIT_REGISTER`

because B-07e is now explicitly registered as its sole runtime consumer.

The eligibility semantic `current_state` moves from:

`NOT_YET_UNIFIED`

to:

`REGISTERED_CAPABILITY_ISLAND`.

This means canonical runtime topology exists, while historical Stage-1/Agronomy Judge precursor authority still coexists until B-09.

A new static guard:

`G-B02-18-decision-eligibility-runtime-consumer`

permits exactly the B-07e runtime seam to import the B-07d evaluator.

Any second runtime consumer requires explicit later governance.

## Non-effects

B-07e does not modify:

- Stage-1;
- Agronomy Judge;
- Evidence Judge;
- Decision Engine route;
- Approval;
- OperationPlan;
- Task;
- execution;
- MCFT implementation.

Historical authority removal remains B-09 only.

## Completion gate

B-07e is complete only when one exact product head proves:

- CandidateDecision schema validation PASS;
- candidate_ref derived from CandidateDecision PASS;
- scope derived from CandidateDecision PASS;
- ContextSnapshot/stage refs derived from Candidate basis PASS;
- decision_time inherited from CandidateDecision PASS;
- Candidate evidence basis refs cannot disappear PASS;
- criterion support refs restricted to canonical input/basis union PASS;
- policy action applicability explicit PASS;
- evaluation cannot predate Candidate creation/decision time PASS;
- required criteria continuity PASS;
- B-07d deterministic verdict semantics preserved PASS;
- PASS remains non-Approval PASS;
- final producer set remains exactly one B-07d evaluator PASS;
- runtime consumer set exactly one B-07e seam PASS;
- second runtime consumer rejected PASS;
- B-07b/B-07c criterion producer set unchanged PASS;
- no route/Approval/downstream runtime mutation PASS;
- B-09-only removal boundary preserved PASS;
- earlier B-line regressions PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.

Only after B-07e qualification should B-07 overall closure be adjudicated.
