// Purpose: atomically persist and exactly inspect the CAP-08 S5 24-Residual set and final Residual/Calibration/Shadow completion authority.
// Boundary: bounded PostgreSQL persistence only; no residual math, calibration/shadow compute, Model Activation, active-config, State/checkpoint pointer, route or scheduler authority.

import type { Pool, PoolClient } from "pg";
import { canonicalJsonV1 } from "../../domain/twin_runtime/canonical_json_v1.js";
import { validateCap05ForecastResidualV1, type Cap05ForecastResidualEnvelopeV1 } from "../../domain/twin_runtime/forecast_observation_residual_v1.js";
import {
  CAP08_S5_AUTHORITY_KIND_V1,
  CAP08_S5_COMPLETION_SCHEMA_VERSION_V1,
  CAP08_S5_RESIDUAL_SET_SCHEMA_VERSION_V1,
  validateCap08S5CompletionAuthorityV1,
  validateCap08S5ResidualSetAuthorityV1,
  type Cap08S5CompletionAuthorityV1,
  type Cap08S5ResidualSetAuthorityV1,
} from "../../domain/twin_runtime/cap08_s5_residual_calibration_shadow_contracts_v1.js";
import type { Cap06GovernanceObjectV1 } from "../calibration/postgres_calibration_governance_repository_v1.js";

export const CAP08_S5_IDENTITY_KIND_V1 = "OBJECT" as const;
export const CAP08_S5_RESIDUAL_FACT_SOURCE_V1 = "mcft_cap08_s5_residual_set_v1" as const;

type ResidualInspectionV1 =
  | { disposition: "NOT_ESTABLISHED"; authority: null; residuals: null; write_delta: 0 }
  | { disposition: "ALREADY_COMPLETE_EXACT"; authority: Cap08S5ResidualSetAuthorityV1; residuals: Cap05ForecastResidualEnvelopeV1[]; write_delta: 0 };
type CompletionInspectionV1 =
  | { disposition: "NOT_ESTABLISHED"; authority: null; write_delta: 0 }
  | { disposition: "ALREADY_COMPLETE_EXACT"; authority: Cap08S5CompletionAuthorityV1; write_delta: 0 };

function record(value: unknown, code: string): Record<string, unknown> {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(code);
  return parsed as Record<string, unknown>;
}
function factId(objectId: string): string { return `fact_${objectId}`; }
function recordJson(object: Cap05ForecastResidualEnvelopeV1): string {
  return JSON.stringify({ type: object.object_type, payload: object });
}
function parseResidual(value: unknown): Cap05ForecastResidualEnvelopeV1 {
  const outer = record(value, "CAP08_S5_RESIDUAL_FACT_INVALID");
  if (outer.type !== "twin_forecast_residual_v1") throw new Error("CAP08_S5_RESIDUAL_FACT_TYPE_MISMATCH");
  const residual = structuredClone(record(outer.payload, "CAP08_S5_RESIDUAL_PAYLOAD_REQUIRED")) as unknown as Cap05ForecastResidualEnvelopeV1;
  validateCap05ForecastResidualV1(residual);
  return residual;
}

async function readAuthority(client: PoolClient, schema: string, ref: string): Promise<{determinism_hash:string;semantic_payload:unknown}|null> {
  const result = await client.query(
    `SELECT determinism_hash,semantic_payload FROM twin_runtime_authority_snapshot_v1
     WHERE authority_kind=$1 AND authority_ref=$2 AND semantic_payload->>'schema_version'=$3`,
    [CAP08_S5_AUTHORITY_KIND_V1, ref, schema],
  );
  if (result.rows.length === 0) return null;
  if (result.rows.length !== 1) throw new Error("CAP08_S5_AUTHORITY_CARDINALITY");
  return result.rows[0] as {determinism_hash:string;semantic_payload:unknown};
}
async function readGuard(client: PoolClient, key: string): Promise<Record<string, unknown>|null> {
  const result = await client.query(
    `SELECT identity_kind,record_set_id,determinism_hash,identity_basis,member_object_ids,member_determinism_hashes
     FROM twin_object_idempotency_index_v1 WHERE idempotency_key=$1`, [key]);
  if (result.rows.length === 0) return null;
  if (result.rows.length !== 1) throw new Error("CAP08_S5_GUARD_CARDINALITY");
  return result.rows[0] as Record<string, unknown>;
}
async function readResiduals(client: PoolClient, ids: readonly string[]): Promise<Map<string, Cap05ForecastResidualEnvelopeV1>> {
  const result = await client.query(
    `SELECT record_json FROM facts WHERE record_json->>'type'='twin_forecast_residual_v1'
       AND record_json->'payload'->>'object_id'=ANY($1::text[]) ORDER BY fact_id`, [[...ids]]);
  const map = new Map<string, Cap05ForecastResidualEnvelopeV1>();
  for (const row of result.rows) {
    const residual = parseResidual(row.record_json);
    if (map.has(residual.object_id)) throw new Error("CAP08_S5_RESIDUAL_OBJECT_NOT_UNIQUE");
    map.set(residual.object_id, residual);
  }
  return map;
}
async function readGovernanceObject(client: PoolClient, ref: string): Promise<Cap06GovernanceObjectV1|null> {
  const result = await client.query(
    `SELECT record_json FROM facts WHERE record_json->'payload'->>'object_id'=$1
       AND record_json->>'type' IN ('twin_calibration_candidate_v1','twin_shadow_evaluation_v1') LIMIT 2`, [ref]);
  if (result.rows.length === 0) return null;
  if (result.rows.length !== 1) throw new Error("CAP08_S5_GOVERNANCE_OBJECT_CARDINALITY");
  const outer = record(result.rows[0].record_json, "CAP08_S5_GOVERNANCE_FACT_INVALID");
  return structuredClone(record(outer.payload, "CAP08_S5_GOVERNANCE_PAYLOAD_REQUIRED")) as unknown as Cap06GovernanceObjectV1;
}

