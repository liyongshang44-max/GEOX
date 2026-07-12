<!-- docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-TASK.md -->
# GEOX MCFT-CAP-04 — 72-Hour Forecast and Three Scenarios

## 0. Authority

```text
canonical_name: 72-Hour Forecast and Three Scenarios
capability_line_id: MCFT-CAP-04
display_alias: MCFT-4
runtime_mode: REPLAY
target_completion_level: Level A — Deterministic Replay Twin
primary_owner_work_package_id: MCFT-09
contributing_owner_work_package_ids:
  MCFT-02
  MCFT-03
  MCFT-04
  MCFT-05
  MCFT-06
  MCFT-07
  MCFT-08
  MCFT-10
excluded_owner_work_package_ids:
  MCFT-11
  MCFT-12
  MCFT-13
  MCFT-14
  MCFT-15
  MCFT-16
  MCFT-17
  MCFT-18
predecessor_capability_line_id: MCFT-CAP-03
successor_capability_line_id: MCFT-CAP-05
successor_authorized: false
task_version: v0.5
design_status: FINAL_FROZEN_CANDIDATE_V0_5
implementation_status: NOT_AUTHORIZED
first_permitted_repository_action: MCFT-CAP-04.P0.CAP-03-GLOBAL-SSOT-RECONCILIATION-V1
```

Execution order is mandatory:

```text
P0 Global CAP-03 SSOT Reconciliation
  ↓ merged-main P0 Gate PASS
S0 CAP-04 Authorization and Predecessor Lock
  ↓ merged-main Authorization Gate PASS
S1 through S8 Runtime delivery slices
  ↓ merge-before-next
  ↓ postmerge-verify-before-next
S9 Closure Candidate
  ↓ merged-main Closure Gate PASS
S10A Finalization Candidate
  ↓ exact-head CI PASS
S10B Main Verification Candidate
  ↓ merged-main Finalization Gate PASS
S10C Finalization Effectiveness Reconciliation
```

P0 does not authorize S0. S0 does not become effective before its implementation PR is merged to `main` and its merged-main Authorization Gate passes. No Runtime source may change before S0 effectiveness.

## 1. Capability scope

MCFT-CAP-04 establishes the first successful Forecast and Scenario Runtime on top of the persisted MCFT-CAP-03 posterior chain.

It must establish:

```text
one successful Forecast for every new valid posterior State on the same logical tick
exactly 72 hourly Forecast points from +1h through +72h
complete Future Forcing canonical trace
hourly deterministic mean propagation
hourly additive process uncertainty propagation
A1_COMPLETED canonical persistence
A2_BLOCKED_FORECAST legal degradation path
exactly three fixed Scenario options
B_SCENARIO_COMMIT canonical persistence
A1/A2 cross-variant terminal-tick uniqueness
A1-success/B-missing recovery barrier
24 contiguous Forecast + Scenario Runtime ticks
restart, bounded forward backfill, response-loss recovery
canonical readback and projection rebuild
```

### 1.1 Frozen nonclaims

MCFT-CAP-04 does not establish:

```text
Forecast Residual
Recommendation
Policy Evaluation
Human Decision
Approval
Action Plan
AO-ACT
Dispatch
Execution Receipt
Outcome Evidence
Calibration Candidate
Shadow Evaluation
Model Activation
Late-Evidence Revision
Continuous Scheduler
Shadow-online Runtime
Live Field Runtime
MCFT-GATE-A Closure
Minimum Complete Field Twin Complete
```

## 2. Predecessor authority

P0 and S0 must treat these files as predecessor SSOT:

```text
docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-MAIN-VERIFICATION.json
docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-FINAL-VERIFICATION.json
docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json
```

Expected predecessor facts:

```text
CAP-03 status: COMPLETE
CAP-03 verified_on_main: true
CAP-03 closure_effective: true
CAP-03 effective completion claims: 15
CAP-03 active record-set contract: MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2
global State count: 49
global continuation State count: 48
checkpoint sequence: 48
latest logical time: 2026-06-03T01:00:00.000Z
next tick logical time: 2026-06-03T02:00:00.000Z
latest successful Forecast ref: null
```

Any mismatch fails closed and forbids CAP-04 authorization.

## 3. P0 — Global CAP-03 SSOT Reconciliation

```text
delivery_slice_id: MCFT-CAP-04.P0.CAP-03-GLOBAL-SSOT-RECONCILIATION-V1
slice_kind: GOVERNANCE_ONLY
runtime_source_authorized: false
cap_04_authorized: false
```

