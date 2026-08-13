#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");

const PROOF = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-KBS-AUTHORITATIVE-LATE-LIVE-PROOF-V1.json";
const AMENDMENT = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md";
const EXPECTED = Object.freeze({
  subject_sha: "4b391476b2f3a4cf77ddbd8756253ef19bc99813",
  workflow_run_id: 31695778044,
  workflow_job_id: 94433110135,
  artifact_id: 9179259809,
  artifact_digest: "sha256:7168040e3757e6b945cbb2732f8c317ecc5bdcc5a77563aa03f46f2cc2e9d39d",
  provider_latest_timestamp: "2026-08-13T04:00:00.000Z",
  provider_latest_age_hours: 7.368161,
  event_time: "2026-08-13T04:00:00.000Z",
});

function fail(code) { throw new Error(code); }
function requireTrue(value, code) { if (!value) fail(code); }

requireTrue(fs.existsSync(PROOF), "MCFT_CAP09_KBS_LATE_LIVE_PROOF_REQUIRED");
requireTrue(fs.existsSync(AMENDMENT), "MCFT_CAP09_AMENDMENT11_REQUIRED");
const proofBytes = fs.readFileSync(PROOF);
const proof = JSON.parse(proofBytes.toString("utf8"));
const amendment = fs.readFileSync(AMENDMENT, "utf8");

