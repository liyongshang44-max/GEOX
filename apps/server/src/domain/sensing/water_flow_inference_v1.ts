import type {
  IrrigationEffectivenessV1,
  LeakRiskV1,
  WaterFlowInferenceExplanationCodeV1,
  WaterFlowInferenceV1Result,
} from "@geox/contracts";

export type SensingWaterFlowAggregateV1 = {
  inlet_flow_lpm?: number | null;
  outlet_flow_lpm?: number | null;
  pressure_drop_kpa?: number | null;
  observation_count?: number | null;
  source_ids?: string[];
};

export type DeviceObservationV1Input =
  | Array<Record<string, unknown>>
  | { observations?: Array<Record<string, unknown>>; sources?: Array<Record<string, unknown>> }
  | Record<string, unknown>
  | null
  | undefined;

const EXPLANATION_CODES_V1 = {
  SKILL: "SENSING_SKILL_WATER_FLOW_INFERENCE_V1",
  NO_DEVICE_OBSERVATION: "NO_DEVICE_OBSERVATION",
  MISSING_INLET_FLOW_LPM: "MISSING_INLET_FLOW_LPM",
  MISSING_OUTLET_FLOW_LPM: "MISSING_OUTLET_FLOW_LPM",
  MISSING_PRESSURE_DROP_KPA: "MISSING_PRESSURE_DROP_KPA",
  HIGH_FLOW_EFFICIENCY: "HIGH_FLOW_EFFICIENCY",
  MEDIUM_FLOW_EFFICIENCY: "MEDIUM_FLOW_EFFICIENCY",
  LOW_FLOW_EFFICIENCY: "LOW_FLOW_EFFICIENCY",
  PRESSURE_DROP_HIGH: "PRESSURE_DROP_HIGH",
  PRESSURE_DROP_MODERATE: "PRESSURE_DROP_MODERATE",
  PRESSURE_DROP_LOW: "PRESSURE_DROP_LOW",
  RULE_EFFICIENCY_LOW_LEAK_HIGH: "RULE_EFFICIENCY_LOW_LEAK_HIGH",
  RULE_PRESSURE_HIGH_LEAK_HIGH: "RULE_PRESSURE_HIGH_LEAK_HIGH",
  RULE_FLOW_BALANCED_LEAK_LOW: "RULE_FLOW_BALANCED_LEAK_LOW",
} as const satisfies Record<string, WaterFlowInferenceExplanationCodeV1>;

function toFiniteNumber(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  const n = Number(input);
  return Number.isFinite(n) ? n : null;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function extractObservationList(deviceObservation: DeviceObservationV1Input): Array<Record<string, unknown>> {
  if (Array.isArray(deviceObservation)) return deviceObservation;
  if (Array.isArray(deviceObservation?.observations)) return deviceObservation.observations;
  if (Array.isArray(deviceObservation?.sources)) return deviceObservation.sources;
  if (deviceObservation && typeof deviceObservation === "object") return [deviceObservation];
  return [];
}

function firstFiniteFromObservation(observation: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const n = toFiniteNumber(observation[key]);
    if (n != null) return n;
  }
  return null;
}

export function inferWaterFlowFromDeviceObservationV1(deviceObservation: DeviceObservationV1Input): WaterFlowInferenceV1Result {
  const observations = extractObservationList(deviceObservation);
  const inletSeries = observations
    .map((x) => firstFiniteFromObservation(x, ["inlet_flow_lpm", "inflow_lpm", "flow_in_lpm"]))
    .filter((x): x is number => x != null);
  const outletSeries = observations
    .map((x) => firstFiniteFromObservation(x, ["outlet_flow_lpm", "outflow_lpm", "flow_out_lpm"]))
    .filter((x): x is number => x != null);
  const pressureSeries = observations
    .map((x) => firstFiniteFromObservation(x, ["pressure_drop_kpa", "delta_pressure_kpa", "pressure_loss_kpa"]))
    .filter((x): x is number => x != null);

  return inferWaterFlowFromObservationAggregateV1({
    inlet_flow_lpm: inletSeries.length ? inletSeries[inletSeries.length - 1] : null,
    outlet_flow_lpm: outletSeries.length ? outletSeries[outletSeries.length - 1] : null,
    pressure_drop_kpa: pressureSeries.length ? pressureSeries[pressureSeries.length - 1] : null,
    observation_count: observations.length,
  });
}

