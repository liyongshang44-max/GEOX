#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = process.cwd();
const BASE = String(process.env.MCFT_BASE_SHA || "").trim();
const EXPECTED_BASE = "007ef1ee17105c52386ed555c20373474feea6bb";
const AUTH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-FRESH-BOOTSTRAP-EXECUTION-AUTHORITY-V1.json";
const RUNNER = "scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_T3R1_FRESH_BOOTSTRAP.ts";
const GATE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T3R1_FRESH_BOOTSTRAP.cjs";
const WORKFLOW = ".github/workflows/mcft-cap-09-t3r1-fresh-bootstrap.yml";
const FRESH_DB = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5A-FRESH-FORMAL-DATABASE-PREFLIGHT-V2.json";
const CROP = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json";
const AUTH_BLOB = "d97129915ae5f7720b3a3d8e5561a2842213da65";
const FRESH_DB_BLOB = "302f4ff3451c393cd1712ec87bc0941b2a6dc8d6";
const CROP_BLOB = "757e4b9f4fdcd631eea97fca85614a1b61ef0c4a";
const EXPECTED = [AUTH, RUNNER, GATE, WORKFLOW].sort();
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_T3R1_FRESH_BOOTSTRAP_GOVERNANCE_RESULT.json");

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const json = (file) => JSON.parse(read(file));
const blob = (ref, file) => git("rev-parse", `${ref}:${file}`);
const req = (condition, code) => { if (!condition) throw new Error(code); };
const has = (text, marker) => text.includes(marker);

const result = {
  schema_version: "geox_mcft_cap09_t3r1_fresh_bootstrap_governance_v1",
  status: "FAIL",
  base_sha: BASE,
  exact_file_count: 0,
  live_write_on_pull_request_authorized: false,
  live_write_on_merge_group_authorized: false,
  workflow_dispatch_live_write_authorized: true,
  provider_request_maximum: 1,
  fresh_evidence_write_maximum: 1,
  canonical_bootstrap_write_maximum: 34,
  scheduler_start_authorized: false,
  ea5e2_operational_activation_authorized: false,
  formal_o00_start_authorized: false,
  formal_window_started: false,
  mcft_cap09_completed: false,
};

