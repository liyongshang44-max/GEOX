import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const AUTH_PATH = path.resolve(
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5A-FRESH-FORMAL-DATABASE-PREFLIGHT-V2.json",
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
    existing_t1r1_database_name_forbidden_as_t3r1_storage: string;
  };
  formal_scope: Record<string, string>;
  fresh_database_requirements: {
    schema_must_match_formal_runtime_requirements: boolean;
    facts_total: number;
    twin_lineage_v1_total: number;
    twin_state_estimate_v1_total: number;
    twin_forecast_v1_total: number;
    twin_runtime_checkpoint_latest_index_v1_total: number;
    twin_shadow_online_scheduler_slot_v1_total: number;
    t1r1_scope_row_count: number;
    t3r1_scope_row_count_before_bootstrap: number;
    cross_scope_canonical_stitching_authorized: boolean;
  };
};

const REQUIRED_SCHEMA_TABLES = [
  "facts",
  "twin_object_idempotency_index_v1",
  "twin_active_lineage_index_v1",
  "twin_state_latest_index_v1",
  "twin_forecast_result_latest_index_v1",
  "twin_forecast_success_latest_index_v1",
  "twin_runtime_checkpoint_latest_index_v1",
  "twin_runtime_health_latest_index_v1",
  "twin_runtime_lease_v1",
  "twin_shadow_online_scheduler_cursor_v1",
  "twin_shadow_online_scheduler_slot_v1",
  "twin_terminal_tick_uniqueness_v1",
] as const;

const SCOPE_FIELDS = [
  "tenant_id",
  "project_id",
  "group_id",
  "field_id",
  "season_id",
  "zone_id",
] as const;

const T1R1_SCOPE = {
  tenant_id: "tenant_mcft_external",
  project_id: "project_mcft_cap09",
  group_id: "group_public_research",
  field_id: "field_kbs_mcse_t1r1",
  season_id: "season_2026_corn",
  zone_id: "zone_kbs_mcse_t1r1_formal_v1",
};

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify(value, null, 2));
}

