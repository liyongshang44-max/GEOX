// Purpose: deterministically materialize the Amendment-20 T4R1 Formal crop context
// from the frozen T4R1 crop authority identity and MCFT-00 configuration matrix.
// Boundary: pure validation/materialization only; no filesystem, database, provider,
// R2, scheduler, wall clock, persistence, or Formal execution.

import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_BLOBS_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_HASH_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_REF_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_CROP_CONTEXT_ID_V1,
} from "../../domain/twin_runtime/external_formal_bootstrap_authority_bundle_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "./continuation_evidence_window_service_v1.js";

export const MCFT_CAP09_A18_DERIVED_CONTEXT_AUTHORITY_V3 =
  "FORMAL_DERIVED_CROP_WATER_USE_STAGE_CONTEXT_V3" as const;
export const MCFT_CAP09_A18_CROP_CONTEXT_IDENTITY_PROFILE_V3 =
  "T4R1_A18_SLOT_CROP_CONTEXT_AUTHORITY_IDENTITY_V3" as const;
export const MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V3 =
  "T4R1_A18_FULL_CROP_CONTEXT_MATERIALIZATION_V3" as const;

const CROP_CONFIGURATION_SOURCE_ID = "mcft_crop_water_use_corn_v1" as const;
const CROP_CONFIGURATION_SEMANTIC_HASH =
  "sha256:56ac92e34148bd81fe20f2925e1079cb1a3ed647ffefd1471caf1302df70ee4c" as const;
const HOUR_MS = 3_600_000;

type JsonRecordV3 = Record<string, unknown>;
type CropStageCodeV3 = "INITIAL" | "DEVELOPMENT" | "MID" | "LATE";

export type MaterializeExternalFormalA18CropContextInputV3 = {
  logical_time: string;
  expected_identity_hash: string;
  crop_authority: JsonRecordV3;
  configuration_matrix: JsonRecordV3;
};

export type MaterializedExternalFormalA18CropContextV3 = {
  identity_profile: typeof MCFT_CAP09_A18_CROP_CONTEXT_IDENTITY_PROFILE_V3;
  materialization_profile: typeof MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V3;
  logical_time: string;
  stage_code: "MID";
  context_ref: typeof MCFT_CAP09_EXTERNAL_FORMAL_CROP_CONTEXT_ID_V1;
  context_identity_hash: string;
  context_materialization_hash: string;
  minimum_hours_to_next_stage_after_forward_guard: number;
  context: ContinuationCropStageConfigurationContextV1;
};

function recordV3(value: unknown, code: string): JsonRecordV3 {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as JsonRecordV3;
}

