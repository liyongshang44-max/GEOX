<!-- docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-AUTHORIZATION.md -->
# GEOX MCFT-CAP-02 Authorization V1

## 0. Authorization state

```text
authorization_id:
MCFT-CAP-02-AUTHORIZATION-V1

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

current_status:
READY_FOR_MERGE

authorization_effective:
false

authorization_effective_condition:
AUTHORIZATION_PR_MERGED_TO_MAIN_AND_POSTMERGE_GATE_PASS
```

This document freezes the bounded authorization contract for MCFT-CAP-02. Merged-main verification and canonical predecessor identity extraction are complete. Runtime source remains unauthorized until this authorization PR is merged into `main` and the postmerge authorization Gate passes from the merged authorization main commit.

## 1. Predecessor authority

```text
predecessor_capability_line_id:
MCFT-CAP-01

predecessor_implementation_candidate_head:
193f9785e42eb146e300e2a64abeed455f10e54e

predecessor_final_closure_head:
7fedd85815cd65f0e3d2aedc74e4d0d9ed1b0558

predecessor_merge_commit:
7da8fee4daf1f022edff29078a1bbac207d1a32f

predecessor_main_verification_commit:
53aa944da595c515619229d37be86930d7a2e7e7

predecessor_main_verification_artifact:
docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-MAIN-VERIFICATION.json

predecessor_lock_artifact:
docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-PREDECESSOR-LOCK.json
```

The verification artifact proves the exact merge commit, 173-pass closure Gate, server typecheck, server build, `git diff --check`, clean worktree and canonical identity extraction. The predecessor lock was populated only from isolated PostgreSQL canonical readback.

The locked predecessor handoff is:

```text
active_lineage_object_ref:
twin_runtime_lineage_31d5cdda3c87fdf1536f0233

lineage_id:
lineage_da76d015085f0d37bf2ed478

revision_id:
revision_e0c62f99ac3db66f60a87e2b

bootstrap_state_ref:
twin_state_estimate_a411d678b1d79b7a58b31fd7

bootstrap_checkpoint_ref:
twin_runtime_checkpoint_16dfbf70c99cd900d463406c

bootstrap_runtime_config_ref:
twin_runtime_config_851ac30201221a7aa2ce16f7

next_logical_tick_time:
2026-06-01T02:00:00.000Z
```

These are predecessor identities. This authorization does not assert that any continuation tick has run.

## 2. Authorized owner work packages

```yaml
authorized_owner_work_package_ids:
  - MCFT-02
  - MCFT-03
  - MCFT-04
  - MCFT-05
  - MCFT-06
  - MCFT-07
  - MCFT-08
  - MCFT-09

primary_owner_work_package_id:
  MCFT-06

excluded_owner_work_package_ids:
  - MCFT-10
  - MCFT-11
  - MCFT-12
  - MCFT-13
  - MCFT-14
  - MCFT-15
  - MCFT-16
  - MCFT-17
  - MCFT-18
```

Authorization of a work package in this capability line is bounded to the delivery slices below and does not mark the horizontal work package COMPLETE.

## 3. Delivery-slice graph

```text
MCFT-CAP-02.GOV-AUTHORIZATION-V1
↓
MCFT-CAP-02.MCFT-02.CONTINUATION-CONTRACTS-CONFIG-V1
↓
MCFT-CAP-02.MCFT-06.PURE-HOURLY-DYNAMICS-V1
↓
MCFT-CAP-02.MCFT-05.CONTINUATION-EVIDENCE-WINDOW-V1
↓
MCFT-CAP-02.MCFT-03.CONTINUATION-PERSISTENCE-V1
↓
MCFT-CAP-02.MCFT-04-06-08-09.SINGLE-TICK-INTEGRATION-V1
↓
MCFT-CAP-02.MCFT-04-08.TWENTY-FOUR-TICK-RANGE-V1
↓
MCFT-CAP-02.MCFT-04.RESTART-BACKFILL-V1
↓
MCFT-CAP-02.FAILURE-RECOVERY-V1
↓
MCFT-CAP-02.CLOSURE-V1
```

Every edge is merge-before-next. No downstream branch may be treated as effective before the preceding PR is merged into `main` and verified.

## 4. Exact dependency graph

