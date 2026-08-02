// Purpose: persist the MCFT-CAP-08 S4 corrected-T16 -> T17 authority-bound A1 transition atomically.
// Boundary: dedicated T17 protocol only; generic CAP-04 persistence, ordinary Tick semantics, routes and schedulers remain unchanged.

import type { Pool, PoolClient } from "pg";
import { canonicalJsonV1 } from "../../domain/twin_runtime/canonical_json_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  CAP08_S4_AUTHORITY_KIND_V1,
  CAP08_S4_AUTHORITY_SCHEMA_VERSION_V1,
  validateCap08S4AppendForwardAuthorityV1,
  type Cap08S4AppendForwardAuthorityV1,
  type Cap08S4CorrectedCanonicalSetV1,
} from "../../domain/twin_runtime/cap08_s4_append_forward_contracts_v1.js";
import {
  CAP08_S4_T17_SERIALIZATION_RETRY_POLICY_V1,
  classifyCap08S4T17ExistingTransitionV1,
  type Cap08S4T17ExpectedLatestBaseV1,
  type Cap08S4T17TransitionWitnessV1,
} from "../../domain/twin_runtime/cap08_t17_transition_contracts_v1.js";
import {
  cap08S4T17TransitionWitnessFactIdV1,
  deriveCap08S4T17TransitionWitnessV1,
} from "../../domain/twin_runtime/cap08_t17_transition_witness_identity_v1.js";
import {
  CAP04_A1_OPERATION_VARIANT_V1,
  type Cap04ForecastRunPayloadV1,
  type Cap04ScenarioSetEnvelopeV1,
} from "../../domain/twin_runtime/forecast_scenario_contracts_v1.js";
import type { Cap04ARecordSetV1 } from "../../domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import { validateCap04ARecordSetV1 } from "../../domain/twin_runtime/forecast_scenario_record_set_validator_v1.js";
import { buildCap04ForecastProjectionRowsV1 } from "../../projections/twin_runtime/forecast_scenario_projection_rebuilder_v1.js";
import type {
  CommitCap08S4T17A1TransitionInputV1,
  CommitCap08S4T17A1TransitionResultV1,
  Cap08S4T17TransitionPersistencePortV1,
} from "../../runtime/twin_runtime/cap08_t17_transition_persistence_port_v1.js";
import type { TwinScopeKeyV1 } from "../../runtime/twin_runtime/ports.js";

const FACT_SOURCE_V1 = "mcft_cap08_s4_t17_transition_v1";
type PersistedCanonicalV1 = CanonicalObjectEnvelopeV1 | Cap04ScenarioSetEnvelopeV1;

function scopeValuesV1(scope: TwinScopeKeyV1): unknown[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}

function sameScopeV1(scope: TwinScopeKeyV1, value: Record<string, unknown>, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (value[field] !== scope[field]) throw new Error(`${code}:${field}`);
  }
}

function jsonObjectV1(value: unknown, code: string): Record<string, unknown> {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(code);
  return parsed as Record<string, unknown>;
}

function canonicalFactIdV1(objectId: string): string { return `fact_${objectId}`; }
function canonicalRecordJsonV1(object: PersistedCanonicalV1): string {
  return JSON.stringify({ type: object.object_type, payload: object });
}
function witnessRecordJsonV1(witness: Cap08S4T17TransitionWitnessV1): string {
  return JSON.stringify({ type: witness.schema_version, payload: witness });
}
function parseCanonicalFactV1(value: unknown): PersistedCanonicalV1 {
  const record = jsonObjectV1(value, "CAP08_S4_T17_FACT_RECORD_INVALID");
  const payload = jsonObjectV1(record.payload, "CAP08_S4_T17_FACT_PAYLOAD_REQUIRED") as unknown as PersistedCanonicalV1;
  if (record.type !== payload.object_type) throw new Error("CAP08_S4_T17_FACT_TYPE_MISMATCH");
  return payload;
}
function requireMemberV1(recordSet: Cap04ARecordSetV1, objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP08_S4_T17_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}
function committedBindingsV1(recordSet: Cap04ARecordSetV1) {
  const state = requireMemberV1(recordSet, "twin_state_estimate_v1");
  const checkpoint = requireMemberV1(recordSet, "twin_runtime_checkpoint_v1");
  const forecast = requireMemberV1(recordSet, "twin_forecast_run_v1");
  return {
    record_set_id: recordSet.record_set_id,
    aggregate_determinism_hash: recordSet.aggregate_determinism_hash,
    state: { ref: state.object_id, hash: state.determinism_hash },
    checkpoint: { ref: checkpoint.object_id, hash: checkpoint.determinism_hash },
    forecast_result: { ref: forecast.object_id, hash: forecast.determinism_hash },
    successful_forecast: { ref: forecast.object_id, hash: forecast.determinism_hash },
  };
}

