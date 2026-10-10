# GEOX B-09b Evidence Semantic Shadow Comparator V1

## Status

B-09b is stacked exactly on completed B-09a product head:

`afd914deab6cac927a085694e8a3270c8e0720d8`.

B-09b adds one pure Evidence-family semantic comparator.

It does not connect a runtime consumer, migrate a consumer, change a legacy verdict, or remove authority.

## Existing B-04 shadow is reused

B-04 already provides:

`EvidenceJudgeCanonicalSufficiencyShadowV1`

derived from canonical EvidenceQualification role authority.

B-09b does not recompute QC, freshness, physical ranges, conflict, or source policy.

It compares legacy coarse sufficiency semantics to that existing canonical shadow.

## Evidence Judge coarse mapping

Legacy Evidence Judge:

- PASS -> SUFFICIENT;
- DEVICE_OFFLINE -> NEEDS_EVIDENCE;
- SENSOR_DRIFT -> NEEDS_EVIDENCE;
- STALE_DATA -> NEEDS_EVIDENCE;
- INSUFFICIENT_EVIDENCE -> NEEDS_EVIDENCE;
- any unknown/future verdict -> UNKNOWN.

Canonical shadow:

- SUFFICIENT -> SUFFICIENT;
- NEEDS_EVIDENCE -> NEEDS_EVIDENCE;
- UNKNOWN -> UNKNOWN.

MATCH is allowed only when both known coarse states agree.

## Independent-evidence divergence

The important B-04/B-09 divergence is explicit:

`legacy non-PASS + canonical SUFFICIENT`

becomes:

`DIVERGENT / LEGACY_REJECTS_WHILE_INDEPENDENT_CANONICAL_EVIDENCE_REMAINS_SUFFICIENT`.

This captures cases where one bad observation caused legacy rejection while independent canonical role-eligible evidence still supports the decision claim.

It does not automatically change legacy runtime authority.

## Stage-1 mapping

Stage-1 is compared only at its coarse evidence precursor layer:

- ELIGIBLE -> SUFFICIENT;
- NEEDS_EVIDENCE -> NEEDS_EVIDENCE.

Stage-1:

`NOT_ELIGIBLE + NO_FORMAL_STAGE1_SIGNAL`

is always:

`INCOMPARABLE`

because it means trigger absence, not an evidence conclusion.

It must never be compared as canonical evidence insufficiency or action BLOCK.

## UNKNOWN behavior

If either comparable coarse evidence side is UNKNOWN, the comparison is INCOMPARABLE.

UNKNOWN is never silently treated as MATCH.

## Shadow-only authority

Every output is:

`SemanticShadowComparisonV1`

with:

`authority_state = SHADOW_ONLY`

and:

`authority_removal_permitted = false`.

Even MATCH cannot authorize removal.

MATCH is explicitly limited to coarse sufficiency agreement and does not prove field-level semantic equivalence.

## Governance

`G-B02-22-semantic-shadow-comparison-instantiation`

expands from zero paths to exactly:

`apps/server/src/domain/decision/evidence_semantic_shadow_comparator_v1.ts`.

The comparator is:

`REGISTERED_CAPABILITY_ISLAND / MANUAL / INTENTIONAL_NONE`.

No runtime consumer is registered.

Any second shadow-comparison producer requires explicit later registration.

## No authority removal

B-09b does not alter:

- Stage-1;
- Evidence Judge;
- canonical EvidenceQualification runtime;
- Apple-II sufficiency;
- Decision Eligibility;
- Approval;
- OperationPlan;
- Task;
- MCFT.

The B-09a migration inventory remains true:

`authority_removal_performed = false`.

Evidence consumer migration remains incomplete.

## Next frontier

After B-09b qualification, a later B-09c may connect this comparator to the already-existing non-authoritative Evidence shadow output and collect an actual divergence inventory.

Only after observed shadow/divergence evidence and consumer migration may removal be adjudicated.

## Completion gate

B-09b is complete only when one exact product head proves:

- legacy PASS vs canonical SUFFICIENT MATCH PASS;
- known legacy failures vs canonical NEEDS_EVIDENCE MATCH PASS;
- independent canonical support divergence PASS;
- legacy PASS vs canonical NEEDS_EVIDENCE divergence PASS;
- canonical UNKNOWN incomparable PASS;
- unknown legacy verdict incomparable PASS;
- Stage-1 ELIGIBLE/NEEDS_EVIDENCE coarse comparison PASS;
- Stage-1 NOT_ELIGIBLE trigger absence incomparable PASS;
- all outputs SHADOW_ONLY / authority_removal_permitted=false PASS;
- exactly one registered shadow-comparison producer PASS;
- second unregistered shadow producer rejected PASS;
- comparator has no runtime consumer PASS;
- B-09a inventory still reports authority_removal_performed=false PASS;
- historical authority/runtime files untouched PASS;
- B-08/B-07 and earlier regressions PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.
