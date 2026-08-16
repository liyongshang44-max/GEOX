#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = process.cwd();
const AUTHORITY_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A18D-PREWINDOW-BOOTSTRAP-EXECUTION-AUTHORITY-V1.json";
const EXECUTOR_PATH = "scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_A18D_PREWINDOW_BOOTSTRAP_V1.ts";
const WORKFLOW_PATH = ".github/workflows/mcft-cap-09-a18d-prewindow-bootstrap.yml";
const OUTPUT_DIR = path.join(ROOT, "acceptance-output");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "MCFT_CAP_09_A18D_PREWINDOW_BOOTSTRAP_QUALIFICATION_GOVERNANCE.json");
const EXACT_BASE = "f8480f468dbe2dff24629903d20e45daf7dc08e6";
const A0 = "2026-08-17T19:00:00.000Z";
const O00 = "2026-08-17T20:00:00.000Z";
const DB = "geox_mcft_cap09_s6_formal_t3r1_24h_v2";

function requireCondition(value, code) { if (!value) throw new Error(code); }
function text(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }
function json(rel) { return JSON.parse(text(rel)); }
function blob(rel) { return execFileSync("git", ["hash-object", rel], { cwd: ROOT, encoding: "utf8" }).trim(); }

const authority = json(AUTHORITY_PATH);
const executor = text(EXECUTOR_PATH);
const workflow = text(WORKFLOW_PATH);
const amendment18 = text(authority.governing_authorities.amendment_18.path);
const correction = json(authority.governing_authorities.ea5e3_a1_prewindow_a0_soil_correction.path);
const a18b = json(authority.governing_authorities.a18b_runtime_config_chain.path);
const a18c = json(authority.governing_authorities.a18c_replacement_manifest.path);

requireCondition(authority.schema_version === "geox_mcft_cap09_a18d_prewindow_bootstrap_execution_authority_v1", "A18D_AUTHORITY_SCHEMA_REQUIRED");
requireCondition(authority.frontier_id === "A18D_PREWINDOW_A0_BOOTSTRAP_AND_POST_BOOTSTRAP_CUTOVER_PROOF", "A18D_FRONTIER_REQUIRED");
requireCondition(authority.exact_predecessor_protected_main === EXACT_BASE, "A18D_EXACT_BASE_REQUIRED");
requireCondition(authority.selected_epoch.prewindow_a0 === A0 && authority.selected_epoch.o00 === O00 && authority.selected_epoch.o23 === "2026-08-18T19:00:00.000Z" && authority.selected_epoch.slot_count === 24, "A18D_SELECTED_EPOCH_REQUIRED");
requireCondition(authority.formal_store.database_name === DB && authority.formal_store.historical_database_write_authorized === false && authority.formal_store.cross_store_fact_or_state_copy_authorized === false, "A18D_REPLACEMENT_STORE_BOUNDARY_REQUIRED");

for (const [name, binding] of Object.entries(authority.governing_authorities)) {
  requireCondition(blob(binding.path) === binding.blob_sha, `A18D_GOVERNING_BLOB_DRIFT:${name}`);
}
for (const [name, binding] of Object.entries({
  executor: authority.implementation_binding.executor,
  builder: authority.implementation_binding.prewindow_authority_builder,
  persistence: authority.implementation_binding.bootstrap_persistence_service,
  a0_evidence: authority.implementation_binding.a0_evidence_window_service,
  evidence_builder: authority.implementation_binding.evidence_window_builder,
})) {
  requireCondition(blob(binding.path) === binding.blob_sha, `A18D_IMPLEMENTATION_BLOB_DRIFT:${name}`);
}

requireCondition(amendment18.includes("A18D") && amendment18.includes(A0) && amendment18.includes(O00), "A18D_AMENDMENT18_SEQUENCE_REQUIRED");
requireCondition(correction.readiness_effect?.a18d_preauthorization_restored_after_exact_head_qualification_and_on_time_merge === true && correction.readiness_effect?.runtime_obligation_must_still_succeed_before_a18d === true, "A18D_EA5E3_A1_PREAUTH_AND_RUNTIME_OBLIGATION_REQUIRED");
requireCondition(correction.prewindow_a0_evidence_contract?.logical_time === A0 && correction.prewindow_a0_evidence_contract?.required_record_type === "soil_moisture_observation_v1", "A18D_A0_SOIL_CORRECTION_BINDING_REQUIRED");
requireCondition(a18b.prewindow_a0?.runtime_config_ref === authority.runtime_config_binding.a0_runtime_config_ref && a18b.prewindow_a0?.runtime_config_hash === authority.runtime_config_binding.a0_runtime_config_hash && a18b.hourly_runtime_config_pins?.length === 24, "A18D_A18B_EXACT_CONFIG_BINDING_REQUIRED");
requireCondition(a18c.manifest_hash === authority.governing_authorities.a18c_replacement_manifest.semantic_manifest_sha256 && a18c.epoch?.epoch_id === authority.selected_epoch.epoch_id, "A18D_A18C_MANIFEST_BINDING_REQUIRED");

