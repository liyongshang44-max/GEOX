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
eq(base, "9e9f358bc57799c7ec1a29d177076b7256bf163f", "AMENDMENT10_EXACT_BASE_REQUIRED");

const amendmentPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-10-P0306-BOUNDED-THERMAL-PROXY-AUTHORITY.md";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AMENDMENT_10_P0306_BOUNDED_THERMAL_PROXY_AUTHORITY.cjs";
const workflowPath = ".github/workflows/mcft-cap-09-amendment-10-p0306-bounded-thermal-proxy-authority.yml";

const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(
  JSON.stringify(changed),
  JSON.stringify([amendmentPath, gatePath, workflowPath].sort()),
  "AMENDMENT10_EXACT_THREE_FILE_BOUNDARY_REQUIRED",
);

const predecessorPins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-09-CROP-CONTEXT-SEASON-ARCHITECTURE-ADJUDICATION-AUTHORITY.md": "422f60257039e0f674171c218a7ff0a2fd7dc1b2",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-CURRENT-SEASON-CONTEMPORANEOUS-PHENOLOGY-QUALIFICATION-V1.json": "0e1f809c4bf63b09f4e44431ce507e3b74a966af",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-P0306Q-THERMAL-THRESHOLD-AUTHORITY-V1.json": "a4be8bea8fd31f2d451bd49b24da67a2ec3210df",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION-V1.json": "0e5752ff903663037b6399d68aca1290b2828e7f",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-P0306-GENETIC-BACKGROUND-THERMAL-EQUIVALENCE-ADJUDICATION-V1.json": "fdcac3109d2a17a1a4f5593fd690552c4b9e93b0"
};
for (const [filePath, expectedSha] of Object.entries(predecessorPins)) {
  eq(blob(base, filePath), expectedSha, `AMENDMENT10_BASE_PIN:${filePath}`);
  eq(blob("HEAD", filePath), expectedSha, `AMENDMENT10_PREDECESSOR_MUTATED:${filePath}`);
}

const thermal = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-P0306Q-THERMAL-THRESHOLD-AUTHORITY-V1.json");
eq(thermal.formal_scope.hybrid_product_code, "P0306Q", "AMENDMENT10_TARGET_HYBRID_DRIFT");
eq(thermal.formal_scope.relative_maturity_days, 103, "AMENDMENT10_TARGET_RM_DRIFT");
eq(thermal.qualification_contract.sibling_or_related_product_point_threshold_transfer_authorized, false, "AMENDMENT10_POINT_TRANSFER_PREDECESSOR_MUST_REMAIN_FALSE");
eq(thermal.qualification_contract.allowed_ea9a_terminal_result, "CURRENT_SEASON_PHENOLOGY_AUTHORITY_NOT_ESTABLISHED", "AMENDMENT10_HISTORICAL_TERMINAL_CONTRACT_DRIFT");

const ea9b = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION-V1.json");
eq(ea9b.authority_predecessors.ea9a_terminal_exact_head_proof.terminal_result, "CURRENT_SEASON_PHENOLOGY_AUTHORITY_NOT_ESTABLISHED", "AMENDMENT10_HISTORICAL_EA9A_TERMINAL_REQUIRED");
eq(ea9b.successor_policy.on_no_candidate, "S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION", "AMENDMENT10_EA9B_TIME_GATE_REQUIRED");
eq(ea9b.authority_effect.current_season_2026_recovery_reopened, false, "AMENDMENT10_PREDECESSOR_CURRENT_SEASON_MUST_REMAIN_CLOSED");
eq(ea9b.authority_effect.formal_execution_count, "0/24", "AMENDMENT10_PREDECESSOR_FORMAL_DRIFT");

