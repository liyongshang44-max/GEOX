// scripts/runtime_acceptance/mcft_cap_05_effective_runtime_config_fixture_v1.ts
// Purpose: compile one canonical CAP-05 effective feedback Runtime Config from a canonical CAP-04 acceptance Config while preserving the predecessor Config as the explicit parent authority.
// Boundary: acceptance fixture only; no production persistence, active binding, Runtime execution, validator relaxation, calibration, Model Activation, or CAP-06 authority.

import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import type { Cap04RuntimeConfigPayloadV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import { compileCap05EffectiveRuntimeConfigV1 } from "../../apps/server/src/runtime/twin_runtime/effective_feedback_runtime_config_v1.js";

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

export function buildCap05EffectiveRuntimeConfigFromCap04FixtureV1(
  source: CanonicalObjectEnvelopeV1,
): CanonicalObjectEnvelopeV1 {
  if (source.object_type !== "twin_runtime_config_v1") {
    throw new Error("CAP05_FIXTURE_PARENT_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
  }
  const payload = source.payload as unknown as Cap04RuntimeConfigPayloadV1;
  return compileCap05EffectiveRuntimeConfigV1({
    scope: {
      tenant_id: source.tenant_id,
      project_id: source.project_id,
      group_id: source.group_id,
      field_id: source.field_id,
      season_id: source.season_id,
      zone_id: source.zone_id,
    },
    effective_logical_time: source.logical_time,
    created_at: source.created_at,
    parent_runtime_config_ref: source.object_id,
    parent_runtime_config_hash: source.determinism_hash,
    reality_binding_ref: requiredStringV1(payload.reality_binding_ref, "CAP05_FIXTURE_REALITY_BINDING_REF_REQUIRED"),
    reality_binding_hash: requiredStringV1(payload.reality_binding_hash, "CAP05_FIXTURE_REALITY_BINDING_HASH_REQUIRED"),
    source_matrix_hash: requiredStringV1(payload.source_matrix_hash, "CAP05_FIXTURE_SOURCE_MATRIX_HASH_REQUIRED"),
    configuration_matrix_hash: requiredStringV1(
      payload.configuration_matrix_hash,
      "CAP05_FIXTURE_CONFIGURATION_MATRIX_HASH_REQUIRED",
    ),
    geometry_semantic_hash: requiredStringV1(payload.geometry_semantic_hash, "CAP05_FIXTURE_GEOMETRY_HASH_REQUIRED"),
  });
}
