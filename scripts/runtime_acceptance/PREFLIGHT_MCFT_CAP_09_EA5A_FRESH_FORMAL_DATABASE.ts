import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const AUTH_PATH = path.resolve(
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5A-FRESH-FORMAL-DATABASE-PREFLIGHT-V1.json",
);
const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_EA5A_FRESH_FORMAL_DATABASE_PREFLIGHT_RESULT.json",
);
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA ?? "").trim();
const DATABASE_URL = String(process.env.DATABASE_URL ?? "").trim();
const AUTH = JSON.parse(fs.readFileSync(AUTH_PATH, "utf8")) as {
  formal_database_identity: {
    project_id: string;
    branch_id: string;
    database_name: string;
    simulation_branch_id_forbidden: string;
  };
  formal_scope: Record<string, string>;
  required_schema_tables: string[];
  fresh_database_requirements: Record<string, number>;
};

const SCOPE_FIELDS = [
  "tenant_id",
  "project_id",
  "group_id",
  "field_id",
  "season_id",
  "zone_id",
] as const;
const FORBIDDEN_ACTION_TYPES = [
  "twin_decision_record_v1",
  "twin_recommendation_v1",
  "decision_recommendation_v1",
  "approval_request_v1",
  "ao_act_task_v1",
  "ao_act_receipt_v1",
  "dispatch_request_v1",
  "model_activation_v1",
];

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify(value, null, 2));
}

