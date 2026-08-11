#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const OUT = "acceptance-output/MCFT_CAP_09_EA5E2_FIXED_LAG_COLLECTOR_RUNTIME_SCHEDULE_READINESS_GOVERNANCE_RESULT.json";
const BASE = "f150b18a2ab9691fec64eaecb00105911857994c";
const AMENDMENT08 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-08-IMPLEMENTATION-ACTIVATION-QUALIFICATION-SEPARATION-AUTHORITY.md";
const AMENDMENT08_BLOB = "ef1e4344e5915e2c591cf7cfc9b6c2bf27f8bc3b";

function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function eq(actual, expected, code) { if (actual !== expected) throw new Error(`${code}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`); }
function yes(value, code) { eq(value, true, code); }
function no(value, code) { eq(value, false, code); }
function blob(ref, file) { return git("rev-parse", `${ref}:${file}`); }
function read(file) { return fs.readFileSync(file, "utf8"); }
function json(file) { return JSON.parse(read(file)); }
function show(ref, file) { return git("show", `${ref}:${file}`); }
function has(source, needle, code) { if (!source.includes(needle)) throw new Error(`${code}:${needle}`); }
function lacks(source, needle, code) { if (source.includes(needle)) throw new Error(`${code}:${needle}`); }
function writeResult(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(value));
}

const P = {
  workflow: ".github/workflows/mcft-cap-09-ea5e2-fixed-lag-collector-runtime-schedule-readiness.yml",
  collectorWorkflow: ".github/workflows/mcft-cap-09-ea5e2-collector-phase-orchestration.yml",
  liveWorkflow: ".github/workflows/mcft-cap-09-ea5e2-live-provider-two-phase-readiness.yml",
  canonicalizer: "apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts",
  orchestrator: "apps/server/src/external_evidence/mcft_cap09_external_formal_collector_phase_orchestrator_v1.ts",
  continuation: "apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.ts",
  assimilation: "apps/server/src/runtime/twin_runtime/assimilated_continuation_evidence_window_v2.ts",
  externalCandidate: "apps/server/src/runtime/twin_runtime/external_formal_cap04_candidate_execution_service_v1.ts",
  fixedLagScheduler: "apps/server/src/runtime/twin_runtime/fixed_lag_scheduler_adapter_v1.ts",
  dbSource: "apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.ts",
  schedule: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-FIXED-LAG-COLLECTOR-RUNTIME-SCHEDULE-V1.json",
  authority: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-COLLECTOR-RUNTIME-SCHEDULE-READINESS-V1.json",
  gate: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_FIXED_LAG_COLLECTOR_RUNTIME_SCHEDULE_READINESS.cjs",
  collectorAcceptance: "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_COLLECTOR_PHASE_ORCHESTRATION.ts",
  dbToCap04: "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_DATABASE_SOURCE_TO_EXTERNAL_CAP04.ts",
  cutoffAcceptance: "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_EXACT_INTERVAL_LATE_CUTOFF_SEAM.ts",
  dbSourceAcceptance: "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_EXTERNAL_FORMAL_DATABASE_EVIDENCE_SOURCE.ts",
  schedulerAcceptance: "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_FIXED_LAG_SCHEDULER_SEAM.ts",
  providerHelper: "scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py",
  localRunner: "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PHASE_LOCAL_DB.ts",
  privateRunner: "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts"
};

