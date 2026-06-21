// scripts/governance_acceptance/ACCEPTANCE_SOIL_WATER_POTENTIAL_SCHEMA_MIGRATION_V1.cjs
// Purpose: prove H31 soil water potential schema migration is idempotent, non-destructive, and transaction-safe.

const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const ACCEPTANCE_NAME = "ACCEPTANCE_SOIL_WATER_POTENTIAL_SCHEMA_MIGRATION_V1";
const PROBE_ID = "h31_soil_water_potential_acceptance_schema_probe";

function fail(message, detail) {
  console.error(`[${ACCEPTANCE_NAME}] FAIL: ${message}`);
  if (detail !== undefined) console.error(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) fail(message, detail);
}

const REQUIRED_COLUMNS = {
  soil_hydraulic_profile_index_v1: [
    "profile_id",
    "tenant_id",
    "project_id",
    "group_id",
    "field_id",
    "zone_id",
    "layer_depth_cm",
    "texture_class",
    "theta_r",
    "theta_s",
    "alpha_per_kpa",
    "n",
    "m",
    "parameter_source",
    "calibration_status",
    "confidence_level",
    "confidence_score",
    "evidence_refs_json",
    "source_fact_id",
    "created_at",
    "updated_at",
  ],
  soil_water_potential_estimate_index_v1: [
    "estimate_id",
    "tenant_id",
    "project_id",
    "group_id",
    "field_id",
    "zone_id",
    "layer_depth_cm",
    "source_window_id",
    "source_profile_id",
    "observed_theta",
    "theta_unit",
    "normalized_theta_m3_m3",
    "matric_potential_kpa",
    "matric_potential_class",
    "available_water_fraction",
    "root_zone_weight",
    "input_status",
    "blocking_reasons_json",
    "hydraulic_profile_ref",
    "data_quality_ref",
    "evidence_refs_json",
    "calculation_inputs_json",
    "derivation_json",
    "confidence_json",
    "determinism_hash",
    "source_fact_id",
    "computed_at",
    "updated_at",
  ],
};

const REQUIRED_JSONB_COLUMNS = {
  soil_hydraulic_profile_index_v1: ["evidence_refs_json"],
  soil_water_potential_estimate_index_v1: [
    "blocking_reasons_json",
    "evidence_refs_json",
    "calculation_inputs_json",
    "derivation_json",
    "confidence_json",
  ],
};

const REQUIRED_INDEXES = [
  "idx_soil_hydraulic_profile_index_v1_scope_latest",
  "idx_soil_hydraulic_profile_index_v1_field",
  "idx_soil_water_potential_estimate_index_v1_scope_latest",
  "idx_soil_water_potential_estimate_index_v1_window",
  "idx_soil_water_potential_estimate_index_v1_profile",
];

async function assertTableShape(client, tableName) {
  const tableResult = await client.query("SELECT to_regclass($1)::text AS name", [`public.${tableName}`]);
  assert(
    String(tableResult.rows[0].name || "").endsWith(tableName),
    `table missing: ${tableName}`,
    tableResult.rows[0],
  );

  const columnResult = await client.query(
    `
      SELECT column_name, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
    `,
    [tableName],
  );
  const columnsByName = new Map(columnResult.rows.map((row) => [row.column_name, row]));

  for (const columnName of REQUIRED_COLUMNS[tableName]) {
    assert(columnsByName.has(columnName), `missing column ${tableName}.${columnName}`, columnResult.rows);
  }

  for (const columnName of REQUIRED_JSONB_COLUMNS[tableName]) {
    assert(
      columnsByName.get(columnName).udt_name === "jsonb",
      `${tableName}.${columnName} must be jsonb`,
      columnsByName.get(columnName),
    );
  }
}

async function assertIndexes(client) {
  const result = await client.query(
    `
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY($1::text[])
    `,
    [REQUIRED_INDEXES],
  );
  const names = new Set(result.rows.map((row) => row.indexname));

  for (const indexName of REQUIRED_INDEXES) {
    assert(names.has(indexName), `required index missing: ${indexName}`, result.rows);
  }
}

