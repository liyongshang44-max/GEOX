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

## MCFT-CAP-03 canonical completion after R4

```text
capability: MCFT-CAP-03 — Observation Assimilation and State Innovation
status: COMPLETE
design_status: DESIGN_FROZEN
implementation_status: COMPLETE
authorization_effective: true
runtime_source_authorized: true
closure_effective: true
capability_complete: true
active_delivery_slice_id: null
pending_completion_claims: []
effective_completion_claims: 15
R4-A: MERGED_EFFECTIVE
R4-B: MERGED_EFFECTIVE
R4-C: MERGED_EFFECTIVE
R4 final verification merge: cda1016542300bbc477a1c72023401aaaad954bc
remaining hard nonconformance: 0
remaining unadjudicated contract deviation: 0
active record-set contract: MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2
global State count: 49
global continuation State count: 48
latest checkpoint sequence: 48
latest logical time: 2026-06-03T01:00:00.000Z
next tick: 2026-06-03T02:00:00.000Z
latest successful Forecast: null
successor: MCFT-CAP-04
successor authorized: false
```

Detailed authority:

```text
docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-MAIN-VERIFICATION.json
docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-FINAL-VERIFICATION.json
docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json
```

MCFT-CAP-03 is complete at Level A for Replay-mode observation assimilation and state innovation. This does not establish successful Forecast, Scenario, Recommendation, Policy Evaluation, Decision, AO-ACT, continuous Runtime, live-field operation, Gate A/B/C closure, or Minimum Complete Field Twin.

## MCFT-CAP-04 provisional state after P0

```text
capability: MCFT-CAP-04 — 72-Hour Forecast and Three Scenarios
runtime mode: REPLAY
target level: Level A — Deterministic Replay Twin
status: NOT_AUTHORIZED
design_status: FINAL_FROZEN_CANDIDATE_V0_5
implementation_status: NOT_AUTHORIZED
runtime_source_authorized: false
authorization_effective: false
active_delivery_slice_id: null
P0 delivery candidate: MCFT-CAP-04.P0.CAP-03-GLOBAL-SSOT-RECONCILIATION-V1
next delivery slice: MCFT-CAP-04.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1
next delivery slice authorized: false
successor: MCFT-CAP-05
successor authorized: false
```

P0 records the complete v0.5 task authority and reconciles predecessor SSOT only. It does not authorize S0 or any Runtime source change.

P0 exact boundary:

```text
docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md
docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json
docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-P0-STATUS.json
docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-TASK.md
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_P0_PREDECESSOR_SSOT.cjs
```

Complete task authority:

```text
docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-TASK.md
```

Runtime source remains forbidden until P0 is merged and passes its merged-main Gate, then S0 is separately merged and passes its merged-main Authorization Gate.


## MCFT-CAP-04 S0 authorization readiness

```text
capability: MCFT-CAP-04 — 72-Hour Forecast and Three Scenarios
P0 merge commit: 30fdd839aa675656dd3dc9d1def57b06f63f86ec
P0 postmerge Gate: PASS
S0 authorization: READY_FOR_MERGE
authorization effective: false
design status: FINAL_FROZEN_CANDIDATE_V0_5
implementation status: NOT_AUTHORIZED
runtime source authorized: false
active delivery slice: MCFT-CAP-04.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1
predecessor checkpoint sequence: 48
predecessor latest logical time: 2026-06-03T01:00:00.000Z
canonical next logical tick: 2026-06-03T02:00:00.000Z
latest successful Forecast: null
predecessor lock: docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-PREDECESSOR-LOCK.json
next eligible slice after merge and merged-main Gate: MCFT-CAP-04.MCFT-02-07-09-10.FORECAST-SCENARIO-CONTRACTS-CONFIG-V1
successor MCFT-CAP-05 authorized: false
```

The S0 branch contains governance artifacts and isolated PostgreSQL predecessor proof only. Runtime implementation remains forbidden until S0 merges and its merged-main Authorization Gate passes.

<!-- MCFT-CAP-04-S1-CONTRACTS-CONFIG-START -->

## MCFT-CAP-04 S1 contracts/config implementation candidate

