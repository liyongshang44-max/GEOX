// Purpose: execute the bounded MCFT-CAP-08.S5 Residual, Calibration Candidate, paired Shadow Evaluation and completion chain.
// Boundary: explicit slice invocation only; no Model Activation, active-config switch, Runtime parameter mutation, State/checkpoint pointer mutation, route, scheduler or MCFT-CAP-09 authority.

import type { Pool } from "pg";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import {
  CAP08_S5_EXPECTED_PARAMETER_V1,
  CAP08_S5_GRID_POINT_COUNT_V1,
  buildCap08S5CompletionAuthorityV1,
  deriveCap08S5ResidualSetIdentityV1,
  validateCap08S5ResidualSetAuthorityV1,
  type Cap08S5CompletionAuthorityV1,
  type Cap08S5ResidualSetAuthorityV1,
  type Cap08S5ScopeV1,
} from "../../domain/twin_runtime/cap08_s5_residual_calibration_shadow_contracts_v1.js";
import { buildCap06CaseWindowsV1 } from "../../domain/calibration/case_builder_v1.js";
import { runCap06CalibrationGridSearchV1 } from "../../domain/calibration/grid_search_v1.js";
import { runCap06PairedHistoricalShadowV1 } from "../../domain/calibration/shadow_evaluation_v1.js";
import {
  buildCap06CalibrationCandidateDraftV1,
  buildCap06ShadowEvaluationDraftV1,
  type Cap06CalibrationCandidateDraftV1,
  type Cap06ShadowEvaluationDraftV1,
} from "../../domain/calibration/envelope_profiles_v1.js";
import { isCap06CandidateAppendingStatusV1 } from "../../domain/calibration/contracts_v1.js";
import {
  PostgresCalibrationGovernanceRepositoryV1,
  type Cap06GovernanceObjectV1,
} from "../../persistence/calibration/postgres_calibration_governance_repository_v1.js";
import { PostgresCap08S5ResidualCalibrationShadowRepositoryV1 } from "../../persistence/twin_runtime/postgres_cap08_s5_residual_calibration_shadow_repository_v1.js";
import { Cap08S5CasePredictionAdapterV1 } from "./cap08_s5_case_prediction_adapter_v1.js";
import { buildCap08S5CaseWindowV1 } from "./cap08_s5_case_window_adapter_v1.js";
import { Cap08S5PersistedSourceReaderV1 } from "./cap08_s5_persisted_source_reader_v1.js";
import type { ReplayEvidenceSourcePortV1 } from "./ports.js";

export type ExecuteCap08S5InputV1 = {
  formal_run_id: string;
  scope: Cap08S5ScopeV1;
  created_at: string;
  phase_engine_contract_digest: string;
  phase_engine_source_digest: string;
  fault_injection?: (stage: string) => void;
};

export type ExecuteCap08S5ResultV1 = {
  status: "COMPLETED" | "ALREADY_COMPLETE";
  write_delta: number;
  residual_write_delta: 0 | 26;
  candidate_write_delta: 0 | 1;
  shadow_write_delta: 0 | 1;
  completion_write_delta: 0 | 2;
  residual_authority: Cap08S5ResidualSetAuthorityV1;
  candidate_ref: string;
  candidate_hash: string;
  candidate_parameter_value: "0.034000";
  shadow_ref: string;
  shadow_hash: string;
  completion_authority: Cap08S5CompletionAuthorityV1;
  residual_count: 24;
  calibration_case_count: 16;
  holdout_case_count: 8;
  grid_point_count: 21;
  calibration_candidate_count: 1;
  shadow_evaluation_count: 1;
  future_leakage_count: 0;
  model_activation_count: 0;
  active_config_switch_count: 0;
  runtime_parameter_change_count: 0;
  state_pointer_delta: 0;
  checkpoint_pointer_delta: 0;
  production_runtime_source_authorized: false;
  s6_authorized: false;
  mcft_cap_09_authorized: false;
};

function req(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}
function exactGovernanceObject<T extends Cap06GovernanceObjectV1>(
  value: Cap06GovernanceObjectV1 | null,
  expected: T,
  type: T["object_type"],
  code: string,
): T | null {
  if (!value) return null;
  if (value.object_type !== type || value.object_id !== expected.object_id
    || value.determinism_hash !== expected.determinism_hash) throw new Error(code);
  return value as T;
}

export class Cap08S5ResidualCalibrationShadowServiceV1 {
  private readonly sourceReader: Cap08S5PersistedSourceReaderV1;
  private readonly sliceRepository: PostgresCap08S5ResidualCalibrationShadowRepositoryV1;
  private readonly governanceRepository: PostgresCalibrationGovernanceRepositoryV1;

