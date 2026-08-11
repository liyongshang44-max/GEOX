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
eq(base, "f54fd1c235898041aff50ac342d3ee6ad5a87b00", "EA9A_P0306_EQUIVALENCE_EXACT_BASE_REQUIRED");

const configPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-P0306-GENETIC-BACKGROUND-THERMAL-EQUIVALENCE-ADJUDICATION-V1.json";
const probePath = "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA9A_P0306_GENETIC_BACKGROUND_THERMAL_EQUIVALENCE_ADJUDICATION.mjs";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA9A_P0306_GENETIC_BACKGROUND_THERMAL_EQUIVALENCE_ADJUDICATION.cjs";
const workflowPath = ".github/workflows/mcft-cap-09-ea9a-p0306-genetic-background-thermal-equivalence-adjudication.yml";

const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(
  JSON.stringify(changed),
  JSON.stringify([configPath, probePath, gatePath, workflowPath].sort()),
  "EA9A_P0306_EQUIVALENCE_EXACT_FOUR_FILE_BOUNDARY_REQUIRED",
);

const predecessorPins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-09-CROP-CONTEXT-SEASON-ARCHITECTURE-ADJUDICATION-AUTHORITY.md": "422f60257039e0f674171c218a7ff0a2fd7dc1b2",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-CURRENT-SEASON-CONTEMPORANEOUS-PHENOLOGY-QUALIFICATION-V1.json": "0e1f809c4bf63b09f4e44431ce507e3b74a966af",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-P0306Q-THERMAL-THRESHOLD-AUTHORITY-V1.json": "a4be8bea8fd31f2d451bd49b24da67a2ec3210df",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION-V1.json": "0e5752ff903663037b6399d68aca1290b2828e7f"
};
for (const [filePath, expectedSha] of Object.entries(predecessorPins)) {
  eq(blob(base, filePath), expectedSha, `EA9A_P0306_EQUIVALENCE_BASE_PIN:${filePath}`);
  eq(blob("HEAD", filePath), expectedSha, `EA9A_P0306_EQUIVALENCE_PREDECESSOR_MUTATED:${filePath}`);
}

const thermal = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-P0306Q-THERMAL-THRESHOLD-AUTHORITY-V1.json");
eq(thermal.formal_scope.hybrid_product_code, "P0306Q", "EA9A_P0306_EQUIVALENCE_HYBRID_DRIFT");
eq(thermal.formal_scope.relative_maturity_days, 103, "EA9A_P0306_EQUIVALENCE_RM_DRIFT");
eq(thermal.qualification_contract.sibling_or_related_product_point_threshold_transfer_authorized, false, "EA9A_P0306_EQUIVALENCE_POINT_TRANSFER_MUST_REMAIN_FORBIDDEN");
eq(thermal.qualification_contract.allowed_ea9a_terminal_result, "CURRENT_SEASON_PHENOLOGY_AUTHORITY_NOT_ESTABLISHED", "EA9A_P0306_EQUIVALENCE_TERMINAL_CONTRACT_DRIFT");

const ea9b = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION-V1.json");
eq(ea9b.authority_predecessors.ea9a_terminal_exact_head_proof.terminal_result, "CURRENT_SEASON_PHENOLOGY_AUTHORITY_NOT_ESTABLISHED", "EA9A_P0306_EQUIVALENCE_HISTORICAL_TERMINAL_REQUIRED");
eq(ea9b.authority_predecessors.ea9a_terminal_exact_head_proof.ea9a_terminal_reached, true, "EA9A_P0306_EQUIVALENCE_HISTORICAL_TERMINAL_REACHED_REQUIRED");
eq(ea9b.successor_policy.on_no_candidate, "S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION", "EA9A_P0306_EQUIVALENCE_EA9B_TIME_GATE_REQUIRED");
eq(ea9b.authority_effect.current_season_2026_recovery_reopened, false, "EA9A_P0306_EQUIVALENCE_CURRENT_SEASON_MUST_REMAIN_CLOSED");
eq(ea9b.authority_effect.formal_execution_count, "0/24", "EA9A_P0306_EQUIVALENCE_FORMAL_COUNT_DRIFT");

