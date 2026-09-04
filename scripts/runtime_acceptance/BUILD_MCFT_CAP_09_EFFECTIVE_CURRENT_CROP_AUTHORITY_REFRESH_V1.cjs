#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function fail(code, detail) {
  throw new Error(detail ? `${code}:${detail}` : code);
}
function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function digestBytes(bytes) {
  return "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
}
function digestFile(file) {
  return digestBytes(fs.readFileSync(file));
}
function canonicalIso(value, code) {
  const text = String(value ?? "").trim();
  const ms = Date.parse(text);
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== text) fail(code, text);
  return text;
}
function exactFalse(object, keys, prefix) {
  for (const key of keys) {
    if (object?.[key] !== false) fail(`${prefix}:${key}`);
  }
}

const candidatePath = String(arg("--candidate") ?? "").trim();
const certPath = String(arg("--architecture-effectiveness") ?? "").trim();
const requestPath = String(arg("--refresh-request") ?? "").trim();
const subjectSha = String(arg("--subject") ?? "").trim();
const outPath = String(arg("--out") ?? "").trim();
if (!candidatePath || !certPath || !requestPath || !subjectSha || !outPath) {
  fail("CURRENT_CROP_REFRESH_ARGUMENTS_REQUIRED");
}
if (!/^[0-9a-f]{40}$/.test(subjectSha)) fail("CURRENT_CROP_REFRESH_SUBJECT_SHA_INVALID");

const candidate = readJson(candidatePath);
const cert = readJson(certPath);
const request = readJson(requestPath);

if (
  request.schema_version !== "geox_mcft_cap09_t4r1_current_crop_refresh_request_v1"
  || request.status !== "QUALIFICATION_ONLY_REQUESTED"
) fail("CURRENT_CROP_REFRESH_REQUEST_INVALID");
if (!/^[0-9a-f]{40}$/.test(String(request.protected_main_base_sha ?? ""))) {
  fail("CURRENT_CROP_REFRESH_PROTECTED_MAIN_BASE_INVALID");
}
if (
  candidate.schema_version !== "geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1"
  || candidate.status !== "PASS"
  || candidate.qualification_outcome !== "CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED"
) fail("CURRENT_CROP_REFRESH_CANDIDATE_INVALID");
if (candidate.subject_head_sha !== subjectSha) fail("CURRENT_CROP_REFRESH_SUBJECT_MISMATCH");
if (candidate.architecture_effective !== false || candidate.runtime_consumption_authorized !== false) {
  fail("CURRENT_CROP_REFRESH_INPUT_MUST_BE_UNGRADUATED");
}
if (
  cert.schema_version !== "geox_dt02_biological_stage_authority_effectiveness_v1"
  || cert.amendment_id !== "DT02-AMENDMENT-03"
  || cert.status !== "EFFECTIVE"
  || cert.effective !== true
) fail("CURRENT_CROP_REFRESH_ARCHITECTURE_CERT_INVALID");
if (digestFile(certPath) !== request.architecture_effectiveness?.sha256) {
  fail("CURRENT_CROP_REFRESH_ARCHITECTURE_CERT_DIGEST_MISMATCH");
}
const previousPath = String(request.previous_effective_current_crop_authority?.ref ?? "").trim();
if (!previousPath || !fs.existsSync(previousPath)) fail("CURRENT_CROP_REFRESH_PREVIOUS_AUTHORITY_REQUIRED");
if (digestFile(previousPath) !== request.previous_effective_current_crop_authority?.sha256) {
  fail("CURRENT_CROP_REFRESH_PREVIOUS_AUTHORITY_DIGEST_MISMATCH");
}
if (request.previous_effective_current_crop_authority?.overwrite_forbidden !== true) {
  fail("CURRENT_CROP_REFRESH_PREVIOUS_AUTHORITY_IMMUTABILITY_REQUIRED");
}
if (request.target_artifact?.must_be_immutable !== true || request.target_artifact?.must_not_replace_running_preformal_mount !== true) {
  fail("CURRENT_CROP_REFRESH_TARGET_IMMUTABILITY_REQUIRED");
}
if (
  request.qualification_policy?.architecture_effectiveness_is_persistent_after_effective_merge !== true
  || request.qualification_policy?.rolling_stage_refresh_may_reference_prior_effective_architecture_certificate !== true
  || request.qualification_policy?.production_runtime_host_may_be_github_actions !== false
) fail("CURRENT_CROP_REFRESH_POLICY_INVALID");

