// Purpose: freeze the MCFT-CAP-08.S5 exact 24-Residual, 16/8 Calibration/Holdout, Candidate and Shadow adapter boundary.
// Boundary: contracts and deterministic validation only; no repository search, persistence, calibration math, Model Activation, active Config, State, checkpoint, route, scheduler, filesystem, environment or network authority.

import type { Cap04ForecastPointV1 } from "./forecast_scenario_contracts_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import type { Cap05ForecastResidualEnvelopeV1 } from "./forecast_observation_residual_v1.js";
import type { ResolvedCap04ExecutionConfigV1 } from "./runtime_config_execution_view_v1.js";
import { CAP08_S1_RUNTIME_START_V1 } from "./cap08_phase_engine_contracts_v1.js";
import type {
  Cap06CalibrationCaseSourceV1,
  Cap06RealityScopeV1,
} from "../calibration/contracts_v1.js";
import type {
  HourlyWaterBalanceConfigV1,
  HourlyWaterBalanceInputV1,
} from "../soil_water/hourly_water_balance_v1.js";

export const CAP08_S5_SERVICE_ID_V1 = "MCFT_CAP_08_S5_RESIDUAL_CALIBRATION_SHADOW_SERVICE_V1" as const;
export const CAP08_S5_RESIDUAL_OBLIGATION_COUNT_V1 = 24 as const;
export const CAP08_S5_CALIBRATION_COUNT_V1 = 16 as const;
export const CAP08_S5_HOLDOUT_COUNT_V1 = 8 as const;
export const CAP08_S5_EXPECTED_CANDIDATE_PARAMETER_V1 = "0.034000" as const;
export const CAP08_S5_PHASE_ENGINE_CONTRACT_DIGEST_V1 =
  "sha256:41428596e893112483a8695ccd7bc28dc19dee35c2c3bf29e78395a86133d466" as const;
export const CAP08_S5_REQUIRED_S4_EFFECTIVE_STATUS_V1 =
  "S4_LATE_EVIDENCE_APPEND_FORWARD_IMPLEMENTED_EFFECTIVE" as const;
export const CAP08_S5_REQUIRED_S4_NEXT_SLICE_V1 = "S5" as const;
export const CAP08_S5_REQUIRED_S4_STATUS_CONTEXT_V1 =
  "mcft-cap-08/s4-exact-sha-attestation" as const;
export const CAP08_S5_REQUIRED_S4_RETENTION_CLASS_V1 = "R1_180_DAYS" as const;
export const CAP08_S5_ORDINARY_ASSIMILATION_ORDERS_V1 = [2, 3, 4, 10, 22] as const;

export type Cap08S5PredecessorEvidenceV1 = {
  effective_status: typeof CAP08_S5_REQUIRED_S4_EFFECTIVE_STATUS_V1;
  effective_next_slice: typeof CAP08_S5_REQUIRED_S4_NEXT_SLICE_V1;
  status_context: typeof CAP08_S5_REQUIRED_S4_STATUS_CONTEXT_V1;
  retention_class: typeof CAP08_S5_REQUIRED_S4_RETENTION_CLASS_V1;
  merge_subject_sha: string;
  candidate_head_sha: string;
  candidate_tree_sha: string;
  merge_tree_sha: string;
  candidate_to_merge_tree_delta: 0;
  exact_sha_workflow_run_id: string;
  artifact_id: string;
  artifact_digest: string;
  semantic_artifact_digest: string;
  artifact_readback_verified: true;
};

export type Cap08S5ObservationV1 = {
  fvo_id: string;
  source_record_id: string;
  source_record_hash: string;
  observed_at: string;
  available_to_runtime_at: string;
  quality_status: "PASS" | "LIMITED";
  canonical_value: string;
  canonical_unit: "fraction";
};

export type Cap08S5ResidualObligationV1 = {
  residual_id: string;
  residual_order: number;
  commit_phase: string;
  forecast_ref: string;
  forecast_hash: string;
  observation: Cap08S5ObservationV1;
  assimilation_update_ref: string | null;
  assimilation_update_hash: string | null;
};