const adjudication = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-P0306-GENETIC-BACKGROUND-THERMAL-EQUIVALENCE-ADJUDICATION-V1.json");
eq(adjudication.formal_scope_anchor.hybrid_product_code, "P0306Q", "AMENDMENT10_EVIDENCE_TARGET_DRIFT");
eq(adjudication.formal_scope_anchor.relative_maturity_days, 103, "AMENDMENT10_EVIDENCE_RM_DRIFT");
eq(adjudication.evidence_interpretation_policy.secondary_p0306am_gdu_values_may_become_p0306q_point_thresholds, false, "AMENDMENT10_SECONDARY_POINT_TRANSFER_MUST_REMAIN_FALSE");
eq(adjudication.evidence_interpretation_policy.canadian_heat_units_may_be_converted_to_base50_gdu, false, "AMENDMENT10_CHU_CONVERSION_MUST_REMAIN_FALSE");
eq(adjudication.evidence_interpretation_policy.base50_daily_gdu_theoretical_max, 36, "AMENDMENT10_BASE50_DAILY_MAX_DRIFT");
eq(adjudication.evidence_interpretation_policy.three_day_base50_gdu_theoretical_max, 108, "AMENDMENT10_THREE_DAY_BOUND_DRIFT");
eq(adjudication.expected_evidence_facts_if_sources_match.p0306am_secondary_gdu_to_silk, 1330, "AMENDMENT10_SECONDARY_SILK_CENTER_DRIFT");
eq(adjudication.expected_evidence_facts_if_sources_match.p0306am_secondary_gdu_to_physiological_maturity, 2500, "AMENDMENT10_SECONDARY_PHYS_CENTER_DRIFT");
eq(adjudication.expected_evidence_facts_if_sources_match.p0306am_canadian_heat_units, 3100, "AMENDMENT10_AM_CHU_DRIFT");
eq(adjudication.expected_evidence_facts_if_sources_match.p0306amxt_canadian_heat_units, 3125, "AMENDMENT10_AMXT_CHU_DRIFT");
eq(adjudication.expected_evidence_facts_if_sources_match.canadian_heat_unit_difference, 25, "AMENDMENT10_CHU_DELTA_DRIFT");
eq(adjudication.decision_policy.successor_if_supported, "S6-AMENDMENT-10-P0306-BOUNDED-THERMAL-TRANSFER-AUTHORITY", "AMENDMENT10_PREDECESSOR_SUCCESSOR_DRIFT");

const amendment = read(amendmentPath);
for (const marker of [
  "Status: **CANDIDATE — NOT EFFECTIVE UNTIL EXACT-HEAD PROOF AND PROTECTED-MAIN MERGE**",
  "P0306_BOUNDED_THERMAL_TRANSFER_POLICY_ADJUDICATION_SUPPORTED",
  "related_product_point_threshold_transfer_authorized = false",
  "exact_p0306q_product_specific_threshold_authority_established = false",
  "ASSUMED_P0306Q_BOUNDED_THERMAL_PROXY_V1",
  "candidate GDU to silk center = `1330`",
  "candidate GDU to physiological maturity center = `2500`",
  "proxy_timing_uncertainty_days = ±3",
  "maximum_base50_gdu_per_day = 36",
  "proxy_threshold_uncertainty_gdu = ±108",
  "silk proxy interval: `[1222, 1438] GDU`",
  "physiological-maturity proxy interval: `[2392, 2608] GDU`",
  "ASSUMED_BOUNDED_PROXY",
  "S6-EA9A-P0306Q-BOUNDED-GDD-STAGE-QUALIFICATION",
  "T-6h ... T+30h",
  "must not equate silking directly with an FAO water-use-stage boundary",
  "must not equate",
  "S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION",
  "database_write_authorized = false",
  "formal_evidence_write_authorized = false",
  "runtime_config_persistence_authorized = false",
  "scheduler_write_authorized = false",
  "canonical_runtime_write_authorized = false",
  "successor_epoch_selected = false",
  "EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false",
  "EA5E3 = false",
  "Formal execution = 0/24",
  "MCFT-CAP-09 completed = false",
  "P0306_BOUNDED_THERMAL_PROXY_QUALIFICATION_AUTHORIZED = true",
  "P0306_POINT_THRESHOLD_TRANSFER_AUTHORIZED = false",
  "CURRENT_SEASON_STAGE_AUTHORITY_ESTABLISHED = false"
]) has(amendment, marker, "AMENDMENT10_REQUIRED_RULING_MISSING");

