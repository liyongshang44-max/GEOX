#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const OUT = "acceptance-output/MCFT_CAP_09_EA5E2_FIXED_LAG_COLLECTOR_RUNTIME_SCHEDULE_READINESS_GOVERNANCE_RESULT.json";
const BASE = "4fc792398bcc25243af7c63734fe59beec9b0dcc";

function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function eq(actual, expected, code) { if (actual !== expected) throw new Error(`${code}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`); }
function yes(value, code) { eq(value, true, code); }
function no(value, code) { eq(value, false, code); }
function blob(ref, file) { return git("rev-parse", `${ref}:${file}`); }
function read(file) { return fs.readFileSync(file, "utf8"); }
function json(file) { return JSON.parse(read(file)); }
function has(source, needle, code) { if (!source.includes(needle)) throw new Error(`${code}:${needle}`); }
function lacks(source, needle, code) { if (source.includes(needle)) throw new Error(`${code}:${needle}`); }
function before(source, left, right, code) { const a=source.indexOf(left), b=source.indexOf(right); if (a<0 || b<0 || a>=b) throw new Error(`${code}:${left} !< ${right}`); }
function writeResult(value) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + "\n", "utf8"); console.log(JSON.stringify(value)); }

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
  "apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.ts": "1cc2726aace39524e84fda9762f86a3fc2e96408",
  "apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts": "6f7b6450d4f671c75affc2c7aba45ed71cb518c5",
  "apps/server/src/runtime/twin_runtime/external_formal_cap04_input_authority_v1.ts": "b4b7448518628bcffe8eaf6a91d9967145f7647d",
  "apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.ts": "6133206095ca3a98ab5e8ae514ee4610404d2edd",
  "apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts": "45cca8e03cf0641f2fbf45f3b3aca044f322989c",
  "apps/server/src/runtime/twin_runtime/postgres_frozen_shadow_online_evidence_source_v1.ts": "39a097a2343bd95dcc6b7621a4acc0e31772c563",
  "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py": "ff2ad210387402a74731968e14746210fd2440dd"
};

