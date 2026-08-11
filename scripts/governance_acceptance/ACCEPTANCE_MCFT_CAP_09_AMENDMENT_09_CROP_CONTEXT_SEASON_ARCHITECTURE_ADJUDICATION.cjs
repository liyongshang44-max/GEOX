#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const fail = (message) => { throw new Error(message); };
const eq = (actual, expected, code) => {
  if (actual !== expected) fail(`${code}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
};
const has = (text, marker, code) => {
  if (!text.includes(marker)) fail(`${code}:${marker}`);
};
const lacks = (text, marker, code) => {
  if (text.includes(marker)) fail(`${code}:${marker}`);
};
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const blob = (ref, filePath) => git("rev-parse", `${ref}:${filePath}`);
const read = (filePath) => fs.readFileSync(filePath, "utf8");
const json = (filePath) => JSON.parse(read(filePath));

const base = process.env.MCFT_BASE_SHA;
eq(base, "f753f2bdaa68f64de623dd1b0a0e7da65d0f1eef", "AMENDMENT09_EXACT_BASE_REQUIRED");

const amendmentPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-09-CROP-CONTEXT-SEASON-ARCHITECTURE-ADJUDICATION-AUTHORITY.md";
const workflowPath = ".github/workflows/mcft-cap-09-amendment-09-crop-context-season-architecture-adjudication.yml";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AMENDMENT_09_CROP_CONTEXT_SEASON_ARCHITECTURE_ADJUDICATION.cjs";

const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(
  JSON.stringify(changed),
  JSON.stringify([amendmentPath, workflowPath, gatePath].sort()),
  "AMENDMENT09_EXACT_THREE_FILE_BOUNDARY_REQUIRED",
);

const predecessorPins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md": "39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md": "41270b888e15e4d9a6c9a34e1fa3f70e957a275e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md": "7a92c17f7ba32aae52667de9c21db62bfd2ba70b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md": "e59e11e909bfd0a38c7298c5a6f909a6cd7afa49",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-07-EXTERNAL-FORMAL-FIXED-LAG-CAUSALITY-AUTHORITY.md": "c5a98ca789027e1bf051ec56bf1b7e76b98a0891",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-08-IMPLEMENTATION-ACTIVATION-QUALIFICATION-SEPARATION-AUTHORITY.md": "ef1e4344e5915e2c591cf7cfc9b6c2bf27f8bc3b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1J-CROP-WATER-USE-STAGE-AUTHORITY-V1.json": "eeb7ab49ee3270421efe4d6674305426074d1541",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json": "b5de9d29189cb654444b3f57d00df290eefe16d3",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-SUCCESSOR-WHOLE-WINDOW-VIABILITY-SCANNER-QUALIFICATION-V1.json": "4c6b4bc417d957eb381a7a41deb44436acf909c8"
};
for (const [filePath, expectedSha] of Object.entries(predecessorPins)) {
  eq(blob(base, filePath), expectedSha, `AMENDMENT09_BASE_PIN:${filePath}`);
  eq(blob("HEAD", filePath), expectedSha, `AMENDMENT09_PREDECESSOR_MUTATED:${filePath}`);
}

const crop = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json");
eq(crop.scope.site_id, "KBS_MCSE_T1R1", "AMENDMENT09_SITE_AUTHORITY_DRIFT");
eq(crop.scope.field_id, "field_kbs_mcse_t1r1", "AMENDMENT09_FIELD_AUTHORITY_DRIFT");
eq(crop.scope.season_id, "season_2026_corn", "AMENDMENT09_SEASON_AUTHORITY_DRIFT");
eq(crop.scope.crop, "corn", "AMENDMENT09_CROP_AUTHORITY_DRIFT");
eq(crop.scope.observed_biological_stage_claimed, false, "AMENDMENT09_OBSERVED_STAGE_MUST_REMAIN_UNCLAIMED");
eq(crop.scope.v_or_r_stage_truth_claimed, false, "AMENDMENT09_VR_STAGE_TRUTH_MUST_REMAIN_UNCLAIMED");
eq(crop.planting_authority.possible_event_window_utc.start_inclusive, "2026-05-11T04:00:00.000Z", "AMENDMENT09_PLANTING_WINDOW_START_DRIFT");
eq(crop.planting_authority.possible_event_window_utc.end_exclusive, "2026-05-12T04:00:00.000Z", "AMENDMENT09_PLANTING_WINDOW_END_DRIFT");
eq(crop.as_of_derivation_policy.future_observations_authorized, false, "AMENDMENT09_FUTURE_OBSERVATIONS_MUST_REMAIN_FORBIDDEN");
eq(crop.as_of_derivation_policy.future_phenocam_observations_authorized, false, "AMENDMENT09_FUTURE_PHENOCAM_MUST_REMAIN_FORBIDDEN");
eq(crop.as_of_derivation_policy.full_season_ex_post_normalization_authorized, false, "AMENDMENT09_EX_POST_NORMALIZATION_MUST_REMAIN_FORBIDDEN");
eq(crop.as_of_derivation_policy.backward_stability_hours, 6, "AMENDMENT09_BACKWARD_STABILITY_MUST_REMAIN_SIX_HOURS");
eq(crop.as_of_derivation_policy.forward_transition_guard_hours, 30, "AMENDMENT09_FORWARD_GUARD_MUST_REMAIN_THIRTY_HOURS");

const ea1j = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1J-CROP-WATER-USE-STAGE-AUTHORITY-V1.json");
eq(ea1j.scope_candidate.field_phenology_observation_claimed, false, "AMENDMENT09_FIELD_PHENOLOGY_MUST_REMAIN_UNCLAIMED");
eq(ea1j.gdd_policy.stage_determinative, false, "AMENDMENT09_GDD_MUST_NOT_SILENTLY_BECOME_STAGE_DETERMINATIVE");
eq(ea1j.gdd_policy.silent_hybrid_or_relative_maturity_assumption_forbidden, true, "AMENDMENT09_SILENT_HYBRID_ASSUMPTION_MUST_REMAIN_FORBIDDEN");

const scanner = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-SUCCESSOR-WHOLE-WINDOW-VIABILITY-SCANNER-QUALIFICATION-V1.json");
eq(scanner.independent_expected_result.result, "NO_CURRENT_SEASON_SUCCESSOR_EPOCH", "AMENDMENT09_SCANNER_FAIL_CLOSED_RESULT_REQUIRED");
eq(scanner.independent_expected_result.latest_complete_current_season_o00, "2026-08-11T22:00:00.000Z", "AMENDMENT09_LATEST_CURRENT_SEASON_O00_DRIFT");
eq(scanner.independent_expected_result.latest_complete_current_season_o23, "2026-08-12T21:00:00.000Z", "AMENDMENT09_LATEST_CURRENT_SEASON_O23_DRIFT");
eq(scanner.authority_effect.operational_activation_qualified, false, "AMENDMENT09_OPERATIONAL_ACTIVATION_MUST_REMAIN_FALSE");
eq(scanner.authority_effect.successor_epoch_selected, false, "AMENDMENT09_SUCCESSOR_EPOCH_MUST_REMAIN_UNSELECTED");

const amendment01 = read("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md");
for (const marker of [
  "FORMAL_DERIVED_CROP_WATER_USE_STAGE_CONTEXT_V1",
  "Inputs may include PhenoCam GCC available as-of the authority time, GDD",
  "future PhenoCam observations = FORBIDDEN",
  "full-season ex-post normalization = FORBIDDEN",
  "ASSUMED_STAGE_TRANSITION_GUARD"
]) has(amendment01, marker, "AMENDMENT09_AMENDMENT01_CROP_RULE_MISSING");

const amendment08 = read("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-08-IMPLEMENTATION-ACTIVATION-QUALIFICATION-SEPARATION-AUTHORITY.md");
for (const marker of [
  "Operational Activation Qualification PASS on protected main",
  "whole-window crop-context viability scan",
  "NO_CURRENT_SEASON_SUCCESSOR_EPOCH",
  "separate crop-context / season architecture adjudication"
]) has(amendment08, marker, "AMENDMENT09_AMENDMENT08_ORDERING_RULE_MISSING");

const amendment = read(amendmentPath);
for (const marker of [
  "S6-CROP-CONTEXT-SEASON-ARCHITECTURE-ADJUDICATION-UNDER-AMENDMENT-08",
  "CURRENT_SEASON_CONTEMPORANEOUS_STAGE_AUTHORITY_ESTABLISHED",
  "CURRENT_SEASON_PHENOLOGY_AUTHORITY_NOT_ESTABLISHED",
  "S6-EA9A-CURRENT-SEASON-CONTEMPORANEOUS-PHENOLOGY-QUALIFICATION",
  "S6-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION",
  "stage_determinative = false",
  "T - 6h ... T + 30h",
  "STAGE_TRANSITION_RISK",
  "CROP_WATER_USE_STAGE_NO_CONSERVATIVE_CONSENSUS",
  "CURRENT_SEASON_SUCCESSOR_WINDOW_AVAILABLE",
  "NO_CURRENT_SEASON_SUCCESSOR_EPOCH",
  "EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = true",
  "new natural season must establish at minimum",
  "cross-season State/Forecast/Checkpoint/lineage stitching",
  "current_season_stage_extended = false",
  "current_season_late_stage_created = false",
  "successor_epoch_selected = false",
  "EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false",
  "EA5E3 = false",
  "Formal execution = 0/24"
]) has(amendment, marker, "AMENDMENT09_REQUIRED_RULING_MISSING");

for (const forbidden of [
  "current_season_stage_extended = true",
  "current_season_late_stage_created = true",
  "successor_epoch_selected = true",
  "runtime_config_persistence_authorized = true",
  "formal_database_write_authorized = true",
  "formal_raw_object_write_authorized = true",
  "scheduler_write_authorized = true",
  "canonical_runtime_write_authorized = true",
  "EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = true\nEA5E3 = true",
  "MCFT-CAP-09 completed = true"
]) lacks(amendment, forbidden, "AMENDMENT09_PREMATURE_OR_FORBIDDEN_CLAIM");

const workflow = read(workflowPath);
for (const marker of [
  "Resolve exact Amendment-09 base",
  "ACCEPTANCE_MCFT_CAP_09_AMENDMENT_09_CROP_CONTEXT_SEASON_ARCHITECTURE_ADJUDICATION.cjs",
  "Upload immutable Amendment-09 proof artifact"
]) has(workflow, marker, "AMENDMENT09_WORKFLOW_PROOF_STEP_MISSING");
for (const forbidden of [
  "pull_request_target",
  "workflow_dispatch:",
  "schedule:",
  "GEOX_MCFT_CAP09_S6_DATABASE_URL",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY"
]) lacks(workflow, forbidden, "AMENDMENT09_WORKFLOW_SIDE_EFFECT_CAPABILITY_FORBIDDEN");

fs.mkdirSync("acceptance-output", { recursive: true });
const result = {
  schema_version: "geox_mcft_cap09_amendment_09_crop_context_season_architecture_adjudication_governance_result_v1",
  status: "PASS",
  base_main_sha: base,
  subject_head_sha: git("rev-parse", "HEAD"),
  exact_changed_file_count: changed.length,
  predecessor_blobs_verified_unchanged: true,
  current_scope: {
    site_id: crop.scope.site_id,
    field_id: crop.scope.field_id,
    season_id: crop.scope.season_id,
    crop: crop.scope.crop
  },
  current_observed_biological_stage_claimed: crop.scope.observed_biological_stage_claimed,
  current_field_phenology_observation_claimed: ea1j.scope_candidate.field_phenology_observation_claimed,
  gdd_stage_determinative: ea1j.gdd_policy.stage_determinative,
  old_authority_successor_result: scanner.independent_expected_result.result,
  crop_context_season_architecture_adjudicated: true,
  current_season_stage_extended: false,
  current_season_late_stage_created: false,
  current_season_phenology_reproof_authorized: true,
  current_season_phenology_reproof_effective: false,
  new_natural_season_created: false,
  future_observations_authorized: false,
  full_season_ex_post_normalization_authorized: false,
  backward_stability_hours: 6,
  forward_transition_guard_hours: 30,
  successor_epoch_selected: false,
  runtime_config_persistence_authorized: false,
  formal_database_write_authorized: false,
  formal_raw_object_write_authorized: false,
  scheduler_write_authorized: false,
  canonical_runtime_write_authorized: false,
  ea5e2_operational_activation_qualified: false,
  ea5e3_effective: false,
  formal_execution_count: "0/24",
  mcft_cap09_completed: false,
  next_legal_primary_successor: "S6-EA9A-CURRENT-SEASON-CONTEMPORANEOUS-PHENOLOGY-QUALIFICATION",
  fallback_architecture_successor: "S6-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION",
  parallel_operational_successor: "S6-EA5E2-OPERATIONAL-ACTIVATION-QUALIFICATION-UNDER-AMENDMENT-08"
};
fs.writeFileSync(
  "acceptance-output/MCFT_CAP_09_AMENDMENT_09_CROP_CONTEXT_SEASON_ARCHITECTURE_ADJUDICATION_GOVERNANCE_RESULT.json",
  `${JSON.stringify(result, null, 2)}\n`,
);

console.log(JSON.stringify(result, null, 2));
