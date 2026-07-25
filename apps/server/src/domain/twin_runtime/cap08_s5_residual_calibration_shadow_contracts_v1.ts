// Purpose: freeze the MCFT-CAP-08.S5 exact 24-Residual, 16/8 Calibration/Holdout, Candidate and Shadow adapter boundary.
// Boundary: contracts and deterministic validation only; no repository search, persistence, calibration math, Model Activation, active Config, State, checkpoint, route, scheduler, filesystem, environment or network authority.

import type { Cap04ForecastPointV1 } from "./forecast_scenario_contracts_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import type { Cap05ForecastResidualEnvelopeV1 } from "./forecast_observation_residual_v1.js";
import type { ResolvedCap04ExecutionConfigV1 } from "./runtime_config_execution_view_v1.js";
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

export type Cap08S5ResolvedObligationV1 = {
  obligation: Cap08S5ResidualObligationV1;
  residual: Cap05ForecastResidualEnvelopeV1;
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
    if (item.observation.quality_status !== "PASS" && item.observation.quality_status !== "LIMITED") {
      throw new Error(`CAP08_S5_FVO_QUALITY_INVALID:${order}`);
    }
    canonicalInstantV1(item.observation.observed_at, `CAP08_S5_FVO_OBSERVED_AT_INVALID:${order}`);
    canonicalInstantV1(item.observation.available_to_runtime_at, `CAP08_S5_FVO_AVAILABLE_AT_INVALID:${order}`);
    requiredStringV1(item.observation.source_record_hash, `CAP08_S5_FVO_HASH_REQUIRED:${order}`);
    requiredStringV1(item.observation.canonical_value, `CAP08_S5_FVO_VALUE_REQUIRED:${order}`);
    requiredStringV1(item.forecast_ref, `CAP08_S5_FORECAST_REF_REQUIRED:${order}`);
    requiredStringV1(item.forecast_hash, `CAP08_S5_FORECAST_HASH_REQUIRED:${order}`);
    requiredStringV1(item.commit_phase, `CAP08_S5_COMMIT_PHASE_REQUIRED:${order}`);
    if ((item.assimilation_update_ref === null) !== (item.assimilation_update_hash === null)) {
      throw new Error(`CAP08_S5_ASSIMILATION_IDENTITY_PARTIAL:${order}`);
    }
    return structuredClone(item);
  });
  if (new Set(normalized.map((item) => item.forecast_ref)).size !== CAP08_S5_RESIDUAL_OBLIGATION_COUNT_V1) {
    throw new Error("CAP08_S5_FORECAST_REFS_NOT_UNIQUE");
  }
  if (new Set(normalized.map((item) => item.observation.source_record_id)).size !== CAP08_S5_RESIDUAL_OBLIGATION_COUNT_V1) {
    throw new Error("CAP08_S5_FVO_REFS_NOT_UNIQUE");
  }
  if (normalized[0].commit_phase !== "T16" || normalized[15].commit_phase !== "T16") {
    throw new Error("CAP08_S5_T16_R01_R16_COMMIT_REQUIRED");
  }
  if (normalized[23].commit_phase !== "G00") throw new Error("CAP08_S5_R24_G00_COMMIT_REQUIRED");
  return normalized;
}
