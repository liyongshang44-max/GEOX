<!-- docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md -->
# GEOX DT-02 to MCFT Implementation Map

## 0. Authority and interpretation

DT-02 freezes the Runtime architecture. MCFT capability lines deliver bounded executable vertical closure slices against that architecture. Capability-line completion does not mark horizontal owner work packages complete.

```text
capability_line_id
  vertical executable capability closure unit

owner_work_package_id
  horizontal architecture ownership catalogue entry

delivery_slice_id
  bounded implementation slice delivered by a capability line
```

Historical per-slice evidence remains authoritative in each capability directory. This map records the current cross-capability implementation state and successor boundary.

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

## 2. MCFT-CAP-01 canonical completion

```text
capability: MCFT-CAP-01 — First-Class Water State Estimate
status: COMPLETE
runtime mode: REPLAY
runtime delivery main commit: 4a0fd03beb05298028101a4999c67a5e053dadb8
remediation merge commit: 7da8fee4daf1f022edff29078a1bbac207d1a32f
main verification commit: 53aa944da595c515619229d37be86930d7a2e7e7
active delivery slice: null
```

Established bounded proof includes controlled Canonical Replay Evidence, immutable Runtime Config, bootstrap posterior, A0 aggregate idempotency, nine-fact atomic append, six rebuildable projections, INITIAL lineage/checkpoint, persisted next-tick handoff, cross-reference graph validation, and the operator-invokable manual Runtime entry.

Preserved boundary:

```text
NO_PROPAGATION
NO_SUCCESSFUL_FORECAST
NO_SCENARIO
NO_CONTINUOUS_RUNTIME
NO_LIVE_FIELD_CLAIM
NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
```

Detailed evidence:

```text
docs/digital_twin/mcft/cap_01/
```

## 3. MCFT-CAP-02 canonical completion

```text
capability: MCFT-CAP-02 — Hourly Dynamics and Persistence
status: COMPLETE
runtime mode: REPLAY
closure PR: #2327
closure merge and verified main: 08f0b5c146959b2a3988cd3ea07647628b0e84ad
merged-main Closure Gate: 161 PASS, 0 FAIL
completion claims: 12 EFFECTIVE
active delivery slice: null
```

Established bounded proof includes deterministic fixed-point hourly water Dynamics, exact mass-balance trace, additive process uncertainty, exact-hour Evidence selection, continuation State/checkpoint chains, operation idempotency, canonical uniqueness, restart/resume, bounded forward backfill, projection rebuild, and executed-irrigation input policy.

Preserved boundary:

```text
NO_OBSERVATION_UPDATE_APPLIED
NO_SUCCESSFUL_FORECAST
NO_72_HOUR_FORECAST
NO_SCENARIO
NO_CONTINUOUS_RUNTIME
NO_LIVE_FIELD_CLAIM
NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
```

Detailed evidence:

```text
docs/digital_twin/mcft/cap_02/
```

## 4. MCFT-CAP-03 canonical completion after R4

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
```

Finalization authority:

```text
finalization PR: #2365
finalization head: 9827846038083092bedeabdbf8f9713f587c083b
finalization CI: CI_4768
finalization merge: e42a9a799b8f27110e3955d645f3ea70c50c0588
finalization postmerge Gate: 58 PASS, 0 FAIL
```

Post-completion R4 authority:

```text
audit issue: #2368
R4-A: MERGED_EFFECTIVE
R4-B: MERGED_EFFECTIVE
R4-C: MERGED_EFFECTIVE
R4 final verification PR: #2375
R4 exact-head CI: CI_4801
R4 verification merge: cda1016542300bbc477a1c72023401aaaad954bc
R4 task conformance: VERIFIED_AFTER_R4_REMEDIATION
remaining hard nonconformance: 0
remaining unadjudicated contract deviation: 0
active record-set contract: MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2
```

Persisted Runtime handoff after CAP-03:

```text
global State count: 49
global continuation State count: 48
latest checkpoint sequence: 48
latest logical time: 2026-06-03T01:00:00.000Z
next tick: 2026-06-03T02:00:00.000Z
latest successful Forecast: null
```

Established bounded proof includes deterministic observation selection, PASS acceptance, LIMITED downweighting, candidate exclusion, innovation outlier rejection, posterior correction, uncertainty update, disposition trace, 24 observation-aware persisted ticks, restart/backfill recovery, canonical State uniqueness, and explicit V1/V2 compatibility dispatch.

Preserved boundary:

```text
NO_FORECAST_RESIDUAL
NO_SUCCESSFUL_FORECAST
NO_72_HOUR_FORECAST
NO_SCENARIO
NO_RECOMMENDATION
NO_POLICY_EVALUATION
NO_DECISION
NO_AO_ACT
NO_CALIBRATION_CANDIDATE
NO_MODEL_ACTIVATION
NO_CONTINUOUS_RUNTIME
NO_CONTINUOUS_SCHEDULER
NO_LIVE_FIELD_CLAIM
NO_MCFT_GATE_A_CLOSURE
NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
```

Detailed evidence:

```text
docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-MAIN-VERIFICATION.json
docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-FINAL-VERIFICATION.json
docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json
```

## 5. MCFT-CAP-04 P0 governance reconciliation

```text
capability: MCFT-CAP-04 — 72-Hour Forecast and Three Scenarios
runtime mode: REPLAY
target level: Level A — Deterministic Replay Twin
design_status: FINAL_FROZEN_CANDIDATE_V0_5
implementation_status: NOT_AUTHORIZED
runtime_source_authorized: false
authorization_effective: false
active delivery slice: MCFT-CAP-04.P0.CAP-03-GLOBAL-SSOT-RECONCILIATION-V1
next delivery slice: MCFT-CAP-04.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1
next delivery slice authorized: false
successor: MCFT-CAP-05
successor authorized: false
```

P0 is governance-only. It reconciles the global CAP-03 terminal state with the effective Main Verification and R4 Final Verification. It does not authorize S0 and does not authorize Runtime source changes.

P0 exact boundary:

```text
docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md
docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json
docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-P0-STATUS.json
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_P0_PREDECESSOR_SSOT.cjs
```

Runtime source remains forbidden until both conditions are true:

```text
1. P0 PR merged to main and merged-main P0 Gate PASS
2. S0 authorization/predecessor-lock PR merged to main and merged-main Authorization Gate PASS
```

Only after S0 effectiveness may the first CAP-04 Runtime delivery slice set:

```text
design_status: DESIGN_FROZEN
implementation_status: READY_FOR_IMPLEMENTATION
runtime_source_authorized: true
```

## 6. CAP-04 frozen architecture boundaries

CAP-04 must implement the existing DT-02 transaction families rather than invent a parallel Runtime:

```text
A1_COMPLETED
  valid posterior State
  Forecast.status = COMPLETED
  Forecast.points = exactly 72
  horizons = 1..72
  terminal tick = COMPLETED
  checkpoint advances
  latest Forecast result advances
  latest successful Forecast advances

