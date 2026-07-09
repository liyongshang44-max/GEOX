// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_CONTRACTS_CONFIG.ts
// Purpose: verify the MCFT-CAP-02 continuation Runtime Config contract is deterministic, pinned to the predecessor lock, and rejects contract drift.
// Boundary: acceptance-only filesystem reads; no database, network, Runtime orchestration, or canonical write.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileContinuationRuntimeConfigV1,
} from "../../apps/server/src/runtime/twin_runtime/continuation_runtime_config_compile_service_v1.js";
import {
  validateContinuationRuntimeConfigSemanticPayloadV1,
  MCFT_CAP_02_CONTINUATION_CONFIG_PURPOSE_V1,
  MCFT_CAP_02_CONTINUATION_CONFIG_SELECTION_MODE_V1,
  MCFT_CAP_02_CONTINUATION_CROP_STAGE_CONTEXT_KIND_V1,
  MCFT_CAP_02_CONTINUATION_ROOT_ZONE_POLICY_ID_V1,
  MCFT_CAP_02_CONTINUATION_MODEL_ID_V1,
  MCFT_CAP_02_CONTINUATION_PROCESS_UNCERTAINTY_POLICY_V1,
  MCFT_CAP_02_CONTINUATION_NO_OBSERVATION_POLICY_V1,
  MCFT_CAP_02_CONTINUATION_FORECAST_BLOCK_POLICY_V1,
  type ContinuationRuntimeConfigSemanticPayloadV1,
} from "../../apps/server/src/domain/twin_runtime/continuation_runtime_config_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PREDECESSOR_LOCK_PATH = "docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-PREDECESSOR-LOCK.json";
const REALITY_PATH = "docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json";
const CONFIG_MATRIX_PATH = "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json";

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8")) as T;
}

