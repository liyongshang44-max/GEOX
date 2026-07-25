// Purpose: reconstruct the exact CAP-08 S5 24-Residual and calibration/shadow source graph from persisted S3/S4 authorities plus the frozen replay Evidence port.
// Boundary: read-only canonical inspection and deterministic draft construction only; no persistence, calibration math, Candidate/Shadow append, pointer mutation, route or scheduler.

import type { Pool } from "pg";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  buildCap05ForecastPointMemberRefV1,
  buildCap05ForecastResidualV1,
  type Cap05ForecastResidualEnvelopeV1,
} from "../../domain/twin_runtime/forecast_observation_residual_v1.js";
import {
  validateCap04CanonicalForecastRunPayloadV1,
  type Cap04CanonicalCompletedForecastRunPayloadV1,
} from "../../domain/twin_runtime/forecast_canonical_authority_v1.js";
import {
  DirectCap04ExecutionConfigResolverV1,
  type ResolvedCap04ExecutionConfigV1,
} from "../../domain/twin_runtime/runtime_config_execution_view_v1.js";
import {
  CAP08_S3_COMPLETION_TUPLE_SCHEMA_VERSION_V1,
  validateCap08S3CompletionTupleV1,
  type Cap08S3CompletionTupleV1,
} from "../../domain/twin_runtime/cap08_s3_completion_tuple_v1.js";
import {
  CAP08_S4_AUTHORITY_SCHEMA_VERSION_V1,
  type Cap08S4AppendForwardAuthorityV1,
  type Cap08S4ScopeV1,
} from "../../domain/twin_runtime/cap08_s4_append_forward_contracts_v1.js";
import {
  CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
  CAP06_HOLDOUT_PURPOSE_V1,
  CAP06_RUNTIME_REPLAY_NUMERIC_POLICY_ID_V1,
  CAP06_WINDOW_HASH_SEMANTICS_V1,
  type Cap06SourceDatasetIdentityV1,
} from "../../domain/calibration/contracts_v1.js";
import type { Cap06CaseBuilderSourceV1 } from "../../domain/calibration/case_builder_v1.js";
import { PostgresCap08S4AppendForwardRepositoryV1 } from "../../persistence/twin_runtime/postgres_cap08_s4_append_forward_repository_v1.js";
import type { CanonicalReplayEvidenceRecordV1, ReplayEvidenceSourcePortV1 } from "./ports.js";
import type { Cap08S5PredictionAuthorityV1 } from "./cap08_s5_case_prediction_adapter_v1.js";
import type { Cap08S5ResidualSetIdentityInputV1, Cap08S5ScopeV1 } from "../../domain/twin_runtime/cap08_s5_residual_calibration_shadow_contracts_v1.js";

export type Cap08S5PersistedSourcesV1 = {
  formal_run_id: string;
  scope: Cap08S5ScopeV1;
  lineage_id: string;
  revision_id: string;
  phase_engine_contract_digest: string;
  phase_engine_source_digest: string;
  identity_input: Cap08S5ResidualSetIdentityInputV1;
  residuals: Cap05ForecastResidualEnvelopeV1[];
  case_sources: Cap06CaseBuilderSourceV1[];
  prediction_authorities: Cap08S5PredictionAuthorityV1[];
  source_dataset_identity: Cap06SourceDatasetIdentityV1;
  s3_completion: Cap08S3CompletionTupleV1;
  s4_authority: Cap08S4AppendForwardAuthorityV1;
};

const SELECTED_ASSIMILATION_INDEXES = new Set([2, 3, 4, 10, 22]);

function req(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}
function record(value: unknown, code: string): Record<string, unknown> {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(code);
  return parsed as Record<string, unknown>;
}
function iso(value: unknown, code: string): string {
  const text = req(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}
function fixed(value: unknown, digits: number, code: string): string {
  const number = typeof value === "number" ? value : Number(req(value, code));
  if (!Number.isFinite(number)) throw new Error(code);
  return number.toFixed(digits);
}
function addHours(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}
function scopeValues(scope: Cap08S5ScopeV1): unknown[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}
function exactScope(actual: {tenant_id:string;project_id:string;group_id?:string;field_id:string;season_id?:string;zone_id?:string}, expected: Cap08S5ScopeV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[field] !== expected[field]) throw new Error(`${code}:${field}`);
  }
}
function parseFact(value: unknown): CanonicalObjectEnvelopeV1 {
  const outer = record(value, "CAP08_S5_FACT_RECORD_INVALID");
  const object = record(outer.payload, "CAP08_S5_FACT_PAYLOAD_REQUIRED") as unknown as CanonicalObjectEnvelopeV1;
  if (outer.type !== object.object_type) throw new Error("CAP08_S5_FACT_TYPE_MISMATCH");
  return object;
}

