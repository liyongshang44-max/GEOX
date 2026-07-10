// apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v1.ts
// Purpose: define and validate the immutable MCFT-CAP-03 observation-assimilation contract vocabulary without changing MCFT-CAP-02 continuation contracts.
// Boundary: pure contract validation only; no Evidence selection, duplicate resolution, assimilation math, persistence, filesystem, clock, network, or Runtime orchestration.

export const ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1 =
  "MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1" as const;

export const ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_CONTRACT_ID_V1 =
  "MCFT_CAP_03_ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_V1" as const;

export const ASSIMILATED_CONTINUATION_RESIDUAL_KIND_V1 =
  "STATE_OBSERVATION_INNOVATION" as const;

export const ASSIMILATED_CONTINUATION_CANDIDATE_ASSESSMENTS_V1 = [
  "ELIGIBLE",
  "SELECTED",
  "NOT_SELECTED_OLDER_USABLE",
  "IDENTICAL_DUPLICATE_SUPPRESSED",
  "REJECTED_SCOPE",
  "REJECTED_TIME_FUTURE",
  "REJECTED_TIME_LATE",
  "REJECTED_TIME_STALE",
  "REJECTED_UNAUTHORIZED_BINDING",
  "REJECTED_RECORD_TYPE",
  "REJECTED_QUANTITY",
  "REJECTED_CANONICAL_UNIT",
  "REJECTED_PHYSICAL_BOUNDS",
  "REJECTED_QUALITY_FAIL",
] as const;

export type AssimilatedContinuationCandidateAssessmentV1 =
  (typeof ASSIMILATED_CONTINUATION_CANDIDATE_ASSESSMENTS_V1)[number];

export const ASSIMILATED_CONTINUATION_UPDATE_STATUSES_V1 = [
  "APPLIED",
  "NOT_APPLIED",
] as const;

export type AssimilatedContinuationUpdateStatusV1 =
  (typeof ASSIMILATED_CONTINUATION_UPDATE_STATUSES_V1)[number];

export const ASSIMILATED_CONTINUATION_UPDATE_DISPOSITIONS_V1 = [
  "ACCEPTED",
  "DOWNWEIGHTED",
  "REJECTED_OUTLIER",
  "NO_USABLE_OBSERVATION",
] as const;

export type AssimilatedContinuationUpdateDispositionV1 =
  (typeof ASSIMILATED_CONTINUATION_UPDATE_DISPOSITIONS_V1)[number];

export type AssimilatedObservationCandidateV1 = {
  observation_ref: string;
  source_record_id: string;
  source_record_hash: string;
  observation_semantic_content_hash: string;
  record_type: "soil_moisture_observation_v1";
  epistemic_class: "OBSERVED";
  observed_at: string;
  available_to_runtime_at: string;
  ingested_at: string;
  binding_id: string;
  quantity_kind: "VOLUMETRIC_WATER_CONTENT";
  source_unit: string;
  canonical_unit: "fraction";
  conversion_rule: { id: string; version: string };
  canonical_payload: { unit: "fraction"; value: number };
  canonical_value: number;
  quality_status: "PASS" | "LIMITED" | "FAIL";
  temporal_offset_seconds: number;
  candidate_assessment: AssimilatedContinuationCandidateAssessmentV1;
  reason_codes: string[];
};

