# GEOX B-09f Agronomy Evidence Referential Shadow Binding V1

## Status

B-09f is stacked exactly on completed B-09e product head:

`fc2eaf47da19c5adeb0f455cf50946b9f760c96b`.

B-09f is the first Agronomy consumer-migration precursor that touches runtime,
but it remains strictly shadow/non-authoritative.

It does not change the historical Agronomy Judge verdict and does not perform
criterion cutover, final Decision Eligibility, Approval, Plan, Task, execution,
or Evidence authority removal.

## Problem established by B-09e

The Agronomy request accepts:

```text
evidence_judge_id
evidence_judge_verdict
```

but the historical domain gate consumes only the caller-injected verdict
string.

The ID is not referentially resolved.

This means the caller can currently supply a verdict that is:

- not bound to a persisted Evidence Judge;
- scoped to a different field;
- inconsistent with the persisted verdict;
- blind to a persisted B-09c DIVERGENT/INCOMPARABLE comparison.

## B-09f runtime seam

B-09f adds:

```text
evidence_judge_id
-> tenant/project/group scoped loadJudgeResultV2
-> verify Judge kind = EVIDENCE
-> verify field scope
-> compare caller verdict with persisted verdict
-> inspect B-04 canonical sufficiency shadow
-> inspect B-09c SemanticShadowComparisonV1
-> AgronomyEvidenceDependencyShadowBindingV1
-> Agronomy Judge outputs.agronomy_evidence_dependency_shadow_v1
```

This is observability only.

The historical call remains:

```text
evaluateAgronomyJudgeV2(body)
```

and still receives the same caller-injected `evidence_judge_verdict`.

B-09f does not substitute the bound result into that call.

## Binding states

The shadow reports one of:

- NOT_REQUESTED;
- EVIDENCE_JUDGE_NOT_FOUND;
- EVIDENCE_JUDGE_KIND_INVALID;
- FIELD_SCOPE_NOT_ESTABLISHED;
- FIELD_SCOPE_MISMATCH;
- LEGACY_VERDICT_MISSING;
- LEGACY_VERDICT_MISMATCH;
- CANONICAL_SHADOW_MISSING;
- CANONICAL_SHADOW_UNKNOWN;
- SEMANTIC_COMPARISON_MISSING;
- BOUND;
- BINDING_READ_ERROR.

All states remain non-authoritative.

## Why B-09f stops before B-07 criterion cutover

B-07e requires criterion support refs to belong to canonical runtime inputs.

The persisted Evidence Judge currently stores:

```text
canonical_evidence_sufficiency_shadow_v1
semantic_shadow_comparison_v1
```

but does not persist a resolvable set of canonical
`EvidenceQualificationV1` refs.

Therefore B-09f explicitly records:

```text
canonical_evidence_qualification_refs_state
= NOT_PERSISTED_IN_EVIDENCE_JUDGE_OUTPUT

migration_readiness
= NOT_READY_FOR_CRITERION_CUTOVER
```

when canonical sufficiency is observable.

The B-09c comparison ref:

```text
judge_result_v2:<id>#outputs.canonical_evidence_sufficiency_shadow_v1
```

is not promoted into an `EvidenceQualificationV1` ref.

Doing that would violate the B-07e provenance boundary.

## DIVERGENT / INCOMPARABLE preservation

A referentially valid binding may carry:

```text
semantic_comparison_state = DIVERGENT
```

and still be BOUND.

BOUND means the reference relationship is established.

It does not mean semantic equivalence.

If canonical sufficiency is UNKNOWN, B-09f reports:

```text
binding_state = CANONICAL_SHADOW_UNKNOWN
semantic_comparison_state = INCOMPARABLE
```

when that B-09c comparison exists.

It does not coerce UNKNOWN to a criterion status.

## B-07 target boundary

The target remains:

```text
canonical EvidenceQualification refs
-> QUALIFIED_EVIDENCE criterion
-> B-07 Decision Eligibility Runtime
```

not:

```text
canonical evidence shadow
-> direct Agronomy BLOCK
```

B-09f instantiates no new DecisionEligibilityCriterionAssessmentV1 producer.

The B-02 B-07 criterion producer guard therefore remains unchanged.

## Graph truth

B-09f does not rewrite C-004.

C-004 remains:

```text
evidence-judge-v2
-> agronomy-judge-v2
runtime_edge = NOT_PROVEN
status = NOT_WIRED
```

because the historical Agronomy authority still consumes a caller-injected
string.

B-09f adds two separate shadow edges:

```text
C-036
evidence-judge-v2
-> agronomy-evidence-dependency-shadow-binding

C-037
agronomy-evidence-dependency-shadow-binding-v1
-> judge-v2-agronomy-shadow-binding
```

Both are non-authoritative migration observability.

## Fail-open boundary

The binding loader converts scoped read failures into:

`BINDING_READ_ERROR`.

It must not fail the historical Agronomy route.

Likewise NOT_FOUND, mismatch, UNKNOWN and missing-comparison states are observed,
not promoted into historical Agronomy verdict changes.

## No migration / no removal

Every B-09f object declares:

```text
authority_mode = SHADOW_NON_AUTHORITATIVE
legacy_consumer_unchanged = true
consumer_migration_performed = false
authority_removal_permitted = false
migration_readiness = NOT_READY_FOR_CRITERION_CUTOVER
```

B-09 replacement readiness therefore remains:

```text
consumer_migration_state = PARTIAL
authority_removal_state = PENDING_CONSUMER_MIGRATION
authority_removal_performed = false
```

## Completion gate

B-09f is complete only when one exact product head proves:

- scoped evidence_judge_id binding PASS;
- cross-field mismatch detected PASS;
- caller/persisted verdict mismatch detected PASS;
- DIVERGENT preserved as shadow PASS;
- canonical UNKNOWN / INCOMPARABLE preserved PASS;
- old rows without B-09c comparison remain not cutover-ready PASS;
- no ID remains NOT_REQUESTED PASS;
- binding read failure cannot change legacy Agronomy result PASS;
- legacy Agronomy verdict/reasons/calculation outputs unchanged PASS;
- no DecisionEligibility criterion producer added PASS;
- B-07 criterion producer set unchanged PASS;
- C-004 remains NOT_PROVEN PASS;
- C-036/C-037 exact shadow edges PASS;
- B-09 readiness remains PARTIAL / pending migration / no removal PASS;
- all 29 grandfathered authorities unchanged PASS;
- Stage-1 remains separate/disconnected from B-09b comparator runtime PASS;
- MCFT / ADR / LLM remain untouched PASS;
- B-09e/d/c/b/a and B-07 regressions PASS;
- server typecheck/build PASS;
- general full acceptance PASS;
- four MCFT boundary lanes PASS.

After B-09f, the next blocker is explicit and narrow:

> establish auditable canonical EvidenceQualification support refs for the
> Agronomy Decision Eligibility criterion seam without promoting a coarse
> sufficiency shadow into canonical authority.

Only after that provenance blocker is solved may criterion-level migration be
shadowed.