async function main(): Promise<void> {
  assert.match(SUBJECT_SHA, /^[0-9a-f]{40}$/, "EA5A_EXACT_SUBJECT_SHA_REQUIRED");
  assert(DATABASE_URL, "EA5A_DATABASE_URL_REQUIRED");
  const scope = AUTH.formal_scope;
  for (const field of SCOPE_FIELDS) assert(scope[field], `EA5A_SCOPE_REQUIRED:${field}`);

  const pool = new Pool({
    connectionString: DATABASE_URL,
    application_name: `mcft-cap09-ea5a-${SUBJECT_SHA.slice(0, 12)}`,
    max: 1,
  });

  let result: Record<string, unknown> = {
    schema_version: "geox_mcft_cap09_ea5a_fresh_formal_database_preflight_result_v1",
    status: "FAIL",
    subject_sha: SUBJECT_SHA,
    transaction_mode: "READ_ONLY",
    database_write_count: 0,
    formal_evidence_write_count: 0,
    schema_write_count: 0,
    public_provider_request_count: 0,
    formal_window_started: false,
    mcft_cap09_completed: false,
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");

    const identity = (await client.query<{
      database_name: string;
      neon_project_id: string | null;
      neon_branch_id: string | null;
      database_now_utc: Date;
      transaction_read_only: string;
    }>(`
      SELECT current_database() AS database_name,
             current_setting('neon.project_id', true) AS neon_project_id,
             current_setting('neon.branch_id', true) AS neon_branch_id,
             transaction_timestamp() AS database_now_utc,
             current_setting('transaction_read_only') AS transaction_read_only
    `)).rows[0];

    assert(identity, "EA5A_DATABASE_IDENTITY_REQUIRED");
    assert.equal(identity.database_name, AUTH.formal_database_identity.database_name, "EA5A_DATABASE_NAME_DRIFT");
    assert.equal(identity.neon_project_id, AUTH.formal_database_identity.project_id, "EA5A_NEON_PROJECT_ID_DRIFT");
    assert.equal(identity.neon_branch_id, AUTH.formal_database_identity.branch_id, "EA5A_NEON_BRANCH_ID_DRIFT");
    assert.notEqual(identity.neon_branch_id, AUTH.formal_database_identity.simulation_branch_id_forbidden, "EA5A_SIMULATION_BRANCH_REUSE_FORBIDDEN");
    assert.equal(identity.transaction_read_only, "on", "EA5A_READ_ONLY_TRANSACTION_REQUIRED");

    const tableRows = (await client.query<{ table_name: string }>(`
      SELECT table_name
        FROM information_schema.tables
       WHERE table_schema='public'
         AND table_name = ANY($1::text[])
       ORDER BY table_name
    `, [AUTH.required_schema_tables])).rows.map((row) => row.table_name);
    const missingTables = AUTH.required_schema_tables.filter((table) => !tableRows.includes(table));
    assert.deepEqual(missingTables, [], `EA5A_REQUIRED_SCHEMA_TABLES_MISSING:${missingTables.join(",")}`);

    const scopeValues = SCOPE_FIELDS.map((field) => scope[field]);
    const factCounts = (await client.query<{
      facts_total: number;
      external_scope_fact_count: number;
      field_c8_demo_reference_count: number;
      forbidden_action_fact_count_global: number;
    }>(`
      SELECT
        (SELECT count(*)::int FROM facts) AS facts_total,
        (SELECT count(*)::int FROM facts
          WHERE record_json#>>'{payload,tenant_id}'=$1
            AND record_json#>>'{payload,project_id}'=$2
            AND record_json#>>'{payload,group_id}'=$3
            AND record_json#>>'{payload,field_id}'=$4
            AND record_json#>>'{payload,season_id}'=$5
            AND record_json#>>'{payload,zone_id}'=$6) AS external_scope_fact_count,
        (SELECT count(*)::int FROM facts WHERE record_json::text LIKE '%field_c8_demo%') AS field_c8_demo_reference_count,
        (SELECT count(*)::int FROM facts WHERE record_json->>'type'=ANY($7::text[])) AS forbidden_action_fact_count_global
    `, [...scopeValues, FORBIDDEN_ACTION_TYPES])).rows[0];

    const projectionCounts = (await client.query<{
      external_scheduler_slot_count: number;
      external_scheduler_cursor_count: number;
      external_active_lineage_count: number;
      external_state_latest_count: number;
      external_forecast_latest_count: number;
      external_checkpoint_count: number;
      external_lease_count: number;
    }>(`
      SELECT
        (SELECT count(*)::int FROM twin_shadow_online_scheduler_slot_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS external_scheduler_slot_count,
        (SELECT count(*)::int FROM twin_shadow_online_scheduler_cursor_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS external_scheduler_cursor_count,
        (SELECT count(*)::int FROM twin_active_lineage_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS external_active_lineage_count,
        (SELECT count(*)::int FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS external_state_latest_count,
        (SELECT count(*)::int FROM twin_forecast_result_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS external_forecast_latest_count,
        (SELECT count(*)::int FROM twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS external_checkpoint_count,
        (SELECT count(*)::int FROM twin_runtime_lease_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS external_lease_count
    `, scopeValues)).rows[0];

    const observed = { ...factCounts, ...projectionCounts } as Record<string, number>;
    for (const [key, expected] of Object.entries(AUTH.fresh_database_requirements)) {
      assert.equal(observed[key], expected, `EA5A_FRESH_DATABASE_REQUIREMENT_FAIL:${key}:actual=${observed[key]}:expected=${expected}`);
    }

    await client.query("COMMIT");
    result = {
      ...result,
      status: "PASS",
      database_identity: {
        database_name: identity.database_name,
        neon_project_id: identity.neon_project_id,
        neon_branch_id: identity.neon_branch_id,
        simulation_branch_reused: false,
        database_now_utc: new Date(identity.database_now_utc).toISOString(),
      },
      required_schema_table_count: AUTH.required_schema_tables.length,
      missing_schema_tables: [],
      fresh_database_counts: observed,
      fresh_formal_database_identity_qualified: true,
      fresh_external_scope_preflight_qualified: true,
      ea5b_restricted_formal_ingress_candidate_authorized: true,
      external_package_formal_eligible: false,
      formal_o00_start_authorized: false,
    };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    result = {
      ...result,
      error: String(error instanceof Error ? error.message : error),
      fresh_formal_database_identity_qualified: false,
      fresh_external_scope_preflight_qualified: false,
      ea5b_restricted_formal_ingress_candidate_authorized: false,
      external_package_formal_eligible: false,
      formal_o00_start_authorized: false,
    };
    throw error;
  } finally {
    client.release();
    await pool.end();
    write(result);
  }
}

main().catch(() => {
  process.exitCode = 1;
});
