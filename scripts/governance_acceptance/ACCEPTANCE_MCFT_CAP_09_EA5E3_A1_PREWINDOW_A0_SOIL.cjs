#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = process.cwd();
const AUTHORITY_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E3-AMENDMENT-01-PREWINDOW-A0-SOIL-EVIDENCE-AUTHORITY.json";
const ORIGINAL_EA5E3_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E3-FORMAL-AUTHORITY-V3.json";
const COLLECTOR_PATH = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E3_A1_PREWINDOW_A0_SOIL_COLLECTOR.ts";
const WORKFLOW_PATH = ".github/workflows/mcft-cap-09-ea5e3-a1-prewindow-a0-soil.yml";
const OUTPUT_DIR = path.join(ROOT, "acceptance-output");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "MCFT_CAP_09_EA5E3_A1_PREWINDOW_A0_SOIL_GOVERNANCE.json");
const EXACT_BASE = "1daf449c5d572b49c41ed54c771ff7ecbee004e7";
const DEADLINE = "2026-08-17T08:00:00.000Z";
const A0 = "2026-08-17T19:00:00.000Z";
const WINDOW_START = "2026-08-17T18:00:00.000Z";
const DB = "geox_mcft_cap09_s6_formal_t3r1_24h_v2";

function requireCondition(value, code) { if (!value) throw new Error(code); }
function text(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }
function json(rel) { return JSON.parse(text(rel)); }
function blob(rel) { return execFileSync("git", ["hash-object", rel], { cwd: ROOT, encoding: "utf8" }).trim(); }

const authority = json(AUTHORITY_PATH);
const original = json(ORIGINAL_EA5E3_PATH);
const collector = text(COLLECTOR_PATH);
const workflow = text(WORKFLOW_PATH);
const a0Service = text(authority.governing_authorities.a0_evidence_window_service.path);
const builder = text(authority.governing_authorities.evidence_window_builder.path);
const amendment18 = text(authority.governing_authorities.amendment_18.path);

requireCondition(authority.schema_version === "geox_mcft_cap09_ea5e3_amendment_01_prewindow_a0_soil_evidence_authority_v1", "EA5E3_A1_AUTHORITY_SCHEMA_REQUIRED");
requireCondition(authority.exact_predecessor_protected_main === EXACT_BASE, "EA5E3_A1_EXACT_BASE_REQUIRED");
requireCondition(authority.effectiveness_deadline === DEADLINE, "EA5E3_A1_EFFECTIVENESS_DEADLINE_REQUIRED");
requireCondition(authority.selected_epoch.prewindow_a0 === A0 && authority.selected_epoch.o00 === "2026-08-17T20:00:00.000Z" && authority.selected_epoch.unchanged === true, "EA5E3_A1_EPOCH_MUST_REMAIN_UNCHANGED");
requireCondition(authority.formal_store.database_name === DB && authority.formal_store.historical_database_write_authorized === false, "EA5E3_A1_REPLACEMENT_STORE_REQUIRED");

requireCondition(blob(ORIGINAL_EA5E3_PATH) === authority.supersession.original_ea5e3_authority.blob_sha, "EA5E3_A1_ORIGINAL_AUTHORITY_BLOB_DRIFT");
for (const [name, binding] of Object.entries(authority.governing_authorities)) {
  requireCondition(blob(binding.path) === binding.blob_sha, `EA5E3_A1_GOVERNING_BLOB_DRIFT:${name}`);
}
requireCondition(blob(COLLECTOR_PATH) === authority.collector_wiring.entrypoint_blob_sha, "EA5E3_A1_COLLECTOR_BLOB_DRIFT");
for (const [name, binding] of Object.entries({
  retention: authority.collector_wiring.formal_raw_retention_adapter,
  ingress: authority.collector_wiring.canonical_evidence_ingress,
  soil: authority.collector_wiring.soil_provider_executor,
})) {
  requireCondition(blob(binding.path) === binding.blob_sha, `EA5E3_A1_COMPONENT_BLOB_DRIFT:${name}`);
}

