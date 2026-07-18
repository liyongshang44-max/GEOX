// Purpose: prove that one exact canonical MCFT-CAP-06 Evaluation and its Candidate survive restart and that all governance projections can be rebuilt deterministically from canonical facts.
// Boundary: exact canonical reads and the existing facts-based rebuild only; no canonical commit, shadow recompute, Candidate/Evaluation append, Model Activation, active Config, Runtime parameter, State, checkpoint, route, scheduler, migration, filesystem, or network authority.

import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type {
  Cap06GovernanceObjectV1,
  Cap06GovernanceRecoverySummaryV1,
} from "../../persistence/calibration/postgres_calibration_governance_repository_v1.js";

export const CAP06_RESTART_READBACK_REBUILD_SERVICE_ID_V1 =
  "MCFT_CAP_06_S8_RESTART_READBACK_REBUILD_SERVICE_V1" as const;

export type Cap06RestartReadbackRebuildPortV1 = {
  readCanonicalObject(objectId: string): Promise<Cap06GovernanceObjectV1 | null>;
  rebuildFromFacts(): Promise<Cap06GovernanceRecoverySummaryV1>;
};

export type Cap06RestartReadbackRebuildResultV1 = {
  schema_version: "geox_mcft_cap_06_s8_restart_readback_rebuild_result_v1";
  service_id: typeof CAP06_RESTART_READBACK_REBUILD_SERVICE_ID_V1;
  evaluation_ref: string;
  evaluation_hash: string;
  candidate_ref: string;
  candidate_hash: string;
  evaluation_case_count: 8;
  pre_rebuild_readback_hash: string;
  post_first_rebuild_readback_hash: string;
  post_second_rebuild_readback_hash: string;
  first_rebuild_summary: Cap06GovernanceRecoverySummaryV1;
  second_rebuild_summary: Cap06GovernanceRecoverySummaryV1;
  first_rebuild_summary_hash: string;
  second_rebuild_summary_hash: string;
  exact_readback_verified: true;
  deterministic_second_rebuild_verified: true;
  canonical_fact_append_count: 0;
  canonical_fact_update_count: 0;
  canonical_fact_delete_count: 0;
  candidate_append_count: 0;
  evaluation_append_count: 0;
  model_activation_count: 0;
  active_config_switch_count: 0;
  runtime_parameter_change_count: 0;
  state_mutation_count: 0;
  checkpoint_mutation_count: 0;
};

const EXPECTED_SUMMARY_V1: Cap06GovernanceRecoverySummaryV1 = Object.freeze({
  canonical_objects_scanned: 2,
  idempotency_guards_rebuilt: 2,
  candidate_projections_rebuilt: 1,
  evaluation_projections_rebuilt: 1,
  candidate_evaluation_rows_rebuilt: 1,
  evaluation_case_rows_rebuilt: 8,
});

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function assertSelfHashV1(object: Cap06GovernanceObjectV1, code: string): void {
  const semantic = structuredClone(object);
  semantic.determinism_hash = "";
  if (semanticHashV1(semantic) !== object.determinism_hash) throw new Error(code);
}

function assertSummaryV1(summary: Cap06GovernanceRecoverySummaryV1, code: string): void {
  if (semanticHashV1(summary) !== semanticHashV1(EXPECTED_SUMMARY_V1)) throw new Error(code);
}

function assertEvaluationV1(input: {
  object: Cap06GovernanceObjectV1 | null;
  evaluationRef: string;
  evaluationHash: string;
  candidateRef: string;
  candidateHash: string;
}): Extract<Cap06GovernanceObjectV1, { object_type: "twin_shadow_evaluation_v1" }> {
  const object = input.object;
  if (!object || object.object_type !== "twin_shadow_evaluation_v1") {
    throw new Error("CAP06_S8_EXACT_CANONICAL_EVALUATION_REQUIRED");
  }
  if (object.object_id !== input.evaluationRef) throw new Error("CAP06_S8_EVALUATION_REF_MISMATCH");
  if (object.determinism_hash !== input.evaluationHash) throw new Error("CAP06_S8_EVALUATION_HASH_MISMATCH");
  assertSelfHashV1(object, "CAP06_S8_EVALUATION_DETERMINISM_HASH_INVALID");
  if (object.payload.candidate_ref !== input.candidateRef) throw new Error("CAP06_S8_EVALUATION_CANDIDATE_REF_MISMATCH");
  if (object.payload.candidate_hash !== input.candidateHash) throw new Error("CAP06_S8_EVALUATION_CANDIDATE_HASH_MISMATCH");
  if (!Array.isArray(object.payload.case_results) || object.payload.case_results.length !== 8) {
    throw new Error("CAP06_S8_EVALUATION_CASE_COUNT_MISMATCH");
  }
  if (semanticHashV1(object.payload.case_results) !== object.payload.case_results_hash) {
    throw new Error("CAP06_S8_EVALUATION_CASE_RESULTS_HASH_INVALID");
  }
  if (object.payload.model_activation_created !== false
    || object.payload.active_config_switch_performed !== false
    || object.payload.approval_created !== false
    || object.payload.activation_authorized !== false) {
    throw new Error("CAP06_S8_EVALUATION_NON_ACTIVATION_BOUNDARY_VIOLATION");
  }
  return object;
}

function assertCandidateV1(input: {
  object: Cap06GovernanceObjectV1 | null;
  candidateRef: string;
  candidateHash: string;
}): Extract<Cap06GovernanceObjectV1, { object_type: "twin_calibration_candidate_v1" }> {
  const object = input.object;
  if (!object || object.object_type !== "twin_calibration_candidate_v1") {
    throw new Error("CAP06_S8_EXACT_CANONICAL_CANDIDATE_REQUIRED");
  }
  if (object.object_id !== input.candidateRef) throw new Error("CAP06_S8_CANDIDATE_REF_MISMATCH");
  if (object.determinism_hash !== input.candidateHash) throw new Error("CAP06_S8_CANDIDATE_HASH_MISMATCH");
  assertSelfHashV1(object, "CAP06_S8_CANDIDATE_DETERMINISM_HASH_INVALID");
  return object;
}

