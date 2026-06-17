// scripts/governance_acceptance/ACCEPTANCE_IRRIGATION_SCENARIO_SET_SCHEMA_MIGRATION_V1.cjs
// Purpose: prove H15 irrigation_scenario_set_index_v1 is created by the formal SQL migration.
// Boundary: schema acceptance only; no recommendation, approval, operation, AO-ACT, report, frontend, or customer page behavior.

const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const ACCEPTANCE_NAME = "ACCEPTANCE_IRRIGATION_SCENARIO_SET_SCHEMA_MIGRATION_V1";

function fail(message, detail) {
  console.error(`[${ACCEPTANCE_NAME}] FAIL:`, message);
  if (detail !== undefined) console.error(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) fail(message, detail);
}

async function getColumns(client) {
  const result = await client.query(`
    SELECT column_name, is_nullable, data_type, udt_name, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'irrigation_scenario_set_index_v1'
    ORDER BY ordinal_position
  `);

  return result.rows;
}

async function assertRequiredColumns(client) {
  const columns = await getColumns(client);
  const byName = new Map(columns.map((row) => [row.column_name, row]));

  const required = [
    "scenario_set_id",
    "tenant_id",
    "project_id",
    "group_id",
    "field_id",
    "season_id",
    "source_water_state_estimate_id",
    "source_requirement_id",
    "source_forecast_id",
    "source_sensing_window_id",
    "baseline_water_state",
    "baseline_soil_moisture_percent",
    "target_min_soil_moisture_percent",
    "target_max_soil_moisture_percent",
    "net_irrigation_mm",
    "gross_irrigation_requirement_mm",
    "options_json",
    "recommended_option_id",
    "input_refs_json",
    "evidence_refs_json",
    "derivation_json",
    "quality_json",
    "confidence_json",
    "source_fact_id",
    "created_at",
    "updated_at",
  ];

  for (const columnName of required) {
    assert(byName.has(columnName), `missing column ${columnName}`, columns);
  }

  for (const columnName of [
    "scenario_set_id",
    "tenant_id",
    "project_id",
    "group_id",
    "field_id",
    "season_id",
    "options_json",
    "input_refs_json",
    "evidence_refs_json",
    "derivation_json",
    "quality_json",
    "confidence_json",
    "created_at",
    "updated_at",
  ]) {
    assert(byName.get(columnName).is_nullable === "NO", `${columnName} must be NOT NULL`, byName.get(columnName));
  }

  for (const columnName of [
    "options_json",
    "input_refs_json",
    "evidence_refs_json",
    "derivation_json",
    "quality_json",
    "confidence_json",
  ]) {
    assert(byName.get(columnName).udt_name === "jsonb", `${columnName} must be jsonb`, byName.get(columnName));
  }
}

async function assertOptionsArrayConstraint(client) {
  const result = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'public.irrigation_scenario_set_index_v1'::regclass
      AND conname = 'irrigation_scenario_set_index_v1_options_array_check'
  `);

  assert(result.rows.length === 1, "options_json array CHECK constraint missing", result.rows);
  assert(String(result.rows[0].def).includes("jsonb_typeof(options_json)"), "options_json CHECK must use jsonb_typeof", result.rows[0]);
  assert(String(result.rows[0].def).includes("'array'"), "options_json CHECK must require array", result.rows[0]);
}

async function assertRequiredIndexes(client) {
  const result = await client.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'irrigation_scenario_set_index_v1'
      AND indexname = ANY($1::text[])
    ORDER BY indexname
  `, [[
    "idx_irrigation_scenario_set_index_v1_requirement",
    "idx_irrigation_scenario_set_index_v1_scope_latest",
    "idx_irrigation_scenario_set_index_v1_water_state",
  ]]);

  const names = new Set(result.rows.map((row) => row.indexname));

  assert(names.has("idx_irrigation_scenario_set_index_v1_scope_latest"), "scope latest index missing", result.rows);
  assert(names.has("idx_irrigation_scenario_set_index_v1_water_state"), "water state index missing", result.rows);
  assert(names.has("idx_irrigation_scenario_set_index_v1_requirement"), "requirement index missing", result.rows);
}

(async () => {
  const repoRoot = process.cwd();
  const migrationPath = path.join(repoRoot, "apps", "server", "db", "migrations", "2026_06_16_irrigation_scenario_set_v1.sql");
  const runnerPath = path.join(repoRoot, "apps", "server", "src", "infra", "migrations.ts");

  assert(fs.existsSync(migrationPath), "formal migration file missing", migrationPath);
  assert(fs.existsSync(runnerPath), "server migration runner missing", runnerPath);

  const migrationSql = fs.readFileSync(migrationPath, "utf8").replace(/^\uFEFF/, "");
  const runnerSource = fs.readFileSync(runnerPath, "utf8").replace(/^\uFEFF/, "");

  assert(migrationSql.includes("CREATE TABLE IF NOT EXISTS public.irrigation_scenario_set_index_v1"), "migration must create irrigation_scenario_set_index_v1");
  assert(migrationSql.includes("recommended_option_id text"), "migration must include nullable recommended_option_id");
  assert(migrationSql.includes("idx_irrigation_scenario_set_index_v1_scope_latest"), "migration must define scope latest index");
  assert(migrationSql.includes("idx_irrigation_scenario_set_index_v1_water_state"), "migration must define water state index");
  assert(migrationSql.includes("idx_irrigation_scenario_set_index_v1_requirement"), "migration must define requirement index");

  assert(runnerSource.includes('"apps", "server", "db", "migrations"'), "server migration runner must scan apps/server/db/migrations");
  assert(runnerSource.includes("name.endsWith(\".sql\")"), "server migration runner must execute sql migration files");

  const databaseUrl = process.env.DATABASE_URL;
  assert(databaseUrl, "DATABASE_URL is required");

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DROP TABLE IF EXISTS public.irrigation_scenario_set_index_v1");
    await client.query(migrationSql);

    await assertRequiredColumns(client);
    await assertOptionsArrayConstraint(client);
    await assertRequiredIndexes(client);

    await client.query(`
      INSERT INTO public.irrigation_scenario_set_index_v1 (
        scenario_set_id,
        tenant_id,
        project_id,
        group_id,
        field_id,
        season_id,
        options_json,
        recommended_option_id
      )
      VALUES (
        'full_review_seed_tenantA_iscen_schema_probe',
        'tenantA',
        'projectA',
        'groupA',
        'field_c8_demo',
        'season_2026_c8_corn',
        '[]'::jsonb,
        NULL
      )
    `);

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
