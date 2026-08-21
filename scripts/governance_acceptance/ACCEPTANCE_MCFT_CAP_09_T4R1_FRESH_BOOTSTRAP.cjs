#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = process.cwd();
const BASE = String(process.env.MCFT_BASE_SHA || "").trim();
const EXPECTED_BASE = "cec35325afef39dbd39ad8e39e54e7b5c3ea6a2b";
const AUTH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-FRESH-BOOTSTRAP-EXECUTION-AUTHORITY-V1.json";
const RUNNER = "scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_T4R1_FRESH_BOOTSTRAP.ts";
const REVERIFY = "scripts/runtime_acceptance/REVERIFY_MCFT_CAP_09_T4R1_FRESH_BOOTSTRAP_EXISTING_STATE.ts";
const GATE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T4R1_FRESH_BOOTSTRAP.cjs";
const WORKFLOW = ".github/workflows/mcft-cap-09-t4r1-fresh-bootstrap.yml";
const REVERIFY_WORKFLOW = ".github/workflows/mcft-cap-09-t4r1-bootstrap-reverify.yml";
const FRESH_DB = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5A-FRESH-FORMAL-DATABASE-PREFLIGHT-V3.json";
const CROP = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json";
const SOURCE_RUNNER = "scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_T3R1_FRESH_BOOTSTRAP.ts";
const AUTH_BLOB = "fa9a9e241a37b79042855cab3b38f99ffe80e158";
const FRESH_DB_BLOB = "fae82fdac5befddbed94ce47fedda517d75741eb";
const CROP_BLOB = "4bc1f8dda6559c8951db915132172b65469affcb";
const SOURCE_RUNNER_BLOB = "f1ff8547a78a982f4a968a62e9e02c802adb74f3";
const EXPECTED_A0_REF = "external_formal_runtime_config_3b2eec25d4ef44cb04867e06";
const EXPECTED_A0_HASH = "sha256:7414c2341537a9120946501e3f0e46d9570d978b893bb8934449abe3030af851";
const EXPECTED = [RUNNER, REVERIFY, GATE, REVERIFY_WORKFLOW].sort();
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_T4R1_FRESH_BOOTSTRAP_GOVERNANCE_RESULT.json");
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const json = (file) => JSON.parse(read(file));
const blob = (ref, file) => git("rev-parse", `${ref}:${file}`);
const req = (condition, code) => { if (!condition) throw new Error(code); };
const has = (text, marker) => text.includes(marker);

const result = {
  schema_version: "geox_mcft_cap09_t4r1_bootstrap_postsuccess_lifecycle_governance_v1",
  status: "FAIL",
  base_sha: BASE,
  exact_file_count: 0,
  live_write_on_pull_request_authorized: false,
  live_write_on_merge_group_authorized: false,
  fresh_bootstrap_rerun_authorized: false,
  existing_state_reverify_authorized: true,
  existing_state_reverify_database_write_authorized: false,
  existing_state_reverify_provider_request_authorized: false,
  t1r1_state_reuse_authorized: false,
  t3r1_state_reuse_authorized: false,
  scheduler_start_authorized: false,
  formal_o00_start_authorized: false,
};