function readbackHashV1(input: {
  evaluation: Cap06GovernanceObjectV1;
  candidate: Cap06GovernanceObjectV1;
}): string {
  return semanticHashV1({
    evaluation_ref: input.evaluation.object_id,
    evaluation_hash: input.evaluation.determinism_hash,
    candidate_ref: input.candidate.object_id,
    candidate_hash: input.candidate.determinism_hash,
    evaluation_payload_hash: semanticHashV1(input.evaluation.payload),
    candidate_payload_hash: semanticHashV1(input.candidate.payload),
  });
}

export class Cap06RestartReadbackRebuildServiceV1 {
  constructor(private readonly port: Cap06RestartReadbackRebuildPortV1) {
    if (!port || typeof port.readCanonicalObject !== "function") {
      throw new Error("CAP06_S8_EXACT_CANONICAL_READ_PORT_REQUIRED");
    }
    if (typeof port.rebuildFromFacts !== "function") {
      throw new Error("CAP06_S8_FACTS_REBUILD_PORT_REQUIRED");
    }
  }

  async recover(input: {
    evaluationRef: string;
    evaluationHash: string;
    candidateRef: string;
    candidateHash: string;
  }): Promise<Cap06RestartReadbackRebuildResultV1> {
    const evaluationRef = requiredStringV1(input.evaluationRef, "CAP06_S8_EVALUATION_REF_REQUIRED");
    const evaluationHash = requiredStringV1(input.evaluationHash, "CAP06_S8_EVALUATION_HASH_REQUIRED");
    const candidateRef = requiredStringV1(input.candidateRef, "CAP06_S8_CANDIDATE_REF_REQUIRED");
    const candidateHash = requiredStringV1(input.candidateHash, "CAP06_S8_CANDIDATE_HASH_REQUIRED");

    const beforeEvaluation = assertEvaluationV1({
      object: await this.port.readCanonicalObject(evaluationRef),
      evaluationRef,
      evaluationHash,
      candidateRef,
      candidateHash,
    });
    const beforeCandidate = assertCandidateV1({
      object: await this.port.readCanonicalObject(candidateRef),
      candidateRef,
      candidateHash,
    });
    const beforeHash = readbackHashV1({ evaluation: beforeEvaluation, candidate: beforeCandidate });

    const firstSummary = await this.port.rebuildFromFacts();
    assertSummaryV1(firstSummary, "CAP06_S8_FIRST_REBUILD_SUMMARY_MISMATCH");
    const firstEvaluation = assertEvaluationV1({
      object: await this.port.readCanonicalObject(evaluationRef),
      evaluationRef,
      evaluationHash,
      candidateRef,
      candidateHash,
    });
    const firstCandidate = assertCandidateV1({
      object: await this.port.readCanonicalObject(candidateRef),
      candidateRef,
      candidateHash,
    });
    const firstHash = readbackHashV1({ evaluation: firstEvaluation, candidate: firstCandidate });
    if (firstHash !== beforeHash) throw new Error("CAP06_S8_FIRST_REBUILD_READBACK_DIVERGENCE");

    const secondSummary = await this.port.rebuildFromFacts();
    assertSummaryV1(secondSummary, "CAP06_S8_SECOND_REBUILD_SUMMARY_MISMATCH");
    if (semanticHashV1(secondSummary) !== semanticHashV1(firstSummary)) {
      throw new Error("CAP06_S8_SECOND_REBUILD_SUMMARY_DIVERGENCE");
    }
    const secondEvaluation = assertEvaluationV1({
      object: await this.port.readCanonicalObject(evaluationRef),
      evaluationRef,
      evaluationHash,
      candidateRef,
      candidateHash,
    });
    const secondCandidate = assertCandidateV1({
      object: await this.port.readCanonicalObject(candidateRef),
      candidateRef,
      candidateHash,
    });
    const secondHash = readbackHashV1({ evaluation: secondEvaluation, candidate: secondCandidate });
    if (secondHash !== firstHash) throw new Error("CAP06_S8_SECOND_REBUILD_READBACK_DIVERGENCE");

    return {
      schema_version: "geox_mcft_cap_06_s8_restart_readback_rebuild_result_v1",
      service_id: CAP06_RESTART_READBACK_REBUILD_SERVICE_ID_V1,
      evaluation_ref: evaluationRef,
      evaluation_hash: evaluationHash,
      candidate_ref: candidateRef,
      candidate_hash: candidateHash,
      evaluation_case_count: 8,
      pre_rebuild_readback_hash: beforeHash,
      post_first_rebuild_readback_hash: firstHash,
      post_second_rebuild_readback_hash: secondHash,
      first_rebuild_summary: structuredClone(firstSummary),
      second_rebuild_summary: structuredClone(secondSummary),
      first_rebuild_summary_hash: semanticHashV1(firstSummary),
      second_rebuild_summary_hash: semanticHashV1(secondSummary),
      exact_readback_verified: true,
      deterministic_second_rebuild_verified: true,
      canonical_fact_append_count: 0,
      canonical_fact_update_count: 0,
      canonical_fact_delete_count: 0,
      candidate_append_count: 0,
      evaluation_append_count: 0,
      model_activation_count: 0,
      active_config_switch_count: 0,
      runtime_parameter_change_count: 0,
      state_mutation_count: 0,
      checkpoint_mutation_count: 0,
    };
  }
}
