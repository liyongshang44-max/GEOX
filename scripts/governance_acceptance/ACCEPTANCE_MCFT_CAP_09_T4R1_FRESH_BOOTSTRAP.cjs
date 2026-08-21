#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = process.cwd();
const BASE = String(process.env.MCFT_BASE_SHA || "").trim();
const ADOPTION_BASE = "8213ec945c2d25c6441fcf708f88991a157eb76a";
const LIFECYCLE_HOTFIX_BASE = "cec35325afef39dbd39ad8e39e54e7b5c3ea6a2b";
const AUTH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-FRESH-BOOTSTRAP-EXECUTION-AUTHORITY-V1.json";
const RUNNER = "scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_T4R1_FRESH_BOOTSTRAP.ts";
const GATE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T4R1_FRESH_BOOTSTRAP.cjs";
const WORKFLOW = ".github/workflows/mcft-cap-09-t4r1-fresh-bootstrap.yml";
const FRESH_DB = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5A-FRESH-FORMAL-DATABASE-PREFLIGHT-V3.json";
const CROP = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json";
const SOURCE_RUNNER = "scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_T3R1_FRESH_BOOTSTRAP.ts";
const AUTH_BLOB = "fa9a9e241a37b79042855cab3b38f99ffe80e158";
const FRESH_DB_BLOB = "fae82fdac5befddbed94ce47fedda517d75741eb";
const CROP_BLOB = "4bc1f8dda6559c8951db915132172b65469affcb";
const SOURCE_RUNNER_BLOB = "f1ff8547a78a982f4a968a62e9e02c802adb74f3";
const ADOPTION_EXPECTED = [AUTH, RUNNER, GATE, WORKFLOW].sort();
const LIFECYCLE_HOTFIX_EXPECTED = [RUNNER, GATE].sort();
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_T4R1_FRESH_BOOTSTRAP_GOVERNANCE_RESULT.json");
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const json = (file) => JSON.parse(read(file));
const blob = (ref, file) => git("rev-parse", `${ref}:${file}`);
const req = (condition, code) => { if (!condition) throw new Error(code); };
const has = (text, marker) => text.includes(marker);

const result = {
  schema_version: "geox_mcft_cap09_t4r1_fresh_bootstrap_governance_v1",
  status: "FAIL",
  base_sha: BASE,
  exact_file_count: 0,
  live_write_on_pull_request_authorized: false,
  live_write_on_merge_group_authorized: false,
  workflow_dispatch_live_write_authorized: true,
  t1r1_state_reuse_authorized: false,
  t3r1_state_reuse_authorized: false,
  scheduler_start_authorized: false,
  formal_o00_start_authorized: false,
};

