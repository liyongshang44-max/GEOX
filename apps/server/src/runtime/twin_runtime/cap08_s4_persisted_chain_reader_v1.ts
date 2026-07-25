// Purpose: reconstruct the MCFT-CAP-08.S4 T01-to-T16 posterior transport context exclusively from the completed S3 canonical PostgreSQL chain.
// Boundary: read-only canonical inspection only; no external Evidence load, late-correction math, candidate construction, persistence, pointer mutation, repair, route, scheduler, or production Runtime authority.

import type { Pool } from "pg";
import {
  CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
  cap08TickLogicalTimeV1,
} from "../../domain/twin_runtime/cap08_phase_engine_contracts_v1.js";
import {
  CAP08_S3_COMPLETION_TUPLE_SCHEMA_VERSION_V1,
  validateCap08S3CompletionTupleV1,
  type Cap08S3CompletionTupleV1,
  type Cap08S3PersistedTickBindingV1,
} from "../../domain/twin_runtime/cap08_s3_completion_tuple_v1.js";
import {
  buildCap08S4HistoricalHashManifestV1,
  type Cap08S4HistoricalHashManifestV1,
  type Cap08S4ScopeV1,
} from "../../domain/twin_runtime/cap08_s4_append_forward_contracts_v1.js";
import type { Cap08S4LateTransitionV1 } from "../../domain/twin_runtime/cap08_s4_late_correction_math_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  validateCap04CanonicalForecastRunPayloadV1,
  type Cap04CanonicalCompletedForecastRunPayloadV1,
} from "../../domain/twin_runtime/forecast_canonical_authority_v1.js";
import {
  validateCap04RuntimeConfigPayloadV1,
  type Cap04RuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/forecast_scenario_runtime_config_v1.js";

export type Cap08S4PersistedTransportContextV1 = {
  formal_run_id: string;
  scope: Cap08S4ScopeV1;
  lineage_id: string;
  revision_id: string;
  phase_engine_contract_digest: typeof CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1;
  phase_engine_source_digest: string;
  source_t01_state: CanonicalObjectEnvelopeV1;
  source_t01_prior_mean: number;
  source_t01_prior_variance: number;
  base_t16_state: CanonicalObjectEnvelopeV1;
  base_t16_forecast: CanonicalObjectEnvelopeV1;
  base_t16_tick: CanonicalObjectEnvelopeV1;
  base_t16_checkpoint: CanonicalObjectEnvelopeV1;
  runtime_config: CanonicalObjectEnvelopeV1;
  execution_config_payload: Cap04RuntimeConfigPayloadV1;
  forcing_window: Cap04CanonicalCompletedForecastRunPayloadV1["forcing_window_authority"];
  current_t16_mean: number;
  current_t16_variance: number;
  transitions: Cap08S4LateTransitionV1[];
  historical_hash_manifest: Cap08S4HistoricalHashManifestV1;
};

type TickGraphV1 = {
  binding: Cap08S3PersistedTickBindingV1;
  tick: CanonicalObjectEnvelopeV1;
  state: CanonicalObjectEnvelopeV1;
  forecast: CanonicalObjectEnvelopeV1;
  checkpoint: CanonicalObjectEnvelopeV1;
  assimilation: CanonicalObjectEnvelopeV1;
};

type StateMomentsV1 = { mean: number; variance: number };

type AssimilationTraceV1 = {
  status: "APPLIED" | "NOT_APPLIED";
  prior_mean: number;
  prior_variance: number;
  published_posterior_mean: number;
  published_posterior_variance: number;
  selected_observation_ref: string | null;
  applied_observation_refs: string[];
  actual_observation: number | null;
  observation_variance: number | null;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function digestV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  if (!/^sha256:[0-9a-f]{64}$/.test(text)) throw new Error(code);
  return text;
}

function finiteV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
}

function nonNegativeV1(value: unknown, code: string): number {
  const number = finiteV1(value, code);
  if (number < 0) throw new Error(code);
  return number;
}

function recordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function stringArrayV1(value: unknown, code: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error(code);
  return [...value] as string[];
}

function scopeValuesV1(scope: Cap08S4ScopeV1): unknown[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}

function exactScopeV1(actual: CanonicalObjectEnvelopeV1, expected: Cap08S4ScopeV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[field] !== expected[field]) throw new Error(`${code}:${field}`);
  }
}

