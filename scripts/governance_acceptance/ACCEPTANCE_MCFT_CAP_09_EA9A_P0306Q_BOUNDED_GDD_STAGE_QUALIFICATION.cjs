#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const fail = (message) => { throw new Error(message); };
const eq = (actual, expected, code) => { if (actual !== expected) fail(`${code}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`); };
const has = (text, marker, code) => { if (!text.includes(marker)) fail(`${code}:${marker}`); };
const matches = (text, pattern, code) => { if (!pattern.test(text)) fail(code); };
const lacks = (text, marker, code) => { if (text.includes(marker)) fail(`${code}:${marker}`); };
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const blob = (ref, filePath) => git("rev-parse", `${ref}:${filePath}`);
const read = (filePath) => fs.readFileSync(filePath, "utf8");
const json = (filePath) => JSON.parse(read(filePath));

const base = process.env.MCFT_BASE_SHA;
eq(base, "b39fe14b491d9155b8c12ba73763a9cc8e6d8428", "EA9A_BOUNDED_GDD_EXACT_BASE_REQUIRED");

const configPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-P0306Q-BOUNDED-GDD-STAGE-QUALIFICATION-V1.json";
const probePath = "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA9A_P0306Q_BOUNDED_GDD_STAGE_QUALIFICATION.py";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA9A_P0306Q_BOUNDED_GDD_STAGE_QUALIFICATION.cjs";
const workflowPath = ".github/workflows/mcft-cap-09-ea9a-p0306q-bounded-gdd-stage-qualification.yml";

const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed), JSON.stringify([configPath, probePath, gatePath, workflowPath].sort()), "EA9A_BOUNDED_GDD_EXACT_FOUR_FILE_BOUNDARY_REQUIRED");

const pins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-09-CROP-CONTEXT-SEASON-ARCHITECTURE-ADJUDICATION-AUTHORITY.md": "422f60257039e0f674171c218a7ff0a2fd7dc1b2",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-10-P0306-BOUNDED-THERMAL-PROXY-AUTHORITY.md": "964efa8acc95bf1aeed692c7662754afd3ac6db5",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-THERMAL-LANDMARK-TO-WATER-USE-STAGE-MAPPING-V1.json": "4e555183e2b69d3b7f39a7341acd89815ad871dd",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1J-CROP-WATER-USE-STAGE-AUTHORITY-V1.json": "eeb7ab49ee3270421efe4d6674305426074d1541",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-CURRENT-SEASON-CONTEMPORANEOUS-PHENOLOGY-QUALIFICATION-V1.json": "0e1f809c4bf63b09f4e44431ce507e3b74a966af",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-RECOVERY-AUTHORITY-V1.json": "1174940a6908e545e70d87cb65be5b3a41db33cf",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION-V1.json": "0e5752ff903663037b6399d68aca1290b2828e7f"
};
for (const [filePath, expected] of Object.entries(pins)) {
  eq(blob(base, filePath), expected, `EA9A_BOUNDED_GDD_BASE_PIN:${filePath}`);
  eq(blob("HEAD", filePath), expected, `EA9A_BOUNDED_GDD_PREDECESSOR_MUTATED:${filePath}`);
}

const amendment10 = read("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-10-P0306-BOUNDED-THERMAL-PROXY-AUTHORITY.md");
for (const marker of [
  "ASSUMED_P0306Q_BOUNDED_THERMAL_PROXY_V1",
  "silk proxy interval: `[1222, 1438] GDU`",
  "physiological-maturity proxy interval: `[2392, 2608] GDU`",
  "S6-EA9A-P0306Q-BOUNDED-GDD-STAGE-QUALIFICATION"
]) has(amendment10, marker, "EA9A_BOUNDED_GDD_AMENDMENT10_RULE_REQUIRED");
matches(
  amendment10,
  /related_product_point_threshold_transfer_authorized\s*=\s*false/,
  "EA9A_BOUNDED_GDD_AMENDMENT10_POINT_TRANSFER_PROHIBITION_REQUIRED"
);
matches(
  amendment10,
  /exact_p0306q_product_specific_threshold_authority_established\s*=\s*false/,
  "EA9A_BOUNDED_GDD_AMENDMENT10_EXACT_THRESHOLD_PROHIBITION_REQUIRED"
);

