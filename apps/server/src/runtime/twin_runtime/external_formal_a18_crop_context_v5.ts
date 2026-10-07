// Purpose: Formal-v5 successor materializes T4R1 crop context from a governed current-crop
// authority composition rather than the historical hard-coded MID calendar consensus.
// Boundary: pure qualification/materialization. No provider, database, scheduler,
// persistence, wall clock, Docker, or Formal execution effect.

import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_HASH_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_REF_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_CROP_CONTEXT_ID_V1,
} from "../../domain/twin_runtime/external_formal_bootstrap_authority_bundle_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "./continuation_evidence_window_service_v1.js";

export const MCFT_CAP09_A18_DERIVED_CONTEXT_AUTHORITY_V5 =
  "FORMAL_BIOLOGICAL_STAGE_AUTHORITY_DERIVED_CROP_WATER_USE_CONTEXT_V4" as const;
export const MCFT_CAP09_A18_CROP_CONTEXT_IDENTITY_PROFILE_V5 =
  "T4R1_A18_BIOLOGICAL_STAGE_AUTHORITY_CONTEXT_IDENTITY_V4" as const;
export const MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V5 =
  "T4R1_A18_BIOLOGICAL_STAGE_AUTHORITY_CONTEXT_MATERIALIZATION_V4" as const;

const CROP_CONFIGURATION_SOURCE_ID = "mcft_crop_water_use_corn_v1" as const;
const CROP_CONFIGURATION_SEMANTIC_HASH =
  "sha256:56ac92e34148bd81fe20f2925e1079cb1a3ed647ffefd1471caf1302df70ee4c" as const;
const BACKWARD_STABILITY_HOURS = 6;
const FORWARD_STAGE_GUARD_HOURS = 30;
const ALLOWED_BIOLOGICAL_STAGES_V5 = new Set([
  "R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE",
  "R6_OR_LATER_MODEL_ESTIMATE",
] as const);

type JsonRecordV5 = Record<string, unknown>;
export type ExternalFormalCropWaterUseStageV5 = "INITIAL" | "DEVELOPMENT" | "MID" | "LATE";

export type MaterializeExternalFormalA18CropContextInputV5 = {
  logical_time: string;
  expected_identity_hash: string;
  crop_authority: JsonRecordV5;
  configuration_matrix: JsonRecordV5;
  current_crop_authority: JsonRecordV5;
  biological_stage_architecture_effectiveness?: JsonRecordV5;
  activation_mode: "QUALIFICATION_ONLY" | "PRODUCTION_EFFECTIVE";
};

export type MaterializedExternalFormalA18CropContextV5 = {
  identity_profile: typeof MCFT_CAP09_A18_CROP_CONTEXT_IDENTITY_PROFILE_V5;
  materialization_profile: typeof MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V5;
  logical_time: string;
  stage_code: ExternalFormalCropWaterUseStageV5;
  kc: number;
  context_ref: typeof MCFT_CAP09_EXTERNAL_FORMAL_CROP_CONTEXT_ID_V1;
  context_identity_hash: string;
  context_materialization_hash: string;
  current_crop_authority_evidence_digest: string;
  water_use_stage_forward_stable_under_thermal_progression: true;
  lifecycle_requires_separate_validation: true;
  production_effective: boolean;
  context: ContinuationCropStageConfigurationContextV1;
};