function parseFactObjectV1(value: unknown): CanonicalObjectEnvelopeV1 {
  const record = recordV1(typeof value === "string" ? JSON.parse(value) : value, "CAP08_S4_FACT_INVALID");
  const object = recordV1(record.payload, "CAP08_S4_FACT_PAYLOAD_REQUIRED") as unknown as CanonicalObjectEnvelopeV1;
  if (record.type !== object.object_type) throw new Error("CAP08_S4_FACT_TYPE_MISMATCH");
  return object;
}

function payloadV1(object: CanonicalObjectEnvelopeV1, code: string): Record<string, unknown> {
  return recordV1(object.payload, code);
}

function stateMomentsV1(state: CanonicalObjectEnvelopeV1): StateMomentsV1 {
  if (state.object_type !== "twin_state_estimate_v1") throw new Error("CAP08_S4_STATE_OBJECT_REQUIRED");
  const moments = recordV1(payloadV1(state, "CAP08_S4_STATE_PAYLOAD_REQUIRED").root_zone_vwc_fraction, "CAP08_S4_STATE_VWC_REQUIRED");
  return {
    mean: finiteV1(moments.mean, "CAP08_S4_STATE_MEAN_INVALID"),
    variance: nonNegativeV1(moments.variance, "CAP08_S4_STATE_VARIANCE_INVALID"),
  };
}

function assimilationTraceV1(object: CanonicalObjectEnvelopeV1): AssimilationTraceV1 {
  if (object.object_type !== "twin_assimilation_update_v1") throw new Error("CAP08_S4_ASSIMILATION_OBJECT_REQUIRED");
  const payload = payloadV1(object, "CAP08_S4_ASSIMILATION_PAYLOAD_REQUIRED");
  if (payload.status !== "APPLIED" && payload.status !== "NOT_APPLIED") throw new Error("CAP08_S4_ASSIMILATION_STATUS_INVALID");
  return {
    status: payload.status,
    prior_mean: finiteV1(payload.prior_mean, "CAP08_S4_ASSIMILATION_PRIOR_MEAN_INVALID"),
    prior_variance: nonNegativeV1(payload.prior_variance, "CAP08_S4_ASSIMILATION_PRIOR_VARIANCE_INVALID"),
    published_posterior_mean: finiteV1(payload.published_posterior_mean, "CAP08_S4_ASSIMILATION_POSTERIOR_MEAN_INVALID"),
    published_posterior_variance: nonNegativeV1(payload.published_posterior_variance, "CAP08_S4_ASSIMILATION_POSTERIOR_VARIANCE_INVALID"),
    selected_observation_ref: payload.selected_observation_ref === null
      ? null
      : requiredStringV1(payload.selected_observation_ref, "CAP08_S4_SELECTED_OBSERVATION_REF_INVALID"),
    applied_observation_refs: stringArrayV1(payload.applied_observation_refs, "CAP08_S4_APPLIED_OBSERVATION_REFS_INVALID"),
    actual_observation: payload.actual_observation === null
      ? null
      : finiteV1(payload.actual_observation, "CAP08_S4_ACTUAL_OBSERVATION_INVALID"),
    observation_variance: payload.observation_variance === null
      ? null
      : nonNegativeV1(payload.observation_variance, "CAP08_S4_OBSERVATION_VARIANCE_INVALID"),
  };
}

function closeEnoughV1(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= 1e-9;
}

function replayTransitionV1(input: {
  previous: StateMomentsV1;
  transition: Cap08S4LateTransitionV1;
  lower_bound: number;
  upper_bound: number;
  minimum_variance: number;
}): StateMomentsV1 {
  const predictedMean = Math.max(input.lower_bound, Math.min(
    input.upper_bound,
    input.previous.mean + input.transition.dynamics_delta,
  ));
  const predictedVariance = Math.max(
    input.previous.variance + input.transition.process_variance,
    input.minimum_variance,
  );
  const observation = input.transition.ordinary_observation;
  if (!observation) return { mean: predictedMean, variance: predictedVariance };
  const gain = observation.quality * predictedVariance / (predictedVariance + observation.variance);
  return {
    mean: Math.max(input.lower_bound, Math.min(
      input.upper_bound,
      predictedMean + gain * (observation.value - predictedMean),
    )),
    variance: Math.max((1 - gain) * predictedVariance, input.minimum_variance),
  };
}

export class Cap08S4PersistedChainReaderV1 {
  constructor(private readonly pool: Pool) {}

