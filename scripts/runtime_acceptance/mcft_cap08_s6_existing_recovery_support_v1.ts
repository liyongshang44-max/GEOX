import assert from "node:assert/strict";
import type { Pool } from "pg";

import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v1.js";
import {
  ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V2,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v2.js";
import {
  validateCap08S5ResidualObligationsV1,
  type Cap08S5ResidualObligationV1,
} from "../../apps/server/src/domain/twin_runtime/cap08_s5_residual_calibration_shadow_contracts_v1.js";
import { buildContinuationProjectionRowsV1 } from "../../apps/server/src/projections/twin_runtime/projection_rebuilder_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import {
  PostgresAssimilatedRuntimeRepositoryV1,
  PostgresAssimilatedRuntimeRepositoryV2,
} from "../../apps/server/src/persistence/twin_runtime/postgres_assimilated_runtime_repository_v1.js";
import { PostgresForecastScenarioRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.js";
import {
  CAP08_S5_S4_PREDECESSOR_EVIDENCE_V1,
  CAP08_S5_V2_PREQUALIFICATION_EVIDENCE_V1,
} from "./mcft_cap08_s5_v2_formal_acceptance_support_v1.js";

function residualCommitPhase(order: number): string {
  if (order === 1 || order === 16) return "T16";
  if (order === 24) return "G00";
  return `T${String(order).padStart(2, "0")}`;
}

function record(value: unknown, code: string): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, any>;
}

export async function loadExistingS5Request(
  pool: Pool,
  materialization: Record<string, any>,
): Promise<{
  scope: Record<string, string>;
  formal_run_id: string;
  created_at: string;
  predecessor: typeof CAP08_S5_S4_PREDECESSOR_EVIDENCE_V1;
  prequalification: typeof CAP08_S5_V2_PREQUALIFICATION_EVIDENCE_V1;
  obligations: Cap08S5ResidualObligationV1[];
}> {
  const refs = materialization.residual_refs as string[];
  const hashes = materialization.residual_hashes as string[];
  assert.equal(refs.length, 24, "S6_RESIDUAL_REF_COUNT");
  assert.equal(hashes.length, 24, "S6_RESIDUAL_HASH_COUNT");
  const query = await pool.query(
    `SELECT record_json->'payload' AS object
       FROM facts
      WHERE record_json->>'type'='twin_forecast_residual_v1'
        AND record_json->'payload'->>'object_id'=ANY($1::text[])`,
    [refs],
  );
  assert.equal(query.rows.length, 24, "S6_EXISTING_RESIDUAL_CARDINALITY");
  const byId = new Map<string, CanonicalObjectEnvelopeV1>(
    query.rows.map((row) => {
      const object = row.object as CanonicalObjectEnvelopeV1;
      return [object.object_id, object];
    }),
  );
  const objects = refs.map((ref, index) => {
    const object = byId.get(ref);
    assert.ok(object, `S6_EXISTING_RESIDUAL_MISSING:${ref}`);
    assert.equal(object.determinism_hash, hashes[index], `S6_EXISTING_RESIDUAL_HASH:${ref}`);
    return object;
  });
  const first = objects[0];
  const scope = {
    tenant_id: first.tenant_id,
    project_id: first.project_id,
    group_id: String(first.group_id),
    field_id: first.field_id,
    season_id: String(first.season_id),
    zone_id: String(first.zone_id),
  };
  const obligations = objects.map((object, index): Cap08S5ResidualObligationV1 => {
    for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
      assert.equal(String(object[field]), scope[field], `S6_RESIDUAL_SCOPE:${index + 1}:${field}`);
    }
    const payload = record(object.payload, `S6_RESIDUAL_PAYLOAD:${index + 1}`);
    const order = index + 1;
    return {
      residual_id: `R-${String(order).padStart(2, "0")}`,
      residual_order: order,
      commit_phase: residualCommitPhase(order),
      forecast_ref: String(payload.forecast_run_ref),
      forecast_hash: String(payload.forecast_run_hash),
      observation: {
        fvo_id: String(payload.actual_observation_ref),
        source_record_id: String(payload.actual_observation_ref),
        source_record_hash: String(payload.actual_observation_hash),
        observed_at: String(payload.actual_observation_observed_at),
        available_to_runtime_at: String(payload.observation_available_to_runtime_at),
        quality_status: payload.actual_observation_quality as "PASS" | "LIMITED",
        canonical_value: String(payload.actual_observation_value),
        canonical_unit: "fraction",
      },
      assimilation_update_ref: payload.assimilation_update_ref === null ? null : String(payload.assimilation_update_ref),
      assimilation_update_hash: payload.assimilation_update_hash === null ? null : String(payload.assimilation_update_hash),
    };
  });
  return {
    scope,
    formal_run_id: String(materialization.formal_run_id),
    created_at: "2026-07-26T00:00:00.000Z",
    predecessor: structuredClone(CAP08_S5_S4_PREDECESSOR_EVIDENCE_V1),
    prequalification: structuredClone(CAP08_S5_V2_PREQUALIFICATION_EVIDENCE_V1),
    obligations: validateCap08S5ResidualObligationsV1(obligations),
  };
}

