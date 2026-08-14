#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const OUT = "acceptance-output/MCFT_CAP_09_EA5E2_AMENDMENT_11_SUCCESSOR_PREFLIGHT.json";
const A11 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md";
const A07 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-07-EXTERNAL-FORMAL-FIXED-LAG-CAUSALITY-AUTHORITY.md";
const A13 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-13-CURRENT-CROP-AUTHORITY-REQUALIFICATION-SEPARATION.md";
const DB = "apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.ts";
const CROP_REQUAL = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-CURRENT-CROP-AUTHORITY-REQUALIFICATION-RESULT-V1.json";
const ROLLING_PROOF = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-ROLLING-PREBOUNDARY-LIVE-PROOF-V1.json";
const HOUR = 3600_000;

function read(file) { return fs.readFileSync(file, "utf8"); }
function git(...args) { return execFileSync("git", args, { encoding:"utf8" }).trim(); }
function requireMarker(text, marker, code, staticBlockers) { if (!text.includes(marker)) staticBlockers.push({ code, marker }); }
function forbidMarker(text, marker, code, staticBlockers) { if (text.includes(marker)) staticBlockers.push({ code, marker }); }

function rollingProofProfile(staticBlockers, readinessBlockers) {
  if (!fs.existsSync(ROLLING_PROOF)) {
    readinessBlockers.push({ code:"ROLLING_PREBOUNDARY_QUALIFICATION_CAPTURE_NOT_PROVEN", implication:"WAIT_FOR_EXACT_MAIN_REAL_SOIL_GFS_CAUSAL_CAPTURE_AND_IMMUTABLE_PROOF" });
    return { present:false, qualified:false };
  }
  let proof;
  try { proof = JSON.parse(read(ROLLING_PROOF)); }
  catch (error) {
    staticBlockers.push({ code:"ROLLING_PREBOUNDARY_LIVE_PROOF_INVALID_JSON", error:String(error?.message||error) });
    return { present:true, qualified:false };
  }
  const expectedTypes = ["future_et0_assumption_v1","future_weather_assumption_v1","soil_moisture_observation_v1"];
  const types = Array.isArray(proof.record_types) ? [...proof.record_types].sort() : [];
  const rawRefs = Array.isArray(proof.raw_retention_refs) ? proof.raw_retention_refs : [];
  const producerSha = String(proof.producer_subject_sha || proof.subject_sha || "");
  const target = Date.parse(String(proof.target_t || ""));
  const captured = Date.parse(String(proof.captured_at || ""));
  const expires = Date.parse(String(proof.candidate_expires_at || ""));
  const checks = [
    [proof.status === "PASS", "ROLLING_PREBOUNDARY_LIVE_PROOF_STATUS"],
    [proof.proof_class === "EXACT_PROTECTED_MAIN_REAL_PREBOUNDARY_CAUSAL_CAPTURE", "ROLLING_PREBOUNDARY_LIVE_PROOF_CLASS"],
    [proof.temporal_authority === "PROVIDER_AVAILABILITY_WATERMARK_V1", "ROLLING_PREBOUNDARY_LIVE_PROOF_AUTHORITY"],
    [/^[0-9a-f]{40}$/.test(producerSha), "ROLLING_PREBOUNDARY_LIVE_PROOF_PRODUCER_SHA"],
    [Number.isInteger(proof.workflow_run_id) && proof.workflow_run_id > 0, "ROLLING_PREBOUNDARY_LIVE_PROOF_RUN_ID"],
    [Number.isInteger(proof.artifact_id) && proof.artifact_id > 0, "ROLLING_PREBOUNDARY_LIVE_PROOF_ARTIFACT_ID"],
    [typeof proof.artifact_digest === "string" && /^sha256:[0-9a-f]{64}$/.test(proof.artifact_digest), "ROLLING_PREBOUNDARY_LIVE_PROOF_ARTIFACT_DIGEST"],
    [JSON.stringify(types) === JSON.stringify(expectedTypes), "ROLLING_PREBOUNDARY_LIVE_PROOF_FAMILY_SET"],
    [rawRefs.length >= 2 && rawRefs.every((x) => typeof x === "string" && x.startsWith("s3-private://")), "ROLLING_PREBOUNDARY_LIVE_PROOF_RAW_REFS"],
    [Number.isFinite(target) && Number.isFinite(captured) && captured <= target, "ROLLING_PREBOUNDARY_LIVE_PROOF_CAUSAL_TIME"],
    [Number.isFinite(expires) && expires >= target + 36*HOUR, "ROLLING_PREBOUNDARY_LIVE_PROOF_RETENTION"],
    [proof.soil_observation_inside_t_minus_15_to_t === true, "ROLLING_PREBOUNDARY_LIVE_PROOF_SOIL_WINDOW"],
    [proof.same_cycle_future_weather_et0 === true, "ROLLING_PREBOUNDARY_LIVE_PROOF_GFS_PAIR"],
    [proof.raw_retained_before_canonicalization === true, "ROLLING_PREBOUNDARY_LIVE_PROOF_RAW_FIRST"],
    [proof.formal_database_write_count === 0, "ROLLING_PREBOUNDARY_LIVE_PROOF_FORMAL_DB_ZERO"],
    [proof.formal_r2_prefix_write_count === 0, "ROLLING_PREBOUNDARY_LIVE_PROOF_FORMAL_R2_ZERO"],
    [proof.scheduler_write_count === 0, "ROLLING_PREBOUNDARY_LIVE_PROOF_SCHEDULER_ZERO"],
    [proof.runtime_write_count === 0, "ROLLING_PREBOUNDARY_LIVE_PROOF_RUNTIME_ZERO"],
    [proof.crop_authority_effect === "NONE", "ROLLING_PREBOUNDARY_LIVE_PROOF_CROP_NONE"]
  ];
  for (const [ok, code] of checks) if (!ok) staticBlockers.push({ code });
  return { present:true, qualified:checks.every(([ok]) => ok), producer_subject_sha:producerSha, workflow_run_id:proof.workflow_run_id, artifact_id:proof.artifact_id, target_t:proof.target_t, captured_at:proof.captured_at, candidate_expires_at:proof.candidate_expires_at, record_types:types, raw_ref_count:rawRefs.length };
}

