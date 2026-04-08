import type {
  CanopyTempStatusV1,
  CanopyTemperatureInferenceExplanationCodeV1,
  CanopyTemperatureInferenceV1Result,
  EvapotranspirationRiskV1,
} from "@geox/contracts";
import type { Pool, PoolClient } from "pg";
import { appendDerivedSensingStateV1 } from "../../services/derived_sensing_state_v1";
import { appendSkillRunFact, digestJson } from "../skill_registry/facts";

export type SensingCanopyObservationAggregateV1 = {
  canopy_temp_c?: number | null;
  ambient_temp_c?: number | null;
  relative_humidity_pct?: number | null;
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
  SKILL: "SENSING_SKILL_CANOPY_TEMPERATURE_INFERENCE_V1",
  NO_DEVICE_OBSERVATION: "NO_DEVICE_OBSERVATION",
  MISSING_CANOPY_TEMP: "MISSING_CANOPY_TEMP",
  CANOPY_TEMP_NORMAL: "CANOPY_TEMP_NORMAL",
  CANOPY_TEMP_ELEVATED: "CANOPY_TEMP_ELEVATED",
  CANOPY_TEMP_CRITICAL: "CANOPY_TEMP_CRITICAL",
  MISSING_AMBIENT_TEMP: "MISSING_AMBIENT_TEMP",
  AMBIENT_TEMP_AVAILABLE: "AMBIENT_TEMP_AVAILABLE",
  MISSING_RELATIVE_HUMIDITY: "MISSING_RELATIVE_HUMIDITY",
  HIGH_VPD_RISK: "HIGH_VPD_RISK",
  MODERATE_VPD_RISK: "MODERATE_VPD_RISK",
  LOW_VPD_RISK: "LOW_VPD_RISK",
  RULE_CANOPY_CRITICAL_ET_HIGH: "RULE_CANOPY_CRITICAL_ET_HIGH",
  RULE_CANOPY_ELEVATED_ET_MEDIUM: "RULE_CANOPY_ELEVATED_ET_MEDIUM",
  RULE_VPD_BASED_ET: "RULE_VPD_BASED_ET",
} as const satisfies Record<string, CanopyTemperatureInferenceExplanationCodeV1>;

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

export function inferCanopyTemperatureFromDeviceObservationV1(
  deviceObservation: DeviceObservationV1Input
): CanopyTemperatureInferenceV1Result {
  const observations = extractObservationList(deviceObservation);
  const canopySeries = observations
    .map((x) => firstFiniteFromObservation(x, ["canopy_temp_c", "canopy_temp", "temperature_c", "temp_c"]))
    .filter((x): x is number => x != null);
  const ambientSeries = observations
    .map((x) => firstFiniteFromObservation(x, ["ambient_temp_c", "air_temp_c", "ambient_temperature_c"]))
    .filter((x): x is number => x != null);
  const rhSeries = observations
    .map((x) => firstFiniteFromObservation(x, ["relative_humidity_pct", "humidity_pct", "rh_pct"]))
    .filter((x): x is number => x != null);

  return inferCanopyTemperatureFromObservationAggregateV1({
    canopy_temp_c: canopySeries.length ? canopySeries[canopySeries.length - 1] : null,
    ambient_temp_c: ambientSeries.length ? ambientSeries[ambientSeries.length - 1] : null,
    relative_humidity_pct: rhSeries.length ? rhSeries[rhSeries.length - 1] : null,
    observation_count: observations.length,
  });
}