const cfg = json(configPath);
eq(cfg.base_main_sha, base, "EA9A_P0306_EQUIVALENCE_CONFIG_BASE_DRIFT");
eq(cfg.formal_scope_anchor.hybrid_product_code, "P0306Q", "EA9A_P0306_EQUIVALENCE_CONFIG_HYBRID_DRIFT");
eq(cfg.formal_scope_anchor.relative_maturity_days, 103, "EA9A_P0306_EQUIVALENCE_CONFIG_RM_DRIFT");
eq(cfg.adjudication_contract.historical_ea9a_terminal_result_remains_true, true, "EA9A_P0306_EQUIVALENCE_TERMINAL_HISTORY_MUST_BE_PRESERVED");
eq(cfg.adjudication_contract.ea9b_time_gated_frontier_remains_valid, true, "EA9A_P0306_EQUIVALENCE_EA9B_FRONTIER_MUST_BE_PRESERVED");
eq(cfg.adjudication_contract.current_season_reopened_by_this_adjudication, false, "EA9A_P0306_EQUIVALENCE_CURRENT_SEASON_REOPEN_FORBIDDEN");
eq(cfg.adjudication_contract.p0306q_point_threshold_authority_established_by_this_adjudication, false, "EA9A_P0306_EQUIVALENCE_POINT_THRESHOLD_AUTHORITY_FORBIDDEN");
eq(cfg.adjudication_contract.bounded_thermal_transfer_authorized_by_this_adjudication, false, "EA9A_P0306_EQUIVALENCE_BOUNDED_TRANSFER_AUTHORITY_FORBIDDEN");
eq(cfg.adjudication_contract.amendment_10_authority_created_by_this_adjudication, false, "EA9A_P0306_EQUIVALENCE_AMENDMENT10_EFFECT_FORBIDDEN");

for (const key of [
  "database_write_authorized",
  "formal_evidence_write_authorized",
  "raw_object_write_authorized",
  "runtime_config_write_authorized",
  "scheduler_write_authorized",
  "canonical_runtime_write_authorized"
]) eq(cfg.adjudication_contract[key], false, `EA9A_P0306_EQUIVALENCE_WRITE_AUTHORITY_FORBIDDEN:${key}`);

const sources = Object.fromEntries(cfg.enumerated_public_sources.map((source) => [source.source_id, source]));
for (const required of [
  "PIONEER_CURRENT_HYBRID_FAMILY_SEMANTICS",
  "BAYER_P0306Q_P0306AMXT_SAME_GENETIC_BACKGROUND",
  "PIONEER_CURRENT_SAME_FAMILY_MATURITY_VARIANCE",
  "PIONEER_2020_PRODUCT_GUIDE_MIRROR_P0306_PROFILE",
  "LANGFRITZ_P0306AM_GDU_VALUES"
]) {
  if (!sources[required]) fail(`EA9A_P0306_EQUIVALENCE_SOURCE_REQUIRED:${required}`);
}

eq(sources.PIONEER_CURRENT_HYBRID_FAMILY_SEMANTICS.provider_class, "FIRST_PARTY_PIONEER", "EA9A_P0306_EQUIVALENCE_PIONEER_FAMILY_SOURCE_CLASS");
eq(sources.BAYER_P0306Q_P0306AMXT_SAME_GENETIC_BACKGROUND.provider_class, "FIRST_PARTY_BAYER_TRIAL_DESCRIPTION", "EA9A_P0306_EQUIVALENCE_BAYER_SOURCE_CLASS");
eq(sources.PIONEER_2020_PRODUCT_GUIDE_MIRROR_P0306_PROFILE.provider_class, "THIRD_PARTY_ARCHIVED_MIRROR_OF_PIONEER_2020_PRODUCT_GUIDE", "EA9A_P0306_EQUIVALENCE_GUIDE_MIRROR_MUST_REMAIN_SECONDARY");
eq(sources.LANGFRITZ_P0306AM_GDU_VALUES.provider_class, "INDEPENDENT_PIONEER_SALES_REPRESENTATIVE_SECONDARY", "EA9A_P0306_EQUIVALENCE_THRESHOLD_SOURCE_MUST_REMAIN_SECONDARY");

