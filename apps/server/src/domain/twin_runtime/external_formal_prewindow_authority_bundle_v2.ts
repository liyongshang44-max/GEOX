// Purpose: deterministically construct the Amendment-18 replacement pre-window A0
// Runtime Config and exact 24-hour parent-linked Runtime Config chain for the selected
// T3R1 Formal epoch.
// Boundary: pure construction only. This module performs no filesystem, database,
// provider, R2, scheduler, wall-clock, persistence, recommendation, action, or Formal tick work.

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
  MCFT_CAP09_EXTERNAL_FORMAL_GEOMETRY_AUTHORITY_DESCRIPTOR_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_GEOMETRY_SEMANTIC_HASH_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_MODEL_HYDRAULIC_PRIOR_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_REALITY_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOURCE_MATRIX_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOURCE_MATRIX_SEMANTIC_HASH_V1,
  type ExternalFormalCropStageCodeV1,
} from "./external_formal_bootstrap_authority_bundle_v1.js";
import type { RealityBindingRuntimeSnapshotV1 } from "../../runtime/twin_runtime/ports.js";

export const MCFT_CAP09_A18A_ZERO_STATE_FORMAL_STORE_AUTHORITY_REF_V2 =
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A18A-ZERO-STATE-FORMAL-STORE-IDENTITY-AND-SCHEMA-PREFLIGHT-V1.json" as const;
export const MCFT_CAP09_A18A_ZERO_STATE_FORMAL_STORE_AUTHORITY_BLOB_V2 =
  "c63cb9b74fc14c08bccc2fedb8bed3b97a7c5ef4" as const;
export const MCFT_CAP09_A18_SELECTED_EPOCH_ID_V2 =
  "mcft_cap09_external_formal_window_epoch_20260817t200000z_v2" as const;
export const MCFT_CAP09_A18_PREWINDOW_A0_LOGICAL_TIME_V2 = "2026-08-17T19:00:00.000Z" as const;
export const MCFT_CAP09_A18_O00_LOGICAL_TIME_V2 = "2026-08-17T20:00:00.000Z" as const;
export const MCFT_CAP09_A18_O23_LOGICAL_TIME_V2 = "2026-08-18T19:00:00.000Z" as const;
export const MCFT_CAP09_A18_CONFIG_AUTHORITY_CREATED_AT_V2 = "2026-08-16T11:03:59.000Z" as const;

export type ExternalFormalA18HourlyCropPinV2 = {
  slot_id: string;
  logical_time: string;
  crop_stage_code: ExternalFormalCropStageCodeV1;
  crop_stage_context_hash: string;
};

export type ExternalFormalPrewindowAuthorityBundleInputV2 = {
  bootstrap_logical_time: string;
  created_at: string;
  bootstrap_crop_stage_code: ExternalFormalCropStageCodeV1;
  hourly_crop_pins: readonly ExternalFormalA18HourlyCropPinV2[];
};

export type ExternalFormalPrewindowAuthorityBundleV2 = {
  epoch_id: typeof MCFT_CAP09_A18_SELECTED_EPOCH_ID_V2;
  scope: typeof MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1;
  bootstrap_logical_time: string;
  bootstrap_crop_stage_code: ExternalFormalCropStageCodeV1;
  bootstrap_crop_stage_context_hash: string;
  reality_binding_snapshot: RealityBindingRuntimeSnapshotV1;
  bootstrap_runtime_config: CanonicalObjectEnvelopeV1;
  runtime_configs: readonly CanonicalObjectEnvelopeV1[];
};

