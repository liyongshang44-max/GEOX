// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_DOMAIN.ts
// Purpose: prove the S4 CAP-05-to-CAP-04 execution projection selects only the frozen CAP-04 field set, remains non-canonical, preserves source identity, and fails closed on missing execution fields.
// Boundary: pure domain acceptance only; no database, persistence, graph query, calibration/shadow compute, Runtime authority, State/checkpoint mutation, active-config mutation, Model Activation, route, Web, scheduler, filesystem, environment, or network.

import assert from "node:assert/strict";
import {
  compileCap05EffectiveRuntimeConfigV1,
} from "../../apps/server/src/runtime/twin_runtime/effective_feedback_runtime_config_v1.js";
import {
  Cap05InheritedCap04ExecutionConfigResolverV1,
  projectCap05PayloadToCap04ExecutionPayloadV1,
} from "../../apps/server/src/runtime/twin_runtime/cap05_inherited_cap04_execution_config_resolver_v1.js";
import {
  CAP05_RUNTIME_CONFIG_PURPOSE_V1,
  type Cap05RuntimeConfigPayloadV1,
} from "../../apps/server/src/domain/twin_runtime/feedback_runtime_config_v1.js";
import {
  CAP04_CONFIG_SELECTION_MODE_V1,
  CAP04_RUNTIME_CONFIG_PURPOSE_V1,
} from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.js";

const EXPECTED_CAP04_KEYS = [
  "active_model_parameter_change",
  "configuration_matrix_hash",
  "config_purpose",
  "config_selection_mode",
  "crop_stage_context",
  "decimal_scale_policy_id",
  "dynamics_model",
  "dynamics_parameters",
  "effective_logical_time",
  "forecast_block_policy",
  "forecast_horizon_hours",
  "forecast_interval_method_id",
  "forecast_method_id",
  "forecast_method_version",
  "forecast_step_hours",
  "future_forcing_fallback_policy_id",
  "future_forcing_freshness_policy_id",
  "future_forcing_pair_policy_id",
  "future_forcing_policy_id",
  "geometry_semantic_hash",
  "irrigation_input_policy",
  "model_component_refs",
  "observation_assimilation",
  "parent_runtime_config_hash",
  "parent_runtime_config_ref",
  "physical_bound_policy_id",
  "process_uncertainty",
  "reality_binding_hash",
  "reality_binding_ref",
  "record_set_contract_ids",
  "rounding",
  "rounding_policy_id",
  "scenario_application_efficiency_policy",
  "scenario_option_ids",
  "scenario_policy_id",
  "soil_hydraulic_snapshot",
  "soil_root_zone_config_refs",
  "source_matrix_hash",
  "stress_threshold_policy",
  "uncertainty_propagation_method_id",
] as const;

function buildConfigV1() {
  return compileCap05EffectiveRuntimeConfigV1({
    scope: {
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      field_id: "field_c8_demo",
      season_id: "season_2026_c8_corn",
      zone_id: "zone_mcft_c8_water_001",
    },
    effective_logical_time: "2026-06-04T02:00:00.000Z",
    created_at: "2026-06-04T02:00:00.000Z",
    parent_runtime_config_ref: "runtime_config_parent_cap04_v1",
    parent_runtime_config_hash: "sha256:parent-cap04-v1",
    reality_binding_ref: "reality_binding_c8_v1",
    reality_binding_hash: "sha256:reality-binding-c8-v1",
    source_matrix_hash: "sha256:source-matrix-v1",
    configuration_matrix_hash: "sha256:configuration-matrix-v1",
    geometry_semantic_hash: "sha256:geometry-c8-v1",
  });
}

function main(): void {
  const config = buildConfigV1();
  const resolver = new Cap05InheritedCap04ExecutionConfigResolverV1();
  const resolved = resolver.resolveExecutionConfig(config);

  assert.deepEqual(Object.keys(resolved.payload).sort(), [...EXPECTED_CAP04_KEYS].sort());
  assert.equal(resolved.source_config_ref, config.object_id);
  assert.equal(resolved.source_config_hash, config.determinism_hash);
  assert.equal(resolved.source_config_purpose, CAP05_RUNTIME_CONFIG_PURPOSE_V1);
  assert.equal(resolved.payload.config_purpose, CAP04_RUNTIME_CONFIG_PURPOSE_V1);
  assert.equal(resolved.payload.config_selection_mode, CAP04_CONFIG_SELECTION_MODE_V1);
  assert.equal("object_id" in resolved, false);
  assert.equal("idempotency_key" in resolved, false);
  assert.equal("determinism_hash" in resolved, false);
  console.log("PASS positive CAP-04 field projection preserves source identity and remains non-canonical");

  const futurePolicyPayload = {
    ...(config.payload as Cap05RuntimeConfigPayloadV1),
    cap05_future_policy_field_v2: {
      must_not_leak: true,
    },
  } as Cap05RuntimeConfigPayloadV1;
  const futureProjected = projectCap05PayloadToCap04ExecutionPayloadV1(futurePolicyPayload);
  assert.deepEqual(Object.keys(futureProjected).sort(), [...EXPECTED_CAP04_KEYS].sort());
  assert.equal("cap05_future_policy_field_v2" in futureProjected, false);
  console.log("PASS unknown future CAP-05 policy fields cannot leak into the CAP-04 execution view");

  const missing = structuredClone(config.payload) as Partial<Cap05RuntimeConfigPayloadV1>;
  delete missing.model_component_refs;
  assert.throws(
    () => projectCap05PayloadToCap04ExecutionPayloadV1(missing as Cap05RuntimeConfigPayloadV1),
    /CAP04_CONFIG_(MODEL_COMPONENT_REFS_REQUIRED|POLICY_COMPONENT_REFS_REQUIRED)|DataCloneError|could not be cloned/i,
  );
  console.log("PASS missing frozen CAP-04 execution fields fail closed");

  const first = resolver.resolveExecutionConfig(config);
  const second = resolver.resolveExecutionConfig(structuredClone(config));
  assert.deepEqual(second, first);
  assert.notEqual(second.payload, first.payload);
  console.log("PASS execution projection is deterministic and returns isolated read-only value copies");

  console.log("MCFT_CAP_06_S4_DOMAIN:PASS");
}

main();
