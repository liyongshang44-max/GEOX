<!-- docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md -->
# GEOX DT-02 to MCFT Implementation Map

## 0. Rule

DT-02 freezes architecture. MCFT owner work packages implement it. Capability-line closure does not automatically mark horizontal owner work packages COMPLETE.

```text
capability_line_id
  vertical executable capability closure unit

owner_work_package_id
  horizontal architecture ownership catalogue entry

delivery_slice_id
  bounded implementation slice delivered by a capability line
```

## 1. Horizontal architecture ownership

```text
MCFT-00 scope and binding authority
MCFT-01 Replay Evidence
MCFT-02 canonical contracts
MCFT-03 facts, projections, lease and idempotency
MCFT-04 tick, checkpoint and recovery
MCFT-05 Evidence Window
MCFT-06 propagation
MCFT-07 observation and assimilation
MCFT-08 canonical posterior State
MCFT-09 Forecast outcome
MCFT-10 Scenario
MCFT-11 Forecast residual
MCFT-12 calibration and model activation
MCFT-13 human decision
MCFT-14 action lifecycle
MCFT-15 execution feedback
MCFT-16 closed-loop orchestration
MCFT-17 runtime read APIs
MCFT-18 Operator integration
```

## 2. MCFT-CAP-01 final slice map

| delivery slice | bounded result | status |
|---|---|---|
| `MCFT-CAP-01.MCFT-01.CANONICAL-REPLAY-DATASET-V1` | 30-day Replay Evidence plus configuration-derived crop-stage context | COMPLETE |
| `MCFT-CAP-01.MCFT-02.A0-CONTRACTS-AND-CONFIG-V1` | A0 contracts and complete graph validation | COMPLETE |
| `MCFT-CAP-01.MCFT-03.A0-PERSISTENCE-V1` | A0 persistence plus Reality Binding snapshot and next-tick reads | COMPLETE |
| `MCFT-CAP-01.MCFT-07-08.BOOTSTRAP-STATE-MATH-V1` | deterministic bootstrap posterior | COMPLETE |
| `MCFT-CAP-01.MCFT-04-05-08-09.A0-RUNTIME-INTEGRATION-V1` | one A0 transaction, complete Evidence trace, persisted handoff and manual entry | COMPLETE |
| `MCFT-CAP-01.CLOSURE-V1` | historical closure | SUPERSEDED_BY_REMEDIATION |
| `MCFT-CAP-01.CLOSURE-REMEDIATION-V1` | repaired bounded capability closure | COMPLETE |

```text
runtime delivery main commit:
4a0fd03beb05298028101a4999c67a5e053dadb8

historical closure main commit:
250053aba801075c17098f8d505d527eb54390e9

remediation implementation candidate head:
193f9785e42eb146e300e2a64abeed455f10e54e

remediation final closure head:
7fedd85815cd65f0e3d2aedc74e4d0d9ed1b0558

remediation merge commit:
7da8fee4daf1f022edff29078a1bbac207d1a32f

merged-main verification commit:
53aa944da595c515619229d37be86930d7a2e7e7

PR:
#2316

capability status:
COMPLETE

active delivery slice:
null
```

## 3. Established MCFT-CAP-01 proof

```text
controlled Canonical Replay Evidence
configuration-derived crop-stage context
explicit Replay logical time
no-future-leakage behavior
immutable Runtime Config
bootstrap prior and scalar assimilation
first bootstrap posterior
A0 aggregate idempotency
nine-fact atomic append
six rebuildable projections
INITIAL lineage and checkpoint
BLOCKED zero-point Forecast result
NEXT_TICK_CHECKPOINT_POINTER_ESTABLISHED
PERSISTED_NEXT_TICK_HANDOFF_ESTABLISHED
CONFLICTING_DUPLICATE_OBSERVATION_REJECTION_ESTABLISHED
EVIDENCE_MODEL_CONSUMPTION_TRACE_ESTABLISHED
A0_CROSS_REFERENCE_GRAPH_VALIDATION_ESTABLISHED
OPERATOR_INVOKABLE_MANUAL_RUNTIME_ENTRY_ESTABLISHED
MCFT_CAP_01_COMPLETE
```

The persisted handoff resolves:

```text
active_lineage_ref = lineage canonical object_id
lineage_id = semantic lineage identity
```

and reads active lineage, latest checkpoint, previous posterior, Runtime Config and Reality Binding in one PostgreSQL consistent view.

## 4. MCFT-CAP-01 merged-main acceptance