const CANDIDATE = {
  [P.workflow]: "0737be9a1edcb3a9a9caeb81e444665314c13c8d",
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
  [P.authority]: "0d4c61e9aa6fb0d3abf4ec4a9121f107376ace24",
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
  eq(base, BASE, "EA5E2_EXACT_BASE_REQUIRED");
  const subject = git("rev-parse", "HEAD");
  const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  eq(JSON.stringify(changed), JSON.stringify(Object.values(P).sort()), "EA5E2_EXACT_TWENTY_ONE_FILE_BOUNDARY_REQUIRED");

  for (const [file, sha] of Object.entries(IMMUTABLE)) {
    eq(blob(base, file), sha, `EA5E2_BASE_PIN:${file}`);
    eq(blob("HEAD", file), sha, `EA5E2_PREDECESSOR_MUTATED:${file}`);
  }
  eq(blob(base, P.canonicalizer), "5b4e5133e51dfaf447c2de52caf1a9f50c8254d3", "EA5E2_CANONICALIZER_BASE_PIN_REQUIRED");
  for (const [file, sha] of Object.entries(CANDIDATE)) eq(blob("HEAD", file), sha, `EA5E2_CANDIDATE_BLOB:${file}`);

  const schedule = json(P.schedule);
  eq(schedule.schema_version, "geox_mcft_cap09_ea5e2_fixed_lag_schedule_v1", "EA5E2_SCHEDULE_SCHEMA_REQUIRED");
  eq(schedule.epoch_id, "mcft_cap09_external_formal_window_epoch_20260811t170000z_v1", "EA5E2_EPOCH_REQUIRED");
  eq(schedule.slots.length, 24, "EA5E2_EXACT_24_SLOTS_REQUIRED");
  eq(schedule.window_input_manifest_blob_sha, IMMUTABLE["docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-WINDOW-INPUT-MANIFEST-V1.json"], "EA5E2_MANIFEST_BINDING_REQUIRED");
  const sp = schedule.schedule_profile;
  eq(sp.scheduler_eligibility_lag_hours, 7, "EA5E2_LAG_REQUIRED");
  eq(sp.pre_boundary_collector_offset_minutes, -30, "EA5E2_PREBOUNDARY_OFFSET_REQUIRED");
  eq(sp.late_exact_hour_collector_offset_minutes, 390, "EA5E2_LATE_OFFSET_REQUIRED");
  eq(sp.late_exact_hour_evidence_cutoff_offset_minutes, 432, "EA5E2_CUTOFF_REQUIRED");
  eq(sp.runtime_observer_offset_minutes, 437, "EA5E2_OBSERVER_REQUIRED");
  eq(sp.minimum_ingestion_margin_minutes, 5, "EA5E2_MARGIN_REQUIRED");
  const o00 = Date.parse("2026-08-11T17:00:00.000Z");
  for (let i = 0; i < 24; i += 1) {
    const s = schedule.slots[i], t = o00 + i * 3600000;
    eq(s.slot_id, `O${String(i).padStart(2, "0")}`, `EA5E2_SLOT_ID:${i}`);
    eq(Date.parse(s.logical_time), t, `EA5E2_SLOT_TIME:${i}`);
    eq(Date.parse(s.pre_boundary_causal_collector_target), t - 30 * 60000, `EA5E2_PRE_TIME:${i}`);
    eq(Date.parse(s.late_exact_hour_collector_scheduled), t + 390 * 60000, `EA5E2_LATE_TIME:${i}`);
    eq(Date.parse(s.scheduler_eligibility_time), t + 420 * 60000, `EA5E2_ELIGIBILITY:${i}`);
    eq(Date.parse(s.late_exact_hour_evidence_cutoff), t + 432 * 60000, `EA5E2_CUTOFF_TIME:${i}`);
    eq(Date.parse(s.runtime_observer_nominal_time), t + 437 * 60000, `EA5E2_OBSERVER_TIME:${i}`);
  }
  no(schedule.phase_rules.future_forcing_post_logical_time_availability_allowed, "EA5E2_POST_T_FUTURE_FORCING_FORBIDDEN");
  no(schedule.phase_rules.time_relabeling_allowed, "EA5E2_TIME_RELABELING_FORBIDDEN");
  no(schedule.phase_rules.source_substitution_allowed, "EA5E2_SOURCE_SUBSTITUTION_FORBIDDEN");

  const authority = json(P.authority);
  eq(authority.record_status, "EA5E2_FIXED_LAG_SCHEDULE_READINESS_CANDIDATE_NOT_EFFECTIVE", "EA5E2_CANDIDATE_STATUS_REQUIRED");
  eq(authority.base_main_sha, base, "EA5E2_AUTHORITY_BASE_REQUIRED");
  eq(authority.schedule_authority.schedule_blob_sha, CANDIDATE[P.schedule], "EA5E2_AUTHORITY_SCHEDULE_BLOB_REQUIRED");
  eq(authority.governing_authority.ea2a_kbs_use_policy_blob_sha, IMMUTABLE["docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA2A-KBS-SOIL-CONTINUITY-USE-POLICY-V1.json"], "EA5E2_EA2A_PIN_REQUIRED");
  const ib = authority.implementation_path_exact_blobs;
  const ibExpected = {
    external_collector_canonicalizer: CANDIDATE[P.canonicalizer],
    durable_raw_retention_adapter: IMMUTABLE["apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.ts"],
    restricted_formal_evidence_ingress: IMMUTABLE["apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts"],
    fixed_lag_collector_phase_orchestrator: CANDIDATE[P.orchestrator],
    provider_specific_raw_first_helper: CANDIDATE[P.providerHelper],
    isolated_live_provider_phase_runner: CANDIDATE[P.localRunner],
    private_transient_r2_live_provider_phase_runner: CANDIDATE[P.privateRunner],
    collector_phase_static_workflow: CANDIDATE[P.collectorWorkflow],
    real_provider_two_phase_readiness_workflow: CANDIDATE[P.liveWorkflow],
    external_formal_database_evidence_source: CANDIDATE[P.dbSource],
    historical_s2_database_evidence_reader_unchanged: IMMUTABLE["apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts"],
    historical_s5_selected_evidence_readback_unchanged: IMMUTABLE["apps/server/src/runtime/twin_runtime/postgres_frozen_shadow_online_evidence_source_v1.ts"],
    external_cap04_input_authority: IMMUTABLE["apps/server/src/runtime/twin_runtime/external_formal_cap04_input_authority_v1.ts"],
    continuation_evidence_window_late_cutoff_seam: CANDIDATE[P.continuation],
    assimilated_continuation_cutoff_threading: CANDIDATE[P.assimilation],
    external_cap04_candidate_execution_service: CANDIDATE[P.externalCandidate],
    persistent_sequential_scheduler_adapter: IMMUTABLE["apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.ts"],
    fixed_lag_scheduler_adapter: CANDIDATE[P.fixedLagScheduler],
    live_provider_probe: IMMUTABLE["scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py"]
  };
  for (const [key, value] of Object.entries(ibExpected)) eq(ib[key], value, `EA5E2_IMPLEMENTATION_BLOB:${key}`);

  const rc = authority.readiness_proof_contract;
  for (const key of ["real_provider_gets_required","provider_specific_same_t_two_phase_live_path_required","live_kbs_reproof_required","live_gfs_72h_same_cycle_reproof_required","raw_retention_before_decode_contract_required","restricted_append_only_formal_ingress_contract_required","actual_postgres_restricted_ingress_adapter_required","runtime_provider_fetch_forbidden","runtime_database_evidence_only_required","external_formal_database_source_read_only_required","database_source_to_external_cap04_candidate_path_required","exact_five_binding_families_required","exact_ea5e1_config_manifest_binding_required","two_phase_same_slot_composition_required","whole_phase_validation_before_ingress_required","collector_phase_family_partition_required","pre_boundary_soil_must_be_inside_t_minus_15m_to_t","future_weather_and_et0_same_gfs_cycle_required","exact_late_kbs_target_row_required","minimum_ingestion_margin_fail_closed","isolated_readiness_database_localhost_only","private_transient_r2_required","existing_private_r2_account_binding_may_be_reused_for_transient_prefix","formal_database_credentials_forbidden_in_provider_readiness","public_ci_artifacts_hash_and_metadata_only","retained_raw_semantic_rehydration_required","transient_private_r2_put_get_delete_smoke_required","transient_private_r2_cleanup_required","transient_cleanup_must_cover_nested_downloaded_metadata","scheduler_fixed_lag_implementation_required","scheduler_default_zero_lag_preserved","exact_interval_late_cutoff_implementation_required","delayed_database_evidence_must_reach_completed_a1_candidate","non_exact_interval_evidence_cutoff_remains_logical_time"]) yes(rc[key], `EA5E2_CONTRACT_REQUIRED:${key}`);
  no(rc.historical_s2_s5_database_readers_mutated, "EA5E2_HISTORICAL_READER_MUTATION_FORBIDDEN");
  no(rc.canonical_persistence_authorized_in_ea5e2, "EA5E2_CANONICAL_PERSISTENCE_FORBIDDEN");
  no(rc.future_forcing_post_logical_time_availability_allowed, "EA5E2_POST_T_FUTURE_FORCING_FORBIDDEN_AUTHORITY");
  no(rc.time_relabeling_allowed, "EA5E2_TIME_RELABELING_FORBIDDEN_AUTHORITY");
  no(rc.source_substitution_allowed, "EA5E2_SOURCE_SUBSTITUTION_FORBIDDEN_AUTHORITY");
  eq(rc.private_transient_r2_prefix, "mcft-cap09-ea5e2-readiness-transient-v1", "EA5E2_TRANSIENT_PREFIX_REQUIRED");
  eq(rc.formal_raw_prefix, "mcft-cap09-formal-raw-v1/sha256", "EA5E2_FORMAL_RAW_PREFIX_REQUIRED");
  eq(rc.minimum_ingestion_margin_minutes, 5, "EA5E2_AUTHORITY_MARGIN_REQUIRED");
  eq(rc.external_formal_scheduler_lag_hours, 7, "EA5E2_AUTHORITY_LAG_REQUIRED");
  eq(rc.exact_interval_late_cutoff_offset_minutes, 432, "EA5E2_AUTHORITY_CUTOFF_REQUIRED");
  eq(rc.runtime_observer_offset_minutes, 437, "EA5E2_AUTHORITY_OBSERVER_REQUIRED");
  eq(rc.completed_a1_candidate_forecast_point_count, 72, "EA5E2_AUTHORITY_FORECAST_POINTS_REQUIRED");
  eq(rc.formal_raw_prefix_write_count, 0, "EA5E2_FORMAL_RAW_PREFIX_ZERO_REQUIRED");
  eq(rc.public_value_bearing_artifact_count, 0, "EA5E2_PUBLIC_VALUE_ARTIFACT_ZERO_REQUIRED");
  eq(rc.public_raw_value_emission_count, 0, "EA5E2_PUBLIC_RAW_VALUE_ZERO_REQUIRED");
  eq(rc.pre_rehydration_provider_refetch_count, 0, "EA5E2_REHYDRATION_PROVIDER_REFETCH_ZERO_REQUIRED");
  for (const key of ["formal_database_write_count","formal_raw_object_write_count","scheduler_write_count","runtime_tick_count"]) eq(rc[key], 0, `EA5E2_ZERO_SIDE_EFFECT:${key}`);

  const canonicalizer = read(P.canonicalizer), orchestrator = read(P.orchestrator), scheduler = read(P.fixedLagScheduler), dbSource = read(P.dbSource), privateRunner = read(P.privateRunner), liveWorkflow = read(P.liveWorkflow), collectorWorkflow = read(P.collectorWorkflow), fixedWorkflow = read(P.workflow);
  has(canonicalizer, "collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1", "EA5E2_COMPLETION_CLOCK_REQUIRED");
  has(canonicalizer, "retainRawEvidence", "EA5E2_RETENTION_BEFORE_DECODE_REQUIRED");
  has(orchestrator, "ingestCanonicalizedPhase", "EA5E2_PRECANONICAL_PHASE_INGRESS_REQUIRED");
  has(orchestrator, "Whole-phase validation is complete before the first canonical ingress call.", "EA5E2_WHOLE_PHASE_BARRIER_REQUIRED");
  has(scheduler, "external_formal_eligibility_lag_hours: 7", "EA5E2_EXTERNAL_PROFILE_SEVEN_HOUR_LAG_REQUIRED");
  has(scheduler, "eligibility_lag_hours: FIXED_LAG_SCHEDULER_PROFILE_V1.external_formal_eligibility_lag_hours", "EA5E2_EXTERNAL_FACTORY_PROFILE_BINDING_REQUIRED");
  has(scheduler, "const HOUR_MS = 3_600_000", "EA5E2_HOUR_MS_REQUIRED");
  has(scheduler, "eligibleAtMs = logicalMs + this.eligibilityLagHours * HOUR_MS", "EA5E2_ELIGIBILITY_ARITHMETIC_REQUIRED");
  has(dbSource, "provider_request_count: 0", "EA5E2_DB_PROVIDER_ZERO_REQUIRED");
  lacks(dbSource, "node:http", "EA5E2_DB_HTTP_FORBIDDEN"); lacks(dbSource, "node:https", "EA5E2_DB_HTTPS_FORBIDDEN"); lacks(dbSource, "fetch(", "EA5E2_DB_FETCH_FORBIDDEN");
  has(privateRunner, "mcft-cap09-ea5e2-readiness-transient-v1", "EA5E2_TRANSIENT_IMPLEMENTATION_REQUIRED");
  has(privateRunner, "mcft-cap09-formal-raw-v1/sha256", "EA5E2_FORMAL_PREFIX_GUARD_REQUIRED");
  has(privateRunner, "EA5E2_FORMAL_RAW_PREFIX_WRITE_FORBIDDEN", "EA5E2_FORMAL_PREFIX_FAIL_CLOSED_REQUIRED");
  has(privateRunner, "TRANSIENT_STORE_SMOKE", "EA5E2_SMOKE_REQUIRED"); has(privateRunner, "CLEANUP_TRANSIENT", "EA5E2_CLEANUP_REQUIRED"); has(privateRunner, "readRetainedRawEvidence", "EA5E2_PRIVATE_READBACK_REQUIRED"); has(privateRunner, "EA5E2_REHYDRATION_SEMANTIC_HASH_MISMATCH", "EA5E2_REHYDRATION_HASH_REQUIRED"); has(privateRunner, "pre_rehydration_provider_request_count: 0", "EA5E2_REHYDRATION_PROVIDER_ZERO_REQUIRED"); has(privateRunner, "EA5E2_READINESS_DATABASE_MUST_BE_LOCALHOST", "EA5E2_LOCAL_DB_GUARD_REQUIRED"); lacks(privateRunner, "GEOX_MCFT_CAP09_S6_DATABASE_URL", "EA5E2_FORMAL_DB_SECRET_FORBIDDEN"); lacks(privateRunner, "pg_dump", "EA5E2_PGDUMP_FORBIDDEN");
  has(liveWorkflow, "Upload metadata-only inter-phase proof", "EA5E2_METADATA_ONLY_INTERPHASE_REQUIRED"); has(liveWorkflow, "Flatten metadata-only JSONs for exact-head cleanup discovery", "EA5E2_NESTED_CLEANUP_REQUIRED"); lacks(liveWorkflow, "pg_dump", "EA5E2_WORKFLOW_PGDUMP_FORBIDDEN"); lacks(liveWorkflow, ".dump", "EA5E2_WORKFLOW_DUMP_FORBIDDEN"); lacks(liveWorkflow, "gfs-raw-bundle.tar", "EA5E2_PUBLIC_RAW_ARTIFACT_FORBIDDEN"); before(liveWorkflow, "Prove private transient R2 round trip and cleanup with non-provider random bytes", "Fail fast unless KBS Raw Hourly is currently within unchanged authority", "EA5E2_SMOKE_BEFORE_KBS_REQUIRED"); before(liveWorkflow, "Fail fast unless KBS Raw Hourly is currently within unchanged authority", "Select one real future target T with EA5E3 completion margin", "EA5E2_KBS_BEFORE_TARGET_REQUIRED"); before(liveWorkflow, "Flatten metadata-only JSONs for exact-head cleanup discovery", "Delete every exact-head transient R2 object found in safe metadata", "EA5E2_CLEANUP_BEFORE_DELETE_REQUIRED");
  has(collectorWorkflow, P.privateRunner, "EA5E2_PRIVATE_RUNNER_TRIGGER_REQUIRED"); has(collectorWorkflow, "Typecheck both isolated live provider phase runners", "EA5E2_BOTH_RUNNERS_TYPECHECK_REQUIRED");
  has(fixedWorkflow, "Validate EA5E2 fixed-lag schedule and implementation readiness before live source gate", "EA5E2_GOVERNANCE_PRELIVE_REQUIRED"); has(fixedWorkflow, "Exact-head live KBS and GFS readiness reproof", "EA5E2_LIVE_REPROOF_REQUIRED"); before(fixedWorkflow, "Validate EA5E2 fixed-lag schedule and implementation readiness before live source gate", "Exact-head live KBS and GFS readiness reproof", "EA5E2_GOVERNANCE_MUST_PRECEDE_LIVE");

  const effect = authority.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main;
  yes(effect.ea5e2_collector_runtime_schedule_readiness_effective, "EA5E2_EFFECTIVE_REQUIRED"); yes(effect.private_transient_readiness_carrier_effective, "EA5E2_PRIVATE_CARRIER_REQUIRED"); yes(effect.ea5e3_formal_authority_v3_authorized, "EA5E2_SUCCESSOR_AUTH_REQUIRED"); no(effect.ea5e3_effective, "EA5E3_PREMATURE_EFFECT"); no(effect.ea5e_complete, "EA5E_PREMATURE_COMPLETE"); no(effect.formal_o00_start_authorized, "EA5E2_O00_FORBIDDEN"); no(effect.formal_window_started, "EA5E2_WINDOW_FORBIDDEN"); eq(effect.formal_execution_count, "0/24", "EA5E2_ZERO_EXECUTION"); no(effect.mcft_cap09_completed, "EA5E2_CAP09_COMPLETE_FORBIDDEN");

  writeResult({schema_version:"geox_mcft_cap09_ea5e2_fixed_lag_collector_runtime_schedule_readiness_governance_result_v1",status:"PASS",base_sha:base,subject_sha:subject,exact_changed_file_count:changed.length,exact_boundary:"TWENTY_ONE_FILES",governance_proved_before_live_source_gate:true,scheduler_lag_hours:7,exact_interval_cutoff_minutes:432,runtime_observer_offset_minutes:437,private_transient_r2_prefix:"mcft-cap09-ea5e2-readiness-transient-v1",formal_raw_prefix_write_count:0,public_value_bearing_artifact_count:0,pre_rehydration_provider_refetch_count:0,transient_cleanup_required:true,formal_database_write_count:0,scheduler_write_count:0,canonical_runtime_write_count:0,formal_window_started:false,ea5e3_effective:false,mcft_cap09_completed:false});
}

try { main(); }
catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  let subject = null; try { subject = git("rev-parse", "HEAD"); } catch {}
  writeResult({schema_version:"geox_mcft_cap09_ea5e2_fixed_lag_collector_runtime_schedule_readiness_governance_result_v1",status:"FAIL",base_sha:process.env.MCFT_BASE_SHA??null,subject_sha:subject,error:message,fail_closed:true,formal_database_write_count:0,formal_raw_prefix_write_count:0,public_value_bearing_artifact_count:0,scheduler_write_count:0,canonical_runtime_write_count:0,formal_window_started:false,ea5e3_effective:false,mcft_cap09_completed:false});
  process.exitCode = 1;
}
