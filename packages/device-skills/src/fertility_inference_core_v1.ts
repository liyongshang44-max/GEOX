export type FertilityLevelV1 = "low" | "medium" | "high" | "unknown";
export type SalinityRiskV1 = "low" | "medium" | "high" | "unknown";
export type RecommendationBiasV1 = "fertilize" | "wait" | "irrigate_first" | "inspect";

export type SensingObservationAggregateV1 = {
  soil_moisture_pct?: number | null;
  ec_ds_m?: number | null;
  canopy_temp_c?: number | null;
  observation_count?: number | null;
  source_ids?: string[];
};

export type FertilityInferenceV1Result = {
  fertility_level: FertilityLevelV1;
  recommendation_bias: RecommendationBiasV1;
  salinity_risk: SalinityRiskV1;
  confidence: number;
  explanation_codes: string[];
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function inferFertilityFromObservationAggregateV1(input: SensingObservationAggregateV1): FertilityInferenceV1Result {
  const moisture = isFiniteNumber(input.soil_moisture_pct) ? input.soil_moisture_pct : null;
  const ec = isFiniteNumber(input.ec_ds_m) ? input.ec_ds_m : null;
  const canopyTemp = isFiniteNumber(input.canopy_temp_c) ? input.canopy_temp_c : null;

  const explanationCodes: string[] = ["SENSING_SKILL_FERTILITY_INFERENCE_V1"];

  if (moisture == null && ec == null && canopyTemp == null) {
    explanationCodes.push("NO_DEVICE_OBSERVATION");
    return {
      fertility_level: "unknown",
      recommendation_bias: "inspect",
      salinity_risk: "unknown",
      confidence: 0.2,
      explanation_codes: explanationCodes,
    };
  }

  const fertilityLevel: FertilityLevelV1 =
    moisture == null
      ? "unknown"
      : moisture < 22
        ? "low"
        : moisture < 35
          ? "medium"
          : "high";

  if (moisture == null) explanationCodes.push("MISSING_SOIL_MOISTURE");
  else if (moisture < 22) explanationCodes.push("LOW_SOIL_MOISTURE");
  else explanationCodes.push("ADEQUATE_SOIL_MOISTURE");

  const salinityRisk: SalinityRiskV1 =
    ec == null
      ? "unknown"
      : ec >= 2.8
        ? "high"
        : ec >= 2.0
          ? "medium"
          : "low";

  if (ec != null && ec >= 2.8) explanationCodes.push("HIGH_EC");
  else if (ec != null && ec >= 2.0) explanationCodes.push("MODERATE_EC");
  else if (ec != null) explanationCodes.push("LOW_EC");
  else explanationCodes.push("MISSING_EC");

  if (canopyTemp == null) explanationCodes.push("MISSING_CANOPY_TEMP");
  else if (canopyTemp >= 32) explanationCodes.push("HEAT_STRESS_SIGNAL");
  else if (canopyTemp >= 30) explanationCodes.push("ELEVATED_CANOPY_TEMP");

  let recommendationBias: RecommendationBiasV1;
  if (moisture != null && moisture < 22) {
    recommendationBias = "irrigate_first";
    explanationCodes.push("RULE_MOISTURE_LOW_IRRIGATE_FIRST");
  } else if (salinityRisk === "high") {
    recommendationBias = "inspect";
    explanationCodes.push("RULE_SALINITY_HIGH_INSPECT");
  } else {
    const ecAvailable = ec != null;
    const tempAvailable = canopyTemp != null;
    const favorableEc = ec != null && ec >= 1.2 && ec <= 2.2;
    const favorableTemp = canopyTemp != null && canopyTemp >= 16 && canopyTemp <= 30;

    if (ecAvailable && tempAvailable && favorableEc && favorableTemp) {
      recommendationBias = "fertilize";
      explanationCodes.push("RULE_EC_TEMP_AVAILABLE_FERTILIZE");
    } else {
      recommendationBias = "wait";
      explanationCodes.push("RULE_EC_TEMP_AVAILABILITY_WAIT");
    }
  }

  const availabilityScore = [moisture, ec, canopyTemp].filter((v) => v != null).length / 3;
  const baseConfidence = 0.45 + availabilityScore * 0.4;
  const confidenceBoost = recommendationBias === "irrigate_first" || recommendationBias === "inspect" ? 0.1 : 0;

  return {
    fertility_level: fertilityLevel,
    recommendation_bias: recommendationBias,
    salinity_risk: salinityRisk,
    confidence: Number(clamp(baseConfidence + confidenceBoost, 0.2, 0.95).toFixed(3)),
    explanation_codes: Array.from(new Set(explanationCodes)),
  };
}
