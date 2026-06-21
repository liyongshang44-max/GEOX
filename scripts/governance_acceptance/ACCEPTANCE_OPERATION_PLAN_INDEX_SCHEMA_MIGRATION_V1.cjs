// scripts/governance_acceptance/ACCEPTANCE_OPERATION_PLAN_INDEX_SCHEMA_MIGRATION_V1.cjs
const fs = require("fs");
const { Pool } = require("pg");

const MIGRATION = "apps/server/db/migrations/2026_06_21_operation_plan_index_v1.sql";
const PROBE_ID = "h38_schema_probe";

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail ? ` ${JSON.stringify(detail)}` : "";
    throw new Error(`${message}${suffix}`);
  }
  console.log(`PASS: ${message}`);
}

async function tableExists(client) {
  const result = await client.query("SELECT to_regclass('public.operation_plan_index_v1')::text AS name");
  return result.rows[0]?.name === "operation_plan_index_v1";
}

async function probeRowExists(client) {
  if (!(await tableExists(client))) return false;
  const result = await client.query(
    "SELECT 1 FROM public.operation_plan_index_v1 WHERE operation_plan_id = $1 LIMIT 1",
    [PROBE_ID],
  );
  return result.rowCount === 1;
}

async function main() {
  assert(fs.existsSync(MIGRATION), "migration file exists");

  const sql = fs.readFileSync(MIGRATION, "utf8");
  assert(sql.includes("operation_plan_index_v1"), "operation_plan_index_v1 table DDL is present");
  assert(/spatial_scope_json\s+jsonb/i.test(sql), "spatial_scope_json is JSONB");

  for (const indexName of [
    "idx_operation_plan_index_v1_scope_latest",
    "idx_operation_plan_index_v1_approval_request",
    "idx_operation_plan_index_v1_approval_decision_fact",
    "idx_operation_plan_index_v1_recommendation",
  ]) {
    assert(sql.includes(indexName), `required index ${indexName} exists in migration`);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  let rolledBack = false;

  try {
    await client.query("BEGIN");
    await client.query(sql);
    assert(await tableExists(client), "operation_plan_index_v1 table exists after migration inside transaction");

    const columns = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'operation_plan_index_v1'",
    );
    const columnMap = new Map(columns.rows.map((row) => [row.column_name, row.data_type]));

    for (const columnName of [
      "operation_plan_id",
      "tenant_id",
      "project_id",
      "group_id",
      "field_id",
      "zone_id",
      "spatial_scope_json",
      "season_id",
      "program_id",
      "recommendation_id",
      "recommendation_fact_id",
      "approval_request_id",
      "approval_decision",
      "approval_decision_fact_id",
      "status",
      "act_task_id",
      "receipt_fact_id",
      "source_fact_id",
      "created_ts",
      "updated_ts",
      "updated_at",
    ]) {
      assert(columnMap.has(columnName), `required column ${columnName} exists`);
    }

    assert(columnMap.get("spatial_scope_json") === "jsonb", "spatial_scope_json column has jsonb type");

    const indexes = await client.query(
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'operation_plan_index_v1'",
    );
    const indexNames = new Set(indexes.rows.map((row) => row.indexname));
    for (const indexName of [
      "idx_operation_plan_index_v1_scope_latest",
      "idx_operation_plan_index_v1_approval_request",
      "idx_operation_plan_index_v1_approval_decision_fact",
      "idx_operation_plan_index_v1_recommendation",
    ]) {
      assert(indexNames.has(indexName), `required index ${indexName} exists after migration`);
    }

    await client.query(
      "INSERT INTO public.operation_plan_index_v1 (operation_plan_id, tenant_id, project_id, group_id, status, created_ts, updated_ts) VALUES ($1, 'tenant_probe', 'project_probe', 'group_probe', 'CREATED', 1, 1)",
      [PROBE_ID],
    );
    assert(await probeRowExists(client), "probe row can be inserted");

    await client.query(sql);
    assert(true, "migration is idempotent");

    await client.query("ROLLBACK");
    rolledBack = true;
  } finally {
    if (!rolledBack) await client.query("ROLLBACK").catch(() => undefined);
    client.release();
  }

  const verificationClient = await pool.connect();
  try {
    assert(!(await probeRowExists(verificationClient)), "rollback removes probe row");
  } finally {
    verificationClient.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
