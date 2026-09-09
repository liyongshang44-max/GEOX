# GEOX B-08b Typed Decision Integration Ports V1

## Status

B-08b is stacked exactly on completed B-08a product head:

`0e87d8b9e5c6a5ca2bbeb308e7e631aa18fa7b14`.

This phase freezes typed integration seams only.

No real MCFT adapter, ADR runtime, or LLM provider is connected.

## Authority input ports

B-08b defines typed outputs for:

- GovernedEvidencePort;
- ContextAuthorityPort;
- TwinDecisionInputPort;
- KnowledgeClaimInputPort.

All authority input port outputs are:

`REFERENCE_ONLY`.

They carry references to already-governed authority objects.

They do not create CandidateDecision, Decision Eligibility, Approval, Task, or execution authority.

## Decision-producer ports

B-08b defines producer-port kinds:

- DeterministicCalculatorPort;
- HumanReasoningPort;
- LLMReasoningPort.

The only typed decision output is:

`CandidateDecisionV1`.

The wrapper authority remains:

`CANDIDATE_ONLY`.

Reasoning trace refs may be carried for audit.

Reasoning itself is not authority.

Strict schema rejects producer-port objects carrying:

- eligibility verdicts;
- approved flags;
- approval ids;
- operation-plan ids;
- task ids;
- device commands.

The embedded CandidateDecision contract also remains CANDIDATE_ONLY.

## Future real integrations remain disconnected

B-08b defines one structural future-binding descriptor for the three later-program integrations:

`MCFT -> TWIN_DECISION_INPUT`

`ADR -> KNOWLEDGE_CLAIM_INPUT`

`LLM -> LLM_REASONING`.

At B-08b the descriptor can represent only:

`binding_state = DISCONNECTED`

`adapter_ref = null`

`provider_ref = null`

`runtime_edge = INTENTIONAL_NONE`.

CONNECTED/PROVEN/non-null bindings are schema-invalid.

This satisfies the Amendment-01 B-08 exit constraint without pretending a future adapter/provider exists.

## Unknown preservation

ContextAuthorityPort permits:

`crop_stage_state_ref = null`.

Missing/unknown stage therefore remains explicit instead of being fabricated for integration convenience.

## No real runtime binding

B-08b does not modify or import:

- MCFT implementation;
- Twin production adapters/providers;
- ADR runtime;
- LLM SDK/provider code;
- Approval;
- OperationPlan;
- Task;
- execution.

The port contract has no production consumers in B-08b.

## Machine governance

New semantic:

`decision.integration_ports`.

Current state:

`BOUNDARY_CLEAR_TARGET_NOT_YET_PRODUCT_CONNECTED`.

Two new guards keep B-08b contract-only:

- `G-B02-20-decision-producer-port-output-instantiation`;
- `G-B02-21-future-integration-binding-instantiation`.

Both registered path sets are empty at B-08b.

Any production decision-producer-port output or integration-binding descriptor requires explicit later registration.

## Relationship to Decision Episode

Decision Episode may carry reasoning refs and authority refs, but it does not need a real MCFT/ADR/LLM adapter to exist.

B-08c may assemble the existing commercial chain into DecisionEpisodeV1 while all future external bindings remain DISCONNECTED.

## Completion gate

B-08b is complete only when one exact product head proves:

- four authority input port contracts PASS;
- authority input outputs remain REFERENCE_ONLY PASS;
- deterministic/human/LLM producer output is CandidateDecisionV1 only PASS;
- eligibility/Approval/Plan/Task/device contamination rejected PASS;
- CandidateDecision authority remains CANDIDATE_ONLY PASS;
- exact MCFT->Twin / ADR->Knowledge / LLM->Reasoning port mapping PASS;
- real integration bindings structurally DISCONNECTED PASS;
- connected/non-null/proven binding attempts rejected PASS;
- crop-stage UNKNOWN/null preserved PASS;
- production producer-port output count remains zero PASS;
- production future-binding descriptor count remains zero PASS;
- no MCFT/ADR/LLM runtime imports/consumers created PASS;
- B-08a/B-07/B-06/B-05/B-03/B-04 regressions PASS;
- B-09-only removal boundary preserved PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.
