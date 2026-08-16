#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = process.cwd();
const AUTHORITY_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E3-FORMAL-AUTHORITY-V3.json";
const COLLECTOR_PATH = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E3_FORMAL_V2_PROVIDER_WATERMARK_COLLECTOR.ts";
const WORKFLOW_PATH = ".github/workflows/mcft-cap-09-ea5e3-v2-provider-watermark-wiring.yml";
const OUTPUT_DIR = path.join(ROOT, "acceptance-output");
const OUTPUT = path.join(OUTPUT_DIR, "MCFT_CAP_09_EA5E3_FORMAL_V2_PROVIDER_WATERMARK_WIRING_GOVERNANCE.json");
const EXACT_BASE = "de280185c09312213f59624164171919517ad26b";
const DEADLINE = "2026-08-17T08:00:00.000Z";
const EPOCH = "mcft_cap09_external_formal_window_epoch_20260817t200000z_v2";
const DB = "geox_mcft_cap09_s6_formal_t3r1_24h_v2";
const FORMAL_PREFIX = "mcft-cap09-formal-raw-v1/sha256";

function requireCondition(value, code) { if (!value) throw new Error(code); }
function readText(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }
function readJson(rel) { return JSON.parse(readText(rel)); }
function blob(rel) { return execFileSync("git", ["hash-object", rel], { cwd: ROOT, encoding: "utf8" }).trim(); }

const authority = readJson(AUTHORITY_PATH);
const collector = readText(COLLECTOR_PATH);
const workflow = readText(WORKFLOW_PATH);
const amendment11 = readText(authority.governing_authorities.amendment_11.path);
const amendment18 = readText(authority.governing_authorities.amendment_18.path);
const activation = readJson(authority.governing_authorities.ea5e2_operational_activation.path);
const a18c = readJson(authority.governing_authorities.a18c_replacement_manifest.path);

requireCondition(authority.schema_version === "geox_mcft_cap09_ea5e3_formal_authority_v3", "EA5E3_AUTHORITY_SCHEMA_REQUIRED");
requireCondition(authority.frontier_id === "EA5E3_READINESS_PREAUTHORIZATION_BEFORE_O00_MINUS_12H", "EA5E3_FRONTIER_REQUIRED");
requireCondition(authority.exact_predecessor_protected_main === EXACT_BASE, "EA5E3_EXACT_BASE_REQUIRED");
requireCondition(authority.effectiveness_deadline === DEADLINE, "EA5E3_DEADLINE_REQUIRED");
requireCondition(authority.selected_epoch.epoch_id === EPOCH && authority.selected_epoch.prewindow_a0 === "2026-08-17T19:00:00.000Z" && authority.selected_epoch.o00 === "2026-08-17T20:00:00.000Z" && authority.selected_epoch.o23 === "2026-08-18T19:00:00.000Z" && authority.selected_epoch.slot_count === 24, "EA5E3_SELECTED_EPOCH_REQUIRED");
requireCondition(authority.formal_store.database_name === DB && authority.formal_store.historical_database_write_authorized === false && authority.formal_store.cross_store_state_copy_authorized === false && authority.formal_store.cross_store_fact_copy_authorized === false, "EA5E3_REPLACEMENT_STORE_BOUNDARY_REQUIRED");

for (const [name, binding] of Object.entries(authority.governing_authorities)) {
  requireCondition(typeof binding.path === "string" && typeof binding.blob_sha === "string", `EA5E3_PREDECESSOR_BINDING_INVALID:${name}`);
  requireCondition(blob(binding.path) === binding.blob_sha, `EA5E3_PREDECESSOR_BLOB_DRIFT:${name}`);
}
requireCondition(blob(COLLECTOR_PATH) === authority.collector_wiring.entrypoint_blob_sha, "EA5E3_COLLECTOR_BLOB_DRIFT");
for (const [name, binding] of Object.entries({
  formal_retention: authority.collector_wiring.formal_raw_retention_adapter,
  evidence_ingress: authority.collector_wiring.canonical_evidence_ingress,
  canonicalizer: authority.collector_wiring.canonicalizer,
  gfs_helper: authority.collector_wiring.gfs_provider_helper,
  soil_executor: authority.collector_wiring.soil_provider_executor,
  kbs_late_decoder: authority.collector_wiring.kbs_authoritative_late_decoder,
  a18c_runner: authority.runtime_wiring.a18c_runner,
})) {
  requireCondition(blob(binding.path) === binding.blob_sha, `EA5E3_BOUND_COMPONENT_BLOB_DRIFT:${name}`);
}

