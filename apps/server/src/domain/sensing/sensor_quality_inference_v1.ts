import type {
  SensorQualityInferenceExplanationCodeV1,
  SensorQualityInferenceV1Result,
  SensorQualityV1,
} from "@geox/contracts";
import type { Pool, PoolClient } from "pg";
import { appendDerivedSensingStateV1 } from "../../services/derived_sensing_state_v1";
import { appendSkillRunFact, digestJson } from "../skill_registry/facts";

export type SensingSensorQualityAggregateV1 = {
  signal_strength_dbm?: number | null;
  battery_level_pct?: number | null;
  packet_loss_rate_pct?: number | null;
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
  SKILL: "SENSING_SKILL_SENSOR_QUALITY_INFERENCE_V1",
  NO_DEVICE_OBSERVATION: "NO_DEVICE_OBSERVATION",
  MISSING_SIGNAL_STRENGTH: "MISSING_SIGNAL_STRENGTH",
  SIGNAL_STRONG: "SIGNAL_STRONG",
  SIGNAL_WEAK: "SIGNAL_WEAK",
  MISSING_BATTERY_LEVEL: "MISSING_BATTERY_LEVEL",
  BATTERY_LOW: "BATTERY_LOW",
  BATTERY_OK: "BATTERY_OK",
  MISSING_PACKET_LOSS_RATE: "MISSING_PACKET_LOSS_RATE",
  PACKET_LOSS_HIGH: "PACKET_LOSS_HIGH",
  PACKET_LOSS_MODERATE: "PACKET_LOSS_MODERATE",
  PACKET_LOSS_LOW: "PACKET_LOSS_LOW",
  RULE_SIGNAL_OR_PACKET_POOR: "RULE_SIGNAL_OR_PACKET_POOR",
  RULE_BATTERY_OR_PACKET_FAIR: "RULE_BATTERY_OR_PACKET_FAIR",
  RULE_SIGNAL_BATTERY_PACKET_GOOD: "RULE_SIGNAL_BATTERY_PACKET_GOOD",
} as const satisfies Record<string, SensorQualityInferenceExplanationCodeV1>;

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

export function inferSensorQualityFromDeviceObservationV1(deviceObservation: DeviceObservationV1Input): SensorQualityInferenceV1Result {
  const observations = extractObservationList(deviceObservation);
  const signalSeries = observations
    .map((x) => firstFiniteFromObservation(x, ["signal_strength_dbm", "rssi_dbm", "signal_dbm"]))
    .filter((x): x is number => x != null);
  const batterySeries = observations
    .map((x) => firstFiniteFromObservation(x, ["battery_level_pct", "battery_pct", "battery"]))
    .filter((x): x is number => x != null);
  const packetLossSeries = observations
    .map((x) => firstFiniteFromObservation(x, ["packet_loss_rate_pct", "packet_loss_pct", "packet_loss_rate"]))
    .filter((x): x is number => x != null);

  return inferSensorQualityFromObservationAggregateV1({
    signal_strength_dbm: signalSeries.length ? signalSeries[signalSeries.length - 1] : null,
    battery_level_pct: batterySeries.length ? batterySeries[batterySeries.length - 1] : null,
    packet_loss_rate_pct: packetLossSeries.length ? packetLossSeries[packetLossSeries.length - 1] : null,
    observation_count: observations.length,
  });
}

export function inferSensorQualityFromObservationAggregateV1(input: SensingSensorQualityAggregateV1): SensorQualityInferenceV1Result {
  const signal = toFiniteNumber(input.signal_strength_dbm);
  const battery = toFiniteNumber(input.battery_level_pct);
  const packetLoss = toFiniteNumber(input.packet_loss_rate_pct);
  const explanationCodes: SensorQualityInferenceExplanationCodeV1[] = [EXPLANATION_CODES_V1.SKILL];

  if (signal == null && battery == null && packetLoss == null) {
    explanationCodes.push(EXPLANATION_CODES_V1.NO_DEVICE_OBSERVATION);
    return {
      sensor_quality: "unknown",
      confidence: 0.2,
      explanation_codes: explanationCodes,
    };
  }

  if (signal == null) explanationCodes.push(EXPLANATION_CODES_V1.MISSING_SIGNAL_STRENGTH);
  else if (signal <= -90) explanationCodes.push(EXPLANATION_CODES_V1.SIGNAL_WEAK);
  else explanationCodes.push(EXPLANATION_CODES_V1.SIGNAL_STRONG);

  if (battery == null) explanationCodes.push(EXPLANATION_CODES_V1.MISSING_BATTERY_LEVEL);
  else if (battery < 25) explanationCodes.push(EXPLANATION_CODES_V1.BATTERY_LOW);
  else explanationCodes.push(EXPLANATION_CODES_V1.BATTERY_OK);

  if (packetLoss == null) explanationCodes.push(EXPLANATION_CODES_V1.MISSING_PACKET_LOSS_RATE);
  else if (packetLoss >= 10) explanationCodes.push(EXPLANATION_CODES_V1.PACKET_LOSS_HIGH);
  else if (packetLoss >= 3) explanationCodes.push(EXPLANATION_CODES_V1.PACKET_LOSS_MODERATE);
  else explanationCodes.push(EXPLANATION_CODES_V1.PACKET_LOSS_LOW);

  let sensor_quality: SensorQualityV1;
  if ((signal != null && signal <= -95) || (packetLoss != null && packetLoss >= 10)) {
    sensor_quality = "poor";
    explanationCodes.push(EXPLANATION_CODES_V1.RULE_SIGNAL_OR_PACKET_POOR);
  } else if ((battery != null && battery < 25) || (packetLoss != null && packetLoss >= 3)) {
    sensor_quality = "fair";
    explanationCodes.push(EXPLANATION_CODES_V1.RULE_BATTERY_OR_PACKET_FAIR);
  } else {
    sensor_quality = "good";
    explanationCodes.push(EXPLANATION_CODES_V1.RULE_SIGNAL_BATTERY_PACKET_GOOD);
  }

  const availability = [signal, battery, packetLoss].filter((x) => x != null).length / 3;
  const baseConfidence = 0.5 + availability * 0.4;

  return {
    sensor_quality,
    confidence: Number(clamp(baseConfidence, 0.2, 0.95).toFixed(3)),
    explanation_codes: Array.from(new Set(explanationCodes)),
  };
}

