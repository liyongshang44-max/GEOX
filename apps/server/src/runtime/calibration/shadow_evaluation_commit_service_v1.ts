// Purpose: validate one complete S6 paired-shadow artifact, build the deterministic S7 Shadow Evaluation draft, commit it through the existing S3 D transaction, and require canonical readback.
// Boundary: exact Candidate read plus one Evaluation append only; no shadow recompute, Candidate append, Model Activation, active Config, Runtime parameter, State, checkpoint, approval, route, scheduler, or external network authority.

import {
  buildCap06ShadowEvaluationDraftV1,
  type Cap06CalibrationCandidateDraftV1,
  type Cap06ShadowEvaluationDraftV1,
} from "../../domain/calibration/envelope_profiles_v1.js";
import { CAP06_HOLDOUT_CASE_COUNT_V1 } from "../../domain/calibration/contracts_v1.js";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type {
  Cap06GovernanceObjectV1,
  Cap06GovernancePersistenceResultV1,
  Cap06GovernancePersistenceStatusV1,
} from "../../persistence/calibration/postgres_calibration_governance_repository_v1.js";
import {
  CAP06_PAIRED_HISTORICAL_SHADOW_SERVICE_ID_V1,
  type Cap06PairedHistoricalShadowServiceResultV1,
} from "./paired_historical_shadow_service_v1.js";

export const CAP06_SHADOW_EVALUATION_COMMIT_SERVICE_ID_V1 =
  "MCFT_CAP_06_S7_SHADOW_EVALUATION_COMMIT_SERVICE_V1" as const;

export type Cap06ShadowEvaluationCommitPortV1 = {
  readCanonicalObject(objectId: string): Promise<Cap06GovernanceObjectV1 | null>;
  commitCanonicalObject(input: {
    object: Cap06GovernanceObjectV1;
  }): Promise<Cap06GovernancePersistenceResultV1>;
};

export type Cap06ShadowEvaluationCommitServiceResultV1 = {
  schema_version: "geox_mcft_cap_06_s7_shadow_evaluation_commit_service_result_v1";
  service_id: typeof CAP06_SHADOW_EVALUATION_COMMIT_SERVICE_ID_V1;
  source_s6_artifact_hash: string;
  source_s6_compute_determinism_hash: string;
  source_s6_case_results_hash: string;
  candidate_ref: string;
  candidate_hash: string;
  evaluation_ref: string;
  evaluation_hash: string;
  evaluation_disposition: string;
  reason_codes: string[];
  holdout_case_count: number;
  persistence_status: Cap06GovernancePersistenceStatusV1;
  canonical_readback_verified: true;
  evaluation_append_count: 0 | 1;
  aggregate_projection_row_count: 0 | 1;
  candidate_evaluation_index_row_count: 0 | 1;
  case_projection_row_count: 0 | 8;
  projection_row_count: 0 | 10;
  candidate_append_count: 0;
  model_activation_count: 0;
  active_config_switch_count: 0;
  runtime_parameter_change_count: 0;
  state_mutation_count: 0;
  checkpoint_mutation_count: 0;
};

function assertEqualV1(actual: unknown, expected: unknown, code: string): void {
  if (actual !== expected) throw new Error(code);
}

function assertStringArrayV1(value: unknown, expectedCount: number, code: string): string[] {
  if (!Array.isArray(value) || value.length !== expectedCount) throw new Error(code);
  const result = value.map((item) => {
    if (typeof item !== "string" || !item) throw new Error(code);
    return item;
  });
  if (new Set(result).size !== result.length) throw new Error(`${code}_DUPLICATE`);
  return result;
}

function validateSelfHashV1(value: { determinism_hash: string }, code: string): void {
  const semantic = structuredClone(value);
  semantic.determinism_hash = "";
  if (semanticHashV1(semantic) !== value.determinism_hash) throw new Error(code);
}

function validateCaseWindowHashV1(
  window: Cap06PairedHistoricalShadowServiceResultV1["holdout_window"],
): void {
  const { determinism_hash: declaredHash, ...semantic } = window;
  if (semanticHashV1(semantic) !== declaredHash) {
    throw new Error("CAP06_S7_S6_HOLDOUT_WINDOW_DETERMINISM_HASH_INVALID");
  }
}

function validateShadowHashV1(
  shadow: Cap06PairedHistoricalShadowServiceResultV1["paired_shadow_compute_result"],
): void {
  const { determinism_hash: declaredHash, ...semantic } = shadow;
  if (semanticHashV1(semantic) !== declaredHash) {
    throw new Error("CAP06_S7_S6_COMPUTE_DETERMINISM_HASH_INVALID");
  }
  if (semanticHashV1(shadow.case_results) !== shadow.case_results_hash) {
    throw new Error("CAP06_S7_S6_CASE_RESULTS_HASH_INVALID");
  }
}

