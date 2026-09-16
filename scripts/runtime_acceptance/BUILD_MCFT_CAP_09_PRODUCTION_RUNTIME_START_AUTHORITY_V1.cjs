#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../..");
const DEFAULT_ARM = path.join(
  ROOT,
  "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_RUNTIME_START_ARM_V1.json",
);
const PRE_RUNTIME_READY_PROOF_REL =
  "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_NON_GITHUB_HOST_BINDING_ARM_V1.json";
const PRE_RUNTIME_READY_CANONICAL_MAIN =
  "f9cdeb4eddb1801a339149a592ee41f9cf120257";
const PRE_RUNTIME_READY_HOST_PROOF_SUBJECT =
  "d1db5463d1363eb5f9efacc13425b75a7c8b7ee8";
const CANONICAL_HOST_ID = "fae5f756-ef25-40d5-9777-5b2c3d4837a1";
const NON_OWNER_STANDBY = "NON_OWNER_STANDBY";
const OWNER_CUTOVER = "OWNER_CUTOVER";
const OWNER_CUTOVER_ACTIVATION_STEP = "POST_EFFECTIVENESS_DUAL_KEY_LOCAL_OWNER_CUTOVER";
const MAX_ADJUDICATION_CLOCK_SKEW_MS = 5 * 60_000;
const EFFECTIVE_CURRENT_CROP_GRADUATION_STATUSES = new Set([
  "EFFECTIVE_FOR_RUNTIME_CONSUMPTION",
  "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH",
]);