```text
baseline merged main: 870bcc621e8d0495ae5acbedd534068a18d402b9
S0 authorization: MERGED_EFFECTIVE
S0 postmerge workflow: 29207138083
active delivery slice: MCFT-CAP-04.MCFT-02-07-09-10.FORECAST-SCENARIO-CONTRACTS-CONFIG-V1
status: IMPLEMENTATION_CANDIDATE
design_status: DESIGN_FROZEN
implementation_status: IN_PROGRESS
authorization_effective: true
runtime_source_authorized: true
next delivery slice: MCFT-CAP-04.MCFT-05-09.FUTURE-FORCING-WINDOW-V1
next delivery slice authorized: false
```

Established in this bounded slice:

```text
A1: MCFT_CAP_04_COMPLETED_FORECAST_CONTINUATION_V1
A2: MCFT_CAP_04_BLOCKED_FORECAST_CONTINUATION_V1
B: MCFT_CAP_04_THREE_SCENARIO_SET_V1
Forecast points: exact horizons 1..72
Scenario options: NO_ACTION, IRRIGATE_NOW_15MM, IRRIGATE_NOW_25MM
Runtime Config purpose: FORECAST_AND_THREE_SCENARIO_CONTINUATION_RUNTIME_V1
Runtime Config chain: exactly 24 immutable D transactions
validator dispatch: explicit contract ID + config purpose only
```

Future Forcing selection, Forecast math, Scenario math, A1/A2/B persistence, migration, projection, route and scheduler remain outside S1.

<!-- MCFT-CAP-04-S1-CONTRACTS-CONFIG-END -->

<!-- MCFT-CAP-04-S2-FUTURE-FORCING-START -->

## MCFT-CAP-04 S2 Future Forcing implementation candidate

```text
baseline merged main: 13f8bf3231cb41c809d235096ca7cfda9e201944
S1 status: MERGED_EFFECTIVE
S1 postmerge workflow: 29222992520
active delivery slice: MCFT-CAP-04.MCFT-05-09.FUTURE-FORCING-WINDOW-V1
status: IMPLEMENTATION_CANDIDATE
runtime_source_authorized: true
next delivery slice: MCFT-CAP-04.MCFT-06-09.PURE-72H-FORECAST-MATH-V1
next delivery slice authorized: false
```

Established in this bounded slice:

```text
joint weather/ET0 matching forcing-cycle selector
forcing_cycle_key equality and deterministic ordering
exact 72-point ForecastForcingWindowV1 DTO
no-future-leakage at logical time T
identical duplicate collapse
CONFLICTING_FORCING_SNAPSHOT rejection
CONFLICTING_FORCING_CYCLE rejection
forcing_window_hash over complete 72-point DTO
24-tick / 95-hour controlled Replay fixture
```

Forecast equations, Scenario equations, persistence, migration, projection, route and scheduler remain outside S2.

<!-- MCFT-CAP-04-S2-FUTURE-FORCING-END -->

<!-- MCFT-CAP-04-S3-PURE-FORECAST-MATH-START -->

## MCFT-CAP-04 S3 pure 72-hour Forecast math implementation candidate

```text
baseline merged main: 4a8dab632246b05266f1d869f6c9a0a5bcf37e76
S2 status: MERGED_EFFECTIVE
S2 postmerge workflow: 29223899742
active delivery slice: MCFT-CAP-04.MCFT-06-09.PURE-72H-FORECAST-MATH-V1
status: IMPLEMENTATION_CANDIDATE
runtime_source_authorized: true
next delivery slice: MCFT-CAP-04.MCFT-06-10.PURE-THREE-SCENARIO-MATH-V1
next delivery slice authorized: false
```

Established in this bounded slice:

```text
NO_NEW_IRRIGATION pure Forecast adapter
72 hourly fixed-point mean propagation
exact zero mass-balance error
10^-12 storage variance chain
controlled uncalibrated 95% storage interval
physical storage and interval bounds
point semantic hash, trajectory hash and forecast math hash
24-tick / 95-hour controlled Replay Forecast-math fixture
```

Scenario equations, canonical append, persistence, migration, projection, route and scheduler remain outside S3.

<!-- MCFT-CAP-04-S3-PURE-FORECAST-MATH-END -->

<!-- MCFT-CAP-04-S4-PURE-SCENARIO-MATH-START -->

## MCFT-CAP-04 S4 pure three-Scenario math candidate

