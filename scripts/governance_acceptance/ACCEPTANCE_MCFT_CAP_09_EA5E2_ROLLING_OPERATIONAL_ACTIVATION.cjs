#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const A11 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md";
const WORKFLOW = ".github/workflows/mcft-cap-09-ea5e2-rolling-operational-activation-live.yml";
const CAPTURE = ".github/workflows/mcft-cap-09-rolling-preboundary-capture.yml";
const INTERSECTION = ".github/workflows/mcft-cap-09-rolling-kbs-intersection.yml";
const OBSERVER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_ROLLING_OPERATIONAL_ACTIVATION_OBSERVER_V1.ts";
const DRIFT = "scripts/runtime_acceptance/ASSERT_MCFT_CAP_09_EA5E2_ROLLING_ACTIVATION_BOUNDARY_CURRENT_MAIN.cjs";

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`EA5E2_ROLLING_ACTIVATION_FILE_REQUIRED:${file}`);
  return fs.readFileSync(file, "utf8");
}
function has(text, marker, code) { if (!text.includes(marker)) throw new Error(`${code}:${marker}`); }
function lacks(text, marker, code) { if (text.includes(marker)) throw new Error(`${code}:${marker}`); }

const a11 = read(A11);
const workflow = read(WORKFLOW);
const capture = read(CAPTURE);
const intersection = read(INTERSECTION);
const observer = read(OBSERVER);
const drift = read(DRIFT);

for (const marker of [
  "EA5E2 qualification SHALL stop using the following workflow shape",
  "choose future `T`",
  "retain rolling candidate packages for approximately 36h",
  "PROVIDER_AVAILABILITY_WATERMARK_V1",
  "intersect crop-legal T values",
  "oldest-first backfill",
  "there is no fixed `T+432` normative cutoff",
]) has(a11, marker, "EA5E2_ROLLING_ACTIVATION_AMENDMENT11_MARKER_REQUIRED");

for (const marker of [
  "cron: '5 * * * *'",
  "CANDIDATE_RETENTION_HOURS",
  "kbs_daily_batch_required_at_capture",
  "crop_authority_required_at_capture",
  "PROVIDER_AVAILABILITY_WATERMARK_V1",
]) has(capture, marker, "EA5E2_ROLLING_ACTIVATION_CAPTURE_BOUNDARY_REQUIRED");

for (const marker of [
  "OLDEST_CROP_LEGAL_EXACT_TARGET_FIRST",
  "crop_authority_intersection_applied",
  "freshness_is_late_authoritative_admission_gate",
  "WAITING_FOR_DAILY_BATCH_INTERSECTION",
]) has(intersection, marker, "EA5E2_ROLLING_ACTIVATION_INTERSECTION_BOUNDARY_REQUIRED");

for (const marker of [
  "workflow_dispatch:",
  "EA5E2_ROLLING_SUCCESSOR_V3_EXACT_HEAD_QUALIFICATION_REQUIRED",
  "mcft-cap-09-rolling-kbs-intersection.yml/runs",
  "geox_mcft_cap09_rolling_kbs_intersection_v2",
  "OLDEST_CROP_LEGAL_EXACT_TARGET_FIRST",
  "RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION_V1.ts",
  "RUN_MCFT_CAP_09_KBS_EXTERNAL_FIVE_FAMILY_DATA_PATH_V1.ts",
  "RUN_MCFT_CAP_09_EA5E2_ROLLING_OPERATIONAL_ACTIVATION_OBSERVER_V1.ts",
  "GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL",
  "future_t_preselection_used:false",
  "long_horizon_wait_used:false",
  "fixed_t_plus_432_normative_authority:false",
  "fixed_t_plus_437_observer_normative_authority:false",
]) has(workflow, marker, "EA5E2_ROLLING_ACTIVATION_WORKFLOW_BOUNDARY_REQUIRED");

for (const forbidden of [
  "PLAN_MCFT_CAP_09_EA5E2_LONG_HORIZON_WINDOW",
  "wait_pre_t20",
  "wait_pre_t15",
  "wait_pre_t10",
  "wait_pre_t5",
  "wait_pre_viability",
  "Number(availability.latest_age_hours)>6",
  "frozen evidence cutoff",
]) lacks(workflow, forbidden, "EA5E2_ROLLING_ACTIVATION_FORBIDDEN_ORCHESTRATION");

for (const marker of [
  "evidence_snapshot_time: evidenceSnapshotTime",
  "evidence_snapshot_time_is_actual_execution_snapshot: true",
  "ROLLING_PREBOUNDARY_BATCH_INTERSECTION",
  "PROVIDER_AVAILABILITY_WATERMARK_V1",
  "fixed_t_plus_432_cutoff_normative_authority: false",
  "fixed_t_plus_437_observer_normative_authority: false",
  "future_t_preselection_used: false",
  "FORMAL_DATABASE_IDENTITY_MISMATCH",
]) has(observer, marker, "EA5E2_ROLLING_ACTIVATION_OBSERVER_BOUNDARY_REQUIRED");

for (const forbidden of [
  "OBSERVER_OFFSET_MINUTES",
  "MAX_OBSERVER_START_SKEW_MINUTES",
  "EXACT_INTERVAL_CUTOFF_OFFSET_MINUTES",
  "OBSERVER_EARLY_FORBIDDEN",
  "OBSERVER_START_TOO_LATE",
]) lacks(observer, forbidden, "EA5E2_ROLLING_ACTIVATION_OBSERVER_FIXED_LAG_FORBIDDEN");

for (const marker of [
  WORKFLOW,
  CAPTURE,
  INTERSECTION,
  OBSERVER,
  "future_t_long_wait_activation_authority: false",
  "fixed_t_plus_432_normative_authority: false",
  "six_hour_freshness_late_admission_authority: false",
]) has(drift, marker, "EA5E2_ROLLING_ACTIVATION_DRIFT_GUARD_REQUIRED");

console.log(JSON.stringify({
  schema_version: "geox_mcft_cap09_ea5e2_rolling_operational_activation_acceptance_v1",
  status: "PASS",
  final_activation_orchestration: "ROLLING_PREBOUNDARY_BATCH_INTERSECTION",
  provider_temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
  crop_legal_intersection_required: true,
  future_t_long_wait_activation_authority: false,
  fixed_t_plus_432_normative_authority: false,
  fixed_t_plus_437_observer_normative_authority: false,
  six_hour_freshness_late_admission_authority: false,
  formal_database_write_count: 0,
  scheduler_write_count: 0,
  authority_effect: false,
}));