requireCondition(amendment11.includes("PROVIDER_AVAILABILITY_WATERMARK_V1") && amendment11.includes("there is no fixed `T+432` normative cutoff") && amendment11.includes("formal_oldest_eligible_watermark_required = true"), "EA5E3_AMENDMENT11_WATERMARK_AUTHORITY_REQUIRED");
requireCondition(amendment18.includes("EA5E3") && amendment18.includes(DEADLINE) && amendment18.includes("A18D"), "EA5E3_AMENDMENT18_SEQUENCE_REQUIRED");
requireCondition(activation.effect_if_exact_head_proof_passes_and_candidate_merges?.ea5e2_operational_activation_qualified === true, "EA5E3_EA5E2_ACTIVATION_REQUIRED");
requireCondition(activation.temporal_authority?.provider_temporal_authority === "PROVIDER_AVAILABILITY_WATERMARK_V1" && activation.temporal_authority?.freshness_is_late_authoritative_admission_gate === false, "EA5E3_EA5E2_WATERMARK_REQUIRED");
requireCondition(activation.side_effect_boundary?.ea5e3_authorized === false && activation.effect_if_exact_head_proof_passes_and_candidate_merges?.ea5e3_authorized === false, "EA5E3_EA5E2_NONAUTHORIZATION_PREDECESSOR_REQUIRED");
requireCondition(a18c.epoch?.epoch_id === EPOCH && a18c.formal_store?.database_name === DB && a18c.manifest_hash === authority.governing_authorities.a18c_replacement_manifest.semantic_manifest_sha256, "EA5E3_A18C_REPLACEMENT_BINDING_REQUIRED");

const wiring = authority.collector_wiring;
requireCondition(wiring.entrypoint === COLLECTOR_PATH && wiring.workflow === WORKFLOW_PATH, "EA5E3_COLLECTOR_ENTRYPOINT_REQUIRED");
requireCondition(wiring.collector_side_provider_access_authorized === true && wiring.runtime_side_provider_access_authorized === false, "EA5E3_PROVIDER_BOUNDARY_REQUIRED");
requireCondition(wiring.formal_raw_retention_adapter.prefix === FORMAL_PREFIX && wiring.formal_raw_retention_adapter.raw_retention_before_decode_required === true && wiring.formal_raw_retention_adapter.content_addressed_idempotency_required === true, "EA5E3_RAW_RETENTION_BARRIER_REQUIRED");
requireCondition(wiring.canonical_evidence_ingress.append_only_facts_only === true && wiring.canonical_evidence_ingress.raw_reverification_before_fact_transaction_required === true, "EA5E3_APPEND_ONLY_EVIDENCE_INGRESS_REQUIRED");
requireCondition(wiring.preboundary_phase.available_to_runtime_at_lte_t_required === true && wiring.preboundary_phase.ingested_at_lte_t_required === true && wiring.preboundary_phase.same_complete_gfs_cycle_required === true && wiring.preboundary_phase.post_t_future_forcing_capture_authorized === false && wiring.preboundary_phase.expired_gap_backfill_or_relabel_authorized === false, "EA5E3_PREBOUNDARY_CAUSALITY_REQUIRED");
requireCondition(wiring.delayed_exact_phase.exact_interval_start === "T-PT1H" && wiring.delayed_exact_phase.exact_interval_end === "T" && wiring.delayed_exact_phase.actual_evidence_snapshot_time_required === true && wiring.delayed_exact_phase.fixed_cutoff_authorized === false && wiring.delayed_exact_phase.oldest_elapsed_incomplete_slot_first === true, "EA5E3_DELAYED_EXACT_INTERVAL_REQUIRED");
requireCondition(wiring.operational_trigger.cadence === "PT1H" && wiring.operational_trigger.cron_minute_is_normative_temporal_authority === false && wiring.operational_trigger.github_schedule_is_provider_publication_sla === false && wiring.operational_trigger.provider_batch_arrival_replaces_scheduler_clock === false, "EA5E3_OPERATIONAL_TRIGGER_NONNORMATIVE_REQUIRED");