requireCondition(original.readiness_blockers.blocker_count_if_exact_head_qualification_passes === 0, "EA5E3_A1_ORIGINAL_ZERO_BLOCKER_CLAIM_REQUIRED");
requireCondition(original.a18d_future_bootstrap_preauthorization.preauthorized_if_ea5e3_becomes_effective_before_deadline === true, "EA5E3_A1_ORIGINAL_A18D_PREAUTH_CLAIM_REQUIRED");
requireCondition(authority.correction_reason.original_ea5e3_blocker_count_zero_was_complete === false, "EA5E3_A1_CORRECTION_MUST_REJECT_ORIGINAL_ZERO_BLOCKER_COMPLETENESS");
requireCondition(authority.correction_reason.selected_epoch_invalidated === false && authority.correction_reason.a18a_a18b_a18c_invalidated === false && authority.correction_reason.ea5e3_v2_collector_runtime_wiring_invalidated === false, "EA5E3_A1_CORRECTION_SCOPE_MUST_BE_NARROW");
requireCondition(authority.supersession.pre_amendment_effective_blocker_count === 1 && authority.supersession.pre_amendment_a18d_preauthorized === false, "EA5E3_A1_PRE_EFFECTIVE_FAIL_CLOSED_REQUIRED");

requireCondition(a0Service.includes("buildFrozenEvidenceWindowV1") && a0Service.includes("authorized_soil_binding_id"), "EA5E3_A1_AUTHORIZED_A0_SOIL_SERVICE_REQUIRED");
requireCondition(builder.includes("OPEN_START_CLOSED_END_PT1H_V1"), "EA5E3_A1_PT1H_WINDOW_RULE_REQUIRED");
requireCondition(builder.includes("eventTime <= windowStart") && builder.includes("available > logicalTime") && builder.includes("NO_USABLE_SOIL_OBSERVATION_IN_A0_WINDOW"), "EA5E3_A1_A0_SOIL_HARD_DEPENDENCY_REQUIRED");
requireCondition(amendment18.includes("2026-08-17T19:00:00.000Z") && amendment18.includes("A18D"), "EA5E3_A1_AMENDMENT18_PREWINDOW_REQUIRED");

const contract = authority.prewindow_a0_evidence_contract;
requireCondition(contract.logical_time === A0 && contract.window_start_exclusive === WINDOW_START && contract.window_end_inclusive === A0, "EA5E3_A1_EXACT_A0_WINDOW_REQUIRED");
requireCondition(contract.window_rule_id === "OPEN_START_CLOSED_END_PT1H_V1" && contract.required_record_type === "soil_moisture_observation_v1" && contract.required_minimum_usable_count === 1, "EA5E3_A1_EXACT_SOIL_REQUIREMENT_REQUIRED");
requireCondition(contract.authorized_soil_binding_required === true && JSON.stringify(contract.quality_allowed) === JSON.stringify(["PASS", "LIMITED"]), "EA5E3_A1_SOIL_AUTHORITY_QUALITY_REQUIRED");
requireCondition(contract.observed_at_gt_window_start_required === true && contract.observed_at_lte_logical_time_required === true && contract.available_to_runtime_at_lte_logical_time_required === true && contract.ingested_at_lte_logical_time_required === true, "EA5E3_A1_REAL_CHRONOLOGY_REQUIRED");
requireCondition(contract.future_evidence_authorized === false && contract.late_after_a0_authorized === false && contract.timestamp_relabel_authorized === false, "EA5E3_A1_FUTURE_LATE_RELABEL_FORBIDDEN");

