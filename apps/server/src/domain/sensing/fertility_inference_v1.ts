import {
  inferFertilityFromDeviceObservationV1 as inferFertilityFromDeviceObservationCoreV1,
  inferFertilityFromObservationAggregateV1 as inferFertilityFromObservationAggregateCoreV1,
  type DeviceObservationV1Input,
  type SensingObservationAggregateV1,
} from "@geox/device-skills";
import type {
  FertilityInferenceV1Result,
  FertilityLevelV1,
  RecommendationBiasV1,
  SalinityRiskV1,
} from "@geox/contracts";
import type { Pool, PoolClient } from "pg";
import { appendDerivedSensingStateV1 } from "../../services/derived_sensing_state_v1";
import { appendSkillRunFact, digestJson } from "../skill_registry/facts";

export type {
  DeviceObservationV1Input,
  FertilityInferenceV1Result,
  FertilityLevelV1,
  RecommendationBiasV1,
  SalinityRiskV1,
  SensingObservationAggregateV1,
};

/**
 * Server entry keeps a thin boundary to device-skills to avoid rule forks.
 */
export function inferFertilityFromDeviceObservationV1(input: DeviceObservationV1Input): FertilityInferenceV1Result {
  return inferFertilityFromDeviceObservationCoreV1(input);
}

/**
 * Aggregate entry is preserved for route-level callers that already normalize inputs.
 */
export function inferFertilityFromObservationAggregateV1(input: SensingObservationAggregateV1): FertilityInferenceV1Result {
  return inferFertilityFromObservationAggregateCoreV1(input);
}


export type RunFertilityInferenceAndPersistV1Input = {
  tenant_id: string;
  project_id: string | null;
  group_id: string | null;
  field_id: string;
  device_id: string;
  soil_moisture_pct: number;
  canopy_temp_c: number;
  ec_ds_m?: number | null;
  computed_at_ts_ms?: number;
  source?: string;
};

type FertilityDerivedPayloadV1 = {
  level: FertilityLevelV1;
  fertility_level: FertilityLevelV1;
  recommendation_bias: RecommendationBiasV1;
  salinity_risk: SalinityRiskV1;
  confidence: number;
  soil_moisture_pct: number;
  canopy_temp_c: number;
  ec_ds_m: number | null;
};

type SalinityDerivedPayloadV1 = {
  level: SalinityRiskV1;
  salinity_risk: SalinityRiskV1;
  recommendation_bias: RecommendationBiasV1;
  soil_moisture_pct: number;
  canopy_temp_c: number;
  ec_ds_m: number | null;
};

function normalizeFertilityDerivedPayloadV1(input: {
  inference: FertilityInferenceV1Result;
  soil_moisture_pct: number;
  canopy_temp_c: number;
  ec_ds_m: number | null;
}): {
  fertility: FertilityDerivedPayloadV1;
  salinity: SalinityDerivedPayloadV1;
} {
  const fertility: FertilityDerivedPayloadV1 = {
    level: input.inference.fertility_level,
    fertility_level: input.inference.fertility_level,
    recommendation_bias: input.inference.recommendation_bias,
    salinity_risk: input.inference.salinity_risk,
    confidence: input.inference.confidence,
    soil_moisture_pct: input.soil_moisture_pct,
    canopy_temp_c: input.canopy_temp_c,
    ec_ds_m: input.ec_ds_m,
  };

  const salinity: SalinityDerivedPayloadV1 = {
    level: input.inference.salinity_risk,
    salinity_risk: input.inference.salinity_risk,
    recommendation_bias: input.inference.recommendation_bias,
    soil_moisture_pct: input.soil_moisture_pct,
    canopy_temp_c: input.canopy_temp_c,
    ec_ds_m: input.ec_ds_m,
  };

  return { fertility, salinity };
}

export async function runFertilityInferenceAndPersistV1(
  db: Pool | PoolClient,
  input: RunFertilityInferenceAndPersistV1Input
): Promise<{
  inference: FertilityInferenceV1Result;
  computed_at_ts_ms: number;
}> {
  const normalizedEcDsM = Number.isFinite(Number(input.ec_ds_m)) ? Number(input.ec_ds_m) : null;
  const telemetryDigestInput = {
    soil_moisture_pct: input.soil_moisture_pct,
    canopy_temp_c: input.canopy_temp_c,
    ec_ds_m: normalizedEcDsM,
    device_id: input.device_id,
    field_id: input.field_id,
  };
  await appendSkillRunFact(db, {
    tenant_id: input.tenant_id,
    project_id: input.project_id ?? "default",
    group_id: input.group_id ?? "default",
    skill_id: "soil_sensor_v1",
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
    output_digest: digestJson({ normalized: telemetryDigestInput }),
    error_code: null,
    duration_ms: 0,
  });
  const inference = inferFertilityFromObservationAggregateCoreV1({
    soil_moisture_pct: input.soil_moisture_pct,
    canopy_temp_c: input.canopy_temp_c,
    ec_ds_m: normalizedEcDsM,
    observation_count: 1,
    source_ids: [input.device_id],
  });

  const payload = normalizeFertilityDerivedPayloadV1({
    inference,
    soil_moisture_pct: input.soil_moisture_pct,
    canopy_temp_c: input.canopy_temp_c,
    ec_ds_m: normalizedEcDsM,
  });

  const computed_at_ts_ms = Number.isFinite(Number(input.computed_at_ts_ms))
    ? Number(input.computed_at_ts_ms)
    : Date.now();

  await appendDerivedSensingStateV1(db, {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    state_type: "fertility_state",
    payload: payload.fertility,
    confidence: inference.confidence,
    explanation_codes: inference.explanation_codes,
    source_device_ids: [input.device_id],
    computed_at_ts_ms,
    source: input.source ?? "decision_engine_v1",
  });

  await appendDerivedSensingStateV1(db, {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    state_type: "salinity_risk_state",
    payload: payload.salinity,
    confidence: inference.confidence,
    explanation_codes: inference.explanation_codes,
    source_device_ids: [input.device_id],
    computed_at_ts_ms,
    source: input.source ?? "decision_engine_v1",
  });
  await appendSkillRunFact(db, {
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
    device_id: input.device_id,
    input_digest: digestJson(telemetryDigestInput),
    output_digest: digestJson(inference),
    error_code: null,
    duration_ms: 0,
  });

  return { inference, computed_at_ts_ms };
}