function requireString(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function buildInput(createdAt: string) {
  const lock = readJson<Record<string, unknown>>(PREDECESSOR_LOCK_PATH);
  const reality = readJson<{ binding_id: string; determinism_hash: string; semantic_payload: { scope: Record<string, string>; geometry_binding: { geometry_semantic_hash: string } } }>(REALITY_PATH);
  const configurationMatrix = readJson<{
    configuration_source_definitions: Array<{ configuration_source_id: string; parameters: Record<string, { value: unknown }> }>;
    bindings: Array<{ binding_id: string; configuration_source_id: string; determinism_hash: string; source_role: string }>;
    determinism_hash: string;
  }>(CONFIG_MATRIX_PATH);

  const soilSourceDefinition = configurationMatrix.configuration_source_definitions.find((item) => item.configuration_source_id === "mcft_soil_hydraulic_config_c8_v1");
  if (!soilSourceDefinition) throw new Error("SOIL_HYDRAULIC_DEFINITION_NOT_FOUND");
  const soilBinding = configurationMatrix.bindings.find((binding) => binding.configuration_source_id === "mcft_soil_hydraulic_config_c8_v1");
  if (!soilBinding) throw new Error("SOIL_HYDRAULIC_BINDING_NOT_FOUND");

  const scope = lock.scope as Record<string, string>;
  const modelComponentRef = "root_zone_hourly_water_balance_model_component_v1";
  const soilRootZoneConfigRef = soilBinding.binding_id;
  const soilRootZoneConfigHash = soilBinding.determinism_hash;
  const cropStageContextRef = requireString(lock.crop_stage_context_ref, "CROP_STAGE_CONTEXT_REF_REQUIRED");
  const cropStageContextHash = requireString(lock.crop_stage_context_hash, "CROP_STAGE_CONTEXT_HASH_REQUIRED");

  return {
    created_at: createdAt,
    logical_time: "2026-06-01T02:00:00.000Z",
    scope: {
      tenant_id: scope.tenant_id,
      project_id: scope.project_id,
      group_id: scope.group_id,
      field_id: scope.field_id,
      season_id: scope.season_id,
      zone_id: scope.zone_id,
    },
    parent_runtime_config_ref: requireString(lock.bootstrap_runtime_config_ref, "PARENT_RUNTIME_CONFIG_REF_REQUIRED"),
    parent_runtime_config_hash: requireString(lock.bootstrap_runtime_config_hash, "PARENT_RUNTIME_CONFIG_HASH_REQUIRED"),
    reality_binding_ref: requireString(lock.reality_binding_ref, "REALITY_BINDING_REF_REQUIRED"),
    reality_binding_hash: requireString(lock.reality_binding_hash, "REALITY_BINDING_HASH_REQUIRED"),
    source_matrix_hash: requireString(lock.source_matrix_hash, "SOURCE_MATRIX_HASH_REQUIRED"),
    configuration_matrix_hash: requireString(lock.configuration_matrix_hash, "CONFIGURATION_MATRIX_HASH_REQUIRED"),
    geometry_semantic_hash: requireString(lock.geometry_semantic_hash, "GEOMETRY_SEMANTIC_HASH_REQUIRED"),
    crop_stage_context_ref: cropStageContextRef,
    crop_stage_context_hash: cropStageContextHash,
    soil_hydraulic_source_config_ref: soilSourceDefinition.configuration_source_id,
    soil_hydraulic_source_config_hash: soilSourceDefinition.configuration_semantic_hash,
    dynamics_model_component_ref: modelComponentRef,
    soil_root_zone_config_ref: soilRootZoneConfigRef,
    model_component_refs: [
      modelComponentRef,
      MCFT_CAP_02_CONTINUATION_PROCESS_UNCERTAINTY_POLICY_V1,
      MCFT_CAP_02_CONTINUATION_NO_OBSERVATION_POLICY_V1,
      MCFT_CAP_02_CONTINUATION_FORECAST_BLOCK_POLICY_V1,
    ],
  };
}

function assertContinuationRuntimeConfigShape(payload: ContinuationRuntimeConfigSemanticPayloadV1): void {
  assert.equal(payload.config_purpose, MCFT_CAP_02_CONTINUATION_CONFIG_PURPOSE_V1);
  assert.equal(payload.config_selection_mode, MCFT_CAP_02_CONTINUATION_CONFIG_SELECTION_MODE_V1);
  assert.equal(payload.crop_stage_context.context_kind, MCFT_CAP_02_CONTINUATION_CROP_STAGE_CONTEXT_KIND_V1);
  assert.equal(payload.crop_stage_context.resolution_policy_id, MCFT_CAP_02_CONTINUATION_ROOT_ZONE_POLICY_ID_V1);
  assert.equal(payload.dynamics_model.model_id, MCFT_CAP_02_CONTINUATION_MODEL_ID_V1);
  assert.equal(payload.process_uncertainty.policy_id, MCFT_CAP_02_CONTINUATION_PROCESS_UNCERTAINTY_POLICY_V1);
  assert.equal(payload.no_observation_update_policy.policy_id, MCFT_CAP_02_CONTINUATION_NO_OBSERVATION_POLICY_V1);
  assert.equal(payload.forecast_block_policy.policy_id, MCFT_CAP_02_CONTINUATION_FORECAST_BLOCK_POLICY_V1);
  assert.equal(payload.soil_hydraulic_snapshot.root_zone_depth_mm, 300);
  assert.equal(payload.soil_hydraulic_snapshot.wilting_point_storage_mm, 36);
  assert.equal(payload.soil_hydraulic_snapshot.field_capacity_storage_mm, 90);
  assert.equal(payload.soil_hydraulic_snapshot.saturation_storage_mm, 135);
  assert.equal(payload.rounding.output_decimals, 6);
  assert.equal(payload.rounding.rule, "DECIMAL_HALF_AWAY_FROM_ZERO_V1");
  assert.equal(payload.soil_root_zone_config_refs.length, 1);
  assert.equal(payload.model_component_refs.length, 4);
  assert.equal(payload.model_component_refs[0], payload.dynamics_model.model_component_ref);
}

let pass = 0;
function check(condition: unknown, message: string): void {
  assert.ok(condition, message);
  pass += 1;
  console.log(`PASS ${message}`);
}

const first = compileContinuationRuntimeConfigV1(buildInput("2026-07-10T00:00:00.000Z"));
const second = compileContinuationRuntimeConfigV1(buildInput("2026-07-10T00:01:00.000Z"));

validateContinuationRuntimeConfigSemanticPayloadV1(first.payload);
assertContinuationRuntimeConfigShape(first.payload as ContinuationRuntimeConfigSemanticPayloadV1);

check(first.object_type === "twin_runtime_config_v1", "continuation Runtime Config object type");
check(first.object_id === second.object_id, "audit created_at excluded from object identity");
check(first.determinism_hash === second.determinism_hash, "audit created_at excluded from semantic hash");
check(first.runtime_config_ref === null && first.runtime_config_hash === null, "continuation Runtime Config has no self-reference");
check(first.source_refs.length === 2, "continuation Runtime Config has two source refs");
check(first.source_refs[0] < first.source_refs[1], "continuation Runtime Config source refs are sorted deterministically");
check(first.payload.config_purpose === MCFT_CAP_02_CONTINUATION_CONFIG_PURPOSE_V1, "continuation config purpose frozen");
check(first.payload.config_selection_mode === MCFT_CAP_02_CONTINUATION_CONFIG_SELECTION_MODE_V1, "continuation config selection mode frozen");
check(first.payload.parent_runtime_config_ref === "twin_runtime_config_851ac30201221a7aa2ce16f7", "parent Runtime Config ref frozen");
check(first.payload.parent_runtime_config_hash === "sha256:44b8171ff2d6adb8e0f383ef0e813bebcb3f486b8848844eef2b7ff9d6db993c", "parent Runtime Config hash frozen");
check(first.payload.reality_binding_ref === "mcft_rb_bf1da664164a4fedda249bcb", "Reality binding ref frozen");
check(first.payload.reality_binding_hash === "sha256:bf1da664164a4fedda249bcb0e330c1af2083173a52bd704f01eac3ad277ba4f", "Reality binding hash frozen");
check(first.payload.source_matrix_hash === "sha256:c5187c23be0d058ffa23d464ae1139f924f5af064a270248746fbabde4c3e51b", "source matrix hash frozen");
check(first.payload.configuration_matrix_hash === "sha256:381ef166454c7b698c6641fadc5d08019fecff127e9529a4c58a1f09d9e1fef5", "configuration matrix hash frozen");
check(first.payload.geometry_semantic_hash === "sha256:d3dbc5495485e7af68acdc4b32e6061c2ea99772835be2805ae706b74d75ca51", "geometry semantic hash frozen");
check(first.payload.crop_stage_context.context_ref === "fixtures/mcft/water_state/replay_v1/configuration_context.json", "crop-stage context ref frozen");
check(first.payload.crop_stage_context.context_hash === "sha256:2287c71e983b1ba529e49939f025d9b035e09e195a5effc994fe54b4ef7863ce", "crop-stage context hash frozen");
check(first.payload.soil_hydraulic_snapshot.source_config_ref === "soil_hydraulic_config_c8_v1", "soil hydraulic config ref frozen");
check(first.payload.soil_hydraulic_snapshot.source_config_hash === "sha256:3d6e3d8b52a9736ff6898487cacbbffdf71578cca693754ab34cb484e5bc3082", "soil hydraulic config hash frozen");
check(first.payload.dynamics_model.model_component_ref === "root_zone_hourly_water_balance_model_component_v1", "model component ref frozen");
check(first.payload.dynamics_parameters.runoff_fraction === 0.05, "runoff fraction frozen");
check(first.payload.dynamics_parameters.drainage_coefficient_per_hour === 0.03, "drainage coefficient frozen");
check(first.payload.process_uncertainty.structural_process_stddev_mm_per_hour === 0.5, "structural process stddev frozen");
check(first.payload.process_uncertainty.rainfall_relative_stddev === 0.1, "rainfall relative stddev frozen");
check(first.payload.process_uncertainty.crop_et_relative_stddev === 0.15, "crop ET relative stddev frozen");
check(first.payload.process_uncertainty.executed_irrigation_relative_stddev === 0.1, "irrigation relative stddev frozen");
check(first.payload.no_observation_update_policy.policy_id === MCFT_CAP_02_CONTINUATION_NO_OBSERVATION_POLICY_V1, "no-observation policy frozen");
check(first.payload.forecast_block_policy.policy_id === MCFT_CAP_02_CONTINUATION_FORECAST_BLOCK_POLICY_V1, "forecast block policy frozen");
check(JSON.stringify(first.payload.soil_root_zone_config_refs) === JSON.stringify(["soil_hydraulic_config_c8_v1"]), "soil-root-zone ref list frozen");
check(JSON.stringify(first.payload.model_component_refs) === JSON.stringify([
  "root_zone_hourly_water_balance_model_component_v1",
  MCFT_CAP_02_CONTINUATION_PROCESS_UNCERTAINTY_POLICY_V1,
  MCFT_CAP_02_CONTINUATION_NO_OBSERVATION_POLICY_V1,
  MCFT_CAP_02_CONTINUATION_FORECAST_BLOCK_POLICY_V1,
]), "model component refs frozen");

const forged = buildInput("2026-07-10T00:00:00.000Z");
forged.parent_runtime_config_hash = "sha256:forged";
assert.throws(() => compileContinuationRuntimeConfigV1(forged), /PARENT_RUNTIME_CONFIG_HASH_REQUIRED|CONTINUATION_RUNTIME_CONFIG/);
check(true, "forged parent Runtime Config hash rejected");

console.log(`MCFT-CAP-02 contracts-config: ${pass} PASS, 0 FAIL`);