  private async readTupleV1(input: {
    formal_run_id: string;
    scope: Cap08S4ScopeV1;
    phase_engine_source_digest: string;
  }): Promise<Cap08S3CompletionTupleV1> {
    const result = await this.pool.query(
      `SELECT determinism_hash,semantic_payload
         FROM twin_runtime_authority_snapshot_v1
        WHERE semantic_payload->>'schema_version'=$1
          AND semantic_payload->>'formal_run_id'=$2
          AND semantic_payload->'scope'->>'tenant_id'=$3
          AND semantic_payload->'scope'->>'project_id'=$4
          AND semantic_payload->'scope'->>'group_id'=$5
          AND semantic_payload->'scope'->>'field_id'=$6
          AND semantic_payload->'scope'->>'season_id'=$7
          AND semantic_payload->'scope'->>'zone_id'=$8`,
      [CAP08_S3_COMPLETION_TUPLE_SCHEMA_VERSION_V1, input.formal_run_id, ...scopeValuesV1(input.scope)],
    );
    if (result.rows.length !== 1) throw new Error("CAP08_S4_S3_COMPLETION_TUPLE_CARDINALITY");
    const raw = typeof result.rows[0].semantic_payload === "string"
      ? JSON.parse(result.rows[0].semantic_payload)
      : result.rows[0].semantic_payload;
    const tuple = structuredClone(raw as Cap08S3CompletionTupleV1);
    validateCap08S3CompletionTupleV1(tuple);
    if (tuple.determinism_hash !== result.rows[0].determinism_hash
      || tuple.phase_engine_source_digest !== input.phase_engine_source_digest) {
      throw new Error("CAP08_S4_S3_COMPLETION_TUPLE_HASH_MISMATCH");
    }
    return tuple;
  }

  private async readObjectsV1(objectIds: readonly string[]): Promise<Map<string, CanonicalObjectEnvelopeV1>> {
    const unique = [...new Set(objectIds)];
    const result = await this.pool.query(
      `SELECT record_json FROM facts
        WHERE record_json->'payload'->>'object_id'=ANY($1::text[])
        ORDER BY fact_id`,
      [unique],
    );
    const map = new Map<string, CanonicalObjectEnvelopeV1>();
    for (const row of result.rows) {
      const object = parseFactObjectV1(row.record_json);
      if (map.has(object.object_id)) throw new Error("CAP08_S4_CANONICAL_OBJECT_ID_NOT_UNIQUE");
      map.set(object.object_id, object);
    }
    if (map.size !== unique.length) throw new Error("CAP08_S4_CANONICAL_GRAPH_INCOMPLETE");
    return map;
  }

  private async graphV1(tuple: Cap08S3CompletionTupleV1, scope: Cap08S4ScopeV1): Promise<TickGraphV1[]> {
    const bindings = tuple.tick_bindings.slice(0, 17);
    if (bindings.length !== 17 || bindings.some((binding, index) =>
      binding.tick_id !== `T${String(index).padStart(2, "0")}`
      || binding.logical_time !== cap08TickLogicalTimeV1(index))) {
      throw new Error("CAP08_S4_T00_T16_BINDING_SEQUENCE_MISMATCH");
    }
    const primary = await this.readObjectsV1(bindings.flatMap((binding) => [binding.tick_ref, binding.assimilation_update_ref]));
    const relatedRefs: string[] = [];
    const ticks = bindings.map((binding) => {
      const tick = primary.get(binding.tick_ref);
      if (!tick || tick.object_type !== "twin_runtime_tick_v1" || tick.determinism_hash !== binding.tick_hash) {
        throw new Error(`CAP08_S4_TICK_BINDING_MISMATCH:${binding.tick_id}`);
      }
      exactScopeV1(tick, scope, `CAP08_S4_TICK_SCOPE_MISMATCH:${binding.tick_id}`);
      const payload = payloadV1(tick, "CAP08_S4_TICK_PAYLOAD_REQUIRED");
      for (const field of ["posterior_state_ref", "forecast_result_ref", "checkpoint_ref"] as const) {
        relatedRefs.push(requiredStringV1(payload[field], `CAP08_S4_TICK_${field.toUpperCase()}_REQUIRED`));
      }
      return tick;
    });
    const related = await this.readObjectsV1(relatedRefs);
    return bindings.map((binding, index) => {
      const tick = ticks[index];
      const payload = payloadV1(tick, "CAP08_S4_TICK_PAYLOAD_REQUIRED");
      const requireObject = (ref: unknown, type: CanonicalObjectEnvelopeV1["object_type"], code: string) => {
        const object = related.get(requiredStringV1(ref, code));
        if (!object || object.object_type !== type) throw new Error(code);
        exactScopeV1(object, scope, `${code}_SCOPE`);
        return object;
      };
      const assimilation = primary.get(binding.assimilation_update_ref);
      if (!assimilation || assimilation.object_type !== "twin_assimilation_update_v1"
        || assimilation.determinism_hash !== binding.assimilation_update_hash) {
        throw new Error(`CAP08_S4_ASSIMILATION_BINDING_MISMATCH:${binding.tick_id}`);
      }
      return {
        binding,
        tick,
        state: requireObject(payload.posterior_state_ref, "twin_state_estimate_v1", "CAP08_S4_STATE_REF_INVALID"),
        forecast: requireObject(payload.forecast_result_ref, "twin_forecast_run_v1", "CAP08_S4_FORECAST_REF_INVALID"),
        checkpoint: requireObject(payload.checkpoint_ref, "twin_runtime_checkpoint_v1", "CAP08_S4_CHECKPOINT_REF_INVALID"),
        assimilation,
      };
    });
  }

