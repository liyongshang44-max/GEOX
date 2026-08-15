#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const A11 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md";
const SELECTOR = "scripts/runtime_acceptance/SELECT_MCFT_CAP_09_ROLLING_KBS_INTERSECTION_V1.py";
const CROP_BUILDER = "scripts/runtime_acceptance/BUILD_MCFT_CAP_09_ROLLING_CROP_LEGALITY_V1.cjs";
const CROP_PREFLIGHT = "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_TARGET_CROP_CONSENSUS.cjs";
const DECODER = "scripts/runtime_acceptance/MCFT_CAP_09_KBS_AUTHORITATIVE_LATE_DECODER_V1.py";
const WORKFLOW = ".github/workflows/mcft-cap-09-rolling-kbs-intersection.yml";

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`MCFT_CAP09_ROLLING_INTERSECTION_FILE_REQUIRED:${file}`);
  return fs.readFileSync(file, "utf8");
}
function has(text, marker, code) { if (!text.includes(marker)) throw new Error(`${code}:${marker}`); }
function lacks(text, marker, code) { if (text.includes(marker)) throw new Error(`${code}:${marker}`); }

const a11 = read(A11);
const selector = read(SELECTOR);
const cropBuilder = read(CROP_BUILDER);
const cropPreflight = read(CROP_PREFLIGHT);
const decoder = read(DECODER);
const workflow = read(WORKFLOW);

for (const marker of [
  "provider_publication_cadence = daily_batch",
  "PROVIDER_AVAILABILITY_WATERMARK_V1",
  "retain rolling candidate packages for approximately 36h",
  "intersect crop-legal T values",
  "oldest(\n  T where",
  "oldest-first backfill",
  "crop_authority_effect = NONE",
]) has(a11, marker, "MCFT_CAP09_ROLLING_INTERSECTION_AMENDMENT11_MARKER_REQUIRED");

for (const marker of [
  "evaluateTargetCropConsensus",
  "future_observations_used: false",
  "crop_authority_effect: \"NONE\"",
]) has(cropPreflight, marker, "MCFT_CAP09_ROLLING_INTERSECTION_CROP_PREFLIGHT_REQUIRED");

for (const marker of [
  "PRE_KBS_CROP_AUTHORITY_INTERSECTION",
  "evaluateTargetCropConsensus",
  "legal_targets",
  "crop_authority_effect: \"NONE\"",
  "provider_request_count: 0",
  "database_write_count: 0",
]) has(cropBuilder, marker, "MCFT_CAP09_ROLLING_INTERSECTION_CROP_BUILDER_REQUIRED");

for (const marker of [
  "OLDEST_CROP_LEGAL_EXACT_TARGET_FIRST",
  "ARTIFACT_METADATA.json",
  "run_conclusion",
  "head_branch",
  "head_sha",
  "artifact_digest",
  "historical_online_freshness_diagnostic_le_6h",
  "freshness_is_late_authoritative_admission_gate\": False",
  "crop_authority_intersection_applied\": True",
  "future_crop_observations_used\": False",
  "row_is_complete",
  "exact_kbs_intersection_count",
  "raw_values_emitted\": False",
  "crop_authority_effect\": \"NONE\"",
  "oldest_crop_legal_exact_target_first",
  "stale_daily_batch_can_intersect",
]) has(selector, marker, "MCFT_CAP09_ROLLING_INTERSECTION_SELECTOR_MARKER_REQUIRED");

for (const marker of [
  "--target-t",
  "EXACT_REQUESTED_TARGET",
  "MCFT_CAP09_KBS_LATE_REQUESTED_TARGET_MISSING",
  "MCFT_CAP09_KBS_LATE_REQUESTED_TARGET_DUPLICATE",
  "MCFT_CAP09_KBS_LATE_REQUESTED_TARGET_INCOMPLETE",
]) has(decoder, marker, "MCFT_CAP09_ROLLING_INTERSECTION_EXACT_TARGET_SEAM_REQUIRED");

for (const marker of [
  "cron: '20 * * * *'",
  "actions: read",
  "mcft-cap-09-rolling-preboundary-capture.yml/runs",
  "status=success",
  "ARTIFACT_METADATA.json",
  "BUILD_MCFT_CAP_09_ROLLING_CROP_LEGALITY_V1.cjs",
  "lter.kbs.msu.edu/datatables/13.csv",
  "--crop-legality acceptance-output/MCFT_CAP_09_ROLLING_CROP_LEGALITY.json",
  "OLDEST_CROP_LEGAL_EXACT_TARGET_FIRST",
  "EXACT_CROP_LEGAL_INTERSECTION_READY",
  "WAITING_FOR_DAILY_BATCH_INTERSECTION",
  "raw_values_emitted",
  "formal_effect",
]) has(workflow, marker, "MCFT_CAP09_ROLLING_INTERSECTION_WORKFLOW_MARKER_REQUIRED");

for (const forbidden of [
  "configured_max_age_hours",
  "T+432",
  "T+07:12",
  "T+07:17",
  "CURRENT_CROP_AUTHORITY_HAS_NO_FUTURE_LEGAL_TARGET",
  "GEOX_MCFT_CAP09_S6_DATABASE_URL",
]) lacks(workflow, forbidden, "MCFT_CAP09_ROLLING_INTERSECTION_FORBIDDEN_GATE");

console.log(JSON.stringify({
  schema_version: "geox_mcft_cap09_rolling_kbs_intersection_acceptance_v2",
  status: "PASS",
  temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
  provider_publication_cadence: "DAILY_BATCH",
  selection_policy: "OLDEST_CROP_LEGAL_EXACT_TARGET_FIRST",
  producer_run_provenance_required: true,
  exact_target_required: true,
  crop_authority_intersection_applied: true,
  crop_authority_effect: "NONE",
  future_crop_observations_used: false,
  freshness_is_late_authoritative_admission_gate: false,
  database_write_count: 0,
  formal_effect: false,
}));
