// Purpose: Formal-v5 fresh-store successor for External Formal pre-window A0 + exact 24-hour Runtime Config chain.
// Boundary: pure construction only. No provider, database, scheduler, clock, persistence, or Formal effect.
// Formal-v5 actual arm/A0 must pin the fresh V3 store authority while preserving the same runtime-config semantics.

import { semanticHashV1 } from "./canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
  compileExternalFormalRuntimeConfigV1,
  type CompileExternalFormalRuntimeConfigInputV1,
} from "./external_formal_runtime_config_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_BLOBS_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_HASH_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_REF_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_CROP_CONTEXT_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_GEOMETRY_SEMANTIC_HASH_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_MODEL_HYDRAULIC_PRIOR_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_REALITY_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOURCE_MATRIX_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOURCE_MATRIX_SEMANTIC_HASH_V1,
  type ExternalFormalBootstrapAuthorityBundleV1,
  type ExternalFormalCropStageCodeV1,
} from "./external_formal_bootstrap_authority_bundle_v1.js";
import type { RealityBindingRuntimeSnapshotV1 } from "../../runtime/twin_runtime/ports.js";

export const MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V5 =
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-ACTUAL-FORMAL-STORE-AUTHORITY-V3.json" as const;
export const MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V5 =
  "34fd3e92e0e628cf0db16e10df3633337fe81a1a" as const;

export type ExternalFormalPrewindowAuthorityBundleInputV5 = {
  epoch_id: string;
  bootstrap_logical_time: string;
  created_at: string;
  bootstrap_crop_stage_code: ExternalFormalCropStageCodeV1;
  hourly_crop_stage_codes: readonly ExternalFormalCropStageCodeV1[];
  current_crop_authority_evidence_digest: string;
  stage_authority_as_of: string;
  forward_stability_hours: number;
  fresh_database_authority_ref: typeof MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V5;
  fresh_database_authority_blob_sha: typeof MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V5;
};

export type ExternalFormalHourlyCropPinV5 = {
  slot_id: string;
  logical_time: string;
  crop_stage_code: ExternalFormalCropStageCodeV1;
  crop_stage_context_hash: string;
};

export type ExternalFormalPrewindowAuthorityBundleV5 = {
  epoch_id: string;
  o00_logical_time: string;
  o23_logical_time: string;
  hourly_crop_pins: readonly ExternalFormalHourlyCropPinV5[];
  persistence_bundle: ExternalFormalBootstrapAuthorityBundleV1;
};

