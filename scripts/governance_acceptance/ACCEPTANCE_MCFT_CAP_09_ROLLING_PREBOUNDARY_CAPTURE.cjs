#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const AMENDMENT = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md";
const WORKFLOW = ".github/workflows/mcft-cap-09-rolling-preboundary-capture.yml";
const PLANNER = "scripts/runtime_acceptance/PLAN_MCFT_CAP_09_ROLLING_PREBOUNDARY_TARGET.cjs";
const ASSEMBLER = "scripts/runtime_acceptance/ASSEMBLE_MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.cjs";
const PROVIDER_RUNNER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts";

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`MCFT_CAP09_ROLLING_PREBOUNDARY_FILE_REQUIRED:${path}`);
  return fs.readFileSync(path, "utf8");
}
function requireAll(text, values, code) {
  for (const value of values) if (!text.includes(value)) throw new Error(`${code}:${value}`);
}

const amendment = read(AMENDMENT);
const workflow = read(WORKFLOW);
const planner = read(PLANNER);
const assembler = read(ASSEMBLER);
const providerRunner = read(PROVIDER_RUNNER);

requireAll(amendment, [
  "PROVIDER_AVAILABILITY_WATERMARK_V1",
  "### 5.1 Pre-boundary causal families",
  "soil_moisture_observation_v1",
  "future_weather_assumption_v1",
  "future_et0_assumption_v1",
  "available_to_runtime_at <= T",
  "ingested_at <= T",
  "actual hourly pre-boundary capture",
  "retain rolling candidate packages for approximately 36h",
  "Qualification candidate retention is not Formal canonical persistence",
  "crop_authority_effect = NONE",
], "MCFT_CAP09_ROLLING_PREBOUNDARY_AMENDMENT11_BOUNDARY_MISSING");

requireAll(planner, [
  "MIN_TARGET_LEAD_MINUTES = 35",
  "CANDIDATE_RETENTION_HOURS = 36",
  "provider_publication_dependency: \"NONE\"",
  "kbs_raw_hourly_dependency: \"NONE\"",
  "crop_authority_dependency: \"NONE\"",
  "PROVIDER_AVAILABILITY_WATERMARK_V1",
  "selftest",
], "MCFT_CAP09_ROLLING_PREBOUNDARY_PLANNER_CONTRACT_MISSING");

requireAll(assembler, [
  "ROLLING_PRE_BOUNDARY_CAUSAL_CAPTURE",
  "PROVIDER_AVAILABILITY_WATERMARK_V1",
  "producer_subject_sha: subject",
  "soil_observation_inside_t_minus_15_to_t",
  "same_cycle_future_weather_et0",
  "raw_retained_before_canonicalization",
  "producer_subject_sha_immutable: true",
  "producer_exact_main_capture_proof_required: true",
  "consumer_subject_may_differ_from_producer: true",
  "consumer_exact_main_successor_qualification_required: true",
  "cross_version_rehydration_required_when_consumer_subject_differs: true",
  "raw_retention_reverification_required: true",
  "semantic_hash_reverification_required: true",
  "crop_authority_checked_only_at_consumption",
  "delayed_kbs_exact_interval_checked_only_at_consumption",
  "oldest_eligible_selection_required",
  "consumer_same_git_sha_required: false",
  "kbs_daily_batch_required_at_capture: false",
  "crop_authority_required_at_capture: false",
  "formal_database_write_count: 0",
  "formal_r2_prefix_write_count: 0",
  "scheduler_write_count: 0",
  "runtime_write_count: 0",
  "crop_authority_effect: \"NONE\"",
], "MCFT_CAP09_ROLLING_PREBOUNDARY_ASSEMBLER_CONTRACT_MISSING");

for (const forbidden of [
  "exact_subject_sha_required: true",
  "successful_successor_qualification_for_subject_required: true",
]) {
  if (assembler.includes(forbidden)) throw new Error(`MCFT_CAP09_ROLLING_PREBOUNDARY_SAME_HEAD_CONSUMPTION_FORBIDDEN:${forbidden}`);
}

requireAll(workflow, [
  "cron: '5 * * * *'",
  "branches: [main]",
  "MCFT_CAP09_ROLLING_PREBOUNDARY_EXACT_MAIN_DRIFT",
  "PLAN_MCFT_CAP_09_ROLLING_PREBOUNDARY_TARGET.cjs plan",
  "MCFT_EA5E2_LIVE_PHASE: PRE_BOUNDARY_CAUSAL",
  "RUN_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts",
  "ASSEMBLE_MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.cjs",
  "retention-days: 2",
  "kbs_daily_batch_required_at_capture!==false",
  "crop_authority_required_at_capture!==false",
  "formal_database_write_count!==0",
  "formal_r2_prefix_write_count!==0",
  "scheduler_write_count!==0",
  "runtime_write_count!==0",
  "crop_authority_effect!=='NONE'",
], "MCFT_CAP09_ROLLING_PREBOUNDARY_WORKFLOW_CONTRACT_MISSING");

for (const forbidden of [
  "CURRENT_CROP_AUTHORITY_HAS_NO_FUTURE_LEGAL_TARGET",
  "configured_max_age_hours",
  "KBS_RAW_HOURLY",
  "LATE_EXACT_HOUR",
  "T+432",
  "T+07:12",
  "T+07:17",
]) {
  if (workflow.includes(forbidden)) throw new Error(`MCFT_CAP09_ROLLING_PREBOUNDARY_WORKFLOW_FORBIDDEN_DEPENDENCY:${forbidden}`);
}

requireAll(providerRunner, [
  "PRE_BOUNDARY_CAUSAL",
  "soil_observation_inside_t_minus_15_to_t: true",
  "gfs_same_cycle_pair: true",
  "rehydration_manifest",
  "formal_database_write_count: 0",
  "formal_r2_write_count: 0",
], "MCFT_CAP09_ROLLING_PREBOUNDARY_EXISTING_RUNNER_CAPABILITY_REQUIRED");

console.log(JSON.stringify({
  schema_version: "geox_mcft_cap09_rolling_preboundary_capture_acceptance_v1",
  status: "PASS",
  temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
  schedule: "hourly",
  candidate_retention_hours: 36,
  captured_families: ["soil_moisture_observation_v1", "future_weather_assumption_v1", "future_et0_assumption_v1"],
  kbs_daily_batch_required_at_capture: false,
  crop_authority_required_at_capture: false,
  producer_subject_sha_immutable: true,
  consumer_same_git_sha_required: false,
  consumer_exact_main_successor_qualification_required: true,
  cross_version_raw_and_semantic_reverification_required: true,
  formal_effect: false,
  crop_authority_effect: "NONE"
}));
