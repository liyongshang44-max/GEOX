// Purpose: atomically persist and exactly inspect the MCFT-CAP-08.S4 corrected T16 canonical set, one schema-compatible idempotency guard, and immutable append-forward authority without regressing Runtime pointers.
// Boundary: bounded PostgreSQL persistence only; no math, candidate construction, projection/latest-pointer mutation, route, scheduler, Residual commit, Calibration, Shadow, historical rewrite, or production Runtime authority.

import type { Pool, PoolClient } from "pg";
import { canonicalJsonV1 } from "../../domain/twin_runtime/canonical_json_v1.js";
import {
  CAP08_S3_COMPLETION_TUPLE_SCHEMA_VERSION_V1,
  validateCap08S3CompletionTupleV1,
  type Cap08S3CompletionTupleV1,
} from "../../domain/twin_runtime/cap08_s3_completion_tuple_v1.js";
import {
  CAP08_S4_AUTHORITY_KIND_V1,
  CAP08_S4_AUTHORITY_SCHEMA_VERSION_V1,
  validateCap08S4AppendForwardAuthorityV1,
  type Cap08S4AppendForwardAuthorityV1,
  type Cap08S4CorrectedCanonicalSetV1,
  type Cap08S4ObjectBindingV1,
  type Cap08S4ScopeV1,
} from "../../domain/twin_runtime/cap08_s4_append_forward_contracts_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import type { Cap04ScenarioSetEnvelopeV1 } from "../../domain/twin_runtime/forecast_scenario_contracts_v1.js";

// S4 has zero schema delta; OBJECT is the existing physical discriminator.
// S4 semantics are bound by identity_basis plus the immutable authority schema.
export const CAP08_S4_IDENTITY_KIND_V1 = "OBJECT" as const;
export const CAP08_S4_FACT_SOURCE_V1 = "mcft_cap08_s4_late_append_forward_v1" as const;

export type InspectCap08S4AppendForwardResultV1 =
  | { disposition: "NOT_ESTABLISHED"; authority: null; corrected_set: null; write_delta: 0 }
  | { disposition: "ALREADY_COMPLETE_EXACT"; authority: Cap08S4AppendForwardAuthorityV1; corrected_set: Cap08S4CorrectedCanonicalSetV1; write_delta: 0 };

export type EstablishCap08S4AppendForwardResultV1 = {
  disposition: "ALREADY_COMPLETE_EXACT";
  write_status: "INSERTED_ATOMIC_SET" | "EXISTING_IDEMPOTENT_SET";
  authority: Cap08S4AppendForwardAuthorityV1;
  corrected_set: Cap08S4CorrectedCanonicalSetV1;
  write_delta: 0 | 7;
};

type PersistedObjectV1 = CanonicalObjectEnvelopeV1 | Cap04ScenarioSetEnvelopeV1;
type GuardRowV1 = {
  identity_kind: string;
  record_set_id: string | null;
  determinism_hash: string;
  identity_basis: unknown;
  member_object_ids: unknown;
  member_determinism_hashes: unknown;
};

function scopeValuesV1(scope: Cap08S4ScopeV1): unknown[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}

function jsonObjectV1(value: unknown, code: string): Record<string, unknown> {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(code);
  return parsed as Record<string, unknown>;
}

function parseFactObjectV1(value: unknown): PersistedObjectV1 {
  const record = jsonObjectV1(value, "CAP08_S4_FACT_RECORD_JSON_INVALID");
  const payload = jsonObjectV1(record.payload, "CAP08_S4_FACT_PAYLOAD_REQUIRED") as unknown as PersistedObjectV1;
  if (record.type !== payload.object_type) throw new Error("CAP08_S4_FACT_TYPE_MISMATCH");
  return payload;
}

function factIdV1(objectId: string): string { return `fact_${objectId}`; }
function recordJsonV1(object: PersistedObjectV1): string { return JSON.stringify({ type: object.object_type, payload: object }); }

function correctedObjectsV1(set: Cap08S4CorrectedCanonicalSetV1): PersistedObjectV1[] {
  return [set.state, set.forecast, set.scenario, set.tick, set.checkpoint];
}

function correctedBindingsV1(authority: Cap08S4AppendForwardAuthorityV1): Cap08S4ObjectBindingV1[] {
  return [
    authority.corrected_objects.state,
    authority.corrected_objects.forecast,
    authority.corrected_objects.scenario,
    authority.corrected_objects.tick,
    authority.corrected_objects.checkpoint,
  ];
}

function correctedHashesV1(authority: Cap08S4AppendForwardAuthorityV1): Record<string, string> {
  return Object.fromEntries(correctedBindingsV1(authority).map((binding) => [binding.ref, binding.hash]));
}