const mapping = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-THERMAL-LANDMARK-TO-WATER-USE-STAGE-MAPPING-V1.json");
eq(mapping.mapping_contract.mapping_class, "PARTIAL_SAFE_THERMAL_LANDMARK_TO_MODEL_STAGE_MAPPING", "EA9A_BOUNDED_GDD_MAPPING_CLASS_DRIFT");
eq(mapping.mapping_contract.full_continuous_gdd_to_four_stage_mapping_claimed, false, "EA9A_BOUNDED_GDD_CONTINUOUS_MAPPING_FORBIDDEN");
eq(JSON.stringify(mapping.mapping_contract.post_silking_pre_physiological_maturity_candidate_stages), JSON.stringify(["MID","LATE"]), "EA9A_BOUNDED_GDD_R1_R6_AMBIGUITY_REQUIRED");
eq(mapping.mapping_contract.silking_threshold_may_be_used_as_mid_late_boundary, false, "EA9A_BOUNDED_GDD_SILK_BOUNDARY_FORBIDDEN");
eq(mapping.mapping_contract.physiological_maturity_threshold_may_be_used_as_mid_late_boundary, false, "EA9A_BOUNDED_GDD_R6_BOUNDARY_FORBIDDEN");
eq(mapping.bounded_proxy_consumption.late_candidate_minimum_rule, "minimum_accumulated_base50_gdd_across_all_permitted_uncertainty >= 2608", "EA9A_BOUNDED_GDD_2608_RULE_DRIFT");

