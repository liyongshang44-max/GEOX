// Purpose: execute the bounded MCFT-CAP-08.S5 24-Residual, 16-case Calibration, 8-case paired Shadow and canonical Candidate/Evaluation append over exact predecessor authorities.
// Boundary: one caller-provided formal chain only; no repository search, latest lookup, active Config mutation, Model Activation, State/checkpoint mutation, route, scheduler, production Runtime source, or MCFT-CAP-09 authority.

import {
  buildCap06CaseWindowV1,
  buildCap06CaseWindowsV1,
  type Cap06BuiltCaseWindowV1,
  type Cap06BuiltCaseWindowsV1,
} from "../../domain/calibration/case_builder_v1.js";
import {
  CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
  CAP06_HOLDOUT_PURPOSE_V1,
  CAP06_WINDOW_HASH_SEMANTICS_V1,
  isCap06CandidateAppendingStatusV1,
  type Cap06RealityScopeV1,
  type Cap06SourceDatasetIdentityV1,
} from "../../domain/calibration/contracts_v1.js";
import { runCap06CalibrationGridSearchV1 } from "../../domain/calibration/grid_search_v1.js";
import { runCap06PairedHistoricalShadowV1 } from "../../domain/calibration/shadow_evaluation_v1.js";
import {
  buildCap06CalibrationCandidateDraftV1,
  buildCap06ShadowEvaluationDraftV1,
  type Cap06CalibrationCandidateDraftV1,
  type Cap06ShadowEvaluationDraftV1,
} from "../../domain/calibration/envelope_profiles_v1.js";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import {
  CAP08_S5_CALIBRATION_COUNT_V1,
  CAP08_S5_EXPECTED_CANDIDATE_PARAMETER_V1,
  CAP08_S5_HOLDOUT_COUNT_V1,
  CAP08_S5_RESIDUAL_OBLIGATION_COUNT_V1,
  CAP08_S5_SERVICE_ID_V1,
  validateCap08S5PredecessorEvidenceV1,
  validateCap08S5ResidualObligationsV1,
  type Cap08S5ExactSourcePortV1,
  type Cap08S5PredecessorEvidenceV1,
  type Cap08S5ResidualObligationV1,
  type Cap08S5ResolvedObligationV1,
} from "../../domain/twin_runtime/cap08_s5_residual_calibration_shadow_contracts_v1.js";
import type {
  Cap06GovernanceObjectV1,
  Cap06GovernancePersistenceResultV1,
} from "../../persistence/calibration/postgres_calibration_governance_repository_v1.js";
import { Cap08S5ReplayPredictionAdapterV1 } from "./cap08_s5_replay_prediction_adapter_v1.js";

export type Cap08S5GovernancePersistencePortV1 = {
  commitCanonicalObject(input: {
    object: Cap06GovernanceObjectV1;
    fault_injection?: (stage: string) => void;
  }): Promise<Cap06GovernancePersistenceResultV1>;
  readCanonicalObject(objectId: string): Promise<Cap06GovernanceObjectV1 | null>;
};

export type Cap08S5ServiceResultV1 = {
  schema_version: "geox_mcft_cap08_s5_service_result_v1";
  service_id: typeof CAP08_S5_SERVICE_ID_V1;
  formal_run_id: string;
  predecessor: Cap08S5PredecessorEvidenceV1;
  residual_count: 24;
  calibration_case_count: 16;
  holdout_case_count: 8;
  ordered_residual_refs: string[];
  ordered_residual_hashes: string[];
  residual_fact_ids: string[];
  residual_insert_count: number;
  calibration_residual_refs: string[];
  holdout_residual_refs: string[];
  source_dataset_identity: Cap06SourceDatasetIdentityV1;
  case_windows: Cap06BuiltCaseWindowsV1;
  calibration_window: Cap06BuiltCaseWindowV1;
  holdout_window: Cap06BuiltCaseWindowV1;
  candidate: Cap06CalibrationCandidateDraftV1;
  candidate_persistence_status: Cap06GovernancePersistenceResultV1["status"];
  candidate_append_count: 0 | 1;
  shadow_evaluation: Cap06ShadowEvaluationDraftV1;
  shadow_persistence_status: Cap06GovernancePersistenceResultV1["status"];
  shadow_append_count: 0 | 1;
  shadow_deterministic_rerun_verified: true;
  model_activation_count: 0;
  active_runtime_config_switch_count: 0;
  state_pointer_delta: 0;
  checkpoint_pointer_delta: 0;
  semantic_digest: string;
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

function exactScopeV1(
  left: Pick<Cap06RealityScopeV1, "tenant_id" | "project_id" | "group_id" | "field_id" | "season_id" | "zone_id">,
  right: Cap06RealityScopeV1,
  code: string,
): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (left[field] !== right[field]) throw new Error(`${code}:${field}`);
  }
}

