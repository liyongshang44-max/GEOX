// Deterministic physical-source substitute for MCFT-CAP-09 S6 qualification.
// It emits the same five canonical Evidence record types consumed by the production
// PostgreSQL adapter. Every record is irreversibly marked as simulation-only.

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalReplayEvidenceRecordV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
export const SIMULATION_SOURCE_LANE_V1 = "PRODUCTION_EQUIVALENT_SHADOW_SIMULATION" as const;
export type SimulationOperationV1 = "accelerated" | "bootstrap" | "hourly" | "preflight";

export function simulationLeaseOwnerV1(input: {
  operation: SimulationOperationV1;
  subject_sha: string;
}): string {
  if (!/^[0-9a-f]{40}$/.test(input.subject_sha)) throw new Error("SIMULATION_LEASE_SUBJECT_SHA_INVALID");
  return `mcft-cap09-sim-${input.operation}-${input.subject_sha.slice(0, 12)}`;
}

export type SimulationEvidenceRecordV1 = CanonicalReplayEvidenceRecordV1 & {
  formal_eligible: false;
  is_simulated: true;
  evidence_level: "SIMULATION";
  source_lane: typeof SIMULATION_SOURCE_LANE_V1;
  simulation_run_id: string;
  simulation_model_version: "ROOT_ZONE_BUCKET_5_LAYER_V1";
  simulation_seed: number;
  logical_time: string;
};

export type SimulatorStateV1 = {
  layer_theta: [number, number, number, number, number];
  cumulative_rainfall_mm: number;
  cumulative_et0_mm: number;
  cumulative_drainage_mm: number;
};

export type SimulationHourV1 = {
  slot_id: string;
  logical_time: string;
  state: SimulatorStateV1;
  records: SimulationEvidenceRecordV1[];
  injected_conditions: string[];
  determinism_hash: string;
};

function addHours(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * HOUR_MS).toISOString();
}

function addMinutes(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * MINUTE_MS).toISOString();
}

function round(value: number, digits = 6): number {
  return Number(value.toFixed(digits));
}

