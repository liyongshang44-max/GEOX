<!-- docs/digital_twin/GEOX-DT-01-REUSE-DECISION-REGISTER.md -->
# GEOX DT-01 Reuse Decision Register

## 0. Authority

```text
phase: DT-01
baseline: bce918d1eea423397bdd329148b7a2e7eb181b6c
next task: DT-02 Runtime Architecture Freeze
```

Every row inherits the exact retention/exclusion rule for its decision below. Component-specific adapter duties, formulas, replacement reasons, compatibility periods, callers, and deletion prerequisites are authoritative in the capability inventory.

## 1. Decision semantics

| decision | retained | excluded |
|---|---|---|
| REUSE_AS_IS | Core implementation and invariant | Semantic rewrite; a new caller may still be added |
| REUSE_WITH_ADAPTER | Core pattern or contract | Existing input, clock, persistence, route, or read-model wiring |
| EXTRACT_ALGORITHM | Formula, validation, deterministic rule | Current object contract, time grain, persistence, and runtime claim |
| REFERENCE_ONLY | Governance boundary, negative rule, acceptance structure | Implementation from MCFT runtime |
| REPLACE | Historical compatibility/readback only | Current core semantics or persistence as canonical MCFT behavior |
| DEPRECATE | Compatibility during migration | New functionality on the legacy entry; deletion waits for prerequisites |

## 2. Component register