const prewrite = authority.prewrite_fail_closed_gate;
requireCondition(prewrite.actual_wall_clock_gte === A0 && prewrite.actual_wall_clock_lt === O00 && prewrite.a0_soil_exact_count === 1, "A18D_PREWRITE_TIME_AND_SOIL_REQUIRED");
requireCondition(prewrite.a0_soil_observed_at_gt === "2026-08-17T18:00:00.000Z" && prewrite.a0_soil_observed_at_lte === A0 && prewrite.a0_soil_available_to_runtime_at_lte === A0 && prewrite.a0_soil_ingested_at_lte === A0, "A18D_A0_SOIL_REAL_CHRONOLOGY_REQUIRED");
requireCondition(prewrite.a0_frozen_evidence_window_service_must_succeed_before_persistence === true && prewrite.scheduler_cursor_count === 0 && prewrite.scheduler_slot_count === 0 && prewrite.terminal_tick_count === 0 && prewrite.downstream_action_fact_count === 0, "A18D_PREWRITE_FAIL_CLOSED_BOUNDARY_REQUIRED");

requireCondition(authority.runtime_config_binding.exact_total_runtime_config_count === 25 && authority.runtime_config_binding.hourly_runtime_config_count === 24 && authority.runtime_config_binding.all_25_refs_hashes_must_be_recomputed_and_equal_before_any_write === true, "A18D_EXACT_25_CONFIG_PIN_RECOMPUTATION_REQUIRED");
requireCondition(authority.retry_semantics.a0_state_absent.startsWith("REENTER_BOOTSTRAP_SERVICE") && authority.retry_semantics.a0_state_present_and_exact.includes("DO_NOT_REBUILD_A0_RECORD_SET") && authority.retry_semantics.second_initial_in_populated_store_authorized === false, "A18D_RETRY_AND_SECOND_INITIAL_BOUNDARY_REQUIRED");

const post = authority.post_bootstrap_cutover_proof;
requireCondition(post.exact_total_runtime_config_count === 25 && post.exact_a0_active_lineage_count === 1 && post.exact_a0_state_latest_count === 1 && post.exact_a0_checkpoint_count === 1, "A18D_POSTBOOTSTRAP_CORE_COUNTS_REQUIRED");
requireCondition(post.active_runtime_config_ref === authority.runtime_config_binding.a0_runtime_config_ref && post.active_runtime_config_hash === authority.runtime_config_binding.a0_runtime_config_hash && post.checkpoint_next_tick_logical_time === O00, "A18D_POSTBOOTSTRAP_A0_TO_O00_CONTINUITY_REQUIRED");
requireCondition(post.scheduler_cursor_count === 0 && post.scheduler_slot_count === 0 && post.o00_terminal_tick_count === 0 && post.downstream_action_fact_count === 0 && post.wall_clock_lt_o00 === true && post.formal_o00_started === false && post.formal_execution_count === "0/24", "A18D_POSTBOOTSTRAP_NONSTART_REQUIRED");

const gate = authority.execution_gate;
requireCondition(gate.a18d_effective_if_present_on_protected_main === true && gate.qualification_merge_may_occur_before_execution_window === true, "A18D_QUALIFICATION_EFFECTIVENESS_REQUIRED");
requireCondition(gate.execution_not_before_actual_wall_clock === A0 && gate.execution_must_complete_before === O00, "A18D_ACTUAL_WALL_CLOCK_GATE_REQUIRED");
requireCondition(JSON.stringify(gate.live_execution_events) === JSON.stringify(["schedule", "workflow_dispatch"]) && gate.push_event_live_execution_authorized === false && gate.pull_request_live_execution_authorized === false, "A18D_LIVE_EVENT_BOUNDARY_REQUIRED");
requireCondition(gate.operational_schedule_is_normative_temporal_authority === false && gate.provider_access_authorized === false && gate.scheduler_write_authorized === false && gate.canonical_runtime_tick_authorized === false && gate.formal_o00_start_authorized_by_a18d === false, "A18D_OPERATIONAL_NONAUTHORITY_REQUIRED");

const q = authority.qualification_boundary;
requireCondition(q.database_transaction_mode === "READ_ONLY" && q.evidence_facts_may_exist === true && q.canonical_twin_runtime_facts_must_be_zero === true && q.runtime_config_count_must_be_zero === true && q.scheduler_and_terminal_counts_must_be_zero === true && q.provider_request_count === 0 && q.database_write_count === 0, "A18D_QUALIFICATION_READ_ONLY_BOUNDARY_REQUIRED");