export type PointerSnapshot = Record<string, Array<Record<string, any>>>;

function pointerRow(snapshot: PointerSnapshot, table: string): Record<string, any> {
  const rows = snapshot[table] ?? [];
  assert.equal(rows.length, 1, `S6_POINTER_CARDINALITY:${table}:${rows.length}`);
  return rows[0];
}

function memberIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).map(String);
  return [];
}

function quotedIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

async function assertScopedSourceFactBindings(pool: Pool, scope: Record<string, string>): Promise<void> {
  const requiredColumns = ["source_fact_id", "tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"];
  const relations = await pool.query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.columns
      WHERE table_schema='public'
        AND column_name=ANY($1::text[])
      GROUP BY table_name
     HAVING count(DISTINCT column_name)=$2
      ORDER BY table_name`,
    [requiredColumns, requiredColumns.length],
  );
  const values = [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
  const mismatches: Array<Record<string, unknown>> = [];
  for (const { table_name: table } of relations.rows) {
    const relation = quotedIdentifier(table);
    const result = await pool.query(
      `SELECT $7::text AS relation_name,
              t.source_fact_id,
              f.record_json->>'type' AS object_type,
              f.record_json->'payload'->>'object_id' AS object_id,
              f.record_json->'payload'->>'tenant_id' AS actual_tenant_id,
              f.record_json->'payload'->>'project_id' AS actual_project_id,
              f.record_json->'payload'->>'group_id' AS actual_group_id,
              f.record_json->'payload'->>'field_id' AS actual_field_id,
              f.record_json->'payload'->>'season_id' AS actual_season_id,
              f.record_json->'payload'->>'zone_id' AS actual_zone_id
         FROM ${relation} AS t
         LEFT JOIN facts AS f ON f.fact_id=t.source_fact_id
        WHERE t.tenant_id=$1 AND t.project_id=$2 AND t.group_id=$3
          AND t.field_id=$4 AND t.season_id=$5 AND t.zone_id=$6
          AND (
            f.fact_id IS NULL
            OR f.record_json->'payload'->>'tenant_id' IS DISTINCT FROM $1
            OR f.record_json->'payload'->>'project_id' IS DISTINCT FROM $2
            OR f.record_json->'payload'->>'group_id' IS DISTINCT FROM $3
            OR f.record_json->'payload'->>'field_id' IS DISTINCT FROM $4
            OR f.record_json->'payload'->>'season_id' IS DISTINCT FROM $5
            OR f.record_json->'payload'->>'zone_id' IS DISTINCT FROM $6
          )
        ORDER BY t.source_fact_id`,
      [...values, table],
    );
    mismatches.push(...result.rows);
  }
  assert.deepEqual(mismatches, [], `S6_SCOPED_SOURCE_FACT_BINDING_MISMATCH:${JSON.stringify(mismatches)}`);
}

async function assertLatestRecordSetMemberScopes(
  pool: Pool,
  scope: Record<string, string>,
  checkpointRef: string,
): Promise<void> {
  const guards = await pool.query(
    `SELECT identity_kind,record_set_id,member_object_ids
       FROM twin_object_idempotency_index_v1
      WHERE identity_kind IN ('A0_RECORD_SET','A1_RECORD_SET','A2_RECORD_SET')
        AND (
          (jsonb_typeof(member_object_ids)='array' AND member_object_ids @> $1::jsonb)
          OR
          (jsonb_typeof(member_object_ids)='object' AND member_object_ids @> jsonb_build_object('twin_runtime_checkpoint_v1',$2::text))
        )`,
    [JSON.stringify([checkpointRef]), checkpointRef],
  );
  assert.equal(guards.rows.length, 1, `S6_SCOPE_DIAGNOSTIC_RECORD_SET_CARDINALITY:${guards.rows.length}`);
  const ids = memberIds(guards.rows[0].member_object_ids);
  const facts = await pool.query(
    `SELECT fact_id,
            record_json->>'type' AS object_type,
            record_json->'payload'->>'object_id' AS object_id,
            record_json->'payload'->>'tenant_id' AS actual_tenant_id,
            record_json->'payload'->>'project_id' AS actual_project_id,
            record_json->'payload'->>'group_id' AS actual_group_id,
            record_json->'payload'->>'field_id' AS actual_field_id,
            record_json->'payload'->>'season_id' AS actual_season_id,
            record_json->'payload'->>'zone_id' AS actual_zone_id
       FROM facts
      WHERE record_json->'payload'->>'object_id'=ANY($1::text[])
        AND (
          record_json->'payload'->>'tenant_id' IS DISTINCT FROM $2
          OR record_json->'payload'->>'project_id' IS DISTINCT FROM $3
          OR record_json->'payload'->>'group_id' IS DISTINCT FROM $4
          OR record_json->'payload'->>'field_id' IS DISTINCT FROM $5
          OR record_json->'payload'->>'season_id' IS DISTINCT FROM $6
          OR record_json->'payload'->>'zone_id' IS DISTINCT FROM $7
        )
      ORDER BY record_json->>'type',record_json->'payload'->>'object_id'`,
    [ids, scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id],
  );
  assert.deepEqual(
    facts.rows,
    [],
    `S6_RECORD_SET_MEMBER_SCOPE_MISMATCH:${guards.rows[0].identity_kind}:${guards.rows[0].record_set_id}:${JSON.stringify(facts.rows)}`,
  );
}

export async function pointerSnapshot(pool: Pool, scope: Record<string, string>): Promise<PointerSnapshot> {
  const tables = [
    "twin_state_latest_index_v1",
    "twin_forecast_result_latest_index_v1",
    "twin_runtime_checkpoint_latest_index_v1",
    "twin_scenario_latest_index_v1",
  ];
  const values = [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
  const output: PointerSnapshot = {};
  for (const table of tables) {
    const exists = Boolean((await pool.query("SELECT to_regclass($1) AS relation", [`public.${table}`])).rows[0].relation);
    if (!exists) { output[table] = []; continue; }
    output[table] = (await pool.query(
      `SELECT to_jsonb(t) - 'created_at' - 'updated_at' AS row FROM ${table} t
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
        ORDER BY 1`, values,
    )).rows.map((row) => row.row);
  }
  await assertScopedSourceFactBindings(pool, scope);
  await assertLatestRecordSetMemberScopes(
    pool,
    scope,
    String(pointerRow(output, "twin_runtime_checkpoint_latest_index_v1").checkpoint_object_id),
  );
  return output;
}

export async function removeRecoverablePointers(pool: Pool, scope: Record<string, string>): Promise<void> {
  const tables = [
    "twin_state_latest_index_v1",
    "twin_forecast_result_latest_index_v1",
    "twin_runtime_checkpoint_latest_index_v1",
    "twin_scenario_latest_index_v1",
  ];
  const values = [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
  for (const table of tables) {
    const exists = Boolean((await pool.query("SELECT to_regclass($1) AS relation", [`public.${table}`])).rows[0].relation);
    if (exists) await pool.query(
      `DELETE FROM ${table}
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`, values,
    );
  }
}

export async function findLatestRecordSetAuthority(
  pool: Pool,
  snapshot: PointerSnapshot,
): Promise<{ record_set_id: string; contract_id: string | null }> {
  const required = [
    String(pointerRow(snapshot, "twin_state_latest_index_v1").state_object_id),
    String(pointerRow(snapshot, "twin_forecast_result_latest_index_v1").forecast_object_id),
    String(pointerRow(snapshot, "twin_runtime_checkpoint_latest_index_v1").checkpoint_object_id),
  ];
  const guards = await pool.query(
    `SELECT record_set_id,identity_basis,member_object_ids
       FROM twin_object_idempotency_index_v1
      WHERE identity_kind IN ('A1_RECORD_SET','A2_RECORD_SET')`,
  );
  const matches = guards.rows.filter((row) => {
    const ids = new Set(memberIds(row.member_object_ids));
    return required.every((id) => ids.has(id));
  });
  assert.equal(matches.length, 1, `S6_LATEST_RECORD_SET_CARDINALITY:${matches.length}`);
  const basis = record(matches[0].identity_basis ?? {}, "S6_LATEST_RECORD_SET_BASIS");
  return {
    record_set_id: String(matches[0].record_set_id),
    contract_id: typeof basis.record_set_contract_id === "string" ? basis.record_set_contract_id : null,
  };
}

async function rebuildCap04LatestPointers(
  pool: Pool,
  recordSetId: string,
): Promise<Record<string, unknown>> {
  const repository = new PostgresForecastScenarioRepositoryV1(pool);
  const recordSet = await repository.readARecordSet(recordSetId);
  assert.ok(recordSet, "S6_CAP04_A_RECORD_SET_REQUIRED");
  const rows = buildContinuationProjectionRowsV1(
    recordSet.members.map((object) => ({ fact_id: `fact_${object.object_id}`, object })),
  );
  const scope = recordSet.operation_key.scope;
  const values = [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO twin_state_latest_index_v1
       (tenant_id,project_id,group_id,field_id,season_id,zone_id,state_object_id,lineage_id,revision_id,logical_time,determinism_hash,source_fact_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12)`,
      [...values, rows.state_latest.state_object_id, rows.state_latest.lineage_id, rows.state_latest.revision_id, rows.state_latest.logical_time, rows.state_latest.determinism_hash, rows.state_latest.source_fact_id],
    );
    await client.query(
      `INSERT INTO twin_forecast_result_latest_index_v1
       (tenant_id,project_id,group_id,field_id,season_id,zone_id,forecast_object_id,forecast_status,logical_time,determinism_hash,source_fact_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10,$11)`,
      [...values, rows.forecast_result_latest.forecast_object_id, rows.forecast_result_latest.forecast_status, rows.forecast_result_latest.logical_time, rows.forecast_result_latest.determinism_hash, rows.forecast_result_latest.source_fact_id],
    );
    await client.query(
      `INSERT INTO twin_runtime_checkpoint_latest_index_v1
       (tenant_id,project_id,group_id,field_id,season_id,zone_id,checkpoint_object_id,lineage_id,revision_id,logical_time,determinism_hash,source_fact_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12)`,
      [...values, rows.checkpoint_latest.checkpoint_object_id, rows.checkpoint_latest.lineage_id, rows.checkpoint_latest.revision_id, rows.checkpoint_latest.logical_time, rows.checkpoint_latest.determinism_hash, rows.checkpoint_latest.source_fact_id],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return { rebuilt_projection_count: 3, ...(await repository.rebuildForecastProjections(recordSetId)) };
}

export async function rebuildLatestRuntimeAuthority(
  pool: Pool,
  authority: { record_set_id: string; contract_id: string | null },
): Promise<Record<string, unknown>> {
  if (authority.contract_id === ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1) {
    return new PostgresAssimilatedRuntimeRepositoryV1(pool)
      .rebuildAssimilatedContinuationProjections(authority.record_set_id);
  }
  if (authority.contract_id === ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V2) {
    return new PostgresAssimilatedRuntimeRepositoryV2(pool)
      .rebuildAssimilatedContinuationProjections(authority.record_set_id);
  }
  if (authority.contract_id === null) {
    return new PostgresRuntimeRepositoryV1(pool).rebuildContinuationProjections(authority.record_set_id);
  }
  return rebuildCap04LatestPointers(pool, authority.record_set_id);
}

export async function rebuildScenarioAuthority(
  pool: Pool,
  snapshot: PointerSnapshot,
): Promise<Record<string, unknown>> {
  const scenarioSetId = String(pointerRow(snapshot, "twin_scenario_latest_index_v1").scenario_set_id);
  return new PostgresForecastScenarioRepositoryV1(pool).rebuildScenarioProjections(scenarioSetId);
}
