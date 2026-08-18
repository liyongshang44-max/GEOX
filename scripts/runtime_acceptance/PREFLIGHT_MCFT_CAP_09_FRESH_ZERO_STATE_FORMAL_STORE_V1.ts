import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const AUTH_PATH = path.resolve(
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FRESH-ZERO-STATE-FORMAL-STORE-REQUALIFICATION-V1.json",
);
const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_FRESH_ZERO_STATE_FORMAL_STORE_IDENTITY_RESULT.json",
);
const DATABASE_URL = String(process.env.DATABASE_URL ?? "").trim();
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA ?? "").trim();
const AUTH = JSON.parse(fs.readFileSync(AUTH_PATH, "utf8"));

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify(value, null, 2));
}

async function main(): Promise<void> {
  assert(DATABASE_URL, "FRESH_STORE_DATABASE_URL_REQUIRED");
  assert.match(SUBJECT_SHA, /^[0-9a-f]{40}$/, "FRESH_STORE_EXACT_SUBJECT_SHA_REQUIRED");
  assert.equal(AUTH.exact_predecessor_main_sha, "051150d1355529cc3062b6a084fc4fe46f1d9047");
  assert.equal(AUTH.formal_database_identity.database_name, "geox_mcft_cap09_s6_formal_t3r1_24h_v3");
  assert.equal(AUTH.formal_database_identity.failed_database_reuse_forbidden, "geox_mcft_cap09_s6_formal_t3r1_24h_v2");
  assert.equal(AUTH.formal_database_identity.creation_mode, "CREATE_DATABASE_TEMPLATE0_NO_DATA_CLONE");
  assert.equal(AUTH.schema_contract.required_table_count, 26);
  assert.equal(AUTH.schema_contract.public_table_count, 26);
  assert.equal(AUTH.qualification_contract.transaction_mode, "READ_ONLY");

  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 1,
    application_name: `mcft-cap09-fresh-v3-${SUBJECT_SHA.slice(0, 12)}`,
  });
  const client = await pool.connect();
  let result: Record<string, unknown> = {
    schema_version: "geox_mcft_cap09_fresh_zero_state_formal_store_identity_result_v1",
    status: "FAIL",
    subject_sha: SUBJECT_SHA,
    transaction_mode: "READ_ONLY",
    database_write_count: 0,
    formal_runtime_write_count: 0,
    public_provider_request_count: 0,
    formal_effect: false,
  };

  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    const identity = (await client.query(`
      SELECT current_database()::text AS database_name,
             current_setting('neon.project_id', true)::text AS neon_project_id,
             current_setting('neon.branch_id', true)::text AS neon_branch_id,
             current_setting('transaction_read_only')::text AS transaction_read_only,
             current_setting('server_version_num')::text AS server_version_num,
             transaction_timestamp() AS database_now_utc
    `)).rows[0];

    assert(identity, "FRESH_STORE_DATABASE_IDENTITY_REQUIRED");
    assert.equal(identity.database_name, AUTH.formal_database_identity.database_name, "FRESH_STORE_DATABASE_NAME_DRIFT");
    assert.notEqual(identity.database_name, AUTH.formal_database_identity.failed_database_reuse_forbidden, "FAILED_V2_STORE_REUSE_FORBIDDEN");
    assert.notEqual(identity.database_name, AUTH.formal_database_identity.historical_schema_reference_database, "HISTORICAL_STORE_EXECUTION_REUSE_FORBIDDEN");
    assert.equal(identity.neon_project_id, AUTH.formal_database_identity.project_id, "FRESH_STORE_NEON_PROJECT_ID_DRIFT");
    assert.equal(identity.neon_branch_id, AUTH.formal_database_identity.branch_id, "FRESH_STORE_NEON_BRANCH_ID_DRIFT");
    assert.equal(identity.transaction_read_only, "on", "FRESH_STORE_READ_ONLY_TRANSACTION_REQUIRED");

    const publicTableCount = Number((await client.query(`
      SELECT count(*)::int AS n
        FROM information_schema.tables
       WHERE table_schema='public'
    `)).rows[0]?.n ?? -1);
    assert.equal(publicTableCount, AUTH.schema_contract.public_table_count, "FRESH_STORE_PUBLIC_TABLE_COUNT_DRIFT");

    await client.query("COMMIT");
    result = {
      ...result,
      status: "PASS",
      database_identity: {
        ...identity,
        database_now_utc: new Date(identity.database_now_utc).toISOString(),
      },
      public_table_count: publicTableCount,
      failed_v2_reused: false,
      historical_store_reused: false,
      exact_identity_qualified: true,
      repository_effect_claimed: false,
      future_epoch_selected: false,
      a0_started: false,
      formal_o00_started: false,
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