export type AssimilatedContinuationUpdatePayloadV1 = {
  status: AssimilatedContinuationUpdateStatusV1;
  disposition: AssimilatedContinuationUpdateDispositionV1;
  policy_id: string;
  record_set_contract_id: typeof ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1;
  assimilation_method_id: "SCALAR_GAUSSIAN_ASSIMILATION_V1";
  observation_selector_id: "LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V1";
  candidate_observations: AssimilatedObservationCandidateV1[];
  selected_observation_ref: string | null;
  evaluated_observation_refs: string[];
  applied_observation_refs: string[];
  consumed_observation_refs: string[];
  observation_operator: {
    id: "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1";
    h: 1;
    direct_state_equivalence: false;
  };
  predicted_observation: number | null;
  actual_observation: number | null;
  innovation: number | null;
  residual: number | null;
  residual_kind: typeof ASSIMILATED_CONTINUATION_RESIDUAL_KIND_V1;
  innovation_variance: number | null;
  normalized_innovation: number | null;
  squared_normalized_innovation: number | null;
  threshold_decision_basis: "INNOVATION_SQUARED_LE_16_TIMES_VARIANCE";
  prior_mean: number;
  prior_variance: number;
  observation_variance: number | null;
  candidate_assimilation_gain: number | null;
  applied_assimilation_gain: number | null;
  candidate_unclipped_posterior_mean: number | null;
  candidate_posterior_variance: number | null;
  published_posterior_mean: number;
  published_posterior_variance: number;
  state_correction_vwc: number;
  state_correction_storage_mm: number;
  clipping: {
    applied: boolean;
    lower_bound: 0;
    upper_bound: number;
    delta: number;
  };
  state_transition_ref: string;
  posterior_state_ref: string;
  runtime_config_ref: string;
  runtime_config_hash: string;
  model_parameter_change_applied: false;
  reason_codes: string[];
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function requiredRecordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function requiredArrayV1(value: unknown, code: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(code);
  return value;
}

function requiredFiniteNumberV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
}

function requiredNullableFiniteNumberV1(value: unknown, code: string): number | null {
  if (value === null) return null;
  return requiredFiniteNumberV1(value, code);
}

