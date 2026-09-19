# GEOX B-09c Evidence Runtime Shadow Collection V1

## Status

B-09c is stacked exactly on completed B-09b product head:

`742cddefb82a8faa5657a35ed5dce1ad10d41f17`.

B-09c connects exactly one existing B-09b comparator path to the already-existing
Evidence Judge runtime shadow seam.

It does not migrate any authoritative consumer, change a legacy verdict, remove
historical authority, create a new database/schema, or connect MCFT / ADR / LLM.

## Why this seam

The Evidence Judge route already has both sides needed for an honest runtime
comparison:

```text
legacy Evidence Judge verdict
+
B-04 canonical EvidenceQualification sufficiency shadow
```

The route already persists `JudgeResultV2.outputs`.

B-09c therefore does not create a new endpoint or storage model. It adds the
comparison to that existing output envelope after the JudgeResult identity is
created and before the existing row is inserted.

## Runtime flow

```text
evaluateEvidenceJudgeV2WithCanonicalShadow
→ buildJudgeResultV2
→ collectEvidenceJudgeSemanticShadowComparisonV1
→ SemanticShadowComparisonV1
→ JudgeResultV2.outputs.semantic_shadow_comparison_v1
→ existing judge_result_v2 JSONB persistence
```

The historical `verdict`, `severity`, `reasons`, skill traces, evidence refs
and source refs remain unchanged.

## Comparison identity

Each collected comparison is bound to the created Judge result:

```text
comparison_id
= b09c:evidence-judge:<judge_id>

legacy_ref
= judge_result_v2:<judge_id>

canonical_ref
= judge_result_v2:<judge_id>#outputs.canonical_evidence_sufficiency_shadow_v1
```

This makes each runtime shadow observation independently auditable.

## Fail-open collection boundary

B-09c is observational.

If the canonical shadow is absent/malformed, or the collector cannot construct a
valid comparison, the collector returns `null`.

That failure must not alter or fail the historical Evidence Judge route.

The B-04 behavior remains intact:

```text
canonical read/qualification uncertainty
→ shadow UNKNOWN or no B-09c comparison
→ legacy compatibility verdict unchanged
```

## Authority boundary

Every successfully collected comparison remains:

```text
authority_state = SHADOW_ONLY
authority_removal_permitted = false
```

A persisted MATCH is evidence of coarse sufficiency agreement for that
observation only.

It is not authority-removal permission.

A DIVERGENT result is evidence to investigate consumers; it does not rewrite the
legacy verdict.

INCOMPARABLE remains a valid and expected result.

## Stage-1 remains disconnected in B-09c

B-09b also defines a Stage-1 comparator, but B-09c does not connect it.

The machine governance adds a negative static guard so
`compareStage1GateToCanonicalEvidenceShadowV1` remains confined to its pure
comparator definition until a later explicit B-09 phase.

In particular:

```text
NOT_ELIGIBLE + NO_FORMAL_STAGE1_SIGNAL
→ still INCOMPARABLE
```

No Stage-1 runtime behavior is changed.

## Machine governance

B-09c changes the Evidence comparator from an isolated capability to one
explicitly bounded ACTIVE_PARALLEL shadow edge.

Exactly one registered runtime consumer is permitted:

```text
evidence-semantic-shadow-comparator-v1
→ evidence-shadow-runtime-collector-v1
```

The route attachment is separately guarded so the collector cannot silently
proliferate into other product paths.

The Parallel Authority Graph records only the new non-authoritative shadow
connectivity. No `current_parallel_edges` authority-removal entry is added.

## No migration / no removal

B-09c leaves all grandfathered producer records unchanged:

```text
grandfathered_duplicate = true
removal_target = B-09
```

and leaves:

```text
authority_removal_performed = false
```

in the B-09a replacement-readiness inventory.

Evidence consumer migration is not performed by this phase.

## Completion gate

B-09c is complete only when one exact product head proves:

- runtime collector contract fixtures PASS;
- legacy Judge result is byte-for-byte unchanged before shadow attachment PASS;
- MATCH persists as `SHADOW_ONLY` PASS;
- independent canonical support produces DIVERGENT PASS;
- canonical UNKNOWN produces INCOMPARABLE PASS;
- collector failure cannot fail or rewrite the legacy path PASS;
- exactly one comparator runtime consumer is registered PASS;
- exactly one route attachment of the collector is registered PASS;
- Stage-1 comparator remains without a runtime consumer PASS;
- `authority_removal_performed=false` PASS;
- all 29 grandfathered producer records remain unchanged PASS;
- no current parallel-authority removal edge changes PASS;
- no MCFT / ADR / LLM connection changes PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.

After B-09c, real Evidence Judge runtime calls can accumulate actual MATCH /
DIVERGENT / INCOMPARABLE observations in existing persisted Judge results.

Consumer dependency analysis remains a later B-09 step.