function validateS6ArtifactV1(
  artifact: Cap06PairedHistoricalShadowServiceResultV1,
): string {
  assertEqualV1(
    artifact.schema_version,
    "geox_mcft_cap_06_s6_paired_shadow_service_result_v1",
    "CAP06_S7_S6_ARTIFACT_SCHEMA_MISMATCH",
  );
  assertEqualV1(
    artifact.service_id,
    CAP06_PAIRED_HISTORICAL_SHADOW_SERVICE_ID_V1,
    "CAP06_S7_S6_ARTIFACT_SERVICE_MISMATCH",
  );
  assertEqualV1(
    artifact.artifact_authority,
    "NON_CANONICAL_IN_MEMORY_OR_ACCEPTANCE_ARTIFACT",
    "CAP06_S7_S6_ARTIFACT_AUTHORITY_MISMATCH",
  );
  assertEqualV1(artifact.deterministic_rerun_verified, true, "CAP06_S7_S6_RERUN_PROOF_REQUIRED");
  assertEqualV1(
    artifact.resolved_holdout_case_count,
    CAP06_HOLDOUT_CASE_COUNT_V1,
    "CAP06_S7_S6_HOLDOUT_CASE_COUNT_MISMATCH",
  );
  const refs = assertStringArrayV1(
    artifact.ordered_holdout_residual_refs,
    CAP06_HOLDOUT_CASE_COUNT_V1,
    "CAP06_S7_S6_HOLDOUT_REFS_INVALID",
  );
  assertEqualV1(artifact.holdout_window.role, "HOLDOUT", "CAP06_S7_S6_HOLDOUT_WINDOW_REQUIRED");
  assertEqualV1(
    artifact.holdout_window.cases.length,
    CAP06_HOLDOUT_CASE_COUNT_V1,
    "CAP06_S7_S6_HOLDOUT_WINDOW_CASE_COUNT_MISMATCH",
  );
  validateCaseWindowHashV1(artifact.holdout_window);
  if (semanticHashV1(artifact.holdout_window.ordered_residual_refs) !== semanticHashV1(refs)) {
    throw new Error("CAP06_S7_S6_HOLDOUT_REF_ORDER_MISMATCH");
  }
  assertEqualV1(
    artifact.paired_shadow_compute_result.schema_version,
    "geox_mcft_cap_06_paired_shadow_compute_result_v1",
    "CAP06_S7_S6_SHADOW_SCHEMA_MISMATCH",
  );
  assertEqualV1(
    artifact.paired_shadow_compute_result.candidate_parameter_value,
    artifact.candidate_parameter_value,
    "CAP06_S7_S6_CANDIDATE_PARAMETER_MISMATCH",
  );
  assertEqualV1(
    artifact.paired_shadow_compute_result.case_results.length,
    CAP06_HOLDOUT_CASE_COUNT_V1,
    "CAP06_S7_S6_CASE_RESULTS_COUNT_MISMATCH",
  );
  for (let index = 0; index < refs.length; index += 1) {
    const caseResult = artifact.paired_shadow_compute_result.case_results[index];
    const caseItem = artifact.holdout_window.cases[index];
    if (caseResult?.residual_ref !== refs[index]
      || caseItem?.residual_ref !== refs[index]
      || caseResult?.candidate_parameter_value !== artifact.candidate_parameter_value) {
      throw new Error(`CAP06_S7_S6_CASE_BINDING_MISMATCH:${index}`);
    }
  }
  validateShadowHashV1(artifact.paired_shadow_compute_result);
  for (const [key, value] of Object.entries({
    canonical_fact_write_count: artifact.canonical_fact_write_count,
    projection_write_count: artifact.projection_write_count,
    candidate_append_count: artifact.candidate_append_count,
    evaluation_append_count: artifact.evaluation_append_count,
    model_activation_count: artifact.model_activation_count,
    active_config_switch_count: artifact.active_config_switch_count,
    runtime_parameter_change_count: artifact.runtime_parameter_change_count,
    state_mutation_count: artifact.state_mutation_count,
    checkpoint_mutation_count: artifact.checkpoint_mutation_count,
  })) {
    if (value !== 0) throw new Error(`CAP06_S7_S6_ARTIFACT_${key.toUpperCase()}_NONZERO`);
  }
  return semanticHashV1(artifact);
}

