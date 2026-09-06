# GEOX B-09h Agronomy Qualified Evidence Criterion Shadow V1

## Status

B-09h is stacked exactly on completed B-09g product head:

`1abb9c2fa818efb455c43da93e4efeadd492e199`.

B-09h instantiates one shadow-only `QUALIFIED_EVIDENCE` criterion observation
from the auditable canonical EvidenceQualification provenance established by
B-09g.

It does not perform consumer migration, Decision Eligibility cutover, legacy
authority removal, or MCFT / ADR / LLM integration.

## Why this is a separate shadow producer

B-07c already contains a compatibility adapter for Agronomy Judge semantics,
but that adapter requires a canonical `candidate_ref` and explicit canonical
basis refs.

The current Agronomy Judge route is not yet bound to a canonical
CandidateDecision.

B-09h therefore must not connect the B-07c adapter or B-07e runtime by
inventing a candidate identity.

Instead it projects a criterion-shaped shadow observation with:

```text
candidate_binding_state = NOT_BOUND
candidate_ref = null
decision_eligibility_runtime_connected = false
direct_verdict_authority = NONE
```

## Input authority

B-09h consumes only:

`AgronomyEvidenceDependencyShadowBindingV1`.

A criterion can be projected only when:

- binding_state = BOUND;
- criterion_shadow_provenance_readiness = READY_FOR_CRITERION_SHADOW;
- canonical sufficiency is known;
- canonical EvidenceQualification provenance state is internally consistent.

Legacy Agronomy evidence_refs or caller-supplied raw refs are never promoted.

## Criterion mapping

For canonical sufficiency:

```text
SUFFICIENT
  + one or more direct canonical qualification refs
  -> QUALIFIED_EVIDENCE = SATISFIED

NEEDS_EVIDENCE
  + available qualification refs
  -> QUALIFIED_EVIDENCE = MISSING

NEEDS_EVIDENCE
  + known empty canonical qualification set
  -> QUALIFIED_EVIDENCE = MISSING, support_refs=[]

UNKNOWN / unbound / provenance unavailable
  -> no criterion assessment
  -> projection_state = NOT_READY
```

MISSING is criterion-level semantics. It is not final Decision Eligibility
`NEED_EVIDENCE` and never means `BLOCK`.

## Divergence preservation

A B-09c `DIVERGENT` comparison does not prevent construction of the
canonical criterion shadow when canonical provenance is otherwise complete.

The divergence is preserved as metadata:

`LEGACY_CANONICAL_DIVERGENCE_PRESERVED`.

It is not resolved, hidden, or promoted into authority.

## Runtime attachment

The existing Agronomy Judge route now persists:

```text
outputs.agronomy_evidence_dependency_shadow_v1
outputs.agronomy_qualified_evidence_criterion_shadow_v1
```

The historical Agronomy Judge result is constructed before both shadows and
remains compatibility authority.

The new shadow is not passed to `runDecisionEligibilityRuntimeV1`.

## Governance

B-09h explicitly registers a third criterion-instantiating path under
G-B02-17:

- B-07b Stage-1 precursor adapter;
- B-07c Agronomy Judge precursor adapter;
- B-09h Agronomy qualified-evidence shadow adapter.

The B-09h producer is classified:

`SHADOW_ONLY_ELIGIBILITY_CRITERION`.

New connectivity:

- C-038: B-09f binding -> B-09h criterion shadow;
- C-039: B-09h criterion shadow -> bounded Agronomy Judge output attachment.

`current_parallel_edges` remain unchanged because no historical authority is
removed or replaced.

## Non-effects

B-09h does not change:

- EvidenceQualificationV1;
- B-04/B-09g canonical evidence projection semantics;
- historical Evidence Judge verdict logic;
- historical Agronomy Judge domain logic;
- Stage-1;
- B-07b/B-07c adapters;
- B-07d evaluator;
- B-07e runtime;
- CandidateDecision;
- Approval/Plan/Task/execution;
- B-09 replacement readiness;
- database/schema;
- MCFT / ADR / LLM.

## Completion gate

B-09h is complete only when one exact product head proves:

- SUFFICIENT -> shadow QUALIFIED_EVIDENCE=SATISFIED PASS;
- NEEDS_EVIDENCE -> shadow QUALIFIED_EVIDENCE=MISSING PASS;
- known empty qualification set -> MISSING with zero support refs PASS;
- UNKNOWN / unbound / provenance unavailable -> no criterion PASS;
- DIVERGENT remains visible and non-authoritative PASS;
- exact support_refs equal B-09g canonical qualification refs PASS;
- candidate_binding_state remains NOT_BOUND PASS;
- Decision Eligibility Runtime remains disconnected PASS;
- legacy Agronomy verdict/reasons/calculation outputs unchanged PASS;
- no final eligibility verdict/Approval/Plan/Task authority appears PASS;
- G-B02-17 contains exactly the two B-07 adapters plus B-09h shadow adapter PASS;
- C-038/C-039 are the only connectivity additions PASS;
- current_parallel_edges unchanged PASS;
- B-09 readiness unchanged PASS;
- all 29 grandfathered authority records unchanged PASS;
- Stage-1 comparator remains disconnected PASS;
- exact runtime proof persists the criterion shadow PASS;
- MCFT / ADR / LLM untouched PASS;
- server typecheck/build, general CI/full acceptance and all four MCFT boundary lanes PASS.

Only after B-09h may a later B-Line phase solve canonical CandidateDecision
binding for the Agronomy consumer. Consumer migration remains forbidden until
that candidate provenance exists and is shadow-proven.
