#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const cp = require("node:child_process");

const BASE = "68af52d1c6df8a32edad231e0425421ecfe31b4d";
const PATHS = {
  workflow: ".github/workflows/mcft-cap-09-t3r1-successor-whole-window-scan-v2.yml",
  scanner: "scripts/runtime_acceptance/SCAN_MCFT_CAP_09_T3R1_SUCCESSOR_WHOLE_WINDOW_V2.cjs",
  authority: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-WHOLE-WINDOW-SCAN-V2.json",
  gate: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T3R1_SUCCESSOR_WHOLE_WINDOW_SCAN_V2.cjs",
};
const OUTPUT = "acceptance-output/MCFT_CAP_09_T3R1_SUCCESSOR_WHOLE_WINDOW_SCAN_V2_GATE_RESULT.json";
const SCAN_OUTPUT = "acceptance-output/MCFT_CAP_09_T3R1_SUCCESSOR_WHOLE_WINDOW_SCAN_V2.json";

function git(...args) { return cp.execFileSync("git", args, { encoding: "utf8" }).trim(); }
function eq(actual, expected, code) { if (actual !== expected) throw new Error(`${code}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`); }
function yes(value, code) { eq(value, true, code); }
function no(value, code) { eq(value, false, code); }
function json(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }

function main() {
  const base = process.env.MCFT_BASE_SHA;
  eq(base, BASE, "T3R1_WHOLE_WINDOW_SCAN_EXACT_BASE_REQUIRED");
  const subject = git("rev-parse", "HEAD");
  const expectedFiles = Object.values(PATHS).sort();
  const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  eq(JSON.stringify(changed), JSON.stringify(expectedFiles), "T3R1_WHOLE_WINDOW_SCAN_EXACT_FOUR_FILE_BOUNDARY_REQUIRED");

  const immutablePins = {
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-OPERATIONAL-ACTIVATION-EVIDENCE-FREEZE-V1.json": "8b790d37dc0b9f253d168f58e8b0dac28dedc3f7",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json": "757e4b9f4fdcd631eea97fca85614a1b61ef0c4a",
    "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_TARGET_CROP_CONSENSUS.cjs": "f54dce70602cc3e4387773b47f11eb602d3b41c0",
  };
  for (const [file, blob] of Object.entries(immutablePins)) {
    eq(git("rev-parse", `${base}:${file}`), blob, `T3R1_WHOLE_WINDOW_SCAN_BASE_PIN:${file}`);
    eq(git("rev-parse", `HEAD:${file}`), blob, `T3R1_WHOLE_WINDOW_SCAN_PREDECESSOR_MUTATED:${file}`);
  }

  const authority = json(PATHS.authority);
  eq(authority.schema_version, "geox_mcft_cap09_t3r1_successor_whole_window_scan_authority_v2", "T3R1_WHOLE_WINDOW_SCAN_AUTHORITY_SCHEMA_REQUIRED");
  eq(authority.base_protected_main_sha, BASE, "T3R1_WHOLE_WINDOW_SCAN_AUTHORITY_BASE_REQUIRED");
  eq(authority.activation_effective_at, "2026-08-16T07:12:23.000Z", "T3R1_WHOLE_WINDOW_SCAN_ACTIVATION_TIME_REQUIRED");
  yes(authority.operational_activation_freeze.ea5e2_operational_activation_qualified, "T3R1_WHOLE_WINDOW_SCAN_ACTIVATION_EFFECTIVE_REQUIRED");
  eq(authority.crop_authority.site_id, "KBS_MCSE_T3R1", "T3R1_WHOLE_WINDOW_SCAN_SITE_REQUIRED");
  eq(authority.crop_authority.hybrid_product_code, "P0306Q", "T3R1_WHOLE_WINDOW_SCAN_HYBRID_REQUIRED");
  eq(authority.crop_authority.planting_window_start_inclusive, "2026-05-20T04:00:00.000Z", "T3R1_WHOLE_WINDOW_SCAN_PLANTING_START_REQUIRED");
  eq(authority.crop_authority.planting_window_end_exclusive, "2026-05-21T04:00:00.000Z", "T3R1_WHOLE_WINDOW_SCAN_PLANTING_END_REQUIRED");
  eq(authority.window_contract.exact_slot_count, 24, "T3R1_WHOLE_WINDOW_SCAN_24_SLOTS_REQUIRED");
  eq(authority.window_contract.minimum_lead_hours, 36, "T3R1_WHOLE_WINDOW_SCAN_36H_LEAD_REQUIRED");
  eq(authority.window_contract.ea5e3_readiness_offset_hours, -12, "T3R1_WHOLE_WINDOW_SCAN_MINUS_12H_REQUIRED");
  yes(authority.window_contract.successor_epoch_selection_is_separate_authority, "T3R1_WHOLE_WINDOW_SCAN_SELECTION_SEPARATION_REQUIRED");

  cp.execFileSync("node", [PATHS.scanner], { stdio: "inherit" });
  const scan = json(SCAN_OUTPUT);
  const expected = authority.expected_scan_result;
  eq(scan.status, "PASS", "T3R1_WHOLE_WINDOW_SCAN_PASS_REQUIRED");
  eq(scan.legal_candidate_count_after_activation, expected.legal_candidate_count_after_activation, "T3R1_WHOLE_WINDOW_SCAN_CANDIDATE_COUNT_REQUIRED");
  eq(JSON.stringify(scan.earliest_legal_candidate_if_selected_at_activation), JSON.stringify(expected.earliest_legal_candidate_if_selected_at_activation), "T3R1_WHOLE_WINDOW_SCAN_EARLIEST_CANDIDATE_REQUIRED");
  eq(JSON.stringify(scan.latest_complete_current_season_candidate), JSON.stringify(expected.latest_complete_current_season_candidate), "T3R1_WHOLE_WINDOW_SCAN_LATEST_CANDIDATE_REQUIRED");
  yes(scan.current_season_successor_window_exists, "T3R1_WHOLE_WINDOW_SCAN_CURRENT_SEASON_WINDOW_REQUIRED");
  no(scan.successor_epoch_selected, "T3R1_WHOLE_WINDOW_SCAN_SELECTION_FORBIDDEN");
  no(scan.future_observations_used, "T3R1_WHOLE_WINDOW_SCAN_FUTURE_OBSERVATIONS_FORBIDDEN");
  for (const key of ["provider_request_count", "database_write_count", "r2_write_count", "scheduler_write_count", "canonical_runtime_write_count"]) eq(scan[key], 0, `T3R1_WHOLE_WINDOW_SCAN_ZERO_SIDE_EFFECT:${key}`);
  no(scan.ea5e3_authorized, "T3R1_WHOLE_WINDOW_SCAN_EA5E3_FORBIDDEN");
  no(scan.formal_window_started, "T3R1_WHOLE_WINDOW_SCAN_FORMAL_START_FORBIDDEN");

  const effect = authority.authority_effect_if_exact_head_proof_passes_and_merges;
  yes(effect.whole_window_crop_context_scan_effective, "T3R1_WHOLE_WINDOW_SCAN_EFFECT_REQUIRED");
  yes(effect.current_season_successor_window_exists, "T3R1_WHOLE_WINDOW_SCAN_WINDOW_EFFECT_REQUIRED");
  no(effect.successor_epoch_selected, "T3R1_WHOLE_WINDOW_SCAN_PREMATURE_SELECTION_FORBIDDEN");
  no(effect.ea5e3_authorized, "T3R1_WHOLE_WINDOW_SCAN_PREMATURE_EA5E3_FORBIDDEN");
  no(effect.formal_window_started, "T3R1_WHOLE_WINDOW_SCAN_PREMATURE_FORMAL_START_FORBIDDEN");
  no(effect.mcft_cap09_completed, "T3R1_WHOLE_WINDOW_SCAN_PREMATURE_COMPLETION_FORBIDDEN");
  eq(effect.next_legal_frontier, "SUCCESSOR_EPOCH_SELECTION_AUTHORITY", "T3R1_WHOLE_WINDOW_SCAN_NEXT_FRONTIER_REQUIRED");

  const capabilityText = [PATHS.workflow, PATHS.scanner, PATHS.authority].map((file) => fs.readFileSync(file, "utf8")).join("\n");
  for (const marker of ["GEOX_MCFT_CAP09_S6_DATABASE_URL", "DATABASE_URL", "INSERT INTO", "UPDATE facts", "DELETE FROM facts", "workflow_dispatch:", "curl ", "fetch(", "aws s3"]) {
    if (capabilityText.includes(marker)) throw new Error(`T3R1_WHOLE_WINDOW_SCAN_SIDE_EFFECT_CAPABILITY_FORBIDDEN:${marker}`);
  }

  const result = {
    schema_version: "geox_mcft_cap09_t3r1_successor_whole_window_scan_gate_result_v2",
    status: "PASS",
    subject_sha: subject,
    base_sha: base,
    changed_files: changed,
    legal_candidate_count_after_activation: scan.legal_candidate_count_after_activation,
    earliest_legal_candidate_if_selected_at_activation: scan.earliest_legal_candidate_if_selected_at_activation,
    latest_complete_current_season_candidate: scan.latest_complete_current_season_candidate,
    current_season_successor_window_exists: true,
    successor_epoch_selected: false,
    database_write_count: 0,
    r2_write_count: 0,
    scheduler_write_count: 0,
    canonical_runtime_write_count: 0,
    ea5e3_authorized: false,
    formal_window_started: false,
  };
  fs.mkdirSync("acceptance-output", { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
}

main();
