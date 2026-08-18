import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const AUTH_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-RUNTIME-ENV-REQUALIFICATION-AUTHORITY-V1.json");
const OUT = path.resolve("acceptance-output/MCFT_CAP_09_RUNTIME_ENVIRONMENT_PREFLIGHT_RESULT.json");
const AUTH = JSON.parse(fs.readFileSync(AUTH_PATH, "utf8"));
const DATABASE_URL = String(process.env.DATABASE_URL ?? "").trim();
const MODE = String(process.argv[2] ?? "schema").trim();

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify(value, null, 2));
}

function safeRelation(name: string): string {
  assert.match(name, /^[a-z_][a-z0-9_]*$/, `RUNTIME_ENV_RELATION_NAME_INVALID:${name}`);
  return `"${name}"`;
}

async function main(): Promise<void> {
  assert(DATABASE_URL, "RUNTIME_ENV_DATABASE_URL_REQUIRED");
  assert(["schema", "zero-state"].includes(MODE), "RUNTIME_ENV_MODE_INVALID");
  const required = AUTH.schema_contract.minimum_required_tables as string[];
  assert.equal(required.length, Number(AUTH.schema_contract.required_table_count), "RUNTIME_ENV_AUTHORITY_TABLE_COUNT_DRIFT");
  assert.equal(new Set(required).size, required.length, "RUNTIME_ENV_AUTHORITY_DUPLICATE_TABLE");
  assert(required.includes("twin_runtime_authority_snapshot_v1"), "AUTHORITY_SNAPSHOT_TABLE_MUST_BE_QUALIFIED");
  assert(required.includes("twin_scenario_set_uniqueness_v1"), "SCENARIO_PERSISTENCE_TABLES_MUST_BE_QUALIFIED");
  assert(required.includes("twin_forecast_run_projection_v1"), "FORECAST_RECOVERY_TABLES_MUST_BE_QUALIFIED");

  const pool = new Pool({ connectionString: DATABASE_URL, max: 1, application_name: "mcft-cap09-runtime-env-preflight-v1" });
  const client = await pool.connect();
  let result: Record<string, unknown> = {
    schema_version: "geox_mcft_cap09_runtime_environment_preflight_result_v1",
    status: "FAIL",
    mode: MODE,
    transaction_mode: "READ_ONLY",
    database_write_count: 0,
    formal_effect: false,
  };
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    const identity = (await client.query("SELECT current_database() AS database_name, current_setting('transaction_read_only') AS transaction_read_only")).rows[0];
    assert.equal(identity.transaction_read_only, "on", "RUNTIME_ENV_READ_ONLY_REQUIRED");

    const rows = (await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1::text[]) ORDER BY table_name",
      [required],
    )).rows.map((row) => String(row.table_name));
    const missing = required.filter((name) => !rows.includes(name));
    assert.deepEqual(missing, [], `RUNTIME_ENV_REQUIRED_TABLES_MISSING:${missing.join(',')}`);

    const fp = (await client.query(`
      WITH wanted(name) AS (SELECT unnest($1::text[])),
      colshape AS (
        SELECT c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod) typ,a.attnotnull,COALESCE(pg_get_expr(ad.adbin,ad.adrelid),'') def
          FROM pg_class c
          JOIN pg_namespace n ON n.oid=c.relnamespace
          JOIN wanted w ON w.name=c.relname
          JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
          LEFT JOIN pg_attrdef ad ON ad.adrelid=c.oid AND ad.adnum=a.attnum
         WHERE n.nspname='public'
      ),
      conshape AS (
        SELECT c.relname,con.conname,con.contype::text contype,pg_get_constraintdef(con.oid,true) def
          FROM pg_constraint con
          JOIN pg_class c ON c.oid=con.conrelid
          JOIN pg_namespace n ON n.oid=c.relnamespace
          JOIN wanted w ON w.name=c.relname
         WHERE n.nspname='public' AND con.contype IN ('p','u','c','f')
      ),
      idxshape AS (
        SELECT i.tablename,i.indexname,i.indexdef
          FROM pg_indexes i
          JOIN wanted w ON w.name=i.tablename
         WHERE i.schemaname='public'
      )
      SELECT
        (SELECT md5(string_agg(relname||'|'||attnum::text||'|'||attname||'|'||typ||'|'||attnotnull::text||'|'||def,E'\\n' ORDER BY relname,attnum)) FROM colshape) AS column_fingerprint,
        (SELECT md5(string_agg(relname||'|'||conname||'|'||contype||'|'||def,E'\\n' ORDER BY relname,conname)) FROM conshape) AS constraint_fingerprint,
        (SELECT md5(string_agg(tablename||'|'||indexname||'|'||indexdef,E'\\n' ORDER BY tablename,indexname)) FROM idxshape) AS index_fingerprint
    `, [required])).rows[0];
    assert.equal(fp.column_fingerprint, AUTH.schema_contract.column_fingerprint_md5, "RUNTIME_ENV_COLUMN_FINGERPRINT_DRIFT");
    assert.equal(fp.constraint_fingerprint, AUTH.schema_contract.constraint_fingerprint_md5, "RUNTIME_ENV_CONSTRAINT_FINGERPRINT_DRIFT");
    assert.equal(fp.index_fingerprint, AUTH.schema_contract.index_fingerprint_md5, "RUNTIME_ENV_INDEX_FINGERPRINT_DRIFT");

    let zeroState: Record<string, number> | undefined;
    if (MODE === "zero-state") {
      zeroState = {};
      for (const relation of required) {
        const count = Number((await client.query(`SELECT count(*)::int AS n FROM public.${safeRelation(relation)}`)).rows[0]?.n ?? -1);
        zeroState[relation] = count;
        assert.equal(count, 0, `RUNTIME_ENV_ZERO_STATE_REQUIRED:${relation}`);
      }
    }

    await client.query("COMMIT");
    result = {
      ...result,
      status: "PASS",
      database_identity: identity,
      required_table_count: required.length,
      required_tables_present: rows,
      schema_fingerprints: fp,
      zero_state_counts: zeroState,
      schema_complete: true,
      zero_state_qualified: MODE === "zero-state",
    };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    result = { ...result, error: String(error instanceof Error ? error.message : error) };
    throw error;
  } finally {
    client.release();
    await pool.end();
    write(result);
  }
}

main().catch(() => { process.exitCode = 1; });