for (const forbidden of [
  "P0306Q GDU-to-silk = 1330` is authorized",
  "P0306Q GDU-to-physiological-maturity = 2500` is authorized",
  "related_product_point_threshold_transfer_authorized = true",
  "exact_p0306q_product_specific_threshold_authority_established = true",
  "CURRENT_SEASON_STAGE_AUTHORITY_ESTABLISHED = true",
  "database_write_authorized = true",
  "formal_evidence_write_authorized = true",
  "runtime_config_persistence_authorized = true",
  "scheduler_write_authorized = true",
  "canonical_runtime_write_authorized = true",
  "successor_epoch_selected = true",
  "EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = true",
  "EA5E3 = true",
  "Formal execution = 1/24",
  "MCFT-CAP-09 completed = true"
]) lacks(amendment, forbidden, "AMENDMENT10_PREMATURE_OR_FORBIDDEN_CLAIM");

const workflow = read(workflowPath);
for (const marker of [
  "Resolve exact Amendment-10 base",
  "ACCEPTANCE_MCFT_CAP_09_AMENDMENT_10_P0306_BOUNDED_THERMAL_PROXY_AUTHORITY.cjs",
  "Upload immutable Amendment-10 proof artifact"
]) has(workflow, marker, "AMENDMENT10_WORKFLOW_PROOF_STEP_MISSING");
for (const forbidden of [
  "pull_request_target",
  "workflow_dispatch:",
  "schedule:",
  "GEOX_MCFT_CAP09_S6_DATABASE_URL",
  "FORMAL_DATABASE_URL",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY"
]) lacks(workflow, forbidden, "AMENDMENT10_WORKFLOW_SIDE_EFFECT_CAPABILITY_FORBIDDEN");

fs.mkdirSync("acceptance-output", { recursive: true });
const result = {
  schema_version: "geox_mcft_cap09_amendment_10_p0306_bounded_thermal_proxy_governance_result_v1",
  status: "PASS",
  base_main_sha: base,
  subject_head_sha: git("rev-parse", "HEAD"),
  exact_changed_file_count: changed.length,
  predecessor_blobs_verified_unchanged: true,
  historical_ea9a_terminal_result_preserved: true,
  ea9b_time_gated_path_preserved: true,
  evidence_adjudication_supported_proof_pinned: true,
  exact_p0306q_point_threshold_authority_established: false,
  related_product_point_threshold_transfer_authorized: false,
  bounded_proxy_qualification_authorized_if_merged: true,
  proxy_class: "ASSUMED_BOUNDED_PROXY",
  silk_proxy_interval_gdu: [1222, 1438],
  physiological_maturity_proxy_interval_gdu: [2392, 2608],
  current_season_stage_authority_established: false,
  database_write_authorized: false,
  formal_evidence_write_authorized: false,
  raw_object_write_authorized: false,
  runtime_config_persistence_authorized: false,
  scheduler_write_authorized: false,
  canonical_runtime_write_authorized: false,
  successor_epoch_selected: false,
  ea5e2_operational_activation_qualified: false,
  ea5e3_effective: false,
  formal_execution_count: "0/24",
  mcft_cap09_completed: false,
  next_bounded_successor: "S6-EA9A-P0306Q-BOUNDED-GDD-STAGE-QUALIFICATION",
  fallback_successor: "S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION",
  parallel_operational_successor: "S6-EA5E2-OPERATIONAL-ACTIVATION-QUALIFICATION-UNDER-AMENDMENT-08"
};
fs.writeFileSync(
  "acceptance-output/MCFT_CAP_09_AMENDMENT_10_P0306_BOUNDED_THERMAL_PROXY_GOVERNANCE_RESULT.json",
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(JSON.stringify(result, null, 2));
