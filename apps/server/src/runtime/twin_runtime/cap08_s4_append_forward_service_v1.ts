// Purpose: bind the frozen T16 formal Evidence due set to the persisted S3 transport chain, execute MCFT-CAP-08.S4 late correction, atomically establish the corrected T16 append-forward authority, and resolve T17.
// Boundary: one explicit bounded slice invocation only; no historical rewrite, latest-pointer mutation, Residual commit, Calibration, Shadow, route, scheduler, live ingestion, production Runtime source, or MCFT-CAP-09 authority.

import type { Pool } from "pg";
import {
  buildCap08S2FormalDueObligationV1,
  CAP08_S2_STATE_OBSERVATION_BINDING_ID_V1,
} from "../../domain/twin_runtime/cap08_s2_formal_provider_contracts_v1.js";
import { cap08TickLogicalTimeV1 } from "../../domain/twin_runtime/cap08_phase_engine_contracts_v1.js";
import {
  CAP08_S4_LAG_HOURS_V1,
  CAP08_S4_LATE_OBSERVATION_ID_V1,
  CAP08_S4_ORDINARY_DUE_OBSERVATION_ID_V1,
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
} from "../../domain/twin_runtime/cap08_s4_late_correction_math_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
} from "./ports.js";
import {
  PostgresCap08S4AppendForwardRepositoryV1,
  type EstablishCap08S4AppendForwardResultV1,
} from "../../persistence/twin_runtime/postgres_cap08_s4_append_forward_repository_v1.js";
import { buildCap08S4CorrectedCanonicalSetV1 } from "./cap08_s4_corrected_canonical_set_builder_v1.js";
import { Cap08S4PersistedChainReaderV1 } from "./cap08_s4_persisted_chain_reader_v1.js";
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
  phase_engine_contract_digest: string;
  phase_engine_source_digest: string;
  slice_acceptance_only: true;
  final_formal_run_id: null;
  production_runtime_source_authorized: false;
  s5_authorized: false;
  mcft_cap_09_authorized: false;
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

function exactScopeV1(record: CanonicalReplayEvidenceRecordV1, scope: Cap08S4ScopeV1): boolean {
  return record.tenant_id === scope.tenant_id
    && record.project_id === scope.project_id
    && record.group_id === scope.group_id
    && record.field_id === scope.field_id
    && record.season_id === scope.season_id
    && record.zone_id === scope.zone_id;
}

function exactObservationV1(input: {
  records: readonly CanonicalReplayEvidenceRecordV1[];
  source_record_id: string;
  scope: Cap08S4ScopeV1;
  observed_at: string;
  available_at: string;
}): CanonicalReplayEvidenceRecordV1 {
  const matches = input.records.filter((record) =>
    record.record_type === "soil_moisture_observation_v1"
    && record.source_record_id === input.source_record_id);
  if (matches.length !== 1) throw new Error(`CAP08_S4_OBSERVATION_CARDINALITY:${input.source_record_id}`);
  const record = structuredClone(matches[0]);
  if (!exactScopeV1(record, input.scope)
    || record.binding_id !== CAP08_S2_STATE_OBSERVATION_BINDING_ID_V1
    || record.role_time?.observed_at !== input.observed_at
    || record.role_time?.ingested_at !== input.available_at
    || record.available_to_runtime_at !== input.available_at
    || record.canonical_unit !== "fraction"
    || typeof record.source_record_hash !== "string"
    || !/^sha256:[0-9a-f]{64}$/.test(record.source_record_hash)) {
    throw new Error(`CAP08_S4_OBSERVATION_FORMAL_BINDING_MISMATCH:${input.source_record_id}`);
  }
  return record;
}

function qualityWeightV1(quality: unknown, weights: Readonly<{ PASS: number; LIMITED: number; FAIL: 0 }>): number {
  if (quality !== "PASS" && quality !== "LIMITED") throw new Error("CAP08_S4_LATE_OBSERVATION_QUALITY_UNUSABLE");
  const value = finiteV1(weights[quality], "CAP08_S4_LATE_OBSERVATION_QUALITY_WEIGHT_INVALID");
  if (!(value > 0 && value <= 1)) throw new Error("CAP08_S4_LATE_OBSERVATION_QUALITY_WEIGHT_INVALID");
  return value;
}

export class Cap08S4AppendForwardServiceV1 {
  private readonly chainReader: Cap08S4PersistedChainReaderV1;
  private readonly repository: PostgresCap08S4AppendForwardRepositoryV1;
  private readonly resolver: Cap08S4T17CorrectedPredecessorResolverV1;

  constructor(
    pool: Pool,
    private readonly evidenceSource: ReplayEvidenceSourcePortV1,
  ) {
    this.chainReader = new Cap08S4PersistedChainReaderV1(pool);
    this.repository = new PostgresCap08S4AppendForwardRepositoryV1(pool);
    this.resolver = new Cap08S4T17CorrectedPredecessorResolverV1(pool);
  }