export class Cap08S5PersistedSourceReaderV1 {
  private readonly configResolver = new DirectCap04ExecutionConfigResolverV1();
  private readonly s4Repository: PostgresCap08S4AppendForwardRepositoryV1;

  constructor(
    private readonly pool: Pool,
    private readonly evidenceSource: ReplayEvidenceSourcePortV1,
  ) {
    this.s4Repository = new PostgresCap08S4AppendForwardRepositoryV1(pool);
  }

  private async readS3Tuple(input: { formal_run_id: string; scope: Cap08S5ScopeV1 }): Promise<{ tuple: Cap08S3CompletionTupleV1; hash: string }> {
    const result = await this.pool.query(
      `SELECT determinism_hash,semantic_payload FROM twin_runtime_authority_snapshot_v1
       WHERE semantic_payload->>'schema_version'=$1
         AND semantic_payload->>'formal_run_id'=$2
         AND semantic_payload->'scope'->>'tenant_id'=$3
         AND semantic_payload->'scope'->>'project_id'=$4
         AND semantic_payload->'scope'->>'group_id'=$5
         AND semantic_payload->'scope'->>'field_id'=$6
         AND semantic_payload->'scope'->>'season_id'=$7
         AND semantic_payload->'scope'->>'zone_id'=$8`,
      [CAP08_S3_COMPLETION_TUPLE_SCHEMA_VERSION_V1, input.formal_run_id, ...scopeValues(input.scope)],
    );
    if (result.rows.length !== 1) throw new Error("CAP08_S5_S3_COMPLETION_CARDINALITY");
    const tuple = structuredClone(record(result.rows[0].semantic_payload, "CAP08_S5_S3_COMPLETION_INVALID")) as unknown as Cap08S3CompletionTupleV1;
    validateCap08S3CompletionTupleV1(tuple);
    if (tuple.determinism_hash !== result.rows[0].determinism_hash) throw new Error("CAP08_S5_S3_COMPLETION_HASH_MISMATCH");
    return { tuple, hash: result.rows[0].determinism_hash as string };
  }

  private async readS4Authority(input: { formal_run_id: string; scope: Cap08S5ScopeV1 }): Promise<{
    authority: Cap08S4AppendForwardAuthorityV1;
    corrected_forecast: CanonicalObjectEnvelopeV1;
  }> {
    const result = await this.pool.query(
      `SELECT determinism_hash,semantic_payload FROM twin_runtime_authority_snapshot_v1
       WHERE semantic_payload->>'schema_version'=$1
         AND semantic_payload->>'formal_run_id'=$2
         AND semantic_payload->'scope'->>'tenant_id'=$3
         AND semantic_payload->'scope'->>'project_id'=$4
         AND semantic_payload->'scope'->>'group_id'=$5
         AND semantic_payload->'scope'->>'field_id'=$6
         AND semantic_payload->'scope'->>'season_id'=$7
         AND semantic_payload->'scope'->>'zone_id'=$8`,
      [CAP08_S4_AUTHORITY_SCHEMA_VERSION_V1, input.formal_run_id, ...scopeValues(input.scope)],
    );
    if (result.rows.length !== 1) throw new Error("CAP08_S5_S4_AUTHORITY_CARDINALITY");
    const authority = structuredClone(record(result.rows[0].semantic_payload, "CAP08_S5_S4_AUTHORITY_INVALID")) as unknown as Cap08S4AppendForwardAuthorityV1;
    if (authority.determinism_hash !== result.rows[0].determinism_hash) throw new Error("CAP08_S5_S4_AUTHORITY_HASH_MISMATCH");
    const inspected = await this.s4Repository.inspect(authority);
    if (inspected.disposition !== "ALREADY_COMPLETE_EXACT" || !inspected.corrected_set) {
      throw new Error("CAP08_S5_S4_APPEND_FORWARD_NOT_EFFECTIVE");
    }
    return { authority: inspected.authority, corrected_forecast: inspected.corrected_set.forecast };
  }

