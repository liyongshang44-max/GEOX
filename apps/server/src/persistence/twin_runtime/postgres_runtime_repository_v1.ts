// apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts
// Purpose: implement MCFT-CAP-01 Runtime Config persistence and the fenced, idempotent, atomic A0 repository transaction.
// Boundary: persistence only; no State equations, Evidence selection, uncertainty math, Forecast prerequisite policy, routes, or web concerns.

import type { Pool, PoolClient } from "pg";
import { validateA0RecordSetV1, validateCanonicalObjectV1, type A0RecordSetV1, type CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import { buildA0ProjectionRowsV1, type CanonicalFactReadV1 } from "../../projections/twin_runtime/projection_rebuilder_v1.js";
import type { BootstrapPersistencePortV1, RuntimeConfigRepositoryPortV1, RuntimeLeaseClaimV1, TwinScopeKeyV1 } from "../../runtime/twin_runtime/ports.js";

function factId(objectId: string): string { return `fact_${objectId}`; }
function recordJson(object: CanonicalObjectEnvelopeV1): string { return JSON.stringify({ type: object.object_type, payload: object }); }
function parseFactObject(recordJsonValue: unknown): CanonicalObjectEnvelopeV1 {
  const parsed = typeof recordJsonValue === "string" ? JSON.parse(recordJsonValue) : recordJsonValue;
  return (parsed as { payload: CanonicalObjectEnvelopeV1 }).payload;
}
function scopeValues(scope: TwinScopeKeyV1): unknown[] { return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id]; }

export class PostgresRuntimeRepositoryV1 implements RuntimeConfigRepositoryPortV1, BootstrapPersistencePortV1 {
  constructor(private readonly pool: Pool) {}