```text
S1 Replay Dataset: 12 PASS, 0 FAIL
S4 static: 21 PASS, 0 FAIL
S4 PostgreSQL: 12 PASS, 0 FAIL
Remediation static: 18 PASS, 0 FAIL
Remediation PostgreSQL: 7 PASS, 0 FAIL
Governance readiness: 106 PASS, 0 FAIL
Merged-main final closure Gate: 173 PASS, 0 FAIL
Merged-main Typecheck: PASS
Merged-main Build: PASS
Merged-main git diff check: PASS
Merged-main worktree: CLEAN
Isolated PostgreSQL A0 execution: INSERTED
Canonical predecessor identity extraction: PASS
```

## 5. MCFT-CAP-02 authorization map

```text
MCFT-CAP-02 authorization status:
READY_FOR_MERGE

capability matrix status:
READY_FOR_IMPLEMENTATION

authorization effective:
false

runtime source authorized:
false

predecessor main verification:
COMPLETE

predecessor canonical identity lock:
COMPLETE

active delivery slice:
MCFT-CAP-02.GOV-AUTHORIZATION-V1

next implementation slice after merge and postmerge Gate:
MCFT-CAP-02.MCFT-02.CONTINUATION-CONTRACTS-CONFIG-V1
```

Runtime source implementation begins only after this authorization is merged into `main` and the postmerge authorization Gate passes from the merged authorization main commit. Matrix readiness on the authorization branch is a bounded merge target, not premerge Runtime authority.

| delivery slice | bounded result | premerge status |
|---|---|---|
| `MCFT-CAP-02.GOV-AUTHORIZATION-V1` | exact predecessor proof, owner boundary, delivery graph, claims/nonclaims and changed-file boundary | READY_FOR_MERGE |
| `MCFT-CAP-02.MCFT-02.CONTINUATION-CONTRACTS-CONFIG-V1` | continuation contracts, fixed coordinate policy, Runtime Config and graph validation | BLOCKED |
| `MCFT-CAP-02.MCFT-06.PURE-HOURLY-DYNAMICS-V1` | deterministic fixed-point hourly water Dynamics and mass-balance trace | BLOCKED |
| `MCFT-CAP-02.MCFT-05.CONTINUATION-EVIDENCE-WINDOW-V1` | exact-hour Evidence selection and consumption trace | BLOCKED |
| `MCFT-CAP-02.MCFT-03.CONTINUATION-PERSISTENCE-V1` | eight-fact continuation transaction, CAS, idempotency and rebuild | BLOCKED |
| `MCFT-CAP-02.MCFT-04-06-08-09.SINGLE-TICK-INTEGRATION-V1` | first continuation tick from persisted predecessor handoff | BLOCKED |
| `MCFT-CAP-02.MCFT-04-08.TWENTY-FOUR-TICK-RANGE-V1` | 24 contiguous ticks and exact chain verification | BLOCKED |
| `MCFT-CAP-02.MCFT-04.RESTART-BACKFILL-V1` | persisted restart/resume and bounded forward backfill | BLOCKED |
| `MCFT-CAP-02.FAILURE-RECOVERY-V1` | failure fixtures, retry, fencing, CAS and divergence handling | BLOCKED |
| `MCFT-CAP-02.CLOSURE-V1` | capability closure only after all prior slices merge and pass | BLOCKED |

## 6. MCFT-CAP-02 predecessor identity lock

```text
predecessor merge commit:
7da8fee4daf1f022edff29078a1bbac207d1a32f

predecessor main verification commit:
53aa944da595c515619229d37be86930d7a2e7e7

active lineage object ref:
twin_runtime_lineage_31d5cdda3c87fdf1536f0233

semantic lineage id:
lineage_da76d015085f0d37bf2ed478

revision id:
revision_e0c62f99ac3db66f60a87e2b

bootstrap State ref:
twin_state_estimate_a411d678b1d79b7a58b31fd7

bootstrap checkpoint ref:
twin_runtime_checkpoint_16dfbf70c99cd900d463406c

bootstrap Runtime Config ref:
twin_runtime_config_851ac30201221a7aa2ce16f7

next logical tick:
2026-06-01T02:00:00.000Z
```

These values were extracted through the isolated PostgreSQL canonical read path. They are predecessor identities, not new Runtime output.

## 7. Owner work-package status

```text
MCFT-01 PARTIALLY_ESTABLISHED
MCFT-02 PARTIALLY_ESTABLISHED
MCFT-03 PARTIALLY_ESTABLISHED
MCFT-04 PARTIALLY_ESTABLISHED
MCFT-05 PARTIALLY_ESTABLISHED
MCFT-06 NOT_STARTED
MCFT-07 PARTIALLY_ESTABLISHED
MCFT-08 PARTIALLY_ESTABLISHED
MCFT-09 PARTIALLY_ESTABLISHED
```

