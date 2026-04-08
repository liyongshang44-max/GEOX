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

export async function runSensorQualityInferenceAndPersistV1(
  db: Pool | PoolClient,
  input: RunSensorQualityInferenceAndPersistV1Input
): Promise<{ inference: SensorQualityInferenceV1Result; computed_at_ts_ms: number }> {
  const telemetryDigestInput = {
    signal_strength_dbm: toFiniteNumber(input.signal_strength_dbm),
    battery_level_pct: toFiniteNumber(input.battery_level_pct),
    packet_loss_rate_pct: toFiniteNumber(input.packet_loss_rate_pct),
    device_id: input.device_id,
    field_id: input.field_id,
  };

  await appendSkillRunFact(db, {
    tenant_id: input.tenant_id,
    project_id: input.project_id ?? "default",
    group_id: input.group_id ?? "default",
    skill_id: "sensor_quality_inference_v1",
    version: "v1",
    category: "OBSERVABILITY",
    status: "ACTIVE",
    result_status: "SUCCESS",
    trigger_stage: "before_recommendation",
    scope_type: "DEVICE",
    rollout_mode: "DIRECT",
    bind_target: input.device_id,
    operation_id: null,
    operation_plan_id: null,
    field_id: input.field_id,
    device_id: input.device_id,
    input_digest: digestJson(telemetryDigestInput),
    output_digest: digestJson({ parsed: telemetryDigestInput }),
    error_code: null,
    duration_ms: 0,
  });

  const inference = inferSensorQualityFromObservationAggregateV1({
    signal_strength_dbm: telemetryDigestInput.signal_strength_dbm,
    battery_level_pct: telemetryDigestInput.battery_level_pct,
    packet_loss_rate_pct: telemetryDigestInput.packet_loss_rate_pct,
    observation_count: 1,
    source_ids: [input.device_id],
  });

  const computed_at_ts_ms = Number.isFinite(Number(input.computed_at_ts_ms))
    ? Number(input.computed_at_ts_ms)
    : Date.now();

  await appendDerivedSensingStateV1(db, {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    state_type: "sensor_quality_state",
    payload: {
      level: inference.sensor_quality,
      sensor_quality: inference.sensor_quality,
      signal_strength_dbm: telemetryDigestInput.signal_strength_dbm,
      battery_level_pct: telemetryDigestInput.battery_level_pct,
      packet_loss_rate_pct: telemetryDigestInput.packet_loss_rate_pct,
    },
    confidence: inference.confidence,
    explanation_codes: inference.explanation_codes,
    source_device_ids: [input.device_id],
    computed_at_ts_ms,
    source: "sensing_pipeline_v1",
  });

  await appendSkillRunFact(db, {
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
    device_id: input.device_id,
    input_digest: digestJson(telemetryDigestInput),
    output_digest: digestJson(inference),
    error_code: null,
    duration_ms: 0,
  });

  return { inference, computed_at_ts_ms };
}