  constructor(pool: Pool, evidenceSource: ReplayEvidenceSourcePortV1) {
    this.sourceReader = new Cap08S5PersistedSourceReaderV1(pool, evidenceSource);
    this.sliceRepository = new PostgresCap08S5ResidualCalibrationShadowRepositoryV1(pool);
    this.governanceRepository = new PostgresCalibrationGovernanceRepositoryV1(pool);
  }

  private result(input: {
    status: "COMPLETED" | "ALREADY_COMPLETE";
    residualAuthority: Cap08S5ResidualSetAuthorityV1;
    candidate: Cap06CalibrationCandidateDraftV1;
    shadow: Cap06ShadowEvaluationDraftV1;
    completion: Cap08S5CompletionAuthorityV1;
    residualDelta: 0 | 26;
    candidateDelta: 0 | 1;
    shadowDelta: 0 | 1;
    completionDelta: 0 | 2;
  }): ExecuteCap08S5ResultV1 {
    return {
      status: input.status,
      write_delta: input.residualDelta + input.candidateDelta + input.shadowDelta + input.completionDelta,
      residual_write_delta: input.residualDelta,
      candidate_write_delta: input.candidateDelta,
      shadow_write_delta: input.shadowDelta,
      completion_write_delta: input.completionDelta,
      residual_authority: input.residualAuthority,
      candidate_ref: input.candidate.object_id,
      candidate_hash: input.candidate.determinism_hash,
      candidate_parameter_value: CAP08_S5_EXPECTED_PARAMETER_V1,
      shadow_ref: input.shadow.object_id,
      shadow_hash: input.shadow.determinism_hash,
      completion_authority: input.completion,
      residual_count: 24,
      calibration_case_count: 16,
      holdout_case_count: 8,
      grid_point_count: 21,
      calibration_candidate_count: 1,
      shadow_evaluation_count: 1,
      future_leakage_count: 0,
      model_activation_count: 0,
      active_config_switch_count: 0,
      runtime_parameter_change_count: 0,
      state_pointer_delta: 0,
      checkpoint_pointer_delta: 0,
      production_runtime_source_authorized: false,
      s6_authorized: false,
      mcft_cap_09_authorized: false,
    };
  }