```text
baseline merged main: 4a1c9fde05594c97fb949e062df77375a1a27365
S3 status: MERGED_EFFECTIVE
S3 postmerge workflow: 29225560206
active delivery slice: MCFT-CAP-04.MCFT-06-10.PURE-THREE-SCENARIO-MATH-V1
status: IMPLEMENTATION_CANDIDATE
runtime_source_authorized: true
next delivery slice: MCFT-CAP-04.MCFT-02-07-08-09.A1-A2-RECORD-SET-BUILDERS-V1
next delivery slice authorized: false
```

Established: exact NO_ACTION Forecast copy; immediate 15/25 mm assumed irrigation; deterministic efficiency, stress, deltas and hashes; 24-tick/95-hour pure Scenario fixture. Canonical append, record-set builders and persistence remain outside S4.

<!-- MCFT-CAP-04-S4-PURE-SCENARIO-MATH-END -->

<!-- MCFT-CAP-04-S5A-A1-A2-BUILDERS-START -->

## MCFT-CAP-04 S5A A1/A2 record-set-builder candidate

```text
baseline merged main: f0fc64d487ba6ed34d0c77178fed45e707092a07
S4 status: MERGED_EFFECTIVE
S4 postmerge workflow: 29226613070
active delivery slice: MCFT-CAP-04.MCFT-02-07-08-09.A1-A2-RECORD-SET-BUILDERS-V1
status: IMPLEMENTATION_CANDIDATE
runtime_source_authorized: true
next delivery slice: MCFT-CAP-04.MCFT-03-09-10.A1-A2-B-PERSISTENCE-UNIQUENESS-RECOVERY-V1
next delivery slice authorized: false
```

Established in this bounded slice:

```text
pure A1 completed-Forecast eight-member builder
pure A2 blocked-Forecast eight-member builder
strict status/variant separation
complete eight-member cross-reference validation
shared cross-variant terminal uniqueness identity
distinct operation and idempotency identities
member and aggregate deterministic hashes
Tick six-reference recovery root with no health_ref
24-tick controlled builder fixture
```

Database access, persistence, uniqueness queries, recovery transactions, migrations, projections, routes and schedulers remain outside S5A.

<!-- MCFT-CAP-04-S5A-A1-A2-BUILDERS-END -->

<!-- MCFT-CAP-04-S5B-PERSISTENCE-START -->

## MCFT-CAP-04 S5B persistence candidate

```text
baseline merged main: 2c6a0834488f367eb927430a15c9590c1bf348a3
S5A status: MERGED_EFFECTIVE
S5A postmerge workflow: 29228386162
active delivery slice: MCFT-CAP-04.MCFT-03-09-10.A1-A2-B-PERSISTENCE-UNIQUENESS-RECOVERY-V1
status: IMPLEMENTATION_CANDIDATE
runtime_source_authorized: true
next delivery slice: MCFT-CAP-04.MCFT-04-05-06-07-08-09-10.SINGLE-TICK-FORECAST-SCENARIO-INTEGRATION-V1
next delivery slice authorized: false
canonical store: public.facts
additive migrations in S5B: 1
```

Established in this bounded slice: A1/A2/B atomic persistence, cross-variant terminal uniqueness, Scenario canonical uniqueness, idempotent readback, pending Scenario recovery detection, Forecast/Scenario projections, explicit projection rebuild and fault-injection rollback.

No route, web, scheduler or tick orchestration is introduced.

<!-- MCFT-CAP-04-S5B-PERSISTENCE-END -->

<!-- MCFT-CAP-04-S6-SINGLE-TICK-START -->

## MCFT-CAP-04 S6 single-tick Forecast/Scenario integration candidate

```text
baseline merged main: 63c8ba7b8dd314c1224ca8de2914b663b3551092
S5B status: MERGED_EFFECTIVE
S5B postmerge workflow: 29232760223
active delivery slice: MCFT-CAP-04.MCFT-04-05-06-07-08-09-10.SINGLE-TICK-FORECAST-SCENARIO-INTEGRATION-V1
status: IMPLEMENTATION_CANDIDATE
runtime_source_authorized: true
next delivery slice: MCFT-CAP-04.MCFT-04-07-09-10.TWENTY-FOUR-TICK-FORECAST-SCENARIO-RANGE-V1
next delivery slice authorized: false
```

Established in this bounded slice:

