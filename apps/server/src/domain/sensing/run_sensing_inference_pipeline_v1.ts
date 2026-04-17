import type {
  CanopyTemperatureInferenceV1Result,
  FertilityInferenceV1Result,
  SensorQualityInferenceV1Result,
  WaterFlowInferenceV1Result,
} from "@geox/contracts";
import type { Pool, PoolClient } from "pg";
import { appendDerivedSensingStateV1, type DerivedSensingStateTypeV1 } from "../../services/derived_sensing_state_v1.js";
import { appendSkillRunFact, digestJson } from "../skill_registry/facts.js";
import { inferCanopyTemperatureFromObservationAggregateV1 } from "./canopy_temperature_inference_v1.js";
import { inferFertilityFromObservationAggregateV1 } from "./fertility_inference_v1.js";
import { inferSensorQualityFromObservationAggregateV1 } from "./sensor_quality_inference_v1.js";
import { inferWaterFlowFromObservationAggregateV1 } from "./water_flow_inference_v1.js";

type DbConn = Pool | PoolClient;

type Observation = Record<string, unknown>;

export type RunSensingInferencePipelineV1Input = {
  db: DbConn;
  tenant_id: string;
  project_id: string | null;
  group_id: string | null;
  field_id: string;
  source_device_ids: string[];
  source_observation_ids?: string[];
  observations: Observation[];
  now: number;
};

export type SensingSkillRunSummaryV1 = {
  skill_id: "fertility_inference_v1" | "canopy_temperature_inference_v1" | "sensor_quality_inference_v1" | "water_flow_inference_v1";
  state_type: DerivedSensingStateTypeV1;
  success: boolean;
  fact_id: string | null;
  error: string | null;
};

export type RunSensingInferencePipelineV1Result = {
  runs: SensingSkillRunSummaryV1[];
};

function toFiniteNumber(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  const n = Number(input);
  return Number.isFinite(n) ? n : null;
}

function normalizeErrorCode(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim().slice(0, 120);
  }
  return "PIPELINE_SKILL_EXECUTION_FAILED";
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "Unknown pipeline skill error";
}

