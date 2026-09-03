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
function text(value, code) {
  req(typeof value === "string" && value.trim().length > 0, code);
  return value.trim();
}
function repoRef(value, digest, code) {
  const ref = text(value, code + "_REF_REQUIRED").replaceAll("\\", "/");
  req(!path.posix.isAbsolute(ref) && !ref.startsWith("../") && !ref.includes("/../"), code + "_REF_MUST_BE_REPOSITORY_RELATIVE");
  const resolved = path.resolve(ROOT, ref);
  const relative = path.relative(ROOT, resolved);
  req(relative !== "" && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative), code + "_REF_ESCAPES_REPOSITORY");
  req(fs.existsSync(resolved) && fs.statSync(resolved).isFile(), code + "_REF_FILE_REQUIRED");
  const observed = sha256(resolved);
  req(observed === text(digest, code + "_SHA256_REQUIRED"), code + "_SHA256_MISMATCH");
  return { ref, sha256: observed, resolved };
}

function validateEffectiveStageAuthorities(currentCropRef, stageArchitectureRef, scope, formalA0) {
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
  for (const key of ["tenant_id","project_id","group_id","field_id","season_id","zone_id"]) {
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
  text(
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
  req(
    Date.parse(formalA0) >= Date.parse(stageAsOf),
    "RUNTIME_START_CURRENT_CROP_FUTURE_STAGE_EVIDENCE_FORBIDDEN",
  );
  req(
    Date.parse(formalA0) <= Date.parse(stageAsOf) + forwardHours * 3_600_000,
    "RUNTIME_START_CURRENT_CROP_STAGE_AUTHORITY_STALE_AT_A0",
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
  exactSha(
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
    graduation.status === "EFFECTIVE_FOR_RUNTIME_CONSUMPTION"
      && graduation.amendment_id === "DT02-AMENDMENT-03",
    "RUNTIME_START_CURRENT_CROP_GRADUATION_REQUIRED",
  );
  req(
    graduation.architecture_effectiveness_sha256 === stageArchitectureRef.sha256,
    "RUNTIME_START_CURRENT_CROP_ARCHITECTURE_CERTIFICATE_DIGEST_MISMATCH",
  );
  req(
    graduation.protected_main_sha === stageArchitecture.protected_main_sha,
    "RUNTIME_START_CURRENT_CROP_PROTECTED_MAIN_MISMATCH",
  );
  req(
    graduation.graduated_at === stageArchitecture.issued_at,
    "RUNTIME_START_CURRENT_CROP_GRADUATION_TIME_MISMATCH",
  );

  return {
    biological_stage: biological.resolved_biological_stage,
    crop_water_use_stage: waterUseStage,
    kc: kc.value,
    stage_authority_as_of: stageAsOf,
    stage_authority_valid_until:
      new Date(Date.parse(stageAsOf) + forwardHours * 3_600_000).toISOString(),
    lifecycle_horizon_end_utc: lifecycleHorizon,
    protected_main_sha: stageArchitecture.protected_main_sha,
  };
}
function gitHead() {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
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
function build(arm, observedHead) {
  req(arm.schema_version === "geox_mcft_cap09_production_runtime_start_arm_v1", "RUNTIME_START_ARM_SCHEMA_REQUIRED");
  req(arm.armed === true, "RUNTIME_START_ARM_NOT_ARMED");
  req(arm.execution_requested === true, "RUNTIME_START_EXECUTION_REQUEST_REQUIRED");
  const subject = exactSha(arm.exact_deployment_subject_sha, "RUNTIME_START_EXACT_DEPLOYMENT_SUBJECT_REQUIRED");
  req(subject === observedHead, "RUNTIME_START_EXACT_DEPLOYMENT_SUBJECT_MISMATCH");

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
  for (const key of ["tenant_id","project_id","group_id","field_id","season_id","zone_id"]) {
    scope[key] = text(arm.scope?.[key], "RUNTIME_START_SCOPE_REQUIRED:" + key);
  }

  const activationFence = exactIso(
    arm.activation_fence_time,
    "RUNTIME_START_ACTIVATION_FENCE_REQUIRED",
  );
  const formalA0 = exactHour(
    arm.formal_a0_logical_time,
    "RUNTIME_START_FORMAL_A0_REQUIRED",
  );
  req(Date.parse(activationFence) < Date.parse(formalA0), "RUNTIME_START_FENCE_MUST_PRECEDE_A0");

  const stageValidation = validateEffectiveStageAuthorities(
    currentCrop,
    stageArchitecture,
    scope,
    formalA0,
  );

  req(arm.runtime_process_start_authorized === true, "RUNTIME_START_PROCESS_START_MUST_BE_AUTHORIZED");
  req(arm.evidence_runtime_start_authorized === true, "RUNTIME_START_EVIDENCE_START_MUST_BE_AUTHORIZED");
  req(arm.twin_runtime_start_authorized === true, "RUNTIME_START_TWIN_START_MUST_BE_AUTHORIZED");
  for (const key of [
    "production_owner_activation_authorized",
    "formal_v5_arm_authorized",
    "a0_authorized",
    "o00_authorized",
  ]) {
    req(arm[key] === false, "RUNTIME_START_LATER_AUTHORITY_MUST_REMAIN_FALSE:" + key);
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
  const result = build(arm, gitHead());
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, JSON.stringify(result, null, 2) + "\n");
  process.stdout.write(JSON.stringify({
    status: "PASS",
    output_path: path.relative(ROOT, args.output).replaceAll("\\", "/"),
    deployment_subject_sha: result.deployment_subject_sha,
    scope: result.scope,
    activation_fence_time: result.activation_fence_time,
    formal_a0_logical_time: result.formal_a0_logical_time,
    current_crop_authority_ref: result.current_crop_authority_ref,
    current_crop_authority_sha256: result.current_crop_authority_sha256,
    biological_stage_architecture_effectiveness_ref: result.biological_stage_architecture_effectiveness_ref,
    biological_stage_architecture_effectiveness_sha256: result.biological_stage_architecture_effectiveness_sha256,
    biological_stage: result.biological_stage,
    crop_water_use_stage: result.crop_water_use_stage,
    kc: result.kc,
    stage_authority_valid_until: result.stage_authority_valid_until,
    lifecycle_horizon_end_utc: result.lifecycle_horizon_end_utc,
    biological_stage_protected_main_sha: result.biological_stage_protected_main_sha,
    production_owner_activation_authorized: false,
    formal_v5_arm_authorized: false,
    a0_authorized: false,
    o00_authorized: false,
  }, null, 2) + "\n");
} catch (error) {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + "\n");
  process.exitCode = 1;
}
