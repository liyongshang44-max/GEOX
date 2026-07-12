// apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v2.ts
// Purpose: define the additive MCFT-CAP-03 V2 observation-candidate contract and independently recompute its committed semantic-content hash.
// Boundary: pure contract validation only; no Evidence selection, assimilation math, persistence, filesystem, network, wall clock, Runtime orchestration, or V1 reinterpretation.

import { semanticHashV1 } from "./canonical_identity_v1.js";
import type {
  AssimilatedContinuationUpdatePayloadV1,
} from "./assimilated_continuation_contracts_v1.js";

export const ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V2 =
  "MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2" as const;

export const ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_CONTRACT_ID_V2 =
  "MCFT_CAP_03_ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_V2" as const;

export const ASSIMILATED_CONTINUATION_RESIDUAL_KIND_V2 =
  "STATE_OBSERVATION_INNOVATION" as const;

export const ASSIMILATED_CONTINUATION_CANDIDATE_ASSESSMENTS_V2 = [
  "ELIGIBLE",
  "SELECTED",
  "NOT_SELECTED_OLDER_USABLE",
  "IDENTICAL_DUPLICATE_SUPPRESSED",
  "REJECTED_SCOPE",
  "REJECTED_TIME_FUTURE",
  "REJECTED_TIME_LATE",
  "REJECTED_TIME_STALE",
  "REJECTED_UNAUTHORIZED_BINDING",
  "REJECTED_QUANTITY",
  "REJECTED_CANONICAL_UNIT",
  "REJECTED_PHYSICAL_BOUNDS",
  "REJECTED_QUALITY_FAIL",
] as const;

export type AssimilatedContinuationCandidateAssessmentV2 =
  (typeof ASSIMILATED_CONTINUATION_CANDIDATE_ASSESSMENTS_V2)[number];

export type AssimilatedObservationQualityV2 = {
  status: "PASS" | "LIMITED" | "FAIL";
};

export type AssimilatedObservationConversionRuleV2 = {
  id: string;
  version: string;
};

export type AssimilatedObservationSemanticHashBasisV2 = {
  canonical_payload: Record<string, unknown>;
  quality: AssimilatedObservationQualityV2;
  source_unit: string;
  canonical_unit: string;
  conversion_rule: AssimilatedObservationConversionRuleV2;
  epistemic_class: "OBSERVED";
};

export type AssimilatedObservationCandidateV2 =
  AssimilatedObservationSemanticHashBasisV2 & {
    observation_ref: string;
    source_record_id: string;
    source_record_hash: string;
    observation_semantic_content_hash: string;
    record_type: "soil_moisture_observation_v1";
    observed_at: string;
    available_to_runtime_at: string;
    ingested_at: string;
    binding_id: string;
    quantity_kind: string;
    canonical_value: number;
    quality_status: AssimilatedObservationQualityV2["status"];
    temporal_offset_milliseconds: number;
    candidate_assessment: AssimilatedContinuationCandidateAssessmentV2;
    reason_codes: string[];
  };

function requiredRecordV2(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(code);
  }
  return value as Record<string, unknown>;
}

function requiredStringV2(value: unknown, code: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(code);
  }
  return value;
}

function requiredFiniteNumberV2(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(code);
  }
  return value;
}

function requiredCanonicalIsoV2(value: unknown, code: string): string {
  const text = requiredStringV2(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) {
    throw new Error(code);
  }
  return text;
}

function validateStringArrayV2(value: unknown, code: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(code);
  }
  for (const item of value) {
    requiredStringV2(item, `${code}_ITEM_REQUIRED`);
  }
  return value as string[];
}

export function computeAssimilatedObservationSemanticContentHashV2(
  input: AssimilatedObservationSemanticHashBasisV2,
): string {
  return semanticHashV1({
    canonical_payload: input.canonical_payload,
    quality: input.quality,
    source_unit: input.source_unit,
    canonical_unit: input.canonical_unit,
    conversion_rule: input.conversion_rule,
    epistemic_class: input.epistemic_class,
  });
}

