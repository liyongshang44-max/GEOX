#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const WORKFLOW = ".github/workflows/mcft-cap-09-ea5e2-timing-budget-qualification.yml";
const COLLECTOR = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts";
const OBSERVER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_OBSERVER.ts";
const SEED = "scripts/runtime_acceptance/SEED_MCFT_CAP_09_EA5E2_OBSERVER_TIMING_QUALIFICATION.ts";
const AGGREGATE = "scripts/runtime_acceptance/QUALIFY_MCFT_CAP_09_EA5E2_TIMING_BUDGETS.ts";
const KBS_LATE_DECODER = "scripts/runtime_acceptance/MCFT_CAP_09_KBS_AUTHORITATIVE_LATE_DECODER_V1.py";
const KBS_TIMING_SELECTOR = "scripts/runtime_acceptance/SELECT_MCFT_CAP_09_EA5E2_TIMING_TARGET_AMENDMENT11.py";
const EVIDENCE = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-TIMING-BUDGET-QUALIFICATION-V1.json";
const VALIDATOR = "scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_TIMING_BUDGET_EVIDENCE_V2.cjs";

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`EA5E2_TIMING_QUALIFICATION_FILE_REQUIRED:${path}`);
  return fs.readFileSync(path, "utf8");
}

function requireAll(text, values, code) {
  for (const value of values) if (!text.includes(value)) throw new Error(`${code}:${value}`);
}

const workflow = read(WORKFLOW);
const collector = read(COLLECTOR);
const observer = read(OBSERVER);
const seed = read(SEED);
const aggregate = read(AGGREGATE);
const kbsLateDecoder = read(KBS_LATE_DECODER);
const kbsTimingSelector = read(KBS_TIMING_SELECTOR);
const evidence = read(EVIDENCE);
const validator = read(VALIDATOR);

