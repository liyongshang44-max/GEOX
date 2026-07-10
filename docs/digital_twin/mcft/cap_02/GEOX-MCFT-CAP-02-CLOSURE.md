<!-- docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-CLOSURE.md -->
# GEOX MCFT-CAP-02 Closure V1

## 0. Identity

```text
closure_identity:
GEOX-MCFT-CAP-02-CLOSURE-V1

capability_line_id:
MCFT-CAP-02

display_alias:
MCFT-2

name:
Hourly Dynamics and Persistence

runtime_mode:
REPLAY

target_completion_level:
Level A

delivery_slice_id:
MCFT-CAP-02.CLOSURE-V1

status:
COMPLETE

closure_effective:
true

baseline_main_commit:
9a61e05f683adf3815ee1cc4af182efd23508588

activation_head:
8f63fc84c298a20d12094d100865af89e812ea31

branch:
mcft-cap-02-closure-v1
```

This Closure slice is governance and evidence aggregation only. It does not create a second Runtime path, alter Dynamics, change persistence semantics, add a migration, introduce a route, create a scheduler, or authorize MCFT-CAP-03.

## 1. Verified predecessor state

All nine predecessor delivery slices are merged. The latest verified predecessor is:

```text
MCFT-CAP-02.FAILURE-RECOVERY-V1
merge commit:
9a61e05f683adf3815ee1cc4af182efd23508588

application Failure Recovery:
6 PASS, 0 FAIL

existing persistence PostgreSQL:
15 PASS, 0 FAIL

Failure Recovery PostgreSQL:
8 PASS, 0 FAIL

Failure Recovery Final Gate:
86 PASS, 0 FAIL

candidate exact-head CI:
#4571 SUCCESS

READY exact-head CI:
#4572 SUCCESS

server typecheck:
PASS

server build:
PASS
```

## 2. Closure proof

The accumulated merged-main evidence establishes:

```text
persisted MCFT-CAP-01 predecessor consumption
no re-bootstrap
fixed 300 mm State coordinate
deterministic hourly water Dynamics
exact mass-balance closure
persisted additive process uncertainty budget
first continuation tick
24 contiguous continuation ticks
25-State immutable chain
continuation checkpoint chain
one active lineage and revision
per-tick atomic A2 commit
operation idempotency
same-key different-hash conflict
canonical uniqueness after idempotency projection loss
persisted restart and resume
bounded contiguous forward backfill
explicit projection rebuild
frozen final numerical State
consolidated negative and failure recovery surface
```

## 3. Completion claims

The following claims are effective because PR #2327 is merged and the merged-main Closure Gate passed.

```text
MCFT_CAP_02_COMPLETE
HOURLY_WATER_DYNAMICS_V1_ESTABLISHED
TWENTY_FOUR_CONTINUATION_TICKS_PERSISTED
CONTINUATION_STATE_CHAIN_ESTABLISHED
CONTROLLED_ADDITIVE_PROCESS_UNCERTAINTY_BUDGET_ESTABLISHED
CONTINUATION_CHECKPOINT_CHAIN_ESTABLISHED
CONTINUATION_OPERATION_IDEMPOTENCY_ESTABLISHED
CONTINUATION_CANONICAL_UNIQUENESS_ESTABLISHED
RESTART_RESUME_PROVEN
BOUNDED_FORWARD_BACKFILL_PROVEN
EXACT_HOURLY_EVIDENCE_SELECTION_ESTABLISHED
EXECUTED_IRRIGATION_INPUT_POLICY_ESTABLISHED
```

PR #2327 is merged and the merged-main Closure Gate passed with 161 PASS, 0 FAIL.

## 4. Preserved nonclaims

