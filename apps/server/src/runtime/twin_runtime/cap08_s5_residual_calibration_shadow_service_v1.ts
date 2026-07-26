// Purpose: execute bounded MCFT-CAP-08.S5 24-Residual, eligibility-aware 16-case Calibration, 8-case paired Shadow and canonical Candidate/Evaluation append.
// Boundary: one caller-provided exact v2 formal chain only; no repository search, latest lookup, active Config mutation, Model Activation, State/checkpoint mutation, route, scheduler, production Runtime source or MCFT-CAP-09 authority.

import {
  CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
  CAP06_HOLDOUT_PURPOSE_V1,
  CAP06_SEARCH_MAXIMUM_V1,
  CAP06_SEARCH_MINIMUM_V1,
  CAP06_WINDOW_HASH_SEMANTICS_V1,
  type Cap06CalibrationCaseV1,
  type Cap06RealityScopeV1,
  type Cap06SourceDatasetIdentityV1,
} from "../../domain/calibration/contracts_v1.js";
import { runCap06PairedHistoricalShadowV1 } from "../../domain/calibration/shadow_evaluation_v1.js";
import type {
  Cap06CalibrationCandidateDraftV1,
  Cap06ShadowEvaluationDraftV1,
} from "../../domain/calibration/envelope_profiles_v1.js";
import {
  CAP08_S5_NO_POSITIVE_EXCESS_REGIME_V1,
  asCap06ComputeWindowV1,
  buildCap08S5CaseWindowV1,
  buildCap08S5CaseWindowsV1,
  type Cap08S5BuiltCaseWindowV1,
  type Cap08S5BuiltCaseWindowsV1,
} from "../../domain/calibration/cap08_s5_case_builder_v1.js";
import {
  runCap08S5ObjectiveGridSearchV1,
  type Cap08S5ObjectiveAttemptV1,
  type Cap08S5ObjectivePolicyV1,
} from "../../domain/calibration/cap08_s5_objective_grid_search_v1.js";
import {
  buildCap08S5CalibrationCandidateDraftV1,
  buildCap08S5ShadowEvaluationDraftV1,
} from "../../domain/calibration/cap08_s5_envelope_profiles_v1.js";
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
import {
  CAP08_S5_V2_PREQUALIFICATION_POLICY_ID_V1,
  validateCap08S5V2PrequalificationEvidenceV1,
  type Cap08S5V2PrequalificationEvidenceV1,
} from "../../domain/twin_runtime/cap08_s5_replay_dataset_v2_authority_v1.js";
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
  schema_version: "geox_mcft_cap08_s5_service_result_v2";
  service_id: typeof CAP08_S5_SERVICE_ID_V1;
  formal_run_id: string;
  predecessor: Cap08S5PredecessorEvidenceV1;
  prequalification: Cap08S5V2PrequalificationEvidenceV1;
  residual_count: 24;
  calibration_case_count: 16;
  objective_case_count: 15;
  diagnostic_only_case_count: 1;
  holdout_case_count: 8;
  diagnostic_only_observation_refs: ["FVO-10"];
  ordered_residual_refs: string[];
  ordered_residual_hashes: string[];
  residual_fact_ids: string[];
  residual_insert_count: number;
  calibration_residual_refs: string[];
  holdout_residual_refs: string[];
  source_dataset_identity: Cap06SourceDatasetIdentityV1;
  case_windows: Cap08S5BuiltCaseWindowsV1;
  calibration_window: Cap08S5BuiltCaseWindowV1;
  holdout_window: Cap08S5BuiltCaseWindowV1;
  objective_attempt: Cap08S5ObjectiveAttemptV1;
  no_positive_excess_parameter_insensitivity_verified: true;
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

const requiredStringV1 = (value: unknown, code: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
};

function exactScopeV1(
  left: Pick<Cap06RealityScopeV1, "tenant_id" | "project_id" | "group_id" | "field_id" | "season_id" | "zone_id">,
  right: Cap06RealityScopeV1,
  code: string,
): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (left[field] !== right[field]) throw new Error(`${code}:${field}`);
  }
}

