#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const BASE = "60e4fd93c9dff017fd0d62967fad17a49383f12e";
const CONFIG = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-NATURAL-SEASON-SUCCESSOR-ADJUDICATION-V1.json";
const PROBE = "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_T4R1_NATURAL_SEASON_SUCCESSOR_ADJUDICATION_V1.mjs";
const GATE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T4R1_NATURAL_SEASON_SUCCESSOR_ADJUDICATION_V1.cjs";
const WORKFLOW = ".github/workflows/mcft-cap-09-t4r1-natural-season-successor-adjudication-v1.yml";
const OUT = "acceptance-output/MCFT_CAP_09_T4R1_NATURAL_SEASON_SUCCESSOR_ADJUDICATION_GOVERNANCE_V1.json";
const FILES = [CONFIG, PROBE, GATE, WORKFLOW].sort();
const PRESERVED = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-09-CROP-CONTEXT-SEASON-ARCHITECTURE-ADJUDICATION-AUTHORITY.md": "422f60257039e0f674171c218a7ff0a2fd7dc1b2",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-13-CURRENT-CROP-AUTHORITY-REQUALIFICATION-SEPARATION.md": "5210001b387993cea502aac9480834400b3b8ef3",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-20-T4R1-FORMAL-SUCCESSOR-SCOPE-AUTHORITY.md": "e9e9d7d1d4efb09e91ed4a847d3cce83a67f3a86",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-PERSISTENT-LIFECYCLE-QUALIFICATION-V1.json": "58891e7ac7d887e3fdbb439c60728a794c9d70c7",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-CONTEMPORANEOUS-STAGE-INPUT-REQUALIFICATION-V1.json": "220b0d935bf1404a981ce1e7c43bdd6c831bb793",
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
  assert.equal(base, BASE, "T4R1_NATURAL_SEASON_EXACT_BASE_REQUIRED");
  assert.equal(subject, head, "T4R1_NATURAL_SEASON_EXACT_HEAD_REQUIRED");
  assert.equal(git("merge-base", base, head), base, "T4R1_NATURAL_SEASON_BASE_NOT_ANCESTOR");

  const changed = git("diff", "--name-only", `${base}...HEAD`).split("\n").filter(Boolean).sort();
  assert.deepEqual(changed, FILES, "T4R1_NATURAL_SEASON_EXACT_FOUR_FILE_BOUNDARY_REQUIRED");

  for (const [file, blob] of Object.entries(PRESERVED)) {
    assert.equal(git("rev-parse", `${base}:${file}`), blob, `T4R1_NATURAL_SEASON_BASE_PIN_DRIFT:${file}`);
    assert.equal(git("rev-parse", `HEAD:${file}`), blob, `T4R1_NATURAL_SEASON_PREDECESSOR_MUTATED:${file}`);
  }

  const config = JSON.parse(read(CONFIG));
  assert.equal(config.exact_predecessor_sha, BASE);
  assert.equal(config.frontier, "T4R1_NATURAL_SEASON_SUCCESSOR_ADJUDICATION");
  const proof = config.authority_predecessors.stage_input_requalification.exact_head_proof;
  assert.equal(proof.subject_sha, BASE);
  assert.equal(proof.workflow_run_id, 33630413934);
  assert.equal(proof.artifact_id, 9846584085);
  assert.equal(proof.artifact_digest, "sha256:38a6b645cab971c70ed13e116392186f0eafee2c32538d062a02e265a24a18c4");
  assert.equal(proof.result, "NO_T4R1_CONTEMPORANEOUS_STAGE_INPUT_AUTHORITY_CURRENTLY_ESTABLISHED");
  assert.equal(proof.direct_stage_input_candidate_count, 0);
  assert.equal(proof.termination_input_candidate_count, 0);

  const anchor = config.historical_scope_anchor;
  assert.equal(anchor.site_id, "KBS_MCSE_T4R1");
  assert.equal(anchor.field_id, "field_kbs_mcse_t4r1");
  assert.equal(anchor.season_id, "season_2026_corn");
  assert.equal(anchor.planting_observation_id, 6974);
  assert.equal(anchor.planting_observation_date, "2026-05-27");
  assert.equal(anchor.history_must_remain_append_only, true);
  assert.equal(anchor.historical_scope_may_be_relabelled_as_new_season, false);

  const a = config.adjudication_contract;
  assert.equal(a.candidate_result_is_not_new_season_authority, true);
  assert.equal(a.no_candidate_result_is_time_gated_snapshot_not_global_absence, true);
  assert.equal(a.post_anchor_planting_event_alone_may_establish_new_season, false);
  assert.equal(a.new_season_id_may_be_created_by_this_adjudication, false);
  assert.equal(a.new_crop_identity_may_be_inferred_from_rotation, false);
  assert.equal(a.future_calendar_year_may_define_season_identity, false);
  assert.equal(a.historical_field_or_zone_identity_may_be_reused_by_this_adjudication, false);
  assert.equal(a.historical_crop_stage_may_be_reused, false);
  assert.equal(a.historical_kc_may_be_reused, false);
  assert.equal(a.cross_season_state_stitching_authorized, false);
  assert.equal(a.cross_season_forecast_stitching_authorized, false);
  assert.equal(a.cross_season_checkpoint_stitching_authorized, false);
  assert.equal(a.cross_season_lineage_stitching_authorized, false);
  assert.equal(a.fresh_successor_authority_requires_separate_build, true);

  const p = config.provider_probe;
  assert.equal(p.provider, "KBS_AGLOG");
  assert.equal(p.anchor_url, "https://aglog.kbs.msu.edu/observations/6974");
  assert.equal(p.new_candidate_min_observation_date_exclusive, "2026-05-27");
  assert.equal(p.candidate_observation_type_token, "Planting");
  assert.equal(p.exact_t4r1_detail_area_is_sufficient, true);
  assert.equal(p.parent_t4_detail_area_requires_explicit_all_replications_including_r1, true);
  assert.equal(p.candidate_crop_identity_is_metadata_only_until_separate_authority_build, true);
  assert.equal(p.provider_body_text_may_be_emitted, false);
  assert(p.maximum_index_pages >= 5 && p.maximum_index_pages <= 50, "T4R1_NATURAL_SEASON_BOUNDED_INDEX_SCAN_REQUIRED");

  assert.equal(config.successor_policy.on_candidate, "T4R1_NATURAL_SEASON_SUCCESSOR_AUTHORITY_BUILD");
  assert.equal(config.successor_policy.on_no_candidate, "T4R1_NATURAL_SEASON_EVIDENCE_REQUALIFICATION");

  for (const key of [
    "new_natural_season_created","new_crop_context_authority_established","historical_geometry_reused",
    "new_canonical_bootstrap_authority_established","database_write_authorized","raw_object_write_authorized",
    "runtime_config_write_authorized","scheduler_write_authorized","runtime_process_start_authorized",
    "production_owner_activation_authorized","formal_v5_arm_authorized","a0_authorized","o00_authorized",
    "mcft_cap09_completed"
  ]) assert.equal(config.non_effects[key], false, `T4R1_NATURAL_SEASON_PREMATURE_EFFECT_FORBIDDEN:${key}`);
  assert.equal(config.non_effects.new_season_id, null);
  assert.equal(config.non_effects.new_crop, null);
  assert.equal(config.non_effects.formal_execution_count, "0/24");

  const probe = read(PROBE);
  for (const value of [
    "T4R1_NATURAL_SEASON_SUCCESSOR_CANDIDATE_EVIDENCE_OBSERVED",
    "NO_T4R1_NATURAL_SEASON_SUCCESSOR_CANDIDATE_CURRENTLY_OBSERVED",
    "candidate_result_is_new_season_authority: false",
    "rotation_used_to_infer_crop: false",
    "new_natural_season_created: false",
    "new_season_id: null",
    "historical_geometry_reused: false",
    "cross_season_state_stitching_authorized: false",
    "cross_season_forecast_stitching_authorized: false",
    "cross_season_checkpoint_stitching_authorized: false",
    "cross_season_lineage_stitching_authorized: false",
    "database_write_count: 0",
    "runtime_process_start: false",
    "formal_execution_count: '0/24'"
  ]) marker(probe, value, "T4R1_NATURAL_SEASON_PROBE_MARKER_REQUIRED");

  for (const forbidden of [
    "require('pg')","require(\"pg\")","DATABASE_URL","FORMAL_DATABASE_URL","GEOX_MCFT_CAP09_S6_DATABASE_URL",
    "@aws-sdk/client-s3","INSERT INTO","UPDATE ","DELETE FROM","TRUNCATE"
  ]) assert(!probe.includes(forbidden), `T4R1_NATURAL_SEASON_SIDE_EFFECT_CAPABILITY_FORBIDDEN:${forbidden}`);

  const workflow = read(WORKFLOW);
  marker(workflow, "pull_request:", "T4R1_NATURAL_SEASON_PR_TRIGGER_REQUIRED");
  marker(workflow, "merge_group:", "T4R1_NATURAL_SEASON_MERGE_GROUP_TRIGGER_REQUIRED");
  marker(workflow, "persist-credentials: false", "T4R1_NATURAL_SEASON_READ_ONLY_CHECKOUT_REQUIRED");
  marker(workflow, "MCFT_BASE_SHA: 60e4fd93c9dff017fd0d62967fad17a49383f12e", "T4R1_NATURAL_SEASON_FIXED_PREDECESSOR_REQUIRED");
  marker(workflow, "PROBE_MCFT_CAP_09_T4R1_NATURAL_SEASON_SUCCESSOR_ADJUDICATION_V1.mjs", "T4R1_NATURAL_SEASON_LIVE_PROBE_REQUIRED");
  assert(!/^\s{2}push:/m.test(workflow), "T4R1_NATURAL_SEASON_PUSH_TRIGGER_FORBIDDEN");
  assert(!workflow.includes("workflow_dispatch:"), "T4R1_NATURAL_SEASON_MANUAL_DISPATCH_FORBIDDEN");
  assert(!workflow.includes("schedule:"), "T4R1_NATURAL_SEASON_SCHEDULE_TRIGGER_FORBIDDEN");

  write({
    schema_version: "geox_mcft_cap09_t4r1_natural_season_successor_adjudication_governance_v1",
    status: "PASS",
    subject_sha: head,
    exact_predecessor_sha: base,
    exact_four_file_boundary: true,
    preserved_authority_pins_verified: true,
    stage_requalification_terminal_proof_pinned: true,
    new_season_creation_authorized: false,
    crop_inference_from_rotation_authorized: false,
    cross_season_stitching_authorized: false,
    database_write_count: 0,
    runtime_process_start: false,
    formal_execution_count: "0/24",
    mcft_cap09_completed: false
  });
} catch (error) {
  write({
    schema_version: "geox_mcft_cap09_t4r1_natural_season_successor_adjudication_governance_v1",
    status: "FAIL",
    error: String(error?.message || error),
    new_season_creation_authorized: false,
    database_write_count: 0,
    runtime_process_start: false,
    formal_execution_count: "0/24",
    mcft_cap09_completed: false
  });
  process.exitCode = 1;
}
