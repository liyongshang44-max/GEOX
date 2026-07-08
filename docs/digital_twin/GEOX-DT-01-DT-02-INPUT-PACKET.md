<!-- docs/digital_twin/GEOX-DT-01-DT-02-INPUT-PACKET.md -->
# DT-01 Input Packet for DT-02 Runtime Architecture Freeze

## 0. Purpose

This packet contains only architecture questions that DT-02 must decide. It does not decide final object names or API prefixes.

## 1. Canonical object atomicity

Decide whether one tick commits:

```text
one state_transition record containing prior, propagation, observation update, posterior
```

or an atomic set of separately addressable records.

Required invariant:

```text
no partially committed prior/prediction/posterior set
```

## 2. Domain/runtime/persistence boundaries

Freeze:

```text
domain pure calculations
runtime orchestration
persistence repositories
clock/ingress/scheduler/execution adapters
read APIs
human write APIs
```

Pure builders must not access DB, environment, random identity, or wall clock.

## 3. Canonical versus index persistence

Existing latest indexes are reusable patterns, not canonical history.

DT-02 must define:

```text
canonical append tables/facts
latest revision indexes
history readers
superseded revision readers
transaction ownership
```

## 4. Tick transaction

Decide the atomic boundary for:

```text
tick claim
evidence window
state transition
posterior
forecast run
checkpoint
health/result
```

Specify failure and retry semantics.

## 5. Checkpoint and recovery

No existing canonical checkpoint/restart recovery was found.

Freeze:

```text
checkpoint owner
last-completed tick identity
lease/lock
missed tick detection
backfill order
idempotent retry
restart health state
```

## 6. Late evidence revision

Freeze immutable revision fields:

```text
revision_id
supersedes_ref
revision_reason
late_evidence_refs
original_tick_ref
```

The same idempotency key must never refer to a changed payload.

## 7. Forecast storage

MCFT forecast is:

```text
source posterior at t0
+1h through +72h
exactly 72 forecast points
```

Decide run/point table split, uncertainty storage, weather/config refs, latest index, and revision behavior.

## 8. Scenario storage

Decide set/projection atomicity, fixed option identity, baseline link, forecast source, custom-option extension boundary, and separation from recommendation/approval.

## 9. Model governance

Decide registry ownership for:

```text
active model/config
candidate
shadow evaluation
activation
rollback
forecast consumption proof
```

P44/P50 provide governance references, not production registry implementation.

## 10. API naming

The current canonical frontend family is `/operator/fields/:fieldId/*`.

DT-02 must inventory existing server APIs before choosing an API prefix. It must not create a parallel API family without a compatibility rationale.

## 11. Legacy compatibility

Inventory and classify:

```text
/operator/twin/*
/app/operator/*/evidence-twin
legacy scenario submission
water_state_estimate_v1
legacy scenario indexes
```

For every deprecated path specify readers, compatibility period, replacement, and deletion prerequisite.

## 12. Architecture inputs that are retained

```text
append-only facts and provenance
tenant/project/group/field/zone scope
stable deterministic hashing
P50 explicit replay clock and no-future-leakage
root-zone aggregation and water-bucket formulas
latest-index pattern as read index
canonical Operator Field Runtime route shell
approval, operation-plan, AO-ACT task, receipt, and acceptance boundaries
ROI/Field Memory governance separation
```

## 13. Inputs that must not be promoted

```text
P31 synthetic DATA_COVERAGE_BELIEF as physical State
P42/P43 acceptance ledgers as database runtime
P50 demo math or file persistence
P57 freeze package as runtime implementation
route/tab existence as runtime proof
task creation as execution
acceptance as effect attribution
```