export function validateAssimilatedObservationCandidateV2(
  value: unknown,
): asserts value is AssimilatedObservationCandidateV2 {
  const candidate = requiredRecordV2(
    value,
    "ASSIMILATION_V2_CANDIDATE_REQUIRED",
  );

  for (const field of [
    "observation_ref",
    "source_record_id",
    "source_record_hash",
    "observation_semantic_content_hash",
    "binding_id",
    "source_unit",
  ]) {
    requiredStringV2(
      candidate[field],
      `ASSIMILATION_V2_CANDIDATE_${field.toUpperCase()}_REQUIRED`,
    );
  }

  if (candidate.record_type !== "soil_moisture_observation_v1") {
    throw new Error("ASSIMILATION_V2_CANDIDATE_RECORD_TYPE_MISMATCH");
  }
  if (candidate.epistemic_class !== "OBSERVED") {
    throw new Error("ASSIMILATION_V2_CANDIDATE_EPISTEMIC_CLASS_MISMATCH");
  }
  const quantityKind = requiredStringV2(
    candidate.quantity_kind,
    "ASSIMILATION_V2_CANDIDATE_QUANTITY_REQUIRED",
  );
  const canonicalUnit = requiredStringV2(
    candidate.canonical_unit,
    "ASSIMILATION_V2_CANDIDATE_CANONICAL_UNIT_REQUIRED",
  );

  requiredCanonicalIsoV2(
    candidate.observed_at,
    "ASSIMILATION_V2_CANDIDATE_OBSERVED_AT_INVALID",
  );
  requiredCanonicalIsoV2(
    candidate.available_to_runtime_at,
    "ASSIMILATION_V2_CANDIDATE_AVAILABLE_AT_INVALID",
  );
  requiredCanonicalIsoV2(
    candidate.ingested_at,
    "ASSIMILATION_V2_CANDIDATE_INGESTED_AT_INVALID",
  );

  const conversion = requiredRecordV2(
    candidate.conversion_rule,
    "ASSIMILATION_V2_CANDIDATE_CONVERSION_RULE_REQUIRED",
  );
  const conversionRule: AssimilatedObservationConversionRuleV2 = {
    id: requiredStringV2(
      conversion.id,
      "ASSIMILATION_V2_CANDIDATE_CONVERSION_ID_REQUIRED",
    ),
    version: requiredStringV2(
      conversion.version,
      "ASSIMILATION_V2_CANDIDATE_CONVERSION_VERSION_REQUIRED",
    ),
  };

  const canonicalPayload = requiredRecordV2(
    candidate.canonical_payload,
    "ASSIMILATION_V2_CANDIDATE_CANONICAL_PAYLOAD_REQUIRED",
  );
  if (canonicalPayload.unit !== canonicalUnit) {
    throw new Error("ASSIMILATION_V2_CANDIDATE_PAYLOAD_UNIT_MISMATCH");
  }
  if (canonicalPayload.quantity_kind !== quantityKind) {
    throw new Error("ASSIMILATION_V2_CANDIDATE_PAYLOAD_QUANTITY_MISMATCH");
  }
  const payloadValue = requiredFiniteNumberV2(
    canonicalPayload.value,
    "ASSIMILATION_V2_CANDIDATE_PAYLOAD_VALUE_NON_FINITE",
  );
  const canonicalValue = requiredFiniteNumberV2(
    candidate.canonical_value,
    "ASSIMILATION_V2_CANDIDATE_CANONICAL_VALUE_NON_FINITE",
  );
  if (payloadValue !== canonicalValue) {
    throw new Error("ASSIMILATION_V2_CANDIDATE_CANONICAL_VALUE_MISMATCH");
  }

  const quality = requiredRecordV2(
    candidate.quality,
    "ASSIMILATION_V2_CANDIDATE_QUALITY_REQUIRED",
  );
  const qualityStatus = requiredStringV2(
    quality.status,
    "ASSIMILATION_V2_CANDIDATE_QUALITY_STATUS_REQUIRED",
  );
  if (!( ["PASS", "LIMITED", "FAIL"] as const).includes(
    qualityStatus as AssimilatedObservationQualityV2["status"],
  )) {
    throw new Error("ASSIMILATION_V2_CANDIDATE_QUALITY_STATUS_UNKNOWN");
  }
  if (candidate.quality_status !== qualityStatus) {
    throw new Error("ASSIMILATION_V2_CANDIDATE_QUALITY_STATUS_MISMATCH");
  }

  const temporalOffset = requiredFiniteNumberV2(
    candidate.temporal_offset_milliseconds,
    "ASSIMILATION_V2_CANDIDATE_TEMPORAL_OFFSET_NON_FINITE",
  );
  if (!Number.isInteger(temporalOffset)) {
    throw new Error("ASSIMILATION_V2_CANDIDATE_TEMPORAL_OFFSET_NOT_INTEGER");
  }

  if (!ASSIMILATED_CONTINUATION_CANDIDATE_ASSESSMENTS_V2.includes(
    candidate.candidate_assessment as AssimilatedContinuationCandidateAssessmentV2,
  )) {
    throw new Error("ASSIMILATION_V2_CANDIDATE_ASSESSMENT_UNKNOWN");
  }
  const reasonCodes = validateStringArrayV2(
    candidate.reason_codes,
    "ASSIMILATION_V2_CANDIDATE_REASON_CODES_REQUIRED",
  );
  const assessment =
    candidate.candidate_assessment as AssimilatedContinuationCandidateAssessmentV2;
  if (
    quantityKind !== "VOLUMETRIC_WATER_CONTENT"
    && !reasonCodes.includes("REJECTED_QUANTITY")
  ) {
    throw new Error("ASSIMILATION_V2_CANDIDATE_QUANTITY_REJECTION_TRACE_REQUIRED");
  }
  if (
    canonicalUnit !== "fraction"
    && !reasonCodes.includes("REJECTED_CANONICAL_UNIT")
  ) {
    throw new Error("ASSIMILATION_V2_CANDIDATE_UNIT_REJECTION_TRACE_REQUIRED");
  }
  if (
    !assessment.startsWith("REJECTED_")
    && (
      quantityKind !== "VOLUMETRIC_WATER_CONTENT"
      || canonicalUnit !== "fraction"
    )
  ) {
    throw new Error("ASSIMILATION_V2_NON_REJECTED_CANDIDATE_NOT_AUTHORIZED");
  }

  const expectedHash = computeAssimilatedObservationSemanticContentHashV2({
    canonical_payload: canonicalPayload,
    quality: {
      status: qualityStatus as AssimilatedObservationQualityV2["status"],
    },
    source_unit: requiredStringV2(
      candidate.source_unit,
      "ASSIMILATION_V2_CANDIDATE_SOURCE_UNIT_REQUIRED",
    ),
    canonical_unit: canonicalUnit,
    conversion_rule: conversionRule,
    epistemic_class: "OBSERVED",
  });

  if (candidate.observation_semantic_content_hash !== expectedHash) {
    throw new Error(
      "ASSIMILATION_V2_CANDIDATE_SEMANTIC_CONTENT_HASH_MISMATCH",
    );
  }
}