function requiredTextV5(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function canonicalIsoV5(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function canonicalHourV5(value: string, code: string): string {
  const canonical = canonicalIsoV5(value, code);
  if (!canonical.endsWith(":00:00.000Z")) throw new Error(code);
  return canonical;
}

function addHoursV5(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function exactSlotIdV5(index: number): string {
  return `O${String(index).padStart(2, "0")}`;
}

function validStageV5(value: string): value is ExternalFormalCropStageCodeV1 {
  return (["INITIAL", "DEVELOPMENT", "MID", "LATE"] as const).includes(value as ExternalFormalCropStageCodeV1);
}

export function deriveExternalFormalCropStageContextHashV5(input: {
  crop_stage_code: ExternalFormalCropStageCodeV1;
  derivation_authority_time: string;
  current_crop_authority_evidence_digest: string;
}): string {
  const logicalTime = canonicalHourV5(
    input.derivation_authority_time,
    "EXTERNAL_FORMAL_V5_CROP_CONTEXT_TIME_INVALID",
  );
  if (!validStageV5(input.crop_stage_code)) {
    throw new Error("EXTERNAL_FORMAL_V5_CROP_STAGE_INVALID");
  }
  const digest = requiredTextV5(
    input.current_crop_authority_evidence_digest,
    "EXTERNAL_FORMAL_V5_CURRENT_CROP_AUTHORITY_DIGEST_REQUIRED",
  );
  if (!/^sha256:[0-9a-f]{64}$/.test(digest)) {
    throw new Error("EXTERNAL_FORMAL_V5_CURRENT_CROP_AUTHORITY_DIGEST_INVALID");
  }
  return semanticHashV1({
    derived_context_authority:
      "FORMAL_BIOLOGICAL_STAGE_AUTHORITY_DERIVED_CROP_WATER_USE_CONTEXT_V4",
    crop_stage_code: input.crop_stage_code,
    derivation_authority_time: logicalTime,
    current_crop_authority_evidence_digest: digest,
    observed_biological_stage_claimed: false,
    water_use_stage_forward_stable_under_thermal_progression: true,
    lifecycle_requires_separate_validation: true,
    field_calibration_status: "NOT_FIELD_CALIBRATED",
  });
}

function realityBindingSnapshotV5(): RealityBindingRuntimeSnapshotV1 {
  const rootZoneDefinition = {
    root_zone_depth_mm: MCFT_CAP09_EXTERNAL_FORMAL_MODEL_HYDRAULIC_PRIOR_V1.root_zone_depth_mm,
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

function baseConfigInputV5(input: {
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
    formal_authorities: {
      ...structuredClone(MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_BLOBS_V1),
      fresh_database: {
        ref: MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V5,
        hash: MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V5,
      },
    },
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

export function buildExternalFormalPrewindowAuthorityBundleV5(
  input: ExternalFormalPrewindowAuthorityBundleInputV5,
): ExternalFormalPrewindowAuthorityBundleV5 {
  const epochId = requiredTextV5(input.epoch_id, "EXTERNAL_FORMAL_V5_EPOCH_ID_REQUIRED");
  if (epochId === "mcft_cap09_external_formal_window_epoch_20260817t200000z_v2") {
    throw new Error("EXTERNAL_FORMAL_V5_FAILED_EPOCH_REUSE_FORBIDDEN");
  }
  const bootstrapTime = canonicalHourV5(
    input.bootstrap_logical_time,
    "EXTERNAL_FORMAL_V5_BOOTSTRAP_TIME_INVALID",
  );
  const createdAt = canonicalIsoV5(
    input.created_at,
    "EXTERNAL_FORMAL_V5_CREATED_AT_INVALID",
  );
  if (Date.parse(createdAt) > Date.parse(bootstrapTime)) {
    throw new Error("EXTERNAL_FORMAL_V5_CONFIG_AUTHORITY_FROM_FUTURE_FORBIDDEN");
  }
  const stageAuthorityAsOf = canonicalHourV5(
    input.stage_authority_as_of,
    "EXTERNAL_FORMAL_V5_STAGE_AUTHORITY_AS_OF_INVALID",
  );
  if (
    !Number.isInteger(input.forward_stability_hours)
    || input.forward_stability_hours <= 0
    || input.forward_stability_hours > 48
  ) {
    throw new Error("EXTERNAL_FORMAL_V5_FORWARD_STABILITY_HOURS_INVALID");
  }
  const o23Candidate = addHoursV5(bootstrapTime, 24);
  if (Date.parse(bootstrapTime) < Date.parse(stageAuthorityAsOf)) {
    throw new Error("EXTERNAL_FORMAL_V5_FUTURE_STAGE_EVIDENCE_FORBIDDEN");
  }
  if (
    Date.parse(o23Candidate)
      > Date.parse(stageAuthorityAsOf)
        + input.forward_stability_hours * 3_600_000
  ) {
    throw new Error("EXTERNAL_FORMAL_V5_STAGE_AUTHORITY_FORWARD_WINDOW_EXCEEDED");
  }
  if (!validStageV5(input.bootstrap_crop_stage_code)) throw new Error("EXTERNAL_FORMAL_V5_BOOTSTRAP_CROP_STAGE_INVALID");
  if (input.hourly_crop_stage_codes.length !== 24) throw new Error("EXTERNAL_FORMAL_V5_EXACT_24_CROP_STAGES_REQUIRED");
  if (input.fresh_database_authority_ref !== MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V5
    || input.fresh_database_authority_blob_sha !== MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V5) {
    throw new Error("EXTERNAL_FORMAL_V5_FRESH_STORE_AUTHORITY_PIN_MISMATCH");
  }

  const realityBinding = realityBindingSnapshotV5();
  const bootstrapCropHash = deriveExternalFormalCropStageContextHashV5({
    crop_stage_code: input.bootstrap_crop_stage_code,
    derivation_authority_time: bootstrapTime,
    current_crop_authority_evidence_digest:
      input.current_crop_authority_evidence_digest,
  });
  const bootstrapRuntimeConfig = compileExternalFormalRuntimeConfigV1(baseConfigInputV5({
    role: "A0_BOOTSTRAP",
    logical_time: bootstrapTime,
    created_at: createdAt,
    parent: null,
    crop_stage_context_hash: bootstrapCropHash,
    reality_binding: realityBinding,
  }));

  const hourlyCropPins: ExternalFormalHourlyCropPinV5[] = [];
  const runtimeConfigs: CanonicalObjectEnvelopeV1[] = [];
  let parent = bootstrapRuntimeConfig;
  for (let index = 0; index < 24; index += 1) {
    const stage = input.hourly_crop_stage_codes[index]!;
    if (!validStageV5(stage)) throw new Error(`EXTERNAL_FORMAL_V5_CROP_STAGE_INVALID:${index}`);
    const logicalTime = addHoursV5(bootstrapTime, index + 1);
    const cropHash = deriveExternalFormalCropStageContextHashV5({
      crop_stage_code: stage,
      derivation_authority_time: logicalTime,
      current_crop_authority_evidence_digest:
        input.current_crop_authority_evidence_digest,
    });
    hourlyCropPins.push({ slot_id: exactSlotIdV5(index), logical_time: logicalTime, crop_stage_code: stage, crop_stage_context_hash: cropHash });
    const config = compileExternalFormalRuntimeConfigV1(baseConfigInputV5({
      role: "HOURLY_CAP04",
      logical_time: logicalTime,
      created_at: createdAt,
      parent,
      crop_stage_context_hash: cropHash,
      reality_binding: realityBinding,
    }));
    runtimeConfigs.push(config);
    parent = config;
  }

  const o00 = addHoursV5(bootstrapTime, 1);
  const o23 = addHoursV5(bootstrapTime, 24);
  return {
    epoch_id: epochId,
    o00_logical_time: o00,
    o23_logical_time: o23,
    hourly_crop_pins: hourlyCropPins,
    persistence_bundle: {
      scope: MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
      bootstrap_logical_time: bootstrapTime,
      window_start_utc: o00,
      crop_stage_code: input.bootstrap_crop_stage_code,
      crop_stage_context_hash: bootstrapCropHash,
      geometry_semantic_hash: MCFT_CAP09_EXTERNAL_FORMAL_GEOMETRY_SEMANTIC_HASH_V1,
      reality_binding_snapshot: realityBinding,
      bootstrap_runtime_config: bootstrapRuntimeConfig,
      runtime_configs: runtimeConfigs,
      hydraulic: MCFT_CAP09_EXTERNAL_FORMAL_MODEL_HYDRAULIC_PRIOR_V1,
      model_prior_ref: MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_REF_V1,
      model_prior_hash: MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_HASH_V1,
    },
  };
}