requireAll(workflow, [
  "workflow_dispatch:",
  "github.event_name == 'workflow_dispatch' || github.event_name == 'push'",
  "QUALIFY_EXACT_MAIN_NO_FORMAL_WRITE",
  "EA5E2_TIMING_QUALIFICATION_PROTECTED_MAIN_REQUIRED",
  "git rev-parse origin/main",
  "TIMING_QUALIFICATION_LATE_EXACT_HOUR",
  "MCFT_CAP_09_KBS_AUTHORITATIVE_LATE_DECODER_V1.py selftest",
  "SELECT_MCFT_CAP_09_EA5E2_TIMING_TARGET_AMENDMENT11.py",
  "PROVIDER_AVAILABILITY_WATERMARK_V1",
  "QUALIFICATION_TIMING_ONLY_NOT_LIVE_TARGET_ADMISSION",
  "2026-08-15T11:00:00.000Z",
  "for trial in 1 2 3",
  "MCFT_EA5E2_OBSERVER_TIMING_QUALIFICATION_ACK: 'true'",
  "QUALIFY_MCFT_CAP_09_EA5E2_TIMING_BUDGETS.ts",
  "formal_database_write_count",
  "actions/upload-artifact@v4",
], "EA5E2_TIMING_QUALIFICATION_WORKFLOW_CONTRACT_MISSING");
requireAll(collector, [
  "TIMING_QUALIFICATION_LATE_EXACT_HOUR",
  "EA5E2_TIMING_QUALIFICATION_EXACT_MAIN_ACTION_RUN_REQUIRED",
  "KbsRawHourlyTransportV1",
  "PythonKbsLateDecoderV1",
  "PostgresExternalFormalEvidenceIngressV1",
  "KBS_AUTHORITATIVE_LATE_DECODER_SCRIPT",
  "freshness_is_late_authoritative_admission_gate",
  "--target-t",
  "collection_to_ingress_completion_elapsed_ms",
  "transient_cleanup_confirmed",
  "formal_database_write_count: 0",
  "authority_effect: false",
  "live_dispatch_authorized: false",
], "EA5E2_COLLECTOR_TIMING_PATH_MISSING");
requireAll(kbsLateDecoder, [
  "HISTORICAL_FRESHNESS_HOURS = 6.0",
  "freshness_is_late_authoritative_admission_gate\": False",
  "provider_publication_cadence\": \"DAILY_BATCH\"",
  "select_complete_exact_row",
  "EXACT_REQUESTED_TARGET",
  "stale_daily_batch_remains_selectable",
], "EA5E2_AMENDMENT11_LATE_DECODER_CONTRACT_MISSING");
requireAll(kbsTimingSelector, [
  "PROVIDER_AVAILABILITY_WATERMARK_V1",
  "freshness_is_late_authoritative_admission_gate\": False",
  "provider_publication_cadence\": \"DAILY_BATCH\"",
  "QUALIFICATION_TIMING_ONLY_NOT_LIVE_TARGET_ADMISSION",
  "select_complete_exact_row",
], "EA5E2_AMENDMENT11_TIMING_SELECTOR_CONTRACT_MISSING");
if (workflow.includes("Number(value.latest_age_hours)>6")) throw new Error("EA5E2_TIMING_WORKFLOW_FRESHNESS_HARD_GATE_FORBIDDEN");
if (collector.includes('runPython(["decode-kbs-late"')) throw new Error("EA5E2_COLLECTOR_LEGACY_FRESHNESS_DECODER_FORBIDDEN");
requireAll(observer, [
  "MCFT_EA5E2_OBSERVER_TIMING_QUALIFICATION_ACK",
  "EA5E2_OBSERVER_TIMING_QUALIFICATION_EXACT_MAIN_ACTION_RUN_REQUIRED",
  "scheduling_clock_bypassed_for_historical_fixture",
  "timing_qualification_actual_execution_started_at",
  "authority_effect: false",
  "live_dispatch_authorized: false",
], "EA5E2_OBSERVER_TIMING_PATH_MISSING");
requireAll(seed, [
  "buildEa5b5bExternalFixtureV1",
  "EA5E2_OBSERVER_TIMING_TARGET_V1",
  "2026-08-15T11:00:00.000Z",
  "target_bound_to_fresh_t3r1_o00_candidate: true",
  "shiftQualificationTimestamp",
  "bindLateExactIntervalAvailability",
  "+ 390 * 60_000",
  "+ 391 * 60_000",
  "assertQualificationCandidateTiming",
  "EA5E2_OBSERVER_TIMING_SEED_CAUSAL_ORDER_INVALID",
  "rehashQualificationRecord",
  "JSON.stringify({ type: candidate.record_type, payload: candidate })",
  "EA5E2_OBSERVER_TIMING_SEED_EXACT_MAIN_ACTION_RUN_REQUIRED",
  "TRUNCATE TABLE facts",
  "canonical_fact_count: count",
  "formal_database_write_count: 0",
], "EA5E2_OBSERVER_TIMING_SEED_MISSING");
requireAll(aggregate, [
  "const TRIAL_COUNT = 3",
  "const COLLECTOR_BUDGET_MS = 25 * 60_000",
  "const OBSERVER_BUDGET_MS = 5 * 60_000",
  "const SAFETY_FACTOR = 2",
  "collectorMax * SAFETY_FACTOR",
  "observerMax * SAFETY_FACTOR",
  "crop_or_season_authority_changed: false",
  "live_dispatch_authorized: false",
], "EA5E2_TIMING_AGGREGATION_CONTRACT_MISSING");
requireAll(evidence, [
  "eb21a3e5c51a471d7eecd6118bd27a53201d49fc",
  "31680898174",
  "9173467650",
  "sha256:3d1fc6316f2195c4ab8ddbab17b52d018d17b1c196cf471c538944f8ef59dbd6",
  "\"safety_adjusted_max_elapsed_ms\": 36596",
  "\"safety_adjusted_max_elapsed_ms\": 3670",
  "\"live_dispatch_authorized\": false",
], "EA5E2_TIMING_FROZEN_EVIDENCE_MISSING");
requireAll(validator, [
  "EA5E2_TIMING_V2_EXACT_MAIN_BINDING_DRIFT",
  "EA5E2_TIMING_V2_MEASURED_BLOB_DRIFT",
  "EA5E2_COLLECTOR_TIMING_V2_BUDGET_NOT_QUALIFIED",
  "EA5E2_OBSERVER_TIMING_V2_BUDGET_NOT_QUALIFIED",
  "observer_operational_start_deadline_offset_minutes: 442",
  "frozen_observer_max_start_offset_minutes: 447",
], "EA5E2_TIMING_FROZEN_EVIDENCE_VALIDATOR_MISSING");

console.log(JSON.stringify({
  schema_version: "geox_mcft_cap09_ea5e2_timing_budget_qualification_static_acceptance_v1",
  status: "PASS",
  real_collector_trial_count: 3,
  real_observer_trial_count: 3,
  collector_budget_minutes: 25,
  observer_budget_minutes: 5,
  safety_factor: 2,
  exact_main_action_run_required: true,
  exact_main_frozen_evidence_bound: true,
  formal_effect: false,
  authority_effect: false,
  live_dispatch_authorized: false,
}));