// R2_V2_UPDATE_PAYLOAD_CONTRACT_BEGIN
// Purpose: extend the additive V2 candidate contract into the complete
// versioned A2 assimilation-update and Tick discriminator contract.
// Boundary: validation only; V1 contracts remain immutable.

export const ASSIMILATED_CONTINUATION_UPDATE_STATUSES_V2 = [
  "APPLIED",
  "NOT_APPLIED",
] as const;

export const ASSIMILATED_CONTINUATION_UPDATE_DISPOSITIONS_V2 = [
  "ACCEPTED",
  "DOWNWEIGHTED",
  "REJECTED_OUTLIER",
  "NO_USABLE_OBSERVATION",
] as const;

export type AssimilatedContinuationUpdateStatusV2 =
  (typeof ASSIMILATED_CONTINUATION_UPDATE_STATUSES_V2)[number];

export type AssimilatedContinuationUpdateDispositionV2 =
  (typeof ASSIMILATED_CONTINUATION_UPDATE_DISPOSITIONS_V2)[number];

export type AssimilatedContinuationUpdatePayloadV2 =
  Omit<
    AssimilatedContinuationUpdatePayloadV1,
    | "record_set_contract_id"
    | "observation_selector_id"
    | "candidate_observations"
  > & {
    record_set_contract_id:
      typeof ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V2;
    observation_selector_id:
      "LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V2";
    candidate_observations: AssimilatedObservationCandidateV2[];
  };