  async execute(input: ExecuteCap08S5InputV1): Promise<ExecuteCap08S5ResultV1> {
    const inject = (stage: string): void => input.fault_injection?.(stage);
    const sources = await this.sourceReader.read({
      formal_run_id: req(input.formal_run_id, "CAP08_S5_FORMAL_RUN_REQUIRED"),
      scope: input.scope,
      created_at: input.created_at,
      phase_engine_contract_digest: input.phase_engine_contract_digest,
      phase_engine_source_digest: input.phase_engine_source_digest,
    });
    const identity = deriveCap08S5ResidualSetIdentityV1(sources.identity_input);
    const orderedBindings = sources.residuals.map((residual, index) => ({
      residual_id: `R-${String(index + 1).padStart(2, "0")}`,
      forecast_id: residual.payload.forecast_run_ref,
      observation_id: residual.payload.actual_observation_ref,
      forecast_target_time: residual.payload.forecast_target_time,
      ref: residual.object_id,
      hash: residual.determinism_hash,
    }));
    const residualSemantic = {
      schema_version: "geox_mcft_cap08_s5_residual_set_authority_v1" as const,
      contract_id: "MCFT-CAP-08.S5-RESIDUAL-CALIBRATION-SHADOW-V1" as const,
      authority_kind: "REALITY_BINDING" as const,
      authority_ref: identity.authority_ref,
      idempotency_key: identity.idempotency_key,
      formal_run_id: sources.formal_run_id,
      scope: structuredClone(sources.scope),
      lineage_id: sources.lineage_id,
      revision_id: sources.revision_id,
      identity_input: identity.identity_input,
      ordered_residuals: orderedBindings,
      calibration_residual_refs: orderedBindings.slice(0, 16).map((item) => item.ref),
      holdout_residual_refs: orderedBindings.slice(16).map((item) => item.ref),
      r01_commit_logical_time: "2026-06-01T16:00:00.000Z",
      r17_forecast_source: "S4_CORRECTED_T16_FORECAST" as const,
      future_leakage_count: 0 as const,
      residual_count: 24 as const,
      phase_engine_contract_digest: sources.phase_engine_contract_digest,
      phase_engine_source_digest: sources.phase_engine_source_digest,
      production_runtime_source_authorized: false as const,
      model_activation_count: 0 as const,
      active_config_switch_count: 0 as const,
      mcft_cap_09_authorized: false as const,
    };
    const residualAuthority: Cap08S5ResidualSetAuthorityV1 = {
      ...residualSemantic,
      determinism_hash: semanticHashV1(residualSemantic),
    };
    validateCap08S5ResidualSetAuthorityV1({ authority: residualAuthority, residuals: sources.residuals });

    const calibrationWindow = buildCap08S5CaseWindowV1({
      role: "CALIBRATION",
      orderedResidualRefs: residualAuthority.calibration_residual_refs,
      loadedCases: sources.case_sources.slice(0, 16),
      sourceDatasetIdentity: sources.source_dataset_identity,
    });
    const holdoutWindow = buildCap08S5CaseWindowV1({
      role: "HOLDOUT",
      orderedResidualRefs: residualAuthority.holdout_residual_refs,
      loadedCases: sources.case_sources.slice(16),
      sourceDatasetIdentity: sources.source_dataset_identity,
    });
    const windows = buildCap06CaseWindowsV1({ calibration: calibrationWindow, holdout: holdoutWindow });
    if (windows.future_leakage_count !== 0) throw new Error("CAP08_S5_FUTURE_LEAKAGE_DETECTED");
    const predictionPort = new Cap08S5CasePredictionAdapterV1(sources.prediction_authorities);
    const attempt = await runCap06CalibrationGridSearchV1({ calibrationWindow, predictionPort });
    if (!isCap06CandidateAppendingStatusV1(attempt.status)
      || attempt.selected_parameter_value !== CAP08_S5_EXPECTED_PARAMETER_V1
      || attempt.objective_surface.length !== CAP08_S5_GRID_POINT_COUNT_V1) {
      throw new Error(`CAP08_S5_FORMAL_CANDIDATE_ORACLE_MISMATCH:${attempt.status}:${attempt.selected_parameter_value}`);
    }
    const candidateDraft = buildCap06CalibrationCandidateDraftV1({ calibrationWindow, attempt });
    const shadowFirst = await runCap06PairedHistoricalShadowV1({
      holdoutWindow,
      candidateParameterValue: CAP08_S5_EXPECTED_PARAMETER_V1,
      predictionPort,
    });
    const shadowSecond = await runCap06PairedHistoricalShadowV1({
      holdoutWindow,
      candidateParameterValue: CAP08_S5_EXPECTED_PARAMETER_V1,
      predictionPort,
    });
    if (semanticHashV1(shadowFirst) !== semanticHashV1(shadowSecond)
      || shadowFirst.model_activation_created !== false
      || shadowFirst.active_config_switch_performed !== false) {
      throw new Error("CAP08_S5_SHADOW_DETERMINISM_OR_BOUNDARY_MISMATCH");
    }
    const shadowDraft = buildCap06ShadowEvaluationDraftV1({ holdoutWindow, candidate: candidateDraft, shadow: shadowFirst });
    const completionAuthority = buildCap08S5CompletionAuthorityV1({
      formal_run_id: sources.formal_run_id,
      scope: sources.scope,
      lineage_id: sources.lineage_id,
      revision_id: sources.revision_id,
      residual_set: { ref: residualAuthority.authority_ref, hash: residualAuthority.determinism_hash },
      calibration_candidate: { ref: candidateDraft.object_id, hash: candidateDraft.determinism_hash },
      shadow_evaluation: { ref: shadowDraft.object_id, hash: shadowDraft.determinism_hash },
      candidate_parameter_value: CAP08_S5_EXPECTED_PARAMETER_V1,
      residual_count: 24,
      calibration_case_count: 16,
      holdout_case_count: 8,
      calibration_candidate_count: 1,
      shadow_evaluation_count: 1,
      grid_point_count: CAP08_S5_GRID_POINT_COUNT_V1,
      future_leakage_count: 0,
      model_activation_count: 0,
      active_config_switch_count: 0,
      runtime_parameter_change_count: 0,
      state_pointer_delta: 0,
      checkpoint_pointer_delta: 0,
      completed_rerun_write_delta: 0,
      phase_engine_contract_digest: sources.phase_engine_contract_digest,
      phase_engine_source_digest: sources.phase_engine_source_digest,
      slice_acceptance_only: true,
      final_formal_run_id: null,
      production_runtime_source_authorized: false,
      s6_authorized: false,
      mcft_cap_09_authorized: false,
    });

    const [residualState, candidateById, candidateByKey, shadowById, shadowByKey, completionState] = await Promise.all([
      this.sliceRepository.inspectResidualSet(residualAuthority),
      this.governanceRepository.readCanonicalObject(candidateDraft.object_id),
      this.governanceRepository.lookupByIdempotencyKey(candidateDraft.idempotency_key),
      this.governanceRepository.readCanonicalObject(shadowDraft.object_id),
      this.governanceRepository.lookupByIdempotencyKey(shadowDraft.idempotency_key),
      this.sliceRepository.inspectCompletion(completionAuthority),
    ]);
    const existingCandidate = exactGovernanceObject(candidateById, candidateDraft, "twin_calibration_candidate_v1", "CAP08_S5_EXISTING_CANDIDATE_CONFLICT");
    const candidateByGuard = exactGovernanceObject(candidateByKey, candidateDraft, "twin_calibration_candidate_v1", "CAP08_S5_CANDIDATE_GUARD_CONFLICT");
    const existingShadow = exactGovernanceObject(shadowById, shadowDraft, "twin_shadow_evaluation_v1", "CAP08_S5_EXISTING_SHADOW_CONFLICT");
    const shadowByGuard = exactGovernanceObject(shadowByKey, shadowDraft, "twin_shadow_evaluation_v1", "CAP08_S5_SHADOW_GUARD_CONFLICT");
    if (Boolean(existingCandidate) !== Boolean(candidateByGuard)) throw new Error("CAP08_S5_CANDIDATE_PARTIAL_SET");
    if (Boolean(existingShadow) !== Boolean(shadowByGuard)) throw new Error("CAP08_S5_SHADOW_PARTIAL_SET");
    const present = [
      residualState.disposition === "ALREADY_COMPLETE_EXACT",
      Boolean(existingCandidate),
      Boolean(existingShadow),
      completionState.disposition === "ALREADY_COMPLETE_EXACT",
    ];
    if (present.every(Boolean)) {
      return this.result({
        status: "ALREADY_COMPLETE",
        residualAuthority: residualState.disposition === "ALREADY_COMPLETE_EXACT" ? residualState.authority : residualAuthority,
        candidate: candidateDraft,
        shadow: shadowDraft,
        completion: completionState.disposition === "ALREADY_COMPLETE_EXACT" ? completionState.authority : completionAuthority,
        residualDelta: 0, candidateDelta: 0, shadowDelta: 0, completionDelta: 0,
      });
    }
    if (present.some(Boolean)) throw new Error(`CAP08_S5_PARTIAL_CHAIN_DETECTED:${present.map(Number).join("")}`);

    inject("before_residual_set");
    const residualPersistence = await this.sliceRepository.establishResidualSet({
      authority: residualAuthority,
      residuals: sources.residuals,
      fault_injection: input.fault_injection,
    });
    inject("after_residual_set");
    inject("before_candidate_commit");
    const candidatePersistence = await this.governanceRepository.commitCanonicalObject({ object: candidateDraft });
    inject("after_candidate_commit");
    if (candidatePersistence.object.object_type !== "twin_calibration_candidate_v1"
      || candidatePersistence.object.determinism_hash !== candidateDraft.determinism_hash) throw new Error("CAP08_S5_CANDIDATE_READBACK_MISMATCH");
    inject("before_shadow_commit");
    const shadowPersistence = await this.governanceRepository.commitCanonicalObject({ object: shadowDraft });
    inject("after_shadow_commit");
    if (shadowPersistence.object.object_type !== "twin_shadow_evaluation_v1"
      || shadowPersistence.object.determinism_hash !== shadowDraft.determinism_hash) throw new Error("CAP08_S5_SHADOW_READBACK_MISMATCH");
    inject("before_completion_commit");
    const completionPersistence = await this.sliceRepository.establishCompletion({ authority: completionAuthority, fault_injection: input.fault_injection });
    inject("after_completion_commit");
    const candidateDelta: 0 | 1 = candidatePersistence.status === "INSERTED" ? 1 : 0;
    const shadowDelta: 0 | 1 = shadowPersistence.status === "INSERTED" ? 1 : 0;
    if (residualPersistence.write_delta !== 26 || candidateDelta !== 1 || shadowDelta !== 1 || completionPersistence.write_delta !== 2) {
      throw new Error("CAP08_S5_FIRST_COMMIT_DELTA_MISMATCH");
    }
    return this.result({
      status: "COMPLETED",
      residualAuthority: residualPersistence.authority,
      candidate: candidateDraft,
      shadow: shadowDraft,
      completion: completionPersistence.authority,
      residualDelta: 26, candidateDelta: 1, shadowDelta: 1, completionDelta: 2,
    });
  }
}
