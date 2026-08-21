import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Pool, type PoolClient } from "pg";

import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_T4R1_FRESH_BOOTSTRAP_EXISTING_STATE_REVERIFY_RESULT.json");
const EXPECTED_DATABASE = "geox_mcft_cap09_s6_formal_t4r1_24h";
const EXPECTED_PROJECT = "delicate-glade-62464340";
const EXPECTED_BRANCH = "br-cold-dust-a6j6aymz";
const EXPECTED_BOOTSTRAP_LOGICAL_TIME = "2026-08-21T14:00:00.000Z";
const EXPECTED_O00_LOGICAL_TIME = "2026-08-21T15:00:00.000Z";
const EXPECTED_A0_REF = "external_formal_runtime_config_3b2eec25d4ef44cb04867e06";
const EXPECTED_A0_HASH = "sha256:7414c2341537a9120946501e3f0e46d9570d978b893bb8934449abe3030af851";
const EXPECTED_O00_REF = "external_formal_runtime_config_764052dc6dabdb7ff02f6c4d";
const EXPECTED_O00_HASH = "sha256:ce965a2b2a03a5eedd0ad2790760865a0afb9ada512e447357c429f5c1967335";
const HOUR_MS = 3_600_000;

const T1_SCOPE = Object.freeze({
  tenant_id: "tenant_mcft_external",
  project_id: "project_mcft_cap09",
  group_id: "group_public_research",
  field_id: "field_kbs_mcse_t1r1",
  season_id: "season_2026_corn",
  zone_id: "zone_kbs_mcse_t1r1_formal_v1",
});

const T3_SCOPE = Object.freeze({
  tenant_id: "tenant_mcft_external",
  project_id: "project_mcft_cap09",
  group_id: "group_public_research",
  field_id: "field_kbs_mcse_t3r1",
  season_id: "season_2026_corn",
  zone_id: "zone_kbs_mcse_t3r1_crop_formal_v1",
});

const SCOPE_FIELDS = ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`T4R1_BOOTSTRAP_REVERIFY_ENV_REQUIRED:${name}`);
  return value;
}

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function exactIso(value: string, code: string): string {
  const parsed = Date.parse(value);
  assert(Number.isFinite(parsed) && new Date(parsed).toISOString() === value, code);
  return value;
}

