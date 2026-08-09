// Purpose: materialize the deterministic External Formal Reality snapshot, A0 Runtime Config,
// and exact 24-hour parent-linked Runtime Config chain authorized by MCFT-CAP-09 Amendment-05.
// Boundary: pure construction only; no filesystem, database, provider network, scheduler,
// wall clock, persistence, recommendation, action, model activation, or O00 execution.

import { semanticHashV1 } from "./canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
  compileExternalFormalRuntimeConfigV1,
  type CompileExternalFormalRuntimeConfigInputV1,
} from "./external_formal_runtime_config_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_BINDING_PROFILE_ID_V1,
} from "./external_formal_evidence_binding_profile_v1.js";
import type { SoilHydraulicBoundsV1 } from "./physical_bounds_v1.js";
import type { RealityBindingRuntimeSnapshotV1 } from "../../runtime/twin_runtime/ports.js";

export const MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_REF_V1 =
  "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json" as const;
export const MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_BLOB_V1 =
  "c04c6805ab79c715781b99f8fbcf997fae3a8c48" as const;
export const MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_HASH_V1 =
  "sha256:381ef166454c7b698c6641fadc5d08019fecff127e9529a4c58a1f09d9e1fef5" as const;

export const MCFT_CAP09_EXTERNAL_FORMAL_REALITY_BINDING_ID_V1 =
  "GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V1" as const;
export const MCFT_CAP09_EXTERNAL_FORMAL_SOURCE_MATRIX_ID_V1 =
  "GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1" as const;
export const MCFT_CAP09_EXTERNAL_FORMAL_CROP_CONTEXT_ID_V1 =
  "GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1" as const;

export const MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_BLOBS_V1 = Object.freeze({
  site: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V1.json",
    hash: "eb9eb1880e01eb16430c177be6e2ef2dc36b3ca8",
  },
  reality: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V1.json",
    hash: "dedc8db6e2e3c902066ed94b0d3322a69775b7b6",
  },
  source_binding_matrix: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1.json",
    hash: "30b7910a1bd27882b80eb56041924d0f6252ae02",
  },
  crop_context: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json",
    hash: "b5de9d29189cb654444b3f57d00df290eefe16d3",
  },
  recovery: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-RECOVERY-AUTHORITY-V1.json",
    hash: "1174940a6908e545e70d87cb65be5b3a41db33cf",
  },
  fresh_database: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5A-FRESH-FORMAL-DATABASE-PREFLIGHT-V1.json",
    hash: "f3a57413d78633685cbc5be7d94f39d9fdc5c62b",
  },
});

export const MCFT_CAP09_EXTERNAL_FORMAL_MODEL_HYDRAULIC_PRIOR_V1: SoilHydraulicBoundsV1 = Object.freeze({
  root_zone_depth_mm: 300,
  wilting_point_fraction: 0.12,
  field_capacity_fraction: 0.3,
  saturation_fraction: 0.45,
});

export const MCFT_CAP09_EXTERNAL_FORMAL_GEOMETRY_AUTHORITY_DESCRIPTOR_V1 = Object.freeze({
  qualified_formal_site_id: "KBS_MCSE_T1R1",
  plot_geometry_source: "KBS039-006_MCSE_PLOT_POLYGONS",
  plot_centroid_source: "KBS136-006_PLOT_CENTER_LOCATIONS_AND_SIZE",
  geometry_truth_class: "PUBLIC_RESEARCH_PLOT_GEOMETRY",
  raw_geometry_embedded_in_repository: false,
  direct_field_equivalence_by_near_site_sources: false,
});

export const MCFT_CAP09_EXTERNAL_FORMAL_GEOMETRY_SEMANTIC_HASH_V1 = semanticHashV1(
  MCFT_CAP09_EXTERNAL_FORMAL_GEOMETRY_AUTHORITY_DESCRIPTOR_V1,
);

export const MCFT_CAP09_EXTERNAL_FORMAL_SOURCE_MATRIX_SEMANTIC_HASH_V1 = semanticHashV1({
  authority_ref: MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_BLOBS_V1.source_binding_matrix.ref,
  authority_blob_sha: MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_BLOBS_V1.source_binding_matrix.hash,
  evidence_binding_profile_id: MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_BINDING_PROFILE_ID_V1,
});