try {
  req(BASE === EXPECTED_BASE, `T4R1_BOOTSTRAP_POSTSUCCESS_BASE_MAIN_DRIFT:${BASE}`);
  const changed = git("diff", "--name-only", `${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  result.changed_files = changed;
  result.exact_file_count = changed.length;
  req(JSON.stringify(changed) === JSON.stringify(EXPECTED), `T4R1_BOOTSTRAP_POSTSUCCESS_EXACT_FOUR_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);
  req(blob("HEAD", AUTH) === AUTH_BLOB, "T4R1_BOOTSTRAP_POSTSUCCESS_AUTHORITY_BLOB_DRIFT");
  req(blob("HEAD", FRESH_DB) === FRESH_DB_BLOB, "T4R1_BOOTSTRAP_POSTSUCCESS_FRESH_DB_AUTHORITY_BLOB_DRIFT");
  req(blob("HEAD", CROP) === CROP_BLOB, "T4R1_BOOTSTRAP_POSTSUCCESS_CROP_AUTHORITY_BLOB_DRIFT");
  req(blob("HEAD", SOURCE_RUNNER) === SOURCE_RUNNER_BLOB, "T4R1_BOOTSTRAP_POSTSUCCESS_SOURCE_RUNNER_BLOB_DRIFT");

  const authority = json(AUTH);
  const runner = read(RUNNER);
  const reverify = read(REVERIFY);
  const workflow = read(WORKFLOW);
  const reverifyWorkflow = read(REVERIFY_WORKFLOW);

  req(authority.record_status === "T4R1_FRESH_BOOTSTRAP_EXECUTION_AUTHORITY_NOT_FORMAL_ACTIVATION", "T4R1_BOOTSTRAP_POSTSUCCESS_AUTHORITY_STATUS_DRIFT");
  req(authority.preconditions?.fresh_database_authority_blob_sha === FRESH_DB_BLOB, "T4R1_BOOTSTRAP_POSTSUCCESS_FRESH_DB_PIN_DRIFT");
  req(authority.preconditions?.database_name === "geox_mcft_cap09_s6_formal_t4r1_24h", "T4R1_BOOTSTRAP_POSTSUCCESS_DATABASE_DRIFT");
  req(authority.preconditions?.required_database_secret === "GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL", "T4R1_BOOTSTRAP_POSTSUCCESS_SECRET_DRIFT");
  req(authority.preconditions?.t1r1_canonical_state_reuse_authorized === false && authority.preconditions?.t3r1_canonical_state_reuse_authorized === false && authority.preconditions?.cross_scope_canonical_stitching_authorized === false, "T4R1_BOOTSTRAP_POSTSUCCESS_REUSE_GUARD_DRIFT");
  req(authority.scope?.field_id === "field_kbs_mcse_t4r1" && authority.scope?.zone_id === "zone_kbs_mcse_t4r1_crop_formal_v1", "T4R1_BOOTSTRAP_POSTSUCCESS_SCOPE_DRIFT");
  req(authority.crop_stage_authority?.blob_sha === CROP_BLOB && authority.crop_stage_authority?.expected_stage_for_current_execution_window === "MID", "T4R1_BOOTSTRAP_POSTSUCCESS_CROP_PIN_DRIFT");
  req(authority.bootstrap_persistence_contract?.expected_canonical_twin_fact_count === 34 && authority.bootstrap_persistence_contract?.expected_runtime_config_count === 25 && authority.bootstrap_persistence_contract?.expected_a0_member_count === 9, "T4R1_BOOTSTRAP_POSTSUCCESS_COUNT_DRIFT");
  req(authority.authorized_effect?.fresh_t4r1_bootstrap_authorized === true && authority.authorized_effect?.ea5e2_operational_activation_authorized === false && authority.authorized_effect?.formal_o00_start_authorized === false, "T4R1_BOOTSTRAP_POSTSUCCESS_AUTHORIZED_EFFECT_DRIFT");

  for (const marker of [SOURCE_RUNNER_BLOB, AUTH_BLOB, CROP_BLOB, "GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL", "geox_mcft_cap09_s6_formal_t4r1_24h", "T3_SCOPE", "T4R1_FRESH_BOOTSTRAP_T3_SCOPE_REUSE_FORBIDDEN", "withShortLivedGuardPool", "successor_adapter_source_runner_blob", "generated_file_committed = false"]) {
    req(has(runner, marker), `T4R1_BOOTSTRAP_POSTSUCCESS_RUNNER_MARKER_MISSING:${marker}`);
  }
  const mainStart = runner.indexOf("async function main(): Promise<void>");
  req(mainStart >= 0, "T4R1_BOOTSTRAP_POSTSUCCESS_MAIN_REQUIRED");
  const mainBody = runner.slice(mainStart);
  req(!has(mainBody, "const pool = new Pool"), "T4R1_BOOTSTRAP_POSTSUCCESS_LONG_LIVED_GUARD_POOL_FORBIDDEN");
  req(mainBody.indexOf('await withShortLivedGuardPool(databaseUrl, "BEFORE")') < mainBody.indexOf('execFileSync("pnpm", ["exec", "tsx", GENERATED_RUNNER]'), "T4R1_BOOTSTRAP_POSTSUCCESS_BEFORE_GUARD_ORDER_REQUIRED");
  req(mainBody.indexOf('execFileSync("pnpm", ["exec", "tsx", GENERATED_RUNNER]') < mainBody.indexOf('await withShortLivedGuardPool(databaseUrl, "AFTER")'), "T4R1_BOOTSTRAP_POSTSUCCESS_AFTER_GUARD_ORDER_REQUIRED");
  req(!has(runner, "process.env.GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL"), "T4R1_BOOTSTRAP_POSTSUCCESS_DIRECT_T3_SECRET_ACCESS_FORBIDDEN");

  for (const marker of ["BEGIN READ ONLY", "SHOW transaction_read_only", "database_write_count: 0", "provider_request_count: 0", "fresh_bootstrap_rerun_performed: false", EXPECTED_A0_REF, EXPECTED_A0_HASH, "T1_SCOPE", "T3_SCOPE", "scheduler_started: false", "formal_o00_start_authorized: false", "mcft_cap09_completed: false"]) {
    req(has(reverify, marker), `T4R1_BOOTSTRAP_POSTSUCCESS_REVERIFY_MARKER_MISSING:${marker}`);
  }
  req(!has(reverify, "executeFormalLiveKbsSoilIngressV1"), "T4R1_BOOTSTRAP_POSTSUCCESS_REVERIFY_PROVIDER_CALL_FORBIDDEN");
  req(!has(reverify, "INSERT INTO") && !has(reverify, "UPDATE ") && !has(reverify, "DELETE FROM"), "T4R1_BOOTSTRAP_POSTSUCCESS_REVERIFY_SQL_MUTATION_FORBIDDEN");

  req(has(workflow, "pull_request:") && has(workflow, "merge_group:") && has(workflow, "workflow_dispatch:"), "T4R1_BOOTSTRAP_POSTSUCCESS_ORIGINAL_WORKFLOW_TRIGGERS_REQUIRED");
  req(has(workflow, "EXECUTE_T4R1_FRESH_BOOTSTRAP"), "T4R1_BOOTSTRAP_POSTSUCCESS_ORIGINAL_TOKEN_REQUIRED");
  req(!/\n\s{2}push:\s*$/m.test(workflow), "T4R1_BOOTSTRAP_POSTSUCCESS_ORIGINAL_AUTO_PUSH_TRIGGER_FORBIDDEN");

  req(has(reverifyWorkflow, "pull_request:") && has(reverifyWorkflow, "merge_group:") && has(reverifyWorkflow, "workflow_dispatch:"), "T4R1_BOOTSTRAP_POSTSUCCESS_REVERIFY_WORKFLOW_TRIGGERS_REQUIRED");
  req(has(reverifyWorkflow, "protected-main-read-only-reverify:"), "T4R1_BOOTSTRAP_POSTSUCCESS_REVERIFY_LIVE_JOB_REQUIRED");
  req(has(reverifyWorkflow, "GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL: ${{ secrets.GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL }}"), "T4R1_BOOTSTRAP_POSTSUCCESS_REVERIFY_SECRET_REQUIRED");
  req(has(reverifyWorkflow, "REVERIFY_MCFT_CAP_09_T4R1_FRESH_BOOTSTRAP_EXISTING_STATE.ts"), "T4R1_BOOTSTRAP_POSTSUCCESS_REVERIFY_COMMAND_REQUIRED");
  req(has(reverifyWorkflow, "transaction_mode!=='READ_ONLY'"), "T4R1_BOOTSTRAP_POSTSUCCESS_REVERIFY_READ_ONLY_RESULT_GATE_REQUIRED");
  req(has(reverifyWorkflow, "database_write_count!==0") && has(reverifyWorkflow, "provider_request_count!==0") && has(reverifyWorkflow, "fresh_bootstrap_rerun_performed!==false"), "T4R1_BOOTSTRAP_POSTSUCCESS_REVERIFY_ZERO_SIDE_EFFECT_GATE_REQUIRED");
  req(!has(reverifyWorkflow, "EXECUTE_T4R1_FRESH_BOOTSTRAP"), "T4R1_BOOTSTRAP_POSTSUCCESS_REVERIFY_MUST_NOT_AUTHORIZE_BOOTSTRAP_TOKEN");
  req(!has(reverifyWorkflow, "GEOX_MCFT_CAP09_FORMAL_RAW_S3_"), "T4R1_BOOTSTRAP_POSTSUCCESS_REVERIFY_RAW_PROVIDER_BINDINGS_FORBIDDEN");
  req(!/\n\s{2}push:\s*$/m.test(reverifyWorkflow), "T4R1_BOOTSTRAP_POSTSUCCESS_REVERIFY_AUTO_PUSH_TRIGGER_FORBIDDEN");

  result.status = "PASS";
} catch (error) {
  result.error_code = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
}
