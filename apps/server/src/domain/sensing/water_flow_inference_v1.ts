import type {
  IrrigationEffectivenessV1,
  LeakRiskV1,
  WaterFlowInferenceExplanationCodeV1,
  WaterFlowInferenceV1Result,
} from "@geox/contracts";
import type { Pool, PoolClient } from "pg";
import { appendDerivedSensingStateV1 } from "../../services/derived_sensing_state_v1";
import { appendSkillRunFact, digestJson } from "../skill_registry/facts";

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

export type RunWaterFlowInferenceAndPersistV1Input = {
  tenant_id: string;
  project_id: string | null;
  group_id: string | null;
  field_id: string;
  device_id: string;
  inlet_flow_lpm?: number | null;
  outlet_flow_lpm?: number | null;
  pressure_drop_kpa?: number | null;
  computed_at_ts_ms?: number;
};

export type RunWaterFlowInferenceV1Input = {
  tenant_id: string;
  project_id: string | null;
  group_id: string | null;
  field_id: string;
  source_device_ids?: string[];
  observation?: DeviceObservationV1Input;
  computed_at_ts_ms?: number;
};

export type RunWaterFlowInferenceV1Result = {
  state_type: "water_flow_state";
  fact_id: string;
  payload_summary: {
    irrigation_effectiveness: IrrigationEffectivenessV1;
    leak_risk: LeakRiskV1;
    confidence: number;
    explanation_codes: WaterFlowInferenceExplanationCodeV1[];
  };
  payload: Record<string, unknown>;
};

function pickLatestFinite(observations: Array<Record<string, unknown>>, keys: string[]): number | null {
  for (let i = observations.length - 1; i >= 0; i -= 1) {
    const value = firstFiniteFromObservation(observations[i], keys);
    if (value != null) return value;
  }
  return null;
}

function pickSourceDeviceIds(observations: Array<Record<string, unknown>>, inputDeviceIds?: string[]): string[] {
  const inferred = observations
    .map((x) => x.device_id ?? x.source_device_id ?? x.sensor_id ?? x.id)
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim());
  const fromInput = (inputDeviceIds ?? []).map((x) => String(x ?? "").trim()).filter(Boolean);
  return Array.from(new Set([...fromInput, ...inferred]));
}

export async function runWaterFlowInferenceV1(
  db: Pool | PoolClient,
  input: RunWaterFlowInferenceV1Input
): Promise<RunWaterFlowInferenceV1Result> {
  const observations = extractObservationList(input.observation);
  const sourceDeviceIds = pickSourceDeviceIds(observations, input.source_device_ids);
  const aggregate: SensingWaterFlowAggregateV1 = {
    inlet_flow_lpm: pickLatestFinite(observations, ["inlet_flow_lpm", "inflow_lpm", "flow_in_lpm"]),
    outlet_flow_lpm: pickLatestFinite(observations, ["outlet_flow_lpm", "outflow_lpm", "flow_out_lpm"]),
    pressure_drop_kpa: pickLatestFinite(observations, ["pressure_drop_kpa", "delta_pressure_kpa", "pressure_loss_kpa"]),
    observation_count: observations.length,
    source_ids: sourceDeviceIds,
  };

  const inference = inferWaterFlowFromObservationAggregateV1(aggregate);
  const computed_at_ts_ms = Number.isFinite(Number(input.computed_at_ts_ms)) ? Number(input.computed_at_ts_ms) : Date.now();
  const payload = {
    irrigation_effectiveness: inference.irrigation_effectiveness,
    leak_risk: inference.leak_risk,
    confidence: inference.confidence,
    explanation_codes: inference.explanation_codes,
    inlet_flow_lpm: aggregate.inlet_flow_lpm ?? null,
    outlet_flow_lpm: aggregate.outlet_flow_lpm ?? null,
    pressure_drop_kpa: aggregate.pressure_drop_kpa ?? null,
    observation_count: aggregate.observation_count ?? 0,
  } satisfies Record<string, unknown>;

  await appendDerivedSensingStateV1(db, {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    state_type: "water_flow_state",
    payload,
    confidence: inference.confidence,
    explanation_codes: inference.explanation_codes,
    source_device_ids: sourceDeviceIds,
    computed_at_ts_ms,
    source: "sensing_pipeline_v1",
  });

  const run = await appendSkillRunFact(db, {
    tenant_id: input.tenant_id,
    project_id: input.project_id ?? "default",
    group_id: input.group_id ?? "default",
    skill_id: "water_flow_inference_v1",
    version: "v1",
    category: "AGRONOMY",
    status: "ACTIVE",
    result_status: "SUCCESS",
    trigger_stage: "after_recommendation",
    scope_type: "FIELD",
    rollout_mode: "DIRECT",
    bind_target: input.field_id,
    operation_id: null,
    operation_plan_id: null,
    field_id: input.field_id,
    device_id: sourceDeviceIds[0] ?? null,
    input_digest: digestJson(aggregate),
    output_digest: digestJson(payload),
    error_code: null,
    duration_ms: 0,
  });

  return {
    state_type: "water_flow_state",
    fact_id: run.fact_id,
    payload_summary: {
      irrigation_effectiveness: inference.irrigation_effectiveness,
      leak_risk: inference.leak_risk,
      confidence: inference.confidence,
      explanation_codes: inference.explanation_codes,
    },
    payload,
  };
}

export async function runWaterFlowInferenceAndPersistV1(
  db: Pool | PoolClient,
  input: RunWaterFlowInferenceAndPersistV1Input
): Promise<{ inference: WaterFlowInferenceV1Result; computed_at_ts_ms: number }> {
  const computed_at_ts_ms = Number.isFinite(Number(input.computed_at_ts_ms)) ? Number(input.computed_at_ts_ms) : Date.now();
  const run = await runWaterFlowInferenceV1(db, {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    source_device_ids: [input.device_id],
    observation: {
      inlet_flow_lpm: input.inlet_flow_lpm,
      outlet_flow_lpm: input.outlet_flow_lpm,
      pressure_drop_kpa: input.pressure_drop_kpa,
      device_id: input.device_id,
    },
    computed_at_ts_ms,
  });

  return {
    inference: {
      irrigation_effectiveness: run.payload_summary.irrigation_effectiveness,
      leak_risk: run.payload_summary.leak_risk,
      confidence: run.payload_summary.confidence,
      explanation_codes: run.payload_summary.explanation_codes,
    },
    computed_at_ts_ms,
  };
}
