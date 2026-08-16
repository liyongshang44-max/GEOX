// Purpose: deterministically materialize the Amendment-18 T3R1 Formal crop context
// from the frozen crop authority identity and MCFT-00 configuration matrix.
// Boundary: pure validation/materialization only; no filesystem, database, provider,
// R2, scheduler, wall clock, persistence, or Formal execution.

import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "./continuation_evidence_window_service_v1.js";

export const MCFT_CAP09_A18_CROP_AUTHORITY_PATH_V2 =
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json" as const;
export const MCFT_CAP09_A18_CROP_AUTHORITY_BLOB_V2 =
  "757e4b9f4fdcd631eea97fca85614a1b61ef0c4a" as const;
export const MCFT_CAP09_A18_CONFIGURATION_MATRIX_REF_V2 =
  "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json" as const;
export const MCFT_CAP09_A18_CONFIGURATION_MATRIX_HASH_V2 =
  "sha256:381ef166454c7b698c6641fadc5d08019fecff127e9529a4c58a1f09d9e1fef5" as const;
export const MCFT_CAP09_A18_CROP_CONFIGURATION_SOURCE_ID_V2 = "mcft_crop_water_use_corn_v1" as const;
export const MCFT_CAP09_A18_CROP_CONFIGURATION_SEMANTIC_HASH_V2 =
  "sha256:56ac92e34148bd81fe20f2925e1079cb1a3ed647ffefd1471caf1302df70ee4c" as const;
export const MCFT_CAP09_A18_DERIVED_CONTEXT_AUTHORITY_V2 =
  "FORMAL_DERIVED_CROP_WATER_USE_STAGE_CONTEXT_V2" as const;
export const MCFT_CAP09_A18_CROP_CONTEXT_REF_V2 =
  "GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2" as const;
export const MCFT_CAP09_A18_CROP_CONTEXT_IDENTITY_PROFILE_V2 =
  "T3R1_A18_SLOT_CROP_CONTEXT_AUTHORITY_IDENTITY_V2" as const;
export const MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V2 =
  "T3R1_A18_FULL_CROP_CONTEXT_MATERIALIZATION_V2" as const;

const HOUR_MS = 3_600_000;

type JsonRecordV2 = Record<string, unknown>;
type CropStageCodeV2 = "INITIAL" | "DEVELOPMENT" | "MID" | "LATE";

export type MaterializeExternalFormalA18CropContextInputV2 = {
  logical_time: string;
  expected_identity_hash: string;
  crop_authority: JsonRecordV2;
  configuration_matrix: JsonRecordV2;
};

export type MaterializedExternalFormalA18CropContextV2 = {
  identity_profile: typeof MCFT_CAP09_A18_CROP_CONTEXT_IDENTITY_PROFILE_V2;
  materialization_profile: typeof MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V2;
  logical_time: string;
  stage_code: "MID";
  context_ref: typeof MCFT_CAP09_A18_CROP_CONTEXT_REF_V2;
  context_identity_hash: string;
  context_materialization_hash: string;
  minimum_hours_to_next_stage_after_forward_guard: number;
  context: ContinuationCropStageConfigurationContextV1;
};

function recordV2(value: unknown, code: string): JsonRecordV2 {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as JsonRecordV2;
}