const requestAsOf = canonicalIso(
  request.qualification_snapshot?.as_of_logical_time,
  "CURRENT_CROP_REFRESH_REQUEST_STAGE_AS_OF_INVALID",
);
const localBoundary = canonicalIso(
  request.qualification_snapshot?.local_day_complete_boundary_utc,
  "CURRENT_CROP_REFRESH_LOCAL_DAY_BOUNDARY_INVALID",
);
if (requestAsOf !== localBoundary) fail("CURRENT_CROP_REFRESH_STAGE_AS_OF_MUST_EQUAL_LOCAL_DAY_BOUNDARY");
if (request.qualification_snapshot?.future_observations_authorized !== false) {
  fail("CURRENT_CROP_REFRESH_FUTURE_OBSERVATIONS_FORBIDDEN");
}
const qualificationTime = canonicalIso(
  request.qualification_time,
  "CURRENT_CROP_REFRESH_QUALIFICATION_TIME_INVALID",
);
const certIssuedAt = canonicalIso(cert.issued_at, "CURRENT_CROP_REFRESH_CERT_ISSUED_AT_INVALID");
const bio = candidate.biological_stage ?? {};
const candidateAsOf = canonicalIso(bio.authority_as_of, "CURRENT_CROP_REFRESH_CANDIDATE_STAGE_AS_OF_INVALID");
if (candidateAsOf !== requestAsOf) fail("CURRENT_CROP_REFRESH_STAGE_AS_OF_MISMATCH");
if (bio.epistemic_class !== "THERMAL_MODEL_DERIVED" || bio.observed_biological_stage_claimed !== false) {
  fail("CURRENT_CROP_REFRESH_DERIVED_STAGE_SEMANTICS_REQUIRED");
}
if (!bio.resolved_biological_stage) fail("CURRENT_CROP_REFRESH_STAGE_UNRESOLVED");
if (!candidate.crop_water_use_stage) fail("CURRENT_CROP_REFRESH_WATER_USE_STAGE_UNRESOLVED");
const kc = candidate.crop_model_parameter ?? {};
if (
  kc.parameter !== "Kc"
  || kc.stage_code !== candidate.crop_water_use_stage
  || typeof kc.value !== "number"
  || !Number.isFinite(kc.value)
  || kc.production_effective !== false
) fail("CURRENT_CROP_REFRESH_KC_INVALID");
const life = candidate.lifecycle ?? {};
if (
  life.domain_state !== "ACTIVE"
  || life.authority_status !== "RESOLVED"
  || life.authority_validity !== "VALID"
  || life.authority_mode !== "GOVERNED_PERSISTENT_STATE"
  || life.active_consumable_candidate !== true
) fail("CURRENT_CROP_REFRESH_LIFECYCLE_NOT_CONSUMABLE");

const forwardHours = Number(request.forward_stability_hours);
if (!Number.isInteger(forwardHours) || forwardHours <= 0 || forwardHours > 48) {
  fail("CURRENT_CROP_REFRESH_FORWARD_STABILITY_INVALID");
}
if (Number(bio.forward_stability_hours) !== forwardHours) {
  fail("CURRENT_CROP_REFRESH_FORWARD_STABILITY_MISMATCH");
}
const certMs = Date.parse(certIssuedAt);
const stageMs = Date.parse(candidateAsOf);
const qualificationMs = Date.parse(qualificationTime);
const validUntilMs = stageMs + forwardHours * 3_600_000;
if (certMs > stageMs) fail("CURRENT_CROP_REFRESH_ARCHITECTURE_NOT_EFFECTIVE_BY_STAGE_SNAPSHOT");
if (qualificationMs < stageMs) fail("CURRENT_CROP_REFRESH_QUALIFICATION_PRECEDES_STAGE_SNAPSHOT");
if (qualificationMs > validUntilMs) fail("CURRENT_CROP_REFRESH_STAGE_STALE_AT_QUALIFICATION");
const horizon = Date.parse(canonicalIso(life.horizon_end_utc, "CURRENT_CROP_REFRESH_LIFECYCLE_HORIZON_INVALID"));
if (qualificationMs > horizon) fail("CURRENT_CROP_REFRESH_LIFECYCLE_HORIZON_EXPIRED");

const ceilingKeys = [
  "runtime_config_write_authorized",
  "database_write_authorized",
  "scheduler_write_authorized",
  "formal_evidence_write_authorized",
  "production_runtime_start_authorized",
  "production_owner_activation_authorized",
  "formal_v5_authorized",
  "a0_authorized",
  "o00_o23_authorized",
  "mcft_cap09_completed",
];
exactFalse(candidate, ceilingKeys, "CURRENT_CROP_REFRESH_CANDIDATE_AUTHORITY_CEILING_DRIFT");
exactFalse(request.non_effects, [
  ...ceilingKeys,
  "production_runtime_restart_authorized",
], "CURRENT_CROP_REFRESH_REQUEST_AUTHORITY_CEILING_DRIFT");

const out = JSON.parse(JSON.stringify(candidate));
out.architecture_effective = true;
out.runtime_consumption_authorized = true;
out.biological_stage.authority_valid_until = new Date(validUntilMs).toISOString();
out.graduation = {
  status: "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH",
  amendment_id: "DT02-AMENDMENT-03",
  architecture_effectiveness_sha256: digestFile(certPath),
  protected_main_sha: cert.protected_main_sha,
  architecture_effective_since: certIssuedAt,
  graduated_at: qualificationTime,
  refresh_request_sha256: digestFile(requestPath),
  refresh_protected_main_base_sha: request.protected_main_base_sha,
  previous_effective_current_crop_authority_sha256: request.previous_effective_current_crop_authority.sha256,
};
out.refresh = {
  request_id: request.request_id,
  qualification_time: qualificationTime,
  target_artifact_ref: request.target_artifact.ref,
  running_preformal_mount_replaced: false,
  production_runtime_restarted: false,
  formal_v5_authorized: false,
  a0_authorized: false,
  o00_o23_authorized: false,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
process.stdout.write(JSON.stringify({
  status: "PASS",
  subject_head_sha: subjectSha,
  stage: out.biological_stage.resolved_biological_stage,
  stage_authority_as_of: candidateAsOf,
  stage_authority_valid_until: out.biological_stage.authority_valid_until,
  architecture_effective_since: certIssuedAt,
  refresh_qualified_at: qualificationTime,
  runtime_consumption_authorized: true,
  production_runtime_restarted: false,
  formal_v5_authorized: false,
  a0_authorized: false,
  o00_o23_authorized: false
}, null, 2) + "\n");
