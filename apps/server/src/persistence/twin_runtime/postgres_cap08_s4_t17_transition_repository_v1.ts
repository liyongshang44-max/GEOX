// Purpose: persist the authority-bound dual-predecessor MCFT-CAP-08 S4 corrected-T16 -> T17 A1 transition atomically.
// Boundary: dedicated T17 transition only; generic CAP-04 CAS remains unchanged.

import type { Pool, PoolClient } from "pg";
import { canonicalJsonV1 } from "../../domain/twin_runtime/canonical_json_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  CAP04_A1_OPERATION_VARIANT_V1,
  CAP04_A_MEMBER_OBJECT_TYPES_V1,
  type Cap04ForecastRunPayloadV1,
} from "../../domain/twin_runtime/forecast_scenario_contracts_v1.js";
import type { Cap04ARecordSetV1 } from "../../domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import { validateCap04ARecordSetV1 } from "../../domain/twin_runtime/forecast_scenario_record_set_validator_v1.js";
import {
  CAP08_S4_T17_SERIALIZATION_RETRY_POLICY_V1,
  classifyCap08S4T17ExistingTransitionV1,
  normalizeCap08S4T17WitnessInputV1,
  type Cap08S4T17ExpectedLatestBaseV1,
  type Cap08S4T17ObjectBindingV1,
  type Cap08S4T17TransitionWitnessV1,
} from "../../domain/twin_runtime/cap08_t17_transition_contracts_v1.js";
import {
  cap08S4T17TransitionWitnessFactIdV1,
  deriveCap08S4T17TransitionWitnessV1,
} from "../../domain/twin_runtime/cap08_t17_transition_witness_identity_v1.js";
import type { Cap08S4AppendForwardAuthorityV1 } from "../../domain/twin_runtime/cap08_s4_append_forward_contracts_v1.js";
import { buildCap04ForecastProjectionRowsV1 } from "../../projections/twin_runtime/forecast_scenario_projection_rebuilder_v1.js";
import type {
  CommitCap08S4T17A1TransitionInputV1,
  CommitCap08S4T17A1TransitionResultV1,
  Cap08S4T17TransitionPersistencePortV1,
} from "../../runtime/twin_runtime/cap08_t17_transition_persistence_port_v1.js";
import type { RuntimeLeaseClaimV1, TwinScopeKeyV1 } from "../../runtime/twin_runtime/ports.js";

export const CAP08_S4_T17_TRANSITION_FACT_SOURCE_V1 = "mcft_cap08_s4_t17_transition_v1" as const;
export const CAP08_S4_T17_TRANSITION_GUARD_TABLE_V1 = "twin_cap08_s4_t17_transition_guard_v1" as const;

function scopeValuesV1(scope: TwinScopeKeyV1): unknown[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}

function factIdV1(objectId: string): string {
  return `fact_${objectId}`;
}

function recordJsonV1(object: CanonicalObjectEnvelopeV1): string {
  return JSON.stringify({ type: object.object_type, payload: object });
}

function witnessRecordJsonV1(witness: Cap08S4T17TransitionWitnessV1): string {
  return JSON.stringify({ type: witness.schema_version, payload: witness });
}

function parseJsonObjectV1(value: unknown, code: string): Record<string, unknown> {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(code);
  return parsed as Record<string, unknown>;
}

function parseFactObjectV1(value: unknown): CanonicalObjectEnvelopeV1 {
  const record = parseJsonObjectV1(value, "CAP08_S4_T17_FACT_RECORD_INVALID");
  const payload = parseJsonObjectV1(record.payload, "CAP08_S4_T17_FACT_PAYLOAD_INVALID") as unknown as CanonicalObjectEnvelopeV1;
  if (record.type !== payload.object_type) throw new Error("CAP08_S4_T17_FACT_TYPE_MISMATCH");
  return payload;
}

function requireMemberV1(recordSet: Cap04ARecordSetV1, objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP08_S4_T17_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}

function bindingV1(object: CanonicalObjectEnvelopeV1): Cap08S4T17ObjectBindingV1 {
  return { ref: object.object_id, hash: object.determinism_hash };
}

function sameBindingV1(left: Cap08S4T17ObjectBindingV1, right: Cap08S4T17ObjectBindingV1): boolean {
  return left.ref === right.ref && left.hash === right.hash;
}

