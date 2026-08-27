# GEOX B-07b Stage-1 Eligibility Precursor Adapter V1

## 0. Status

B-Line bounded B-07 phase stacked exactly on completed B-07a product head:

`9fb38385dc303853354c9524022a25558283a47c`

B-07b adds a pure compatibility projection for the existing Stage-1 formal-trigger gate.

It does not create a final DecisionEligibilityDecisionV1 producer.

## 1. Why Stage-1 cannot map directly to final verdicts

Current Stage-1 vocabulary is:

- ELIGIBLE;
- NOT_ELIGIBLE;
- NEEDS_EVIDENCE.

But the Stage-1 gate only evaluates a formal-trigger/evidence slice.

It does not evaluate the full Amendment-01 eligibility factor set:

- State;
- Forecast;
- Scenario;
- Context;
- Knowledge / Policy;
- Permission;
- Action Window;
- Consequence;
- Reversibility;
- Remaining Uncertainty;
- Independent Evidence Support.

Therefore the following shortcuts are forbidden:

`ELIGIBLE -> PASS`

`NOT_ELIGIBLE -> BLOCK`

`NEEDS_EVIDENCE -> final NEED_EVIDENCE`

B-07b emits precursor classification and criterion assessment only.

## 2. Precursor classifications

Exact classes:

- `FORMAL_TRIGGER_SUPPORTED`;
- `FORMAL_TRIGGER_EVIDENCE_GAP`;
- `NO_FORMAL_TRIGGER_SIGNAL`.

Every projection carries:

`direct_verdict_authority = NONE`.

The projection has no `verdict` field.

## 3. ELIGIBLE mapping

Stage-1:

`ELIGIBLE + reason_codes=[]`

maps only to:

`QUALIFIED_EVIDENCE = SATISFIED`.

This means the Stage-1 formal-trigger evidence gate is satisfied.

It does not mean the candidate has passed complete Decision Eligibility.

## 4. NEEDS_EVIDENCE mapping

Stage-1:

`NEEDS_EVIDENCE`

requires non-empty reason codes and maps only to:

`QUALIFIED_EVIDENCE = MISSING`.

Here `MISSING` means required formal-trigger decision support is incomplete/ineligible, not necessarily that every raw observation is physically absent.

The later Decision Eligibility runtime must still consider:

- independent qualified support;
- other eligibility criteria;
- the candidate action as a whole.

Therefore Stage-1 NEEDS_EVIDENCE does not by itself force final BLOCK or even final NEED_EVIDENCE.

## 5. NOT_ELIGIBLE mapping

Current Stage-1 `NOT_ELIGIBLE` is emitted when there is:

`NO_FORMAL_STAGE1_SIGNAL`.

B-07b maps that to:

`NO_FORMAL_TRIGGER_SIGNAL`

with zero canonical criterion assessments.

It does not map it to BLOCK.

Absence of this specific Stage-1 formal signal is not a complete action-level eligibility decision.

## 6. Evidence authority

Criterion `support_refs` come only from explicit caller-supplied canonical EvidenceQualification refs.

B-07b does not inspect or promote arbitrary raw evidence fields carried on an extended Stage-1 object.

Stage-1 source fields cannot smuggle approval/plan/task authority into the projection.

## 7. Runtime boundary

B-07b does not modify or connect:

- `stage1_action_boundary_v1.ts`;
- Apple-II Stage-1 evidence-gate route;
- recommendation generation;
- Agronomy Judge;
- Approval;
- OperationPlan;
- Task;
- MCFT implementation.

The adapter is:

`REGISTERED_CAPABILITY_ISLAND / MANUAL / INTENTIONAL_NONE`.

## 8. Machine governance

B-07a final eligibility guard remains:

`G-B02-16-decision-eligibility-instantiation`

with zero registered paths.

B-07b adds:

`G-B02-17-decision-eligibility-criterion-instantiation`

and registers exactly one criterion producer:

`stage1_eligibility_precursor_adapter_v1.ts`.

Any second production criterion-instantiation path is forbidden until explicitly registered.

## 9. Historical authority

The existing Stage-1 producer remains:

`GRANDFATHERED_PRECURSOR`

with:

`removal_target = B-09`.

B-07b does not alter or remove it.

## 10. Next B-07 frontier

After B-07b, Agronomy Judge remains the other known eligibility precursor.

Its current:

`evidence verdict -> BLOCKED`

behavior must not be promoted directly into canonical BLOCK.

A later bounded B-07 phase must classify its output before a canonical final eligibility runtime is connected.

## 11. Completion gate

B-07b is complete only when one exact product head proves:

- ELIGIBLE -> SATISFIED criterion, not PASS PASS;
- NEEDS_EVIDENCE -> MISSING criterion only PASS;
- NOT_ELIGIBLE -> no-trigger classification, not BLOCK PASS;
- direct_verdict_authority always NONE PASS;
- canonical EvidenceQualification support refs explicit PASS;
- source raw/downstream fields cannot be promoted PASS;
- malformed precursor status semantics fail closed PASS;
- final DecisionEligibility producer count remains zero PASS;
- criterion producer set exactly one registered adapter PASS;
- unregistered second criterion producer rejected PASS;
- Stage-1/Apple-II/Agronomy Judge/Approval runtime surfaces untouched PASS;
- B-07a/B-06/B-05/B-03/B-04 regressions PASS;
- B-09-only removal boundary preserved PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.