function requiredArrayV2(
  value: unknown,
  code: string,
): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(code);
  }
  return value;
}

function requiredNullableFiniteNumberV2(
  value: unknown,
  code: string,
): number | null {
  if (value === null) {
    return null;
  }
  return requiredFiniteNumberV2(value, code);
}

function exactArrayV2(
  actual: unknown,
  expected: readonly unknown[],
  code: string,
): void {
  if (
    !Array.isArray(actual)
    || JSON.stringify(actual) !== JSON.stringify(expected)
  ) {
    throw new Error(code);
  }
}

export function validateAssimilatedContinuationUpdatePayloadV2(
  value: unknown,
): asserts value is AssimilatedContinuationUpdatePayloadV2 {
  const payload = requiredRecordV2(
    value,
    "ASSIMILATION_V2_UPDATE_PAYLOAD_REQUIRED",
  );

  if (!ASSIMILATED_CONTINUATION_UPDATE_STATUSES_V2.includes(
    payload.status as AssimilatedContinuationUpdateStatusV2,
  )) {
    throw new Error("ASSIMILATION_V2_UPDATE_STATUS_UNKNOWN");
  }

  if (!ASSIMILATED_CONTINUATION_UPDATE_DISPOSITIONS_V2.includes(
    payload.disposition as AssimilatedContinuationUpdateDispositionV2,
  )) {
    throw new Error("ASSIMILATION_V2_UPDATE_DISPOSITION_UNKNOWN");
  }

  if (
    payload.record_set_contract_id
    !== ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V2
  ) {
    throw new Error("ASSIMILATION_V2_RECORD_SET_CONTRACT_MISMATCH");
  }

  if (
    payload.assimilation_method_id
    !== "SCALAR_GAUSSIAN_ASSIMILATION_V1"
  ) {
    throw new Error("ASSIMILATION_V2_METHOD_MISMATCH");
  }

  if (
    payload.observation_selector_id
    !== "LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V2"
  ) {
    throw new Error("ASSIMILATION_V2_SELECTOR_MISMATCH");
  }

  requiredStringV2(
    payload.policy_id,
    "ASSIMILATION_V2_POLICY_ID_REQUIRED",
  );

  const candidates = requiredArrayV2(
    payload.candidate_observations,
    "ASSIMILATION_V2_CANDIDATES_REQUIRED",
  );

  for (const candidate of candidates) {
    validateAssimilatedObservationCandidateV2(candidate);
  }
  const candidateValues =
    candidates as AssimilatedObservationCandidateV2[];

  const evaluated = validateStringArrayV2(
    payload.evaluated_observation_refs,
    "ASSIMILATION_V2_EVALUATED_REFS_REQUIRED",
  );

  const applied = validateStringArrayV2(
    payload.applied_observation_refs,
    "ASSIMILATION_V2_APPLIED_REFS_REQUIRED",
  );

  const consumed = validateStringArrayV2(
    payload.consumed_observation_refs,
    "ASSIMILATION_V2_CONSUMED_REFS_REQUIRED",
  );

  exactArrayV2(
    applied,
    consumed,
    "ASSIMILATION_V2_CONSUMED_REFS_MUST_EQUAL_APPLIED_REFS",
  );

  const selected = payload.selected_observation_ref;
  let selectedCandidate: AssimilatedObservationCandidateV2 | null = null;
  if (selected !== null) {
    const selectedRef = requiredStringV2(
      selected,
      "ASSIMILATION_V2_SELECTED_REF_INVALID",
    );
    selectedCandidate = candidateValues.find(
      (candidate) => candidate.observation_ref === selectedRef,
    ) ?? null;
    if (!selectedCandidate) {
      throw new Error("ASSIMILATION_V2_SELECTED_CANDIDATE_NOT_FOUND");
    }
  }

  for (const field of [
    "prior_mean",
    "prior_variance",
    "published_posterior_mean",
    "published_posterior_variance",
    "state_correction_vwc",
    "state_correction_storage_mm",
  ]) {
    requiredFiniteNumberV2(
      payload[field],
      "ASSIMILATION_V2_" + field.toUpperCase() + "_NON_FINITE",
    );
  }

  for (const field of [
    "predicted_observation",
    "actual_observation",
    "innovation",
    "residual",
    "innovation_variance",
    "normalized_innovation",
    "squared_normalized_innovation",
    "observation_variance",
    "candidate_assimilation_gain",
    "applied_assimilation_gain",
    "candidate_unclipped_posterior_mean",
    "candidate_posterior_variance",
  ]) {
    requiredNullableFiniteNumberV2(
      payload[field],
      "ASSIMILATION_V2_" + field.toUpperCase() + "_NON_FINITE",
    );
  }

  requiredStringV2(
    payload.state_transition_ref,
    "ASSIMILATION_V2_TRANSITION_REF_REQUIRED",
  );

  requiredStringV2(
    payload.posterior_state_ref,
    "ASSIMILATION_V2_POSTERIOR_REF_REQUIRED",
  );

  requiredStringV2(
    payload.runtime_config_ref,
    "ASSIMILATION_V2_RUNTIME_CONFIG_REF_REQUIRED",
  );

  requiredStringV2(
    payload.runtime_config_hash,
    "ASSIMILATION_V2_RUNTIME_CONFIG_HASH_REQUIRED",
  );

  validateStringArrayV2(
    payload.reason_codes,
    "ASSIMILATION_V2_REASON_CODES_REQUIRED",
  );

  const status = payload.status;
  const disposition = payload.disposition;

  if (
    status === "APPLIED"
    && !(
      disposition === "ACCEPTED"
      || disposition === "DOWNWEIGHTED"
    )
  ) {
    throw new Error(
      "ASSIMILATION_V2_STATUS_DISPOSITION_COMBINATION_INVALID",
    );
  }

  if (
    status === "NOT_APPLIED"
    && !(
      disposition === "REJECTED_OUTLIER"
      || disposition === "NO_USABLE_OBSERVATION"
    )
  ) {
    throw new Error(
      "ASSIMILATION_V2_STATUS_DISPOSITION_COMBINATION_INVALID",
    );
  }

  if (status === "APPLIED" || disposition === "REJECTED_OUTLIER") {
    const selectedRef = requiredStringV2(
      selected,
      "ASSIMILATION_V2_SELECTED_OBSERVATION_REQUIRED",
    );
    if (
      !selectedCandidate
      || selectedCandidate.candidate_assessment !== "SELECTED"
      || selectedCandidate.binding_id !== "soil_obs_c8_20cm_v1"
      || selectedCandidate.quantity_kind !== "VOLUMETRIC_WATER_CONTENT"
      || selectedCandidate.canonical_unit !== "fraction"
      || selectedCandidate.quality_status === "FAIL"
    ) {
      throw new Error("ASSIMILATION_V2_SELECTED_CANDIDATE_NOT_AUTHORIZED");
    }
    exactArrayV2(
      evaluated,
      [selectedRef],
      "ASSIMILATION_V2_EVALUATED_REFS_MUST_EQUAL_SELECTED",
    );
    exactArrayV2(
      applied,
      status === "APPLIED" ? [selectedRef] : [],
      "ASSIMILATION_V2_APPLIED_REFS_STATUS_MISMATCH",
    );
  }

  if (disposition === "NO_USABLE_OBSERVATION") {
    if (selected !== null) {
      throw new Error(
        "ASSIMILATION_V2_NO_OBSERVATION_SELECTED_REF_MUST_BE_NULL",
      );
    }
    exactArrayV2(
      evaluated,
      [],
      "ASSIMILATION_V2_NO_OBSERVATION_EVALUATED_REFS_MUST_BE_EMPTY",
    );
    exactArrayV2(
      applied,
      [],
      "ASSIMILATION_V2_NO_OBSERVATION_APPLIED_REFS_MUST_BE_EMPTY",
    );
  }
}

export function validateAssimilatedContinuationTickDiscriminatorV2(
  payload: unknown,
): void {
  const tick = requiredRecordV2(
    payload,
    "ASSIMILATED_CONTINUATION_V2_TICK_PAYLOAD_REQUIRED",
  );

  if (
    tick.record_set_contract_id
    !== ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V2
  ) {
    throw new Error("UNKNOWN_RECORD_SET_CONTRACT");
  }
}
// R2_V2_UPDATE_PAYLOAD_CONTRACT_END