| capability | component | decision | primary evidence | target |
|---|---|---|---|---|
| DT01-CAP-001 | `append_only_fact_store` | **REUSE_AS_IS** | `apps/server/src/store/pg_store.ts` | DT-02 |
| DT01-CAP-002 | `tenant_project_group_field_zone_scope` | **REUSE_AS_IS** | `apps/server/src/domain/soil_water/root_zone_soil_water_state_builder_v1.ts` | MCFT-00 |
| DT01-CAP-003 | `evidence_reference_rules` | **REUSE_AS_IS** | `apps/server/src/domain/skill_registry/facts.ts` | DT-02 |
| DT01-CAP-004 | `stable_hash_patterns` | **REUSE_AS_IS** | `apps/server/src/domain/soil_water/root_zone_soil_water_state_builder_v1.ts` | DT-02 |
| DT01-CAP-004 | `idempotency_patterns` | **REUSE_WITH_ADAPTER** | `apps/server/src/routes/control_ao_act.ts` | DT-02 |
| DT01-CAP-005 | `p50_trace_replay_pattern` | **REUSE_WITH_ADAPTER** | `scripts/twin_demo_runtime/P50_REPLAY_BACKED_DEMO_RUNTIME_RUNNER.cjs` | DT-02 |
| DT01-CAP-010 | `p31_contract_and_negative_boundaries` | **REFERENCE_ONLY** | `scripts/twin_kernel/P31_09_CONTINUOUS_STATE_ESTIMATION_RUNTIME_V0.cjs` | DT-02 |
| DT01-CAP-010 | `p31_fact_write_pattern` | **REUSE_WITH_ADAPTER** | `scripts/twin_kernel/P31_09_CONTINUOUS_STATE_ESTIMATION_RUNTIME_V0.cjs` | DT-02 |
| DT01-CAP-011 | `p42_contract` | **REFERENCE_ONLY** | `scripts/twin_kernel/P42_21_CONTROLLED_ACTIVE_TWIN_FORECAST_LOOP_RUNNER_V0.cjs` | MCFT-09 |
| DT01-CAP-011 | `p42_acceptance_ledger` | **REPLACE** | `scripts/twin_kernel/P42_21_CONTROLLED_ACTIVE_TWIN_FORECAST_LOOP_RUNNER_V0.cjs` | MCFT-03 |
| DT01-CAP-012 | `p43_residual_contract` | **REFERENCE_ONLY** | `scripts/twin_kernel/P43_21_CONTROLLED_FORECAST_RESIDUAL_MONITORING_RUNNER_V0.cjs` | MCFT-11 |
| DT01-CAP-012 | `p43_acceptance_ledger` | **REPLACE** | `scripts/twin_kernel/P43_21_CONTROLLED_FORECAST_RESIDUAL_MONITORING_RUNNER_V0.cjs` | MCFT-11 |
| DT01-CAP-013 | `p49_freeze_packet` | **REFERENCE_ONLY** | `docs/twin_runtime_v1/GEOX-TWIN-RUNTIME-V1-PILOT-FREEZE.md` | DT-02 |
| DT01-CAP-014 | `explicit_replay_clock` | **REUSE_WITH_ADAPTER** | `scripts/twin_demo_runtime/P50_REPLAY_BACKED_DEMO_RUNTIME_RUNNER.cjs` | DT-02 |
| DT01-CAP-014 | `evidence_partition` | **REUSE_WITH_ADAPTER** | `scripts/twin_demo_runtime/P50_REPLAY_BACKED_DEMO_RUNTIME_RUNNER.cjs` | DT-02 |
| DT01-CAP-014 | `no_future_leakage` | **REUSE_AS_IS** | `scripts/twin_demo_runtime/P50_REPLAY_BACKED_DEMO_RUNTIME_RUNNER.cjs` | DT-02 |
| DT01-CAP-014 | `trace_packet_structure` | **REUSE_WITH_ADAPTER** | `scripts/twin_demo_runtime/P50_REPLAY_BACKED_DEMO_RUNTIME_RUNNER.cjs` | DT-02 |
| DT01-CAP-014 | `average_value_state_estimator` | **REPLACE** | `scripts/twin_demo_runtime/P50_REPLAY_BACKED_DEMO_RUNTIME_RUNNER.cjs` | MCFT-06/07/08 |
| DT01-CAP-014 | `linear_demo_forecast` | **REPLACE** | `scripts/twin_demo_runtime/P50_REPLAY_BACKED_DEMO_RUNTIME_RUNNER.cjs` | MCFT-09 |
| DT01-CAP-014 | `mechanical_shadow_evaluation` | **REPLACE** | `scripts/twin_demo_runtime/P50_REPLAY_BACKED_DEMO_RUNTIME_RUNNER.cjs` | MCFT-12 |
| DT01-CAP-014 | `acceptance_output_persistence` | **REPLACE** | `scripts/twin_demo_runtime/P50_REPLAY_BACKED_DEMO_RUNTIME_RUNNER.cjs` | MCFT-03 |
| DT01-CAP-014 | `demo_namespace` | **REFERENCE_ONLY** | `docs/twin_demo_runtime/GEOX-P50-REPLAY-BACKED-PRODUCTION-TWIN-DEMO-RUNTIME.md` | DT-02 |
| DT01-CAP-015 | `p57_freeze_runner` | **REFERENCE_ONLY** | `scripts/full_runtime_freeze/P57_FULL_RUNTIME_FREEZE_RUNNER.cjs` | DT-02 |
| DT01-CAP-020 | `threshold_classifier` | **REPLACE** | `apps/server/src/projections/water_state_estimate_v1.ts` | MCFT-06/07/08 |
| DT01-CAP-020 | `derived_fact_history` | **REUSE_WITH_ADAPTER** | `apps/server/src/projections/water_state_estimate_v1.ts` | MCFT-08 |
| DT01-CAP-020 | `latest_index` | **REUSE_WITH_ADAPTER** | `apps/server/src/projections/water_state_estimate_v1.ts` | MCFT-08 |
| DT01-CAP-020 | `integration_status` | **DEPRECATE** | `apps/server/src/projections/water_state_estimate_v1.ts` | MCFT-08 |
| DT01-CAP-021 | `scope_validation_and_hash` | **REUSE_AS_IS** | `apps/server/src/domain/soil_water/root_zone_soil_water_state_builder_v1.ts` | MCFT-06/07/08 |
| DT01-CAP-021 | `spatial_aggregation` | **EXTRACT_ALGORITHM** | `apps/server/src/domain/soil_water/root_zone_soil_water_state_builder_v1.ts` | MCFT-06/07/08 |
| DT01-CAP-021 | `state_payload_contract` | **REPLACE** | `apps/server/src/domain/soil_water/root_zone_soil_water_state_builder_v1.ts` | MCFT-02/08 |
| DT01-CAP-022 | `daily_bucket_model` | **EXTRACT_ALGORITHM** | `apps/server/src/domain/soil_water/root_zone_soil_water_forecast_builder_v1.ts` | MCFT-09 |
| DT01-CAP-022 | `daily_forecast_contract` | **REPLACE** | `apps/server/src/domain/soil_water/root_zone_soil_water_forecast_builder_v1.ts` | MCFT-09 |
| DT01-CAP-023 | `fixed_irrigation_options_and_trajectory` | **EXTRACT_ALGORITHM** | `apps/server/src/domain/soil_water/root_zone_irrigation_scenario_builder_v1.ts` | MCFT-10 |
| DT01-CAP-023 | `scenario_contract` | **REUSE_WITH_ADAPTER** | `apps/server/src/domain/soil_water/root_zone_irrigation_scenario_builder_v1.ts` | MCFT-10 |
| DT01-CAP-024 | `state_latest_index` | **REUSE_WITH_ADAPTER** | `apps/server/src/projections/root_zone_soil_water_state_v1.ts` | MCFT-03/08 |
| DT01-CAP-025 | `forecast_latest_index` | **REUSE_WITH_ADAPTER** | `apps/server/src/projections/root_zone_soil_water_forecast_v1.ts` | MCFT-03/09 |
| DT01-CAP-026 | `scenario_latest_index` | **REUSE_WITH_ADAPTER** | `apps/server/src/projections/root_zone_irrigation_scenario_set_v1.ts` | DT-02/MCFT-10/17 |
| DT01-CAP-026 | `legacy_scenario_projection` | **DEPRECATE** | `apps/server/src/projections/irrigation_scenario_set_v1.ts` | MCFT-17 |
| DT01-CAP-030 | `controlled_residual_record` | **REFERENCE_ONLY** | `scripts/twin_kernel/P43_21_CONTROLLED_FORECAST_RESIDUAL_MONITORING_RUNNER_V0.cjs` | MCFT-11 |
| DT01-CAP-031 | `controlled_calibration_review` | **REFERENCE_ONLY** | `scripts/twin_kernel/P44_21_CONTROLLED_MODEL_ACTIVATION_RUNNER_V0.cjs` | MCFT-12 |
| DT01-CAP-032 | `controlled_model_candidate` | **REFERENCE_ONLY** | `scripts/twin_kernel/P44_21_CONTROLLED_MODEL_ACTIVATION_RUNNER_V0.cjs` | MCFT-12 |
| DT01-CAP-033 | `shadow_governance_sequence` | **REFERENCE_ONLY** | `scripts/twin_kernel/P44_21_CONTROLLED_MODEL_ACTIVATION_RUNNER_V0.cjs` | MCFT-12 |
| DT01-CAP-033 | `p50_mechanical_shadow_math` | **REPLACE** | `scripts/twin_demo_runtime/P50_REPLAY_BACKED_DEMO_RUNTIME_RUNNER.cjs` | MCFT-12 |
| DT01-CAP-034 | `controlled_activation_gate` | **REFERENCE_ONLY** | `scripts/twin_kernel/P44_21_CONTROLLED_MODEL_ACTIVATION_RUNNER_V0.cjs` | MCFT-12 |
| DT01-CAP-035 | `p50_active_consumption_trace` | **REUSE_WITH_ADAPTER** | `scripts/twin_demo_runtime/P50_REPLAY_BACKED_DEMO_RUNTIME_RUNNER.cjs` | MCFT-12 |
| DT01-CAP-040 | `canonical_field_routes` | **REUSE_WITH_ADAPTER** | `apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx` | DT-02/MCFT-18 |
| DT01-CAP-040 | `legacy_operator_twin_routes` | **DEPRECATE** | `apps/server/src/routes/v1/operator_twin.ts` | DT-02/MCFT-17 |
| DT01-CAP-041 | `field_runtime_adapters` | **REUSE_WITH_ADAPTER** | `apps/web/src/features/operator/fieldRuntime/fieldRuntimeEvidenceAdapter.ts` | MCFT-17/18 |
| DT01-CAP-042 | `state_tab` | **REPLACE** | `apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx` | MCFT-18 |
| DT01-CAP-043 | `forecast_tab` | **REPLACE** | `apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx` | MCFT-18 |
| DT01-CAP-044 | `scenario_tab` | **REUSE_WITH_ADAPTER** | `apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx` | MCFT-18 |
| DT01-CAP-045 | `residual_tab` | **REPLACE** | `apps/web/src/features/operator/fieldRuntime/fieldRuntimeEvidenceAdapter.ts` | MCFT-18 |
| DT01-CAP-046 | `calibration_tab` | **REUSE_WITH_ADAPTER** | `apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx` | MCFT-18 |
| DT01-CAP-050 | `controlled_twin_recommendation_bridge` | **REFERENCE_ONLY** | `scripts/twin_kernel/P46_21_CONTROLLED_RECOMMENDATION_FROM_TWIN_RUNNER_V0.cjs` | MCFT-13 |
| DT01-CAP-051 | `recommendation_candidate_path` | **REUSE_WITH_ADAPTER** | `apps/server/src/routes/decision_engine_v1.ts` | MCFT-13 |
| DT01-CAP-052 | `decision_policy_evaluation` | **REUSE_WITH_ADAPTER** | `apps/server/src/routes/decision_engine_v1.ts` | MCFT-13/14 |
| DT01-CAP-053 | `approval_request_service` | **REUSE_WITH_ADAPTER** | `apps/server/src/domain/approval/approval_request_service_v1.ts` | MCFT-13/14 |
| DT01-CAP-054 | `operation_plan_route` | **REUSE_WITH_ADAPTER** | `apps/server/src/routes/control_operation_plan_v1.ts` | MCFT-14 |
| DT01-CAP-055 | `ao_act_preflight` | **REUSE_WITH_ADAPTER** | `apps/server/src/routes/control_ao_act.ts` | MCFT-14 |
| DT01-CAP-056 | `ao_act_task_server_write` | **REUSE_WITH_ADAPTER** | `apps/server/src/routes/control_ao_act.ts` | MCFT-14 |
| DT01-CAP-057 | `action_receipt_server_write` | **REUSE_WITH_ADAPTER** | `apps/server/src/routes/control_ao_act.ts` | MCFT-14/15 |
| DT01-CAP-058 | `acceptance_server_path` | **REUSE_WITH_ADAPTER** | `apps/server/src/routes/acceptance_v1.ts` | MCFT-14/15 |
| DT01-CAP-059 | `as_executed_evidence_artifact` | **REUSE_WITH_ADAPTER** | `apps/server/src/routes/evidence_artifact_from_as_executed_v1.ts` | MCFT-15/CAT-10 |
| DT01-CAP-060 | `roi_ledger_server_and_db` | **REUSE_WITH_ADAPTER** | `apps/server/src/routes/roi_ledger_v1.ts` | CAT-10 |
| DT01-CAP-060 | `roi_controlled_gate` | **REFERENCE_ONLY** | `scripts/twin_kernel/P28_09_ROI_LEDGER_GATE_V0.cjs` | CAT-10 |
| DT01-CAP-061 | `field_memory_server_and_db` | **REUSE_WITH_ADAPTER** | `apps/server/src/routes/field_memory_v1.ts` | CAT-10/11 |
| DT01-CAP-061 | `field_memory_controlled_gates` | **REFERENCE_ONLY** | `scripts/twin_kernel/P29_09_FIELD_MEMORY_CANDIDATE_GATE_V0.cjs` | CAT-10/11 |
| DT01-CAP-062 | `effect_boundary` | **REFERENCE_ONLY** | `apps/server/src/domain/agronomy/effect_engine.ts` | CAT-10 |
| DT01-CAP-063 | `no_automatic_learning_boundary` | **REFERENCE_ONLY** | `docs/twin_kernel/NO_ROI_LEDGER_NO_FIELDMEMORY_NO_MODELUPDATE_POLICY_V0.json` | CAT-11 |