requireCondition(collector.includes("MCFT_CAP_09_KBS_AUTHORITATIVE_LATE_DECODER_V1.py"), "EA5E3_CORRECTED_KBS_DECODER_REQUIRED");
requireCondition(collector.includes("S3CompatiblePrivateRawEvidenceRetentionAdapterV1") && collector.includes("PostgresExternalFormalEvidenceIngressV1"), "EA5E3_FORMAL_RETENTION_AND_INGRESS_REQUIRED");
requireCondition(collector.includes(FORMAL_PREFIX) && collector.includes(DB), "EA5E3_EXACT_FORMAL_RESOURCE_BINDING_REQUIRED");
requireCondition(collector.includes("EA5E3_PREBOUNDARY_GAP_EXPIRED_FAIL_CLOSED") && collector.includes("EA5E3_DELAYED_PARTIAL_DATASET_FAIL_CLOSED"), "EA5E3_FAIL_CLOSED_GAP_AND_PARTIAL_REQUIRED");
requireCondition(!collector.includes("McftCap09ExternalFormalCollectorPhaseOrchestratorV1") && !collector.includes("PRE_OFFSET_MINUTES") && !collector.includes("LATE_OFFSET_MINUTES") && !collector.includes("CUTOFF_OFFSET_MINUTES"), "EA5E3_FIXED_LAG_IMPLEMENTATION_FORBIDDEN");
requireCondition(!collector.includes("ea5e2_readiness") && !collector.includes("TRANSIENT_ROOT_PREFIX"), "EA5E3_QUALIFICATION_CARRIER_FORBIDDEN");

requireCondition(workflow.includes("cron: '0 * * * *'") && workflow.includes("cron_minute_is_normative_temporal_authority"), "EA5E3_HOURLY_TRIGGER_REQUIRED");
requireCondition(workflow.includes("github.event_name != 'pull_request'") && workflow.includes("refs/heads/main"), "EA5E3_LIVE_MAIN_ONLY_REQUIRED");
requireCondition(workflow.includes("git log --first-parent --diff-filter=A") && workflow.includes(DEADLINE), "EA5E3_EFFECTIVENESS_DEADLINE_RUNTIME_GUARD_REQUIRED");
requireCondition(workflow.includes("PREFLIGHT_MCFT_CAP_09_A18A_ZERO_STATE_FORMAL_STORE.ts"), "EA5E3_PR_READ_ONLY_ZERO_STATE_REPROOF_REQUIRED");

const temporal = authority.provider_temporal_semantics;
requireCondition(temporal.authority === "PROVIDER_AVAILABILITY_WATERMARK_V1" && temporal.kbs_observation_resolution === "HOURLY" && temporal.kbs_publication_cadence === "DAILY_BATCH", "EA5E3_PROVIDER_TEMPORAL_SEMANTICS_REQUIRED");
requireCondition(temporal.historical_online_freshness_diagnostic_hours === 6 && temporal.freshness_is_late_authoritative_admission_gate === false, "EA5E3_FRESHNESS_DIAGNOSTIC_ONLY_REQUIRED");
requireCondition(temporal.fixed_lag_7h_normative_authority === false && temporal.t_plus_0630_collector_normative_authority === false && temporal.t_plus_0712_cutoff_normative_authority === false && temporal.t_plus_0717_observer_normative_authority === false, "EA5E3_FIXED_LAG_AUTHORITY_MUST_BE_FALSE");

