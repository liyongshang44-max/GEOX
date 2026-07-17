// Purpose: orchestrate the authorized MCFT-CAP-06 S6 exact Candidate plus eight-case paired historical shadow compute and deterministic rerun.
// Boundary: exact immutable reads and in-memory compute only; no canonical append, projection write, Evaluation draft/commit, active Config, Runtime parameter, State, checkpoint, route, scheduler, or Model Activation authority.

import {
  buildCap06CaseWindowV1,
  type Cap06BuiltCaseWindowV1,
} from "../../domain/calibration/case_builder_v1.js";
import {
  CAP06_HOLDOUT_CASE_COUNT_V1,
  CAP06_PARAMETER_KEY_V1,
  isCap06CandidateAppendingStatusV1,
  type Cap06CalibrationDispositionV1,
  type Cap06PairedShadowResultV1,
  type Cap06SourceDatasetIdentityV1,
} from "../../domain/calibration/contracts_v1.js";
import { runCap06PairedHistoricalShadowV1 } from "../../domain/calibration/shadow_evaluation_v1.js";
import {
  compareIsoInstantV1,
  parseFixedDecimalV1,
} from "../../domain/soil_water/fixed_point_water_decimal_v1.js";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { ResolvedForecastObservationCaseV1 } from "../../domain/twin_runtime/resolved_forecast_observation_case_v1.js";
import type {
  Cap06GovernanceObjectV1,
} from "../../persistence/calibration/postgres_calibration_governance_repository_v1.js";
import { Cap06ResolvedForecastReplayPredictionAdapterV1 } from "./resolved_forecast_replay_prediction_adapter_v1.js";

export const CAP06_PAIRED_HISTORICAL_SHADOW_SERVICE_ID_V1 =
  "MCFT_CAP_06_S6_PAIRED_HISTORICAL_SHADOW_SERVICE_V1" as const;

export type Cap06ExactCandidateReadPortV1 = {
  readCanonicalObject(objectId: string): Promise<Cap06GovernanceObjectV1 | null>;
};

export type Cap06ExactHoldoutCasePortV1 = {
  resolveExactResidualRefs(
    orderedResidualRefs: readonly string[],
  ): Promise<readonly ResolvedForecastObservationCaseV1[]>;
};

export type Cap06PairedHistoricalShadowServiceResultV1 = {
  schema_version: "geox_mcft_cap_06_s6_paired_shadow_service_result_v1";
  service_id: typeof CAP06_PAIRED_HISTORICAL_SHADOW_SERVICE_ID_V1;
  artifact_authority: "NON_CANONICAL_IN_MEMORY_OR_ACCEPTANCE_ARTIFACT";
  candidate_ref: string;
  candidate_hash: string;
  candidate_parameter_value: string;
  ordered_holdout_residual_refs: string[];
  resolved_holdout_case_count: number;
  holdout_window: Cap06BuiltCaseWindowV1;
  paired_shadow_compute_result: Cap06PairedShadowResultV1;
  deterministic_rerun_verified: true;
  canonical_fact_write_count: 0;
  projection_write_count: 0;
  candidate_append_count: 0;
  evaluation_append_count: 0;
  model_activation_count: 0;
  active_config_switch_count: 0;
  runtime_parameter_change_count: 0;
  state_mutation_count: 0;
  checkpoint_mutation_count: 0;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function requiredRecordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function exactHoldoutRefsV1(refs: readonly string[]): string[] {
  if (!Array.isArray(refs) || refs.length !== CAP06_HOLDOUT_CASE_COUNT_V1) {
    throw new Error(`CAP06_S6_EXACT_HOLDOUT_REF_COUNT_REQUIRED:${refs?.length ?? 0}`);
  }
  const normalized = refs.map((ref) => requiredStringV1(
    ref,
    "CAP06_S6_EXACT_HOLDOUT_RESIDUAL_REF_REQUIRED",
  ));
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("CAP06_S6_DUPLICATE_HOLDOUT_RESIDUAL_REF");
  }
  return normalized;
}

function verifyResolvedOrderV1(
  refs: readonly string[],
  cases: readonly ResolvedForecastObservationCaseV1[],
): void {
  if (cases.length !== refs.length) {
    throw new Error(`CAP06_S6_RESOLVED_HOLDOUT_CASE_COUNT_MISMATCH:${cases.length}`);
  }
  for (let index = 0; index < refs.length; index += 1) {
    if (cases[index]?.residual.object_id !== refs[index]
      || cases[index]?.case_source.residual_ref !== refs[index]) {
      throw new Error(`CAP06_S6_RESOLVED_HOLDOUT_ORDER_MISMATCH:${index}`);
    }
  }
}