function validateCandidateAgainstArtifactV1(input: {
  candidate: Cap06GovernanceObjectV1 | null;
  artifact: Cap06PairedHistoricalShadowServiceResultV1;
}): Cap06CalibrationCandidateDraftV1 {
  const candidate = input.candidate;
  if (!candidate || candidate.object_type !== "twin_calibration_candidate_v1") {
    throw new Error("CAP06_S7_EXACT_CANONICAL_CANDIDATE_REQUIRED");
  }
  assertEqualV1(candidate.object_id, input.artifact.candidate_ref, "CAP06_S7_CANDIDATE_REF_MISMATCH");
  assertEqualV1(candidate.determinism_hash, input.artifact.candidate_hash, "CAP06_S7_CANDIDATE_HASH_MISMATCH");
  validateSelfHashV1(candidate, "CAP06_S7_CANDIDATE_DETERMINISM_HASH_INVALID");
  assertEqualV1(
    candidate.payload.candidate_parameter_value,
    input.artifact.candidate_parameter_value,
    "CAP06_S7_CANDIDATE_PARAMETER_VALUE_MISMATCH",
  );
  if (semanticHashV1(candidate.scope) !== semanticHashV1(input.artifact.holdout_window.scope)) {
    throw new Error("CAP06_S7_CANDIDATE_HOLDOUT_SCOPE_MISMATCH");
  }
  assertEqualV1(
    candidate.context_lineage_ref,
    input.artifact.holdout_window.context_lineage_ref,
    "CAP06_S7_CANDIDATE_HOLDOUT_LINEAGE_MISMATCH",
  );
  assertEqualV1(
    candidate.context_revision_ref,
    input.artifact.holdout_window.context_revision_ref,
    "CAP06_S7_CANDIDATE_HOLDOUT_REVISION_MISMATCH",
  );
  assertEqualV1(
    candidate.payload.model_component_set_hash,
    input.artifact.holdout_window.model_component_hash,
    "CAP06_S7_CANDIDATE_HOLDOUT_MODEL_COMPONENT_HASH_MISMATCH",
  );
  assertEqualV1(
    candidate.payload.effective_base_parameter_bundle_hash,
    input.artifact.holdout_window.effective_parameter_bundle_hash,
    "CAP06_S7_CANDIDATE_HOLDOUT_PARAMETER_BUNDLE_HASH_MISMATCH",
  );
  assertEqualV1(
    candidate.payload.runtime_replay_numeric_policy_hash,
    input.artifact.holdout_window.runtime_replay_numeric_policy_hash,
    "CAP06_S7_CANDIDATE_HOLDOUT_NUMERIC_POLICY_HASH_MISMATCH",
  );
  assertEqualV1(
    candidate.payload.source_s1_residual_set_hash,
    input.artifact.holdout_window.source_s1_residual_set_hash,
    "CAP06_S7_CANDIDATE_SOURCE_RESIDUAL_SET_HASH_MISMATCH",
  );
  assertEqualV1(
    candidate.payload.source_s1_case_input_set_hash,
    input.artifact.holdout_window.source_s1_case_input_set_hash,
    "CAP06_S7_CANDIDATE_SOURCE_CASE_INPUT_SET_HASH_MISMATCH",
  );
  assertEqualV1(
    candidate.payload.source_s1_calibration_window_hash,
    input.artifact.holdout_window.source_s1_calibration_window_hash,
    "CAP06_S7_CANDIDATE_SOURCE_CALIBRATION_WINDOW_HASH_MISMATCH",
  );
  assertEqualV1(
    candidate.payload.source_s1_holdout_window_hash,
    input.artifact.holdout_window.window_ref_membership_hash,
    "CAP06_S7_CANDIDATE_HOLDOUT_MEMBERSHIP_HASH_MISMATCH",
  );
  assertEqualV1(
    candidate.payload.window_hash_semantics,
    input.artifact.holdout_window.window_hash_semantics,
    "CAP06_S7_CANDIDATE_WINDOW_HASH_SEMANTICS_MISMATCH",
  );
  return candidate;
}

function validateEvaluationDraftV1(input: {
  draft: Cap06ShadowEvaluationDraftV1;
  artifact: Cap06PairedHistoricalShadowServiceResultV1;
}): void {
  validateSelfHashV1(input.draft, "CAP06_S7_EVALUATION_DETERMINISM_HASH_INVALID");
  assertEqualV1(input.draft.payload.candidate_ref, input.artifact.candidate_ref, "CAP06_S7_EVALUATION_CANDIDATE_REF_MISMATCH");
  assertEqualV1(input.draft.payload.candidate_hash, input.artifact.candidate_hash, "CAP06_S7_EVALUATION_CANDIDATE_HASH_MISMATCH");
  assertEqualV1(
    input.draft.payload.case_results_hash,
    input.artifact.paired_shadow_compute_result.case_results_hash,
    "CAP06_S7_EVALUATION_CASE_RESULTS_HASH_MISMATCH",
  );
  assertEqualV1(
    input.draft.payload.compute_determinism_hash,
    input.artifact.paired_shadow_compute_result.determinism_hash,
    "CAP06_S7_EVALUATION_COMPUTE_HASH_MISMATCH",
  );
  assertEqualV1(
    input.draft.payload.evaluation_disposition,
    input.artifact.paired_shadow_compute_result.evaluation_disposition,
    "CAP06_S7_EVALUATION_DISPOSITION_MISMATCH",
  );
  if (semanticHashV1(input.draft.payload.reason_codes)
    !== semanticHashV1(input.artifact.paired_shadow_compute_result.reason_codes)) {
    throw new Error("CAP06_S7_EVALUATION_REASON_CODES_MISMATCH");
  }
  assertEqualV1(input.draft.payload.model_activation_created, false, "CAP06_S7_MODEL_ACTIVATION_FORBIDDEN");
  assertEqualV1(input.draft.payload.active_config_switch_performed, false, "CAP06_S7_ACTIVE_CONFIG_SWITCH_FORBIDDEN");
  assertEqualV1(input.draft.payload.approval_created, false, "CAP06_S7_APPROVAL_CREATION_FORBIDDEN");
  assertEqualV1(input.draft.payload.activation_authorized, false, "CAP06_S7_ACTIVATION_AUTHORITY_FORBIDDEN");
}