function canonicalIsoV2(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function canonicalHourV2(value: string, code: string): string {
  const canonical = canonicalIsoV2(value, code);
  if (!canonical.endsWith(":00:00.000Z")) throw new Error(code);
  return canonical;
}

function addHoursV2(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function exactSlotIdV2(index: number): string {
  return `O${String(index).padStart(2, "0")}`;
}

export function deriveExternalFormalCropStageContextHashV2(input: {
  crop_stage_code: ExternalFormalCropStageCodeV1;
  derivation_authority_time: string;
}): string {
  const derivationTime = canonicalHourV2(
    input.derivation_authority_time,
    "EXTERNAL_FORMAL_A18_CROP_CONTEXT_DERIVATION_TIME_INVALID",
  );
  return semanticHashV1({
    authority_ref: MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_BLOBS_V1.crop_context.ref,
    authority_blob_sha: MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_BLOBS_V1.crop_context.hash,
    derived_context_authority: "FORMAL_DERIVED_CROP_WATER_USE_STAGE_CONTEXT_V2",
    crop_stage_code: input.crop_stage_code,
    derivation_authority_time: derivationTime,
    observed_biological_stage_claimed: false,
    field_calibration_status: "NOT_FIELD_CALIBRATED",
  });
}

function realityBindingSnapshotV2(): RealityBindingRuntimeSnapshotV1 {
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

function baseConfigInputV2(input: {
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
        ref: MCFT_CAP09_A18A_ZERO_STATE_FORMAL_STORE_AUTHORITY_REF_V2,
        hash: MCFT_CAP09_A18A_ZERO_STATE_FORMAL_STORE_AUTHORITY_BLOB_V2,
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

export function buildExternalFormalPrewindowAuthorityBundleV2(
  input: ExternalFormalPrewindowAuthorityBundleInputV2,
): ExternalFormalPrewindowAuthorityBundleV2 {
  const bootstrapTime = canonicalHourV2(input.bootstrap_logical_time, "EXTERNAL_FORMAL_A18_BOOTSTRAP_TIME_INVALID");
  const createdAt = canonicalIsoV2(input.created_at, "EXTERNAL_FORMAL_A18_CREATED_AT_INVALID");
  if (bootstrapTime !== MCFT_CAP09_A18_PREWINDOW_A0_LOGICAL_TIME_V2) throw new Error("EXTERNAL_FORMAL_A18_BOOTSTRAP_TIME_DRIFT");
  if (addHoursV2(bootstrapTime, 1) !== MCFT_CAP09_A18_O00_LOGICAL_TIME_V2) throw new Error("EXTERNAL_FORMAL_A18_O00_CONTINUITY_DRIFT");
  if (Date.parse(createdAt) > Date.parse(bootstrapTime)) throw new Error("EXTERNAL_FORMAL_A18_CONFIG_AUTHORITY_FROM_FUTURE_FORBIDDEN");
  if (input.hourly_crop_pins.length !== 24) throw new Error("EXTERNAL_FORMAL_A18_EXACT_24_CROP_PINS_REQUIRED");

  const bootstrapCropHash = deriveExternalFormalCropStageContextHashV2({
    crop_stage_code: input.bootstrap_crop_stage_code,
    derivation_authority_time: bootstrapTime,
  });
  const realityBinding = realityBindingSnapshotV2();
  const bootstrapRuntimeConfig = compileExternalFormalRuntimeConfigV1(baseConfigInputV2({
    role: "A0_BOOTSTRAP",
    logical_time: bootstrapTime,
    created_at: createdAt,
    parent: null,
    crop_stage_context_hash: bootstrapCropHash,
    reality_binding: realityBinding,
  }));

  const hourly: CanonicalObjectEnvelopeV1[] = [];
  let parent = bootstrapRuntimeConfig;
  for (let index = 0; index < 24; index += 1) {
    const pin = input.hourly_crop_pins[index]!;
    const slotId = exactSlotIdV2(index);
    const logicalTime = addHoursV2(bootstrapTime, index + 1);
    if (pin.slot_id !== slotId) throw new Error(`EXTERNAL_FORMAL_A18_SLOT_ID_DRIFT:${slotId}`);
    if (canonicalHourV2(pin.logical_time, `EXTERNAL_FORMAL_A18_SLOT_TIME_INVALID:${slotId}`) !== logicalTime) {
      throw new Error(`EXTERNAL_FORMAL_A18_SLOT_TIME_DRIFT:${slotId}`);
    }
    const recomputedCropHash = deriveExternalFormalCropStageContextHashV2({
      crop_stage_code: pin.crop_stage_code,
      derivation_authority_time: logicalTime,
    });
    if (recomputedCropHash !== pin.crop_stage_context_hash) throw new Error(`EXTERNAL_FORMAL_A18_CROP_HASH_DRIFT:${slotId}`);

    const config = compileExternalFormalRuntimeConfigV1(baseConfigInputV2({
      role: "HOURLY_CAP04",
      logical_time: logicalTime,
      created_at: createdAt,
      parent,
      crop_stage_context_hash: recomputedCropHash,
      reality_binding: realityBinding,
    }));
    hourly.push(config);
    parent = config;
  }

  if (hourly.at(-1)?.payload && (hourly.at(-1)!.payload as Record<string, unknown>).effective_logical_time !== MCFT_CAP09_A18_O23_LOGICAL_TIME_V2) {
    throw new Error("EXTERNAL_FORMAL_A18_O23_DRIFT");
  }

  return {
    epoch_id: MCFT_CAP09_A18_SELECTED_EPOCH_ID_V2,
    scope: MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    bootstrap_logical_time: bootstrapTime,
    bootstrap_crop_stage_code: input.bootstrap_crop_stage_code,
    bootstrap_crop_stage_context_hash: bootstrapCropHash,
    reality_binding_snapshot: realityBinding,
    bootstrap_runtime_config: bootstrapRuntimeConfig,
    runtime_configs: hourly,
  };
}
