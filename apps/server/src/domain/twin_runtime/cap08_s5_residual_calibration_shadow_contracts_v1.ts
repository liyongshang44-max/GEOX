// Purpose: freeze deterministic MCFT-CAP-08.S5 Residual, Calibration Candidate, Shadow Evaluation and completion identities.
// Boundary: pure contracts and validation only; no database, persistence, replay execution, route, scheduler, Model Activation or active-config authority.

import { deriveSemanticObjectIdV1, semanticHashV1 } from "./canonical_identity_v1.js";
import type { Cap05ForecastResidualEnvelopeV1 } from "./forecast_observation_residual_v1.js";

export const CAP08_S5_CONTRACT_ID_V1 = "MCFT-CAP-08.S5-RESIDUAL-CALIBRATION-SHADOW-V1" as const;
export const CAP08_S5_RESIDUAL_SET_SCHEMA_VERSION_V1 = "geox_mcft_cap08_s5_residual_set_authority_v1" as const;
export const CAP08_S5_COMPLETION_SCHEMA_VERSION_V1 = "geox_mcft_cap08_s5_completion_authority_v1" as const;
export const CAP08_S5_AUTHORITY_KIND_V1 = "REALITY_BINDING" as const;
export const CAP08_S5_RESIDUAL_COUNT_V1 = 24 as const;
export const CAP08_S5_CALIBRATION_COUNT_V1 = 16 as const;
export const CAP08_S5_HOLDOUT_COUNT_V1 = 8 as const;
export const CAP08_S5_EXPECTED_PARAMETER_V1 = "0.034000" as const;
export const CAP08_S5_BASE_PARAMETER_V1 = "0.030000" as const;
export const CAP08_S5_GRID_POINT_COUNT_V1 = 21 as const;

export type Cap08S5ScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
};

export type Cap08S5BindingV1 = { ref: string; hash: string };

export type Cap08S5ResidualBindingV1 = Cap08S5BindingV1 & {
  residual_id: string;
  forecast_id: string;
  observation_id: string;
  forecast_target_time: string;
};

export type Cap08S5ResidualSetIdentityInputV1 = {
  formal_run_id: string;
  scope: Cap08S5ScopeV1;
  lineage_id: string;
  revision_id: string;
  s3_completion: Cap08S5BindingV1;
  s4_append_forward: Cap08S5BindingV1;
  phase_engine_contract_digest: string;
  phase_engine_source_digest: string;
};

export type Cap08S5ResidualSetAuthorityV1 = {
  schema_version: typeof CAP08_S5_RESIDUAL_SET_SCHEMA_VERSION_V1;
  contract_id: typeof CAP08_S5_CONTRACT_ID_V1;
  authority_kind: typeof CAP08_S5_AUTHORITY_KIND_V1;
  authority_ref: string;
  idempotency_key: string;
  formal_run_id: string;
  scope: Cap08S5ScopeV1;
  lineage_id: string;
  revision_id: string;
  identity_input: Cap08S5ResidualSetIdentityInputV1;
  ordered_residuals: Cap08S5ResidualBindingV1[];
  calibration_residual_refs: string[];
  holdout_residual_refs: string[];
  r01_commit_logical_time: string;
  r17_forecast_source: "S4_CORRECTED_T16_FORECAST";
  future_leakage_count: 0;
  residual_count: 24;
  phase_engine_contract_digest: string;
  phase_engine_source_digest: string;
  production_runtime_source_authorized: false;
  model_activation_count: 0;
  active_config_switch_count: 0;
  mcft_cap_09_authorized: false;
  determinism_hash: string;
};

export type Cap08S5CompletionAuthorityV1 = {
  schema_version: typeof CAP08_S5_COMPLETION_SCHEMA_VERSION_V1;
  contract_id: typeof CAP08_S5_CONTRACT_ID_V1;
  authority_kind: typeof CAP08_S5_AUTHORITY_KIND_V1;
  authority_ref: string;
  idempotency_key: string;
  formal_run_id: string;
  scope: Cap08S5ScopeV1;
  lineage_id: string;
  revision_id: string;
  residual_set: Cap08S5BindingV1;
  calibration_candidate: Cap08S5BindingV1;
  shadow_evaluation: Cap08S5BindingV1;
  candidate_parameter_value: typeof CAP08_S5_EXPECTED_PARAMETER_V1;
  residual_count: 24;
  calibration_case_count: 16;
  holdout_case_count: 8;
  calibration_candidate_count: 1;
  shadow_evaluation_count: 1;
  grid_point_count: 21;
  future_leakage_count: 0;
  model_activation_count: 0;
  active_config_switch_count: 0;
  runtime_parameter_change_count: 0;
  state_pointer_delta: 0;
  checkpoint_pointer_delta: 0;
  completed_rerun_write_delta: 0;
  phase_engine_contract_digest: string;
  phase_engine_source_digest: string;
  slice_acceptance_only: true;
  final_formal_run_id: null;
  production_runtime_source_authorized: false;
  s6_authorized: false;
  mcft_cap_09_authorized: false;
  determinism_hash: string;
};