```text
NO_OBSERVATION_UPDATE_APPLIED
NO_OBSERVATION_INNOVATION_COMPUTED
NO_FORECAST_RESIDUAL
NO_SUCCESSFUL_FORECAST
NO_SCENARIO
NO_RECOMMENDATION
NO_DECISION
NO_AO_ACT
NO_CALIBRATED_CONFIDENCE_MODEL
NO_MODEL_ACTIVATION
NO_LATE_EVIDENCE_REVISION
NO_DYNAMIC_ROOT_ZONE_GEOMETRY
NO_SPATIAL_EXECUTION_OVERLAP_DEDUPLICATION
NO_CONTINUOUS_RUNTIME
NO_CONTINUOUS_SCHEDULER
NO_720_TICK_REPLAY_CLOSURE
NO_LIVE_FIELD_CLAIM
NO_MCFT_GATE_A_CLOSURE
NO_MCFT_GATE_B_CLOSURE
NO_MCFT_GATE_C_CLOSURE
NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
```


## 5. Exact changed-file boundary

```text
docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md
docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json
docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-CLOSURE-RECORD.json
docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-CLOSURE.md
docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_CLOSURE.cjs
```

Forbidden in this slice:

```text
apps/server/src/**
apps/server/db/migrations/**
apps/server/src/routes/**
apps/web/**
.github/workflows/**
existing fixture bytes
new Runtime semantics
new model semantics
successor authorization
```

## 6. Successor boundary

```text
successor:
MCFT-CAP-03 鈥?Observation Assimilation and State Innovation

authorized:
false

authorization:
NONE

required persisted start:
2026-06-02T01:00:00.000Z
```

MCFT-CAP-03 requires independent authorization after MCFT-CAP-02 is merged, verified on main, and effective.

## 7. Effectiveness condition

```text
CLOSURE_PR_MERGED_TO_MAIN
AND
MERGED_MAIN_MCFT_CAP_02_CLOSURE_GATE_PASS
```

Both conditions are satisfied by merge commit 08f0b5c146959b2a3988cd3ea07647628b0e84ad and the merged-main Gate result 161 PASS, 0 FAIL.
## 8. Readiness evidence

```text
implementation candidate head:
2c4c07ef56209d19f0fccea9da734ffcc31d02bb

Closure Draft Gate:
126 PASS, 0 FAIL

candidate exact-head CI:
#4574 SUCCESS

changed-file boundary:
6 files exact

server typecheck:
PASS

git diff --check:
PASS
```

At the READY transition, Closure remained non-effective. The later merge and merged-main verification activated the twelve completion claims; MCFT-CAP-03 remains unauthorized.
## 9. Final Gate evidence

```text
READY head:
c88f555685ad8d79618f6ceb21d702264f37bfe7

READY exact-head CI:
#4575 SUCCESS

Closure Final Gate on READY head:
141 PASS, 0 FAIL

24-tick PostgreSQL:
8 PASS, 0 FAIL

restart/backfill PostgreSQL:
8 PASS, 0 FAIL

persistence PostgreSQL:
15 PASS, 0 FAIL

Failure Recovery PostgreSQL:
8 PASS, 0 FAIL

server typecheck:
PASS

server build:
PASS

git diff --check:
PASS
```

The `SIMULATED_PRECOMMIT_PROCESS_CRASH` and `SIMULATED_RESPONSE_LOSS_AFTER_COMMIT` stack traces are expected fault-injection child-process output. Their parent acceptance completed with `8 PASS, 0 FAIL`.

This evidence was recorded before merge. PR #2327 and the merged-main Gate later made Closure effective; MCFT-CAP-03 remains unauthorized.
## 10. Canonical merged-main finalization

```text
Closure PR:
#2327

final evidence head:
800e1d255414b847587350d0f19b92288b32c1db

final exact-head CI:
#4576 SUCCESS

merge commit:
08f0b5c146959b2a3988cd3ea07647628b0e84ad

merged-main Closure Gate:
161 PASS, 0 FAIL

main verification:
docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-MAIN-VERIFICATION.json

capability status:
COMPLETE

closure effective:
true

MCFT-CAP-03 authorized:
false
```

The twelve taskbook completion claims are effective. The twenty-one taskbook nonclaims remain in force. No horizontal owner work package is marked COMPLETE by this capability-line closure.
