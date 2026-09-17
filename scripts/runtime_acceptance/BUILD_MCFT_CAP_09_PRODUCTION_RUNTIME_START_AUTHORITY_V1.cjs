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
const NON_OWNER_ACTIVATION_STEP = "PRE_RUNTIME_START_READY_NON_OWNER_STANDBY";
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
  const textValue = exactIso(value, code);
  req(textValue.endsWith(":00:00.000Z"), code);
  return textValue;
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
  req(
    !path.posix.isAbsolute(ref) && !ref.startsWith("../") && !ref.includes("/../"),
    code + "_REF_MUST_BE_REPOSITORY_RELATIVE",
  );
  const resolved = path.resolve(ROOT, ref);
  const relative = path.relative(ROOT, resolved);
  req(
    relative !== "" && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative),
    code + "_REF_ESCAPES_REPOSITORY",
  );
  req(fs.existsSync(resolved) && fs.statSync(resolved).isFile(), code + "_REF_FILE_REQUIRED");
  const observed = sha256(resolved);
  req(
    observed === text(expectedDigest, code + "_SHA256_REQUIRED"),
    code + "_SHA256_MISMATCH",
  );
  return { ref, sha256: observed, resolved };
}
function fixedRepoRef(ref) {
  const resolved = path.resolve(ROOT, ref);
  req(
    resolved.startsWith(ROOT + path.sep),
    "RUNTIME_START_PRE_READY_PROOF_REF_ESCAPES_REPOSITORY",
  );
  req(
    fs.existsSync(resolved) && fs.statSync(resolved).isFile(),
    "RUNTIME_START_PRE_READY_PROOF_FILE_REQUIRED",
  );
  return { ref, resolved, sha256: sha256(resolved) };
}
function sameArray(left, right) {
  return Array.isArray(left)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}
function gitHead() {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
}
function requireAncestor(ancestor, descendant, code) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
      cwd: ROOT,
      stdio: "ignore",
    });
  } catch {
    throw new Error(code);
  }
}