async function scopeRowCount(client: PoolClient, target: Record<string, string>): Promise<number> {
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
    )::int AS total`, values)).rows[0];
  return Number(row?.total ?? -1);
}

async function main(): Promise<void> {
  const subjectSha = requiredEnv("GITHUB_SHA");
  assert.match(subjectSha, /^[0-9a-f]{40}$/, "T4R1_BOOTSTRAP_REVERIFY_EXACT_SHA_REQUIRED");
  assert.equal(process.env.GITHUB_REF, "refs/heads/main", "T4R1_BOOTSTRAP_REVERIFY_PROTECTED_MAIN_ONLY");
  assert.equal(git("rev-parse", "HEAD"), subjectSha, "T4R1_BOOTSTRAP_REVERIFY_HEAD_SHA_MISMATCH");
  assert.equal(git("rev-parse", "origin/main"), subjectSha, "T4R1_BOOTSTRAP_REVERIFY_PROTECTED_MAIN_DRIFT");

  const pool = new Pool({
    connectionString: requiredEnv("GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL"),
    application_name: `mcft-cap09-t4r1-bootstrap-existing-state-reverify-${subjectSha.slice(0, 12)}`,
    max: 1,
  });
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query("BEGIN READ ONLY");
    transactionStarted = true;
    const readOnly = (await client.query<{ transaction_read_only: string }>("SHOW transaction_read_only")).rows[0]?.transaction_read_only;
    assert.equal(readOnly, "on", "T4R1_BOOTSTRAP_REVERIFY_READ_ONLY_TRANSACTION_REQUIRED");

    const identity = (await client.query<{
      database_name: string;
      neon_project_id: string | null;
      neon_branch_id: string | null;
    }>(`SELECT current_database() AS database_name,
              current_setting('neon.project_id', true) AS neon_project_id,
              current_setting('neon.branch_id', true) AS neon_branch_id`)).rows[0];
    assert(identity, "T4R1_BOOTSTRAP_REVERIFY_DATABASE_IDENTITY_REQUIRED");
    assert.equal(identity.database_name, EXPECTED_DATABASE, "T4R1_BOOTSTRAP_REVERIFY_DATABASE_DRIFT");
    assert.equal(identity.neon_project_id, EXPECTED_PROJECT, "T4R1_BOOTSTRAP_REVERIFY_PROJECT_DRIFT");
    assert.equal(identity.neon_branch_id, EXPECTED_BRANCH, "T4R1_BOOTSTRAP_REVERIFY_BRANCH_DRIFT");

    const scope = Object.values(MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1);
    const counts = (await client.query(`
      SELECT
        (SELECT count(*)::int FROM facts) AS total_facts,
        (SELECT count(*)::int FROM facts WHERE record_json->>'type' LIKE 'twin_%') AS twin_facts,
        (SELECT count(*)::int FROM facts WHERE record_json->>'type'='twin_runtime_config_v1') AS runtime_configs,
        (SELECT count(*)::int FROM facts WHERE record_json->>'type' LIKE 'twin_%' AND record_json->>'type'<>'twin_runtime_config_v1') AS a0_members,
        (SELECT count(*)::int FROM facts WHERE record_json->>'type' NOT LIKE 'twin_%') AS non_twin_facts,
        (SELECT count(*)::int FROM facts
          WHERE record_json->'payload'->>'tenant_id'=$1 AND record_json->'payload'->>'project_id'=$2
            AND record_json->'payload'->>'group_id'=$3 AND record_json->'payload'->>'field_id'=$4
            AND record_json->'payload'->>'season_id'=$5 AND record_json->'payload'->>'zone_id'=$6) AS t4_scope_facts,
        (SELECT count(*)::int FROM twin_shadow_online_scheduler_slot_v1) AS scheduler_slots,
        (SELECT count(*)::int FROM twin_shadow_online_scheduler_cursor_v1) AS scheduler_cursors
    `, scope)).rows[0];
    assert.equal(Number(counts.total_facts), 35, "T4R1_BOOTSTRAP_REVERIFY_EXACT_35_FACTS_REQUIRED");
    assert.equal(Number(counts.twin_facts), 34, "T4R1_BOOTSTRAP_REVERIFY_EXACT_34_TWIN_FACTS_REQUIRED");
    assert.equal(Number(counts.runtime_configs), 25, "T4R1_BOOTSTRAP_REVERIFY_EXACT_25_CONFIGS_REQUIRED");
    assert.equal(Number(counts.a0_members), 9, "T4R1_BOOTSTRAP_REVERIFY_EXACT_9_A0_MEMBERS_REQUIRED");
    assert.equal(Number(counts.non_twin_facts), 1, "T4R1_BOOTSTRAP_REVERIFY_EXACT_ONE_EXTERNAL_FACT_REQUIRED");
    assert.equal(Number(counts.t4_scope_facts), 35, "T4R1_BOOTSTRAP_REVERIFY_ALL_FACTS_MUST_BE_T4_SCOPE");
    assert.equal(Number(counts.scheduler_slots), 0, "T4R1_BOOTSTRAP_REVERIFY_SCHEDULER_SLOT_MUST_REMAIN_ZERO");
    assert.equal(Number(counts.scheduler_cursors), 0, "T4R1_BOOTSTRAP_REVERIFY_SCHEDULER_CURSOR_MUST_REMAIN_ZERO");
    assert.equal(await scopeRowCount(client, T1_SCOPE), 0, "T4R1_BOOTSTRAP_REVERIFY_T1_REUSE_FORBIDDEN");
    assert.equal(await scopeRowCount(client, T3_SCOPE), 0, "T4R1_BOOTSTRAP_REVERIFY_T3_REUSE_FORBIDDEN");

    const configs = (await client.query(`
      SELECT record_json->'payload' AS object
        FROM public.facts
       WHERE record_json->>'type'='twin_runtime_config_v1'
         AND record_json->'payload'->>'tenant_id'=$1 AND record_json->'payload'->>'project_id'=$2
         AND record_json->'payload'->>'group_id'=$3 AND record_json->'payload'->>'field_id'=$4
         AND record_json->'payload'->>'season_id'=$5 AND record_json->'payload'->>'zone_id'=$6
       ORDER BY (record_json->'payload'->>'logical_time')::timestamptz ASC
    `, scope)).rows.map((row) => row.object as Record<string, any>);
    assert.equal(configs.length, 25, "T4R1_BOOTSTRAP_REVERIFY_CONFIG_CHAIN_LENGTH_REQUIRED");
    let parent: Record<string, any> | null = null;
    for (let index = 0; index < configs.length; index += 1) {
      const object = configs[index]!;
      const payload = object.payload as Record<string, any>;
      const logicalTime = exactIso(String(object.logical_time), `T4R1_BOOTSTRAP_REVERIFY_CONFIG_TIME_INVALID:${index}`);
      assert.equal(logicalTime, new Date(Date.parse(EXPECTED_BOOTSTRAP_LOGICAL_TIME) + index * HOUR_MS).toISOString(), `T4R1_BOOTSTRAP_REVERIFY_CONFIG_TIME_CHAIN:${index}`);
      assert.equal(payload.config_selection_mode, "EXPLICIT_REF_HASH_PIN_ONLY", `T4R1_BOOTSTRAP_REVERIFY_EXPLICIT_PIN_REQUIRED:${index}`);
      assert.equal(payload.runtime_mode, "SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY", `T4R1_BOOTSTRAP_REVERIFY_RUNTIME_MODE_REQUIRED:${index}`);
      for (const [key, expected] of Object.entries(MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1)) {
        assert.equal(object[key], expected, `T4R1_BOOTSTRAP_REVERIFY_SCOPE_DRIFT:${index}:${key}`);
      }
      if (index === 0) {
        assert.equal(payload.config_role, "A0_BOOTSTRAP", "T4R1_BOOTSTRAP_REVERIFY_A0_ROLE_REQUIRED");
        assert.equal(payload.parent_runtime_config_ref, null, "T4R1_BOOTSTRAP_REVERIFY_A0_PARENT_REF_NULL_REQUIRED");
        assert.equal(payload.parent_runtime_config_hash, null, "T4R1_BOOTSTRAP_REVERIFY_A0_PARENT_HASH_NULL_REQUIRED");
        assert.equal(object.object_id, EXPECTED_A0_REF, "T4R1_BOOTSTRAP_REVERIFY_A0_REF_DRIFT");
        assert.equal(object.determinism_hash, EXPECTED_A0_HASH, "T4R1_BOOTSTRAP_REVERIFY_A0_HASH_DRIFT");
      } else {
        assert.equal(payload.config_role, "HOURLY_CAP04", `T4R1_BOOTSTRAP_REVERIFY_HOURLY_ROLE:${index}`);
        assert.equal(payload.parent_runtime_config_ref, parent?.object_id, `T4R1_BOOTSTRAP_REVERIFY_PARENT_REF:${index}`);
        assert.equal(payload.parent_runtime_config_hash, parent?.determinism_hash, `T4R1_BOOTSTRAP_REVERIFY_PARENT_HASH:${index}`);
      }
      parent = object;
    }
    assert.equal(configs[1]?.logical_time, EXPECTED_O00_LOGICAL_TIME, "T4R1_BOOTSTRAP_REVERIFY_O00_TIME_DRIFT");
    assert.equal(configs[1]?.object_id, EXPECTED_O00_REF, "T4R1_BOOTSTRAP_REVERIFY_O00_REF_DRIFT");
    assert.equal(configs[1]?.determinism_hash, EXPECTED_O00_HASH, "T4R1_BOOTSTRAP_REVERIFY_O00_HASH_DRIFT");

    const evidence = (await client.query(`
      SELECT source,
             record_json->>'type' AS record_type,
             record_json->'payload'->'role_time'->>'observed_at' AS observed_at,
             record_json->'payload'->>'available_to_runtime_at' AS available_at
        FROM public.facts
       WHERE record_json->>'type' NOT LIKE 'twin_%'
    `)).rows;
    assert.equal(evidence.length, 1, "T4R1_BOOTSTRAP_REVERIFY_EXACT_ONE_EXTERNAL_EVIDENCE_REQUIRED");
    assert.equal(evidence[0]?.source, "mcft_cap09_external_formal_evidence_v1", "T4R1_BOOTSTRAP_REVERIFY_EXTERNAL_SOURCE_DRIFT");
    assert.equal(evidence[0]?.record_type, "soil_moisture_observation_v1", "T4R1_BOOTSTRAP_REVERIFY_SOIL_EVIDENCE_REQUIRED");
    const observedAt = exactIso(String(evidence[0]?.observed_at), "T4R1_BOOTSTRAP_REVERIFY_SOIL_OBSERVED_AT_INVALID");
    const availableAt = exactIso(String(evidence[0]?.available_at), "T4R1_BOOTSTRAP_REVERIFY_SOIL_AVAILABLE_AT_INVALID");
    assert(Date.parse(observedAt) > Date.parse(EXPECTED_BOOTSTRAP_LOGICAL_TIME) - HOUR_MS, "T4R1_BOOTSTRAP_REVERIFY_SOIL_TOO_OLD");
    assert(Date.parse(observedAt) <= Date.parse(EXPECTED_BOOTSTRAP_LOGICAL_TIME), "T4R1_BOOTSTRAP_REVERIFY_SOIL_AFTER_A0");
    assert(Date.parse(availableAt) <= Date.parse(EXPECTED_BOOTSTRAP_LOGICAL_TIME), "T4R1_BOOTSTRAP_REVERIFY_SOIL_AVAILABLE_AFTER_A0");

    await client.query("COMMIT");
    transactionStarted = false;
    const result = {
      schema_version: "geox_mcft_cap09_t4r1_fresh_bootstrap_existing_state_reverify_v1",
      status: "PASS",
      subject_sha: subjectSha,
      transaction_mode: "READ_ONLY",
      database_write_count: 0,
      provider_request_count: 0,
      formal_window_started: false,
      scheduler_started: false,
      existing_t4r1_bootstrap_reverified: true,
      database_identity: identity,
      final_fact_count: 35,
      final_canonical_twin_fact_count: 34,
      exact_runtime_config_count: 25,
      exact_hourly_runtime_config_count: 24,
      external_a0_member_count: 9,
      a0_runtime_config_ref: EXPECTED_A0_REF,
      a0_runtime_config_hash: EXPECTED_A0_HASH,
      o00_candidate_runtime_config_ref: EXPECTED_O00_REF,
      o00_candidate_runtime_config_hash: EXPECTED_O00_HASH,
      bootstrap_logical_time: EXPECTED_BOOTSTRAP_LOGICAL_TIME,
      o00_candidate_logical_time: EXPECTED_O00_LOGICAL_TIME,
      t1r1_scope_row_count: 0,
      t3r1_scope_row_count: 0,
      raw_values_emitted: false,
      fresh_bootstrap_rerun_performed: false,
      ea5e2_operational_activation_authorized: false,
      formal_o00_start_authorized: false,
      mcft_cap09_completed: false,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (transactionStarted) {
      try { await client.query("ROLLBACK"); } catch {}
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
