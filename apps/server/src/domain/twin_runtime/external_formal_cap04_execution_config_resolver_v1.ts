// apps/server/src/domain/twin_runtime/external_formal_cap04_execution_config_resolver_v1.ts
// Purpose: derive a non-canonical CAP04 compatibility execution payload from one honest External Formal canonical Runtime Config while preserving the External config ref/hash as the sole canonical Runtime Config authority.
// Boundary: pure in-memory resolution only; no persistence, canonical compatibility object, provider fetch, scheduler, filesystem, environment, wall clock, model activation, recommendation, action, or O00 execution.

import {
  validateCanonicalObjectV1,
  type CanonicalObjectEnvelopeV1,
} from "./canonical_object_contracts_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_CONFIG_PURPOSE_V1,
  validateExternalFormalRuntimeConfigPayloadV1,
  type ExternalFormalRuntimeConfigPayloadV1,
} from "./external_formal_runtime_config_v1.js";
import {
  compileCap04RuntimeConfigV1,
  validateCap04RuntimeConfigPayloadV1,
  type Cap04RuntimeConfigPayloadV1,
} from "./forecast_scenario_runtime_config_v1.js";
import {
  EXTERNAL_FORMAL_CAP04_COMPATIBILITY_RESOLUTION_POLICY_ID_V1,
  type Cap04ExecutionConfigResolverPortV1,
  type ResolvedCap04ExecutionConfigV1,
} from "./runtime_config_execution_view_v1.js";

export class ExternalFormalCap04ExecutionConfigResolverV1
implements Cap04ExecutionConfigResolverPortV1 {
  resolveExecutionConfig(
    canonicalConfig: CanonicalObjectEnvelopeV1,
  ): ResolvedCap04ExecutionConfigV1 {
    validateCanonicalObjectV1(canonicalConfig);
    if (canonicalConfig.object_type !== "twin_runtime_config_v1") {
      throw new Error("EXTERNAL_FORMAL_CAP04_SOURCE_CONFIG_OBJECT_TYPE_REQUIRED");
    }
    validateExternalFormalRuntimeConfigPayloadV1(canonicalConfig.payload);
    const external = canonicalConfig.payload as unknown as ExternalFormalRuntimeConfigPayloadV1;
    if (external.config_purpose !== MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_CONFIG_PURPOSE_V1) {
      throw new Error("EXTERNAL_FORMAL_CAP04_SOURCE_PURPOSE_MISMATCH");
    }
    if (external.config_role !== "HOURLY_CAP04") {
      throw new Error("EXTERNAL_FORMAL_CAP04_HOURLY_CONFIG_REQUIRED");
    }
    if (canonicalConfig.logical_time !== external.effective_logical_time
      || canonicalConfig.as_of !== external.effective_logical_time) {
      throw new Error("EXTERNAL_FORMAL_CAP04_SOURCE_TIME_MISMATCH");
    }
    if (!external.parent_runtime_config_ref || !external.parent_runtime_config_hash) {
      throw new Error("EXTERNAL_FORMAL_CAP04_PARENT_CONFIG_REQUIRED");
    }

    const compatibility = compileCap04RuntimeConfigV1({
      scope: {
        tenant_id: canonicalConfig.tenant_id,
        project_id: canonicalConfig.project_id,
        group_id: canonicalConfig.group_id,
        field_id: canonicalConfig.field_id,
        season_id: canonicalConfig.season_id,
        zone_id: canonicalConfig.zone_id,
      },
      effective_logical_time: external.effective_logical_time,
      created_at: canonicalConfig.created_at,
      parent_runtime_config_ref: external.parent_runtime_config_ref,
      parent_runtime_config_hash: external.parent_runtime_config_hash,
      reality_binding_ref: external.reality_binding_ref,
      reality_binding_hash: external.reality_binding_hash,
      source_matrix_hash: external.source_matrix_hash,
      configuration_matrix_hash: external.configuration_matrix_hash,
      geometry_semantic_hash: external.geometry_semantic_hash,
    });
    validateCap04RuntimeConfigPayloadV1(compatibility.payload);
    const payload = structuredClone(
      compatibility.payload,
    ) as unknown as Cap04RuntimeConfigPayloadV1;

    if (payload.reality_binding_ref !== external.reality_binding_ref
      || payload.reality_binding_hash !== external.reality_binding_hash
      || payload.source_matrix_hash !== external.source_matrix_hash
      || payload.configuration_matrix_hash !== external.configuration_matrix_hash
      || payload.geometry_semantic_hash !== external.geometry_semantic_hash
      || payload.parent_runtime_config_ref !== external.parent_runtime_config_ref
      || payload.parent_runtime_config_hash !== external.parent_runtime_config_hash
      || payload.effective_logical_time !== external.effective_logical_time) {
      throw new Error("EXTERNAL_FORMAL_CAP04_COMPATIBILITY_AUTHORITY_MISMATCH");
    }

    return {
      source_config_ref: canonicalConfig.object_id,
      source_config_hash: canonicalConfig.determinism_hash,
      source_config_purpose: MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_CONFIG_PURPOSE_V1,
      payload,
      resolution_policy_id:
        EXTERNAL_FORMAL_CAP04_COMPATIBILITY_RESOLUTION_POLICY_ID_V1,
    };
  }
}