function textV2(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function numberV2(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
}

function canonicalHourV2(value: unknown, code: string): string {
  const text = textV2(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text || !text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function stageAtHoursV2(hoursSincePlanting: number, variant: readonly number[]): CropStageCodeV2 | "PRE_PLANTING" | "POST_MODEL_SEASON" {
  if (variant.length !== 4 || variant.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("EXTERNAL_FORMAL_A18_CROP_CONTEXT_VARIANT_INVALID");
  }
  const [a, b, c, d] = variant;
  if (hoursSincePlanting < 0) return "PRE_PLANTING";
  if (hoursSincePlanting < a * 24) return "INITIAL";
  if (hoursSincePlanting < (a + b) * 24) return "DEVELOPMENT";
  if (hoursSincePlanting < (a + b + c) * 24) return "MID";
  if (hoursSincePlanting < (a + b + c + d) * 24) return "LATE";
  return "POST_MODEL_SEASON";
}

function exactCropSourceV2(matrix: JsonRecordV2): {
  kc: number;
  crop_root_depth_mm: number;
  effective_model_root_depth_mm: number;
  crop_stage_mapping_source: string;
} {
  if (matrix.schema_version !== "geox_mcft00_configuration_binding_matrix_v2") {
    throw new Error("EXTERNAL_FORMAL_A18_CONFIGURATION_MATRIX_SCHEMA_REQUIRED");
  }
  if (matrix.determinism_hash !== MCFT_CAP09_A18_CONFIGURATION_MATRIX_HASH_V2) {
    throw new Error("EXTERNAL_FORMAL_A18_CONFIGURATION_MATRIX_HASH_MISMATCH");
  }
  const definitions = matrix.configuration_source_definitions;
  if (!Array.isArray(definitions)) throw new Error("EXTERNAL_FORMAL_A18_CONFIGURATION_SOURCES_REQUIRED");
  const matches = definitions
    .map((value) => recordV2(value, "EXTERNAL_FORMAL_A18_CONFIGURATION_SOURCE_INVALID"))
    .filter((value) => value.configuration_source_id === MCFT_CAP09_A18_CROP_CONFIGURATION_SOURCE_ID_V2);
  if (matches.length !== 1) throw new Error("EXTERNAL_FORMAL_A18_EXACT_CROP_CONFIGURATION_SOURCE_REQUIRED");
  const source = matches[0];
  if (source.configuration_semantic_hash !== MCFT_CAP09_A18_CROP_CONFIGURATION_SEMANTIC_HASH_V2) {
    throw new Error("EXTERNAL_FORMAL_A18_CROP_CONFIGURATION_HASH_MISMATCH");
  }
  const parameters = recordV2(source.parameters, "EXTERNAL_FORMAL_A18_CROP_PARAMETERS_REQUIRED");
  const kcSchedule = recordV2(parameters.kc_schedule, "EXTERNAL_FORMAL_A18_KC_SCHEDULE_REQUIRED").value;
  const rootDepthMapping = recordV2(parameters.root_depth_mapping, "EXTERNAL_FORMAL_A18_ROOT_DEPTH_MAPPING_REQUIRED").value;
  const stageMapping = recordV2(parameters.crop_stage_mapping_source, "EXTERNAL_FORMAL_A18_STAGE_MAPPING_REQUIRED").value;
  if (!Array.isArray(kcSchedule) || !Array.isArray(rootDepthMapping)) throw new Error("EXTERNAL_FORMAL_A18_PARAMETER_ARRAY_REQUIRED");
  const kcMatches = kcSchedule
    .map((value) => recordV2(value, "EXTERNAL_FORMAL_A18_KC_ENTRY_INVALID"))
    .filter((value) => value.stage_code === "MID");
  const depthMatches = rootDepthMapping
    .map((value) => recordV2(value, "EXTERNAL_FORMAL_A18_DEPTH_ENTRY_INVALID"))
    .filter((value) => value.stage_code === "MID");
  if (kcMatches.length !== 1 || depthMatches.length !== 1) throw new Error("EXTERNAL_FORMAL_A18_EXACT_MID_PARAMETERS_REQUIRED");
  return {
    kc: numberV2(kcMatches[0].kc, "EXTERNAL_FORMAL_A18_MID_KC_REQUIRED"),
    crop_root_depth_mm: numberV2(depthMatches[0].crop_root_depth_mm, "EXTERNAL_FORMAL_A18_MID_CROP_ROOT_DEPTH_REQUIRED"),
    effective_model_root_depth_mm: numberV2(depthMatches[0].effective_model_root_depth_mm, "EXTERNAL_FORMAL_A18_MID_EFFECTIVE_ROOT_DEPTH_REQUIRED"),
    crop_stage_mapping_source: textV2(stageMapping, "EXTERNAL_FORMAL_A18_STAGE_MAPPING_VALUE_REQUIRED"),
  };
}

export function deriveExternalFormalA18CropContextIdentityHashV2(input: {
  logical_time: string;
  crop_stage_code: "MID";
}): string {
  const logicalTime = canonicalHourV2(input.logical_time, "EXTERNAL_FORMAL_A18_CROP_CONTEXT_LOGICAL_TIME_INVALID");
  return semanticHashV1({
    authority_ref: MCFT_CAP09_A18_CROP_AUTHORITY_PATH_V2,
    authority_blob_sha: MCFT_CAP09_A18_CROP_AUTHORITY_BLOB_V2,
    derived_context_authority: MCFT_CAP09_A18_DERIVED_CONTEXT_AUTHORITY_V2,
    crop_stage_code: input.crop_stage_code,
    derivation_authority_time: logicalTime,
    observed_biological_stage_claimed: false,
    field_calibration_status: "NOT_FIELD_CALIBRATED",
  });
}

export function materializeExternalFormalA18CropContextV2(
  input: MaterializeExternalFormalA18CropContextInputV2,
): MaterializedExternalFormalA18CropContextV2 {
  const logicalTime = canonicalHourV2(input.logical_time, "EXTERNAL_FORMAL_A18_CROP_CONTEXT_LOGICAL_TIME_INVALID");
  if (!/^sha256:[0-9a-f]{64}$/.test(input.expected_identity_hash)) {
    throw new Error("EXTERNAL_FORMAL_A18_EXPECTED_IDENTITY_HASH_INVALID");
  }

  const authority = input.crop_authority;
  if (authority.schema_version !== "geox_mcft_cap09_s6_formal_crop_context_authority_v2"
    || authority.authority_id !== MCFT_CAP09_A18_CROP_CONTEXT_REF_V2) {
    throw new Error("EXTERNAL_FORMAL_A18_CROP_CONTEXT_AUTHORITY_V2_REQUIRED");
  }
  if (authority.derived_context_authority !== MCFT_CAP09_A18_DERIVED_CONTEXT_AUTHORITY_V2) {
    throw new Error("EXTERNAL_FORMAL_A18_DERIVED_CONTEXT_AUTHORITY_MISMATCH");
  }

  const planting = recordV2(authority.planting_authority, "EXTERNAL_FORMAL_A18_PLANTING_AUTHORITY_REQUIRED");
  const plantingWindow = recordV2(planting.possible_event_window_utc, "EXTERNAL_FORMAL_A18_PLANTING_WINDOW_REQUIRED");
  const plantingStart = Date.parse(textV2(plantingWindow.start_inclusive, "EXTERNAL_FORMAL_A18_PLANTING_START_REQUIRED"));
  const plantingEnd = Date.parse(textV2(plantingWindow.end_exclusive, "EXTERNAL_FORMAL_A18_PLANTING_END_REQUIRED"));
  if (!Number.isFinite(plantingStart) || !Number.isFinite(plantingEnd) || plantingStart >= plantingEnd) {
    throw new Error("EXTERNAL_FORMAL_A18_PLANTING_WINDOW_INVALID");
  }

  const policy = recordV2(authority.as_of_derivation_policy, "EXTERNAL_FORMAL_A18_DERIVATION_POLICY_REQUIRED");
  const backwardHours = numberV2(policy.backward_stability_hours, "EXTERNAL_FORMAL_A18_BACKWARD_GUARD_REQUIRED");
  const forwardHours = numberV2(policy.forward_transition_guard_hours, "EXTERNAL_FORMAL_A18_FORWARD_GUARD_REQUIRED");
  if (backwardHours !== 6 || forwardHours !== 30
    || policy.planting_time_uncertainty_must_be_carried !== true
    || policy.future_observations_authorized !== false) {
    throw new Error("EXTERNAL_FORMAL_A18_DERIVATION_POLICY_DRIFT");
  }

  const model = recordV2(authority.model_stage_prior, "EXTERNAL_FORMAL_A18_MODEL_STAGE_PRIOR_REQUIRED");
  const variantsRaw = model.variant_stage_lengths_days;
  if (!Array.isArray(variantsRaw) || variantsRaw.length !== 6) {
    throw new Error("EXTERNAL_FORMAL_A18_EXACT_SIX_VARIANTS_REQUIRED");
  }
  const variants = variantsRaw.map((variant) => {
    if (!Array.isArray(variant)) throw new Error("EXTERNAL_FORMAL_A18_VARIANT_ARRAY_REQUIRED");
    return variant.map((value) => numberV2(value, "EXTERNAL_FORMAL_A18_VARIANT_VALUE_INVALID"));
  });

  const target = Date.parse(logicalTime);
  const currentMin = (target - plantingEnd) / HOUR_MS;
  const currentMax = (target - plantingStart) / HOUR_MS;
  const guardMin = (target - backwardHours * HOUR_MS - plantingEnd) / HOUR_MS;
  const guardMax = (target + forwardHours * HOUR_MS - plantingStart) / HOUR_MS;
  const allStages = new Set<string>();
  let minimumClearance = Number.POSITIVE_INFINITY;
  for (const variant of variants) {
    const localStages = [currentMin, currentMax, guardMin, guardMax].map((hours) => stageAtHoursV2(hours, variant));
    if (new Set(localStages).size !== 1) throw new Error("EXTERNAL_FORMAL_A18_STAGE_TRANSITION_RISK");
    allStages.add(localStages[0]);
    minimumClearance = Math.min(minimumClearance, (variant[0] + variant[1] + variant[2]) * 24 - guardMax);
  }
  if (allStages.size !== 1 || [...allStages][0] !== "MID") {
    throw new Error("EXTERNAL_FORMAL_A18_MID_CONSENSUS_REQUIRED");
  }

  const identityHash = deriveExternalFormalA18CropContextIdentityHashV2({ logical_time: logicalTime, crop_stage_code: "MID" });
  if (identityHash !== input.expected_identity_hash) {
    throw new Error("EXTERNAL_FORMAL_A18_FROZEN_IDENTITY_HASH_MISMATCH");
  }

  const source = exactCropSourceV2(input.configuration_matrix);
  const coverageStart = new Date(target - backwardHours * HOUR_MS).toISOString();
  const coverageEnd = new Date(target + forwardHours * HOUR_MS).toISOString();
  const context: ContinuationCropStageConfigurationContextV1 = {
    schema_version: "geox_mcft_cap09_t3r1_a18_formal_crop_context_v2",
    dataset_id: `mcft_cap09_t3r1_a18_formal_crop_context_${logicalTime.replace(/[^0-9]/g, "")}`,
    context_class: "CONFIGURATION_DERIVED_CONTEXT",
    evidence_record: false,
    configuration_matrix_ref: MCFT_CAP09_A18_CONFIGURATION_MATRIX_REF_V2,
    configuration_matrix_hash: MCFT_CAP09_A18_CONFIGURATION_MATRIX_HASH_V2,
    crop_water_use_binding_ref: "external_public_research_crop_water_use_v1",
    crop_water_use_configuration_source_id: MCFT_CAP09_A18_CROP_CONFIGURATION_SOURCE_ID_V2,
    crop_stage_mapping_source: source.crop_stage_mapping_source,
    timezone: "UTC",
    coverage_start: coverageStart,
    coverage_end_exclusive: coverageEnd,
    crop_stage_schedule: [{
      stage_code: "MID",
      effective_from: coverageStart,
      effective_to: coverageEnd,
      kc: source.kc,
      crop_root_depth_mm: source.crop_root_depth_mm,
      effective_model_root_depth_mm: source.effective_model_root_depth_mm,
    }],
    limitations: [
      "EXTERNAL_PUBLIC_RESEARCH_SCOPE",
      "FORMAL_DERIVED_CROP_WATER_USE_STAGE_CONTEXT_V2",
      "FAO56_MAIZE_GRAIN_CONSENSUS_ENVELOPE_FROM_PLANTING_DATE_V1",
      "MODEL_PRIOR_FROM_CAP08",
      "NOT_FIELD_CALIBRATED",
      "NO_OBSERVED_BIOLOGICAL_STAGE_CLAIM",
      "NO_FUTURE_OBSERVATION_USE",
      "CONTEXT_IDENTITY_HASH_DOES_NOT_ALONE_ATTEST_FULL_MATERIALIZED_PAYLOAD",
      "A18_FULL_CONTEXT_MATERIALIZATION_HASH_REQUIRED",
    ],
    determinism_hash: identityHash,
  };

  const materializationHash = semanticHashV1({
    materialization_profile: MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V2,
    context_ref: MCFT_CAP09_A18_CROP_CONTEXT_REF_V2,
    context_identity_hash: identityHash,
    materialized_context: context,
  });

  return {
    identity_profile: MCFT_CAP09_A18_CROP_CONTEXT_IDENTITY_PROFILE_V2,
    materialization_profile: MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V2,
    logical_time: logicalTime,
    stage_code: "MID",
    context_ref: MCFT_CAP09_A18_CROP_CONTEXT_REF_V2,
    context_identity_hash: identityHash,
    context_materialization_hash: materializationHash,
    minimum_hours_to_next_stage_after_forward_guard: minimumClearance,
    context,
  };
}
