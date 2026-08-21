import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";

const SOURCE_RUNNER = path.resolve("scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_T3R1_FRESH_BOOTSTRAP.ts");
const GENERATED_RUNNER = path.resolve("scripts/runtime_acceptance/.generated_EXECUTE_MCFT_CAP_09_T4R1_FRESH_BOOTSTRAP.ts");
const RESULT = path.resolve("acceptance-output/MCFT_CAP_09_T4R1_FRESH_BOOTSTRAP_RESULT.json");
const SOURCE_RUNNER_BLOB = "f1ff8547a78a982f4a968a62e9e02c802adb74f3";
const T4_AUTH_BLOB = "fa9a9e241a37b79042855cab3b38f99ffe80e158";
const T4_CROP_BLOB = "4bc1f8dda6559c8951db915132172b65469affcb";
const EXPECTED_DATABASE = "geox_mcft_cap09_s6_formal_t4r1_24h";
const EXPECTED_PROJECT = "delicate-glade-62464340";
const EXPECTED_BRANCH = "br-cold-dust-a6j6aymz";

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
  if (!value) throw new Error(`T4R1_FRESH_BOOTSTRAP_ENV_REQUIRED:${name}`);
  return value;
}

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

async function scopeRowCount(pool: Pool, target: Record<string, string>): Promise<number> {
  const values = SCOPE_FIELDS.map((field) => target[field]);
  const row = (await pool.query<{ total: number }>(`
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

function exactReplace(source: string, oldValue: string, newValue: string, expectedMinimum = 1): string {
  const count = source.split(oldValue).length - 1;
  assert(count >= expectedMinimum, `T4R1_FRESH_BOOTSTRAP_ADAPTER_SOURCE_TOKEN_MISSING:${oldValue}:${count}`);
  return source.split(oldValue).join(newValue);
}

function buildSuccessorRunner(): string {
  assert.equal(git("rev-parse", `HEAD:scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_T3R1_FRESH_BOOTSTRAP.ts`), SOURCE_RUNNER_BLOB, "T4R1_FRESH_BOOTSTRAP_SOURCE_RUNNER_BLOB_DRIFT");
  let source = fs.readFileSync(SOURCE_RUNNER, "utf8");
  source = exactReplace(source, "T3R1", "T4R1", 10);
  source = exactReplace(source, "t3r1", "t4r1", 6);
  source = exactReplace(source, "d97129915ae5f7720b3a3d8e5561a2842213da65", T4_AUTH_BLOB);
  source = exactReplace(source, "GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json", "GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json");
  source = exactReplace(source, "757e4b9f4fdcd631eea97fca85614a1b61ef0c4a", T4_CROP_BLOB);
  assert(!source.includes("GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL"), "T4R1_FRESH_BOOTSTRAP_OLD_SECRET_SURVIVED_ADAPTATION");
  assert(!source.includes("geox_mcft_cap09_s6_formal_t3r1_24h"), "T4R1_FRESH_BOOTSTRAP_OLD_DATABASE_SURVIVED_ADAPTATION");
  assert(source.includes("GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL"), "T4R1_FRESH_BOOTSTRAP_T4_SECRET_REQUIRED");
  assert(source.includes(EXPECTED_DATABASE), "T4R1_FRESH_BOOTSTRAP_T4_DATABASE_REQUIRED");
  assert(source.includes("GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json"), "T4R1_FRESH_BOOTSTRAP_CROP_V3_REQUIRED");
  return source;
}

function proveGeneratedRunnerCompiles(): void {
  const generated = buildSuccessorRunner();
  fs.writeFileSync(GENERATED_RUNNER, generated);
  try {
    execFileSync("pnpm", [
      "exec", "tsc", "--noEmit", "--pretty", "false", "--skipLibCheck",
      "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext",
      "--esModuleInterop", "--types", "node", GENERATED_RUNNER,
    ], { stdio: "inherit", env: process.env });
    console.log(JSON.stringify({ status: "PASS", static_adapter_proof: true, generated_runner_compiles: true, database_access: false, provider_access: false }));
  } finally {
    try { fs.unlinkSync(GENERATED_RUNNER); } catch {}
  }
}

async function assertDatabaseIdentityAndT3Zero(pool: Pool, phase: string): Promise<void> {
  const identity = (await pool.query<{
    database_name: string;
    neon_project_id: string | null;
    neon_branch_id: string | null;
  }>(`SELECT current_database() AS database_name,
            current_setting('neon.project_id', true) AS neon_project_id,
            current_setting('neon.branch_id', true) AS neon_branch_id`)).rows[0];
  assert(identity, `T4R1_FRESH_BOOTSTRAP_DATABASE_IDENTITY_REQUIRED:${phase}`);
  assert.equal(identity.database_name, EXPECTED_DATABASE, `T4R1_FRESH_BOOTSTRAP_DATABASE_DRIFT:${phase}`);
  assert.equal(identity.neon_project_id, EXPECTED_PROJECT, `T4R1_FRESH_BOOTSTRAP_PROJECT_DRIFT:${phase}`);
  assert.equal(identity.neon_branch_id, EXPECTED_BRANCH, `T4R1_FRESH_BOOTSTRAP_BRANCH_DRIFT:${phase}`);
  const t3Rows = await scopeRowCount(pool, T3_SCOPE);
  assert.equal(t3Rows, 0, `T4R1_FRESH_BOOTSTRAP_T3_SCOPE_REUSE_FORBIDDEN:${phase}:${t3Rows}`);
}

async function main(): Promise<void> {
  if (process.env.MCFT_CAP09_T4R1_BOOTSTRAP_STATIC_ADAPTER_PROOF === "true") {
    proveGeneratedRunnerCompiles();
    return;
  }

  const subjectSha = requiredEnv("GITHUB_SHA");
  assert.match(subjectSha, /^[0-9a-f]{40}$/, "T4R1_FRESH_BOOTSTRAP_EXACT_SHA_REQUIRED");
  assert.equal(process.env.GITHUB_REF, "refs/heads/main", "T4R1_FRESH_BOOTSTRAP_PROTECTED_MAIN_ONLY");
  assert.equal(git("rev-parse", "HEAD"), subjectSha, "T4R1_FRESH_BOOTSTRAP_HEAD_SHA_MISMATCH");
  assert.equal(git("rev-parse", "origin/main"), subjectSha, "T4R1_FRESH_BOOTSTRAP_PROTECTED_MAIN_DRIFT");
  const databaseUrl = requiredEnv("GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL");
  const pool = new Pool({ connectionString: databaseUrl, application_name: `mcft-cap09-t4r1-successor-guard-${subjectSha.slice(0, 12)}`, max: 1 });
  try {
    await assertDatabaseIdentityAndT3Zero(pool, "BEFORE");
    const generated = buildSuccessorRunner();
    fs.writeFileSync(GENERATED_RUNNER, generated);
    execFileSync("pnpm", ["exec", "tsx", GENERATED_RUNNER], { stdio: "inherit", env: process.env });
    await assertDatabaseIdentityAndT3Zero(pool, "AFTER");
    const result = JSON.parse(fs.readFileSync(RESULT, "utf8")) as Record<string, unknown>;
    assert.equal(result.status, "PASS", "T4R1_FRESH_BOOTSTRAP_SUCCESSOR_RESULT_PASS_REQUIRED");
    assert.equal(result.fresh_t4r1_bootstrap_complete, true, "T4R1_FRESH_BOOTSTRAP_SUCCESSOR_COMPLETION_REQUIRED");
    result.t3r1_scope_row_count = 0;
    result.successor_adapter_source_runner_blob = SOURCE_RUNNER_BLOB;
    result.successor_adapter_t4_authority_blob = T4_AUTH_BLOB;
    result.successor_adapter_crop_authority_blob = T4_CROP_BLOB;
    result.successor_adapter_generated_file_committed = false;
    fs.writeFileSync(RESULT, `${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await pool.end();
    try { fs.unlinkSync(GENERATED_RUNNER); } catch {}
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
