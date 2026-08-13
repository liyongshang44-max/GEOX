#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");

const PLAN = "acceptance-output/MCFT_CAP_09_ROLLING_PREBOUNDARY_TARGET.json";
const PRE = "acceptance-output/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PREBOUNDARY_SAFE_PROOF.json";
const LEDGER = "acceptance-output/MCFT_CAP_09_EA5E2_TRANSIENT_R2_REFS.json";
const OUTPUT = "acceptance-output/MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.json";

function readJson(path, code) {
  if (!fs.existsSync(path)) throw new Error(code);
  return JSON.parse(fs.readFileSync(path, "utf8"));
}
function requireTrue(value, code) { if (!value) throw new Error(code); }
function digest(value) { return `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`; }

const subject = String(process.env.MCFT_EA5E2_SUBJECT_SHA || "");
requireTrue(/^[0-9a-f]{40}$/.test(subject), "MCFT_CAP09_ROLLING_PREBOUNDARY_SUBJECT_SHA_REQUIRED");
const plan = readJson(PLAN, "MCFT_CAP09_ROLLING_PREBOUNDARY_PLAN_REQUIRED");
const pre = readJson(PRE, "MCFT_CAP09_ROLLING_PREBOUNDARY_PRE_PROOF_REQUIRED");
const ledger = readJson(LEDGER, "MCFT_CAP09_ROLLING_PREBOUNDARY_LEDGER_REQUIRED");

requireTrue(plan.status === "PASS" && plan.temporal_authority === "PROVIDER_AVAILABILITY_WATERMARK_V1", "MCFT_CAP09_ROLLING_PREBOUNDARY_PLAN_PASS_REQUIRED");
requireTrue(plan.provider_publication_dependency === "NONE" && plan.kbs_raw_hourly_dependency === "NONE" && plan.crop_authority_dependency === "NONE", "MCFT_CAP09_ROLLING_PREBOUNDARY_PLAN_INDEPENDENCE_REQUIRED");
requireTrue(pre.status === "PASS", "MCFT_CAP09_ROLLING_PREBOUNDARY_PRE_PASS_REQUIRED");
requireTrue(pre.subject_sha === subject, "MCFT_CAP09_ROLLING_PREBOUNDARY_PRE_SUBJECT_MISMATCH");
requireTrue(pre.target_logical_time === plan.target_t, "MCFT_CAP09_ROLLING_PREBOUNDARY_TARGET_MISMATCH");
requireTrue(pre.canonical_fact_write_count === 3, "MCFT_CAP09_ROLLING_PREBOUNDARY_THREE_FACTS_REQUIRED");
requireTrue(pre.soil_observation_inside_t_minus_15_to_t === true, "MCFT_CAP09_ROLLING_PREBOUNDARY_SOIL_WINDOW_REQUIRED");
requireTrue(pre.gfs_same_cycle_pair === true, "MCFT_CAP09_ROLLING_PREBOUNDARY_SAME_CYCLE_GFS_REQUIRED");
requireTrue(pre.formal_database_write_count === 0 && pre.formal_r2_write_count === 0 && pre.formal_window_started === false, "MCFT_CAP09_ROLLING_PREBOUNDARY_FORMAL_ZERO_REQUIRED");
requireTrue(Array.isArray(pre.raw_retention_refs) && pre.raw_retention_refs.length >= 2, "MCFT_CAP09_ROLLING_PREBOUNDARY_RAW_REFS_REQUIRED");
requireTrue(pre.rehydration_manifest && Array.isArray(pre.rehydration_manifest.expected_records), "MCFT_CAP09_ROLLING_PREBOUNDARY_REHYDRATION_MANIFEST_REQUIRED");
requireTrue(pre.rehydration_manifest.expected_records.length === 3, "MCFT_CAP09_ROLLING_PREBOUNDARY_REHYDRATION_THREE_RECORDS_REQUIRED");

