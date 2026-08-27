# GEOX B-06e Root-Zone Scenario → CandidateDecision Compatibility Adapter V1

## 0. Status

B-Line bounded B-06 candidate-adapter phase stacked exactly on completed B-06d product head:

`14c0085ca58efb4e6f9fc83f0ff80b1d9a5765d8`

This phase creates a pure compatibility capability only.

It does not modify either legacy Operator Twin POST route or the root-zone scenario builder.

## 1. Why a separate adapter is required

B-06c covers persisted recommendation payloads whose candidate action is the top-level `action_type`.

The root-zone scenario selection writer persists a different `decision_recommendation_v1` shape:

`source = ROOT_ZONE_SCENARIO_SELECTION`

`recommendation_kind = IRRIGATION_CANDIDATE_FROM_SCENARIO`

`proposed_action = { action_type, total_irrigation_mm, total_effective_irrigation_mm, timing }`.

Therefore this source needs a bounded scenario-specific adapter rather than widening B-06c into a permissive historical-object parser.

## 2. Candidate action mapping

Only explicit root-zone candidate actions are accepted:

- `IRRIGATE` with `DAY0`;
- `DELAYED_IRRIGATION` with `DAY3`.

`NO_ACTION` is already rejected upstream by the frozen root-zone submission builder and is not a CandidateDecision action here.

The adapter may carry only the explicitly declared scalar candidate hints:

- irrigation amount;
- effective irrigation amount;
- timing.

These remain non-executable `parameters_hint`.

## 3. Required legacy boundary proof

The source must explicitly prove:

- `status = CANDIDATE`;
- `human_approval_required = true`;
- `no_direct_execution = true`;
- approval/operation-plan/task/dispatch/ROI/field-memory created flags are all false;
- selected option quality is `COMPARABLE`;
- legacy evidence-quality blocking is false;
- scenario derivation is explicit;
- auto-selection is false;
- source scope matches canonical tenant/project/group/field/zone scope.

If any of these are absent or contradictory, projection fails closed.

## 4. Evidence quality is not canonical Evidence Qualification

The root-zone payload requires legacy evidence refs and legacy quality fields before it is created.

B-06e does not treat either as canonical `EvidenceQualificationV1`.

Legacy `evidence_refs` are not promoted.

Canonical EvidenceQualification refs remain explicit caller inputs.

The output records that legacy scenario quality is not equivalent to canonical Evidence authority.

## 5. Unknown confidence is preserved

The persisted root-zone decision recommendation does not carry a candidate confidence value.

B-06e therefore sets:

`confidence = null`

and records:

`LEGACY_SCENARIO_CONFIDENCE_NOT_REPORTED`.

It does not synthesize confidence from scenario quality.

## 6. Ordinary Operator scenario writer remains unmappable

The second preserved Operator scenario writer persists a `decision_recommendation_v1` with:

- scenario id;
- selected option id;
- evidence refs;
- candidate status;

but no `action_type` and no `proposed_action`.

That object does not answer:

`What action should be considered?`

B-06e therefore does not invent an action from the option id or fetch external scenario state to guess one.

It remains an explicit legacy unresolved frontier until a frozen source contract can provide action semantics.

## 7. No runtime wiring

The B-06e adapter is:

`REGISTERED_CAPABILITY_ISLAND / MANUAL / INTENTIONAL_NONE`.

It has no route, job, Operator Module, approval, prescription, plan, task or execution consumer.

B-06e does not modify:

- Operator Twin routes;
- root-zone scenario builder;
- Rule Engine;
- Agronomy Agent;
- Decision Engine;
- prescription;
- approval;
- operation plan;
- Decision Eligibility;
- AO-ACT/task/dispatch/execution;
- MCFT provider/scheduler/Formal/Twin persistence/schema/binding.

## 8. Machine governance

After B-06e, `G-B02-15-candidate-decision-instantiation` permits exactly three adapter paths:

- B-06c persisted recommendation adapter;
- B-06d Rule Engine adapter;
- B-06e root-zone scenario adapter.

Any fourth CandidateDecision producer remains forbidden unless explicitly registered in a later bounded B-06 phase.

## 9. Historical authority

The legacy Operator scenario recommendation writer remains registered and active.

B-06e does not remove or redirect either POST route.

The ownership register records that the root-zone shape is adapter-mappable while the ordinary actionless scenario shape is not yet a valid CandidateDecision source.

Historical authority removal remains B-09 only.

## 10. Completion gate

B-06e is complete only when one exact product head proves:

- root-zone IRRIGATE recommendation -> CandidateDecisionV1 PASS;
- delayed irrigation preserves explicit DAY3 candidate semantics PASS;
- authority remains CANDIDATE_ONLY PASS;
- legacy evidence refs are not promoted to EvidenceQualification PASS;
- downstream-created flags fail closed PASS;
- actionless scenario payload cannot fabricate CandidateDecision PASS;
- source scope mismatch fails closed PASS;
- invalid action/timing pairing fails closed PASS;
- missing canonical zone scope fails closed PASS;
- confidence remains UNKNOWN/null rather than fabricated PASS;
- canonical timestamps/provenance remain caller-explicit PASS;
- exact CandidateDecision producer set = B-06c + B-06d + B-06e adapters only PASS;
- exact CalculationResult producer set remains B-06b adapter only PASS;
- adapter has no production runtime consumer PASS;
- B-06d/B-06c/B-06b/B-06a/B-05/B-03/B-04 regression boundaries PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.