export class Cap06ShadowEvaluationCommitServiceV1 {
  constructor(private readonly port: Cap06ShadowEvaluationCommitPortV1) {
    if (!port || typeof port.readCanonicalObject !== "function") {
      throw new Error("CAP06_S7_EXACT_CANONICAL_READ_PORT_REQUIRED");
    }
    if (typeof port.commitCanonicalObject !== "function") {
      throw new Error("CAP06_S7_EVALUATION_COMMIT_PORT_REQUIRED");
    }
  }

  async commit(input: {
    s6Artifact: Cap06PairedHistoricalShadowServiceResultV1;
  }): Promise<Cap06ShadowEvaluationCommitServiceResultV1> {
    const artifactHash = validateS6ArtifactV1(input.s6Artifact);
    const candidate = validateCandidateAgainstArtifactV1({
      candidate: await this.port.readCanonicalObject(input.s6Artifact.candidate_ref),
      artifact: input.s6Artifact,
    });
    const evaluation = buildCap06ShadowEvaluationDraftV1({
      holdoutWindow: input.s6Artifact.holdout_window,
      candidate,
      shadow: input.s6Artifact.paired_shadow_compute_result,
    });
    validateEvaluationDraftV1({ draft: evaluation, artifact: input.s6Artifact });

    const persisted = await this.port.commitCanonicalObject({ object: evaluation });
    if (persisted.object.object_type !== "twin_shadow_evaluation_v1"
      || persisted.object.object_id !== evaluation.object_id
      || persisted.object.determinism_hash !== evaluation.determinism_hash) {
      throw new Error("CAP06_S7_PERSISTENCE_RESULT_MISMATCH");
    }
    const readback = await this.port.readCanonicalObject(evaluation.object_id);
    if (!readback || readback.object_type !== "twin_shadow_evaluation_v1"
      || readback.determinism_hash !== evaluation.determinism_hash) {
      throw new Error("CAP06_S7_CANONICAL_READBACK_MISMATCH");
    }
    validateSelfHashV1(readback, "CAP06_S7_CANONICAL_READBACK_HASH_INVALID");

    const inserted = persisted.status === "INSERTED";
    return {
      schema_version: "geox_mcft_cap_06_s7_shadow_evaluation_commit_service_result_v1",
      service_id: CAP06_SHADOW_EVALUATION_COMMIT_SERVICE_ID_V1,
      source_s6_artifact_hash: artifactHash,
      source_s6_compute_determinism_hash: input.s6Artifact.paired_shadow_compute_result.determinism_hash,
      source_s6_case_results_hash: input.s6Artifact.paired_shadow_compute_result.case_results_hash,
      candidate_ref: candidate.object_id,
      candidate_hash: candidate.determinism_hash,
      evaluation_ref: evaluation.object_id,
      evaluation_hash: evaluation.determinism_hash,
      evaluation_disposition: String(evaluation.payload.evaluation_disposition),
      reason_codes: [...(evaluation.payload.reason_codes as string[])],
      holdout_case_count: input.s6Artifact.resolved_holdout_case_count,
      persistence_status: persisted.status,
      canonical_readback_verified: true,
      evaluation_append_count: inserted ? 1 : 0,
      aggregate_projection_row_count: inserted ? 1 : 0,
      candidate_evaluation_index_row_count: inserted ? 1 : 0,
      case_projection_row_count: inserted ? 8 : 0,
      projection_row_count: inserted ? 10 : 0,
      candidate_append_count: 0,
      model_activation_count: 0,
      active_config_switch_count: 0,
      runtime_parameter_change_count: 0,
      state_mutation_count: 0,
      checkpoint_mutation_count: 0,
    };
  }
}
