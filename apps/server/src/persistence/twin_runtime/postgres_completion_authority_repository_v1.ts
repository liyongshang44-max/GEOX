// apps/server/src/persistence/twin_runtime/postgres_completion_authority_repository_v1.ts
// Purpose: persist immutable CAP-08 completion authority and inspect one exact terminal Runtime graph from PostgreSQL.
// Boundary: bounded read/authority-snapshot adapter only; no business DDL, canonical writes, routes, scheduler, or production Runtime authority.

import type { Pool, PoolClient } from "pg";
import { canonicalJsonV1 } from "../../domain/twin_runtime/canonical_json_v1.js";
import {
  CAP08_COMPLETION_AUTHORITY_KIND_V1,
  CAP08_COMPLETION_AUTHORITY_SCHEMA_VERSION_V1,
  type Cap08CompletionAuthorityRepositoryPortV1,
  type Cap08CompletionAuthorityV1,
  type Cap08CompletionGraphV1,
  type Cap08CompletionScopeV1,
  type InspectCap08CompletionAuthorityInputV1,
} from "../../domain/twin_runtime/cap08_completion_authority_contracts_v1.js";

type RawEnvelopeV1 = {
  object_id?: unknown;
  object_type?: unknown;
  determinism_hash?: unknown;
  lineage_id?: unknown;
  revision_id?: unknown;
  logical_time?: unknown;
  tenant_id?: unknown;
  project_id?: unknown;
  group_id?: unknown;
  field_id?: unknown;
  season_id?: unknown;
  zone_id?: unknown;
  payload?: unknown;
};

function scopeValuesV1(scope: Cap08CompletionScopeV1): unknown[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}

function parseJsonObjectV1(value: unknown): Record<string, unknown> {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("CAP08_COMPLETION_PERSISTED_OBJECT_REQUIRED");
  return parsed as Record<string, unknown>;
}

function parseEnvelopeV1(recordJson: unknown): RawEnvelopeV1 {
  const record = parseJsonObjectV1(recordJson);
  const payload = record.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("CAP08_COMPLETION_PERSISTED_ENVELOPE_REQUIRED");
  return payload as RawEnvelopeV1;
}

function optionalStringV1(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalIntegerV1(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) return Number(value);
  return null;
}

