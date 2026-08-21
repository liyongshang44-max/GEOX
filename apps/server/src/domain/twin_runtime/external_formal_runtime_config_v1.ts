// apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.ts
// Purpose: define and deterministically compile the honest External Formal canonical Runtime Config authority profile required by MCFT-CAP-09 Amendment-05.
// Boundary: pure contract/construction only; no filesystem, database, persistence, provider fetch, scheduler, wall clock, active-config mutation, model activation, recommendation, action, or O00 execution.

import {
  computeMemberDeterminismHashV1,
  deriveSemanticObjectIdV1,
} from "./canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_BINDING_PROFILE_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1,
} from "./external_formal_evidence_binding_profile_v1.js";

export const MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_CONFIG_PURPOSE_V1 =
  "MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_AUTHORITY_V1" as const;
export const MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1 =
  "SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY" as const;
export const MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_SCOPE_CLASS_V1 =
  "EXTERNAL_PUBLIC_RESEARCH_SCOPE" as const;
export const MCFT_CAP09_EXTERNAL_FORMAL_CONFIG_SELECTION_MODE_V1 =
  "EXPLICIT_REF_HASH_PIN_ONLY" as const;
export const MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1 =
  "MODEL_PRIOR_FROM_CAP08" as const;
export const MCFT_CAP09_EXTERNAL_FORMAL_FIELD_CALIBRATION_STATUS_V1 =
  "NOT_FIELD_CALIBRATED" as const;
export const MCFT_CAP09_EXTERNAL_FORMAL_COMPATIBILITY_TARGET_V1 =
  "CAP04_FROZEN_REPLAY_KERNEL_COMPATIBILITY_VIEW_V1" as const;

export const MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 = Object.freeze({
  tenant_id: "tenant_mcft_external",
  project_id: "project_mcft_cap09",
  group_id: "group_public_research",
  field_id: "field_kbs_mcse_t4r1",
  season_id: "season_2026_corn",
  zone_id: "zone_kbs_mcse_t4r1_crop_formal_v1",
});

export type ExternalFormalRuntimeConfigRoleV1 =
  | "A0_BOOTSTRAP"
  | "HOURLY_CAP04";

export type ExternalFormalRuntimeAuthorityRefV1 = {
  ref: string;
  hash: string;
};

export type ExternalFormalRuntimeConfigPayloadV1 = {
  config_purpose: typeof MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_CONFIG_PURPOSE_V1;
  config_selection_mode: typeof MCFT_CAP09_EXTERNAL_FORMAL_CONFIG_SELECTION_MODE_V1;
  config_role: ExternalFormalRuntimeConfigRoleV1;
  runtime_mode: typeof MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1;
  authority_scope_class: typeof MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_SCOPE_CLASS_V1;
  effective_logical_time: string;
  parent_runtime_config_ref: string | null;
  parent_runtime_config_hash: string | null;
  reality_binding_ref: string;
  reality_binding_hash: string;
  source_matrix_ref: string;
  source_matrix_hash: string;
  configuration_matrix_ref: string;
  configuration_matrix_hash: string;
  geometry_semantic_hash: string;
  formal_authorities: {
    site: ExternalFormalRuntimeAuthorityRefV1;
    reality: ExternalFormalRuntimeAuthorityRefV1;
    source_binding_matrix: ExternalFormalRuntimeAuthorityRefV1;
    crop_context: ExternalFormalRuntimeAuthorityRefV1;
    recovery: ExternalFormalRuntimeAuthorityRefV1;
    fresh_database: ExternalFormalRuntimeAuthorityRefV1;
  };
  evidence_binding_profile: {
    profile_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_BINDING_PROFILE_ID_V1;
    soil_moisture_binding_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1;
    observed_rainfall_binding_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1;
    historical_et0_binding_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1;
    future_weather_binding_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1;
    future_et0_binding_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1;
    soil_observation_operator_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1;
  };
  crop_stage_context_authority: {
    context_ref: string;
    context_hash: string;
    configuration_matrix_ref: string;
    configuration_matrix_hash: string;
  };
  model_prior: {
    authority_class: typeof MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1;
    field_calibration_status: typeof MCFT_CAP09_EXTERNAL_FORMAL_FIELD_CALIBRATION_STATUS_V1;
    source_ref: string;
    source_hash: string;
  };
  compatibility_execution_view: {
    target: typeof MCFT_CAP09_EXTERNAL_FORMAL_COMPATIBILITY_TARGET_V1;
    canonical_persistence_authorized: false;
    may_relabel_external_evidence: false;
  };
};

