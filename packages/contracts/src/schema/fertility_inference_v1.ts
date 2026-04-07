import { z } from "zod";

export const FertilityLevelV1Schema = z.enum(["low", "medium", "high", "unknown"]);
export const RecommendationBiasV1Schema = z.enum(["fertilize", "wait", "irrigate_first", "inspect"]);
export const SalinityRiskV1Schema = z.enum(["low", "medium", "high", "unknown"]);
export const FertilityInferenceExplanationCodeValuesV1 = [
  "SENSING_SKILL_FERTILITY_INFERENCE_V1",
  "NO_DEVICE_OBSERVATION",
  "MISSING_SOIL_MOISTURE",
  "LOW_SOIL_MOISTURE",
  "ADEQUATE_SOIL_MOISTURE",
  "HIGH_EC",
  "MODERATE_EC",
  "LOW_EC",
  "MISSING_EC",
  "MISSING_CANOPY_TEMP",
  "HEAT_STRESS_SIGNAL",
  "ELEVATED_CANOPY_TEMP",
  "RULE_MOISTURE_LOW_IRRIGATE_FIRST",
  "RULE_SALINITY_HIGH_INSPECT",
  "RULE_EC_TEMP_AVAILABLE_FERTILIZE",
  "RULE_EC_TEMP_AVAILABILITY_WAIT",
] as const;
export const FertilityInferenceExplanationCodeV1Schema = z.enum(FertilityInferenceExplanationCodeValuesV1);

export const FertilityInferenceV1ResultSchema = z.object({
  fertility_level: FertilityLevelV1Schema,
  recommendation_bias: RecommendationBiasV1Schema,
  salinity_risk: SalinityRiskV1Schema,
  confidence: z.number().min(0).max(1),
  explanation_codes: z.array(FertilityInferenceExplanationCodeV1Schema),
}).strict();

export type FertilityLevelV1 = z.infer<typeof FertilityLevelV1Schema>;
export type RecommendationBiasV1 = z.infer<typeof RecommendationBiasV1Schema>;
export type SalinityRiskV1 = z.infer<typeof SalinityRiskV1Schema>;
export type FertilityInferenceExplanationCodeV1 = z.infer<typeof FertilityInferenceExplanationCodeV1Schema>;
export type FertilityInferenceV1Result = z.infer<typeof FertilityInferenceV1ResultSchema>;