try {
  req(BASE === EXPECTED_BASE, `T3R1_FRESH_BOOTSTRAP_BASE_MAIN_DRIFT:${BASE}`);
  const changed = git("diff", "--name-only", `${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  result.changed_files = changed;
  result.exact_file_count = changed.length;
  req(JSON.stringify(changed) === JSON.stringify(EXPECTED), `T3R1_FRESH_BOOTSTRAP_EXACT_FOUR_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);
  req(blob("HEAD", AUTH) === AUTH_BLOB, "T3R1_FRESH_BOOTSTRAP_AUTHORITY_BLOB_DRIFT");
  req(blob("HEAD", FRESH_DB) === FRESH_DB_BLOB, "T3R1_FRESH_BOOTSTRAP_FRESH_DB_AUTHORITY_BLOB_DRIFT");
  req(blob("HEAD", CROP) === CROP_BLOB, "T3R1_FRESH_BOOTSTRAP_CROP_AUTHORITY_BLOB_DRIFT");

  const authority = json(AUTH);
  const runner = read(RUNNER);
  const workflow = read(WORKFLOW);

  req(authority.record_status === "T3R1_FRESH_BOOTSTRAP_EXECUTION_AUTHORITY_NOT_FORMAL_ACTIVATION", "T3R1_FRESH_BOOTSTRAP_AUTHORITY_STATUS_DRIFT");
  req(authority.preconditions?.fresh_database_authority_blob_sha === FRESH_DB_BLOB, "T3R1_FRESH_BOOTSTRAP_FRESH_DB_PIN_DRIFT");
  req(authority.preconditions?.neon_project_id === "delicate-glade-62464340", "T3R1_FRESH_BOOTSTRAP_PROJECT_DRIFT");
  req(authority.preconditions?.neon_branch_id === "br-cold-dust-a6j6aymz", "T3R1_FRESH_BOOTSTRAP_BRANCH_DRIFT");
  req(authority.preconditions?.database_name === "geox_mcft_cap09_s6_formal_t3r1_24h", "T3R1_FRESH_BOOTSTRAP_DATABASE_DRIFT");
  req(authority.preconditions?.forbidden_t1r1_database_name === "geox_mcft_cap09_s6_formal_24h", "T3R1_FRESH_BOOTSTRAP_T1_DATABASE_GUARD_MISSING");
  req(authority.preconditions?.t1r1_canonical_state_reuse_authorized === false && authority.preconditions?.cross_scope_canonical_stitching_authorized === false, "T3R1_FRESH_BOOTSTRAP_STITCHING_GUARD_DRIFT");
  req(authority.scope?.field_id === "field_kbs_mcse_t3r1" && authority.scope?.zone_id === "zone_kbs_mcse_t3r1_crop_formal_v1", "T3R1_FRESH_BOOTSTRAP_SCOPE_DRIFT");
  req(authority.crop_stage_authority?.blob_sha === CROP_BLOB && authority.crop_stage_authority?.exact_fao_variant_count === 6, "T3R1_FRESH_BOOTSTRAP_CROP_PIN_DRIFT");
  req(authority.crop_stage_authority?.backward_stability_hours === 6 && authority.crop_stage_authority?.forward_transition_guard_hours === 30, "T3R1_FRESH_BOOTSTRAP_CROP_GUARD_DRIFT");
  req(authority.crop_stage_authority?.future_observations_authorized === false, "T3R1_FRESH_BOOTSTRAP_FUTURE_OBSERVATION_FORBIDDEN");
  req(authority.dynamic_boundary_policy?.minimum_bootstrap_lead_minutes === 25 && authority.dynamic_boundary_policy?.soil_collection_offset_minutes === -8, "T3R1_FRESH_BOOTSTRAP_DYNAMIC_BOUNDARY_DRIFT");
  req(authority.fresh_soil_ingress_contract?.binding_id === "kbs_lter_variate25_vwc_100mm_v1", "T3R1_FRESH_BOOTSTRAP_SOIL_BINDING_DRIFT");
  req(authority.fresh_soil_ingress_contract?.maximum_provider_request_count === 1 && authority.fresh_soil_ingress_contract?.maximum_new_canonical_evidence_fact_count === 1, "T3R1_FRESH_BOOTSTRAP_PROVIDER_OR_EVIDENCE_LIMIT_DRIFT");
  req(authority.fresh_soil_ingress_contract?.raw_retention_before_decode_required === true && authority.fresh_soil_ingress_contract?.source_substitution_authorized === false && authority.fresh_soil_ingress_contract?.time_relabeling_authorized === false, "T3R1_FRESH_BOOTSTRAP_RAW_OR_SUBSTITUTION_GUARD_DRIFT");
  req(authority.bootstrap_persistence_contract?.expected_canonical_twin_fact_count === 34 && authority.bootstrap_persistence_contract?.expected_runtime_config_count === 25 && authority.bootstrap_persistence_contract?.expected_a0_member_count === 9, "T3R1_FRESH_BOOTSTRAP_CANONICAL_COUNT_DRIFT");
  req(authority.execution_mode?.workflow_dispatch_only === true && authority.execution_mode?.protected_main_only === true && authority.execution_mode?.exact_head_required === true, "T3R1_FRESH_BOOTSTRAP_EXECUTION_MODE_DRIFT");
  req(authority.execution_mode?.pull_request_live_database_write_authorized === false && authority.execution_mode?.merge_group_live_database_write_authorized === false, "T3R1_FRESH_BOOTSTRAP_PR_LIVE_WRITE_FORBIDDEN");
  req(authority.authorized_effect?.fresh_t3r1_bootstrap_authorized === true && authority.authorized_effect?.ea5e2_operational_activation_authorized === false && authority.authorized_effect?.formal_o00_start_authorized === false, "T3R1_FRESH_BOOTSTRAP_AUTHORIZED_EFFECT_DRIFT");

  for (const marker of [
    "GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL",
    "geox_mcft_cap09_s6_formal_t3r1_24h",
    "br-cold-dust-a6j6aymz",
    "br-falling-cake-a6lfsdak",
    "T3R1_FRESH_BOOTSTRAP_PROTECTED_MAIN_ONLY",
    "T3R1_FRESH_BOOTSTRAP_PROTECTED_MAIN_DRIFT",
    "assertExactFreshZeroState",
    "executeFormalLiveKbsSoilIngressV1",
    "raw_value_emitted",
    "FIRST_FRESH_BOOTSTRAP",
    "EXISTING_FRESH_BOOTSTRAP_REVERIFIED",
    "buildExternalFormalBootstrapAuthorityBundleV1",
    "ExternalFormalBootstrapPersistenceServiceV1",
    "runtime_config_write_count, 25",
    "a0_member_write_count, 9",
    "hourly_runtime_config_count, 24",
    "formal_window_started, false",
    "totalFacts: 35",
    "t1r1ScopeRows: 0",
    "DYNAMIC_FRESH_T3R1_PERSISTED_A0_SEMANTIC_BINDING",
  ]) req(has(runner, marker), `T3R1_FRESH_BOOTSTRAP_RUNNER_MARKER_MISSING:${marker}`);
  req(!has(runner, "process.env.GEOX_MCFT_CAP09_S6_DATABASE_URL"), "T3R1_FRESH_BOOTSTRAP_OLD_DATABASE_SECRET_FORBIDDEN");
  req(!has(runner, "external_formal_runtime_config_7284202e3b0bdae6d32f4814"), "T3R1_FRESH_BOOTSTRAP_HISTORICAL_A0_REF_FORBIDDEN");
  req(!has(runner, "2026-08-09T21:00:00.000Z"), "T3R1_FRESH_BOOTSTRAP_HISTORICAL_BOUNDARY_FORBIDDEN");

  req(has(workflow, "pull_request:") && has(workflow, "merge_group:") && has(workflow, "workflow_dispatch:"), "T3R1_FRESH_BOOTSTRAP_WORKFLOW_TRIGGERS_REQUIRED");
  req(has(workflow, "if: github.event_name != 'workflow_dispatch'"), "T3R1_FRESH_BOOTSTRAP_STATIC_PR_JOB_REQUIRED");
  req(has(workflow, "if: github.event_name == 'workflow_dispatch'"), "T3R1_FRESH_BOOTSTRAP_LIVE_DISPATCH_JOB_REQUIRED");
  req(has(workflow, "github.ref != 'refs/heads/main'"), "T3R1_FRESH_BOOTSTRAP_WORKFLOW_MAIN_GUARD_REQUIRED");
  req(has(workflow, "EXECUTE_T3R1_FRESH_BOOTSTRAP"), "T3R1_FRESH_BOOTSTRAP_WORKFLOW_TOKEN_REQUIRED");
  req(has(workflow, "GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL: ${{ secrets.GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL }}"), "T3R1_FRESH_BOOTSTRAP_WORKFLOW_T3_SECRET_REQUIRED");
  req(has(workflow, "EXECUTE_MCFT_CAP_09_T3R1_FRESH_BOOTSTRAP.ts"), "T3R1_FRESH_BOOTSTRAP_WORKFLOW_RUNNER_REQUIRED");
  req(!/\n\s{2}push:\s*$/m.test(workflow), "T3R1_FRESH_BOOTSTRAP_AUTO_PUSH_TRIGGER_FORBIDDEN");
  req(!has(workflow, "GEOX_MCFT_CAP09_S6_DATABASE_URL: ${{ secrets.GEOX_MCFT_CAP09_S6_DATABASE_URL }}"), "T3R1_FRESH_BOOTSTRAP_WORKFLOW_OLD_SECRET_FORBIDDEN");

  result.status = "PASS";
} catch (error) {
  result.error_code = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
}