function validateResolvedV1(input: {
  resolved: Cap08S5ResolvedObligationV1;
  obligation: Cap08S5ResidualObligationV1;
  scope: Cap06RealityScopeV1;
  index: number;
}): Cap08S5ResolvedObligationV1 {
  const { resolved, obligation, scope, index } = input;
  if (semanticHashV1(resolved.obligation) !== semanticHashV1(obligation)) {
    throw new Error(`CAP08_S5_RESOLVED_OBLIGATION_MISMATCH:${index}`);
  }
  const residual = resolved.residual;
  if (residual.object_type !== "twin_forecast_residual_v1") {
    throw new Error(`CAP08_S5_RESIDUAL_TYPE_MISMATCH:${index}`);
  }
  exactScopeV1(residual, scope, "CAP08_S5_RESIDUAL_SCOPE_MISMATCH");
  const payload = residual.payload;
  if (payload.forecast_run_ref !== obligation.forecast_ref
    || payload.forecast_run_hash !== obligation.forecast_hash
    || payload.actual_observation_ref !== obligation.observation.source_record_id
    || payload.actual_observation_hash !== obligation.observation.source_record_hash
    || payload.actual_observation_observed_at !== obligation.observation.observed_at
    || payload.observation_available_to_runtime_at !== obligation.observation.available_to_runtime_at
    || payload.assimilation_update_ref !== obligation.assimilation_update_ref
    || payload.assimilation_update_hash !== obligation.assimilation_update_hash) {
    throw new Error(`CAP08_S5_RESIDUAL_AUTHORITY_MISMATCH:${index}`);
  }
  if (resolved.residual_fact_id !== `fact_${residual.object_id}`) {
    throw new Error(`CAP08_S5_RESIDUAL_FACT_ID_MISMATCH:${index}`);
  }
  const caseSource = resolved.case_source;
  if (caseSource.case_index !== index
    || caseSource.residual_ref !== residual.object_id
    || caseSource.residual_hash !== residual.determinism_hash
    || caseSource.source_forecast_ref !== obligation.forecast_ref
    || caseSource.source_forecast_hash !== obligation.forecast_hash
    || caseSource.actual_observation_ref !== obligation.observation.source_record_id
    || caseSource.actual_observation_hash !== obligation.observation.source_record_hash
    || caseSource.forecast_target_time !== obligation.observation.observed_at
    || caseSource.observation_observed_at !== obligation.observation.observed_at
    || caseSource.observation_available_to_runtime_at !== obligation.observation.available_to_runtime_at) {
    throw new Error(`CAP08_S5_CASE_SOURCE_AUTHORITY_MISMATCH:${index}`);
  }
  if (resolved.replay_authority.residual_ref !== residual.object_id
    || resolved.replay_authority.source_forecast_point.horizon_hour !== 1
    || resolved.replay_authority.source_forecast_point.target_time !== obligation.observation.observed_at) {
    throw new Error(`CAP08_S5_REPLAY_AUTHORITY_MISMATCH:${index}`);
  }
  return structuredClone(resolved);
}

function sourceDatasetIdentityV1(
  resolved: readonly Cap08S5ResolvedObligationV1[],
): Cap06SourceDatasetIdentityV1 {
  const residualRefs = resolved.map((item) => item.residual.object_id);
  const calibrationRefs = residualRefs.slice(0, CAP08_S5_CALIBRATION_COUNT_V1);
  const holdoutRefs = residualRefs.slice(CAP08_S5_CALIBRATION_COUNT_V1);
  return {
    residual_set_hash: semanticHashV1(resolved.map((item) => ({
      ref: item.residual.object_id,
      hash: item.residual.determinism_hash,
    }))),
    case_input_set_hash: semanticHashV1(resolved.map((item) => ({
      residual_ref: item.case_source.residual_ref,
      residual_hash: item.case_source.residual_hash,
      forecast_point_ref: item.case_source.source_forecast_point_ref,
      forecast_point_hash: item.case_source.source_forecast_point_hash,
      observation_ref: item.case_source.actual_observation_ref,
      observation_hash: item.case_source.actual_observation_hash,
    }))),
    calibration_window_hash: semanticHashV1(calibrationRefs),
    holdout_window_hash: semanticHashV1(holdoutRefs),
    window_hash_semantics: CAP06_WINDOW_HASH_SEMANTICS_V1,
    holdout_purpose: CAP06_HOLDOUT_PURPOSE_V1,
    holdout_generalization_claim: CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
  };
}