export type CompileExternalFormalRuntimeConfigInputV1 = {
  scope: typeof MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1;
  config_role: ExternalFormalRuntimeConfigRoleV1;
  effective_logical_time: string;
  created_at: string;
  parent_runtime_config_ref: string | null;
  parent_runtime_config_hash: string | null;
  reality_binding_ref: string;
  reality_binding_hash: string;
  source_matrix_ref: string;
  source_matrix_hash: string;
  configuration_matrix_ref: string;
  configuration_matrix_hash: string;
  geometry_semantic_hash: string;
  formal_authorities: ExternalFormalRuntimeConfigPayloadV1["formal_authorities"];
  crop_stage_context_authority: ExternalFormalRuntimeConfigPayloadV1["crop_stage_context_authority"];
  model_prior: Pick<ExternalFormalRuntimeConfigPayloadV1["model_prior"], "source_ref" | "source_hash">;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalHourV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text || !text.endsWith(":00:00.000Z")) {
    throw new Error(code);
  }
  return text;
}

function exactExternalScopeV1(value: Record<string, unknown>): void {
  for (const [key, expected] of Object.entries(MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1)) {
    if (value[key] !== expected) throw new Error(`EXTERNAL_FORMAL_RUNTIME_CONFIG_SCOPE_MISMATCH:${key}`);
  }
}

function authorityRefV1(value: unknown, code: string): ExternalFormalRuntimeAuthorityRefV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  const record = value as Record<string, unknown>;
  return {
    ref: requiredStringV1(record.ref, `${code}_REF_REQUIRED`),
    hash: requiredStringV1(record.hash, `${code}_HASH_REQUIRED`),
  };
}

