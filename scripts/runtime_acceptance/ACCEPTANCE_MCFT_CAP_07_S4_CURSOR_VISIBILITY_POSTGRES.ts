// Purpose: prove projected collection candidates are filtered by the cursor-bound canonical fact snapshot before validation.
// Boundary: isolated PostgreSQL fixture writes only; production repository/API reads are SELECT-only and no Runtime root is required.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import { computeMemberDeterminismHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { PostgresMcftFieldTwinReadApiV1 } from "../../apps/server/src/services/mcft_field_twin_read_api_v1.js";

const DB = String(process.env.MCFT_S4_CURSOR_POSTGRES_URL || "postgres://postgres:postgres@127.0.0.1:5432/postgres");
const OUT = path.resolve("acceptance-output/MCFT_CAP_07_S4_CURSOR_VISIBILITY_POSTGRES_RESULT.json");
const scope = { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA", field_id: "fieldA", season_id: "seasonA", zone_id: "zoneA" } as const;
const checks: Array<{ name: string; status: "PASS" }> = [];
const at = (minute: number, seconds = 0) => new Date(Date.UTC(2026, 6, 21, 0, minute, seconds)).toISOString();

type Obj = Record<string, unknown>;

async function withTransaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function stateObject(id: string, logicalTime: string, ordinal: number): Obj {
  const object: Obj = {
    object_id: id,
    object_type: "twin_state_estimate_v1",
    ...scope,
    lineage_id: "lineage-a",
    revision_id: "revision-a",
    logical_time: logicalTime,
    as_of: logicalTime,
    payload: { ordinal },
    source_refs: [],
    evidence_refs: [],
    limitations: [],
  };
  object.determinism_hash = computeMemberDeterminismHashV1(object);
  return object;
}

async function insertState(pool: Pool, id: string, logicalTime: string, ordinal: number): Promise<void> {
  const object = stateObject(id, logicalTime, ordinal);
  const factId = `fact-${id}`;
  await withTransaction(pool, async (client) => {
    await client.query(
      "INSERT INTO public.facts(fact_id,occurred_at,source,record_json) VALUES($1,$2,'s4-cursor',$3::jsonb)",
      [factId, logicalTime, JSON.stringify({ type: object.object_type, payload: object })],
    );
    await client.query(
      "INSERT INTO public.twin_fact_visibility_index_v1(visibility_epoch_id,fact_id,visibility_anchor_xid8,visibility_anchor_kind) VALUES('epoch-s4-cursor',$1,pg_catalog.pg_current_xact_id(),'FACT_INSERT_TRANSACTION')",
      [factId],
    );
    await client.query(
      "INSERT INTO public.twin_state_history_projection_v1 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)",
      [id, scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id, "lineage-a", "revision-a", logicalTime, object.determinism_hash, JSON.stringify(object.payload), factId],
    );
  });
}

function pass(name: string, assertion: () => void): void {
  assertion();
  checks.push({ name, status: "PASS" });
}

async function countRows(pool: Pool): Promise<Record<string, string>> {
  const output: Record<string, string> = {};
  for (const relation of ["facts", "twin_fact_visibility_index_v1", "twin_state_history_projection_v1"]) {
    output[relation] = String((await pool.query(`SELECT count(*)::text AS count FROM public.${relation}`)).rows[0]?.count ?? "0");
  }
  return output;
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: DB, max: 6 });
  try {
    process.env.MCFT_CURSOR_SIGNING_KEYS_JSON = JSON.stringify({ "s4-cursor-key": "0123456789abcdef0123456789abcdef" });
    process.env.MCFT_CURSOR_PRIMARY_KEY_ID = "s4-cursor-key";
    await pool.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      CREATE TABLE public.facts(fact_id text PRIMARY KEY,occurred_at timestamptz NOT NULL,source text NOT NULL,record_json jsonb NOT NULL);
      CREATE TABLE public.twin_fact_visibility_epoch_v1(visibility_epoch_id text PRIMARY KEY,status text NOT NULL);
      INSERT INTO public.twin_fact_visibility_epoch_v1 VALUES('epoch-s4-cursor','ACTIVE');
      CREATE TABLE public.twin_fact_visibility_index_v1(visibility_epoch_id text NOT NULL,fact_id text NOT NULL,visibility_anchor_xid8 xid8 NOT NULL,visibility_anchor_kind text NOT NULL,PRIMARY KEY(visibility_epoch_id,fact_id));
      CREATE TABLE public.twin_state_history_projection_v1(state_object_id text PRIMARY KEY,tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,lineage_id text,revision_id text,logical_time timestamptz,determinism_hash text,canonical_payload jsonb,source_fact_id text);
    `);
    for (let index = 0; index < 120; index += 1) await insertState(pool, `state-${String(index).padStart(3, "0")}`, at(index), index);

    const api = new PostgresMcftFieldTwinReadApiV1(pool);
    const first = await api.readStates({ scope, limit: 50 }) as any;
    pass("FIRST_PAGE_BINDS_CURSOR_SNAPSHOT", () => {
      assert.equal(first.items.length, 50);
      assert.equal(first.items[0]?.object_ref, "state-119");
      assert.equal(first.items[49]?.object_ref, "state-070");
      assert.equal(typeof first.next_cursor, "string");
    });

    await insertState(pool, "state-late", at(65, 30), 6530);
    const beforeReads = await countRows(pool);
    const continuation = await api.readStates({ scope, limit: 50, cursor: first.next_cursor }) as any;
    pass("OLD_CURSOR_EXCLUDES_POST_SNAPSHOT_PROJECTION_AND_FACT", () => {
      assert.equal(continuation.fixed_root_ref, first.fixed_root_ref);
      assert.equal(continuation.items.length, 50);
      assert.equal(continuation.items.some((item: any) => item.object_ref === "state-late"), false);
      assert.equal(continuation.items[0]?.object_ref, "state-069");
    });

    const fresh = await api.readStates({ scope, limit: 100 }) as any;
    pass("FRESH_SNAPSHOT_OBSERVES_LATE_COMMIT", () => {
      assert.equal(fresh.items.some((item: any) => item.object_ref === "state-late"), true);
    });
    const afterReads = await countRows(pool);
    pass("PRODUCT_READS_REMAIN_ZERO_WRITE", () => assert.deepEqual(afterReads, beforeReads));

    const result = {
      schema_version: "geox_mcft_cap_07_s4_cursor_visibility_postgres_result_v1",
      status: "PASS",
      check_count: checks.length,
      checks,
      old_cursor_post_snapshot_projection_excluded: true,
      fresh_snapshot_late_commit_visible: true,
      product_read_write_delta: 0,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
    console.log(`MCFT-CAP-07 S4 cursor visibility: ${checks.length} PASS`);
  } catch (error) {
    const result = { schema_version: "geox_mcft_cap_07_s4_cursor_visibility_postgres_result_v1", status: "FAIL", check_count: checks.length, checks, error: String(error instanceof Error ? error.stack || error.message : error) };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