function req(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}
function digest(value: unknown, code: string): string {
  const text = req(value, code);
  if (!/^sha256:[0-9a-f]{64}$/.test(text)) throw new Error(code);
  return text;
}
function scope(value: Cap08S5ScopeV1): Cap08S5ScopeV1 {
  return {
    tenant_id: req(value?.tenant_id, "CAP08_S5_SCOPE_TENANT_REQUIRED"),
    project_id: req(value?.project_id, "CAP08_S5_SCOPE_PROJECT_REQUIRED"),
    group_id: req(value?.group_id, "CAP08_S5_SCOPE_GROUP_REQUIRED"),
    field_id: req(value?.field_id, "CAP08_S5_SCOPE_FIELD_REQUIRED"),
    season_id: req(value?.season_id, "CAP08_S5_SCOPE_SEASON_REQUIRED"),
    zone_id: req(value?.zone_id, "CAP08_S5_SCOPE_ZONE_REQUIRED"),
  };
}
function binding(value: Cap08S5BindingV1, code: string): Cap08S5BindingV1 {
  return { ref: req(value?.ref, `${code}_REF_REQUIRED`), hash: digest(value?.hash, `${code}_HASH_REQUIRED`) };
}
function residualId(index: number): string { return `R-${String(index).padStart(2, "0")}`; }
function fvoId(index: number): string { return `FVO-${String(index).padStart(2, "0")}`; }

export function deriveCap08S5ResidualSetIdentityV1(raw: Cap08S5ResidualSetIdentityInputV1): {
  identity_input: Cap08S5ResidualSetIdentityInputV1;
  authority_ref: string;
  idempotency_key: string;
} {
  const identity_input: Cap08S5ResidualSetIdentityInputV1 = {
    formal_run_id: req(raw.formal_run_id, "CAP08_S5_FORMAL_RUN_REQUIRED"),
    scope: scope(raw.scope),
    lineage_id: req(raw.lineage_id, "CAP08_S5_LINEAGE_REQUIRED"),
    revision_id: req(raw.revision_id, "CAP08_S5_REVISION_REQUIRED"),
    s3_completion: binding(raw.s3_completion, "CAP08_S5_S3_COMPLETION"),
    s4_append_forward: binding(raw.s4_append_forward, "CAP08_S5_S4_APPEND_FORWARD"),
    phase_engine_contract_digest: digest(raw.phase_engine_contract_digest, "CAP08_S5_PHASE_CONTRACT_REQUIRED"),
    phase_engine_source_digest: digest(raw.phase_engine_source_digest, "CAP08_S5_PHASE_SOURCE_REQUIRED"),
  };
  const identityHash = semanticHashV1(identity_input);
  return {
    identity_input,
    authority_ref: deriveSemanticObjectIdV1("cap08_s5_residual_set_authority", { identity_hash: identityHash }),
    idempotency_key: deriveSemanticObjectIdV1("cap08_s5_residual_set_key", { identity_hash: identityHash }),
  };
}

export function validateCap08S5ResidualSetAuthorityV1(input: {
  authority: Cap08S5ResidualSetAuthorityV1;
  residuals: readonly Cap05ForecastResidualEnvelopeV1[];
}): void {
  const a = input.authority;
  const identity = deriveCap08S5ResidualSetIdentityV1(a.identity_input);
  if (a.schema_version !== CAP08_S5_RESIDUAL_SET_SCHEMA_VERSION_V1
    || a.contract_id !== CAP08_S5_CONTRACT_ID_V1
    || a.authority_kind !== CAP08_S5_AUTHORITY_KIND_V1
    || a.authority_ref !== identity.authority_ref
    || a.idempotency_key !== identity.idempotency_key) throw new Error("CAP08_S5_RESIDUAL_AUTHORITY_HEADER_MISMATCH");
  if (a.formal_run_id !== identity.identity_input.formal_run_id
    || semanticHashV1(a.scope) !== semanticHashV1(identity.identity_input.scope)
    || a.lineage_id !== identity.identity_input.lineage_id
    || a.revision_id !== identity.identity_input.revision_id) throw new Error("CAP08_S5_RESIDUAL_AUTHORITY_IDENTITY_MISMATCH");
  if (input.residuals.length !== CAP08_S5_RESIDUAL_COUNT_V1
    || a.ordered_residuals.length !== CAP08_S5_RESIDUAL_COUNT_V1) throw new Error("CAP08_S5_RESIDUAL_COUNT_MISMATCH");
  for (let index = 0; index < CAP08_S5_RESIDUAL_COUNT_V1; index += 1) {
    const expectedResidualId = residualId(index + 1);
    const expectedFvoId = fvoId(index + 1);
    const object = input.residuals[index];
    const declared = a.ordered_residuals[index];
    if (!object || !declared
      || declared.residual_id !== expectedResidualId
      || declared.observation_id !== expectedFvoId
      || declared.ref !== object.object_id
      || declared.hash !== object.determinism_hash
      || declared.forecast_target_time !== object.payload.forecast_target_time
      || declared.forecast_id !== object.payload.forecast_run_ref
      || object.payload.actual_observation_ref !== expectedFvoId) {
      throw new Error(`CAP08_S5_RESIDUAL_ORDER_OR_BINDING_MISMATCH:${expectedResidualId}`);
    }
  }
  const calibrationRefs = a.ordered_residuals.slice(0, 16).map((item) => item.ref);
  const holdoutRefs = a.ordered_residuals.slice(16).map((item) => item.ref);
  if (semanticHashV1(a.calibration_residual_refs) !== semanticHashV1(calibrationRefs)
    || semanticHashV1(a.holdout_residual_refs) !== semanticHashV1(holdoutRefs)
    || new Set([...calibrationRefs, ...holdoutRefs]).size !== 24) {
    throw new Error("CAP08_S5_RESIDUAL_WINDOW_BINDING_MISMATCH");
  }
  if (a.r17_forecast_source !== "S4_CORRECTED_T16_FORECAST"
    || a.future_leakage_count !== 0
    || a.residual_count !== 24
    || a.production_runtime_source_authorized !== false
    || a.model_activation_count !== 0
    || a.active_config_switch_count !== 0
    || a.mcft_cap_09_authorized !== false) throw new Error("CAP08_S5_RESIDUAL_AUTHORITY_BOUNDARY_MISMATCH");
  const { determinism_hash: _hash, ...basis } = a;
  if (a.determinism_hash !== semanticHashV1(basis)) throw new Error("CAP08_S5_RESIDUAL_AUTHORITY_HASH_MISMATCH");
}