requireTrue(proof.schema_version === "geox_mcft_cap09_kbs_authoritative_late_live_proof_v1", "MCFT_CAP09_KBS_LATE_LIVE_PROOF_SCHEMA");
requireTrue(proof.status === "PASS", "MCFT_CAP09_KBS_LATE_LIVE_PROOF_STATUS");
requireTrue(proof.proof_class === "EXACT_PROTECTED_MAIN_REAL_PROVIDER_QUALIFICATION", "MCFT_CAP09_KBS_LATE_LIVE_PROOF_CLASS");
requireTrue(proof.temporal_authority === "PROVIDER_AVAILABILITY_WATERMARK_V1", "MCFT_CAP09_KBS_LATE_LIVE_PROOF_AUTHORITY");
requireTrue(proof.subject_sha === EXPECTED.subject_sha, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_SUBJECT");
requireTrue(proof.workflow_run_id === EXPECTED.workflow_run_id, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_RUN");
requireTrue(proof.workflow_job_id === EXPECTED.workflow_job_id, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_JOB");
requireTrue(proof.artifact_id === EXPECTED.artifact_id, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_ARTIFACT");
requireTrue(proof.artifact_digest === EXPECTED.artifact_digest, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_ARTIFACT_DIGEST");

requireTrue(proof.provider.publication_cadence === "DAILY_BATCH", "MCFT_CAP09_KBS_LATE_LIVE_PROOF_DAILY_BATCH");
requireTrue(proof.provider.observation_resolution === "HOURLY", "MCFT_CAP09_KBS_LATE_LIVE_PROOF_HOURLY_RESOLUTION");
requireTrue(proof.provider.provider_request_count === 1, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_PROVIDER_REQUEST_COUNT");
requireTrue(proof.provider.provider_latest_timestamp === EXPECTED.provider_latest_timestamp, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_LATEST_TIMESTAMP");
requireTrue(proof.provider.provider_latest_age_hours === EXPECTED.provider_latest_age_hours, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_LATEST_AGE");
requireTrue(proof.provider.provider_latest_age_hours > 6, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_MUST_BE_OVER_6H");
requireTrue(proof.provider.historical_online_freshness_diagnostic_le_6h === false, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_DIAGNOSTIC_FALSE_REQUIRED");
requireTrue(proof.provider.freshness_is_late_authoritative_admission_gate === false, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_6H_ADMISSION_FORBIDDEN");

requireTrue(proof.selected_exact_interval.event_time === EXPECTED.event_time, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_EVENT_TIME");
requireTrue(proof.selected_exact_interval.interval_end === EXPECTED.event_time, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_INTERVAL_END");
requireTrue(proof.selected_exact_interval.interval_start === "2026-08-13T03:00:00.000Z", "MCFT_CAP09_KBS_LATE_LIVE_PROOF_INTERVAL_START");
requireTrue(proof.selected_exact_interval.delayed_authoritative_evidence_eligible === true, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_DELAYED_ELIGIBLE");

for (const item of proof.chronology) {
  const eventMs = Date.parse(item.event_time);
  const availableMs = Date.parse(item.available_to_runtime_at);
  const retainedMs = Date.parse(item.retained_at);
  const ingestedMs = Date.parse(item.ingested_at);
  requireTrue(Number.isFinite(eventMs) && Number.isFinite(availableMs) && Number.isFinite(retainedMs) && Number.isFinite(ingestedMs), "MCFT_CAP09_KBS_LATE_LIVE_PROOF_CHRONOLOGY_PARSE");
  requireTrue(eventMs <= availableMs, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_EVENT_AVAILABLE_ORDER");
  requireTrue(availableMs <= retainedMs, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_AVAILABLE_RETAINED_ORDER");
  requireTrue(retainedMs <= ingestedMs, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_RETAINED_INGESTED_ORDER");
}
requireTrue(proof.chronology.map((x) => x.record_type).sort().join(",") === "historical_et0_estimate_v1,observed_rainfall_v1", "MCFT_CAP09_KBS_LATE_LIVE_PROOF_RECORD_PAIR");

requireTrue(proof.evidence_contract.exact_source_identity === true, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_SOURCE_IDENTITY");
requireTrue(proof.evidence_contract.exact_interval_identity === true, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_INTERVAL_IDENTITY");
requireTrue(proof.evidence_contract.raw_retained_before_decode === true, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_RAW_FIRST");
requireTrue(proof.evidence_contract.real_chronology_retained === true, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_REAL_CHRONOLOGY");
requireTrue(proof.evidence_contract.identity_conflict_allowed === false, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_IDENTITY_CONFLICT_FORBIDDEN");
requireTrue(proof.evidence_contract.interpolation_allowed === false, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_INTERPOLATION_FORBIDDEN");
requireTrue(proof.evidence_contract.persistence_fill_allowed === false, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_FILL_FORBIDDEN");
requireTrue(proof.evidence_contract.source_substitution_allowed === false, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_SUBSTITUTION_FORBIDDEN");

requireTrue(proof.qualification_side_effects.isolated_database_fact_count === 2, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_ISOLATED_FACT_COUNT");
requireTrue(proof.qualification_side_effects.isolated_database_write_count === 2, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_ISOLATED_WRITE_COUNT");
requireTrue(proof.qualification_side_effects.private_transient_r2_put_count === 1, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_R2_PUT_COUNT");
requireTrue(proof.qualification_side_effects.private_transient_cleanup_confirmed === true, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_R2_CLEANUP");
requireTrue(proof.qualification_side_effects.formal_database_write_count === 0, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_FORMAL_DB_ZERO");
requireTrue(proof.qualification_side_effects.formal_r2_prefix_write_count === 0, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_FORMAL_R2_ZERO");
requireTrue(proof.qualification_side_effects.scheduler_write_count === 0, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_SCHEDULER_ZERO");
requireTrue(proof.nonclaims.crop_authority_effect === "NONE", "MCFT_CAP09_KBS_LATE_LIVE_PROOF_CROP_NONE");
requireTrue(proof.nonclaims.authority_effect === false && proof.nonclaims.formal_effect === false && proof.nonclaims.live_dispatch_authorized === false && proof.nonclaims.formal_window_started === false, "MCFT_CAP09_KBS_LATE_LIVE_PROOF_NONCLAIMS");

requireTrue(amendment.includes("Age alone MUST NOT invalidate an otherwise exact authoritative-late observation."), "MCFT_CAP09_KBS_LATE_LIVE_PROOF_AMENDMENT11_AGE_BOUNDARY");
requireTrue(amendment.includes("provider_publication_cadence = daily_batch"), "MCFT_CAP09_KBS_LATE_LIVE_PROOF_AMENDMENT11_DAILY_BATCH");
requireTrue(amendment.includes("PROVIDER_AVAILABILITY_WATERMARK_V1"), "MCFT_CAP09_KBS_LATE_LIVE_PROOF_AMENDMENT11_WATERMARK");

console.log(JSON.stringify({
  schema_version: "geox_mcft_cap09_kbs_authoritative_late_live_proof_acceptance_v1",
  status: "PASS",
  subject_sha: proof.subject_sha,
  run_id: proof.workflow_run_id,
  artifact_id: proof.artifact_id,
  artifact_digest: proof.artifact_digest,
  proof_file_sha256: `sha256:${crypto.createHash("sha256").update(proofBytes).digest("hex")}`,
  provider_latest_age_hours: proof.provider.provider_latest_age_hours,
  freshness_diagnostic_le_6h: proof.provider.historical_online_freshness_diagnostic_le_6h,
  delayed_authoritative_evidence_eligible: proof.selected_exact_interval.delayed_authoritative_evidence_eligible,
  formal_effect: false,
  crop_authority_effect: "NONE"
}));
