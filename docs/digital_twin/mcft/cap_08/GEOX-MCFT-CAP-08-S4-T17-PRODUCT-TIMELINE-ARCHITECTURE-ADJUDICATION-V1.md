# MCFT-CAP-08 S4/T17 Product Timeline Architecture Adjudication V1

## Status

**ACCEPTED AS MACHINE CONTRACT; PRODUCT IMPLEMENTATION NOT AUTHORIZED**

Decision time: `2026-08-01T08:15:00.000Z`
Base main: `94d0da2afef241d73d52bf3f19b359c74151fbaa`
Predecessor freeze: `GEOX-MCFT-CAP-08-S6-STAGE-1A-END-TO-END-CLOSURE-NOT-ESTABLISHED-V1.json`

The formal authority chain remains `PAUSED`. This ADR does not authorize V10, formal RUN_A, RUN_B, an S6 Candidate, migration, database execution, or qualification v3.

## Decision

MCFT-CAP-08 S6 T17 uses one dedicated transition protocol:

```text
authority-bound
dual-predecessor
A1-only
four-pointer CAS
single-transaction
replay-first classification
audit-witnessed
fail-closed
```

It is not a generic time-correction platform and does not modify generic CAP-04 persistence semantics.

## Formal dataset outcome

The frozen Stage-1A input must be recomputed through the existing future-forcing selector.

```text
T17 outcome = A1 COMPLETED
A2 = OUT_OF_SCOPE_FOR_MCFT_CAP_08_S6_FORMAL_RUN
```

The focused static validator reconstructs the T17 forcing-relevant records from the frozen fixture and final-formal rainfall profile, recomputes the existing selector, and freezes the resulting proof hash.

Any `BLOCKED` or `FAILED` selector result produces:

```text
FORMAL_DATASET_INVARIANT_VIOLATION
```

This decision occurs before lease acquisition and before a database transaction.

## Dual predecessor model

The transition has two independent predecessor groups.

### Expected database latest before commit

```yaml
state:               base T16
checkpoint:          base T16
forecast_result:     base T16
successful_forecast: base T16
```

### Computation and record identity predecessor

```yaml
state:               corrected T16
checkpoint:          corrected T16
forecast_result:     corrected T16
successful_forecast: corrected T16
scenario_set:        corrected T16
previous_tick_sequence: corrected T16
```

The explicit base successful-forecast binding is mandatory. No equivalence between forecast-result latest and successful-forecast latest is inferred.

## Transition identity

One transition is permitted for:

```text
transition_kind
+ formal_run_id
+ six-key scope
+ lineage_id
+ revision_id
+ T17 logical time
```

`transition_id` and `transition_idempotency_key` are derived only from this uniqueness key. The complete authority, base, corrected, and committed-T17 bindings determine the witness determinism hash.

Therefore:

```text
same uniqueness key + different payload
→ same transition identity
→ different determinism hash
→ IDEMPOTENCY_CONFLICT
```

## Minimal transition witness

The witness stores only:

- transition identity;
- correction-authority ref/hash;
- four base latest bindings;
- corrected predecessor bindings;
- committed T17 record-set ID and aggregate hash;
- committed T17 state/checkpoint/forecast-result/successful-forecast bindings;
- transition semantic enum;
- determinism hash.

It does not duplicate the authority payload, full A1 record set, forecast points, or mathematical trace. Corrected-predecessor consumption is revalidated from canonical A1 aggregate identity and deterministic member references.

## Persistence boundary

Generic CAP-04 interfaces and repository behavior remain unchanged.

The only new interface is:

`Cap08S4T17TransitionPersistencePortV1.commitAuthorityBoundA1Transition`

Routing is permitted only when all of the following are exact:

- next Tick is T17;
- S4 authority ref/hash is present;
- handoff equals the authority-bound corrected predecessor;
- formal dataset A1 proof is valid.

There is no fallback to generic CAP-04 persistence.

## Transaction and exact replay

The transaction is `SERIALIZABLE` and uses a transaction-scoped advisory lock on the transition idempotency key.

Replay classification occurs before base-T16 CAS.

```text
exact record set + exact witness + exact transition guard + latest exact T17
→ EXISTING_IDEMPOTENT_SUCCESS
→ zero writes
```

```text
exact record set + exact witness + exact transition guard + latest not exact T17
→ POST_TRANSITION_PROJECTION_DIVERGENCE
→ no repair
→ zero writes
```

Only a completely absent transition may enter the first-commit base-T16 CAS path.

## Serialization retry

Only PostgreSQL SQLSTATE `40001` is retryable.

```text
max attempts: 3
retry delays: 25 ms, 100 ms
jitter: forbidden
scope: full transaction from BEGIN
connection: reacquired
advisory lock: reacquired
replay classification: repeated
transaction state reuse: forbidden
```

After attempt 3:

```text
SERIALIZABLE_RETRY_EXHAUSTED
```

## A1 atomic commit

The first successful commit atomically establishes:

- T17 A1 canonical facts;
- A1 record-set idempotency guard;
- minimal transition witness fact;
- transition idempotency guard;
- state latest = T17;
- checkpoint latest = T17;
- forecast-result latest = T17;
- successful-forecast latest = T17.

Any fault before COMMIT rolls back the complete set.

## Explicit non-decisions

This ADR does not authorize:

- A2 transition implementation;
- corrected T16 as an intermediate latest state;
- a generic correction/revision platform;
- generic CAP-04 CAS changes;
- qualification-only bypasses;
- migration or database execution;
- V10 or any execution authority.

## Machine-contract files

- `GEOX-MCFT-CAP-08-S4-T17-TRANSITION-STATE-MACHINE-V1.json`
- `GEOX-MCFT-CAP-08-S4-T17-SQL-TRANSACTION-SPECIFICATION-V1.json`
- `GEOX-MCFT-CAP-08-S4-T17-ACCEPTANCE-MATRIX-V1.json`
- `cap08_t17_transition_contracts_v1.ts`
- `cap08_t17_transition_witness_identity_v1.ts`
- `cap08_t17_transition_persistence_port_v1.ts`

## Completion condition

This ADR package is complete only when:

- the frozen T17 input recomputes to `SELECTED / A1_COMPLETED`;
- the negative non-A1 vector fails closed;
- transition identity is deterministic and conflict-preserving;
- `40001` bounded full-transaction retry is exact;
- `POST_TRANSITION_PROJECTION_DIVERGENCE` is an explicit terminal outcome;
- TypeScript contracts compile;
- the state machine has no undefined branch;
- generic CAP-04 and all current product persistence implementations are byte-identical;
- Runtime implementation, migration, database execution, and authority deltas remain zero.

The only legal successor after this ADR is a separately authorized narrow product implementation package for the dedicated T17 transition protocol.
