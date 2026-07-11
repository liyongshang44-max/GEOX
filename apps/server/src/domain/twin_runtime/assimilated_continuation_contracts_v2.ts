// apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v2.ts
// Purpose: define the additive MCFT-CAP-03 V2 observation-candidate contract and independently recompute its committed semantic-content hash.
// Boundary: pure contract validation only; no Evidence selection, assimilation math, persistence, filesystem, network, wall clock, Runtime orchestration, or V1 reinterpretation.

import { semanticHashV1 } from "./canonical_identity_v1.js";

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
  canonical_unit: "fraction";
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
    quantity_kind: "VOLUMETRIC_WATER_CONTENT";
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
  if (candidate.quantity_kind !== "VOLUMETRIC_WATER_CONTENT") {
    throw new Error("ASSIMILATION_V2_CANDIDATE_QUANTITY_MISMATCH");
  }
  if (candidate.canonical_unit !== "fraction") {
    throw new Error("ASSIMILATION_V2_CANDIDATE_CANONICAL_UNIT_MISMATCH");
  }

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
  if (canonicalPayload.unit !== "fraction") {
    throw new Error("ASSIMILATION_V2_CANDIDATE_PAYLOAD_UNIT_MISMATCH");
  }
  if (canonicalPayload.quantity_kind !== "VOLUMETRIC_WATER_CONTENT") {
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
  validateStringArrayV2(
    candidate.reason_codes,
    "ASSIMILATION_V2_CANDIDATE_REASON_CODES_REQUIRED",
  );

  const expectedHash = computeAssimilatedObservationSemanticContentHashV2({
    canonical_payload: canonicalPayload,
    quality: {
      status: qualityStatus as AssimilatedObservationQualityV2["status"],
    },
    source_unit: requiredStringV2(
      candidate.source_unit,
      "ASSIMILATION_V2_CANDIDATE_SOURCE_UNIT_REQUIRED",
    ),
    canonical_unit: "fraction",
    conversion_rule: conversionRule,
    epistemic_class: "OBSERVED",
  });

  if (candidate.observation_semantic_content_hash !== expectedHash) {
    throw new Error(
      "ASSIMILATION_V2_CANDIDATE_SEMANTIC_CONTENT_HASH_MISMATCH",
    );
  }
}