async function readAuthorityV1(client: PoolClient, authorityRef: string) {
  const result = await client.query(
    `SELECT determinism_hash,semantic_payload FROM twin_runtime_authority_snapshot_v1
      WHERE authority_kind=$1 AND authority_ref=$2`,
    [CAP08_S4_AUTHORITY_KIND_V1, authorityRef],
  );
  if (result.rows.length === 0) return null;
  if (result.rows.length !== 1) throw new Error("CAP08_S4_AUTHORITY_CARDINALITY");
  return result.rows[0] as { determinism_hash: string; semantic_payload: unknown };
}

async function readGuardV1(client: PoolClient, key: string): Promise<GuardRowV1 | null> {
  const result = await client.query(
    `SELECT identity_kind,record_set_id,determinism_hash,identity_basis,
            member_object_ids,member_determinism_hashes
       FROM twin_object_idempotency_index_v1 WHERE idempotency_key=$1`,
    [key],
  );
  if (result.rows.length === 0) return null;
  if (result.rows.length !== 1) throw new Error("CAP08_S4_IDEMPOTENCY_GUARD_CARDINALITY");
  return result.rows[0] as GuardRowV1;
}

async function readFactsV1(client: PoolClient, objectIds: readonly string[]): Promise<Map<string, PersistedObjectV1>> {
  const ids = [...new Set(objectIds)];
  if (ids.length === 0) return new Map();
  const result = await client.query(
    `SELECT record_json FROM facts
      WHERE record_json->'payload'->>'object_id'=ANY($1::text[]) ORDER BY fact_id`,
    [ids],
  );
  const objects = new Map<string, PersistedObjectV1>();
  for (const row of result.rows) {
    const object = parseFactObjectV1(row.record_json);
    if (objects.has(object.object_id)) throw new Error("CAP08_S4_CANONICAL_OBJECT_ID_NOT_UNIQUE");
    objects.set(object.object_id, object);
  }
  return objects;
}

async function verifyBindingsV1(
  client: PoolClient,
  bindings: readonly Cap08S4ObjectBindingV1[],
  missingCode: string,
  mismatchCode: string,
): Promise<void> {
  const facts = await readFactsV1(client, bindings.map((binding) => binding.ref));
  if (facts.size !== bindings.length) throw new Error(missingCode);
  for (const binding of bindings) {
    if (facts.get(binding.ref)?.determinism_hash !== binding.hash) throw new Error(mismatchCode);
  }
}

async function verifyS3CompletionV1(client: PoolClient, authority: Cap08S4AppendForwardAuthorityV1): Promise<void> {
  const result = await client.query(
    `SELECT determinism_hash,semantic_payload FROM twin_runtime_authority_snapshot_v1
      WHERE semantic_payload->>'schema_version'=$1
        AND semantic_payload->>'formal_run_id'=$2
        AND semantic_payload->'scope'->>'tenant_id'=$3
        AND semantic_payload->'scope'->>'project_id'=$4
        AND semantic_payload->'scope'->>'group_id'=$5
        AND semantic_payload->'scope'->>'field_id'=$6
        AND semantic_payload->'scope'->>'season_id'=$7
        AND semantic_payload->'scope'->>'zone_id'=$8`,
    [CAP08_S3_COMPLETION_TUPLE_SCHEMA_VERSION_V1, authority.formal_run_id, ...scopeValuesV1(authority.scope)],
  );
  if (result.rows.length !== 1) throw new Error("CAP08_S4_S3_COMPLETION_TUPLE_CARDINALITY");
  const tupleRaw = jsonObjectV1(result.rows[0].semantic_payload, "CAP08_S4_S3_COMPLETION_TUPLE_INVALID");
  const tuple = structuredClone(tupleRaw) as unknown as Cap08S3CompletionTupleV1;
  validateCap08S3CompletionTupleV1(tuple);
  if (tuple.determinism_hash !== result.rows[0].determinism_hash
    || tuple.phase_engine_source_digest !== authority.phase_engine_source_digest) {
    throw new Error("CAP08_S4_S3_COMPLETION_TUPLE_HASH_MISMATCH");
  }
  const t16 = tuple.tick_bindings.filter((binding) => binding.tick_id === "T16");
  if (t16.length !== 1
    || t16[0].tick_ref !== authority.identity_input.base_t16_tick.ref
    || t16[0].tick_hash !== authority.identity_input.base_t16_tick.hash) {
    throw new Error("CAP08_S4_S3_T16_BINDING_MISMATCH");
  }
}