function validatePreRuntimeStartReadyProof(observedHead) {
  requireAncestor(
    PRE_RUNTIME_READY_CANONICAL_MAIN,
    observedHead,
    "RUNTIME_START_PRE_READY_CANONICAL_MAIN_NOT_ANCESTOR",
  );
  const proofRef = fixedRepoRef(PRE_RUNTIME_READY_PROOF_REL);
  const arm = readJson(proofRef.resolved);
  const proof = arm.local_machine_proof_evidence ?? {};

  req(
    arm.schema_version === "geox_mcft_cap09_production_non_github_host_binding_arm_v1",
    "RUNTIME_START_PRE_READY_PROOF_SCHEMA_REQUIRED",
  );
  req(arm.armed === false, "RUNTIME_START_PRE_READY_PROOF_HOST_ARM_MUST_REMAIN_FALSE");
  req(
    arm.runtime_process_start_authorized === false,
    "RUNTIME_START_PRE_READY_PROOF_RUNTIME_START_MUST_REMAIN_FALSE",
  );
  req(
    arm.production_owner_activation_authorized === false,
    "RUNTIME_START_PRE_READY_PROOF_OWNER_MUST_REMAIN_FALSE",
  );
  req(
    arm.formal_v5_arm_authorized === false
      && arm.a0_authorized === false
      && arm.o00_authorized === false,
    "RUNTIME_START_PRE_READY_PROOF_LATER_AUTHORITY_MUST_REMAIN_FALSE",
  );
  req(
    arm.runtime_secret_binding_target_host_id === CANONICAL_HOST_ID,
    "RUNTIME_START_PRE_READY_PROOF_HOST_BINDING_MISMATCH",
  );

  req(
    proof.schema_version === "geox_mcft_cap09_production_host_secret_binding_pre_owner_readiness_v1",
    "RUNTIME_START_PRE_READY_LOCAL_PROOF_SCHEMA_REQUIRED",
  );
  req(proof.status === "PASS", "RUNTIME_START_PRE_READY_LOCAL_PROOF_PASS_REQUIRED");
  req(
    proof.stage === "PRODUCTION_HOST_SECRET_BINDING_PROVEN_PRE_OWNER_CUTOVER_READY",
    "RUNTIME_START_PRE_READY_LOCAL_PROOF_STAGE_REQUIRED",
  );
  req(
    proof.observed_subject_sha === PRE_RUNTIME_READY_HOST_PROOF_SUBJECT,
    "RUNTIME_START_PRE_READY_LOCAL_PROOF_SUBJECT_MISMATCH",
  );
  req(
    proof.local_host_id === CANONICAL_HOST_ID,
    "RUNTIME_START_PRE_READY_LOCAL_PROOF_HOST_MISMATCH",
  );
  req(
    proof.exact_two_runtime_service_identities_bound === true,
    "RUNTIME_START_PRE_READY_LOCAL_PROOF_TWO_IDENTITIES_REQUIRED",
  );
  req(
    proof.runtime_secret_binding_count === 7,
    "RUNTIME_START_PRE_READY_LOCAL_PROOF_SECRET_COUNT_REQUIRED",
  );
  req(
    proof.repository_secret_materialized === false
      && proof.github_secret_materialized === false,
    "RUNTIME_START_PRE_READY_LOCAL_PROOF_SECRET_PERSISTENCE_FORBIDDEN",
  );
  req(
    proof.evidence_database_connectivity_proven === true
      && proof.twin_database_connectivity_proven === true,
    "RUNTIME_START_PRE_READY_LOCAL_PROOF_DB_CONNECTIVITY_REQUIRED",
  );
  req(
    proof.exact_one_privilege_membership_each_proven_by_current_credentials === true,
    "RUNTIME_START_PRE_READY_LOCAL_PROOF_EXACT_MEMBERSHIP_REQUIRED",
  );
  req(
    proof.cross_plane_privilege_forbidden_proven === true,
    "RUNTIME_START_PRE_READY_LOCAL_PROOF_CROSS_PLANE_REQUIRED",
  );
  req(
    proof.r2_bucket === "geox-mcft-cap09-evidence-runtime-v1"
      && proof.r2_formal_bucket_reused === false,
    "RUNTIME_START_PRE_READY_LOCAL_PROOF_R2_SEPARATION_REQUIRED",
  );
  req(
    proof.r2_put_status === 200
      && proof.r2_head_status === 200
      && proof.r2_delete_status === 204
      && proof.r2_post_delete_head_status === 404,
    "RUNTIME_START_PRE_READY_LOCAL_PROOF_R2_CAPABILITY_REQUIRED",
  );
  req(
    proof.compose_render_only_pass === true,
    "RUNTIME_START_PRE_READY_LOCAL_PROOF_COMPOSE_RENDER_REQUIRED",
  );
  req(
    proof.production_container_count_before === 0
      && proof.production_container_count_after === 0,
    "RUNTIME_START_PRE_READY_LOCAL_PROOF_ZERO_CONTAINER_REQUIRED",
  );
  req(
    proof.pre_owner_cutover_ready === true,
    "RUNTIME_START_PRE_READY_LOCAL_PROOF_READY_REQUIRED",
  );
  req(
    sameArray(proof.remaining_blockers, ["PRODUCTION_RUNTIME_START_AUTHORITY_NOT_ARMED"]),
    "RUNTIME_START_PRE_READY_LOCAL_PROOF_EXACT_BLOCKER_REQUIRED",
  );
  for (const key of [
    "database_write",
    "compose_build",
    "compose_create",
    "compose_up",
    "runtime_process_start",
    "production_owner_activation",
    "formal_v5_arm",
    "a0_bootstrap",
    "o00_started",
    "secret_values_recorded",
  ]) {
    req(
      proof[key] === false,
      "RUNTIME_START_PRE_READY_LOCAL_PROOF_FORBIDDEN_EFFECT:" + key,
    );
  }

  return {
    ref: proofRef.ref,
    sha256: proofRef.sha256,
    canonical_main_sha: PRE_RUNTIME_READY_CANONICAL_MAIN,
    host_proof_subject_sha: PRE_RUNTIME_READY_HOST_PROOF_SUBJECT,
    host_id: CANONICAL_HOST_ID,
  };
}