P0 must:

```text
remove stale CAP-03 candidate state from the global Vertical Matrix
remove stale CAP-03 authorization/finalization candidate state from the DT-02 Implementation Map
record CAP-03 COMPLETE after R4
record CAP-04 as P0-only and NOT_AUTHORIZED
preserve every CAP-03 nonclaim related to Forecast, Scenario and downstream action
add the P0 status object and executable governance Gate
```

P0 exact changed-file boundary:

```text
docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md
docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json
docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-TASK.md
docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-P0-STATUS.json
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_P0_PREDECESSOR_SSOT.cjs
```

P0 effectiveness condition:

```text
P0 implementation PR merged to main
AND merged-main P0 Gate PASS
```

S0 exact baseline main commit must equal the effective P0 merge commit.

## 4. S0 — Authorization and Predecessor Lock

```text
delivery_slice_id: MCFT-CAP-04.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1
depends_on: MCFT-CAP-04.P0.CAP-03-GLOBAL-SSOT-RECONCILIATION-V1
slice_kind: GOVERNANCE_ONLY
```

S0 must read the PostgreSQL canonical path and freeze:

```text
active_lineage_ref
lineage_id
revision_id
latest posterior State ref/hash
latest checkpoint ref/hash
previous checkpoint.forecast_result_ref/hash
previous State runtime_config_ref/hash
Reality Binding ref/hash
next_tick_logical_time
checkpoint_sequence
latest_successful_forecast_ref
```

Replay Runtime Config authority is not an `active_runtime_config_ref` pointer. It is the config ref/hash bound to the previous posterior State.

Only after S0 merged-main effectiveness may the repository set:

```text
design_status: DESIGN_FROZEN
implementation_status: READY_FOR_IMPLEMENTATION
runtime_source_authorized: true
```

## 5. Runtime Config chain

CAP-04 must commit 24 immutable Runtime Config objects for the 24-tick closure range.

```text
C1.parent_runtime_config_ref/hash = final CAP-03 posterior State runtime_config_ref/hash
C2.parent_runtime_config_ref/hash = C1.object_id/determinism_hash
...
C24.parent_runtime_config_ref/hash = C23.object_id/determinism_hash
```

Every current tick State, Forecast and Scenario Set must pin the same current Runtime Config ref/hash.

The config must freeze:

```text
record-set contract version
Forecast model component and version
Future Forcing pair-selection policy
Weather and ET0 authority bindings
72-point horizon contract
uncertainty propagation policy
physical clipping policy
rounding policy
Scenario policy
three fixed Scenario option definitions
canonical uniqueness keys
projection authority
```

A Runtime Config is immutable. No active model parameter mutation is permitted.

## 6. Future Forcing contract

For Forecast issued at logical time `T`:

```text
issued_at = T
source_posterior.as_of = T
points = horizons 1..72
target_time(n) = T + n × PT1H
forcing interval(n) = (target_time(n) - PT1H, target_time(n)]
```

Weather and ET0 must be selected as one coherent forcing-cycle pair. Independent latest-per-role selection is forbidden.

The pair must match on:

```text
forcing_cycle_key
issued_at
available_to_runtime_at
valid_from
valid_to
point_count = 72
```

Each selected snapshot ref/hash must be canonical Evidence identity:

```text
snapshot_ref = Evidence.source_record_id
snapshot_hash = Evidence.source_record_hash
```

The Forecast envelope `evidence_refs` must include both selected Evidence source-record IDs, sorted and deduplicated.

Forbidden forcing conditions include:

```text
Weather unavailable at T
ET0 unavailable at T
forcing_cycle_key mismatch
issued_at mismatch
available_to_runtime_at mismatch
valid_from/to mismatch
Weather cycle N paired with ET0 cycle N-1
71 or 73 forcing points
gap
overlap
cross-snapshot stitching
future actual weather leakage
future Forecast revision leakage
conflicting Weather snapshot
conflicting ET0 snapshot
forcing hash mismatch
```

## 7. Forecast contract

A successful Forecast is one `twin_forecast_run_v1` aggregate with exactly 72 points.

Each point records:

```text
horizon_hour
target_time
interval_start
interval_end
predicted root-zone storage mean
predicted root-zone VWC mean
predicted available-water fraction
latent storage variance
latent VWC variance
published interval lower/upper
precipitation input
ET0 input
crop ET
assumed irrigation
runoff
drainage
overflow
physical clipping trace
```

