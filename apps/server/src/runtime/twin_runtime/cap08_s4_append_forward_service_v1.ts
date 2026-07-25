// Purpose: reconstruct the MCFT-CAP-08.S4 T01-to-T16 transport exclusively from the completed S3 canonical PostgreSQL chain, establish the corrected T16 append-forward authority, and resolve the exact corrected T17 predecessor.
// Boundary: one explicit bounded slice invocation only; no historical rewrite, latest-pointer mutation, Residual commit, Calibration, Shadow, route, scheduler, live ingestion, production Runtime source, or MCFT-CAP-09 authority.

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
  CAP08_S4_LAG_HOURS_V1,
  CAP08_S4_LATE_OBSERVATION_ID_V1,
  CAP08_S4_ORDINARY_DUE_OBSERVATION_ID_V1,
  buildCap08S4HistoricalHashManifestV1,
  deriveCap08S4AppendForwardIdentityV1,
  type Cap08S4AppendForwardAuthorityV1,
  type Cap08S4CorrectedCanonicalSetV1,
  type Cap08S4ScopeV1,
  type Cap08S4T17CorrectedPredecessorV1,
} from "../../domain/twin_runtime/cap08_s4_append_forward_contracts_v1.js";
import {
  calculateCap08S4LateCorrectionV1,
  type Cap08S4LateCorrectionAppliedV1,
  type Cap08S4LateCorrectionInputV1,
  type Cap08S4LateTransitionV1,
} from "../../domain/twin_runtime/cap08_s4_late_correction_math_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  validateCap04CanonicalForecastRunPayloadV1,
  type Cap04CanonicalCompletedForecastRunPayloadV1,
} from "../../domain/twin_runtime/forecast_canonical_authority_v1.js";
import {
  validateCap04RuntimeConfigPayloadV1,
  type Cap04RuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import type { CanonicalReplayEvidenceRecordV1 } from "./ports.js";
import {
  PostgresCap08S4AppendForwardRepositoryV1,
  type EstablishCap08S4AppendForwardResultV1,
} from "../../persistence/twin_runtime/postgres_cap08_s4_append_forward_repository_v1.js";
import {
  buildCap08S4CorrectedCanonicalSetV1,
} from "./cap08_s4_corrected_canonical_set_builder_v1.js";
import { Cap08S4T17CorrectedPredecessorResolverV1 } from "./cap08_s4_t17_corrected_predecessor_resolver_v1.js";

export type ExecuteCap08S4AppendForwardInputV1 = {
  formal_run_id: string;
  scope: Cap08S4ScopeV1;
  created_at: string;
  phase_engine_source_digest: string;
  fault_injection?: (stage: string) => void;
};

export type ExecuteCap08S4AppendForwardResultV1 = {
  status: "COMPLETED" | "ALREADY_COMPLETE";
  write_status: EstablishCap08S4AppendForwardResultV1["write_status"];
  write_delta: 0 | 7;
  authority: Cap08S4AppendForwardAuthorityV1;
  corrected_set: Cap08S4CorrectedCanonicalSetV1;
  t17_predecessor: Cap08S4T17CorrectedPredecessorV1;
  transport_transition_count: 15;
  historical_state_hash_count: 17;
  historical_forecast_hash_count: 17;
  historical_hashes_unchanged: true;
  latest_pointer_delta: 0;
  residual_count: 0;
  residual_obligations: readonly ["R-01", "R-16"];
  residual_commit_status: "PENDING_S5_C_PROVIDER";
  phase_engine_contract_digest: typeof CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1;
  phase_engine_source_digest: string;
  slice_acceptance_only: true;
  final_formal_run_id: null;
  production_runtime_source_authorized: false;
  s5_authorized: false;
  mcft_cap_09_authorized: false;
};

type PersistedTickGraphV1 = {
  binding: Cap08S3PersistedTickBindingV1;
  tick: CanonicalObjectEnvelopeV1;
  state: CanonicalObjectEnvelopeV1;
  forecast: CanonicalObjectEnvelopeV1;
  checkpoint: CanonicalObjectEnvelopeV1;
  evidence: CanonicalObjectEnvelopeV1;
  assimilation: CanonicalObjectEnvelopeV1;
};

type StateMomentsV1 = {
  mean: number;
  variance: number;
};

type AssimilationTraceV1 = {
  status: "APPLIED" | "NOT_APPLIED";
  prior_mean: number;
  prior_variance: number;
  published_posterior_mean: number;
  published_posterior_variance: number;
  actual_observation: number | null;
  observation_variance: number | null;
  selected_observation_ref: string | null;
  applied_observation_refs: string[];
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalIsoV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
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
  return [
    scope.tenant_id,
    scope.project_id,
    scope.group_id,
    scope.field_id,
    scope.season_id,
    scope.zone_id,
  ];
}

function exactScopeV1(actual: CanonicalObjectEnvelopeV1, expected: Cap08S4ScopeV1, code: string): void {
  for (const field of [
    "tenant_id",
    "project_id",
    "group_id",
    "field_id",
    "season_id",
    "zone_id",
  ] as const) {
    if (actual[field] !== expected[field]) throw new Error(`${code}:${field}`);
  }
}

function parseFactObjectV1(value: unknown): CanonicalObjectEnvelopeV1 {
  const record = recordV1(typeof value === "string" ? JSON.parse(value) : value, "CAP08_S4_FACT_INVALID");
  const object = recordV1(record.payload, "CAP08_S4_FACT_PAYLOAD_REQUIRED") as unknown as CanonicalObjectEnvelopeV1;
  if (record.type !== object.object_type) throw new Error("CAP08_S4_FACT_TYPE_MISMATCH");
  return object;
}

function objectPayloadV1(object: CanonicalObjectEnvelopeV1, code: string): Record<string, unknown> {
  return recordV1(object.payload, code);
}

function stateMomentsV1(state: CanonicalObjectEnvelopeV1): StateMomentsV1 {
  if (state.object_type !== "twin_state_estimate_v1") throw new Error("CAP08_S4_STATE_OBJECT_REQUIRED");
  const moments = recordV1(
    objectPayloadV1(state, "CAP08_S4_STATE_PAYLOAD_REQUIRED").root_zone_vwc_fraction,
    "CAP08_S4_STATE_VWC_MOMENTS_REQUIRED",
  );
  return {
    mean: finiteV1(moments.mean, "CAP08_S4_STATE_MEAN_INVALID"),
    variance: nonNegativeV1(moments.variance, "CAP08_S4_STATE_VARIANCE_INVALID"),
  };
}

function assimilationTraceV1(object: CanonicalObjectEnvelopeV1): AssimilationTraceV1 {
  if (object.object_type !== "twin_assimilation_update_v1") {
    throw new Error("CAP08_S4_ASSIMILATION_OBJECT_REQUIRED");
  }
  const payload = objectPayloadV1(object, "CAP08_S4_ASSIMILATION_PAYLOAD_REQUIRED");
  if (payload.status !== "APPLIED" && payload.status !== "NOT_APPLIED") {
    throw new Error("CAP08_S4_ASSIMILATION_STATUS_INVALID");
  }
  const selected = payload.selected_observation_ref === null
    ? null
    : requiredStringV1(payload.selected_observation_ref, "CAP08_S4_SELECTED_OBSERVATION_REF_INVALID");
  return {
    status: payload.status,
    prior_mean: finiteV1(payload.prior_mean, "CAP08_S4_ASSIMILATION_PRIOR_MEAN_INVALID"),
    prior_variance: nonNegativeV1(
      payload.prior_variance,
      "CAP08_S4_ASSIMILATION_PRIOR_VARIANCE_INVALID",
    ),
    published_posterior_mean: finiteV1(
      payload.published_posterior_mean,
      "CAP08_S4_ASSIMILATION_POSTERIOR_MEAN_INVALID",
    ),
    published_posterior_variance: nonNegativeV1(
      payload.published_posterior_variance,
      "CAP08_S4_ASSIMILATION_POSTERIOR_VARIANCE_INVALID",
    ),
    actual_observation: payload.actual_observation === null
      ? null
      : finiteV1(payload.actual_observation, "CAP08_S4_ASSIMILATION_ACTUAL_INVALID"),
    observation_variance: payload.observation_variance === null
      ? null
      : nonNegativeV1(
        payload.observation_variance,
        "CAP08_S4_ASSIMILATION_OBSERVATION_VARIANCE_INVALID",
      ),
    selected_observation_ref: selected,
    applied_observation_refs: stringArrayV1(
      payload.applied_observation_refs,
      "CAP08_S4_ASSIMILATION_APPLIED_REFS_INVALID",
    ),
  };
}

function closeEnoughV1(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= 1e-9;
}

function oneStepV1(input: {
  previous: StateMomentsV1;
  transition: Cap08S4LateTransitionV1;
  lower_bound: number;
  upper_bound: number;
  minimum_variance: number;
}): StateMomentsV1 {
  const predictedMean = Math.max(
    input.lower_bound,
    Math.min(input.upper_bound, input.previous.mean + input.transition.dynamics_delta),
  );
  const predictedVariance = Math.max(
    input.previous.variance + input.transition.process_variance,
    input.minimum_variance,
  );
  const observation = input.transition.ordinary_observation;
  if (!observation) return { mean: predictedMean, variance: predictedVariance };
  const gain = observation.quality * predictedVariance
    / (predictedVariance + observation.variance);
  return {
    mean: Math.max(
      input.lower_bound,
      Math.min(input.upper_bound, predictedMean + gain * (observation.value - predictedMean)),
    ),
    variance: Math.max((1 - gain) * predictedVariance, input.minimum_variance),
  };
}

function observationRecordV1(input: {
  evidence: CanonicalObjectEnvelopeV1;
  source_record_id: string;
  observed_at: string;
  available_at: string;
}): CanonicalReplayEvidenceRecordV1 {
  const payload = objectPayloadV1(input.evidence, "CAP08_S4_EVIDENCE_PAYLOAD_REQUIRED");
  const base = recordV1(
    payload.base_continuation_window,
    "CAP08_S4_BASE_CONTINUATION_WINDOW_REQUIRED",
  );
  const records = base.soil_moisture_records;
  if (!Array.isArray(records)) throw new Error("CAP08_S4_SOIL_MOISTURE_RECORDS_REQUIRED");
  const matches = records.filter((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
    return (candidate as Record<string, unknown>).source_record_id === input.source_record_id;
  });
  if (matches.length !== 1) throw new Error(`CAP08_S4_OBSERVATION_CARDINALITY:${input.source_record_id}`);
  const record = structuredClone(matches[0]) as CanonicalReplayEvidenceRecordV1;
  if (record.record_type !== "soil_moisture_observation_v1"
    || record.source_record_id !== input.source_record_id
    || record.role_time?.observed_at !== input.observed_at
    || record.available_to_runtime_at !== input.available_at
    || record.role_time?.ingested_at !== input.available_at
    || record.canonical_unit !== "fraction") {
    throw new Error(`CAP08_S4_OBSERVATION_FORMAL_BINDING_MISMATCH:${input.source_record_id}`);
  }
  return record;
}

function qualityWeightV1(
  quality: unknown,
  config: Cap04RuntimeConfigPayloadV1,
): number {
  if (quality !== "PASS" && quality !== "LIMITED") {
    throw new Error("CAP08_S4_LATE_OBSERVATION_QUALITY_UNUSABLE");
  }
  return finiteV1(
    config.observation_assimilation.quality_weights[quality],
    "CAP08_S4_LATE_OBSERVATION_QUALITY_WEIGHT_INVALID",
  );
}

export class Cap08S4AppendForwardServiceV1 {
  private readonly repository: PostgresCap08S4AppendForwardRepositoryV1;
  private readonly resolver: Cap08S4T17CorrectedPredecessorResolverV1;

  constructor(private readonly pool: Pool) {
    this.repository = new PostgresCap08S4AppendForwardRepositoryV1(pool);
    this.resolver = new Cap08S4T17CorrectedPredecessorResolverV1(pool);
  }

  private async readS3TupleV1(input: ExecuteCap08S4AppendForwardInputV1): Promise<Cap08S3CompletionTupleV1> {
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
      [
        CAP08_S3_COMPLETION_TUPLE_SCHEMA_VERSION_V1,
        input.formal_run_id,
        ...scopeValuesV1(input.scope),
      ],
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

  private async graphV1(
    tuple: Cap08S3CompletionTupleV1,
    scope: Cap08S4ScopeV1,
  ): Promise<PersistedTickGraphV1[]> {
    const bindings = tuple.tick_bindings.slice(0, 17);
    if (bindings.length !== 17
      || bindings.some((binding, index) => binding.tick_id !== `T${String(index).padStart(2, "0")}`
        || binding.logical_time !== cap08TickLogicalTimeV1(index))) {
      throw new Error("CAP08_S4_T00_T16_BINDING_SEQUENCE_MISMATCH");
    }
    const firstObjects = await this.readObjectsV1(bindings.flatMap((binding) => [
      binding.tick_ref,
      binding.evidence_window_ref,
      binding.assimilation_update_ref,
    ]));
    const graphRefs: string[] = [];
    const tickObjects = bindings.map((binding) => {
      const tick = firstObjects.get(binding.tick_ref);
      if (!tick || tick.object_type !== "twin_runtime_tick_v1"
        || tick.determinism_hash !== binding.tick_hash) {
        throw new Error(`CAP08_S4_TICK_BINDING_MISMATCH:${binding.tick_id}`);
      }
      exactScopeV1(tick, scope, `CAP08_S4_TICK_SCOPE_MISMATCH:${binding.tick_id}`);
      const payload = objectPayloadV1(tick, "CAP08_S4_TICK_PAYLOAD_REQUIRED");
      for (const field of [
        "posterior_state_ref",
        "forecast_result_ref",
        "checkpoint_ref",
      ] as const) graphRefs.push(requiredStringV1(payload[field], `CAP08_S4_TICK_${field.toUpperCase()}_REQUIRED`));
      return tick;
    });
    const graphObjects = await this.readObjectsV1(graphRefs);
    return bindings.map((binding, index) => {
      const tick = tickObjects[index];
      const payload = objectPayloadV1(tick, "CAP08_S4_TICK_PAYLOAD_REQUIRED");
      const require = (ref: unknown, type: CanonicalObjectEnvelopeV1["object_type"], code: string) => {
        const object = graphObjects.get(requiredStringV1(ref, code));
        if (!object || object.object_type !== type) throw new Error(code);
        exactScopeV1(object, scope, `${code}_SCOPE`);
        return object;
      };
      const evidence = firstObjects.get(binding.evidence_window_ref);
      const assimilation = firstObjects.get(binding.assimilation_update_ref);
      if (!evidence || evidence.object_type !== "twin_evidence_window_v1"
        || evidence.determinism_hash !== binding.evidence_window_hash
        || !assimilation || assimilation.object_type !== "twin_assimilation_update_v1"
        || assimilation.determinism_hash !== binding.assimilation_update_hash) {
        throw new Error(`CAP08_S4_EVIDENCE_ASSIMILATION_BINDING_MISMATCH:${binding.tick_id}`);
      }
      return {
        binding,
        tick,
        state: require(payload.posterior_state_ref, "twin_state_estimate_v1", "CAP08_S4_STATE_REF_INVALID"),
        forecast: require(payload.forecast_result_ref, "twin_forecast_run_v1", "CAP08_S4_FORECAST_REF_INVALID"),
        checkpoint: require(payload.checkpoint_ref, "twin_runtime_checkpoint_v1", "CAP08_S4_CHECKPOINT_REF_INVALID"),
        evidence,
        assimilation,
      };
    });
  }

  private transitionsV1(input: {
    graph: PersistedTickGraphV1[];
    lower_bound: number;
    upper_bound: number;
    minimum_variance: number;
  }): Cap08S4LateTransitionV1[] {
    const transitions: Cap08S4LateTransitionV1[] = [];
    for (let index = 2; index <= 16; index += 1) {
      const previous = stateMomentsV1(input.graph[index - 1].state);
      const current = stateMomentsV1(input.graph[index].state);
      const trace = assimilationTraceV1(input.graph[index].assimilation);
      const processVarianceRaw = trace.prior_variance - previous.variance;
      if (processVarianceRaw < -1e-9) {
        throw new Error(`CAP08_S4_PROCESS_VARIANCE_REGRESSION:T${String(index).padStart(2, "0")}`);
      }
      const transition: Cap08S4LateTransitionV1 = {
        dynamics_delta: trace.prior_mean - previous.mean,
        process_variance: Math.max(0, processVarianceRaw),
      };
      if (trace.status === "APPLIED") {
        if (trace.actual_observation === null
          || trace.observation_variance === null
          || trace.selected_observation_ref === null
          || trace.applied_observation_refs.length !== 1
          || trace.applied_observation_refs[0] !== trace.selected_observation_ref) {
          throw new Error(`CAP08_S4_APPLIED_ASSIMILATION_TRACE_INVALID:T${String(index).padStart(2, "0")}`);
        }
        transition.ordinary_observation = {
          value: trace.actual_observation,
          variance: trace.observation_variance,
          quality: 1,
        };
      } else if (trace.applied_observation_refs.length !== 0) {
        throw new Error(`CAP08_S4_NON_APPLIED_ASSIMILATION_HAS_APPLIED_REF:T${String(index).padStart(2, "0")}`);
      }
      const replayed = oneStepV1({
        previous,
        transition,
        lower_bound: input.lower_bound,
        upper_bound: input.upper_bound,
        minimum_variance: input.minimum_variance,
      });
      if (!closeEnoughV1(replayed.mean, current.mean)
        || !closeEnoughV1(replayed.variance, current.variance)
        || !closeEnoughV1(trace.published_posterior_mean, current.mean)
        || !closeEnoughV1(trace.published_posterior_variance, current.variance)) {
        throw new Error(`CAP08_S4_PERSISTED_TRANSITION_REPLAY_MISMATCH:T${String(index).padStart(2, "0")}`);
      }
      transitions.push(transition);
    }
    if (transitions.length !== 15) throw new Error("CAP08_S4_TRANSITION_COUNT_MISMATCH");
    return transitions;
  }

  async execute(input: ExecuteCap08S4AppendForwardInputV1): Promise<ExecuteCap08S4AppendForwardResultV1> {
    const formalRunId = requiredStringV1(input.formal_run_id, "CAP08_S4_FORMAL_RUN_ID_REQUIRED");
    const createdAt = canonicalIsoV1(input.created_at, "CAP08_S4_CREATED_AT_INVALID");
    const phaseSourceDigest = digestV1(
      input.phase_engine_source_digest,
      "CAP08_S4_PHASE_SOURCE_DIGEST_INVALID",
    );
    const tuple = await this.readS3TupleV1({
      ...input,
      formal_run_id: formalRunId,
      created_at: createdAt,
      phase_engine_source_digest: phaseSourceDigest,
    });
    const graph = await this.graphV1(tuple, input.scope);
    const t01 = graph[1];
    const t16 = graph[16];
    const t16Time = cap08TickLogicalTimeV1(16);
    const t17Time = cap08TickLogicalTimeV1(17);

    const configRef = requiredStringV1(
      t16.state.runtime_config_ref,
      "CAP08_S4_RUNTIME_CONFIG_REF_REQUIRED",
    );
    const configHash = digestV1(
      t16.state.runtime_config_hash,
      "CAP08_S4_RUNTIME_CONFIG_HASH_REQUIRED",
    );
    const configMap = await this.readObjectsV1([configRef]);
    const runtimeConfig = configMap.get(configRef);
    if (!runtimeConfig || runtimeConfig.object_type !== "twin_runtime_config_v1"
      || runtimeConfig.determinism_hash !== configHash) {
      throw new Error("CAP08_S4_RUNTIME_CONFIG_BINDING_MISMATCH");
    }
    const configPayload = structuredClone(runtimeConfig.payload) as unknown as Cap04RuntimeConfigPayloadV1;
    validateCap04RuntimeConfigPayloadV1(configPayload);
    if (configPayload.effective_logical_time !== t16Time) {
      throw new Error("CAP08_S4_RUNTIME_CONFIG_TIME_MISMATCH");
    }

    const baseForecastPayload = structuredClone(
      t16.forecast.payload,
    ) as unknown as Cap04CanonicalCompletedForecastRunPayloadV1;
    validateCap04CanonicalForecastRunPayloadV1(baseForecastPayload);
    if (baseForecastPayload.status !== "COMPLETED") {
      throw new Error("CAP08_S4_BASE_T16_COMPLETED_FORECAST_REQUIRED");
    }

    const late = observationRecordV1({
      evidence: t16.evidence,
      source_record_id: CAP08_S4_LATE_OBSERVATION_ID_V1,
      observed_at: cap08TickLogicalTimeV1(1),
      available_at: t16Time,
    });
    const ordinaryDue = observationRecordV1({
      evidence: t16.evidence,
      source_record_id: CAP08_S4_ORDINARY_DUE_OBSERVATION_ID_V1,
      observed_at: t16Time,
      available_at: t16Time,
    });
    const t16Assimilation = assimilationTraceV1(t16.assimilation);
    if (t16Assimilation.status !== "NOT_APPLIED"
      || t16Assimilation.selected_observation_ref !== null
      || t16Assimilation.applied_observation_refs.length !== 0) {
      throw new Error("CAP08_S4_T16_DYNAMICS_ONLY_BASE_REQUIRED");
    }
    const t01Assimilation = assimilationTraceV1(t01.assimilation);
    const currentMoments = stateMomentsV1(t16.state);
    const quality = qualityWeightV1(late.quality?.status, configPayload);
    const sensorStddev = nonNegativeV1(
      configPayload.observation_assimilation.sensor_measurement_stddev_fraction,
      "CAP08_S4_SENSOR_STDDEV_INVALID",
    );
    const representativenessStddev = nonNegativeV1(
      configPayload.observation_assimilation.point_to_zone_representativeness_stddev_fraction,
      "CAP08_S4_REPRESENTATIVENESS_STDDEV_INVALID",
    );
    const mathInput: Cap08S4LateCorrectionInputV1 = {
      source_mean: t01Assimilation.prior_mean,
      source_variance: t01Assimilation.prior_variance,
      observation_value: finiteV1(
        late.canonical_payload.value,
        "CAP08_S4_LATE_OBSERVATION_VALUE_INVALID",
      ),
      observation_variance: sensorStddev ** 2 + representativenessStddev ** 2,
      quality,
      current_mean: currentMoments.mean,
      current_variance: currentMoments.variance,
      lag_hours: CAP08_S4_LAG_HOURS_V1,
      max_lag_hours: CAP08_S4_LAG_HOURS_V1,
      lambda_per_hour: 0.05,
      epsilon: 0.001,
      a_max: 1.25,
      lower_bound: 0,
      upper_bound: finiteV1(
        configPayload.soil_hydraulic_snapshot.saturation_fraction,
        "CAP08_S4_SATURATION_FRACTION_INVALID",
      ),
      minimum_variance: 0.0001,
      transitions: [],
    };
    mathInput.transitions = this.transitionsV1({
      graph,
      lower_bound: mathInput.lower_bound,
      upper_bound: mathInput.upper_bound,
      minimum_variance: mathInput.minimum_variance,
    });
    const math = calculateCap08S4LateCorrectionV1(mathInput);
    if (math.disposition !== "APPLIED") {
      throw new Error(`CAP08_S4_FORMAL_MATH_REJECTED:${math.disposition}`);
    }
    const mathResult = math as Cap08S4LateCorrectionAppliedV1;

    const manifest = buildCap08S4HistoricalHashManifestV1({
      state_bindings: graph.map(({ state }) => ({
        ref: state.object_id,
        hash: state.determinism_hash,
      })),
      forecast_bindings: graph.map(({ forecast }) => ({
        ref: forecast.object_id,
        hash: forecast.determinism_hash,
      })),
    });
    const tickPayload = objectPayloadV1(t16.tick, "CAP08_S4_T16_TICK_PAYLOAD_REQUIRED");
    const checkpointPayload = objectPayloadV1(
      t16.checkpoint,
      "CAP08_S4_T16_CHECKPOINT_PAYLOAD_REQUIRED",
    );
    if (tickPayload.posterior_state_ref !== t16.state.object_id
      || tickPayload.forecast_result_ref !== t16.forecast.object_id
      || tickPayload.checkpoint_ref !== t16.checkpoint.object_id
      || checkpointPayload.last_completed_tick_ref !== t16.tick.object_id
      || checkpointPayload.last_posterior_state_ref !== t16.state.object_id
      || checkpointPayload.forecast_result_ref !== t16.forecast.object_id) {
      throw new Error("CAP08_S4_T16_BASE_GRAPH_MISMATCH");
    }

    const identityInput = {
      formal_run_id: formalRunId,
      scope: structuredClone(input.scope),
      lineage_id: requiredStringV1(t16.state.lineage_id, "CAP08_S4_LINEAGE_ID_REQUIRED"),
      revision_id: requiredStringV1(t16.state.revision_id, "CAP08_S4_REVISION_ID_REQUIRED"),
      correction_logical_time: t16Time,
      next_logical_time: t17Time,
      base_t16_state: { ref: t16.state.object_id, hash: t16.state.determinism_hash },
      base_t16_forecast: { ref: t16.forecast.object_id, hash: t16.forecast.determinism_hash },
      base_t16_tick: { ref: t16.tick.object_id, hash: t16.tick.determinism_hash },
      base_t16_checkpoint: { ref: t16.checkpoint.object_id, hash: t16.checkpoint.determinism_hash },
      source_t01_state: { ref: t01.state.object_id, hash: t01.state.determinism_hash },
      late_observation: { ref: late.source_record_id, hash: late.source_record_hash },
      ordinary_due_observation: {
        ref: ordinaryDue.source_record_id,
        hash: ordinaryDue.source_record_hash,
      },
      historical_hash_manifest_digest: manifest.manifest_digest,
      phase_engine_contract_digest: CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
      phase_engine_source_digest: phaseSourceDigest,
    };
    deriveCap08S4AppendForwardIdentityV1(identityInput);
    const candidate = buildCap08S4CorrectedCanonicalSetV1({
      identity_input: identityInput,
      created_at: createdAt,
      runtime_config: runtimeConfig,
      execution_config_payload: configPayload,
      base_t16_state: t16.state,
      base_t16_forecast: t16.forecast,
      base_t16_tick: t16.tick,
      base_t16_checkpoint: t16.checkpoint,
      forcing_window: baseForecastPayload.forcing_window_authority,
      math_input: mathInput,
      math_result: mathResult,
      historical_hash_manifest: manifest,
    });
    const persisted = await this.repository.establish({
      ...candidate,
      fault_injection: input.fault_injection,
    });
    const t17Predecessor = await this.resolver.resolve({
      authority_ref: persisted.authority.authority_ref,
      formal_run_id: formalRunId,
      scope: input.scope,
      expected_next_logical_time: t17Time,
    });
    return {
      status: persisted.write_status === "INSERTED_ATOMIC_SET" ? "COMPLETED" : "ALREADY_COMPLETE",
      write_status: persisted.write_status,
      write_delta: persisted.write_delta,
      authority: persisted.authority,
      corrected_set: persisted.corrected_set,
      t17_predecessor: t17Predecessor,
      transport_transition_count: 15,
      historical_state_hash_count: 17,
      historical_forecast_hash_count: 17,
      historical_hashes_unchanged: true,
      latest_pointer_delta: 0,
      residual_count: 0,
      residual_obligations: ["R-01", "R-16"],
      residual_commit_status: "PENDING_S5_C_PROVIDER",
      phase_engine_contract_digest: CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
      phase_engine_source_digest: phaseSourceDigest,
      slice_acceptance_only: true,
      final_formal_run_id: null,
      production_runtime_source_authorized: false,
      s5_authorized: false,
      mcft_cap_09_authorized: false,
    };
  }
}