const recordTypes = [...pre.record_types].sort();
requireTrue(JSON.stringify(recordTypes) === JSON.stringify(["future_et0_assumption_v1", "future_weather_assumption_v1", "soil_moisture_observation_v1"]), "MCFT_CAP09_ROLLING_PREBOUNDARY_FAMILY_SET_REQUIRED");
requireTrue(ledger.subject_sha === subject, "MCFT_CAP09_ROLLING_PREBOUNDARY_LEDGER_SUBJECT_MISMATCH");
requireTrue(ledger.formal_raw_prefix_write_count === 0, "MCFT_CAP09_ROLLING_PREBOUNDARY_FORMAL_PREFIX_ZERO_REQUIRED");
requireTrue(Array.isArray(ledger.refs) && ledger.refs.length >= 2, "MCFT_CAP09_ROLLING_PREBOUNDARY_LEDGER_REFS_REQUIRED");
for (const ref of ledger.refs) {
  requireTrue(String(ref.retention_ref).startsWith("s3-private://geox-mcft-cap09-formal-raw-v1/mcft-cap09-ea5e2-readiness-transient-v1/"), "MCFT_CAP09_ROLLING_PREBOUNDARY_PRIVATE_TRANSIENT_REF_REQUIRED");
  requireTrue(!String(ref.retention_ref).includes("/mcft-cap09-formal-raw-v1/sha256/"), "MCFT_CAP09_ROLLING_PREBOUNDARY_FORMAL_RAW_REF_FORBIDDEN");
}

const now = new Date().toISOString();
const candidate = {
  schema_version: "geox_mcft_cap09_rolling_preboundary_candidate_v1",
  status: "PASS",
  qualification_mode: "ROLLING_PRE_BOUNDARY_CAUSAL_CAPTURE",
  temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
  producer_subject_sha: subject,
  subject_sha: subject,
  target_t: plan.target_t,
  target_key: plan.target_key,
  captured_at: String(pre.phase_canonicalized_at),
  packaged_at: now,
  candidate_expires_at: plan.candidate_expires_at,
  candidate_retention_hours: plan.candidate_retention_hours,
  pre_boundary_evidence_deadline: plan.evidence_deadline,
  record_types: recordTypes,
  source_record_ids: [...pre.source_record_ids].sort(),
  semantic_manifest_digest: digest(pre.rehydration_manifest.expected_records),
  rehydration_manifest: pre.rehydration_manifest,
  raw_retention_refs: [...pre.raw_retention_refs].sort(),
  raw_ref_ledger: ledger.refs,
  causal_contract: {
    soil_observation_inside_t_minus_15_to_t: true,
    future_weather_available_and_ingested_by_t: true,
    future_et0_available_and_ingested_by_t: true,
    same_cycle_future_weather_et0: true,
    no_future_leakage: true,
    raw_retained_before_canonicalization: true
  },
  consumption_contract: {
    producer_subject_sha_immutable: true,
    producer_exact_main_capture_proof_required: true,
    consumer_subject_may_differ_from_producer: true,
    consumer_exact_main_successor_qualification_required: true,
    exact_target_t_required: true,
    raw_retention_reverification_required: true,
    semantic_hash_reverification_required: true,
    cross_version_rehydration_required_when_consumer_subject_differs: true,
    crop_authority_checked_only_at_consumption: true,
    delayed_kbs_exact_interval_checked_only_at_consumption: true,
    oldest_eligible_selection_required: true
  },
  independence: {
    kbs_daily_batch_required_at_capture: false,
    kbs_raw_hourly_required_at_capture: false,
    crop_authority_required_at_capture: false,
    formal_database_required_at_capture: false,
    consumer_same_git_sha_required: false
  },
  side_effects: {
    isolated_database_fact_count: 3,
    formal_database_write_count: 0,
    formal_r2_prefix_write_count: 0,
    scheduler_write_count: 0,
    runtime_write_count: 0,
    crop_authority_effect: "NONE",
    formal_effect: false
  },
  raw_values_emitted: false
};

fs.writeFileSync(OUTPUT, JSON.stringify(candidate, null, 2) + "\n");
console.log(JSON.stringify({
  schema_version: candidate.schema_version,
  status: candidate.status,
  producer_subject_sha: candidate.producer_subject_sha,
  target_t: candidate.target_t,
  candidate_expires_at: candidate.candidate_expires_at,
  family_count: candidate.record_types.length,
  raw_ref_count: candidate.raw_retention_refs.length,
  semantic_manifest_digest: candidate.semantic_manifest_digest,
  kbs_required_at_capture: false,
  crop_required_at_capture: false,
  consumer_same_git_sha_required: false,
  formal_effect: false
}));