Hard horizon rules:

```text
first horizon = 1
last horizon = 72
exact point count = 72
no horizon 0
no point at T
no duplicate target
no gap
no overlap
no out-of-order point
all targets hour aligned
```

Mean propagation reuses the CAP-02 pure fixed-point hourly water-balance Dynamics. It must not reuse P50 linear demo Forecast mathematics.

Reuse classification:

```text
P42 contract and negative boundaries: REFERENCE_ONLY
P50 linear demo Forecast: REPLACE
root_zone_soil_water_forecast_builder_v1 daily bucket formula: EXTRACT_ALGORITHM only
legacy daily Forecast contract: REPLACE
CAP-02 hourly water-balance Dynamics: REUSE_AS_IS through a pure Forecast adapter
```

Uncertainty propagation is additive and explicit. The published `mean ± 1.96σ` interval is:

```text
interval_semantics: CONTROLLED_UNCALIBRATED_NORMAL_APPROXIMATION
limitations:
  NO_CALIBRATED_FORECAST_PROBABILITY
  NORMALITY_NOT_FIELD_VALIDATED
  WEATHER_ENSEMBLE_UNCERTAINTY_NOT_MODELED
```

`latest_successful_forecast_ref` must be typed as `string | null` across handoff and expected-pointer contracts.

```text
A1 advances latest_successful_forecast_ref
A2 preserves latest_successful_forecast_ref
```

## 8. A1 and A2 transaction semantics

### 8.1 A1_COMPLETED

A1 appends exactly eight canonical objects:

```text
twin_evidence_window_v1
twin_state_transition_v1
twin_assimilation_update_v1
twin_state_estimate_v1
twin_forecast_run_v1
twin_runtime_tick_v1
twin_runtime_checkpoint_v1
twin_runtime_health_v1
```

A1 requirements:

```text
Forecast.status = COMPLETED
Forecast.points.length = 72
Forecast.horizons = 1..72
tick.status = COMPLETED
checkpoint advances
latest Forecast result advances
latest successful Forecast advances
Scenario eligible = true
```

### 8.2 A2_BLOCKED_FORECAST

A2 remains the legal degradation path when posterior State is valid but a non-State Forecast prerequisite is unavailable or insufficient.

```text
Forecast.status = BLOCKED
Forecast.points.length = 0
reason_codes non-empty
tick.status = COMPLETED_WITH_LIMITATIONS
checkpoint advances
latest Forecast result advances
latest successful Forecast unchanged
Scenario eligible = false
```

A1 and A2 share terminal-tick canonical uniqueness. The same scope/lineage/revision/logical-time may not commit both variants.

## 9. Scenario contract

Each successful Forecast produces exactly one canonical `twin_scenario_set_v1` through `B_SCENARIO_COMMIT`.

Fixed option order:

```text
1. NO_ACTION
2. IRRIGATE_NOW_15MM
3. IRRIGATE_NOW_25MM
```

Semantics:

```text
NO_ACTION requested/effective amount = 0
IRRIGATE_NOW_15MM requested amount = 15 mm at horizon 1
IRRIGATE_NOW_25MM requested amount = 25 mm at horizon 1
every option has exactly 72 trajectory points
```

`NO_ACTION.trajectory_points` must be an exact canonical deep copy of source `Forecast.points`. Option metadata remains outside `trajectory_points`.

Scenario mathematics may extract fixed-option trajectory algorithms from `root_zone_irrigation_scenario_builder_v1`, but the legacy Scenario contract is not canonical CAP-04 authority.

Scenario Set canonical uniqueness is independent from operation idempotency.

```text
canonical uniqueness key = source_forecast_ref + scenario_policy_id + runtime_config_ref
same key + same aggregate hash -> existing idempotent success
same key + different aggregate hash -> SCENARIO_SET_CANONICAL_CONFLICT
```

No ungrounded `assumption_ref` is permitted. Scenario identity and provenance use:

```text
source_forecast_ref/hash
runtime_config_ref/hash
scenario_policy_id
option_id
```

Scenario projection authority must be explicit:

```text
new canonical twin_runtime Scenario projections are authoritative
legacy root_zone_irrigation_scenario_set_index_v1 remains compatibility-only
no legacy projection may become canonical truth
```

## 10. A1/B recovery barrier

