// Purpose: inspect and atomically establish the generic CAP-08 terminal authority together with the S3 semantic completion authority.
// Boundary: bounded authority-snapshot persistence only; no canonical fact write, projection repair, Tick execution, route, scheduler, or production authority.

import type { Pool, PoolClient } from "pg";
import { canonicalJsonV1 } from "../../domain/twin_runtime/canonical_json_v1.js";
import {
  CAP08_COMPLETION_AUTHORITY_KIND_V1,
  CAP08_COMPLETION_AUTHORITY_SCHEMA_VERSION_V1,
  buildCap08CompletionAuthorityV1,
  cap08CompletionAuthorityStorageRefV1,
  type Cap08CompletionAuthorityRepositoryPortV1,
  type Cap08CompletionAuthorityV1,
  type Cap08CompletionGraphV1,
  type Cap08CompletionScopeV1,
  type InspectCap08CompletionAuthorityInputV1,
} from "../../domain/twin_runtime/cap08_completion_authority_contracts_v1.js";
import {
  CAP08_S3_SEMANTIC_COMPLETION_AUTHORITY_KIND_V1,
  type Cap08S3CompletionAuthorityPairPortV1,
  type EstablishCap08S3CompletionAuthorityPairResultV1,
  type InspectCap08S3CompletionAuthorityPairResultV1,
} from "../../domain/twin_runtime/cap08_s3_completion_authority_pair_contracts_v1.js";
import {
  cap08S3CompletionTupleRefV1,
  validateCap08S3CompletionTupleV1,
  type Cap08S3CompletionTupleV1,
} from "../../domain/twin_runtime/cap08_s3_completion_tuple_v1.js";
import { Cap08CompletionAuthorityServiceV1 } from "../../runtime/twin_runtime/cap08_completion_authority_service_v1.js";
import { Cap08S3CompletionTupleServiceV1 } from "../../runtime/twin_runtime/cap08_s3_completion_tuple_service_v1.js";

const PARTIAL_PAIR = "CAP08_S3_COMPLETION_AUTHORITY_PARTIAL_PAIR";

type RawEnvelopeV1 = {
  object_id?: unknown;
  object_type?: unknown;
  determinism_hash?: unknown;
  lineage_id?: unknown;
  revision_id?: unknown;
  logical_time?: unknown;
  payload?: unknown;
};

function scopeValuesV1(scope: Cap08CompletionScopeV1): unknown[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}

function parseJsonObjectV1(value: unknown): Record<string, unknown> {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("CAP08_S3_COMPLETION_AUTHORITY_PAYLOAD_REQUIRED");
  }
  return parsed as Record<string, unknown>;
}

function parseEnvelopeV1(recordJson: unknown): RawEnvelopeV1 {
  const record = parseJsonObjectV1(recordJson);
  const payload = record.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("CAP08_S3_COMPLETION_PERSISTED_ENVELOPE_REQUIRED");
  }
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
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parseGenericAuthorityV1(value: unknown): Cap08CompletionAuthorityV1 {
  const authority = parseJsonObjectV1(value) as unknown as Cap08CompletionAuthorityV1;
  if (authority.schema_version !== CAP08_COMPLETION_AUTHORITY_SCHEMA_VERSION_V1
    || authority.authority_kind !== CAP08_COMPLETION_AUTHORITY_KIND_V1) {
    throw new Error("CAP08_S3_GENERIC_COMPLETION_AUTHORITY_INVALID");
  }
  return authority;
}

function parseSemanticAuthorityV1(value: unknown): Cap08S3CompletionTupleV1 {
  const tuple = structuredClone(
    parseJsonObjectV1(value) as unknown as Cap08S3CompletionTupleV1,
  );
  validateCap08S3CompletionTupleV1(tuple);
  return tuple;
}