const IMMUTABLE = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md": "39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md": "7a92c17f7ba32aae52667de9c21db62bfd2ba70b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md": "e59e11e909bfd0a38c7298c5a6f909a6cd7afa49",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-07-EXTERNAL-FORMAL-FIXED-LAG-CAUSALITY-AUTHORITY.md": "c5a98ca789027e1bf051ec56bf1b7e76b98a0891",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-WINDOW-INPUT-MANIFEST-V1.json": "b47af64277330bb46a3fc1bb171dfcaaaf91abb1",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E1-POST-REBASE-FORMAL-DB-PREFLIGHT-AND-WINDOW-INPUT-MANIFEST-V1.json": "788d1f969aa335ee18db9186c5ec0578ee1a960a",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA2A-KBS-SOIL-CONTINUITY-USE-POLICY-V1.json": "6c6e623ff96917d5ca6410d5fd5acc0f3372689c",
  "apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.ts": "dfa2c10266a5079842012426aed175851d30ca44",
  "apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts": "6f7b6450d4f671c75affc2c7aba45ed71cb518c5",
  "apps/server/src/runtime/twin_runtime/external_formal_cap04_input_authority_v1.ts": "b4b7448518628bcffe8eaf6a91d9967145f7647d",
  "apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.ts": "6133206095ca3a98ab5e8ae514ee4610404d2edd",
  "apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts": "45cca8e03cf0641f2fbf45f3b3aca044f322989c",
  "apps/server/src/runtime/twin_runtime/postgres_frozen_shadow_online_evidence_source_v1.ts": "39a097a2343bd95dcc6b7621a4acc0e31772c563",
  "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py": "ff2ad210387402a74731968e14746210fd2440dd"
};

const CANDIDATE = {
  [P.workflow]: "4a656ae124ecb601a5453910185a31e878533322",
  [P.collectorWorkflow]: "73e8a4d63f628e292b39895ce76db7ef63b7854a",
  [P.liveWorkflow]: "f003dde9ff2f9319cb09be4809092f437215427c",
  [P.canonicalizer]: "3fad324baecd395b6511f5102e905127f50eda4a",
  [P.orchestrator]: "1be54411a4f283ece7a984e8a7edf974f6ad70ce",
  [P.continuation]: "a83437765f1c75860c5270b89446474787cde4c3",
  [P.assimilation]: "6699fb741cc0f61291f3d8c6e1e45ee0dcc79e36",
  [P.externalCandidate]: "71df4e47b0c62b7c6f2126e33896849af56273ca",
  [P.fixedLagScheduler]: "7525c4748c8d758ba04a198b8a6c00f1a9ffceb4",
  [P.dbSource]: "e5ed3c677bf55e4eee3cbb67a52e3b6886b8f259",
  [P.schedule]: "964fde5ad80dcf62a901184b0db3789858dfed85",
  [P.authority]: "60c00a9719436ff82980499813551ba9fa6ecf19",
  [P.collectorAcceptance]: "e1859170cc89a2d8fa98562b9a06833784141032",
  [P.dbToCap04]: "5d468312bc2905a54bcb1f477a5df7ca6c335631",
  [P.cutoffAcceptance]: "741fffeec8d976648e78a9f1cb2c888a1b423f01",
  [P.dbSourceAcceptance]: "e796ae2ad265b67f38960ee80d5664cb9ba768e0",
  [P.schedulerAcceptance]: "6be7604dc29940880d02f4bfc9722a13cc2af494",
  [P.providerHelper]: "150c3ae271d5572ea31133ce27b0fcccbf27c512",
  [P.localRunner]: "0e8125b4796e11469265d3353a267847117ecb3e",
  [P.privateRunner]: "7173707ace398fbeb8c1270900bab1a8785f518d"
};