Neither MCFT-CAP-01 completion nor MCFT-CAP-02 authorization readiness marks a horizontal owner work package COMPLETE.

## 8. Preserved MCFT-CAP-02 nonclaims

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

## 9. Closure hierarchy and successor boundary

MCFT-CAP-01 establishes a deterministic Replay bootstrap State capability only. MCFT-CAP-02 authorization readiness establishes no Dynamics, continuation State, restart/backfill, Forecast success, Gate A, Gate B, Gate C or Minimum Complete Field Twin closure.

MCFT-CAP-03 remains unauthorized. It requires independent authorization after MCFT-CAP-02 is fully implemented, closed, merged and verified on `main`.
## 10. MCFT-CAP-02 Closure activation

```text
closure identity:
GEOX-MCFT-CAP-02-CLOSURE-V1

status:
READY_FOR_MERGE

closure effective:
false

baseline and latest verified main:
9a61e05f683adf3815ee1cc4af182efd23508588

activation head:
8f63fc84c298a20d12094d100865af89e812ea31

active delivery slice:
MCFT-CAP-02.CLOSURE-V1

completed predecessor delivery slices:
9

failure recovery merged-main Gate:
86 PASS, 0 FAIL

successor:
MCFT-CAP-03

successor authorized:
false
```

The Closure slice aggregates already merged and main-verified evidence. It changes no Runtime source, migration, route, web path, workflow, canonical fact semantics, Dynamics math, or persistence transaction semantics.

The exact post-effectiveness completion claims are recorded as pending. `MCFT_CAP_02_COMPLETE` does not become effective until the Closure PR is merged and the merged-main Closure Gate passes.

Horizontal owner work packages remain partially established. Capability-line completion does not mark any horizontal owner work package COMPLETE.
## 11. MCFT-CAP-02 Closure readiness

```text
implementation candidate head:
2c4c07ef56209d19f0fccea9da734ffcc31d02bb

candidate exact-head CI:
#4574 SUCCESS

Closure Draft Gate:
126 PASS, 0 FAIL

Closure effective:
false

MCFT-CAP-03 authorized:
false
```

The Closure candidate is ready for destructive Final Gate and a new READY exact-head CI. No capability completion claim is effective before merge and merged-main verification.
## 12. MCFT-CAP-02 Closure Final Gate

```text
READY head:
c88f555685ad8d79618f6ceb21d702264f37bfe7

READY exact-head CI:
#4575 SUCCESS

Closure Final Gate:
141 PASS, 0 FAIL

PostgreSQL:
24-tick 8/0
restart/backfill 8/0
persistence 15/0
Failure Recovery 8/0

server typecheck:
PASS

server build:
PASS

Closure effective:
false

MCFT-CAP-03 authorized:
false
```

The Final Gate evidence is recorded for the READY head. Capability completion remains non-effective until the Closure PR is merged and the merged-main Closure Gate passes.
## 13. MCFT-CAP-02 canonical completion

```text
capability:
MCFT-CAP-02 鈥?Hourly Dynamics and Persistence

status:
COMPLETE

Closure PR:
#2327

final evidence head:
800e1d255414b847587350d0f19b92288b32c1db

final exact-head CI:
#4576 SUCCESS

merge commit and verified main:
08f0b5c146959b2a3988cd3ea07647628b0e84ad

merged-main Closure Gate:
161 PASS, 0 FAIL

completion claims:
12 effective

preserved nonclaims:
21 effective

horizontal owner work packages:
not completed by capability closure

successor:
MCFT-CAP-03

successor authorized:
false
```

MCFT-CAP-02 is canonically complete at Level A for deterministic replay hourly Dynamics and persistence. This does not establish observation assimilation, successful Forecast, continuous Runtime, live-field operation, or Minimum Complete Field Twin. MCFT-CAP-03 requires independent authorization.


## 14. MCFT-CAP-03 S0 authorization readiness

```text
capability:
MCFT-CAP-03 — Observation Assimilation and State Innovation

authorization:
READY_FOR_MERGE

authorization effective:
false

design status:
FINAL_FROZEN_CANDIDATE_V1_2

implementation status:
NOT_AUTHORIZED

baseline main:
d1a3948d06e4c7896d513168d31ef52409c3e0f0

predecessor checkpoint sequence:
24

predecessor final logical time:
2026-06-02T01:00:00.000Z

canonical next logical tick:
2026-06-02T02:00:00.000Z

predecessor lock:
docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-PREDECESSOR-LOCK.json

active delivery slice:
MCFT-CAP-03.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1

next eligible slice after merge and merged-main Gate:
MCFT-CAP-03.MCFT-02-07-08.ASSIMILATION-CONTRACTS-CONFIG-V1

MCFT-CAP-04 authorized:
false
```