function recordV5(value: unknown, code: string): JsonRecordV5 {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as JsonRecordV5;
}
function textV5(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}
function numberV5(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
}
function canonicalHourV5(value: unknown, code: string): string {
  const text = textV5(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text || !text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}
function validStageV5(value: unknown): value is ExternalFormalCropWaterUseStageV5 {
  return typeof value === "string" && (["INITIAL","DEVELOPMENT","MID","LATE"] as const).includes(value as ExternalFormalCropWaterUseStageV5);
}

function exactCropSourceV5(matrix: JsonRecordV5, stage: ExternalFormalCropWaterUseStageV5): {
  kc: number;
  crop_root_depth_mm: number;
  effective_model_root_depth_mm: number;
  crop_stage_mapping_source: string;
} {
  if (matrix.schema_version !== "geox_mcft00_configuration_binding_matrix_v2") {
    throw new Error("EXTERNAL_FORMAL_A18_V5_CONFIGURATION_MATRIX_SCHEMA_REQUIRED");
  }
  if (matrix.determinism_hash !== MCFT_CAP09_EXTERNAL_FORMAL_CONFIGURATION_MATRIX_HASH_V1) {
    throw new Error("EXTERNAL_FORMAL_A18_V5_CONFIGURATION_MATRIX_HASH_MISMATCH");
  }
  const definitions = matrix.configuration_source_definitions;
  if (!Array.isArray(definitions)) throw new Error("EXTERNAL_FORMAL_A18_V5_CONFIGURATION_SOURCES_REQUIRED");
  const matches = definitions
    .map((value) => recordV5(value, "EXTERNAL_FORMAL_A18_V5_CONFIGURATION_SOURCE_INVALID"))
    .filter((value) => value.configuration_source_id === CROP_CONFIGURATION_SOURCE_ID);
  if (matches.length !== 1) throw new Error("EXTERNAL_FORMAL_A18_V5_EXACT_CROP_CONFIGURATION_SOURCE_REQUIRED");
  const source = matches[0]!;
  if (source.configuration_semantic_hash !== CROP_CONFIGURATION_SEMANTIC_HASH) {
    throw new Error("EXTERNAL_FORMAL_A18_V5_CROP_CONFIGURATION_HASH_MISMATCH");
  }
  const parameters = recordV5(source.parameters, "EXTERNAL_FORMAL_A18_V5_CROP_PARAMETERS_REQUIRED");
  const kcSchedule = recordV5(parameters.kc_schedule, "EXTERNAL_FORMAL_A18_V5_KC_SCHEDULE_REQUIRED").value;
  const rootDepthMapping = recordV5(parameters.root_depth_mapping, "EXTERNAL_FORMAL_A18_V5_ROOT_DEPTH_MAPPING_REQUIRED").value;
  const stageMapping = recordV5(parameters.crop_stage_mapping_source, "EXTERNAL_FORMAL_A18_V5_STAGE_MAPPING_REQUIRED").value;
  if (!Array.isArray(kcSchedule) || !Array.isArray(rootDepthMapping)) throw new Error("EXTERNAL_FORMAL_A18_V5_PARAMETER_ARRAY_REQUIRED");
  const kcMatches = kcSchedule
    .map((value) => recordV5(value, "EXTERNAL_FORMAL_A18_V5_KC_ENTRY_INVALID"))
    .filter((value) => value.stage_code === stage);
  const depthMatches = rootDepthMapping
    .map((value) => recordV5(value, "EXTERNAL_FORMAL_A18_V5_DEPTH_ENTRY_INVALID"))
    .filter((value) => value.stage_code === stage);
  if (kcMatches.length !== 1 || depthMatches.length !== 1) {
    throw new Error("EXTERNAL_FORMAL_A18_V5_EXACT_STAGE_PARAMETERS_REQUIRED:" + stage);
  }
  return {
    kc: numberV5(kcMatches[0]!.kc, "EXTERNAL_FORMAL_A18_V5_KC_REQUIRED"),
    crop_root_depth_mm: numberV5(depthMatches[0]!.crop_root_depth_mm, "EXTERNAL_FORMAL_A18_V5_CROP_ROOT_DEPTH_REQUIRED"),
    effective_model_root_depth_mm: numberV5(depthMatches[0]!.effective_model_root_depth_mm, "EXTERNAL_FORMAL_A18_V5_EFFECTIVE_ROOT_DEPTH_REQUIRED"),
    crop_stage_mapping_source: textV5(stageMapping, "EXTERNAL_FORMAL_A18_V5_STAGE_MAPPING_VALUE_REQUIRED"),
  };
}

function validateCurrentCropAuthorityV5(value: JsonRecordV5): {
  stage: ExternalFormalCropWaterUseStageV5;
  evidenceDigest: string;
  expectedKc: number;
  authorityAsOf: string;
  forwardStabilityHours: number;
} {
  if (value.schema_version !== "geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1"
    || value.status !== "PASS"
    || value.qualification_outcome !== "CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED") {
    throw new Error("EXTERNAL_FORMAL_A18_V5_CURRENT_CROP_AUTHORITY_REQUIRED");
  }
  const scope = recordV5(value.scope, "EXTERNAL_FORMAL_A18_V5_CURRENT_SCOPE_REQUIRED");
  if (scope.site_id !== "KBS_MCSE_T4R1"
    || scope.field_id !== "field_kbs_mcse_t4r1"
    || scope.season_id !== "season_2026_corn"
    || scope.zone_id !== "zone_kbs_mcse_t4r1_crop_formal_v1"
    || scope.hybrid_product_code !== "43-96P") {
    throw new Error("EXTERNAL_FORMAL_A18_V5_CURRENT_SCOPE_MISMATCH");
  }
  const lifecycle = recordV5(value.lifecycle, "EXTERNAL_FORMAL_A18_V5_LIFECYCLE_REQUIRED");
  if (lifecycle.domain_state !== "ACTIVE"
    || lifecycle.authority_status !== "RESOLVED"
    || lifecycle.authority_validity !== "VALID"
    || lifecycle.authority_mode !== "GOVERNED_PERSISTENT_STATE"
    || lifecycle.active_consumable_candidate !== true) {
    throw new Error("EXTERNAL_FORMAL_A18_V5_LIFECYCLE_NOT_CONSUMABLE");
  }
  const biological = recordV5(value.biological_stage, "EXTERNAL_FORMAL_A18_V5_BIOLOGICAL_STAGE_REQUIRED");
  if (biological.epistemic_class !== "THERMAL_MODEL_DERIVED"
    || biological.observed_biological_stage_claimed !== false
    || !ALLOWED_BIOLOGICAL_STAGES_V5.has(
      String(biological.resolved_biological_stage) as
        | "R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE"
        | "R6_OR_LATER_MODEL_ESTIMATE"
    )) {
    throw new Error("EXTERNAL_FORMAL_A18_V5_BIOLOGICAL_STAGE_AUTHORITY_MISMATCH");
  }
  const authorityAsOf = canonicalHourV5(
    biological.authority_as_of,
    "EXTERNAL_FORMAL_A18_V5_STAGE_AUTHORITY_AS_OF_REQUIRED",
  );
  const forwardStabilityHours = numberV5(
    biological.forward_stability_hours,
    "EXTERNAL_FORMAL_A18_V5_FORWARD_STABILITY_HOURS_REQUIRED",
  );
  if (
    !Number.isInteger(forwardStabilityHours)
    || forwardStabilityHours <= 0
    || forwardStabilityHours > 48
  ) {
    throw new Error("EXTERNAL_FORMAL_A18_V5_FORWARD_STABILITY_HOURS_INVALID");
  }

  const stage = value.crop_water_use_stage;
  if (!validStageV5(stage) || stage !== "LATE") {
    throw new Error("EXTERNAL_FORMAL_A18_V5_EXACT_LATE_STAGE_REQUIRED");
  }
  const model = recordV5(value.crop_model_parameter, "EXTERNAL_FORMAL_A18_V5_CROP_MODEL_PARAMETER_REQUIRED");
  if (model.parameter !== "Kc"
    || model.stage_code !== stage
    || model.configuration_source_id !== CROP_CONFIGURATION_SOURCE_ID
    || model.configuration_semantic_hash !== CROP_CONFIGURATION_SEMANTIC_HASH
    || model.production_effective !== false) {
    throw new Error("EXTERNAL_FORMAL_A18_V5_CROP_MODEL_PARAMETER_AUTHORITY_MISMATCH");
  }
  const expectedKc = numberV5(model.value, "EXTERNAL_FORMAL_A18_V5_CURRENT_KC_REQUIRED");
  const evidenceDigest = textV5(value.evidence_digest, "EXTERNAL_FORMAL_A18_V5_EVIDENCE_DIGEST_REQUIRED");
  if (!/^sha256:[0-9a-f]{64}$/.test(evidenceDigest)) throw new Error("EXTERNAL_FORMAL_A18_V5_EVIDENCE_DIGEST_INVALID");
  // R5 -> R6 is a monotone biological-development transition and both governed
  // mappings resolve to LATE. This proves water-use-stage stability under thermal
  // progression only; it does not prove future lifecycle ACTIVE.
  return {
    stage,
    evidenceDigest,
    expectedKc,
    authorityAsOf,
    forwardStabilityHours,
  };
}

export function deriveExternalFormalA18CropContextIdentityHashV5(input: {
  logical_time: string;
  crop_stage_code: ExternalFormalCropWaterUseStageV5;
  current_crop_authority_evidence_digest: string;
}): string {
  const logicalTime = canonicalHourV5(input.logical_time, "EXTERNAL_FORMAL_A18_V5_CROP_CONTEXT_LOGICAL_TIME_INVALID");
  if (!validStageV5(input.crop_stage_code)) throw new Error("EXTERNAL_FORMAL_A18_V5_CROP_STAGE_INVALID");
  if (!/^sha256:[0-9a-f]{64}$/.test(input.current_crop_authority_evidence_digest)) {
    throw new Error("EXTERNAL_FORMAL_A18_V5_CURRENT_AUTHORITY_DIGEST_INVALID");
  }
  return semanticHashV1({
    derived_context_authority: MCFT_CAP09_A18_DERIVED_CONTEXT_AUTHORITY_V5,
    crop_stage_code: input.crop_stage_code,
    derivation_authority_time: logicalTime,
    current_crop_authority_evidence_digest: input.current_crop_authority_evidence_digest,
    observed_biological_stage_claimed: false,
    water_use_stage_forward_stable_under_thermal_progression: true,
    lifecycle_requires_separate_validation: true,
    field_calibration_status: "NOT_FIELD_CALIBRATED",
  });
}

export function materializeExternalFormalA18CropContextV5(
  input: MaterializeExternalFormalA18CropContextInputV5,
): MaterializedExternalFormalA18CropContextV5 {
  const productionEffective = input.activation_mode === "PRODUCTION_EFFECTIVE";
  if (productionEffective) {
    const current = input.current_crop_authority;
    if (
      current.architecture_effective !== true
      || current.runtime_consumption_authorized !== true
    ) {
      throw new Error("EXTERNAL_FORMAL_A18_V5_CURRENT_CROP_AUTHORITY_NOT_EFFECTIVE");
    }
    const architecture = input.biological_stage_architecture_effectiveness;
    if (
      !architecture
      || architecture.schema_version !== "geox_dt02_biological_stage_authority_effectiveness_v1"
      || architecture.amendment_id !== "DT02-AMENDMENT-03"
      || architecture.status !== "EFFECTIVE"
      || architecture.effective !== true
    ) {
      throw new Error("EXTERNAL_FORMAL_A18_V5_ARCHITECTURE_EFFECTIVENESS_REQUIRED");
    }
  }
  const logicalTime = canonicalHourV5(input.logical_time, "EXTERNAL_FORMAL_A18_V5_CROP_CONTEXT_LOGICAL_TIME_INVALID");
  if (!/^sha256:[0-9a-f]{64}$/.test(input.expected_identity_hash)) {
    throw new Error("EXTERNAL_FORMAL_A18_V5_EXPECTED_IDENTITY_HASH_INVALID");
  }

  const authority = input.crop_authority;
  if (authority.schema_version !== "geox_mcft_cap09_s6_formal_crop_context_authority_v3"
    || authority.authority_id !== MCFT_CAP09_EXTERNAL_FORMAL_CROP_CONTEXT_ID_V1) {
    throw new Error("EXTERNAL_FORMAL_A18_V5_FORMAL_CROP_CONTEXT_AUTHORITY_REQUIRED");
  }
  const scope = recordV5(authority.scope, "EXTERNAL_FORMAL_A18_V5_FORMAL_SCOPE_REQUIRED");
  if (scope.site_id !== "KBS_MCSE_T4R1"
    || scope.field_id !== "field_kbs_mcse_t4r1"
    || scope.season_id !== "season_2026_corn"
    || scope.zone_id !== "zone_kbs_mcse_t4r1_crop_formal_v1"
    || scope.hybrid_product_code !== "43-96P") {
    throw new Error("EXTERNAL_FORMAL_A18_V5_FORMAL_SCOPE_MISMATCH");
  }

  const current = validateCurrentCropAuthorityV5(input.current_crop_authority);
  const logicalMs = Date.parse(logicalTime);
  const authorityMs = Date.parse(current.authorityAsOf);
  if (logicalMs < authorityMs) {
    throw new Error("EXTERNAL_FORMAL_A18_V5_FUTURE_STAGE_EVIDENCE_FORBIDDEN");
  }
  if (logicalMs > authorityMs + current.forwardStabilityHours * 3_600_000) {
    throw new Error("EXTERNAL_FORMAL_A18_V5_STAGE_AUTHORITY_FORWARD_WINDOW_EXCEEDED");
  }
  const source = exactCropSourceV5(input.configuration_matrix, current.stage);
  if (source.kc !== current.expectedKc) throw new Error("EXTERNAL_FORMAL_A18_V5_CURRENT_KC_MATRIX_MISMATCH");

  const identityHash = deriveExternalFormalA18CropContextIdentityHashV5({
    logical_time: logicalTime,
    crop_stage_code: current.stage,
    current_crop_authority_evidence_digest: current.evidenceDigest,
  });
  if (identityHash !== input.expected_identity_hash) throw new Error("EXTERNAL_FORMAL_A18_V5_FROZEN_IDENTITY_HASH_MISMATCH");

  const target = Date.parse(logicalTime);
  const coverageStart = new Date(target - BACKWARD_STABILITY_HOURS * 3_600_000).toISOString();
  const coverageEnd = new Date(target + FORWARD_STAGE_GUARD_HOURS * 3_600_000).toISOString();
  const context: ContinuationCropStageConfigurationContextV1 = {
    schema_version: "geox_mcft_cap09_t4r1_a18_formal_crop_context_v4",
    dataset_id: `mcft_cap09_t4r1_a18_formal_crop_context_v4_${logicalTime.replace(/[^0-9]/g, "")}`,
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
      stage_code: current.stage,
      effective_from: coverageStart,
      effective_to: coverageEnd,
      kc: source.kc,
      crop_root_depth_mm: source.crop_root_depth_mm,
      effective_model_root_depth_mm: source.effective_model_root_depth_mm,
    }],
    limitations: [
      "EXTERNAL_PUBLIC_RESEARCH_SCOPE",
      MCFT_CAP09_A18_DERIVED_CONTEXT_AUTHORITY_V5,
      "BIOLOGICAL_STAGE_AUTHORITY_THERMAL_MODEL_DERIVED",
      "NO_OBSERVED_BIOLOGICAL_STAGE_CLAIM",
      "WATER_USE_STAGE_LATE_STABLE_FOR_R5_TO_R6_THERMAL_PROGRESSION",
      "LIFECYCLE_ACTIVE_REQUIRES_SEPARATE_VALIDATION",
      "MODEL_PRIOR_FROM_CAP08",
      "NOT_FIELD_CALIBRATED",
      "NO_FUTURE_OBSERVATION_USE",
      productionEffective
        ? "PRODUCTION_EFFECTIVE_EXACT_BOUND_STAGE_AUTHORITY"
        : "QUALIFICATION_ONLY_NO_PRODUCTION_EFFECT",
    ],
    determinism_hash: identityHash,
  };

  const materializationHash = semanticHashV1({
    materialization_profile: MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V5,
    context_ref: MCFT_CAP09_EXTERNAL_FORMAL_CROP_CONTEXT_ID_V1,
    context_identity_hash: identityHash,
    current_crop_authority_evidence_digest: current.evidenceDigest,
    materialized_context: context,
  });

  return {
    identity_profile: MCFT_CAP09_A18_CROP_CONTEXT_IDENTITY_PROFILE_V5,
    materialization_profile: MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V5,
    logical_time: logicalTime,
    stage_code: current.stage,
    kc: source.kc,
    context_ref: MCFT_CAP09_EXTERNAL_FORMAL_CROP_CONTEXT_ID_V1,
    context_identity_hash: identityHash,
    context_materialization_hash: materializationHash,
    current_crop_authority_evidence_digest: current.evidenceDigest,
    water_use_stage_forward_stable_under_thermal_progression: true,
    lifecycle_requires_separate_validation: true,
    production_effective: productionEffective,
    context,
  };
}
