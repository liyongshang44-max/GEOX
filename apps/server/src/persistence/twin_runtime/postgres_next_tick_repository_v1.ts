// apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts
// Purpose: persist immutable Reality Binding Runtime snapshots and reconstruct one consistent next-tick snapshot from PostgreSQL projections plus canonical facts.
// Boundary: persistence/read-model adapter only; no propagation, Evidence selection, State equations, scheduler, routes, web, or canonical object construction.

import type { Pool, PoolClient } from "pg";
import { validateCanonicalObjectV1, type CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import type { NextTickReadPortV1, PersistedNextTickSnapshotV1, RealityBindingRuntimeSnapshotV1, RuntimeAuthoritySnapshotRepositoryPortV1, TwinScopeKeyV1 } from "../../runtime/twin_runtime/ports.js";

function scopeValuesV1(scope: TwinScopeKeyV1): unknown[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}

function parseFactObjectV1(recordJsonValue: unknown): CanonicalObjectEnvelopeV1 {
  const parsed = typeof recordJsonValue === "string" ? JSON.parse(recordJsonValue) : recordJsonValue;
  const object = (parsed as { payload: CanonicalObjectEnvelopeV1 }).payload;
  validateCanonicalObjectV1(object);
  return object;
}

function canonicalJsonV1(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("NON_FINITE_AUTHORITY_VALUE");
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJsonV1).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalJsonV1((value as Record<string, unknown>)[key])}`).join(",")}}`;
  throw new Error(`UNSUPPORTED_AUTHORITY_VALUE:${typeof value}`);
}

export class PostgresNextTickRepositoryV1 implements RuntimeAuthoritySnapshotRepositoryPortV1, NextTickReadPortV1 {
  constructor(private readonly pool: Pool) {}

  async commitRealityBindingSnapshot(snapshot: RealityBindingRuntimeSnapshotV1): Promise<{ status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS"; binding_id: string }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query("SELECT determinism_hash,semantic_payload FROM twin_runtime_authority_snapshot_v1 WHERE authority_kind='REALITY_BINDING' AND authority_ref=$1 FOR UPDATE", [snapshot.binding_id]);
      if (existing.rows.length) {
        if (existing.rows[0].determinism_hash !== snapshot.determinism_hash || canonicalJsonV1(existing.rows[0].semantic_payload) !== canonicalJsonV1(snapshot)) throw new Error("REALITY_BINDING_SNAPSHOT_CONFLICT");
        await client.query("COMMIT");
        return { status: "EXISTING_IDEMPOTENT_SUCCESS", binding_id: snapshot.binding_id };
      }
      await client.query("INSERT INTO twin_runtime_authority_snapshot_v1 (authority_kind,authority_ref,determinism_hash,semantic_payload) VALUES ('REALITY_BINDING',$1,$2,$3::jsonb)", [snapshot.binding_id, snapshot.determinism_hash, JSON.stringify(snapshot)]);
      await client.query("COMMIT");
      return { status: "INSERTED", binding_id: snapshot.binding_id };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async readRealityBindingSnapshotWithClientV1(client: PoolClient, bindingId: string): Promise<RealityBindingRuntimeSnapshotV1 | null> {
    const result = await client.query("SELECT semantic_payload FROM twin_runtime_authority_snapshot_v1 WHERE authority_kind='REALITY_BINDING' AND authority_ref=$1", [bindingId]);
    return result.rows.length ? result.rows[0].semantic_payload as RealityBindingRuntimeSnapshotV1 : null;
  }

  async readRealityBindingSnapshot(bindingId: string): Promise<RealityBindingRuntimeSnapshotV1 | null> {
    const client = await this.pool.connect();
    try {
      return await this.readRealityBindingSnapshotWithClientV1(client, bindingId);
    } finally {
      client.release();
    }
  }

  private async readCanonicalObjectV1(client: PoolClient, objectId: string, expectedType: CanonicalObjectEnvelopeV1["object_type"]): Promise<CanonicalObjectEnvelopeV1> {
    const result = await client.query("SELECT record_json FROM facts WHERE record_json->'payload'->>'object_id'=$1 AND record_json->>'type'=$2 LIMIT 1", [objectId, expectedType]);
    if (result.rows.length !== 1) throw new Error(`PERSISTED_OBJECT_NOT_FOUND:${expectedType}:${objectId}`);
    const object = parseFactObjectV1(result.rows[0].record_json);
    if (object.object_type !== expectedType) throw new Error(`PERSISTED_OBJECT_TYPE_MISMATCH:${expectedType}:${objectId}`);
    return object;
  }

  async readPersistedNextTickSnapshot(scope: TwinScopeKeyV1): Promise<PersistedNextTickSnapshotV1 | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const active = await client.query("SELECT active_lineage_ref FROM twin_active_lineage_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", scopeValuesV1(scope));
      const checkpointPointer = await client.query("SELECT checkpoint_object_id FROM twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", scopeValuesV1(scope));
      const statePointer = await client.query("SELECT state_object_id FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", scopeValuesV1(scope));
      if (!active.rows.length && !checkpointPointer.rows.length && !statePointer.rows.length) {
        await client.query("COMMIT");
        return null;
      }
      if (active.rows.length !== 1 || checkpointPointer.rows.length !== 1 || statePointer.rows.length !== 1) throw new Error("PERSISTED_NEXT_TICK_POINTER_SET_INCOMPLETE");

      const checkpoint = await this.readCanonicalObjectV1(client, checkpointPointer.rows[0].checkpoint_object_id, "twin_runtime_checkpoint_v1");
      const previousPosterior = await this.readCanonicalObjectV1(client, statePointer.rows[0].state_object_id, "twin_state_estimate_v1");
      if (!previousPosterior.runtime_config_ref || checkpoint.runtime_config_ref !== previousPosterior.runtime_config_ref) throw new Error("PERSISTED_RUNTIME_CONFIG_POINTER_MISMATCH");
      const runtimeConfig = await this.readCanonicalObjectV1(client, previousPosterior.runtime_config_ref, "twin_runtime_config_v1");
      const realityBindingRef = runtimeConfig.payload.reality_binding_ref;
      if (typeof realityBindingRef !== "string" || !realityBindingRef) throw new Error("RUNTIME_CONFIG_REALITY_BINDING_REF_REQUIRED");
      const realityBinding = await this.readRealityBindingSnapshotWithClientV1(client, realityBindingRef);
      if (!realityBinding) throw new Error("PERSISTED_REALITY_BINDING_NOT_FOUND");
      await client.query("COMMIT");
      return {
        active_lineage_ref: active.rows[0].active_lineage_ref,
        checkpoint,
        previous_posterior: previousPosterior,
        runtime_config: runtimeConfig,
        reality_binding: realityBinding,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