function verifyCanonicalReadbackV1(input: {
  expected: Cap06GovernanceObjectV1;
  actual: Cap06GovernanceObjectV1 | null;
  code: string;
}): void {
  if (!input.actual
    || input.actual.object_type !== input.expected.object_type
    || input.actual.object_id !== input.expected.object_id
    || input.actual.determinism_hash !== input.expected.determinism_hash) {
    throw new Error(input.code);
  }
}

export class Cap08S5ResidualCalibrationShadowServiceV1 {
  constructor(
    private readonly exactSourcePort: Cap08S5ExactSourcePortV1,
    private readonly governancePersistencePort: Cap08S5GovernancePersistencePortV1,
  ) {
    if (!exactSourcePort || typeof exactSourcePort.resolveExactObligation !== "function") {
      throw new Error("CAP08_S5_EXACT_SOURCE_PORT_REQUIRED");
    }
    if (!governancePersistencePort
      || typeof governancePersistencePort.commitCanonicalObject !== "function"
      || typeof governancePersistencePort.readCanonicalObject !== "function") {
      throw new Error("CAP08_S5_GOVERNANCE_PERSISTENCE_PORT_REQUIRED");
    }
  }

  async execute(input: {
    scope: Cap06RealityScopeV1;
    formal_run_id: string;
    created_at: string;
    predecessor: Cap08S5PredecessorEvidenceV1;
    obligations: readonly Cap08S5ResidualObligationV1[];
    candidate_fault_injection?: (stage: string) => void;
    shadow_fault_injection?: (stage: string) => void;
  }): Promise<Cap08S5ServiceResultV1> {
    const formalRunId = requiredStringV1(input.formal_run_id, "CAP08_S5_FORMAL_RUN_ID_REQUIRED");
    const createdAt = canonicalInstantV1(input.created_at, "CAP08_S5_CREATED_AT_INVALID");
    const predecessor = validateCap08S5PredecessorEvidenceV1(input.predecessor);
    const obligations = validateCap08S5ResidualObligationsV1(input.obligations);

    const resolved: Cap08S5ResolvedObligationV1[] = [];
    for (let index = 0; index < obligations.length; index += 1) {
      const item = await this.exactSourcePort.resolveExactObligation({
        scope: input.scope,
        formal_run_id: formalRunId,
        obligation: obligations[index],
        created_at: createdAt,
      });
      resolved.push(validateResolvedV1({
        resolved: item,
        obligation: obligations[index],
        scope: input.scope,
        index,
      }));
    }
    if (resolved.length !== CAP08_S5_RESIDUAL_OBLIGATION_COUNT_V1) {
      throw new Error(`CAP08_S5_RESOLVED_COUNT_MISMATCH:${resolved.length}`);
    }
    for (let index = 1; index < resolved.length; index += 1) {
      if (Date.parse(resolved[index - 1].case_source.forecast_target_time)
        >= Date.parse(resolved[index].case_source.forecast_target_time)) {
        throw new Error(`CAP08_S5_TARGET_ORDER_MISMATCH:${index}`);
      }
    }

    const sourceDatasetIdentity = sourceDatasetIdentityV1(resolved);
    const calibrationResolved = resolved.slice(0, CAP08_S5_CALIBRATION_COUNT_V1);
    const holdoutResolved = resolved.slice(CAP08_S5_CALIBRATION_COUNT_V1);
    if (calibrationResolved.length !== CAP08_S5_CALIBRATION_COUNT_V1
      || holdoutResolved.length !== CAP08_S5_HOLDOUT_COUNT_V1) {
      throw new Error("CAP08_S5_CALIBRATION_HOLDOUT_SPLIT_MISMATCH");
    }
    const calibrationRefs = calibrationResolved.map((item) => item.residual.object_id);
    const holdoutRefs = holdoutResolved.map((item) => item.residual.object_id);
    if (holdoutRefs.some((ref) => new Set(calibrationRefs).has(ref))) {
      throw new Error("CAP08_S5_CALIBRATION_HOLDOUT_OVERLAP");
    }

    const calibrationWindow = buildCap06CaseWindowV1({
      role: "CALIBRATION",
      orderedResidualRefs: calibrationRefs,
      loadedCases: calibrationResolved.map((item) => item.case_source),
      sourceDatasetIdentity,
    });
    const holdoutWindow = buildCap06CaseWindowV1({
      role: "HOLDOUT",
      orderedResidualRefs: holdoutRefs,
      loadedCases: holdoutResolved.map((item) => item.case_source),
      sourceDatasetIdentity,
    });
    const caseWindows = buildCap06CaseWindowsV1({
      calibration: calibrationWindow,
      holdout: holdoutWindow,
    });
    const predictionPort = new Cap08S5ReplayPredictionAdapterV1(resolved);
    const attempt = await runCap06CalibrationGridSearchV1({
      calibrationWindow,
      predictionPort,
    });
    if (!isCap06CandidateAppendingStatusV1(attempt.status)
      || attempt.selected_parameter_value !== CAP08_S5_EXPECTED_CANDIDATE_PARAMETER_V1) {
      throw new Error(
        `CAP08_S5_EXPECTED_CANDIDATE_NOT_ESTABLISHED:${attempt.status}:${attempt.selected_parameter_value ?? "null"}`,
      );
    }

    const candidate = buildCap06CalibrationCandidateDraftV1({
      calibrationWindow,
      attempt,
    });
    const candidatePersisted = await this.governancePersistencePort.commitCanonicalObject({
      object: candidate,
      fault_injection: input.candidate_fault_injection,
    });
    if (candidatePersisted.object.object_type !== "twin_calibration_candidate_v1"
      || candidatePersisted.object.object_id !== candidate.object_id
      || candidatePersisted.object.determinism_hash !== candidate.determinism_hash) {
      throw new Error("CAP08_S5_CANDIDATE_PERSISTENCE_RESULT_MISMATCH");
    }
    verifyCanonicalReadbackV1({
      expected: candidate,
      actual: await this.governancePersistencePort.readCanonicalObject(candidate.object_id),
      code: "CAP08_S5_CANDIDATE_CANONICAL_READBACK_MISMATCH",
    });

    const shadowFirst = await runCap06PairedHistoricalShadowV1({
      holdoutWindow,
      candidateParameterValue: CAP08_S5_EXPECTED_CANDIDATE_PARAMETER_V1,
      predictionPort,
    });
    const shadowSecond = await runCap06PairedHistoricalShadowV1({
      holdoutWindow,
      candidateParameterValue: CAP08_S5_EXPECTED_CANDIDATE_PARAMETER_V1,
      predictionPort,
    });
    if (semanticHashV1(shadowFirst) !== semanticHashV1(shadowSecond)) {
      throw new Error("CAP08_S5_SHADOW_DETERMINISTIC_RERUN_MISMATCH");
    }
    const shadowEvaluation = buildCap06ShadowEvaluationDraftV1({
      holdoutWindow,
      candidate,
      shadow: shadowFirst,
    });
    const shadowPersisted = await this.governancePersistencePort.commitCanonicalObject({
      object: shadowEvaluation,
      fault_injection: input.shadow_fault_injection,
    });
    if (shadowPersisted.object.object_type !== "twin_shadow_evaluation_v1"
      || shadowPersisted.object.object_id !== shadowEvaluation.object_id
      || shadowPersisted.object.determinism_hash !== shadowEvaluation.determinism_hash) {
      throw new Error("CAP08_S5_SHADOW_PERSISTENCE_RESULT_MISMATCH");
    }
    verifyCanonicalReadbackV1({
      expected: shadowEvaluation,
      actual: await this.governancePersistencePort.readCanonicalObject(shadowEvaluation.object_id),
      code: "CAP08_S5_SHADOW_CANONICAL_READBACK_MISMATCH",
    });

    const semantic = {
      schema_version: "geox_mcft_cap08_s5_service_result_v1" as const,
      service_id: CAP08_S5_SERVICE_ID_V1,
      formal_run_id: formalRunId,
      predecessor,
      residual_count: CAP08_S5_RESIDUAL_OBLIGATION_COUNT_V1,
      calibration_case_count: CAP08_S5_CALIBRATION_COUNT_V1,
      holdout_case_count: CAP08_S5_HOLDOUT_COUNT_V1,
      ordered_residual_refs: resolved.map((item) => item.residual.object_id),
      ordered_residual_hashes: resolved.map((item) => item.residual.determinism_hash),
      residual_fact_ids: resolved.map((item) => item.residual_fact_id),
      residual_insert_count: resolved.filter((item) => item.residual_persistence_status === "INSERTED").length,
      calibration_residual_refs: calibrationRefs,
      holdout_residual_refs: holdoutRefs,
      source_dataset_identity: sourceDatasetIdentity,
      case_windows: caseWindows,
      calibration_window: calibrationWindow,
      holdout_window: holdoutWindow,
      candidate,
      candidate_persistence_status: candidatePersisted.status,
      candidate_append_count: candidatePersisted.status === "INSERTED" ? 1 as const : 0 as const,
      shadow_evaluation: shadowEvaluation,
      shadow_persistence_status: shadowPersisted.status,
      shadow_append_count: shadowPersisted.status === "INSERTED" ? 1 as const : 0 as const,
      shadow_deterministic_rerun_verified: true as const,
      model_activation_count: 0 as const,
      active_runtime_config_switch_count: 0 as const,
      state_pointer_delta: 0 as const,
      checkpoint_pointer_delta: 0 as const,
    };
    return {
      ...semantic,
      semantic_digest: semanticHashV1(semantic),
    };
  }
}