  private transitionsV1(input: {
    graph: TickGraphV1[];
    lower_bound: number;
    upper_bound: number;
    minimum_variance: number;
  }): Cap08S4LateTransitionV1[] {
    const transitions: Cap08S4LateTransitionV1[] = [];
    for (let index = 2; index <= 16; index += 1) {
      const previous = stateMomentsV1(input.graph[index - 1].state);
      const current = stateMomentsV1(input.graph[index].state);
      const trace = assimilationTraceV1(input.graph[index].assimilation);
      const processVariance = trace.prior_variance - previous.variance;
      if (processVariance < -1e-9) throw new Error(`CAP08_S4_PROCESS_VARIANCE_REGRESSION:T${String(index).padStart(2, "0")}`);
      const transition: Cap08S4LateTransitionV1 = {
        dynamics_delta: trace.prior_mean - previous.mean,
        process_variance: Math.max(0, processVariance),
      };
      if (trace.status === "APPLIED") {
        if (trace.actual_observation === null || trace.observation_variance === null
          || trace.selected_observation_ref === null || trace.applied_observation_refs.length !== 1
          || trace.applied_observation_refs[0] !== trace.selected_observation_ref) {
          throw new Error(`CAP08_S4_APPLIED_ASSIMILATION_TRACE_INVALID:T${String(index).padStart(2, "0")}`);
        }
        // The persisted Runtime already folds quality into effective_observation_variance.
        // quality=1 with that effective variance exactly reproduces the existing ordinary assimilation operator.
        transition.ordinary_observation = {
          value: trace.actual_observation,
          variance: trace.observation_variance,
          quality: 1,
        };
      } else if (trace.applied_observation_refs.length !== 0) {
        throw new Error(`CAP08_S4_NON_APPLIED_ASSIMILATION_HAS_APPLIED_REF:T${String(index).padStart(2, "0")}`);
      }
      const replayed = replayTransitionV1({
        previous,
        transition,
        lower_bound: input.lower_bound,
        upper_bound: input.upper_bound,
        minimum_variance: input.minimum_variance,
      });
      if (!closeEnoughV1(replayed.mean, current.mean) || !closeEnoughV1(replayed.variance, current.variance)
        || !closeEnoughV1(trace.published_posterior_mean, current.mean)
        || !closeEnoughV1(trace.published_posterior_variance, current.variance)) {
        throw new Error(`CAP08_S4_PERSISTED_TRANSITION_REPLAY_MISMATCH:T${String(index).padStart(2, "0")}`);
      }
      transitions.push(transition);
    }
    if (transitions.length !== 15) throw new Error("CAP08_S4_TRANSITION_COUNT_MISMATCH");
    return transitions;
  }