  private async readObjects(objectIds: readonly string[]): Promise<Map<string, CanonicalObjectEnvelopeV1>> {
    const ids = [...new Set(objectIds)];
    const result = await this.pool.query(
      `SELECT record_json FROM facts WHERE record_json->'payload'->>'object_id'=ANY($1::text[]) ORDER BY fact_id`,
      [ids],
    );
    const map = new Map<string, CanonicalObjectEnvelopeV1>();
    for (const row of result.rows) {
      const object = parseFact(row.record_json);
      if (map.has(object.object_id)) throw new Error(`CAP08_S5_OBJECT_NOT_UNIQUE:${object.object_id}`);
      map.set(object.object_id, object);
    }
    if (map.size !== ids.length) throw new Error("CAP08_S5_CANONICAL_GRAPH_INCOMPLETE");
    return map;
  }

  private async observation(input: {
    scope: Cap08S5ScopeV1;
    index: number;
    available_at: string;
  }): Promise<CanonicalReplayEvidenceRecordV1> {
    const fvoId = `FVO-${String(input.index).padStart(2, "0")}`;
    const records = await this.evidenceSource.loadCandidateRecords({ scope: input.scope, logical_time: input.available_at });
    const matches = records.filter((item) => item.record_type === "soil_moisture_observation_v1" && item.source_record_id === fvoId);
    if (matches.length !== 1) throw new Error(`CAP08_S5_FVO_CARDINALITY:${fvoId}:${matches.length}`);
    const item = structuredClone(matches[0]);
    exactScope(item, input.scope, `CAP08_S5_FVO_SCOPE_MISMATCH:${fvoId}`);
    const observedAt = addHours("2026-06-01T00:00:00.000Z", input.index);
    if (item.role_time?.observed_at !== observedAt
      || item.role_time?.ingested_at !== input.available_at
      || item.available_to_runtime_at !== input.available_at
      || item.canonical_unit !== "fraction"
      || item.quality?.status !== (input.index === 3 ? "LIMITED" : "PASS")
      || !/^sha256:[0-9a-f]{64}$/.test(item.source_record_hash)) {
      throw new Error(`CAP08_S5_FVO_FORMAL_BINDING_MISMATCH:${fvoId}`);
    }
    return item;
  }

