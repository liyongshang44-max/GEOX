// scripts/governance_acceptance/ACCEPTANCE_IRRIGATION_REQUIREMENT_DERIVATION_SCHEMA_MIGRATION_V1.cjs
// Purpose: prove old irrigation_requirement_index_v1 schemas are repaired by the formal SQL migration.
// Boundary: schema acceptance only; does not change seed data, algorithm output, report semantics, or API contracts.

const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

function fail(message, detail) {
  console.error("[ACCEPTANCE_IRRIGATION_REQUIREMENT_DERIVATION_SCHEMA_MIGRATION_V1] FAIL:", message);
  if (detail !== undefined) console.error(JSON.stringify(detail, null, 2));
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) fail(message, detail);
}

async function columnExists(client) {
  const result = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'irrigation_requirement_index_v1'
      AND column_name = 'derivation_json'
  `);
  return result.rows.length === 1;
}

(async () => {
  const repoRoot = process.cwd();
  const migrationPath = path.join(repoRoot, "apps", "server", "db", "migrations", "2026_06_15_irrigation_requirement_derivation_json_v1.sql");
  const runnerPath = path.join(repoRoot, "apps", "server", "src", "infra", "migrations.ts");

  assert(fs.existsSync(migrationPath), "formal migration file missing", migrationPath);
  assert(fs.existsSync(runnerPath), "server migration runner missing", runnerPath);

  const migrationSql = fs.readFileSync(migrationPath, "utf8").replace(/^\uFEFF/, "");
  const runnerSource = fs.readFileSync(runnerPath, "utf8").replace(/^\uFEFF/, "");

  assert(migrationSql.includes("to_regclass('public.irrigation_requirement_index_v1') IS NOT NULL"), "migration must tolerate table-missing databases");
  assert(migrationSql.includes("ADD COLUMN IF NOT EXISTS derivation_json jsonb NOT NULL DEFAULT '{}'::jsonb"), "migration must add derivation_json idempotently");
  assert(runnerSource.includes('"apps", "server", "db", "migrations"'), "server migration runner must scan apps/server/db/migrations");
  assert(runnerSource.includes("name.endsWith(\".sql\")"), "server migration runner must execute sql migration files");

  const databaseUrl = process.env.DATABASE_URL;
  assert(databaseUrl, "DATABASE_URL is required");

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tableResult = await client.query("SELECT to_regclass('public.irrigation_requirement_index_v1') AS table_name");
    const tableAlreadyExisted = Boolean(tableResult.rows[0]?.table_name);

    if (!tableAlreadyExisted) {
      await client.query("CREATE TABLE public.irrigation_requirement_index_v1 (migration_acceptance_probe text)");
    } else {
      await client.query("ALTER TABLE public.irrigation_requirement_index_v1 DROP COLUMN IF EXISTS derivation_json");
    }

    const before = await columnExists(client);
    assert(before === false, "test setup failed: derivation_json should be absent before migration");

    await client.query(migrationSql);

    const after = await columnExists(client);
    assert(after === true, "formal migration did not restore derivation_json");

    await client.query("ROLLBACK");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.log("[ACCEPTANCE_IRRIGATION_REQUIREMENT_DERIVATION_SCHEMA_MIGRATION_V1] PASS");
})().catch((error) => {
  fail(error.message || "unexpected failure", error.stack || error);
});