A2_BLOCKED_FORECAST
  valid posterior State
  Forecast.status = BLOCKED
  Forecast.points = 0
  reason_codes required
  terminal tick = COMPLETED_WITH_LIMITATIONS
  checkpoint advances
  latest Forecast result advances
  latest successful Forecast unchanged

B_SCENARIO_COMMIT
  source Forecast.status = COMPLETED
  source Forecast.points = exactly 72
  one canonical Scenario Set
  three fixed options
  failure does not roll back source A1 State Tick
```

The Replay handoff authority is the previous posterior State and checkpoint. There is no Replay `active_runtime_config_ref` pointer. Runtime Config continuity is verified through:

```text
previous State.runtime_config_ref
previous State.runtime_config_hash
current Runtime Config.parent_runtime_config_ref
current Runtime Config.parent_runtime_config_hash
```

Future forcing must select Weather and ET0 as one coherent forcing-cycle pair. Forecast envelope `evidence_refs` must include the selected Weather and ET0 `Evidence.source_record_id` values. Snapshot hashes must equal the corresponding `Evidence.source_record_hash` values.

Scenario recovery authority is the previous checkpoint `forecast_result_ref`. A successful A1 followed by missing B creates a pending Scenario recovery barrier; A2 never creates a false pending-B state.

The latest successful Forecast pointer contract must support `string | null`: A1 advances it and A2 preserves it.

Tick-root canonical recovery uses the six frozen direct member refs plus `record_set_id`, aggregate determinism hash and operation variant. Runtime Health is recovered by a unique canonical reverse lookup where `health.payload.tick_ref == Tick.object_id`; no new Tick `health_ref` is introduced.

## 7. CAP-04 preserved nonclaims

```text
NO_MCFT_CAP_04_AUTHORIZATION_FROM_P0
NO_RUNTIME_SOURCE_AUTHORIZED_FROM_P0
NO_FORECAST_RESIDUAL
NO_RECOMMENDATION
NO_POLICY_EVALUATION
NO_HUMAN_DECISION
NO_APPROVAL
NO_ACTION_PLAN
NO_AO_ACT
NO_DISPATCH
NO_EXECUTION_RECEIPT
NO_OUTCOME_EVIDENCE
NO_CALIBRATION_CANDIDATE
NO_SHADOW_EVALUATION
NO_MODEL_ACTIVATION
NO_LATE_EVIDENCE_REVISION
NO_CONTINUOUS_SCHEDULER
NO_SHADOW_ONLINE_RUNTIME
NO_LIVE_FIELD_RUNTIME
NO_MCFT_GATE_A_CLOSURE
NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
```

## 8. Sequential execution rule

```text
P0 Global CAP-03 SSOT Reconciliation
  ↓ merged-main Gate PASS
S0 CAP-04 Authorization and Predecessor Lock
  ↓ merged-main Authorization Gate PASS
CAP-04 Runtime delivery slices, one active slice at a time
  ↓ merge-before-next
  ↓ postmerge-verify-before-next
Closure candidate
  ↓ merged-main Closure Gate PASS
Finalization/Main Verification candidate
  ↓ merged-main Finalization Gate PASS
Postmerge effectiveness reconciliation
```

Parallel downstream PRs are forbidden. A candidate branch or matrix readiness value is not merged-main Runtime authority.