export type Cap08S5ReplayAuthorityV1 = {
  residual_ref: string;
  source_forecast_point: Cap04ForecastPointV1;
  source_posterior: CanonicalObjectEnvelopeV1;
  resolved_execution_config: ResolvedCap04ExecutionConfigV1;
  input_without_config: Omit<HourlyWaterBalanceInputV1, "config">;
  base_config: HourlyWaterBalanceConfigV1;
};

export type Cap08S5ResidualPersistenceStatusV1 =
  | "INSERTED"
  | "EXISTING_IDEMPOTENT_SUCCESS"
  | "EXISTING_RECOVERED";

export type Cap08S5ResolvedObligationV1 = {
  obligation: Cap08S5ResidualObligationV1;
  residual: Cap05ForecastResidualEnvelopeV1;
  residual_fact_id: string;
  residual_persistence_status: Cap08S5ResidualPersistenceStatusV1;
  case_source: Cap06CalibrationCaseSourceV1 & {
    source_runtime_config_logical_time: string;
  };
  replay_authority: Cap08S5ReplayAuthorityV1;
};

export type Cap08S5ExactSourcePortV1 = {
  resolveExactObligation(input: {
    scope: Cap06RealityScopeV1;
    formal_run_id: string;
    obligation: Cap08S5ResidualObligationV1;
    created_at: string;
  }): Promise<Cap08S5ResolvedObligationV1>;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalInstantV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function expectedIdV1(prefix: string, index: number): string {
  return `${prefix}-${String(index).padStart(2, "0")}`;
}

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function expectedCommitPhaseV1(order: number): string {
  if (order === 1 || order === 16) return "T16";
  if (order === 24) return "G00";
  return `T${String(order).padStart(2, "0")}`;
}

function ordinaryAssimilationRequiredV1(order: number): boolean {
  return (CAP08_S5_ORDINARY_ASSIMILATION_ORDERS_V1 as readonly number[]).includes(order);
}

export function validateCap08S5PredecessorEvidenceV1(
  value: Cap08S5PredecessorEvidenceV1,
): Cap08S5PredecessorEvidenceV1 {
  if (value.effective_status !== CAP08_S5_REQUIRED_S4_EFFECTIVE_STATUS_V1
    || value.effective_next_slice !== CAP08_S5_REQUIRED_S4_NEXT_SLICE_V1
    || value.status_context !== CAP08_S5_REQUIRED_S4_STATUS_CONTEXT_V1
    || value.retention_class !== CAP08_S5_REQUIRED_S4_RETENTION_CLASS_V1
    || value.candidate_to_merge_tree_delta !== 0
    || value.artifact_readback_verified !== true) {
    throw new Error("CAP08_S5_S4_PREDECESSOR_EFFECTIVENESS_REQUIRED");
  }
  for (const [field, fieldValue] of Object.entries({
    merge_subject_sha: value.merge_subject_sha,
    candidate_head_sha: value.candidate_head_sha,
    candidate_tree_sha: value.candidate_tree_sha,
    merge_tree_sha: value.merge_tree_sha,
    exact_sha_workflow_run_id: value.exact_sha_workflow_run_id,
    artifact_id: value.artifact_id,
    artifact_digest: value.artifact_digest,
    semantic_artifact_digest: value.semantic_artifact_digest,
  })) {
    requiredStringV1(fieldValue, `CAP08_S5_S4_PREDECESSOR_${field.toUpperCase()}_REQUIRED`);
  }
  if (value.candidate_tree_sha !== value.merge_tree_sha) {
    throw new Error("CAP08_S5_S4_PREDECESSOR_TREE_MISMATCH");
  }
  return structuredClone(value);
}

export function validateCap08S5ResidualObligationsV1(
  obligations: readonly Cap08S5ResidualObligationV1[],
): Cap08S5ResidualObligationV1[] {
  if (!Array.isArray(obligations) || obligations.length !== CAP08_S5_RESIDUAL_OBLIGATION_COUNT_V1) {
    throw new Error(`CAP08_S5_RESIDUAL_OBLIGATION_COUNT_REQUIRED:${obligations?.length ?? 0}`);
  }
  const normalized = obligations.map((item, index) => {
    const order = index + 1;
    if (item.residual_order !== order) throw new Error(`CAP08_S5_RESIDUAL_ORDER_MISMATCH:${order}`);
    if (requiredStringV1(item.residual_id, "CAP08_S5_RESIDUAL_ID_REQUIRED") !== expectedIdV1("R", order)) {
      throw new Error(`CAP08_S5_RESIDUAL_ID_MISMATCH:${order}`);
    }
    if (requiredStringV1(item.observation.fvo_id, "CAP08_S5_FVO_ID_REQUIRED") !== expectedIdV1("FVO", order)) {
      throw new Error(`CAP08_S5_FVO_ID_MISMATCH:${order}`);
    }
    if (item.observation.source_record_id !== item.observation.fvo_id) {
      throw new Error(`CAP08_S5_FVO_SOURCE_ID_MISMATCH:${order}`);
    }
    if (item.observation.canonical_unit !== "fraction") {
      throw new Error(`CAP08_S5_FVO_UNIT_MISMATCH:${order}`);
    }
    const expectedQuality = order === 3 ? "LIMITED" : "PASS";
    if (item.observation.quality_status !== expectedQuality) {
      throw new Error(`CAP08_S5_FVO_QUALITY_MISMATCH:${order}`);
    }
    const observedAt = canonicalInstantV1(
      item.observation.observed_at,
      `CAP08_S5_FVO_OBSERVED_AT_INVALID:${order}`,
    );
    const availableAt = canonicalInstantV1(
      item.observation.available_to_runtime_at,
      `CAP08_S5_FVO_AVAILABLE_AT_INVALID:${order}`,
    );
    const expectedObservedAt = addHoursV1(CAP08_S1_RUNTIME_START_V1, order);
    const expectedAvailableAt = order === 1
      ? addHoursV1(CAP08_S1_RUNTIME_START_V1, 16)
      : expectedObservedAt;
    if (observedAt !== expectedObservedAt || availableAt !== expectedAvailableAt) {
      throw new Error(`CAP08_S5_FVO_DUAL_TIME_MISMATCH:${order}`);
    }
    requiredStringV1(item.observation.source_record_hash, `CAP08_S5_FVO_HASH_REQUIRED:${order}`);
    requiredStringV1(item.observation.canonical_value, `CAP08_S5_FVO_VALUE_REQUIRED:${order}`);
    requiredStringV1(item.forecast_ref, `CAP08_S5_FORECAST_REF_REQUIRED:${order}`);
    requiredStringV1(item.forecast_hash, `CAP08_S5_FORECAST_HASH_REQUIRED:${order}`);
    if (item.commit_phase !== expectedCommitPhaseV1(order)) {
      throw new Error(`CAP08_S5_COMMIT_PHASE_MISMATCH:${order}`);
    }
    if ((item.assimilation_update_ref === null) !== (item.assimilation_update_hash === null)) {
      throw new Error(`CAP08_S5_ASSIMILATION_IDENTITY_PARTIAL:${order}`);
    }
    const ordinaryRequired = ordinaryAssimilationRequiredV1(order);
    if (ordinaryRequired !== (item.assimilation_update_ref !== null)) {
      throw new Error(`CAP08_S5_ASSIMILATION_ROLE_MISMATCH:${order}`);
    }
    return structuredClone(item);
  });
  if (new Set(normalized.map((item) => item.forecast_ref)).size !== CAP08_S5_RESIDUAL_OBLIGATION_COUNT_V1) {
    throw new Error("CAP08_S5_FORECAST_REFS_NOT_UNIQUE");
  }
  if (new Set(normalized.map((item) => item.observation.source_record_id)).size !== CAP08_S5_RESIDUAL_OBLIGATION_COUNT_V1) {
    throw new Error("CAP08_S5_FVO_REFS_NOT_UNIQUE");
  }
  return normalized;
}