| Delivery slice | Primary owner | Contributors | Depends on |
|---|---|---|---|
| `MCFT-CAP-02.GOV-AUTHORIZATION-V1` | `MCFT-06` | `MCFT-02`, `MCFT-03`, `MCFT-04`, `MCFT-05`, `MCFT-07`, `MCFT-08`, `MCFT-09` | `MCFT-CAP-01.CLOSURE-REMEDIATION-V1`, merged-main verification, predecessor lock |
| `MCFT-CAP-02.MCFT-02.CONTINUATION-CONTRACTS-CONFIG-V1` | `MCFT-02` | `MCFT-03`, `MCFT-04`, `MCFT-06`, `MCFT-07`, `MCFT-08`, `MCFT-09` | `MCFT-CAP-02.GOV-AUTHORIZATION-V1` |
| `MCFT-CAP-02.MCFT-06.PURE-HOURLY-DYNAMICS-V1` | `MCFT-06` | `MCFT-02`, `MCFT-08` | continuation contracts/config |
| `MCFT-CAP-02.MCFT-05.CONTINUATION-EVIDENCE-WINDOW-V1` | `MCFT-05` | `MCFT-02`, `MCFT-06` | pure hourly Dynamics |
| `MCFT-CAP-02.MCFT-03.CONTINUATION-PERSISTENCE-V1` | `MCFT-03` | `MCFT-02`, `MCFT-04`, `MCFT-08`, `MCFT-09` | continuation Evidence Window |
| `MCFT-CAP-02.MCFT-04-06-08-09.SINGLE-TICK-INTEGRATION-V1` | `MCFT-04` | `MCFT-06`, `MCFT-08`, `MCFT-09` | continuation persistence |
| `MCFT-CAP-02.MCFT-04-08.TWENTY-FOUR-TICK-RANGE-V1` | `MCFT-04` | `MCFT-08` | single-tick integration |
| `MCFT-CAP-02.MCFT-04.RESTART-BACKFILL-V1` | `MCFT-04` | `MCFT-03`, `MCFT-08` | 24-tick range |
| `MCFT-CAP-02.FAILURE-RECOVERY-V1` | `MCFT-03` | `MCFT-04`, `MCFT-05`, `MCFT-06`, `MCFT-08`, `MCFT-09` | restart/backfill |
| `MCFT-CAP-02.CLOSURE-V1` | `MCFT-06` | `MCFT-02`, `MCFT-03`, `MCFT-04`, `MCFT-05`, `MCFT-07`, `MCFT-08`, `MCFT-09` | failure recovery |

## 5. Premerge readiness claims

Before merge, this authorization slice may claim only:

```text
MCFT_CAP_02_PREDECESSOR_MAIN_VERIFIED
MCFT_CAP_02_PREDECESSOR_IDENTITY_LOCKED
MCFT_CAP_02_DELIVERY_GRAPH_FROZEN
MCFT_CAP_02_OWNER_BOUNDARY_FROZEN
MCFT_CAP_02_AUTHORIZATION_READY_FOR_MERGE
```

After this authorization PR is merged and its postmerge Gate passes, it may additionally claim only:

```text
MCFT_CAP_02_AUTHORIZATION_V1_ESTABLISHED
MCFT_CAP_02_READY_FOR_IMPLEMENTATION
```

It may not claim hourly Dynamics, continuation persistence, any continuation State, restart/resume, backfill, or capability completion.

## 6. Preserved nonclaims

```text
NO_RUNTIME_SOURCE_AUTHORIZED_BEFORE_AUTHORIZATION_MERGE
NO_HOURLY_DYNAMICS_IMPLEMENTED
NO_CONTINUATION_STATE_PERSISTED
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

## 7. Exact changed-file boundary for this authorization slice

Only the following files may change relative to predecessor merge commit `7da8fee4daf1f022edff29078a1bbac207d1a32f`:

```text
docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-MAIN-VERIFICATION.json
docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-TASK.md
docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-AUTHORIZATION.md
docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-AUTHORIZATION-STATUS.json
docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-PREDECESSOR-LOCK.json
docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json
docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json
docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_PREDECESSOR_PREFLIGHT.cjs
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_AUTHORIZATION.cjs
```

No Runtime, domain, persistence, adapter, projection, migration, route, web, fixture Evidence, MCFT-00 authority, or CAP-01 file other than the exact verification artifact is authorized in this slice.

## 8. Premerge Gate

The premerge authorization Gate must establish all of the following:

```text
predecessor main ref == 7da8fee4daf1f022edff29078a1bbac207d1a32f
merged-main verification artifact status == COMPLETE
final closure Gate == 173_PASS_0_FAIL
server typecheck == PASS
server build == PASS
git diff check == PASS
verification worktree == CLEAN
predecessor canonical identity snapshot read from isolated PostgreSQL
predecessor lock status == COMPLETE
authorization status == READY_FOR_MERGE
authorization_effective == false
capability matrix MCFT-CAP-02 status == READY_FOR_IMPLEMENTATION
Runtime source changed-file count == 0
exact authorization changed-file set == 10
```

## 9. Postmerge effectiveness condition

Authorization becomes effective only when all conditions are true:

```text
all premerge Gate checks == PASS
this authorization PR merged into main
postmerge Gate executes from the merged authorization main commit
postmerge Gate confirms authorization commit ancestry
postmerge Gate confirms the same ten-file boundary and no Runtime source
```

Before merge, `authorization_effective` remains `false`. Matrix readiness is a bounded merge target and does not independently grant Runtime authority. The next slice is not automatically implemented; it is only allowed to start from the merged authorization main commit after the postmerge Gate passes.

## 10. Successor boundary

```text
successor:
MCFT-CAP-03 — Observation Assimilation and State Innovation

successor_authorization:
NONE
```

MCFT-CAP-03 remains unauthorized. No successor design or implementation is authorized by this document.
