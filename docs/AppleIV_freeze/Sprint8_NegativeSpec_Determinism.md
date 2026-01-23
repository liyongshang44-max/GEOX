# Apple IV v0 · Sprint 8 Freeze

Scope name: **"Negative Spec + Determinism Discipline Freeze"**

This Sprint freezes constraints that are structural prerequisites for any future Agronomy v1 / Decision layer.

## 1. Role and Non-Goals (Negative Spec)

Agronomy v0 is a **read-only, deterministic projection** over the append-only ledger (`facts`).

The following are explicitly **forbidden** in Agronomy v0:

1) Ledger mutation
- MUST NOT write `facts`.
- MUST NOT create `task` / `receipt` facts.
- MUST NOT create markers as a side effect.

2) Control coupling
- MUST NOT trigger AO (no automatic action output).
- MUST NOT call Control endpoints.
- MUST NOT modify Judge state or `problem_state`.

3) Advice / judgement semantics
- MUST NOT emit prescriptions, suggestions, or action recommendations.
- MUST NOT downgrade or upgrade the meaning of evidence (no diagnosis, no scoring, no inference claims).

Operational consequence: Agronomy v0 may exist or be removed without breaking the system loop; it is not allowed to become a hidden dependency for Control/Judge correctness.

## 2. EvidenceRefs v0 Contract Freeze

Endpoint: `/api/agronomy/v0/evidence_refs`

### 2.1 Minimal schema
EvidenceRef is a pointer only:

```ts
type EvidenceRef = {
  kind: string;
  ref_id: string;
}
```

No optional fields are allowed.

### 2.2 Semantics
- EvidenceRef is a **reference**, not a snapshot.
- Any metadata (time, metric details, window context) belongs to the referenced object, not the reference.
- If callers need metadata, the correct path is: resolve `ref_id` back to the ledger (`facts`) or introduce a new endpoint/version.

### 2.3 Decoupling rule
`/evidence_refs` MUST NOT freeze or expose the internal structure of `/report` (e.g. `report.evidence` layout). Report presentation may evolve; evidence pointer list must remain stable.

## 3. Determinism Discipline

Agronomy v0 outputs MUST be replay-stable.

### 3.1 Determinism inputs
Determinism inputs are only those that are replayable from the ledger:
- Query parameters (`projectId`, `groupId`, `startTs`, `endTs`).
- Ledger facts reachable by those parameters.

The following are forbidden as implicit inputs:
- `now()` / wall-clock time.
- Randomness.
- Environment variables.
- Database row order without explicit ordering.
- Non-deterministic JSON property ordering.

### 3.2 Deterministic ordering
Any list in v0 responses MUST be explicitly ordered.
If an order is not explicitly specified, the order is **undefined** and therefore violates v0.

Minimum expectation:
- Metric list: sorted lexicographically by `metric`.
- Evidence refs list: sorted lexicographically by `kind`, then `ref_id`.

### 3.3 Empty set semantics
Empty is not an error, but must be deterministic.
- No samples / markers MUST yield empty arrays and counts of 0.
- Empty MUST still produce a deterministic hash/id for the same inputs.

## 4. Error Contract (Input Errors)

For invalid input (missing/invalid query params):
- MUST return HTTP 400
- MUST return JSON:

```json
{ "ok": false, "error": "<string>" }
```

No SQL details should be included in 500 responses.

## 5. Stability Constraint

The system MUST NOT produce TCP-level empty responses.
If a request cannot be served within a timeout policy, the endpoint should return a valid HTTP status (e.g. 503) with JSON; empty replies are always a bug.