function verifyCandidateV1(input: {
  object: Cap06GovernanceObjectV1 | null;
  candidateRef: string;
  candidateHash: string;
  sourceDatasetIdentity: Cap06SourceDatasetIdentityV1;
  holdoutRefs: readonly string[];
}): {
  object: Extract<Cap06GovernanceObjectV1, { object_type: "twin_calibration_candidate_v1" }>;
  payload: Record<string, unknown>;
  parameterValue: string;
} {
  const candidate = input.object;
  if (!candidate || candidate.object_type !== "twin_calibration_candidate_v1") {
    throw new Error("CAP06_S6_EXACT_CALIBRATION_CANDIDATE_REQUIRED");
  }
  if (candidate.object_id !== input.candidateRef) {
    throw new Error("CAP06_S6_CANDIDATE_REF_MISMATCH");
  }
  if (candidate.determinism_hash !== input.candidateHash) {
    throw new Error("CAP06_S6_CANDIDATE_HASH_MISMATCH");
  }
  const semantic = structuredClone(candidate);
  semantic.determinism_hash = "";
  if (semanticHashV1(semantic) !== candidate.determinism_hash) {
    throw new Error("CAP06_S6_CANDIDATE_DETERMINISM_HASH_INVALID");
  }
  const payload = requiredRecordV1(candidate.payload, "CAP06_S6_CANDIDATE_PAYLOAD_REQUIRED");
  if (!isCap06CandidateAppendingStatusV1(
    payload.candidate_status as Cap06CalibrationDispositionV1,
  )) {
    throw new Error("CAP06_S6_CANDIDATE_STATUS_NOT_SHADOWABLE");
  }
  if (payload.parameter_key !== CAP06_PARAMETER_KEY_V1) {
    throw new Error("CAP06_S6_CANDIDATE_PARAMETER_KEY_MISMATCH");
  }
  const parameterValue = requiredStringV1(
    payload.candidate_parameter_value,
    "CAP06_S6_CANDIDATE_PARAMETER_VALUE_REQUIRED",
  );
  parseFixedDecimalV1(parameterValue, 6, "CAP06_S6_CANDIDATE_PARAMETER_VALUE_INVALID");

  const identityChecks: Array<[unknown, string, string]> = [
    [payload.source_s1_residual_set_hash, input.sourceDatasetIdentity.residual_set_hash, "RESIDUAL_SET_HASH"],
    [payload.source_s1_case_input_set_hash, input.sourceDatasetIdentity.case_input_set_hash, "CASE_INPUT_SET_HASH"],
    [payload.source_s1_calibration_window_hash, input.sourceDatasetIdentity.calibration_window_hash, "CALIBRATION_WINDOW_HASH"],
    [payload.source_s1_holdout_window_hash, input.sourceDatasetIdentity.holdout_window_hash, "HOLDOUT_WINDOW_HASH"],
    [payload.window_hash_semantics, input.sourceDatasetIdentity.window_hash_semantics, "WINDOW_HASH_SEMANTICS"],
  ];
  for (const [actual, expected, label] of identityChecks) {
    if (actual !== expected) throw new Error(`CAP06_S6_CANDIDATE_SOURCE_IDENTITY_MISMATCH:${label}`);
  }
  const sourceRefs = new Set(candidate.source_refs);
  const leakedHoldoutRef = input.holdoutRefs.find((ref) => sourceRefs.has(ref));
  if (leakedHoldoutRef) {
    throw new Error(`CAP06_S6_CANDIDATE_CONTAINS_HOLDOUT_REF:${leakedHoldoutRef}`);
  }
  return { object: candidate, payload, parameterValue };
}

function verifyCandidateHoldoutBindingV1(input: {
  candidate: Extract<Cap06GovernanceObjectV1, { object_type: "twin_calibration_candidate_v1" }>;
  candidatePayload: Record<string, unknown>;
  holdoutWindow: Cap06BuiltCaseWindowV1;
}): void {
  const candidate = input.candidate;
  const payload = input.candidatePayload;
  const holdout = input.holdoutWindow;
  if (semanticHashV1(candidate.scope) !== semanticHashV1(holdout.scope)) {
    throw new Error("CAP06_S6_CANDIDATE_HOLDOUT_SCOPE_MISMATCH");
  }
  if (candidate.context_lineage_ref !== holdout.context_lineage_ref) {
    throw new Error("CAP06_S6_CANDIDATE_HOLDOUT_LINEAGE_MISMATCH");
  }
  if (candidate.context_revision_ref !== holdout.context_revision_ref) {
    throw new Error("CAP06_S6_CANDIDATE_HOLDOUT_REVISION_MISMATCH");
  }
  const bindings: Array<[unknown, string, string]> = [
    [payload.model_component_set_hash, holdout.model_component_hash, "MODEL_COMPONENT_HASH"],
    [payload.effective_base_parameter_bundle_hash, holdout.effective_parameter_bundle_hash, "BASE_PARAMETER_BUNDLE_HASH"],
    [payload.runtime_replay_numeric_policy_hash, holdout.runtime_replay_numeric_policy_hash, "RUNTIME_NUMERIC_POLICY_HASH"],
    [payload.source_s1_holdout_window_hash, holdout.window_ref_membership_hash, "HOLDOUT_WINDOW_MEMBERSHIP_HASH"],
  ];
  for (const [actual, expected, label] of bindings) {
    if (actual !== expected) throw new Error(`CAP06_S6_CANDIDATE_HOLDOUT_BINDING_MISMATCH:${label}`);
  }
  const minimumHoldoutAvailability = holdout.cases.reduce(
    (earliest, item) => compareIsoInstantV1(item.observation_available_to_runtime_at, earliest) < 0
      ? item.observation_available_to_runtime_at
      : earliest,
    holdout.cases[0].observation_available_to_runtime_at,
  );
  if (compareIsoInstantV1(candidate.as_of, minimumHoldoutAvailability) >= 0) {
    throw new Error("CAP06_S6_CANDIDATE_AS_OF_NOT_BEFORE_MINIMUM_HOLDOUT_AVAILABILITY");
  }
}

