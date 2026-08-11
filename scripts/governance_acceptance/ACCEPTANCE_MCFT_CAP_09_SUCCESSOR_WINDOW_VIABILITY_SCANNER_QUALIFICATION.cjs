#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const BASE = "6ae90765b1ec90f96d9f07895d4570bfa53382e0";
const OUT = "acceptance-output/MCFT_CAP_09_SUCCESSOR_WINDOW_VIABILITY_SCANNER_QUALIFICATION_RESULT.json";
const P = {
  scanner: "apps/server/src/domain/twin_runtime/external_formal_successor_window_viability_scanner_v1.ts",
  acceptance: "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_SUCCESSOR_WINDOW_VIABILITY_SCANNER.ts",
  authority: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-SUCCESSOR-WINDOW-VIABILITY-SCANNER-QUALIFICATION-V1.json",
  gate: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_SUCCESSOR_WINDOW_VIABILITY_SCANNER_QUALIFICATION.cjs",
  workflow: ".github/workflows/mcft-cap-09-successor-window-viability-scanner-qualification.yml",
};

function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function read(file) { return fs.readFileSync(file, "utf8"); }
function blob(ref, file) { return git("rev-parse", `${ref}:${file}`); }
function eq(a, b, code) { if (a !== b) throw new Error(`${code}: expected=${JSON.stringify(b)} actual=${JSON.stringify(a)}`); }
function yes(v, code) { eq(v, true, code); }
function no(v, code) { eq(v, false, code); }
function has(text, marker, code) { if (!text.includes(marker)) throw new Error(`${code}:${marker}`); }
function lacks(text, marker, code) { if (text.includes(marker)) throw new Error(`${code}:${marker}`); }
function result(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value));
}