async function inspectResidualWithClient(client: PoolClient, requested: Cap08S5ResidualSetAuthorityV1): Promise<ResidualInspectionV1> {
  const ids = requested.ordered_residuals.map((item) => item.ref);
  const [authorityRow, guard, facts] = await Promise.all([
    readAuthority(client, CAP08_S5_RESIDUAL_SET_SCHEMA_VERSION_V1, requested.authority_ref),
    readGuard(client, requested.idempotency_key),
    readResiduals(client, ids),
  ]);
  const presence = Number(Boolean(authorityRow)) + Number(Boolean(guard)) + facts.size;
  if (presence === 0) return { disposition: "NOT_ESTABLISHED", authority: null, residuals: null, write_delta: 0 };
  if (!authorityRow || !guard || facts.size !== 24) throw new Error("CAP08_S5_RESIDUAL_SET_PARTIAL");
  const authority = structuredClone(record(authorityRow.semantic_payload, "CAP08_S5_RESIDUAL_AUTHORITY_INVALID")) as unknown as Cap08S5ResidualSetAuthorityV1;
  if (authority.determinism_hash !== authorityRow.determinism_hash
    || authority.authority_ref !== requested.authority_ref
    || canonicalJsonV1(authority.identity_input) !== canonicalJsonV1(requested.identity_input)) {
    throw new Error("CAP08_S5_RESIDUAL_AUTHORITY_CONFLICT");
  }
  const ordered = authority.ordered_residuals.map((binding) => {
    const residual = facts.get(binding.ref);
    if (!residual || residual.determinism_hash !== binding.hash) throw new Error("CAP08_S5_RESIDUAL_BINDING_CONFLICT");
    return residual;
  });
  validateCap08S5ResidualSetAuthorityV1({ authority, residuals: ordered });
  const basis = record(guard.identity_basis, "CAP08_S5_RESIDUAL_GUARD_BASIS_INVALID");
  const memberIds = Array.isArray(guard.member_object_ids) ? guard.member_object_ids : [];
  const memberHashes = record(guard.member_determinism_hashes, "CAP08_S5_RESIDUAL_GUARD_HASHES_INVALID");
  const expectedHashes = Object.fromEntries(authority.ordered_residuals.map((item) => [item.ref, item.hash]));
  if (guard.identity_kind !== CAP08_S5_IDENTITY_KIND_V1
    || guard.record_set_id !== authority.authority_ref
    || guard.determinism_hash !== authority.determinism_hash
    || basis.schema_version !== authority.schema_version
    || canonicalJsonV1(basis.identity_input) !== canonicalJsonV1(authority.identity_input)
    || canonicalJsonV1([...memberIds].sort()) !== canonicalJsonV1(ids.sort())
    || canonicalJsonV1(memberHashes) !== canonicalJsonV1(expectedHashes)) {
    throw new Error("CAP08_S5_RESIDUAL_GUARD_CONFLICT");
  }
  return { disposition: "ALREADY_COMPLETE_EXACT", authority, residuals: ordered, write_delta: 0 };
}

