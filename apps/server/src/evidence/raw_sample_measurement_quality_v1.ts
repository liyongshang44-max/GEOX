import type { RawSampleQualityV1 } from "../domain/sensing/raw_sample_fact_envelope_v1.js";

export type RawSampleObservationQualityDecisionV1 = {
  quality_flags: string[];
  observation_pipeline_eligible: boolean;
  reason_code:
    | "RAW_SAMPLE_QC_OK"
    | "RAW_SAMPLE_QC_SUSPECT"
    | "RAW_SAMPLE_QC_BAD"
    | "RAW_SAMPLE_QC_UNKNOWN";
};

/**
 * Consume the caller/raw-sample QC label without upgrading uncertainty.
 *
 * UNKNOWN must never become OK simply because the transport payload was finite.
 * BAD remains retained as source evidence but is not eligible to enter the
 * official observation -> Stage-1 physical-state pipeline.
 *
 * SUSPECT remains explicitly SUSPECT and can continue through the compatibility
 * observation path for later bounded qualification; it is never rewritten as OK.
 */
export function evaluateRawSampleObservationQualityV1(
  quality: RawSampleQualityV1,
): RawSampleObservationQualityDecisionV1 {
  if (quality === "ok") {
    return {
      quality_flags: ["OK"],
      observation_pipeline_eligible: true,
      reason_code: "RAW_SAMPLE_QC_OK",
    };
  }
  if (quality === "suspect") {
    return {
      quality_flags: ["SUSPECT"],
      observation_pipeline_eligible: true,
      reason_code: "RAW_SAMPLE_QC_SUSPECT",
    };
  }
  if (quality === "bad") {
    return {
      quality_flags: ["OUTLIER"],
      observation_pipeline_eligible: false,
      reason_code: "RAW_SAMPLE_QC_BAD",
    };
  }
  return {
    quality_flags: ["MISSING_CONTEXT"],
    observation_pipeline_eligible: false,
    reason_code: "RAW_SAMPLE_QC_UNKNOWN",
  };
}
