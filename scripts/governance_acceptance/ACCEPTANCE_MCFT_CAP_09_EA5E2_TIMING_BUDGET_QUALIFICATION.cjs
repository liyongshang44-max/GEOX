#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const WORKFLOW = ".github/workflows/mcft-cap-09-ea5e2-timing-budget-qualification.yml";
const COLLECTOR = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts";
const OBSERVER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_OBSERVER.ts";
const SEED = "scripts/runtime_acceptance/SEED_MCFT_CAP_09_EA5E2_OBSERVER_TIMING_QUALIFICATION.ts";
const AGGREGATE = "scripts/runtime_acceptance/QUALIFY_MCFT_CAP_09_EA5E2_TIMING_BUDGETS.ts";

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

requireAll(workflow, [
  "workflow_dispatch:",
  "github.event_name == 'workflow_dispatch' || github.event_name == 'push'",
  "QUALIFY_EXACT_MAIN_NO_FORMAL_WRITE",
  "EA5E2_TIMING_QUALIFICATION_PROTECTED_MAIN_REQUIRED",
  "git rev-parse origin/main",
  "TIMING_QUALIFICATION_LATE_EXACT_HOUR",
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
  "collection_to_ingress_completion_elapsed_ms",
  "transient_cleanup_confirmed",
  "formal_database_write_count: 0",
  "authority_effect: false",
  "live_dispatch_authorized: false",
], "EA5E2_COLLECTOR_TIMING_PATH_MISSING");
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

console.log(JSON.stringify({
  schema_version: "geox_mcft_cap09_ea5e2_timing_budget_qualification_static_acceptance_v1",
  status: "PASS",
  real_collector_trial_count: 3,
  real_observer_trial_count: 3,
  collector_budget_minutes: 25,
  observer_budget_minutes: 5,
  safety_factor: 2,
  exact_main_action_run_required: true,
  formal_effect: false,
  authority_effect: false,
  live_dispatch_authorized: false,
}));