function validateTransitionInputV1(input: CommitCap08S4T17A1TransitionInputV1): void {
  validateCap04ARecordSetV1(input.record_set);
  sameScopeV1(input.scope, input.record_set.operation_key.scope as unknown as Record<string, unknown>, "CAP08_S4_T17_SCOPE_MISMATCH");
  if (input.record_set.operation_key.operation_variant !== CAP04_A1_OPERATION_VARIANT_V1) {
    throw new Error("FORMAL_DATASET_INVARIANT_VIOLATION");
  }
  if (input.record_set.operation_key.logical_time !== input.transition_witness.uniqueness_key.t17_logical_time
    || input.formal_run_id !== input.transition_witness.uniqueness_key.formal_run_id) {
    throw new Error("CAP08_S4_T17_TRANSITION_IDENTITY_MISMATCH");
  }
  const aggregate = input.record_set.aggregate_identity_input;
  const corrected = input.corrected_computation_predecessor;
  if (aggregate.previous_posterior_ref !== corrected.state.ref
    || aggregate.previous_posterior_hash !== corrected.state.hash
    || aggregate.previous_checkpoint_ref !== corrected.checkpoint.ref
    || aggregate.previous_checkpoint_hash !== corrected.checkpoint.hash
    || aggregate.previous_forecast_result_ref !== corrected.forecast_result.ref
    || aggregate.previous_forecast_result_hash !== corrected.forecast_result.hash) {
    throw new Error("CAP08_S4_T17_RECORD_IDENTITY_NOT_CORRECTED_PREDECESSOR");
  }
  const checkpoint = requireMemberV1(input.record_set, "twin_runtime_checkpoint_v1");
  if (checkpoint.payload.successful_forecast_ref !== committedBindingsV1(input.record_set).forecast_result.ref) {
    throw new Error("CAP08_S4_T17_A1_CHECKPOINT_SUCCESSFUL_FORECAST_MISMATCH");
  }
  const expectedWitness = deriveCap08S4T17TransitionWitnessV1({
    uniqueness_key: input.transition_witness.uniqueness_key,
    correction_authority: input.correction_authority,
    expected_latest_base: input.expected_latest_base,
    corrected_computation_predecessor: input.corrected_computation_predecessor,
    committed_t17: committedBindingsV1(input.record_set),
  });
  if (canonicalJsonV1(expectedWitness) !== canonicalJsonV1(input.transition_witness)) {
    throw new Error("CAP08_S4_T17_WITNESS_INPUT_MISMATCH");
  }
}

async function readCanonicalFactsV1(client: PoolClient, objectIds: readonly string[]): Promise<Map<string, PersistedCanonicalV1>> {
  const ids = [...new Set(objectIds)];
  if (ids.length === 0) return new Map();
  const result = await client.query(
    `SELECT record_json FROM facts WHERE record_json->'payload'->>'object_id'=ANY($1::text[]) ORDER BY fact_id`,
    [ids],
  );
  const byId = new Map<string, PersistedCanonicalV1>();
  for (const row of result.rows) {
    const object = parseCanonicalFactV1(row.record_json);
    if (byId.has(object.object_id)) throw new Error("CAP08_S4_T17_CANONICAL_OBJECT_ID_NOT_UNIQUE");
    byId.set(object.object_id, object);
  }
  return byId;
}

async function verifyBindingsV1(client: PoolClient, bindings: readonly { ref: string; hash: string }[], missingCode: string, mismatchCode: string): Promise<void> {
  const facts = await readCanonicalFactsV1(client, bindings.map((binding) => binding.ref));
  if (facts.size !== new Set(bindings.map((binding) => binding.ref)).size) throw new Error(missingCode);
  for (const binding of bindings) {
    if (facts.get(binding.ref)?.determinism_hash !== binding.hash) throw new Error(mismatchCode);
  }
}

