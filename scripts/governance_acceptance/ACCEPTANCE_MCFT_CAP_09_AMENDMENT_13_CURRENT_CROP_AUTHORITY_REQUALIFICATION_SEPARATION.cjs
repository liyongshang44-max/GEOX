#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const EXPECTED_BASE = "1e0b9ae19965e6cfc9f9a538b7299a8afd84fd60";
const ENTRY_REPROOF_RUN_ID = 31793869722;
const LEGACY_READINESS_BLOCKER = "CURRENT_CROP_AUTHORITY_HAS_NO_FUTURE_LEGAL_TARGET";
const DOC = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-13-CURRENT-CROP-AUTHORITY-REQUALIFICATION-SEPARATION.md";
const GATE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AMENDMENT_13_CURRENT_CROP_AUTHORITY_REQUALIFICATION_SEPARATION.cjs";
const WORKFLOW = ".github/workflows/mcft-cap-09-amendment-13-current-crop-authority-requalification-separation.yml";
const OUT = "acceptance-output/MCFT_CAP_09_AMENDMENT_13_CURRENT_CROP_AUTHORITY_REQUALIFICATION_SEPARATION_RESULT.json";

const ALLOWED = [DOC, GATE, WORKFLOW].sort();
const PRESERVED = [
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-08-IMPLEMENTATION-ACTIVATION-QUALIFICATION-SEPARATION-AUTHORITY.md",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-09-CROP-CONTEXT-SEASON-ARCHITECTURE-ADJUDICATION-AUTHORITY.md",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-10-P0306-BOUNDED-THERMAL-PROXY-AUTHORITY.md",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-12-SIGNED-ET0-CONSUMPTION-AUTHORITY.md",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1J-CROP-WATER-USE-STAGE-AUTHORITY-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-CURRENT-SEASON-CONTEMPORANEOUS-PHENOLOGY-QUALIFICATION-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-P0306Q-BOUNDED-GDD-STAGE-QUALIFICATION-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION-V1.json"
].sort();

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}
function read(file) {
  return fs.readFileSync(file, "utf8");
}
function marker(text, value, code) {
  assert(text.includes(value), `${code}:${value}`);
}
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(value));
}