```text
one explicit persisted-handoff Replay tick
current Evidence -> Dynamics -> Assimilation -> posterior State
matching Future Forcing -> successful 72h Forecast -> A1 commit
three Scenario options -> B commit
canonical A/B readback
completed-idempotent zero recomputation
pending-Scenario B-only recovery
T+1 handoff with successful Forecast pointer
real PostgreSQL integration acceptance
```

The 24-tick range, restart/backfill, route, web and scheduler remain outside S6.

<!-- MCFT-CAP-04-S6-SINGLE-TICK-END -->

## MCFT-CAP-04 S7 activation — 24-tick Forecast / Scenario range

```text
predecessor S6 merge commit: ea9ddfeeda88a3bb0a3b8abd3b821b8a3965dac3
predecessor postmerge Gate: PASS (29245469293)
active slice: MCFT-CAP-04.MCFT-04-07-09-10.TWENTY-FOUR-TICK-FORECAST-SCENARIO-RANGE-V1
implementation branch: agent/mcft-cap-04-s7-twenty-four-tick-range-v1
status: IMPLEMENTATION_AUTHORIZED
Runtime source authorized: true
S8 authorized: false
```

S7 is authorized only for the deterministic 24-tick Replay range. It does not authorize restart/backfill, routes, web, scheduler, recommendation, decision, AO-ACT, continuous Runtime or live-field claims.

## MCFT-CAP-04 S7 candidate — 24-tick Forecast / Scenario range

```text
baseline main: 01be1e85dc409eee30bc3464dad30f7005b135c4
branch: agent/mcft-cap-04-s7-twenty-four-tick-range-v1
status: IMPLEMENTATION_CANDIDATE
standard range: 24 contiguous A1+B ticks
checkpoint sequence: 49..72
Forecast points: 1728
Scenario points: 5184
PostgreSQL operation facts: 216
PostgreSQL Config + operation facts: 240
positive/negative recheck: 29247534180 PASS
PostgreSQL range acceptance: 29247696055 PASS
S8 authorized: false
```

S7 reuses the verified S6 pending-B single-tick entry and does not duplicate State, Forecast, or Scenario mathematics. A legal A2 advances the latest Forecast result while preserving the prior successful-Forecast pointer, returns `BLOCKED`, and stops the range. Malformed forcing writes no terminal tick for the failing hour.

## MCFT-CAP-04 S8 Activation — Restart, Backfill and Failure Recovery

```text
S7: MERGED_EFFECTIVE
S7 merge: 413908eadf1016d879760da3afc968abdee82342
S7 postmerge Gate: 29248764378 PASS
S8: IMPLEMENTATION_AUTHORIZED
S8 baseline: 413908eadf1016d879760da3afc968abdee82342
S8 implementation branch: agent/mcft-cap-04-s8-restart-backfill-recovery-v1
S9: BLOCKED
```

## MCFT-CAP-04 S8 Candidate — Restart, Backfill and Failure Recovery

```text
activation merge: bdc3e93ce755e237655f7bfc98b117a6e842d030
activation postmerge Gate: 29250261737 PASS
implementation: VALIDATED_PENDING_MERGE
in-memory restart/backfill + failure recovery: 29251031846 PASS
PostgreSQL uniqueness/rebuild + fencing/CAS: 29251564080 PASS
PostgreSQL fresh-process restart: 29252000320 PASS
S9: BLOCKED
```


## MCFT-CAP-04 S9 Closure activation

```text
baseline main: 235c832d302a1917dbd557ba0adfe15587a44f50
S8 status: MERGED_EFFECTIVE
S8 exact-head CI: 29252831679 SUCCESS
S8 merged-main Gate: 29255291485 SUCCESS
active delivery slice: MCFT-CAP-04.CLOSURE-CANDIDATE-V1
S9 status: ACTIVATION_CANDIDATE
S9 Runtime source authorized: false
S9 completion claims: PENDING_ONLY
S10 status: BLOCKED
MCFT-CAP-05 authorized: false
```

S9 is governance-only evidence aggregation. It does not activate CAP-04 completion claims.


## MCFT-CAP-04 S9 Closure candidate

