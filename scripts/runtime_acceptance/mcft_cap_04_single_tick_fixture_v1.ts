// scripts/runtime_acceptance/mcft_cap_04_single_tick_fixture_v1.ts
// Purpose: assemble one deterministic CAP-04 S6 predecessor handoff, current Evidence set, C1 Runtime Config, and mutable in-memory A1/B persistence runtime.
// Boundary: acceptance fixture only; no production database, route, scheduler, range, restart/backfill, recommendation, decision, or action.

import {
  computeMemberDeterminismHashV1,
  semanticHashV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import type {
  Cap04ARecordSetV1,
  Cap04ScenarioSetRecordV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import {
  validateCap04ARecordSetV1,
  validateCap04ScenarioSetRecordV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_scenario_record_set_validator_v1.js";
import type { Cap04RuntimeConfigPayloadV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.js";
import type {
  Cap04SingleTickPersistencePortV1,
  ExecuteCap04SingleTickInputV1,
} from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import { Cap04ForecastScenarioSingleTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  NextTickReadPortV1,
  PersistedNextTickSnapshotV1,
  ReplayEvidenceSourcePortV1,
  RuntimeConfigRepositoryPortV1,
  RuntimeLeaseClaimV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  buildCap04ConfigChainFixtureV1,
  CAP04_FIXTURE_SCOPE_V1,
} from "./mcft_cap_04_contracts_config_fixture_v1.js";
import { buildCap04FutureForcingSnapshotV1 } from "./mcft_cap_04_future_forcing_fixture_v1.js";

export const CAP04_S6_LOGICAL_TIME_V1 = "2026-06-03T02:00:00.000Z";
export const CAP04_S6_CREATED_AT_V1 = "2026-06-03T02:10:00.000Z";
export const CAP04_S6_NEXT_TIME_V1 = "2026-06-03T03:00:00.000Z";
export const CAP04_S6_SCOPE_V1: TwinScopeKeyV1 = { ...CAP04_FIXTURE_SCOPE_V1 };

function addMinutesV1(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

function addHoursV1(value: string, hours: number): string {
  return addMinutesV1(value, hours * 60);
}

function envelopeV1(input: {
  object_id: string;
  object_type: CanonicalObjectEnvelopeV1["object_type"];
  logical_time: string;
  runtime_config_ref: string | null;
  runtime_config_hash: string | null;
  lineage_id: string;
  revision_id: string;
  payload: Record<string, unknown>;
  determinism_hash?: string;
}): CanonicalObjectEnvelopeV1 {
  const value: CanonicalObjectEnvelopeV1 = {
    object_id: input.object_id,
    object_type: input.object_type,
    schema_version: "v1",
    ...CAP04_S6_SCOPE_V1,
    logical_time: input.logical_time,
    as_of: input.logical_time,
    source_refs: ["mcft_rb_bf1da664164a4fedda249bcb"],
    evidence_refs: [],
    runtime_config_ref: input.runtime_config_ref,
    runtime_config_hash: input.runtime_config_hash,
    idempotency_key: `fixture_key_${input.object_id}`,
    determinism_hash: input.determinism_hash ?? "",
    limitations: ["CONTROLLED_SYNTHETIC", "NOT_FIELD_CALIBRATED"],
    created_at: CAP04_S6_CREATED_AT_V1,
    lineage_id: input.lineage_id,
    revision_id: input.revision_id,
    payload: structuredClone(input.payload),
  };
  if (!input.determinism_hash) {
    value.determinism_hash = computeMemberDeterminismHashV1(value as unknown as Record<string, unknown>);
  }
  return value;
}

function evidenceV1(input: {
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
    dataset_id: "mcft_cap04_s6_single_tick_fixture_v1",
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

function currentEvidenceV1(): CanonicalReplayEvidenceRecordV1[] {
  const ingestedAt = addMinutesV1(CAP04_S6_LOGICAL_TIME_V1, -5);
  const rainfall = evidenceV1({
    record_type: "observed_rainfall_v1",
    source_record_id: "rain_cap04_s6_001",
    binding_id: "rainfall_c8_hourly_v1",
    origin_source_id: "weather_replay_cap04_s6",
    role_time: {
      interval_start: addHoursV1(CAP04_S6_LOGICAL_TIME_V1, -1),
      interval_end: CAP04_S6_LOGICAL_TIME_V1,
      ingested_at: ingestedAt,
    },
    canonical_payload: { value: 0.4, unit: "mm" },
    source_unit: "mm",
    canonical_unit: "mm",
  });
  const et0 = evidenceV1({
    record_type: "historical_et0_estimate_v1",
    source_record_id: "et0_cap04_s6_001",
    binding_id: "historical_et0_c8_hourly_v1",
    origin_source_id: "et0_replay_cap04_s6",
    role_time: {
      interval_start: addHoursV1(CAP04_S6_LOGICAL_TIME_V1, -1),
      interval_end: CAP04_S6_LOGICAL_TIME_V1,
      ingested_at: ingestedAt,
    },
    canonical_payload: {
      value: 0.1,
      unit: "mm",
      calculation_method: "FAO56_PM_REPLAY_V1",
      method_version: "1",
    },
    source_unit: "mm",
    canonical_unit: "mm",
  });
  const soil = evidenceV1({
    record_type: "soil_moisture_observation_v1",
    source_record_id: "soil_cap04_s6_001",
    binding_id: "soil_obs_c8_20cm_v1",
    origin_source_id: "soil_sensor_cap04_s6",
    role_time: {
      observed_at: addMinutesV1(CAP04_S6_LOGICAL_TIME_V1, -10),
      ingested_at: ingestedAt,
    },
    canonical_payload: {
      value: 0.31,
      unit: "fraction",
      quantity_kind: "VOLUMETRIC_WATER_CONTENT",
    },
    source_unit: "fraction",
    canonical_unit: "fraction",
  });
  const issuedAt = addMinutesV1(CAP04_S6_LOGICAL_TIME_V1, -45);
  const availableAt = addMinutesV1(CAP04_S6_LOGICAL_TIME_V1, -30);
  const weather = buildCap04FutureForcingSnapshotV1({
    kind: "weather",
    logical_time: CAP04_S6_LOGICAL_TIME_V1,
    issued_at: issuedAt,
    available_to_runtime_at: availableAt,
    source_record_id: "weather_cap04_s6_selected",
    seed: 6,
    scope_override: CAP04_S6_SCOPE_V1,
  });
  const futureEt0 = buildCap04FutureForcingSnapshotV1({
    kind: "et0",
    logical_time: CAP04_S6_LOGICAL_TIME_V1,
    issued_at: issuedAt,
    available_to_runtime_at: availableAt,
    source_record_id: "future_et0_cap04_s6_selected",
    seed: 6,
    scope_override: CAP04_S6_SCOPE_V1,
  });
  return [rainfall, et0, soil, weather, futureEt0];
}

function memberV1(recordSet: Cap04ARecordSetV1, objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP04_S6_FIXTURE_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}

function sameScopeV1(left: TwinScopeKeyV1, right: TwinScopeKeyV1): boolean {
  return left.tenant_id === right.tenant_id
    && left.project_id === right.project_id
    && left.group_id === right.group_id
    && left.field_id === right.field_id
    && left.season_id === right.season_id
    && left.zone_id === right.zone_id;
}

export class InMemoryCap04SingleTickRuntimeV1 implements
  NextTickReadPortV1,
  ReplayEvidenceSourcePortV1,
  RuntimeConfigRepositoryPortV1,
  Cap04SingleTickPersistencePortV1 {
  private snapshot: PersistedNextTickSnapshotV1;
  private candidateRecords: CanonicalReplayEvidenceRecordV1[];
  private readonly configs = new Map<string, CanonicalObjectEnvelopeV1>();
  private readonly aByKey = new Map<string, Cap04ARecordSetV1>();
  private readonly aById = new Map<string, Cap04ARecordSetV1>();
  private readonly bByKey = new Map<string, Cap04ScenarioSetRecordV1>();
  private readonly bById = new Map<string, Cap04ScenarioSetRecordV1>();
  private fencingToken = 0n;

  evidenceLoadCount = 0;
  configReadCount = 0;
  leaseAcquireCount = 0;
  aCommitCount = 0;
  bCommitCount = 0;
  aReadCount = 0;
  bReadCount = 0;

  constructor(input: {
    snapshot: PersistedNextTickSnapshotV1;
    configs: CanonicalObjectEnvelopeV1[];
    candidate_records: CanonicalReplayEvidenceRecordV1[];
  }) {
    this.snapshot = structuredClone(input.snapshot);
    this.candidateRecords = structuredClone(input.candidate_records);
    for (const config of input.configs) this.configs.set(config.object_id, structuredClone(config));
  }

  currentSnapshotV1(): PersistedNextTickSnapshotV1 {
    return structuredClone(this.snapshot);
  }

  async readPersistedNextTickSnapshot(scope: TwinScopeKeyV1): Promise<PersistedNextTickSnapshotV1 | null> {
    return sameScopeV1(this.snapshot.reality_binding.scope, scope) ? structuredClone(this.snapshot) : null;
  }

  async loadCandidateRecords(input: { scope: TwinScopeKeyV1; logical_time: string }): Promise<readonly CanonicalReplayEvidenceRecordV1[]> {
    if (!sameScopeV1(input.scope, this.snapshot.reality_binding.scope)) throw new Error("CAP04_S6_FIXTURE_EVIDENCE_SCOPE_MISMATCH");
    this.evidenceLoadCount += 1;
    return structuredClone(this.candidateRecords);
  }

  async commitRuntimeConfig(config: CanonicalObjectEnvelopeV1): Promise<{ status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS"; object_id: string; fact_id: string }> {
    const existing = this.configs.get(config.object_id);
    if (existing && existing.determinism_hash !== config.determinism_hash) throw new Error("CAP04_S6_FIXTURE_CONFIG_CONFLICT");
    this.configs.set(config.object_id, structuredClone(config));
    return { status: existing ? "EXISTING_IDEMPOTENT_SUCCESS" : "INSERTED", object_id: config.object_id, fact_id: `fact_${config.object_id}` };
  }

  async readRuntimeConfig(objectId: string): Promise<CanonicalObjectEnvelopeV1 | null> {
    this.configReadCount += 1;
    const value = this.configs.get(objectId);
    return value ? structuredClone(value) : null;
  }

  async acquireLease(claim: Omit<RuntimeLeaseClaimV1, "fencing_token">): Promise<RuntimeLeaseClaimV1> {
    this.leaseAcquireCount += 1;
    this.fencingToken += 1n;
    return { ...claim, fencing_token: this.fencingToken };
  }

  async lookupARecordSet(idempotencyKey: string): Promise<Cap04ARecordSetV1 | null> {
    const value = this.aByKey.get(idempotencyKey);
    return value ? structuredClone(value) : null;
  }

  async commitARecordSet(input: Parameters<Cap04SingleTickPersistencePortV1["commitARecordSet"]>[0]): Promise<Awaited<ReturnType<Cap04SingleTickPersistencePortV1["commitARecordSet"]>>> {
    const existing = this.aByKey.get(input.record_set.idempotency_key);
    if (existing) {
      if (existing.aggregate_determinism_hash !== input.record_set.aggregate_determinism_hash) throw new Error("IDEMPOTENCY_CONFLICT");
      return { status: "EXISTING_IDEMPOTENT_SUCCESS", record_set: structuredClone(existing), fact_ids_by_object_id: {} };
    }
    validateCap04ARecordSetV1(input.record_set);
    if (input.expected.active_lineage_ref !== this.snapshot.active_lineage_ref) throw new Error("ACTIVE_LINEAGE_OBJECT_REF_MISMATCH");
    if (input.expected.previous_checkpoint_ref !== this.snapshot.checkpoint.object_id) throw new Error("CHECKPOINT_CAS_CONFLICT");
    if (input.expected.previous_state_ref !== this.snapshot.previous_posterior.object_id) throw new Error("STATE_LATEST_CAS_CONFLICT");
    if (input.expected.previous_forecast_result_ref !== this.snapshot.previous_forecast_result?.object_id) throw new Error("FORECAST_RESULT_CAS_CONFLICT");
    const priorSuccess = this.snapshot.checkpoint.payload.successful_forecast_ref;
    if (input.expected.previous_successful_forecast_ref !== priorSuccess) throw new Error("FORECAST_SUCCESS_CAS_CONFLICT");
    input.fault_injection?.("before_commit");
    this.aCommitCount += 1;
    this.aByKey.set(input.record_set.idempotency_key, structuredClone(input.record_set));
    this.aById.set(input.record_set.record_set_id, structuredClone(input.record_set));
    const state = memberV1(input.record_set, "twin_state_estimate_v1");
    const checkpoint = memberV1(input.record_set, "twin_runtime_checkpoint_v1");
    const forecast = memberV1(input.record_set, "twin_forecast_run_v1");
    const tick = memberV1(input.record_set, "twin_runtime_tick_v1");
    const config = this.configs.get(String(state.runtime_config_ref));
    if (!config) throw new Error("CAP04_S6_FIXTURE_CURRENT_CONFIG_NOT_FOUND");
    this.snapshot = {
      ...this.snapshot,
      checkpoint: structuredClone(checkpoint),
      previous_posterior: structuredClone(state),
      previous_forecast_result: structuredClone(forecast),
      last_terminal_tick: structuredClone(tick),
      runtime_config: structuredClone(config),
    };
    return {
      status: "INSERTED",
      record_set: structuredClone(input.record_set),
      fact_ids_by_object_id: Object.fromEntries(input.record_set.members.map((member) => [member.object_id, `fact_${member.object_id}`])),
    };
  }

  async readARecordSet(recordSetId: string): Promise<Cap04ARecordSetV1 | null> {
    this.aReadCount += 1;
    const value = this.aById.get(recordSetId);
    return value ? structuredClone(value) : null;
  }

  async lookupScenarioSet(idempotencyKey: string): Promise<Cap04ScenarioSetRecordV1 | null> {
    const value = this.bByKey.get(idempotencyKey);
    return value ? structuredClone(value) : null;
  }

  async commitScenarioSet(input: Parameters<Cap04SingleTickPersistencePortV1["commitScenarioSet"]>[0]): Promise<Awaited<ReturnType<Cap04SingleTickPersistencePortV1["commitScenarioSet"]>>> {
    const existing = this.bByKey.get(input.record.idempotency_key);
    if (existing) {
      if (existing.aggregate_determinism_hash !== input.record.aggregate_determinism_hash) throw new Error("IDEMPOTENCY_CONFLICT");
      return { status: "EXISTING_IDEMPOTENT_SUCCESS", record: structuredClone(existing), fact_id: `fact_${existing.scenario_set_id}` };
    }
    const sourceA = [...this.aById.values()].find((recordSet) => memberV1(recordSet, "twin_forecast_run_v1").object_id === input.record.scenario_set_uniqueness_key.source_forecast_ref);
    if (!sourceA) throw new Error("CAP04_S6_FIXTURE_SOURCE_FORECAST_NOT_FOUND");
    validateCap04ScenarioSetRecordV1(input.record, memberV1(sourceA, "twin_forecast_run_v1"));
    input.fault_injection?.("before_commit");
    this.bCommitCount += 1;
    this.bByKey.set(input.record.idempotency_key, structuredClone(input.record));
    this.bById.set(input.record.scenario_set_id, structuredClone(input.record));
    return { status: "INSERTED", record: structuredClone(input.record), fact_id: `fact_${input.record.scenario_set_id}` };
  }

  async readScenarioSet(scenarioSetId: string): Promise<Cap04ScenarioSetRecordV1 | null> {
    this.bReadCount += 1;
    const value = this.bById.get(scenarioSetId);
    return value ? structuredClone(value) : null;
  }

  async readScenarioSetBySourceForecast(sourceForecastRef: string, sourceForecastHash: string): Promise<Cap04ScenarioSetRecordV1 | null> {
    const value = [...this.bById.values()].find((record) =>
      record.scenario_set_uniqueness_key.source_forecast_ref === sourceForecastRef
      && record.scenario_set_uniqueness_key.source_forecast_hash === sourceForecastHash
    );
    return value ? structuredClone(value) : null;
  }

  async detectPendingScenario(scope: TwinScopeKeyV1): Promise<CanonicalObjectEnvelopeV1 | null> {
    if (!sameScopeV1(scope, this.snapshot.reality_binding.scope)) return null;
    const forecast = this.snapshot.previous_forecast_result;
    if (!forecast) return null;
    return await this.readScenarioSetBySourceForecast(forecast.object_id, forecast.determinism_hash) ? null : structuredClone(forecast);
  }

  async rebuildForecastProjections(): Promise<{ rebuilt_forecast_run_count: 1; rebuilt_forecast_point_count: 0 | 72 }> {
    return { rebuilt_forecast_run_count: 1, rebuilt_forecast_point_count: 72 };
  }

  async rebuildScenarioProjections(): Promise<{ rebuilt_scenario_set_count: 1; rebuilt_scenario_point_count: 216; rebuilt_latest_count: 1 }> {
    return { rebuilt_scenario_set_count: 1, rebuilt_scenario_point_count: 216, rebuilt_latest_count: 1 };
  }
}

export function buildCap04S6SingleTickFixtureV1(): {
  runtime: InMemoryCap04SingleTickRuntimeV1;
  service: Cap04ForecastScenarioSingleTickServiceV1;
  input: ExecuteCap04SingleTickInputV1;
  runtime_config: CanonicalObjectEnvelopeV1;
  crop_stage_context: ContinuationCropStageConfigurationContextV1;
} {
  const { configs } = buildCap04ConfigChainFixtureV1();
  const runtimeConfig = configs[0];
  if (!runtimeConfig) throw new Error("CAP04_S6_CONFIG_MISSING");
  const config = runtimeConfig.payload as unknown as Cap04RuntimeConfigPayloadV1;
  const lineageId = "twin_runtime_lineage_31d5cdda3c87fdf1536f0233";
  const revisionId = "revision_active";
  const previousConfig = envelopeV1({
    object_id: config.parent_runtime_config_ref,
    object_type: "twin_runtime_config_v1",
    logical_time: addHoursV1(CAP04_S6_LOGICAL_TIME_V1, -1),
    runtime_config_ref: null,
    runtime_config_hash: null,
    lineage_id: lineageId,
    revision_id: revisionId,
    determinism_hash: config.parent_runtime_config_hash,
    payload: {
      reality_binding_ref: config.reality_binding_ref,
      reality_binding_hash: config.reality_binding_hash,
    },
  });
  const previousState = envelopeV1({
    object_id: "twin_state_estimate_0adec65ed4a2a6f8146b1b2b",
    object_type: "twin_state_estimate_v1",
    logical_time: addHoursV1(CAP04_S6_LOGICAL_TIME_V1, -1),
    runtime_config_ref: previousConfig.object_id,
    runtime_config_hash: previousConfig.determinism_hash,
    lineage_id: lineageId,
    revision_id: revisionId,
    payload: {
      root_zone_vwc_fraction: { mean: 0.3, variance: 0.001 },
      computation_basis: {
        storage_mean_mm_decimal: { value: "90.000000" },
        storage_variance_mm2_decimal: { value: "4.000000000000" },
      },
    },
  });
  const previousForecast = envelopeV1({
    object_id: "twin_forecast_run_68997d774c7febc701bbbccf",
    object_type: "twin_forecast_run_v1",
    logical_time: addHoursV1(CAP04_S6_LOGICAL_TIME_V1, -1),
    runtime_config_ref: previousConfig.object_id,
    runtime_config_hash: previousConfig.determinism_hash,
    lineage_id: lineageId,
    revision_id: revisionId,
    payload: { status: "BLOCKED", points: [], scenario_eligible: false },
  });
  const checkpoint = envelopeV1({
    object_id: "twin_runtime_checkpoint_b88792b2c77677855575a858",
    object_type: "twin_runtime_checkpoint_v1",
    logical_time: addHoursV1(CAP04_S6_LOGICAL_TIME_V1, -1),
    runtime_config_ref: previousConfig.object_id,
    runtime_config_hash: previousConfig.determinism_hash,
    lineage_id: lineageId,
    revision_id: revisionId,
    payload: {
      last_posterior_state_ref: previousState.object_id,
      forecast_result_ref: previousForecast.object_id,
      successful_forecast_ref: null,
      next_tick_logical_time: CAP04_S6_LOGICAL_TIME_V1,
      tick_sequence: 48,
    },
  });
  const snapshot: PersistedNextTickSnapshotV1 = {
    active_lineage_ref: "twin_runtime_lineage_object_cap04_s6",
    active_lineage_id: lineageId,
    checkpoint,
    previous_posterior: previousState,
    previous_forecast_result: previousForecast,
    runtime_config: previousConfig,
    reality_binding: {
      binding_id: config.reality_binding_ref,
      determinism_hash: config.reality_binding_hash,
      geometry_semantic_hash: String(config.geometry_semantic_hash),
      scope: structuredClone(CAP04_S6_SCOPE_V1),
      root_zone_definition: { root_zone_depth_mm: config.soil_hydraulic_snapshot.root_zone_depth_mm },
    },
  };
  const cropStageContext: ContinuationCropStageConfigurationContextV1 = {
    schema_version: "v1",
    dataset_id: "mcft_cap04_s6_crop_stage_fixture_v1",
    context_class: "CONFIGURATION_DERIVED_CONTEXT",
    evidence_record: false,
    configuration_matrix_ref: "mcft_configuration_matrix_cap04_s6",
    configuration_matrix_hash: config.configuration_matrix_hash,
    crop_water_use_binding_ref: "crop_water_use_cap04_s6",
    crop_water_use_configuration_source_id: "crop_water_use_source_cap04_s6",
    crop_stage_mapping_source: "CONTROLLED_REPLAY_CONFIGURATION",
    timezone: "UTC",
    coverage_start: addHoursV1(CAP04_S6_LOGICAL_TIME_V1, -24),
    coverage_end_exclusive: addHoursV1(CAP04_S6_LOGICAL_TIME_V1, 96),
    crop_stage_schedule: [{
      stage_code: "CONTROLLED_STAGE_V1",
      effective_from: addHoursV1(CAP04_S6_LOGICAL_TIME_V1, -24),
      effective_to: addHoursV1(CAP04_S6_LOGICAL_TIME_V1, 96),
      kc: 1,
    }],
    limitations: ["CONTROLLED_SYNTHETIC", "NOT_FIELD_CALIBRATED"],
    determinism_hash: config.crop_stage_context.context_hash,
  };
  const runtime = new InMemoryCap04SingleTickRuntimeV1({
    snapshot,
    configs: [previousConfig, runtimeConfig],
    candidate_records: currentEvidenceV1(),
  });
  const service = new Cap04ForecastScenarioSingleTickServiceV1(
    new PrepareNextTickInputServiceV1(runtime),
    runtime,
    runtime,
    runtime,
  );
  const input: ExecuteCap04SingleTickInputV1 = {
    scope: structuredClone(CAP04_S6_SCOPE_V1),
    logical_time: CAP04_S6_LOGICAL_TIME_V1,
    created_at: CAP04_S6_CREATED_AT_V1,
    runtime_config_ref: runtimeConfig.object_id,
    runtime_config_hash: runtimeConfig.determinism_hash,
    authorized_future_forcing_binding_ids: ["binding_weather", "binding_et0"],
    crop_stage_context: cropStageContext,
    lease_owner: "cap04_s6_acceptance",
    lease_duration_seconds: 300,
  };
  return { runtime, service, input, runtime_config: runtimeConfig, crop_stage_context: cropStageContext };
}