try {
  const base = String(process.env.MCFT_BASE_SHA || "").trim();
  const subject = String(process.env.MCFT_SUBJECT_SHA || "").trim();
  const head = git("rev-parse", "HEAD");
  assert.equal(base, EXPECTED_BASE, "AMENDMENT13_EXACT_BASE_REQUIRED");
  assert.equal(subject, head, "AMENDMENT13_EXACT_HEAD_REQUIRED");
  assert.equal(git("merge-base", base, head), base, "AMENDMENT13_BASE_NOT_ANCESTOR");

  const changed = git("diff", "--name-only", `${base}...HEAD`).split("\n").filter(Boolean).sort();
  assert.deepEqual(changed, ALLOWED, "AMENDMENT13_EXACT_THREE_FILE_BOUNDARY_REQUIRED");

  const preservedBlobs = {};
  for (const file of PRESERVED) {
    const baseBlob = git("rev-parse", `${base}:${file}`);
    const headBlob = git("rev-parse", `HEAD:${file}`);
    assert.equal(headBlob, baseBlob, `AMENDMENT13_PREDECESSOR_MUTATED:${file}`);
    preservedBlobs[file] = headBlob;
  }

  const doc = read(DOC);
  for (const value of [
    "Status: **CANDIDATE — NOT EFFECTIVE UNTIL EXACT-HEAD GOVERNANCE PROOF AND PROTECTED-MAIN MERGE**",
    `Exact base protected main: \`${EXPECTED_BASE}\``,
    "season_lifecycle_authority",
    "phenology_stage_authority",
    "crop_model_parameter_authority",
    "management_lifecycle_not_biological_vitality: true",
    "current_season_lifecycle_status = UNRESOLVED",
    "current_phenology_stage_status = UNRESOLVED",
    "current_crop_model_parameter_status = UNRESOLVED",
    "S6-CURRENT-CROP-AUTHORITY-REQUALIFICATION",
    "CURRENT_SEASON_LIFECYCLE_TERMINATED",
    "CURRENT_SEASON_LIFECYCLE_UNRESOLVED",
    "REQUIRED_CROP_MODEL_PARAMETER_AUTHORITY_UNRESOLVED",
    "REQUIRED_PHENOLOGY_STAGE_UNRESOLVED",
    LEGACY_READINESS_BLOCKER,
    "REAL_HISTORICAL_SEASON_RUNTIME_CORRECTNESS_QUALIFICATION",
    "Absence of a termination row does not automatically prove `ACTIVE`",
    "no future leakage",
    "no interpolation",
    "no persistence fill",
    "no source substitution",
    "current_season_active_established = false",
    "current_season_terminated_established = false",
    "current_phenology_stage_resolved = false",
    "current_crop_model_parameter_resolved = false",
    "EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false",
    "Formal execution = 0/24"
  ]) marker(doc, value, "AMENDMENT13_AUTHORITY_MARKER_MISSING");

  marker(doc, "four-stage phenology non-consensus means `phenology_stage_authority.status = UNRESOLVED`", "AMENDMENT13_PHENOLOGY_SEPARATION_MISSING");
  marker(doc, "it does **not**, by itself, determine `season_lifecycle_authority.status`", "AMENDMENT13_LIFECYCLE_NONINFERENCE_MISSING");
  marker(doc, "does **not** establish a new `Kc`", "AMENDMENT13_NO_KC_INVENTION_MISSING");
  marker(doc, "does not change Formal completion criteria", "AMENDMENT13_HISTORICAL_QUALIFICATION_NONACTIVATION_MISSING");
  marker(doc, "historical six-FAO-variant authority is not overwritten or rewritten", "AMENDMENT13_HISTORICAL_SIX_MODEL_PRESERVATION_MISSING");
  marker(doc, "historical bounded-GDD terminal proof is not rewritten", "AMENDMENT13_BOUNDED_GDD_PRESERVATION_MISSING");

  const workflow = read(WORKFLOW);
  marker(workflow, "pull_request:", "AMENDMENT13_PR_TRIGGER_REQUIRED");
  marker(workflow, "merge_group:", "AMENDMENT13_MERGE_GROUP_TRIGGER_REQUIRED");
  marker(workflow, "persist-credentials: false", "AMENDMENT13_READ_ONLY_CHECKOUT_REQUIRED");
  assert(!/^\s{2}push:/m.test(workflow), "AMENDMENT13_PUSH_TRIGGER_FORBIDDEN");
  assert(!workflow.includes("workflow_dispatch:"), "AMENDMENT13_MANUAL_DISPATCH_FORBIDDEN");

  write({
    schema_version: "geox_mcft_cap09_amendment_13_current_crop_authority_requalification_separation_result_v1",
    status: "PASS",
    subject_sha: head,
    exact_base_sha: base,
    exact_three_file_boundary: true,
    authority_only: true,
    entry_exact_main_reproof: {
      workflow_run_id: ENTRY_REPROOF_RUN_ID,
      subject_sha: EXPECTED_BASE,
      engineering_static_blocker_count: 0,
      readiness_blocker_count: 1,
      readiness_blockers: [LEGACY_READINESS_BLOCKER]
    },
    three_axis_authority_separation: true,
    season_lifecycle_authority_independent: true,
    phenology_stage_authority_independent: true,
    crop_model_parameter_authority_independent: true,
    current_season_lifecycle_status: "UNRESOLVED",
    current_phenology_stage_status: "UNRESOLVED",
    current_crop_model_parameter_status: "UNRESOLVED",
    current_season_active_established: false,
    current_season_terminated_established: false,
    phenology_stage_established: false,
    crop_model_parameter_established: false,
    legacy_six_model_no_future_target_no_longer_lifecycle_terminal_after_successor: true,
    successor_frontier: "S6-CURRENT-CROP-AUTHORITY-REQUALIFICATION",
    historical_real_season_runtime_correctness_design_review_permitted: true,
    historical_real_season_substitutes_for_live_activation: false,
    protected_main_live_dispatch_authorized: false,
    ea5e2_operational_activation_qualified: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    raw_object_write_count: 0,
    runtime_config_write_count: 0,
    scheduler_write_count: 0,
    canonical_runtime_write_count: 0,
    formal_window_started: false,
    formal_execution_count: "0/24",
    preserved_predecessor_blobs: preservedBlobs
  });
} catch (error) {
  write({
    schema_version: "geox_mcft_cap09_amendment_13_current_crop_authority_requalification_separation_result_v1",
    status: "FAIL",
    error: String(error?.message || error),
    protected_main_live_dispatch_authorized: false,
    database_write_count: 0,
    formal_window_started: false
  });
  process.exitCode = 1;
}