const wiring = authority.collector_wiring;
requireCondition(wiring.entrypoint === COLLECTOR_PATH && wiring.workflow === WORKFLOW_PATH, "EA5E3_A1_ENTRYPOINT_WORKFLOW_REQUIRED");
requireCondition(wiring.formal_raw_retention_adapter.raw_retention_before_decode_required === true && wiring.canonical_evidence_ingress.append_only_facts_only === true, "EA5E3_A1_RAW_FIRST_APPEND_ONLY_REQUIRED");
requireCondition(wiring.capture_window_start === WINDOW_START && wiring.collector_hard_stop === "2026-08-17T18:58:00.000Z", "EA5E3_A1_CAPTURE_WINDOW_REQUIRED");
requireCondition(wiring.provider_access_side === "COLLECTOR_ONLY" && wiring.runtime_provider_access_authorized === false && wiring.raw_values_in_artifact_authorized === false, "EA5E3_A1_PROVIDER_OUTPUT_BOUNDARY_REQUIRED");

requireCondition(collector.includes("prewindow_a0_soil_20260817t190000z"), "EA5E3_A1_DATASET_PIN_REQUIRED");
requireCondition(collector.includes("S3CompatiblePrivateRawEvidenceRetentionAdapterV1") && collector.includes("PostgresExternalFormalEvidenceIngressV1"), "EA5E3_A1_RETENTION_INGRESS_REQUIRED");
requireCondition(collector.includes("observedAt) > Date.parse(WINDOW_START)") && collector.includes("Date.parse(availableAt) <= Date.parse(PREWINDOW_A0)") && collector.includes("Date.parse(ingestedAt) <= Date.parse(PREWINDOW_A0)"), "EA5E3_A1_COLLECTOR_CHRONOLOGY_GUARD_REQUIRED");
requireCondition(collector.includes("EA5E3_A1_PREWINDOW_A0_SOIL_DEADLINE_MISSED_FAIL_CLOSED") && collector.includes("EA5E3_A1_NO_USABLE_SOIL_OBSERVATION_IN_PREWINDOW_A0_WINDOW_FAIL_CLOSED"), "EA5E3_A1_RUNTIME_FAIL_CLOSED_REQUIRED");
requireCondition(!collector.includes("PRE_OFFSET_MINUTES") && !collector.includes("LATE_OFFSET_MINUTES") && !collector.includes("CUTOFF_OFFSET_MINUTES"), "EA5E3_A1_FIXED_LAG_CONSTANTS_FORBIDDEN");

const temporal = authority.temporal_semantics;
requireCondition(temporal.authority === "PROVIDER_AVAILABILITY_WATERMARK_V1", "EA5E3_A1_WATERMARK_AUTHORITY_REQUIRED");
requireCondition(temporal.fixed_7h_authority === false && temporal.fixed_t_plus_0630_authority === false && temporal.fixed_t_plus_0712_authority === false && temporal.fixed_t_plus_0717_authority === false, "EA5E3_A1_FIXED_LAG_REVIVAL_FORBIDDEN");
requireCondition(temporal.workflow_schedule_is_normative_temporal_authority === false && temporal.source_substitution_authorized === false && temporal.interpolation_authorized === false && temporal.persistence_fill_authorized === false && temporal.timestamp_relabel_authorized === false, "EA5E3_A1_TEMPORAL_NONCLAIMS_REQUIRED");

const effect = authority.readiness_effect;
requireCondition(effect.blocker_id === "PREWINDOW_A0_USABLE_AUTHORIZED_SOIL_EVIDENCE_INGRESS" && effect.blocker_closed_by_static_wiring_qualification === true && effect.runtime_obligation_must_still_succeed_before_a18d === true, "EA5E3_A1_BLOCKER_EFFECT_REQUIRED");
requireCondition(effect.effective_blocker_count_after_exact_head_qualification_and_on_time_merge === 0 && effect.a18d_preauthorization_restored_after_exact_head_qualification_and_on_time_merge === true && effect.a18d_execution_still_not_before === A0, "EA5E3_A1_PREAUTH_RESTORATION_REQUIRED");
requireCondition(authority.runtime_fail_closed_conditions.missing_usable_a0_soil_at_2026_08_17t19z === "A18D_DISABLED_AND_FORMAL_O00_DISABLED", "EA5E3_A1_MISSING_SOIL_FAIL_CLOSED_REQUIRED");