export type RunSensorQualityInferenceAndPersistV1Input = {
  tenant_id: string;
  project_id: string | null;
  group_id: string | null;
  field_id: string;
  device_id: string;
  signal_strength_dbm?: number | null;
  battery_level_pct?: number | null;
  packet_loss_rate_pct?: number | null;
  computed_at_ts_ms?: number;
};

export type RunSensorQualityInferenceV1Input = {
  tenant_id: string;
  project_id: string | null;
  group_id: string | null;
  field_id: string;
  source_device_ids?: string[];
  observation?: DeviceObservationV1Input;
  computed_at_ts_ms?: number;
};

export type RunSensorQualityInferenceV1Result = {
  state_type: "sensor_quality_state";
  fact_id: string;
  payload_summary: {
    sensor_quality: SensorQualityV1;
    confidence: number;
    explanation_codes: SensorQualityInferenceExplanationCodeV1[];
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

function toSensorQualityStateLevel(sensorQuality: SensorQualityV1): "GOOD" | "DEGRADED" | "INVALID" | "UNKNOWN" {
  if (sensorQuality === "good") return "GOOD";
  if (sensorQuality === "fair") return "DEGRADED";
  if (sensorQuality === "poor") return "INVALID";
  return "UNKNOWN";
}

export async function runSensorQualityInferenceV1(
  db: Pool | PoolClient,
  input: RunSensorQualityInferenceV1Input
): Promise<RunSensorQualityInferenceV1Result> {
  const observations = extractObservationList(input.observation);
  const sourceDeviceIds = pickSourceDeviceIds(observations, input.source_device_ids);
  const aggregate: SensingSensorQualityAggregateV1 = {
    signal_strength_dbm: pickLatestFinite(observations, ["signal_strength_dbm", "rssi_dbm", "signal_dbm"]),
    battery_level_pct: pickLatestFinite(observations, ["battery_level_pct", "battery_pct", "battery"]),
    packet_loss_rate_pct: pickLatestFinite(observations, ["packet_loss_rate_pct", "packet_loss_pct", "packet_loss_rate"]),
    observation_count: observations.length,
    source_ids: sourceDeviceIds,
  };
  const inference = inferSensorQualityFromObservationAggregateV1(aggregate);
  const computed_at_ts_ms = Number.isFinite(Number(input.computed_at_ts_ms)) ? Number(input.computed_at_ts_ms) : Date.now();
  const payload = {
    level: toSensorQualityStateLevel(inference.sensor_quality),
    sensor_quality: inference.sensor_quality,
    confidence: inference.confidence,
    explanation_codes: inference.explanation_codes,
    signal_strength_dbm: aggregate.signal_strength_dbm ?? null,
    battery_level_pct: aggregate.battery_level_pct ?? null,
    packet_loss_rate_pct: aggregate.packet_loss_rate_pct ?? null,
    observation_count: aggregate.observation_count ?? 0,
  } satisfies Record<string, unknown>;

  await appendDerivedSensingStateV1(db, {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    state_type: "sensor_quality_state",
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
    skill_id: "sensor_quality_inference_v1",
    version: "v1",
    category: "OBSERVABILITY",
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
    state_type: "sensor_quality_state",
    fact_id: run.fact_id,
    payload_summary: {
      sensor_quality: inference.sensor_quality,
      confidence: inference.confidence,
      explanation_codes: inference.explanation_codes,
    },
    payload,
  };
}

export async function runSensorQualityInferenceAndPersistV1(
  db: Pool | PoolClient,
  input: RunSensorQualityInferenceAndPersistV1Input
): Promise<{ inference: SensorQualityInferenceV1Result; computed_at_ts_ms: number }> {
  const computed_at_ts_ms = Number.isFinite(Number(input.computed_at_ts_ms)) ? Number(input.computed_at_ts_ms) : Date.now();
  const run = await runSensorQualityInferenceV1(db, {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    source_device_ids: [input.device_id],
    observation: {
      signal_strength_dbm: input.signal_strength_dbm,
      battery_level_pct: input.battery_level_pct,
      packet_loss_rate_pct: input.packet_loss_rate_pct,
      device_id: input.device_id,
    },
    computed_at_ts_ms,
  });

  return {
    inference: {
      sensor_quality: run.payload_summary.sensor_quality,
      confidence: run.payload_summary.confidence,
      explanation_codes: run.payload_summary.explanation_codes,
    },
    computed_at_ts_ms,
  };
}
