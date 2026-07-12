<!-- docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-TASK.md -->
# GEOX MCFT-CAP-04 Task — Successful Forecast and Scenario Runtime

## 0. Authority

```text
capability_line_id: MCFT-CAP-04
display_alias: MCFT-4
name: Successful Forecast and Scenario Runtime
runtime_mode: REPLAY
target_completion_level: Level A
task_revision: v0.5
design_status: FINAL_FROZEN_CANDIDATE_V0_5
implementation_status: NOT_AUTHORIZED
runtime_source_authorized: false
```

This document freezes the successor design boundary only. P0 does not authorize Runtime source, persistence, migration, route, scheduler, API, frontend, canonical fact creation, Forecast execution, or Scenario execution.

## 1. Objective

MCFT-CAP-04 establishes a deterministic Replay-mode path from an already persisted posterior State to:

1. a canonical 72-hour `COMPLETED` Forecast;
2. a canonical Scenario set derived only from that successful Forecast;
3. atomic persistence, projections, restart/backfill, and failure recovery for those objects;
4. traceable provenance for all selected future forcing Evidence.

It does not establish Forecast residuals, calibration, model activation, recommendation, policy evaluation, decision, AO-ACT, continuous scheduling, live-field operation, or Minimum Complete Field Twin closure.

## 2. Frozen predecessor

The predecessor is MCFT-CAP-03 after R4 remediation and final verification.

```text
predecessor_status: COMPLETE
predecessor_verification_status: VERIFIED_ON_MAIN
predecessor_r4_a: MERGED_EFFECTIVE
predecessor_r4_b: MERGED_EFFECTIVE
predecessor_r4_c: MERGED_EFFECTIVE
remaining_nonconformant_hard_acceptance_count: 0
remaining_unadjudicated_contract_deviation_count: 0
predecessor_latest_successful_forecast_ref: null
```

The CAP-04 predecessor Runtime Config authority is the previous posterior State. Every new operation must read and validate both `runtime_config_ref` and `runtime_config_hash` from the previous posterior State. Selection of an active, latest, or ambient Runtime Config is forbidden.

The forward checkpoint contract must declare:

```text
latest_successful_forecast_ref: string | null
```

No implementation may infer non-nullability from historical bootstrap or blocked-Forecast fixtures.

## 3. Canonical Tick-root boundary

`twin_runtime_tick_v1` retains exactly six direct references:

```text
evidence_window_ref
state_transition_ref
assimilation_update_ref
posterior_state_ref
forecast_result_ref
checkpoint_ref
```

Health is not a seventh direct Tick-root reference. Operational recovery discovers Health records by the reverse link `health.payload.tick_ref`.

A `COMPLETED` Forecast permits a `COMPLETED` Tick. A `BLOCKED` Forecast permits `COMPLETED_WITH_LIMITATIONS`. A failed Forecast is operational audit evidence and does not create a terminal Tick or advance the checkpoint.

## 4. Successful Forecast contract

A successful Forecast is one canonical `twin_forecast_run_v1` aggregate with:

```text
status: COMPLETED
points_count: 72
horizons: 1..72
source_posterior_ref: required
runtime_config_ref: required
runtime_config_hash: required
scenario_eligible: true
```

The Forecast envelope and determinism basis must include the selected Weather Evidence refs and selected ET0 Evidence refs. The Future Forcing Evidence Window must be frozen before Forecast math and must enforce Replay logical time, no-future-leakage, scope equality, unit authority, deterministic selection, and duplicate conflict rejection.

A successful Forecast advances both the latest Forecast-result pointer and `latest_successful_forecast_ref`. A blocked Forecast advances only the latest Forecast-result pointer. A failed Forecast advances neither.

## 5. Reuse and replacement rulings

The following classifications are binding:

| source capability | element | ruling |
|---|---|---|
| P42 | Forecast contract and negative boundary | REFERENCE_ONLY |
| P42 | acceptance ledger and file persistence | REPLACE |
| P50 | explicit Replay clock and Evidence partition | REUSE_WITH_ADAPTER |
| P50 | no-future-leakage invariant | REUSE_AS_IS |
| P50 | linear demo Forecast math | REPLACE |
| root-zone Forecast | daily bucket algorithm | EXTRACT_ALGORITHM |
| root-zone Forecast | daily Forecast contract | REPLACE |
| root-zone Scenario | fixed irrigation options and trajectory algorithm | EXTRACT_ALGORITHM |
| root-zone Scenario | Scenario contract | REUSE_WITH_ADAPTER |

No P42 or P50 acceptance ledger becomes canonical MCFT persistence.

## 6. Scenario contract

Scenario Runtime consumes only a canonical `COMPLETED` 72-point Forecast. It must not consume a blocked or failed Forecast.

The Scenario set:

```text
object_type: twin_scenario_set_v1
source_forecast_ref: required
runtime_config_ref: required
runtime_config_hash: required
source_forecast_status: COMPLETED
source_forecast_points_count: 72
source_forecast_horizons: 1..72
```