The S0 branch contains governance and PostgreSQL predecessor proof only. Runtime implementation remains forbidden until S0 merges and its merged-main Authorization Gate passes. Horizontal owner work packages remain partially established.

## MCFT-CAP-03 Finalization candidate

```text
status: FINALIZATION_READY_FOR_MERGE
baseline_main_commit: 68f0bc2198c0fd09bb4dcedf5b13d8507fb35902
branch: mcft-cap-03-s8-finalization-v1
active_delivery_slice_id: MCFT-CAP-03.CLOSURE-FINALIZATION-V1
closure_effective: false
completion_claims: PENDING_FINALIZATION_EFFECTIVENESS
main_verification: PENDING_FINALIZATION_EFFECTIVENESS
MCFT-CAP-04: UNAUTHORIZED
```

This candidate records governance evidence only. It does not change Runtime behavior, canonical facts, model parameters, or successor authorization.

## MCFT-CAP-03 canonical completion

```text
status: COMPLETE
closure_effective: true
completion_claims: 15 EFFECTIVE
finalization_pr: #2365
finalization_head: 9827846038083092bedeabdbf8f9713f587c083b
finalization_ci: CI_4768
finalization_merge: e42a9a799b8f27110e3955d645f3ea70c50c0588
finalization_postmerge_gate: MCFT-CAP-03 S8 Finalization postmerge: 58 PASS, 0 FAIL
MCFT-CAP-04: UNAUTHORIZED
```

MCFT-CAP-03 is complete at Level A for replay-mode observation assimilation and state innovation. This does not establish Forecast success, Scenario, Recommendation, Policy Evaluation, AO-ACT, continuous Runtime, live-field operation, Gate A/B/C closure, or Minimum Complete Field Twin.

<!-- MCFT-CAP-04-P0-AUTHORITY-START -->
## 15. MCFT-CAP-03 authoritative reconciliation and MCFT-CAP-04 P0

```text
repository baseline:
eca0d053045db59982ad20a6e0421f72ae16f804

MCFT-CAP-03:
status: COMPLETE
implementation_status: VERIFIED_ON_MAIN
closure_effective: true
capability_complete: true
active_delivery_slice_id: null
R4-A: MERGED_EFFECTIVE
R4-B: MERGED_EFFECTIVE
R4-C: MERGED_EFFECTIVE
remaining audited hard-acceptance failures: 0
remaining unadjudicated contract deviations: 0
successor: MCFT-CAP-04
successor_authorized: false
```

The global capability matrix is reconciled to the effective CAP-03 delivery and verification records. Historical candidate sections above remain historical evidence and are not current authority.

MCFT-CAP-04 P0 freezes the task and delivery graph only:

```text
design_status: FINAL_FROZEN_CANDIDATE_V0_5
implementation_status: NOT_AUTHORIZED
runtime_source_authorized: false
active_delivery_slice_id: MCFT-CAP-04.P0.PREDECESSOR-SSOT-AND-TASK-FREEZE-V1
```

| phase | bounded result | P0 state |
|---|---|---|
| P0 | predecessor SSOT reconciliation and task freeze | READY_FOR_MERGE |
| S0 | authorization and predecessor identity lock | BLOCKED |
| S1 | contracts, Runtime Config pins, provenance | BLOCKED |
| S2 | Future Forcing Evidence Window | BLOCKED |
| S3 | successful 72-hour Forecast math and record set | BLOCKED |
| S4 | Forecast persistence and canonical projections | BLOCKED |
| S5 | Tick integration and reverse Health recovery | BLOCKED |
| S6 | Scenario contracts and deterministic trajectories | BLOCKED |
| S7 | Scenario persistence and canonical projections | BLOCKED |
| S8 | restart, bounded backfill, and failure recovery | BLOCKED |
| S9 | capability closure candidate | BLOCKED |
| S10A | finalization candidate | BLOCKED |
| S10B | exact-head final verification | BLOCKED |
| S10C | postmerge effectiveness reconciliation | BLOCKED |

No Runtime, migration, route, API, scheduler, frontend, Forecast, Scenario, Recommendation, Decision, or AO_ACT capability is authorized by P0.
<!-- MCFT-CAP-04-P0-AUTHORITY-END -->
