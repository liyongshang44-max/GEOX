# GEOX B-08c Decision Episode Assembler V1

## Status

B-08c is stacked exactly on completed B-08b product head:

`c3672de04880616b2cae9ac4aaeff03b759d7db0`.

B-08a froze `DecisionEpisodeV1`.
B-08b froze the typed integration ports.
B-08c establishes the canonical trace aggregation capability as a domain capability island.

No external route, Approval mutation, execution mutation, MCFT adapter, ADR runtime, or LLM provider is connected.

## Trace inputs

The assembler consumes real canonical:

- `CandidateDecisionV1`;
- `DecisionEligibilityDecisionV1`.

It derives identity, scope, decision-time authority inputs, and canonical reasoning refs from those upstream objects rather than accepting caller-overridable copies.

## Candidate / Eligibility continuity

The assembler requires:

- exact scope equality;
- eligibility candidate_ref exactly identifies the supplied CandidateDecision;
- exact ContextSnapshot continuity;
- exact crop-stage-state continuity;
- every Candidate EvidenceQualification ref remains in eligibility inputs;
- one explicit matching non-null decision_time.

This prevents a Decision Episode from joining unrelated candidate and eligibility objects.

## Trace-only downstream chain

The assembler may represent the existing commercial chain through references:

`ApprovalRequest -> ApprovalDecision -> ApprovedOperationPlan -> Task -> Receipt / AsExecuted / AsApplied -> Acceptance -> OutcomeEvidence`.

These are references only.

The assembler never interprets the presence of a ref as newly creating or replacing the referenced authority.

`authority_state = TRACE_ONLY`.

## Downstream ordering

The trace fails closed on impossible ordering:

- ApprovalDecision without ApprovalRequest;
- ApprovedOperationPlan without ApprovalDecision;
- Task without approved-plan ref;
- Receipt/AsExecuted/AsApplied without Task;
- Acceptance without execution-evidence ref;
- OutcomeEvidence without Acceptance.

This is trace structural integrity, not approval/execution semantics.

## Reasoning refs

Canonical CalculationResult and interpretation refs are derived from CandidateDecision basis.

Additional deterministic/human/LLM reasoning trace refs may be represented, but are trace-only.

An LLM reasoning ref does not imply that a real LLM provider is connected.

## Time

`assembled_at` must not precede Candidate creation or Eligibility evaluation.

The Episode decision_time is inherited from the matched Candidate/Eligibility pair.

## Governance

`G-B02-19-decision-episode-instantiation` expands from zero producers to exactly one:

`apps/server/src/domain/decision/decision_episode_assembler_v1.ts`.

The assembler is:

`REGISTERED_CAPABILITY_ISLAND / MANUAL / INTENTIONAL_NONE`.

Any second DecisionEpisode producer remains forbidden.

The Decision Episode semantic current_state becomes `REGISTERED_CAPABILITY_ISLAND`.

## Integration boundary

B-08c does not instantiate any typed future integration port output/binding.

B-08b guards remain:

- decision-producer port output producer set = zero;
- future MCFT/ADR/LLM binding producer set = zero.

Real integrations remain disconnected.

## Completion gate

B-08c is complete only when one exact product head proves:

- real Candidate/Eligibility contract validation PASS;
- exact candidate identity/scope continuity PASS;
- exact context/stage/evidence continuity PASS;
- explicit matching decision_time PASS;
- assembly-time ordering PASS;
- complete commercial chain representable as references PASS;
- downstream trace ordering negative fixtures PASS;
- authority_state fixed TRACE_ONLY PASS;
- real MCFT/ADR/LLM remain disconnected PASS;
- DecisionEpisode producer set exactly one assembler PASS;
- second unregistered Episode producer rejected PASS;
- B-08b port-output/binding producer sets remain zero PASS;
- no external route/Approval/execution/MCFT mutation PASS;
- B-09-only removal boundary preserved PASS;
- B-08a/B-08b/B-07 and earlier regressions PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.