export type ExternalFormalCropStageCodeV1 = "INITIAL" | "DEVELOPMENT" | "MID" | "LATE";

export type ExternalFormalBootstrapAuthorityBundleInputV1 = {
  bootstrap_logical_time: string;
  created_at: string;
  crop_stage_code: ExternalFormalCropStageCodeV1;
  crop_stage_derivation_authority_time: string;
};

export type ExternalFormalBootstrapAuthorityBundleV1 = {
  scope: typeof MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1;
  bootstrap_logical_time: string;
  window_start_utc: string;
  crop_stage_code: ExternalFormalCropStageCodeV1;
  crop_stage_context_hash: string;
  geometry_semantic_hash: string;
  reality_binding_snapshot: RealityBindingRuntimeSnapshotV1;
  bootstrap_runtime_config: CanonicalObjectEnvelopeV1;
  runtime_configs: readonly CanonicalObjectEnvelopeV1[];
  hydraulic: SoilHydraulicBoundsV1;
  model_prior_ref: typeof MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_REF_V1;
  model_prior_hash: typeof MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_HASH_V1;
};

function canonicalIsoV1(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function canonicalHourV1(value: string, code: string): string {
  const canonical = canonicalIsoV1(value, code);
  if (!canonical.endsWith(":00:00.000Z")) throw new Error(code);
  return canonical;
}

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function cropStageContextHashV1(input: ExternalFormalBootstrapAuthorityBundleInputV1): string {
  return semanticHashV1({
    authority_ref: MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_BLOBS_V1.crop_context.ref,
    authority_blob_sha: MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_BLOBS_V1.crop_context.hash,
    derived_context_authority: "FORMAL_DERIVED_CROP_WATER_USE_STAGE_CONTEXT_V1",
    crop_stage_code: input.crop_stage_code,
    derivation_authority_time: input.crop_stage_derivation_authority_time,
    observed_biological_stage_claimed: false,
    field_calibration_status: "NOT_FIELD_CALIBRATED",
  });
}

function realityBindingSnapshotV1(): RealityBindingRuntimeSnapshotV1 {
  const rootZoneDefinition = {
    root_zone_depth_mm: 300,
    vertical_support: "MODEL_ROOT_ZONE_0_300MM",
    authority_class: "MODEL_PRIOR_FROM_CAP08",
    field_calibration_status: "NOT_FIELD_CALIBRATED",
    source_ref: MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_REF_V1,
    source_hash: MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_HASH_V1,
    direct_site_soil_truth_claimed: false,
  };
  const determinismHash = semanticHashV1({
    authority_id: MCFT_CAP09_EXTERNAL_FORMAL_REALITY_BINDING_ID_V1,
    authority_blob_sha: MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_BLOBS_V1.reality.hash,
    reality_class: "EXTERNAL_PUBLIC_RESEARCH_SCOPE",
    scope: MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    geometry_semantic_hash: MCFT_CAP09_EXTERNAL_FORMAL_GEOMETRY_SEMANTIC_HASH_V1,
    root_zone_definition: rootZoneDefinition,
    cross_scope_canonical_stitching_authorized: false,
  });
  return {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_REALITY_BINDING_ID_V1,
    determinism_hash: determinismHash,
    geometry_semantic_hash: MCFT_CAP09_EXTERNAL_FORMAL_GEOMETRY_SEMANTIC_HASH_V1,
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    root_zone_definition: rootZoneDefinition,
  };
}

function baseConfigInputV1(input: {
  role: "A0_BOOTSTRAP" | "HOURLY_CAP04";
  logical_time: string;
  created_at: string;
  parent: CanonicalObjectEnvelopeV1 | null;
  crop_stage_context_hash: string;
  reality_binding: RealityBindingRuntimeSnapshotV1;
}): CompileExternalFormalRuntimeConfigInputV1 {
  return {
    scope: MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    config_role: input.role,
    effective_logical_time: input.logical_time,
    created_at: input.created_at,
    parent_runtime_config_ref: input.parent?.object_id ?? null,
    parent_runtime_config_hash: input.parent?.determinism_hash ?? null,
    reality_binding_ref: input.reality_binding.binding_id,
    reality_binding_hash: input.reality_binding.determinism_hash,
    source_matrix_ref: MCFT_CAP09_EXTERNAL_FORMAL_SOURCE_MATRIX_ID_V1,
    source_matrix_hash: MCFT_CAP09_EXTERNAL_FORMAL_SOURCE_MATRIX_SEMANTIC_HASH_V1,
    configuration_matrix_ref: MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_REF_V1,
    configuration_matrix_hash: MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_HASH_V1,
    geometry_semantic_hash: MCFT_CAP09_EXTERNAL_FORMAL_GEOMETRY_SEMANTIC_HASH_V1,
    formal_authorities: structuredClone(MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_BLOBS_V1),
    crop_stage_context_authority: {
      context_ref: MCFT_CAP09_EXTERNAL_FORMAL_CROP_CONTEXT_ID_V1,
      context_hash: input.crop_stage_context_hash,
      configuration_matrix_ref: MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_REF_V1,
      configuration_matrix_hash: MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_HASH_V1,
    },
    model_prior: {
      source_ref: MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_REF_V1,
      source_hash: MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_HASH_V1,
    },
  };
}

export function buildExternalFormalBootstrapAuthorityBundleV1(
  input: ExternalFormalBootstrapAuthorityBundleInputV1,
): ExternalFormalBootstrapAuthorityBundleV1 {
  const bootstrapTime = canonicalHourV1(input.bootstrap_logical_time, "EXTERNAL_FORMAL_BOOTSTRAP_TIME_INVALID");
  const createdAt = canonicalIsoV1(input.created_at, "EXTERNAL_FORMAL_BOOTSTRAP_CREATED_AT_INVALID");
  const derivationTime = canonicalIsoV1(
    input.crop_stage_derivation_authority_time,
    "EXTERNAL_FORMAL_CROP_STAGE_DERIVATION_TIME_INVALID",
  );
  if (!(["INITIAL", "DEVELOPMENT", "MID", "LATE"] as const).includes(input.crop_stage_code)) {
    throw new Error("EXTERNAL_FORMAL_CROP_STAGE_CODE_INVALID");
  }
  if (Date.parse(derivationTime) > Date.parse(createdAt)) {
    throw new Error("EXTERNAL_FORMAL_CROP_STAGE_AUTHORITY_FROM_FUTURE_FORBIDDEN");
  }
  if (Date.parse(derivationTime) > Date.parse(bootstrapTime)) {
    throw new Error("EXTERNAL_FORMAL_CROP_STAGE_AUTHORITY_AFTER_BOOTSTRAP_FORBIDDEN");
  }

  const cropHash = cropStageContextHashV1({ ...input, crop_stage_derivation_authority_time: derivationTime });
  const realityBinding = realityBindingSnapshotV1();
  const bootstrapRuntimeConfig = compileExternalFormalRuntimeConfigV1(baseConfigInputV1({
    role: "A0_BOOTSTRAP",
    logical_time: bootstrapTime,
    created_at: createdAt,
    parent: null,
    crop_stage_context_hash: cropHash,
    reality_binding: realityBinding,
  }));

  const hourly: CanonicalObjectEnvelopeV1[] = [];
  let parent = bootstrapRuntimeConfig;
  for (let index = 0; index < 24; index += 1) {
    const logicalTime = addHoursV1(bootstrapTime, index + 1);
    const config = compileExternalFormalRuntimeConfigV1(baseConfigInputV1({
      role: "HOURLY_CAP04",
      logical_time: logicalTime,
      created_at: createdAt,
      parent,
      crop_stage_context_hash: cropHash,
      reality_binding: realityBinding,
    }));
    hourly.push(config);
    parent = config;
  }

  return {
    scope: MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    bootstrap_logical_time: bootstrapTime,
    window_start_utc: addHoursV1(bootstrapTime, 1),
    crop_stage_code: input.crop_stage_code,
    crop_stage_context_hash: cropHash,
    geometry_semantic_hash: MCFT_CAP09_EXTERNAL_FORMAL_GEOMETRY_SEMANTIC_HASH_V1,
    reality_binding_snapshot: realityBinding,
    bootstrap_runtime_config: bootstrapRuntimeConfig,
    runtime_configs: hourly,
    hydraulic: MCFT_CAP09_EXTERNAL_FORMAL_MODEL_HYDRAULIC_PRIOR_V1,
    model_prior_ref: MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_REF_V1,
    model_prior_hash: MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_HASH_V1,
  };
}
