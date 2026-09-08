# GEOX B-06f OperationPlan Authority Classifier + Candidate Compatibility Adapter V1

## 0. Status

B-Line bounded B-06 operation-plan classification phase stacked exactly on completed B-06e product head:

`10430d387d144c72ae68cb101c31e1f3f58d358d`

This phase adds:

1. a pure `operation_plan_v1` authority classifier;
2. a pure CandidateDecision compatibility projection for one exact grandfathered Agronomy Agent plan provenance.

It does not rewire any operation-plan producer or consumer.

## 1. Why classification comes before projection

The repository does not have one semantic meaning for every `operation_plan_v1` record.

Current inventory includes:

- approval-derived mainline plan formation;
- approval-linked AO-ACT plan formation;
- Agronomy Agent direct plan creation after recommendation;
- decision-engine lifecycle touchpoints;
- flight-table compatibility/demo plan semantics.

Therefore:

`operation_plan_v1 exists`

must never imply:

`CandidateDecision`

and:

`status = CREATED`

must never imply:

`unapproved proposal`.

B-06f first classifies real source authority.

## 2. Authority classes

The classifier returns exactly one class:

- `GRANDFATHERED_DIRECT_PLAN_AUTHORITY`;
- `APPROVAL_DERIVED_PLAN_AUTHORITY`;
- `DOWNSTREAM_PLAN_AUTHORITY`;
- `UNKNOWN_PLAN_AUTHORITY`.

Only the first is candidate-view compatible.

This naming is intentional: the Agronomy Agent source object is still real grandfathered plan authority today. B-06f does not relabel that historical runtime authority away.

## 3. Positive provenance whitelist

A plan is classified as `GRANDFATHERED_DIRECT_PLAN_AUTHORITY` only if all of these are true:

- plan fact type is `operation_plan_v1`;
- plan fact source is exactly `jobs/agronomy_agent`;
- plan status is exactly `CREATED`;
- a transition fact is supplied;
- transition fact type is exactly `operation_plan_transition_v1`;
- transition source is exactly `jobs/agronomy_agent`;
- transition `operation_plan_id` exactly matches the plan;
- transition status is exactly `CREATED`;
- transition trigger is exactly `agronomy_agent_auto_create`;
- neither plan nor transition contains approval lineage;
- neither plan nor transition contains task/dispatch/receipt lineage.

Missing or inexact dual provenance becomes `UNKNOWN_PLAN_AUTHORITY`.

No filename, id-prefix or status-only guess is accepted.

## 4. Approval-derived classification

Any non-empty approval lineage on the plan, including:

- `approval_request_id`;
- `approval_decision_id`;
- `approval_decision`;
- `approval_decision_fact_id`;
- decision/approval identity;

classifies the object as:

`APPROVAL_DERIVED_PLAN_AUTHORITY`.

This covers both known approved-plan formation families:

- H54.4 / `operator_approval_decision_operation_plan_api`;
- approval-linked AO-ACT plan creation carrying `approval_request_id` and `approval_operation_plan_auto_create`.

These objects may never be projected back into CandidateDecision.

## 5. Downstream classification

Task/dispatch/receipt identity or downstream statuses such as:

- APPROVED;
- READY;
- DISPATCHED;
- ACKED;
- SUCCEEDED;
- FAILED;
- INVALID_EXECUTION;
- PENDING_ACCEPTANCE;

classify the plan as:

`DOWNSTREAM_PLAN_AUTHORITY`.

These objects are never candidate-compatible.

## 6. Unknown classification

Any other CREATED plan source remains:

`UNKNOWN_PLAN_AUTHORITY`.

In particular, B-06f does not guess candidate semantics for:

- decision-engine lifecycle touchpoints;
- flight-table compatibility plans;
- unknown sources;
- Agronomy Agent plans missing the exact paired transition proof.

Unknown means fail closed.

## 7. Candidate projection

Only `GRANDFATHERED_DIRECT_PLAN_AUTHORITY` may enter:

`projectLegacyOperationPlanProposalCandidateV1`.

The output is:

`CandidateDecisionV1`

with:

`source_class = LEGACY_OPERATION_PLAN_PROPOSAL`

and:

`authority_state = CANDIDATE_ONLY`.

This is a compatibility candidate view. It does not mutate the source plan's current authority.

The output explicitly records:

`SOURCE_OPERATION_PLAN_RETAINS_HISTORICAL_PLAN_AUTHORITY_UNTIL_B09`.

## 8. Action boundary

Only the Agronomy Agent's existing high-level action vocabulary is accepted:

- IRRIGATE;
- FERTILIZE;
- SPRAY;
- INSPECT.

EXECUTE/OTHER/unknown labels fail closed.

Legacy `device_id`, `expected_effect`, crop metadata and plan-control fields are not promoted into CandidateDecision parameters.

`parameters_hint` remains empty.

## 9. Evidence / scope / time boundary

Canonical EvidenceQualification, ContextSnapshot, crop-stage-state, CalculationResult and interpretation refs remain explicit projection inputs.

Legacy plan provenance is kept only in `legacy_source_refs`.

Canonical tenant/project/group/field scope must exactly match the legacy plan. Optional season/zone values, when present, must also match.

Legacy `created_ts` is not promoted into canonical `created_at`.

## 10. No runtime rewiring

B-06f does not modify:

- Agronomy Agent;
- decision engine;
- approval routes;
- operation-plan builders/routes;
- AO-ACT;
- flight-table compatibility code;
- MCFT implementation.

The adapter is:

`REGISTERED_CAPABILITY_ISLAND / MANUAL / INTENTIONAL_NONE`.

Historical operation-plan authority removal remains B-09 only.

## 11. Machine governance

`G-B02-15-candidate-decision-instantiation` expands to exactly four registered adapter paths:

1. B-06c recommendation;
2. B-06d decision-plan;
3. B-06e prescription action-spec;
4. B-06f grandfathered operation-plan candidate view.

Any fifth CandidateDecision producer remains forbidden until explicitly registered.

CalculationResult governance remains unchanged.

## 12. Completion gate

B-06f is complete only when one exact product head proves:

- exact Agronomy Agent dual provenance classifies as grandfathered direct plan authority PASS;
- candidate projection remains CANDIDATE_ONLY PASS;
- missing/inexact transition provenance fails closed PASS;
- approval-derived CREATED plans never project back to candidate PASS;
- downstream plan status/task/receipt lineage fails closed PASS;
- unknown CREATED sources remain unknown PASS;
- scope mismatch/missing required scope fails closed PASS;
- only existing Agronomy Agent high-level action vocabulary passes PASS;
- device/expected-effect fields are not promoted PASS;
- canonical Evidence refs remain explicit PASS;
- transition approval/downstream lineage overrides source provenance PASS;
- legacy timestamps are not promoted PASS;
- recommendation lineage is required PASS;
- exact CandidateDecision producer set = B-06c/B-06d/B-06e/B-06f only PASS;
- B-06f has no production runtime consumer PASS;
- all existing operation-plan producer/runtime files remain untouched PASS;
- B-06e/B-06d/B-06c/B-06b/B-06a/B-05/B-03/B-04 regressions PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.
