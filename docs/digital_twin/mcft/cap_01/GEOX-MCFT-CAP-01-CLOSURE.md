<!-- docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-CLOSURE.md -->
# MCFT-CAP-01 Closure

```text
capability_line_id: MCFT-CAP-01
display_alias: MCFT-1
name: First-Class Water State Estimate
runtime_mode: REPLAY
target_completion_level: Level A
delivery_slice_id: MCFT-CAP-01.CLOSURE-V1
runtime_delivery_main_commit: 4a0fd03beb05298028101a4999c67a5e053dadb8
closure_readiness_head: 273843b09a7fe2e71f2cb9ea5c4ca14dcee8e3e5
status: COMPLETE
transition_effective_condition: PR_2315_MERGED_AND_VERIFIED_ON_MAIN
```

## 1. Closure meaning

MCFT-CAP-01 closes one bounded vertical capability line: a first-class root-zone water State estimate in controlled Replay mode.

The established proof is limited to:

```text
one controlled bootstrap posterior
one atomic A0 bootstrap transaction
aggregate idempotency
rebuildable A0 projections
one INITIAL lineage
one INITIAL checkpoint
one BLOCKED Forecast result
one explicit next-tick handoff
```

This is not the Minimum Complete Field Twin and is not MCFT Gate A, Gate B, or Gate C.

## 2. Completed delivery chain

```text
S1 Canonical Replay Dataset       COMPLETE
S2 A0 Contracts and Config        COMPLETE
S3A A0 Persistence                COMPLETE
S3B Bootstrap State Math          COMPLETE
S4 A0 Runtime Integration         COMPLETE
S5 Capability Closure             COMPLETE
```

The executable chain is:

```text
frozen MCFT-00 authority
→ controlled Canonical Replay records
→ immutable Runtime Config
→ frozen Evidence Window
→ static bootstrap prior
→ governed H=1 observation operator
→ scalar Gaussian assimilation
→ first-class posterior root-zone water State
→ deterministic nine-object A0 record set
→ fenced atomic PostgreSQL commit
→ six rebuildable projections
→ INITIAL lineage
→ BLOCKED zero-point Forecast result
→ INITIAL checkpoint
→ explicit next-tick handoff
```

## 3. Executable evidence

### Foundation

```text
S1 Replay Dataset Gate: 12 PASS, 0 FAIL
S2 Contracts/Config Gate: 10 PASS, 0 FAIL
S3A Static Persistence Gate: 16 PASS, 0 FAIL
S3A PostgreSQL Gate: 8 PASS, 0 FAIL
Foundation Governance Gate: 11 PASS, 0 FAIL
Foundation merge commit: b0b364933956a65345b927c6c5618e9d4ebe22af
```

### Bootstrap State mathematics

```text
S3B State Math Gate: 108 PASS, 0 FAIL
S3B Closure Gate: 36 PASS, 0 FAIL
S3B merge commit: 5d17e6ad9944376bbb5a71c9d801aa4472afe592

posterior_mean: 0.192595
posterior_variance: 0.002678
posterior_stddev: 0.051746
storage_mean_mm: 57.778512
available_water_fraction: 0.403306
depletion_from_field_capacity_mm: 32.221488
confidence.status: NOT_ESTABLISHED
```

### A0 Runtime integration

```text
S4 Static Runtime Gate: 20 PASS, 0 FAIL
S4 PostgreSQL Runtime Gate: 12 PASS, 0 FAIL
S4 Closure Gate: 57 PASS, 0 FAIL
S4 merge commit: 4a0fd03beb05298028101a4999c67a5e053dadb8

fault stages: 17
partial writes: 0
canonical facts: 9
projections: 6
lineage kind: INITIAL
checkpoint kind: INITIAL
Forecast status: BLOCKED
Forecast points: 0
latest successful Forecast rows: 0
next tick: 2026-06-01T02:00:00.000Z
```

### Capability closure

```text
Closure Readiness Gate: 104 PASS, 0 FAIL
server Typecheck: PASS
server Build: PASS
git diff --check: CLEAN
working tree: CLEAN
CI #4462 build-test: SUCCESS
CI #4462 acceptance: SUCCESS
changed files: 6 governance-only files
```

## 4. Completion claims

```text
MCFT_CAP_01_COMPLETE
FIRST_CLASS_WATER_STATE_ESTIMATE_LEVEL_A_ESTABLISHED
CONTROLLED_REPLAY_BOOTSTRAP_CLOSURE_ESTABLISHED
```

These claims mean that GEOX can deterministically create and atomically commit one first-class root-zone water posterior State from controlled Replay Evidence under a frozen Runtime Config, preserve uncertainty and INITIAL lineage, produce a governed BLOCKED Forecast result, rebuild the six A0 projections, and hand off the next logical tick.

They do not mean that the system can propagate water dynamics or run continuously.

## 5. Owner work-package status

Capability-line closure does not complete all contributing owner work packages.

```text
MCFT-01 COMPLETE
  30-day controlled Canonical Replay Dataset

MCFT-02 PARTIALLY_ESTABLISHED
  A0 canonical object and immutable Runtime Config subset only

MCFT-03 PARTIALLY_ESTABLISHED
  A0 persistence, fenced lease, aggregate idempotency and six-projection subset only

MCFT-04 PARTIALLY_ESTABLISHED
  one controlled A0 bootstrap transaction and next-tick handoff only

MCFT-05 PARTIALLY_ESTABLISHED
  one frozen bootstrap Evidence Window only

MCFT-06 NOT_STARTED
  no propagation model

MCFT-07 PARTIALLY_ESTABLISHED
  static bootstrap observation operator and scalar Gaussian assimilation only

MCFT-08 PARTIALLY_ESTABLISHED
  one first-class posterior State, INITIAL lineage and checkpoint handoff only

MCFT-09 PARTIALLY_ESTABLISHED
  BLOCKED zero-point Forecast result only
```

## 6. Preserved nonclaims

```text
NO_PROPAGATION
NO_SUCCESSFUL_FORECAST
NO_SCENARIO
NO_RECOMMENDATION
NO_DECISION
NO_AO_ACT
NO_CONTINUOUS_RUNTIME
NO_CONTINUOUS_SCHEDULER
NO_RESTART_BACKFILL_PROOF
NO_LATE_EVIDENCE_REVISION_RUNTIME
NO_LIVE_FIELD_CLAIM
NO_MCFT_GATE_A_CLOSURE
NO_MCFT_GATE_B_CLOSURE
NO_MCFT_GATE_C_CLOSURE
NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
```

`MCFT-CAP-01 COMPLETE` is a strictly smaller claim than `MCFT-GATE-A COMPLETE`.

## 7. Governance-only boundary

The closure slice changes only closure status, capability matrix, implementation map, closure records, and governance acceptance.

It does not change:

```text
apps/server Runtime source
persistence implementation
migration files
canonical object contracts
fixtures
public routes
web or Operator UI
workflow configuration
MCFT-00 artifacts or authority hashes
```

## 8. Effectiveness

The closure record and status are marked `COMPLETE`, but the transition becomes effective only after PR #2315 merges into `main` and the merged main commit is verified.