```text
baseline main: 8a4e1b5a92b8b3fcc21ec77a6542743fd3a7b4c3
activation postmerge Gate: 29257014497 SUCCESS
active delivery slice: MCFT-CAP-04.CLOSURE-CANDIDATE-V1
status: CLOSURE_CANDIDATE
pending completion claims: 24
effective completion claims: 0
closure effective: false
capability complete: false
S10 status: BLOCKED
MCFT-CAP-05 authorized: false
```

S9 aggregates merged-main evidence only. It does not activate CAP-04 completion claims.


## MCFT-CAP-04 S10A Finalization candidate

```text
baseline main: a6a07840efe080198233b39ec9a31d26c2e3f4f9
S9 status: MERGED_EFFECTIVE
S9 merged-main Closure Gate: 29258021682 SUCCESS
active delivery slice: MCFT-CAP-04.FINALIZATION-MAIN-VERIFICATION-V1
lifecycle stage: S10A_CANDIDATE
pending completion claims: 24
effective completion claims: 0
closure effective: false
capability complete: false
S10B authorized: false
S10C authorized: false
MCFT-CAP-05 authorized: false
```


## MCFT-CAP-04 S10B Main verification

```text
baseline main: e39ac16f83e4f5e5c4762a25589dce275c853f1a
verification subject: S10A_MERGED_MAIN
S10A tree equivalence: PASS
lifecycle stage: S10B_MAIN_VERIFICATION
pending completion claims: 24
effective completion claims: 0
effectiveness condition satisfied: false
S10C authorized: false
MCFT-CAP-05 authorized: false
```


## MCFT-CAP-04 S10C Evidence reconciliation

```text
baseline main: 8603b07c567729a68949cfe2d4c1559a7848ac93
lifecycle stage: S10C_POSTMERGE_EFFECTIVENESS_RECONCILIATION
phase: EVIDENCE_CANDIDATE
S10B tree equivalence: PASS
S10B postmerge Finalization Gate: 29260346203 SUCCESS
pending completion claims: 24
effective completion claims: 0
effectiveness condition satisfied: false
MCFT-CAP-05 authorized: false
```


## MCFT-CAP-04 Reconciled COMPLETE

```text
baseline main: 89f2d1ccd14cd5ad8f853c1d6da5dd8759bb8fa4
S10C evidence reconciliation Gate: 29261294502 SUCCESS
status: COMPLETE
implementation status: COMPLETE
active delivery slice: null
pending completion claims: 0
effective completion claims: 24
closure effective: true
capability complete: true
completion level: Level A — Deterministic Replay Twin
MCFT-CAP-05 authorized: false
```


## MCFT-CAP-05 P-1 DT-02 object / transaction adjudication candidate

```text
baseline main: 3eba797307388bd652dc5c65e91d634375e1b8c2
delivery slice: MCFT-CAP-05.P-1.DT02-OBJECT-TRANSACTION-ADJUDICATION-V1
slice kind: ARCHITECTURE_GOVERNANCE_ONLY
adjudication status: COMPLETE_CANDIDATE
adjudication result: REUSE_WITHOUT_AMENDMENT
DT-02 Architecture Amendment 03 required: false
runtime source authorized: false
migration authorized: false
canonical write authorized: false
P0 authorized: false
```

Adjudicated reuse:

```text
twin_decision_record_v1 -> G_HUMAN_DECISION_LINK_COMMIT
twin_action_feedback_v1 -> H_ACTION_FEEDBACK_COMMIT
twin_forecast_residual_v1 -> C_FORECAST_RESIDUAL_COMMIT
```

Non-canonical CAP-05 artifacts remain Replay Evidence, adapters or rebuildable projections. Forecast Residual remains distinct from current-tick Assimilation Innovation. The frozen Forecast projection is root-zone storage to root-zone mean VWC under the existing H=1 observation-operator semantics; no 200 mm point Forecast profile is claimed.

This P-1 result becomes effective only after its PR merges and the merged-main P-1 adjudication Gate passes. Until then, P0 and all Runtime source remain unauthorized.


<!-- MCFT-CAP-05-P0-SETTLEMENT-START -->

## MCFT-CAP-05 P0 CAP-04 settlement and CAP-05 provisional SSOT candidate

