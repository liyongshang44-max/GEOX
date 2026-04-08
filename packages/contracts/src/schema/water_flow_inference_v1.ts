import { z } from "zod";

export const IrrigationEffectivenessV1Schema = z.enum(["low", "medium", "high", "unknown"]);
export const LeakRiskV1Schema = z.enum(["low", "medium", "high", "unknown"]);

export const WaterFlowInferenceExplanationCodeValuesV1 = [
  "SENSING_SKILL_WATER_FLOW_INFERENCE_V1",
  "NO_DEVICE_OBSERVATION",
  "MISSING_INLET_FLOW_LPM",
  "MISSING_OUTLET_FLOW_LPM",
  "MISSING_PRESSURE_DROP_KPA",
  "HIGH_FLOW_EFFICIENCY",
  "MEDIUM_FLOW_EFFICIENCY",
  "LOW_FLOW_EFFICIENCY",
  "PRESSURE_DROP_HIGH",
  "PRESSURE_DROP_MODERATE",
  "PRESSURE_DROP_LOW",
  "RULE_EFFICIENCY_LOW_LEAK_HIGH",
  "RULE_PRESSURE_HIGH_LEAK_HIGH",
  "RULE_FLOW_BALANCED_LEAK_LOW",
] as const;
export const WaterFlowInferenceExplanationCodeV1Schema = z.enum(WaterFlowInferenceExplanationCodeValuesV1);

export const WaterFlowInferenceV1ResultSchema = z.object({
  irrigation_effectiveness: IrrigationEffectivenessV1Schema,
  leak_risk: LeakRiskV1Schema,
  confidence: z.number().min(0).max(1),
  explanation_codes: z.array(WaterFlowInferenceExplanationCodeV1Schema),
}).strict();

export type IrrigationEffectivenessV1 = z.infer<typeof IrrigationEffectivenessV1Schema>;
export type LeakRiskV1 = z.infer<typeof LeakRiskV1Schema>;
export type WaterFlowInferenceExplanationCodeV1 = z.infer<typeof WaterFlowInferenceExplanationCodeV1Schema>;
export type WaterFlowInferenceV1Result = z.infer<typeof WaterFlowInferenceV1ResultSchema>;