function reconstructSetV1(
  authority: Cap08S4AppendForwardAuthorityV1,
  facts: Map<string, PersistedObjectV1>,
): Cap08S4CorrectedCanonicalSetV1 {
  const requireObject = <T extends PersistedObjectV1>(binding: Cap08S4ObjectBindingV1, type: string, code: string): T => {
    const object = facts.get(binding.ref);
    if (!object || object.object_type !== type || object.determinism_hash !== binding.hash) throw new Error(code);
    return object as T;
  };
  return {
    state: requireObject(authority.corrected_objects.state, "twin_state_estimate_v1", "CAP08_S4_CORRECTED_STATE_INVALID"),
    forecast: requireObject(authority.corrected_objects.forecast, "twin_forecast_run_v1", "CAP08_S4_CORRECTED_FORECAST_INVALID"),
    scenario: requireObject(authority.corrected_objects.scenario, "twin_scenario_set_v1", "CAP08_S4_CORRECTED_SCENARIO_INVALID"),
    tick: requireObject(authority.corrected_objects.tick, "twin_runtime_tick_v1", "CAP08_S4_CORRECTED_TICK_INVALID"),
    checkpoint: requireObject(authority.corrected_objects.checkpoint, "twin_runtime_checkpoint_v1", "CAP08_S4_CORRECTED_CHECKPOINT_INVALID"),
  };
}

async function validateExternalBindingsV1(client: PoolClient, authority: Cap08S4AppendForwardAuthorityV1): Promise<void> {
  await verifyS3CompletionV1(client, authority);
  await verifyBindingsV1(client, [
    authority.identity_input.base_t16_state,
    authority.identity_input.base_t16_forecast,
    authority.identity_input.base_t16_tick,
    authority.identity_input.base_t16_checkpoint,
    authority.identity_input.source_t01_state,
  ], "CAP08_S4_BASE_BINDING_OBJECT_MISSING", "CAP08_S4_BASE_BINDING_HASH_MISMATCH");
  await verifyBindingsV1(client, [
    ...authority.historical_hash_manifest.state_bindings,
    ...authority.historical_hash_manifest.forecast_bindings,
  ], "CAP08_S4_HISTORICAL_OBJECT_MISSING", "CAP08_S4_HISTORICAL_HASH_MUTATION_DETECTED");
}

async function inspectWithClientV1(
  client: PoolClient,
  requested: Cap08S4AppendForwardAuthorityV1,
): Promise<InspectCap08S4AppendForwardResultV1> {
  if (requested.schema_version !== CAP08_S4_AUTHORITY_SCHEMA_VERSION_V1) {
    throw new Error("CAP08_S4_REQUESTED_AUTHORITY_SCHEMA_MISMATCH");
  }
  const bindings = correctedBindingsV1(requested);
  const [authorityRow, guard, facts] = await Promise.all([
    readAuthorityV1(client, requested.authority_ref),
    readGuardV1(client, requested.idempotency_key),
    readFactsV1(client, bindings.map((binding) => binding.ref)),
  ]);
  const presence = Number(Boolean(authorityRow)) + Number(Boolean(guard)) + facts.size;
  if (presence === 0) return { disposition: "NOT_ESTABLISHED", authority: null, corrected_set: null, write_delta: 0 };
  if (!authorityRow || !guard || facts.size !== 5) throw new Error("CAP08_S4_APPEND_FORWARD_PARTIAL_SET");

  const authorityRaw = jsonObjectV1(authorityRow.semantic_payload, "CAP08_S4_AUTHORITY_PAYLOAD_INVALID");
  const authority = structuredClone(authorityRaw) as unknown as Cap08S4AppendForwardAuthorityV1;
  if (authorityRow.determinism_hash !== authority.determinism_hash
    || authority.authority_ref !== requested.authority_ref
    || authority.idempotency_key !== requested.idempotency_key
    || canonicalJsonV1(authority.identity_input) !== canonicalJsonV1(requested.identity_input)) {
    throw new Error("CAP08_S4_EXISTING_AUTHORITY_CONFLICT");
  }

  const basis = jsonObjectV1(guard.identity_basis, "CAP08_S4_GUARD_IDENTITY_BASIS_INVALID");
  const storedIds = Array.isArray(guard.member_object_ids)
    ? [...guard.member_object_ids]
    : Object.values(jsonObjectV1(guard.member_object_ids, "CAP08_S4_GUARD_MEMBER_IDS_INVALID"));
  if (guard.identity_kind !== CAP08_S4_IDENTITY_KIND_V1
    || guard.record_set_id !== authority.authority_ref
    || guard.determinism_hash !== authority.determinism_hash
    || basis.schema_version !== authority.schema_version
    || basis.contract_id !== authority.contract_id
    || canonicalJsonV1(basis.identity_input) !== canonicalJsonV1(authority.identity_input)
    || canonicalJsonV1(storedIds.sort()) !== canonicalJsonV1(bindings.map((binding) => binding.ref).sort())
    || canonicalJsonV1(jsonObjectV1(guard.member_determinism_hashes, "CAP08_S4_GUARD_MEMBER_HASHES_INVALID"))
      !== canonicalJsonV1(correctedHashesV1(authority))) {
    throw new Error("CAP08_S4_IDEMPOTENCY_GUARD_CONFLICT");
  }

  const set = reconstructSetV1(authority, facts);
  validateCap08S4AppendForwardAuthorityV1({ authority, corrected_set: set });
  await validateExternalBindingsV1(client, authority);
  return { disposition: "ALREADY_COMPLETE_EXACT", authority, corrected_set: set, write_delta: 0 };
}