```text
baseline main: 5391a3a8f811fc166fa187d7da70342ee36ab5fa
P-1 exact head: ca83b67241b4df0082e78d3bfdf45e9338d82ad4
P-1 merge commit: 5391a3a8f811fc166fa187d7da70342ee36ab5fa
P-1 head-to-merge file delta count: 0
P-1 tree equivalence: PASS
P-1 merged-main Gate workflow: 29305092038 SUCCESS
P-1 adjudication result: REUSE_WITHOUT_AMENDMENT
DT-02 Architecture Amendment 03 required: false
active delivery slice: MCFT-CAP-05.P0.CAP-04-SETTLEMENT-AND-CAP-05-PROVISIONAL-SSOT-V1
P0 status: READY_FOR_MERGE
Runtime source authorized: false
S0 authorized: false
```

P0 reconciles only the current CAP-04 lifecycle view to its Closure Record and Main Verification authority. Historical delivery-slice baselines, merge commits, Gates and predecessor identities remain unchanged.

```text
CAP-04 status: COMPLETE
CAP-04 implementation status: COMPLETE
CAP-04 closure effective: true
CAP-04 capability complete: true
CAP-04 active delivery slice: null
CAP-04 pending completion claims: 0
CAP-04 current next delivery slice: null
CAP-04 current next delivery authorization: false
CAP-04 current latest effective slice: MCFT-CAP-04.FINALIZATION-MAIN-VERIFICATION-V1
```

The provisional CAP-05 capability entry remains `NOT_AUTHORIZED`. P0 creates no Runtime authority, predecessor PostgreSQL lock, migration, canonical write, route, web or CAP-06 authorization. S0 remains the next independent authorization boundary.

<!-- MCFT-CAP-05-P0-SETTLEMENT-END -->


<!-- MCFT-CAP-05-S0-AUTHORIZATION-START -->

## MCFT-CAP-05 S0 authorization readiness

```text
capability: MCFT-CAP-05 — Human Decision and Execution-Receipt Feedback
P0 merge commit: 2d4d00aec8cd1e925687ee67e5de429c324cc1b2
P0 postmerge Gate: 29305450785 PASS
S0 authorization: READY_FOR_MERGE
authorization effective: false
design status: DESIGN_FROZEN_CANDIDATE_V0_4
implementation status: NOT_AUTHORIZED
runtime source authorized: false
active delivery slice: MCFT-CAP-05.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1
predecessor checkpoint sequence: 72
predecessor latest logical time: 2026-06-04T01:00:00.000Z
canonical next logical tick: 2026-06-04T02:00:00.000Z
latest successful Forecast: twin_forecast_run_f39699032a45814603caddf5
latest Scenario Set: twin_scenario_set_f382a595734b3262b5bc6fd9
predecessor lock: docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-PREDECESSOR-LOCK.json
next eligible slice after merge and merged-main Gate: MCFT-CAP-05.MCFT-01-13-15.CONTROLLED-FEEDBACK-REPLAY-DATASET-V1
successor MCFT-CAP-06 authorized: false
```

The S0 branch contains governance artifacts and isolated PostgreSQL predecessor proof only. Runtime implementation remains forbidden until S0 merges and its merged-main Authorization Gate passes.

<!-- MCFT-CAP-05-S0-AUTHORIZATION-END -->


<!-- MCFT-CAP-05-S1-DATASET-START -->

## MCFT-CAP-05 S1 controlled feedback Replay Dataset candidate

```text
baseline main: 55b61b36a7d408ab68c2786499e14bab886d01e2
S0 exact head: 0d86de86c1f887a0d1b1a4a1aeb98afab6ed432f
S0 merge commit: 55b61b36a7d408ab68c2786499e14bab886d01e2
S0 merged-main Authorization Gate: 29306075015 SUCCESS
active delivery slice: MCFT-CAP-05.MCFT-01-13-15.CONTROLLED-FEEDBACK-REPLAY-DATASET-V1
status: IMPLEMENTATION_CANDIDATE
authorization effective: true
capability Runtime source authority: true
S1 Runtime source change: false
positive Replay Evidence records: 8
negative fixtures: 12
canonical Twin object fact delta: 0
Replay Evidence fact delta: 8
next delivery slice: MCFT-CAP-05.MCFT-02-06-11-13-15.CONTRACTS-PROJECTION-MATH-CONFIG-V1
next delivery slice authorized: false
successor MCFT-CAP-06 authorized: false
```