try {
  const adoptionRoute = BASE === ADOPTION_BASE;
  const lifecycleHotfixRoute = BASE === LIFECYCLE_HOTFIX_BASE;
  req(adoptionRoute || lifecycleHotfixRoute, `T4R1_FRESH_BOOTSTRAP_BASE_MAIN_DRIFT:${BASE}`);
  const changed = git("diff", "--name-only", `${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  result.changed_files = changed;
  result.exact_file_count = changed.length;
  result.governance_route = adoptionRoute ? "INITIAL_FOUR_FILE_ADOPTION" : "POST_BOOTSTRAP_GUARD_POOL_LIFECYCLE_HOTFIX";
  const expected = adoptionRoute ? ADOPTION_EXPECTED : LIFECYCLE_HOTFIX_EXPECTED;
  req(JSON.stringify(changed) === JSON.stringify(expected), `T4R1_FRESH_BOOTSTRAP_EXACT_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);
  req(blob("HEAD", AUTH) === AUTH_BLOB, "T4R1_FRESH_BOOTSTRAP_AUTHORITY_BLOB_DRIFT");
  req(blob("HEAD", FRESH_DB) === FRESH_DB_BLOB, "T4R1_FRESH_BOOTSTRAP_FRESH_DB_AUTHORITY_BLOB_DRIFT");
  req(blob("HEAD", CROP) === CROP_BLOB, "T4R1_FRESH_BOOTSTRAP_CROP_AUTHORITY_BLOB_DRIFT");
  req(blob("HEAD", SOURCE_RUNNER) === SOURCE_RUNNER_BLOB, "T4R1_FRESH_BOOTSTRAP_SOURCE_RUNNER_BLOB_DRIFT");

  const authority = json(AUTH);
  const runner = read(RUNNER);
  const workflow = read(WORKFLOW);
  req(authority.record_status === "T4R1_FRESH_BOOTSTRAP_EXECUTION_AUTHORITY_NOT_FORMAL_ACTIVATION", "T4R1_FRESH_BOOTSTRAP_AUTHORITY_STATUS_DRIFT");
  req(authority.preconditions?.fresh_database_authority_blob_sha === FRESH_DB_BLOB, "T4R1_FRESH_BOOTSTRAP_FRESH_DB_PIN_DRIFT");
  req(authority.preconditions?.database_name === "geox_mcft_cap09_s6_formal_t4r1_24h", "T4R1_FRESH_BOOTSTRAP_DATABASE_DRIFT");
  req(authority.preconditions?.required_database_secret === "GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL", "T4R1_FRESH_BOOTSTRAP_SECRET_DRIFT");
  req(authority.preconditions?.t1r1_canonical_state_reuse_authorized === false && authority.preconditions?.t3r1_canonical_state_reuse_authorized === false && authority.preconditions?.cross_scope_canonical_stitching_authorized === false, "T4R1_FRESH_BOOTSTRAP_REUSE_GUARD_DRIFT");
  req(authority.scope?.field_id === "field_kbs_mcse_t4r1" && authority.scope?.zone_id === "zone_kbs_mcse_t4r1_crop_formal_v1", "T4R1_FRESH_BOOTSTRAP_SCOPE_DRIFT");
  req(authority.crop_stage_authority?.blob_sha === CROP_BLOB && authority.crop_stage_authority?.expected_stage_for_current_execution_window === "MID", "T4R1_FRESH_BOOTSTRAP_CROP_PIN_DRIFT");
  req(authority.dynamic_boundary_policy?.minimum_bootstrap_lead_minutes === 25 && authority.dynamic_boundary_policy?.soil_collection_offset_minutes === -8 && authority.dynamic_boundary_policy?.accelerated_clock_authorized === false, "T4R1_FRESH_BOOTSTRAP_BOUNDARY_DRIFT");
  req(authority.bootstrap_persistence_contract?.expected_canonical_twin_fact_count === 34 && authority.bootstrap_persistence_contract?.expected_runtime_config_count === 25 && authority.bootstrap_persistence_contract?.expected_a0_member_count === 9, "T4R1_FRESH_BOOTSTRAP_COUNT_DRIFT");
  req(authority.execution_mode?.workflow_dispatch_only === true && authority.execution_mode?.protected_main_only === true && authority.execution_mode?.execution_token_required === "EXECUTE_T4R1_FRESH_BOOTSTRAP", "T4R1_FRESH_BOOTSTRAP_EXECUTION_MODE_DRIFT");
  req(authority.authorized_effect?.fresh_t4r1_bootstrap_authorized === true && authority.authorized_effect?.ea5e2_operational_activation_authorized === false && authority.authorized_effect?.formal_o00_start_authorized === false, "T4R1_FRESH_BOOTSTRAP_AUTHORIZED_EFFECT_DRIFT");

  for (const marker of [SOURCE_RUNNER_BLOB, AUTH_BLOB, CROP_BLOB, "GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL", "geox_mcft_cap09_s6_formal_t4r1_24h", "T3_SCOPE", "T4R1_FRESH_BOOTSTRAP_T3_SCOPE_REUSE_FORBIDDEN", "successor_adapter_source_runner_blob", "generated_file_committed = false"]) {
    req(has(runner, marker), `T4R1_FRESH_BOOTSTRAP_RUNNER_MARKER_MISSING:${marker}`);
  }
  req(!has(runner, "process.env.GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL"), "T4R1_FRESH_BOOTSTRAP_DIRECT_T3_SECRET_ACCESS_FORBIDDEN");
  if (lifecycleHotfixRoute) {
    req(has(runner, "assertDatabaseIdentityAndT3ZeroFreshConnection"), "T4R1_FRESH_BOOTSTRAP_FRESH_GUARD_CONNECTION_REQUIRED");
    req(has(runner, 'assertDatabaseIdentityAndT3ZeroFreshConnection(databaseUrl, subjectSha, "BEFORE")'), "T4R1_FRESH_BOOTSTRAP_FRESH_BEFORE_GUARD_REQUIRED");
    req(has(runner, 'assertDatabaseIdentityAndT3ZeroFreshConnection(databaseUrl, subjectSha, "AFTER")'), "T4R1_FRESH_BOOTSTRAP_FRESH_AFTER_GUARD_REQUIRED");
    req(!has(runner, 'const pool = new Pool({ connectionString: databaseUrl, application_name: `mcft-cap09-t4r1-successor-guard-${subjectSha.slice(0, 12)}`'), "T4R1_FRESH_BOOTSTRAP_CROSS_WAIT_GUARD_POOL_FORBIDDEN");
  }

  req(has(workflow, "pull_request:") && has(workflow, "merge_group:") && has(workflow, "workflow_dispatch:"), "T4R1_FRESH_BOOTSTRAP_WORKFLOW_TRIGGERS_REQUIRED");
  req(has(workflow, "if: github.event_name != 'workflow_dispatch'"), "T4R1_FRESH_BOOTSTRAP_STATIC_JOB_REQUIRED");
  req(has(workflow, "if: github.event_name == 'workflow_dispatch'"), "T4R1_FRESH_BOOTSTRAP_LIVE_JOB_REQUIRED");
  req(has(workflow, "GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL: ${{ secrets.GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL }}"), "T4R1_FRESH_BOOTSTRAP_T4_SECRET_REQUIRED");
  req(has(workflow, "MCFT_CAP09_T4R1_BOOTSTRAP_STATIC_ADAPTER_PROOF: 'true'"), "T4R1_FRESH_BOOTSTRAP_STATIC_ADAPTER_FLAG_REQUIRED");
  const liveJobMarker = "  protected-main-live-bootstrap:";
  const liveJobIndex = workflow.indexOf(liveJobMarker);
  req(liveJobIndex >= 0, "T4R1_FRESH_BOOTSTRAP_LIVE_JOB_BOUNDARY_REQUIRED");
  const liveWorkflow = workflow.slice(liveJobIndex);
  const preflightCommand = "run: pnpm exec tsx scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5A_FRESH_FORMAL_DATABASE.ts";
  const mutationStep = "- name: Execute bounded fresh T4R1 bootstrap on protected main";
  const mutationCommand = "run: pnpm exec tsx scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_T4R1_FRESH_BOOTSTRAP.ts";
  req(has(liveWorkflow, preflightCommand), "T4R1_FRESH_BOOTSTRAP_EA5A_PREFLIGHT_EXECUTION_REQUIRED");
  req(has(liveWorkflow, mutationStep), "T4R1_FRESH_BOOTSTRAP_LIVE_MUTATION_STEP_REQUIRED");
  req(has(liveWorkflow, mutationCommand), "T4R1_FRESH_BOOTSTRAP_LIVE_MUTATION_EXECUTION_REQUIRED");
  req(liveWorkflow.indexOf(preflightCommand) < liveWorkflow.indexOf(mutationStep), "T4R1_FRESH_BOOTSTRAP_PREFLIGHT_MUST_PRECEDE_MUTATION_STEP");
  req(liveWorkflow.indexOf(mutationStep) < liveWorkflow.indexOf(mutationCommand), "T4R1_FRESH_BOOTSTRAP_MUTATION_STEP_COMMAND_ORDER_REQUIRED");
  req(has(workflow, "EXECUTE_T4R1_FRESH_BOOTSTRAP"), "T4R1_FRESH_BOOTSTRAP_TOKEN_REQUIRED");
  req(!/\n\s{2}push:\s*$/m.test(workflow), "T4R1_FRESH_BOOTSTRAP_AUTO_PUSH_TRIGGER_FORBIDDEN");
  result.status = "PASS";
} catch (error) {
  result.error_code = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
}