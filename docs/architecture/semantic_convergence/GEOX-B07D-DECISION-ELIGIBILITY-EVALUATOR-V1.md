# GEOX B-07d Decision Eligibility Evaluator V1

## Status

B-07d is stacked exactly on completed B-07c product head:

`366de72a7c4983f48d5ec200353b10e0eea8360b`.

It introduces the first canonical `DecisionEligibilityDecisionV1` producer as a pure deterministic capability island.

No route, Approval, OperationPlan, Task, execution path, or MCFT implementation is connected.

## Explicit policy, no hidden defaults

The evaluator requires:

`policy_ref + required_criteria`.

There is no built-in default list of required criteria.

The `policy_ref` must already appear in canonical `inputs.policy_refs`, preserving the provenance of the eligibility policy.

Required criteria must be:

- non-empty;
- unique;
- all present in the supplied criterion assessments.

Missing a required criterion fails closed.

## All supplied criteria participate

`required_criteria` defines completeness, not an allowlist.

Every criterion supplied to the evaluator participates in aggregation, including non-required criteria.

Therefore a caller cannot hide a known `VIOLATED` condition merely by omitting it from the required set after supplying it.

Duplicate assessments for one criterion fail closed.

## Deterministic aggregation

Status precedence is:

`VIOLATED -> BLOCK`

`REVIEW_REQUIRED -> HUMAN_REVIEW`

`MISSING / UNKNOWN -> NEED_EVIDENCE`

`DEGRADED -> DEGRADED`

`all SATISFIED -> PASS`.

A higher-severity criterion always dominates a lower one.

This realizes the Amendment-01 verdict vocabulary without conflating Evidence Qualification and final action-level eligibility.

## Degraded evidence behavior

A degraded Evidence criterion can yield:

`DEGRADED`

when all harder constraints are satisfied.

It does not automatically become BLOCK.

This preserves the central B-04/B-07 rule:

`one invalid observation != automatic action BLOCK`.

## Lifecycle consistency

`EXPIRED` remains a lifecycle state, not a verdict.

An EXPIRED evaluation must carry:

`ACTION_WINDOW = VIOLATED`

which deterministically yields current action verdict `BLOCK`.

`NOT_YET_ACTIVE` and `UNKNOWN` lifecycle states may not claim a SATISFIED/DEGRADED action window.

This prevents a non-active candidate from silently receiving PASS.

## Authority boundary

Output authority is fixed:

`ELIGIBILITY_ONLY`.

Even `PASS` means only:

> eligible to proceed toward the next authority boundary.

PASS does not mean Approved.

The evaluator cannot create:

- approval;
- ApprovedOperationPlan;
- Task;
- execution authorization;
- device command.

## Machine governance

`G-B02-16-decision-eligibility-instantiation` now registers exactly one producer path:

`apps/server/src/domain/decision/decision_eligibility_evaluator_v1.ts`.

The producer is:

`REGISTERED_CAPABILITY_ISLAND / MANUAL / INTENTIONAL_NONE`.

Any second final DecisionEligibilityDecisionV1 producer is forbidden.

Criterion guard B-02-17 remains exactly B-07b + B-07c.

## Historical authority

Stage-1 and Agronomy Judge remain grandfathered precursors with `removal_target=B-09`.

B-07d does not rewire or remove them.

## Completion gate

B-07d is complete only when one exact product head proves:

- all-satisfied -> PASS PASS;
- deterministic status precedence PASS;
- missing required criterion fail closed PASS;
- required criteria explicit/nonempty/unique PASS;
- policy_ref bound to canonical inputs PASS;
- duplicate criterion assessment fails PASS;
- non-required supplied violation still affects verdict PASS;
- lifecycle consistency PASS;
- degraded evidence can remain DEGRADED PASS;
- PASS remains non-approval PASS;
- final eligibility producer set exactly one PASS;
- second unregistered final producer rejected PASS;
- criterion producer set remains exactly B-07b+B-07c PASS;
- no production runtime consumer PASS;
- precursor/Approval/downstream runtime surfaces untouched PASS;
- B-07c/B-07b/B-07a/B-06/B-05/B-03/B-04 regressions PASS;
- B-09-only removal boundary preserved PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.
