import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const AUTH_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A18A-ZERO-STATE-FORMAL-STORE-IDENTITY-AND-SCHEMA-PREFLIGHT-V1.json");
const OUT = path.resolve("acceptance-output/MCFT_CAP_09_A18A_ZERO_STATE_FORMAL_STORE_PREFLIGHT_RESULT.json");
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA ?? "").trim();
const DATABASE_URL = String(process.env.DATABASE_URL ?? "").trim();
const AUTH = JSON.parse(fs.readFileSync(AUTH_PATH, "utf8"));

const REQUIRED_TABLES = AUTH.schema_provenance.required_tables as string[];

function write(value: unknown) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify(value, null, 2));
}

async function main() {
  assert.match(SUBJECT_SHA, /^[0-9a-f]{40}$/, "A18A_EXACT_SUBJECT_SHA_REQUIRED");
  assert(DATABASE_URL, "A18A_DATABASE_URL_REQUIRED");
  const pool = new Pool({ connectionString: DATABASE_URL, application_name: `mcft-cap09-a18a-${SUBJECT_SHA.slice(0,12)}`, max: 1 });
  let result: Record<string, unknown> = {
    schema_version: "geox_mcft_cap09_a18a_zero_state_formal_store_preflight_result_v1",
    status: "FAIL",
    subject_sha: SUBJECT_SHA,
    transaction_mode: "READ_ONLY",
    database_write_count: 0,
    formal_runtime_write_count: 0,
    ea5e3_authorized: false,
    formal_o00_started: false,
    formal_execution_count: "0/24"
  };
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    const identity = (await client.query(`SELECT current_database() AS database_name, current_setting('neon.project_id', true) AS neon_project_id, current_setting('neon.branch_id', true) AS neon_branch_id, current_setting('transaction_read_only') AS transaction_read_only, transaction_timestamp() AS database_now_utc`)).rows[0];
    assert.equal(identity.database_name, AUTH.formal_database_identity.database_name, "A18A_DATABASE_NAME_DRIFT");
    assert.notEqual(identity.database_name, AUTH.formal_database_identity.historical_database_name_forbidden_for_execution, "A18A_HISTORICAL_STORE_REUSE_FORBIDDEN");
    assert.equal(identity.neon_project_id, AUTH.formal_database_identity.neon_project_id, "A18A_NEON_PROJECT_DRIFT");
    assert.equal(identity.neon_branch_id, AUTH.formal_database_identity.neon_branch_id, "A18A_NEON_BRANCH_DRIFT");
    assert.equal(identity.transaction_read_only, "on", "A18A_READ_ONLY_REQUIRED");

    const tables = (await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1::text[]) ORDER BY table_name`, [REQUIRED_TABLES])).rows.map((r) => r.table_name);
    assert.deepEqual([...tables].sort(), [...REQUIRED_TABLES].sort(), "A18A_REQUIRED_SCHEMA_TABLES_MISSING");

    const fp = (await client.query(`
      WITH wanted(name) AS (SELECT unnest($1::text[])),
      colshape AS (
        SELECT c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod) typ,a.attnotnull,COALESCE(pg_get_expr(ad.adbin,ad.adrelid),'') def
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN wanted w ON w.name=c.relname
        JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
        LEFT JOIN pg_attrdef ad ON ad.adrelid=c.oid AND ad.adnum=a.attnum WHERE n.nspname='public'
      ),
      conshape AS (
        SELECT c.relname,con.conname,con.contype::text contype,pg_get_constraintdef(con.oid,true) def
        FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN wanted w ON w.name=c.relname
        WHERE n.nspname='public' AND con.contype IN ('p','u','c','f')
      ),
      idxshape AS (
        SELECT i.tablename,i.indexname,i.indexdef FROM pg_indexes i JOIN wanted w ON w.name=i.tablename WHERE i.schemaname='public'
      )
      SELECT
        (SELECT md5(string_agg(relname||'|'||attnum::text||'|'||attname||'|'||typ||'|'||attnotnull::text||'|'||def,E'\\n' ORDER BY relname,attnum)) FROM colshape) AS column_fingerprint,
        (SELECT md5(string_agg(relname||'|'||conname||'|'||contype||'|'||def,E'\\n' ORDER BY relname,conname)) FROM conshape) AS constraint_fingerprint,
        (SELECT md5(string_agg(tablename||'|'||indexname||'|'||indexdef,E'\\n' ORDER BY tablename,indexname)) FROM idxshape) AS index_fingerprint
    `, [REQUIRED_TABLES])).rows[0];
    assert.equal(fp.column_fingerprint, AUTH.schema_provenance.column_fingerprint_md5, "A18A_COLUMN_FINGERPRINT_DRIFT");
    assert.equal(fp.constraint_fingerprint, AUTH.schema_provenance.constraint_fingerprint_md5, "A18A_CONSTRAINT_FINGERPRINT_DRIFT");
    assert.equal(fp.index_fingerprint, AUTH.schema_provenance.index_fingerprint_md5, "A18A_INDEX_FINGERPRINT_DRIFT");

    const counts = (await client.query(`SELECT
      (SELECT count(*)::int FROM facts) facts_total,
      (SELECT count(*)::int FROM twin_runtime_checkpoint_latest_index_v1) checkpoint_total,
      (SELECT count(*)::int FROM twin_shadow_online_scheduler_slot_v1) scheduler_slot_total,
      (SELECT count(*)::int FROM twin_shadow_online_scheduler_cursor_v1) scheduler_cursor_total,
      (SELECT count(*)::int FROM twin_active_lineage_index_v1) active_lineage_total,
      (SELECT count(*)::int FROM twin_state_latest_index_v1) state_latest_total,
      (SELECT count(*)::int FROM twin_forecast_result_latest_index_v1) forecast_result_latest_total,
      (SELECT count(*)::int FROM twin_forecast_success_latest_index_v1) forecast_success_latest_total,
      (SELECT count(*)::int FROM twin_runtime_lease_v1) runtime_lease_total,
      (SELECT count(*)::int FROM twin_terminal_tick_uniqueness_v1) terminal_tick_uniqueness_total`)).rows[0];
    for (const [key, expected] of Object.entries(AUTH.zero_state_requirements)) {
      assert.equal(Number(counts[key]), Number(expected), `A18A_ZERO_STATE_REQUIREMENT_FAIL:${key}`);
    }
    await client.query("COMMIT");
    result = {
      ...result,
      status: "PASS",
      database_identity: identity,
      required_schema_table_count: REQUIRED_TABLES.length,
      schema_fingerprints: fp,
      zero_state_counts: counts,
      zero_state_formal_store_qualified: true,
      prewindow_a0_persisted: false,
      runner_exact_binding_qualified: false
    };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    result = { ...result, error: String(error instanceof Error ? error.message : error), zero_state_formal_store_qualified: false };
    throw error;
  } finally {
    client.release();
    await pool.end();
    write(result);
  }
}

main().catch(() => { process.exitCode = 1; });
