// apps/server/src/runtime/twin_runtime/runtime_config_authority_adapter_v1.ts
// Purpose: adapt the final MCFT-00 Reality, Source Binding, and Configuration Binding artifacts into the pure Runtime Config compiler input.
// Boundary: pure parsed-object adapter; callers own filesystem I/O, and this module performs no database, network, wall-clock, environment, or random access.

import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import { compileRuntimeConfigV1 } from "./runtime_config_compile_service_v1.js";

export type Mcft00RealityArtifactV1 = {
  binding_id: string;
  determinism_hash: string;
  semantic_payload: {
    scope: { tenant_id: string; project_id: string; group_id: string; field_id: string; season_id: string; zone_id: string };
    geometry_binding: { geometry_semantic_hash: string };
    root_zone_binding: Record<string, unknown>;
  };
};

export type Mcft00SourceMatrixArtifactV1 = {
  determinism_hash: string;
  bindings: Array<{ binding_id: string; availability_semantics?: { release_policy_id?: string } }>;
};

export type Mcft00ConfigurationMatrixArtifactV1 = {
  determinism_hash: string;
  bindings: Array<{ binding_id: string; source_role: string; configuration_source_id: string }>;
};

export function compileRuntimeConfigFromAuthorityArtifactsV1(input: {
  realityArtifact: Mcft00RealityArtifactV1;
  sourceMatrixArtifact: Mcft00SourceMatrixArtifactV1;
  configurationMatrixArtifact: Mcft00ConfigurationMatrixArtifactV1;
  logical_time: string;
  created_at: string;
}): CanonicalObjectEnvelopeV1 {
  const semantic = input.realityArtifact.semantic_payload;
  return compileRuntimeConfigV1({
    created_at: input.created_at,
    logical_time: input.logical_time,
    scope: semantic.scope,
    reality: {
      binding_id: input.realityArtifact.binding_id,
      determinism_hash: input.realityArtifact.determinism_hash,
      geometry_semantic_hash: semantic.geometry_binding.geometry_semantic_hash,
      root_zone_definition: semantic.root_zone_binding,
    },
    source_matrix: {
      determinism_hash: input.sourceMatrixArtifact.determinism_hash,
      bindings: input.sourceMatrixArtifact.bindings,
    },
    configuration_matrix: {
      determinism_hash: input.configurationMatrixArtifact.determinism_hash,
      bindings: input.configurationMatrixArtifact.bindings,
    },
  });
}
