// scripts/runtime_acceptance/mcft_cap_04_twenty_four_tick_range_fixture_v1.ts
// Purpose: assemble the deterministic CAP-04 S7 24-config chain, dynamic hourly Evidence/forcing authority, verified pending-B single-tick service, and in-memory persistence required by range acceptance.
// Boundary: acceptance support only; no production database, route, scheduler, restart/backfill mode, recommendation, decision, action, calibration, model activation, or live-field claim.

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { CAP04_CANONICAL_FORECAST_AUTHORITY_CONTRACT_ID_V1 } from "../../apps/server/src/domain/twin_runtime/forecast_canonical_authority_v1.js";
import type { Cap04RuntimeConfigPayloadV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import type { Cap04SingleTickPersistencePortV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import { Cap04ForecastScenarioSingleTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import {
  Cap04ForecastScenarioRangeServiceV1,
  type RunCap04ForecastScenarioRangeInputV1,
} from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_range_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import { Cap04PendingScenarioBarrierSingleTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/pending_scenario_barrier_service_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { buildCap04ConfigChainFixtureV1 } from "./mcft_cap_04_contracts_config_fixture_v1.js";
import { buildCap04FutureForcingSnapshotV1 } from "./mcft_cap_04_future_forcing_fixture_v1.js";
import {
  CAP04_S6_CREATED_AT_V1,
  CAP04_S6_LOGICAL_TIME_V1,
  CAP04_S6_SCOPE_V1,
  InMemoryCap04SingleTickRuntimeV1,
  buildCap04S6SingleTickFixtureV1,
} from "./mcft_cap_04_single_tick_fixture_v1.js";

export const CAP04_S7_STANDARD_TICK_COUNT_V1 = 24;
export const CAP04_S7_TARGET_LOGICAL_TIME_V1 = "2026-06-04T01:00:00.000Z";
export const CAP04_S7_FINAL_NEXT_LOGICAL_TIME_V1 = "2026-06-04T02:00:00.000Z";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export type BuildCap04S7RangeFixtureOptionsV1 = {
  blocked_tick_index?: number;
  malformed_tick_index?: number;
};

export type Cap04S7RangeFixtureV1 = {
  runtime: InMemoryCap04SingleTickRuntimeV1;
  evidence_source: ReplayEvidenceSourcePortV1;
  range_service: Cap04ForecastScenarioRangeServiceV1;
  range_input: RunCap04ForecastScenarioRangeInputV1;
  configs_by_logical_time: ReadonlyMap<string, { ref: string; hash: string }>;
  evidence_load_count: () => number;
};

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * HOUR_MS).toISOString();
}

function addMinutesV1(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * MINUTE_MS).toISOString();
}

function sameScopeV1(left: TwinScopeKeyV1, right: TwinScopeKeyV1): boolean {
  return left.tenant_id === right.tenant_id
    && left.project_id === right.project_id
    && left.group_id === right.group_id
    && left.field_id === right.field_id
    && left.season_id === right.season_id
    && left.zone_id === right.zone_id;
}

function evidenceV1(input: {
  logical_time: string;
  record_type: string;
  source_record_id: string;
  binding_id: string;
  origin_source_id: string;
  role_time: Record<string, unknown>;
  canonical_payload: Record<string, unknown>;
  source_unit: string;
  canonical_unit: string;
}): CanonicalReplayEvidenceRecordV1 {
  const semantic = {
    record_type: input.record_type,
    source_record_id: input.source_record_id,
    binding_id: input.binding_id,
    origin_source_id: input.origin_source_id,
    role_time: input.role_time,
    canonical_payload: input.canonical_payload,
  };
  return {
    ...CAP04_S6_SCOPE_V1,
    dataset_id: "mcft_cap04_s7_twenty_four_tick_fixture_v1",
    source_record_id: input.source_record_id,
    source_record_hash: semanticHashV1(semantic),
    record_type: input.record_type,
    binding_id: input.binding_id,
    origin_source_kind: "CONTROLLED_REPLAY_FIXTURE",
    origin_source_id: input.origin_source_id,
    epistemic_class: "OBSERVED",
    available_to_runtime_at: String(input.role_time.ingested_at),
    role_time: structuredClone(input.role_time),
    quality: { status: "PASS" },
    source_payload: { ...structuredClone(input.canonical_payload), source_version: "1" },
    canonical_payload: structuredClone(input.canonical_payload),
    source_unit: input.source_unit,
    canonical_unit: input.canonical_unit,
    conversion_rule: { id: "IDENTITY_V1", version: "1" },
    limitations: ["CONTROLLED_SYNTHETIC", "NOT_FIELD_CALIBRATED"],
  };
}

function evidenceForTickV1(
  logicalTime: string,
  index: number,
  options: BuildCap04S7RangeFixtureOptionsV1,
): CanonicalReplayEvidenceRecordV1[] {
  const suffix = logicalTime.replaceAll("-", "").replaceAll(":", "").replace(".000Z", "Z");
  const ingestedAt = addMinutesV1(logicalTime, -5);
  const rainfall = evidenceV1({
    logical_time: logicalTime,
    record_type: "observed_rainfall_v1",
    source_record_id: `rain_cap04_s7_${suffix}`,
    binding_id: "rainfall_c8_hourly_v1",
    origin_source_id: "weather_replay_cap04_s7",
    role_time: {
      interval_start: addHoursV1(logicalTime, -1),
      interval_end: logicalTime,
      ingested_at: ingestedAt,
    },
    canonical_payload: { value: Number((0.2 + (index % 4) * 0.1).toFixed(6)), unit: "mm" },
    source_unit: "mm",
    canonical_unit: "mm",
  });
  const et0 = evidenceV1({
    logical_time: logicalTime,
    record_type: "historical_et0_estimate_v1",
    source_record_id: `et0_cap04_s7_${suffix}`,
    binding_id: "historical_et0_c8_hourly_v1",
    origin_source_id: "et0_replay_cap04_s7",
    role_time: {
      interval_start: addHoursV1(logicalTime, -1),
      interval_end: logicalTime,
      ingested_at: ingestedAt,
    },
    canonical_payload: {
      value: Number((0.1 + (index % 3) * 0.01).toFixed(6)),
      unit: "mm",
      calculation_method: "FAO56_PM_REPLAY_V1",
      method_version: "1",
    },
    source_unit: "mm",
    canonical_unit: "mm",
  });
  const soil = evidenceV1({
    logical_time: logicalTime,
    record_type: "soil_moisture_observation_v1",
    source_record_id: `soil_cap04_s7_${suffix}`,
    binding_id: "soil_obs_c8_20cm_v1",
    origin_source_id: "soil_sensor_cap04_s7",
    role_time: {
      observed_at: addMinutesV1(logicalTime, -10),
      ingested_at: ingestedAt,
    },
    canonical_payload: {
      value: Number((0.31 - index * 0.0005).toFixed(6)),
      unit: "fraction",
      quantity_kind: "VOLUMETRIC_WATER_CONTENT",
    },
    source_unit: "fraction",
    canonical_unit: "fraction",
  });
  if (options.blocked_tick_index === index) return [rainfall, et0, soil];

  const issuedAt = addMinutesV1(logicalTime, -45);
  const availableAt = addMinutesV1(logicalTime, -30);
  const weather = buildCap04FutureForcingSnapshotV1({
    kind: "weather",
    logical_time: logicalTime,
    issued_at: issuedAt,
    available_to_runtime_at: availableAt,
    source_record_id: `weather_cap04_s7_${suffix}`,
    seed: 100 + index,
    scope_override: CAP04_S6_SCOPE_V1,
  });
  const futureEt0 = buildCap04FutureForcingSnapshotV1({
    kind: "et0",
    logical_time: logicalTime,
    issued_at: issuedAt,
    available_to_runtime_at: availableAt,
    source_record_id: `future_et0_cap04_s7_${suffix}`,
    seed: 100 + index,
    scope_override: CAP04_S6_SCOPE_V1,
  });
  if (options.malformed_tick_index === index) {
    const points = weather.canonical_payload.points;
    if (!Array.isArray(points)) throw new Error("CAP04_S7_FIXTURE_WEATHER_POINTS_REQUIRED");
    weather.canonical_payload.points = points.slice(0, 71);
  }
  return [rainfall, et0, soil, weather, futureEt0];
}

function persistenceAdapterV1(runtime: InMemoryCap04SingleTickRuntimeV1): Cap04SingleTickPersistencePortV1 {
  return {
    acquireLease: runtime.acquireLease.bind(runtime),
    lookupARecordSet: runtime.lookupARecordSet.bind(runtime),
    commitARecordSet: runtime.commitARecordSet.bind(runtime),
    readARecordSet: runtime.readARecordSet.bind(runtime),
    lookupScenarioSet: runtime.lookupScenarioSet.bind(runtime),
    commitScenarioSet: runtime.commitScenarioSet.bind(runtime),
    readScenarioSet: runtime.readScenarioSet.bind(runtime),
    readScenarioSetBySourceForecast: runtime.readScenarioSetBySourceForecast.bind(runtime),
    detectPendingScenario: async (scope) => {
      const pending = await runtime.detectPendingScenario(scope);
      if (!pending) return null;
      return pending.payload.canonical_authority_contract_id === CAP04_CANONICAL_FORECAST_AUTHORITY_CONTRACT_ID_V1
        ? pending
        : null;
    },
    rebuildForecastProjections: runtime.rebuildForecastProjections.bind(runtime),
    rebuildScenarioProjections: runtime.rebuildScenarioProjections.bind(runtime),
  };
}

export async function buildCap04S7RangeFixtureV1(
  options: BuildCap04S7RangeFixtureOptionsV1 = {},
): Promise<Cap04S7RangeFixtureV1> {
  if (options.blocked_tick_index !== undefined
    && (!Number.isInteger(options.blocked_tick_index) || options.blocked_tick_index < 0 || options.blocked_tick_index >= CAP04_S7_STANDARD_TICK_COUNT_V1)) {
    throw new Error("CAP04_S7_FIXTURE_BLOCKED_INDEX_INVALID");
  }
  if (options.malformed_tick_index !== undefined
    && (!Number.isInteger(options.malformed_tick_index) || options.malformed_tick_index < 0 || options.malformed_tick_index >= CAP04_S7_STANDARD_TICK_COUNT_V1)) {
    throw new Error("CAP04_S7_FIXTURE_MALFORMED_INDEX_INVALID");
  }
  const base = buildCap04S6SingleTickFixtureV1();
  const chain = buildCap04ConfigChainFixtureV1();
  if (chain.configs.length !== CAP04_S7_STANDARD_TICK_COUNT_V1) throw new Error("CAP04_S7_FIXTURE_CONFIG_COUNT_MISMATCH");
  for (const config of chain.configs) await base.runtime.commitRuntimeConfig(config);

  const configsByLogicalTime = new Map<string, { ref: string; hash: string }>();
  const refs: Record<string, string> = {};
  const hashes: Record<string, string> = {};
  for (const config of chain.configs) {
    const payload = config.payload as unknown as Cap04RuntimeConfigPayloadV1;
    configsByLogicalTime.set(payload.effective_logical_time, { ref: config.object_id, hash: config.determinism_hash });
    refs[payload.effective_logical_time] = config.object_id;
    hashes[payload.effective_logical_time] = config.determinism_hash;
  }

  let loadCount = 0;
  const source: ReplayEvidenceSourcePortV1 = {
    async loadCandidateRecords(input) {
      if (!sameScopeV1(input.scope, CAP04_S6_SCOPE_V1)) throw new Error("CAP04_S7_FIXTURE_EVIDENCE_SCOPE_MISMATCH");
      const index = (Date.parse(input.logical_time) - Date.parse(CAP04_S6_LOGICAL_TIME_V1)) / HOUR_MS;
      if (!Number.isInteger(index) || index < 0 || index >= CAP04_S7_STANDARD_TICK_COUNT_V1) {
        throw new Error("CAP04_S7_FIXTURE_EVIDENCE_TIME_OUT_OF_RANGE");
      }
      loadCount += 1;
      return structuredClone(evidenceForTickV1(input.logical_time, index, options));
    },
  };

  const handoff = new PrepareNextTickInputServiceV1(base.runtime);
  const persistence = persistenceAdapterV1(base.runtime);
  const inner = new Cap04ForecastScenarioSingleTickServiceV1(
    handoff,
    source,
    base.runtime,
    persistence,
  );
  const barrier = new Cap04PendingScenarioBarrierSingleTickServiceV1(
    handoff,
    base.runtime,
    persistence,
    inner,
  );
  const rangeService = new Cap04ForecastScenarioRangeServiceV1(handoff, barrier);
  const rangeInput: RunCap04ForecastScenarioRangeInputV1 = {
    scope: structuredClone(CAP04_S6_SCOPE_V1),
    to_logical_time: CAP04_S7_TARGET_LOGICAL_TIME_V1,
    created_at: CAP04_S6_CREATED_AT_V1,
    runtime_config_refs_by_logical_time: refs,
    runtime_config_hashes_by_logical_time: hashes,
    authorized_future_forcing_binding_ids: ["binding_weather", "binding_et0"],
    crop_stage_context: structuredClone(base.crop_stage_context),
    lease_owner: "cap04_s7_range_acceptance",
    lease_duration_seconds: 300,
  };
  return {
    runtime: base.runtime,
    evidence_source: source,
    range_service: rangeService,
    range_input: rangeInput,
    configs_by_logical_time: configsByLogicalTime,
    evidence_load_count: () => loadCount,
  };
}