const gate = authority.activation_gate;
requireCondition(gate.amendment_effective_if_present_on_protected_main === true && gate.exact_head_focused_qualification_required === true && gate.repository_wide_ci_required === true && gate.merge_before_effectiveness_deadline_required === true, "EA5E3_A1_EFFECTIVENESS_GATE_REQUIRED");
requireCondition(gate.prewindow_a0_soil_collector_enabled_after_effectiveness === true && gate.formal_evidence_fact_write_authorized_before_a18d === true, "EA5E3_A1_EVIDENCE_WRITE_AUTHORITY_REQUIRED");
requireCondition(gate.runtime_config_write_authorized_before_a18d === false && gate.prewindow_a0_state_write_authorized_before_a18d === false && gate.scheduler_write_authorized_before_a18d === false && gate.canonical_runtime_tick_authorized_before_a18d === false, "EA5E3_A1_PREA18D_RUNTIME_WRITES_FORBIDDEN");
requireCondition(gate.formal_o00_started === false && gate.formal_execution_count === "0/24", "EA5E3_A1_FORMAL_NONSTART_REQUIRED");
requireCondition(authority.next_legal_frontier_if_effective === "A18D_PREWINDOW_A0_BOOTSTRAP_AND_POST_BOOTSTRAP_CUTOVER_PROOF_AT_ACTUAL_2026_08_17T19_00_00Z", "EA5E3_A1_NEXT_FRONTIER_REQUIRED");

requireCondition(workflow.includes("0,20,40,55 18 17 8 *") && workflow.includes("workflow_schedule_is_normative_temporal_authority"), "EA5E3_A1_SCHEDULE_AND_NONAUTHORITY_REQUIRED");
requireCondition(workflow.includes("github.event_name != 'pull_request'") && workflow.includes("refs/heads/main"), "EA5E3_A1_LIVE_MAIN_ONLY_REQUIRED");
requireCondition(workflow.includes("git log --first-parent --diff-filter=A") && workflow.includes(DEADLINE), "EA5E3_A1_ON_TIME_EFFECTIVENESS_RUNTIME_GUARD_REQUIRED");
requireCondition(workflow.includes("PREFLIGHT_MCFT_CAP_09_A18A_ZERO_STATE_FORMAL_STORE.ts"), "EA5E3_A1_PR_ZERO_STATE_READ_ONLY_REPROOF_REQUIRED");

const result = {
  schema_version: "geox_mcft_cap09_ea5e3_a1_prewindow_a0_soil_governance_v1",
  status: "PASS",
  exact_predecessor_protected_main: EXACT_BASE,
  effectiveness_deadline: DEADLINE,
  selected_epoch_unchanged: true,
  prewindow_a0: A0,
  evidence_window_start_exclusive: WINDOW_START,
  evidence_window_end_inclusive: A0,
  required_record_type: "soil_moisture_observation_v1",
  original_ea5e3_zero_blocker_claim_incomplete: true,
  original_ea5e3_collector_runtime_wiring_retained: true,
  pre_effective_blocker_count: 1,
  blocker_count_after_exact_head_qualification_and_on_time_merge: 0,
  a18d_preauthorization_restored_if_effective: true,
  runtime_obligation_must_succeed_before_a18d: true,
  provider_availability_watermark: "PROVIDER_AVAILABILITY_WATERMARK_V1",
  qualification_provider_request_count: 0,
  qualification_database_write_count: 0,
  scheduler_write_count: 0,
  canonical_runtime_write_count: 0,
  runtime_config_write_count: 0,
  prewindow_a0_state_write_count: 0,
  formal_o00_started: false,
  formal_execution_count: "0/24"
};
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