function assertScopeV1(scope: TwinScopeKeyV1, value: {
  tenant_id: string;
  project_id: string;
  group_id: string | null;
  field_id: string;
  season_id: string | null;
  zone_id: string | null;
}, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (scope[field] !== value[field]) throw new Error(`${code}:${field}`);
  }
}

function isSerializationFailureV1(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "40001");
}

function isUniqueViolationV1(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "23505");
}

function sleepV1(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function readCanonicalObjectsV1(
  client: PoolClient,
  bindings: readonly Cap08S4T17ObjectBindingV1[],
): Promise<Map<string, CanonicalObjectEnvelopeV1>> {
  const refs = [...new Set(bindings.map((binding) => binding.ref))];
  const rows = await client.query(
    "SELECT record_json FROM facts WHERE record_json->'payload'->>'object_id'=ANY($1::text[]) ORDER BY fact_id",
    [refs],
  );
  const result = new Map<string, CanonicalObjectEnvelopeV1>();
  for (const row of rows.rows) {
    const object = parseFactObjectV1(row.record_json);
    if (result.has(object.object_id)) throw new Error("CAP08_S4_T17_CANONICAL_OBJECT_DUPLICATE");
    result.set(object.object_id, object);
  }
  return result;
}

async function verifyBindingsV1(
  client: PoolClient,
  bindings: readonly Cap08S4T17ObjectBindingV1[],
  missingCode: string,
  hashCode: string,
): Promise<void> {
  const objects = await readCanonicalObjectsV1(client, bindings);
  if (objects.size !== new Set(bindings.map((binding) => binding.ref)).size) throw new Error(missingCode);
  for (const binding of bindings) {
    if (objects.get(binding.ref)?.determinism_hash !== binding.hash) throw new Error(hashCode);
  }
}

type LatestRowsV1 = {
  state: Cap08S4T17ObjectBindingV1 | null;
  checkpoint: Cap08S4T17ObjectBindingV1 | null;
  forecast_result: Cap08S4T17ObjectBindingV1 | null;
  successful_forecast: Cap08S4T17ObjectBindingV1 | null;
};

async function readLatestRowsV1(client: PoolClient, scope: TwinScopeKeyV1): Promise<LatestRowsV1> {
  const values = scopeValuesV1(scope);
  const [state, checkpoint, forecast, success] = await Promise.all([
    client.query(
      `SELECT state_object_id AS ref,determinism_hash AS hash FROM twin_state_latest_index_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 FOR UPDATE`,
      values,
    ),
    client.query(
      `SELECT checkpoint_object_id AS ref,determinism_hash AS hash FROM twin_runtime_checkpoint_latest_index_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 FOR UPDATE`,
      values,
    ),
    client.query(
      `SELECT forecast_object_id AS ref,determinism_hash AS hash FROM twin_forecast_result_latest_index_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 FOR UPDATE`,
      values,
    ),
    client.query(
      `SELECT forecast_object_id AS ref,determinism_hash AS hash FROM twin_forecast_success_latest_index_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 FOR UPDATE`,
      values,
    ),
  ]);
  for (const [name, result] of [["state", state], ["checkpoint", checkpoint], ["forecast", forecast], ["success", success]] as const) {
    if (result.rows.length > 1) throw new Error(`CAP08_S4_T17_${name.toUpperCase()}_LATEST_CARDINALITY`);
  }
  return {
    state: state.rows[0] ?? null,
    checkpoint: checkpoint.rows[0] ?? null,
    forecast_result: forecast.rows[0] ?? null,
    successful_forecast: success.rows[0] ?? null,
  };
}

function latestStateV1(
  rows: LatestRowsV1,
  base: Cap08S4T17ExpectedLatestBaseV1,
  committed: Cap08S4T17TransitionWitnessV1["committed_t17"],
): "BASE_T16" | "EXACT_T17" | "OTHER" {
  const exact = (actual: Cap08S4T17ObjectBindingV1 | null, expected: Cap08S4T17ObjectBindingV1): boolean =>
    Boolean(actual && sameBindingV1(actual, expected));
  if (exact(rows.state, committed.state)
    && exact(rows.checkpoint, committed.checkpoint)
    && exact(rows.forecast_result, committed.forecast_result)
    && exact(rows.successful_forecast, committed.successful_forecast)) return "EXACT_T17";
  if (exact(rows.state, base.state)
    && exact(rows.checkpoint, base.checkpoint)
    && exact(rows.forecast_result, base.forecast_result)
    && exact(rows.successful_forecast, base.successful_forecast)) return "BASE_T16";
  return "OTHER";
}

async function verifyLeaseV1(
  client: PoolClient,
  scope: TwinScopeKeyV1,
  lease: RuntimeLeaseClaimV1,
): Promise<void> {
  assertScopeV1(scope, lease, "CAP08_S4_T17_LEASE_SCOPE_MISMATCH");
  const result = await client.query(
    `SELECT lease_owner,fencing_token,expires_at>transaction_timestamp() AS valid
       FROM twin_runtime_lease_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
      FOR UPDATE`,
    scopeValuesV1(scope),
  );
  if (result.rows.length !== 1 || result.rows[0].lease_owner !== lease.lease_owner) throw new Error("LEASE_OWNER_MISMATCH");
  if (BigInt(result.rows[0].fencing_token) !== lease.fencing_token) throw new Error("STALE_FENCING_TOKEN");
  if (result.rows[0].valid !== true) throw new Error("LEASE_EXPIRED");
}

async function verifyActiveLineageV1(
  client: PoolClient,
  scope: TwinScopeKeyV1,
  lineageId: string,
  revisionId: string,
  recordSet: Cap04ARecordSetV1,
): Promise<void> {
  const result = await client.query(
    `SELECT active_lineage_ref FROM twin_active_lineage_index_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 FOR UPDATE`,
    scopeValuesV1(scope),
  );
  if (result.rows.length !== 1) throw new Error("CAP08_S4_T17_ACTIVE_LINEAGE_CARDINALITY");
  if (recordSet.operation_key.lineage_id !== lineageId
    || recordSet.operation_key.revision_id !== revisionId) {
    throw new Error("CAP08_S4_T17_LINEAGE_REVISION_MISMATCH");
  }
}

async function verifyAuthorityAndPredecessorV1(
  client: PoolClient,
  input: CommitCap08S4T17A1TransitionInputV1,
): Promise<void> {
  const authorityResult = await client.query(
    `SELECT determinism_hash,semantic_payload FROM twin_runtime_authority_snapshot_v1
      WHERE authority_ref=$1 FOR SHARE`,
    [input.correction_authority.authority_ref],
  );
  if (authorityResult.rows.length !== 1) throw new Error("CAP08_S4_T17_AUTHORITY_CARDINALITY");
  const authority = structuredClone(parseJsonObjectV1(
    authorityResult.rows[0].semantic_payload,
    "CAP08_S4_T17_AUTHORITY_PAYLOAD_INVALID",
  )) as unknown as Cap08S4AppendForwardAuthorityV1;
  if (authorityResult.rows[0].determinism_hash !== input.correction_authority.authority_hash
    || authority.determinism_hash !== input.correction_authority.authority_hash
    || authority.authority_ref !== input.correction_authority.authority_ref
    || authority.formal_run_id !== input.formal_run_id
    || canonicalJsonV1(authority.scope) !== canonicalJsonV1(input.scope)) {
    throw new Error("CAP08_S4_T17_AUTHORITY_BINDING_MISMATCH");
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
    throw new Error("CAP08_S4_T17_CORRECTED_AUTHORITY_MISMATCH");
  }
  if (authority.identity_input.base_t16_state.ref !== input.expected_latest_base.state.ref
    || authority.identity_input.base_t16_state.hash !== input.expected_latest_base.state.hash
    || authority.identity_input.base_t16_checkpoint.ref !== input.expected_latest_base.checkpoint.ref
    || authority.identity_input.base_t16_checkpoint.hash !== input.expected_latest_base.checkpoint.hash
    || authority.identity_input.base_t16_forecast.ref !== input.expected_latest_base.forecast_result.ref
    || authority.identity_input.base_t16_forecast.hash !== input.expected_latest_base.forecast_result.hash) {
    throw new Error("CAP08_S4_T17_BASE_AUTHORITY_MISMATCH");
  }
  await verifyBindingsV1(client, [
    input.expected_latest_base.state,
    input.expected_latest_base.checkpoint,
    input.expected_latest_base.forecast_result,
    input.expected_latest_base.successful_forecast,
  ], "CAP08_S4_T17_BASE_OBJECT_MISSING", "CAP08_S4_T17_BASE_OBJECT_HASH_MISMATCH");
  await verifyBindingsV1(client, [
    corrected.state,
    corrected.checkpoint,
    corrected.forecast_result,
    corrected.successful_forecast,
    corrected.scenario_set,
  ], "CAP08_S4_T17_CORRECTED_OBJECT_MISSING", "CAP08_S4_T17_CORRECTED_OBJECT_HASH_MISMATCH");
}

function verifyA1RecordSetV1(
  input: CommitCap08S4T17A1TransitionInputV1,
): void {
  validateCap04ARecordSetV1(input.record_set);
  assertScopeV1(input.scope, input.record_set.operation_key.scope, "CAP08_S4_T17_RECORD_SET_SCOPE_MISMATCH");
  if (input.record_set.operation_key.operation_variant !== CAP04_A1_OPERATION_VARIANT_V1) {
    throw new Error("FORMAL_DATASET_INVARIANT_VIOLATION");
  }
  const aggregate = input.record_set.aggregate_identity_input;
  const corrected = input.corrected_computation_predecessor;
  if (aggregate.previous_posterior_ref !== corrected.state.ref
    || aggregate.previous_posterior_hash !== corrected.state.hash
    || aggregate.previous_checkpoint_ref !== corrected.checkpoint.ref
    || aggregate.previous_checkpoint_hash !== corrected.checkpoint.hash
    || aggregate.previous_forecast_result_ref !== corrected.forecast_result.ref
    || aggregate.previous_forecast_result_hash !== corrected.forecast_result.hash) {
    throw new Error("CAP08_S4_T17_RECORD_SET_CORRECTED_PREDECESSOR_MISMATCH");
  }
  const forecast = requireMemberV1(input.record_set, "twin_forecast_run_v1");
  const forecastPayload = forecast.payload as unknown as Cap04ForecastRunPayloadV1;
  if (forecastPayload.status !== "COMPLETED") throw new Error("FORMAL_DATASET_INVARIANT_VIOLATION");
}

async function recordSetPresenceV1(
  client: PoolClient,
  recordSet: Cap04ARecordSetV1,
): Promise<"ABSENT" | "EXACT" | "CONFLICT"> {
  const guard = await client.query(
    `SELECT record_set_id,determinism_hash,member_object_ids,member_determinism_hashes
       FROM twin_object_idempotency_index_v1 WHERE idempotency_key=$1`,
    [recordSet.idempotency_key],
  );
  const ids = CAP04_A_MEMBER_OBJECT_TYPES_V1.map((type) => recordSet.member_object_ids[type]);
  const facts = await client.query(
    "SELECT record_json FROM facts WHERE record_json->'payload'->>'object_id'=ANY($1::text[])",
    [ids],
  );
  if (guard.rows.length === 0 && facts.rows.length === 0) return "ABSENT";
  if (guard.rows.length !== 1 || facts.rows.length !== CAP04_A_MEMBER_OBJECT_TYPES_V1.length) return "CONFLICT";
  const row = guard.rows[0];
  if (row.record_set_id !== recordSet.record_set_id || row.determinism_hash !== recordSet.aggregate_determinism_hash) return "CONFLICT";
  const objects = facts.rows.map((value) => parseFactObjectV1(value.record_json));
  const byId = new Map(objects.map((object) => [object.object_id, object]));
  for (const member of recordSet.members) {
    if (byId.get(member.object_id)?.determinism_hash !== member.determinism_hash) return "CONFLICT";
  }
  return "EXACT";
}

async function witnessPresenceV1(
  client: PoolClient,
  witness: Cap08S4T17TransitionWitnessV1,
): Promise<"ABSENT" | "EXACT" | "CONFLICT"> {
  const result = await client.query("SELECT record_json FROM facts WHERE fact_id=$1", [cap08S4T17TransitionWitnessFactIdV1(witness)]);
  if (result.rows.length === 0) return "ABSENT";
  if (result.rows.length !== 1) return "CONFLICT";
  const record = parseJsonObjectV1(result.rows[0].record_json, "CAP08_S4_T17_WITNESS_RECORD_INVALID");
  const payload = parseJsonObjectV1(record.payload, "CAP08_S4_T17_WITNESS_PAYLOAD_INVALID");
  return canonicalJsonV1(payload) === canonicalJsonV1(witness) ? "EXACT" : "CONFLICT";
}

async function guardPresenceV1(
  client: PoolClient,
  witness: Cap08S4T17TransitionWitnessV1,
): Promise<"ABSENT" | "EXACT" | "CONFLICT"> {
  const result = await client.query(
    `SELECT transition_id,idempotency_key,record_set_id,aggregate_determinism_hash,witness_determinism_hash,
            authority_ref,authority_hash,identity_basis
       FROM twin_cap08_s4_t17_transition_guard_v1 WHERE idempotency_key=$1`,
    [witness.idempotency_key],
  );
  if (result.rows.length === 0) return "ABSENT";
  if (result.rows.length !== 1) return "CONFLICT";
  const row = result.rows[0];
  if (row.transition_id !== witness.transition_id
    || row.record_set_id !== witness.committed_t17.record_set_id
    || row.aggregate_determinism_hash !== witness.committed_t17.aggregate_determinism_hash
    || row.witness_determinism_hash !== witness.determinism_hash
    || row.authority_ref !== witness.correction_authority.authority_ref
    || row.authority_hash !== witness.correction_authority.authority_hash
    || canonicalJsonV1(row.identity_basis) !== canonicalJsonV1(witness.uniqueness_key)) return "CONFLICT";
  return "EXACT";
}

async function classifyExistingV1(
  client: PoolClient,
  input: CommitCap08S4T17A1TransitionInputV1,
  witness: Cap08S4T17TransitionWitnessV1,
): Promise<ReturnType<typeof classifyCap08S4T17ExistingTransitionV1>> {
  const [recordSet, witnessPresence, guard, latest] = await Promise.all([
    recordSetPresenceV1(client, input.record_set),
    witnessPresenceV1(client, witness),
    guardPresenceV1(client, witness),
    readLatestRowsV1(client, input.scope),
  ]);
  return classifyCap08S4T17ExistingTransitionV1({
    record_set_presence: recordSet,
    witness_presence: witnessPresence,
    transition_guard_presence: guard,
    latest_projection_state: latestStateV1(latest, input.expected_latest_base, witness.committed_t17),
  });
}

async function exactReadbackV1(
  client: PoolClient,
  input: CommitCap08S4T17A1TransitionInputV1,
  witness: Cap08S4T17TransitionWitnessV1,
): Promise<void> {
  const classification = await classifyExistingV1(client, input, witness);
  if (classification !== "EXISTING_IDEMPOTENT_SUCCESS") throw new Error(`CAP08_S4_T17_EXACT_READBACK_FAILED:${classification}`);
}

export class PostgresCap08S4T17TransitionRepositoryV1 implements Cap08S4T17TransitionPersistencePortV1 {
  constructor(private readonly pool: Pool) {}

  async captureExpectedLatestBase(scope: TwinScopeKeyV1): Promise<Cap08S4T17ExpectedLatestBaseV1> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      const rows = await readLatestRowsV1(client, scope);
      await client.query("COMMIT");
      if (!rows.state || !rows.checkpoint || !rows.forecast_result || !rows.successful_forecast) {
        throw new Error("CAP08_S4_T17_EXPECTED_BASE_POINTERS_REQUIRED");
      }
      return {
        state: rows.state,
        checkpoint: rows.checkpoint,
        forecast_result: rows.forecast_result,
        successful_forecast: rows.successful_forecast,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async commitAuthorityBoundA1Transition(
    input: CommitCap08S4T17A1TransitionInputV1,
  ): Promise<CommitCap08S4T17A1TransitionResultV1> {
    verifyA1RecordSetV1(input);
    const witnessInput = normalizeCap08S4T17WitnessInputV1({
      uniqueness_key: input.transition_witness.uniqueness_key,
      correction_authority: input.correction_authority,
      expected_latest_base: input.expected_latest_base,
      corrected_computation_predecessor: input.corrected_computation_predecessor,
      committed_t17: input.transition_witness.committed_t17,
    });
    const derivedWitness = deriveCap08S4T17TransitionWitnessV1(witnessInput);
    if (canonicalJsonV1(derivedWitness) !== canonicalJsonV1(input.transition_witness)) {
      throw new Error("CAP08_S4_T17_WITNESS_DERIVATION_MISMATCH");
    }

    const policy = CAP08_S4_T17_SERIALIZATION_RETRY_POLICY_V1;
    for (let attempt = 1; attempt <= policy.max_attempts; attempt += 1) {
      const client = await this.pool.connect();
      const inject = (stage: Parameters<NonNullable<typeof input.fault_injection>>[0]): void => input.fault_injection?.(stage);
      try {
        await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [derivedWitness.idempotency_key]);

        const existing = await classifyExistingV1(client, input, derivedWitness);
        inject("after_replay_classification");
        if (existing === "EXISTING_IDEMPOTENT_SUCCESS") {
          await client.query("COMMIT");
          client.release();
          return {
            status: "EXISTING_IDEMPOTENT_SUCCESS",
            record_set: input.record_set,
            transition_witness: derivedWitness,
            write_delta: 0,
          };
        }
        if (existing === "POST_TRANSITION_PROJECTION_DIVERGENCE") throw new Error(existing);
        if (existing === "PARTIAL_TRANSITION_CORRUPTION") throw new Error(existing);
        if (existing === "IDEMPOTENCY_CONFLICT") throw new Error(existing);

        const latest = await readLatestRowsV1(client, input.scope);
        if (latestStateV1(latest, input.expected_latest_base, derivedWitness.committed_t17) !== "BASE_T16") {
          throw new Error("BASE_LATEST_CAS_CONFLICT");
        }
        inject("after_base_pointer_validation");
        await verifyLeaseV1(client, input.scope, input.lease);
        await verifyActiveLineageV1(
          client,
          input.scope,
          input.record_set.operation_key.lineage_id,
          input.record_set.operation_key.revision_id,
          input.record_set,
        );
        await verifyAuthorityAndPredecessorV1(client, input);
        inject("after_authority_validation");
        inject("after_corrected_predecessor_validation");

        let writeDelta = 0;
        const guard = await client.query(
          `INSERT INTO twin_object_idempotency_index_v1
           (identity_kind,idempotency_key,record_set_id,determinism_hash,identity_basis,member_object_ids,member_determinism_hashes)
           VALUES ('A1_RECORD_SET',$1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)
           ON CONFLICT (idempotency_key) DO NOTHING RETURNING idempotency_key`,
          [
            input.record_set.idempotency_key,
            input.record_set.record_set_id,
            input.record_set.aggregate_determinism_hash,
            JSON.stringify({
              record_set_contract_id: input.record_set.record_set_contract_id,
              terminal_tick_uniqueness_key: input.record_set.terminal_tick_uniqueness_key,
              terminal_tick_uniqueness_key_hash: input.record_set.terminal_tick_uniqueness_key_hash,
              operation_key: input.record_set.operation_key,
              operation_key_hash: input.record_set.operation_key_hash,
              aggregate_identity_input: input.record_set.aggregate_identity_input,
            }),
            JSON.stringify(input.record_set.member_object_ids),
            JSON.stringify(Object.fromEntries(input.record_set.members.map((member) => [member.object_id, member.determinism_hash]))),
          ],
        );
        if (guard.rows.length !== 1) throw new Error("IDEMPOTENCY_CONFLICT");
        writeDelta += 1;
        inject("after_record_set_guard");

        const tick = requireMemberV1(input.record_set, "twin_runtime_tick_v1");
        const terminal = await client.query(
          `INSERT INTO twin_terminal_tick_uniqueness_v1
           (tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,logical_time,
            terminal_tick_uniqueness_key_hash,operation_variant,record_set_id,aggregate_determinism_hash,source_tick_object_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10,$11,$12,$13,$14)
           ON CONFLICT (tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,logical_time)
           DO NOTHING RETURNING record_set_id`,
          [
            ...scopeValuesV1(input.scope),
            input.record_set.operation_key.lineage_id,
            input.record_set.operation_key.revision_id,
            input.record_set.operation_key.logical_time,
            input.record_set.terminal_tick_uniqueness_key_hash,
            input.record_set.operation_key.operation_variant,
            input.record_set.record_set_id,
            input.record_set.aggregate_determinism_hash,
            tick.object_id,
          ],
        );
        if (terminal.rows.length !== 1) throw new Error("TERMINAL_TICK_VARIANT_CONFLICT");
        writeDelta += 1;

        const factIds: Record<string, string> = {};
        for (const member of input.record_set.members) {
          const id = factIdV1(member.object_id);
          factIds[member.object_id] = id;
          await client.query(
            "INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,'system',$3::jsonb)",
            [id, member.logical_time, recordJsonV1(member)],
          );
          writeDelta += 1;
        }
        inject("after_t17_facts");

        const state = requireMemberV1(input.record_set, "twin_state_estimate_v1");
        const checkpoint = requireMemberV1(input.record_set, "twin_runtime_checkpoint_v1");
        const forecast = requireMemberV1(input.record_set, "twin_forecast_run_v1");
        const health = requireMemberV1(input.record_set, "twin_runtime_health_v1");
        const forecastPayload = forecast.payload as unknown as Cap04ForecastRunPayloadV1;
        const forecastRows = buildCap04ForecastProjectionRowsV1(forecast, factIds[forecast.object_id]);

        await client.query(
          `INSERT INTO twin_state_history_projection_v1
           (state_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,logical_time,determinism_hash,canonical_payload,source_fact_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12::jsonb,$13)`,
          [state.object_id, ...scopeValuesV1(input.scope), state.lineage_id, state.revision_id, state.logical_time, state.determinism_hash, JSON.stringify(state.payload), factIds[state.object_id]],
        );
        writeDelta += 1;

        await client.query(
          `INSERT INTO twin_forecast_run_projection_v1
           (forecast_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,logical_time,
            forecast_status,source_posterior_ref,source_posterior_hash,runtime_config_ref,runtime_config_hash,forcing_window_hash,
            point_count,determinism_hash,canonical_payload,source_fact_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20)`,
          [
            forecastRows.run.forecast_object_id,
            forecastRows.run.tenant_id,
            forecastRows.run.project_id,
            forecastRows.run.group_id,
            forecastRows.run.field_id,
            forecastRows.run.season_id,
            forecastRows.run.zone_id,
            forecastRows.run.lineage_id,
            forecastRows.run.revision_id,
            forecastRows.run.logical_time,
            forecastRows.run.forecast_status,
            forecastRows.run.source_posterior_ref,
            forecastRows.run.source_posterior_hash,
            forecastRows.run.runtime_config_ref,
            forecastRows.run.runtime_config_hash,
            forecastRows.run.forcing_window_hash,
            forecastRows.run.point_count,
            forecastRows.run.determinism_hash,
            JSON.stringify(forecastRows.run.canonical_payload),
            forecastRows.run.source_fact_id,
          ],
        );
        writeDelta += 1;
        for (const point of forecastRows.points) {
          await client.query(
            `INSERT INTO twin_forecast_point_projection_v1
             (forecast_object_id,horizon_hour,target_time,storage_mean_mm,storage_variance_mm2,available_water_fraction,determinism_hash,canonical_point)
             VALUES ($1,$2,$3::timestamptz,$4,$5,$6,$7,$8::jsonb)`,
            [point.forecast_object_id, point.horizon_hour, point.target_time, point.storage_mean_mm, point.storage_variance_mm2, point.available_water_fraction, point.determinism_hash, JSON.stringify(point.canonical_point)],
          );
          writeDelta += 1;
        }

        const witnessFactId = cap08S4T17TransitionWitnessFactIdV1(derivedWitness);
        await client.query(
          "INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,$3,$4::jsonb)",
          [witnessFactId, input.record_set.operation_key.logical_time, CAP08_S4_T17_TRANSITION_FACT_SOURCE_V1, witnessRecordJsonV1(derivedWitness)],
        );
        writeDelta += 1;
        inject("after_transition_witness_fact");

        await client.query(
          `INSERT INTO twin_cap08_s4_t17_transition_guard_v1
           (transition_id,idempotency_key,formal_run_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,
            lineage_id,revision_id,t17_logical_time,record_set_id,aggregate_determinism_hash,witness_fact_id,
            witness_determinism_hash,authority_ref,authority_hash,identity_basis)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::timestamptz,$13,$14,$15,$16,$17,$18,$19::jsonb)`,
          [
            derivedWitness.transition_id,
            derivedWitness.idempotency_key,
            input.formal_run_id,
            ...scopeValuesV1(input.scope),
            input.record_set.operation_key.lineage_id,
            input.record_set.operation_key.revision_id,
            input.record_set.operation_key.logical_time,
            input.record_set.record_set_id,
            input.record_set.aggregate_determinism_hash,
            witnessFactId,
            derivedWitness.determinism_hash,
            input.correction_authority.authority_ref,
            input.correction_authority.authority_hash,
            JSON.stringify(derivedWitness.uniqueness_key),
          ],
        );
        writeDelta += 1;
        inject("after_transition_guard");

        const stateUpdate = await client.query(
          `UPDATE twin_state_latest_index_v1 SET
             state_object_id=$7,lineage_id=$8,revision_id=$9,logical_time=$10::timestamptz,determinism_hash=$11,source_fact_id=$12
           WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
             AND state_object_id=$13 AND determinism_hash=$14`,
          [...scopeValuesV1(input.scope), state.object_id, state.lineage_id, state.revision_id, state.logical_time, state.determinism_hash, factIds[state.object_id], input.expected_latest_base.state.ref, input.expected_latest_base.state.hash],
        );
        if (stateUpdate.rowCount !== 1) throw new Error("STATE_LATEST_CAS_CONFLICT");
        writeDelta += 1;
        inject("after_state_latest");

        const checkpointUpdate = await client.query(
          `UPDATE twin_runtime_checkpoint_latest_index_v1 SET
             checkpoint_object_id=$7,lineage_id=$8,revision_id=$9,logical_time=$10::timestamptz,determinism_hash=$11,source_fact_id=$12
           WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
             AND checkpoint_object_id=$13 AND determinism_hash=$14`,
          [...scopeValuesV1(input.scope), checkpoint.object_id, checkpoint.lineage_id, checkpoint.revision_id, checkpoint.logical_time, checkpoint.determinism_hash, factIds[checkpoint.object_id], input.expected_latest_base.checkpoint.ref, input.expected_latest_base.checkpoint.hash],
        );
        if (checkpointUpdate.rowCount !== 1) throw new Error("CHECKPOINT_CAS_CONFLICT");
        writeDelta += 1;
        inject("after_checkpoint_latest");

        const forecastUpdate = await client.query(
          `UPDATE twin_forecast_result_latest_index_v1 SET
             forecast_object_id=$7,forecast_status=$8,logical_time=$9::timestamptz,determinism_hash=$10,source_fact_id=$11
           WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
             AND forecast_object_id=$12 AND determinism_hash=$13`,
          [...scopeValuesV1(input.scope), forecast.object_id, forecastPayload.status, forecast.logical_time, forecast.determinism_hash, factIds[forecast.object_id], input.expected_latest_base.forecast_result.ref, input.expected_latest_base.forecast_result.hash],
        );
        if (forecastUpdate.rowCount !== 1) throw new Error("FORECAST_RESULT_CAS_CONFLICT");
        writeDelta += 1;
        inject("after_forecast_result_latest");

        const successUpdate = await client.query(
          `UPDATE twin_forecast_success_latest_index_v1 SET
             forecast_object_id=$7,logical_time=$8::timestamptz,determinism_hash=$9,source_fact_id=$10
           WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
             AND forecast_object_id=$11 AND determinism_hash=$12`,
          [...scopeValuesV1(input.scope), forecast.object_id, forecast.logical_time, forecast.determinism_hash, factIds[forecast.object_id], input.expected_latest_base.successful_forecast.ref, input.expected_latest_base.successful_forecast.hash],
        );
        if (successUpdate.rowCount !== 1) throw new Error("FORECAST_SUCCESS_CAS_CONFLICT");
        writeDelta += 1;
        inject("after_successful_forecast_latest");

        const healthUpdate = await client.query(
          `UPDATE twin_runtime_health_latest_index_v1 SET
             health_object_id=$7,operation_status=$8,logical_time=$9::timestamptz,determinism_hash=$10,source_fact_id=$11
           WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
          [...scopeValuesV1(input.scope), health.object_id, String(health.payload.operation_status), health.logical_time, health.determinism_hash, factIds[health.object_id]],
        );
        if (healthUpdate.rowCount !== 1) throw new Error("HEALTH_LATEST_CAS_CONFLICT");
        writeDelta += 1;

        inject("before_exact_readback");
        await exactReadbackV1(client, input, derivedWitness);
        inject("before_commit");
        await client.query("COMMIT");
        client.release();
        return {
          status: "INSERTED_ATOMIC_TRANSITION",
          record_set: input.record_set,
          transition_witness: derivedWitness,
          write_delta: writeDelta,
        };
      } catch (error) {
        await client.query("ROLLBACK");
        client.release();
        if (isSerializationFailureV1(error)) {
          if (attempt >= policy.max_attempts) throw new Error(policy.exhaustion_error);
          await sleepV1(policy.retry_delays_ms[attempt - 1]);
          continue;
        }
        if (isUniqueViolationV1(error)) throw new Error("IDEMPOTENCY_CONFLICT");
        throw error;
      }
    }
    throw new Error(CAP08_S4_T17_SERIALIZATION_RETRY_POLICY_V1.exhaustion_error);
  }
}
