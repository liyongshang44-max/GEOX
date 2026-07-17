// Purpose: orchestrate the authorized MCFT-CAP-06 S5 exact 16-case calibration compute, Candidate D commit and canonical readback.
// Boundary: Candidate-only orchestration; no holdout access, Shadow Evaluation, Model Activation, active-config mutation, Runtime parameter mutation, State/checkpoint mutation, route, scheduler, or external forcing retrieval.

import {
  buildCap06CaseWindowV1,
  type Cap06BuiltCaseWindowV1,
} from "../../domain/calibration/case_builder_v1.js";
import {
  isCap06CandidateAppendingStatusV1,
  type Cap06CalibrationAttemptResultV1,
  type Cap06SourceDatasetIdentityV1,
} from "../../domain/calibration/contracts_v1.js";
import { runCap06CalibrationGridSearchV1 } from "../../domain/calibration/grid_search_v1.js";
import {
  buildCap06CalibrationCandidateDraftV1,
  type Cap06CalibrationCandidateDraftV1,
} from "../../domain/calibration/envelope_profiles_v1.js";
import type { ResolvedForecastObservationCaseV1 } from "../../domain/twin_runtime/resolved_forecast_observation_case_v1.js";
import type {
  Cap06GovernanceObjectV1,
  Cap06GovernancePersistenceResultV1,
} from "../../persistence/calibration/postgres_calibration_governance_repository_v1.js";
import { Cap06ResolvedForecastReplayPredictionAdapterV1 } from "./resolved_forecast_replay_prediction_adapter_v1.js";

export const CAP06_CALIBRATION_CANDIDATE_SERVICE_ID_V1 =
  "MCFT_CAP_06_S5_CALIBRATION_CANDIDATE_SERVICE_V1" as const;

export type Cap06ExactResolvedCasePortV1 = {
  resolveExactResidualRefs(
    orderedResidualRefs: readonly string[],
  ): Promise<readonly ResolvedForecastObservationCaseV1[]>;
};

export type Cap06CandidatePersistencePortV1 = {
  commitCanonicalObject(input: {
    object: Cap06GovernanceObjectV1;
    fault_injection?: (stage: string) => void;
  }): Promise<Cap06GovernancePersistenceResultV1>;
  readCanonicalObject(objectId: string): Promise<Cap06GovernanceObjectV1 | null>;
};

export type Cap06CalibrationCandidateServiceResultV1 = {
  schema_version: "geox_mcft_cap_06_s5_candidate_service_result_v1";
  service_id: typeof CAP06_CALIBRATION_CANDIDATE_SERVICE_ID_V1;
  status: Cap06CalibrationAttemptResultV1["status"];
  ordered_residual_refs: string[];
  resolved_case_count: number;
  calibration_window: Cap06BuiltCaseWindowV1;
  attempt: Cap06CalibrationAttemptResultV1;
  candidate: Cap06CalibrationCandidateDraftV1 | null;
  persistence_status: Cap06GovernancePersistenceResultV1["status"] | "NOT_APPENDED";
  canonical_readback_verified: boolean;
  candidate_append_count: 0 | 1;
  evaluation_append_count: 0;
  model_activation_count: 0;
  active_config_switch_count: 0;
  runtime_parameter_change_count: 0;
  state_mutation_count: 0;
  checkpoint_mutation_count: 0;
};