export function validateExternalFormalRuntimeConfigPayloadV1(
  value: unknown,
): asserts value is ExternalFormalRuntimeConfigPayloadV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("EXTERNAL_FORMAL_RUNTIME_CONFIG_PAYLOAD_REQUIRED");
  }
  const payload = value as Record<string, unknown>;
  if (payload.config_purpose !== MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_CONFIG_PURPOSE_V1) throw new Error("EXTERNAL_FORMAL_RUNTIME_CONFIG_PURPOSE_MISMATCH");
  if (payload.config_selection_mode !== MCFT_CAP09_EXTERNAL_FORMAL_CONFIG_SELECTION_MODE_V1) throw new Error("EXTERNAL_FORMAL_RUNTIME_CONFIG_SELECTION_MODE_MISMATCH");
  if (payload.runtime_mode !== MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1) throw new Error("EXTERNAL_FORMAL_RUNTIME_MODE_MISMATCH");
  if (payload.authority_scope_class !== MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_SCOPE_CLASS_V1) throw new Error("EXTERNAL_FORMAL_RUNTIME_SCOPE_CLASS_MISMATCH");
  if (payload.config_role !== "A0_BOOTSTRAP" && payload.config_role !== "HOURLY_CAP04") throw new Error("EXTERNAL_FORMAL_RUNTIME_CONFIG_ROLE_INVALID");
  canonicalHourV1(payload.effective_logical_time, "EXTERNAL_FORMAL_RUNTIME_CONFIG_EFFECTIVE_TIME_INVALID");

  if (payload.config_role === "A0_BOOTSTRAP") {
    if (payload.parent_runtime_config_ref !== null || payload.parent_runtime_config_hash !== null) {
      throw new Error("EXTERNAL_FORMAL_A0_PARENT_CONFIG_FORBIDDEN");
    }
  } else {
    requiredStringV1(payload.parent_runtime_config_ref, "EXTERNAL_FORMAL_CAP04_PARENT_CONFIG_REF_REQUIRED");
    requiredStringV1(payload.parent_runtime_config_hash, "EXTERNAL_FORMAL_CAP04_PARENT_CONFIG_HASH_REQUIRED");
  }

  for (const field of [
    "reality_binding_ref", "reality_binding_hash", "source_matrix_ref", "source_matrix_hash",
    "configuration_matrix_ref", "configuration_matrix_hash", "geometry_semantic_hash",
  ]) requiredStringV1(payload[field], `EXTERNAL_FORMAL_RUNTIME_CONFIG_${field.toUpperCase()}_REQUIRED`);

  if (!payload.formal_authorities || typeof payload.formal_authorities !== "object" || Array.isArray(payload.formal_authorities)) {
    throw new Error("EXTERNAL_FORMAL_RUNTIME_AUTHORITIES_REQUIRED");
  }
  const authorities = payload.formal_authorities as Record<string, unknown>;
  for (const key of ["site", "reality", "source_binding_matrix", "crop_context", "recovery", "fresh_database"]) {
    authorityRefV1(authorities[key], `EXTERNAL_FORMAL_RUNTIME_AUTHORITY_${key.toUpperCase()}`);
  }

  if (!payload.evidence_binding_profile || typeof payload.evidence_binding_profile !== "object" || Array.isArray(payload.evidence_binding_profile)) {
    throw new Error("EXTERNAL_FORMAL_EVIDENCE_BINDING_PROFILE_REQUIRED");
  }
  const bindings = payload.evidence_binding_profile as Record<string, unknown>;
  const expectedBindings: Record<string, string> = {
    profile_id: MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_BINDING_PROFILE_ID_V1,
    soil_moisture_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
    observed_rainfall_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
    historical_et0_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
    future_weather_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
    future_et0_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
    soil_observation_operator_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1,
  };
  for (const [key, expected] of Object.entries(expectedBindings)) {
    if (bindings[key] !== expected) throw new Error(`EXTERNAL_FORMAL_EVIDENCE_BINDING_PROFILE_MISMATCH:${key}`);
  }

  if (!payload.crop_stage_context_authority || typeof payload.crop_stage_context_authority !== "object" || Array.isArray(payload.crop_stage_context_authority)) {
    throw new Error("EXTERNAL_FORMAL_CROP_CONTEXT_AUTHORITY_REQUIRED");
  }
  const crop = payload.crop_stage_context_authority as Record<string, unknown>;
  for (const field of ["context_ref", "context_hash", "configuration_matrix_ref", "configuration_matrix_hash"]) {
    requiredStringV1(crop[field], `EXTERNAL_FORMAL_CROP_CONTEXT_${field.toUpperCase()}_REQUIRED`);
  }
  if (crop.configuration_matrix_ref !== payload.configuration_matrix_ref
    || crop.configuration_matrix_hash !== payload.configuration_matrix_hash) {
    throw new Error("EXTERNAL_FORMAL_CROP_CONTEXT_CONFIGURATION_MATRIX_MISMATCH");
  }

  if (!payload.model_prior || typeof payload.model_prior !== "object" || Array.isArray(payload.model_prior)) {
    throw new Error("EXTERNAL_FORMAL_MODEL_PRIOR_REQUIRED");
  }
  const prior = payload.model_prior as Record<string, unknown>;
  if (prior.authority_class !== MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1) throw new Error("EXTERNAL_FORMAL_MODEL_PRIOR_CLASS_MISMATCH");
  if (prior.field_calibration_status !== MCFT_CAP09_EXTERNAL_FORMAL_FIELD_CALIBRATION_STATUS_V1) throw new Error("EXTERNAL_FORMAL_MODEL_PRIOR_CALIBRATION_MISMATCH");
  requiredStringV1(prior.source_ref, "EXTERNAL_FORMAL_MODEL_PRIOR_SOURCE_REF_REQUIRED");
  requiredStringV1(prior.source_hash, "EXTERNAL_FORMAL_MODEL_PRIOR_SOURCE_HASH_REQUIRED");

  if (!payload.compatibility_execution_view || typeof payload.compatibility_execution_view !== "object" || Array.isArray(payload.compatibility_execution_view)) {
    throw new Error("EXTERNAL_FORMAL_COMPATIBILITY_VIEW_POLICY_REQUIRED");
  }
  const compatibility = payload.compatibility_execution_view as Record<string, unknown>;
  if (compatibility.target !== MCFT_CAP09_EXTERNAL_FORMAL_COMPATIBILITY_TARGET_V1
    || compatibility.canonical_persistence_authorized !== false
    || compatibility.may_relabel_external_evidence !== false) {
    throw new Error("EXTERNAL_FORMAL_COMPATIBILITY_VIEW_POLICY_MISMATCH");
  }
}