B is a separate transaction. Scenario failure does not roll back A1.

After a successful A1:

```text
checkpoint.forecast_result_ref = completed Forecast
Forecast is scenario eligible
```

If B is missing, restart/backfill must detect pending Scenario work from the previous checkpoint `forecast_result_ref`, canonical Forecast readback and Scenario canonical uniqueness lookup.

```text
A1 success + B missing -> recover B before next State tick
A2 -> no pending B
```

The Runtime must never advance a new State tick while an eligible previous Forecast lacks its required Scenario Set.

## 11. Canonical aggregate recovery

Tick-root recovery must not modify the frozen DT-02 direct-reference graph.

The Tick root contains:

```text
record_set_id
aggregate_determinism_hash
operation_variant
evidence_window_ref
state_transition_ref
assimilation_update_ref
posterior_state_ref
forecast_result_ref
checkpoint_ref
```

Runtime Health is recovered by unique canonical reverse lookup:

```text
health.payload.tick_ref == Tick.object_id
exactly one matching Health required
```

No new Tick `health_ref` is introduced.

Projection loss never authorizes a duplicate canonical aggregate. Rebuild starts from canonical facts and validates aggregate completeness and hashes before projection writes.

## 12. Delivery slices

### S1 — Contracts and Runtime Config

```text
delivery_slice_id: MCFT-CAP-04.MCFT-02-09-10.FORECAST-SCENARIO-CONTRACTS-CONFIG-V1
primary_owner: MCFT-02
contributors: MCFT-09, MCFT-10
depends_on: S0 merged-main verified
```

Freeze A1/A2/B contracts, Runtime Config chain, Future Forcing pair identity, 72-point Forecast aggregate identity, Scenario Set identity, canonical uniqueness, version dispatch and negative validators.

### S2 — Future Forcing selection

```text
delivery_slice_id: MCFT-CAP-04.MCFT-05-09.FUTURE-FORCING-SELECTION-V1
primary_owner: MCFT-05
contributors: MCFT-09
depends_on: S1 merged-main verified
```

Implement deterministic coherent Weather/ET0 pair selection and 72-point forcing alignment without database access in the pure selector.

### S3 — Pure Forecast mathematics

```text
delivery_slice_id: MCFT-CAP-04.MCFT-06-09.PURE-72-HOUR-FORECAST-MATH-V1
primary_owner: MCFT-09
contributors: MCFT-06
depends_on: S2 merged-main verified
```

Implement 72 hourly Dynamics steps, mean/variance propagation, interval publication, mass-balance trace and physical-bound trace.

### S4 — Pure Scenario mathematics

```text
delivery_slice_id: MCFT-CAP-04.MCFT-09-10.THREE-SCENARIO-MATH-V1
primary_owner: MCFT-10
contributors: MCFT-09
depends_on: S3 merged-main verified
```

Implement NO_ACTION, 15 mm and 25 mm option trajectories and deterministic summaries.

### S5 — Persistence and projections

```text
delivery_slice_id: MCFT-CAP-04.MCFT-03-09-10.FORECAST-SCENARIO-PERSISTENCE-V1
primary_owner: MCFT-03
contributors: MCFT-09, MCFT-10
depends_on: S4 merged-main verified
```

Implement A1/A2/B atomicity, CAS, idempotency, terminal uniqueness, successful-Forecast pointer, Scenario canonical uniqueness, canonical readback, projection authority and rebuild.

### S6 — Single-tick Forecast + Scenario integration

```text
delivery_slice_id: MCFT-CAP-04.MCFT-04-05-06-07-08-09-10.SINGLE-TICK-FORECAST-SCENARIO-INTEGRATION-V1
primary_owner: MCFT-04
contributors: MCFT-05, MCFT-06, MCFT-07, MCFT-08, MCFT-09, MCFT-10
depends_on: S5 merged-main verified
```

Pipeline:

```text
persisted CAP-03 handoff
→ current Evidence
→ Dynamics
→ Assimilation
→ posterior State
→ coherent Future Forcing
→ successful 72h Forecast
→ A1 commit
→ three Scenario options
→ B commit
→ canonical readback
→ T+1 handoff
```

### S7 — 24-tick Forecast + Scenario range

```text
delivery_slice_id: MCFT-CAP-04.MCFT-04-07-09-10.TWENTY-FOUR-TICK-FORECAST-SCENARIO-RANGE-V1
depends_on: S6 merged-main verified
```