function main() {
  const base = process.env.MCFT_BASE_SHA;
  eq(base, BASE, "EA5E2_AMENDMENT08_EXACT_BASE_REQUIRED");
  const subject = git("rev-parse", "HEAD");
  const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  eq(JSON.stringify(changed), JSON.stringify(Object.values(P).sort()), "EA5E2_EXACT_TWENTY_ONE_FILE_BOUNDARY_REQUIRED");

  eq(blob(base, AMENDMENT08), AMENDMENT08_BLOB, "EA5E2_AMENDMENT08_BASE_BLOB_REQUIRED");
  const amendment08 = show(base, AMENDMENT08);
  for (const marker of [
    "implementation_and_operational_activation_qualification_separated = true",
    "implementation_qualification_may_authorize_merge = true",
    "operational_activation_qualification_requires_protected_main = true",
    "kbs_raw_hourly_max_age_hours = 6",
    "scheduler_eligibility_lag_hours = 7",
    "runtime_observer_offset_minutes = 437",
    "current_selected_epoch_extended = false",
    "S6-EA5E2-IMPLEMENTATION-QUALIFICATION-REBASE-UNDER-AMENDMENT-08"
  ]) has(amendment08, marker, "EA5E2_AMENDMENT08_RULE_MISSING");

  for (const [file, sha] of Object.entries(IMMUTABLE)) {
    eq(blob(base, file), sha, `EA5E2_BASE_PIN:${file}`);
    eq(blob("HEAD", file), sha, `EA5E2_PREDECESSOR_MUTATED:${file}`);
  }
  eq(blob(base, P.canonicalizer), "5b4e5133e51dfaf447c2de52caf1a9f50c8254d3", "EA5E2_CANONICALIZER_BASE_PIN_REQUIRED");
  for (const [file, sha] of Object.entries(CANDIDATE)) eq(blob("HEAD", file), sha, `EA5E2_CANDIDATE_BLOB:${file}`);

  const schedule = json(P.schedule);
  eq(schedule.schema_version, "geox_mcft_cap09_ea5e2_fixed_lag_schedule_v1", "EA5E2_SCHEDULE_SCHEMA_REQUIRED");
  eq(schedule.epoch_id, "mcft_cap09_external_formal_window_epoch_20260811t170000z_v1", "EA5E2_HISTORICAL_EPOCH_REQUIRED");
  eq(schedule.slots.length, 24, "EA5E2_EXACT_24_SLOTS_REQUIRED");
  const sp = schedule.schedule_profile;
  eq(sp.scheduler_eligibility_lag_hours, 7, "EA5E2_LAG_REQUIRED");
  eq(sp.pre_boundary_collector_offset_minutes, -30, "EA5E2_PREBOUNDARY_OFFSET_REQUIRED");
  eq(sp.late_exact_hour_collector_offset_minutes, 390, "EA5E2_LATE_OFFSET_REQUIRED");
  eq(sp.late_exact_hour_evidence_cutoff_offset_minutes, 432, "EA5E2_CUTOFF_REQUIRED");
  eq(sp.runtime_observer_offset_minutes, 437, "EA5E2_OBSERVER_REQUIRED");
  eq(sp.minimum_ingestion_margin_minutes, 5, "EA5E2_MARGIN_REQUIRED");
  no(schedule.phase_rules.future_forcing_post_logical_time_availability_allowed, "EA5E2_POST_T_FUTURE_FORCING_FORBIDDEN");
  no(schedule.phase_rules.time_relabeling_allowed, "EA5E2_TIME_RELABELING_FORBIDDEN");
  no(schedule.phase_rules.source_substitution_allowed, "EA5E2_SOURCE_SUBSTITUTION_FORBIDDEN");

  const authority = json(P.authority);
  eq(authority.schema_version, "geox_mcft_cap09_ea5e2_collector_runtime_schedule_readiness_v2", "EA5E2_AUTHORITY_SCHEMA_REQUIRED");
  eq(authority.frontier_id, "S6-EA5E2-IMPLEMENTATION-QUALIFICATION-REBASE-UNDER-AMENDMENT-08", "EA5E2_AMENDMENT08_FRONTIER_REQUIRED");
  eq(authority.record_status, "EA5E2_IMPLEMENTATION_QUALIFICATION_CANDIDATE_NOT_EFFECTIVE", "EA5E2_IMPLEMENTATION_CANDIDATE_STATUS_REQUIRED");
  eq(authority.base_main_sha, base, "EA5E2_AUTHORITY_BASE_REQUIRED");
  eq(authority.governing_authority.amendment_08_blob_sha, AMENDMENT08_BLOB, "EA5E2_AMENDMENT08_BINDING_REQUIRED");
  yes(authority.amendment_08_qualification_policy.implementation_and_operational_activation_qualification_separated, "EA5E2_QUALIFICATION_SPLIT_REQUIRED");
  yes(authority.amendment_08_qualification_policy.implementation_qualification_may_authorize_merge, "EA5E2_IMPLEMENTATION_MERGE_AUTH_REQUIRED");
  yes(authority.amendment_08_qualification_policy.operational_activation_qualification_requires_protected_main, "EA5E2_ACTIVATION_ON_MAIN_REQUIRED");
  no(authority.amendment_08_qualification_policy.temporary_provider_freshness_failure_is_implementation_defect, "EA5E2_PROVIDER_FAILURE_NOT_IMPLEMENTATION_DEFECT_REQUIRED");
  yes(authority.amendment_08_qualification_policy.operational_activation_required_before_ea5e3, "EA5E2_ACTIVATION_BEFORE_EA5E3_REQUIRED");

  const ic = authority.implementation_qualification_contract;
  for (const key of [
    "exact_twenty_one_file_boundary_required",
    "repository_build_typecheck_acceptance_required",
    "fixed_lag_scheduler_implementation_required",
    "scheduler_default_zero_lag_preserved",
    "exact_interval_late_cutoff_implementation_required",
    "historical_replay_semantics_preserved",
    "raw_retention_before_decode_contract_required",
    "whole_phase_validation_before_ingress_required",
    "runtime_provider_fetch_forbidden",
    "runtime_database_evidence_only_required",
    "external_formal_database_source_read_only_required",
    "database_source_to_external_cap04_candidate_path_required",
    "exact_five_binding_families_required",
    "private_transient_r2_required",
    "public_ci_artifacts_hash_and_metadata_only",
    "formal_database_credentials_forbidden_in_provider_readiness"
  ]) yes(ic[key], `EA5E2_IMPLEMENTATION_CONTRACT_REQUIRED:${key}`);
  no(ic.future_forcing_post_logical_time_availability_allowed, "EA5E2_POST_T_FUTURE_FORCING_FORBIDDEN_AUTHORITY");
  no(ic.time_relabeling_allowed, "EA5E2_TIME_RELABELING_FORBIDDEN_AUTHORITY");
  no(ic.source_substitution_allowed, "EA5E2_SOURCE_SUBSTITUTION_FORBIDDEN_AUTHORITY");
  no(ic.canonical_persistence_authorized_in_ea5e2_implementation_qualification, "EA5E2_CANONICAL_PERSISTENCE_FORBIDDEN");
  eq(ic.external_formal_scheduler_lag_hours, 7, "EA5E2_AUTHORITY_LAG_REQUIRED");
  eq(ic.exact_interval_late_cutoff_offset_minutes, 432, "EA5E2_AUTHORITY_CUTOFF_REQUIRED");
  eq(ic.runtime_observer_offset_minutes, 437, "EA5E2_AUTHORITY_OBSERVER_REQUIRED");
  eq(ic.minimum_ingestion_margin_minutes, 5, "EA5E2_AUTHORITY_MARGIN_REQUIRED");
  eq(ic.public_value_bearing_artifact_count, 0, "EA5E2_PUBLIC_VALUE_ARTIFACT_ZERO_REQUIRED");
  eq(ic.public_raw_value_emission_count, 0, "EA5E2_PUBLIC_RAW_VALUE_ZERO_REQUIRED");
  for (const key of ["formal_database_write_count","formal_raw_object_write_count","scheduler_write_count","runtime_tick_count"]) eq(ic[key], 0, `EA5E2_ZERO_SIDE_EFFECT:${key}`);

  const oc = authority.operational_activation_contract;
  yes(oc.required_after_implementation_merge, "EA5E2_ACTIVATION_REQUIRED_AFTER_MERGE");
  yes(oc.must_run_against_exact_protected_main_sha, "EA5E2_ACTIVATION_EXACT_MAIN_REQUIRED");
  yes(oc.real_provider_gets_required, "EA5E2_REAL_PROVIDER_REQUIRED_FOR_ACTIVATION");
  yes(oc.provider_specific_same_t_two_phase_live_path_required, "EA5E2_TWO_PHASE_REQUIRED_FOR_ACTIVATION");
  eq(oc.kbs_raw_hourly_max_age_hours, 6, "EA5E2_KBS_SIX_HOUR_AUTHORITY_REQUIRED");
  eq(oc.scheduler_eligibility_lag_hours, 7, "EA5E2_ACTIVATION_LAG_REQUIRED");
  eq(oc.late_exact_hour_evidence_cutoff_offset_minutes, 432, "EA5E2_ACTIVATION_CUTOFF_REQUIRED");
  eq(oc.runtime_observer_offset_minutes, 437, "EA5E2_ACTIVATION_OBSERVER_REQUIRED");
  no(oc.source_substitution_allowed, "EA5E2_ACTIVATION_SOURCE_SUBSTITUTION_FORBIDDEN");
  no(oc.time_relabeling_allowed, "EA5E2_ACTIVATION_TIME_RELABELING_FORBIDDEN");
  no(oc.cross_cycle_substitution_allowed, "EA5E2_ACTIVATION_CROSS_CYCLE_FORBIDDEN");
  no(oc.accelerated_formal_clock_allowed, "EA5E2_ACTIVATION_ACCELERATED_CLOCK_FORBIDDEN");
  no(oc.current_historical_epoch_may_be_rescued, "EA5E2_CURRENT_EPOCH_RESCUE_FORBIDDEN");

  const historical = authority.historical_external_live_evidence;
  eq(historical.subject_sha, "47baa2d05267ef0a1b41e4ec29762084ce2ebfc9", "EA5E2_HISTORICAL_LIVE_SUBJECT_REQUIRED");
  eq(historical.fixed_lag_run_id, 31415198370, "EA5E2_HISTORICAL_FIXED_LAG_RUN_REQUIRED");
  eq(historical.two_phase_run_id, 31415197755, "EA5E2_HISTORICAL_TWO_PHASE_RUN_REQUIRED");
  eq(historical.artifact_id, 9073186656, "EA5E2_HISTORICAL_ARTIFACT_REQUIRED");
  eq(historical.authority_max_age_hours, 6, "EA5E2_HISTORICAL_THRESHOLD_REQUIRED");
  eq(historical.classification, "EXTERNAL_PROVIDER_FRESHNESS_FAIL_CLOSED_NOT_OPERATIONAL_ACTIVATION_PASS", "EA5E2_HISTORICAL_FAIL_CLOSED_CLASS_REQUIRED");
  no(historical.freshness_threshold_changed, "EA5E2_HISTORICAL_THRESHOLD_CHANGE_FORBIDDEN");
  no(historical.source_substitution_performed, "EA5E2_HISTORICAL_SOURCE_SUBSTITUTION_FORBIDDEN");
  eq(historical.formal_write_count, 0, "EA5E2_HISTORICAL_FORMAL_WRITE_ZERO_REQUIRED");

  const canonicalizer = read(P.canonicalizer);
  const orchestrator = read(P.orchestrator);
  const scheduler = read(P.fixedLagScheduler);
  const dbSource = read(P.dbSource);
  const privateRunner = read(P.privateRunner);
  const focusedWorkflow = read(P.workflow);
  has(canonicalizer, "collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1", "EA5E2_COMPLETION_CLOCK_REQUIRED");
  has(canonicalizer, "retainRawEvidence", "EA5E2_RETENTION_BEFORE_DECODE_REQUIRED");
  has(orchestrator, "Whole-phase validation is complete before the first canonical ingress call.", "EA5E2_WHOLE_PHASE_BARRIER_REQUIRED");
  has(scheduler, "external_formal_eligibility_lag_hours: 7", "EA5E2_EXTERNAL_PROFILE_SEVEN_HOUR_LAG_REQUIRED");
  has(scheduler, "eligibleAtMs = logicalMs + this.eligibilityLagHours * HOUR_MS", "EA5E2_ELIGIBILITY_ARITHMETIC_REQUIRED");
  has(dbSource, "provider_request_count: 0", "EA5E2_DB_PROVIDER_ZERO_REQUIRED");
  lacks(dbSource, "node:http", "EA5E2_DB_HTTP_FORBIDDEN");
  lacks(dbSource, "node:https", "EA5E2_DB_HTTPS_FORBIDDEN");
  lacks(dbSource, "fetch(", "EA5E2_DB_FETCH_FORBIDDEN");
  has(privateRunner, "mcft-cap09-ea5e2-readiness-transient-v1", "EA5E2_TRANSIENT_IMPLEMENTATION_REQUIRED");
  has(privateRunner, "mcft-cap09-formal-raw-v1/sha256", "EA5E2_FORMAL_PREFIX_GUARD_REQUIRED");
  lacks(privateRunner, "GEOX_MCFT_CAP09_S6_DATABASE_URL", "EA5E2_FORMAL_DB_SECRET_FORBIDDEN");
  lacks(privateRunner, "pg_dump", "EA5E2_PGDUMP_FORBIDDEN");

  has(focusedWorkflow, "Validate EA5E2 implementation qualification under Amendment-08", "EA5E2_IMPLEMENTATION_GATE_STEP_REQUIRED");
  has(focusedWorkflow, "Upload immutable EA5E2 implementation qualification proof", "EA5E2_IMPLEMENTATION_ARTIFACT_REQUIRED");
  lacks(focusedWorkflow, "EA5E2_READINESS_DEADLINE_ALREADY_PASSED", "EA5E2_EXPIRED_EPOCH_MERGE_GATE_FORBIDDEN");
  lacks(focusedWorkflow, "Exact-head live KBS and GFS readiness reproof", "EA5E2_LIVE_PROVIDER_MERGE_GATE_FORBIDDEN");
  lacks(focusedWorkflow, "urllib.request", "EA5E2_PROVIDER_NETWORK_MERGE_GATE_FORBIDDEN");

  const effect = authority.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main;
  yes(effect.ea5e2_implementation_qualified, "EA5E2_IMPLEMENTATION_QUALIFIED_REQUIRED");
  yes(effect.implementation_merge_authorized, "EA5E2_IMPLEMENTATION_MERGE_AUTHORIZED_REQUIRED");
  no(effect.ea5e2_operational_activation_qualified, "EA5E2_OPERATIONAL_ACTIVATION_PREMATURE");
  no(effect.ea5e3_formal_authority_v3_authorized, "EA5E3_AUTHORIZATION_PREMATURE");
  no(effect.ea5e3_effective, "EA5E3_PREMATURE_EFFECT");
  no(effect.ea5e_complete, "EA5E_PREMATURE_COMPLETE");
  no(effect.formal_o00_start_authorized, "EA5E2_O00_FORBIDDEN");
  no(effect.formal_window_started, "EA5E2_WINDOW_FORBIDDEN");
  eq(effect.formal_execution_count, "0/24", "EA5E2_ZERO_EXECUTION");
  no(effect.mcft_cap09_completed, "EA5E2_CAP09_COMPLETE_FORBIDDEN");
  eq(authority.next_legal_successor_if_effective, "S6-EA5E2-OPERATIONAL-ACTIVATION-QUALIFICATION-UNDER-AMENDMENT-08", "EA5E2_NEXT_SUCCESSOR_REQUIRED");

  writeResult({
    schema_version:"geox_mcft_cap09_ea5e2_implementation_qualification_governance_result_v1",
    status:"PASS",
    base_sha:base,
    subject_sha:subject,
    exact_changed_file_count:changed.length,
    exact_boundary:"TWENTY_ONE_FILES",
    amendment_08_bound:true,
    ea5e2_implementation_qualified:true,
    implementation_merge_authorized:true,
    ea5e2_operational_activation_qualified:false,
    operational_activation_requires_exact_protected_main_sha:true,
    kbs_raw_hourly_max_age_hours:6,
    scheduler_lag_hours:7,
    exact_interval_cutoff_minutes:432,
    runtime_observer_offset_minutes:437,
    minimum_ingestion_margin_minutes:5,
    current_historical_epoch_rescued:false,
    formal_database_write_count:0,
    formal_raw_prefix_write_count:0,
    scheduler_write_count:0,
    canonical_runtime_write_count:0,
    formal_window_started:false,
    ea5e3_authorized:false,
    ea5e3_effective:false,
    mcft_cap09_completed:false,
    next_legal_successor:"S6-EA5E2-OPERATIONAL-ACTIVATION-QUALIFICATION-UNDER-AMENDMENT-08"
  });
}

try { main(); }
catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  let subject = null; try { subject = git("rev-parse", "HEAD"); } catch {}
  writeResult({
    schema_version:"geox_mcft_cap09_ea5e2_implementation_qualification_governance_result_v1",
    status:"FAIL",
    base_sha:process.env.MCFT_BASE_SHA??null,
    subject_sha:subject,
    error:message,
    fail_closed:true,
    ea5e2_implementation_qualified:false,
    ea5e2_operational_activation_qualified:false,
    formal_database_write_count:0,
    formal_raw_prefix_write_count:0,
    scheduler_write_count:0,
    canonical_runtime_write_count:0,
    formal_window_started:false,
    ea5e3_authorized:false,
    ea5e3_effective:false,
    mcft_cap09_completed:false
  });
  process.exitCode = 1;
}