function validateEffectiveStageAuthorities(
  currentCropRef,
  stageArchitectureRef,
  scope,
  formalA0,
  adjudicationTime,
) {
  const currentCrop = readJson(currentCropRef.resolved);
  req(
    currentCrop.schema_version === "geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1"
      && currentCrop.status === "PASS"
      && currentCrop.qualification_outcome === "CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED",
    "RUNTIME_START_CURRENT_CROP_AUTHORITY_SCHEMA_STATUS_REQUIRED",
  );
  req(
    currentCrop.architecture_effective === true
      && currentCrop.runtime_consumption_authorized === true,
    "RUNTIME_START_CURRENT_CROP_AUTHORITY_NOT_EFFECTIVE",
  );
  for (const key of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"]) {
    req(
      text(currentCrop.scope?.[key], "RUNTIME_START_CURRENT_CROP_SCOPE_REQUIRED:" + key)
        === scope[key],
      "RUNTIME_START_CURRENT_CROP_SCOPE_MISMATCH:" + key,
    );
  }

  const life = currentCrop.lifecycle ?? {};
  req(
    life.domain_state === "ACTIVE"
      && life.authority_status === "RESOLVED"
      && life.authority_validity === "VALID"
      && life.authority_mode === "GOVERNED_PERSISTENT_STATE"
      && life.active_consumable_candidate === true,
    "RUNTIME_START_CURRENT_CROP_LIFECYCLE_NOT_CONSUMABLE",
  );
  const lifecycleHorizon = exactIso(
    life.horizon_end_utc,
    "RUNTIME_START_CURRENT_CROP_LIFECYCLE_HORIZON_REQUIRED",
  );
  req(
    Date.parse(formalA0) <= Date.parse(lifecycleHorizon),
    "RUNTIME_START_CURRENT_CROP_LIFECYCLE_HORIZON_EXPIRED",
  );

  const biological = currentCrop.biological_stage ?? {};
  const biologicalStage = text(
    biological.resolved_biological_stage,
    "RUNTIME_START_CURRENT_CROP_BIOLOGICAL_STAGE_REQUIRED",
  );
  if (biological.epistemic_class !== "DIRECT_OBSERVED_PHENOLOGY") {
    req(
      biological.observed_biological_stage_claimed === false,
      "RUNTIME_START_CURRENT_CROP_DERIVED_OBSERVED_CLAIM_FORBIDDEN",
    );
  }
  const stageAsOf = exactHour(
    biological.authority_as_of,
    "RUNTIME_START_CURRENT_CROP_STAGE_AUTHORITY_AS_OF_REQUIRED",
  );
  const forwardHours = Number(biological.forward_stability_hours);
  req(
    Number.isInteger(forwardHours) && forwardHours > 0 && forwardHours <= 48,
    "RUNTIME_START_CURRENT_CROP_FORWARD_STABILITY_INVALID",
  );
  const computedStageValidUntil =
    new Date(Date.parse(stageAsOf) + forwardHours * 3_600_000).toISOString();
  const stageValidUntil = biological.authority_valid_until === undefined
    ? computedStageValidUntil
    : exactIso(
      biological.authority_valid_until,
      "RUNTIME_START_CURRENT_CROP_STAGE_AUTHORITY_VALID_UNTIL_REQUIRED",
    );
  req(
    stageValidUntil === computedStageValidUntil,
    "RUNTIME_START_CURRENT_CROP_STAGE_AUTHORITY_VALID_UNTIL_MISMATCH",
  );
  req(
    Date.parse(formalA0) >= Date.parse(stageAsOf),
    "RUNTIME_START_CURRENT_CROP_FUTURE_STAGE_EVIDENCE_FORBIDDEN",
  );
  req(
    Date.parse(formalA0) <= Date.parse(stageValidUntil),
    "RUNTIME_START_CURRENT_CROP_STAGE_AUTHORITY_STALE_AT_A0",
  );
  req(
    Date.parse(adjudicationTime) + MAX_ADJUDICATION_CLOCK_SKEW_MS >= Date.parse(stageAsOf),
    "RUNTIME_START_CURRENT_CROP_STAGE_AUTHORITY_FUTURE_AT_ADJUDICATION",
  );
  req(
    Date.parse(adjudicationTime) <= Date.parse(stageValidUntil),
    "RUNTIME_START_CURRENT_CROP_STAGE_AUTHORITY_STALE_AT_ADJUDICATION",
  );

  const waterUseStage = text(
    currentCrop.crop_water_use_stage,
    "RUNTIME_START_CURRENT_CROP_WATER_USE_STAGE_REQUIRED",
  );
  const kc = currentCrop.crop_model_parameter ?? {};
  req(
    kc.parameter === "Kc"
      && kc.stage_code === waterUseStage
      && typeof kc.value === "number"
      && Number.isFinite(kc.value)
      && kc.production_effective === false,
    "RUNTIME_START_CURRENT_CROP_KC_AUTHORITY_INVALID",
  );

  const stageArchitecture = readJson(stageArchitectureRef.resolved);
  req(
    stageArchitecture.schema_version === "geox_dt02_biological_stage_authority_effectiveness_v1"
      && stageArchitecture.amendment_id === "DT02-AMENDMENT-03"
      && stageArchitecture.status === "EFFECTIVE"
      && stageArchitecture.effective === true,
    "RUNTIME_START_BIOLOGICAL_STAGE_ARCHITECTURE_NOT_EFFECTIVE",
  );
  const protectedMain = exactSha(
    stageArchitecture.protected_main_sha,
    "RUNTIME_START_BIOLOGICAL_STAGE_PROTECTED_MAIN_SHA_REQUIRED",
  );
  const certificateIssuedAt = exactIso(
    stageArchitecture.issued_at,
    "RUNTIME_START_BIOLOGICAL_STAGE_CERTIFICATE_ISSUED_AT_REQUIRED",
  );
  req(
    Date.parse(certificateIssuedAt) <= Date.parse(formalA0),
    "RUNTIME_START_BIOLOGICAL_STAGE_CERTIFICATE_FROM_FUTURE",
  );
  for (const key of [
    "runtime_start_authorized",
    "production_owner_activation_authorized",
    "formal_v5_authorized",
    "a0_authorized",
    "o00_o23_authorized",
  ]) {
    req(
      stageArchitecture[key] === false,
      "RUNTIME_START_BIOLOGICAL_STAGE_CERTIFICATE_AUTHORITY_CEILING_DRIFT:" + key,
    );
  }

  const graduation = currentCrop.graduation ?? {};
  req(
    EFFECTIVE_CURRENT_CROP_GRADUATION_STATUSES.has(graduation.status)
      && graduation.amendment_id === "DT02-AMENDMENT-03",
    "RUNTIME_START_CURRENT_CROP_GRADUATION_REQUIRED",
  );
  req(
    graduation.architecture_effectiveness_sha256 === stageArchitectureRef.sha256,
    "RUNTIME_START_CURRENT_CROP_ARCHITECTURE_CERTIFICATE_DIGEST_MISMATCH",
  );
  req(
    graduation.protected_main_sha === protectedMain,
    "RUNTIME_START_CURRENT_CROP_PROTECTED_MAIN_MISMATCH",
  );
  if (graduation.status === "EFFECTIVE_FOR_RUNTIME_CONSUMPTION") {
    req(
      graduation.graduated_at === stageArchitecture.issued_at,
      "RUNTIME_START_CURRENT_CROP_GRADUATION_TIME_MISMATCH",
    );
  } else {
    const architectureEffectiveSince = exactIso(
      graduation.architecture_effective_since,
      "RUNTIME_START_CURRENT_CROP_ARCHITECTURE_EFFECTIVE_SINCE_REQUIRED",
    );
    req(
      architectureEffectiveSince === certificateIssuedAt,
      "RUNTIME_START_CURRENT_CROP_ARCHITECTURE_EFFECTIVE_SINCE_MISMATCH",
    );
    const graduatedAt = exactIso(
      graduation.graduated_at,
      "RUNTIME_START_CURRENT_CROP_REFRESH_GRADUATION_TIME_REQUIRED",
    );
    const refreshQualificationTime = exactIso(
      currentCrop.refresh?.qualification_time,
      "RUNTIME_START_CURRENT_CROP_REFRESH_QUALIFICATION_TIME_REQUIRED",
    );
    req(
      graduatedAt === refreshQualificationTime,
      "RUNTIME_START_CURRENT_CROP_REFRESH_GRADUATION_TIME_MISMATCH",
    );
    req(
      Date.parse(graduatedAt) >= Date.parse(stageAsOf),
      "RUNTIME_START_CURRENT_CROP_REFRESH_GRADUATION_PRECEDES_STAGE_AUTHORITY",
    );
    req(
      Date.parse(graduatedAt) <= Date.parse(stageValidUntil),
      "RUNTIME_START_CURRENT_CROP_REFRESH_GRADUATION_AFTER_STAGE_VALIDITY",
    );
  }

  return {
    biological_stage: biologicalStage,
    crop_water_use_stage: waterUseStage,
    kc: kc.value,
    stage_authority_as_of: stageAsOf,
    stage_authority_valid_until: stageValidUntil,
    lifecycle_horizon_end_utc: lifecycleHorizon,
    protected_main_sha: protectedMain,
  };
}

