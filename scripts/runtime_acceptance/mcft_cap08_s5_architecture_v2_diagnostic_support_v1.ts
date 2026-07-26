// Purpose: test one non-authoritative CAP-08 replay-dataset v2 design with multi-regime rainfall and Forecast-derived hidden-0.034 FVO values.
// Boundary: disposable architecture diagnostic only; no Candidate Declaration, predecessor effectiveness, final formal run, production Runtime source, Model Activation, active Config switch, or MCFT-CAP-09 authority.

import { types as pgTypes } from "pg";

import { executeHourlyWaterBalanceV1 } from "../../apps/server/src/domain/soil_water/hourly_water_balance_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { CAP08_S1_RUNTIME_START_V1 } from "../../apps/server/src/domain/twin_runtime/cap08_phase_engine_contracts_v1.js";
import { buildCap08S2FormalDueObligationV1 } from "../../apps/server/src/domain/twin_runtime/cap08_s2_formal_provider_contracts_v1.js";
import { DirectCap04ExecutionConfigResolverV1 } from "../../apps/server/src/domain/twin_runtime/runtime_config_execution_view_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { PostgresActionFeedbackTickSourceV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_action_feedback_tick_source_v1.js";
import { PostgresCap08S3CompletionAuthorityPairRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_cap08_s3_completion_authority_pair_repository_v1.js";
import { Cap08S2QualifiedEvidenceSourceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s2_qualified_evidence_source_v1.js";
import { Cap08S3AuthorityGuardV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_authority_guard_v1.js";
import { Cap08S3CompletionEvidenceTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_completion_evidence_tick_service_v1.js";
import { Cap08S3DecisionActionProviderServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_decision_action_provider_service_v1.js";
import { Cap08S3EpisodeInspectorV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_episode_inspector_v1.js";
import { Cap08S3FormalRangeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_formal_range_service_v1.js";
import { Cap08S3FormalRuntimeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_formal_runtime_service_v1.js";
import { Cap08S3FormalTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_formal_tick_service_v1.js";
import { Cap08S3OutcomeCompletionEvidenceServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_outcome_completion_evidence_service_v1.js";
import { Cap08S3ReceiptConsumingForecastScenarioTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_receipt_consuming_tick_service_v1.js";
import { Cap08S3ReceiptEpisodeGuardV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_receipt_episode_guard_v1.js";
import {
  A0BootstrapRuntimeServiceV1,
  Cap04ForecastScenarioSingleTickServiceV1,
  Cap08DeferredScenarioPersistenceV1,
  Cap08FrozenEvidenceSourceV1,
  PostgresForecastScenarioRecoveryRepositoryV1,
  PostgresNextTickRepositoryV1,
  PostgresRuntimeRepositoryV1,
  PrepareNextTickInputServiceV1,
  CAP08_S1_CREATED_AT_V1,
  persistenceAdapterV1,
  runner,
} from "./mcft_cap08_s2_g3_acceptance_support_v1.js";
import { buildCap08S2FormalProviderFixtureV1 } from "./mcft_cap08_s2_formal_provider_fixture_v1.js";
import { computeCap08S3SourceManifestV1 } from "./mcft_cap08_s3_source_manifest_v1.js";

export const CAP08_S5_ARCHITECTURE_V2_DIAGNOSTIC_DATASET_ID_V1 =
  "mcft_cap08_stage1a_replay_v2_architecture_diagnostic" as const;
export const CAP08_S5_ARCHITECTURE_V2_HIDDEN_PARAMETER_V1 = "0.034000" as const;
export const CAP08_S5_ARCHITECTURE_V2_PROFILE_ID_V1 =
  "MULTI_REGIME_RAINFALL_PLUS_FORECAST_DERIVED_HIDDEN_0034_FVO_V1" as const;

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function recordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function fvoIndexV1(fvoId: string): number {
  const match = /^FVO-(\d{2})$/.exec(fvoId);
  if (!match) throw new Error(`CAP08_S5_V2_FVO_ID_INVALID:${fvoId}`);
  const index = Number(match[1]);
  if (!Number.isInteger(index) || index < 1 || index > 24) {
    throw new Error(`CAP08_S5_V2_FVO_INDEX_INVALID:${fvoId}`);
  }
  return index;
}

function exactScopeValuesV1(scope: TwinScopeKeyV1): string[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}

function rainfallProfileV2(index: number): number {
  if (index >= 8) return Number((5.2 + (index % 4) * 0.2).toFixed(6));
  return Number((0.2 + (index % 4) * 0.1).toFixed(6));
}

function rewriteRainfallV2(
  records: readonly CanonicalReplayEvidenceRecordV1[],
  logicalTime: string,
): CanonicalReplayEvidenceRecordV1[] {
  const index = (Date.parse(logicalTime) - Date.parse(CAP08_S1_RUNTIME_START_V1)) / 3_600_000;
  if (!Number.isInteger(index) || index < 0 || index > 23) {
    throw new Error(`CAP08_S5_V2_TICK_INDEX_INVALID:${logicalTime}`);
  }
  return records.map((source) => {
    const record = structuredClone(source);
    if (record.record_type !== "observed_rainfall_v1") return record;
    const value = rainfallProfileV2(index);
    record.canonical_payload = { ...record.canonical_payload, value };
    record.source_payload = { ...record.source_payload, value };
    record.source_record_hash = semanticHashV1({
      record_type: record.record_type,
      source_record_id: record.source_record_id,
      binding_id: record.binding_id,
      origin_source_id: record.origin_source_id,
      role_time: record.role_time,
      canonical_payload: record.canonical_payload,
    });
    record.dataset_id = CAP08_S5_ARCHITECTURE_V2_DIAGNOSTIC_DATASET_ID_V1;
    record.limitations = [
      "CONTROLLED_SYNTHETIC",
      "ARCHITECTURE_DEVIATION_DIAGNOSTIC_ONLY",
      "MULTI_REGIME_RAINFALL_PROFILE",
    ];
    return record;
  });
}

function parseCanonicalFactV1(value: unknown, expectedType: string): CanonicalObjectEnvelopeV1 {
  const record = recordV1(typeof value === "string" ? JSON.parse(value) : value, "CAP08_S5_V2_FACT_INVALID");
  if (record.type !== expectedType) throw new Error("CAP08_S5_V2_FACT_TYPE_MISMATCH");
  const object = recordV1(record.payload, "CAP08_S5_V2_FACT_PAYLOAD_REQUIRED") as unknown as CanonicalObjectEnvelopeV1;
  if (object.object_type !== expectedType) throw new Error("CAP08_S5_V2_OBJECT_TYPE_MISMATCH");
  return object;
}

export class Cap08S5ArchitectureV2EvidenceSourceV1 implements ReplayEvidenceSourcePortV1 {
  constructor(
    private readonly baseSource: ReplayEvidenceSourcePortV1,
    private readonly runtimeRepository: PostgresRuntimeRepositoryV1,
  ) {}

  private async exactForecastByIssuedAtV1(
    scope: TwinScopeKeyV1,
    issuedAt: string,
  ): Promise<CanonicalObjectEnvelopeV1> {
    const result = await runner.query(
      `SELECT record_json
         FROM facts
        WHERE record_json->>'type'='twin_forecast_run_v1'
          AND record_json->'payload'->>'tenant_id'=$1
          AND record_json->'payload'->>'project_id'=$2
          AND record_json->'payload'->>'group_id'=$3
          AND record_json->'payload'->>'field_id'=$4
          AND record_json->'payload'->>'season_id'=$5
          AND record_json->'payload'->>'zone_id'=$6
          AND record_json->'payload'->'payload'->>'issued_at'=$7
          AND record_json->'payload'->'payload'->>'status'='COMPLETED'`,
      [...exactScopeValuesV1(scope), issuedAt],
    );
    if (result.rows.length !== 1) {
      throw new Error(`CAP08_S5_V2_FORECAST_CARDINALITY:${issuedAt}:${result.rows.length}`);
    }
    return parseCanonicalFactV1(result.rows[0].record_json, "twin_forecast_run_v1");
  }

  async buildFvoFromForecastV1(input: {
    scope: TwinScopeKeyV1;
    fvoId: string;
    forecast: CanonicalObjectEnvelopeV1;
  }): Promise<CanonicalReplayEvidenceRecordV1> {
    const index = fvoIndexV1(input.fvoId);
    const forecastPayload = recordV1(input.forecast.payload, "CAP08_S5_V2_FORECAST_PAYLOAD_REQUIRED");
    const points = Array.isArray(forecastPayload.points) ? forecastPayload.points : [];
    if (forecastPayload.status !== "COMPLETED" || points.length !== 72) {
      throw new Error(`CAP08_S5_V2_COMPLETED_FORECAST_REQUIRED:${input.fvoId}`);
    }
    const point = recordV1(points[0], "CAP08_S5_V2_H1_POINT_REQUIRED");
    if (point.horizon_hour !== 1) throw new Error(`CAP08_S5_V2_H1_REQUIRED:${input.fvoId}`);
    const runtimeConfig = await this.runtimeRepository.readRuntimeConfig(
      requiredStringV1(input.forecast.runtime_config_ref, "CAP08_S5_V2_CONFIG_REF_REQUIRED"),
    );
    if (!runtimeConfig || runtimeConfig.determinism_hash !== input.forecast.runtime_config_hash) {
      throw new Error(`CAP08_S5_V2_CONFIG_MISMATCH:${input.fvoId}`);
    }
    const resolved = new DirectCap04ExecutionConfigResolverV1().resolveExecutionConfig(runtimeConfig);
    const config = resolved.payload;
    const fixed6 = (value: unknown, code: string): string => {
      const number = Number(value);
      if (!Number.isFinite(number)) throw new Error(code);
      return number.toFixed(6);
    };
    const replay = executeHourlyWaterBalanceV1({
      interval_start_exclusive: requiredStringV1(point.interval_start, "CAP08_S5_V2_INTERVAL_START_REQUIRED"),
      interval_end_inclusive: requiredStringV1(point.interval_end, "CAP08_S5_V2_INTERVAL_END_REQUIRED"),
      previous_storage_mm_decimal: requiredStringV1(point.previous_storage_mm, "CAP08_S5_V2_PREVIOUS_STORAGE_REQUIRED"),
      previous_variance_basis: {
        basis_origin: "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE",
        previous_state_ref: requiredStringV1(forecastPayload.source_posterior_ref, "CAP08_S5_V2_POSTERIOR_REF_REQUIRED"),
        previous_storage_variance_mm2_decimal: "0.000000000000",
      },
      gross_rainfall_mm_decimal: requiredStringV1(point.gross_precipitation_assumption_mm, "CAP08_S5_V2_RAINFALL_REQUIRED"),
      historical_et0_mm_decimal: requiredStringV1(point.reference_et0_mm, "CAP08_S5_V2_ET0_REQUIRED"),
      crop_stage_code: requiredStringV1(point.crop_stage_code, "CAP08_S5_V2_CROP_STAGE_REQUIRED"),
      kc_decimal: requiredStringV1(point.kc, "CAP08_S5_V2_KC_REQUIRED"),
      executed_irrigation_candidates: [],
      config: {
        root_zone_depth_mm: fixed6(config.soil_hydraulic_snapshot.root_zone_depth_mm, "CAP08_S5_V2_ROOT_DEPTH_REQUIRED"),
        wilting_point_storage_mm: fixed6(config.soil_hydraulic_snapshot.wilting_point_storage_mm, "CAP08_S5_V2_WILTING_REQUIRED"),
        field_capacity_storage_mm: fixed6(config.soil_hydraulic_snapshot.field_capacity_storage_mm, "CAP08_S5_V2_FIELD_CAPACITY_REQUIRED"),
        saturation_storage_mm: fixed6(config.soil_hydraulic_snapshot.saturation_storage_mm, "CAP08_S5_V2_SATURATION_REQUIRED"),
        saturation_fraction: fixed6(config.soil_hydraulic_snapshot.saturation_fraction, "CAP08_S5_V2_SATURATION_FRACTION_REQUIRED"),
        runoff_fraction: fixed6(config.dynamics_parameters.runoff_fraction, "CAP08_S5_V2_RUNOFF_REQUIRED"),
        drainage_coefficient_per_hour: CAP08_S5_ARCHITECTURE_V2_HIDDEN_PARAMETER_V1,
        structural_process_stddev_mm_per_hour: fixed6(config.process_uncertainty.structural_process_stddev_mm_per_hour, "CAP08_S5_V2_STRUCTURAL_REQUIRED"),
        rainfall_relative_stddev: fixed6(config.process_uncertainty.rainfall_relative_stddev, "CAP08_S5_V2_RAIN_STDDEV_REQUIRED"),
        crop_et_relative_stddev: fixed6(config.process_uncertainty.crop_et_relative_stddev, "CAP08_S5_V2_ET_STDDEV_REQUIRED"),
        executed_irrigation_relative_stddev: fixed6(config.process_uncertainty.executed_irrigation_relative_stddev, "CAP08_S5_V2_IRRIGATION_STDDEV_REQUIRED"),
      },
    });
    const observedAt = addHoursV1(CAP08_S1_RUNTIME_START_V1, index);
    const availableAt = index === 1 ? addHoursV1(CAP08_S1_RUNTIME_START_V1, 16) : observedAt;
    const qualityStatus = index === 3 ? "LIMITED" : "PASS";
    const canonicalPayload = {
      value: Number(replay.published_state.root_zone_vwc_fraction.mean),
      unit: "fraction",
      quantity_kind: "VOLUMETRIC_WATER_CONTENT",
      forecast_verification_observation_id: input.fvoId,
      generation_profile_id: CAP08_S5_ARCHITECTURE_V2_PROFILE_ID_V1,
      hidden_parameter_key: "dynamics_parameters.drainage_coefficient_per_hour",
      hidden_parameter_value: CAP08_S5_ARCHITECTURE_V2_HIDDEN_PARAMETER_V1,
      source_forecast_ref: input.forecast.object_id,
      source_forecast_hash: input.forecast.determinism_hash,
    };
    const roleTime = { observed_at: observedAt, ingested_at: availableAt };
    const semantic = {
      dataset_id: CAP08_S5_ARCHITECTURE_V2_DIAGNOSTIC_DATASET_ID_V1,
      source_record_id: input.fvoId,
      binding_id: "soil_obs_c8_20cm_v1",
      scope: input.scope,
      role_time: roleTime,
      canonical_payload: canonicalPayload,
      quality_status: qualityStatus,
    };
    return {
      ...input.scope,
      dataset_id: CAP08_S5_ARCHITECTURE_V2_DIAGNOSTIC_DATASET_ID_V1,
      source_record_id: input.fvoId,
      source_record_hash: semanticHashV1(semantic),
      record_type: "soil_moisture_observation_v1",
      binding_id: "soil_obs_c8_20cm_v1",
      origin_source_kind: "CONTROLLED_REPLAY_FIXTURE",
      origin_source_id: "mcft_cap08_stage1a_hidden_parameter_fvo_source_v2_diagnostic",
      epistemic_class: "OBSERVED",
      available_to_runtime_at: availableAt,
      role_time: roleTime,
      quality: { status: qualityStatus },
      source_payload: { ...canonicalPayload, source_version: "2-diagnostic" },
      canonical_payload: canonicalPayload,
      source_unit: "fraction",
      canonical_unit: "fraction",
      conversion_rule: { id: "IDENTITY_V1", version: "1" },
      limitations: [
        "CONTROLLED_SYNTHETIC",
        "ARCHITECTURE_DEVIATION_DIAGNOSTIC_ONLY",
        "HIDDEN_PARAMETER_GENERATED_FVO",
        "NOT_FIELD_CALIBRATED",
      ],
    };
  }

  async loadCandidateRecords(input: {
    scope: TwinScopeKeyV1;
    logical_time: string;
  }): Promise<readonly CanonicalReplayEvidenceRecordV1[]> {
    const due = buildCap08S2FormalDueObligationV1(input.logical_time);
    const baseRecords = rewriteRainfallV2(
      await this.baseSource.loadCandidateRecords(input),
      input.logical_time,
    ).filter((record) => record.record_type !== "soil_moisture_observation_v1");
    const observations: CanonicalReplayEvidenceRecordV1[] = [];
    for (const fvoId of due.due_fvo_ids) {
      const index = fvoIndexV1(fvoId);
      const sourceForecastTime = addHoursV1(CAP08_S1_RUNTIME_START_V1, index - 1);
      const forecast = await this.exactForecastByIssuedAtV1(input.scope, sourceForecastTime);
      observations.push(await this.buildFvoFromForecastV1({ scope: input.scope, fvoId, forecast }));
    }
    return [...baseRecords, ...observations];
  }
}

export async function establishCap08S5ArchitectureV2DiagnosticPredecessorV1(root: string) {
  const fixture = buildCap08S2FormalProviderFixtureV1();
  const baseManifest = computeCap08S3SourceManifestV1(root);
  const diagnosticSourceDigest = semanticHashV1({
    base_manifest_digest: baseManifest.manifest_digest,
    dataset_id: CAP08_S5_ARCHITECTURE_V2_DIAGNOSTIC_DATASET_ID_V1,
    profile_id: CAP08_S5_ARCHITECTURE_V2_PROFILE_ID_V1,
    hidden_parameter_value: CAP08_S5_ARCHITECTURE_V2_HIDDEN_PARAMETER_V1,
  });
  const runtimeRepository = new PostgresRuntimeRepositoryV1(runner);
  const nextTickRepository = new PostgresNextTickRepositoryV1(runner);
  const forecastRepository = new PostgresForecastScenarioRecoveryRepositoryV1(runner);
  const binding = await nextTickRepository.commitRealityBindingSnapshot(fixture.reality_binding_snapshot);
  if (binding.status !== "INSERTED") throw new Error("CAP08_S5_V2_REALITY_BINDING_INSERT_FAILED");
  for (const config of fixture.runtime_configs) {
    const committed = await runtimeRepository.commitRuntimeConfig(config);
    if (committed.status !== "INSERTED") throw new Error("CAP08_S5_V2_RUNTIME_CONFIG_INSERT_FAILED");
  }
  const diagnosticEvidence = new Cap08S5ArchitectureV2EvidenceSourceV1(
    fixture.bootstrap_evidence_source,
    runtimeRepository,
  );
  const qualifiedEvidence = new Cap08S2QualifiedEvidenceSourceV1(diagnosticEvidence);
  const frozenEvidence = new Cap08FrozenEvidenceSourceV1(qualifiedEvidence);
  const persistence = persistenceAdapterV1(runtimeRepository, forecastRepository, []);
  const deferred = new Cap08DeferredScenarioPersistenceV1(persistence);
  const handoff = new PrepareNextTickInputServiceV1(nextTickRepository);
  const normalTick = new Cap04ForecastScenarioSingleTickServiceV1(
    handoff,
    frozenEvidence,
    runtimeRepository,
    deferred,
    new DirectCap04ExecutionConfigResolverV1(),
  );
  const receiptTick = new Cap08S3ReceiptConsumingForecastScenarioTickServiceV1(
    handoff,
    frozenEvidence,
    new PostgresActionFeedbackTickSourceV1(runner),
    runtimeRepository,
    deferred,
    new DirectCap04ExecutionConfigResolverV1(),
  );
  const provider = new Cap08S3DecisionActionProviderServiceV1(runner);
  const inspector = new Cap08S3EpisodeInspectorV1(runner);
  const baseTick = new Cap08S3FormalTickServiceV1(
    handoff,
    frozenEvidence,
    deferred,
    normalTick,
    receiptTick,
    provider,
    new Cap08S3ReceiptEpisodeGuardV1(runner),
    new Cap08S3AuthorityGuardV1(runner),
  );
  const tick = new Cap08S3CompletionEvidenceTickServiceV1(
    baseTick,
    new Cap08S3OutcomeCompletionEvidenceServiceV1(runner),
  );
  const range = new Cap08S3FormalRangeServiceV1(
    handoff,
    tick,
    inspector,
    diagnosticSourceDigest,
    new PostgresCap08S3CompletionAuthorityPairRepositoryV1(runner),
  );
  const runtime = new Cap08S3FormalRuntimeServiceV1(
    new A0BootstrapRuntimeServiceV1(runtimeRepository, runtimeRepository, fixture.bootstrap_evidence_source),
    range,
  );
  const formalRunId = `cap08_v2diag_${semanticHashV1({
    dataset_id: CAP08_S5_ARCHITECTURE_V2_DIAGNOSTIC_DATASET_ID_V1,
    profile_id: CAP08_S5_ARCHITECTURE_V2_PROFILE_ID_V1,
    scope: fixture.scope,
    runtime_config_hashes: fixture.runtime_configs.map((item) => item.determinism_hash),
  }).slice(7, 31)}`;
  const runtimeInput = {
    formal_run_id: formalRunId,
    scope: fixture.scope,
    created_at: CAP08_S1_CREATED_AT_V1,
    bootstrap_runtime_config: fixture.bootstrap_runtime_config,
    bootstrap_hydraulic: fixture.hydraulic,
    soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1",
    runtime_config_refs_by_logical_time: fixture.runtime_config_refs_by_logical_time,
    runtime_config_hashes_by_logical_time: fixture.runtime_config_hashes_by_logical_time,
    authorized_future_forcing_binding_ids: ["binding_weather", "binding_et0"],
    crop_stage_context: fixture.crop_stage_context,
    lease_owner: "mcft-cap08-s5-v2-architecture-diagnostic",
    lease_duration_seconds: 300,
  };
  const result = await runtime.execute(runtimeInput);
  if (result.status !== "COMPLETED"
    || result.range.executed_tick_count !== 24
    || result.range.completion_authority_pair_write_delta !== 2) {
    throw new Error("CAP08_S5_V2_S3_PREDECESSOR_NOT_EXACT");
  }
  pgTypes.setTypeParser(1184, (value: string): string => value);
  pgTypes.setTypeParser(1114, (value: string): string => value);
  return {
    fixture: { ...fixture, formal_run_id: formalRunId },
    diagnostic_evidence_source: diagnosticEvidence,
    diagnostic_source_digest: diagnosticSourceDigest,
    runtime_repository: runtimeRepository,
    runtime,
    runtime_input: runtimeInput,
    predecessor_result: result,
  };
}