const cfg = json(configPath);
eq(cfg.base_main_sha, base, "EA9A_BOUNDED_GDD_CONFIG_BASE_DRIFT");
eq(cfg.formal_scope_anchor.hybrid_product_code, "P0306Q", "EA9A_BOUNDED_GDD_HYBRID_DRIFT");
eq(cfg.formal_scope_anchor.relative_maturity_days, 103, "EA9A_BOUNDED_GDD_RM_DRIFT");
eq(cfg.formal_scope_anchor.planting_observation_id, 6931, "EA9A_BOUNDED_GDD_PLANTING_OBSERVATION_DRIFT");
eq(cfg.formal_scope_anchor.planting_local_calendar_date, "2026-05-11", "EA9A_BOUNDED_GDD_PLANTING_DATE_DRIFT");
eq(cfg.formal_scope_anchor.planting_timezone, "America/Detroit", "EA9A_BOUNDED_GDD_PLANTING_TZ_DRIFT");
eq(cfg.formal_scope_anchor.planting_timestamp_uncertainty_utc.start_inclusive, "2026-05-11T04:00:00Z", "EA9A_BOUNDED_GDD_PLANTING_START_DRIFT");
eq(cfg.formal_scope_anchor.planting_timestamp_uncertainty_utc.end_exclusive, "2026-05-12T04:00:00Z", "EA9A_BOUNDED_GDD_PLANTING_END_DRIFT");
eq(cfg.temperature_source.metadata_path, "/datatables/561", "EA9A_BOUNDED_GDD_DAILY_EXTREMA_METADATA_IDENTITY_DRIFT");
eq(cfg.temperature_source.csv_path, "/datatables/561.csv", "EA9A_BOUNDED_GDD_DAILY_EXTREMA_CSV_IDENTITY_DRIFT");
eq(cfg.temperature_source.datatable_id, "KBS002-014.142", "EA9A_BOUNDED_GDD_DATATABLE_ID_DRIFT");
eq(cfg.temperature_source.source_class, "DIRECT_KBS_LTER_WEATHER_STATION_DAILY_EXTREMA", "EA9A_BOUNDED_GDD_SOURCE_CLASS_DRIFT");
eq(cfg.temperature_source.synthetic_daily_table_7_may_be_used, false, "EA9A_BOUNDED_GDD_SYNTHETIC_DAILY_SOURCE_FORBIDDEN");
eq(cfg.temperature_source.raw_hourly_means_may_be_relabelled_daily_extrema, false, "EA9A_BOUNDED_GDD_HOURLY_MEAN_EXTREMA_SUBSTITUTION_FORBIDDEN");
eq(cfg.temperature_source.spatial_confidence_upgrade_authorized, false, "EA9A_BOUNDED_GDD_SPATIAL_UPGRADE_FORBIDDEN");
eq(cfg.base50_method.daily_max_f_upper_cap, 86, "EA9A_BOUNDED_GDD_MAX_CAP_DRIFT");
eq(cfg.base50_method.daily_min_f_lower_floor, 50, "EA9A_BOUNDED_GDD_MIN_FLOOR_DRIFT");
eq(cfg.base50_method.maximum_allowed_daily_gdu, 36, "EA9A_BOUNDED_GDD_DAILY_MAX_DRIFT");
eq(cfg.base50_method.rm_to_gdu_conversion_authorized, false, "EA9A_BOUNDED_GDD_RM_CONVERSION_FORBIDDEN");
eq(cfg.base50_method.canadian_heat_unit_conversion_authorized, false, "EA9A_BOUNDED_GDD_CHU_CONVERSION_FORBIDDEN");
eq(cfg.base50_method.hourly_mean_extrema_substitution_authorized, false, "EA9A_BOUNDED_GDD_HOURLY_MEAN_SUBSTITUTION_FORBIDDEN");
eq(cfg.uncertainty_policy.planting_day_lower_gdu, 0, "EA9A_BOUNDED_GDD_PLANTING_DAY_LOWER_DRIFT");
eq(cfg.uncertainty_policy.planting_day_upper_uses_valid_full_day_gdu_else, 36, "EA9A_BOUNDED_GDD_PLANTING_DAY_UPPER_DRIFT");
eq(cfg.uncertainty_policy.missing_or_invalid_complete_day_lower_gdu, 0, "EA9A_BOUNDED_GDD_MISSING_DAY_LOWER_DRIFT");
eq(cfg.uncertainty_policy.missing_or_invalid_complete_day_upper_gdu, 36, "EA9A_BOUNDED_GDD_MISSING_DAY_UPPER_DRIFT");
eq(cfg.uncertainty_policy.current_incomplete_local_day_used, false, "EA9A_BOUNDED_GDD_CURRENT_PARTIAL_DAY_FORBIDDEN");
eq(cfg.uncertainty_policy.future_observations_used, false, "EA9A_BOUNDED_GDD_FUTURE_OBSERVATION_FORBIDDEN");
eq(cfg.uncertainty_policy.silent_imputation_authorized, false, "EA9A_BOUNDED_GDD_SILENT_IMPUTATION_FORBIDDEN");
eq(JSON.stringify(cfg.bounded_proxy.silk_interval_gdu), JSON.stringify([1222,1438]), "EA9A_BOUNDED_GDD_SILK_INTERVAL_DRIFT");
eq(JSON.stringify(cfg.bounded_proxy.physiological_maturity_interval_gdu), JSON.stringify([2392,2608]), "EA9A_BOUNDED_GDD_PHYS_INTERVAL_DRIFT");
eq(cfg.bounded_proxy.late_stage_deterministic_minimum_rule_gdu, 2608, "EA9A_BOUNDED_GDD_LATE_RULE_DRIFT");
eq(cfg.bounded_proxy.epistemic_class, "ASSUMED_BOUNDED_PROXY", "EA9A_BOUNDED_GDD_PROXY_EPISTEMIC_DRIFT");
eq(cfg.harvest_guard.scan_required_only_if_thermal_late_candidate, true, "EA9A_BOUNDED_GDD_HARVEST_GUARD_TRIGGER_DRIFT");
eq(cfg.harvest_guard.global_absence_claim_authorized, false, "EA9A_BOUNDED_GDD_GLOBAL_HARVEST_ABSENCE_FORBIDDEN");
eq(cfg.stage_decision_policy.positive_stage_code, "LATE", "EA9A_BOUNDED_GDD_POSITIVE_STAGE_DRIFT");
eq(cfg.stage_decision_policy.positive_stage_is_observed_biological_stage, false, "EA9A_BOUNDED_GDD_OBSERVED_STAGE_CLAIM_FORBIDDEN");
eq(cfg.stage_decision_policy.negative_successor, "S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION", "EA9A_BOUNDED_GDD_NEGATIVE_SUCCESSOR_DRIFT");
eq(cfg.stage_decision_policy.parallel_operational_successor, "S6-EA5E2-OPERATIONAL-ACTIVATION-QUALIFICATION-UNDER-AMENDMENT-08", "EA9A_BOUNDED_GDD_PARALLEL_SUCCESSOR_DRIFT");
for (const expected of [
  "temperature_source_identity_and_extrema_semantics_qualified",
  "minimum_accumulated_base50_gdd_gte_2608",
  "minimum_accumulated_base50_gdd_was_already_gte_2608_by_previous_complete_local_day",
  "at_least_6h_elapsed_since_start_of_current_local_day",
  "no_retrievable_t1_harvest_or_termination_event_as_of_authority_time",
  "no_future_observations_used",
  "all_write_counts_zero"
]) {
  if (!cfg.stage_decision_policy.positive_requires_all.includes(expected)) fail(`EA9A_BOUNDED_GDD_POSITIVE_REQUIREMENT_MISSING:${expected}`);
}
for (const key of [
  "current_season_stage_authority_established_before_exact_head_proof_and_merge",
  "database_write_authorized", "formal_evidence_write_authorized", "raw_object_write_authorized", "runtime_config_write_authorized",
  "scheduler_write_authorized", "canonical_runtime_write_authorized", "new_natural_season_created", "successor_epoch_selected",
  "ea5e2_operational_activation_qualified", "ea5e3_effective", "mcft_cap09_completed"
]) eq(cfg.authority_effect[key], false, `EA9A_BOUNDED_GDD_PREMATURE_EFFECT_FORBIDDEN:${key}`);
eq(cfg.authority_effect.formal_execution_count, "0/24", "EA9A_BOUNDED_GDD_FORMAL_COUNT_DRIFT");

