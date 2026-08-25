import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_V13_HOLISTIC_SCHEMA_POSTGRES_RESULT.json");
const EXPECTED_PREDECESSOR_TABLE_COUNT = 26;
const EXPECTED_V13_TABLE_COUNT = 29;
const EXPECTED_NEW_RELATIONS = [
  "twin_external_formal_forcing_base_cursor_v1",
  "twin_external_formal_forcing_base_target_v1",
  "twin_external_formal_forcing_controller_lease_v1",
] as const;
const PREDECESSOR_SCHEMA_CHAIN = [
  "docker/postgres/init/001_schema.sql",
  "apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql",
  "apps/server/db/migrations/2026_07_10_mcft_cap_01_closure_remediation.sql",
] as const;
const V13_MIGRATIONS = [
  "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_base_continuity.sql",
  "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_admission.sql",
  "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_lifecycle.sql",
] as const;

function md5Rows(rows: readonly Record<string, unknown>[], fields: readonly string[]): string {
  const lines = rows.map((row) => fields.map((field) => String(row[field] ?? "")).join("|")).join("\n");
  return crypto.createHash("md5").update(lines, "utf8").digest("hex");
}

async function publicTables(pool: Pool): Promise<string[]> {
  const rows = (await pool.query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'
      ORDER BY table_name ASC`,
  )).rows;
  return rows.map((row) => row.table_name);
}

async function columns(pool: Pool): Promise<Record<string, unknown>[]> {
  return (await pool.query(
    `SELECT c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod) AS typ,a.attnotnull,
            COALESCE(pg_get_expr(ad.adbin,ad.adrelid),'') AS def
       FROM pg_class c
       JOIN pg_namespace n ON n.oid=c.relnamespace
       JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
       LEFT JOIN pg_attrdef ad ON ad.adrelid=c.oid AND ad.adnum=a.attnum
      WHERE n.nspname='public' AND c.relkind='r'
      ORDER BY c.relname,a.attnum`,
  )).rows;
}

async function constraints(pool: Pool): Promise<Record<string, unknown>[]> {
  return (await pool.query(
    `SELECT c.relname,con.conname,con.contype::text AS contype,pg_get_constraintdef(con.oid,true) AS def
       FROM pg_constraint con
       JOIN pg_class c ON c.oid=con.conrelid
       JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' AND con.contype IN ('p','u','c','f')
      ORDER BY c.relname,con.conname`,
  )).rows;
}

async function indexes(pool: Pool): Promise<Record<string, unknown>[]> {
  return (await pool.query(
    `SELECT tablename,indexname,indexdef
       FROM pg_indexes
      WHERE schemaname='public'
      ORDER BY tablename,indexname`,
  )).rows;
}

async function factsColumns(pool: Pool): Promise<unknown[]> {
  return (await pool.query(
    `SELECT column_name,ordinal_position,data_type,udt_name,is_nullable,column_default
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='facts'
      ORDER BY ordinal_position`,
  )).rows;
}

async function applyFiles(pool: Pool, files: readonly string[]): Promise<void> {
  for (const file of files) await pool.query(fs.readFileSync(path.join(ROOT, file), "utf8"));
}

async function main(): Promise<void> {
  if (process.env.MCFT_CAP09_V13_HOLISTIC_SCHEMA_DESTRUCTIVE_ACCEPTANCE !== "1") {
    throw new Error("SET_MCFT_CAP09_V13_HOLISTIC_SCHEMA_DESTRUCTIVE_ACCEPTANCE_1");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_REQUIRED");
  const pool = new Pool({ connectionString: url, max: 4 });
  try {
    await pool.query("DROP SCHEMA public CASCADE");
    await pool.query("CREATE SCHEMA public");
    await applyFiles(pool, PREDECESSOR_SCHEMA_CHAIN);

    const predecessorTables = await publicTables(pool);
    assert.equal(predecessorTables.length, EXPECTED_PREDECESSOR_TABLE_COUNT, `V13_SCHEMA_PREDECESSOR_TABLE_COUNT:${predecessorTables.length}`);
    const predecessorFactsColumns = await factsColumns(pool);
    if (predecessorFactsColumns.length === 0) throw new Error("V13_SCHEMA_PREDECESSOR_FACTS_REQUIRED");

    await applyFiles(pool, V13_MIGRATIONS);

    const v13Tables = await publicTables(pool);
    assert.equal(v13Tables.length, EXPECTED_V13_TABLE_COUNT, `V13_SCHEMA_FINAL_TABLE_COUNT:${v13Tables.length}`);
    const delta = v13Tables.filter((name) => !predecessorTables.includes(name)).sort();
    assert.deepEqual(delta, [...EXPECTED_NEW_RELATIONS].sort(), "V13_SCHEMA_EXACT_NEW_RELATION_SET_REQUIRED");
    for (const expected of EXPECTED_NEW_RELATIONS) assert.equal(v13Tables.includes(expected), true, `V13_SCHEMA_RELATION_MISSING:${expected}`);

    const v13FactsColumns = await factsColumns(pool);
    assert.deepEqual(v13FactsColumns, predecessorFactsColumns, "V13_SCHEMA_CANONICAL_FACTS_SCHEMA_MUTATION_FORBIDDEN");

    const newRelationColumns = (await pool.query<{ table_name: string; column_name: string }>(
      `SELECT table_name,column_name
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name=ANY($1::text[])
        ORDER BY table_name,ordinal_position`,
      [[...EXPECTED_NEW_RELATIONS]],
    )).rows;
    const newRelationConstraints = (await pool.query<{ table_name: string; constraint_name: string }>(
      `SELECT c.relname AS table_name, con.conname AS constraint_name
         FROM pg_constraint con
         JOIN pg_class c ON c.oid=con.conrelid
         JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relname=ANY($1::text[])
        ORDER BY c.relname,con.conname`,
      [[...EXPECTED_NEW_RELATIONS]],
    )).rows;
    const newRelationIndexes = (await pool.query<{ tablename: string; indexname: string }>(
      `SELECT tablename,indexname
         FROM pg_indexes
        WHERE schemaname='public' AND tablename=ANY($1::text[])
        ORDER BY tablename,indexname`,
      [[...EXPECTED_NEW_RELATIONS]],
    )).rows;
    for (const expected of EXPECTED_NEW_RELATIONS) {
      if (!newRelationColumns.some((row) => row.table_name === expected)) throw new Error(`V13_SCHEMA_COLUMNS_MISSING:${expected}`);
      if (!newRelationConstraints.some((row) => row.table_name === expected)) throw new Error(`V13_SCHEMA_CONSTRAINTS_MISSING:${expected}`);
      if (!newRelationIndexes.some((row) => row.tablename === expected)) throw new Error(`V13_SCHEMA_INDEXES_MISSING:${expected}`);
      const count = Number((await pool.query(`SELECT count(*)::int AS n FROM public.${expected}`)).rows[0]?.n ?? -1);
      assert.equal(count, 0, `V13_SCHEMA_NEW_RELATION_NOT_ZERO_STATE:${expected}:${count}`);
    }

    const allColumns = await columns(pool);
    const allConstraints = await constraints(pool);
    const allIndexes = await indexes(pool);
    const result = {
      status: "PASS",
      acceptance_mode: "REAL_POSTGRES_HOLISTIC_V13_SCHEMA",
      predecessor_schema_chain: [...PREDECESSOR_SCHEMA_CHAIN],
      predecessor_public_table_count: predecessorTables.length,
      v13_required_public_table_count: v13Tables.length,
      exact_new_operational_relations: delta,
      operational_table_delta: delta.length,
      v13_migration_order: [...V13_MIGRATIONS],
      canonical_facts_schema_unchanged: true,
      all_new_relations_zero_state: true,
      columns_observed_from_pg_catalog: true,
      constraints_observed_from_pg_catalog: true,
      indexes_observed_from_pg_indexes: true,
      v13_column_fingerprint_md5: md5Rows(allColumns, ["relname","attnum","attname","typ","attnotnull","def"]),
      v13_constraint_fingerprint_md5: md5Rows(allConstraints, ["relname","conname","contype","def"]),
      v13_index_fingerprint_md5: md5Rows(allIndexes, ["tablename","indexname","indexdef"]),
      exact_head_fingerprint_candidate_generated: true,
      production_workflow_effect: false,
      formal_v4_mutation_performed: false,
      mcft_cap09_completed: false,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ status: "FAIL", error: error instanceof Error ? error.message : String(error) }, null, 2) + "\n");
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