function sourceDatasetIdentityV1(resolved: readonly Cap08S5ResolvedObligationV1[]): Cap06SourceDatasetIdentityV1 {
  const residualRefs = resolved.map((item) => item.residual.object_id);
  const calibrationRefs = residualRefs.slice(0, CAP08_S5_CALIBRATION_COUNT_V1);
  const holdoutRefs = residualRefs.slice(CAP08_S5_CALIBRATION_COUNT_V1);
  return {
    residual_set_hash: semanticHashV1(resolved.map((item) => ({ ref: item.residual.object_id, hash: item.residual.determinism_hash }))),
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

function verifyReadbackV1(expected: Cap06GovernanceObjectV1, actual: Cap06GovernanceObjectV1 | null, code: string): void {
  if (!actual || actual.object_type !== expected.object_type
    || actual.object_id !== expected.object_id
    || actual.determinism_hash !== expected.determinism_hash) throw new Error(code);
}

async function verifyNoPositiveExcessV1(
  windows: readonly Cap08S5BuiltCaseWindowV1[],
  adapter: Cap08S5ReplayPredictionAdapterV1,
): Promise<void> {
  for (const item of windows.flatMap((window) => window.cases)
    .filter((value) => value.wetness_regime === CAP08_S5_NO_POSITIVE_EXCESS_REGIME_V1)) {
    const compute = item as unknown as Cap06CalibrationCaseV1;
    const minimum = await adapter.predictCase(compute, CAP06_SEARCH_MINIMUM_V1);
    const maximum = await adapter.predictCase(compute, CAP06_SEARCH_MAXIMUM_V1);
    if (minimum.prediction_vwc !== maximum.prediction_vwc
      || minimum.storage_mm !== maximum.storage_mm
      || minimum.physical_invariant_status !== "PASS"
      || maximum.physical_invariant_status !== "PASS"
      || minimum.mass_balance_status !== "PASS"
      || maximum.mass_balance_status !== "PASS") {
      throw new Error(`CAP08_S5_NO_POSITIVE_EXCESS_PARAMETER_SENSITIVE:${item.residual_ref}`);
    }
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
    prequalification: Cap08S5V2PrequalificationEvidenceV1;
    obligations: readonly Cap08S5ResidualObligationV1[];
    candidate_fault_injection?: (stage: string) => void;
    shadow_fault_injection?: (stage: string) => void;
  }): Promise<Cap08S5ServiceResultV1> {
    const formalRunId = requiredStringV1(input.formal_run_id, "CAP08_S5_FORMAL_RUN_ID_REQUIRED");
    if (!Number.isFinite(Date.parse(input.created_at))) throw new Error("CAP08_S5_CREATED_AT_INVALID");
    const predecessor = validateCap08S5PredecessorEvidenceV1(input.predecessor);
    const prequalification = validateCap08S5V2PrequalificationEvidenceV1(input.prequalification);
    const obligations = validateCap08S5ResidualObligationsV1(input.obligations);
    const resolved: Cap08S5ResolvedObligationV1[] = [];
    for (let index = 0; index < obligations.length; index += 1) {
      const item = await this.exactSourcePort.resolveExactObligation({
        scope: input.scope,
        formal_run_id: formalRunId,
        obligation: obligations[index],
        created_at: input.created_at,
      });
      if (semanticHashV1(item.obligation) !== semanticHashV1(obligations[index])) {
        throw new Error(`CAP08_S5_RESOLVED_OBLIGATION_MISMATCH:${index}`);
      }
      exactScopeV1(item.residual, input.scope, "CAP08_S5_RESIDUAL_SCOPE_MISMATCH");
      if (item.residual.object_type !== "twin_forecast_residual_v1"
        || item.case_source.residual_ref !== item.residual.object_id
        || item.replay_authority.residual_ref !== item.residual.object_id
        || item.replay_authority.source_forecast_point.horizon_hour !== 1) {
        throw new Error(`CAP08_S5_RESOLVED_AUTHORITY_MISMATCH:${index}`);
      }
      resolved.push(structuredClone(item));
    }
    if (resolved.length !== CAP08_S5_RESIDUAL_OBLIGATION_COUNT_V1) {
      throw new Error(`CAP08_S5_RESOLVED_COUNT_MISMATCH:${resolved.length}`);
    }
    const sourceDatasetIdentity = sourceDatasetIdentityV1(resolved);
    const calibrationResolved = resolved.slice(0, CAP08_S5_CALIBRATION_COUNT_V1);
    const holdoutResolved = resolved.slice(CAP08_S5_CALIBRATION_COUNT_V1);
    const calibrationRefs = calibrationResolved.map((item) => item.residual.object_id);
    const holdoutRefs = holdoutResolved.map((item) => item.residual.object_id);
    if (holdoutRefs.some((ref) => new Set(calibrationRefs).has(ref))) {
      throw new Error("CAP08_S5_CALIBRATION_HOLDOUT_OVERLAP");
    }
    const calibrationWindow = buildCap08S5CaseWindowV1({
      role: "CALIBRATION",
      orderedResidualRefs: calibrationRefs,
      loadedCases: calibrationResolved.map((item) => item.case_source),
      sourceDatasetIdentity,
    });
    const holdoutWindow = buildCap08S5CaseWindowV1({
      role: "HOLDOUT",
      orderedResidualRefs: holdoutRefs,
      loadedCases: holdoutResolved.map((item) => item.case_source),
      sourceDatasetIdentity,
    });
    const caseWindows = buildCap08S5CaseWindowsV1({ calibration: calibrationWindow, holdout: holdoutWindow });
    const diagnosticCases = calibrationWindow.cases.filter((item) => item.actual_observation_ref === "FVO-10");
    if (diagnosticCases.length !== 1) throw new Error("CAP08_S5_FVO10_DIAGNOSTIC_CASE_REQUIRED");
    const objectivePolicy: Cap08S5ObjectivePolicyV1 = {
      policy_id: CAP08_S5_V2_PREQUALIFICATION_POLICY_ID_V1,
      objective_residual_refs: calibrationWindow.cases
        .filter((item) => item.actual_observation_ref !== "FVO-10")
        .map((item) => item.residual_ref),
      diagnostic_only_residual_refs: [diagnosticCases[0].residual_ref],
      diagnostic_only_observation_refs: ["FVO-10"],
    };
    const adapter = new Cap08S5ReplayPredictionAdapterV1(resolved);
    await verifyNoPositiveExcessV1([calibrationWindow, holdoutWindow], adapter);
    const attempt = await runCap08S5ObjectiveGridSearchV1({
      calibrationWindow: asCap06ComputeWindowV1(calibrationWindow),
      predictionPort: adapter,
      objectivePolicy,
    });
    const excitation = attempt.excitation_summary;
    if (attempt.status !== "BOUNDED_PARAMETER_DELTA_CANDIDATE"
      || attempt.selected_parameter_value !== CAP08_S5_EXPECTED_CANDIDATE_PARAMETER_V1
      || attempt.objective_case_count !== 15
      || attempt.diagnostic_only_case_count !== 1
      || !excitation
      || excitation.sensitive_case_count !== 7
      || JSON.stringify(excitation.represented_sensitive_wetness_regimes)
        !== JSON.stringify(["HIGH_EXCESS", "MID_EXCESS"])) {
      throw new Error(`CAP08_S5_EXPECTED_CANDIDATE_NOT_ESTABLISHED:${attempt.status}:${attempt.selected_parameter_value}`);
    }
    const candidate = buildCap08S5CalibrationCandidateDraftV1({ calibrationWindow, attempt });
    const candidatePersisted = await this.governancePersistencePort.commitCanonicalObject({
      object: candidate,
      fault_injection: input.candidate_fault_injection,
    });
    verifyReadbackV1(candidate, await this.governancePersistencePort.readCanonicalObject(candidate.object_id),
      "CAP08_S5_CANDIDATE_CANONICAL_READBACK_MISMATCH");
    const computeHoldout = asCap06ComputeWindowV1(holdoutWindow);
    const shadowFirst = await runCap06PairedHistoricalShadowV1({
      holdoutWindow: computeHoldout,
      candidateParameterValue: CAP08_S5_EXPECTED_CANDIDATE_PARAMETER_V1,
      predictionPort: adapter,
    });
    const shadowSecond = await runCap06PairedHistoricalShadowV1({
      holdoutWindow: computeHoldout,
      candidateParameterValue: CAP08_S5_EXPECTED_CANDIDATE_PARAMETER_V1,
      predictionPort: adapter,
    });
    if (semanticHashV1(shadowFirst) !== semanticHashV1(shadowSecond)) {
      throw new Error("CAP08_S5_SHADOW_DETERMINISTIC_RERUN_MISMATCH");
    }
    const shadowEvaluation = buildCap08S5ShadowEvaluationDraftV1({
      holdoutWindow,
      candidate,
      shadow: shadowFirst,
    });
    const shadowPersisted = await this.governancePersistencePort.commitCanonicalObject({
      object: shadowEvaluation,
      fault_injection: input.shadow_fault_injection,
    });
    verifyReadbackV1(shadowEvaluation,
      await this.governancePersistencePort.readCanonicalObject(shadowEvaluation.object_id),
      "CAP08_S5_SHADOW_CANONICAL_READBACK_MISMATCH");

    const semantic = {
      schema_version: "geox_mcft_cap08_s5_service_result_v2" as const,
      service_id: CAP08_S5_SERVICE_ID_V1,
      formal_run_id: formalRunId,
      predecessor,
      prequalification,
      residual_count: 24 as const,
      calibration_case_count: 16 as const,
      objective_case_count: 15 as const,
      diagnostic_only_case_count: 1 as const,
      holdout_case_count: 8 as const,
      diagnostic_only_observation_refs: ["FVO-10"] as ["FVO-10"],
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
      objective_attempt: attempt,
      no_positive_excess_parameter_insensitivity_verified: true as const,
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
    return { ...semantic, semantic_digest: semanticHashV1(semantic) };
  }
}