function main() {
  const base = process.env.MCFT_BASE_SHA;
  eq(base, BASE, "SUCCESSOR_SCAN_EXACT_BASE_REQUIRED");
  const subject = git("rev-parse", "HEAD");
  const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  eq(JSON.stringify(changed), JSON.stringify(Object.values(P).sort()), "SUCCESSOR_SCAN_EXACT_FIVE_FILE_BOUNDARY_REQUIRED");

  const immutable = {
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md": "39f6a09273c30088a7ea264cfa94ff930ea5518e",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md": "e59e11e909bfd0a38c7298c5a6f909a6cd7afa49",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-08-IMPLEMENTATION-ACTIVATION-QUALIFICATION-SEPARATION-AUTHORITY.md": "ef1e4344e5915e2c591cf7cfc9b6c2bf27f8bc3b",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json": "b5de9d29189cb654444b3f57d00df290eefe16d3",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-POST-ACTIVATION-READINESS-AUDIT-V1.json": "df8b60cdcd21ad6b92665d8fc92e45f95836cffe",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EXTERNAL-FORMAL-V3-PERSISTENT-TICK-IMPLEMENTATION-QUALIFICATION-V1.json": "961294d5ac9b37d9f8147260a4606e1a9f2ffaef"
  };
  for (const [file, sha] of Object.entries(immutable)) {
    eq(blob(base, file), sha, `SUCCESSOR_SCAN_BASE_PIN:${file}`);
    eq(blob("HEAD", file), sha, `SUCCESSOR_SCAN_PREDECESSOR_MUTATED:${file}`);
  }
  eq(blob("HEAD", P.scanner), "0e64081316d79e7e24015c1da1b99a56de58f99d", "SUCCESSOR_SCAN_SCANNER_BLOB_REQUIRED");
  eq(blob("HEAD", P.acceptance), "5c9658fdbac28a18871158350124465303d50f22", "SUCCESSOR_SCAN_ACCEPTANCE_BLOB_REQUIRED");
  eq(blob("HEAD", P.authority), "9f079fb3555360979daef79fe92cb1f5c1496669", "SUCCESSOR_SCAN_AUTHORITY_BLOB_REQUIRED");

  const a = JSON.parse(read(P.authority));
  eq(a.schema_version, "geox_mcft_cap09_successor_window_viability_scanner_qualification_v1", "SUCCESSOR_SCAN_SCHEMA_REQUIRED");
  eq(a.base_protected_main_sha, base, "SUCCESSOR_SCAN_BASE_BINDING_REQUIRED");
  eq(a.qualification_boundary.exact_changed_file_count, 5, "SUCCESSOR_SCAN_FIVE_FILE_AUTHORITY_REQUIRED");
  eq(a.qualification_boundary.runtime_service_source_change_count, 0, "SUCCESSOR_SCAN_RUNTIME_SOURCE_CHANGE_FORBIDDEN");
  eq(a.qualification_boundary.operational_activation_critical_boundary_change_count, 0, "SUCCESSOR_SCAN_ACTIVATION_BOUNDARY_CHANGE_FORBIDDEN");
  yes(a.frozen_crop_inputs.all_six_fao_variants_required, "SUCCESSOR_SCAN_SIX_VARIANTS_REQUIRED");
  yes(a.frozen_crop_inputs.all_possible_planting_times_required, "SUCCESSOR_SCAN_PLANTING_UNCERTAINTY_REQUIRED");
  no(a.frozen_crop_inputs.future_observations_authorized, "SUCCESSOR_SCAN_FUTURE_OBSERVATIONS_FORBIDDEN");
  eq(a.successor_epoch_constraints.minimum_lead_hours, 36, "SUCCESSOR_SCAN_36H_LEAD_REQUIRED");
  no(a.successor_epoch_constraints.epoch_selection_before_operational_activation_effective_authorized, "SUCCESSOR_SCAN_PRE_ACTIVATION_SELECTION_FORBIDDEN");
  eq(a.amendment_08_effectiveness_evidence.merge_sha, "f150b18a2ab9691fec64eaecb00105911857994c", "SUCCESSOR_SCAN_A08_MERGE_SHA_REQUIRED");
  eq(a.amendment_08_effectiveness_evidence.merged_at, "2026-08-11T02:33:13.000Z", "SUCCESSOR_SCAN_A08_MERGED_AT_REQUIRED");
  const e = a.deterministic_expected_scan;
  eq(e.viable_window_count, 1191, "SUCCESSOR_SCAN_WINDOW_COUNT_REQUIRED");
  eq(e.viable_window_ranges.length, 3, "SUCCESSOR_SCAN_RANGE_COUNT_REQUIRED");
  no(e.late_stage_complete_window_exists, "SUCCESSOR_SCAN_LATE_STAGE_WINDOW_FORBIDDEN");
  eq(e.latest_complete_current_season_o00, "2026-08-11T22:00:00.000Z", "SUCCESSOR_SCAN_LATEST_O00_REQUIRED");
  eq(e.latest_complete_current_season_o23, "2026-08-12T21:00:00.000Z", "SUCCESSOR_SCAN_LATEST_O23_REQUIRED");
  eq(e.latest_successor_selection_authority_effective_at_under_36h_lead, "2026-08-10T10:00:00.000Z", "SUCCESSOR_SCAN_LATEST_SELECTION_TIME_REQUIRED");
  eq(e.amendment_08_missed_latest_selection_deadline_by_seconds, 59593, "SUCCESSOR_SCAN_A08_MISSED_BY_REQUIRED");
  eq(e.disposition, "NO_CURRENT_SEASON_SUCCESSOR_EPOCH", "SUCCESSOR_SCAN_DISPOSITION_REQUIRED");
  no(a.proof_consequence.current_season_successor_epoch_eligible, "SUCCESSOR_SCAN_CURRENT_SEASON_ELIGIBILITY_FORBIDDEN");
  no(a.proof_consequence.kbs_recovery_can_rescue_current_season_formal, "SUCCESSOR_SCAN_KBS_RESCUE_FORBIDDEN");
  yes(a.proof_consequence.kbs_recovery_remains_useful_for_operational_activation_qualification, "SUCCESSOR_SCAN_KBS_ACTIVATION_USE_REQUIRED");
  no(a.proof_consequence.operational_activation_may_be_skipped, "SUCCESSOR_SCAN_ACTIVATION_SKIP_FORBIDDEN");
  no(a.proof_consequence.mid_stage_may_be_extended_or_fabricated, "SUCCESSOR_SCAN_STAGE_EXTENSION_FORBIDDEN");

  const scanner = read(P.scanner);
  for (const marker of [
    "NO_CURRENT_SEASON_SUCCESSOR_EPOCH",
    "backward_stability_hours",
    "forward_transition_guard_hours",
    "minimum_lead_hours",
    "variant_stage_lengths_days",
    "allowed_stage_codes",
    "slot_count: 24",
    "slot_interval_hours: 1",
    "future_observations_used: false"
  ]) has(scanner, marker, "SUCCESSOR_SCAN_IMPLEMENTATION_RULE_MISSING");
  for (const forbidden of ["Date.now(", "new Date()", "process.env", "node:fs", "fetch(", "axios", "INSERT INTO", "UPDATE ", "DELETE FROM"])
    lacks(scanner, forbidden, "SUCCESSOR_SCAN_SIDE_EFFECT_OR_WALL_CLOCK_FORBIDDEN");

  const acceptance = read(P.acceptance);
  for (const marker of [
    "2026-08-11T22:00:00.000Z",
    "2026-08-12T21:00:00.000Z",
    "2026-08-10T10:00:00.000Z",
    "2026-08-11T02:33:13.000Z",
    "59593",
    "NO_CURRENT_SEASON_SUCCESSOR_EPOCH",
    "CURRENT_SEASON_SUCCESSOR_EPOCH_POSSIBLE"
  ]) has(acceptance, marker, "SUCCESSOR_SCAN_ACCEPTANCE_RULE_MISSING");

  for (const [key, value] of Object.entries(a.side_effect_boundary)) {
    if (key.endsWith("_write_count") || key === "provider_request_count") eq(value, 0, `SUCCESSOR_SCAN_ZERO_SIDE_EFFECT:${key}`);
  }
  no(a.side_effect_boundary.operational_activation_qualified, "SUCCESSOR_SCAN_PREMATURE_ACTIVATION_FORBIDDEN");
  no(a.side_effect_boundary.successor_epoch_selected, "SUCCESSOR_SCAN_PREMATURE_EPOCH_FORBIDDEN");
  no(a.side_effect_boundary.new_crop_context_authority_created, "SUCCESSOR_SCAN_NEW_CROP_AUTHORITY_FORBIDDEN");
  no(a.side_effect_boundary.new_season_authority_created, "SUCCESSOR_SCAN_NEW_SEASON_AUTHORITY_FORBIDDEN");
  no(a.side_effect_boundary.ea5e3_authorized, "SUCCESSOR_SCAN_PREMATURE_EA5E3_FORBIDDEN");
  no(a.side_effect_boundary.formal_window_started, "SUCCESSOR_SCAN_PREMATURE_O00_FORBIDDEN");
  yes(a.effect_if_exact_head_qualification_passes_and_candidate_merges.no_current_season_successor_epoch_proved, "SUCCESSOR_SCAN_PROOF_EFFECT_REQUIRED");
  yes(a.effect_if_exact_head_qualification_passes_and_candidate_merges.current_season_formal_path_fail_closed, "SUCCESSOR_SCAN_FAIL_CLOSED_EFFECT_REQUIRED");

  const workflow = read(P.workflow);
  has(workflow, "ACCEPTANCE_MCFT_CAP_09_SUCCESSOR_WINDOW_VIABILITY_SCANNER.ts", "SUCCESSOR_SCAN_FOCUSED_ACCEPTANCE_REQUIRED");
  has(workflow, "ACCEPTANCE_MCFT_CAP_09_SUCCESSOR_WINDOW_VIABILITY_SCANNER_QUALIFICATION.cjs", "SUCCESSOR_SCAN_FOCUSED_GATE_REQUIRED");
  lacks(workflow, "workflow_dispatch:", "SUCCESSOR_SCAN_MANUAL_TRIGGER_FORBIDDEN");
  lacks(workflow, "GEOX_MCFT_CAP09_S6_DATABASE_URL", "SUCCESSOR_SCAN_FORMAL_SECRET_FORBIDDEN");

  result({
    schema_version: "geox_mcft_cap09_successor_window_viability_scanner_qualification_result_v1",
    status: "PASS",
    base_sha: base,
    subject_sha: subject,
    exact_changed_file_count: changed.length,
    exact_boundary: "FIVE_FILES",
    successor_window_viability_scanner_implementation_qualified: true,
    no_current_season_successor_epoch_proved: true,
    latest_complete_current_season_o00: e.latest_complete_current_season_o00,
    latest_complete_current_season_o23: e.latest_complete_current_season_o23,
    latest_successor_selection_authority_effective_at: e.latest_successor_selection_authority_effective_at_under_36h_lead,
    amendment_08_effective_at: e.amendment_08_effective_at,
    amendment_08_missed_latest_selection_deadline_by_seconds: e.amendment_08_missed_latest_selection_deadline_by_seconds,
    disposition: e.disposition,
    operational_activation_qualified: false,
    successor_epoch_selected: false,
    ea5e3_authorized: false,
    formal_window_started: false,
    database_write_count: 0,
    provider_request_count: 0,
    next_legal_formal_planning_frontier: a.next_legal_formal_planning_frontier
  });
}

try { main(); }
catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  let subject = null;
  try { subject = git("rev-parse", "HEAD"); } catch {}
  result({
    schema_version: "geox_mcft_cap09_successor_window_viability_scanner_qualification_result_v1",
    status: "FAIL",
    base_sha: process.env.MCFT_BASE_SHA ?? null,
    subject_sha: subject,
    error: message,
    fail_closed: true,
    operational_activation_qualified: false,
    successor_epoch_selected: false,
    ea5e3_authorized: false,
    formal_window_started: false,
    database_write_count: 0,
    provider_request_count: 0
  });
  process.exitCode = 1;
}