  async execute(input: ExecuteCap08S4AppendForwardInputV1): Promise<ExecuteCap08S4AppendForwardResultV1> {
    const formalRunId = requiredStringV1(input.formal_run_id, "CAP08_S4_FORMAL_RUN_ID_REQUIRED");
    const createdAt = canonicalIsoV1(input.created_at, "CAP08_S4_CREATED_AT_INVALID");
    const phaseSourceDigest = digestV1(input.phase_engine_source_digest, "CAP08_S4_PHASE_SOURCE_DIGEST_INVALID");
    const context = await this.chainReader.read({
      formal_run_id: formalRunId,
      scope: input.scope,
      phase_engine_source_digest: phaseSourceDigest,
    });
    const t16Time = cap08TickLogicalTimeV1(16);
    const t17Time = cap08TickLogicalTimeV1(17);
    const due = buildCap08S2FormalDueObligationV1(t16Time);
    if (JSON.stringify(due.due_fvo_ids) !== JSON.stringify(["FVO-01", "FVO-16"])
      || JSON.stringify(due.due_residual_ids) !== JSON.stringify(["R-01", "R-16"])
      || JSON.stringify(due.late_state_correction_observation_ids) !== JSON.stringify(["FVO-01"])
      || JSON.stringify(due.residual_only_observation_ids) !== JSON.stringify(["FVO-16"])
      || due.selected_state_observation_ids.length !== 0) {
      throw new Error("CAP08_S4_T16_DUE_OBLIGATION_MISMATCH");
    }

    const records = structuredClone(await this.evidenceSource.loadCandidateRecords({
      scope: input.scope,
      logical_time: t16Time,
    }));
    const observationIds = records
      .filter((record) => record.record_type === "soil_moisture_observation_v1")
      .map((record) => record.source_record_id)
      .sort();
    if (JSON.stringify(observationIds) !== JSON.stringify(due.due_fvo_ids)) {
      throw new Error("CAP08_S4_FORMAL_EVIDENCE_DUE_SET_MISMATCH");
    }
    const late = exactObservationV1({
      records,
      source_record_id: CAP08_S4_LATE_OBSERVATION_ID_V1,
      scope: input.scope,
      observed_at: cap08TickLogicalTimeV1(1),
      available_at: t16Time,
    });
    const ordinaryDue = exactObservationV1({
      records,
      source_record_id: CAP08_S4_ORDINARY_DUE_OBSERVATION_ID_V1,
      scope: input.scope,
      observed_at: t16Time,
      available_at: t16Time,
    });

    const config = context.execution_config_payload;
    const sensorStddev = nonNegativeV1(
      config.observation_assimilation.sensor_measurement_stddev_fraction,
      "CAP08_S4_SENSOR_STDDEV_INVALID",
    );
    const representativenessStddev = nonNegativeV1(
      config.observation_assimilation.point_to_zone_representativeness_stddev_fraction,
      "CAP08_S4_REPRESENTATIVENESS_STDDEV_INVALID",
    );
    const mathInput: Cap08S4LateCorrectionInputV1 = {
      source_mean: context.source_t01_prior_mean,
      source_variance: context.source_t01_prior_variance,
      observation_value: finiteV1(late.canonical_payload.value, "CAP08_S4_LATE_OBSERVATION_VALUE_INVALID"),
      observation_variance: sensorStddev ** 2 + representativenessStddev ** 2,
      quality: qualityWeightV1(late.quality?.status, config.observation_assimilation.quality_weights),
      current_mean: context.current_t16_mean,
      current_variance: context.current_t16_variance,
      lag_hours: CAP08_S4_LAG_HOURS_V1,
      max_lag_hours: CAP08_S4_LAG_HOURS_V1,
      lambda_per_hour: 0.05,
      epsilon: 0.001,
      a_max: 1.25,
      lower_bound: 0,
      upper_bound: finiteV1(config.soil_hydraulic_snapshot.saturation_fraction, "CAP08_S4_SATURATION_INVALID"),
      minimum_variance: 0.0001,
      transitions: structuredClone(context.transitions),
    };
    const math = calculateCap08S4LateCorrectionV1(mathInput);
    if (math.disposition !== "APPLIED") throw new Error(`CAP08_S4_FORMAL_MATH_REJECTED:${math.disposition}`);
    const mathResult = math as Cap08S4LateCorrectionAppliedV1;

    const identityInput = {
      formal_run_id: formalRunId,
      scope: structuredClone(input.scope),
      lineage_id: context.lineage_id,
      revision_id: context.revision_id,
      correction_logical_time: t16Time,
      next_logical_time: t17Time,
      base_t16_state: { ref: context.base_t16_state.object_id, hash: context.base_t16_state.determinism_hash },
      base_t16_forecast: { ref: context.base_t16_forecast.object_id, hash: context.base_t16_forecast.determinism_hash },
      base_t16_tick: { ref: context.base_t16_tick.object_id, hash: context.base_t16_tick.determinism_hash },
      base_t16_checkpoint: { ref: context.base_t16_checkpoint.object_id, hash: context.base_t16_checkpoint.determinism_hash },
      source_t01_state: { ref: context.source_t01_state.object_id, hash: context.source_t01_state.determinism_hash },
      late_observation: { ref: late.source_record_id, hash: late.source_record_hash },
      ordinary_due_observation: { ref: ordinaryDue.source_record_id, hash: ordinaryDue.source_record_hash },
      historical_hash_manifest_digest: context.historical_hash_manifest.manifest_digest,
      phase_engine_contract_digest: context.phase_engine_contract_digest,
      phase_engine_source_digest: phaseSourceDigest,
    };
    deriveCap08S4AppendForwardIdentityV1(identityInput);
    const candidate = buildCap08S4CorrectedCanonicalSetV1({
      identity_input: identityInput,
      created_at: createdAt,
      runtime_config: context.runtime_config,
      execution_config_payload: config,
      base_t16_state: context.base_t16_state,
      base_t16_forecast: context.base_t16_forecast,
      base_t16_tick: context.base_t16_tick,
      base_t16_checkpoint: context.base_t16_checkpoint,
      forcing_window: context.forcing_window,
      math_input: mathInput,
      math_result: mathResult,
      historical_hash_manifest: context.historical_hash_manifest,
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
      phase_engine_contract_digest: context.phase_engine_contract_digest,
      phase_engine_source_digest: phaseSourceDigest,
      slice_acceptance_only: true,
      final_formal_run_id: null,
      production_runtime_source_authorized: false,
      s5_authorized: false,
      mcft_cap_09_authorized: false,
    };
  }
}
