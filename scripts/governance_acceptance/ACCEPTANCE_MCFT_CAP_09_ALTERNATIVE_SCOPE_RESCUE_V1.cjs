#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const BASE = "0cf2b3ddd529c2c5b05698e51aa41a2afce1b92c";
const CONFIG = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-ALTERNATIVE-SCOPE-RESCUE-V1.json";
const PROBE = "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_ALTERNATIVE_SCOPE_RESCUE_V1.mjs";
const GATE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_ALTERNATIVE_SCOPE_RESCUE_V1.cjs";
const WORKFLOW = ".github/workflows/mcft-cap-09-alternative-scope-rescue-v1.yml";
const OUT = "acceptance-output/MCFT_CAP_09_ALTERNATIVE_SCOPE_RESCUE_GOVERNANCE_V1.json";
const FILES = [CONFIG, PROBE, GATE, WORKFLOW].sort();
const PRESERVED = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md": "39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-13-CURRENT-CROP-AUTHORITY-REQUALIFICATION-SEPARATION.md": "5210001b387993cea502aac9480834400b3b8ef3",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-16-CURRENT-SEASON-LIFECYCLE-PERSISTENT-STATE-SEMANTICS.md": "4d0f4449847aa865aec5b23b87c180ee5799051a",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-17-T3R1-FORMAL-SUCCESSOR-SCOPE-AUTHORITY.md": "f9d664a0f58c6024f3090edbd5aee26d8d1b680a",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1J-CROP-WATER-USE-STAGE-AUTHORITY-V1.json": "eeb7ab49ee3270421efe4d6674305426074d1541",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-CROP-ONLY-GEOMETRY-AUTHORITY-V1.json": "87b1c8fa37939085be68abb66bfa8e0918f65e95"
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
  assert.equal(base, BASE, "ALTERNATIVE_SCOPE_EXACT_BASE_REQUIRED");
  assert.equal(subject, head, "ALTERNATIVE_SCOPE_EXACT_HEAD_REQUIRED");
  assert.equal(git("merge-base", base, head), base, "ALTERNATIVE_SCOPE_BASE_NOT_ANCESTOR");
  const changed = git("diff", "--name-only", `${base}...HEAD`).split("\n").filter(Boolean).sort();
  assert.deepEqual(changed, FILES, "ALTERNATIVE_SCOPE_EXACT_FOUR_FILE_BOUNDARY_REQUIRED");
  for (const [file, blob] of Object.entries(PRESERVED)) assert.equal(git("rev-parse", `HEAD:${file}`), blob, `ALTERNATIVE_SCOPE_PREDECESSOR_MUTATED:${file}`);

  const config = JSON.parse(read(CONFIG));
  assert.equal(config.exact_base_protected_main, BASE);
  assert.equal(config.frontier, "S6-ALTERNATIVE-SCOPE-RESCUE");
  assert.equal(config.selection_contract.locked_before_live_scan, true);
  assert.equal(config.selection_contract.preferred_treatment, null);
  assert.equal(config.selection_contract.preferred_field, null);
  assert.equal(config.selection_contract.preferred_hybrid, null);
  assert.deepEqual(config.selection_contract.eligible_treatments, ["T1", "T2", "T3", "T4", "T5", "T6"]);
  assert.deepEqual(config.selection_contract.ranking, ["LEGAL_O00_COUNT_DESC", "EARLIEST_LEGAL_O00_ASC", "PLANTING_OBSERVATION_ID_ASC", "TREATMENT_ASC"]);
  assert.equal(config.whole_window_policy.minimum_candidate_lead_hours, 48);
  assert.equal(config.whole_window_policy.exact_slot_count, 24);
  assert.equal(config.whole_window_policy.backward_stability_hours, 6);
  assert.equal(config.whole_window_policy.forward_transition_guard_hours, 30);
  assert.equal(config.whole_window_policy.variant_stage_lengths_days.length, 6);
  assert.equal(config.lifecycle_candidate_policy.maximum_maize_grain_horizon_days, 180);
  assert.equal(config.lifecycle_candidate_policy.support_event_renews_horizon, false);
  assert.equal(config.lifecycle_candidate_policy.absence_of_termination_proves_active, false);
  assert.equal(config.geometry_candidate_policy.t3r1_geometry_may_be_reused_for_another_scope, false);

  const probe = read(PROBE);
  for (const value of [
    "ALTERNATIVE_SCOPE_CANDIDATE_DETECTED_REQUALIFICATION_REQUIRED",
    "NO_ALTERNATIVE_SCOPE_CANDIDATE_CURRENTLY_ESTABLISHED",
    "selection_contract_locked_before_live_scan: true",
    "preferred_treatment_used: false",
    "candidate_only_not_authority: true",
    "alternative_scope_authority_created: false",
    "whole_window_authority_passed: false",
    "parserSelfcheck();",
    "page.locator('span').allTextContents()",
    "page.locator('body').textContent()",
    "v4_qualification_store_opened: false",
    "database_write_count: 0",
    "formal_execution_count: '0/24'"
  ]) marker(probe, value, "ALTERNATIVE_SCOPE_PROBE_MARKER_REQUIRED");
  for (const forbidden of ["require('pg')", "require(\"pg\")", "DATABASE_URL", "INSERT INTO", "UPDATE facts", "DELETE FROM", "TRUNCATE"])
    assert(!probe.includes(forbidden), `ALTERNATIVE_SCOPE_SIDE_EFFECT_CAPABILITY_FORBIDDEN:${forbidden}`);

  const workflow = read(WORKFLOW);
  marker(workflow, "pull_request:", "ALTERNATIVE_SCOPE_PR_TRIGGER_REQUIRED");
  marker(workflow, "merge_group:", "ALTERNATIVE_SCOPE_MERGE_GROUP_TRIGGER_REQUIRED");
  marker(workflow, "persist-credentials: false", "ALTERNATIVE_SCOPE_READ_ONLY_CHECKOUT_REQUIRED");
  marker(workflow, "PROBE_MCFT_CAP_09_ALTERNATIVE_SCOPE_RESCUE_V1.mjs", "ALTERNATIVE_SCOPE_LIVE_PROBE_REQUIRED");
  assert(!/^\s{2}push:/m.test(workflow), "ALTERNATIVE_SCOPE_PUSH_TRIGGER_FORBIDDEN");
  assert(!workflow.includes("workflow_dispatch:"), "ALTERNATIVE_SCOPE_MANUAL_DISPATCH_FORBIDDEN");

  write({
    schema_version: "geox_mcft_cap09_alternative_scope_rescue_governance_v1",
    status: "PASS",
    subject_sha: head,
    exact_base_sha: base,
    exact_four_file_boundary: true,
    selection_contract_locked_before_live_scan: true,
    preferred_treatment_or_field_or_hybrid: false,
    deterministic_ranking_required: true,
    candidate_only_no_authority_effect: true,
    v4_qualification_store_opened: false,
    database_write_count: 0,
    formal_execution_count: "0/24",
    mcft_cap09_completed: false
  });
} catch (error) {
  write({
    schema_version: "geox_mcft_cap09_alternative_scope_rescue_governance_v1",
    status: "FAIL",
    error: String(error?.message || error),
    v4_qualification_store_opened: false,
    database_write_count: 0,
    formal_execution_count: "0/24",
    mcft_cap09_completed: false
  });
  process.exitCode = 1;
}