async function inspectCompletionWithClient(client: PoolClient, requested: Cap08S5CompletionAuthorityV1): Promise<CompletionInspectionV1> {
  const [authorityRow, guard, candidate, shadow] = await Promise.all([
    readAuthority(client, CAP08_S5_COMPLETION_SCHEMA_VERSION_V1, requested.authority_ref),
    readGuard(client, requested.idempotency_key),
    readGovernanceObject(client, requested.calibration_candidate.ref),
    readGovernanceObject(client, requested.shadow_evaluation.ref),
  ]);
  const presence = Number(Boolean(authorityRow)) + Number(Boolean(guard));
  if (presence === 0) return { disposition: "NOT_ESTABLISHED", authority: null, write_delta: 0 };
  if (!authorityRow || !guard) throw new Error("CAP08_S5_COMPLETION_PARTIAL");
  const authority = structuredClone(record(authorityRow.semantic_payload, "CAP08_S5_COMPLETION_AUTHORITY_INVALID")) as unknown as Cap08S5CompletionAuthorityV1;
  validateCap08S5CompletionAuthorityV1(authority);
  if (authority.determinism_hash !== authorityRow.determinism_hash
    || authority.authority_ref !== requested.authority_ref
    || authority.determinism_hash !== requested.determinism_hash) throw new Error("CAP08_S5_COMPLETION_AUTHORITY_CONFLICT");
  if (!candidate || candidate.object_type !== "twin_calibration_candidate_v1"
    || candidate.object_id !== authority.calibration_candidate.ref
    || candidate.determinism_hash !== authority.calibration_candidate.hash) throw new Error("CAP08_S5_COMPLETION_CANDIDATE_BINDING_MISMATCH");
  if (!shadow || shadow.object_type !== "twin_shadow_evaluation_v1"
    || shadow.object_id !== authority.shadow_evaluation.ref
    || shadow.determinism_hash !== authority.shadow_evaluation.hash) throw new Error("CAP08_S5_COMPLETION_SHADOW_BINDING_MISMATCH");
  const residualAuthority = await readAuthority(client, CAP08_S5_RESIDUAL_SET_SCHEMA_VERSION_V1, authority.residual_set.ref);
  if (!residualAuthority || residualAuthority.determinism_hash !== authority.residual_set.hash) throw new Error("CAP08_S5_COMPLETION_RESIDUAL_BINDING_MISMATCH");
  const memberIds = Array.isArray(guard.member_object_ids) ? guard.member_object_ids : [];
  const expectedIds = [candidate.object_id, shadow.object_id].sort();
  if (guard.identity_kind !== CAP08_S5_IDENTITY_KIND_V1
    || guard.record_set_id !== authority.authority_ref
    || guard.determinism_hash !== authority.determinism_hash
    || canonicalJsonV1([...memberIds].sort()) !== canonicalJsonV1(expectedIds)) {
    throw new Error("CAP08_S5_COMPLETION_GUARD_CONFLICT");
  }
  return { disposition: "ALREADY_COMPLETE_EXACT", authority, write_delta: 0 };
}

export class PostgresCap08S5ResidualCalibrationShadowRepositoryV1 {
  constructor(private readonly pool: Pool) {}