export class PostgresCap08S4AppendForwardRepositoryV1 {
  constructor(private readonly pool: Pool) {}

  async inspect(authority: Cap08S4AppendForwardAuthorityV1): Promise<InspectCap08S4AppendForwardResultV1> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const result = await inspectWithClientV1(client, authority);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async establish(input: {
    authority: Cap08S4AppendForwardAuthorityV1;
    corrected_set: Cap08S4CorrectedCanonicalSetV1;
    fault_injection?: (stage: string) => void;
  }): Promise<EstablishCap08S4AppendForwardResultV1> {
    validateCap08S4AppendForwardAuthorityV1(input);
    const client = await this.pool.connect();
    const inject = (stage: string): void => input.fault_injection?.(stage);
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [canonicalJsonV1({
        formal_run_id: input.authority.formal_run_id,
        scope: input.authority.scope,
        correction_logical_time: input.authority.correction_logical_time,
        operation_variant: input.authority.operation_variant,
      })]);
      const existing = await inspectWithClientV1(client, input.authority);
      if (existing.disposition === "ALREADY_COMPLETE_EXACT") {
        await client.query("COMMIT");
        return {
          disposition: "ALREADY_COMPLETE_EXACT",
          write_status: "EXISTING_IDEMPOTENT_SET",
          authority: existing.authority,
          corrected_set: existing.corrected_set,
          write_delta: 0,
        };
      }

      await validateExternalBindingsV1(client, input.authority);
      inject("before_facts");
      for (const object of correctedObjectsV1(input.corrected_set)) {
        await client.query(
          `INSERT INTO facts (fact_id,occurred_at,source,record_json)
           VALUES ($1,$2::timestamptz,$3,$4::jsonb)`,
          [factIdV1(object.object_id), object.logical_time, CAP08_S4_FACT_SOURCE_V1, recordJsonV1(object)],
        );
      }
      inject("before_idempotency_guard");
      await client.query(
        `INSERT INTO twin_object_idempotency_index_v1
         (identity_kind,idempotency_key,record_set_id,determinism_hash,
          identity_basis,member_object_ids,member_determinism_hashes)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb)`,
        [
          CAP08_S4_IDENTITY_KIND_V1,
          input.authority.idempotency_key,
          input.authority.authority_ref,
          input.authority.determinism_hash,
          JSON.stringify({
            schema_version: input.authority.schema_version,
            contract_id: input.authority.contract_id,
            identity_input: input.authority.identity_input,
          }),
          JSON.stringify(correctedBindingsV1(input.authority).map((binding) => binding.ref)),
          JSON.stringify(correctedHashesV1(input.authority)),
        ],
      );
      inject("before_authority");
      await client.query(
        `INSERT INTO twin_runtime_authority_snapshot_v1
         (authority_kind,authority_ref,determinism_hash,semantic_payload)
         VALUES ($1,$2,$3,$4::jsonb)`,
        [CAP08_S4_AUTHORITY_KIND_V1, input.authority.authority_ref,
          input.authority.determinism_hash, JSON.stringify(input.authority)],
      );
      inject("before_final_readback");
      const exact = await inspectWithClientV1(client, input.authority);
      if (exact.disposition !== "ALREADY_COMPLETE_EXACT") {
        throw new Error("CAP08_S4_APPEND_FORWARD_FINAL_READBACK_FAILED");
      }
      inject("before_commit");
      await client.query("COMMIT");
      return {
        disposition: "ALREADY_COMPLETE_EXACT",
        write_status: "INSERTED_ATOMIC_SET",
        authority: exact.authority,
        corrected_set: exact.corrected_set,
        write_delta: 7,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
