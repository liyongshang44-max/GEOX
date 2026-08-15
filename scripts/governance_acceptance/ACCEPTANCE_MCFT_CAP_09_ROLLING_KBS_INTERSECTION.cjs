#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const A11 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md";
const SELECTOR = "scripts/runtime_acceptance/SELECT_MCFT_CAP_09_ROLLING_KBS_INTERSECTION_V1.py";
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
const decoder = read(DECODER);
const workflow = read(WORKFLOW);

for (const marker of [
  "provider_publication_cadence = daily_batch",
  "PROVIDER_AVAILABILITY_WATERMARK_V1",
  "retain rolling candidate packages for approximately 36h",
  "oldest(\n  T where",
  "oldest-first backfill",
  "crop_authority_effect = NONE",
]) has(a11, marker, "MCFT_CAP09_ROLLING_INTERSECTION_AMENDMENT11_MARKER_REQUIRED");

for (const marker of [
  "OLDEST_EXACT_TARGET_FIRST_WITHIN_ACTIVE_SCOPE_LINEAGE",
  "ARTIFACT_METADATA.json",
  "run_conclusion",
  "head_branch",
  "head_sha",
  "artifact_digest",
  "T3R1_SCOPE_REBIND_ACTIVATION_SHA",
  "b6f2883789d48aeed717263f8fb43152fd34c57e",
  "git\", \"merge-base\", \"--is-ancestor",
  "T3R1_POST_REBIND_ONLY",
  "cross_scope_canonical_stitching_authorized\": False",
  "historical_online_freshness_diagnostic_le_6h",
  "freshness_is_late_authoritative_admission_gate\": False",
  "row_is_complete",
  "exact_kbs_intersection_count",
  "raw_values_emitted\": False",
  "crop_authority_effect\": \"NONE\"",
  "producer_run_provenance_required",
  "t3r1_scope_lineage_gate",
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
  "lter.kbs.msu.edu/datatables/13.csv",
  "SELECT_MCFT_CAP_09_ROLLING_KBS_INTERSECTION_V1.py select",
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
  schema_version: "geox_mcft_cap09_rolling_kbs_intersection_acceptance_v1",
  status: "PASS",
  temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
  provider_publication_cadence: "DAILY_BATCH",
  selection_policy: "OLDEST_EXACT_TARGET_FIRST_WITHIN_ACTIVE_SCOPE_LINEAGE",
  t3r1_scope_rebind_activation_sha: "b6f2883789d48aeed717263f8fb43152fd34c57e",
  producer_run_provenance_required: true,
  active_scope_lineage_required: true,
  cross_scope_canonical_stitching_authorized: false,
  exact_target_required: true,
  freshness_is_late_authoritative_admission_gate: false,
  database_write_count: 0,
  formal_effect: false,
  crop_authority_effect: "NONE",
}));
