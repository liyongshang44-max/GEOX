# GEOX B-09d Evidence Shadow Inventory V1

## Status

B-09d is stacked exactly on completed B-09c product head:

`b35efbccfdaccf543c982d9ef8643a08bd7214e9`.

B-09d adds one read-only inventory over persisted B-09c Evidence shadow
comparisons.

It does not produce EvidenceQualification, change a legacy verdict, migrate an
authoritative consumer, remove authority, create a schema/database, or connect
MCFT / ADR / LLM.

## Source of truth for the inventory

B-09d reads only existing `judge_result_v2` rows with:

```text
judge_kind = EVIDENCE
```

and inspects:

```text
outputs.semantic_shadow_comparison_v1
```

A row contributes to MATCH / DIVERGENT / INCOMPARABLE / CANONICAL_MISSING /
LEGACY_MISSING counts only if that output is a valid persisted
`SemanticShadowComparisonV1` for:

```text
semantic_id = evidence.qualification
legacy_producer_id = evidence-judge-v2
```

## No retrospective fabrication

Historical Judge rows that predate B-09c, or otherwise have no valid persisted
comparison, are counted only as:

```text
unobserved_legacy_result_count
```

They are not reinterpreted as:

```text
MATCH
DIVERGENT
INCOMPARABLE
CANONICAL_MISSING
LEGACY_MISSING
```

A malformed persisted comparison increments:

```text
malformed_comparison_count
+
unobserved_legacy_result_count
```

This keeps missingness and divergence evidence-faithful.

## Read-only API

B-09d adds:

```text
GET /api/v1/judge/shadow/evidence/inventory
```

The route:

- requires existing Judge read authorization;
- requires the full tenant/project/group scope;
- optionally filters by field;
- reads at most 200 recent Evidence Judge rows;
- performs no write;
- returns only bounded comparison trace metadata.

The inventory item does not expose a new verdict, approval, plan, task, or
execution object.

## Authority boundary

The inventory always declares:

```text
authority_state = SHADOW_ONLY
authority_removal_permitted = false
consumer_migration_permitted = false
removal_readiness = NOT_AUTHORIZED_BY_INVENTORY
```

Therefore:

```text
many MATCH
!= authority removal

DIVERGENT
!= rewrite legacy

inventory exists
!= consumer migration
```

## Machine governance

B-09d explicitly registers one additional read-only consumer of persisted
shadow-comparison output:

```text
evidence-shadow-inventory-read-model-v1
```

classified as:

```text
REPORTING_ARTIFACT_PLANE
API_ONLY
PROVEN
```

The comparator remains `SHADOW_ONLY_COMPARATOR`.

The Parallel Authority Graph adds one persisted-data read edge only. Current
parallel historical-authority removal edges remain unchanged.

## Real-evidence interpretation

An inventory with zero observed comparisons is valid.

B-09d must not claim real divergence evidence merely because fixtures prove the
aggregator.

Only persisted B-09c observations count as observed runtime comparison
evidence.

Likewise, `LEGACY_MISSING` is not synthesized merely to populate every
contract state. It may remain zero if the current Evidence Judge observation
plane cannot prove such a case.

## Completion gate

B-09d is complete only when one exact product head proves:

- inventory contract/typecheck PASS;
- MATCH / DIVERGENT / INCOMPARABLE aggregation PASS;
- unobserved historical rows are not fabricated into semantic states PASS;
- malformed persisted comparisons remain unobserved PASS;
- explicit missing states are counted only when explicitly persisted PASS;
- non-Evidence Judge rows are ignored PASS;
- inventory route is read-only and tenant-scoped PASS;
- inventory exposes no Approval/Plan/Task authority PASS;
- comparator remains SHADOW_ONLY PASS;
- all 29 grandfathered historical producers remain unchanged PASS;
- current parallel-authority removal graph remains unchanged PASS;
- B-09a `authority_removal_performed=false` PASS;
- Stage-1 comparator remains disconnected PASS;
- real MCFT / ADR / LLM remain disconnected PASS;
- server typecheck/build PASS;
- general CI/full acceptance PASS;
- four MCFT boundary lanes PASS.

B-09d does not authorize consumer migration or authority removal.

The next step after sufficient real observations is consumer-dependency
analysis against actual divergent/incomparable cases, not deletion.
