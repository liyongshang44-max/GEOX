#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const BASE = "5e623a66737efccfc2e41238e7d32c4c70ab5327";
const CONFIG = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-BRANCH-A-CONTEMPORANEOUS-PHENOLOGY-REPROOF-V1.json";
const PROBE = "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_T3R1_BRANCH_A_CONTEMPORANEOUS_PHENOLOGY_REPROOF_V1.mjs";
const GATE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T3R1_BRANCH_A_CONTEMPORANEOUS_PHENOLOGY_REPROOF_V1.cjs";
const WORKFLOW = ".github/workflows/mcft-cap-09-t3r1-branch-a-contemporaneous-phenology-reproof-v1.yml";
const OUT = "acceptance-output/MCFT_CAP_09_T3R1_BRANCH_A_CONTEMPORANEOUS_PHENOLOGY_REPROOF_GOVERNANCE_V1.json";
const FILES = [CONFIG, PROBE, GATE, WORKFLOW].sort();
const PRESERVED = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-13-CURRENT-CROP-AUTHORITY-REQUALIFICATION-SEPARATION.md": "5210001b387993cea502aac9480834400b3b8ef3",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-17-T3R1-FORMAL-SUCCESSOR-SCOPE-AUTHORITY.md": "f9d664a0f58c6024f3090edbd5aee26d8d1b680a",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json": "757e4b9f4fdcd631eea97fca85614a1b61ef0c4a",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-PERSISTENT-LIFECYCLE-QUALIFICATION-V1.json": "073247dd9527246e423beedcccba832162ad0ff9"
};

function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function read(file) { return fs.readFileSync(file, "utf8"); }
function marker(text, value, code) { assert(text.includes(value), `${code}:${value}`); }
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify(value));
}

try {
  const base = String(process.env.MCFT_BASE_SHA || "").trim();
  const subject = String(process.env.MCFT_SUBJECT_SHA || "").trim();
  const head = git("rev-parse", "HEAD");
  assert.equal(base, BASE, "T3R1_BRANCH_A_EXACT_BASE_REQUIRED");
  assert.equal(subject, head, "T3R1_BRANCH_A_EXACT_HEAD_REQUIRED");
  assert.equal(git("merge-base", base, head), base, "T3R1_BRANCH_A_BASE_NOT_ANCESTOR");
  const changed = git("diff", "--name-only", `${base}...HEAD`).split("\n").filter(Boolean).sort();
  assert.deepEqual(changed, FILES, "T3R1_BRANCH_A_EXACT_FOUR_FILE_BOUNDARY_REQUIRED");
  for (const [file, blob] of Object.entries(PRESERVED)) assert.equal(git("rev-parse", `HEAD:${file}`), blob, `T3R1_BRANCH_A_PREDECESSOR_MUTATED:${file}`);

  const config = JSON.parse(read(CONFIG));
  assert.equal(config.exact_base_protected_main, BASE);
  assert.equal(config.frontier, "S6-T3R1-BRANCH-A-CONTEMPORANEOUS-PHENOLOGY-REPROOF");
  assert.equal(config.formal_scope.site_id, "KBS_MCSE_T3R1");
  assert.equal(config.formal_scope.field_id, "field_kbs_mcse_t3r1");
  assert.equal(config.formal_scope.planting_observation_id, 6966);
  assert.equal(config.formal_scope.hybrid_product_code, "P0306Q");
  assert.equal(config.phenology_policy.semantic_candidate_alone_resolves_stage, false);
  assert.equal(config.phenology_policy.elapsed_calendar_time_resolves_stage, false);
  assert.equal(config.phenology_policy.single_fao_variant_selection_authorized, false);
  assert.equal(config.phenology_policy.future_observations_authorized, false);

  const probe = read(PROBE);
  for (const value of [
    "T3R1_PHENOLOGY_INPUT_CANDIDATE_DETECTED_REQUALIFICATION_REQUIRED",
    "NO_T3R1_PHENOLOGY_AUTHORITY_CURRENTLY_ESTABLISHED",
    "semantic_candidate_alone_used_as_stage: false",
    "gdd_stage_authority_created: false",
    "historical_crop_authority_mutated: false",
    "whole_window_scan_passed: false",
    "v4_qualification_store_opened: false",
    "database_write_count: 0",
    "formal_execution_count: '0/24'"
  ]) marker(probe, value, "T3R1_BRANCH_A_PROBE_MARKER_REQUIRED");
  for (const forbidden of ["require('pg')", "require(\"pg\")", "DATABASE_URL", "INSERT INTO", "UPDATE facts", "DELETE FROM", "TRUNCATE"])
    assert(!probe.includes(forbidden), `T3R1_BRANCH_A_SIDE_EFFECT_CAPABILITY_FORBIDDEN:${forbidden}`);

  const workflow = read(WORKFLOW);
  marker(workflow, "pull_request:", "T3R1_BRANCH_A_PR_TRIGGER_REQUIRED");
  marker(workflow, "merge_group:", "T3R1_BRANCH_A_MERGE_GROUP_TRIGGER_REQUIRED");
  marker(workflow, "persist-credentials: false", "T3R1_BRANCH_A_READ_ONLY_CHECKOUT_REQUIRED");
  marker(workflow, "PROBE_MCFT_CAP_09_T3R1_BRANCH_A_CONTEMPORANEOUS_PHENOLOGY_REPROOF_V1.mjs", "T3R1_BRANCH_A_LIVE_PROBE_REQUIRED");
  assert(!/^\s{2}push:/m.test(workflow), "T3R1_BRANCH_A_PUSH_TRIGGER_FORBIDDEN");
  assert(!workflow.includes("workflow_dispatch:"), "T3R1_BRANCH_A_MANUAL_DISPATCH_FORBIDDEN");

  write({
    schema_version: "geox_mcft_cap09_t3r1_branch_a_contemporaneous_phenology_reproof_governance_v1",
    status: "PASS",
    subject_sha: head,
    exact_base_sha: base,
    exact_four_file_boundary: true,
    live_read_only_provider_reproof_required: true,
    semantic_token_alone_stage_authority_forbidden: true,
    v4_qualification_store_opened: false,
    database_write_count: 0,
    formal_execution_count: "0/24",
    mcft_cap09_completed: false
  });
} catch (error) {
  write({
    schema_version: "geox_mcft_cap09_t3r1_branch_a_contemporaneous_phenology_reproof_governance_v1",
    status: "FAIL",
    error: String(error?.message || error),
    v4_qualification_store_opened: false,
    database_write_count: 0,
    formal_execution_count: "0/24",
    mcft_cap09_completed: false
  });
  process.exitCode = 1;
}