function payloadObjectV1(envelope: RawEnvelopeV1 | null): Record<string, unknown> {
  const value = envelope?.payload;
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function parseAuthorityV1(value: unknown): Cap08CompletionAuthorityV1 {
  const authority = parseJsonObjectV1(value) as unknown as Cap08CompletionAuthorityV1;
  if (authority.schema_version !== CAP08_COMPLETION_AUTHORITY_SCHEMA_VERSION_V1) throw new Error("CAP08_COMPLETION_AUTHORITY_SCHEMA_INVALID");
  if (authority.authority_kind !== CAP08_COMPLETION_AUTHORITY_KIND_V1) throw new Error("CAP08_COMPLETION_AUTHORITY_KIND_INVALID");
  return authority;
}

export class PostgresCompletionAuthorityRepositoryV1 implements Cap08CompletionAuthorityRepositoryPortV1 {
  constructor(private readonly pool: Pool) {}

  async readAuthority(authorityRef: string): Promise<Cap08CompletionAuthorityV1 | null> {
    const result = await this.pool.query(
      `SELECT semantic_payload
         FROM twin_runtime_authority_snapshot_v1
        WHERE authority_kind=$1 AND authority_ref=$2`,
      [CAP08_COMPLETION_AUTHORITY_KIND_V1, authorityRef],
    );
    if (result.rows.length === 0) return null;
    if (result.rows.length !== 1) throw new Error("CAP08_COMPLETION_AUTHORITY_CARDINALITY");
    const semantic = result.rows[0].semantic_payload;
    const candidate = parseJsonObjectV1(semantic);
    if (candidate.schema_version !== CAP08_COMPLETION_AUTHORITY_SCHEMA_VERSION_V1) return null;
    return parseAuthorityV1(candidate);
  }

  async readAuthoritiesForScope(input: {
    run_contract_id: string;
    scope: Cap08CompletionScopeV1;
  }): Promise<Cap08CompletionAuthorityV1[]> {
    const result = await this.pool.query(
      `SELECT semantic_payload
         FROM twin_runtime_authority_snapshot_v1
        WHERE authority_kind=$1
          AND semantic_payload->>'schema_version'=$2
          AND semantic_payload->>'run_contract_id'=$3
          AND semantic_payload->'scope'->>'tenant_id'=$4
          AND semantic_payload->'scope'->>'project_id'=$5
          AND semantic_payload->'scope'->>'group_id'=$6
          AND semantic_payload->'scope'->>'field_id'=$7
          AND semantic_payload->'scope'->>'season_id'=$8
          AND semantic_payload->'scope'->>'zone_id'=$9
        ORDER BY authority_ref`,
      [
        CAP08_COMPLETION_AUTHORITY_KIND_V1,
        CAP08_COMPLETION_AUTHORITY_SCHEMA_VERSION_V1,
        input.run_contract_id,
        ...scopeValuesV1(input.scope),
      ],
    );
    return result.rows.map((row) => parseAuthorityV1(row.semantic_payload));
  }

  async commitAuthority(authority: Cap08CompletionAuthorityV1): Promise<{
    status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
    authority: Cap08CompletionAuthorityV1;
  }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        `INSERT INTO twin_runtime_authority_snapshot_v1
         (authority_kind,authority_ref,determinism_hash,semantic_payload)
         VALUES ($1,$2,$3,$4::jsonb)
         ON CONFLICT (authority_kind,authority_ref) DO NOTHING
         RETURNING authority_ref`,
        [authority.authority_kind, authority.authority_ref, authority.determinism_hash, JSON.stringify(authority)],
      );
      if (inserted.rows.length === 1) {
        await client.query("COMMIT");
        return { status: "INSERTED", authority: structuredClone(authority) };
      }
      if (inserted.rows.length !== 0) throw new Error("CAP08_COMPLETION_AUTHORITY_INSERT_CARDINALITY");
      const existing = await client.query(
        `SELECT determinism_hash,semantic_payload
           FROM twin_runtime_authority_snapshot_v1
          WHERE authority_kind=$1 AND authority_ref=$2`,
        [authority.authority_kind, authority.authority_ref],
      );
      if (existing.rows.length !== 1) throw new Error("CAP08_COMPLETION_AUTHORITY_CONFLICT");
      const persisted = parseAuthorityV1(existing.rows[0].semantic_payload);
      if (existing.rows[0].determinism_hash !== authority.determinism_hash
        || canonicalJsonV1(persisted) !== canonicalJsonV1(authority)) {
        throw new Error("CAP08_COMPLETION_AUTHORITY_CONFLICT");
      }
      await client.query("COMMIT");
      return { status: "EXISTING_IDEMPOTENT_SUCCESS", authority: persisted };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async readObjectV1(client: PoolClient, objectId: string | null, expectedType: string): Promise<RawEnvelopeV1 | null> {
    if (!objectId) return null;
    const result = await client.query(
      `SELECT record_json
         FROM facts
        WHERE record_json->>'type'=$1
          AND record_json->'payload'->>'object_id'=$2
        LIMIT 2`,
      [expectedType, objectId],
    );
    if (result.rows.length !== 1) return null;
    return parseEnvelopeV1(result.rows[0].record_json);
  }

  private async countFactsV1(client: PoolClient, input: {
    object_type: string;
    scope: Cap08CompletionScopeV1;
    logical_time_from?: string;
    logical_time_to?: string;
    forecast_status?: string;
  }): Promise<number> {
    const parameters: unknown[] = [input.object_type, ...scopeValuesV1(input.scope)];
    const clauses = [
      "record_json->>'type'=$1",
      "record_json->'payload'->>'tenant_id'=$2",
      "record_json->'payload'->>'project_id'=$3",
      "record_json->'payload'->>'group_id'=$4",
      "record_json->'payload'->>'field_id'=$5",
      "record_json->'payload'->>'season_id'=$6",
      "record_json->'payload'->>'zone_id'=$7",
    ];
    if (input.logical_time_from) {
      parameters.push(input.logical_time_from);
      clauses.push(`(record_json->'payload'->>'logical_time')::timestamptz >= $${parameters.length}::timestamptz`);
    }
    if (input.logical_time_to) {
      parameters.push(input.logical_time_to);
      clauses.push(`(record_json->'payload'->>'logical_time')::timestamptz <= $${parameters.length}::timestamptz`);
    }
    if (input.forecast_status) {
      parameters.push(input.forecast_status);
      clauses.push(`record_json->'payload'->'payload'->>'status'=$${parameters.length}`);
    }
    const result = await client.query(`SELECT count(*)::int AS n FROM facts WHERE ${clauses.join(" AND ")}`, parameters);
    return Number(result.rows[0]?.n ?? 0);
  }

  async inspectCompletionGraph(input: InspectCap08CompletionAuthorityInputV1): Promise<Cap08CompletionGraphV1> {
    const client = await this.pool.connect();
    const values = scopeValuesV1(input.scope);
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const active = await client.query(
        `SELECT active_lineage_ref
           FROM twin_active_lineage_index_v1
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
            AND field_id=$4 AND season_id=$5 AND zone_id=$6`, values,
      );
      const checkpointPointer = await client.query(
        `SELECT checkpoint_object_id,lineage_id,revision_id,logical_time,determinism_hash,source_fact_id
           FROM twin_runtime_checkpoint_latest_index_v1
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
            AND field_id=$4 AND season_id=$5 AND zone_id=$6`, values,
      );
      const statePointer = await client.query(
        `SELECT state_object_id,lineage_id,revision_id,logical_time,determinism_hash,source_fact_id
           FROM twin_state_latest_index_v1
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
            AND field_id=$4 AND season_id=$5 AND zone_id=$6`, values,
      );
      const forecastPointer = await client.query(
        `SELECT forecast_object_id,logical_time,determinism_hash,source_fact_id
           FROM twin_forecast_result_latest_index_v1
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
            AND field_id=$4 AND season_id=$5 AND zone_id=$6`, values,
      );
      const present = active.rows.length > 0 || checkpointPointer.rows.length > 0 || statePointer.rows.length > 0 || forecastPointer.rows.length > 0;

      const activeRef = active.rows.length === 1 ? optionalStringV1(active.rows[0].active_lineage_ref) : null;
      const activeLineage = await this.readObjectV1(client, activeRef, "twin_runtime_lineage_v1");
      const checkpointRef = checkpointPointer.rows.length === 1 ? optionalStringV1(checkpointPointer.rows[0].checkpoint_object_id) : null;
      const checkpoint = await this.readObjectV1(client, checkpointRef, "twin_runtime_checkpoint_v1");
      const checkpointPayload = payloadObjectV1(checkpoint);
      const tickRef = optionalStringV1(checkpointPayload.last_completed_tick_ref);
      const stateRef = optionalStringV1(checkpointPayload.last_posterior_state_ref);
      const forecastRef = optionalStringV1(checkpointPayload.forecast_result_ref);
      const tick = await this.readObjectV1(client, tickRef, "twin_runtime_tick_v1");
      const state = await this.readObjectV1(client, stateRef, "twin_state_estimate_v1");
      const forecast = await this.readObjectV1(client, forecastRef, "twin_forecast_run_v1");
      const forecastPayload = payloadObjectV1(forecast);

      const lineageCount = await this.countFactsV1(client, { object_type: "twin_runtime_lineage_v1", scope: input.scope });
      const tickCount = await this.countFactsV1(client, { object_type: "twin_runtime_tick_v1", scope: input.scope, logical_time_from: input.initial_logical_time, logical_time_to: input.terminal_logical_time });
      const stateCount = await this.countFactsV1(client, { object_type: "twin_state_estimate_v1", scope: input.scope, logical_time_to: input.terminal_logical_time });
      const forecastCount = await this.countFactsV1(client, { object_type: "twin_forecast_run_v1", scope: input.scope, logical_time_to: input.terminal_logical_time, forecast_status: "COMPLETED" });
      const scenarioCount = await this.countFactsV1(client, { object_type: "twin_scenario_set_v1", scope: input.scope, logical_time_from: input.initial_logical_time, logical_time_to: input.terminal_logical_time });
      const scenarioProjection = await client.query(
        `SELECT count(*)::int AS n
           FROM twin_scenario_set_projection_v1
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
            AND field_id=$4 AND season_id=$5 AND zone_id=$6
            AND logical_time >= $7::timestamptz AND logical_time <= $8::timestamptz`,
        [...values, input.initial_logical_time, input.terminal_logical_time],
      );

      const graph: Cap08CompletionGraphV1 = {
        scope: structuredClone(input.scope), present,
        active_lineage_ref: activeRef,
        active_lineage_id: optionalStringV1(activeLineage?.lineage_id),
        active_revision_id: optionalStringV1(activeLineage?.revision_id),
        lineage_fact_count: lineageCount,
        checkpoint_pointer_count: checkpointPointer.rows.length,
        checkpoint_pointer_lineage_id: checkpointPointer.rows.length === 1 ? optionalStringV1(checkpointPointer.rows[0].lineage_id) : null,
        checkpoint_pointer_revision_id: checkpointPointer.rows.length === 1 ? optionalStringV1(checkpointPointer.rows[0].revision_id) : null,
        checkpoint_pointer_hash: checkpointPointer.rows.length === 1 ? optionalStringV1(checkpointPointer.rows[0].determinism_hash) : null,
        state_pointer_count: statePointer.rows.length,
        state_pointer_ref: statePointer.rows.length === 1 ? optionalStringV1(statePointer.rows[0].state_object_id) : null,
        state_pointer_lineage_id: statePointer.rows.length === 1 ? optionalStringV1(statePointer.rows[0].lineage_id) : null,
        state_pointer_revision_id: statePointer.rows.length === 1 ? optionalStringV1(statePointer.rows[0].revision_id) : null,
        forecast_pointer_count: forecastPointer.rows.length,
        forecast_pointer_ref: forecastPointer.rows.length === 1 ? optionalStringV1(forecastPointer.rows[0].forecast_object_id) : null,
        forecast_pointer_hash: forecastPointer.rows.length === 1 ? optionalStringV1(forecastPointer.rows[0].determinism_hash) : null,
        terminal_checkpoint_ref: optionalStringV1(checkpoint?.object_id),
        terminal_checkpoint_hash: optionalStringV1(checkpoint?.determinism_hash),
        terminal_checkpoint_lineage_id: optionalStringV1(checkpoint?.lineage_id),
        terminal_checkpoint_revision_id: optionalStringV1(checkpoint?.revision_id),
        terminal_checkpoint_logical_time: optionalStringV1(checkpoint?.logical_time),
        terminal_tick_sequence: optionalIntegerV1(checkpointPayload.tick_sequence),
        expected_next_logical_time: optionalStringV1(checkpointPayload.next_tick_logical_time),
        terminal_tick_ref: optionalStringV1(tick?.object_id), terminal_tick_hash: optionalStringV1(tick?.determinism_hash),
        terminal_tick_lineage_id: optionalStringV1(tick?.lineage_id), terminal_tick_revision_id: optionalStringV1(tick?.revision_id), terminal_tick_logical_time: optionalStringV1(tick?.logical_time),
        terminal_state_ref: optionalStringV1(state?.object_id), terminal_state_hash: optionalStringV1(state?.determinism_hash),
        terminal_state_lineage_id: optionalStringV1(state?.lineage_id), terminal_state_revision_id: optionalStringV1(state?.revision_id),
        terminal_forecast_ref: optionalStringV1(forecast?.object_id), terminal_forecast_hash: optionalStringV1(forecast?.determinism_hash),
        terminal_forecast_lineage_id: optionalStringV1(forecast?.lineage_id), terminal_forecast_revision_id: optionalStringV1(forecast?.revision_id), terminal_forecast_status: optionalStringV1(forecastPayload.status),
        tick_count: tickCount, state_count: stateCount, forecast_count: forecastCount, scenario_set_count: scenarioCount,
        scenario_projection_count: Number(scenarioProjection.rows[0]?.n ?? 0),
      };
      await client.query("COMMIT");
      return graph;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
