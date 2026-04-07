import { z } from "zod";

export const FertilityLevelV1Schema = z.enum(["low", "medium", "high", "unknown"]);
export const RecommendationBiasV1Schema = z.enum(["fertilize", "wait", "irrigate_first", "inspect"]);
export const SalinityRiskV1Schema = z.enum(["low", "medium", "high", "unknown"]);

export const FertilityInferenceV1ResultSchema = z.object({
  fertility_level: FertilityLevelV1Schema,
  recommendation_bias: RecommendationBiasV1Schema,
  salinity_risk: SalinityRiskV1Schema,
  confidence: z.number().min(0).max(1),
  explanation_codes: z.array(z.string().min(1)),
}).strict();

export type FertilityLevelV1 = z.infer<typeof FertilityLevelV1Schema>;
export type RecommendationBiasV1 = z.infer<typeof RecommendationBiasV1Schema>;
export type SalinityRiskV1 = z.infer<typeof SalinityRiskV1Schema>;
export type FertilityInferenceV1Result = z.infer<typeof FertilityInferenceV1ResultSchema>;