export class Cap06PairedHistoricalShadowServiceV1 {
  constructor(
    private readonly candidateReadPort: Cap06ExactCandidateReadPortV1,
    private readonly holdoutCasePort: Cap06ExactHoldoutCasePortV1,
  ) {
    if (!candidateReadPort || typeof candidateReadPort.readCanonicalObject !== "function") {
      throw new Error("CAP06_S6_EXACT_CANDIDATE_READ_PORT_REQUIRED");
    }
    if (!holdoutCasePort || typeof holdoutCasePort.resolveExactResidualRefs !== "function") {
      throw new Error("CAP06_S6_EXACT_HOLDOUT_CASE_PORT_REQUIRED");
    }
  }

  async compute(input: {
    candidateRef: string;
    candidateHash: string;
    orderedHoldoutResidualRefs: readonly string[];
    sourceDatasetIdentity: Cap06SourceDatasetIdentityV1;
  }): Promise<Cap06PairedHistoricalShadowServiceResultV1> {
    const candidateRef = requiredStringV1(input.candidateRef, "CAP06_S6_CANDIDATE_REF_REQUIRED");
    const candidateHash = requiredStringV1(input.candidateHash, "CAP06_S6_CANDIDATE_HASH_REQUIRED");
    const refs = exactHoldoutRefsV1(input.orderedHoldoutResidualRefs);
    const verifiedCandidate = verifyCandidateV1({
      object: await this.candidateReadPort.readCanonicalObject(candidateRef),
      candidateRef,
      candidateHash,
      sourceDatasetIdentity: input.sourceDatasetIdentity,
      holdoutRefs: refs,
    });

    const resolved = await this.holdoutCasePort.resolveExactResidualRefs(refs);
    verifyResolvedOrderV1(refs, resolved);
    const holdoutWindow = buildCap06CaseWindowV1({
      role: "HOLDOUT",
      orderedResidualRefs: refs,
      loadedCases: resolved.map((item) => item.case_source),
      sourceDatasetIdentity: input.sourceDatasetIdentity,
    });
    verifyCandidateHoldoutBindingV1({
      candidate: verifiedCandidate.object,
      candidatePayload: verifiedCandidate.payload,
      holdoutWindow,
    });

    const predictionPort = new Cap06ResolvedForecastReplayPredictionAdapterV1(resolved);
    const first = await runCap06PairedHistoricalShadowV1({
      holdoutWindow,
      candidateParameterValue: verifiedCandidate.parameterValue,
      predictionPort,
    });
    const second = await runCap06PairedHistoricalShadowV1({
      holdoutWindow,
      candidateParameterValue: verifiedCandidate.parameterValue,
      predictionPort,
    });
    if (first.determinism_hash !== second.determinism_hash
      || first.case_results_hash !== second.case_results_hash
      || semanticHashV1(first) !== semanticHashV1(second)) {
      throw new Error("CAP06_S6_SHADOW_COMPUTE_RERUN_MISMATCH");
    }
    if (first.case_results.length !== CAP06_HOLDOUT_CASE_COUNT_V1) {
      throw new Error("CAP06_S6_SHADOW_RESULT_CASE_COUNT_MISMATCH");
    }

    return {
      schema_version: "geox_mcft_cap_06_s6_paired_shadow_service_result_v1",
      service_id: CAP06_PAIRED_HISTORICAL_SHADOW_SERVICE_ID_V1,
      artifact_authority: "NON_CANONICAL_IN_MEMORY_OR_ACCEPTANCE_ARTIFACT",
      candidate_ref: verifiedCandidate.object.object_id,
      candidate_hash: verifiedCandidate.object.determinism_hash,
      candidate_parameter_value: verifiedCandidate.parameterValue,
      ordered_holdout_residual_refs: [...refs],
      resolved_holdout_case_count: resolved.length,
      holdout_window: holdoutWindow,
      paired_shadow_compute_result: first,
      deterministic_rerun_verified: true,
      canonical_fact_write_count: 0,
      projection_write_count: 0,
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
