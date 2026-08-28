# GEOX B-09g Canonical EvidenceQualification Provenance Shadow V1

## Status

B-09g is stacked exactly on completed B-09f product head:

`f3fa6e4a27f833859e6d5bea77a43a02272a265d`.

B-09g resolves the provenance blocker identified by B-09f without performing
criterion cutover, consumer migration, or authority removal.

## Existing canonical identity

The B-03 contract already defines:

`EvidenceQualificationV1.qualification_id`.

The B-04 raw-sample projection already emits a deterministic identity:

```text
evidence_qualification_v1:raw_sample:<sample_id>:<decision_time_ms>
```

B-09g does not create a second identifier and does not wrap, rename, or hash the
existing identity.

## Evidence Judge shadow extension

The existing B-04e canonical sufficiency shadow now also persists:

```text
canonical_evidence_qualification_refs
canonical_evidence_qualification_refs_state
canonical_evidence_qualification_ref_basis = QUALIFICATION_ID_DIRECT
```

The refs are the exact `qualification_id` values already present in the
canonical projection.

No legacy `evidence_refs`, raw fact ids, Judge ids, or B-09c comparison refs
are promoted into EvidenceQualification refs.

## Ref states

For a successfully evaluated canonical projection:

- one or more qualifications -> `AVAILABLE`;
- zero qualifications -> `EMPTY_NO_CANONICAL_QUALIFICATIONS`.

For canonical read/build failure or missing field scope:

- refs = `[]`;
- state = `UNAVAILABLE`.

Zero qualifications is a known empty set, not a fabricated missing
EvidenceQualification.

B-03 supports MISSING evidence vocabulary, but the current B-04 raw-sample
projection does not synthesize a missing qualification object. B-09g preserves
that boundary.

## Identity integrity

The sufficiency facade requires one unique non-empty qualification identity per
projected qualification.

Duplicate/missing identities fail the canonical shadow build closed.

The outer Evidence Judge compatibility wrapper already degrades canonical
shadow failure to UNKNOWN while preserving the historical Evidence Judge
verdict.

## Agronomy referential binding propagation

B-09f's binding now propagates the persisted canonical refs when present.

It reports one of:

- `AVAILABLE_FROM_PERSISTED_CANONICAL_SHADOW`;
- `EMPTY_NO_CANONICAL_QUALIFICATIONS`;
- `LEGACY_SHADOW_WITHOUT_QUALIFICATION_REFS`;
- `UNAVAILABLE`.

Old persisted B-04/B-09c Judge rows remain readable. They are explicitly marked
`LEGACY_SHADOW_WITHOUT_QUALIFICATION_REFS` rather than having refs invented.

## Two readiness levels remain separate

When a BOUND referential shadow has:

- a known canonical sufficiency status;
- a B-09c comparison;
- and either an available qualification-ref set or a known empty set;

B-09g may report:

```text
criterion_shadow_provenance_readiness = READY_FOR_CRITERION_SHADOW
```

This means only that a later phase can construct a non-authoritative
QUALIFIED_EVIDENCE criterion shadow with auditable provenance.

It does **not** change:

```text
migration_readiness = NOT_READY_FOR_CRITERION_CUTOVER
consumer_migration_performed = false
authority_removal_permitted = false
```

## No Decision Eligibility producer

B-09g does not instantiate:

- DecisionEligibilityCriterionAssessmentV1;
- DecisionEligibilityDecisionV1;
- CandidateDecision;
- Approval;
- OperationPlan;
- Task.

The B-07 criterion producer guard remains exactly B-07b + B-07c.

## No new runtime edge

B-09g adds no route and no new consumer.

Existing B-04e/B-09f edges carry the additional provenance field.

Therefore the Parallel Authority Graph is unchanged.

## Non-effects

B-09g does not modify:

- canonical EvidenceQualification contract;
- raw-sample qualification semantics;
- legacy Evidence Judge verdict logic;
- Agronomy Judge domain logic;
- Stage-1;
- B-07 criterion/evaluator/runtime;
- B-09 replacement readiness;
- database/schema;
- MCFT / ADR / LLM.

## Completion gate

B-09g is complete only when one exact product head proves:

- qualification refs equal exact canonical qualification_id values PASS;
- non-empty projection -> AVAILABLE PASS;
- zero qualifications -> known empty ref set PASS;
- canonical read failure -> UNAVAILABLE PASS;
- duplicate qualification identity fails closed PASS;
- legacy Evidence Judge verdict unchanged on canonical ref failure PASS;
- B-09f binding propagates exact refs PASS;
- old persisted rows without refs remain not provenance-ready PASS;
- DIVERGENT / INCOMPARABLE semantics remain unchanged PASS;
- criterion_shadow_provenance_readiness is separate from migration readiness PASS;
- no DecisionEligibility criterion producer added PASS;
- B-07 criterion producer set unchanged PASS;
- Parallel Authority Graph byte-identical PASS;
- C-004/C-036/C-037 unchanged PASS;
- B-09 readiness unchanged PASS;
- all 29 grandfathered authority records unchanged PASS;
- Stage-1 comparator remains disconnected PASS;
- runtime HTTP proof from a persisted raw sample exposes exact qualification ref PASS;
- MCFT / ADR / LLM untouched PASS;
- B-09f/e/d/c/b/a and B-07 regressions PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- four MCFT boundary lanes PASS.

Only after B-09g may the next phase instantiate a **shadow-only**
QUALIFIED_EVIDENCE criterion from these canonical refs.

That future criterion remains non-authoritative until separately shadow-proven.