eq(cfg.evidence_interpretation_policy.am_to_amxt_exact_same_genetic_background_statement_required_for_point_transfer, true, "EA9A_P0306_EQUIVALENCE_POINT_TRANSFER_GENETIC_RULE_REQUIRED");
eq(cfg.evidence_interpretation_policy.different_canadian_heat_unit_values_prohibit_exact_thermal_identity_claim, true, "EA9A_P0306_EQUIVALENCE_NONIDENTICAL_THERMAL_PROFILE_MUST_BE_PRESERVED");
eq(cfg.evidence_interpretation_policy.canadian_heat_units_may_be_converted_to_base50_gdu, false, "EA9A_P0306_EQUIVALENCE_CHU_TO_GDU_CONVERSION_FORBIDDEN");
eq(cfg.evidence_interpretation_policy.secondary_p0306am_gdu_values_may_become_p0306q_point_thresholds, false, "EA9A_P0306_EQUIVALENCE_SECONDARY_POINT_TRANSFER_FORBIDDEN");
eq(cfg.evidence_interpretation_policy.single_secondary_threshold_source_stage_determinative, false, "EA9A_P0306_EQUIVALENCE_SINGLE_SECONDARY_STAGE_AUTHORITY_FORBIDDEN");
eq(cfg.evidence_interpretation_policy.base50_daily_gdu_theoretical_max, 36, "EA9A_P0306_EQUIVALENCE_BASE50_DAILY_MAX_DRIFT");
eq(cfg.evidence_interpretation_policy.three_day_base50_gdu_theoretical_max, 108, "EA9A_P0306_EQUIVALENCE_THREE_DAY_BOUND_DRIFT");
eq(cfg.evidence_interpretation_policy.derived_108_gdu_role, "CONSERVATIVE_POLICY_REVIEW_BOUND_ONLY_NOT_PRODUCT_THRESHOLD_AUTHORITY", "EA9A_P0306_EQUIVALENCE_108_ROLE_DRIFT");

eq(cfg.expected_evidence_facts_if_sources_match.p0306am_p0306amxt_same_crm, 103, "EA9A_P0306_EQUIVALENCE_CRM_PROFILE_DRIFT");
eq(cfg.expected_evidence_facts_if_sources_match.p0306am_p0306amxt_same_silk_crm, 101, "EA9A_P0306_EQUIVALENCE_SILK_CRM_PROFILE_DRIFT");
eq(cfg.expected_evidence_facts_if_sources_match.p0306am_p0306amxt_same_physiological_crm, 104, "EA9A_P0306_EQUIVALENCE_PHYS_CRM_PROFILE_DRIFT");
eq(cfg.expected_evidence_facts_if_sources_match.p0306am_canadian_heat_units, 3100, "EA9A_P0306_EQUIVALENCE_AM_CHU_DRIFT");
eq(cfg.expected_evidence_facts_if_sources_match.p0306amxt_canadian_heat_units, 3125, "EA9A_P0306_EQUIVALENCE_AMXT_CHU_DRIFT");
eq(cfg.expected_evidence_facts_if_sources_match.canadian_heat_unit_difference, 25, "EA9A_P0306_EQUIVALENCE_CHU_DELTA_DRIFT");
eq(cfg.expected_evidence_facts_if_sources_match.p0306am_secondary_gdu_to_silk, 1330, "EA9A_P0306_EQUIVALENCE_SECONDARY_SILK_GDU_DRIFT");
eq(cfg.expected_evidence_facts_if_sources_match.p0306am_secondary_gdu_to_physiological_maturity, 2500, "EA9A_P0306_EQUIVALENCE_SECONDARY_PHYS_GDU_DRIFT");

eq(cfg.authority_effect.current_season_2026_recovery_reopened, false, "EA9A_P0306_EQUIVALENCE_AUTHORITY_EFFECT_REOPEN_FORBIDDEN");
eq(cfg.authority_effect.current_season_stage_authority_established, false, "EA9A_P0306_EQUIVALENCE_STAGE_AUTHORITY_FORBIDDEN");
eq(cfg.authority_effect.p0306q_exact_point_threshold_authority_established, false, "EA9A_P0306_EQUIVALENCE_POINT_AUTHORITY_EFFECT_FORBIDDEN");
eq(cfg.authority_effect.p0306q_bounded_transfer_authority_established, false, "EA9A_P0306_EQUIVALENCE_BOUNDED_AUTHORITY_EFFECT_FORBIDDEN");
eq(cfg.authority_effect.successor_epoch_selected, false, "EA9A_P0306_EQUIVALENCE_EPOCH_SELECTION_FORBIDDEN");
eq(cfg.authority_effect.formal_execution_count, "0/24", "EA9A_P0306_EQUIVALENCE_FORMAL_EXECUTION_MUST_REMAIN_ZERO");
eq(cfg.authority_effect.mcft_cap09_completed, false, "EA9A_P0306_EQUIVALENCE_COMPLETION_FORBIDDEN");

