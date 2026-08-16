#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const BASE = "5f7e534b2db41e1a6e8bc793d0fa5d87c1639289";
const AUTHORITY = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-OPERATIONAL-ACTIVATION-EVIDENCE-FREEZE-V1.json";
const GATE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_EVIDENCE_FREEZE_V1.cjs";
const WORKFLOW = ".github/workflows/mcft-cap-09-ea5e2-operational-activation-evidence-freeze.yml";
const OUT = "acceptance-output/MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_EVIDENCE_FREEZE_V1_RESULT.json";

function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function read(file) { return fs.readFileSync(file, "utf8"); }
function json(file) { return JSON.parse(read(file)); }
function blob(ref, file) { return git("rev-parse", `${ref}:${file}`); }
function eq(actual, expected, code) { if (actual !== expected) throw new Error(`${code}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`); }
function yes(value, code) { eq(value, true, code); }
function no(value, code) { eq(value, false, code); }
function present(value, code) { if (value === null || value === undefined || value === "") throw new Error(code); return value; }
function sha256(value) { return `sha256:${crypto.createHash("sha256").update(value, "utf8").digest("hex")}`; }
function canonicalIso(value, code) {
  present(value, code);
  const t = Date.parse(value);
  if (!Number.isFinite(t) || new Date(t).toISOString() !== value) throw new Error(code);
  return value;
}
function writeResult(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value));
}
function sortedEvidenceHashes(values) {
  return [...values].sort((a, b) => String(a.record_type).localeCompare(String(b.record_type)));
}
function sanitizeReceipt(raw) {
  return {
    retention_class: raw.retention_class ?? "PRIVATE_RESTRICTED_RAW_EVIDENCE",
    retained_sha256: raw.retained_sha256 ?? raw.raw_sha256,
    retained_bytes: raw.retained_bytes ?? raw.raw_bytes,
    retention_ref_sha256: sha256(present(raw.retention_ref, "EA5E2_FREEZE_RETENTION_REF_REQUIRED")),
    retained_at: raw.retained_at,
    externally_publishable: false,
  };
}

