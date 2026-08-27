# GEOX B-06e Prescription Action-Spec → CandidateDecision Compatibility Adapter V1

## 0. Status

B-Line bounded B-06 candidate-adapter phase stacked exactly on completed B-06d product head:

`a1c625a9627215f32dd6906ce0c02023bc14c0bb`

This phase adds a pure compatibility projection capability only.

No prescription producer, approval route, operation-plan route or task runtime is rewired.

## 1. Why prescription requires a stricter adapter

The current `PrescriptionContractV1` is not a pure candidate object.

It carries an action specification plus approval/execution-adjacent metadata:

- operation type and amount;
- spatial/timing detail;
- device requirements;
- risk;
- approval requirement;
- acceptance conditions;
- workflow status.

Therefore B-06e must not equate:

`PrescriptionContractV1 = CandidateDecisionV1`.

Only the pre-approval action-spec portion may be projected.

## 2. Status boundary

Only these legacy prescription statuses are candidate-compatible:

- `DRAFT`;
- `READY_FOR_APPROVAL`.

`READY_FOR_APPROVAL` means exactly "ready to ask for approval".

It does not mean:

- Decision Eligibility PASS;
- approval requested;
- approved;
- operation plan created;
- task created;
- executable.

The adapter rejects:

- `APPROVAL_REQUESTED`;
- `APPROVED`;
- `TASK_CREATED`;
- `REJECTED`;
- `CANCELLED`;
- missing/unknown status.

This prevents downstream workflow state from being collapsed back into candidate authority.

## 3. Action mapping

B-06e reuses only mappings already explicit in the prescription approval route:

- `IRRIGATION -> IRRIGATE`;
- `FERTILIZATION -> FERTILIZE`;
- `SPRAYING -> SPRAY`;
- `INSPECTION -> INSPECT`.

`SAMPLING` and `OTHER` are rejected rather than mapped to a guessed canonical action.

In particular, B-06e does not reuse the route's generic fallback `EXECUTE`, because that label is execution-shaped rather than candidate-shaped.

## 4. Action-spec projection

The adapter may project only scalar operation hints that are already explicit:

- positive finite amount;
- unit;
- optional finite rate;
- optional rate unit.

A DRAFT with incomplete/pending amount remains a candidate with no amount hint and explicit limitations.

Nested `operation_amount.parameters` are not promoted.

The full prescription source remains reachable through:

`proposed_action.action_spec_ref`.

## 5. Approval and execution metadata boundary

The adapter does not copy into CandidateDecision parameters:

- timing window;
- device requirements;
- approval requirement;
- acceptance conditions;
- automatic task-issue hints.

`approval_requirement.required=true` becomes only a limitation noting that approval is still required.

`approval_requirement.required=false` still does not grant execution authority.

If `auto_execute_allowed=true`, the adapter fails closed.

Any explicit approval-request, approval-decision, operation-plan, task, dispatch or receipt identity also fails closed.

## 6. Evidence / calculation boundary

Legacy prescription `evidence_refs` remain provenance only.

They are not promoted into canonical `EvidenceQualificationV1` refs.

Prescription amount is an action-spec hint, not a canonical `CalculationResultV1`; B-06e records that limitation explicitly.

Canonical Evidence/Context/Stage/Calculation/Interpretation refs must be supplied explicitly.

## 7. Scope boundary

Prescription tenant/project/group/field scope is required and must match canonical scope.

Optional season/zone values, when present, must also match.

Scope is not inferred or repaired.

## 8. No runtime wiring

The adapter is registered as:

`REGISTERED_CAPABILITY_ISLAND / MANUAL / INTENTIONAL_NONE`.

It does not modify or connect:

- `/api/v1/prescriptions/from-recommendation`;
- `/api/v1/prescriptions/:prescription_id/submit-approval`;
- approval request/decision;
- operation plan;
- AO-ACT task/dispatch/receipt;
- MCFT implementation.

## 9. Machine governance

`G-B02-15-candidate-decision-instantiation` expands to exactly three registered adapter paths:

1. B-06c legacy recommendation adapter;
2. B-06d decision-plan adapter;
3. B-06e prescription action-spec adapter.

Any fourth CandidateDecision producer remains forbidden until separately registered.

CalculationResult governance remains unchanged.

## 10. Historical authority

B-06e does not remove or rewrite historical prescription behavior.

Historical semantic-authority removal remains B-09 only.

## 11. Completion gate

B-06e is complete only when one exact product head proves:

- READY_FOR_APPROVAL -> CANDIDATE_ONLY, not approval PASS;
- DRAFT incomplete amount remains explicit/limited PASS;
- downstream prescription statuses fail closed PASS;
- only explicit high-level action mappings are accepted PASS;
- SAMPLING/OTHER do not receive guessed authority PASS;
- legacy evidence refs remain provenance-only PASS;
- timing/device/approval/acceptance metadata are not promoted PASS;
- nested operation parameters are not promoted PASS;
- auto-execute capability fails closed PASS;
- explicit downstream ids fail closed PASS;
- scope mismatch/missing required scope fails closed PASS;
- approval-not-required still grants no execution authority PASS;
- exact CandidateDecision producer set = B-06c/B-06d/B-06e adapters only PASS;
- B-06e adapter has no production runtime consumer PASS;
- prescription runtime/approval route files remain untouched PASS;
- B-06d/B-06c/B-06b/B-06a/B-05/B-03/B-04 regressions PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.