function parseArgs(argv) {
  const out = { arm: DEFAULT_ARM, output: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--arm") out.arm = path.resolve(ROOT, argv[++i]);
    else if (argv[i] === "--out") out.output = path.resolve(ROOT, argv[++i]);
    else throw new Error("RUNTIME_START_BUILDER_ARGUMENT_UNSUPPORTED:" + argv[i]);
  }
  return out;
}
function runtimeModeFromArm(arm) {
  const activationStep = text(
    arm.activation_step,
    "RUNTIME_START_ACTIVATION_STEP_REQUIRED",
  );
  if (
    arm.runtime_mode === undefined
    && activationStep === OWNER_CUTOVER_ACTIVATION_STEP
  ) {
    return OWNER_CUTOVER;
  }
  const runtimeMode = text(arm.runtime_mode, "RUNTIME_START_RUNTIME_MODE_REQUIRED");
  req(
    runtimeMode === NON_OWNER_STANDBY || runtimeMode === OWNER_CUTOVER,
    "RUNTIME_START_RUNTIME_MODE_INVALID",
  );
  if (runtimeMode === NON_OWNER_STANDBY) {
    req(
      activationStep === NON_OWNER_ACTIVATION_STEP,
      "RUNTIME_START_NON_OWNER_ACTIVATION_STEP_REQUIRED",
    );
  }
  if (runtimeMode === OWNER_CUTOVER) {
    req(
      activationStep === OWNER_CUTOVER_ACTIVATION_STEP,
      "RUNTIME_START_OWNER_CUTOVER_ACTIVATION_STEP_REQUIRED",
    );
  }
  return runtimeMode;
}
function build(arm, observedHead, adjudicationTime) {
  req(
    arm.schema_version === "geox_mcft_cap09_production_runtime_start_arm_v1",
    "RUNTIME_START_ARM_SCHEMA_REQUIRED",
  );
  req(arm.armed === true, "RUNTIME_START_ARM_NOT_ARMED");
  req(arm.execution_requested === true, "RUNTIME_START_EXECUTION_REQUEST_REQUIRED");
  const subject = exactSha(
    arm.exact_deployment_subject_sha,
    "RUNTIME_START_EXACT_DEPLOYMENT_SUBJECT_REQUIRED",
  );
  req(subject === observedHead, "RUNTIME_START_EXACT_DEPLOYMENT_SUBJECT_MISMATCH");

  const runtimeMode = runtimeModeFromArm(arm);
  const preReady = validatePreRuntimeStartReadyProof(observedHead);

  const live = repoRef(
    arm.live_activation_authority_ref,
    arm.live_activation_authority_sha256,
    "RUNTIME_START_LIVE_ACTIVATION_AUTHORITY",
  );
  const a0 = repoRef(
    arm.formal_a0_authority_ref,
    arm.formal_a0_authority_sha256,
    "RUNTIME_START_FORMAL_A0_AUTHORITY",
  );
  const currentCrop = repoRef(
    arm.current_crop_authority_ref,
    arm.current_crop_authority_sha256,
    "RUNTIME_START_CURRENT_CROP_AUTHORITY",
  );
  const stageArchitecture = repoRef(
    arm.biological_stage_architecture_effectiveness_ref,
    arm.biological_stage_architecture_effectiveness_sha256,
    "RUNTIME_START_BIOLOGICAL_STAGE_ARCHITECTURE_EFFECTIVENESS",
  );

  const scope = {};
  for (const key of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"]) {
    scope[key] = text(arm.scope?.[key], "RUNTIME_START_SCOPE_REQUIRED:" + key);
  }

  const activationFence = exactIso(
    arm.activation_fence_time,
    "RUNTIME_START_ACTIVATION_FENCE_REQUIRED",
  );
  const adjudicationMs = Date.parse(adjudicationTime);
  req(
    Math.abs(Date.parse(activationFence) - adjudicationMs) <= MAX_ADJUDICATION_CLOCK_SKEW_MS,
    "RUNTIME_START_ACTIVATION_FENCE_ADJUDICATION_CLOCK_SKEW_EXCEEDED",
  );
  const formalA0 = exactHour(
    arm.formal_a0_logical_time,
    "RUNTIME_START_FORMAL_A0_REQUIRED",
  );
  req(
    Date.parse(activationFence) < Date.parse(formalA0),
    "RUNTIME_START_FENCE_MUST_PRECEDE_A0",
  );

  const stageValidation = validateEffectiveStageAuthorities(
    currentCrop,
    stageArchitecture,
    scope,
    formalA0,
    adjudicationTime,
  );

  req(
    arm.runtime_process_start_authorized === true,
    "RUNTIME_START_PROCESS_START_MUST_BE_AUTHORIZED",
  );
  req(
    arm.evidence_runtime_start_authorized === true,
    "RUNTIME_START_EVIDENCE_START_MUST_BE_AUTHORIZED",
  );
  req(
    arm.twin_runtime_start_authorized === true,
    "RUNTIME_START_TWIN_START_MUST_BE_AUTHORIZED",
  );
  for (const key of [
    "production_owner_activation_authorized",
    "formal_v5_arm_authorized",
    "a0_authorized",
    "o00_authorized",
  ]) {
    req(
      arm[key] === false,
      "RUNTIME_START_LATER_AUTHORITY_MUST_REMAIN_FALSE:" + key,
    );
  }

  return {
    schema_version: "geox_mcft_cap09_production_runtime_start_authority_instance_v1",
    authority_id: "GEOX-MCFT-CAP-09-PRODUCTION-RUNTIME-START-AUTHORITY-INSTANCE-V1",
    status: "AUTHORIZED",
    armed: true,
    authority_class: "MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY",
    authority_ref: text(arm.authority_ref, "RUNTIME_START_AUTHORITY_REF_REQUIRED"),
    deployment_subject_sha: subject,
    scope,
    activation_fence_time: activationFence,
    formal_a0_authority_ref: a0.ref,
    formal_a0_authority_sha256: a0.sha256,
    live_activation_authority_ref: live.ref,
    live_activation_authority_sha256: live.sha256,
    current_crop_authority_ref: currentCrop.ref,
    current_crop_authority_sha256: currentCrop.sha256,
    biological_stage_architecture_effectiveness_ref: stageArchitecture.ref,
    biological_stage_architecture_effectiveness_sha256: stageArchitecture.sha256,
    formal_a0_logical_time: formalA0,
    runtime_mode: runtimeMode,
    current_crop_authority_as_of: stageValidation.stage_authority_as_of,
    current_crop_authority_valid_until: stageValidation.stage_authority_valid_until,
    pre_runtime_start_ready_proof_ref: preReady.ref,
    pre_runtime_start_ready_proof_sha256: preReady.sha256,
    pre_runtime_start_ready_canonical_protected_main_sha: preReady.canonical_main_sha,
    host_proof_subject_sha: preReady.host_proof_subject_sha,
    host_id: preReady.host_id,
    biological_stage: stageValidation.biological_stage,
    crop_water_use_stage: stageValidation.crop_water_use_stage,
    kc: stageValidation.kc,
    stage_authority_as_of: stageValidation.stage_authority_as_of,
    stage_authority_valid_until: stageValidation.stage_authority_valid_until,
    lifecycle_horizon_end_utc: stageValidation.lifecycle_horizon_end_utc,
    biological_stage_protected_main_sha: stageValidation.protected_main_sha,
    runtime_process_start_authorized: true,
    evidence_runtime_start_authorized: true,
    twin_runtime_start_authorized: true,
    production_owner_activation_authorized: false,
    formal_v5_arm_authorized: false,
    a0_authorized: false,
    o00_authorized: false,
  };
}

