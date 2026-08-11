#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const BASE = "5229598e1222defd2aa3a2dab73649678e2300d8";
const OUT = "acceptance-output/MCFT_CAP_09_POST_ACTIVATION_READINESS_AUDIT_RESULT.json";
const P = {
  authority: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-POST-ACTIVATION-READINESS-AUDIT-V1.json",
  gate: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_POST_ACTIVATION_READINESS_AUDIT.cjs",
  workflow: ".github/workflows/mcft-cap-09-post-activation-readiness-audit.yml",
};

function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function read(file) { return fs.readFileSync(file, "utf8"); }
function json(file) { return JSON.parse(read(file)); }
function blob(ref, file) { return git("rev-parse", `${ref}:${file}`); }
function eq(actual, expected, code) { if (actual !== expected) throw new Error(`${code}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`); }
function yes(value, code) { eq(value, true, code); }
function no(value, code) { eq(value, false, code); }
function has(text, marker, code) { if (!text.includes(marker)) throw new Error(`${code}:${marker}`); }
function lacks(text, marker, code) { if (text.includes(marker)) throw new Error(`${code}:${marker}`); }
function result(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value));
}

function main() {
  const base = process.env.MCFT_BASE_SHA;
  eq(base, BASE, "POST_ACTIVATION_AUDIT_EXACT_BASE_REQUIRED");
  const subject = git("rev-parse", "HEAD");
  const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  eq(JSON.stringify(changed), JSON.stringify(Object.values(P).sort()), "POST_ACTIVATION_AUDIT_EXACT_THREE_FILE_BOUNDARY_REQUIRED");

  const immutable = {
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md": "39f6a09273c30088a7ea264cfa94ff930ea5518e",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md": "7a92c17f7ba32aae52667de9c21db62bfd2ba70b",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md": "e59e11e909bfd0a38c7298c5a6f909a6cd7afa49",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-07-EXTERNAL-FORMAL-FIXED-LAG-CAUSALITY-AUTHORITY.md": "c5a98ca789027e1bf051ec56bf1b7e76b98a0891",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-08-IMPLEMENTATION-ACTIVATION-QUALIFICATION-SEPARATION-AUTHORITY.md": "ef1e4344e5915e2c591cf7cfc9b6c2bf27f8bc3b",
    ".github/workflows/mcft-cap-09-s6-formal-24-hour-stage-1b-closure.yml": "64bc77026628efa5cc75907d9c01eddc87a639e4",
    "scripts/runtime_acceptance/RUN_MCFT_CAP_09_S6_FORMAL_24_HOUR_STAGE_1B_WINDOW.ts": "1f19fa1e65352eba58e7de79dd124844defc901f",
    "scripts/runtime_acceptance/RUN_MCFT_CAP_09_S6_FORMAL_24_HOUR_STAGE_1B_WINDOW_V2.ts": "e4e64e843213c7e7587165c8ecfccf6f0a3c8095",
    "scripts/runtime_acceptance/mcft_cap09_s6_formal_authority_v1.ts": "955e081231a9e7190383d77496ff2baedf7adb5a"
  };
  for (const [file, sha] of Object.entries(immutable)) {
    eq(blob(base, file), sha, `POST_ACTIVATION_AUDIT_BASE_PIN:${file}`);
    eq(blob("HEAD", file), sha, `POST_ACTIVATION_AUDIT_PREDECESSOR_MUTATED:${file}`);
  }

  const a = json(P.authority);
  eq(a.schema_version, "geox_mcft_cap09_post_activation_readiness_audit_v1", "POST_ACTIVATION_AUDIT_SCHEMA_REQUIRED");
  eq(a.base_protected_main_sha, base, "POST_ACTIVATION_AUDIT_BASE_BINDING_REQUIRED");
  yes(a.current_effective_state.ea5e2_implementation_qualified, "POST_ACTIVATION_IMPLEMENTATION_QUALIFIED_REQUIRED");
  yes(a.current_effective_state.ea5e2_operational_activation_runner_qualified, "POST_ACTIVATION_RUNNER_QUALIFIED_REQUIRED");
  no(a.current_effective_state.ea5e2_operational_activation_qualified, "POST_ACTIVATION_PREMATURE_ACTIVATION_FORBIDDEN");
  no(a.current_effective_state.ea5e3_authorized, "POST_ACTIVATION_PREMATURE_EA5E3_FORBIDDEN");
  no(a.current_effective_state.formal_window_started, "POST_ACTIVATION_PREMATURE_FORMAL_START_FORBIDDEN");
  eq(a.current_effective_state.formal_execution_slots_completed, 0, "POST_ACTIVATION_FORMAL_ZERO_OF_24_REQUIRED");

  const historical = a.historical_not_reusable_for_successor_formal_v3;
  for (const key of [
    "a06a_epoch_selection_authority_reusable",
    "a06b_old_epoch_runtime_config_chain_reusable",
    "a06c_old_epoch_append_persistence_result_reusable",
    "ea5e1_old_epoch_window_input_manifest_reusable",
    "legacy_stage_1b_runner_reusable",
    "legacy_stage_1b_v2_runner_reusable",
    "legacy_formal_authority_helper_reusable"
  ]) no(historical[key], `POST_ACTIVATION_HISTORICAL_REUSE_FORBIDDEN:${key}`);
  eq(historical.expired_ea5e3_readiness_deadline, "2026-08-11T05:00:00.000Z", "POST_ACTIVATION_EXPIRED_DEADLINE_IMMUTABLE_REQUIRED");

  const legacyWorkflow = read(".github/workflows/mcft-cap-09-s6-formal-24-hour-stage-1b-closure.yml");
  has(legacyWorkflow, "cron: '17 * * * *'", "POST_ACTIVATION_LEGACY_CRON_FACT_REQUIRED");
  has(legacyWorkflow, "GEOX_MCFT_CAP09_S6_CANONICAL_INPUT_JSON", "POST_ACTIVATION_LEGACY_STATIC_INPUT_FACT_REQUIRED");
  has(legacyWorkflow, "RUN_MCFT_CAP_09_S6_FORMAL_24_HOUR_STAGE_1B_WINDOW.ts", "POST_ACTIVATION_LEGACY_ENTRYPOINT_FACT_REQUIRED");
  lacks(legacyWorkflow, "RUN_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_OBSERVER.ts", "POST_ACTIVATION_LEGACY_WORKFLOW_MUST_NOT_BE_MISCLASSIFIED_AS_NEW_RUNNER");

  const legacyRunner = read("scripts/runtime_acceptance/RUN_MCFT_CAP_09_S6_FORMAL_24_HOUR_STAGE_1B_WINDOW.ts");
  has(legacyRunner, 'json<ExecuteCap04SingleTickInputV1>("MCFT_CAP09_S6_CANONICAL_INPUT_JSON")', "POST_ACTIVATION_LEGACY_STATIC_TEMPLATE_FACT_REQUIRED");
  has(legacyRunner, "canonical_input: { ...template", "POST_ACTIVATION_LEGACY_TEMPLATE_REUSE_FACT_REQUIRED");
  lacks(legacyRunner, "PostgresExternalFormalEvidenceSourceV1", "POST_ACTIVATION_LEGACY_DB_ONLY_EXTERNAL_SOURCE_ABSENT_REQUIRED");

  const v2 = read("scripts/runtime_acceptance/RUN_MCFT_CAP_09_S6_FORMAL_24_HOUR_STAGE_1B_WINDOW_V2.ts");
  has(v2, "buildFormalAuthorityBundleV1", "POST_ACTIVATION_LEGACY_V2_HELPER_FACT_REQUIRED");
  has(v2, 'import("./RUN_MCFT_CAP_09_S6_FORMAL_24_HOUR_STAGE_1B_WINDOW.js")', "POST_ACTIVATION_LEGACY_V2_DELEGATION_FACT_REQUIRED");

  const helper = read("scripts/runtime_acceptance/mcft_cap09_s6_formal_authority_v1.ts");
  for (const marker of [
    "GEOX-MCFT-00-REALITY-BINDING.json",
    "GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json",
    "GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json",
    "fixtures/mcft/water_state/replay_v1/configuration_context.json",
    "mcft_soil_hydraulic_config_c8_v1"
  ]) has(helper, marker, "POST_ACTIVATION_LEGACY_REPLAY_AUTHORITY_FACT_REQUIRED");

  const baseline = a.formal_history_inventory_planning_baseline;
  eq(baseline.facts_before_successor_epoch_persistence_expected, 60, "POST_ACTIVATION_HISTORICAL_FACT_BASELINE_REQUIRED");
  eq(baseline.runtime_configs_before_successor_epoch_persistence_expected, 49, "POST_ACTIVATION_HISTORICAL_CONFIG_BASELINE_REQUIRED");
  eq(baseline.successor_config_append_count_if_later_authorized, 24, "POST_ACTIVATION_SUCCESSOR_APPEND_24_REQUIRED");
  eq(baseline.planned_runtime_configs_after_one_successor_append, 73, "POST_ACTIVATION_SUCCESSOR_CONFIG_PLANNING_COUNT_REQUIRED");
  eq(baseline.planned_facts_after_one_successor_config_append_before_other_formal_writes, 84, "POST_ACTIVATION_SUCCESSOR_FACT_PLANNING_COUNT_REQUIRED");
  no(baseline.fixed_global_count_may_be_used_as_future_authority, "POST_ACTIVATION_FIXED_GLOBAL_COUNT_AUTHORITY_FORBIDDEN");

  const freeze = a.operational_activation_evidence_freeze_minimum_contract;
  yes(freeze.must_follow_successful_protected_main_live_run, "POST_ACTIVATION_EVIDENCE_FREEZE_AFTER_LIVE_REQUIRED");
  no(freeze.live_run_candidate_evidence_is_effective_without_freeze, "POST_ACTIVATION_LIVE_CANDIDATE_NOT_EFFECTIVE_REQUIRED");
  eq(freeze.required_cap04_operation_variant, "A1", "POST_ACTIVATION_FREEZE_A1_REQUIRED");
  eq(freeze.required_cap04_forecast_status, "COMPLETED", "POST_ACTIVATION_FREEZE_COMPLETED_REQUIRED");
  eq(freeze.required_cap04_forecast_point_count, 72, "POST_ACTIVATION_FREEZE_72_REQUIRED");
  for (const field of [
    "protected_main_subject_sha","workflow_run_id","artifact_id","artifact_digest","kbs_latest_timestamp",
    "kbs_computed_age_hours","target_t","runtime_observer_started_at","same_cycle_gfs_identity",
    "private_retention_receipt_hash_metadata","isolated_database_evidence_hashes","single_t_crop_context_hash",
    "external_cap04_operation_variant","external_cap04_forecast_status","external_cap04_forecast_point_count",
    "source_substitution_count","timestamp_relabel_count","runtime_provider_request_count",
    "formal_database_write_count","formal_raw_prefix_write_count","formal_scheduler_write_count",
    "formal_canonical_runtime_write_count"
  ]) if (!freeze.required_fields.includes(field)) throw new Error(`POST_ACTIVATION_FREEZE_FIELD_REQUIRED:${field}`);

  const scan = a.successor_whole_window_scan_contract;
  no(scan.may_become_authoritative_before_operational_activation_effective, "POST_ACTIVATION_SCAN_PREMATURE_AUTHORITY_FORBIDDEN");
  yes(scan.implementation_may_be_prepared_read_only_before_activation, "POST_ACTIVATION_SCAN_PREPARATION_ALLOWED_REQUIRED");
  eq(scan.minimum_lead_hours, 36, "POST_ACTIVATION_SCAN_36H_LEAD_REQUIRED");
  eq(scan.ea5e3_readiness_deadline_offset_hours, -12, "POST_ACTIVATION_SCAN_MINUS_12H_REQUIRED");
  eq(scan.slot_count, 24, "POST_ACTIVATION_SCAN_24_SLOTS_REQUIRED");
  eq(scan.crop_backward_stability_hours, 6, "POST_ACTIVATION_SCAN_CROP_BACKWARD_6H_REQUIRED");
  eq(scan.crop_forward_transition_guard_hours, 30, "POST_ACTIVATION_SCAN_CROP_FORWARD_30H_REQUIRED");
  yes(scan.all_six_fao_variants_required, "POST_ACTIVATION_SCAN_SIX_VARIANTS_REQUIRED");
  yes(scan.all_possible_planting_times_required, "POST_ACTIVATION_SCAN_PLANTING_UNCERTAINTY_REQUIRED");
  no(scan.future_observations_authorized, "POST_ACTIVATION_SCAN_FUTURE_OBSERVATION_FORBIDDEN");
  eq(scan.no_candidate_result, "NO_CURRENT_SEASON_SUCCESSOR_EPOCH", "POST_ACTIVATION_SCAN_NO_CANDIDATE_RESULT_REQUIRED");

  const runner = a.external_formal_v3_runner_required_contract;
  yes(runner.new_separate_entrypoint_required, "POST_ACTIVATION_V3_NEW_ENTRYPOINT_REQUIRED");
  yes(runner.legacy_runner_delegation_forbidden, "POST_ACTIVATION_V3_LEGACY_RUNNER_FORBIDDEN");
  yes(runner.legacy_v2_delegation_forbidden, "POST_ACTIVATION_V3_LEGACY_V2_FORBIDDEN");
  yes(runner.static_canonical_input_secret_forbidden, "POST_ACTIVATION_V3_STATIC_INPUT_FORBIDDEN");
  yes(runner.implicit_latest_runtime_config_lookup_forbidden, "POST_ACTIVATION_V3_IMPLICIT_LATEST_CONFIG_FORBIDDEN");
  yes(runner.successor_manifest_exact_slot_config_ref_hash_required, "POST_ACTIVATION_V3_MANIFEST_PIN_REQUIRED");
  yes(runner.database_only_external_evidence_source_required, "POST_ACTIVATION_V3_DB_ONLY_SOURCE_REQUIRED");
  yes(runner.runtime_provider_fetch_forbidden, "POST_ACTIVATION_V3_RUNTIME_PROVIDER_FORBIDDEN");
  yes(runner.runtime_r2_head_forbidden, "POST_ACTIVATION_V3_RUNTIME_R2_HEAD_FORBIDDEN");
  eq(runner.scheduler_eligibility_lag_hours, 7, "POST_ACTIVATION_V3_7H_LAG_REQUIRED");
  eq(runner.exact_interval_cutoff_offset_minutes, 432, "POST_ACTIVATION_V3_432M_CUTOFF_REQUIRED");
  eq(runner.runtime_observer_offset_minutes, 437, "POST_ACTIVATION_V3_437M_OBSERVER_REQUIRED");
  yes(runner.one_scheduler_lease_and_fencing_authority_required, "POST_ACTIVATION_V3_ONE_LEASE_REQUIRED");
  yes(runner.second_runtime_write_lease_forbidden, "POST_ACTIVATION_V3_SECOND_LEASE_FORBIDDEN");
  no(runner.a2_blocked_may_create_scenario, "POST_ACTIVATION_V3_A2_SCENARIO_FORBIDDEN");

  const order = a.post_activation_ordering_matrix;
  eq(order[0], "OPERATIONAL_ACTIVATION_LIVE_PASS", "POST_ACTIVATION_ORDER_LIVE_FIRST_REQUIRED");
  eq(order[1], "OPERATIONAL_ACTIVATION_EVIDENCE_FREEZE_EFFECTIVE", "POST_ACTIVATION_ORDER_FREEZE_SECOND_REQUIRED");
  if (order.indexOf("WHOLE_WINDOW_CROP_CONTEXT_SCAN") >= order.indexOf("SUCCESSOR_EPOCH_SELECTION_AUTHORITY")) throw new Error("POST_ACTIVATION_SCAN_MUST_PRECEDE_EPOCH_SELECTION");
  if (order.indexOf("EA5E3_FORMAL_AUTHORITY_V3_EFFECTIVE_BY_O00_MINUS_12H") >= order.indexOf("ACTUAL_UTC_O00_TO_O23")) throw new Error("POST_ACTIVATION_EA5E3_MUST_PRECEDE_O00");

  const auditSurface = read(P.authority) + "\n" + read(P.workflow);
  for (const forbidden of [
    "GEOX_MCFT_CAP09_S6_DATABASE_URL",
    "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY",
    "INSERT INTO facts",
    "UPDATE facts",
    "DELETE FROM facts",
    "workflow_dispatch:"
  ]) lacks(auditSurface, forbidden, "POST_ACTIVATION_AUDIT_SIDE_EFFECT_CAPABILITY_FORBIDDEN");

  result({
    schema_version: "geox_mcft_cap09_post_activation_readiness_audit_result_v1",
    status: "PASS",
    base_sha: base,
    subject_sha: subject,
    exact_changed_file_count: changed.length,
    exact_boundary: "THREE_FILES",
    legacy_formal_runner_reusable: false,
    legacy_formal_v2_runner_reusable: false,
    successor_epoch_selected: false,
    operational_activation_qualified: false,
    ea5e3_authorized: false,
    formal_window_started: false,
    formal_database_write_count: 0,
    formal_raw_prefix_write_count: 0,
    scheduler_write_count: 0,
    canonical_runtime_write_count: 0,
    preparatory_engineering_frontier: a.next_preparatory_engineering_frontier
  });
}

try { main(); }
catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  let subject = null;
  try { subject = git("rev-parse", "HEAD"); } catch {}
  result({
    schema_version: "geox_mcft_cap09_post_activation_readiness_audit_result_v1",
    status: "FAIL",
    base_sha: process.env.MCFT_BASE_SHA ?? null,
    subject_sha: subject,
    error: message,
    fail_closed: true,
    operational_activation_qualified: false,
    successor_epoch_selected: false,
    ea5e3_authorized: false,
    formal_window_started: false,
    formal_database_write_count: 0,
    formal_raw_prefix_write_count: 0,
    scheduler_write_count: 0,
    canonical_runtime_write_count: 0
  });
  process.exitCode = 1;
}