async function insertProbeRows(client) {
  await client.query(
    `
      INSERT INTO public.soil_hydraulic_profile_index_v1 (
        profile_id,
        tenant_id,
        project_id,
        group_id,
        field_id,
        zone_id,
        layer_depth_cm,
        texture_class,
        theta_r,
        theta_s,
        alpha_per_kpa,
        n,
        m,
        parameter_source,
        calibration_status,
        confidence_level,
        confidence_score
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, 30, 'loam',
        0.08, 0.43, 0.035, 1.56, 0.358974,
        'MANUAL', 'UNVERIFIED', 'LOW', 0.1
      )
      ON CONFLICT (tenant_id, project_id, group_id, field_id, zone_id, layer_depth_cm)
      DO UPDATE SET profile_id = EXCLUDED.profile_id
    `,
    [PROBE_ID, PROBE_ID, `${PROBE_ID}_project`, `${PROBE_ID}_group`, `${PROBE_ID}_field`, `${PROBE_ID}_zone`],
  );

  await client.query(
    `
      INSERT INTO public.soil_water_potential_estimate_index_v1 (
        estimate_id,
        tenant_id,
        project_id,
        group_id,
        field_id,
        zone_id,
        layer_depth_cm,
        theta_unit,
        matric_potential_class,
        root_zone_weight,
        input_status,
        determinism_hash,
        computed_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, 30,
        'm3_m3', 'UNKNOWN', 1, 'INVALID_INPUT', $7, now()
      )
      ON CONFLICT (estimate_id)
      DO UPDATE SET determinism_hash = EXCLUDED.determinism_hash
    `,
    [
      `${PROBE_ID}_estimate`,
      PROBE_ID,
      `${PROBE_ID}_project`,
      `${PROBE_ID}_group`,
      `${PROBE_ID}_field`,
      `${PROBE_ID}_zone`,
      `${PROBE_ID}_hash`,
    ],
  );
}

async function assertProbeRowsRolledBack(pool) {
  const profileResult = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM public.soil_hydraulic_profile_index_v1
      WHERE profile_id = $1
    `,
    [PROBE_ID],
  );
  assert(Number(profileResult.rows[0].count) === 0, "profile probe row survived rollback");

  const estimateResult = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM public.soil_water_potential_estimate_index_v1
      WHERE estimate_id = $1
    `,
    [`${PROBE_ID}_estimate`],
  );
  assert(Number(estimateResult.rows[0].count) === 0, "estimate probe row survived rollback");
}

(async () => {
  const migrationPath = path.join(
    process.cwd(),
    "apps/server/db/migrations/2026_06_21_soil_water_potential_foundation_v1.sql",
  );
  assert(fs.existsSync(migrationPath), "migration file missing", migrationPath);

  const migrationSql = fs.readFileSync(migrationPath, "utf8").replace(/^\uFEFF/, "");
  assert(!/\bDROP\s+TABLE\b/i.test(migrationSql), "migration must not drop tables");
  assert(!/\bTRUNCATE\b/i.test(migrationSql), "migration must not truncate tables");
  assert(!/DELETE\s+FROM\s+(public\.)?facts/i.test(migrationSql), "migration must not delete facts");

  for (const tableName of Object.keys(REQUIRED_COLUMNS)) {
    assert(
      migrationSql.includes(`CREATE TABLE IF NOT EXISTS public.${tableName}`),
      `migration must create ${tableName}`,
    );
  }
  for (const indexName of REQUIRED_INDEXES) {
    assert(migrationSql.includes(indexName), `migration must create ${indexName}`);
  }

  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_URL;
  assert(databaseUrl, "DATABASE_URL/POSTGRES_URL/PG_URL required");

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(migrationSql);
    await client.query(migrationSql);

    for (const tableName of Object.keys(REQUIRED_COLUMNS)) {
      await assertTableShape(client, tableName);
    }
    await assertIndexes(client);
    await insertProbeRows(client);
    await client.query("ROLLBACK");
    await assertProbeRowsRolledBack(pool);
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