function exactCalibrationRefsV1(refs: readonly string[]): string[] {
  if (!Array.isArray(refs) || refs.length !== 16) {
    throw new Error(`CAP06_S5_EXACT_CALIBRATION_REF_COUNT_REQUIRED:${refs?.length ?? 0}`);
  }
  const normalized = refs.map((ref) => {
    if (typeof ref !== "string" || !ref.trim()) throw new Error("CAP06_S5_EXACT_CALIBRATION_REF_REQUIRED");
    return ref;
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("CAP06_S5_DUPLICATE_CALIBRATION_RESIDUAL_REF");
  }
  return normalized;
}

function verifyResolvedOrderV1(
  refs: readonly string[],
  cases: readonly ResolvedForecastObservationCaseV1[],
): void {
  if (cases.length !== refs.length) {
    throw new Error(`CAP06_S5_RESOLVED_CASE_COUNT_MISMATCH:${cases.length}`);
  }
  for (let index = 0; index < refs.length; index += 1) {
    if (cases[index]?.residual.object_id !== refs[index]
      || cases[index]?.case_source.residual_ref !== refs[index]
      || cases[index]?.case_source.case_index !== index) {
      throw new Error(`CAP06_S5_RESOLVED_CASE_ORDER_MISMATCH:${index}`);
    }
  }
}

export class Cap06CalibrationCandidateServiceV1 {
  constructor(
    private readonly exactCasePort: Cap06ExactResolvedCasePortV1,
    private readonly persistencePort: Cap06CandidatePersistencePortV1,
  ) {
    if (!exactCasePort || typeof exactCasePort.resolveExactResidualRefs !== "function") {
      throw new Error("CAP06_S5_EXACT_CASE_PORT_REQUIRED");
    }
    if (!persistencePort
      || typeof persistencePort.commitCanonicalObject !== "function"
      || typeof persistencePort.readCanonicalObject !== "function") {
      throw new Error("CAP06_S5_CANDIDATE_PERSISTENCE_PORT_REQUIRED");
    }
  }

  async computeAndCommit(input: {
    orderedResidualRefs: readonly string[];
    sourceDatasetIdentity: Cap06SourceDatasetIdentityV1;
    fault_injection?: (stage: string) => void;
  }): Promise<Cap06CalibrationCandidateServiceResultV1> {
    const refs = exactCalibrationRefsV1(input.orderedResidualRefs);
    const resolved = await this.exactCasePort.resolveExactResidualRefs(refs);
    verifyResolvedOrderV1(refs, resolved);

    const calibrationWindow = buildCap06CaseWindowV1({
      role: "CALIBRATION",
      orderedResidualRefs: refs,
      loadedCases: resolved.map((item) => item.case_source),
      sourceDatasetIdentity: input.sourceDatasetIdentity,
    });
    const attempt = await runCap06CalibrationGridSearchV1({
      calibrationWindow,
      predictionPort: new Cap06ResolvedForecastReplayPredictionAdapterV1(resolved),
    });

    if (!isCap06CandidateAppendingStatusV1(attempt.status)) {
      return {
        schema_version: "geox_mcft_cap_06_s5_candidate_service_result_v1",
        service_id: CAP06_CALIBRATION_CANDIDATE_SERVICE_ID_V1,
        status: attempt.status,
        ordered_residual_refs: [...refs],
        resolved_case_count: resolved.length,
        calibration_window: calibrationWindow,
        attempt,
        candidate: null,
        persistence_status: "NOT_APPENDED",
        canonical_readback_verified: false,
        candidate_append_count: 0,
        evaluation_append_count: 0,
        model_activation_count: 0,
        active_config_switch_count: 0,
        runtime_parameter_change_count: 0,
        state_mutation_count: 0,
        checkpoint_mutation_count: 0,
      };
    }

    const candidate = buildCap06CalibrationCandidateDraftV1({
      calibrationWindow,
      attempt,
    });
    const persisted = await this.persistencePort.commitCanonicalObject({
      object: candidate,
      fault_injection: input.fault_injection,
    });
    if (persisted.object.object_type !== "twin_calibration_candidate_v1"
      || persisted.object.object_id !== candidate.object_id
      || persisted.object.determinism_hash !== candidate.determinism_hash) {
      throw new Error("CAP06_S5_CANDIDATE_PERSISTENCE_RESULT_MISMATCH");
    }
    const readback = await this.persistencePort.readCanonicalObject(candidate.object_id);
    if (!readback
      || readback.object_type !== "twin_calibration_candidate_v1"
      || readback.object_id !== candidate.object_id
      || readback.determinism_hash !== candidate.determinism_hash) {
      throw new Error("CAP06_S5_CANDIDATE_CANONICAL_READBACK_MISMATCH");
    }

    return {
      schema_version: "geox_mcft_cap_06_s5_candidate_service_result_v1",
      service_id: CAP06_CALIBRATION_CANDIDATE_SERVICE_ID_V1,
      status: attempt.status,
      ordered_residual_refs: [...refs],
      resolved_case_count: resolved.length,
      calibration_window: calibrationWindow,
      attempt,
      candidate,
      persistence_status: persisted.status,
      canonical_readback_verified: true,
      candidate_append_count: persisted.status === "INSERTED" ? 1 : 0,
      evaluation_append_count: 0,
      model_activation_count: 0,
      active_config_switch_count: 0,
      runtime_parameter_change_count: 0,
      state_mutation_count: 0,
      checkpoint_mutation_count: 0,
    };
  }
}
