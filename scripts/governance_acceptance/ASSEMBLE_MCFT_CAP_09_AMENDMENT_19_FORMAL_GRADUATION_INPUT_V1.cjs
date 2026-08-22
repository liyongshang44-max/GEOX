#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const AUTHORITY_PATH = path.join(
  ROOT,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-19-ACCELERATED-GRADUATION-GATE-V1.json",
);
const DEFAULT_OUT = path.join(
  ROOT,
  "acceptance-output/MCFT_CAP_09_AMENDMENT_19_FORMAL_GRADUATION_INPUT_V1.json",
);
const EXPECTED_CORE_PATH = "apps/server/src/runtime/twin_runtime/external_formal_amendment19_canonical_tick_core_v1.ts";
const EXPECTED_CORE_SYMBOL = "executeExternalFormalAmendment19CanonicalTickV1";
const EXPECTED_TEMPORAL_AUTHORITY = "PROVIDER_AVAILABILITY_WATERMARK_V1";
const EXPECTED_CLOCK_SCOPE = "REPLACE_WAIT_UNTIL_NEXT_PT1H_BOUNDARY_ONLY";
const REQUIRED_STATUS_KEYS = [
  "PERSISTENCE_FREE_24T",
  "PERSISTENT_24T",
  "O00_WARM_START",
  "MODE_A",
  "MODE_B",
  "PARTIAL_PAIR",
  "LATE_EXACT_NO_REWRITE",
  "RESTART",
  "MISSED_SLOT_BACKFILL",
  "IDEMPOTENCY",
  "ZERO_PROVIDER_WAIT",
  "SCHEMA_ENV_PREFLIGHT",
  "FULL_CHAIN_READBACK",
];