async function main(): Promise<void> {
  assert.match(SUBJECT_SHA, /^[0-9a-f]{40}$/, "EA5A_EXACT_SUBJECT_SHA_REQUIRED");
  assert(DATABASE_URL, "EA5A_DATABASE_URL_REQUIRED");
  assert.equal(AUTH.fresh_database_requirements.schema_must_match_formal_runtime_requirements, true, "EA5A_V2_SCHEMA_MATCH_AUTHORITY_REQUIRED");
  assert.equal(AUTH.fresh_database_requirements.cross_scope_canonical_stitching_authorized, false, "EA5A_CROSS_SCOPE_STITCHING_MUST_REMAIN_FORBIDDEN");

  const scope = AUTH.formal_scope;
  for (const field of SCOPE_FIELDS) assert(scope[field], `EA5A_SCOPE_REQUIRED:${field}`);

  const pool = new Pool({
    connectionString: DATABASE_URL,
    application_name: `mcft-cap09-ea5a-t3r1-${SUBJECT_SHA.slice(0, 12)}`,
    max: 1,
  });

  let result: Record<string, unknown> = {
    schema_version: "geox_mcft_cap09_ea5a_fresh_formal_database_preflight_result_v2",
    status: "FAIL",
    subject_sha: SUBJECT_SHA,
    transaction_mode: "READ_ONLY",
    database_write_count: 0,
    formal_evidence_write_count: 0,
    schema_write_count: 0,
    public_provider_request_count: 0,
    formal_window_started: false,
    fresh_bootstrap_authorized: false,
    ea5e2_operational_activation_authorized: false,
    mcft_cap09_completed: false,
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");

    const identity = (await client.query<{
      database_name: string;
      neon_project_id: string | null;
      neon_branch_id: string | null;
      transaction_read_only: string;
      database_now_utc: Date;
    }>(`
      SELECT current_database() AS database_name,
             current_setting('neon.project_id', true) AS neon_project_id,
             current_setting('neon.branch_id', true) AS neon_branch_id,
             current_setting('transaction_read_only') AS transaction_read_only,
             transaction_timestamp() AS database_now_utc
    `)).rows[0];

    assert(identity, "EA5A_DATABASE_IDENTITY_REQUIRED");
    assert.equal(identity.database_name, AUTH.formal_database_identity.database_name, "EA5A_DATABASE_NAME_DRIFT");
    assert.notEqual(identity.database_name, AUTH.formal_database_identity.existing_t1r1_database_name_forbidden_as_t3r1_storage, "EA5A_T1R1_DATABASE_REUSE_FORBIDDEN");
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
    `, [REQUIRED_SCHEMA_TABLES])).rows.map((row) => row.table_name);
    const missingTables = REQUIRED_SCHEMA_TABLES.filter((table) => !tableRows.includes(table));
    assert.deepEqual(missingTables, [], `EA5A_REQUIRED_SCHEMA_TABLES_MISSING:${missingTables.join(",")}`);

    const globalCounts = (await client.query<{
      facts_total: number;
      twin_lineage_v1_total: number;
      twin_state_estimate_v1_total: number;
      twin_forecast_v1_total: number;
      twin_runtime_checkpoint_latest_index_v1_total: number;
      twin_shadow_online_scheduler_slot_v1_total: number;
    }>(`
      SELECT
        (SELECT count(*)::int FROM facts) AS facts_total,
        (SELECT count(*)::int FROM facts WHERE record_json->>'type'='twin_lineage_v1') AS twin_lineage_v1_total,
        (SELECT count(*)::int FROM facts WHERE record_json->>'type'='twin_state_estimate_v1') AS twin_state_estimate_v1_total,
        (SELECT count(*)::int FROM facts WHERE record_json->>'type' IN ('twin_forecast_v1','twin_forecast_result_v1')) AS twin_forecast_v1_total,
        (SELECT count(*)::int FROM twin_runtime_checkpoint_latest_index_v1) AS twin_runtime_checkpoint_latest_index_v1_total,
        (SELECT count(*)::int FROM twin_shadow_online_scheduler_slot_v1) AS twin_shadow_online_scheduler_slot_v1_total
    `)).rows[0];

    async function scopeRowCount(target: Record<string, string>): Promise<number> {
      const values = SCOPE_FIELDS.map((field) => target[field]);
      const row = (await client.query<{ total: number }>(`
        SELECT (
          (SELECT count(*) FROM facts WHERE
            (record_json#>>'{payload,tenant_id}'=$1 OR record_json#>>'{payload,scope,tenant_id}'=$1) AND
            (record_json#>>'{payload,project_id}'=$2 OR record_json#>>'{payload,scope,project_id}'=$2) AND
            (record_json#>>'{payload,group_id}'=$3 OR record_json#>>'{payload,scope,group_id}'=$3) AND
            (record_json#>>'{payload,field_id}'=$4 OR record_json#>>'{payload,scope,field_id}'=$4) AND
            (record_json#>>'{payload,season_id}'=$5 OR record_json#>>'{payload,scope,season_id}'=$5) AND
            (record_json#>>'{payload,zone_id}'=$6 OR record_json#>>'{payload,scope,zone_id}'=$6)) +
          (SELECT count(*) FROM twin_active_lineage_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) +
          (SELECT count(*) FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) +
          (SELECT count(*) FROM twin_forecast_result_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) +
          (SELECT count(*) FROM twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) +
          (SELECT count(*) FROM twin_runtime_lease_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) +
          (SELECT count(*) FROM twin_shadow_online_scheduler_cursor_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) +
          (SELECT count(*) FROM twin_shadow_online_scheduler_slot_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6)
        )::int AS total
      `, values)).rows[0];
      return Number(row?.total ?? -1);
    }

    const observed = {
      ...globalCounts,
      t1r1_scope_row_count: await scopeRowCount(T1R1_SCOPE),
      t3r1_scope_row_count_before_bootstrap: await scopeRowCount(scope),
      cross_scope_canonical_stitching_authorized: false,
    };

    for (const key of [
      "facts_total",
      "twin_lineage_v1_total",
      "twin_state_estimate_v1_total",
      "twin_forecast_v1_total",
      "twin_runtime_checkpoint_latest_index_v1_total",
      "twin_shadow_online_scheduler_slot_v1_total",
      "t1r1_scope_row_count",
      "t3r1_scope_row_count_before_bootstrap",
    ] as const) {
      assert.equal(observed[key], AUTH.fresh_database_requirements[key], `EA5A_FRESH_DATABASE_REQUIREMENT_FAIL:${key}:actual=${observed[key]}:expected=${AUTH.fresh_database_requirements[key]}`);
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
        t1r1_database_reused: false,
        database_now_utc: new Date(identity.database_now_utc).toISOString(),
      },
      required_schema_table_count: REQUIRED_SCHEMA_TABLES.length,
      missing_schema_tables: [],
      fresh_database_counts: observed,
      fresh_formal_database_identity_qualified: true,
      fresh_external_scope_preflight_qualified: true,
      secret_binding_required_next: true,
      fresh_bootstrap_authorized: false,
      ea5e2_operational_activation_authorized: false,
      formal_o00_start_authorized: false,
    };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    result = {
      ...result,
      error: String(error instanceof Error ? error.message : error),
      fresh_formal_database_identity_qualified: false,
      fresh_external_scope_preflight_qualified: false,
      secret_binding_required_next: true,
      fresh_bootstrap_authorized: false,
      ea5e2_operational_activation_authorized: false,
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
