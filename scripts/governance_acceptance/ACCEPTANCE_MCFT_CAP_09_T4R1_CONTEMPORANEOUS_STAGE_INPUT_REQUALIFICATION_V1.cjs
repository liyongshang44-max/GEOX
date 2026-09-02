#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const BASE = "e075d48b13ef1c85888c0f3dfbf3173bb5232f96";
const CONFIG = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-CONTEMPORANEOUS-STAGE-INPUT-REQUALIFICATION-V1.json";
const PROBE = "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_T4R1_CONTEMPORANEOUS_STAGE_INPUT_REQUALIFICATION_V1.mjs";
const GATE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T4R1_CONTEMPORANEOUS_STAGE_INPUT_REQUALIFICATION_V1.cjs";
const WORKFLOW = ".github/workflows/mcft-cap-09-t4r1-contemporaneous-stage-input-requalification-v1.yml";
const OUT = "acceptance-output/MCFT_CAP_09_T4R1_CONTEMPORANEOUS_STAGE_INPUT_REQUALIFICATION_GOVERNANCE_V1.json";
const FILES = [CONFIG, PROBE, GATE, WORKFLOW].sort();
const PRESERVED = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-13-CURRENT-CROP-AUTHORITY-REQUALIFICATION-SEPARATION.md": "5210001b387993cea502aac9480834400b3b8ef3",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-20-T4R1-FORMAL-SUCCESSOR-SCOPE-AUTHORITY.md": "e9e9d7d1d4efb09e91ed4a847d3cce83a67f3a86",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json": "4bc1f8dda6559c8951db915132172b65469affcb",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-PERSISTENT-LIFECYCLE-QUALIFICATION-V1.json": "58891e7ac7d887e3fdbb439c60728a794c9d70c7",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-CROP-ONLY-GEOMETRY-AUTHORITY-V1.json": "3f8bfab5569af02fc69b1fe59d80085a38bee05c",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-THERMAL-LANDMARK-TO-WATER-USE-STAGE-MAPPING-V1.json": "4e555183e2b69d3b7f39a7341acd89815ad871dd",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-ACQUISITION-HORIZON-AUTHORITY-V1.json": "45d31055e3c7f488da27b2f706cee913644b1c5b"
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

  assert.equal(base, BASE, "T4R1_STAGE_INPUT_EXACT_BASE_REQUIRED");
  assert.equal(subject, head, "T4R1_STAGE_INPUT_EXACT_HEAD_REQUIRED");
  assert.equal(git("merge-base", base, head), base, "T4R1_STAGE_INPUT_BASE_NOT_ANCESTOR");

  const changed = git("diff", "--name-only", `${base}...HEAD`).split("\n").filter(Boolean).sort();
  assert.deepEqual(changed, FILES, "T4R1_STAGE_INPUT_EXACT_FOUR_FILE_BOUNDARY_REQUIRED");

  for (const [file, blob] of Object.entries(PRESERVED)) {
    assert.equal(git("rev-parse", `${base}:${file}`), blob, `T4R1_STAGE_INPUT_BASE_PIN_DRIFT:${file}`);
    assert.equal(git("rev-parse", `HEAD:${file}`), blob, `T4R1_STAGE_INPUT_PREDECESSOR_MUTATED:${file}`);
  }

  const config = JSON.parse(read(CONFIG));
  assert.equal(config.exact_predecessor_sha, BASE);
  assert.equal(config.frontier, "T4R1_CONTEMPORANEOUS_STAGE_INPUT_REQUALIFICATION");
  assert.equal(config.formal_scope.site_id, "KBS_MCSE_T4R1");
  assert.equal(config.formal_scope.field_id, "field_kbs_mcse_t4r1");
  assert.equal(config.formal_scope.season_id, "season_2026_corn");
  assert.equal(config.formal_scope.planting_observation_id, 6974);
  assert.equal(config.formal_scope.hybrid_product_code, "43-96P");
  assert.equal(config.provider_scan.scan_all_post_planting_t4_or_t4r1_event_types, true);
  assert.equal(config.provider_scan.parent_t4_event_requires_explicit_all_replications_including_r1, true);
  assert.equal(config.stage_requalification_policy.semantic_candidate_alone_resolves_stage, false);
  assert.equal(config.stage_requalification_policy.management_event_description_alone_resolves_stage, false);
  assert.equal(config.stage_requalification_policy.elapsed_calendar_time_resolves_stage, false);
  assert.equal(config.stage_requalification_policy.single_fao_variant_selection_authorized, false);
  assert.equal(config.stage_requalification_policy.future_observations_authorized, false);
  assert.equal(config.stage_requalification_policy.minimum_backward_stability_hours, 6);
  assert.equal(config.stage_requalification_policy.minimum_forward_transition_guard_hours, 30);
  assert.equal(config.stage_requalification_policy.whole_window_guard_must_be_separately_proved, true);
  assert.equal(config.stage_requalification_policy.silking_mapping_reuse.safe_stage_at_exact_landmark, "MID");
  assert.equal(config.stage_requalification_policy.silking_mapping_reuse.post_landmark_stage_persistence_claimed, false);
  assert.equal(config.stage_requalification_policy.physiological_maturity_mapping_reuse.safe_stage_at_or_after_landmark_before_harvest, "LATE");
  assert.equal(config.stage_requalification_policy.physiological_maturity_mapping_reuse.landmark_equals_late_stage_start_claimed, false);
  assert.equal(config.stage_requalification_policy.termination_or_harvest_is_lifecycle_evidence_not_stage_authority, true);

  for (const key of [
    "current_t4r1_stage_authority_established",
    "current_t4r1_lifecycle_mutated",
    "new_natural_season_created",
    "database_write_authorized",
    "raw_object_write_authorized",
    "runtime_config_write_authorized",
    "scheduler_write_authorized",
    "runtime_process_start_authorized",
    "production_owner_activation_authorized",
    "formal_v5_arm_authorized",
    "a0_authorized",
    "o00_authorized",
    "mcft_cap09_completed"
  ]) assert.equal(config.non_effects[key], false, `T4R1_STAGE_INPUT_PREMATURE_EFFECT_FORBIDDEN:${key}`);
  assert.equal(config.non_effects.formal_execution_count, "0/24");

  const probe = read(PROBE);
  for (const value of [
    "T4R1_CONTEMPORANEOUS_STAGE_INPUT_CANDIDATE_DETECTED_MAPPING_AND_GUARD_PROOF_REQUIRED",
    "T4R1_TERMINATION_INPUT_CANDIDATE_DETECTED_LIFECYCLE_REQUALIFICATION_REQUIRED",
    "NO_T4R1_CONTEMPORANEOUS_STAGE_INPUT_AUTHORITY_CURRENTLY_ESTABLISHED",
    "semantic_candidate_alone_used_as_stage: false",
    "elapsed_calendar_time_used_as_stage: false",
    "backward_stability_hours_required: 6",
    "forward_transition_guard_hours_required: 30",
    "whole_window_guard_passed: false",
    "database_write_count: 0",
    "runtime_process_start: false",
    "formal_execution_count: '0/24'"
  ]) marker(probe, value, "T4R1_STAGE_INPUT_PROBE_MARKER_REQUIRED");

  for (const forbidden of [
    "require('pg')",
    "require(\"pg\")",
    "DATABASE_URL",
    "FORMAL_DATABASE_URL",
    "GEOX_MCFT_CAP09_S6_DATABASE_URL",
    "@aws-sdk/client-s3",
    "INSERT INTO",
    "UPDATE facts",
    "DELETE FROM",
    "TRUNCATE"
  ]) assert(!probe.includes(forbidden), `T4R1_STAGE_INPUT_SIDE_EFFECT_CAPABILITY_FORBIDDEN:${forbidden}`);

  const workflow = read(WORKFLOW);
  marker(workflow, "pull_request:", "T4R1_STAGE_INPUT_PR_TRIGGER_REQUIRED");
  marker(workflow, "merge_group:", "T4R1_STAGE_INPUT_MERGE_GROUP_TRIGGER_REQUIRED");
  marker(workflow, "persist-credentials: false", "T4R1_STAGE_INPUT_READ_ONLY_CHECKOUT_REQUIRED");
  marker(workflow, "MCFT_BASE_SHA: e075d48b13ef1c85888c0f3dfbf3173bb5232f96", "T4R1_STAGE_INPUT_FIXED_PREDECESSOR_REQUIRED");
  marker(workflow, "PROBE_MCFT_CAP_09_T4R1_CONTEMPORANEOUS_STAGE_INPUT_REQUALIFICATION_V1.mjs", "T4R1_STAGE_INPUT_LIVE_PROBE_REQUIRED");
  assert(!/^\s{2}push:/m.test(workflow), "T4R1_STAGE_INPUT_PUSH_TRIGGER_FORBIDDEN");
  assert(!workflow.includes("workflow_dispatch:"), "T4R1_STAGE_INPUT_MANUAL_DISPATCH_FORBIDDEN");
  assert(!workflow.includes("schedule:"), "T4R1_STAGE_INPUT_SCHEDULE_TRIGGER_FORBIDDEN");

  write({
    schema_version: "geox_mcft_cap09_t4r1_contemporaneous_stage_input_requalification_governance_v1",
    status: "PASS",
    subject_sha: head,
    exact_predecessor_sha: base,
    exact_four_file_boundary: true,
    preserved_authority_pins_verified: true,
    live_read_only_provider_requalification_required: true,
    semantic_candidate_alone_stage_authority_forbidden: true,
    elapsed_calendar_time_stage_authority_forbidden: true,
    backward_stability_hours_required: 6,
    forward_transition_guard_hours_required: 30,
    database_write_count: 0,
    runtime_process_start: false,
    formal_execution_count: "0/24",
    mcft_cap09_completed: false
  });
} catch (error) {
  write({
    schema_version: "geox_mcft_cap09_t4r1_contemporaneous_stage_input_requalification_governance_v1",
    status: "FAIL",
    error: String(error?.message || error),
    database_write_count: 0,
    runtime_process_start: false,
    formal_execution_count: "0/24",
    mcft_cap09_completed: false
  });
  process.exitCode = 1;
}
