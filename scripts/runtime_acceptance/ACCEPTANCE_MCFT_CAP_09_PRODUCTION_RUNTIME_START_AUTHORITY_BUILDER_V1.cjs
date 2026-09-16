#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../..");
const BUILDER = path.join(ROOT, "scripts/runtime_acceptance/BUILD_MCFT_CAP_09_PRODUCTION_RUNTIME_START_AUTHORITY_V1.cjs");
const REAL_ARM = path.join(ROOT, "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_RUNTIME_START_ARM_V1.json");
const PRE_READY_PROOF = path.join(ROOT, "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_NON_GITHUB_HOST_BINDING_ARM_V1.json");
const PARSER = path.join(ROOT, "apps/server/src/runtime/mcft_cap09_production_runtime_start_authority_v1.ts");
const EVIDENCE_ENTRY = path.join(ROOT, "apps/server/src/runtime/mcft_cap09_evidence_preformal_owner_runtime_v1.ts");
const TWIN_ENTRY = path.join(ROOT, "apps/server/src/runtime/mcft_cap09_twin_preformal_owner_runtime_v1.ts");
const OUT_DIR = path.join(ROOT, "acceptance-output");
const RESULT = path.join(OUT_DIR, "MCFT_CAP_09_PRODUCTION_RUNTIME_START_AUTHORITY_BUILDER_V1_RESULT.json");
const HOUR = 3_600_000;
const PRE_READY_CANONICAL_MAIN = "f9cdeb4eddb1801a339149a592ee41f9cf120257";
const HOST_PROOF_SUBJECT = "d1db5463d1363eb5f9efacc13425b75a7c8b7ee8";
const HOST_ID = "fae5f756-ef25-40d5-9777-5b2c3d4837a1";