export function inferWaterFlowFromObservationAggregateV1(input: SensingWaterFlowAggregateV1): WaterFlowInferenceV1Result {
  const inletFlow = toFiniteNumber(input.inlet_flow_lpm);
  const outletFlow = toFiniteNumber(input.outlet_flow_lpm);
  const pressureDrop = toFiniteNumber(input.pressure_drop_kpa);
  const explanationCodes: WaterFlowInferenceExplanationCodeV1[] = [EXPLANATION_CODES_V1.SKILL];

  if (inletFlow == null && outletFlow == null && pressureDrop == null) {
    explanationCodes.push(EXPLANATION_CODES_V1.NO_DEVICE_OBSERVATION);
    return {
      irrigation_effectiveness: "unknown",
      leak_risk: "unknown",
      confidence: 0.2,
      explanation_codes: explanationCodes,
    };
  }

  if (inletFlow == null) explanationCodes.push(EXPLANATION_CODES_V1.MISSING_INLET_FLOW_LPM);
  if (outletFlow == null) explanationCodes.push(EXPLANATION_CODES_V1.MISSING_OUTLET_FLOW_LPM);
  if (pressureDrop == null) explanationCodes.push(EXPLANATION_CODES_V1.MISSING_PRESSURE_DROP_KPA);

  const flowEfficiency =
    inletFlow != null && outletFlow != null && inletFlow > 0
      ? clamp(outletFlow / inletFlow, 0, 1.5)
      : null;

  let irrigation_effectiveness: IrrigationEffectivenessV1;
  if (flowEfficiency == null) {
    irrigation_effectiveness = "unknown";
  } else if (flowEfficiency >= 0.9) {
    irrigation_effectiveness = "high";
    explanationCodes.push(EXPLANATION_CODES_V1.HIGH_FLOW_EFFICIENCY);
  } else if (flowEfficiency >= 0.75) {
    irrigation_effectiveness = "medium";
    explanationCodes.push(EXPLANATION_CODES_V1.MEDIUM_FLOW_EFFICIENCY);
  } else {
    irrigation_effectiveness = "low";
    explanationCodes.push(EXPLANATION_CODES_V1.LOW_FLOW_EFFICIENCY);
  }

  if (pressureDrop != null && pressureDrop >= 35) explanationCodes.push(EXPLANATION_CODES_V1.PRESSURE_DROP_HIGH);
  else if (pressureDrop != null && pressureDrop >= 20) explanationCodes.push(EXPLANATION_CODES_V1.PRESSURE_DROP_MODERATE);
  else if (pressureDrop != null) explanationCodes.push(EXPLANATION_CODES_V1.PRESSURE_DROP_LOW);

  let leak_risk: LeakRiskV1;
  if (irrigation_effectiveness === "low") {
    leak_risk = "high";
    explanationCodes.push(EXPLANATION_CODES_V1.RULE_EFFICIENCY_LOW_LEAK_HIGH);
  } else if (pressureDrop != null && pressureDrop >= 35) {
    leak_risk = "high";
    explanationCodes.push(EXPLANATION_CODES_V1.RULE_PRESSURE_HIGH_LEAK_HIGH);
  } else if (irrigation_effectiveness === "high" && pressureDrop != null && pressureDrop < 20) {
    leak_risk = "low";
    explanationCodes.push(EXPLANATION_CODES_V1.RULE_FLOW_BALANCED_LEAK_LOW);
  } else {
    leak_risk = "medium";
  }

  const availability = [inletFlow, outletFlow, pressureDrop].filter((x) => x != null).length / 3;
  const baseConfidence = 0.45 + availability * 0.45;

  return {
    irrigation_effectiveness,
    leak_risk,
    confidence: Number(clamp(baseConfidence, 0.2, 0.95).toFixed(3)),
    explanation_codes: Array.from(new Set(explanationCodes)),
  };
}