  async commitRuntimeConfig(config: CanonicalObjectEnvelopeV1) {
    validateCanonicalObjectV1(config);
    if (config.object_type !== "twin_runtime_config_v1") throw new Error("RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query("SELECT determinism_hash,semantic_object_id FROM twin_object_idempotency_index_v1 WHERE idempotency_key=$1 FOR UPDATE", [config.idempotency_key]);
      if (existing.rows.length) {
        if (existing.rows[0].determinism_hash !== config.determinism_hash || existing.rows[0].semantic_object_id !== config.object_id) throw new Error("IDEMPOTENCY_CONFLICT");
        const fact = await client.query("SELECT record_json FROM facts WHERE record_json->>'type'='twin_runtime_config_v1' AND record_json->'payload'->>'object_id'=$1 LIMIT 1", [config.object_id]);
        if (fact.rows.length !== 1) throw new Error("IDEMPOTENT_RUNTIME_CONFIG_INCOMPLETE");
        const existingConfig = parseFactObject(fact.rows[0].record_json);
        validateCanonicalObjectV1(existingConfig);
        if (existingConfig.determinism_hash !== config.determinism_hash) throw new Error("IDEMPOTENCY_CONFLICT");
        await client.query("COMMIT");
        return { status: "EXISTING_IDEMPOTENT_SUCCESS" as const, object_id: config.object_id, fact_id: factId(config.object_id) };
      }
      await client.query("INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,'system',$3::jsonb)", [factId(config.object_id), config.logical_time, recordJson(config)]);
      await client.query("INSERT INTO twin_object_idempotency_index_v1 (identity_kind,idempotency_key,semantic_object_id,determinism_hash) VALUES ('RUNTIME_CONFIG',$1,$2,$3)", [config.idempotency_key, config.object_id, config.determinism_hash]);
      await client.query("COMMIT");
      return { status: "INSERTED" as const, object_id: config.object_id, fact_id: factId(config.object_id) };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async readRuntimeConfig(objectId: string): Promise<CanonicalObjectEnvelopeV1 | null> {
    const result = await this.pool.query("SELECT record_json FROM facts WHERE record_json->>'type'='twin_runtime_config_v1' AND record_json->'payload'->>'object_id'=$1 LIMIT 1", [objectId]);
    if (!result.rows.length) return null;
    const config = parseFactObject(result.rows[0].record_json);
    validateCanonicalObjectV1(config);
    return config;
  }

  async acquireLease(claim: Omit<RuntimeLeaseClaimV1, "fencing_token">): Promise<RuntimeLeaseClaimV1> {
    const result = await this.pool.query(`INSERT INTO twin_runtime_lease_v1 (tenant_id,project_id,group_id,field_id,season_id,zone_id,lease_owner,fencing_token,acquired_at,expires_at,heartbeat_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,1,transaction_timestamp(),transaction_timestamp()+make_interval(secs=>$8),transaction_timestamp())
      ON CONFLICT (tenant_id,project_id,group_id,field_id,season_id,zone_id) DO UPDATE SET lease_owner=EXCLUDED.lease_owner,fencing_token=twin_runtime_lease_v1.fencing_token+1,acquired_at=transaction_timestamp(),expires_at=transaction_timestamp()+make_interval(secs=>$8),heartbeat_at=transaction_timestamp()
      WHERE twin_runtime_lease_v1.expires_at<=transaction_timestamp() OR twin_runtime_lease_v1.lease_owner=EXCLUDED.lease_owner
      RETURNING fencing_token`, [...scopeValues(claim), claim.lease_owner, claim.lease_duration_seconds]);
    if (!result.rows.length) throw new Error("LEASE_HELD_BY_OTHER_OWNER");
    return { ...claim, fencing_token: BigInt(result.rows[0].fencing_token) };
  }

  async lookupA0RecordSet(idempotencyKey: string): Promise<A0RecordSetV1 | null> {
    const guard = await this.pool.query("SELECT record_set_id FROM twin_object_idempotency_index_v1 WHERE identity_kind='A0_RECORD_SET' AND idempotency_key=$1", [idempotencyKey]);
    return guard.rows.length ? this.readBootstrapRecordSet(guard.rows[0].record_set_id) : null;
  }

  private async verifyLease(client: PoolClient, scope: TwinScopeKeyV1, lease: RuntimeLeaseClaimV1): Promise<void> {
    const result = await client.query("SELECT lease_owner,fencing_token,expires_at>transaction_timestamp() AS valid FROM twin_runtime_lease_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 FOR UPDATE", scopeValues(scope));
    if (!result.rows.length || result.rows[0].lease_owner !== lease.lease_owner) throw new Error("LEASE_OWNER_MISMATCH");
    if (BigInt(result.rows[0].fencing_token) !== lease.fencing_token) throw new Error("STALE_FENCING_TOKEN");
    if (!result.rows[0].valid) throw new Error("LEASE_EXPIRED");
  }

  private async verifyRuntimeConfig(client: PoolClient, recordSet: A0RecordSetV1): Promise<void> {
    const refs = new Set(recordSet.members.map((member) => member.runtime_config_ref).filter((value): value is string => Boolean(value)));
    const hashes = new Set(recordSet.members.map((member) => member.runtime_config_hash).filter((value): value is string => Boolean(value)));
    if (refs.size !== 1 || hashes.size !== 1) throw new Error("A0_RUNTIME_CONFIG_REFERENCE_MISMATCH");
    const [runtimeConfigRef] = [...refs];
    const [runtimeConfigHash] = [...hashes];
    if (runtimeConfigHash !== recordSet.a0_identity_input.runtime_config_hash) throw new Error("A0_RUNTIME_CONFIG_HASH_MISMATCH");
    const fact = await client.query("SELECT record_json FROM facts WHERE record_json->>'type'='twin_runtime_config_v1' AND record_json->'payload'->>'object_id'=$1 LIMIT 1", [runtimeConfigRef]);
    if (fact.rows.length !== 1) throw new Error("RUNTIME_CONFIG_NOT_FOUND");
    const config = parseFactObject(fact.rows[0].record_json);
    validateCanonicalObjectV1(config);
    if (config.determinism_hash !== runtimeConfigHash) throw new Error("RUNTIME_CONFIG_HASH_MISMATCH");
  }

  async commitBootstrapState(input: Parameters<BootstrapPersistencePortV1["commitBootstrapState"]>[0]) {
    validateA0RecordSetV1(input.record_set);
    const client = await this.pool.connect();
    const inject = (stage: string) => input.fault_injection?.(stage);
    try {
      await client.query("BEGIN");
      const existing = await client.query("SELECT record_set_id,determinism_hash FROM twin_object_idempotency_index_v1 WHERE identity_kind='A0_RECORD_SET' AND idempotency_key=$1 FOR UPDATE", [input.record_set.a0_idempotency_key]);
      if (existing.rows.length) {
        if (existing.rows[0].record_set_id !== input.record_set.a0_record_set_id || existing.rows[0].determinism_hash !== input.record_set.a0_record_set_determinism_hash) throw new Error("IDEMPOTENCY_CONFLICT");
        const recordSet = await this.readBootstrapRecordSetWithClient(client, input.record_set.a0_record_set_id);
        if (!recordSet) throw new Error("IDEMPOTENT_RECORD_SET_INCOMPLETE");
        validateA0RecordSetV1(recordSet);
        if (recordSet.a0_record_set_determinism_hash !== input.record_set.a0_record_set_determinism_hash) throw new Error("IDEMPOTENCY_CONFLICT");
        await client.query("COMMIT");
        return { status: "EXISTING_IDEMPOTENT_SUCCESS" as const, record_set: recordSet, fact_ids_by_object_id: Object.fromEntries(recordSet.members.map((member) => [member.object_id, factId(member.object_id)])) };
      }

      await this.verifyLease(client, input.scope, input.lease);
      await this.verifyRuntimeConfig(client, input.record_set);
      const initial = await client.query("SELECT 1 FROM facts WHERE record_json->>'type'='twin_runtime_lineage_v1' AND record_json->'payload'->'payload'->>'lineage_kind'='INITIAL' AND record_json->'payload'->>'tenant_id'=$1 AND record_json->'payload'->>'project_id'=$2 AND record_json->'payload'->>'group_id'=$3 AND record_json->'payload'->>'field_id'=$4 AND record_json->'payload'->>'season_id'=$5 AND record_json->'payload'->>'zone_id'=$6 LIMIT 1", scopeValues(input.scope));
      if (initial.rows.length) throw new Error("INITIAL_LINEAGE_CONFLICT");
      for (const table of ["twin_active_lineage_index_v1","twin_state_latest_index_v1","twin_forecast_result_latest_index_v1","twin_forecast_success_latest_index_v1","twin_runtime_checkpoint_latest_index_v1"]) {
        const pointer = await client.query(`SELECT 1 FROM ${table} WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 LIMIT 1`, scopeValues(input.scope));
        if (pointer.rows.length) throw new Error(`${table.toUpperCase()}_NULL_CAS_CONFLICT`);
      }

      const factIds: Record<string, string> = {};
      const factReads: CanonicalFactReadV1[] = [];
      for (let index = 0; index < input.record_set.members.length; index += 1) {
        const object = input.record_set.members[index];
        inject(`before_fact_${index + 1}_${object.object_type}`);
        const id = factId(object.object_id);
        factIds[object.object_id] = id;
        await client.query("INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,'system',$3::jsonb)", [id, object.logical_time, recordJson(object)]);
        factReads.push({ fact_id: id, object });
      }

      const rows = buildA0ProjectionRowsV1(factReads);
      inject("before_active_lineage_projection");
      await client.query("INSERT INTO twin_active_lineage_index_v1 (tenant_id,project_id,group_id,field_id,season_id,zone_id,active_lineage_ref,activation_authority_kind,activation_authority_ref,expected_previous_active_lineage) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL)", [...scopeValues(input.scope), rows.active_lineage.active_lineage_ref, rows.active_lineage.activation_authority_kind, rows.active_lineage.activation_authority_ref]);
      inject("before_state_history_projection");
      await client.query("INSERT INTO twin_state_history_projection_v1 (state_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,logical_time,determinism_hash,canonical_payload,source_fact_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12::jsonb,$13)", [rows.state_history.state_object_id,...scopeValues(input.scope),rows.state_history.lineage_id,rows.state_history.revision_id,rows.state_history.logical_time,rows.state_history.determinism_hash,JSON.stringify(rows.state_history.canonical_payload),rows.state_history.source_fact_id]);
      inject("before_state_latest_projection");
      await client.query("INSERT INTO twin_state_latest_index_v1 (tenant_id,project_id,group_id,field_id,season_id,zone_id,state_object_id,lineage_id,revision_id,logical_time,determinism_hash,source_fact_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12)", [...scopeValues(input.scope),rows.state_latest.state_object_id,rows.state_latest.lineage_id,rows.state_latest.revision_id,rows.state_latest.logical_time,rows.state_latest.determinism_hash,rows.state_latest.source_fact_id]);
      inject("before_forecast_result_projection");
      await client.query("INSERT INTO twin_forecast_result_latest_index_v1 (tenant_id,project_id,group_id,field_id,season_id,zone_id,forecast_object_id,forecast_status,logical_time,determinism_hash,source_fact_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10,$11)", [...scopeValues(input.scope),rows.forecast_result_latest.forecast_object_id,rows.forecast_result_latest.forecast_status,rows.forecast_result_latest.logical_time,rows.forecast_result_latest.determinism_hash,rows.forecast_result_latest.source_fact_id]);
      inject("before_checkpoint_projection");
      await client.query("INSERT INTO twin_runtime_checkpoint_latest_index_v1 (tenant_id,project_id,group_id,field_id,season_id,zone_id,checkpoint_object_id,lineage_id,revision_id,logical_time,determinism_hash,source_fact_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12)", [...scopeValues(input.scope),rows.checkpoint_latest.checkpoint_object_id,rows.checkpoint_latest.lineage_id,rows.checkpoint_latest.revision_id,rows.checkpoint_latest.logical_time,rows.checkpoint_latest.determinism_hash,rows.checkpoint_latest.source_fact_id]);
      inject("before_health_projection");
      await client.query("INSERT INTO twin_runtime_health_latest_index_v1 (tenant_id,project_id,group_id,field_id,season_id,zone_id,health_object_id,operation_status,logical_time,determinism_hash,source_fact_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10,$11)", [...scopeValues(input.scope),rows.runtime_health_latest.health_object_id,rows.runtime_health_latest.operation_status,rows.runtime_health_latest.logical_time,rows.runtime_health_latest.determinism_hash,rows.runtime_health_latest.source_fact_id]);
      inject("before_idempotency_index");
      await client.query("INSERT INTO twin_object_idempotency_index_v1 (identity_kind,idempotency_key,record_set_id,determinism_hash,identity_basis,member_object_ids,member_determinism_hashes) VALUES ('A0_RECORD_SET',$1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)", [input.record_set.a0_idempotency_key,input.record_set.a0_record_set_id,input.record_set.a0_record_set_determinism_hash,JSON.stringify({ a0_identity_input: input.record_set.a0_identity_input, a0_semantic_seed: input.record_set.a0_semantic_seed }),JSON.stringify(input.record_set.members.map((member) => member.object_id)),JSON.stringify(Object.fromEntries(input.record_set.members.map((member) => [member.object_id,member.determinism_hash])))]);
      inject("before_commit");
      await client.query("COMMIT");
      return { status: "INSERTED" as const, record_set: input.record_set, fact_ids_by_object_id: factIds };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async readBootstrapRecordSetWithClient(client: PoolClient, recordSetId: string): Promise<A0RecordSetV1 | null> {
    const guard = await client.query("SELECT idempotency_key,determinism_hash,identity_basis,member_object_ids FROM twin_object_idempotency_index_v1 WHERE identity_kind='A0_RECORD_SET' AND record_set_id=$1", [recordSetId]);
    if (!guard.rows.length || !guard.rows[0].identity_basis) return null;
    const ids: string[] = guard.rows[0].member_object_ids;
    const facts = await client.query("SELECT record_json FROM facts WHERE record_json->'payload'->>'object_id'=ANY($1::text[])", [ids]);
    if (facts.rows.length !== 9) return null;
    const members = facts.rows.map((row) => parseFactObject(row.record_json));
    const recordSet: A0RecordSetV1 = {
      a0_identity_input: guard.rows[0].identity_basis.a0_identity_input,
      a0_semantic_seed: guard.rows[0].identity_basis.a0_semantic_seed,
      a0_record_set_id: recordSetId,
      a0_idempotency_key: guard.rows[0].idempotency_key,
      a0_record_set_determinism_hash: guard.rows[0].determinism_hash,
      members,
    };
    validateA0RecordSetV1(recordSet);
    return recordSet;
  }

  async readBootstrapRecordSet(recordSetId: string): Promise<A0RecordSetV1 | null> {
    const client = await this.pool.connect();
    try {
      return await this.readBootstrapRecordSetWithClient(client, recordSetId);
    } finally {
      client.release();
    }
  }
}