Established in this bounded slice: deterministic Human Decision request, Approval Assertion, Approved Plan, optional External Dispatch, Execution Receipt, exact 03:00 soil observation, rainfall and ET0 Replay Evidence; source semantic hashes; logical-time availability; Evidence identity/idempotency; deterministic generation; and isolated PostgreSQL append-only facts ingress proof.

No `twin_decision_record_v1`, `twin_action_feedback_v1`, `twin_forecast_residual_v1`, State, checkpoint, migration, production Runtime source, route, web, Recommendation, AO-ACT, calibration or CAP-06 authorization is introduced.

<!-- MCFT-CAP-05-S1-DATASET-END -->


<!-- MCFT-CAP-05-S2-CONTRACTS-CONFIG-START -->

## MCFT-CAP-05 S2 contracts, projection math and Runtime Config candidate

```text
baseline main: 552d19505f0cd93584c899665b7d7b339f67e9fe
S1 exact head: 6e2e3e238c5b7886e4d21d7899406e5642192500
S1 merge commit: 552d19505f0cd93584c899665b7d7b339f67e9fe
S1 merged-main Gate: 29306783482 SUCCESS
active delivery slice: MCFT-CAP-05.MCFT-02-06-11-13-15.CONTRACTS-PROJECTION-MATH-CONFIG-V1
status: IMPLEMENTATION_CANDIDATE
authorization effective: true
runtime source authorized: true
new canonical object types: 0
new transaction families: 0
canonical fact delta: 0
migration delta: 0
next delivery slice: MCFT-CAP-05.MCFT-03.PERSISTENCE-IDEMPOTENCY-RECOVERY-V1
next delivery slice authorized: false
successor MCFT-CAP-06 authorized: false
```

Established in this bounded slice: pure G Decision, H Action Feedback and C Forecast Residual builders/validators; immutable Decision second-write policy; Action Feedback to existing ExecutedIrrigationCandidateV1 adapter; exact-one-event guard; fixed-point H=1 Forecast-to-observation projection and normalized residual math; eight immutable CAP-05 Runtime Configs chained from the predecessor State-bound config; and rebuildable feedback-cycle projection.

Persistence, migration, canonical append, State/checkpoint writes, route, web, Recommendation, AO-ACT change, calibration and model activation remain outside S2.

<!-- MCFT-CAP-05-S2-CONTRACTS-CONFIG-END -->


---

## MCFT-CAP-05 S3 Persistence / Idempotency / Recovery Candidate

```text
capability_line_id: MCFT-CAP-05
delivery_slice_id: MCFT-CAP-05.MCFT-03.PERSISTENCE-IDEMPOTENCY-RECOVERY-V1
baseline_main_commit: 651878f63a704f78503acb8565087d7f980ada5a
status: IMPLEMENTATION_CANDIDATE
postgresql_acceptance_workflow: 29309606079 SUCCESS
canonical_store: public.facts
migration_count: 1
new_canonical_object_types: 0
new_transaction_families: 0
S4_authorized: false
CAP_06_authorized: false
```

Established candidate scope:

- reuse `G_HUMAN_DECISION_LINK_COMMIT`, `H_ACTION_FEEDBACK_COMMIT`, and `C_FORECAST_RESIDUAL_COMMIT`;
- append canonical objects only to `public.facts`;
- reuse `twin_object_idempotency_index_v1` with bounded G/H/C identity kinds;
- maintain mutable Decision, Action Feedback, Evidence-link, Forecast Residual, Approved Plan binding, and complete feedback-cycle projections;
- delete and rebuild CAP-05 guards/projections from canonical facts and graph refs;
- create no business-flow service, State Tick, route, Recommendation, AO-ACT change, calibration candidate, activation, or CAP-06 authority.


---

## MCFT-CAP-05 S4 Human Decision G Commit Candidate

```text
capability_line_id: MCFT-CAP-05
delivery_slice_id: MCFT-CAP-05.MCFT-13.HUMAN-DECISION-G-COMMIT-V1
baseline_main_commit: 7e2de9c00a4ecc305c27b6572a63914f38157dbd
status: IMPLEMENTATION_CANDIDATE
postgresql_acceptance_workflow: 29310564723 SUCCESS
transaction_family: G_HUMAN_DECISION_LINK_COMMIT
canonical_object_type: twin_decision_record_v1
canonical_decision_fact_delta: 1
downstream_inferred_fact_delta: 0
migration_delta: 0
S5_authorized: false
CAP_06_authorized: false
```

