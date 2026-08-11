#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const BASE = "4e41858478bdca5989fb3388c3660105f7350559";
const OUT = "acceptance-output/MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_RUNNER_QUALIFICATION_GOVERNANCE_RESULT.json";
const P = {
  liveWorkflow: ".github/workflows/mcft-cap-09-ea5e2-live-provider-two-phase-readiness.yml",
  focusedWorkflow: ".github/workflows/mcft-cap-09-ea5e2-operational-activation-runner-qualification.yml",
  observer: "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_OBSERVER.ts",
  authority: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-OPERATIONAL-ACTIVATION-RUNNER-QUALIFICATION-V1.json",
  gate: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_RUNNER_QUALIFICATION.cjs",
};

function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function blob(ref, file) { return git("rev-parse", `${ref}:${file}`); }
function read(file) { return fs.readFileSync(file, "utf8"); }
function json(file) { return JSON.parse(read(file)); }
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
  eq(base, BASE, "EA5E2_OA_RUNNER_EXACT_BASE_REQUIRED");
  const subject = git("rev-parse", "HEAD");
  const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  eq(JSON.stringify(changed), JSON.stringify(Object.values(P).sort()), "EA5E2_OA_RUNNER_EXACT_FIVE_FILE_BOUNDARY_REQUIRED");

  const immutable = {
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md": "39f6a09273c30088a7ea264cfa94ff930ea5518e",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md": "e59e11e909bfd0a38c7298c5a6f909a6cd7afa49",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-07-EXTERNAL-FORMAL-FIXED-LAG-CAUSALITY-AUTHORITY.md": "c5a98ca789027e1bf051ec56bf1b7e76b98a0891",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-08-IMPLEMENTATION-ACTIVATION-QUALIFICATION-SEPARATION-AUTHORITY.md": "ef1e4344e5915e2c591cf7cfc9b6c2bf27f8bc3b",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-COLLECTOR-RUNTIME-SCHEDULE-READINESS-V1.json": "60c00a9719436ff82980499813551ba9fa6ecf19",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json": "b5de9d29189cb654444b3f57d00df290eefe16d3",
    "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json": "c04c6805ab79c715781b99f8fbcf997fae3a8c48",
    "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts": "7173707ace398fbeb8c1270900bab1a8785f518d",
    "scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py": "150c3ae271d5572ea31133ce27b0fcccbf27c512",
    "apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.ts": "e5ed3c677bf55e4eee3cbb67a52e3b6886b8f259",
    "apps/server/src/runtime/twin_runtime/external_formal_cap04_candidate_execution_service_v1.ts": "71df4e47b0c62b7c6f2126e33896849af56273ca",
    "apps/server/src/runtime/twin_runtime/fixed_lag_scheduler_adapter_v1.ts": "7525c4748c8d758ba04a198b8a6c00f1a9ffceb4",
    "apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.ts": "a83437765f1c75860c5270b89446474787cde4c3",
    "apps/server/src/runtime/twin_runtime/assimilated_continuation_evidence_window_v2.ts": "6699fb741cc0f61291f3d8c6e1e45ee0dcc79e36",
  };
  for (const [file, sha] of Object.entries(immutable)) {
    eq(blob(base, file), sha, `EA5E2_OA_RUNNER_BASE_PIN:${file}`);
    eq(blob("HEAD", file), sha, `EA5E2_OA_RUNNER_PREDECESSOR_MUTATED:${file}`);
  }

  eq(blob("HEAD", P.liveWorkflow), "9c918152cc57d556770ed33d836a4fda75b4d10b", "EA5E2_OA_LIVE_WORKFLOW_BLOB_REQUIRED");
  eq(blob("HEAD", P.observer), "eb4001e5b218030435c2a712f78c9d4d64938568", "EA5E2_OA_OBSERVER_BLOB_REQUIRED");
  eq(blob("HEAD", P.authority), "4f0df5f9fe896bf26eda3d673e3153941f59c2e7", "EA5E2_OA_AUTHORITY_BLOB_REQUIRED");

  const authority = json(P.authority);
  eq(authority.schema_version, "geox_mcft_cap09_ea5e2_operational_activation_runner_qualification_v1", "EA5E2_OA_AUTHORITY_SCHEMA_REQUIRED");
  eq(authority.base_main_sha, base, "EA5E2_OA_AUTHORITY_BASE_REQUIRED");
  eq(authority.qualification_boundary.exact_changed_file_count, 5, "EA5E2_OA_FIVE_FILE_AUTHORITY_REQUIRED");
  eq(authority.qualification_boundary.runtime_implementation_source_change_count, 0, "EA5E2_OA_RUNTIME_SOURCE_CHANGE_ZERO_REQUIRED");
  yes(authority.protected_main_live_contract.live_run_subject_must_be_protected_main, "EA5E2_OA_PROTECTED_MAIN_SUBJECT_REQUIRED");
  yes(authority.protected_main_live_contract.critical_activation_boundary_must_match_current_main, "EA5E2_OA_CRITICAL_BOUNDARY_CURRENT_MAIN_REQUIRED");
  yes(authority.protected_main_live_contract.pull_request_live_run_forbidden, "EA5E2_OA_PR_LIVE_RUN_FORBIDDEN");
  yes(authority.protected_main_live_contract.target_epoch_independent, "EA5E2_OA_EPOCH_INDEPENDENT_REQUIRED");
  yes(authority.protected_main_live_contract.formal_epoch_selection_before_activation_forbidden, "EA5E2_OA_EPOCH_SELECTION_BEFORE_ACTIVATION_FORBIDDEN");

  const clock = authority.provider_and_clock_contract;
  eq(clock.kbs_raw_hourly_max_age_hours, 6, "EA5E2_OA_KBS_SIX_HOUR_REQUIRED");
  eq(clock.pre_boundary_collector_offset_minutes, -30, "EA5E2_OA_PRE_OFFSET_REQUIRED");
  eq(clock.late_exact_hour_collector_offset_minutes, 390, "EA5E2_OA_LATE_OFFSET_REQUIRED");
  eq(clock.scheduler_eligibility_lag_hours, 7, "EA5E2_OA_LAG_REQUIRED");
  eq(clock.late_exact_hour_evidence_cutoff_offset_minutes, 432, "EA5E2_OA_CUTOFF_REQUIRED");
  eq(clock.runtime_observer_offset_minutes, 437, "EA5E2_OA_OBSERVER_REQUIRED");
  eq(clock.runtime_observer_max_start_skew_minutes, 10, "EA5E2_OA_OBSERVER_SKEW_REQUIRED");
  eq(clock.minimum_ingestion_margin_minutes, 5, "EA5E2_OA_MARGIN_REQUIRED");
  no(clock.source_substitution_authorized, "EA5E2_OA_SOURCE_SUBSTITUTION_FORBIDDEN");
  no(clock.time_relabeling_authorized, "EA5E2_OA_TIME_RELABELING_FORBIDDEN");
  no(clock.cross_cycle_substitution_authorized, "EA5E2_OA_CROSS_CYCLE_FORBIDDEN");
  no(clock.accelerated_formal_clock_authorized, "EA5E2_OA_ACCELERATED_CLOCK_FORBIDDEN");

  const observerAuthority = authority.observer_authority;
  eq(observerAuthority.formal_database_access_mode, "READ_ONLY_A0_HANDOFF_ONLY", "EA5E2_OA_FORMAL_READ_ONLY_REQUIRED");
  no(observerAuthority.qualification_runtime_config_persisted, "EA5E2_OA_QUAL_CONFIG_PERSISTENCE_FORBIDDEN");
  no(observerAuthority.qualification_runtime_config_formal_authority, "EA5E2_OA_QUAL_CONFIG_FORMAL_AUTHORITY_FORBIDDEN");
  no(observerAuthority.qualification_crop_context_persisted, "EA5E2_OA_CROP_CONTEXT_PERSISTENCE_FORBIDDEN");
  no(observerAuthority.qualification_crop_context_formal_epoch_reusable, "EA5E2_OA_CROP_CONTEXT_REUSE_FORBIDDEN");
  yes(observerAuthority.single_t_crop_context_rederivation_required, "EA5E2_OA_SINGLE_T_CROP_REDERIVATION_REQUIRED");
  eq(observerAuthority.crop_backward_stability_hours, 6, "EA5E2_OA_CROP_BACKWARD_GUARD_REQUIRED");
  eq(observerAuthority.crop_forward_transition_guard_hours, 30, "EA5E2_OA_CROP_FORWARD_GUARD_REQUIRED");
  yes(observerAuthority.all_six_fao_variants_required, "EA5E2_OA_SIX_FAO_VARIANTS_REQUIRED");
  yes(observerAuthority.planting_time_uncertainty_carried, "EA5E2_OA_PLANTING_UNCERTAINTY_REQUIRED");
  no(observerAuthority.future_crop_observations_authorized, "EA5E2_OA_FUTURE_CROP_OBSERVATIONS_FORBIDDEN");
  eq(observerAuthority.external_cap04_required_disposition, "A1", "EA5E2_OA_CAP04_A1_REQUIRED");
  eq(observerAuthority.external_cap04_required_forecast_status, "COMPLETED", "EA5E2_OA_CAP04_COMPLETED_REQUIRED");
  eq(observerAuthority.external_cap04_required_forecast_point_count, 72, "EA5E2_OA_CAP04_72_REQUIRED");
  eq(observerAuthority.runtime_provider_request_count, 0, "EA5E2_OA_RUNTIME_PROVIDER_ZERO_REQUIRED");
  no(observerAuthority.canonical_persistence_authorized, "EA5E2_OA_CANONICAL_PERSISTENCE_FORBIDDEN");
  no(observerAuthority.scenario_authorized, "EA5E2_OA_SCENARIO_FORBIDDEN");

  for (const [key, value] of Object.entries(authority.side_effect_boundary)) {
    if (key.endsWith("_write_count")) eq(value, 0, `EA5E2_OA_ZERO_SIDE_EFFECT:${key}`);
  }
  no(authority.side_effect_boundary.formal_window_started, "EA5E2_OA_FORMAL_WINDOW_FORBIDDEN");
  no(authority.side_effect_boundary.ea5e3_authorized, "EA5E2_OA_EA5E3_FORBIDDEN");
  no(authority.historical_epoch_rule.expired_epoch_extended, "EA5E2_OA_EXPIRED_EPOCH_EXTENSION_FORBIDDEN");
  no(authority.historical_epoch_rule.expired_epoch_rescued, "EA5E2_OA_EXPIRED_EPOCH_RESCUE_FORBIDDEN");
  no(authority.historical_epoch_rule.retroactive_execution_authorized, "EA5E2_OA_RETROACTIVE_EXECUTION_FORBIDDEN");
  no(authority.historical_epoch_rule.initial_multi_slot_catchup_authorized, "EA5E2_OA_INITIAL_CATCHUP_FORBIDDEN");
  yes(authority.live_proof_effectiveness_rule.successful_live_workflow_run_is_candidate_evidence_only, "EA5E2_OA_LIVE_PROOF_CANDIDATE_ONLY_REQUIRED");
  yes(authority.live_proof_effectiveness_rule.live_proof_must_be_frozen_by_separate_exact_head_authority, "EA5E2_OA_EVIDENCE_FREEZE_REQUIRED");
  yes(authority.live_proof_effectiveness_rule.runner_merge_does_not_make_operational_activation_effective, "EA5E2_OA_RUNNER_MERGE_NON_EFFECT_REQUIRED");
  yes(authority.effect_if_exact_head_runner_qualification_passes_and_candidate_merges.ea5e2_operational_activation_runner_qualified, "EA5E2_OA_RUNNER_QUALIFIED_EFFECT_REQUIRED");
  no(authority.effect_if_exact_head_runner_qualification_passes_and_candidate_merges.ea5e2_operational_activation_qualified, "EA5E2_OA_PREMATURE_EFFECT_FORBIDDEN");

  const live = read(P.liveWorkflow);
  has(live, "name: mcft-cap-09-ea5e2-operational-activation-live", "EA5E2_OA_LIVE_NAME_REQUIRED");
  has(live, "push:\n    branches: [main]", "EA5E2_OA_MAIN_PUSH_REQUIRED");
  has(live, "workflow_dispatch:", "EA5E2_OA_MANUAL_RETRY_REQUIRED");
  lacks(live, "pull_request:", "EA5E2_OA_PR_TRIGGER_FORBIDDEN");
  lacks(live, "EA5E3_HARD_DEADLINE_UTC", "EA5E2_OA_EXPIRED_DEADLINE_COUPLING_FORBIDDEN");
  has(live, "epoch_independent:true", "EA5E2_OA_EPOCH_INDEPENDENT_TARGET_REQUIRED");
  has(live, "Fail fast unless KBS Raw Hourly is currently within unchanged 6h authority", "EA5E2_OA_KBS_FAIL_FAST_REQUIRED");
  has(live, "Wait until actual Runtime observer T plus 7h17m", "EA5E2_OA_REAL_OBSERVER_WAIT_REQUIRED");
  has(live, "RUN_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_OBSERVER.ts", "EA5E2_OA_OBSERVER_EXECUTION_REQUIRED");
  has(live, "operational_activation_live_proof_pass:true", "EA5E2_OA_LIVE_PASS_MARKER_REQUIRED");
  has(live, "ea5e2_operational_activation_qualified:false", "EA5E2_OA_LIVE_PROOF_NOT_EFFECTIVE_REQUIRED");
  has(live, "effectiveness_pending_evidence_freeze:true", "EA5E2_OA_EVIDENCE_FREEZE_PENDING_REQUIRED");
  has(live, "GEOX_MCFT_CAP09_S6_DATABASE_URL", "EA5E2_OA_FORMAL_READONLY_SECRET_REQUIRED");

  const observer = read(P.observer);
  for (const marker of [
    "OBSERVER_OFFSET_MINUTES = 437",
    "MAX_OBSERVER_START_SKEW_MINUTES = 10",
    "READ_ONLY_A0_HANDOFF_ONLY",
    "QUALIFICATION_ONLY_NOT_FORMAL_EPOCH_CONFIG",
    "EA5E2_ACTIVATION_CROP_STAGE_NO_CONSERVATIVE_CONSENSUS",
    "compileExternalFormalRuntimeConfigV1",
    "PostgresExternalFormalEvidenceSourceV1",
    "ExternalFormalCap04CandidateExecutionServiceV1",
    "candidate.disposition !== \"A1\"",
    "candidate.forecast_status !== \"COMPLETED\"",
    "candidate.forecast_point_count !== 72",
    "candidate.execution_authority.provider_request_count !== 0",
    "formal_database_write_count: 0",
    "scheduler_slot_count: 0",
    "scheduler_cursor_count: 0",
    "raw_values_emitted: false"
  ]) has(observer, marker, "EA5E2_OA_OBSERVER_RULE_MISSING");
  for (const forbidden of [
    "INSERT INTO",
    "UPDATE ",
    "DELETE FROM",
    "commitContinuationState",
    "commitAssimilatedContinuationState",
    "commitRuntimeConfig(",
    "acquireLease("
  ]) lacks(observer, forbidden, "EA5E2_OA_OBSERVER_WRITE_CAPABILITY_FORBIDDEN");

  const focused = read(P.focusedWorkflow);
  has(focused, "ACCEPTANCE_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_RUNNER_QUALIFICATION.cjs", "EA5E2_OA_FOCUSED_GATE_REQUIRED");
  has(focused, "RUN_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_OBSERVER.ts", "EA5E2_OA_FOCUSED_OBSERVER_COMPILE_REQUIRED");
  lacks(focused, "GEOX_MCFT_CAP09_S6_DATABASE_URL", "EA5E2_OA_FOCUSED_FORMAL_SECRET_FORBIDDEN");
  lacks(focused, "MCFT_EA5E2_TRANSIENT_S3_SECRET_ACCESS_KEY", "EA5E2_OA_FOCUSED_R2_SECRET_FORBIDDEN");

  result({
    schema_version: "geox_mcft_cap09_ea5e2_operational_activation_runner_qualification_governance_result_v1",
    status: "PASS",
    base_sha: base,
    subject_sha: subject,
    exact_changed_file_count: changed.length,
    exact_boundary: "FIVE_FILES",
    runner_qualified: true,
    protected_main_live_run_authorized: true,
    ea5e2_operational_activation_qualified: false,
    kbs_raw_hourly_max_age_hours: 6,
    scheduler_lag_hours: 7,
    exact_interval_cutoff_minutes: 432,
    runtime_observer_offset_minutes: 437,
    observer_max_start_skew_minutes: 10,
    source_substitution_authorized: false,
    time_relabeling_authorized: false,
    accelerated_formal_clock_authorized: false,
    expired_epoch_rescued: false,
    formal_database_write_count: 0,
    formal_raw_prefix_write_count: 0,
    scheduler_write_count: 0,
    canonical_runtime_write_count: 0,
    formal_window_started: false,
    ea5e3_authorized: false,
    next_legal_successor_if_live_proof_passes: "S6-EA5E2-OPERATIONAL-ACTIVATION-EVIDENCE-FREEZE-UNDER-AMENDMENT-08"
  });
}

try { main(); }
catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  let subject = null;
  try { subject = git("rev-parse", "HEAD"); } catch {}
  result({
    schema_version: "geox_mcft_cap09_ea5e2_operational_activation_runner_qualification_governance_result_v1",
    status: "FAIL",
    base_sha: process.env.MCFT_BASE_SHA ?? null,
    subject_sha: subject,
    error: message,
    fail_closed: true,
    runner_qualified: false,
    ea5e2_operational_activation_qualified: false,
    formal_database_write_count: 0,
    formal_raw_prefix_write_count: 0,
    scheduler_write_count: 0,
    canonical_runtime_write_count: 0,
    formal_window_started: false,
    ea5e3_authorized: false
  });
  process.exitCode = 1;
}