function currentCropProfile(staticBlockers, readinessBlockers) {
  if (!fs.existsSync(CROP_REQUAL)) {
    readinessBlockers.push({ code:"CURRENT_CROP_REQUALIFICATION_RESULT_NOT_BOUND", implication:"RUN_AND_BIND_AMENDMENT13_CURRENT_CROP_REQUALIFICATION" });
    return { present:false, qualified:false };
  }
  let proof;
  try { proof = JSON.parse(read(CROP_REQUAL)); }
  catch (error) {
    staticBlockers.push({ code:"CURRENT_CROP_REQUALIFICATION_RESULT_INVALID_JSON", error:String(error?.message||error) });
    return { present:true, qualified:false };
  }
  const lifecycle = proof.season_lifecycle_authority || {};
  const phenology = proof.phenology_stage_authority || {};
  const model = proof.crop_model_parameter_authority || {};
  const readiness = proof.ea5e2_readiness || {};
  const temporal = proof.temporal_scope || {};
  const effect = proof.authority_effect || {};
  const checks = [
    [proof.schema_version === "geox_mcft_cap09_ea5e2_current_crop_authority_requalification_result_v1", "CURRENT_CROP_REQUAL_SCHEMA"],
    [proof.record_status === "CURRENT_CROP_AUTHORITY_REQUALIFICATION_RESULT_AUTHORITY_WHEN_PRESENT_ON_PROTECTED_MAIN", "CURRENT_CROP_REQUAL_STATUS"],
    [proof.exact_live_proof?.status === "PASS", "CURRENT_CROP_REQUAL_LIVE_PROOF_PASS"],
    [proof.exact_live_proof?.subject_sha === "cd203df090f28ce3d2a21d6a63a2942397889f40", "CURRENT_CROP_REQUAL_LIVE_SUBJECT"],
    [proof.exact_live_proof?.workflow_run_id === 31795122787, "CURRENT_CROP_REQUAL_RUN_ID"],
    [proof.exact_live_proof?.artifact_id === 9217058841, "CURRENT_CROP_REQUAL_ARTIFACT_ID"],
    [proof.exact_live_proof?.artifact_digest === "sha256:18e858be56422f633230d05b917285ec3a1d6c494aa7df97a866c45e91fc8cee", "CURRENT_CROP_REQUAL_ARTIFACT_DIGEST"],
    [lifecycle.status === "UNRESOLVED" && lifecycle.active_established === false && lifecycle.terminated_established === false, "CURRENT_CROP_REQUAL_LIFECYCLE"],
    [lifecycle.absence_of_termination_used_to_prove_active === false, "CURRENT_CROP_REQUAL_NO_ACTIVE_FROM_SILENCE"],
    [phenology.status === "UNRESOLVED" && phenology.stage === null && phenology.reason === "REQUIRED_PHENOLOGY_STAGE_UNRESOLVED", "CURRENT_CROP_REQUAL_PHENOLOGY"],
    [model.status === "UNRESOLVED" && model.parameter === "Kc" && model.kc === null && model.reason === "REQUIRED_CROP_MODEL_PARAMETER_AUTHORITY_UNRESOLVED", "CURRENT_CROP_REQUAL_MODEL_PARAMETER"],
    [readiness.status === "BLOCKED" && readiness.blocker === "CURRENT_SEASON_LIFECYCLE_UNRESOLVED", "CURRENT_CROP_REQUAL_READINESS"],
    [readiness.legacy_no_future_legal_target_blocker_authoritative === false, "CURRENT_CROP_REQUAL_LEGACY_BLOCKER_FORBIDDEN"],
    [temporal.result_is_as_of_snapshot_not_perpetual_field_truth === true && temporal.newer_qualified_crop_or_lifecycle_evidence_requires_requalification === true, "CURRENT_CROP_REQUAL_TEMPORAL_SCOPE"],
    [effect.legacy_no_future_legal_target_interpretation_superseded_for_ea5e2_readiness === true, "CURRENT_CROP_REQUAL_SUPERSESSION_EFFECT"],
    [effect.ea5e2_operational_activation_qualified === false && effect.formal_window_started === false && effect.formal_execution_count === "0/24", "CURRENT_CROP_REQUAL_NO_ACTIVATION"]
  ];
  for (const [ok, code] of checks) if (!ok) staticBlockers.push({ code });
  if (checks.every(([ok]) => ok)) {
    readinessBlockers.push({
      code:readiness.blocker,
      implication:"CURRENT_MANAGEMENT_SEASON_LIFECYCLE_NOT_POSITIVELY_ESTABLISHED_ACTIVE; REQUIRED_PHENOLOGY_AND_KC_ALSO_UNRESOLVED",
      diagnostic_causes:Array.isArray(readiness.diagnostic_causes) ? readiness.diagnostic_causes : []
    });
  }
  return {
    present:true,
    qualified:checks.every(([ok]) => ok),
    authority_time_utc:proof.exact_live_proof?.authority_time_utc,
    workflow_run_id:proof.exact_live_proof?.workflow_run_id,
    artifact_id:proof.exact_live_proof?.artifact_id,
    lifecycle_status:lifecycle.status,
    phenology_status:phenology.status,
    phenology_stage:phenology.stage,
    crop_model_parameter_status:model.status,
    kc:model.kc,
    readiness_blocker:readiness.blocker,
    diagnostic_causes:readiness.diagnostic_causes || [],
    legacy_no_future_legal_target_blocker_authoritative:false,
    next_evidence_frontier:proof.next_evidence_frontier
  };
}