function main() {
  const a = json(AUTHORITY);
  eq(a.schema_version, "geox_mcft_cap09_ea5e2_operational_activation_evidence_freeze_v1", "EA5E2_FREEZE_SCHEMA_REQUIRED");
  eq(a.record_status, "CANDIDATE_EFFECTIVE_ONLY_AFTER_EXACT_HEAD_PROOF_AND_MERGE", "EA5E2_FREEZE_FINAL_CANDIDATE_STATUS_REQUIRED");
  eq(a.base_protected_main_sha, BASE, "EA5E2_FREEZE_BASE_REQUIRED");
  eq(a.protected_main_subject_sha, BASE, "EA5E2_FREEZE_LIVE_SUBJECT_REQUIRED");
  eq(process.env.MCFT_BASE_SHA, BASE, "EA5E2_FREEZE_WORKFLOW_BASE_REQUIRED");
  eq(process.env.MCFT_PR_BASE_SHA, BASE, "EA5E2_FREEZE_PR_BASE_REQUIRED");
  git("fetch", "--no-tags", "origin", "main");
  eq(git("rev-parse", "origin/main"), BASE, "EA5E2_FREEZE_CURRENT_PROTECTED_MAIN_DRIFT");

  const changed = git("diff", "--name-only", `${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  eq(JSON.stringify(changed), JSON.stringify([AUTHORITY, GATE, WORKFLOW].sort()), "EA5E2_FREEZE_EXACT_THREE_FILE_BOUNDARY_REQUIRED");

  const immutable = {
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-08-IMPLEMENTATION-ACTIVATION-QUALIFICATION-SEPARATION-AUTHORITY.md": "ef1e4344e5915e2c591cf7cfc9b6c2bf27f8bc3b",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md": "a037b24757992987fc24ce8b6afac6c8eabca3ed",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-POST-ACTIVATION-READINESS-AUDIT-V1.json": "df8b60cdcd21ad6b92665d8fc92e45f95836cffe",
    ".github/workflows/mcft-cap-09-ea5e2-rolling-operational-activation-live.yml": "d87365a11095900130dc888dbfe982e07af46830",
    "scripts/runtime_acceptance/RUN_MCFT_CAP_09_KBS_EXTERNAL_FIVE_FAMILY_DATA_PATH_V1.ts": "0873f6526d5826f56ad331f2b2f37f14efd85e34",
    "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_ROLLING_OPERATIONAL_ACTIVATION_OBSERVER_V1.ts": "eca0cda7502279c3149a0ff268926e0b4c05f5f7",
    "scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4_BINDING.cjs": "cf753402efae3986bc479d6103b577e586ba5aab",
  };
  for (const [file, expected] of Object.entries(immutable)) {
    eq(blob(BASE, file), expected, `EA5E2_FREEZE_BASE_PIN:${file}`);
    eq(blob("HEAD", file), expected, `EA5E2_FREEZE_QUALIFIED_BOUNDARY_MUTATED:${file}`);
  }

  const temporal = a.temporal_authority;
  eq(temporal.provider_temporal_authority, "PROVIDER_AVAILABILITY_WATERMARK_V1", "EA5E2_FREEZE_WATERMARK_AUTHORITY_REQUIRED");
  eq(temporal.provider_publication_cadence, "DAILY_BATCH", "EA5E2_FREEZE_DAILY_BATCH_REQUIRED");
  eq(temporal.observation_resolution, "HOURLY", "EA5E2_FREEZE_HOURLY_RESOLUTION_REQUIRED");
  eq(temporal.historical_online_freshness_diagnostic_hours, 6, "EA5E2_FREEZE_SIX_HOUR_DIAGNOSTIC_REQUIRED");
  no(temporal.freshness_is_late_authoritative_admission_gate, "EA5E2_FREEZE_FRESHNESS_GATE_FORBIDDEN");
  no(temporal.fixed_lag_7h_normative_authority, "EA5E2_FREEZE_FIXED_LAG_FORBIDDEN");
  no(temporal.t_plus_0630_collector_normative_authority, "EA5E2_FREEZE_0630_AUTHORITY_FORBIDDEN");
  no(temporal.t_plus_0712_cutoff_normative_authority, "EA5E2_FREEZE_0712_AUTHORITY_FORBIDDEN");
  no(temporal.t_plus_0717_observer_normative_authority, "EA5E2_FREEZE_0717_AUTHORITY_FORBIDDEN");
  yes(temporal.evidence_snapshot_time_actual_execution_required, "EA5E2_FREEZE_ACTUAL_SNAPSHOT_REQUIRED");

  const run = json(present(process.env.MCFT_EA5E2_LIVE_RUN_METADATA_PATH, "EA5E2_FREEZE_LIVE_RUN_METADATA_PATH_REQUIRED"));
  const liveArtifactMeta = json(present(process.env.MCFT_EA5E2_LIVE_ARTIFACT_METADATA_PATH, "EA5E2_FREEZE_LIVE_ARTIFACT_METADATA_PATH_REQUIRED"));
  const producerArtifactMeta = json(present(process.env.MCFT_EA5E2_PRODUCER_ARTIFACT_METADATA_PATH, "EA5E2_FREEZE_PRODUCER_ARTIFACT_METADATA_PATH_REQUIRED"));
  const successorRun = json(present(process.env.MCFT_EA5E2_SUCCESSOR_RUN_METADATA_PATH, "EA5E2_FREEZE_SUCCESSOR_RUN_METADATA_PATH_REQUIRED"));
  const successorArtifactMeta = json(present(process.env.MCFT_EA5E2_SUCCESSOR_ARTIFACT_METADATA_PATH, "EA5E2_FREEZE_SUCCESSOR_ARTIFACT_METADATA_PATH_REQUIRED"));
  const liveDir = present(process.env.MCFT_EA5E2_LIVE_ARTIFACT_DIR, "EA5E2_FREEZE_LIVE_ARTIFACT_DIR_REQUIRED");
  const producerDir = present(process.env.MCFT_EA5E2_PRODUCER_ARTIFACT_DIR, "EA5E2_FREEZE_PRODUCER_ARTIFACT_DIR_REQUIRED");

  eq(run.id, a.live_proof.workflow_run_id, "EA5E2_FREEZE_RUN_ID_REQUIRED");
  eq(run.name, "mcft-cap-09-ea5e2-rolling-operational-activation-live", "EA5E2_FREEZE_RUN_NAME_REQUIRED");
  eq(run.event, "workflow_dispatch", "EA5E2_FREEZE_WORKFLOW_DISPATCH_REQUIRED");
  eq(run.head_branch, "main", "EA5E2_FREEZE_RUN_MAIN_REQUIRED");
  eq(run.head_sha, BASE, "EA5E2_FREEZE_RUN_EXACT_SUBJECT_REQUIRED");
  eq(run.status, "completed", "EA5E2_FREEZE_RUN_COMPLETED_REQUIRED");
  eq(run.conclusion, "success", "EA5E2_FREEZE_RUN_SUCCESS_REQUIRED");

  eq(liveArtifactMeta.id, a.live_proof.artifact_id, "EA5E2_FREEZE_ARTIFACT_ID_REQUIRED");
  eq(liveArtifactMeta.digest, a.live_proof.artifact_digest, "EA5E2_FREEZE_ARTIFACT_DIGEST_REQUIRED");
  no(liveArtifactMeta.expired, "EA5E2_FREEZE_LIVE_ARTIFACT_EXPIRED_FORBIDDEN");
  eq(liveArtifactMeta.workflow_run?.id, run.id, "EA5E2_FREEZE_ARTIFACT_RUN_BINDING_REQUIRED");
  eq(liveArtifactMeta.workflow_run?.head_sha, BASE, "EA5E2_FREEZE_ARTIFACT_SUBJECT_REQUIRED");

  eq(successorRun.id, a.exact_head_successor_qualification.workflow_run_id, "EA5E2_FREEZE_SUCCESSOR_RUN_ID_REQUIRED");
  eq(successorRun.head_sha, BASE, "EA5E2_FREEZE_SUCCESSOR_SUBJECT_REQUIRED");
  eq(successorRun.conclusion, "success", "EA5E2_FREEZE_SUCCESSOR_PASS_REQUIRED");
  eq(successorArtifactMeta.id, a.exact_head_successor_qualification.artifact_id, "EA5E2_FREEZE_SUCCESSOR_ARTIFACT_ID_REQUIRED");
  eq(successorArtifactMeta.digest, a.exact_head_successor_qualification.artifact_digest, "EA5E2_FREEZE_SUCCESSOR_ARTIFACT_DIGEST_REQUIRED");
  no(successorArtifactMeta.expired, "EA5E2_FREEZE_SUCCESSOR_ARTIFACT_EXPIRED_FORBIDDEN");

  const intersection = json(path.join(liveDir, "MCFT_CAP_09_ROLLING_KBS_INTERSECTION.json"));
  const five = json(path.join(liveDir, "MCFT_CAP_09_KBS_EXTERNAL_FIVE_FAMILY_DATA_PATH.json"));
  const observer = json(path.join(liveDir, "MCFT_CAP_09_EA5E2_ROLLING_OPERATIONAL_ACTIVATION_OBSERVER_PROOF.json"));
  const live = json(path.join(liveDir, "MCFT_CAP_09_EA5E2_ROLLING_OPERATIONAL_ACTIVATION_LIVE_CANDIDATE.json"));
  const formalSnapshot = json(path.join(liveDir, "MCFT_CAP_09_EA5E2_FORMAL_SNAPSHOT_READINESS.json"));
  const producer = json(path.join(producerDir, "MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.json"));
  const producerSafe = json(path.join(producerDir, "MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PREBOUNDARY_SAFE_PROOF.json"));

  for (const proof of [intersection, five, observer, live, formalSnapshot, producer, producerSafe]) eq(proof.status, "PASS", "EA5E2_FREEZE_ALL_SOURCE_PROOFS_PASS_REQUIRED");
  eq(live.subject_sha, BASE, "EA5E2_FREEZE_LIVE_CANDIDATE_SUBJECT_REQUIRED");
  yes(live.operational_activation_live_candidate_pass, "EA5E2_FREEZE_LIVE_CANDIDATE_PASS_REQUIRED");
  no(live.ea5e2_operational_activation_qualified, "EA5E2_FREEZE_CANDIDATE_PRE_FREEZE_EFFECT_FORBIDDEN");
  yes(live.effectiveness_pending_evidence_freeze, "EA5E2_FREEZE_PENDING_MARKER_REQUIRED");
  eq(five.subject_sha, BASE, "EA5E2_FREEZE_FIVE_SUBJECT_REQUIRED");
  eq(observer.subject_sha, BASE, "EA5E2_FREEZE_OBSERVER_SUBJECT_REQUIRED");
  eq(formalSnapshot.subject_sha, BASE, "EA5E2_FREEZE_FORMAL_SNAPSHOT_SUBJECT_REQUIRED");
  eq(intersection.temporal_authority, "PROVIDER_AVAILABILITY_WATERMARK_V1", "EA5E2_FREEZE_INTERSECTION_WATERMARK_REQUIRED");
  no(intersection.freshness_is_late_authoritative_admission_gate, "EA5E2_FREEZE_INTERSECTION_FRESHNESS_GATE_FORBIDDEN");

  const target = live.target_t;
  canonicalIso(target, "EA5E2_FREEZE_TARGET_T_INVALID");
  for (const proof of [five, observer, producer]) eq(proof.target_t, target, "EA5E2_FREEZE_EXACT_TARGET_BINDING_REQUIRED");
  eq(intersection.selected.target_t, target, "EA5E2_FREEZE_INTERSECTION_TARGET_REQUIRED");
  eq(producerArtifactMeta.id, five.producer_artifact_id, "EA5E2_FREEZE_PRODUCER_ARTIFACT_CROSS_BINDING_REQUIRED");
  eq(producerArtifactMeta.id, a.producer_proof.artifact_id, "EA5E2_FREEZE_PRODUCER_ARTIFACT_ID_REQUIRED");
  eq(producerArtifactMeta.digest, five.producer_artifact_digest, "EA5E2_FREEZE_PRODUCER_DIGEST_CROSS_BINDING_REQUIRED");
  eq(producerArtifactMeta.digest, a.producer_proof.artifact_digest, "EA5E2_FREEZE_PRODUCER_DIGEST_REQUIRED");
  no(producerArtifactMeta.expired, "EA5E2_FREEZE_PRODUCER_ARTIFACT_EXPIRED_FORBIDDEN");
  eq(producer.producer_subject_sha, five.producer_subject_sha, "EA5E2_FREEZE_PRODUCER_SUBJECT_CROSS_BINDING_REQUIRED");
  eq(producer.producer_subject_sha, a.producer_proof.subject_sha, "EA5E2_FREEZE_PRODUCER_SUBJECT_REQUIRED");

  const gfs = producer.rehydration_manifest.gfs;
  const soil = producer.rehydration_manifest.soil;
  const preHashes = producer.rehydration_manifest.expected_records;
  const kbsHashes = five.exact_target_kbs_evidence_hashes;
  eq(preHashes.length, 3, "EA5E2_FREEZE_PREBOUNDARY_THREE_HASHES_REQUIRED");
  eq(kbsHashes.length, 2, "EA5E2_FREEZE_EXACT_T_KBS_TWO_HASHES_REQUIRED");
  const fiveHashes = sortedEvidenceHashes([...preHashes, ...kbsHashes]);
  eq(fiveHashes.length, 5, "EA5E2_FREEZE_EXACT_FIVE_HASHES_REQUIRED");
  eq(new Set(fiveHashes.map((x) => x.record_type)).size, 5, "EA5E2_FREEZE_EXACT_FIVE_TYPES_REQUIRED");

  const gfsSourceIds = preHashes.filter((x) => x.record_type === "future_et0_assumption_v1" || x.record_type === "future_weather_assumption_v1").map((x) => x.source_record_id).sort();
  eq(gfsSourceIds.length, 2, "EA5E2_FREEZE_GFS_TWO_RECORDS_REQUIRED");
  const expectedGfsIdentity = {
    provider_id: gfs.provenance.provider_id,
    source_family: gfs.provenance.source_family,
    source_record_ids: gfsSourceIds,
    raw_sha256: gfs.provenance.raw_sha256,
    raw_bytes: gfs.provenance.raw_bytes,
    retrieved_at: gfs.provenance.retrieved_at,
    available_at: gfs.provenance.available_at,
    ingested_at: gfs.ingested_at,
  };

  const expectedKbsReceipt = sanitizeReceipt(five.exact_target_kbs_private_retention_receipt_hash_metadata);
  const expectedGfsReceipt = sanitizeReceipt(gfs.provenance);
  const expectedSoilReceipt = sanitizeReceipt(soil.provenance);

  const e = a.frozen_evidence;
  eq(e.kbs_latest_timestamp, intersection.provider_latest_timestamp, "EA5E2_FREEZE_KBS_LATEST_REQUIRED");
  eq(e.kbs_computed_age_hours, intersection.provider_latest_age_hours, "EA5E2_FREEZE_KBS_AGE_REQUIRED");
  eq(e.target_t, target, "EA5E2_FREEZE_TARGET_REQUIRED");
  eq(e.pre_boundary_collector_observed_at, producerSafe.phase_requested_at, "EA5E2_FREEZE_PREBOUNDARY_OBSERVED_AT_REQUIRED");
  eq(e.late_exact_hour_collector_observed_at, five.exact_target_kbs_private_retention_receipt_hash_metadata.retained_at, "EA5E2_FREEZE_EXACT_T_COLLECTOR_OBSERVED_AT_REQUIRED");
  eq(e.scheduler_eligibility_time, null, "EA5E2_FREEZE_SUPERSEDED_SCHEDULER_TIME_MUST_BE_NULL");
  eq(e.exact_interval_cutoff_time, observer.evidence_snapshot_time, "EA5E2_FREEZE_SNAPSHOT_CUTOFF_REQUIRED");
  eq(e.runtime_observer_expected_at, null, "EA5E2_FREEZE_SUPERSEDED_OBSERVER_EXPECTED_MUST_BE_NULL");
  eq(e.runtime_observer_started_at, observer.observer_execution_started_at, "EA5E2_FREEZE_OBSERVER_STARTED_REQUIRED");
  eq(e.runtime_observer_start_skew_minutes, null, "EA5E2_FREEZE_SUPERSEDED_OBSERVER_SKEW_MUST_BE_NULL");
  eq(e.evidence_snapshot_time, observer.evidence_snapshot_time, "EA5E2_FREEZE_EVIDENCE_SNAPSHOT_REQUIRED");
  yes(observer.evidence_snapshot_time_is_actual_execution_snapshot, "EA5E2_FREEZE_ACTUAL_SNAPSHOT_PROOF_REQUIRED");
  eq(JSON.stringify(e.same_cycle_gfs_identity), JSON.stringify(expectedGfsIdentity), "EA5E2_FREEZE_GFS_IDENTITY_REQUIRED");
  eq(JSON.stringify(e.private_retention_receipt_hash_metadata.kbs_exact_t), JSON.stringify(expectedKbsReceipt), "EA5E2_FREEZE_KBS_RECEIPT_REQUIRED");
  eq(JSON.stringify(e.private_retention_receipt_hash_metadata.gfs_preboundary), JSON.stringify(expectedGfsReceipt), "EA5E2_FREEZE_GFS_RECEIPT_REQUIRED");
  eq(JSON.stringify(e.private_retention_receipt_hash_metadata.soil_preboundary), JSON.stringify(expectedSoilReceipt), "EA5E2_FREEZE_SOIL_RECEIPT_REQUIRED");
  eq(JSON.stringify(sortedEvidenceHashes(e.isolated_database_evidence_hashes)), JSON.stringify(fiveHashes), "EA5E2_FREEZE_EXACT_FIVE_DB_HASHES_REQUIRED");
  eq(e.single_t_crop_context_hash, observer.crop_context_hash, "EA5E2_FREEZE_CROP_HASH_REQUIRED");
  eq(e.external_cap04_operation_variant, "A1", "EA5E2_FREEZE_CAP04_A1_REQUIRED");
  eq(e.external_cap04_operation_variant, observer.disposition, "EA5E2_FREEZE_CAP04_DISPOSITION_BINDING_REQUIRED");
  eq(e.external_cap04_forecast_status, "COMPLETED", "EA5E2_FREEZE_CAP04_COMPLETED_REQUIRED");
  eq(e.external_cap04_forecast_status, observer.forecast_status, "EA5E2_FREEZE_CAP04_STATUS_BINDING_REQUIRED");
  eq(e.external_cap04_forecast_point_count, 72, "EA5E2_FREEZE_CAP04_72_REQUIRED");
  eq(e.external_cap04_forecast_point_count, observer.forecast_point_count, "EA5E2_FREEZE_CAP04_POINT_BINDING_REQUIRED");

  eq(a.live_proof.target_t, target, "EA5E2_FREEZE_LIVE_TARGET_REQUIRED");
  eq(a.live_proof.evidence_snapshot_time, observer.evidence_snapshot_time, "EA5E2_FREEZE_LIVE_SNAPSHOT_REQUIRED");
  eq(a.producer_proof.target_t, target, "EA5E2_FREEZE_PRODUCER_TARGET_REQUIRED");

  const side = a.side_effect_boundary;
  eq(side.source_substitution_count, live.source_substitution_count, "EA5E2_FREEZE_SOURCE_SUBSTITUTION_BINDING_REQUIRED");
  eq(side.timestamp_relabel_count, live.timestamp_relabel_count, "EA5E2_FREEZE_TIMESTAMP_RELABEL_BINDING_REQUIRED");
  eq(side.runtime_provider_request_count, observer.provider_request_count, "EA5E2_FREEZE_RUNTIME_PROVIDER_BINDING_REQUIRED");
  eq(side.formal_database_write_count, 0, "EA5E2_FREEZE_FORMAL_DB_ZERO_REQUIRED");
  eq(side.formal_database_write_count, live.formal_database_write_count, "EA5E2_FREEZE_FORMAL_DB_BINDING_REQUIRED");
  eq(side.formal_raw_prefix_write_count, 0, "EA5E2_FREEZE_FORMAL_RAW_ZERO_REQUIRED");
  eq(side.formal_raw_prefix_write_count, five.formal_r2_prefix_write_count, "EA5E2_FREEZE_FORMAL_RAW_BINDING_REQUIRED");
  eq(side.formal_scheduler_write_count, 0, "EA5E2_FREEZE_SCHEDULER_ZERO_REQUIRED");
  eq(side.formal_scheduler_write_count, live.scheduler_write_count, "EA5E2_FREEZE_SCHEDULER_BINDING_REQUIRED");
  eq(side.formal_canonical_runtime_write_count, 0, "EA5E2_FREEZE_CANONICAL_RUNTIME_ZERO_REQUIRED");
  eq(side.formal_canonical_runtime_write_count, live.canonical_runtime_write_count, "EA5E2_FREEZE_CANONICAL_RUNTIME_BINDING_REQUIRED");
  for (const key of ["source_substitution_count", "timestamp_relabel_count", "runtime_provider_request_count", "formal_database_write_count", "formal_raw_prefix_write_count", "formal_scheduler_write_count", "formal_canonical_runtime_write_count"]) eq(side[key], 0, `EA5E2_FREEZE_FORBIDDEN_SIDE_EFFECT_ZERO:${key}`);
  no(side.formal_window_started, "EA5E2_FREEZE_FORMAL_WINDOW_START_FORBIDDEN");
  no(side.ea5e3_authorized, "EA5E2_FREEZE_EA5E3_PREMATURE_FORBIDDEN");

  const effect = a.effect_if_exact_head_proof_passes_and_candidate_merges;
  yes(effect.ea5e2_operational_activation_qualified, "EA5E2_FREEZE_EFFECT_ACTIVATION_REQUIRED");
  no(effect.ea5e3_authorized, "EA5E2_FREEZE_EFFECT_EA5E3_FORBIDDEN");
  no(effect.formal_window_started, "EA5E2_FREEZE_EFFECT_FORMAL_START_FORBIDDEN");
  eq(effect.formal_execution_count, "0/24", "EA5E2_FREEZE_EFFECT_FORMAL_ZERO_REQUIRED");
  no(effect.mcft_cap09_completed, "EA5E2_FREEZE_EFFECT_COMPLETION_FORBIDDEN");
  eq(effect.next_legal_frontier, "WHOLE_WINDOW_CROP_CONTEXT_SCAN", "EA5E2_FREEZE_NEXT_FRONTIER_REQUIRED");

  writeResult({
    schema_version: "geox_mcft_cap09_ea5e2_operational_activation_evidence_freeze_v1_governance_result",
    status: "PASS",
    subject_sha: git("rev-parse", "HEAD"),
    base_protected_main_sha: BASE,
    protected_main_live_subject_sha: BASE,
    live_workflow_run_id: run.id,
    live_artifact_id: liveArtifactMeta.id,
    live_artifact_digest: liveArtifactMeta.digest,
    producer_artifact_id: producerArtifactMeta.id,
    exact_head_successor_qualification_run_id: successorRun.id,
    exact_head_successor_qualification_artifact_id: successorArtifactMeta.id,
    exact_five_evidence_hash_count: fiveHashes.length,
    provider_temporal_authority: temporal.provider_temporal_authority,
    historical_online_freshness_diagnostic_hours: temporal.historical_online_freshness_diagnostic_hours,
    freshness_is_late_authoritative_admission_gate: false,
    fixed_lag_normative_authority: false,
    external_cap04_operation_variant: e.external_cap04_operation_variant,
    external_cap04_forecast_status: e.external_cap04_forecast_status,
    external_cap04_forecast_point_count: e.external_cap04_forecast_point_count,
    forbidden_side_effect_count_sum: Object.entries(side).filter(([k]) => k.endsWith("_count")).reduce((n, [, v]) => n + Number(v), 0),
    ea5e2_operational_activation_qualified_after_merge: true,
    formal_window_started: false,
    ea5e3_authorized: false,
    mcft_cap09_completed: false,
  });
}

try { main(); } catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
}