eq(cfg.decision_policy.successor_if_supported, "S6-AMENDMENT-10-P0306-BOUNDED-THERMAL-TRANSFER-AUTHORITY", "EA9A_P0306_EQUIVALENCE_SUPPORTED_SUCCESSOR_DRIFT");
eq(cfg.decision_policy.successor_if_not_supported, "S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION", "EA9A_P0306_EQUIVALENCE_NEGATIVE_SUCCESSOR_DRIFT");

const probe = read(probePath);
for (const marker of [
  "P0306_BOUNDED_THERMAL_TRANSFER_POLICY_ADJUDICATION_SUPPORTED",
  "p0306am_point_threshold_transferred_to_p0306q: false",
  "p0306q_bounded_thermal_transfer_authorized: false",
  "three_day_108_gdu_value_is_policy_review_bound_only: true",
  "database_write_count: 0",
  "formal_execution_count: '0/24'"
]) has(probe, marker, "EA9A_P0306_EQUIVALENCE_PROBE_GUARD_MISSING");
for (const forbidden of [
  "GEOX_MCFT_CAP09_S6_DATABASE_URL",
  "FORMAL_DATABASE_URL",
  "MCFT_EA5E2_TRANSIENT_S3",
  "@aws-sdk/client-s3",
  "INSERT INTO",
  "UPDATE ",
  "DELETE FROM"
]) lacks(probe, forbidden, "EA9A_P0306_EQUIVALENCE_PROBE_SIDE_EFFECT_CAPABILITY_FORBIDDEN");

const workflow = read(workflowPath);
for (const marker of [
  "Resolve exact P0306 equivalence adjudication base",
  "ACCEPTANCE_MCFT_CAP_09_EA9A_P0306_GENETIC_BACKGROUND_THERMAL_EQUIVALENCE_ADJUDICATION.cjs",
  "PROBE_MCFT_CAP_09_EA9A_P0306_GENETIC_BACKGROUND_THERMAL_EQUIVALENCE_ADJUDICATION.mjs",
  "Upload immutable P0306 equivalence adjudication proof artifact"
]) has(workflow, marker, "EA9A_P0306_EQUIVALENCE_WORKFLOW_PROOF_STEP_MISSING");
for (const forbidden of [
  "pull_request_target",
  "workflow_dispatch:",
  "schedule:",
  "GEOX_MCFT_CAP09_S6_DATABASE_URL",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY"
]) lacks(workflow, forbidden, "EA9A_P0306_EQUIVALENCE_WORKFLOW_SIDE_EFFECT_CAPABILITY_FORBIDDEN");

fs.mkdirSync("acceptance-output", { recursive: true });
const result = {
  schema_version: "geox_mcft_cap09_ea9a_p0306_genetic_background_thermal_equivalence_governance_result_v1",
  status: "PASS",
  base_main_sha: base,
  subject_head_sha: git("rev-parse", "HEAD"),
  exact_changed_file_count: changed.length,
  predecessor_blobs_verified_unchanged: true,
  historical_ea9a_terminal_result_preserved: true,
  ea9b_time_gated_frontier_preserved: true,
  p0306q_product_code: cfg.formal_scope_anchor.hybrid_product_code,
  relative_maturity_days: cfg.formal_scope_anchor.relative_maturity_days,
  exact_point_threshold_transfer_authorized: false,
  bounded_thermal_transfer_authorized: false,
  current_season_reopened: false,
  stage_authority_established: false,
  amendment_10_created: false,
  database_write_authorized: false,
  formal_evidence_write_authorized: false,
  raw_object_write_authorized: false,
  runtime_config_write_authorized: false,
  scheduler_write_authorized: false,
  canonical_runtime_write_authorized: false,
  successor_epoch_selected: false,
  ea5e2_operational_activation_qualified: false,
  ea5e3_effective: false,
  formal_execution_count: "0/24",
  mcft_cap09_completed: false
};
fs.writeFileSync(
  "acceptance-output/MCFT_CAP_09_EA9A_P0306_GENETIC_BACKGROUND_THERMAL_EQUIVALENCE_GOVERNANCE_RESULT.json",
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(JSON.stringify(result, null, 2));