  async read(input: {
    formal_run_id: string;
    scope: Cap08S4ScopeV1;
    phase_engine_source_digest: string;
  }): Promise<Cap08S4PersistedTransportContextV1> {
    const formalRunId = requiredStringV1(input.formal_run_id, "CAP08_S4_FORMAL_RUN_ID_REQUIRED");
    const phaseSourceDigest = digestV1(input.phase_engine_source_digest, "CAP08_S4_PHASE_SOURCE_DIGEST_INVALID");
    const tuple = await this.readTupleV1({ ...input, formal_run_id: formalRunId, phase_engine_source_digest: phaseSourceDigest });
    const graph = await this.graphV1(tuple, input.scope);
    const t01 = graph[1];
    const t16 = graph[16];
    const lineageId = requiredStringV1(t16.state.lineage_id, "CAP08_S4_LINEAGE_ID_REQUIRED");
    const revisionId = requiredStringV1(t16.state.revision_id, "CAP08_S4_REVISION_ID_REQUIRED");
    if (graph.some((item) => item.state.lineage_id !== lineageId || item.state.revision_id !== revisionId)) {
      throw new Error("CAP08_S4_HISTORICAL_LINEAGE_REVISION_DRIFT");
    }

    const configRef = requiredStringV1(t16.state.runtime_config_ref, "CAP08_S4_RUNTIME_CONFIG_REF_REQUIRED");
    const configHash = digestV1(t16.state.runtime_config_hash, "CAP08_S4_RUNTIME_CONFIG_HASH_REQUIRED");
    const config = (await this.readObjectsV1([configRef])).get(configRef);
    if (!config || config.object_type !== "twin_runtime_config_v1" || config.determinism_hash !== configHash) {
      throw new Error("CAP08_S4_RUNTIME_CONFIG_BINDING_MISMATCH");
    }
    const configPayload = structuredClone(config.payload) as unknown as Cap04RuntimeConfigPayloadV1;
    validateCap04RuntimeConfigPayloadV1(configPayload);
    if (configPayload.effective_logical_time !== cap08TickLogicalTimeV1(16)) throw new Error("CAP08_S4_RUNTIME_CONFIG_TIME_MISMATCH");

    const forecastPayload = structuredClone(t16.forecast.payload) as unknown as Cap04CanonicalCompletedForecastRunPayloadV1;
    validateCap04CanonicalForecastRunPayloadV1(forecastPayload);
    if (forecastPayload.status !== "COMPLETED") throw new Error("CAP08_S4_T16_COMPLETED_FORECAST_REQUIRED");

    const tickPayload = payloadV1(t16.tick, "CAP08_S4_T16_TICK_PAYLOAD_REQUIRED");
    const checkpointPayload = payloadV1(t16.checkpoint, "CAP08_S4_T16_CHECKPOINT_PAYLOAD_REQUIRED");
    if (tickPayload.posterior_state_ref !== t16.state.object_id || tickPayload.forecast_result_ref !== t16.forecast.object_id
      || tickPayload.checkpoint_ref !== t16.checkpoint.object_id || checkpointPayload.last_completed_tick_ref !== t16.tick.object_id
      || checkpointPayload.last_posterior_state_ref !== t16.state.object_id || checkpointPayload.forecast_result_ref !== t16.forecast.object_id) {
      throw new Error("CAP08_S4_T16_BASE_GRAPH_MISMATCH");
    }
    const t16Assimilation = assimilationTraceV1(t16.assimilation);
    if (t16Assimilation.status !== "NOT_APPLIED" || t16Assimilation.selected_observation_ref !== null
      || t16Assimilation.applied_observation_refs.length !== 0) {
      throw new Error("CAP08_S4_T16_DYNAMICS_ONLY_BASE_REQUIRED");
    }
    const t01Assimilation = assimilationTraceV1(t01.assimilation);
    const current = stateMomentsV1(t16.state);
    const upperBound = finiteV1(configPayload.soil_hydraulic_snapshot.saturation_fraction, "CAP08_S4_SATURATION_INVALID");
    const minimumVariance = 0.0001;
    return {
      formal_run_id: formalRunId,
      scope: structuredClone(input.scope),
      lineage_id: lineageId,
      revision_id: revisionId,
      phase_engine_contract_digest: CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
      phase_engine_source_digest: phaseSourceDigest,
      source_t01_state: t01.state,
      source_t01_prior_mean: t01Assimilation.prior_mean,
      source_t01_prior_variance: t01Assimilation.prior_variance,
      base_t16_state: t16.state,
      base_t16_forecast: t16.forecast,
      base_t16_tick: t16.tick,
      base_t16_checkpoint: t16.checkpoint,
      runtime_config: config,
      execution_config_payload: configPayload,
      forcing_window: structuredClone(forecastPayload.forcing_window_authority),
      current_t16_mean: current.mean,
      current_t16_variance: current.variance,
      transitions: this.transitionsV1({ graph, lower_bound: 0, upper_bound: upperBound, minimum_variance: minimumVariance }),
      historical_hash_manifest: buildCap08S4HistoricalHashManifestV1({
        state_bindings: graph.map(({ state }) => ({ ref: state.object_id, hash: state.determinism_hash })),
        forecast_bindings: graph.map(({ forecast }) => ({ ref: forecast.object_id, hash: forecast.determinism_hash })),
      }),
    };
  }
}
