#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const fail = (message) => { throw new Error(message); };
const eq = (actual, expected, code) => {
  if (actual !== expected) fail(`${code}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
};
const has = (text, marker, code) => {
  if (!text.includes(marker)) fail(`${code}:${marker}`);
};
const lacks = (text, marker, code) => {
  if (text.includes(marker)) fail(`${code}:${marker}`);
};
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const blob = (ref, filePath) => git("rev-parse", `${ref}:${filePath}`);
const read = (filePath) => fs.readFileSync(filePath, "utf8");

const base = process.env.MCFT_BASE_SHA;
eq(base, "a2224d597e523ca1060f2172c7f9052c5fd0bdbe", "AMENDMENT11_EXACT_BASE_REQUIRED");

const amendmentPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AMENDMENT_11_PROVIDER_AVAILABILITY_WATERMARK_AUTHORITY.cjs";
const workflowPath = ".github/workflows/mcft-cap-09-amendment-11-provider-availability-watermark-authority.yml";

const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed), JSON.stringify([amendmentPath, gatePath, workflowPath].sort()), "AMENDMENT11_EXACT_THREE_FILE_BOUNDARY_REQUIRED");

const predecessorPins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-07-EXTERNAL-FORMAL-FIXED-LAG-CAUSALITY-AUTHORITY.md": "c5a98ca789027e1bf051ec56bf1b7e76b98a0891",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-09-CROP-CONTEXT-SEASON-ARCHITECTURE-ADJUDICATION-AUTHORITY.md": "422f60257039e0f674171c218a7ff0a2fd7dc1b2",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-10-P0306-BOUNDED-THERMAL-PROXY-AUTHORITY.md": "964efa8acc95bf1aeed692c7662754afd3ac6db5"
};
for (const [filePath, expectedSha] of Object.entries(predecessorPins)) {
  eq(blob(base, filePath), expectedSha, `AMENDMENT11_BASE_PIN:${filePath}`);
  eq(blob("HEAD", filePath), expectedSha, `AMENDMENT11_PREDECESSOR_MUTATED:${filePath}`);
}

const amendment = read(amendmentPath);
for (const marker of [
  "Status: **CANDIDATE — NOT EFFECTIVE UNTIL EXACT-HEAD PROOF AND PROTECTED-MAIN MERGE**",
  "hourly-resolution observation product delivered by a daily-batch provider",
  "scheduler_eligibility_lag_hours = 7",
  "late collector = T+06:30",
  "exact evidence cutoff = T+07:12",
  "runtime observer = T+07:17",
  "fixed-lag shadow-online qualification",
  "interval_start/end must remain exact T semantics",
  "event_time must not be rewritten",
  "available_to_runtime_at must be actual chronology",
  "ingested_at must be actual chronology",
  "no future leakage",
  "no interpolation",
  "no persistence fill",
  "no source substitution",
  "raw retention before canonicalization",
  "provider_publication_cadence = daily_batch",
  "kbs_raw_hourly_age <= 6h",
  "historical / online-freshness diagnostic",
  "!= late authoritative evidence eligibility",
  "PROVIDER_AVAILABILITY_WATERMARK_V1",
  "evidence_snapshot_time",
  "rainfall                cutoff = evidence_snapshot_time",
  "historical ET0          cutoff = evidence_snapshot_time",
  "rolling candidate packages for approximately 36h",
  "Batch arrival MUST NOT authorize retroactive post-T acquisition",
  "24 actual UTC hourly scheduler boundaries",
  "KBS Raw Hourly = AUTHORITATIVE_LATE / nearline observation source",
  "crop_authority_effect = NONE",
  "CURRENT_CROP_AUTHORITY_HAS_NO_FUTURE_LEGAL_TARGET",
  "CAP-02 water-balance math",
  "CAP-03 exact event-time / interval semantics",
  "CAP-04 candidate math and forcing semantics",
  "fixed_lag_7h_normative_authority = false",
  "kbs_raw_hourly_le_6h_delayed_admission_authority = false",
  "formal_execution_count = 0/24",
  "EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false"
]) has(amendment, marker, "AMENDMENT11_REQUIRED_RULING_MISSING");

for (const forbidden of [
  "fixed_lag_7h_normative_authority = true",
  "kbs_raw_hourly_le_6h_delayed_admission_authority = true",
  "crop_authority_effect = ESTABLISHED",
  "source_substitution_authorized = true",
  "future_forcing_post_T_availability_authorized = true",
  "time_relabeling_authorized = true",
  "formal_window_started = true",
  "formal_execution_count = 1/24",
  "EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = true",
  "MCFT-CAP-09 completed = true"
]) lacks(amendment, forbidden, "AMENDMENT11_FORBIDDEN_CLAIM");

const workflow = read(workflowPath);
for (const marker of [
  "Resolve exact Amendment-11 base",
  "ACCEPTANCE_MCFT_CAP_09_AMENDMENT_11_PROVIDER_AVAILABILITY_WATERMARK_AUTHORITY.cjs",
  "Upload immutable Amendment-11 proof artifact"
]) has(workflow, marker, "AMENDMENT11_WORKFLOW_PROOF_STEP_MISSING");
for (const forbidden of [
  "pull_request_target",
  "workflow_dispatch:",
  "schedule:",
  "FORMAL_DATABASE_URL",
  "GEOX_MCFT_CAP09_S6_DATABASE_URL",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY"
]) lacks(workflow, forbidden, "AMENDMENT11_WORKFLOW_SIDE_EFFECT_CAPABILITY_FORBIDDEN");

fs.mkdirSync("acceptance-output", { recursive: true });
const result = {
  schema_version: "geox_mcft_cap09_amendment_11_provider_availability_watermark_governance_result_v1",
  status: "PASS",
  base_main_sha: base,
  subject_head_sha: git("rev-parse", "HEAD"),
  exact_changed_file_count: changed.length,
  amendment07_preserved_as_historical_predecessor: true,
  fixed_lag_7h_normative_authority: false,
  t_plus_0630_collector_normative_authority: false,
  t_plus_0712_cutoff_normative_authority: false,
  t_plus_0717_observer_normative_authority: false,
  kbs_observation_resolution: "hourly",
  kbs_provider_publication_cadence: "daily_batch",
  kbs_le_6h_delayed_admission_authority: false,
  kbs_le_6h_freshness_diagnostic_retained: true,
  provider_availability_watermark_v1_authorized_if_merged: true,
  evidence_snapshot_time_external_adapter_authorized_if_merged: true,
  rolling_preboundary_qualification_capture_authorized_if_merged: true,
  batch_triggered_candidate_intersection_authorized_if_merged: true,
  formal_actual_hour_scheduler_required: true,
  formal_oldest_eligible_watermark_required: true,
  crop_authority_effect: "NONE",
  cap02_math_changed: false,
  cap03_interval_semantics_changed: false,
  cap04_math_changed: false,
  source_substitution_authorized: false,
  formal_window_started: false,
  formal_execution_count: "0/24",
  ea5e2_operational_activation_qualified: false,
  ea5e3_effective: false,
  mcft_cap09_completed: false,
  next_implementation_frontier: "S6-EA5E2-PROVIDER-WATERMARK-EXTERNAL-ADAPTER-AND-ROLLING-QUALIFICATION"
};
fs.writeFileSync("acceptance-output/MCFT_CAP_09_AMENDMENT_11_PROVIDER_AVAILABILITY_WATERMARK_GOVERNANCE_RESULT.json", `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
