<!-- docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-S0-ALIGNMENT-REVIEW.md -->
# GEOX MCFT-CAP-03 S0 Alignment Review

## Status

```text
review_status:
THREE_WAY_ALIGNMENT_CONFIRMED_WITH_EXPECTED_HANDOFF_ERRATUM

baseline_main_commit:
d1a3948d06e4c7896d513168d31ef52409c3e0f0

active_delivery_slice_id:
MCFT-CAP-03.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1

runtime_source_write:
FORBIDDEN_IN_S0

formal_design_freeze:
PENDING_S0_MERGED_MAIN_AUTHORIZATION_GATE
```

## Three-way comparison

The following authorities were compared:

1. `GEOX_Complete_Agricultural_Digital_Twin_Handoff_2026-07-08` as the Minimum Complete Field Twin mainline authority.
2. `GEOX MCFT-CAP-03 — Observation Assimilation and State Innovation v1.2` as the bounded capability-line task authority.
3. Repository `main` at `d1a3948d06e4c7896d513168d31ef52409c3e0f0` as the implementation fact authority.

The three authorities agree on the following boundaries:

```text
runtime mode = REPLAY
completion target = Level A deterministic replay
predecessor = MCFT-CAP-02 COMPLETE
first new capability = observation-aware State assimilation
State assimilation != model calibration
observation innovation != Forecast residual
Forecast remains BLOCKED
Scenario remains unauthorized
Recommendation remains unauthorized
Decision remains unauthorized
AO-ACT remains unauthorized
late Evidence revision remains unauthorized
continuous Runtime remains unauthorized
```

## Repository facts confirmed

```text
main head = d1a3948d06e4c7896d513168d31ef52409c3e0f0
MCFT-CAP-02 status = COMPLETE
MCFT-CAP-02 closure_effective = true
MCFT-CAP-02 active_delivery_slice_id = null
MCFT-CAP-03 successor_authorized = false
PFA-3 PR #2298 = closed, not merged
open MCFT-CAP-03 PR = none before this slice
```

The repository already contains reusable implementation boundaries required by CAP-03:

```text
A_STATE_TICK_COMMIT
A2_BLOCKED_FORECAST
eight-object continuation aggregate
lease and fencing
expected-current State/checkpoint/Forecast CAS
idempotency guard
canonical readback
projection rebuild
fixed-point hourly Dynamics
SCALAR_GAUSSIAN_ASSIMILATION_V1
POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1
```

No DT-02 Architecture Amendment is justified at S0.

## Required handoff correction

The predecessor completion artifacts currently preserve this historical successor field:

```text
successor.required_start_logical_time = 2026-06-02T01:00:00.000Z
```

The CAP-02 twenty-four-tick range contract establishes:

```text
last continuation logical time = 2026-06-02T01:00:00.000Z
next logical time after range = 2026-06-02T02:00:00.000Z
checkpoint sequence = 24
```

Therefore `01:00` cannot be replayed as the first CAP-03 tick. The historical predecessor artifacts remain immutable. The correction is additive through:

```text
GEOX-MCFT-CAP-02-HANDOFF-ERRATUM-01.json
GEOX-MCFT-CAP-03-PREDECESSOR-LOCK.json
```

The final S0 authorization must fail closed unless the isolated PostgreSQL canonical checkpoint read returns exactly:

```text
checkpoint.payload.next_tick_logical_time = 2026-06-02T02:00:00.000Z
checkpoint.payload.tick_sequence = 24
```

## S0 implementation boundary

Permitted changes:

```text
CAP-03 task artifact
S0 alignment review
authorization document and status
predecessor handoff erratum
PostgreSQL-derived predecessor lock
Delivery Status
capability matrix and implementation map
Authorization Gate with --draft, --final and --postmerge
PostgreSQL predecessor preflight
```

Forbidden changes:

```text
Runtime source
assimilation math
Evidence selector
record-set builder
persistence transaction
migration
route
scheduler
web
CAP-02 historical artifact rewrite
CAP-03 tick execution
CAP-04 authorization
```

## Current implementation state

```text
three_way_alignment:
PASS

postgresql_predecessor_lock:
COMPLETE

checkpoint_tick_sequence:
24

checkpoint_next_tick_logical_time:
2026-06-02T02:00:00.000Z

S0_status:
READY_FOR_MERGE

design_status:
FINAL_FROZEN_CANDIDATE_V1_2

implementation_status:
NOT_AUTHORIZED

authorization_effective:
false

runtime_source_authorized:
false

MCFT-CAP-04:
NOT_AUTHORIZED
```

The only remaining S0 blockers are PR merge and the merged-main Authorization Gate. No Runtime capability claim is active.