export function buildCap08S5CompletionAuthorityV1(input: Omit<Cap08S5CompletionAuthorityV1,
  "schema_version" | "contract_id" | "authority_kind" | "authority_ref" | "idempotency_key" | "determinism_hash">): Cap08S5CompletionAuthorityV1 {
  const semantic = {
    schema_version: CAP08_S5_COMPLETION_SCHEMA_VERSION_V1,
    contract_id: CAP08_S5_CONTRACT_ID_V1,
    authority_kind: CAP08_S5_AUTHORITY_KIND_V1,
    ...structuredClone(input),
  };
  const authority_ref = deriveSemanticObjectIdV1("cap08_s5_completion_authority", {
    formal_run_id: semantic.formal_run_id,
    scope: semantic.scope,
    residual_set: semantic.residual_set,
    calibration_candidate: semantic.calibration_candidate,
    shadow_evaluation: semantic.shadow_evaluation,
  });
  const idempotency_key = deriveSemanticObjectIdV1("cap08_s5_completion_key", { authority_ref });
  const basis = { ...semantic, authority_ref, idempotency_key };
  const result: Cap08S5CompletionAuthorityV1 = { ...basis, determinism_hash: semanticHashV1(basis) };
  validateCap08S5CompletionAuthorityV1(result);
  return result;
}

export function validateCap08S5CompletionAuthorityV1(a: Cap08S5CompletionAuthorityV1): void {
  if (a.schema_version !== CAP08_S5_COMPLETION_SCHEMA_VERSION_V1
    || a.contract_id !== CAP08_S5_CONTRACT_ID_V1
    || a.authority_kind !== CAP08_S5_AUTHORITY_KIND_V1) throw new Error("CAP08_S5_COMPLETION_HEADER_MISMATCH");
  scope(a.scope);
  binding(a.residual_set, "CAP08_S5_COMPLETION_RESIDUAL_SET");
  binding(a.calibration_candidate, "CAP08_S5_COMPLETION_CANDIDATE");
  binding(a.shadow_evaluation, "CAP08_S5_COMPLETION_SHADOW");
  if (a.candidate_parameter_value !== CAP08_S5_EXPECTED_PARAMETER_V1
    || a.residual_count !== 24 || a.calibration_case_count !== 16 || a.holdout_case_count !== 8
    || a.calibration_candidate_count !== 1 || a.shadow_evaluation_count !== 1 || a.grid_point_count !== 21
    || a.future_leakage_count !== 0 || a.model_activation_count !== 0 || a.active_config_switch_count !== 0
    || a.runtime_parameter_change_count !== 0 || a.state_pointer_delta !== 0 || a.checkpoint_pointer_delta !== 0
    || a.completed_rerun_write_delta !== 0 || a.slice_acceptance_only !== true || a.final_formal_run_id !== null
    || a.production_runtime_source_authorized !== false || a.s6_authorized !== false || a.mcft_cap_09_authorized !== false) {
    throw new Error("CAP08_S5_COMPLETION_CARDINALITY_OR_BOUNDARY_MISMATCH");
  }
  digest(a.phase_engine_contract_digest, "CAP08_S5_COMPLETION_PHASE_CONTRACT_REQUIRED");
  digest(a.phase_engine_source_digest, "CAP08_S5_COMPLETION_PHASE_SOURCE_REQUIRED");
  const { determinism_hash: _hash, ...basis } = a;
  if (a.determinism_hash !== semanticHashV1(basis)) throw new Error("CAP08_S5_COMPLETION_HASH_MISMATCH");
}