Required result:

```text
24 new posterior States
24 successful Forecast Runs
24 Scenario Sets
24 × 72 = 1728 Forecast points
24 × 3 × 72 = 5184 Scenario points
checkpoint sequence = 49..72
global State count = 73
next tick = 2026-06-04T02:00:00.000Z
all 24 ticks are A1
closure fixture permits no A2
```

### S8 — Restart, backfill and failure recovery

```text
delivery_slice_id: MCFT-CAP-04.MCFT-03-04-07-09-10.RESTART-BACKFILL-FAILURE-RECOVERY-V1
depends_on: S7 merged-main verified
```

Proofs include:

```text
uninterrupted vs fresh-process aggregate-hash equivalence
A1 response-loss idempotency
B response-loss idempotency
A1 success/B missing recovery barrier
A2 no false pending-B
stale fencing rejection
CAS conflict rejection
same key/different hash rejection
terminal A1/A2 uniqueness
projection divergence fail closed
explicit projection rebuild
canonical aggregate recovery from Tick root plus Health reverse lookup
```

### S9 — Closure Candidate

```text
delivery_slice_id: MCFT-CAP-04.CLOSURE-CANDIDATE-V1
```

S9 aggregates evidence but does not activate completion claims.

### S10A — Finalization Candidate

```text
delivery_slice_id: MCFT-CAP-04.FINALIZATION-CANDIDATE-V1
```

S10A freezes exact implementation boundary and candidate evidence.

### S10B — Main Verification Candidate

```text
delivery_slice_id: MCFT-CAP-04.FINALIZATION-MAIN-VERIFICATION-V1
```

S10B records exact-head CI and merged-main Finalization Gate requirements. It does not self-claim effectiveness before merge.

### S10C — Finalization Effectiveness Reconciliation

```text
delivery_slice_id: MCFT-CAP-04.FINALIZATION-EFFECTIVENESS-V1
```

S10C records:

```text
S10B PR number
S10B exact head
exact-head CI result
S10B merge commit
head-to-merge tree equivalence
merged-main Finalization Gate result
status = COMPLETE
implementation_status = COMPLETE
active_delivery_slice_id = null
pending_completion_claims = []
effective_completion_claims = frozen completion set
successor_authorized = false
```

## 13. Acceptance inventory

Governance:

```text
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_P0_PREDECESSOR_SSOT.cjs
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_AUTHORIZATION.cjs
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_CLOSURE.cjs
```

Runtime:

```text
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PREDECESSOR_PREFLIGHT.ts
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_CONTRACTS_CONFIG.ts
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_FUTURE_FORCING.ts
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_FORECAST_MATH.ts
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SCENARIO_MATH.ts
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PERSISTENCE_DB.ts
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK.ts
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_24_TICK.ts
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_RESTART_BACKFILL.ts
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_FAILURE_RECOVERY.ts
```

## 14. Capability-wide allowed paths

```text
docs/digital_twin/mcft/cap_04/**
docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json
docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md
apps/server/src/domain/soil_water/**
apps/server/src/domain/twin_runtime/**
apps/server/src/runtime/twin_runtime/**
apps/server/src/persistence/twin_runtime/**
apps/server/src/projections/twin_runtime/**
apps/server/src/adapters/twin_runtime/**
apps/server/db/migrations/<exact CAP-04 additive migration>
apps/server/scripts/mcft/MCFT_CAP_04_FORECAST_SCENARIO_RUNNER.ts
fixtures/mcft/water_state/expected/MCFT_CAP_04_*
fixtures/mcft/water_state/negative/MCFT_CAP_04_*
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_*
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_*
apps/server/package.json only for the exact runner command
```

Forbidden unless separately amended:

```text
public write routes
web UI
scheduler
production adapters
AO-ACT semantics
Forecast Residual
Recommendation/Decision paths
workflow changes
DT-02 object-type additions
parallel Operator API namespace
```

## 15. Completion claim boundary

Only S10C may activate CAP-04 completion claims. Before S10C, every document and matrix must preserve:

```text
NO_MCFT_CAP_04_COMPLETE_CLAIM
NO_FORECAST_RESIDUAL
NO_RECOMMENDATION
NO_POLICY_EVALUATION
NO_DECISION
NO_AO_ACT
NO_CONTINUOUS_RUNTIME
NO_LIVE_FIELD_CLAIM
NO_MCFT_GATE_A_CLOSURE
NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
```
