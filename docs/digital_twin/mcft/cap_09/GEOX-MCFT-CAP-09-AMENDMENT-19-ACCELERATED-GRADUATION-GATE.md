# GEOX MCFT-CAP-09 Amendment-19 — Accelerated Graduation Gate

Status: **CANDIDATE — NOT EFFECTIVE UNTIL EXACT-HEAD PROOF AND PROTECTED-MAIN MERGE**

Exact predecessor protected main:

```text
da6670633ffb8ef8a9b509043138a1e5550484c3
```

This document does not change the Amendment-19 provider/runtime cadence ruling. It adds implementation constraints so accelerated qualification cannot become a second implementation.

## 1. One canonical semantic core

The persistence-free accelerated lane and the future production persistent lane SHALL use the same production-facing canonical core:

```text
apps/server/src/runtime/twin_runtime/external_formal_amendment19_canonical_tick_core_v1.ts
executeExternalFormalAmendment19CanonicalTickV1
```

The core owns this semantic chain:

```text
current-interval forcing selector
        ↓
State process propagation
        ↓
soil observation assimilation
        ↓
future forcing selection
        ↓
Forecast
        ↓
canonical A1/A2 record-set candidate
```

The persistence-free acceptance may construct inputs and advance explicit logical time, but it MUST NOT:

```text
reimplement State math
reimplement Forecast math
introduce an engineering-only selector
introduce a simplified runner
replace canonical record-set construction
```

Direct State/Forecast math imports from the persistence-free 24T acceptance are forbidden. It must call the canonical core directly.

Before `PERSISTENT_24T` may pass, the production persistent path must call the same core symbol.

## 2. Persistent accelerated lane differs only by waiting clock

The fresh-v3 persistent 24T qualification must be as close as possible to Formal.

The accelerated clock may replace only:

```text
wait until next PT1H scheduler boundary
```

It may not replace the production execution graph.

The following must be the real production implementations:

```text
fresh v3 schema
exact Runtime Config chain
persistence repositories
scheduler
lease / fencing
runner
health
checkpoint
lineage
canonical record-set builders
```

An in-memory repository, simplified runner, or engineering-only persistence graph cannot satisfy `PERSISTENT_24T`.

## 3. Required fault and semantic matrix

The full accelerated qualification must include all of these cases:

```text
O00_WARM_START_REAL_CAUSAL_GFS_H1
MULTI_TICK_MODE_B_ASSUMED_DEGRADED
BOUNDARY_COMPLETE_EXACT_KBS_PAIR_SWITCHES_MODE_A
PARTIAL_EXACT_PAIR_DOES_NOT_MIX_AND_MODE_B_REMAINS_WHOLE
LATE_EXACT_AFTER_TERMINAL_DOES_NOT_CHANGE_STATE_OR_CHECKPOINT_HASH
PROCESS_RESTART_CONTINUES_FROM_CHECKPOINT
MISSED_SLOT_OLDEST_FIRST_BACKFILL
SAME_SLOT_REEXECUTION_IDEMPOTENT_NO_DUPLICATE_CANONICAL_WORK
NO_ASSUMPTION_PAIR_BLOCKS_EXPLICITLY_WITHOUT_WAIT
POST_24T_STATE_FORECAST_HEALTH_LINEAGE_READBACK_CONSISTENT
```

## 4. Mode B is not an observation

Mode B means only:

```text
causally available forecast assumption
→ current process forcing
```

It MUST remain:

```text
epistemic_class = ASSUMED
Runtime health   = DEGRADED
```

And it MUST NOT become:

```text
fake observation
persistence fill
source substitution
timestamp relabel
retroactive state rewrite
```

A partial exact provider pair may be retained as context/evidence, but it cannot be mixed into the current process forcing pair. The complete prior-step causal assumption pair remains the selected Mode B forcing.

## 5. Formal epoch creation is a machine gate

A future Formal epoch MUST NOT be created unless all of the following are terminal `PASS`:

```text
PERSISTENCE_FREE_24T
PERSISTENT_24T
O00_WARM_START
MODE_A
MODE_B
PARTIAL_PAIR
LATE_EXACT_NO_REWRITE
RESTART
MISSED_SLOT_BACKFILL
IDEMPOTENCY
ZERO_PROVIDER_WAIT
SCHEMA_ENV_PREFLIGHT
FULL_CHAIN_READBACK
```

And:

```text
static_blocker_count = 0
```

There is no human override under this authority.

This implementation unit may prove only the persistence-free subset. It does not authorize a Formal epoch.

## 6. Final 24-hour run remains mandatory

The accelerated lanes are development and qualification tools. They do not replace the final Stage-1B wall-clock proof.

The final run must still prove:

```text
24 actual UTC boundaries
real GitHub/runner scheduling
long-lived DB connection and state survival
real provider availability changes
real network jitter
real restart/retry timing
cross-24h checkpoint continuity
no future leakage
```

Its role is:

```text
GRADUATION_TEST
```

not:

```text
DEVELOPMENT_LOOP
```

## 7. Development sequence

```text
code change
  ↓
persistence-free canonical 24T
  ↓
persistent production-graph 24T on fresh v3
  ↓
fault injection matrix
  ↓
machine gate: all PASS, blocker_count = 0
  ↓
freeze exact main/config/schema/environment
  ↓
select earliest safe future Formal epoch
  ↓
one real wall-clock 24h graduation test
```