Scenario identity has no external dangling assumption pointer. The field `assumption_ref` is forbidden. All option assumptions that participate in identity must be embedded in the canonical Scenario payload and covered by the determinism hash.

## 7. Projection boundary

Canonical projections are separate from compatibility projections.

```text
canonical Forecast projection:
apps/server/src/projections/root_zone_soil_water_forecast_v1.ts

canonical Scenario projection:
apps/server/src/projections/root_zone_irrigation_scenario_set_v1.ts

legacy compatibility Scenario projection:
apps/server/src/projections/irrigation_scenario_set_v1.ts
```

The legacy projection is deprecated compatibility readback. It must not become the canonical Scenario index, canonical writer, or identity authority.

## 8. Persistence and recovery boundary

Forecast success is committed with the State Tick transaction family and must preserve canonical uniqueness, aggregate idempotency, compare-and-swap checkpoint advancement, and object cross-reference validation.

Scenario is committed in its own Scenario transaction family after a successful Forecast is durable. Scenario retry must be idempotent and must not mutate the source Forecast or State Tick.

Restart, bounded forward backfill, and recovery must preserve:

- exact predecessor State and Runtime Config pins;
- exact Future Forcing Evidence selection;
- Forecast determinism and 72-point continuity;
- reverse Health recovery through `health.payload.tick_ref`;
- Scenario uniqueness by source Forecast and deterministic assumptions;
- no automatic recompute from late Evidence.

## 9. Delivery lifecycle

Delivery is strictly serial. A downstream slice is not authorized until its predecessor is merged to `main` and its merged-main gate is effective.

| phase | delivery slice | P0 state |
|---|---|---|
| P0 | `MCFT-CAP-04.P0.PREDECESSOR-SSOT-AND-TASK-FREEZE-V1` | READY_FOR_MERGE |
| S0 | `MCFT-CAP-04.S0.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1` | BLOCKED |
| S1 | `MCFT-CAP-04.S1.CONTRACTS-CONFIG-AND-PROVENANCE-V1` | BLOCKED |
| S2 | `MCFT-CAP-04.S2.FUTURE-FORCING-EVIDENCE-WINDOW-V1` | BLOCKED |
| S3 | `MCFT-CAP-04.S3.SUCCESSFUL-FORECAST-MATH-AND-RECORD-SET-V1` | BLOCKED |
| S4 | `MCFT-CAP-04.S4.FORECAST-PERSISTENCE-AND-PROJECTIONS-V1` | BLOCKED |
| S5 | `MCFT-CAP-04.S5.TICK-INTEGRATION-AND-HEALTH-RECOVERY-V1` | BLOCKED |
| S6 | `MCFT-CAP-04.S6.SCENARIO-CONTRACTS-AND-TRAJECTORY-V1` | BLOCKED |
| S7 | `MCFT-CAP-04.S7.SCENARIO-PERSISTENCE-AND-PROJECTIONS-V1` | BLOCKED |
| S8 | `MCFT-CAP-04.S8.RESTART-BACKFILL-AND-FAILURE-RECOVERY-V1` | BLOCKED |
| S9 | `MCFT-CAP-04.S9.CLOSURE-V1` | BLOCKED |
| S10A | `MCFT-CAP-04.S10A.FINALIZATION-CANDIDATE-V1` | BLOCKED |
| S10B | `MCFT-CAP-04.S10B.EXACT-HEAD-FINAL-VERIFICATION-V1` | BLOCKED |
| S10C | `MCFT-CAP-04.S10C.POSTMERGE-EFFECTIVENESS-V1` | BLOCKED |

Capability completion is forbidden before S10A, S10B, and S10C are all effective. Exact-head validation without postmerge effectiveness is not completion.

## 10. Hard nonclaims at P0

```text
NO_MCFT_CAP_04_AUTHORIZATION
NO_MCFT_CAP_04_RUNTIME_SOURCE
NO_SUCCESSFUL_FORECAST
NO_72_HOUR_FORECAST
NO_FUTURE_FORCING_WINDOW
NO_SCENARIO
NO_FORECAST_RESIDUAL
NO_CALIBRATION_CANDIDATE
NO_SHADOW_EVALUATION
NO_MODEL_ACTIVATION
NO_RECOMMENDATION
NO_POLICY_EVALUATION
NO_DECISION
NO_AO_ACT
NO_CONTINUOUS_RUNTIME
NO_CONTINUOUS_SCHEDULER
NO_LIVE_FIELD_CLAIM
NO_MCFT_GATE_A_CLOSURE
NO_MCFT_GATE_B_CLOSURE
NO_MCFT_GATE_C_CLOSURE
NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
```

## 11. P0 effectiveness condition

P0 becomes effective only after:

1. this five-file candidate is merged to `main`;
2. exact-head CI passes;
3. the merge tree is equivalent to the validated head;
4. merged-main P0 acceptance passes;
5. a separate effectiveness reconciliation records the result.

Until then, S0 and all Runtime implementation remain unauthorized.