function req(ok, code) {
  if (!ok) throw new Error(code);
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function sha256(file) {
  return "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function exactIso(value, code) {
  req(typeof value === "string" && value.length > 0, code);
  const ms = Date.parse(value);
  req(Number.isFinite(ms) && new Date(ms).toISOString() === value, code);
  return value;
}
function exactHour(value, code) {
  const text = exactIso(value, code);
  req(text.endsWith(":00:00.000Z"), code);
  return text;
}
function exactSha(value, code) {
  req(typeof value === "string" && /^[0-9a-f]{40}$/.test(value), code);
  return value;
}
function digest(value, code) {
  req(typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value), code);
  return value;
}
function text(value, code) {
  req(typeof value === "string" && value.trim().length > 0, code);
  return value.trim();
}
function repoRef(value, expectedDigest, code) {
  const ref = text(value, code + "_REF_REQUIRED").replaceAll("\\", "/");
  req(!path.posix.isAbsolute(ref) && !ref.startsWith("../") && !ref.includes("/../"), code + "_REF_MUST_BE_REPOSITORY_RELATIVE");
  const resolved = path.resolve(ROOT, ref);
  const relative = path.relative(ROOT, resolved);
  req(relative !== "" && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative), code + "_REF_ESCAPES_REPOSITORY");
  req(fs.existsSync(resolved) && fs.statSync(resolved).isFile(), code + "_REF_FILE_REQUIRED");
  const observed = sha256(resolved);
  req(observed === text(expectedDigest, code + "_SHA256_REQUIRED"), code + "_SHA256_MISMATCH");
  return { ref, sha256: observed, resolved };
}
function fixedRepoRef(ref) {
  const resolved = path.resolve(ROOT, ref);
  req(resolved.startsWith(ROOT + path.sep), "RUNTIME_START_PRE_READY_PROOF_REF_ESCAPES_REPOSITORY");
  req(fs.existsSync(resolved) && fs.statSync(resolved).isFile(), "RUNTIME_START_PRE_READY_PROOF_FILE_REQUIRED");
  return { ref, resolved, sha256: sha256(resolved) };
}
function sameArray(left, right) {
  return Array.isArray(left)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function validatePreRuntimeStartReadyProof() {
  const proofRef = fixedRepoRef(PRE_RUNTIME_READY_PROOF_REL);
  const arm = readJson(proofRef.resolved);
  const proof = arm.local_machine_proof_evidence ?? {};

  req(arm.schema_version === "geox_mcft_cap09_production_non_github_host_binding_arm_v1", "RUNTIME_START_PRE_READY_PROOF_SCHEMA_REQUIRED");
  req(arm.armed === false, "RUNTIME_START_PRE_READY_PROOF_HOST_ARM_MUST_REMAIN_FALSE");
  req(arm.runtime_process_start_authorized === false, "RUNTIME_START_PRE_READY_PROOF_RUNTIME_START_MUST_REMAIN_FALSE");
  req(arm.production_owner_activation_authorized === false, "RUNTIME_START_PRE_READY_PROOF_OWNER_MUST_REMAIN_FALSE");
  req(arm.formal_v5_arm_authorized === false && arm.a0_authorized === false && arm.o00_authorized === false, "RUNTIME_START_PRE_READY_PROOF_LATER_AUTHORITY_MUST_REMAIN_FALSE");
  req(arm.runtime_secret_binding_target_host_id === CANONICAL_HOST_ID, "RUNTIME_START_PRE_READY_PROOF_HOST_BINDING_MISMATCH");

  req(proof.schema_version === "geox_mcft_cap09_production_host_secret_binding_pre_owner_readiness_v1", "RUNTIME_START_PRE_READY_LOCAL_PROOF_SCHEMA_REQUIRED");
  req(proof.status === "PASS", "RUNTIME_START_PRE_READY_LOCAL_PROOF_PASS_REQUIRED");
  req(proof.stage === "PRODUCTION_HOST_SECRET_BINDING_PROVEN_PRE_OWNER_CUTOVER_READY", "RUNTIME_START_PRE_READY_LOCAL_PROOF_STAGE_REQUIRED");
  req(proof.observed_subject_sha === PRE_RUNTIME_READY_HOST_PROOF_SUBJECT, "RUNTIME_START_PRE_READY_LOCAL_PROOF_SUBJECT_MISMATCH");
  req(proof.local_host_id === CANONICAL_HOST_ID, "RUNTIME_START_PRE_READY_LOCAL_PROOF_HOST_MISMATCH");
  req(proof.exact_two_runtime_service_identities_bound === true, "RUNTIME_START_PRE_READY_LOCAL_PROOF_TWO_IDENTITIES_REQUIRED");
  req(proof.runtime_secret_binding_count === 7, "RUNTIME_START_PRE_READY_LOCAL_PROOF_SECRET_COUNT_REQUIRED");
  req(proof.repository_secret_materialized === false && proof.github_secret_materialized === false, "RUNTIME_START_PRE_READY_LOCAL_PROOF_SECRET_PERSISTENCE_FORBIDDEN");
  req(proof.evidence_database_connectivity_proven === true && proof.twin_database_connectivity_proven === true, "RUNTIME_START_PRE_READY_LOCAL_PROOF_DB_CONNECTIVITY_REQUIRED");
  req(proof.exact_one_privilege_membership_each_proven_by_current_credentials === true, "RUNTIME_START_PRE_READY_LOCAL_PROOF_EXACT_MEMBERSHIP_REQUIRED");
  req(proof.cross_plane_privilege_forbidden_proven === true, "RUNTIME_START_PRE_READY_LOCAL_PROOF_CROSS_PLANE_REQUIRED");
  req(proof.r2_bucket === "geox-mcft-cap09-evidence-runtime-v1" && proof.r2_formal_bucket_reused === false, "RUNTIME_START_PRE_READY_LOCAL_PROOF_R2_SEPARATION_REQUIRED");
  req(proof.r2_put_status === 200 && proof.r2_head_status === 200 && proof.r2_delete_status === 204 && proof.r2_post_delete_head_status === 404, "RUNTIME_START_PRE_READY_LOCAL_PROOF_R2_CAPABILITY_REQUIRED");
  req(proof.compose_render_only_pass === true, "RUNTIME_START_PRE_READY_LOCAL_PROOF_COMPOSE_RENDER_REQUIRED");
  req(proof.production_container_count_before === 0 && proof.production_container_count_after === 0, "RUNTIME_START_PRE_READY_LOCAL_PROOF_ZERO_CONTAINER_REQUIRED");
  req(proof.pre_owner_cutover_ready === true, "RUNTIME_START_PRE_READY_LOCAL_PROOF_READY_REQUIRED");
  req(sameArray(proof.remaining_blockers, ["PRODUCTION_RUNTIME_START_AUTHORITY_NOT_ARMED"]), "RUNTIME_START_PRE_READY_LOCAL_PROOF_EXACT_BLOCKER_REQUIRED");
  for (const key of [
    "database_write", "compose_build", "compose_create", "compose_up",
    "runtime_process_start", "production_owner_activation", "formal_v5_arm",
    "a0_bootstrap", "o00_started", "secret_values_recorded",
  ]) {
    req(proofZ”ECB1‰S8‚