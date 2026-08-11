#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const fail = (message) => { throw new Error(message); };
const eq = (actual, expected, code) => { if (actual !== expected) fail(`${code}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`); };
const has = (text, marker, code) => { if (!text.includes(marker)) fail(`${code}:${marker}`); };
const lacks = (text, marker, code) => { if (text.includes(marker)) fail(`${code}:${marker}`); };
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const blob = (ref, filePath) => git("rev-parse", `${ref}:${filePath}`);
const read = (filePath) => fs.readFileSync(filePath, "utf8");
const json = (filePath) => JSON.parse(read(filePath));

const base = process.env.MCFT_BASE_SHA;
eq(base, "23304a08fe37ee35258654a2520aa293ce328b2b", "EA9A_MAPPING_EXACT_BASE_REQUIRED");

const configPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-THERMAL-LANDMARK-TO-WATER-USE-STAGE-MAPPING-V1.json";
const probePath = "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA9A_THERMAL_LANDMARK_TO_WATER_USE_STAGE_MAPPING.mjs";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA9A_THERMAL_LANDMARK_TO_WATER_USE_STAGE_MAPPING.cjs";
const workflowPath = ".github/workflows/mcft-cap-09-ea9a-thermal-landmark-to-water-use-stage-mapping.yml";

const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed), JSON.stringify([configPath, probePath, gatePath, workflowPath].sort()), "EA9A_MAPPING_EXACT_FOUR_FILE_BOUNDARY_REQUIRED");

const pins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-09-CROP-CONTEXT-SEASON-ARCHITECTURE-ADJUDICATION-AUTHORITY.md": "422f60257039e0f674171c218a7ff0a2fd7dc1b2",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-10-P0306-BOUNDED-THERMAL-PROXY-AUTHORITY.md": "964efa8acc95bf1aeed692c7662754afd3ac6db5",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1J-CROP-WATER-USE-STAGE-AUTHORITY-V1.json": "eeb7ab49ee3270421efe4d6674305426074d1541"
};
for (const [filePath, expected] of Object.entries(pins)) {
  eq(blob(base, filePath), expected, `EA9A_MAPPING_BASE_PIN:${filePath}`);
  eq(blob("HEAD", filePath), expected, `EA9A_MAPPING_PREDECESSOR_MUTATED:${filePath}`);
}

const cfg = json(configPath);
eq(cfg.base_main_sha, base, "EA9A_MAPPING_CONFIG_BASE_DRIFT");
eq(JSON.stringify(cfg.target_model_stage_codes), JSON.stringify(["INITIAL","DEVELOPMENT","MID","LATE"]), "EA9A_MAPPING_STAGE_CODE_DRIFT");
eq(cfg.mapping_contract.mapping_class, "PARTIAL_SAFE_THERMAL_LANDMARK_TO_MODEL_STAGE_MAPPING", "EA9A_MAPPING_CLASS_DRIFT");
eq(cfg.mapping_contract.full_continuous_gdd_to_four_stage_mapping_claimed, false, "EA9A_MAPPING_FULL_CURVE_CLAIM_FORBIDDEN");
eq(cfg.mapping_contract.silking_point_semantics.safe_model_stage_at_exact_landmark, "MID", "EA9A_MAPPING_R1_POINT_STAGE_DRIFT");
eq(cfg.mapping_contract.silking_point_semantics.post_landmark_stage_persistence_claimed, false, "EA9A_MAPPING_R1_PERSISTENCE_FORBIDDEN");
eq(cfg.mapping_contract.physiological_maturity_point_semantics.safe_model_stage_at_or_after_landmark_before_harvest, "LATE", "EA9A_MAPPING_R6_POINT_STAGE_DRIFT");
eq(cfg.mapping_contract.physiological_maturity_point_semantics.landmark_equals_late_stage_start_claimed, false, "EA9A_MAPPING_R6_EQUALS_LATE_START_FORBIDDEN");
eq(JSON.stringify(cfg.mapping_contract.pre_silking_interval_candidate_stages), JSON.stringify(["INITIAL","DEVELOPMENT","MID"]), "EA9A_MAPPING_PRE_R1_SET_DRIFT");
eq(JSON.stringify(cfg.mapping_contract.post_silking_pre_physiological_maturity_candidate_stages), JSON.stringify(["MID","LATE"]), "EA9A_MAPPING_R1_R6_SET_DRIFT");
eq(JSON.stringify(cfg.mapping_contract.post_physiological_maturity_before_harvest_candidate_stages), JSON.stringify(["LATE"]), "EA9A_MAPPING_POST_R6_SET_DRIFT");
eq(cfg.mapping_contract.silking_threshold_may_be_used_as_mid_late_boundary, false, "EA9A_MAPPING_SILK_BOUNDARY_FORBIDDEN");
eq(cfg.mapping_contract.physiological_maturity_threshold_may_be_used_as_mid_late_boundary, false, "EA9A_MAPPING_R6_BOUNDARY_FORBIDDEN");
eq(cfg.mapping_contract.all_other_thermal_ranges_fail_closed_for_four_stage_determination, true, "EA9A_MAPPING_FAIL_CLOSED_REQUIRED");
eq(JSON.stringify(cfg.bounded_proxy_consumption.silk_interval_gdu), JSON.stringify([1222,1438]), "EA9A_MAPPING_SILK_PROXY_DRIFT");
eq(JSON.stringify(cfg.bounded_proxy_consumption.physiological_maturity_interval_gdu), JSON.stringify([2392,2608]), "EA9A_MAPPING_R6_PROXY_DRIFT");
eq(cfg.bounded_proxy_consumption.epistemic_class, "ASSUMED_BOUNDED_PROXY", "EA9A_MAPPING_EPISTEMIC_CLASS_DRIFT");
eq(cfg.bounded_proxy_consumption.harvest_or_crop_termination_must_be_absent_as_of_authority_time, true, "EA9A_MAPPING_HARVEST_GUARD_REQUIRED");
eq(cfg.decision_policy.on_pass, "S6-EA9A-P0306Q-BOUNDED-GDD-STAGE-QUALIFICATION", "EA9A_MAPPING_PASS_SUCCESSOR_DRIFT");
eq(cfg.decision_policy.on_fail, "S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION", "EA9A_MAPPING_FAIL_SUCCESSOR_DRIFT");

