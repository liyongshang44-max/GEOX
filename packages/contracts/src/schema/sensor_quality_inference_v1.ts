import { z } from "zod";

export const SensorQualityV1Schema = z.enum(["good", "fair", "poor", "unknown"]);

export const SensorQualityInferenceExplanationCodeValuesV1 = [
  "SENSING_SKILL_SENSOR_QUALITY_INFERENCE_V1",
  "NO_DEVICE_OBSERVATION",
  "MISSING_SIGNAL_STRENGTH",
  "SIGNAL_STRONG",
  "SIGNAL_WEAK",
  "MISSING_BATTERY_LEVEL",
  "BATTERY_LOW",
  "BATTERY_OK",
  "MISSING_PACKET_LOSS_RATE",
  "PACKET_LOSS_HIGH",
  "PACKET_LOSS_MODERATE",
  "PACKET_LOSS_LOW",
  "RULE_SIGNAL_OR_PACKET_POOR",
  "RULE_BATTERY_OR_PACKET_FAIR",
  "RULE_SIGNAL_BATTERY_PACKET_GOOD",
] as const;
export const SensorQualityInferenceExplanationCodeV1Schema = z.enum(SensorQualityInferenceExplanationCodeValuesV1);

export const SensorQualityInferenceV1ResultSchema = z.object({
  sensor_quality: SensorQualityV1Schema,
  confidence: z.number().min(0).max(1),
  explanation_codes: z.array(SensorQualityInferenceExplanationCodeV1Schema),
}).strict();

export type SensorQualityV1 = z.infer<typeof SensorQualityV1Schema>;
export type SensorQualityInferenceExplanationCodeV1 = z.infer<typeof SensorQualityInferenceExplanationCodeV1Schema>;
export type SensorQualityInferenceV1Result = z.infer<typeof SensorQualityInferenceV1ResultSchema>;