function requiredCanonicalIsoV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function exactArrayV1(actual: unknown, expected: readonly unknown[], code: string): void {
  if (!Array.isArray(actual) || JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(code);
}

function exactNullV1(value: unknown, code: string): void {
  if (value !== null) throw new Error(code);
}

function validateStringArrayV1(value: unknown, code: string): string[] {
  const items = requiredArrayV1(value, code);
  for (const item of items) requiredStringV1(item, `${code}_ITEM_REQUIRED`);
  return items as string[];
}

export function validateAssimilatedObservationCandidateV1(
  value: unknown,
): asserts value is AssimilatedObservationCandidateV1 {
  const candidate = requiredRecordV1(value, "ASSIMILATION_CANDIDATE_REQUIRED");
  for (const field of [
    "observation_ref",
    "source_record_id",
    "source_record_hash",
    "observation_semantic_content_hash",
    "binding_id",
    "source_unit",
  ]) requiredStringV1(candidate[field], `ASSIMILATION_CANDIDATE_${field.toUpperCase()}_REQUIRED`);

  if (candidate.record_type !== "soil_moisture_observation_v1") throw new Error("ASSIMILATION_CANDIDATE_RECORD_TYPE_MISMATCH");
  if (candidate.epistemic_class !== "OBSERVED") throw new Error("ASSIMILATION_CANDIDATE_EPISTEMIC_CLASS_MISMATCH");
  if (candidate.quantity_kind !== "VOLUMETRIC_WATER_CONTENT") throw new Error("ASSIMILATION_CANDIDATE_QUANTITY_MISMATCH");
  if (candidate.canonical_unit !== "fraction") throw new Error("ASSIMILATION_CANDIDATE_CANONICAL_UNIT_MISMATCH");
  requiredCanonicalIsoV1(candidate.observed_at, "ASSIMILATION_CANDIDATE_OBSERVED_AT_INVALID");
  requiredCanonicalIsoV1(candidate.available_to_runtime_at, "ASSIMILATION_CANDIDATE_AVAILABLE_AT_INVALID");
  requiredCanonicalIsoV1(candidate.ingested_at, "ASSIMILATION_CANDIDATE_INGESTED_AT_INVALID");

  const conversion = requiredRecordV1(candidate.conversion_rule, "ASSIMILATION_CANDIDATE_CONVERSION_RULE_REQUIRED");
  requiredStringV1(conversion.id, "ASSIMILATION_CANDIDATE_CONVERSION_ID_REQUIRED");
  requiredStringV1(conversion.version, "ASSIMILATION_CANDIDATE_CONVERSION_VERSION_REQUIRED");

  const canonicalPayload = requiredRecordV1(candidate.canonical_payload, "ASSIMILATION_CANDIDATE_CANONICAL_PAYLOAD_REQUIRED");
  if (canonicalPayload.unit !== "fraction") throw new Error("ASSIMILATION_CANDIDATE_PAYLOAD_UNIT_MISMATCH");
  const payloadValue = requiredFiniteNumberV1(canonicalPayload.value, "ASSIMILATION_CANDIDATE_PAYLOAD_VALUE_NON_FINITE");
  const canonicalValue = requiredFiniteNumberV1(candidate.canonical_value, "ASSIMILATION_CANDIDATE_CANONICAL_VALUE_NON_FINITE");
  if (payloadValue !== canonicalValue) throw new Error("ASSIMILATION_CANDIDATE_CANONICAL_VALUE_MISMATCH");

  if (!["PASS", "LIMITED", "FAIL"].includes(String(candidate.quality_status))) throw new Error("ASSIMILATION_CANDIDATE_QUALITY_STATUS_UNKNOWN");
  const temporalOffset = requiredFiniteNumberV1(candidate.temporal_offset_seconds, "ASSIMILATION_CANDIDATE_TEMPORAL_OFFSET_NON_FINITE");
  if (!Number.isInteger(temporalOffset)) throw new Error("ASSIMILATION_CANDIDATE_TEMPORAL_OFFSET_NOT_INTEGER");
  if (!ASSIMILATED_CONTINUATION_CANDIDATE_ASSESSMENTS_V1.includes(candidate.candidate_assessment as AssimilatedContinuationCandidateAssessmentV1)) {
    throw new Error("ASSIMILATION_CANDIDATE_ASSESSMENT_UNKNOWN");
  }
  validateStringArrayV1(candidate.reason_codes, "ASSIMILATION_CANDIDATE_REASON_CODES_REQUIRED");
}

export function validateAssimilatedContinuationUpdatePayloadV1(
  value: unknown,
): asserts value is AssimilatedContinuationUpdatePayloadV1 {
  const payload = requiredRecordV1(value, "ASSIMILATION_UPDATE_PAYLOAD_REQUIRED");
  if (!ASSIMILATED_CONTINUATION_UPDATE_STATUSES_V1.includes(payload.status as AssimilatedContinuationUpdateStatusV1)) throw new Error("ASSIMILATION_UPDATE_STATUS_UNKNOWN");
  if (!ASSIMILATED_CONTINUATION_UPDATE_DISPOSITIONS_V1.includes(payload.disposition as AssimilatedContinuationUpdateDispositionV1)) throw new Error("ASSIMILATION_UPDATE_DISPOSITION_UNKNOWN");
  if (payload.record_set_contract_id !== ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1) throw new Error("ASSIMILATION_RECORD_SET_CONTRACT_MISMATCH");
  if (payload.assimilation_method_id !== "SCALAR_GAUSSIAN_ASSIMILATION_V1") throw new Error("ASSIMILATION_METHOD_MISMATCH");
  if (payload.observation_selector_id !== "LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V1") throw new Error("ASSIMILATION_SELECTOR_MISMATCH");
  requiredStringV1(payload.policy_id, "ASSIMILATION_POLICY_ID_REQUIRED");

  const candidates = requiredArrayV1(payload.candidate_observations, "ASSIMILATION_CANDIDATES_REQUIRED");
  for (const candidate of candidates) validateAssimilatedObservationCandidateV1(candidate);
  const evaluated = validateStringArrayV1(payload.evaluated_observation_refs, "ASSIMILATION_EVALUATED_REFS_REQUIRED");
  const applied = validateStringArrayV1(payload.applied_observation_refs, "ASSIMILATION_APPLIED_REFS_REQUIRED");
  const consumed = validateStringArrayV1(payload.consumed_observation_refs, "ASSIMILATION_CONSUMED_REFS_REQUIRED");
  if (JSON.stringify(applied) !== JSON.stringify(consumed)) throw new Error("ASSIMILATION_CONSUMED_REFS_MUST_EQUAL_APPLIED_REFS");

  const operator = requiredRecordV1(payload.observation_operator, "ASSIMILATION_OBSERVATION_OPERATOR_REQUIRED");
  if (operator.id !== "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1") throw new Error("ASSIMILATION_OBSERVATION_OPERATOR_ID_MISMATCH");
  if (operator.h !== 1 || operator.direct_state_equivalence !== false) throw new Error("ASSIMILATION_OBSERVATION_OPERATOR_SEMANTICS_MISMATCH");

  const priorMean = requiredFiniteNumberV1(payload.prior_mean, "ASSIMILATION_PRIOR_MEAN_NON_FINITE");
  const priorVariance = requiredFiniteNumberV1(payload.prior_variance, "ASSIMILATION_PRIOR_VARIANCE_NON_FINITE");
  if (priorVariance < 0) throw new Error("ASSIMILATION_PRIOR_VARIANCE_NEGATIVE");
  const publishedMean = requiredFiniteNumberV1(payload.published_posterior_mean, "ASSIMILATION_PUBLISHED_MEAN_NON_FINITE");
  const publishedVariance = requiredFiniteNumberV1(payload.published_posterior_variance, "ASSIMILATION_PUBLISHED_VARIANCE_NON_FINITE");
  if (publishedVariance < 0) throw new Error("ASSIMILATION_PUBLISHED_VARIANCE_NEGATIVE");
  requiredFiniteNumberV1(payload.state_correction_vwc, "ASSIMILATION_STATE_CORRECTION_VWC_NON_FINITE");
  requiredFiniteNumberV1(payload.state_correction_storage_mm, "ASSIMILATION_STATE_CORRECTION_STORAGE_NON_FINITE");

  const predicted = requiredNullableFiniteNumberV1(payload.predicted_observation, "ASSIMILATION_PREDICTED_OBSERVATION_NON_FINITE");
  const actual = requiredNullableFiniteNumberV1(payload.actual_observation, "ASSIMILATION_ACTUAL_OBSERVATION_NON_FINITE");
  const innovation = requiredNullableFiniteNumberV1(payload.innovation, "ASSIMILATION_INNOVATION_NON_FINITE");
  const residual = requiredNullableFiniteNumberV1(payload.residual, "ASSIMILATION_RESIDUAL_NON_FINITE");
  const innovationVariance = requiredNullableFiniteNumberV1(payload.innovation_variance, "ASSIMILATION_INNOVATION_VARIANCE_NON_FINITE");
  const normalizedInnovation = requiredNullableFiniteNumberV1(payload.normalized_innovation, "ASSIMILATION_NORMALIZED_INNOVATION_NON_FINITE");
  const squaredNormalizedInnovation = requiredNullableFiniteNumberV1(payload.squared_normalized_innovation, "ASSIMILATION_SQUARED_NORMALIZED_INNOVATION_NON_FINITE");
  const observationVariance = requiredNullableFiniteNumberV1(payload.observation_variance, "ASSIMILATION_OBSERVATION_VARIANCE_NON_FINITE");
  const candidateGain = requiredNullableFiniteNumberV1(payload.candidate_assimilation_gain, "ASSIMILATION_CANDIDATE_GAIN_NON_FINITE");
  const appliedGain = requiredNullableFiniteNumberV1(payload.applied_assimilation_gain, "ASSIMILATION_APPLIED_GAIN_NON_FINITE");
  const candidateMean = requiredNullableFiniteNumberV1(payload.candidate_unclipped_posterior_mean, "ASSIMILATION_CANDIDATE_POSTERIOR_MEAN_NON_FINITE");
  const candidateVariance = requiredNullableFiniteNumberV1(payload.candidate_posterior_variance, "ASSIMILATION_CANDIDATE_POSTERIOR_VARIANCE_NON_FINITE");

  if (payload.residual_kind !== ASSIMILATED_CONTINUATION_RESIDUAL_KIND_V1) throw new Error("ASSIMILATION_RESIDUAL_KIND_MISMATCH");
  if (payload.threshold_decision_basis !== "INNOVATION_SQUARED_LE_16_TIMES_VARIANCE") throw new Error("ASSIMILATION_THRESHOLD_BASIS_MISMATCH");
  if (innovation !== residual) throw new Error("ASSIMILATION_INNOVATION_RESIDUAL_MISMATCH");
  if (innovationVariance !== null && innovationVariance <= 0) throw new Error("ASSIMILATION_INNOVATION_VARIANCE_NOT_POSITIVE");
  if (observationVariance !== null && observationVariance <= 0) throw new Error("ASSIMILATION_OBSERVATION_VARIANCE_NOT_POSITIVE");
  if (candidateVariance !== null && candidateVariance < 0) throw new Error("ASSIMILATION_CANDIDATE_POSTERIOR_VARIANCE_NEGATIVE");

  requiredStringV1(payload.state_transition_ref, "ASSIMILATION_STATE_TRANSITION_REF_REQUIRED");
  requiredStringV1(payload.posterior_state_ref, "ASSIMILATION_POSTERIOR_STATE_REF_REQUIRED");
  requiredStringV1(payload.runtime_config_ref, "ASSIMILATION_RUNTIME_CONFIG_REF_REQUIRED");
  requiredStringV1(payload.runtime_config_hash, "ASSIMILATION_RUNTIME_CONFIG_HASH_REQUIRED");
  if (payload.model_parameter_change_applied !== false) throw new Error("ASSIMILATION_MODEL_PARAMETER_CHANGE_FORBIDDEN");
  validateStringArrayV1(payload.reason_codes, "ASSIMILATION_REASON_CODES_REQUIRED");

  const clipping = requiredRecordV1(payload.clipping, "ASSIMILATION_CLIPPING_REQUIRED");
  if (typeof clipping.applied !== "boolean") throw new Error("ASSIMILATION_CLIPPING_APPLIED_REQUIRED");
  if (clipping.lower_bound !== 0) throw new Error("ASSIMILATION_CLIPPING_LOWER_BOUND_MISMATCH");
  const upperBound = requiredFiniteNumberV1(clipping.upper_bound, "ASSIMILATION_CLIPPING_UPPER_BOUND_NON_FINITE");
  if (upperBound <= 0) throw new Error("ASSIMILATION_CLIPPING_UPPER_BOUND_INVALID");
  requiredFiniteNumberV1(clipping.delta, "ASSIMILATION_CLIPPING_DELTA_NON_FINITE");

  const status = payload.status as AssimilatedContinuationUpdateStatusV1;
  const disposition = payload.disposition as AssimilatedContinuationUpdateDispositionV1;
  const selected = payload.selected_observation_ref;
  const appliedDisposition = status === "APPLIED" && (disposition === "ACCEPTED" || disposition === "DOWNWEIGHTED");
  const outlierDisposition = status === "NOT_APPLIED" && disposition === "REJECTED_OUTLIER";
  const noObservationDisposition = status === "NOT_APPLIED" && disposition === "NO_USABLE_OBSERVATION";
  if (!appliedDisposition && !outlierDisposition && !noObservationDisposition) throw new Error("ASSIMILATION_STATUS_DISPOSITION_COMBINATION_INVALID");

  if (appliedDisposition) {
    const selectedRef = requiredStringV1(selected, "ASSIMILATION_SELECTED_OBSERVATION_REQUIRED");
    exactArrayV1(evaluated, [selectedRef], "ASSIMILATION_APPLIED_EVALUATED_REFS_MISMATCH");
    exactArrayV1(applied, [selectedRef], "ASSIMILATION_APPLIED_REFS_MISMATCH");
    if ([predicted, actual, innovation, innovationVariance, normalizedInnovation, squaredNormalizedInnovation, observationVariance, candidateGain, appliedGain, candidateMean, candidateVariance].some((item) => item === null)) {
      throw new Error("ASSIMILATION_APPLIED_NUMERIC_TRACE_INCOMPLETE");
    }
    if (candidateGain !== appliedGain) throw new Error("ASSIMILATION_APPLIED_GAIN_MISMATCH");
  }

  if (outlierDisposition) {
    const selectedRef = requiredStringV1(selected, "ASSIMILATION_OUTLIER_SELECTED_OBSERVATION_REQUIRED");
    exactArrayV1(evaluated, [selectedRef], "ASSIMILATION_OUTLIER_EVALUATED_REFS_MISMATCH");
    exactArrayV1(applied, [], "ASSIMILATION_OUTLIER_APPLIED_REFS_MUST_BE_EMPTY");
    if ([predicted, actual, innovation, innovationVariance, normalizedInnovation, squaredNormalizedInnovation, observationVariance, candidateGain].some((item) => item === null)) {
      throw new Error("ASSIMILATION_OUTLIER_NUMERIC_TRACE_INCOMPLETE");
    }
    exactNullV1(appliedGain, "ASSIMILATION_OUTLIER_APPLIED_GAIN_MUST_BE_NULL");
    exactNullV1(candidateMean, "ASSIMILATION_OUTLIER_CANDIDATE_MEAN_MUST_BE_NULL");
    exactNullV1(candidateVariance, "ASSIMILATION_OUTLIER_CANDIDATE_VARIANCE_MUST_BE_NULL");
    if (publishedMean !== priorMean || publishedVariance !== priorVariance) throw new Error("ASSIMILATION_OUTLIER_CHANGED_POSTERIOR");
    if (payload.state_correction_vwc !== 0 || payload.state_correction_storage_mm !== 0) throw new Error("ASSIMILATION_OUTLIER_CORRECTION_NOT_ZERO");
  }

  if (noObservationDisposition) {
    if (selected !== null) throw new Error("ASSIMILATION_NO_OBSERVATION_SELECTED_REF_MUST_BE_NULL");
    exactArrayV1(evaluated, [], "ASSIMILATION_NO_OBSERVATION_EVALUATED_REFS_MUST_BE_EMPTY");
    exactArrayV1(applied, [], "ASSIMILATION_NO_OBSERVATION_APPLIED_REFS_MUST_BE_EMPTY");
    for (const item of [predicted, actual, innovation, residual, innovationVariance, normalizedInnovation, squaredNormalizedInnovation, observationVariance, candidateGain, appliedGain, candidateMean, candidateVariance]) {
      if (item !== null) throw new Error("ASSIMILATION_NO_OBSERVATION_NUMERIC_TRACE_MUST_BE_NULL");
    }
    if (publishedMean !== priorMean || publishedVariance !== priorVariance) throw new Error("ASSIMILATION_NO_OBSERVATION_CHANGED_POSTERIOR");
    if (payload.state_correction_vwc !== 0 || payload.state_correction_storage_mm !== 0) throw new Error("ASSIMILATION_NO_OBSERVATION_CORRECTION_NOT_ZERO");
  }
}

export function validateAssimilatedContinuationTickDiscriminatorV1(payload: unknown): void {
  const tick = requiredRecordV1(payload, "ASSIMILATED_CONTINUATION_TICK_PAYLOAD_REQUIRED");
  if (tick.record_set_contract_id !== ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1) {
    throw new Error("UNKNOWN_RECORD_SET_CONTRACT");
  }
}
