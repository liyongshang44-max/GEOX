# GEOX B-08a Decision Episode Contract V1

## Status

B-08 begins only after overall B-07 closure.

Authoritative B-07 product head:

`ddcb5f75a77731f5f564b21f831d4c7a98ff726c`.

Authoritative literal exact-product-head B-07 closure validator:

`33106695125 = SUCCESS`.

B-08a is contract-first only.

It creates no production Decision Episode assembler and connects no real MCFT/ADR/LLM implementation.

## Purpose

`DecisionEpisodeV1` is a trace/projection object.

It answers:

> Which governed decision-time inputs, reasoning references, CandidateDecision, DecisionEligibility result, and downstream commercial-chain authority objects belong to one decision episode?

It does not itself decide or authorize anything.

## Decision-time core

A DecisionEpisode requires:

- scope;
- offset-aware decision_time;
- governed authority input refs;
- reasoning refs;
- CandidateDecision ref;
- DecisionEligibility ref;
- assembled_at;
- authority_state=TRACE_ONLY.

Candidate and eligibility are referenced, not embedded or duplicated.

The Episode does not repeat the eligibility verdict.

## Authority input trace

The typed decision-time authority-input section can reference:

- EvidenceQualification;
- ContextSnapshot;
- crop-stage state;
- physical State;
- Forecast;
- Scenario;
- KnowledgeClaim;
- Policy;
- Permission;
- ActionWindow.

Unknown/missing context or state remains representable by null/empty refs plus explicit limitations.

No fallback value is fabricated.

## Reasoning refs

The Episode may trace:

- CalculationResult refs;
- agronomy Interpretation refs;
- deterministic reasoning refs;
- human reasoning refs;
- LLM reasoning refs.

These are references only.

Reasoning is not authority.

The reasoning section cannot carry CandidateDecision payloads or eligibility verdicts.

## Decision authority refs

The Episode traces:

- CandidateDecision ref;
- DecisionEligibility ref;
- optional ApprovalRequest ref;
- optional ApprovalDecision ref;
- optional ApprovedOperationPlan ref.

The Episode does not create those objects or repeat their authority state.

## Existing commercial-chain trace

The Episode can also reference:

- AO-ACT Task;
- Receipt;
- AsExecuted;
- AsApplied;
- Acceptance;
- outcome evidence;
- Field Memory.

This satisfies the original B-line requirement that Decision Episode can represent the existing commercial chain while preserving each existing authority boundary.

## Forbidden authority shortcuts

DecisionEpisodeV1 cannot contain top-level:

- PASS/DEGRADED/NEED_EVIDENCE/HUMAN_REVIEW/BLOCK verdict;
- approved flag;
- eligibility-pass flag;
- approval authorization;
- Task authority;
- execute flag;
- device command.

Its fixed authority state is:

`TRACE_ONLY`.

## Integration boundary

B-08a does not define or connect real adapters.

The contract deliberately has no:

- mcft_adapter configuration;
- adr_runtime configuration;
- llm_provider configuration.

At B-08a:

- real MCFT adapter = NOT CONNECTED;
- real ADR runtime = NOT CONNECTED;
- real LLM provider = NOT CONNECTED.

Typed ports are separate later B-08 phases.

## Machine governance

B-08a introduces a new ownership semantic:

`decision.episode`.

Current state:

`BOUNDARY_CLEAR_TARGET_NOT_YET_PRODUCT_CONNECTED`.

It also adds:

`G-B02-19-decision-episode-instantiation`.

At B-08a its registered production assembler path set is empty.

Any production `decisionEpisodeV1Schema.parse(...)` call is forbidden until a later B-08 phase explicitly registers the assembler.

## Historical authority

B-08a does not remove or alter any historical authority.

All grandfathered removals remain B-09 only.

## Completion gate

B-08a is complete only when one exact product head proves:

- typed decision-time trace contract PASS;
- CandidateDecision and DecisionEligibility refs mandatory PASS;
- authority objects referenced rather than embedded PASS;
- strict rejection of verdict/approval/task/device-command shortcuts PASS;
- reasoning refs remain non-authoritative PASS;
- downstream commercial chain representable by refs PASS;
- unknown context/state remains explicit PASS;
- timestamps offset-aware PASS;
- real MCFT/ADR/LLM provider configuration absent PASS;
- authority_state fixed TRACE_ONLY PASS;
- zero production DecisionEpisode assemblers PASS;
- unregistered assembler negative governance PASS;
- B-07 overall regression PASS;
- B-09-only removal boundary preserved PASS;
- no MCFT/ADR/LLM implementation mutation PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.