Established candidate scope:

- read an exact controlled Human Decision request Evidence ref/hash from `public.facts`;
- resolve the current Scenario, latest successful Forecast, active lineage, and revision from PostgreSQL readback;
- resolve the selected Scenario option by frozen semantic member ref/hash;
- build and commit one immutable `twin_decision_record_v1` through the existing G transaction and S3 persistence repository;
- return the exact existing object on response-loss retry;
- reject forged Evidence, forged option identity, stale Scenario, late Evidence, non-Human actor, wrong scope, and a different second Decision;
- create no Approval, Plan, Task, Dispatch, Action Feedback, State, checkpoint, route, Recommendation, AO-ACT, calibration, activation, or CAP-06 authority.


---

## MCFT-CAP-05 S5 Approval Assertion and Approved Plan Evidence Binding Candidate

```text
capability_line_id: MCFT-CAP-05
delivery_slice_id: MCFT-CAP-05.MCFT-01-13.APPROVAL-PLAN-EVIDENCE-BINDING-V1
baseline_main_commit: 7f2f2bec144cee4d90608c3a25c3dc7cac9f9189
status: IMPLEMENTATION_CANDIDATE
postgresql_acceptance_workflow: 29312412661 SUCCESS
approval_assertion_record_type: approval_assertion_evidence_v1
approved_plan_record_type: approved_irrigation_plan_snapshot_v1
canonical_object_delta: 0
transaction_family_delta: 0
migration_delta: 0
S6_authorized: false
CAP_06_authorized: false
```

Established candidate scope:

- validate controlled Human Approval Assertion Replay Evidence without exercising GEOX approval authority;
- bind Assertion and Approved Plan Evidence to the unique canonical S4 G Decision;
- derive scenario amount from the selected canonical Scenario option while preserving the distinct approved amount;
- validate explicit dispatch disposition and externally recorded Dispatch Evidence without creating dispatch;
- append Assertion and Plan as immutable facts with deterministic identity and response-loss idempotency;
- maintain exactly one active Plan projection through explicit supersession;
- rebuild Plan projections and supersession state from immutable facts;
- create no canonical Twin object, transaction family, migration, route, Recommendation, Task, Action Feedback, State/checkpoint, Forecast, Residual, AO-ACT, calibration, activation or CAP-06 authority.


---

## MCFT-CAP-05 S6 Action Feedback H Commit and Adapter Candidate

```text
capability_line_id: MCFT-CAP-05
delivery_slice_id: MCFT-CAP-05.MCFT-15.ACTION-FEEDBACK-H-COMMIT-ADAPTER-V1
baseline_main_commit: ef1c789b15a3e73f93c7e63907519faecb027563
status: IMPLEMENTATION_CANDIDATE
postgresql_acceptance_workflow: 29313657871 SUCCESS
canonical_object_type: twin_action_feedback_v1
transaction_family: H_ACTION_FEEDBACK_COMMIT
standard_actual_amount_mm: 13.600000
standard_spatial_coverage_fraction: 0.910000
standard_target_scope_equivalent_irrigation_mm: 12.376000
migration_delta: 0
S7_authorized: false
CAP_06_authorized: false
```

Established candidate scope:

- read one exact controlled irrigation Receipt Evidence ref/hash from `public.facts`;
- validate source/canonical payload identity, exact Reality scope, depth-mm unit, same-hour execution, role-time order and covered-footprint amount;
- resolve the active S5 Approved Plan and unique canonical S4 G Decision from PostgreSQL readback;
- validate optional external Dispatch Evidence without creating dispatch;
- map execution, validation and quality independently;
- build and commit canonical `twin_action_feedback_v1` through the existing H transaction and S3 persistence repository;
- preserve execution logical time for late Evidence and return exact existing H object on response-loss retry;
- adapt eligible H feedback into the existing executed-irrigation candidate while preserving raw amount and coverage;
- apply coverage exactly once in the existing irrigation aggregator;
- reject multiple eligible events, cross-hour execution, forged covered-footprint amount and volume units;
- create no State/checkpoint, Forecast, Residual, route, Recommendation, AO-ACT, calibration, activation or CAP-06 authority.
