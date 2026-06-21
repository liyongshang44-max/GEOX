// scripts/governance_acceptance/ACCEPTANCE_ROOT_ZONE_IRRIGATION_SCENARIO_SCHEMA_MIGRATION_V1.cjs
const fs = require("node:fs");
const { Pool } = require("pg");

const ACCEPTANCE_NAME = "ACCEPTANCE_ROOT_ZONE_IRRIGATION_SCENARIO_SCHEMA_MIGRATION_V1";
const MIGRATION_PATH = "apps/server/db/migrations/2026_06_21_root_zone_irrigation_scenario_set_v1.sql";
const TABLE_NAME = "root_zone_irrigation_scenario_set_index_v1";
const PROBE_ID = "h34_root_zone_irrigation_scenario_acceptance_schema_probe";

const REQUIRED_COLUMNS = [
  "scenario_set_id",
  "tenant_id",
  "project_id",
  "group_id",
  "field_id",
  "zone_id",
  "source_forecast_id",
  "source_forecast_ref",
  "baseline_mode",
  "comparison_mode",
  "horizon_days",
  "root_zone_depth_cm",
  "root_zone_available_water_capacity_mm",
  "baseline_summary_json",
  "options_json",
  "input_status",
  "blocking_reasons_json",
  "calculation_inputs_json",
  "derivation_json",
  "confidence_json",
  "determinism_hash",
  "source_fact_id",
  "computed_at",
  "updated_at",
];

const JSONB_COLUMNS = [
  "baseline_summary_json",
  "options_json",
  "blocking_reasons_json",
  "calculation_inputs_json",
  "derivation_json",
  "confidence_json",
];

const REQUIRED_INDEXES = [
  "idx_root_zone_irrigation_scenario_set_index_v1_scope_latest",
  "idx_root_zone_irrigation_scenario_set_index_v1_field_latest",
  "idx_root_zone_irrigation_scenario_set_index_v1_source_forecast",
];

function fail(message, detail) {
  console.error(`[${ACCEPTANCE_NAME}] FAIL: ${message}`);
  if (detail !== undefined) {
    console.error(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
  }
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) fail(message, detail);
}

function readMigrationSql() {
  assert(fs.existsSync(MIGRATION_PATH), "migration file exists");

  const sql = fs.readFileSync(MIGRATION_PATH, "utf8");
  assert(!/DROP\s+TABLE/i.test(sql), "migration must not drop tables");
  assert(!/TRUNCATE/i.test(sql), "migration must not truncate production tables");

  return sql;
}

async function relationExists(client, tableName) {
  const result = await client.query("SELECT to_regclass($1)::text AS name", [`public.${tableName}`]);
  return Boolean(result.rows[0]?.name);
}

async function columnTypeMap(client) {
  const result = await client.query(
    `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
    `,
    [TABLE_NAME],
  );

  return Object.fromEntries(result.rows.map((row) => [row.column_name, row.data_type]));
}

async function indexNames(client) {
  const result = await client.query(
    `
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = $1
    `,
    [TABLE_NAME],
  );

  return result.rows.map((row) => row.indexname);
}

async function assertSchema(client) {
  assert(await relationExists(client, TABLE_NAME), "table exists after migration inside transaction");

  const columns = await columnTypeMap(client);
  for (const column of REQUIRED_COLUMNS) {
    assert(columns[column], `required column exists: ${column}`);
  }

  for (const column of JSONB_COLUMNS) {
    assert(columns[column] === "jsonb", `JSONB column is JSONB: ${column}`);
  }

  const indexes = await indexNames(client);
  for (const index of REQUIRED_INDEXES) {
    assert(indexes.includes(index), `required index exists: ${index}`);
  }
}

async function insertProbeRow(client) {
  await client.query(
    `
      INSERT INTO public.root_zone_irrigation_scenario_set_index_v1 (
        scenario_set_id,
        tenant_id,
        project_id,
        group_id,
        field_id,
        zone_id,
        source_forecast_id,
        source_forecast_ref,
        baseline_mode,
        comparison_mode,
        horizon_days,
        root_zone_depth_cm,
        root_zone_available_water_capacity_mm,
        input_status,
        determinism_hash,
        computed_at
      )
      VALUES (
        $1,
        'tenant_probe',
        'project_probe',
        'group_probe',
        'field_probe',
        'zone_probe',
        'forecast_probe',
        'forecast_probe',
        'FORECAST_BASELINE',
        'HYPOTHETICAL_IRRIGATION_OPTIONS',
        7,
        60,
        100,
        'COMPARABLE',
        'schema_probe_hash',
        '2026-06-21T00:00:00Z'
      )
    `,
    [PROBE_ID],
  );

  const result = await client.query(
    `
      SELECT COUNT(*)::int AS count
      FROM public.root_zone_irrigation_scenario_set_index_v1
      WHERE scenario_set_id = $1
    `,
    [PROBE_ID],
  );

  assert(Number(result.rows[0]?.count ?? 0) === 1, "probe row can be inserted");
}

async function assertProbeAbsent(pool) {
  if (!(await relationExists(pool, TABLE_NAME))) return;

  const result = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM public.root_zone_irrigation_scenario_set_index_v1
      WHERE scenario_set_id = $1
    `,
    [PROBE_ID],
  );

  assert(Number(result.rows[0]?.count ?? 0) === 0, "rollback removes probe row");
}

(async () => {
  const sql = readMigrationSql();
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_URL;
  assert(databaseUrl, "DATABASE_URL/POSTGRES_URL/PG_URL required");

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(sql);

    await assertSchema(client);
    await insertProbeRow(client);

    await client.query("ROLLBACK");
    await assertProbeAbsent(pool);

    console.log(`[${ACCEPTANCE_NAME}] PASS`);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    fail(error.message, error.stack);
  } finally {
    client.release();
    await pool.end();
  }
})();