  async read(input: {
    formal_run_id: string;
    scope: Cap08S5ScopeV1;
    created_at: string;
    phase_engine_contract_digest: string;
    phase_engine_source_digest: string;
  }): Promise<Cap08S5PersistedSourcesV1> {
    const formalRunId = req(input.formal_run_id, "CAP08_S5_FORMAL_RUN_REQUIRED");
    const createdAt = iso(input.created_at, "CAP08_S5_CREATED_AT_INVALID");
    const { tuple, hash: tupleHash } = await this.readS3Tuple({ formal_run_id: formalRunId, scope: input.scope });
    const { authority: s4, corrected_forecast: correctedT16Forecast } = await this.readS4Authority({ formal_run_id: formalRunId, scope: input.scope });
    if (tuple.phase_engine_source_digest !== input.phase_engine_source_digest
      || s4.phase_engine_source_digest !== input.phase_engine_source_digest
      || s4.phase_engine_contract_digest !== input.phase_engine_contract_digest) {
      throw new Error("CAP08_S5_PHASE_AUTHORITY_MISMATCH");
    }
    if (tuple.tick_bindings.length !== 24) throw new Error("CAP08_S5_TICK_BINDING_COUNT_MISMATCH");

    const primary = await this.readObjects(tuple.tick_bindings.flatMap((binding) => [binding.tick_ref, binding.assimilation_update_ref]));
    const tickForecastRefs: string[] = [];
    for (const binding of tuple.tick_bindings) {
      const tick = primary.get(binding.tick_ref);
      if (!tick || tick.object_type !== "twin_runtime_tick_v1" || tick.determinism_hash !== binding.tick_hash) {
        throw new Error(`CAP08_S5_TICK_BINDING_MISMATCH:${binding.tick_id}`);
      }
      exactScope(tick, input.scope, `CAP08_S5_TICK_SCOPE_MISMATCH:${binding.tick_id}`);
      tickForecastRefs.push(req(record(tick.payload, "CAP08_S5_TICK_PAYLOAD_REQUIRED").forecast_result_ref, "CAP08_S5_TICK_FORECAST_REF_REQUIRED"));
    }
    const forecastRefs = [...tickForecastRefs, correctedT16Forecast.object_id];
    const forecasts = await this.readObjects(forecastRefs);
    const relatedRefs: string[] = [];
    for (const forecast of forecasts.values()) {
      const payload = record(forecast.payload, "CAP08_S5_FORECAST_PAYLOAD_REQUIRED");
      relatedRefs.push(req(payload.source_posterior_ref, "CAP08_S5_FORECAST_POSTERIOR_REF_REQUIRED"));
      relatedRefs.push(req(payload.runtime_config_ref, "CAP08_S5_FORECAST_CONFIG_REF_REQUIRED"));
    }
    const related = await this.readObjects(relatedRefs);

    const residuals: Cap05ForecastResidualEnvelopeV1[] = [];
    const caseSources: Cap06CaseBuilderSourceV1[] = [];
    const predictionAuthorities: Cap08S5PredictionAuthorityV1[] = [];
    for (let index = 1; index <= 24; index += 1) {
      const sourceTickIndex = index - 1;
      const forecastRef = index === 17 ? correctedT16Forecast.object_id : tickForecastRefs[sourceTickIndex];
      const forecast = forecasts.get(forecastRef);
      if (!forecast || forecast.object_type !== "twin_forecast_run_v1") throw new Error(`CAP08_S5_FORECAST_REQUIRED:R-${String(index).padStart(2, "0")}`);
      exactScope(forecast, input.scope, `CAP08_S5_FORECAST_SCOPE_MISMATCH:R-${String(index).padStart(2, "0")}`);
      const forecastPayload = structuredClone(forecast.payload) as unknown as Cap04CanonicalCompletedForecastRunPayloadV1;
      validateCap04CanonicalForecastRunPayloadV1(forecastPayload);
      if (forecastPayload.status !== "COMPLETED") throw new Error("CAP08_S5_COMPLETED_FORECAST_REQUIRED");
      const point = forecastPayload.points.find((item) => item.horizon_hour === 1);
      if (!point) throw new Error("CAP08_S5_H1_FORECAST_POINT_REQUIRED");
      const expectedTarget = addHours("2026-06-01T00:00:00.000Z", index);
      if (point.target_time !== expectedTarget) throw new Error(`CAP08_S5_FORECAST_TARGET_MISMATCH:R-${String(index).padStart(2, "0")}`);
      const sourcePosterior = related.get(req(forecastPayload.source_posterior_ref, "CAP08_S5_SOURCE_POSTERIOR_REF_REQUIRED"));
      const sourceConfig = related.get(req(forecastPayload.runtime_config_ref, "CAP08_S5_SOURCE_CONFIG_REF_REQUIRED"));
      if (!sourcePosterior || sourcePosterior.object_type !== "twin_state_estimate_v1"
        || sourcePosterior.determinism_hash !== forecastPayload.source_posterior_hash) throw new Error("CAP08_S5_SOURCE_POSTERIOR_BINDING_MISMATCH");
      if (!sourceConfig || sourceConfig.object_type !== "twin_runtime_config_v1"
        || sourceConfig.determinism_hash !== forecastPayload.runtime_config_hash) throw new Error("CAP08_S5_SOURCE_CONFIG_BINDING_MISMATCH");
      const resolvedConfig = this.configResolver.resolveExecutionConfig(sourceConfig);
      const availableAt = index === 1 ? addHours("2026-06-01T00:00:00.000Z", 16) : expectedTarget;
      const observation = await this.observation({ scope: input.scope, index, available_at: availableAt });
      const observationStatus = observation.quality?.status;
      if (observationStatus !== "PASS" && observationStatus !== "LIMITED") throw new Error("CAP08_S5_FVO_QUALITY_INVALID");
      const sensor = Number(resolvedConfig.payload.observation_assimilation.sensor_measurement_stddev_fraction);
      const representativeness = Number(resolvedConfig.payload.observation_assimilation.point_to_zone_representativeness_stddev_fraction);
      const baseVariance = sensor ** 2 + representativeness ** 2;
      const qualityWeight = Number(resolvedConfig.payload.observation_assimilation.quality_weights[observationStatus]);
      if (!Number.isFinite(baseVariance) || !Number.isFinite(qualityWeight) || qualityWeight <= 0) throw new Error("CAP08_S5_OBSERVATION_VARIANCE_INVALID");
      const effectiveVariance = baseVariance / qualityWeight;
      const assimilationBinding = index <= 23 && SELECTED_ASSIMILATION_INDEXES.has(index)
        ? tuple.tick_bindings[index]
        : null;
      const assimilation = assimilationBinding ? primary.get(assimilationBinding.assimilation_update_ref) : null;
      if (assimilationBinding && (!assimilation || assimilation.determinism_hash !== assimilationBinding.assimilation_update_hash)) {
        throw new Error(`CAP08_S5_ASSIMILATION_BINDING_MISMATCH:FVO-${String(index).padStart(2, "0")}`);
      }
      const residual = buildCap05ForecastResidualV1({
        scope: input.scope,
        forecast_run_ref: forecast.object_id,
        forecast_run_hash: forecast.determinism_hash,
        forecast_issued_at: forecastPayload.issued_at,
        forecast_point_ref: buildCap05ForecastPointMemberRefV1(forecast.object_id, 1),
        forecast_point: point,
        root_zone_geometry_ref: resolvedConfig.payload.reality_binding_ref,
        root_zone_geometry_hash: resolvedConfig.payload.reality_binding_hash,
        root_zone_depth_mm: fixed(resolvedConfig.payload.soil_hydraulic_snapshot.root_zone_depth_mm, 6, "CAP08_S5_ROOT_DEPTH_REQUIRED"),
        actual_observation_ref: observation.source_record_id,
        actual_observation_hash: observation.source_record_hash,
        actual_observation_observed_at: expectedTarget,
        actual_observation_quality: observationStatus,
        actual_observation_value: fixed(record(observation.canonical_payload, "CAP08_S5_FVO_PAYLOAD_REQUIRED").value, 6, "CAP08_S5_FVO_VALUE_REQUIRED"),
        actual_observation_variance: effectiveVariance.toFixed(12),
        representativeness_variance: (representativeness ** 2).toFixed(12),
        runtime_config_ref: sourceConfig.object_id,
        runtime_config_hash: sourceConfig.determinism_hash,
        context_lineage_ref: req(sourcePosterior.lineage_id, "CAP08_S5_LINEAGE_REQUIRED"),
        context_revision_ref: req(sourcePosterior.revision_id, "CAP08_S5_REVISION_REQUIRED"),
        observation_available_to_runtime_at: availableAt,
        assimilation_update_ref: assimilation?.object_id ?? null,
        assimilation_update_hash: assimilation?.determinism_hash ?? null,
        created_at: createdAt,
      });
      const fieldCapacity = Number(resolvedConfig.payload.soil_hydraulic_snapshot.field_capacity_storage_mm);
      const saturation = Number(resolvedConfig.payload.soil_hydraulic_snapshot.saturation_storage_mm);
      const storageBeforeDrainage = Number(point.storage_mean_mm) + Number(point.drainage_mm) + Number(point.saturation_overflow_mm);
      const caseBasis = {
        residual_ref: residual.object_id,
        residual_hash: residual.determinism_hash,
        source_forecast_ref: forecast.object_id,
        source_forecast_hash: forecast.determinism_hash,
        source_forecast_point_ref: residual.payload.forecast_point_ref,
        source_forecast_point_hash: point.determinism_hash,
        source_posterior_ref: sourcePosterior.object_id,
        source_posterior_hash: sourcePosterior.determinism_hash,
        source_runtime_config_ref: sourceConfig.object_id,
        source_runtime_config_hash: sourceConfig.determinism_hash,
        actual_observation_ref: observation.source_record_id,
        actual_observation_hash: observation.source_record_hash,
      };
      const modelComponentHash = semanticHashV1({
        forecast_method_id: forecastPayload.forecast_method_id,
        forecast_method_version: forecastPayload.forecast_method_version,
        dynamics_model: "HOURLY_WATER_BALANCE_V1",
      });
      const parameterBundleHash = semanticHashV1(resolvedConfig.payload.dynamics_parameters);
      const operatorHash = semanticHashV1(resolvedConfig.payload.observation_assimilation.observation_operator);
      const numericPolicyHash = semanticHashV1({
        policy_id: CAP06_RUNTIME_REPLAY_NUMERIC_POLICY_ID_V1,
        rounding_policy_id: resolvedConfig.payload.rounding_policy_id,
      });
      const caseSource: Cap06CaseBuilderSourceV1 = {
        case_index: index - 1,
        scope: structuredClone(input.scope),
        residual_ref: residual.object_id,
        residual_hash: residual.determinism_hash,
        source_forecast_ref: forecast.object_id,
        source_forecast_hash: forecast.determinism_hash,
        source_forecast_point_ref: residual.payload.forecast_point_ref,
        source_forecast_point_hash: point.determinism_hash,
        source_posterior_ref: sourcePosterior.object_id,
        source_posterior_hash: sourcePosterior.determinism_hash,
        source_runtime_config_ref: sourceConfig.object_id,
        source_runtime_config_hash: sourceConfig.determinism_hash,
        actual_observation_ref: observation.source_record_id,
        actual_observation_hash: observation.source_record_hash,
        forecast_issued_at: forecastPayload.issued_at,
        forecast_as_of: forecast.as_of,
        forecast_evidence_cutoff: sourcePosterior.as_of,
        forecast_target_time: expectedTarget,
        observation_observed_at: expectedTarget,
        observation_available_to_runtime_at: availableAt,
        actual_observation_vwc: residual.payload.actual_observation_value,
        base_prediction_vwc: residual.payload.predicted_observation_value,
        excess_above_field_capacity_mm: (storageBeforeDrainage - fieldCapacity).toFixed(6),
        saturation_minus_field_capacity_mm: (saturation - fieldCapacity).toFixed(6),
        context_lineage_ref: req(sourcePosterior.lineage_id, "CAP08_S5_CASE_LINEAGE_REQUIRED"),
        context_revision_ref: req(sourcePosterior.revision_id, "CAP08_S5_CASE_REVISION_REQUIRED"),
        model_component_hash: modelComponentHash,
        effective_parameter_bundle_hash: parameterBundleHash,
        observation_operator_hash: operatorHash,
        geometry_hash: resolvedConfig.payload.reality_binding_hash,
        runtime_replay_numeric_policy_hash: numericPolicyHash,
        case_input_hash: semanticHashV1(caseBasis),
        source_runtime_config_logical_time: sourceConfig.logical_time,
      };
      residuals.push(residual);
      caseSources.push(caseSource);
      predictionAuthorities.push({
        residual_ref: residual.object_id,
        case_input_hash: caseSource.case_input_hash,
        source_posterior_ref: sourcePosterior.object_id,
        forecast_point: point,
        resolved_execution_config: resolvedConfig,
      });
    }

    const lineageId = req(caseSources[0]?.context_lineage_ref, "CAP08_S5_LINEAGE_REQUIRED");
    const revisionId = req(caseSources[0]?.context_revision_ref, "CAP08_S5_REVISION_REQUIRED");
    if (caseSources.some((item) => item.context_lineage_ref !== lineageId || item.context_revision_ref !== revisionId)) {
      throw new Error("CAP08_S5_CONTEXT_DRIFT");
    }
    const residualSetHash = semanticHashV1(residuals.map((item) => ({ ref: item.object_id, hash: item.determinism_hash })));
    const caseInputSetHash = semanticHashV1(caseSources.map((item) => ({
      residual_ref: item.residual_ref,
      residual_hash: item.residual_hash,
      forecast_point_ref: item.source_forecast_point_ref,
      forecast_point_hash: item.source_forecast_point_hash,
      observation_ref: item.actual_observation_ref,
      observation_hash: item.actual_observation_hash,
    })));
    const sourceDatasetIdentity: Cap06SourceDatasetIdentityV1 = {
      residual_set_hash: residualSetHash,
      case_input_set_hash: caseInputSetHash,
      calibration_window_hash: semanticHashV1(residuals.slice(0, 16).map((item) => item.object_id)),
      holdout_window_hash: semanticHashV1(residuals.slice(16).map((item) => item.object_id)),
      window_hash_semantics: CAP06_WINDOW_HASH_SEMANTICS_V1,
      holdout_purpose: CAP06_HOLDOUT_PURPOSE_V1,
      holdout_generalization_claim: CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
    };
    const identityInput: Cap08S5ResidualSetIdentityInputV1 = {
      formal_run_id: formalRunId,
      scope: structuredClone(input.scope),
      lineage_id: lineageId,
      revision_id: revisionId,
      s3_completion: { ref: tuple.tuple_ref, hash: tupleHash },
      s4_append_forward: { ref: s4.authority_ref, hash: s4.determinism_hash },
      phase_engine_contract_digest: input.phase_engine_contract_digest,
      phase_engine_source_digest: input.phase_engine_source_digest,
    };
    return {
      formal_run_id: formalRunId,
      scope: structuredClone(input.scope),
      lineage_id: lineageId,
      revision_id: revisionId,
      phase_engine_contract_digest: input.phase_engine_contract_digest,
      phase_engine_source_digest: input.phase_engine_source_digest,
      identity_input: identityInput,
      residuals,
      case_sources: caseSources,
      prediction_authorities: predictionAuthorities,
      source_dataset_identity: sourceDatasetIdentity,
      s3_completion: tuple,
      s4_authority: s4,
    };
  }
}