function digest(file) {
  return "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}
function rel(file) {
  return path.relative(ROOT, file).replaceAll("\\", "/");
}
function runBuilder(arm, out) {
  return spawnSync(process.execPath, [BUILDER, "--arm", rel(arm), "--out", rel(out)], {
    cwd: ROOT,
    encoding: "utf8",
  });
}
function floorHour(ms) {
  return Math.floor(ms / HOUR) * HOUR;
}
function ceilHour(ms) {
  return Math.ceil(ms / HOUR) * HOUR;
}

try {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  assert.match(head, /^[0-9a-f]{40}$/);

  const realArm = JSON.parse(fs.readFileSync(REAL_ARM, "utf8"));
  assert.equal(realArm.armed, false);
  assert.equal(realArm.execution_requested, false);
  const realOut = path.join(OUT_DIR, "MCFT_CAP_09_PRODUCTION_RUNTIME_START_REAL_ARM_MUST_NOT_BUILD.json");
  fs.rmSync(realOut, { force: true });
  const realAttempt = runBuilder(REAL_ARM, realOut);
  assert.notEqual(realAttempt.status, 0);
  assert.match(realAttempt.stderr, /RUNTIME_START_ARM_NOT_ARMED/);
  assert.equal(fs.existsSync(realOut), false);

  const proof = JSON.parse(fs.readFileSync(PRE_READY_PROOF, "utf8"));
  assert.equal(proof.armed, false);
  assert.equal(proof.local_machine_proof_evidence?.status, "PASS");
  assert.equal(proof.local_machine_proof_evidence?.observed_subject_sha, HOST_PROOF_SUBJECT);
  assert.equal(proof.local_machine_proof_evidence?.local_host_id, HOST_ID);
  assert.equal(proof.local_machine_proof_evidence?.pre_owner_cutover_ready, true);

  const now = Date.now();
  const stageAsOfMs = floorHour(now - HOUR);
  const stageAsOf = new Date(stageAsOfMs).toISOString();
  const stageValidUntil = new Date(stageAsOfMs + 30 * HOUR).toISOString();
  const certificateIssuedAt = stageAsOf;
  const activationFence = new Date(now).toISOString();
  const formalA0 = new Date(ceilHour(now + HOUR)).toISOString();
  const lifecycleHorizon = new Date(stageAsOfMs + 48 * HOUR).toISOString();

  assert.ok(Date.parse(activationFence) >= Date.parse(stageAsOf));
  assert.ok(Date.parse(formalA0) <= Date.parse(stageValidUntil));

  const liveAuthority = path.join(OUT_DIR, "MCFT_CAP_09_TEST_LIVE_ACTIVATION_AUTHORITY_V1.json");
  const formalA0Authority = path.join(OUT_DIR, "MCFT_CAP_09_TEST_FORMAL_A0_AUTHORITY_V1.json");
  const currentCropAuthority = path.join(OUT_DIR, "MCFT_CAP_09_TEST_CURRENT_CROP_AUTHORITY_V1.json");
  const stageArchitectureEffectiveness = path.join(OUT_DIR, "MCFT_CAP_09_TEST_BIOLOGICAL_STAGE_ARCHITECTURE_EFFECTIVENESS_V1.json");

  writeJson(liveAuthority, {
    schema_version: "geox_mcft_cap09_test_live_activation_authority_v1",
    status: "QUALIFIED_TEST_FIXTURE_ONLY",
    live_activation_eligible: true,
  });
  writeJson(formalA0Authority, {
    schema_version: "geox_mcft_cap09_test_formal_a0_authority_v1",
    status: "QUALIFIED_TEST_FIXTURE_ONLY",
    formal_a0_logical_time: formalA0,
  });
  const testProtectedMainSha = "9".repeat(40);
  writeJson(stageArchitectureEffectiveness, {
    schema_version: "geox_dt02_biological_stage_authority_effectiveness_v1",
    amendment_id: "DT02-AMENDMENT-03",
    status: "EFFECTIVE",
    effective: true,
    protected_main_sha: testProtectedMainSha,
    issued_at: certificateIssuedAt,
    runtime_start_authorized: false,
    production_owner_activation_authorized: false,
    formal_v5_authorized: false,
    a0_authorized: false,
    o00_o23_authorized: false,
  });

  const scope = {
    tenant_id: "tenant_mcft_external",
    project_id: "project_mcft_cap09",
    group_id: "group_public_research",
    field_id: "field_kbs_mcse_t4r1",
    season_id: "season_2026_corn",
    zone_id: "zone_kbs_mcse_t4r1_crop_formal_v1",
  };
  writeJson(currentCropAuthority, {
    schema_version: "geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1",
    status: "PASS",
    qualification_outcome: "CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED",
    architecture_effective: true,
    runtime_consumption_authorized: true,
    scope,
    lifecycle: {
      domain_state: "ACTIVE",
      authority_status: "RESOLVED",
      authority_validity: "VALID",
      authority_mode: "GOVERNED_PERSISTENT_STATE",
      active_consumable_candidate: true,
      horizon_end_utc: lifecycleHorizon,
    },
    biological_stage: {
      epistemic_class: "THERMAL_MODEL_DERIVED",
      resolved_biological_stage: "R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE",
      observed_biological_stage_claimed: false,
      authority_as_of: stageAsOf,
      authority_valid_until: stageValidUntil,
      forward_stability_hours: 30,
    },
    crop_water_use_stage: "LATE",
    crop_model_parameter: {
      parameter: "Kc",
      stage_code: "LATE",
      value: 0.6,
      production_effective: false,
    },
    evidence_digest: "sha256:" + "a".repeat(64),
    graduation: {
      status: "EFFECTIVE_FOR_RUNTIME_CONSUMPTION",
      amendment_id: "DT02-AMENDMENT-03",
      architecture_effectiveness_sha256: digest(stageArchitectureEffectiveness),
      protected_main_sha: testProtectedMainSha,
      graduated_at: certificateIssuedAt,
    },
  });

  const tempArm = path.join(OUT_DIR, "MCFT_CAP_09_TEST_PRODUCTION_RUNTIME_START_ARM_V1.json");
  const tempOut = path.join(OUT_DIR, "MCFT_CAP_09_TEST_PRODUCTION_RUNTIME_START_AUTHORITY_V1.json");
  const armed = {
    schema_version: "geox_mcft_cap09_production_runtime_start_arm_v1",
    armed: true,
    activation_step: "PRE_RUNTIME_START_READY_NON_OWNER_STANDBY",
    runtime_mode: "NON_OWNER_STANDBY",
    exact_deployment_subject_sha: head,
    authority_ref: rel(tempArm),
    live_activation_authority_ref: rel(liveAuthority),
    live_activation_authority_sha256: digest(liveAuthority),
    formal_a0_authority_ref: rel(formalA0Authority),
    formal_a0_authority_sha256: digest(formalA0Authority),
    current_crop_authority_ref: rel(currentCropAuthority),
    current_crop_authority_sha256: digest(currentCropAuthority),
    biological_stage_architecture_effectiveness_ref: rel(stageArchitectureEffectiveness),
    biological_stage_architecture_effectiveness_sha256: digest(stageArchitectureEffectiveness),
    scope,
    activation_fence_time: activationFence,
    formal_a0_logical_time: formalA0,
    runtime_process_start_authorized: true,
    evidence_runtime_start_authorized: true,
    twin_runtime_start_authorized: true,
    production_owner_activation_authorized: false,
    formal_v5_arm_authorized: false,
    a0_authorized: false,
    o00_authorized: false,
    execution_requested: true,
    current_status: "TEST_FIXTURE_ARMED",
  };
  writeJson(tempArm, armed);
  fs.rmSync(tempOut, { force: true });
  const good = runBuilder(tempArm, tempOut);
  assert.equal(good.status, 0, good.stderr || good.stdout);
  assert.equal(fs.existsSync(tempOut), true);

  const authority = JSON.parse(fs.readFileSync(tempOut, "utf8"));
  assert.equal(authority.status, "AUTHORIZED");
  assert.equal(authority.armed, true);
  assert.equal(authority.deployment_subject_sha, head);
  assert.deepEqual(authority.scope, scope);
  assert.equal(authority.runtime_mode, "NON_OWNER_STANDBY");
  assert.equal(authority.current_crop_authority_as_of, stageAsOf);
  assert.equal(authority.current_crop_authority_valid_until, stageValidUntil);
  assert.equal(authority.pre_runtime_start_ready_proof_ref, rel(PRE_READY_PROOF));
  assert.equal(authority.pre_runtime_start_ready_proof_sha256, digest(PRE_READY_PROOF));
  assert.equal(authority.pre_runtime_start_ready_canonical_protected_main_sha, PRE_READY_CANONICAL_MAIN);
  assert.equal(authority.host_proof_subject_sha, HOST_PROOF_SUBJECT);
  assert.equal(authority.host_id, HOST_ID);
  assert.equal(authority.runtime_process_start_authorized, true);
  assert.equal(authority.evidence_runtime_start_authorized, true);
  assert.equal(authority.twin_runtime_start_authorized, true);
  assert.equal(authority.production_owner_activation_authorized, false);
  assert.equal(authority.formal_v5_arm_authorized, false);
  assert.equal(authority.a0_authorized, false);
  assert.equal(authority.o00_authorized, false);

  const missingModeArm = path.join(OUT_DIR, "MCFT_CAP_09_TEST_MISSING_MODE_RUNTIME_START_ARM_V1.json");
  writeJson*missingModeArm, { ...armed, runtime_mode: undefined });
  const missingModeOut = path.join(OUT_DIR, "MCFT_CAP_09_TEST_MISSING_MODE_RUNTIME_START_AUTHORITY_V1.json");
  fs.rmSync(missingModeOut, { force: true });
  const missingModeAttempt = runBuilder(missingModeArm, missingModeOut);
  assert.notEqual(missingModeAttempt.status, 0);
  assert.match(missingModeAttempt.stderr, /RUNTIME_START_RUNTIME_MODE_REQUIRED/);
  assert.equal(fs.existsSync(missingModeOut), false);

  const ownerCompatArm = path.join(OUT_DIR, "MCFT_CAP_09_TEST_OWNER_COMPAT_RUNTIME_START_ARM_V1.json");
  writeJson(ownerCompatArm, {
    ...armed,
    runtime_mode: undefined,
    activation_step: "POST_EFFECTIVENESS_DUAL_KEY_LOCAL_OWNER_CUTOVER",
  });
  const ownerCompatOut = path.join(OUT_DIR, "MCFT_CAP_09_TEST_OWNER_COMPAT_RUNTIME_START_AUTHORITY_V1.json");
  fs.rmSync(ownerCompatOut, { force: true });
  const ownerCompatAttempt = runBuilder(ownerCompatArm, ownerCompatOut);
  assert.equal(ownerCompatAttempt.status, 0, ownerCompatAttempt.stderr || ownerCompatAttempt.stdout);
  assert.equal(JSON.parse(fs.readFileSync(ownerCompatOut, "utf8")).runtime_mode, "OWNER_CUTOVER");

  const candidateOnlyCurrentCrop = path.join(OUT_DIR, "MCFT_CAP_09_TEST_CANDIDATE_ONLY_CURRENT_CROP_AUTHORITY_V1.json");
  writeJson(candidateOnlyCurrentCrop, {
    ...JSON.parse(fs.readFileSync(currentCropAuthority, "utf8")),
    architecture_effective: false,
    runtime_consumption_authorized: false,
  });
  const candidateOnlyArm = path.join(OUT_DIR, "MCFT_CAP_09_TEST_CANDIDATE_ONLY_CURRENT_CROP_ARM_V1.json");
  writeJson(candidateOnlyArm, {
    ...armed,
    current_crop_authority_ref: rel(candidateOnlyCurrentCrop),
    current_crop_authority_sha256: digest(candidateOnlyCurrentCrop),
  });
  const candidateOnlyOut = path.join(OUT_DIR, "MCFT_CAP_09_TEST_CANDIDATE_ONLY_CURRENT_CROP_RUNTIME_START_AUTHORITY_V1.json");
  fs.rmSync(candidateOnlyOut, { force: true });
  const candidateOnlyAttempt = runBuilder(candidateOnlyArm, candidateOnlyOut);
  assert.notEqual(candidateOnlyAttempt.status, 0);
  assert.match(candidateOnlyAttempt.stderr, /RUNTIME_START_CURRENT_CROP_AUTHORITY_NOT_EFFECTIVE/);
  assert.equal(fs.existsSync(candidateOnlyOut), false);

  const staleStageCurrentCrop = path.join(OUT_DIR, "MCFT_CAP_09_TEST_STALE_STAGE_CURRENT_CROP_AUTHORITY_V1.json");
  const staleStageObject = JSON.parse(fs.readFileSync(currentCropAuthority, "utf8"));
  const staleAsOfMs = floorHour(now - 60 * HOUR);
  staleStageObject.biological_stage.authority_as_of = new Date(staleAsOfMs).toISOString();
  staleStageObject.biological_stage.authority_valid_until = new Date(staleAsOfMs + 30 * HOUR).toISOString();
  staleStageObject.graduation.graduated_at = staleStageObject.biological_stage.authority_as_of;
  writeJson(staleStageCurrentCrop, staleStageObject);
  const staleStageArm = path.join(OUT_DIR, "MCFT_CAP_09_TEST_STALE_STAGE_RUNTIME_START_ARM_V1.json");
  writeJson(staleStageArm, {
    ...armed,
    current_crop_authority_ref: rel(staleStageCurrentCrop),
    current_crop_authority_sha256: digest(staleStageCurrentCrop),
  });
  const staleStageOut = path.join(OUT_DIR, "MCFT_CAP_09_TEST_STALE_STAGE_RUNTIME_START_AUTHORITY_V1.json");
  fs.rmSync(staleStageOut, { force: true });
  const staleStageAttempt = runBuilder(staleStageArm, staleStageOut);
  assert.notEqual(staleStageAttempt.status, 0);
  assert.match(staleStageAttempt.stderr, /RUNTIME_START_CURRENT_CROP_STAGE_AUTHORITY_STALE_AT_ADJUDICATION/);
  assert.equal(fs.existsSync(staleStageOut), false);

  const mismatchedCertificateCurrentCrop = path.join(OUT_DIR, "MCFT_CAP_09_TEST_MISMATCHED_CERT_CURRENT_CROP_AUTHORITY_V1.json");
  const mismatchObject = JSON.parse(fs.readFileSync(currentCropAuthority, "utf8"));
  mismatchObject.graduation.architecture_effectiveness_sha256 = "sha256:" + "7".repeat(64);
  writeJson(mismatchedCertificateCurrentCrop, mismatchObject);
  const mismatchedCertificateArm = path.join(OUT_DIR, "MCFT_CAP_09_TEST_MISMATCHED_CERT_RUNTIME_START_ARM_V1.json");
  writeJson(mismatchedCertificateArm, {
    ...armed,
    current_crop_authority_ref: rel(mismatchedCertificateCurrentCrop),
    current_crop_authority_sha256: digest(mismatchedCertificateCurrentCrop),
  });
  const mismatchedCertificateOut = path.join(OUT_DIR, "MCFT_CAP_09_TEST_MISMATCHED_CERT_RUNTIME_START_AUTHORITY_V1.json");
  fs.rmSync(mismatchedCertificateOut, { force: true });
  const mismatchedCertificateAttempt = runBuilder(mismatchedCertificateArm, mismatchedCertificateOut);
  assert.notEqual(mismatchedCertificateAttempt.status, 0);
  assert.match(mismatchedCertificateAttempt.stderr, /RUNTIME_START_CURRENT_CROP_ARCHITECTURE_CERTIFICATE_DIGEST_MISMATCH/);
  assert.equal(fs.existsSync(mismatchedCertificateOut), false);

  const staleHeadArm = path.join(OUT_DIR, "MCFT_CAP_09_TEST_STALE_HEAD_RUNTIME_START_ARM_V1.json");
  writeJson(staleHeadArm, { ...armed, exact_deployment_subject_sha: "0".repeat(40) });
  const staleHeadOut = path.join(OUT_DIR, "MCFT_CAP_09_TEST_STALE_HEAD_RUNTIME_START_AUTHORITY_V1.json");
  fs.rmSync(staleHeadOut, { force: true });
  const staleHeadAttempt = runBuilder(staleHeadArm, staleHeadOut);
  assert.notEqual(staleHeadAttempt.status, 0);
  assert.match(staleHeadAttempt.stderr, /RUNTIME_START_EXACT_DEPLOYMENT_SUBJECT_MISMATCH/);
  assert.equal(fs.existsSync(staleHeadOut), false);

  const badDigestArm = path.join(OUT_DIR, "MCFT_CAP_09_TEST_BAD_DIGEST_RUNTIME_START_ARM_V1.json");
  writeJson(badDigestArm, { ...armed, current_crop_authority_sha256: "sha256:" + "0".repeat(64) });
  const badDigestOut = path.join(OUT_DIR, "MCFT_CAP_09_TEST_BAD_DIGEST_RUNTIME_START_AUTHORITY_V1.json");
  fs.rmSync(badDigestOut, { force: true });
  const badDigestAttempt = runBuilder(badDigestArm, badDigestOut);
  assert.notEqual(badDigestAttempt.status, 0);
  assert.match(badDigestAttempt.stderr, /RUNTIME_START_CURRENT_CROP_AUTHORITY_SHA256_MISMATCH/);
  assert.equal(fs.existsSync(badDigestOut), false);

  const ceilingArm = path.join(OUT_DIR, "MCFT_CAP_09_TEST_CEILING_RUNTIME_START_ARM_V1.json");
  writeJson(ceilingArm, { ...armed, production_owner_activation_authorized: true });
  const ceilingOut = path.join(OUT_DIR, "MCFT_CAP_09_TEST_CEILING_RUNTIME_START_AUTHORITY_V1.json");
  fs.rmSync(ceilingOut, { force: true });
  const ceilingAttempt = runBuilder(ceilingArm, ceilingOut);
  assert.notEqual(ceilingAttempt.status, 0);
  assert.match(ceilingAttempt.stderr, /RUNTIME_START_LATER_AUTHORITY_MUST_REMAIN_FALSE:production_owner_activation_authorized/);
  assert.equal(fs.existsSync(ceilingOut), false);

  const parser = fs.readFileSync(PARSER, "utf8");
  for (const marker of [
    "MCFT_CAP09_PRODUCTION_RUNTIME_START_MODE_MISMATCH",
    "MCFT_CAP09_PRODUCTION_RUNTIME_START_CURRENT_CROP_STALE_AT_PROCESS_ADMISSION",
    "MCFT_CAP09_PRODUCTION_RUNTIME_START_CURRENT_CROP_FUTURE_AT_PROCESS_ADMISSION",
    PRE_READY_CANONICAL_MAIN,
    HOST_PROOF_SUBJECT,
    HOST_ID,
  ]) assert.ok(parser.includes(marker), "RUNTIME_START_PARSER_MARKER_REQUIRED:" + marker);

  const evidence = fs.readFileSync(EVIDENCE_ENTRY, "utf8");
  const twin = fs.readFileSync(TWIN_ENTRY, "utf8");
  for (const source of [evidence, twin]) {
    assert.ok(source.includes("runtime_mode:NON_OWNER_STANDBY_MODE"), "RUNTIME_START_NON_OWNER_MODE_BINDING_REQUIRED");
    assert.ok(source.includes("runtime_mode:OWNER_CUTOVER_MODE"), "RUNTIME_START_OWNER_MODE_BINDING_REQUIRED");
  }

  writeJson(RESULT, {
    status: "PASS",
    deployment_subject_sha: head,
    runtime_mode_non_owner_standby_required: true,
    owner_cutover_legacy_builder_compatibility_preserved: true,
    pre_runtime_start_ready_proof_bound: true,
    pre_runtime_start_ready_canonical_main_sha: PRE_READY_CANONICAL_MAIN,
    host_proof_subject_sha: HOST_PROOF_SUBJECT,
    canonical_host_id: HOST_ID,
    current_crop_effectiveness_semantics_required: true,
    current_crop_stage_fresh_at_formal_a0_required: true,
    current_crop_fresh_at_adjudication_required: true,
    current_crop_fresh_at_process_admission_required: true,
    current_crop_architecture_certificate_digest_required: true,
    candidate_only_current_crop_rejected: true,
    stale_stage_current_crop_rejected: true,
    mismatched_architecture_certificate_rejected: true,
    missing_non_owner_runtime_mode_rejected: true,
    exact_head_binding_required: true,
    authority_digest_binding_required: true,
    production_owner_activation_authorized: false,
    formal_v5_arm_authorized: false,
    a0_authorized: false,
    o00_authorized: false,
    runtime_started: false,
  });
  process.stdout.write(fs.readFileSync(RESULT, "utf8"));
} catch (error) {
  process.stderr.write((error instanceof Error ? error.stack ?? error.message : String(error)) + "\n");
  process.exitCode = 1;
}