for (const key of [
  "current_season_stage_authority_established",
  "database_write_authorized",
  "formal_evidence_write_authorized",
  "raw_object_write_authorized",
  "runtime_config_write_authorized",
  "scheduler_write_authorized",
  "canonical_runtime_write_authorized",
  "successor_epoch_selected",
  "ea5e2_operational_activation_qualified",
  "ea5e3_effective",
  "mcft_cap09_completed"
]) eq(cfg.authority_effect[key], false, `EA9A_MAPPING_PREMATURE_EFFECT_FORBIDDEN:${key}`);
eq(cfg.authority_effect.formal_execution_count, "0/24", "EA9A_MAPPING_FORMAL_COUNT_DRIFT");

const probe = read(probePath);
for (const marker of [
  "PARTIAL_SAFE_THERMAL_TO_WATER_USE_STAGE_MAPPING_ESTABLISHED",
  "pre_r1_candidate_stages: ['INITIAL', 'DEVELOPMENT', 'MID']",
  "post_r1_pre_r6_candidate_stages: ['MID', 'LATE']",
  "post_r6_before_harvest_candidate_stages: ['LATE']",
  "silking_as_mid_late_boundary: false",
  "physiological_maturity_as_mid_late_boundary: false",
  "full_continuous_gdd_to_four_stage_mapping_established: false",
  "formal_execution_count: '0/24'"
]) has(probe, marker, "EA9A_MAPPING_PROBE_GUARD_MISSING");
for (const forbidden of [
  "GEOX_MCFT_CAP09_S6_DATABASE_URL",
  "FORMAL_DATABASE_URL",
  "@aws-sdk/client-s3",
  "INSERT INTO",
  "UPDATE ",
  "DELETE FROM"
]) lacks(probe, forbidden, "EA9A_MAPPING_PROBE_SIDE_EFFECT_CAPABILITY_FORBIDDEN");

const workflow = read(workflowPath);
for (const marker of [
  "Resolve exact thermal mapping base",
  "ACCEPTANCE_MCFT_CAP_09_EA9A_THERMAL_LANDMARK_TO_WATER_USE_STAGE_MAPPING.cjs",
  "PROBE_MCFT_CAP_09_EA9A_THERMAL_LANDMARK_TO_WATER_USE_STAGE_MAPPING.mjs",
  "Upload immutable thermal mapping proof artifact"
]) has(workflow, marker, "EA9A_MAPPING_WORKFLOW_STEP_MISSING");
for (const forbidden of ["pull_request_target", "workflow_dispatch:", "schedule:", "FORMAL_DATABASE_URL", "GEOX_MCFT_CAP09_S6_DATABASE_URL"]) lacks(workflow, forbidden, "EA9A_MAPPING_WORKFLOW_SIDE_EFFECT_FORBIDDEN");

fs.mkdirSync("acceptance-output", { recursive: true });
const result = {
  schema_version: "geox_mcft_cap09_ea9a_thermal_landmark_to_water_use_stage_mapping_governance_result_v1",
  status: "PASS",
  base_main_sha: base,
  subject_head_sha: git("rev-parse", "HEAD"),
  exact_changed_file_count: changed.length,
  predecessor_blobs_verified_unchanged: true,
  mapping_class: cfg.mapping_contract.mapping_class,
  full_continuous_gdd_to_four_stage_mapping_claimed: false,
  r1_exact_landmark_stage: "MID",
  r6_at_or_after_before_harvest_stage: "LATE",
  r1_to_r6_interval_stage_set: ["MID","LATE"],
  current_season_stage_authority_established: false,
  database_write_authorized: false,
  formal_evidence_write_authorized: false,
  successor_epoch_selected: false,
  ea5e2_operational_activation_qualified: false,
  ea5e3_effective: false,
  formal_execution_count: "0/24",
  mcft_cap09_completed: false
};
fs.writeFileSync("acceptance-output/MCFT_CAP_09_EA9A_THERMAL_LANDMARK_TO_WATER_USE_STAGE_MAPPING_GOVERNANCE_RESULT.json", `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