export function compileExternalFormalRuntimeConfigV1(
  input: CompileExternalFormalRuntimeConfigInputV1,
): CanonicalObjectEnvelopeV1 {
  exactExternalScopeV1(input.scope as unknown as Record<string, unknown>);
  const logicalTime = canonicalHourV1(input.effective_logical_time, "EXTERNAL_FORMAL_RUNTIME_CONFIG_EFFECTIVE_TIME_INVALID");
  const createdAt = requiredStringV1(input.created_at, "EXTERNAL_FORMAL_RUNTIME_CONFIG_CREATED_AT_REQUIRED");
  if (!Number.isFinite(Date.parse(createdAt)) || new Date(Date.parse(createdAt)).toISOString() !== createdAt) {
    throw new Error("EXTERNAL_FORMAL_RUNTIME_CONFIG_CREATED_AT_INVALID");
  }

  const payload: ExternalFormalRuntimeConfigPayloadV1 = {
    config_purpose: MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_CONFIG_PURPOSE_V1,
    config_selection_mode: MCFT_CAP09_EXTERNAL_FORMAL_CONFIG_SELECTION_MODE_V1,
    config_role: input.config_role,
    runtime_mode: MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
    authority_scope_class: MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_SCOPE_CLASS_V1,
    effective_logical_time: logicalTime,
    parent_runtime_config_ref: input.parent_runtime_config_ref,
    parent_runtime_config_hash: input.parent_runtime_config_hash,
    reality_binding_ref: requiredStringV1(input.reality_binding_ref, "EXTERNAL_FORMAL_REALITY_BINDING_REF_REQUIRED"),
    reality_binding_hash: requiredStringV1(input.reality_binding_hash, "EXTERNAL_FORMAL_REALITY_BINDING_HASH_REQUIRED"),
    source_matrix_ref: requiredStringV1(input.source_matrix_ref, "EXTERNAL_FORMAL_SOURCE_MATRIX_REF_REQUIRED"),
    source_matrix_hash: requiredStringV1(input.source_matrix_hash, "EXTERNAL_FORMAL_SOURCE_MATRIX_HASH_REQUIRED"),
    configuration_matrix_ref: requiredStringV1(input.configuration_matrix_ref, "EXTERNAL_FORMAL_CONFIGURATION_MATRIX_REF_REQUIRED"),
    configuration_matrix_hash: requiredStringV1(input.configuration_matrix_hash, "EXTERNAL_FORMAL_CONFIGURATION_MATRIX_HASH_REQUIRED"),
    geometry_semantic_hash: requiredStringV1(input.geometry_semantic_hash, "EXTERNAL_FORMAL_GEOMETRY_HASH_REQUIRED"),
    formal_authorities: {
      site: authorityRefV1(input.formal_authorities.site, "EXTERNAL_FORMAL_SITE_AUTHORITY"),
      reality: authorityRefV1(input.formal_authorities.reality, "EXTERNAL_FORMAL_REALITY_AUTHORITY"),
      source_binding_matrix: authorityRefV1(input.formal_authorities.source_binding_matrix, "EXTERNAL_FORMAL_SOURCE_AUTHORITY"),
      crop_context: authorityRefV1(input.formal_authorities.crop_context, "EXTERNAL_FORMAL_CROP_AUTHORITY"),
      recovery: authorityRefV1(input.formal_authorities.recovery, "EXTERNAL_FORMAL_RECOVERY_AUTHORITY"),
      fresh_database: authorityRefV1(input.formal_authorities.fresh_database, "EXTERNAL_FORMAL_DATABASE_AUTHORITY"),
    },
    evidence_binding_profile: {
      profile_id: MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_BINDING_PROFILE_ID_V1,
      soil_moisture_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
      observed_rainfall_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
      historical_et0_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
      future_weather_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
      future_et0_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
      soil_observation_operator_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1,
    },
    crop_stage_context_authority: {
      context_ref: requiredStringV1(input.crop_stage_context_authority.context_ref, "EXTERNAL_FORMAL_CROP_CONTEXT_REF_REQUIRED"),
      context_hash: requiredStringV1(input.crop_stage_context_authority.context_hash, "EXTERNAL_FORMAL_CROP_CONTEXT_HASH_REQUIRED"),
      configuration_matrix_ref: requiredStringV1(input.crop_stage_context_authority.configuration_matrix_ref, "EXTERNAL_FORMAL_CROP_CONFIGURATION_MATRIX_REF_REQUIRED"),
      configuration_matrix_hash: requiredStringV1(input.crop_stage_context_authority.configuration_matrix_hash, "EXTERNAL_FORMAL_CROP_CONFIGURATION_MATRIX_HASH_REQUIRED"),
    },
    model_prior: {
      authority_class: MCFT_CAP09_EXTERNAL_FORMAL_MODEL_PARAMETER_AUTHORITY_V1,
      field_calibration_status: MCFT_CAP09_EXTERNAL_FORMAL_FIELD_CALIBRATION_STATUS_V1,
      source_ref: requiredStringV1(input.model_prior.source_ref, "EXTERNAL_FORMAL_MODEL_PRIOR_SOURCE_REF_REQUIRED"),
      source_hash: requiredStringV1(input.model_prior.source_hash, "EXTERNAL_FORMAL_MODEL_PRIOR_SOURCE_HASH_REQUIRED"),
    },
    compatibility_execution_view: {
      target: MCFT_CAP09_EXTERNAL_FORMAL_COMPATIBILITY_TARGET_V1,
      canonical_persistence_authorized: false,
      may_relabel_external_evidence: false,
    },
  };
  validateExternalFormalRuntimeConfigPayloadV1(payload);
  const identityBasis = {
    object_type: "twin_runtime_config_v1",
    scope: input.scope,
    logical_time: logicalTime,
    payload,
  };
  const sourceRefs = [
    ...(input.parent_runtime_config_ref ? [input.parent_runtime_config_ref] : []),
    payload.reality_binding_ref,
    payload.source_matrix_ref,
    payload.configuration_matrix_ref,
    payload.formal_authorities.site.ref,
    payload.formal_authorities.reality.ref,
    payload.formal_authorities.source_binding_matrix.ref,
    payload.formal_authorities.crop_context.ref,
    payload.formal_authorities.recovery.ref,
    payload.formal_authorities.fresh_database.ref,
    payload.model_prior.source_ref,
  ].sort();
  const config: CanonicalObjectEnvelopeV1 = {
    object_id: deriveSemanticObjectIdV1("external_formal_runtime_config", identityBasis),
    object_type: "twin_runtime_config_v1",
    schema_version: "v1",
    ...input.scope,
    logical_time: logicalTime,
    as_of: logicalTime,
    source_refs: sourceRefs,
    evidence_refs: [],
    runtime_config_ref: null,
    runtime_config_hash: null,
    idempotency_key: deriveSemanticObjectIdV1("external_formal_runtime_config_key", identityBasis),
    determinism_hash: "",
    limitations: [
      "EXTERNAL_PUBLIC_RESEARCH_SCOPE",
      "MODEL_PRIOR_FROM_CAP08",
      "NOT_FIELD_CALIBRATED",
      "KBS_SOIL_NEAR_SITE_POINT_SUPPORT_PARTIAL_ROOT_ZONE_REPRESENTATIVENESS",
      "NO_RECOMMENDATION",
      "NO_ACTION_AUTHORITY",
      "NO_MODEL_ACTIVATION",
      "FORMAL_QUALIFICATION_ONLY",
    ],
    created_at: createdAt,
    payload: payload as unknown as Record<string, unknown>,
  };
  config.determinism_hash = computeMemberDeterminismHashV1(config as unknown as Record<string, unknown>);
  return config;
}
