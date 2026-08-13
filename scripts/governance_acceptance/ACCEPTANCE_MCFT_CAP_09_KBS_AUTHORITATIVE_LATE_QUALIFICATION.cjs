#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const AMENDMENT = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md";
const DECODER = "scripts/runtime_acceptance/MCFT_CAP_09_KBS_AUTHORITATIVE_LATE_DECODER_V1.py";
const RUNNER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_KBS_AUTHORITATIVE_LATE_QUALIFICATION.ts";
const WORKFLOW = ".github/workflows/mcft-cap-09-kbs-authoritative-late-qualification.yml";

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`MCFT_CAP09_KBS_LATE_FILE_REQUIRED:${path}`);
  return fs.readFileSync(path, "utf8");
}

function requireAll(text, values, code) {
  for (const value of values) if (!text.includes(value)) throw new Error(`${code}:${value}`);
}

const amendment = read(AMENDMENT);
const decoder = read(DECODER);
const runner = read(RUNNER);
const workflow = read(WORKFLOW);

requireAll(amendment, [
  "PROVIDER_AVAILABILITY_WATERMARK_V1",
  "historical / online-freshness diagnostic",
  "It is **not** authoritative delayed-evidence eligibility.",
  "provider_publication_cadence = daily_batch",
  "Age alone MUST NOT invalidate an otherwise exact authoritative-late observation.",
  "Amendment-11 creates no crop authority and modifies no crop authority.",
], "MCFT_CAP09_KBS_LATE_AMENDMENT11_AUTHORITY_MISSING");

requireAll(decoder, [
  "HISTORICAL_FRESHNESS_HOURS = 6.0",
  "historical_online_freshness_diagnostic_le_6h",
  "freshness_is_late_authoritative_admission_gate\": False",
  "provider_publication_cadence\": \"DAILY_BATCH\"",
  "AUTHORITATIVE_LATE_NOT_ONLINE_AVAILABILITY_CLAIM",
  "select_complete_exact_row",
  "len(candidates) != 1",
  "NO_SILENT_IMPUTATION",
  "NO_NEGATIVE_CLIPPING",
  "stale_daily_batch_remains_selectable",
], "MCFT_CAP09_KBS_LATE_DECODER_CONTRACT_MISSING");

for (const forbidden of [
  "require(latest_age_hours <= HISTORICAL_FRESHNESS_HOURS",
  "require(age_hours <= HISTORICAL_FRESHNESS_HOURS",
  "EA5E2_LIVE_KBS_SOURCE_STALE",
  "EA5E2_TIMING_TARGET_KBS_STALE",
]) {
  if (decoder.includes(forbidden)) throw new Error(`MCFT_CAP09_KBS_LATE_STALE_ADMISSION_FORBIDDEN:${forbidden}`);
}

requireAll(runner, [
  "MCFT_CAP09_KBS_LATE_EXACT_MAIN_ACTION_RUN_REQUIRED",
  "MCFT_CAP09_KBS_LATE_DATABASE_MUST_BE_LOCALHOST",
  "mcft-cap09-amendment11-kbs-late-transient-v1",
  "MCFT_CAP09_KBS_LATE_FORMAL_PREFIX_FORBIDDEN",
  "collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1",
  "PostgresExternalFormalEvidenceIngressV1",
  "raw_retained_before_decode: true",
  "freshness_is_late_authoritative_admission_gate: false",
  "delayed_authoritative_evidence_eligible: true",
  "provider_publication_cadence: \"DAILY_BATCH\"",
  "temporal_authority: \"PROVIDER_AVAILABILITY_WATERMARK_V1\"",
  "formal_database_write_count: 0",
  "formal_r2_prefix_write_count: 0",
  "scheduler_write_count: 0",
  "crop_authority_effect: \"NONE\"",
  "live_dispatch_authorized: false",
], "MCFT_CAP09_KBS_LATE_RUNNER_CONTRACT_MISSING");

requireAll(workflow, [
  "workflow_dispatch:",
  "QUALIFY_AMENDMENT11_KBS_LATE_NO_FORMAL_WRITE",
  "github.event_name == 'push' || github.event_name == 'workflow_dispatch'",
  "git rev-parse origin/main",
  "MCFT_CAP09_KBS_LATE_PROTECTED_MAIN_REQUIRED",
  "MCFT_CAP_09_KBS_AUTHORITATIVE_LATE_DECODER_V1.py selftest",
  "RUN_MCFT_CAP_09_KBS_AUTHORITATIVE_LATE_QUALIFICATION.ts",
  "provider_publication_cadence!=='DAILY_BATCH'",
  "freshness_is_late_authoritative_admission_gate!==false",
  "private_transient_cleanup_confirmed!==true",
  "formal_database_write_count!==0",
  "actions/upload-artifact@v4",
], "MCFT_CAP09_KBS_LATE_WORKFLOW_CONTRACT_MISSING");

console.log(JSON.stringify({
  schema_version: "geox_mcft_cap09_kbs_authoritative_late_static_acceptance_v1",
  status: "PASS",
  authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
  provider_publication_cadence: "DAILY_BATCH",
  historical_freshness_diagnostic_retained: true,
  freshness_is_late_authoritative_admission_gate: false,
  exact_source_identity_required: true,
  exact_interval_identity_required: true,
  private_raw_retention_before_decode_required: true,
  isolated_database_only: true,
  formal_effect: false,
  crop_authority_effect: "NONE",
  live_dispatch_authorized: false,
}));