const probe = read(probePath);
for (const marker of [
  "DIRECT_KBS_LTER_WEATHER_STATION_DAILY_EXTREMA",
  "synthetic_daily_table_7_used\": False",
  "raw_hourly_means_relabelled_daily_extrema\": False",
  "CURRENT_SEASON_LATE_STAGE_AUTHORITY_ESTABLISHED_UNDER_BOUNDED_GDD_PROXY",
  "CONSERVATIVE_ACCUMULATED_GDD_LOWER_BOUND_BELOW_2608",
  "full_continuous_gdd_to_four_stage_mapping_used\": False",
  "silking_used_as_mid_late_boundary\": False",
  "physiological_maturity_used_as_mid_late_boundary\": False",
  "formal_execution_count\": \"0/24\""
]) has(probe, marker, "EA9A_BOUNDED_GDD_PROBE_GUARD_MISSING");
for (const forbidden of [
  "GEOX_MCFT_CAP09_S6_DATABASE_URL", "FORMAL_DATABASE_URL", "MCFT_EA5E2_TRANSIENT_S3", "@aws-sdk/client-s3",
  "INSERT INTO", "UPDATE ", "DELETE FROM", "datatables/7.csv"
]) lacks(probe, forbidden, "EA9A_BOUNDED_GDD_PROBE_SIDE_EFFECT_OR_FORBIDDEN_SOURCE");

const workflow = read(workflowPath);
for (const marker of [
  "Resolve exact bounded GDD base",
  "ACCEPTANCE_MCFT_CAP_09_EA9A_P0306Q_BOUNDED_GDD_STAGE_QUALIFICATION.cjs",
  "PROBE_MCFT_CAP_09_EA9A_P0306Q_BOUNDED_GDD_STAGE_QUALIFICATION.py",
  "Upload immutable bounded GDD proof artifact"
]) has(workflow, marker, "EA9A_BOUNDED_GDD_WORKFLOW_STEP_MISSING");
for (const forbidden of ["pull_request_target", "workflow_dispatch:", "schedule:", "FORMAL_DATABASE_URL", "GEOX_MCFT_CAP09_S6_DATABASE_URL"]) lacks(workflow, forbidden, "EA9A_BOUNDED_GDD_WORKFLOW_SIDE_EFFECT_FORBIDDEN");

fs.mkdirSync("acceptance-output", { recursive: true });
const result = {
  schema_version: "geox_mcft_cap09_ea9a_p0306q_bounded_gdd_stage_qualification_governance_result_v1",
  status: "PASS",
  base_main_sha: base,
  subject_head_sha: git("rev-parse", "HEAD"),
  exact_changed_file_count: changed.length,
  predecessor_blobs_verified_unchanged: true,
  temperature_source: "KBS002-014.142 / datatable 561 direct daily extrema",
  synthetic_table_7_forbidden: true,
  raw_hourly_mean_extrema_substitution_forbidden: true,
  p0306q_point_threshold_transfer_authorized: false,
  bounded_proxy_epistemic_class: "ASSUMED_BOUNDED_PROXY",
  deterministic_positive_stage: "LATE",
  positive_minimum_gdd_rule: 2608,
  current_season_stage_authority_established_before_proof: false,
  database_write_authorized: false,
  formal_evidence_write_authorized: false,
  successor_epoch_selected: false,
  ea5e2_operational_activation_qualified: false,
  ea5e3_effective: false,
  formal_execution_count: "0/24",
  mcft_cap09_completed: false
};
fs.mkdirSync("acceptance-output", { recursive: true });
fs.writeFileSync("acceptance-output/MCFT_CAP_09_EA9A_P0306Q_BOUNDED_GDD_STAGE_QUALIFICATION_GOVERNANCE_RESULT.json", `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
