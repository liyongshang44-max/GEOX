export type FertilityLevelV1 = "LOW" | "MEDIUM" | "HIGH";
export type SalinityRiskV1 = "LOW" | "MEDIUM" | "HIGH";
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

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function inferFertilityFromObservationAggregateV1(input: SensingObservationAggregateV1): FertilityInferenceV1Result {
  const moisture = isFiniteNumber(input.soil_moisture_pct) ? input.soil_moisture_pct : null;
  const ec = isFiniteNumber(input.ec_ds_m) ? input.ec_ds_m : null;
  const canopyTemp = isFiniteNumber(input.canopy_temp_c) ? input.canopy_temp_c : null;

  const explanationCodes: string[] = ["SENSING_SKILL_FERTILITY_INFERENCE_V1"];

  const fertilityLevel: FertilityLevelV1 =
    moisture == null
      ? "MEDIUM"
      : moisture < 22
        ? "LOW"
        : moisture < 35
          ? "MEDIUM"
          : "HIGH";

  if (moisture == null) explanationCodes.push("MISSING_SOIL_MOISTURE");
  else if (moisture < 22) explanationCodes.push("LOW_SOIL_MOISTURE");
  else explanationCodes.push("ADEQUATE_SOIL_MOISTURE");

  const salinityRisk: SalinityRiskV1 =
    ec != null && ec >= 2.8
      ? "HIGH"
      : ec != null && ec >= 2.0
        ? "MEDIUM"
        : moisture != null && canopyTemp != null && moisture < 20 && canopyTemp >= 32
          ? "HIGH"
          : canopyTemp != null && canopyTemp >= 30
            ? "MEDIUM"
            : "LOW";

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
  } else if (salinityRisk === "HIGH") {
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
    confidence: clamp01(Number((baseConfidence + confidenceBoost).toFixed(3))),
    explanation_codes: Array.from(new Set(explanationCodes)),
  };
}