  async inspectResidualSet(authority: Cap08S5ResidualSetAuthorityV1): Promise<ResidualInspectionV1> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const result = await inspectResidualWithClient(client, authority);
      await client.query("COMMIT");
      return result;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  async establishResidualSet(input: {
    authority: Cap08S5ResidualSetAuthorityV1;
    residuals: readonly Cap05ForecastResidualEnvelopeV1[];
    fault_injection?: (stage: string) => void;
  }): Promise<{status:"INSERTED_ATOMIC_SET"|"EXISTING_IDEMPOTENT_SET";authority:Cap08S5ResidualSetAuthorityV1;residuals:Cap05ForecastResidualEnvelopeV1[];write_delta:0|26}> {
    validateCap08S5ResidualSetAuthorityV1(input);
    const client = await this.pool.connect();
    const inject = (stage: string): void => input.fault_injection?.(stage);
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [canonicalJsonV1(input.authority.identity_input)]);
      const existing = await inspectResidualWithClient(client, input.authority);
      if (existing.disposition === "ALREADY_COMPLETE_EXACT") {
        await client.query("COMMIT");
        return { status:"EXISTING_IDEMPOTENT_SET", authority:existing.authority, residuals:existing.residuals, write_delta:0 };
      }
      inject("before_residual_facts");
      for (const residual of input.residuals) {
        await client.query(
          `INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,$3,$4::jsonb)`,
          [factId(residual.object_id), residual.logical_time, CAP08_S5_RESIDUAL_FACT_SOURCE_V1, recordJson(residual)],
        );
      }
      inject("before_residual_guard");
      const ids = input.authority.ordered_residuals.map((item) => item.ref);
      const hashes = Object.fromEntries(input.authority.ordered_residuals.map((item) => [item.ref, item.hash]));
      await client.query(
        `INSERT INTO twin_object_idempotency_index_v1
         (identity_kind,idempotency_key,record_set_id,determinism_hash,identity_basis,member_object_ids,member_determinism_hashes)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb)`,
        [CAP08_S5_IDENTITY_KIND_V1,input.authority.idempotency_key,input.authority.authority_ref,input.authority.determinism_hash,
          JSON.stringify({schema_version:input.authority.schema_version,contract_id:input.authority.contract_id,identity_input:input.authority.identity_input}),
          JSON.stringify(ids),JSON.stringify(hashes)],
      );
      inject("before_residual_authority");
      await client.query(
        `INSERT INTO twin_runtime_authority_snapshot_v1 (authority_kind,authority_ref,determinism_hash,semantic_payload)
         VALUES ($1,$2,$3,$4::jsonb)`,
        [CAP08_S5_AUTHORITY_KIND_V1,input.authority.authority_ref,input.authority.determinism_hash,JSON.stringify(input.authority)],
      );
      inject("before_residual_readback");
      const exact = await inspectResidualWithClient(client, input.authority);
      if (exact.disposition !== "ALREADY_COMPLETE_EXACT") throw new Error("CAP08_S5_RESIDUAL_FINAL_READBACK_FAILED");
      inject("before_residual_commit");
      await client.query("COMMIT");
      return { status:"INSERTED_ATOMIC_SET", authority:exact.authority, residuals:exact.residuals, write_delta:26 };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  async inspectCompletion(authority: Cap08S5CompletionAuthorityV1): Promise<CompletionInspectionV1> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const result = await inspectCompletionWithClient(client, authority);
      await client.query("COMMIT");
      return result;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  async establishCompletion(input: {authority:Cap08S5CompletionAuthorityV1;fault_injection?:(stage:string)=>void}): Promise<{status:"INSERTED_ATOMIC_SET"|"EXISTING_IDEMPOTENT_SET";authority:Cap08S5CompletionAuthorityV1;write_delta:0|2}> {
    validateCap08S5CompletionAuthorityV1(input.authority);
    const client = await this.pool.connect();
    const inject = (stage:string):void => input.fault_injection?.(stage);
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [input.authority.idempotency_key]);
      const existing = await inspectCompletionWithClient(client, input.authority);
      if (existing.disposition === "ALREADY_COMPLETE_EXACT") {
        await client.query("COMMIT");
        return {status:"EXISTING_IDEMPOTENT_SET",authority:existing.authority,write_delta:0};
      }
      inject("before_completion_guard");
      const ids = [input.authority.calibration_candidate.ref,input.authority.shadow_evaluation.ref];
      const hashes = Object.fromEntries([[input.authority.calibration_candidate.ref,input.authority.calibration_candidate.hash],[input.authority.shadow_evaluation.ref,input.authority.shadow_evaluation.hash]]);
      await client.query(
        `INSERT INTO twin_object_idempotency_index_v1
         (identity_kind,idempotency_key,record_set_id,determinism_hash,identity_basis,member_object_ids,member_determinism_hashes)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb)`,
        [CAP08_S5_IDENTITY_KIND_V1,input.authority.idempotency_key,input.authority.authority_ref,input.authority.determinism_hash,
          JSON.stringify({schema_version:input.authority.schema_version,contract_id:input.authority.contract_id,residual_set:input.authority.residual_set}),
          JSON.stringify(ids),JSON.stringify(hashes)],
      );
      inject("before_completion_authority");
      await client.query(
        `INSERT INTO twin_runtime_authority_snapshot_v1 (authority_kind,authority_ref,determinism_hash,semantic_payload)
         VALUES ($1,$2,$3,$4::jsonb)`,
        [CAP08_S5_AUTHORITY_KIND_V1,input.authority.authority_ref,input.authority.determinism_hash,JSON.stringify(input.authority)],
      );
      inject("before_completion_readback");
      const exact = await inspectCompletionWithClient(client,input.authority);
      if (exact.disposition !== "ALREADY_COMPLETE_EXACT") throw new Error("CAP08_S5_COMPLETION_FINAL_READBACK_FAILED");
      inject("before_completion_commit");
      await client.query("COMMIT");
      return {status:"INSERTED_ATOMIC_SET",authority:exact.authority,write_delta:2};
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
}