function getObservationDeviceId(observation: Observation): string | null {
  const raw = observation.device_id ?? observation.source_device_id ?? observation.sensor_id ?? observation.id;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function getObservationId(observation: Observation): string | null {
  const raw = observation.observation_id ?? observation.source_observation_id ?? observation.observation_fact_id ?? observation.fact_id;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function pickLatestFinite(observations: Observation[], keys: string[]): number | null {
  for (let i = observations.length - 1; i >= 0; i -= 1) {
    const observation = observations[i];
    for (const key of keys) {
      const n = toFiniteNumber(observation[key]);
      if (n != null) return n;
    }
  }
  return null;
}

function filterObservationsByDevices(observations: Observation[], deviceIds: string[]): Observation[] {
  if (!deviceIds.length) return observations;
  const allow = new Set(deviceIds);
  return observations.filter((x) => {
    const deviceId = getObservationDeviceId(x);
    return deviceId ? allow.has(deviceId) : true;
  });
}

export async function runSensingInferencePipelineV1(input: RunSensingInferencePipelineV1Input): Promise<RunSensingInferencePipelineV1Result> {
  const scopedObservations = filterObservationsByDevices(input.observations ?? [], input.source_device_ids ?? []);
  const primaryDeviceId = input.source_device_ids[0] ?? null;
  const sourceObservationIds = Array.from(
    new Set(
      [
        ...(Array.isArray(input.source_observation_ids) ? input.source_observation_ids : []),
        ...scopedObservations.map((x) => getObservationId(x)).filter((x): x is string => Boolean(x)),
      ].map((x) => String(x).trim()).filter(Boolean)
    )
  );

  async function persistFailureSkillRun(args: {
    skill_id: SensingSkillRunSummaryV1["skill_id"];
    error_code: string;
    input_payload: Record<string, unknown>;
  }): Promise<string | null> {
    try {
      const run = await appendSkillRunFact(input.db, {
        tenant_id: input.tenant_id,
        project_id: input.project_id ?? "default",
        group_id: input.group_id ?? "default",
        skill_id: args.skill_id,
        version: "v1",
        category: args.skill_id === "sensor_quality_inference_v1" ? "OBSERVABILITY" : "AGRONOMY",
        status: "ACTIVE",
        result_status: "FAILED",
        trigger_stage: "after_recommendation",
        scope_type: "FIELD",
        rollout_mode: "DIRECT",
        bind_target: input.field_id,
        operation_id: null,
        operation_plan_id: null,
        field_id: input.field_id,
        device_id: primaryDeviceId,
        input_digest: digestJson(args.input_payload),
        output_digest: digestJson({ error_code: args.error_code }),
        error_code: args.error_code,
        duration_ms: 0,
      });
      return run.fact_id;
    } catch {
      return null;
    }
  }

  const runs: SensingSkillRunSummaryV1[] = [];

  try {
    const aggregate = {
      soil_moisture_pct: pickLatestFinite(scopedObservations, ["soil_moisture_pct", "soil_moisture", "sm_pct"]),
      canopy_temp_c: pickLatestFinite(scopedObservations, ["canopy_temp_c", "canopy_temp", "temperature_c", "temp_c"]),
      ec_ds_m: pickLatestFinite(scopedObservations, ["ec_ds_m", "soil_ec_ds_m", "ec"]),
      observation_count: scopedObservations.length,
      source_ids: input.source_device_ids,
    };
    const inference: FertilityInferenceV1Result = inferFertilityFromObservationAggregateV1(aggregate);

    await appendDerivedSensingStateV1(input.db, {
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      field_id: input.field_id,
      state_type: "fertility_state",
      payload: {
        level: inference.fertility_level,
        fertility_level: inference.fertility_level,
        recommendation_bias: inference.recommendation_bias,
        salinity_risk: inference.salinity_risk,
        confidence: inference.confidence,
        soil_moisture_pct: aggregate.soil_moisture_pct,
        canopy_temp_c: aggregate.canopy_temp_c,
        ec_ds_m: aggregate.ec_ds_m,
      },
      confidence: inference.confidence,
      explanation_codes: inference.explanation_codes,
      source_observation_ids: sourceObservationIds,
      source_device_ids: input.source_device_ids,
      computed_at_ts_ms: input.now,
      source: "sensing_pipeline_v1",
    });

    await appendDerivedSensingStateV1(input.db, {
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      field_id: input.field_id,
      state_type: "salinity_risk_state",
      payload: {
        level: inference.salinity_risk,
        salinity_risk: inference.salinity_risk,
        recommendation_bias: inference.recommendation_bias,
        soil_moisture_pct: aggregate.soil_moisture_pct,
        canopy_temp_c: aggregate.canopy_temp_c,
        ec_ds_m: aggregate.ec_ds_m,
      },
      confidence: inference.confidence,
      explanation_codes: inference.explanation_codes,
      source_observation_ids: sourceObservationIds,
      source_device_ids: input.source_device_ids,
      computed_at_ts_ms: input.now,
      source: "sensing_pipeline_v1",
    });

    const run = await appendSkillRunFact(input.db, {
      tenant_id: input.tenant_id,
      project_id: input.project_id ?? "default",
      group_id: input.group_id ?? "default",
      skill_id: "fertility_inference_v1",
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
      device_id: primaryDeviceId,
      input_digest: digestJson(aggregate),
      output_digest: digestJson(inference),
      error_code: null,
      duration_ms: 0,
    });

    runs.push({
      skill_id: "fertility_inference_v1",
      state_type: "fertility_state",
      success: true,
      fact_id: run.fact_id,
      error: null,
    });
  } catch (error) {
    const error_code = normalizeErrorCode(error);
    const fact_id = await persistFailureSkillRun({
      skill_id: "fertility_inference_v1",
      error_code,
      input_payload: {
        observations: scopedObservations.length,
        source_device_ids: input.source_device_ids,
        computed_at_ts_ms: input.now,
      },
    });
    runs.push({
      skill_id: "fertility_inference_v1",
      state_type: "fertility_state",
      success: false,
      fact_id,
      error: normalizeErrorMessage(error),
    });
  }

  try {
    const aggregate = {
      canopy_temp_c: pickLatestFinite(scopedObservations, ["canopy_temp_c", "canopy_temp", "temperature_c", "temp_c"]),
      ambient_temp_c: pickLatestFinite(scopedObservations, ["ambient_temp_c", "air_temp_c", "ambient_temperature_c"]),
      relative_humidity_pct: pickLatestFinite(scopedObservations, ["relative_humidity_pct", "humidity_pct", "rh_pct"]),
      observation_count: scopedObservations.length,
      source_ids: input.source_device_ids,
    };
    const inference: CanopyTemperatureInferenceV1Result = inferCanopyTemperatureFromObservationAggregateV1(aggregate);

    await appendDerivedSensingStateV1(input.db, {
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      field_id: input.field_id,
      state_type: "canopy_temperature_state",
      payload: {
        level:
          inference.canopy_temp_status === "critical"
            ? "CRITICAL"
            : inference.canopy_temp_status === "elevated"
              ? "ELEVATED"
              : inference.canopy_temp_status === "normal"
                ? "NORMAL"
                : "UNKNOWN",
        canopy_temp_c: aggregate.canopy_temp_c,
        ambient_temp_c: aggregate.ambient_temp_c,
        relative_humidity_pct: aggregate.relative_humidity_pct,
      },
      confidence: inference.confidence,
      explanation_codes: inference.explanation_codes,
      source_observation_ids: sourceObservationIds,
      source_device_ids: input.source_device_ids,
      computed_at_ts_ms: input.now,
      source: "sensing_pipeline_v1",
    });

    await appendDerivedSensingStateV1(input.db, {
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      field_id: input.field_id,
      state_type: "evapotranspiration_risk_state",
      payload: {
        level: inference.evapotranspiration_risk.toUpperCase(),
        canopy_temp_status: inference.canopy_temp_status,
        canopy_temp_c: aggregate.canopy_temp_c,
        ambient_temp_c: aggregate.ambient_temp_c,
        relative_humidity_pct: aggregate.relative_humidity_pct,
      },
      confidence: inference.confidence,
      explanation_codes: inference.explanation_codes,
      source_observation_ids: sourceObservationIds,
      source_device_ids: input.source_device_ids,
      computed_at_ts_ms: input.now,
      source: "sensing_pipeline_v1",
    });

    const run = await appendSkillRunFact(input.db, {
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
      device_id: primaryDeviceId,
      input_digest: digestJson(aggregate),
      output_digest: digestJson(inference),
      error_code: null,
      duration_ms: 0,
    });

    runs.push({
      skill_id: "canopy_temperature_inference_v1",
      state_type: "canopy_temperature_state",
      success: true,
      fact_id: run.fact_id,
      error: null,
    });
  } catch (error) {
    const error_code = normalizeErrorCode(error);
    const fact_id = await persistFailureSkillRun({
      skill_id: "canopy_temperature_inference_v1",
      error_code,
      input_payload: {
        observations: scopedObservations.length,
        source_device_ids: input.source_device_ids,
        computed_at_ts_ms: input.now,
      },
    });
    runs.push({
      skill_id: "canopy_temperature_inference_v1",
      state_type: "canopy_temperature_state",
      success: false,
      fact_id,
      error: normalizeErrorMessage(error),
    });
  }

  try {
    const aggregate = {
      signal_strength_dbm: pickLatestFinite(scopedObservations, ["signal_strength_dbm", "rssi_dbm", "signal_dbm"]),
      battery_level_pct: pickLatestFinite(scopedObservations, ["battery_level_pct", "battery_pct", "battery"]),
      packet_loss_rate_pct: pickLatestFinite(scopedObservations, ["packet_loss_rate_pct", "packet_loss_pct", "packet_loss_rate"]),
      observation_count: scopedObservations.length,
      source_ids: input.source_device_ids,
    };
    const inference: SensorQualityInferenceV1Result = inferSensorQualityFromObservationAggregateV1(aggregate);

    await appendDerivedSensingStateV1(input.db, {
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      field_id: input.field_id,
      state_type: "sensor_quality_state",
      payload: {
        level:
          inference.sensor_quality === "good"
            ? "GOOD"
            : inference.sensor_quality === "fair"
              ? "DEGRADED"
              : inference.sensor_quality === "poor"
                ? "INVALID"
                : "UNKNOWN",
        sensor_quality: inference.sensor_quality,
        signal_strength_dbm: aggregate.signal_strength_dbm,
        battery_level_pct: aggregate.battery_level_pct,
        packet_loss_rate_pct: aggregate.packet_loss_rate_pct,
      },
      confidence: inference.confidence,
      explanation_codes: inference.explanation_codes,
      source_observation_ids: sourceObservationIds,
      source_device_ids: input.source_device_ids,
      computed_at_ts_ms: input.now,
      source: "sensing_pipeline_v1",
    });

    const run = await appendSkillRunFact(input.db, {
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
      device_id: primaryDeviceId,
      input_digest: digestJson(aggregate),
      output_digest: digestJson(inference),
      error_code: null,
      duration_ms: 0,
    });

    runs.push({
      skill_id: "sensor_quality_inference_v1",
      state_type: "sensor_quality_state",
      success: true,
      fact_id: run.fact_id,
      error: null,
    });
  } catch (error) {
    const error_code = normalizeErrorCode(error);
    const fact_id = await persistFailureSkillRun({
      skill_id: "sensor_quality_inference_v1",
      error_code,
      input_payload: {
        observations: scopedObservations.length,
        source_device_ids: input.source_device_ids,
        computed_at_ts_ms: input.now,
      },
    });
    runs.push({
      skill_id: "sensor_quality_inference_v1",
      state_type: "sensor_quality_state",
      success: false,
      fact_id,
      error: normalizeErrorMessage(error),
    });
  }

  try {
    const aggregate = {
      inlet_flow_lpm: pickLatestFinite(scopedObservations, ["inlet_flow_lpm", "inflow_lpm", "flow_in_lpm"]),
      outlet_flow_lpm: pickLatestFinite(scopedObservations, ["outlet_flow_lpm", "outflow_lpm", "flow_out_lpm"]),
      pressure_drop_kpa: pickLatestFinite(scopedObservations, ["pressure_drop_kpa", "delta_pressure_kpa", "pressure_loss_kpa"]),
      observation_count: scopedObservations.length,
      source_ids: input.source_device_ids,
    };
    const inference: WaterFlowInferenceV1Result = inferWaterFlowFromObservationAggregateV1(aggregate);

    await appendDerivedSensingStateV1(input.db, {
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      field_id: input.field_id,
      state_type: "irrigation_effectiveness_state",
      payload: {
        level: inference.irrigation_effectiveness.toUpperCase(),
        irrigation_effectiveness: inference.irrigation_effectiveness,
        inlet_flow_lpm: aggregate.inlet_flow_lpm,
        outlet_flow_lpm: aggregate.outlet_flow_lpm,
        pressure_drop_kpa: aggregate.pressure_drop_kpa,
      },
      confidence: inference.confidence,
      explanation_codes: inference.explanation_codes,
      source_observation_ids: sourceObservationIds,
      source_device_ids: input.source_device_ids,
      computed_at_ts_ms: input.now,
      source: "sensing_pipeline_v1",
    });

    await appendDerivedSensingStateV1(input.db, {
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      field_id: input.field_id,
      state_type: "leak_risk_state",
      payload: {
        level: inference.leak_risk.toUpperCase(),
        leak_risk: inference.leak_risk,
        irrigation_effectiveness: inference.irrigation_effectiveness,
        inlet_flow_lpm: aggregate.inlet_flow_lpm,
        outlet_flow_lpm: aggregate.outlet_flow_lpm,
        pressure_drop_kpa: aggregate.pressure_drop_kpa,
      },
      confidence: inference.confidence,
      explanation_codes: inference.explanation_codes,
      source_observation_ids: sourceObservationIds,
      source_device_ids: input.source_device_ids,
      computed_at_ts_ms: input.now,
      source: "sensing_pipeline_v1",
    });

    const run = await appendSkillRunFact(input.db, {
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
      device_id: primaryDeviceId,
      input_digest: digestJson(aggregate),
      output_digest: digestJson(inference),
      error_code: null,
      duration_ms: 0,
    });

    runs.push({
      skill_id: "water_flow_inference_v1",
      state_type: "irrigation_effectiveness_state",
      success: true,
      fact_id: run.fact_id,
      error: null,
    });
  } catch (error) {
    const error_code = normalizeErrorCode(error);
    const fact_id = await persistFailureSkillRun({
      skill_id: "water_flow_inference_v1",
      error_code,
      input_payload: {
        observations: scopedObservations.length,
        source_device_ids: input.source_device_ids,
        computed_at_ts_ms: input.now,
      },
    });
    runs.push({
      skill_id: "water_flow_inference_v1",
      state_type: "irrigation_effectiveness_state",
      success: false,
      fact_id,
      error: normalizeErrorMessage(error),
    });
  }

  return { runs };
}
