// apps/server/src/runtime/twin_runtime/runtime_config_compile_service_v1.ts
// Purpose: compile parsed MCFT-00 authority artifacts into one immutable twin_runtime_config_v1 object.
// Boundary: pure application service; callers perform artifact I/O and persistence through separate adapters/ports.

import { computeMemberDeterminismHashV1, deriveSemanticObjectIdV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import { MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1, MCFT_CAP_01_EXPECTED_AUTHORITY_V1, type RuntimeConfigSemanticPayloadV1 } from "../../domain/twin_runtime/runtime_config_v1.js";

export type CompileRuntimeConfigInputV1 = {
  created_at: string; logical_time: string;
  scope: { tenant_id: string; project_id: string; group_id: string; field_id: string; season_id: string; zone_id: string };
  reality: { binding_id: string; determinism_hash: string; geometry_semantic_hash: string; root_zone_definition: Record<string, unknown> };
  source_matrix: { determinism_hash?: string; source_matrix_hash?: string; bindings: Array<{ binding_id: string; availability_semantics?: { release_policy_id?: string } }> };
  configuration_matrix: { determinism_hash?: string; configuration_matrix_hash?: string; bindings?: Array<{ binding_id?: string; configuration_id?: string }> };
};

function exact(actual: string | undefined, expected: string, code: string): void { if (actual !== expected) throw new Error(code); }

export function compileRuntimeConfigV1(input: CompileRuntimeConfigInputV1): CanonicalObjectEnvelopeV1 {
  exact(input.reality.binding_id, MCFT_CAP_01_EXPECTED_AUTHORITY_V1.binding_id, "REALITY_BINDING_ID_MISMATCH");
  exact(input.reality.determinism_hash, MCFT_CAP_01_EXPECTED_AUTHORITY_V1.reality_binding_hash, "REALITY_BINDING_HASH_MISMATCH");
  exact(input.reality.geometry_semantic_hash, MCFT_CAP_01_EXPECTED_AUTHORITY_V1.geometry_semantic_hash, "GEOMETRY_HASH_MISMATCH");
  exact(input.source_matrix.source_matrix_hash ?? input.source_matrix.determinism_hash, MCFT_CAP_01_EXPECTED_AUTHORITY_V1.source_matrix_hash, "SOURCE_MATRIX_HASH_MISMATCH");
  exact(input.configuration_matrix.configuration_matrix_hash ?? input.configuration_matrix.determinism_hash, MCFT_CAP_01_EXPECTED_AUTHORITY_V1.configuration_matrix_hash, "CONFIGURATION_MATRIX_HASH_MISMATCH");
  const releasePolicies = new Set(input.source_matrix.bindings.map((binding) => binding.availability_semantics?.release_policy_id).filter(Boolean));
  if (releasePolicies.size !== 1) throw new Error("REPLAY_RELEASE_POLICY_NOT_UNIQUE");
  const payload: RuntimeConfigSemanticPayloadV1 = {
    reality_binding_ref: input.reality.binding_id,
    reality_binding_hash: input.reality.determinism_hash,
    source_matrix_ref: "docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json",
    source_matrix_hash: MCFT_CAP_01_EXPECTED_AUTHORITY_V1.source_matrix_hash,
    configuration_matrix_ref: "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json",
    configuration_matrix_hash: MCFT_CAP_01_EXPECTED_AUTHORITY_V1.configuration_matrix_hash,
    geometry_semantic_hash: input.reality.geometry_semantic_hash,
    root_zone_definition: input.reality.root_zone_definition,
    soil_hydraulic_configuration_refs: (input.configuration_matrix.bindings ?? []).map((binding) => binding.binding_id ?? binding.configuration_id ?? "").filter(Boolean),
    source_binding_refs: input.source_matrix.bindings.map((binding) => binding.binding_id).sort(),
    replay_release_policy_id: [...releasePolicies][0] as string,
    tick_duration: "PT1H",
    evidence_window_rule: "OPEN_START_CLOSED_END_PT1H_V1",
    bootstrap_model_config: MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1,
    object_schema_versions: { twin_runtime_config_v1: "v1", A0_BOOTSTRAP_STATE_COMMIT: "v1" },
  };
  const identityPayload = { object_type: "twin_runtime_config_v1", scope: input.scope, payload };
  const objectId = deriveSemanticObjectIdV1("twin_runtime_config", identityPayload);
  const idempotencyKey = deriveSemanticObjectIdV1("runtime_config_key", identityPayload);
  const draft: CanonicalObjectEnvelopeV1 = {
    object_id: objectId, object_type: "twin_runtime_config_v1", schema_version: "v1",
    ...input.scope, logical_time: input.logical_time, as_of: input.logical_time,
    source_refs: [input.reality.binding_id], evidence_refs: [], runtime_config_ref: null, runtime_config_hash: null,
    idempotency_key: idempotencyKey, determinism_hash: "", limitations: ["CONTROLLED_SYNTHETIC", "NOT_FIELD_CALIBRATED", "NO_ACTIVE_MODEL_ACTIVATION"], created_at: input.created_at,
    payload: payload as unknown as Record<string, unknown>,
  };
  draft.determinism_hash = computeMemberDeterminismHashV1(draft as unknown as Record<string, unknown>);
  return draft;
}
