#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const OUT = "acceptance-output/MCFT_CAP_09_EA5E2_AMENDMENT_11_SUCCESSOR_PREFLIGHT.json";
const A11 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md";
const A07 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-07-EXTERNAL-FORMAL-FIXED-LAG-CAUSALITY-AUTHORITY.md";
const DB = "apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.ts";
const CROP = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json";
const ROLLING_PROOF = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-ROLLING-PREBOUNDARY-LIVE-PROOF-V1.json";
const HOUR = 3600_000;

function read(file) { return fs.readFileSync(file, "utf8"); }
function git(...args) { return execFileSync("git", args, { encoding:"utf8" }).trim(); }
function requireMarker(text, marker, code, staticBlockers) { if (!text.includes(marker)) staticBlockers.push({ code, marker }); }
function forbidMarker(text, marker, code, staticBlockers) { if (text.includes(marker)) staticBlockers.push({ code, marker }); }
function obj(value, code) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code); return value; }
function num(value, code) { if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code); return value; }
function stageAt(ageDays, lengths) {
  const [a,b,c,d] = lengths;
  if (![a,b,c,d].every((x) => typeof x === "number" && Number.isFinite(x))) return null;
  const b1=a, b2=a+b, b3=a+b+c, b4=a+b+c+d;
  if (ageDays < 0 || ageDays >= b4) return null;
  if (ageDays < b1) return "INITIAL";
  if (ageDays < b2) return "DEVELOPMENT";
  if (ageDays < b3) return "MID";
  return "LATE";
}
function cropProfile(authority) {
  const planting = obj(authority.planting_authority, "A11_PREFLIGHT_PLANTING_REQUIRED");
  const window = obj(planting.possible_event_window_utc, "A11_PREFLIGHT_PLANTING_WINDOW_REQUIRED");
  const model = obj(authority.model_stage_prior, "A11_PREFLIGHT_MODEL_REQUIRED");
  const policy = obj(authority.as_of_derivation_policy, "A11_PREFLIGHT_POLICY_REQUIRED");
  const variants = model.variant_stage_lengths_days;
  if (!Array.isArray(variants) || variants.length !== 6) throw new Error("A11_PREFLIGHT_EXACT_SIX_VARIANTS_REQUIRED");
  const plantingTimes = [Date.parse(window.start_inclusive), Date.parse(window.end_exclusive)-1];
  if (plantingTimes.some((x) => !Number.isFinite(x))) throw new Error("A11_PREFLIGHT_PLANTING_WINDOW_INVALID");
  const backward = num(policy.backward_stability_hours, "A11_PREFLIGHT_BACKWARD_REQUIRED");
  const forward = num(policy.forward_transition_guard_hours, "A11_PREFLIGHT_FORWARD_REQUIRED");
  const maxDays = Math.max(...variants.map((v) => v.reduce((a,b) => a+b,0)));
  const first = Math.ceil(Date.now()/HOUR)*HOUR;
  const end = plantingTimes[1] + maxDays*24*HOUR + 48*HOUR;
  let count = 0, firstLegal = null, lastLegal = null;
  for (let target=first; target<=end; target+=HOUR) {
    const stages = new Set(); let outside = false;
    for (const variant of variants) for (const planted of plantingTimes) for (const at of [target-backward*HOUR,target,target+forward*HOUR]) {
      const stage = stageAt((at-planted)/(24*HOUR), variant);
      if (!stage) outside = true; else stages.add(stage);
    }
    if (!outside && stages.size===1) {
      const legal = { target_t:new Date(target).toISOString(), stage:[...stages][0] };
      if (!firstLegal) firstLegal = legal; lastLegal = legal; count += 1;
    }
  }
  return { legal_future_target_count:count, first_legal_future_target:firstLegal, last_legal_future_target:lastLegal };
}
function rollingProofProfile(staticBlockers, readinessBlockers) {
  if (!fs.existsSync(ROLLING_PROOF)) {
    readinessBlockers.push({ code:"ROLLING_PREBOUNDARY_QUALIFICATION_CAPTURE_NOT_PROVEN", implication:"WAIT_FOR_EXACT_MAIN_REAL_SOIL_GFS_CAUSAL_CAPTURE_AND_IMMUTABLE_PROOF" });
    return { present:false, qualified:false };
  }
  let proof;
  try { proof = JSON.parse(read(ROLLING_PROOF)); }
  catch (error) { staticBlockers.push({ code:"ROLLING_PREBOUNDARY_LIVE_PROOF_INVALID_JSON", error:String(error?.message||error) }); return { present:true, qualified:false }; }
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

try {
  fs.mkdirSync(path.dirname(OUT), { recursive:true });
  const subject = git("rev-parse", "HEAD");
  const a11 = read(A11);
  const db = read(DB);
  const staticBlockers = [];
  const readinessBlockers = [];
  for (const marker of ["provider_publication_cadence = daily_batch","kbs_raw_hourly_age <= 6h","!= late authoritative evidence eligibility","PROVIDER_AVAILABILITY_WATERMARK_V1","evidence_snapshot_time","crop_authority_effect = NONE","24 actual UTC hourly scheduler boundaries","Batch arrival MUST NOT authorize retroactive post-T acquisition"]) requireMarker(a11, marker, "AMENDMENT11_AUTHORITY_MARKER_MISSING", staticBlockers);
  const a07Blob = git("rev-parse", `HEAD:${A07}`);
  if (a07Blob !== "c5a98ca789027e1bf051ec56bf1b7e76b98a0891") staticBlockers.push({ code:"HISTORICAL_AMENDMENT07_MUTATED", actual:a07Blob });
  for (const marker of ["evidence_snapshot_time?: string","EA5E2_EXTERNAL_DB_EVIDENCE_SNAPSHOT_BEFORE_LOGICAL_TIME","const availabilityCutoff = exactIntervalRole ? evidenceSnapshotTime : logicalTime","EA5E2_EXTERNAL_DB_SOURCE_IDENTITY_CONFLICT","EA5E2_EXTERNAL_DB_DUPLICATE_SOURCE_RECORD_ID","EA5E2_EXTERNAL_DB_REQUIRED_FAMILY_MISSING","BEGIN TRANSACTION READ ONLY"]) requireMarker(db, marker, "AMENDMENT11_DB_SOURCE_RULE_MISSING", staticBlockers);
  for (const marker of ["EXTERNAL_FORMAL_EXACT_INTERVAL_CUTOFF_OFFSET_MINUTES_V1 = 432","EA5E2_EXTERNAL_DB_EXACT_INTERVAL_CUTOFF_DRIFT"]) forbidMarker(db, marker, "AMENDMENT11_FIXED_LAG_DB_AUTHORITY_STILL_ACTIVE", staticBlockers);
  const crop = cropProfile(JSON.parse(read(CROP)));
  if (crop.legal_future_target_count === 0) readinessBlockers.push({ code:"CURRENT_CROP_AUTHORITY_HAS_NO_FUTURE_LEGAL_TARGET", implication:"CROP_AUTHORITY_REMAINS_INDEPENDENT; AMENDMENT_11_IS_NOT_A_CROP_BYPASS" });
  const rolling = rollingProofProfile(staticBlockers, readinessBlockers);
  if (db.includes("exact_interval_availability_cutoff_time?: string")) readinessBlockers.push({ code:"EVIDENCE_SNAPSHOT_CALLSITE_MIGRATION_NOT_COMPLETE", implication:"DEPRECATED_TRANSPORT_ALIAS_HAS_ZERO_AUTHORITY_EFFECT_AND_MUST_REMAIN_NON_AUTHORITATIVE_WHILE AMENDMENT11 CALLERS MOVE TO evidence_snapshot_time" });
  const result = { schema_version:"geox_mcft_cap09_ea5e2_amendment_11_successor_preflight_v2", status: staticBlockers.length ? "FAIL" : "PASS", subject_sha:subject, amendment_11_effective_on_subject:true, historical_amendment_07_preserved:true, active_temporal_authority:"PROVIDER_AVAILABILITY_WATERMARK_V1", kbs_observation_resolution:"hourly", kbs_provider_publication_cadence:"daily_batch", kbs_le_6h_delayed_admission_authority:false, fixed_t_plus_432_authority:false, fixed_7h_scheduler_authority:false, evidence_snapshot_time_external_adapter:true, preboundary_cutoff_remains_logical_t:true, delayed_exact_interval_uses_actual_snapshot:true, rolling_preboundary_capture:rolling, crop_authority_effect:"NONE", crop_profile:crop, static_blockers:staticBlockers, activation_readiness: staticBlockers.length || readinessBlockers.length ? "BLOCKED" : "READY", readiness_blockers:readinessBlockers, protected_main_live_dispatch_authorized:false, database_write_count:0, provider_request_count:0, formal_window_started:false, formal_execution_count:"0/24" };
  fs.writeFileSync(OUT, `${JSON.stringify(result,null,2)}\n`);
  console.log(JSON.stringify(result));
  if (staticBlockers.length) process.exitCode=1;
} catch (error) {
  fs.mkdirSync(path.dirname(OUT), { recursive:true });
  const result={schema_version:"geox_mcft_cap09_ea5e2_amendment_11_successor_preflight_v2",status:"FAIL",error:String(error?.message||error),protected_main_live_dispatch_authorized:false,database_write_count:0,formal_window_started:false};
  fs.writeFileSync(OUT,`${JSON.stringify(result,null,2)}\n`); console.log(JSON.stringify(result)); process.exitCode=1;
}