function textV3(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function numberV3(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
}

function canonicalHourV3(value: unknown, code: string): string {
  const text = textV3(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text || !text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function stageAtHoursV3(hoursSincePlanting: number, variant: readonly number[]): CropStageCodeV3 | "PRE_PLANTING" | "POST_MODEL_SEASON" {
  if (variant.length !== 4 || variant.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("EXTERNAL_FORMAL_A18_V3_CROP_CONTEXT_VARIANT_INVALID");
  }
  const [a, b, c, d] = variant;
  if (hoursSincePlanting < 0) return "PRE_PLANTING";
  if (hoursSincePlanting < a * 24) return "INITIAL";
  if (hoursSincePlanting < (a + b) * 24) return "DEVELOPMENT";
  if (hoursSincePlanting < (a + b + c) * 24) return "MID";
  if (hoursSincePlanting < (a + b + c + d) * 24) return "LATE";
  return "POST_MODEL_SEASON";
}

function exactCropSourceV3(matrix: JsonRecordV3): {
  kc: number;
  crop_root_depth_mm: number;
  effective_model_root_depth_mm: number;
  crop_stage_mapping_source: string;
} {
  if (matrix.schema_version !== "geox_mcft00_configuration_binding_matrix_v2") {
    throw new Error("EXTERNAL_FORMAL_A18_V3_CONFIGURATION_MATRIX_SCHEMA_REQUIRED");
  }
  if (matrix.determinism_hash !== MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_HASH_V1) {
    throw new Error("EXTERNAL_FORMAL_A18_V3_CONFIGURATION_MATRIX_HASH_MISMATCH");
  }
  const definitions = matrix.configuration_source_definitions;
  if (!Array.isArray(definitions)) throw new Error("EXTERNAL_FORMAL_A18_V3_CONFIGURATION_SOURCES_REQUIRED");
  const matches = definitions
    .map((value) => recordV3(value, "EXTERNAL_FORMAL_A18_V3_CONFIGURATION_SOURCE_INVALID"))
    .filter((value) => value.configuration_source_id === CROP_CONFIGURATION_SOURCE_ID);
  if (matches.length !== 1) throw new Error("EXTERNAL_FORMAL_A18_V3_EXACT_CROP_CONFIGURATION_SOURCE_REQUIRED");
  const source = matches[0];
  if (source.configuration_semantic_hash !== CROP_CONFIGURATION_SEMANTIC_HASH) {
    throw new Error("EXTERNAL_FORMAL_A18_V3_CROP_CONFIGURATION_HASH_MISMATCH");
  }
  const parameters = recordV3(source.parameters, "EXTERNAL_FORMAL_A18_V3_CROP_PARAMETERS_REQUIRED");
  const kcSchedule = recordV3(parameters.kc_schedule, "EXTERNAL_FORMAL_A18_V3_KC_SCHEDULE_REQUIRED").value;
  const rootDepthMapping = recordV3(parameters.root_depth_mapping, "EXTERNAL_FORMAL_A18_V3_ROOT_DEPTH_MAPPING_REQUIRED").value;
  const stageMapping = recordV3(parameters.crop_stage_mapping_source, "EXTERNAL_FORMAL_A18_V3_STAGE_MAPPING_REQUIRED").value;
  if (!Array.isArray(kcSchedule) || !Array.isArray(rootDepthMapping)) throw new Error("EXTERNAL_FORMAL_A18_V3_PARAMETER_ARRAY_REQUIRED");
  const kcMatches = kcSchedule
    .map((value) => recordV3(value, "EXTERNAL_FORMAL_A18_V3_KC_ENTRY_INVALID"))
    .filter((value) => value.stage_code === "MID");
  const depthMatches = rootDepthMapping
    .map((value) => recordV3(value, "EXTERNAL_FORMAL_A18_V3_DEPTH_ENTRY_INVALID"))
    .filter((value) => value.stage_code === "MID");
  if (kcMatches.length !== 1 || depthMatches.length !== 1) throw new Error("EXTERNAL_FORMAL_A18_V3_EXACT_MID_PARAMETERS_REQUIRED");
  return {
    kc: numberV3(kcMatches[0].kc, "EXTERNAL_FORMAL_A18_V3_MID_KC_REQUIRED"),
    crop_root_depth_mm: numberV3(depthMatches[0].crop_root_depth_mm, "EXTERNAL_FORMAL_A18_V3_MID_CROP_ROOT_DEPTH_REQUIRED"),
    effective_model_root_depth_mm: numberV3(depthMatches[0].effective_model_root_depth_mm, "EXTERNAL_FORMAL_A18_V3_MID_EFFECTIVE_ROOT_DEPTH_REQUIRED"),
    crop_stage_mapping_source: textV3(stageMapping, "EXTERNAL_FORMAL_A18_V3_STAGE_MAPPING_VALUE_REQUIRED"),
  };
}

export function deriveExternalFormalA18CropContextIdentityHashV3(input: {
  logical_time: string;
  crop_stage_code: "MID";
}): string {
  const logicalTime = canonicalHourV3(input.logical_time, "EXTERNAL_FORMAL_A18_V3_CROP_CONTEXT_LOGICAL_TIME_INVALID");
  return semanticHashV1({
    authority_ref: MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_BLOBS_V1.crop_context.ref,
    authority_blob_sha: MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_BLOBS_V1.crop_context.hash,
    derived_context_authority: MCFT_CAP09_A18_DERIVED_CONTEXT_AUTHORITY_V3,
    crop_stage_code: input.crop_stage_code,
    derivation_authority_time: logicalTime,
    observed_biological_stage_claimed: false,
    field_calibration_status: "NOT_FIELD_CALIBRATED",
  });
}

export function materializeExternalFormalA18CropContextV3(
  input: MaterializeExternalFormalA18CropContextInputV3,
): MaterializedExternalFormalA18CropContextV3 {
  const logicalTime = canonicalHourV3(input.logical_time, "EXTERNAL_FORMAL_A18_V3_CROP_CONTEXT_LOGICAL_TIME_INVALID");
  if (!/^sha256:[0-9a-f]{64}$/.test(input.expected_identity_hash)) {
    throw new Error("EXTERNAL_FORMAL_A18_V3_EXPECTED_IDENTITY_HASH_INVALID");
  }

  const authority = input.crop_authority;
  if (authority.schema_version !== "geox_mcft_cap09_s6_formal_crop_context_authority_v3"
    || authority.authority_id !== MCFT_CAP09_EXTERNAL_FORMAL_CROP_CONTEXT_ID_V1) {
    throw new Error("EXTERNAL_FORMAL_A18_V3_CROP_CONTEXT_AUTHORITY_REQUIRED");
  }
  if (authority.derived_context_authority !== MCFT_CAP09_A18_DERIVED_CONTEXT_AUTHORITY_V3) {
    throw new Error("EXTERNAL_FORMAL_A18_V3_DERIVED_CONTEXT_AUTHORITY_MISMATCH");
  }
  const scope = recordV3(authority.scope, "EXTERNAL_FORMAL_A18_V3_SCOPE_REQUIRED");
  if (scope.site_id !== "KBS_MCSE_T4R1"
    || scope.field_id !== "field_kbs_mcse_t4r1"
    || scope.season_id !== "season_2026_corn"
    || scope.zone_id !== "zone_kbs_mcse_t4r1_crop_formal_v1"
    || scope.hybrid_product_code !== "43-96P") {
    throw new Error("EXTERNAL_FORMAL_A18_V3_T4R1_SCOPE_REQUIRED");
  }

  const planting = recordV3(authority.planting_authority, "EXTERNAL_FORMAL_A18_V3_PLANTING_AUTHORITY_REQUIRED");
  if (planting.observation_id !== 6974 || planting.provider_area_identity !== "T4" || planting.replicate !== "R1") {
    throw new Error("EXTERNAL_FORMAL_A18_V3_T4R1_PLANTING_AUTHORITY_REQUIRED");
  }
  const plantingWindow = recordV3(planting.possible_event_window_utc, "EXTERNAL_FORMAL_A18_V3_PLANTING_WINDOW_REQUIRED");
  const plantingStart = Date.parse(textV3(plantingWindow.start_inclusive, "EXTERNAL_FORMAL_A18_V3_PLANTING_START_REQUIRED"));
  const plantingEnd = Date.parse(textV3(plantingWindow.end_exclusive, "EXTERNAL_FORMAL_A18_V3_PLANTING_END_REQUIRED"));
  if (!Number.isFinite(plantingStart) || !Number.isFinite(plantingEnd) || plantingStart >= plantingEnd) {
    throw new Error("EXTERNAL_FORMAL_A18_V3_PLANTING_WINDOW_INVALID");
  }

  const policy = recordV3(authority.as_of_derivation_policy, "EXTERNAL_FORMAL_A18_V3_DERIVATION_POLICY_REQUIRED");
  const backwardHours = numberV3(policy.backward_stability_hours, "EXTERNAL_FORMAL_A18_V3_BACKWARD_GUARD_REQUIRED");
  const forwardHours = numberV3(policy.forward_transition_guard_hours, "EXTERNAL_FORMAL_A18_V3_FORWARD_GUARD_REQUIRED");
  if (backwardHours !== 6 || forwardHours !== 30
    || policy.planting_time_uncertainty_must_be_carried !== true
    || policy.future_observations_authorized !== false) {
    throw new Error("EXTERNAL_FORMAL_A18_V3_DERIVATION_POLICY_DRIFT");
  }

  const model = recordV3(authority.model_stage_prior, "EXTERNAL_FORMAL_A18_V3_MODEL_STAGE_PRIOR_REQUIRED");
  const variantsRaw = model.variant_stage_lengths_days;
  if (!Array.isArray(variantsRaw) || variantsRaw.length !== 6) {
    throw new Error("EXTERNAL_FORMAL_A18_V3_EXACT_SIX_VARIANTS_REQUIRED");
  }
  const variants = variantsRaw.map((variant) => {
    if (!Array.isArray(variant)) throw new Error("EXTERNAL_FORMAL_A18_V3_VARIANT_ARRAY_REQUIRED");
    return variant.map((value) => numberV3(value, "EXTERNAL_FORMAL_A18_V3_VARIANT_VALUE_INVALID"));
  });

  const target = Date.parse(logicalTime);
  const currentMin = (target - plantingEnd) / HOUR_MS;
  const currentMax = (target - plantingStart) / HOUR_MS;
  const guardMin = (target - backwardHours * HOUR_MS - plantingEnd) / HOUR_MS;
  const guardMax = (target + forwardHours * HOUR_MS - plantingStart) / HOUR_MS;
  const allStages = new Set<string>();
  let minimumClearance = Number.POSITIVE_INFINITY;
  for (const variant of variants) {
    const localStages = [currentMin, currentMax, guardMin, guardMax].map((hours) => stageAtHoursV3(hours, variant));
    if (new Set(localStages).size !== 1) throw new Error("EXTERNAL_FORMAL_A18_V3_STAGE_TRANSITION_RISK");
    allStages.add(localStages[0]);
    minimumClearance = Math.min(minimumClearance, (variant[0] + variant[1] + variant[2]) * 24 - guardMax);
  }
  if (allStages.size !== 1 || [...allStages][0] !== "MID") {
    throw new Error("EXTERNAL_FORMAL_A18_V3_MID_CONSENSUS_REQUIRED");
  }

  const identityHash = deriveExternalFormalA18CropContextIdentityHashV3({ logical_time: logicalTime, crop_stage_code: "MID" });
  if (identityHash !== input.expected_identity_hash) {
    throw new Error("EXTERNAL_FORMAL_A18_V3_FROZEN_IDENTITY_HASH_MISMATCH");
  }

  const source = exactCropSourceV3(input.configuration_matrix);
  const coverageStart = new Date(target - backwardHours * HOUR_MS).toISOString();
  const coverageEnd = new Date(target + forwardHours * HOUR_MS).toISOString();
  const context: ContinuationCropStageConfigurationContextV1 = {
    schema_version: "geox_mcft_cap09_t4r1_a18_formal_crop_context_v3",
    dataset_id: `mcft_cap09_t4r1_a18_formal_crop_context_${logicalTime.replace(/[^0-9]/g, "")}`,
    context_class: "CONFIGURATION_DERIVED_CONTEXT",
    evidence_record: false,
    configuration_matrix_ref: MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_REF_V1,
    configuration_matrix_hash: MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_HASH_V1,
    crop_water_use_binding_ref: "external_public_research_crop_water_use_v1",
    crop_water_use_configuration_source_id: CROP_CONFIGURATION_SOURCE_ID,
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
      "FORMAL_DERIVED_CROP_WATER_USE_STAGE_CONTEXT_V3",
      "FAO56_MAIZE_GRAIN_CONSENSUS_ENVELOPE_FROM_PLANTING_DATE_V1",
      "MODEL_PRIOR_FROM_CAP08",
      "NOT_FIELD_CALIBRATED",
      "NO_OBSERVED_BIOLOGICAL_STAGE_CLAIM",
      "NO_FUTURE_OBSERVATION_USE",
      "T4R1_SUCCESSOR_SCOPE",
      "CONTEXT_IDENTITY_HASH_DOES_NOT_ALONE_ATTEST_FULL_MATERIALIZED_PAYLOAD",
      "A18_FULL_CONTEXT_MATERIALIZATION_HASH_REQUIRED",
    ],
    determinism_hash: identityHash,
  };

  const materializationHash = semanticHashV1({
    materialization_profile: MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V3,
    context_ref: MCFT_CAP09_EXTERNAL_FORMAL_CROP_CONTEXT_ID_V1,
    context_identity_hash: identityHash,
    materialized_context: context,
  });

  return {
    identity_profile: MCFT_CAP09_A18_CROP_CONTEXT_IDENTITY_PROFILE_V3,
    materialization_profile: MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V3,
    logical_time: logicalTime,
    stage_code: "MID",
    context_ref: MCFT_CAP09_EXTERNAL_FORMAL_CROP_CONTEXT_ID_V1,
    context_identity_hash: identityHash,
    context_materialization_hash: materializationHash,
    minimum_hours_to_next_stage_after_forward_guard: minimumClearance,
    context,
  };
}