function fail(code) { throw new Error(code); }
function need(value, code) { if (!value) fail(code); }
function readJson(file) {
  if (!fs.existsSync(file)) fail(`AM19_GRADUATION_ASSEMBLY_INPUT_NOT_FOUND:${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function canonicalSubject(value) {
  const subject = String(value || "").trim();
  if (!/^[0-9a-f]{40}$/.test(subject)) fail("AM19_GRADUATION_ASSEMBLY_EXACT_SUBJECT_SHA_REQUIRED");
  return subject;
}
function exactRecordTypes(value) {
  const expected = ["future_et0_assumption_v1", "future_weather_assumption_v1", "soil_moisture_observation_v1"];
  return Array.isArray(value) && JSON.stringify([...value].sort()) === JSON.stringify(expected);
}

function assemble(authority, persistent, persistenceFree, rehydration, cutover, subject) {
  subject = canonicalSubject(subject);
  const gate = authority?.formal_epoch_creation_machine_gate;
  need(gate && gate.human_override_authorized === false, "AM19_GRADUATION_ASSEMBLY_AUTHORITY_NO_OVERRIDE_REQUIRED");
  need(gate.all_required_statuses_must_be_terminal_pass === true, "AM19_GRADUATION_ASSEMBLY_AUTHORITY_ALL_PASS_REQUIRED");
  need(gate.static_blocker_count_required === 0, "AM19_GRADUATION_ASSEMBLY_AUTHORITY_ZERO_BLOCKER_REQUIRED");
  need(JSON.stringify(Object.keys(gate.required_statuses || {})) === JSON.stringify(REQUIRED_STATUS_KEYS), "AM19_GRADUATION_ASSEMBLY_AUTHORITY_STATUS_SET_DRIFT");
  for (const key of REQUIRED_STATUS_KEYS) need(gate.required_statuses[key] === "PASS", `AM19_GRADUATION_ASSEMBLY_AUTHORITY_STATUS_NOT_PASS:${key}`);

  need(authority?.canonical_core_binding?.core_path === EXPECTED_CORE_PATH, "AM19_GRADUATION_ASSEMBLY_AUTHORITY_CORE_PATH_DRIFT");
  need(authority?.canonical_core_binding?.core_symbol === EXPECTED_CORE_SYMBOL, "AM19_GRADUATION_ASSEMBLY_AUTHORITY_CORE_SYMBOL_DRIFT");
  need(authority?.canonical_core_binding?.persistence_free_engineering_must_call_core_directly === true, "AM19_GRADUATION_ASSEMBLY_ENGINEERING_DIRECT_CORE_AUTHORITY_REQUIRED");
  need(authority?.canonical_core_binding?.future_production_persistent_path_must_call_same_core_symbol === true, "AM19_GRADUATION_ASSEMBLY_PRODUCTION_SAME_CORE_AUTHORITY_REQUIRED");
  need(authority?.canonical_core_binding?.different_semantic_core_between_engineering_and_production_forbidden === true, "AM19_GRADUATION_ASSEMBLY_DIFFERENT_CORE_FORBIDDEN");
  need(authority?.persistent_accelerated_equivalence?.allowed_clock_difference_only === true, "AM19_GRADUATION_ASSEMBLY_CLOCK_ONLY_AUTHORITY_REQUIRED");
  need(authority?.persistent_accelerated_equivalence?.accelerated_clock_role === EXPECTED_CLOCK_SCOPE, "AM19_GRADUATION_ASSEMBLY_CLOCK_ROLE_DRIFT");
  need(authority?.persistent_accelerated_equivalence?.production_execution_graph_replacement_by_test_harness_forbidden === true, "AM19_GRADUATION_ASSEMBLY_GRAPH_REPLACEMENT_FORBIDDEN");
  need(authority?.final_wall_clock_graduation_test?.still_required === true, "AM19_GRADUATION_ASSEMBLY_FINAL_24H_REQUIRED");
  need(authority?.final_wall_clock_graduation_test?.actual_utc_boundaries === 24, "AM19_GRADUATION_ASSEMBLY_FINAL_24_BOUNDARIES_REQUIRED");
  need(authority?.final_wall_clock_graduation_test?.accelerated_lane_is_substitute === false, "AM19_GRADUATION_ASSEMBLY_ACCELERATED_NOT_SUBSTITUTE_REQUIRED");

  need(persistent?.schema_version === "geox_mcft_cap09_amendment19_persistent24_qualification_result_v1", "AM19_GRADUATION_ASSEMBLY_PERSISTENT_SCHEMA_REQUIRED");
  need(persistent.status === "PASS", `AM19_GRADUATION_ASSEMBLY_FRESH_PERSISTENT_PASS_REQUIRED:${String(persistent?.status)}`);
  need(persistent.subject_sha === subject, "AM19_GRADUATION_ASSEMBLY_PERSISTENT_CONSUMER_SUBJECT_REQUIRED");
  const producerSubject = canonicalSubject(persistent.producer_subject_sha);
  need(persistent.temporal_authority === EXPECTED_TEMPORAL_AUTHORITY, "AM19_GRADUATION_ASSEMBLY_TEMPORAL_AUTHORITY_REQUIRED");
  need(persistent.qualification_clock === "ACCELERATED_ENGINEERING_ONLY", "AM19_GRADUATION_ASSEMBLY_QUALIFICATION_CLOCK_REQUIRED");
  need(persistent.accelerated_clock_scope === EXPECTED_CLOCK_SCOPE, "AM19_GRADUATION_ASSEMBLY_PERSISTENT_CLOCK_SCOPE_DRIFT");
  need(persistent.bootstrap_lease_clock === "REAL_DATABASE_TRANSACTION_TIMESTAMP", "AM19_GRADUATION_ASSEMBLY_REAL_DB_LEASE_CLOCK_REQUIRED");
  need(persistent.bootstrap_lease_real_expiry_required === true && persistent.lease_and_fencing_clock_substitution === false, "AM19_GRADUATION_ASSEMBLY_LEASE_FENCING_CLOCK_SUBSTITUTION_FORBIDDEN");
  need(persistent.formal_clock_authority_changed === false, "AM19_GRADUATION_ASSEMBLY_FORMAL_CLOCK_CHANGE_FORBIDDEN");
  need(persistent.static_blocker_count === 0, "AM19_GRADUATION_ASSEMBLY_STATIC_BLOCKERS_REMAIN");
  for (const key of REQUIRED_STATUS_KEYS) need(persistent.machine_statuses?.[key] === "PASS", `AM19_GRADUATION_ASSEMBLY_MACHINE_STATUS_NOT_PASS:${key}:${String(persistent.machine_statuses?.[key])}`);
  need(persistent.production_scheduler_reused === true, "AM19_GRADUATION_ASSEMBLY_PRODUCTION_SCHEDULER_REQUIRED");
  need(persistent.production_lease_fencing_reused === true, "AM19_GRADUATION_ASSEMBLY_PRODUCTION_LEASE_FENCING_REQUIRED");
  need(persistent.production_runner_reused === true, "AM19_GRADUATION_ASSEMBLY_PRODUCTION_RUNNER_REQUIRED");
  need(persistent.production_persistence_repositories_reused === true, "AM19_GRADUATION_ASSEMBLY_PRODUCTION_REPOSITORIES_REQUIRED");
  need(persistent.production_persistent_tick_service_reused === true, "AM19_GRADUATION_ASSEMBLY_PRODUCTION_TICK_SERVICE_REQUIRED");
  need(Number(persistent.runtime_provider_request_count) === 0 && Number(persistent.runtime_r2_request_count) === 0, "AM19_GRADUATION_ASSEMBLY_ZERO_RUNTIME_PROVIDER_IO_REQUIRED");
  need(persistent.no_assumption_pair_blocks_explicitly_without_wait === true, "AM19_GRADUATION_ASSEMBLY_BLOCKED_NO_WAIT_PROOF_REQUIRED");
  need(persistent.final_actual_24h_still_required === true && persistent.final_actual_24h_substituted_by_this_run === false, "AM19_GRADUATION_ASSEMBLY_FINAL_24H_NON_SUBSTITUTION_REQUIRED");
  need(persistent.future_formal_epoch_selected === false && persistent.formal_o00_started === false && persistent.mcft_cap09_completed === false, "AM19_GRADUATION_ASSEMBLY_PREMATURE_FORMAL_EFFECT_FORBIDDEN");

  need(persistenceFree?.schema_version === "geox_mcft_cap09_amendment19_persistence_free_24t_result_v1", "AM19_GRADUATION_ASSEMBLY_PERSISTENCE_FREE_SCHEMA_REQUIRED");
  need(persistenceFree.status === "PASS", "AM19_GRADUATION_ASSEMBLY_PERSISTENCE_FREE_PASS_REQUIRED");
  need(persistenceFree.qualification_lane === "PERSISTENCE_FREE_ACCELERATED_ENGINEERING_ONLY", "AM19_GRADUATION_ASSEMBLY_PERSISTENCE_FREE_LANE_REQUIRED");
  need(persistenceFree.machine_statuses?.PERSISTENCE_FREE_24T === "PASS", "AM19_GRADUATION_ASSEMBLY_PERSISTENCE_FREE_MACHINE_PASS_REQUIRED");
  need(Number(persistenceFree.canonical_tick_count) === 24, "AM19_GRADUATION_ASSEMBLY_PERSISTENCE_FREE_24_TICKS_REQUIRED");
  need(Number(persistenceFree.provider_wait_count) === 0 && Number(persistenceFree.database_write_count) === 0 && Number(persistenceFree.provider_request_count) === 0, "AM19_GRADUATION_ASSEMBLY_PERSISTENCE_FREE_SIDE_EFFECT_BOUNDARY_DRIFT");
  need(persistenceFree.canonical_core_path === EXPECTED_CORE_PATH, "AM19_GRADUATION_ASSEMBLY_ENGINEERING_CORE_PATH_DRIFT");
  need(persistenceFree.canonical_core_symbol === EXPECTED_CORE_SYMBOL, "AM19_GRADUATION_ASSEMBLY_ENGINEERING_CORE_SYMBOL_DRIFT");

  need(rehydration?.schema_version === "geox_mcft_cap09_rolling_preboundary_rehydration_v1", "AM19_GRADUATION_ASSEMBLY_REHYDRATION_SCHEMA_REQUIRED");
  need(rehydration.status === "PASS", "AM19_GRADUATION_ASSEMBLY_REHYDRATION_PASS_REQUIRED");
  need(rehydration.temporal_authority === EXPECTED_TEMPORAL_AUTHORITY, "AM19_GRADUATION_ASSEMBLY_REHYDRATION_TEMPORAL_AUTHORITY_DRIFT");
  need(rehydration.consumer_subject_sha === subject, "AM19_GRADUATION_ASSEMBLY_REHYDRATION_CONSUMER_SUBJECT_REQUIRED");
  need(rehydration.producer_subject_sha === producerSubject, "AM19_GRADUATION_ASSEMBLY_REHYDRATION_PRODUCER_SUBJECT_REQUIRED");
  need(rehydration.cross_head_rehydration === (producerSubject !== subject), "AM19_GRADUATION_ASSEMBLY_REHYDRATION_CROSS_HEAD_FLAG_REQUIRED");
  need(rehydration.target_t === persistent.a0, "AM19_GRADUATION_ASSEMBLY_REHYDRATION_WINDOW_IDENTITY_REQUIRED");
  need(exactRecordTypes(rehydration.record_types), "AM19_GRADUATION_ASSEMBLY_REHYDRATION_RECORD_TYPES_REQUIRED");
  need(rehydration.semantic_manifest_match === true, "AM19_GRADUATION_ASSEMBLY_REHYDRATION_SEMANTIC_MANIFEST_REQUIRED");
  need(rehydration.producer_bound_raw_reverification === true, "AM19_GRADUATION_ASSEMBLY_REHYDRATION_RAW_REVERIFICATION_REQUIRED");
  need(rehydration.producer_dataset_identity_preserved === true && rehydration.producer_decoder_identity_preserved === true, "AM19_GRADUATION_ASSEMBLY_REHYDRATION_PRODUCER_IDENTITY_REQUIRED");
  need(Number(rehydration.provider_refetch_count) === 0, "AM19_GRADUATION_ASSEMBLY_REHYDRATION_PROVIDER_REFETCH_FORBIDDEN");
  need(Number(rehydration.private_r2_put_count) === 0 && Number(rehydration.private_r2_delete_count) === 0, "AM19_GRADUATION_ASSEMBLY_REHYDRATION_R2_WRITE_FORBIDDEN");
  need(Number(rehydration.isolated_database_fact_count) === 3, "AM19_GRADUATION_ASSEMBLY_REHYDRATION_EXACT_THREE_FACTS_REQUIRED");
  need(Number(rehydration.formal_database_write_count) === 0 && Number(rehydration.formal_r2_prefix_write_count) === 0 && Number(rehydration.scheduler_write_count) === 0 && Number(rehydration.runtime_write_count) === 0, "AM19_GRADUATION_ASSEMBLY_REHYDRATION_FORMAL_SIDE_EFFECT_FORBIDDEN");
  need(rehydration.crop_authority_effect === "NONE" && rehydration.formal_effect === false, "AM19_GRADUATION_ASSEMBLY_REHYDRATION_AUTHORITY_EFFECT_FORBIDDEN");

  need(cutover?.schema_version === "geox_mcft_cap09_amendment19_persistent_production_cutover_result_v1", "AM19_GRADUATION_ASSEMBLY_CUTOVER_SCHEMA_REQUIRED");
  need(cutover.status === "PASS", "AM19_GRADUATION_ASSEMBLY_CUTOVER_PASS_REQUIRED");
  need(cutover.shared_canonical_core_bound === true, "AM19_GRADUATION_ASSEMBLY_PRODUCTION_SHARED_CORE_PROOF_REQUIRED");
  need(cutover.scheduler_graph === "LIST_MISSED_CLAIM_SAME_FENCE_TERMINAL", "AM19_GRADUATION_ASSEMBLY_PRODUCTION_SCHEDULER_GRAPH_REQUIRED");
  need(cutover.provider_wait_authorized === false && cutover.blocked_no_assumption_is_wait === false, "AM19_GRADUATION_ASSEMBLY_PRODUCTION_NO_WAIT_REQUIRED");
  need(cutover.persistent_24t_claimed === false && cutover.future_formal_epoch_selected === false && cutover.formal_effect === false, "AM19_GRADUATION_ASSEMBLY_CUTOVER_PREMATURE_CLAIM_FORBIDDEN");

  const normalizedStatuses = Object.fromEntries(REQUIRED_STATUS_KEYS.map((key) => [key, "PASS"]));
  return {
    schema_version: "geox_mcft_cap09_amendment19_formal_graduation_input_v1",
    status: "PASS",
    subject_sha: subject,
    ...normalizedStatuses,
    static_blocker_count: 0,
    human_override_used: false,
    human_override_supported_by_this_path: false,
    accelerated_clock_replaced_production_execution_graph: false,
    same_canonical_core_engineering_and_production: true,
    canonical_core_path: EXPECTED_CORE_PATH,
    canonical_core_symbol: EXPECTED_CORE_SYMBOL,
    persistent_lane_uses_production_scheduler: true,
    persistent_lane_uses_production_repositories: true,
    persistent_lane_uses_production_lease_fencing: true,
    persistent_lane_uses_production_runner: true,
    persistent_lane_uses_production_tick_service: true,
    accelerated_clock_scope: EXPECTED_CLOCK_SCOPE,
    bootstrap_lease_clock: "REAL_DATABASE_TRANSACTION_TIMESTAMP",
    temporal_authority: EXPECTED_TEMPORAL_AUTHORITY,
    final_actual_24h_still_required: true,
    final_actual_24h_substituted_by_accelerated_lane: false,
    future_formal_epoch_selected: false,
    formal_o00_started: false,
    mcft_cap09_completed: false,
    evidence_provenance: {
      persistent_result_schema: persistent.schema_version,
      persistent_subject_sha: persistent.subject_sha,
      persistent_producer_subject_sha: producerSubject,
      rehydration_consumer_subject_sha: rehydration.consumer_subject_sha,
      rehydration_producer_subject_sha: rehydration.producer_subject_sha,
      cross_head_rehydration: rehydration.cross_head_rehydration,
      persistence_free_result_schema: persistenceFree.schema_version,
      engineering_core_symbol: persistenceFree.canonical_core_symbol,
      rehydration_result_schema: rehydration.schema_version,
      rehydration_target_t: rehydration.target_t,
      rehydration_semantic_manifest_match: true,
      rehydration_producer_bound_raw_reverification: true,
      rehydration_producer_dataset_identity_preserved: true,
      rehydration_producer_decoder_identity_preserved: true,
      persistent_cutover_result_schema: cutover.schema_version,
      production_shared_core_bound: cutover.shared_canonical_core_bound,
      production_scheduler_graph: cutover.scheduler_graph,
    },
  };
}

function selftest() {
  const subject = "1".repeat(40);
  const producer = "2".repeat(40);
  const authority = {
    canonical_core_binding: {
      core_path: EXPECTED_CORE_PATH,
      core_symbol: EXPECTED_CORE_SYMBOL,
      persistence_free_engineering_must_call_core_directly: true,
      future_production_persistent_path_must_call_same_core_symbol: true,
      different_semantic_core_between_engineering_and_production_forbidden: true,
    },
    persistent_accelerated_equivalence: {
      allowed_clock_difference_only: true,
      accelerated_clock_role: EXPECTED_CLOCK_SCOPE,
      production_execution_graph_replacement_by_test_harness_forbidden: true,
    },
    final_wall_clock_graduation_test: { still_required: true, actual_utc_boundaries: 24, accelerated_lane_is_substitute: false },
    formal_epoch_creation_machine_gate: {
      required_statuses: Object.fromEntries(REQUIRED_STATUS_KEYS.map((key) => [key, "PASS"])),
      static_blocker_count_required: 0,
      all_required_statuses_must_be_terminal_pass: true,
      human_override_authorized: false,
    },
  };
  const persistent = {
    schema_version: "geox_mcft_cap09_amendment19_persistent24_qualification_result_v1",
    status: "PASS",
    subject_sha: subject,
    producer_subject_sha: producer,
    temporal_authority: EXPECTED_TEMPORAL_AUTHORITY,
    qualification_clock: "ACCELERATED_ENGINEERING_ONLY",
    accelerated_clock_scope: EXPECTED_CLOCK_SCOPE,
    bootstrap_lease_clock: "REAL_DATABASE_TRANSACTION_TIMESTAMP",
    bootstrap_lease_real_expiry_required: true,
    lease_and_fencing_clock_substitution: false,
    formal_clock_authority_changed: false,
    static_blocker_count: 0,
    machine_statuses: Object.fromEntries(REQUIRED_STATUS_KEYS.map((key) => [key, "PASS"])),
    production_scheduler_reused: true,
    production_lease_fencing_reused: true,
    production_runner_reused: true,
    production_persistence_repositories_reused: true,
    production_persistent_tick_service_reused: true,
    runtime_provider_request_count: 0,
    runtime_r2_request_count: 0,
    no_assumption_pair_blocks_explicitly_without_wait: true,
    final_actual_24h_still_required: true,
    final_actual_24h_substituted_by_this_run: false,
    future_formal_epoch_selected: false,
    formal_o00_started: false,
    mcft_cap09_completed: false,
    a0: "2026-09-01T00:00:00.000Z",
  };
  const persistenceFree = {
    schema_version: "geox_mcft_cap09_amendment19_persistence_free_24t_result_v1",
    status: "PASS",
    qualification_lane: "PERSISTENCE_FREE_ACCELERATED_ENGINEERING_ONLY",
    machine_statuses: { PERSISTENCE_FREE_24T: "PASS" },
    canonical_tick_count: 24,
    provider_wait_count: 0,
    database_write_count: 0,
    provider_request_count: 0,
    canonical_core_path: EXPECTED_CORE_PATH,
    canonical_core_symbol: EXPECTED_CORE_SYMBOL,
  };
  const rehydration = {
    schema_version: "geox_mcft_cap09_rolling_preboundary_rehydration_v1",
    status: "PASS",
    temporal_authority: EXPECTED_TEMPORAL_AUTHORITY,
    consumer_subject_sha: subject,
    producer_subject_sha: producer,
    cross_head_rehydration: true,
    target_t: persistent.a0,
    record_types: ["future_et0_assumption_v1", "future_weather_assumption_v1", "soil_moisture_observation_v1"],
    semantic_manifest_match: true,
    producer_bound_raw_reverification: true,
    producer_dataset_identity_preserved: true,
    producer_decoder_identity_preserved: true,
    provider_refetch_count: 0,
    private_r2_put_count: 0,
    private_r2_delete_count: 0,
    isolated_database_fact_count: 3,
    formal_database_write_count: 0,
    formal_r2_prefix_write_count: 0,
    scheduler_write_count: 0,
    runtime_write_count: 0,
    crop_authority_effect: "NONE",
    formal_effect: false,
  };
  const cutover = {
    schema_version: "geox_mcft_cap09_amendment19_persistent_production_cutover_result_v1",
    status: "PASS",
    shared_canonical_core_bound: true,
    scheduler_graph: "LIST_MISSED_CLAIM_SAME_FENCE_TERMINAL",
    provider_wait_authorized: false,
    blocked_no_assumption_is_wait: false,
    persistent_24t_claimed: false,
    future_formal_epoch_selected: false,
    formal_effect: false,
  };

  const pass = assemble(authority, persistent, persistenceFree, rehydration, cutover, subject);
  need(pass.status === "PASS" && pass.same_canonical_core_engineering_and_production === true && pass.evidence_provenance.cross_head_rehydration === true, "AM19_GRADUATION_ASSEMBLY_SELFTEST_PASS_FAILED");

  const negativeCases = [
    ["subject", { persistent: { ...persistent, subject_sha: "3".repeat(40) } }, "AM19_GRADUATION_ASSEMBLY_PERSISTENT_CONSUMER_SUBJECT_REQUIRED"],
    ["status", { persistent: { ...persistent, machine_statuses: { ...persistent.machine_statuses, MODE_B: "NOT_RUN" } } }, "AM19_GRADUATION_ASSEMBLY_MACHINE_STATUS_NOT_PASS:MODE_B:NOT_RUN"],
    ["blocker", { persistent: { ...persistent, static_blocker_count: 1 } }, "AM19_GRADUATION_ASSEMBLY_STATIC_BLOCKERS_REMAIN"],
    ["engineering_core", { persistenceFree: { ...persistenceFree, canonical_core_symbol: "wrong" } }, "AM19_GRADUATION_ASSEMBLY_ENGINEERING_CORE_SYMBOL_DRIFT"],
    ["rehydration_producer", { rehydration: { ...rehydration, producer_subject_sha: "3".repeat(40) } }, "AM19_GRADUATION_ASSEMBLY_REHYDRATION_PRODUCER_SUBJECT_REQUIRED"],
    ["rehydration_cross_head", { rehydration: { ...rehydration, cross_head_rehydration: false } }, "AM19_GRADUATION_ASSEMBLY_REHYDRATION_CROSS_HEAD_FLAG_REQUIRED"],
    ["rehydration_manifest", { rehydration: { ...rehydration, semantic_manifest_match: false } }, "AM19_GRADUATION_ASSEMBLY_REHYDRATION_SEMANTIC_MANIFEST_REQUIRED"],
    ["rehydration_window", { rehydration: { ...rehydration, target_t: "2026-09-01T01:00:00.000Z" } }, "AM19_GRADUATION_ASSEMBLY_REHYDRATION_WINDOW_IDENTITY_REQUIRED"],
    ["production_core", { cutover: { ...cutover, shared_canonical_core_bound: false } }, "AM19_GRADUATION_ASSEMBLY_PRODUCTION_SHARED_CORE_PROOF_REQUIRED"],
    ["scheduler", { persistent: { ...persistent, production_scheduler_reused: false } }, "AM19_GRADUATION_ASSEMBLY_PRODUCTION_SCHEDULER_REQUIRED"],
    ["clock", { persistent: { ...persistent, lease_and_fencing_clock_substitution: true } }, "AM19_GRADUATION_ASSEMBLY_LEASE_FENCING_CLOCK_SUBSTITUTION_FORBIDDEN"],
    ["formal", { persistent: { ...persistent, formal_o00_started: true } }, "AM19_GRADUATION_ASSEMBLY_PREMATURE_FORMAL_EFFECT_FORBIDDEN"],
  ];
  for (const [name, override, expected] of negativeCases) {
    let observed = "";
    try {
      assemble(authority, override.persistent || persistent, override.persistenceFree || persistenceFree, override.rehydration || rehydration, override.cutover || cutover, subject);
    } catch (error) {
      observed = error instanceof Error ? error.message : String(error);
    }
    need(observed === expected, `AM19_GRADUATION_ASSEMBLY_SELFTEST_NEGATIVE_FAILED:${name}:${observed}`);
  }
  console.log(JSON.stringify({
    schema_version: "geox_mcft_cap09_amendment19_formal_graduation_input_selftest_v1",
    status: "PASS",
    negative_case_count: negativeCases.length,
    field_rename_only_forbidden: true,
    rehydration_provenance_required: true,
    cross_head_rehydration_supported: true,
    evidence_composition_required: true,
  }));
}

function main() {
  if (process.argv.includes("--selftest")) { selftest(); return; }
  const [persistentArg, persistenceFreeArg, rehydrationArg, cutoverArg, subjectArg, outArg] = process.argv.slice(2);
  if (!persistentArg || !persistenceFreeArg || !rehydrationArg || !cutoverArg || !subjectArg) {
    fail("AM19_GRADUATION_ASSEMBLY_USAGE: persistent.json persistence-free.json rehydration.json cutover.json subject_sha [output.json]");
  }
  const authority = readJson(AUTHORITY_PATH);
  const persistent = readJson(path.resolve(ROOT, persistentArg));
  const persistenceFree = readJson(path.resolve(ROOT, persistenceFreeArg));
  const rehydration = readJson(path.resolve(ROOT, rehydrationArg));
  const cutover = readJson(path.resolve(ROOT, cutoverArg));
  const output = assemble(authority, persistent, persistenceFree, rehydration, cutover, subjectArg);
  const out = outArg ? path.resolve(ROOT, outArg) : DEFAULT_OUT;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(output, null, 2) + "\n");
  console.log(JSON.stringify(output));
}

try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