try {
  fs.mkdirSync(path.dirname(OUT), { recursive:true });
  const subject = git("rev-parse", "HEAD");
  const a11 = read(A11);
  const a13 = read(A13);
  const db = read(DB);
  const staticBlockers = [];
  const readinessBlockers = [];

  for (const marker of ["provider_publication_cadence = daily_batch","kbs_raw_hourly_age <= 6h","!= late authoritative evidence eligibility","PROVIDER_AVAILABILITY_WATERMARK_V1","evidence_snapshot_time","crop_authority_effect = NONE","24 actual UTC hourly scheduler boundaries","Batch arrival MUST NOT authorize retroactive post-T acquisition"]) requireMarker(a11, marker, "AMENDMENT11_AUTHORITY_MARKER_MISSING", staticBlockers);
  for (const marker of ["season_lifecycle_authority","phenology_stage_authority","crop_model_parameter_authority","REQUIRED_PHENOLOGY_STAGE_UNRESOLVED","CURRENT_SEASON_LIFECYCLE_UNRESOLVED"]) requireMarker(a13, marker, "AMENDMENT13_AUTHORITY_MARKER_MISSING", staticBlockers);

  const a07Blob = git("rev-parse", `HEAD:${A07}`);
  if (a07Blob !== "c5a98ca789027e1bf051ec56bf1b7e76b98a0891") staticBlockers.push({ code:"HISTORICAL_AMENDMENT07_MUTATED", actual:a07Blob });

  for (const marker of ["evidence_snapshot_time: string","EA5E2_EXTERNAL_DB_EVIDENCE_SNAPSHOT_BEFORE_LOGICAL_TIME","const availabilityCutoff = exactIntervalRole ? evidenceSnapshotTime : logicalTime","EA5E2_EXTERNAL_DB_SOURCE_IDENTITY_CONFLICT","EA5E2_EXTERNAL_DB_DUPLICATE_SOURCE_RECORD_ID","EA5E2_EXTERNAL_DB_REQUIRED_FAMILY_MISSING","BEGIN TRANSACTION READ ONLY"]) requireMarker(db, marker, "AMENDMENT11_DB_SOURCE_RULE_MISSING", staticBlockers);
  for (const marker of ["EXTERNAL_FORMAL_EXACT_INTERVAL_CUTOFF_OFFSET_MINUTES_V1 = 432","EA5E2_EXTERNAL_DB_EXACT_INTERVAL_CUTOFF_DRIFT"]) forbidMarker(db, marker, "AMENDMENT11_FIXED_LAG_DB_AUTHORITY_STILL_ACTIVE", staticBlockers);

  const crop = currentCropProfile(staticBlockers, readinessBlockers);
  const rolling = rollingProofProfile(staticBlockers, readinessBlockers);

  const result = {
    schema_version:"geox_mcft_cap09_ea5e2_amendment_11_successor_preflight_v3",
    status:staticBlockers.length ? "FAIL" : "PASS",
    subject_sha:subject,
    amendment_11_effective_on_subject:true,
    amendment_13_crop_authority_separation_effective:true,
    historical_amendment_07_preserved:true,
    active_temporal_authority:"PROVIDER_AVAILABILITY_WATERMARK_V1",
    kbs_observation_resolution:"hourly",
    kbs_provider_publication_cadence:"daily_batch",
    kbs_le_6h_delayed_admission_authority:false,
    fixed_t_plus_432_authority:false,
    fixed_7h_scheduler_authority:false,
    evidence_snapshot_time_external_adapter:true,
    preboundary_cutoff_remains_logical_t:true,
    delayed_exact_interval_uses_actual_snapshot:true,
    rolling_preboundary_capture:rolling,
    crop_authority_effect:"NONE",
    current_crop_requalification:crop,
    legacy_six_model_no_future_target_is_readiness_authority:false,
    static_blockers:staticBlockers,
    activation_readiness:staticBlockers.length || readinessBlockers.length ? "BLOCKED" : "READY",
    readiness_blockers:readinessBlockers,
    protected_main_live_dispatch_authorized:false,
    database_write_count:0,
    provider_request_count:0,
    formal_window_started:false,
    formal_execution_count:"0/24"
  };
  fs.writeFileSync(OUT, `${JSON.stringify(result,null,2)}\n`);
  console.log(JSON.stringify(result));
  if (staticBlockers.length) process.exitCode=1;
} catch (error) {
  fs.mkdirSync(path.dirname(OUT), { recursive:true });
  const result={schema_version:"geox_mcft_cap09_ea5e2_amendment_11_successor_preflight_v3",status:"FAIL",error:String(error?.message||error),protected_main_live_dispatch_authorized:false,database_write_count:0,formal_window_started:false};
  fs.writeFileSync(OUT,`${JSON.stringify(result,null,2)}\n`); console.log(JSON.stringify(result)); process.exitCode=1;
}
