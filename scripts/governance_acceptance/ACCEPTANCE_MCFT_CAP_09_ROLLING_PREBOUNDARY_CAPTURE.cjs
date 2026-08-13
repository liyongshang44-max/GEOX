#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { ROLLING_WORKFLOW, minimumIngressMarginMinutes } = require("../runtime_acceptance/MCFT_CAP_09_A11_PREBOUNDARY_DEADLINE_POLICY_V1.cjs");

const AMENDMENT = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md";
const WORKFLOW = ".github/workflows/mcft-cap-09-rolling-preboundary-capture.yml";
const PLANNER = "scripts/runtime_acceptance/PLAN_MCFT_CAP_09_ROLLING_PREBOUNDARY_TARGET.cjs";
const ASSEMBLER = "scripts/runtime_acceptance/ASSEMBLE_MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.cjs";
const PROVIDER_RUNNER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts";
const ORCHESTRATOR = "apps/server/src/external_evidence/mcft_cap09_external_formal_collector_phase_orchestrator_v1.ts";

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
const orchestrator = read(ORCHESTRATOR);

requireAll(amendment, [
  "PROVIDER_AVAILABILITY_WATERMARK_V1",
  "available_to_runtime_at <= T",
  "ingested_at <= T",
  "actual hourly pre-boundary capture",
  "A pre-boundary package may qualify only if its soil/GFS evidence was actually acquired and frozen before its target `T`.",
  "crop_authority_effect = NONE",
], "MCFT_CAP09_ROLLING_PREBOUNDARY_AMENDMENT11_BOUNDARY_MISSING");

requireAll(planner, [
  "MIN_TARGET_LEAD_MINUTES = 35",
  "CANDIDATE_RETENTION_HOURS = 36",
  "provider_publication_dependency: \"NONE\"",
  "kbs_raw_hourly_dependency: \"NONE\"",
  "crop_authority_dependency: \"NONE\"",
  "PROVIDER_AVAILABILITY_WATERMARK_V1",
], "MCFT_CAP09_ROLLING_PREBOUNDARY_PLANNER_CONTRACT_MISSING");

requireAll(assembler, [
  "ROLLING_PRE_BOUNDARY_CAUSAL_CAPTURE",
  "PROVIDER_AVAILABILITY_WATERMARK_V1",
  "soil_observation_inside_t_minus_15_to_t",
  "same_cycle_future_weather_et0",
  "raw_retained_before_canonicalization",
  "consumer_exact_main_successor_qualification_required: true",
  "crop_authority_checked_only_at_consumption",
  "delayed_kbs_exact_interval_checked_only_at_consumption",
  "formal_database_write_count: 0",
  "formal_r2_prefix_write_count: 0",
  "scheduler_write_count: 0",
  "runtime_write_count: 0",
  "crop_authority_effect: \"NONE\"",
], "MCFT_CAP09_ROLLING_PREBOUNDARY_ASSEMBLER_CONTRACT_MISSING");

requireAll(workflow, [
  "cron: '5 * * * *'",
  "branches: [main]",
  "MCFT_CAP09_ROLLING_PREBOUNDARY_EXACT_MAIN_DRIFT",
  "MCFT_EA5E2_LIVE_PHASE: PRE_BOUNDARY_CAUSAL",
  "RUN_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts",
  "ASSEMBLE_MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.cjs",
], "MCFT_CAP09_ROLLING_PREBOUNDARY_WORKFLOW_CONTRACT_MISSING");

if (minimumIngressMarginMinutes(ROLLING_WORKFLOW) !== 0) {
  throw new Error("MCFT_CAP09_ROLLING_PREBOUNDARY_TARGET_T_POLICY_REQUIRED");
}
if (minimumIngressMarginMinutes("historical-ea5e2") !== 5) {
  throw new Error("MCFT_CAP09_HISTORICAL_T_MINUS_5_POLICY_DRIFT");
}

requireAll(providerRunner, [
  'const MIN_INGRESS_MARGIN_MINUTES = process.env.GITHUB_WORKFLOW === "mcft-cap-09-rolling-preboundary-capture" ? 0 : 5;',
  "const latestIngressStartMs = Date.parse(addMinutes(target, -MIN_INGRESS_MARGIN_MINUTES));",
  "while (Date.now() < latestIngressStartMs)",
  "observedAt >= soilWindowStart && observedAt <= Date.parse(target)",
  "if (Date.parse(canonicalizedAt) > latestIngressStartMs)",
  "orchestrator.ingestCanonicalizedPhase",
  "soil_observation_inside_t_minus_15_to_t: true",
  "gfs_same_cycle_pair: true",
  "formal_database_write_count: 0",
  "formal_r2_write_count: 0",
], "MCFT_CAP09_ROLLING_PREBOUNDARY_RUNNER_TARGET_T_SEAM_MISSING");

requireAll(orchestrator, [
  'return phase === "PRE_BOUNDARY_CAUSAL" ? slot.logical_time : slot.late_exact_hour_evidence_cutoff;',
  "EA5E2_COLLECTOR_CANONICALIZED_AFTER_DEADLINE",
  "EA5E2_COLLECTOR_RECORD_AFTER_PHASE_DEADLINE",
  "EA5E2_COLLECTOR_PREBOUNDARY_FUTURE_EVENT_FORBIDDEN",
], "MCFT_CAP09_ROLLING_PREBOUNDARY_HARD_CAUSAL_GATE_MISSING");

console.log(JSON.stringify({
  schema_version: "geox_mcft_cap09_rolling_preboundary_capture_acceptance_v2",
  status: "PASS",
  temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
  schedule: "hourly",
  rolling_preboundary_margin_minutes: 0,
  historical_nonrolling_margin_minutes: 5,
  preboundary_deadline_authority: "TARGET_T",
  hard_causality_gate: {
    canonicalized_at_lte_t: true,
    available_to_runtime_at_lte_t: true,
    ingested_at_lte_t: true,
    future_event_forbidden: true
  },
  candidate_retention_hours: 36,
  formal_effect: false,
  crop_authority_effect: "NONE"
}));