const evidencePrepare = executor.indexOf("new ExternalFormalA0EvidenceWindowServiceV1(evidenceSource).prepare");
const persistenceExecute = executor.indexOf("service.execute");
requireCondition(evidencePrepare >= 0 && persistenceExecute >= 0 && evidencePrepare < persistenceExecute, "A18D_EVIDENCE_MUST_PRECHECK_BEFORE_PERSISTENCE");
requireCondition(executor.includes("A18D_EXECUTION_BEFORE_ACTUAL_19Z_FORBIDDEN") && executor.includes("A18D_EXECUTION_AT_OR_AFTER_O00_FORBIDDEN"), "A18D_EXECUTOR_WALL_CLOCK_GUARDS_REQUIRED");
requireCondition(executor.includes("buildExternalFormalPrewindowAuthorityBundleV2") && executor.includes("A18D_HOURLY_CONFIG_PIN_DRIFT"), "A18D_EXECUTOR_A18B_PIN_RECOMPUTATION_REQUIRED");
requireCondition(executor.includes("RETRY_EXISTING_A0_STATE_COMPLETE_CONFIG_CHAIN") && executor.includes("A18D_RETRY_EXISTING_BOOTSTRAP_STATE_DRIFT"), "A18D_EXECUTOR_RETRY_PATH_REQUIRED");
requireCondition(executor.includes("A18D_RUNTIME_CONFIG_FOREIGN_OR_DRIFTED") && executor.includes("WHERE record_json->>'type'='twin_runtime_config_v1' ORDER BY occurred_at ASC, fact_id ASC"), "A18D_ALL_FORMAL_RUNTIME_CONFIGS_MUST_BE_EXACTLY_VETTED");
requireCondition(!executor.includes("fetch(") && !executor.includes("S3Compatible") && !executor.includes("R2"), "A18D_EXECUTOR_PROVIDER_OR_OBJECT_STORE_ACCESS_FORBIDDEN");

requireCondition(workflow.includes("5,20,35,50 19 17 8 *") && workflow.includes("operational_schedule_is_normative_temporal_authority"), "A18D_OPERATIONAL_SCHEDULE_REQUIRED");
requireCondition(workflow.includes("github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'"), "A18D_LIVE_JOB_EVENT_FILTER_REQUIRED");
requireCondition(workflow.includes("refs/heads/main") && workflow.includes("git rev-parse origin/main"), "A18D_LIVE_EXACT_MAIN_REQUIRED");
requireCondition(workflow.includes("A18D_LIVE_MAIN_MOVED_AFTER_QUALIFIED_MERGE") && workflow.includes('test "$(git rev-parse HEAD)" = "$effective_commit"'), "A18D_LIVE_MUST_USE_EXACT_QUALIFIED_MERGE_REQUIRED");
requireCondition(workflow.includes("EXECUTE_MCFT_CAP_09_A18D_PREWINDOW_BOOTSTRAP_V1.ts preflight") && workflow.includes("EXECUTE_MCFT_CAP_09_A18D_PREWINDOW_BOOTSTRAP_V1.ts execute"), "A18D_PREFLIGHT_AND_EXECUTION_ENTRYPOINTS_REQUIRED");

requireCondition(authority.next_legal_frontier_if_qualified_and_merged === "WAIT_FOR_ACTUAL_2026_08_17T19_00_00Z_AND_REQUIRE_A0_SOIL_RUNTIME_OBLIGATION_THEN_EXECUTE_A18D", "A18D_NEXT_FRONTIER_REQUIRED");

const result = {
  schema_version: "geox_mcft_cap09_a18d_prewindow_bootstrap_qualification_governance_v1",
  status: "PASS",
  exact_predecessor_protected_main: EXACT_BASE,
  selected_epoch_id: authority.selected_epoch.epoch_id,
  formal_database_name: DB,
  exact_config_pin_count: 25,
  a0_evidence_prechecked_before_persistence: true,
  a0_soil_runtime_obligation_required: true,
  retry_does_not_rebuild_existing_a0_state: true,
  all_formal_runtime_configs_vetted_against_exact_25_pin_set: true,
  live_execution_requires_exact_qualified_merge_commit: true,
  execution_not_before: A0,
  execution_must_complete_before: O00,
  operational_schedule_is_normative_temporal_authority: false,
  qualification_transaction_mode: "READ_ONLY",
  qualification_provider_request_count: 0,
  qualification_database_write_count: 0,
  scheduler_write_count: 0,
  canonical_runtime_tick_write_count: 0,
  formal_o00_started: false,
  formal_execution_count: "0/24",
  next_legal_frontier: authority.next_legal_frontier_if_qualified_and_merged
};
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