const blockers = authority.readiness_blockers;
requireCondition(blockers.new_store_identity_frozen === true && blockers.expected_prewindow_a0_and_24_runtime_config_pins_frozen === true && blockers.exact_24_slot_pins_frozen === true && blockers.collector_wiring_frozen_by_this_candidate === true && blockers.runtime_wiring_frozen === true && blockers.amendment_18_bound === true && blockers.blocker_count_if_exact_head_qualification_passes === 0, "EA5E3_BLOCKER_SET_NOT_CLOSED");

const a18d = authority.a18d_future_bootstrap_preauthorization;
requireCondition(a18d.preauthorized_if_ea5e3_becomes_effective_before_deadline === true && a18d.execution_not_before_actual_wall_clock === "2026-08-17T19:00:00.000Z" && a18d.must_complete_before === "2026-08-17T20:00:00.000Z", "EA5E3_A18D_TIME_BOUNDARY_REQUIRED");
for (const [name, value] of Object.entries(a18d.required_post_bootstrap_cutover_proof)) requireCondition(value === true, `EA5E3_A18D_CUTOVER_REQUIREMENT_FALSE:${name}`);
requireCondition(a18d.failure_effect === "FORMAL_O00_REMAINS_DISABLED", "EA5E3_A18D_FAIL_CLOSED_EFFECT_REQUIRED");

const gate = authority.activation_gate;
requireCondition(gate.ea5e3_effective_if_present_on_protected_main === true && gate.exact_head_focused_qualification_required === true && gate.repository_wide_ci_required === true && gate.merge_before_effectiveness_deadline_required === true, "EA5E3_EFFECTIVENESS_GATE_REQUIRED");
requireCondition(gate.formal_evidence_collector_enabled_after_effectiveness === true && gate.formal_evidence_fact_writes_before_a18d_authorized === true, "EA5E3_EVIDENCE_ONLY_PREA18D_WRITE_AUTHORITY_REQUIRED");
requireCondition(gate.runtime_config_persistence_before_a18d_authorized === false && gate.prewindow_a0_persistence_before_a18d_authorized === false && gate.runtime_scheduler_enablement_before_a18d_authorized === false && gate.canonical_runtime_tick_before_a18d_authorized === false, "EA5E3_PREA18D_RUNTIME_WRITE_FORBIDDEN");
requireCondition(gate.formal_o00_started === false && gate.formal_execution_count === "0/24", "EA5E3_FORMAL_NONSTART_REQUIRED");
requireCondition(authority.next_legal_frontier_if_effective === "A18D_PREWINDOW_A0_BOOTSTRAP_AND_POST_BOOTSTRAP_CUTOVER_PROOF_AT_ACTUAL_2026_08_17T19_00_00Z", "EA5E3_NEXT_FRONTIER_REQUIRED");

const result = {
  schema_version: "geox_mcft_cap09_ea5e3_formal_v2_provider_watermark_wiring_governance_v1",
  status: "PASS",
  exact_predecessor_protected_main: EXACT_BASE,
  effectiveness_deadline: DEADLINE,
  selected_epoch_id: EPOCH,
  formal_database_name: DB,
  formal_raw_prefix: FORMAL_PREFIX,
  provider_availability_watermark: "PROVIDER_AVAILABILITY_WATERMARK_V1",
  collector_provider_access: true,
  runtime_provider_access: false,
  corrected_kbs_authoritative_late_decoder_bound: true,
  formal_raw_retention_before_decode: true,
  append_only_evidence_ingress_bound: true,
  preboundary_post_t_capture_authorized: false,
  delayed_fixed_cutoff_authorized: false,
  cron_minute_is_normative_temporal_authority: false,
  fixed_lag_authority_used: false,
  blocker_count: 0,
  a18d_future_bootstrap_preauthorized_if_effective_before_deadline: true,
  a18d_execution_not_before: "2026-08-17T19:00:00.000Z",
  formal_o00_started: false,
  formal_execution_count: "0/24",
  qualification_provider_request_count: 0,
  qualification_database_write_count: 0,
  scheduler_write_count: 0,
  canonical_runtime_write_count: 0,
  runtime_config_write_count: 0,
  prewindow_a0_write_count: 0,
  next_legal_frontier: authority.next_legal_frontier_if_effective,
};
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
