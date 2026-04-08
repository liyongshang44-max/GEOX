import { z } from "zod";

export const CanopyTempStatusV1Schema = z.enum(["normal", "elevated", "critical", "unknown"]);
export const EvapotranspirationRiskV1Schema = z.enum(["low", "medium", "high", "unknown"]);

export const CanopyTemperatureInferenceExplanationCodeValuesV1 = [
  "SENSING_SKILL_CANOPY_TEMPERATURE_INFERENCE_V1",
  "NO_DEVICE_OBSERVATION",
  "MISSING_CANOPY_TEMP",
  "CANOPY_TEMP_NORMAL",
  "CANOPY_TEMP_ELEVATED",
  "CANOPY_TEMP_CRITICAL",
  "MISSING_AMBIENT_TEMP",
  "AMBIENT_TEMP_AVAILABLE",
  "MISSING_RELATIVE_HUMIDITY",
  "HIGH_VPD_RISK",
  "MODERATE_VPD_RISK",
  "LOW_VPD_RISK",
  "RULE_CANOPY_CRITICAL_ET_HIGH",
  "RULE_CANOPY_ELEVATED_ET_MEDIUM",
  "RULE_VPD_BASED_ET",
] as const;
export const CanopyTemperatureInferenceExplanationCodeV1Schema = z.enum(CanopyTemperatureInferenceExplanationCodeValuesV1);

export const CanopyTemperatureInferenceV1ResultSchema = z.object({
  canopy_temp_status: CanopyTempStatusV1Schema,
  evapotranspiration_risk: EvapotranspirationRiskV1Schema,
  confidence: z.number().min(0).max(1),
  explanation_codes: z.array(CanopyTemperatureInferenceExplanationCodeV1Schema),
}).strict();

export type CanopyTempStatusV1 = z.infer<typeof CanopyTempStatusV1Schema>;
export type EvapotranspirationRiskV1 = z.infer<typeof EvapotranspirationRiskV1Schema>;
export type CanopyTemperatureInferenceExplanationCodeV1 = z.infer<typeof CanopyTemperatureInferenceExplanationCodeV1Schema>;
export type CanopyTemperatureInferenceV1Result = z.infer<typeof CanopyTemperatureInferenceV1ResultSchema>;
