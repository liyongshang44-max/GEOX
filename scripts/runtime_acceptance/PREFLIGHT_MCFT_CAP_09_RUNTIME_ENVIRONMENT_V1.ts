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

async function main(): Promise<void> {
  assert(DATABASE_URL, "RUNTIME_ENV_DATABASE_URL_REQUIRED");
  assert(["schema", "zero-state"].includes(MODE), "RUNTIME_ENV_MODE_INVALID");
  const required = AUTH.schema_contract.minimum_required_tables as string[];
  assert(required.includes("twin_runtime_authority_snapshot_v1"), "AUTHORITY_SNAPSHOT_TABLE_MUST_BE_QUALIFIED");
  assert(required.includes("twin_state_history_projection_v1"), "STATE_HISTORY_TABLE_MUST_BE_QUALIFIED");
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

    const columnCounts = (await client.query(
      `SELECT table_name,count(*)::int AS column_count
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name = ANY($1::text[])
        GROUP BY table_name ORDER BY table_name`,
      [required],
    )).rows;
    assert.equal(columnCounts.length, required.length, "RUNTIME_ENV_COLUMN_SHAPE_INCOMPLETE");
    for (const row of columnCounts) assert(Number(row.column_count) > 0, `RUNTIME_ENV_EMPTY_TABLE_SHAPE:${row.table_name}`);

    let zeroState: Record<string, number> | undefined;
    if (MODE === "zero-state") {
      const counts = (await client.query(`SELECT
        (SELECT count(*)::int FROM facts) AS facts_total,
        (SELECT count(*)::int FROM twin_runtime_authority_snapshot_v1) AS authority_snapshot_total,
        (SELECT count(*)::int FROM twin_active_lineage_index_v1) AS active_lineage_total,
        (SELECT count(*)::int FROM twin_state_history_projection_v1) AS state_history_total,
        (SELECT count(*)::int FROM twin_state_latest_index_v1) AS state_latest_total,
        (SELECT count(*)::int FROM twin_forecast_result_latest_index_v1) AS forecast_result_latest_total,
        (SELECT count(*)::int FROM twin_forecast_success_latest_index_v1) AS forecast_success_latest_total,
        (SELECT count(*)::int FROM twin_runtime_checkpoint_latest_index_v1) AS checkpoint_total,
        (SELECT count(*)::int FROM twin_runtime_health_latest_index_v1) AS health_total,
        (SELECT count(*)::int FROM twin_runtime_lease_v1) AS lease_total,
        (SELECT count(*)::int FROM twin_shadow_online_scheduler_cursor_v1) AS scheduler_cursor_total,
        (SELECT count(*)::int FROM twin_shadow_online_scheduler_slot_v1) AS scheduler_slot_total,
        (SELECT count(*)::int FROM twin_terminal_tick_uniqueness_v1) AS terminal_tick_total`)).rows[0] as Record<string, number>;
      zeroState = counts;
      for (const [name, count] of Object.entries(counts)) assert.equal(Number(count), 0, `RUNTIME_ENV_ZERO_STATE_REQUIRED:${name}`);
    }
    await client.query("COMMIT");
    result = {
      ...result,
      status: "PASS",
      database_identity: identity,
      required_table_count: required.length,
      required_tables_present: rows,
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
