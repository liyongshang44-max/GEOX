// scripts/governance_acceptance/ACCEPTANCE_WEATHER_FORECAST_VERSION_SCHEMA_MIGRATION_V1.cjs
// Purpose: prove weather_forecast_index_v1 is versioned by the formal H13 SQL migration.
// Boundary: schema acceptance only; does not create live weather data, recommendations, prescriptions, operations, tasks, reports, or customer-facing decisions.

const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const ACCEPTANCE_NAME = "ACCEPTANCE_WEATHER_FORECAST_VERSION_SCHEMA_MIGRATION_V1";

function fail(message, detail) {
  console.error(`[${ACCEPTANCE_NAME}] FAIL:`, message);
  if (detail !== undefined) console.error(JSON.stringify(detail, null, 2));
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) fail(message, detail);
}

async function getColumns(client) {
  const result = await client.query(`
    SELECT
      column_name,
      is_nullable,
      data_type,
      udt_name,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'weather_forecast_index_v1'
    ORDER BY ordinal_position
  `);

  return result.rows;
}

async function assertRequiredColumns(client) {
  const columns = await getColumns(client);
  const byName = new Map(columns.map((row) => [row.column_name, row]));

  const required = [
    "issue_time",
    "forecast_version",
    "provider_run_id",
    "external_forecast_id",
    "version_json",
  ];

  for (const columnName of required) {
    assert(byName.has(columnName), `missing column ${columnName}`, columns);
  }

  assert(byName.get("issue_time").is_nullable === "NO", "issue_time must be NOT NULL", byName.get("issue_time"));
  assert(byName.get("forecast_version").is_nullable === "NO", "forecast_version must be NOT NULL", byName.get("forecast_version"));
  assert(byName.get("version_json").is_nullable === "NO", "version_json must be NOT NULL", byName.get("version_json"));
  assert(byName.get("version_json").udt_name === "jsonb", "version_json must be jsonb", byName.get("version_json"));
}

async function assertRequiredIndex(client) {
  const result = await client.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'weather_forecast_index_v1'
      AND indexname = 'idx_weather_forecast_index_v1_usable_lookup'
  `);

  assert(result.rows.length === 1, "usable forecast lookup index missing", result.rows);
}

async function assertRequiredColumnsAbsent(client) {
  const columns = await getColumns(client);
  const names = new Set(columns.map((row) => row.column_name));

  for (const columnName of ["issue_time", "forecast_version", "provider_run_id", "external_forecast_id", "version_json"]) {
    assert(!names.has(columnName), `test setup failed: ${columnName} should be absent before migration`, columns);
  }
}

(async () => {
  const repoRoot = process.cwd();
  const migrationPath = path.join(repoRoot, "apps", "server", "db", "migrations", "2026_06_16_weather_forecast_version_v1.sql");
  const runnerPath = path.join(repoRoot, "apps", "server", "src", "infra", "migrations.ts");

  assert(fs.existsSync(migrationPath), "formal migration file missing", migrationPath);
  assert(fs.existsSync(runnerPath), "server migration runner missing", runnerPath);

  const migrationSql = fs.readFileSync(migrationPath, "utf8").replace(/^\uFEFF/, "");
  const runnerSource = fs.readFileSync(runnerPath, "utf8").replace(/^\uFEFF/, "");

  assert(migrationSql.includes("CREATE TABLE IF NOT EXISTS public.weather_forecast_index_v1"), "migration must create table when missing");
  assert(migrationSql.includes("ADD COLUMN IF NOT EXISTS issue_time timestamptz"), "migration must add issue_time idempotently");
  assert(migrationSql.includes("ADD COLUMN IF NOT EXISTS forecast_version text"), "migration must add forecast_version idempotently");
  assert(migrationSql.includes("ADD COLUMN IF NOT EXISTS provider_run_id text"), "migration must add provider_run_id idempotently");
  assert(migrationSql.includes("ADD COLUMN IF NOT EXISTS external_forecast_id text"), "migration must add external_forecast_id idempotently");
  assert(migrationSql.includes("ADD COLUMN IF NOT EXISTS version_json jsonb NOT NULL DEFAULT '{}'::jsonb"), "migration must add version_json idempotently");
  assert(migrationSql.includes("idx_weather_forecast_index_v1_usable_lookup"), "migration must create usable lookup index");

  assert(runnerSource.includes('"apps", "server", "db", "migrations"'), "server migration runner must scan apps/server/db/migrations");
  assert(runnerSource.includes("name.endsWith(\".sql\")"), "server migration runner must execute sql migration files");

  const databaseUrl = process.env.DATABASE_URL;
  assert(databaseUrl, "DATABASE_URL is required");

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query("DROP TABLE IF EXISTS public.weather_forecast_index_v1");

    await client.query(migrationSql);
    await assertRequiredColumns(client);
    await assertRequiredIndex(client);

    await client.query("DROP TABLE IF EXISTS public.weather_forecast_index_v1");

    await client.query(`
      CREATE TABLE public.weather_forecast_index_v1 (
        forecast_id text PRIMARY KEY,
        tenant_id text NOT NULL,
        project_id text NOT NULL,
        group_id text NOT NULL,
        field_id text NOT NULL,
        provider text NOT NULL,
        source_type text NOT NULL,
        source_id text NOT NULL,
        latitude double precision,
        longitude double precision,
        generated_at timestamptz NOT NULL,
        valid_from timestamptz NOT NULL,
        valid_to timestamptz NOT NULL,
        horizon_hours integer NOT NULL,
        rainfall_forecast_mm_72h double precision,
        temperature_max_c_72h double precision,
        et0_mm_72h double precision,
        hourly_json jsonb NOT NULL DEFAULT '[]'::jsonb,
        quality_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        raw_payload_json jsonb,
        source_fact_id text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await assertRequiredColumnsAbsent(client);

    await client.query(`
      INSERT INTO public.weather_forecast_index_v1 (
        forecast_id,
        tenant_id,
        project_id,
        group_id,
        field_id,
        provider,
        source_type,
        source_id,
        generated_at,
        valid_from,
        valid_to,
        horizon_hours
      )
      VALUES (
        'wf_h13_schema_probe',
        'tenantA',
        'projectA',
        'groupA',
        'field_c8_irrigation',
        'MOCK',
        'MOCK',
        'migration_probe',
        now(),
        now(),
        now() + interval '72 hours',
        72
      )
    `);

    await client.query(migrationSql);
    await assertRequiredColumns(client);
    await assertRequiredIndex(client);

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

  console.log(`[${ACCEPTANCE_NAME}] PASS`);
})().catch((error) => {
  fail(error.message || "unexpected failure", error.stack || error);
});