async function readS4AuthorityV1(client: PoolClient, authorityRef: string): Promise<{ authority: Cap08S4AppendForwardAuthorityV1; correctedSet: Cap08S4CorrectedCanonicalSetV1 }> {
  const result = await client.query(
    `SELECT determinism_hash,semantic_payload FROM twin_runtime_authority_snapshot_v1 WHERE authority_kind=$1 AND authority_ref=$2`,
    [CAP08_S4_AUTHORITY_KIND_V1, authorityRef],
  );
  if (result.rows.length !== 1) throw new Error("CAP08_S4_T17_AUTHORITY_CARDINALITY");
  const authority = structuredClone(jsonObjectV1(result.rows[0].semantic_payload, "CAP08_S4_T17_AUTHORITY_PAYLOAD_INVALID")) as unknown as Cap08S4AppendForwardAuthorityV1;
  if (authority.schema_version !== CAP08_S4_AUTHORITY_SCHEMA_VERSION_V1 || authority.determinism_hash !== result.rows[0].determinism_hash) {
    throw new Error("CAP08_S4_T17_AUTHORITY_HASH_MISMATCH");
  }
  const bindings = authority.corrected_objects;
  const facts = await readCanonicalFactsV1(client, [bindings.state.ref, bindings.forecast.ref, bindings.scenario.ref, bindings.tick.ref, bindings.checkpoint.ref]);
  const exact = <T extends PersistedCanonicalV1>(binding: { ref: string; hash: string }, type: string, code: string): T => {
    const object = facts.get(binding.ref);
    if (!object || object.object_type !== type || object.determinism_hash !== binding.hash) throw new Error(code);
    return object as T;
  };
  const correctedSet: Cap08S4CorrectedCanonicalSetV1 = {
    state: exact(bindings.state, "twin_state_estimate_v1", "CAP08_S4_T17_CORRECTED_STATE_INVALID"),
    forecast: exact(bindings.forecast, "twin_forecast_run_v1", "CAP08_S4_T17_CORRECTED_FORECAST_INVALID"),
    scenario: exact(bindings.scenario, "twin_scenario_set_v1", "CAP08_S4_T17_CORRECTED_SCENARIO_INVALID"),
    tick: exact(bindings.tick, "twin_runtime_tick_v1", "CAP08_S4_T17_CORRECTED_TICK_INVALID"),
    checkpoint: exact(bindings.checkpoint, "twin_runtime_checkpoint_v1", "CAP08_S4_T17_CORRECTED_CHECKPOINT_INVALID"),
  };
  validateCap08S4AppendForwardAuthorityV1({ authority, corrected_set: correctedSet });
  return { authority, correctedSet };
}

function assertAuthorityContextV1(input: CommitCap08S4T17A1TransitionInputV1, authority: Cap08S4AppendForwardAuthorityV1): void {
  sameScopeV1(input.scope, authority.scope as unknown as Record<string, unknown>, "CAP08_S4_T17_AUTHORITY_SCOPE_MISMATCH");
  if (authority.formal_run_id !== input.formal_run_id
    || authority.authority_ref !== input.correction_authority.authority_ref
    || authority.determinism_hash !== input.correction_authority.authority_hash
    || authority.lineage_id !== input.record_set.operation_key.lineage_id
    || authority.revision_id !== input.record_set.operation_key.revision_id
    || authority.next_logical_time !== input.record_set.operation_key.logical_time) {
    throw new Error("CAP08_S4_T17_AUTHORITY_CONTEXT_MISMATCH");
  }
  const base = input.expected_latest_base;
  if (authority.identity_input.base_t16_state.ref !== base.state.ref
    || authority.identity_input.base_t16_state.hash !== base.state.hash
    || authority.identity_input.base_t16_checkpoint.ref !== base.checkpoint.ref
    || authority.identity_input.base_t16_checkpoint.hash !== base.checkpoint.hash
    || authority.identity_input.base_t16_forecast.ref !== base.forecast_result.ref
    || authority.identity_input.base_t16_forecast.hash !== base.forecast_result.hash) {
    throw new Error("CAP08_S4_T17_AUTHORITY_BASE_BINDING_MISMATCH");
  }
  const corrected = input.corrected_computation_predecessor;
  if (authority.corrected_objects.state.ref !== corrected.state.ref
    || authority.corrected_objects.state.hash !== corrected.state.hash
    || authority.corrected_objects.checkpoint.ref !== corrected.checkpoint.ref
    || authority.corrected_objects.checkpoint.hash !== corrected.checkpoint.hash
    || authority.corrected_objects.forecast.ref !== corrected.forecast_result.ref
    || authority.corrected_objects.forecast.hash !== corrected.forecast_result.hash
    || authority.corrected_objects.scenario.ref !== corrected.scenario_set.ref
    || authority.corrected_objects.scenario.hash !== corrected.scenario_set.hash
    || authority.t17_predecessor.previous_tick_sequence !== corrected.previous_tick_sequence) {
    throw new Error("CAP08_S4_T17_AUTHORITY_CORRECTED_BINDING_MISMATCH");
  }
}

async function verifyLeaseV1(client: PoolClient, input: CommitCap08S4T17A1TransitionInputV1): Promise<void> {
  sameScopeV1(input.scope, input.lease as unknown as Record<string, unknown>, "CAP08_S4_T17_LEASE_SCOPE_MISMATCH");
  const result = await client.query(
    `SELECT lease_owner,fencing_token,expires_at>transaction_timestamp() AS valid FROM twin_runtime_lease_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 FOR UPDATE`,
    scopeValuesV1(input.scope),
  );
  if (result.rows.length !== 1 || result.rows[0].lease_owner !== input.lease.lease_owner) throw new Error("LEASE_OWNER_MISMATCH");
  if (BigInt(result.rows[0].fencing_token) !== input.lease.fencing_token) throw new Error("STALE_FENCING_TOKEN");
  if (result.rows[0].valid !== true) throw new Error("LEASE_EXPIRED");
}