function randomV1(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function futureWeatherPoints(logicalTime: string, slotIndex: number): Array<Record<string, unknown>> {
  return Array.from({ length: 72 }, (_, index) => {
    const horizon = index + 1;
    const storm = (slotIndex + horizon) % 17 === 0 ? 1.4 : 0;
    return {
      horizon,
      valid_from: addHours(logicalTime, horizon - 1),
      valid_to: addHours(logicalTime, horizon),
      precipitation_mm: storm,
      temperature_c: round(17 + 7 * Math.sin((slotIndex + horizon) * Math.PI / 12), 3),
    };
  });
}

function futureEt0Points(logicalTime: string, slotIndex: number): Array<Record<string, unknown>> {
  return Array.from({ length: 72 }, (_, index) => {
    const horizon = index + 1;
    const daylight = Math.max(0, Math.sin((slotIndex + horizon - 6) * Math.PI / 12));
    return {
      horizon,
      valid_from: addHours(logicalTime, horizon - 1),
      valid_to: addHours(logicalTime, horizon),
      et0_mm_per_hour: round(0.025 + 0.19 * daylight),
    };
  });
}

function recordV1(input: {
  scope: TwinScopeKeyV1;
  runId: string;
  seed: number;
  slotId: string;
  logicalTime: string;
  recordType: string;
  bindingId: string;
  originSourceId: string;
  epistemicClass: "OBSERVED" | "ESTIMATED" | "ASSUMED";
  roleTime: Record<string, unknown>;
  availableAt: string;
  canonicalPayload: Record<string, unknown>;
  unit: string;
  limitations?: string[];
}): SimulationEvidenceRecordV1 {
  const sourceRecordId = `mcft_cap09_sim_${input.runId}_${input.slotId}_${input.recordType}`;
  const semantic = {
    record_type: input.recordType,
    source_record_id: sourceRecordId,
    binding_id: input.bindingId,
    origin_source_id: input.originSourceId,
    role_time: input.roleTime,
    canonical_payload: input.canonicalPayload,
  };
  return {
    ...input.scope,
    dataset_id: `mcft_cap09_simulation_${input.runId}`,
    source_record_id: sourceRecordId,
    source_record_hash: semanticHashV1(semantic),
    record_type: input.recordType,
    binding_id: input.bindingId,
    origin_source_kind: "DETERMINISTIC_PHYSICAL_PROCESS_SIMULATOR",
    origin_source_id: input.originSourceId,
    epistemic_class: input.epistemicClass,
    available_to_runtime_at: input.availableAt,
    role_time: structuredClone(input.roleTime),
    quality: { status: "PASS", generated_by: "ROOT_ZONE_BUCKET_5_LAYER_V1" },
    source_payload: structuredClone(input.canonicalPayload),
    canonical_payload: structuredClone(input.canonicalPayload),
    source_unit: input.unit,
    canonical_unit: input.unit,
    conversion_rule: { id: "SIMULATOR_CANONICAL_IDENTITY_V1", version: "1" },
    limitations: ["SIMULATION_ONLY", "NOT_FIELD_EVIDENCE", ...(input.limitations ?? [])],
    formal_eligible: false,
    is_simulated: true,
    evidence_level: "SIMULATION",
    source_lane: SIMULATION_SOURCE_LANE_V1,
    simulation_run_id: input.runId,
    simulation_model_version: "ROOT_ZONE_BUCKET_5_LAYER_V1",
    simulation_seed: input.seed,
    logical_time: input.logicalTime,
  };
}

export function initialSimulatorStateV1(): SimulatorStateV1 {
  return {
    layer_theta: [0.315, 0.308, 0.301, 0.294, 0.288],
    cumulative_rainfall_mm: 0,
    cumulative_et0_mm: 0,
    cumulative_drainage_mm: 0,
  };
}

export function simulateHourV1(input: {
  scope: TwinScopeKeyV1;
  run_id: string;
  seed: number;
  window_start_utc: string;
  slot_index: number;
  previous_state: SimulatorStateV1;
}): SimulationHourV1 {
  if (!Number.isInteger(input.slot_index) || input.slot_index < 0 || input.slot_index > 23) {
    throw new Error("SIMULATION_SLOT_INDEX_INVALID");
  }
  const slotId = `O${String(input.slot_index).padStart(2, "0")}`;
  const logicalTime = addHours(input.window_start_utc, input.slot_index);
  const rand = randomV1(input.seed + input.slot_index * 7_919);
  const daylight = Math.max(0, Math.sin((input.slot_index - 6) * Math.PI / 12));
  const rainfall = input.slot_index === 4 ? 3.2 : input.slot_index === 13 ? 1.1 : 0;
  const irrigation = input.slot_index === 18 ? 2.4 : 0;
  const et0 = round(0.025 + 0.19 * daylight);
  const infiltration = rainfall + irrigation;
  const next = [...input.previous_state.layer_theta] as SimulatorStateV1["layer_theta"];
  const depths = [100, 150, 200, 250, 300];
  let downward = infiltration;
  let drainage = 0;
  for (let index = 0; index < next.length; index += 1) {
    const evapShare = et0 * [0.48, 0.27, 0.15, 0.07, 0.03][index];
    next[index] += downward / depths[index] - evapShare / depths[index];
    const excessMm = Math.max(0, (next[index] - 0.34) * depths[index]);
    next[index] -= excessMm / depths[index];
    downward = excessMm * 0.72;
  }
  drainage = downward;
  const state: SimulatorStateV1 = {
    layer_theta: next.map((value) => round(Math.max(0.12, Math.min(0.46, value)))) as SimulatorStateV1["layer_theta"],
    cumulative_rainfall_mm: round(input.previous_state.cumulative_rainfall_mm + rainfall),
    cumulative_et0_mm: round(input.previous_state.cumulative_et0_mm + et0),
    cumulative_drainage_mm: round(input.previous_state.cumulative_drainage_mm + drainage),
  };
  const ingestedAt = addMinutes(logicalTime, -2);
  const issuedAt = addMinutes(logicalTime, -20);
  const layers = state.layer_theta.map((theta, index) => ({
    depth_cm: [10, 30, 60, 100, 150][index],
    value: round(theta + (rand() - 0.5) * 0.003 + (input.slot_index >= 16 ? 0.0004 * (input.slot_index - 15) : 0)),
    unit: "fraction",
  }));
  const weightedTheta = round(layers.reduce((sum, layer, index) => sum + Number(layer.value) * [0.1, 0.15, 0.2, 0.25, 0.3][index], 0));
  const records: SimulationEvidenceRecordV1[] = [];
  const injected: string[] = [];
  {
    records.push(recordV1({
      scope: input.scope, runId: input.run_id, seed: input.seed, slotId, logicalTime,
      recordType: "observed_rainfall_v1", bindingId: "rainfall_obs_c8_v1",
      originSourceId: `sim_weather_station_${input.run_id}`, epistemicClass: "OBSERVED",
      roleTime: { interval_start: addHours(logicalTime, -1), interval_end: logicalTime, ingested_at: ingestedAt },
      availableAt: ingestedAt, canonicalPayload: { value: rainfall, unit: "mm" }, unit: "mm",
    }));
    records.push(recordV1({
      scope: input.scope, runId: input.run_id, seed: input.seed, slotId, logicalTime,
      recordType: "historical_et0_estimate_v1", bindingId: "et0_historical_estimate_c8_v1",
      originSourceId: `sim_et0_engine_${input.run_id}`, epistemicClass: "ESTIMATED",
      roleTime: { interval_start: addHours(logicalTime, -1), interval_end: logicalTime, ingested_at: ingestedAt },
      availableAt: ingestedAt,
      canonicalPayload: { value: et0, unit: "mm", calculation_method: "FAO56_EQUIVALENT_SIM_V1", method_version: "1" },
      unit: "mm",
    }));
    records.push(recordV1({
      scope: input.scope, runId: input.run_id, seed: input.seed, slotId, logicalTime,
      recordType: "soil_moisture_observation_v1", bindingId: "soil_obs_c8_20cm_v1",
      originSourceId: `sim_soil_probe_${input.run_id}`, epistemicClass: "OBSERVED",
      roleTime: { observed_at: addMinutes(logicalTime, -10), ingested_at: ingestedAt },
      availableAt: ingestedAt,
      canonicalPayload: { value: weightedTheta, unit: "fraction", quantity_kind: "VOLUMETRIC_WATER_CONTENT", layers },
      unit: "fraction",
      limitations: input.slot_index >= 16 ? ["CONTROLLED_SENSOR_DRIFT_ACTIVE"] : [],
    }));
  }
  if (input.slot_index !== 10) {
    records.push(recordV1({
      scope: input.scope, runId: input.run_id, seed: input.seed, slotId, logicalTime,
      recordType: "future_weather_assumption_v1", bindingId: "weather_assumption_c8_replay_v1",
      originSourceId: `sim_weather_forecast_${input.run_id}`, epistemicClass: "ASSUMED",
      roleTime: { issued_at: issuedAt, retrieved_at: ingestedAt, ingested_at: ingestedAt, valid_from: logicalTime, valid_to: addHours(logicalTime, 72) },
      availableAt: ingestedAt,
      canonicalPayload: { snapshot_kind: "FUTURE_WEATHER_ASSUMPTION", points: futureWeatherPoints(logicalTime, input.slot_index) },
      unit: "mm",
    }));
    records.push(recordV1({
      scope: input.scope, runId: input.run_id, seed: input.seed, slotId, logicalTime,
      recordType: "future_et0_assumption_v1", bindingId: "et0_future_assumption_c8_v1",
      originSourceId: `sim_et0_forecast_${input.run_id}`, epistemicClass: "ASSUMED",
      roleTime: { issued_at: issuedAt, retrieved_at: ingestedAt, ingested_at: ingestedAt, valid_from: logicalTime, valid_to: addHours(logicalTime, 72) },
      availableAt: ingestedAt,
      canonicalPayload: { snapshot_kind: "FUTURE_ET0_ASSUMPTION", points: futureEt0Points(logicalTime, input.slot_index) },
      unit: "mm",
    }));
  } else {
    injected.push("FUTURE_FORCING_OUTAGE");
  }
  if (input.slot_index === 9) injected.push("ACTUAL_OBSERVATION_DELAYED_INGRESS_PROBE");
  if (input.slot_index === 15) {
    const lateTime = addMinutes(logicalTime, -30);
    const late = recordV1({
      scope: input.scope, runId: input.run_id, seed: input.seed, slotId: `${slotId}_LATE`, logicalTime,
      recordType: "soil_moisture_observation_v1", bindingId: "soil_obs_c8_20cm_v1",
      originSourceId: `sim_soil_probe_${input.run_id}`, epistemicClass: "OBSERVED",
      roleTime: { observed_at: lateTime, ingested_at: addMinutes(logicalTime, -1) },
      availableAt: addMinutes(logicalTime, -1),
      canonicalPayload: { value: round(weightedTheta - 0.001), unit: "fraction", quantity_kind: "VOLUMETRIC_WATER_CONTENT", correction_reason: "DELAYED_PACKET" },
      unit: "fraction", limitations: ["INTENTIONALLY_DELAYED_PACKET"],
    });
    records.push(late);
    injected.push("LATE_OUT_OF_ORDER_APPEND_FORWARD");
  }
  if (input.slot_index >= 16) injected.push("CONTROLLED_SENSOR_DRIFT");
  return {
    slot_id: slotId,
    logical_time: logicalTime,
    state,
    records,
    injected_conditions: injected,
    determinism_hash: semanticHashV1({ slot_id: slotId, logical_time: logicalTime, state, records }),
  };
}

export function buildSimulationWindowV1(input: {
  scope: TwinScopeKeyV1;
  run_id: string;
  seed: number;
  window_start_utc: string;
}): SimulationHourV1[] {
  let state = initialSimulatorStateV1();
  return Array.from({ length: 24 }, (_, slotIndex) => {
    const hour = simulateHourV1({ ...input, slot_index: slotIndex, previous_state: state });
    state = hour.state;
    return hour;
  });
}