async function readObjectV1(
  client: PoolClient,
  objectId: string | null,
  expectedType: string,
): Promise<RawEnvelopeV1 | null> {
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

async function countFactsV1(client: PoolClient, input: {
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
  const result = await client.query(
    `SELECT count(*)::int AS n FROM facts WHERE ${clauses.join(" AND ")}`,
    parameters,
  );
  return Number(result.rows[0]?.n ?? 0);
}

async function inspectGraphV1(
  client: PoolClient,
  input: InspectCap08CompletionAuthorityInputV1,
): Promise<Cap08CompletionGraphV1> {
  const values = scopeValuesV1(input.scope);
  const active = await client.query(
    `SELECT active_lineage_ref
       FROM twin_active_lineage_index_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
        AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    values,
  );
  const checkpointPointer = await client.query(
    `SELECT checkpoint_object_id,lineage_id,revision_id,logical_time,determinism_hash,source_fact_id
       FROM twin_runtime_checkpoint_latest_index_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
        AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    values,
  );
  const statePointer = await client.query(
    `SELECT state_object_id,lineage_id,revision_id,logical_time,determinism_hash,source_fact_id
       FROM twin_state_latest_index_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
        AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    values,
  );
  const forecastPointer = await client.query(
    `SELECT forecast_object_id,logical_time,determinism_hash,source_fact_id
       FROM twin_forecast_result_latest_index_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
        AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    values,
  );
  const present = active.rows.length > 0
    || checkpointPointer.rows.length > 0
    || statePointer.rows.length > 0
    || forecastPointer.rows.length > 0;

  const activeRef = active.rows.length === 1
    ? optionalStringV1(active.rows[0].active_lineage_ref)
    : null;
  const activeLineage = await readObjectV1(client, activeRef, "twin_runtime_lineage_v1");
  const checkpointRef = checkpointPointer.rows.length === 1
    ? optionalStringV1(checkpointPointer.rows[0].checkpoint_object_id)
    : null;
  const checkpoint = await readObjectV1(client, checkpointRef, "twin_runtime_checkpoint_v1");
  const checkpointPayload = payloadObjectV1(checkpoint);
  const tickRef = optionalStringV1(checkpointPayload.last_completed_tick_ref);
  const stateRef = optionalStringV1(checkpointPayload.last_posterior_state_ref);
  const forecastRef = optionalStringV1(checkpointPayload.forecast_result_ref);
  const tick = await readObjectV1(client, tickRef, "twin_runtime_tick_v1");
  const state = await readObjectV1(client, stateRef, "twin_state_estimate_v1");
  const forecast = await readObjectV1(client, forecastRef, "twin_forecast_run_v1");
  const forecastPayload = payloadObjectV1(forecast);

  const lineageCount = await countFactsV1(client, {
    object_type: "twin_runtime_lineage_v1",
    scope: input.scope,
  });
  const tickCount = await countFactsV1(client, {
    object_type: "twin_runtime_tick_v1",
    scope: input.scope,
    logical_time_from: input.initial_logical_time,
    logical_time_to: input.terminal_logical_time,
  });
  const stateCount = await countFactsV1(client, {
    object_type: "twin_state_estimate_v1",
    scope: input.scope,
    logical_time_to: input.terminal_logical_time,
  });
  const forecastCount = await countFactsV1(client, {
    object_type: "twin_forecast_run_v1",
    scope: input.scope,
    logical_time_to: input.terminal_logical_time,
    forecast_status: "COMPLETED",
  });
  const scenarioCount = await countFactsV1(client, {
    object_type: "twin_scenario_set_v1",
    scope: input.scope,
    logical_time_from: input.initial_logical_time,
    logical_time_to: input.terminal_logical_time,
  });
  const scenarioProjection = await client.query(
    `SELECT count(*)::int AS n
       FROM twin_scenario_set_projection_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
        AND field_id=$4 AND season_id=$5 AND zone_id=$6
        AND logical_time >= $7::timestamptz AND logical_time <= $8::timestamptz`,
    [...values, input.initial_logical_time, input.terminal_logical_time],
  );

  return {
    scope: structuredClone(input.scope),
    present,
    active_lineage_ref: activeRef,
    active_lineage_id: optionalStringV1(activeLineage?.lineage_id),
    active_revision_id: optionalStringV1(activeLineage?.revision_id),
    lineage_fact_count: lineageCount,
    checkpoint_pointer_count: checkpointPointer.rows.length,
    checkpoint_pointer_lineage_id: checkpointPointer.rows.length === 1
      ? optionalStringV1(checkpointPointer.rows[0].lineage_id)
      : null,
    checkpoint_pointer_revision_id: checkpointPointer.rows.length === 1
      ? optionalStringV1(checkpointPointer.rows[0].revision_id)
      : null,
    checkpoint_pointer_hash: checkpointPointer.rows.length === 1
      ? optionalStringV1(checkpointPointer.rows[0].determinism_hash)
      : null,
    state_pointer_count: statePointer.rows.length,
    state_pointer_ref: statePointer.rows.length === 1
      ? optionalStringV1(statePointer.rows[0].state_object_id)
      : null,
    state_pointer_lineage_id: statePointer.rows.length === 1
      ? optionalStringV1(statePointer.rows[0].lineage_id)
      : null,
    state_pointer_revision_id: statePointer.rows.length === 1
      ? optionalStringV1(statePointer.rows[0].revision_id)
      : null,
    forecast_pointer_count: forecastPointer.rows.length,
    forecast_pointer_ref: forecastPointer.rows.length === 1
      ? optionalStringV1(forecastPointer.rows[0].forecast_object_id)
      : null,
    forecast_pointer_hash: forecastPointer.rows.length === 1
      ? optionalStringV1(forecastPointer.rows[0].determinism_hash)
      : null,
    terminal_checkpoint_ref: optionalStringV1(checkpoint?.object_id),
    terminal_checkpoint_hash: optionalStringV1(checkpoint?.determinism_hash),
    terminal_checkpoint_lineage_id: optionalStringV1(checkpoint?.lineage_id),
    terminal_checkpoint_revision_id: optionalStringV1(checkpoint?.revision_id),
    terminal_checkpoint_logical_time: optionalStringV1(checkpoint?.logical_time),
    terminal_tick_sequence: optionalIntegerV1(checkpointPayload.tick_sequence),
    expected_next_logical_time: optionalStringV1(checkpointPayload.next_tick_logical_time),
    terminal_tick_ref: optionalStringV1(tick?.object_id),
    terminal_tick_hash: optionalStringV1(tick?.determinism_hash),
    terminal_tick_lineage_id: optionalStringV1(tick?.lineage_id),
    terminal_tick_revision_id: optionalStringV1(tick?.revision_id),
    terminal_tick_logical_time: optionalStringV1(tick?.logical_time),
    terminal_state_ref: optionalStringV1(state?.object_id),
    terminal_state_hash: optionalStringV1(state?.determinism_hash),
    terminal_state_lineage_id: optionalStringV1(state?.lineage_id),
    terminal_state_revision_id: optionalStringV1(state?.revision_id),
    terminal_forecast_ref: optionalStringV1(forecast?.object_id),
    terminal_forecast_hash: optionalStringV1(forecast?.determinism_hash),
    terminal_forecast_lineage_id: optionalStringV1(forecast?.lineage_id),
    terminal_forecast_revision_id: optionalStringV1(forecast?.revision_id),
    terminal_forecast_status: optionalStringV1(forecastPayload.status),
    tick_count: tickCount,
    state_count: stateCount,
    forecast_count: forecastCount,
    scenario_set_count: scenarioCount,
    scenario_projection_count: Number(scenarioProjection.rows[0]?.n ?? 0),
  };
}

async function readAuthorityRowV1(
  client: PoolClient,
  authorityKind: string,
  authorityRef: string,
): Promise<{ determinism_hash: string; semantic_payload: unknown } | null> {
  const result = await client.query(
    `SELECT determinism_hash,semantic_payload
       FROM twin_runtime_authority_snapshot_v1
      WHERE authority_kind=$1 AND authority_ref=$2`,
    [authorityKind, authorityRef],
  );
  if (result.rows.length === 0) return null;
  if (result.rows.length !== 1) throw new Error("CAP08_S3_COMPLETION_AUTHORITY_CARDINALITY");
  return result.rows[0];
}

function genericRepositoryBoundToClientV1(
  client: PoolClient,
  graph: Cap08CompletionGraphV1,
): Cap08CompletionAuthorityRepositoryPortV1 {
  return {
    async readAuthority(authorityRef) {
      const row = await readAuthorityRowV1(
        client,
        CAP08_COMPLETION_AUTHORITY_KIND_V1,
        authorityRef,
      );
      return row ? parseGenericAuthorityV1(row.semantic_payload) : null;
    },
    async readAuthoritiesForScope(input) {
      const result = await client.query(
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
      return result.rows.map((row) => parseGenericAuthorityV1(row.semantic_payload));
    },
    async commitAuthority() {
      throw new Error("CAP08_S3_COMPLETION_PAIR_STANDALONE_GENERIC_WRITE_FORBIDDEN");
    },
    async inspectCompletionGraph() {
      return structuredClone(graph);
    },
  };
}

export class PostgresCap08S3CompletionAuthorityPairRepositoryV1
implements Cap08S3CompletionAuthorityPairPortV1 {
  constructor(private readonly pool: Pool) {}

  private async inspectWithClientV1(
    client: PoolClient,
    input: InspectCap08CompletionAuthorityInputV1,
  ): Promise<InspectCap08S3CompletionAuthorityPairResultV1> {
    const graph = await inspectGraphV1(client, input);
    const genericRef = cap08CompletionAuthorityStorageRefV1(input);
    const semanticRef = cap08S3CompletionTupleRefV1({
      formal_run_id: input.formal_run_id,
      scope: input.scope,
      phase_engine_source_digest: input.phase_engine_source_digest,
    });
    if (genericRef === semanticRef) {
      throw new Error("CAP08_S3_COMPLETION_AUTHORITY_REF_COLLISION");
    }
    const [genericRow, semanticRow] = await Promise.all([
      readAuthorityRowV1(client, CAP08_COMPLETION_AUTHORITY_KIND_V1, genericRef),
      readAuthorityRowV1(
        client,
        CAP08_S3_SEMANTIC_COMPLETION_AUTHORITY_KIND_V1,
        semanticRef,
      ),
    ]);
    if (Boolean(genericRow) !== Boolean(semanticRow)) throw new Error(PARTIAL_PAIR);

    const genericService = new Cap08CompletionAuthorityServiceV1(
      genericRepositoryBoundToClientV1(client, graph),
    );
    if (!genericRow && !semanticRow) {
      const genericInspection = await genericService.inspect(input);
      if (genericInspection.disposition === "ALREADY_COMPLETE_EXACT") {
        throw new Error(PARTIAL_PAIR);
      }
      return {
        disposition: genericInspection.disposition,
        generic_authority: null,
        semantic_authority: null,
        rebuilt_semantic_authority: null,
        graph,
        authority_pair_write_delta: 0,
      };
    }

    const genericInspection = await genericService.inspect(input);
    if (genericInspection.disposition !== "ALREADY_COMPLETE_EXACT"
      || !genericInspection.authority) {
      throw new Error("CAP08_S3_GENERIC_COMPLETION_AUTHORITY_NOT_EXACT");
    }
    const semantic = parseSemanticAuthorityV1(semanticRow?.semantic_payload);
    if (semanticRow?.determinism_hash !== semantic.determinism_hash) {
      throw new Error("CAP08_S3_SEMANTIC_COMPLETION_AUTHORITY_HASH_MISMATCH");
    }
    const rebuilt = await new Cap08S3CompletionTupleServiceV1(client).rebuild({
      formal_run_id: input.formal_run_id,
      scope: input.scope,
      phase_engine_source_digest: input.phase_engine_source_digest,
    });
    if (canonicalJsonV1(semantic) !== canonicalJsonV1(rebuilt)
      || semantic.determinism_hash !== rebuilt.determinism_hash) {
      throw new Error("CAP08_S3_SEMANTIC_COMPLETION_AUTHORITY_REBUILD_MISMATCH");
    }
    return {
      disposition: "ALREADY_COMPLETE_EXACT",
      generic_authority: genericInspection.authority,
      semantic_authority: semantic,
      rebuilt_semantic_authority: rebuilt,
      graph,
      authority_pair_write_delta: 0,
    };
  }

  async inspect(
    input: InspectCap08CompletionAuthorityInputV1,
  ): Promise<InspectCap08S3CompletionAuthorityPairResultV1> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const result = await this.inspectWithClientV1(client, input);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async establish(
    input: InspectCap08CompletionAuthorityInputV1,
  ): Promise<EstablishCap08S3CompletionAuthorityPairResultV1> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");
      const lockIdentity = canonicalJsonV1({
        run_contract_id: input.run_contract_id,
        formal_run_id: input.formal_run_id,
        scope: input.scope,
      });
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [lockIdentity]);

      const graph = await inspectGraphV1(client, input);
      const genericRef = cap08CompletionAuthorityStorageRefV1(input);
      const semanticRef = cap08S3CompletionTupleRefV1({
        formal_run_id: input.formal_run_id,
        scope: input.scope,
        phase_engine_source_digest: input.phase_engine_source_digest,
      });
      if (genericRef === semanticRef) {
        throw new Error("CAP08_S3_COMPLETION_AUTHORITY_REF_COLLISION");
      }
      const [genericRow, semanticRow] = await Promise.all([
        readAuthorityRowV1(client, CAP08_COMPLETION_AUTHORITY_KIND_V1, genericRef),
        readAuthorityRowV1(
          client,
          CAP08_S3_SEMANTIC_COMPLETION_AUTHORITY_KIND_V1,
          semanticRef,
        ),
      ]);
      if (Boolean(genericRow) !== Boolean(semanticRow)) throw new Error(PARTIAL_PAIR);
      if (genericRow && semanticRow) {
        const existing = await this.inspectWithClientV1(client, input);
        if (existing.disposition !== "ALREADY_COMPLETE_EXACT"
          || !existing.generic_authority
          || !existing.semantic_authority
          || !existing.rebuilt_semantic_authority
          || !existing.graph) {
          throw new Error("CAP08_S3_EXISTING_COMPLETION_AUTHORITY_PAIR_NOT_EXACT");
        }
        await client.query("COMMIT");
        return {
          disposition: "ALREADY_COMPLETE_EXACT",
          write_status: "EXISTING_IDEMPOTENT_PAIR",
          generic_authority: existing.generic_authority,
          semantic_authority: existing.semantic_authority,
          rebuilt_semantic_authority: existing.rebuilt_semantic_authority,
          graph: existing.graph,
          authority_pair_write_delta: 0,
        };
      }

      const generic = buildCap08CompletionAuthorityV1({ inspection: input, graph });
      const semantic = await new Cap08S3CompletionTupleServiceV1(client).rebuild({
        formal_run_id: input.formal_run_id,
        scope: input.scope,
        phase_engine_source_digest: input.phase_engine_source_digest,
      });
      const inserted = await client.query(
        `INSERT INTO twin_runtime_authority_snapshot_v1
         (authority_kind,authority_ref,determinism_hash,semantic_payload)
         VALUES
         ($1,$2,$3,$4::jsonb),
         ($5,$6,$7,$8::jsonb)
         ON CONFLICT (authority_kind,authority_ref) DO NOTHING
         RETURNING authority_kind,authority_ref`,
        [
          generic.authority_kind,
          generic.authority_ref,
          generic.determinism_hash,
          JSON.stringify(generic),
          CAP08_S3_SEMANTIC_COMPLETION_AUTHORITY_KIND_V1,
          semantic.tuple_ref,
          semantic.determinism_hash,
          JSON.stringify(semantic),
        ],
      );
      if (inserted.rows.length !== 2) {
        throw new Error("CAP08_S3_COMPLETION_AUTHORITY_PAIR_ATOMIC_INSERT_FAILED");
      }
      const exact = await this.inspectWithClientV1(client, input);
      if (exact.disposition !== "ALREADY_COMPLETE_EXACT"
        || !exact.generic_authority
        || !exact.semantic_authority
        || !exact.rebuilt_semantic_authority
        || !exact.graph) {
        throw new Error("CAP08_S3_COMPLETION_AUTHORITY_PAIR_FINAL_READBACK_FAILED");
      }
      await client.query("COMMIT");
      return {
        disposition: "ALREADY_COMPLETE_EXACT",
        write_status: "INSERTED_ATOMIC_PAIR",
        generic_authority: exact.generic_authority,
        semantic_authority: exact.semantic_authority,
        rebuilt_semantic_authority: exact.rebuilt_semantic_authority,
        graph: exact.graph,
        authority_pair_write_delta: 2,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