## 3. Decision totals

```text
REUSE_AS_IS: 6
REUSE_WITH_ADAPTER: 28
EXTRACT_ALGORITHM: 3
REFERENCE_ONLY: 16
REPLACE: 13
DEPRECATE: 3
```

## 4. Fixed high-risk rulings

```text
P50 explicit clock and evidence partition -> REUSE_WITH_ADAPTER
P50 no-future-leakage invariant -> REUSE_AS_IS
P50 state, forecast, shadow mathematics, and file persistence -> REPLACE
P57 freeze package -> REFERENCE_ONLY
water_state_estimate_v1 threshold semantics -> REPLACE
water_state_estimate latest index -> REUSE_WITH_ADAPTER as read index only
root-zone aggregation and daily bucket rules -> EXTRACT_ALGORITHM
Operator canonical route shell -> REUSE_WITH_ADAPTER
legacy Operator routes -> DEPRECATE registration only
AO-ACT server contracts -> REUSE_WITH_ADAPTER; task creation is not execution
ROI and Field Memory server/database core -> REUSE_WITH_ADAPTER for CAT
```

## 5. Missing capabilities

DT01-CAP-070 through DT01-CAP-079 are `MISSING` and therefore have no fictional reuse decision. Inventory Part 08 records owner, blocker status, reason, and removal condition.

## 6. Nonclaim

DT-01 registers decisions only. It performs no refactor, deletion, adapter implementation, or runtime implementation.