try {
  const args = parseArgs(process.argv);
  req(args.output, "RUNTIME_START_AUTHORITY_OUTPUT_PATH_REQUIRED");
  const arm = readJson(args.arm);
  const adjudicationTime = new Date().toISOString();
  const result = build(arm, gitHead(), adjudicationTime);
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, JSON.stringify(result, null, 2) + "\n");
  process.stdout.write(JSON.stringify({
    status: "PASS",
    output_path: path.relative(ROOT, args.output).replaceAll("\\", "/"),
    deployment_subject_sha: result.deployment_subject_sha,
    runtime_mode: result.runtime_mode,
    scope: result.scope,
    activation_fence_time: result.activation_fence_time,
    formal_a0_logical_time: result.formal_a0_logical_time,
    current_crop_authority_ref: result.current_crop_authority_ref,
    current_crop_authority_sha256: result.current_crop_authority_sha256,
    current_crop_authority_as_of: result.current_crop_authority_as_of,
    current_crop_authority_valid_until: result.current_crop_authority_valid_until,
    pre_runtime_start_ready_proof_ref: result.pre_runtime_start_ready_proof_ref,
    pre_runtime_start_ready_proof_sha256: result.pre_runtime_start_ready_proof_sha256,
    pre_runtime_start_ready_canonical_protected_main_sha:
      result.pre_runtime_start_ready_canonical_protected_main_sha,
    host_proof_subject_sha: result.host_proof_subject_sha,
    host_id: result.host_id,
    production_owner_activation_authorized: false,
    formal_v5_arm_authorized: false,
    a0_authorized: false,
    o00_authorized: false,
  }, null, 2) + "\n");
} catch (error) {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + "\n");
  process.exitCode = 1;
}