async function readLatestBaseWithClientV1(client: PoolClient, scope: TwinScopeKeyV1, lock: boolean): Promise<Cap08S4T17ExpectedLatestBaseV1> {
  const suffix = lock ? " FOR UPDATE" : "";
  const values = scopeValuesV1(scope);
  const state = await client.query(`SELECT state_object_id AS ref,determinism_hash AS hash FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6${suffix}`, values);
  const checkpoint = await client.query(`SELECT checkpoint_object_id AS ref,determinism_hash AS hash FROM twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6${suffix}`, values);
  const forecast = await client.query(`SELECT forecast_object_id AS ref,determinism_hash AS hash FROM twin_forecast_result_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6${suffix}`, values);
  const success = await client.query(`SELECT forecast_object_id AS ref,determinism_hash AS hash FROM twin_forecast_success_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6${suffix}`, values);
  if ([state, checkpoint, forecast, success].some((result) => result.rows.length !== 1)) throw new Error("CAP08_S4_T17_LATEST_POINTER_CARDINALITY");
  return { state: state.rows[0], checkpoint: checkpoint.rows[0], forecast_result: forecast.rows[0], successful_forecast: success.rows[0] };
}
function sameBindingV1(left: { ref: string; hash: string }, right: { ref: string; hash: string }): boolean {
  return left.ref === right.ref && left.hash === right.hash;
}
async function verifyBaseLatestV1(client: PoolClient, input: CommitCap08S4T17A1TransitionInputV1): Promise<void> {
  const actual = await readLatestBaseWithClientV1(client, input.scope, true);
  if (!sameBindingV1(actual.state, input.expected_latest_base.state)) throw new Error("STATE_LATEST_CAS_CONFLICT");
  if (!sameBindingV1(actual.checkpoint, input.expected_latest_base.checkpoint)) throw new Error("CHECKPOINT_CAS_CONFLICT");
  if (!sameBindingV1(actual.forecast_result, input.expected_latest_base.forecast_result)) throw new Error("FORECAST_RESULT_CAS_CONFLICT");
  if (!sameBindingV1(actual.successful_forecast, input.expected_latest_base.successful_forecast)) throw new Error("FORECAST_SUCCESS_CAS_CONFLICT");
}