export function inferCanopyTemperatureFromObservationAggregateV1(
  input: SensingCanopyObservationAggregateV1
): CanopyTemperatureInferenceV1Result {
  const canopyTemp = toFiniteNumber(input.canopy_temp_c);
  const ambientTemp = toFiniteNumber(input.ambient_temp_c);
  const rh = toFiniteNumber(input.relative_humidity_pct);
  const explanationCodes: CanopyTemperatureInferenceExplanationCodeV1[] = [EXPLANATION_CODES_V1.SKILL];

  if (canopyTemp == null && ambientTemp == null && rh == null) {
    explanationCodes.push(EXPLANATION_CODES_V1.NO_DEVICE_OBSERVATION);
    return {
      canopy_temp_status: "unknown",
      evapotranspiration_risk: "unknown",
      confidence: 0.2,
      explanation_codes: explanationCodes,
    };
  }

  let canopy_temp_status: CanopyTempStatusV1 = "unknown";
  if (canopyTemp == null) explanationCodes.push(EXPLANATION_CODES_V1.MISSING_CANOPY_TEMP);
  else if (canopyTemp >= 35) {
    canopy_temp_status = "critical";
    explanationCodes.push(EXPLANATION_CODES_V1.CANOPY_TEMP_CRITICAL);
  } else if (canopyTemp >= 30) {
    canopy_temp_status = "elevated";
    explanationCodes.push(EXPLANATION_CODES_V1.CANOPY_TEMP_ELEVATED);
  } else {
    canopy_temp_status = "normal";
    explanationCodes.push(EXPLANATION_CODES_V1.CANOPY_TEMP_NORMAL);
  }

  if (ambientTemp == null) explanationCodes.push(EXPLANATION_CODES_V1.MISSING_AMBIENT_TEMP);
  else explanationCodes.push(EXPLANATION_CODES_V1.AMBIENT_TEMP_AVAILABLE);

  if (rh == null) explanationCodes.push(EXPLANATION_CODES_V1.MISSING_RELATIVE_HUMIDITY);

  let evapotranspiration_risk: EvapotranspirationRiskV1;
  if (canopy_temp_status === "critical") {
    evapotranspiration_risk = "high";
    explanationCodes.push(EXPLANATION_CODES_V1.RULE_CANOPY_CRITICAL_ET_HIGH);
  } else if (canopy_temp_status === "elevated") {
    evapotranspiration_risk = "medium";
    explanationCodes.push(EXPLANATION_CODES_V1.RULE_CANOPY_ELEVATED_ET_MEDIUM);
  } else {
    const vpdProxy =
      canopyTemp != null && ambientTemp != null && rh != null
        ? (canopyTemp - ambientTemp) + (100 - rh) / 20
        : null;
    if (vpdProxy == null) {
      evapotranspiration_risk = canopy_temp_status === "normal" ? "low" : "unknown";
    } else if (vpdProxy >= 3) {
      evapotranspiration_risk = "high";
      explanationCodes.push(EXPLANATION_CODES_V1.HIGH_VPD_RISK);
    } else if (vpdProxy >= 1.5) {
      evapotranspiration_risk = "medium";
      explanationCodes.push(EXPLANATION_CODES_V1.MODERATE_VPD_RISK);
    } else {
      evapotranspiration_risk = "low";
      explanationCodes.push(EXPLANATION_CODES_V1.LOW_VPD_RISK);
    }
    explanationCodes.push(EXPLANATION_CODES_V1.RULE_VPD_BASED_ET);
  }

  const availability = [canopyTemp, ambientTemp, rh].filter((x) => x != null).length / 3;
  const baseConfidence = 0.45 + availability * 0.45;

  return {
    canopy_temp_status,
    evapotranspiration_risk,
    confidence: Number(clamp(baseConfidence, 0.2, 0.95).toFixed(3)),
    explanation_codes: Array.from(new Set(explanationCodes)),
  };
}

export type RunCanopyTemperatureInferenceAndPersistV1Input = {
  tenant_id: string;
  project_id: string | null;
  group_id: string | null;
  field_id: string;
  device_id: string;
  canopy_temp_c?: number | null;
  ambient_temp_c?: number | null;
  relative_humidity_pct?: number | null;
  computed_at_ts_ms?: number;
};

export async function runCanopyTemperatureInferenceAndPersistV1(
  db: Pool | PoolClient,
  input: RunCanopyTemperatureInferenceAndPersistV1Input
): Promise<{ inference: CanopyTemperatureInferenceV1Result; computed_at_ts_ms: number }> {
  const telemetryDigestInput = {
    canopy_temp_c: toFiniteNumber(input.canopy_temp_c),
    ambient_temp_c: toFiniteNumber(input.ambient_temp_c),
    relative_humidity_pct: toFiniteNumber(input.relative_humidity_pct),
    device_id: input.device_id,
    field_id: input.field_id,
  };

  await appendSkillRunFact(db, {
    tenant_id: input.tenant_id,
    project_id: input.project_id ?? "default",
    group_id: input.group_id ?? "default",
    skill_id: "canopy_temperature_inference_v1",
    version: "v1",
    category: "AGRONOMY",
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

  const inference = inferCanopyTemperatureFromObservationAggregateV1({
    canopy_temp_c: telemetryDigestInput.canopy_temp_c,
    ambient_temp_c: telemetryDigestInput.ambient_temp_c,
    relative_humidity_pct: telemetryDigestInput.relative_humidity_pct,
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
    state_type: "canopy_temperature_state",
    payload: {
      level: inference.canopy_temp_status,
      canopy_temp_status: inference.canopy_temp_status,
      canopy_temp_c: telemetryDigestInput.canopy_temp_c,
      ambient_temp_c: telemetryDigestInput.ambient_temp_c,
      relative_humidity_pct: telemetryDigestInput.relative_humidity_pct,
      confidence: inference.confidence,
    },
    confidence: inference.confidence,
    explanation_codes: inference.explanation_codes,
    source_device_ids: [input.device_id],
    computed_at_ts_ms,
    source: "sensing_pipeline_v1",
  });

  await appendDerivedSensingStateV1(db, {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    state_type: "evapotranspiration_risk_state",
    payload: {
      level: inference.evapotranspiration_risk,
      evapotranspiration_risk: inference.evapotranspiration_risk,
      canopy_temp_status: inference.canopy_temp_status,
      canopy_temp_c: telemetryDigestInput.canopy_temp_c,
      ambient_temp_c: telemetryDigestInput.ambient_temp_c,
      relative_humidity_pct: telemetryDigestInput.relative_humidity_pct,
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
    skill_id: "canopy_temperature_inference_v1",
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
    device_id: input.device_id,
    input_digest: digestJson(telemetryDigestInput),
    output_digest: digestJson(inference),
    error_code: null,
    duration_ms: 0,
  });

  return { inference, computed_at_ts_ms };
}
