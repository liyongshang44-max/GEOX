# GEOX B-09e Evidence Consumer Dependency Analysis V1

## Status

B-09e is stacked on completed B-09d product head:

`ac0d2d43c4914d53075de0ebc4e76bfeeca12d88`.

B-09e is analysis/governance only.

It performs no consumer migration and no authority removal.

The frozen B-09 order remains:

```text
canonical replacement
-> shadow comparison
-> divergence inventory
-> consumer migration
-> authority removal
-> compatibility-only
-> disable default where safe
-> delete later
```

## Runtime corpus prerequisite

Before this analysis, validation-only run `33146582018` exercised the exact
B-09d product head through a real Postgres + server runtime.

Three Evidence Judge calls were persisted and read back through the B-09d
inventory:

```text
MATCH          = 1
DIVERGENT      = 1
INCOMPARABLE   = 1
CANONICAL_MISSING = 0
LEGACY_MISSING    = 0
```

Artifact:

```text
id      = 9676031155
name    = b09e-evidence-runtime-corpus
digest  = sha256:196d9730009af5b3feeb3f9af65177902c41e39a2ed156de2ca1ed69e08fdb0c
```

This is synthetic acceptance runtime evidence, not customer production traffic.

It is sufficient to analyze dependency behavior across the three observed
comparison classes.

It is not sufficient to authorize consumer migration or authority removal.

## Finding 1 — Evidence Judge self-surface is not the dangerous dependency

`POST /api/v1/judge/evidence/evaluate` currently:

```text
legacy Evidence Judge
-> B-04 canonical shadow
-> B-09c comparison
-> JudgeResultV2 persistence
```

At this route, divergence is observable.

The route does not itself create Approval, OperationPlan or Task authority.

The compatibility response may remain while downstream dependencies are
migrated.

That does not mean the legacy verdict can already be removed.

## Finding 2 — Agronomy Judge consumes a caller-injected verdict string

The Agronomy route accepts:

```text
evidence_judge_id
evidence_judge_verdict
```

but `evaluateAgronomyJudgeV2` does not consume or load
`evidence_judge_id`.

The domain consumes only:

```text
evidence_judge_verdict
```

Therefore the current relationship is not:

```text
persisted Evidence Judge result
-> verified Agronomy Judge consumer
```

It is:

```text
caller supplied string
-> Agronomy Judge legacy gate
```

This explains why the ownership graph correctly keeps C-004 as
`runtime_edge=NOT_PROVEN`.

## Finding 3 — the legacy evidence-to-action mapping is lossy

Agronomy Judge blocks only when the caller-supplied legacy verdict is one of:

```text
DEVICE_OFFLINE
INSUFFICIENT_EVIDENCE
STALE_DATA
```

`SENSOR_DRIFT` is not in that blocking set.

This means downstream behavior cannot be migrated by simply renaming a legacy
verdict to a canonical status.

## Observed DIVERGENT consequence

The runtime corpus proved:

```text
legacy Evidence Judge = PASS
canonical Evidence sufficiency = NEEDS_EVIDENCE
comparison = DIVERGENT
```

If a caller forwards only the legacy `PASS` into the current Agronomy Judge:

```text
blockedByEvidence = false
```

and agronomy calculation can proceed.

That is a real semantic dependency difference.

It is exactly why consumer migration must occur before legacy Evidence Judge
authority can be removed.

## Observed INCOMPARABLE consequence

The runtime corpus also proved:

```text
legacy Evidence Judge = PASS
canonical side = UNKNOWN
reason = field scope absent
comparison = INCOMPARABLE
```

The current caller-injected Agronomy input can still forward only `PASS`.

The canonical missing-scope uncertainty is then absent from the Agronomy Judge
gate.

An INCOMPARABLE case therefore cannot be treated as a harmless MATCH.

## Finding 4 — B-07 already defines the target semantic boundary

B-07c explicitly froze:

```text
Agronomy Judge BLOCKED
-> QUALIFIED_EVIDENCE = MISSING criterion
!= final BLOCK
```

B-07d/B-07e own final action-level Decision Eligibility.

Therefore B-09 must not replace the legacy Agronomy evidence shortcut with
another direct canonical evidence blocker.

The target migration is:

```text
canonical EvidenceQualification support
-> B-07 criterion semantics
-> canonical Decision Eligibility aggregation
```

not:

```text
canonical Evidence status
-> Agronomy Judge direct BLOCK
```

## Finding 5 — Stage-1 is a separate unresolved Evidence authority

The Evidence family has another grandfathered producer:

`stage1-formal-gate`.

Its runtime edge to the Stage-1 recommendation path is proven.

B-09b defines a pure Stage-1 comparator, but B-09c/B-09d deliberately kept it
disconnected.

Therefore the Evidence Judge runtime corpus says nothing about Stage-1
equivalence.

Family-wide Evidence authority removal remains forbidden until Stage-1 receives
its own governed shadow comparison, divergence inventory and consumer
migration/reclassification.

## Machine-readable inventory

B-09e adds:

`GEOX-B09E-EVIDENCE-CONSUMER-DEPENDENCY-INVENTORY-V1.json`.

It records:

- exact runtime corpus evidence;
- current legacy producers;
- current consumer dependency classes;
- observed MATCH/DIVERGENT/INCOMPARABLE consequences;
- B-07 target boundary;
- migration prerequisites;
- explicit removal prohibition.

## Non-effects

B-09e does not modify:

- Evidence Judge runtime;
- Agronomy Judge runtime;
- Stage-1;
- canonical EvidenceQualification;
- CandidateDecision;
- Decision Eligibility runtime;
- Approval;
- OperationPlan;
- Task;
- database/schema;
- MCFT;
- ADR;
- LLM.

It does not change `GEOX-B09-REPLACEMENT-READINESS-V1.json`.

Therefore:

```text
consumer_migration_state = PARTIAL
authority_removal_state = PENDING_CONSUMER_MIGRATION
authority_removal_performed = false
```

remain unchanged.

## B-09e completion gate

B-09e is complete only when one exact product head proves:

- runtime corpus evidence identity locked PASS;
- MATCH/DIVERGENT/INCOMPARABLE observed counts locked PASS;
- Agronomy route accepts evidence_judge_id/verdict PASS;
- Agronomy domain does not load evidence_judge_id PASS;
- Agronomy domain consumes caller-injected verdict PASS;
- exact legacy blocking set locked PASS;
- SENSOR_DRIFT remains outside that blocking set PASS;
- C-004 remains NOT_PROVEN PASS;
- Stage-1 C-003 remains PROVEN PASS;
- Stage-1 comparator remains disconnected PASS;
- B-07c direct BLOCK mapping remains forbidden PASS;
- B-09a consumer migration remains PARTIAL PASS;
- B-09a authority removal remains false PASS;
- 29 grandfathered authorities remain unchanged PASS;
- no runtime/schema/MCFT mutation PASS;
- B-02 governance PASS;
- general CI/full acceptance PASS;
- MCFT boundary lanes PASS.

Only after B-09e may a bounded Agronomy evidence-dependency migration seam be
designed.

That next phase still may not remove legacy authority until migrated behavior is
shadow-proven.
