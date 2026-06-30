# docs/tasks/POSTV1-04-Route-Negative-Runtime-Matrix.md

## Purpose

POSTV1-04 adds a systematic negative runtime acceptance matrix for the Twin Kernel v1 productionization routes.

The task does not redesign route behavior. It records and tests the existing defensive contract around missing ids, unknown ids, malformed bodies, wrong operator session/review pairing, and forbidden automatic writes.

## Phase

```text
Post-Twin-Kernel-v1 Productionization
P1 Production Hardening
```

## Second audit result

Before implementation, repository facts were:

```text
POSTV1-01 Production Hardening Baseline is complete.
POSTV1-02 Strong Multi-Scope Fixture Pack is complete.
POSTV1-03 Ingestion Idempotency & Error Taxonomy is complete.
No POSTV1-04 PR exists.
No pv1-04 branch exists.
```

Route facts:

```text
TK13 exposes explicit formalization routes.
TK14 exposes operator workflow routes.
TK15 exposes production ingestion source-ref route.
TK16 is a multi-scope regression harness, not a separate backend route surface.
TK17 is a production UX/frontend surface over existing backend read routes, not a new backend write route.
TK18 exposes business closure readback.
```

## Scope

POSTV1-04 changes:

```text
docs/tasks/POSTV1-04-Route-Negative-Runtime-Matrix.md
scripts/governance_acceptance/POSTV1_04_ROUTE_NEGATIVE_RUNTIME_MATRIX.cjs
```

No server route is changed in this task.

## Runtime matrix

The acceptance covers these route families:

```text
TK13 decision cycle formalization
TK14 operator workflow
TK15 production ingestion
TK18 execution-to-learning business closure readback
```

TK16 and TK17 are covered as static boundary checks because they do not introduce independent backend write routes.

## Negative cases

The runtime acceptance checks:

```text
missing ids
unknown ids
malformed request bodies
invalid review status
wrong operator session/review pairing
production ingestion duplicate conflict
production ingestion malformed source refs
read-only business closure unknown id
read-only response forbidden automatic-write flags
```

## Boundary

```text
No new route.
No migration.
No UI.
No schema expansion.
No production adapter.
No automatic recommendation.
No automatic approval.
No AO-ACT task creation.
No receipt creation.
No acceptance creation.
No automatic ROI creation.
No automatic Field Memory creation.
No model update.
No change to operator formalization semantics.
```

## Acceptance command

```powershell
node scripts/governance_acceptance/POSTV1_04_ROUTE_NEGATIVE_RUNTIME_MATRIX.cjs
```

Required runtime:

```text
API server running on TWIN_KERNEL_BASE_URL or http://127.0.0.1:3001
A persisted field_learning_candidate_v1 fixture, defaulting to TK15's candidate id.
```

## Expected result

```text
ok = true
acceptance = POSTV1_04_ROUTE_NEGATIVE_RUNTIME_MATRIX
negative_case_count >= 18
wrong_pairing_rejected = true
forbidden_auto_write_flags_verified = true
next_step = POSTV1-05_DB_INDEX_QUERY_COST_AUDIT
```

## Remaining P1 tasks after POSTV1-04

```text
POSTV1-05 DB Index / Query Cost Audit
POSTV1-06 Docker Startup / Migration Runner Baseline
```