async function readGenericRecordGuardV1(client: PoolClient, input: CommitCap08S4T17A1TransitionInputV1) {
  const result = await client.query(`SELECT record_set_id,determinism_hash FROM twin_object_idempotency_index_v1 WHERE identity_kind='A1_RECORD_SET' AND idempotency_key=$1`, [input.record_set.idempotency_key]);
  if (result.rows.length === 0) return { presence: "ABSENT" as const };
  if (result.rows.length !== 1 || result.rows[0].record_set_id !== input.record_set.record_set_id || result.rows[0].determinism_hash !== input.record_set.aggregate_determinism_hash) return { presence: "CONFLICT" as const };
  const facts = await readCanonicalFactsV1(client, input.record_set.members.map((member) => member.object_id));
  if (facts.size !== input.record_set.members.length || input.record_set.members.some((member) => facts.get(member.object_id)?.determinism_hash !== member.determinism_hash)) return { presence: "CONFLICT" as const };
  return { presence: "EXACT" as const };
}
async function readWitnessPresenceV1(client: PoolClient, witness: Cap08S4T17TransitionWitnessV1) {
  const result = await client.query("SELECT record_json FROM facts WHERE fact_id=$1", [cap08S4T17TransitionWitnessFactIdV1(witness)]);
  if (result.rows.length === 0) return { presence: "ABSENT" as const };
  if (result.rows.length !== 1) return { presence: "CONFLICT" as const };
  const record = jsonObjectV1(result.rows[0].record_json, "CAP08_S4_T17_WITNESS_FACT_INVALID");
  return record.type === witness.schema_version && canonicalJsonV1(record.payload) === canonicalJsonV1(witness) ? { presence: "EXACT" as const } : { presence: "CONFLICT" as const };
}
function exactTransitionGuardV1(row: Record<string, unknown>, witness: Cap08S4T17TransitionWitnessV1): boolean {
  return row.transition_id === witness.transition_id && row.idempotency_key === witness.idempotency_key
    && row.uniqueness_key_hash === witness.uniqueness_key_hash && row.record_set_id === witness.committed_t17.record_set_id
    && row.record_set_determinism_hash === witness.committed_t17.aggregate_determinism_hash
    && row.witness_fact_id === cap08S4T17TransitionWitnessFactIdV1(witness)
    && row.witness_determinism_hash === witness.determinism_hash
    && row.correction_authority_ref === witness.correction_authority.authority_ref
    && row.correction_authority_hash === witness.correction_authority.authority_hash
    && canonicalJsonV1(row.expected_latest_base) === canonicalJsonV1(witness.expected_latest_base)
    && canonicalJsonV1(row.corrected_computation_predecessor) === canonicalJsonV1(witness.corrected_computation_predecessor)
    && canonicalJsonV1(row.committed_t17) === canonicalJsonV1(witness.committed_t17);
}
async function readTransitionGuardPresenceV1(client: PoolClient, witness: Cap08S4T17TransitionWitnessV1) {
  const result = await client.query(`SELECT transition_id,idempotency_key,uniqueness_key_hash,record_set_id,record_set_determinism_hash,witness_fact_id,witness_determinism_hash,correction_authority_ref,correction_authority_hash,expected_latest_base,corrected_computation_predecessor,committed_t17 FROM twin_cap08_s4_t17_transition_guard_v1 WHERE idempotency_key=$1`, [witness.idempotency_key]);
  if (result.rows.length === 0) return { presence: "ABSENT" as const };
  if (result.rows.length !== 1 || !exactTransitionGuardV1(result.rows[0], witness)) return { presence: "CONFLICT" as const };
  return { presence: "EXACT" as const };
}
async function latestProjectionStateV1(client: PoolClient, input: CommitCap08S4T17A1TransitionInputV1): Promise<"BASE_T16" | "EXACT_T17" | "OTHER"> {
  const latest = await readLatestBaseWithClientV1(client, input.scope, false);
  const committed = input.transition_witness.committed_t17;
  if (sameBindingV1(latest.state, committed.state) && sameBindingV1(latest.checkpoint, committed.checkpoint) && sameBindingV1(latest.forecast_result, committed.forecast_result) && sameBindingV1(latest.successful_forecast, committed.successful_forecast)) return "EXACT_T17";
  if (sameBindingV1(latest.state, input.expected_latest_base.state) && sameBindingV1(latest.checkpoint, input.expected_latest_base.checkpoint) && sameBindingV1(latest.forecast_result, input.expected_latest_base.forecast_result) && sameBindingV1(latest.successful_forecast, input.expected_latest_base.successful_forecast)) return "BASE_T16";
  return "OTHER";
}
async function classifyExistingV1(client: PoolClient, input: CommitCap08S4T17A1TransitionInputV1) {
  const record = await readGenericRecordGuardV1(client, input);
  const witness = await readWitnessPresenceV1(client, input.transition_witness);
  const guard = await readTransitionGuardPresenceV1(client, input.transition_witness);
  const latest = await latestProjectionStateV1(client, input);
  return classifyCap08S4T17ExistingTransitionV1({ record_set_presence: record.presence, witness_presence: witness.presence, transition_guard_presence: guard.presence, latest_projection_state: latest });
}

async function insertForecastProjectionRowsV1(client: PoolClient, recordSet: Cap04ARecordSetV1, factIds: Record<string, string>): Promise<void> {
  const forecast = requireMemberV1(recordSet, "twin_forecast_run_v1");
  const rows = buildCap04ForecastProjectionRowsV1(forecast, factIds[forecast.object_id]);
  const run = rows.run;
  await client.query(`INSERT INTO twin_forecast_run_projection_v1 (forecast_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,logical_time,forecast_status,source_posterior_ref,source_posterior_hash,runtime_config_ref,runtime_config_hash,forcing_window_hash,point_count,determinism_hash,canonical_payload,source_fact_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20)`, [run.forecast_object_id,run.tenant_id,run.project_id,run.group_id,run.field_id,run.season_id,run.zone_id,run.lineage_id,run.revision_id,run.logical_time,run.forecast_status,run.source_posterior_ref,run.source_posterior_hash,run.runtime_config_ref,run.runtime_config_hash,run.forcing_window_hash,run.point_count,run.determinism_hash,JSON.stringify(run.canonical_payload),run.source_fact_id]);
  for (const point of rows.points) await client.query(`INSERT INTO twin_forecast_point_projection_v1 (forecast_object_id,horizon_hour,target_time,storage_mean_mm,storage_variance_mm2,available_water_fraction,determinism_hash,canonical_point) VALUES ($1,$2,$3::timestamptz,$4,$5,$6,$7,$8::jsonb)`, [point.forecast_object_id,point.horizon_hour,point.target_time,point.storage_mean_mm,point.storage_variance_mm2,point.available_water_fraction,point.determinism_hash,JSON.stringify(point.canonical_point)]);
}

