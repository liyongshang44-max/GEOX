# GEOX B-06d decision_plan_v0 → CandidateDecision Compatibility Adapter V1

## 0. Status

B-Line bounded B-06 candidate-adapter phase stacked exactly on completed B-06c product head:

`cae164a925c02a5a1d675648eb784085a4b28c11`

This phase adds a pure compatibility projection capability only.

No decision_plan producer or runtime consumer is activated.

## 1. Frozen source semantics

The repository's frozen Decision / Plan v0 contract states:

`decision_plan_v0 = candidate for execution`.

It is not:

- approval;
- task;
- schedule;
- prescription;
- trigger;
- execution authority.

Sprint 16 further freezes it as ledger-only and non-coupling.

B-06d therefore maps only the proposal meaning into:

`CandidateDecisionV1`

with:

`source_class = LEGACY_DECISION_PLAN`

and:

`authority_state = CANDIDATE_ONLY`.

## 2. Source contract intersection

B-06d deliberately takes the strict intersection of the Sprint 15 and Sprint 16 frozen semantics.

The adapter requires:

- `record_json.type = decision_plan_v0`;
- a payload;
- `decision_scope = proposal`;
- a complete `proposed_action.action_type`;
- an explicit target;
- subject group scope consistent with canonical scope.

It rejects status, priority, recommendation, trigger/condition, state, next-action, executor, schedule/execution fields, resource locks and `auto_*` semantics anywhere in the source payload.

This prevents a historical plan-shaped object from being used to smuggle later control authority back into CandidateDecision.

## 3. Scope boundary

`subject_ref.groupId` must equal canonical `scope.group_id`.

For a field target, target ref must equal canonical `scope.field_id`.

For a group target, target ref must equal canonical `scope.group_id`.

Scope is not inferred or repaired.

## 4. Evidence boundary

Legacy:

`based_on.evidence_refs`

remain legacy provenance only.

They are not promoted into:

`evidence_qualification_refs`.

Canonical EvidenceQualification refs must be supplied explicitly.

Legacy fact ids may be retained only in `legacy_source_refs`.

## 5. Context / Calculation / Interpretation boundary

The adapter does not derive:

- ContextSnapshot;
- crop-stage authority;
- CalculationResult;
- Agronomy Interpretation.

Canonical refs must be supplied explicitly by the caller.

This keeps B-06d downstream of the already-frozen canonical contracts.

## 6. Parameter boundary

Only scalar legacy `parameters_hint` values may be projected.

Nested objects/arrays are omitted and marked with:

`LEGACY_NESTED_PARAMETERS_NOT_PROMOTED_TO_PARAMETERS_HINT`.

CandidateDecision's downstream-authority-key guard remains authoritative.

## 7. Timestamp / confidence boundary

Legacy `created_at_ts` is not silently promoted to canonical `created_at`.

Canonical `created_at` is explicit adapter input.

Legacy confidence is accepted only when finite and in `[0,1]`; invalid confidence becomes null plus an explicit limitation.

## 8. No runtime wiring

The adapter is registered as:

`REGISTERED_CAPABILITY_ISLAND / MANUAL / INTENTIONAL_NONE`.

It does not add:

- decision_plan API;
- facts writer;
- Judge consumer;
- Agronomy consumer;
- Scheduler consumer;
- AO-ACT consumer;
- Approval consumer;
- Plan/Task/Execution consumer.

Historical Sprint 15/16 negative boundaries remain intact.

## 9. Machine governance

`G-B02-15-candidate-decision-instantiation` is expanded from the B-06c adapter set to exactly two registered paths:

1. legacy recommendation CandidateDecision adapter;
2. decision_plan_v0 CandidateDecision adapter.

Any third CandidateDecision producer remains forbidden unless separately registered.

CalculationResult governance remains unchanged from B-06b.

## 10. Historical authority

B-06d does not remove or rewrite historical objects.

No historical semantic authority is removed before B-09.

## 11. Completion gate

B-06d is complete only when one exact product head proves:

- valid decision_plan_v0 proposal -> CandidateDecisionV1 PASS;
- authority_state remains CANDIDATE_ONLY PASS;
- legacy evidence refs remain provenance-only PASS;
- non-proposal decision_scope fails closed PASS;
- status/priority/trigger/execution semantics fail closed PASS;
- scope mismatch fails closed PASS;
- nested parameters do not gain candidate parameter authority PASS;
- downstream-authority parameter tokens fail contract validation PASS;
- legacy timestamp is not silently promoted PASS;
- wrong record type/incomplete action fails closed PASS;
- exact CandidateDecision producer set = B-06c + B-06d adapters only PASS;
- B-06d adapter has no production runtime consumer PASS;
- Sprint 15/16 Decision Plan negative boundaries remain unchanged PASS;
- B-06c/B-06b/B-06a/B-05/B-03/B-04 regression boundaries PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.