async function insertFirstTransitionV1(client: PoolClient, input: CommitCap08S4T17A1TransitionInputV1): Promise<void> {
  const inject = (stage: Parameters<NonNullable<typeof input.fault_injection>>[0]) => input.fault_injection?.(stage);
  await verifyLeaseV1(client, input);
  await verifyBaseLatestV1(client, input);
  inject("after_base_pointer_validation");
  const { authority } = await readS4AuthorityV1(client, input.correction_authority.authority_ref);
  assertAuthorityContextV1(input, authority);
  inject("after_authority_validation");
  await verifyBindingsV1(client, [input.expected_latest_base.state,input.expected_latest_base.checkpoint,input.expected_latest_base.forecast_result,input.expected_latest_base.successful_forecast,input.corrected_computation_predecessor.state,input.corrected_computation_predecessor.checkpoint,input.corrected_computation_predecessor.forecast_result,input.corrected_computation_predecessor.successful_forecast,input.corrected_computation_predecessor.scenario_set], "CAP08_S4_T17_BOUND_OBJECT_MISSING", "CAP08_S4_T17_BOUND_OBJECT_HASH_MISMATCH");
  inject("after_corrected_predecessor_validation");
  const recordSet = input.record_set;
  await client.query(`INSERT INTO twin_object_idempotency_index_v1 (identity_kind,idempotency_key,record_set_id,determinism_hash,identity_basis,member_object_ids,member_determinism_hashes) VALUES ('A1_RECORD_SET',$1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)`, [recordSet.idempotency_key,recordSet.record_set_id,recordSet.aggregate_determinism_hash,JSON.stringify({record_set_contract_id:recordSet.record_set_contract_id,terminal_tick_uniqueness_key:recordSet.terminal_tick_uniqueness_key,terminal_tick_uniqueness_key_hash:recordSet.terminal_tick_uniqueness_key_hash,operation_key:recordSet.operation_key,operation_key_hash:recordSet.operation_key_hash,aggregate_identity_input:recordSet.aggregate_identity_input}),JSON.stringify(recordSet.member_object_ids),JSON.stringify(Object.fromEntries(recordSet.members.map((member)=>[member.object_id,member.determinism_hash])))]);
  const tick = requireMemberV1(recordSet, "twin_runtime_tick_v1");
  await client.query(`INSERT INTO twin_terminal_tick_uniqueness_v1 (tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,logical_time,terminal_tick_uniqueness_key_hash,operation_variant,record_set_id,aggregate_determinism_hash,source_tick_object_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10,$11,$12,$13,$14)`, [...scopeValuesV1(input.scope),recordSet.operation_key.lineage_id,recordSet.operation_key.revision_id,recordSet.operation_key.logical_time,recordSet.terminal_tick_uniqueness_key_hash,recordSet.operation_key.operation_variant,recordSet.record_set_id,recordSet.aggregate_determinism_hash,tick.object_id]);
  const factIds: Record<string,string> = {};
  for (const member of recordSet.members) { const id=canonicalFactIdV1(member.object_id); factIds[member.object_id]=id; await client.query("INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,$3,$4::jsonb)",[id,member.logical_time,FACT_SOURCE_V1,canonicalRecordJsonV1(member)]); }
  inject("after_t17_facts"); inject("after_record_set_guard");
  const witness=input.transition_witness; const witnessFactId=cap08S4T17TransitionWitnessFactIdV1(witness);
  await client.query("INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,$3,$4::jsonb)",[witnessFactId,witness.uniqueness_key.t17_logical_time,FACT_SOURCE_V1,witnessRecordJsonV1(witness)]);
  inject("after_transition_witness_fact");
  await client.query(`INSERT INTO twin_cap08_s4_t17_transition_guard_v1 (transition_id,idempotency_key,uniqueness_key_hash,formal_run_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,t17_logical_time,correction_authority_ref,correction_authority_hash,record_set_id,record_set_determinism_hash,witness_fact_id,witness_determinism_hash,expected_latest_base,corrected_computation_predecessor,committed_t17) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::timestamptz,$14,$15,$16,$17,$18,$19,$20::jsonb,$21::jsonb,$22::jsonb)`, [witness.transition_id,witness.idempotency_key,witness.uniqueness_key_hash,witness.uniqueness_key.formal_run_id,...scopeValuesV1(input.scope),witness.uniqueness_key.lineage_id,witness.uniqueness_key.revision_id,witness.uniqueness_key.t17_logical_time,witness.correction_authority.authority_ref,witness.correction_authority.authority_hash,witness.committed_t17.record_set_id,witness.committed_t17.aggregate_determinism_hash,witnessFactId,witness.determinism_hash,JSON.stringify(witness.expected_latest_base),JSON.stringify(witness.corrected_computation_predecessor),JSON.stringify(witness.committed_t17)]);
  inject("after_transition_guard");
  const state=requireMemberV1(recordSet,"twin_state_estimate_v1"), checkpoint=requireMemberV1(recordSet,"twin_runtime_checkpoint_v1"), forecast=requireMemberV1(recordSet,"twin_forecast_run_v1"), health=requireMemberV1(recordSet,"twin_runtime_health_v1");
  const forecastPayload=forecast.payload as unknown as Cap04ForecastRunPayloadV1;
  await client.query(`INSERT INTO twin_state_history_projection_v1 (state_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,logical_time,determinism_hash,canonical_payload,source_fact_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12::jsonb,$13)`,[state.object_id,...scopeValuesV1(input.scope),state.lineage_id,state.revision_id,state.logical_time,state.determinism_hash,JSON.stringify(state.payload),factIds[state.object_id]]);
  const update=async(sql:string,values:unknown[],code:string)=>{const result=await client.query(sql,values);if(result.rowCount!==1)throw new Error(code);};
  await update(`UPDATE twin_state_latest_index_v1 SET state_object_id=$7,lineage_id=$8,revision_id=$9,logical_time=$10::timestamptz,determinism_hash=$11,source_fact_id=$12 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND state_object_id=$13 AND determinism_hash=$14`,[...scopeValuesV1(input.scope),state.object_id,state.lineage_id,state.revision_id,state.logical_time,state.determinism_hash,factIds[state.object_id],input.expected_latest_base.state.ref,input.expected_latest_base.state.hash],"STATE_LATEST_CAS_CONFLICT"); inject("after_state_latest");
  await update(`UPDATE twin_runtime_checkpoint_latest_index_v1 SET checkpoint_object_id=$7,lineage_id=$8,revision_id=$9,logical_time=$10::timestamptz,determinism_hash=$11,source_fact_id=$12 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND checkpoint_object_id=$13 AND determinism_hash=$14`,[...scopeValuesV1(input.scope),checkpoint.object_id,checkpoint.lineage_id,checkpoint.revision_id,checkpoint.logical_time,checkpoint.determinism_hash,factIds[checkpoint.object_id],input.expected_latest_base.checkpoint.ref,input.expected_latest_base.checkpoint.hash],"CHECKPOINT_CAS_CONFLICT"); inject("after_checkpoint_latest");
  await update(`UPDATE twin_forecast_result_latest_index_v1 SET forecast_object_id=$7,forecast_status=$8,logical_time=$9::timestamptz,determinism_hash=$10,source_fact_id=$11 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND forecast_object_id=$12 AND determinism_hash=$13`,[...scopeValuesV1(input.scope),forecast.object_id,forecastPayload.status,forecast.logical_time,forecast.determinism_hash,factIds[forecast.object_id],input.expected_latest_base.forecast_result.ref,input.expected_latest_base.forecast_result.hash],"FORECAST_RESULT_CAS_CONFLICT"); inject("after_forecast_result_latest");
  await update(`UPDATE twin_forecast_success_latest_index_v1 SET forecast_object_id=$7,logical_time=$8::timestamptz,determinism_hash=$9,source_fact_id=$10 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND forecast_object_id=$11 AND determinism_hash=$12`,[...scopeValuesV1(input.scope),forecast.object_id,forecast.logical_time,forecast.determinism_hash,factIds[forecast.object_id],input.expected_latest_base.successful_forecast.ref,input.expected_latest_base.successful_forecast.hash],"FORECAST_SUCCESS_CAS_CONFLICT"); inject("after_successful_forecast_latest");
  await update(`UPDATE twin_runtime_health_latest_index_v1 SET health_object_id=$7,operation_status=$8,logical_time=$9::timestamptz,determinism_hash=$10,source_fact_id=$11 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,[...scopeValuesV1(input.scope),health.object_id,String(health.payload.operation_status),health.logical_time,health.determinism_hash,factIds[health.object_id]],"HEALTH_LATEST_CAS_CONFLICT");
  await insertForecastProjectionRowsV1(client,recordSet,factIds);
}

function pgCodeV1(error:unknown):string|null{return error&&typeof error==='object'&&typeof (error as {code?:unknown}).code==='string'?String((error as {code:string}).code):null;}
function sleepV1(ms:number):Promise<void>{return new Promise((resolve)=>setTimeout(resolve,ms));}

export type Cap08S4T17ResolvedPersistenceContextV1 = { expected_latest_base:Cap08S4T17ExpectedLatestBaseV1; correction_authority:{authority_ref:string;authority_hash:string}; corrected_computation_predecessor:CommitCap08S4T17A1TransitionInputV1["corrected_computation_predecessor"]; corrected_state:CanonicalObjectEnvelopeV1 };

export class PostgresCap08S4T17TransitionRepositoryV1 implements Cap08S4T17TransitionPersistencePortV1 {
  constructor(private readonly pool:Pool){}
  async readExpectedLatestBase(scope:TwinScopeKeyV1):Promise<Cap08S4T17ExpectedLatestBaseV1>{const client=await this.pool.connect();try{return await readLatestBaseWithClientV1(client,scope,false);}finally{client.release();}}
  async resolvePersistenceContext(input:{formal_run_id:string;scope:TwinScopeKeyV1;expected_t17_logical_time:string}):Promise<Cap08S4T17ResolvedPersistenceContextV1>{
    const client=await this.pool.connect();try{await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");const result=await client.query(`SELECT authority_ref FROM twin_runtime_authority_snapshot_v1 WHERE authority_kind=$1 AND semantic_payload->>'schema_version'=$2 AND semantic_payload->>'formal_run_id'=$3 AND semantic_payload->'scope'->>'tenant_id'=$4 AND semantic_payload->'scope'->>'project_id'=$5 AND semantic_payload->'scope'->>'group_id'=$6 AND semantic_payload->'scope'->>'field_id'=$7 AND semantic_payload->'scope'->>'season_id'=$8 AND semantic_payload->'scope'->>'zone_id'=$9 AND semantic_payload->>'next_logical_time'=$10`,[CAP08_S4_AUTHORITY_KIND_V1,CAP08_S4_AUTHORITY_SCHEMA_VERSION_V1,input.formal_run_id,...scopeValuesV1(input.scope),input.expected_t17_logical_time]);if(result.rows.length!==1)throw new Error("CAP08_S4_T17_AUTHORITY_CARDINALITY");const {authority,correctedSet}=await readS4AuthorityV1(client,result.rows[0].authority_ref);const expected=await readLatestBaseWithClientV1(client,input.scope,false);if(authority.identity_input.base_t16_state.ref!==expected.state.ref||authority.identity_input.base_t16_state.hash!==expected.state.hash||authority.identity_input.base_t16_checkpoint.ref!==expected.checkpoint.ref||authority.identity_input.base_t16_checkpoint.hash!==expected.checkpoint.hash||authority.identity_input.base_t16_forecast.ref!==expected.forecast_result.ref||authority.identity_input.base_t16_forecast.hash!==expected.forecast_result.hash)throw new Error("CAP08_S4_T17_BASE_LATEST_NOT_AUTHORITY_BOUND");await client.query("COMMIT");return{expected_latest_base:expected,correction_authority:{authority_ref:authority.authority_ref,authority_hash:authority.determinism_hash},corrected_computation_predecessor:{state:authority.corrected_objects.state,checkpoint:authority.corrected_objects.checkpoint,forecast_result:authority.corrected_objects.forecast,successful_forecast:authority.corrected_objects.forecast,scenario_set:authority.corrected_objects.scenario,previous_tick_sequence:authority.t17_predecessor.previous_tick_sequence},corrected_state:correctedSet.state};}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }
  async assertExactTransition(input:CommitCap08S4T17A1TransitionInputV1):Promise<void>{const client=await this.pool.connect();try{await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");const classification=await classifyExistingV1(client,input);if(classification!=="EXISTING_IDEMPOTENT_SUCCESS")throw new Error(classification);await client.query("COMMIT");}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}}
  async commitAuthorityBoundA1Transition(input:CommitCap08S4T17A1TransitionInputV1):Promise<CommitCap08S4T17A1TransitionResultV1>{
    validateTransitionInputV1(input);const retry=CAP08_S4_T17_SERIALIZATION_RETRY_POLICY_V1;let last:unknown=null;
    for(let attempt=1;attempt<=retry.max_attempts;attempt+=1){const client=await this.pool.connect();try{await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[canonicalJsonV1({transition_kind:input.transition_witness.uniqueness_key.transition_kind,formal_run_id:input.formal_run_id,scope:input.scope,lineage_id:input.transition_witness.uniqueness_key.lineage_id,revision_id:input.transition_witness.uniqueness_key.revision_id,t17_logical_time:input.transition_witness.uniqueness_key.t17_logical_time})]);const classification=await classifyExistingV1(client,input);input.fault_injection?.("after_replay_classification");if(classification==="EXISTING_IDEMPOTENT_SUCCESS"){await client.query("COMMIT");return{status:"EXISTING_IDEMPOTENT_SUCCESS",record_set:structuredClone(input.record_set),transition_witness:structuredClone(input.transition_witness),write_delta:0};}if(classification!=="NO_EXISTING_TRANSITION")throw new Error(classification);await insertFirstTransitionV1(client,input);input.fault_injection?.("before_exact_readback");const after=await classifyExistingV1(client,input);if(after!=="EXISTING_IDEMPOTENT_SUCCESS")throw new Error(`CAP08_S4_T17_EXACT_READBACK_FAILED:${after}`);input.fault_injection?.("before_commit");await client.query("COMMIT");return{status:"INSERTED_ATOMIC_TRANSITION",record_set:structuredClone(input.record_set),transition_witness:structuredClone(input.transition_witness),write_delta:input.record_set.members.length+2};}catch(error){await client.query("ROLLBACK");if(pgCodeV1(error)===retry.retryable_sqlstate){last=error;if(attempt<retry.max_attempts){await sleepV1(retry.retry_delays_ms[attempt-1]);continue;}throw new Error(retry.exhaustion_error);}throw error;}finally{client.release();}}
    throw new Error(retry.exhaustion_error);
  }
}
