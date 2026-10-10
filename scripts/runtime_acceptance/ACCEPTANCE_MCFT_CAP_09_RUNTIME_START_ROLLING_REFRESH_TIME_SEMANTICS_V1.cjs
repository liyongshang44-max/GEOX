#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../..");
const BUILDER = path.join(ROOT, "scripts/runtime_acceptance/BUILD_MCFT_CAP_09_PRODUCTION_RUNTIME_START_AUTHORITY_V1.cjs");
const OUT_DIR = path.join(ROOT, "acceptance-output");
const CURRENT_CROP_REL = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-09-09T04Z-V1.json";
const STAGE_REL = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-ARCHITECTURE-EFFECTIVENESS-V1.json";
const LIVE_REL = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-RUNTIME-OWNER-CUTOVER-AUTHORITY-V1.json";
const A0_REL = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRE-FORMAL-A0-PLANNING-AUTHORITY-V1.json";
const RESULT = path.join(OUT_DIR, "MCFT_CAP_09_RUNTIME_START_ROLLING_REFRESH_TIME_SEMANTICS_V1_RESULT.json");

function digest(file) {
  return "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function abs(rel) {
  return path.join(ROOT, rel);
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}
function rel(file) {
  return path.relative(ROOT, file).replaceAll("\\", "/");
}
function runBuilder(armPath, outPath) {
  return spawnSync(process.execPath, [BUILDER, "--arm", rel(armPath), "--out", rel(outPath)], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

try {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  assert.match(head, /^[0-9a-f]{40}$/);

  const currentCrop = JSON.parse(fs.readFileSync(abs(CURRENT_CROP_REL), "utf8"));
  const stage = JSON.parse(fs.readFileSync(abs(STAGE_REL), "utf8"));
  assert.equal(currentCrop.graduation.status, "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH");
  assert.equal(currentCrop.graduation.architecture_effective_since, stage.issued_at);
  assert.equal(currentCrop.graduation.graduated_at, currentCrop.refresh.qualification_time);
  assert.notEqual(currentCrop.graduation.graduated_at, stage.issued_at);

  const scope = {
    tenant_id: currentCrop.scope.tenant_id,
    project_id: currentCrop.scope.project_id,
    group_id: currentCrop.scope.group_id,
    field_id: currentCrop.scope.field_id,
    season_id: currentCrop.scope.season_id,
    zone_id: currentCrop.scope.zone_id,
  };

  const armPath = path.join(OUT_DIR, "MCFT_CAP_09_TEST_ROLLING_REFRESH_RUNTIME_START_ARM_V1.json");
  const outPath = path.join(OUT_DIR, "MCFT_CAP_09_TEST_ROLLING_REFRESH_RUNTIME_START_AUTHORITY_V1.json");
  const arm = {
    schema_version: "geox_mcft_cap09_production_runtime_start_arm_v1",
    armed: true,
    activation_step: "TEST_ROLLING_REFRESH_TIME_SEMANTICS",
    exact_deployment_subject_sha: head,
    authority_ref: rel(armPath),
    live_activation_authority_ref: LIVE_REL,
    live_activation_authority_sha256: digest(abs(LIVE_REL)),
    formal_a0_authority_ref: A0_REL,
    formal_a0_authority_sha256: digest(abs(A0_REL)),
    current_crop_authority_ref: CURRENT_CROP_REL,
    current_crop_authority_sha256: digest(abs(CURRENT_CROP_REL)),
    biological_stage_architecture_effectiveness_ref: STAGE_REL,
    biological_stage_architecture_effectiveness_sha256: digest(abs(STAGE_REL)),
    scope,
    activation_fence_time: "2026-09-10T06:15:00.000Z",
    formal_a0_logical_time: "2026-09-10T07:00:00.000Z",
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
  writeJson(armPath, arm);
  fs.rmSync(outPath, { force: true });
  const positive = runBuilder(armPath, outPath);
  assert.equal(positive.status, 0, positive.stderr || positive.stdout);
  assert.equal(JSON.parse(fs.readFileSync(outPath, "utf8")).status, "AUTHORIZED");

  const tamperedCropPath = path.join(OUT_DIR, "MCFT_CAP_09_TEST_ROLLING_REFRESH_BAD_QUALIFICATION_TIME_V1.json");
  const tamperedCrop = JSON.parse(JSON.stringify(currentCrop));
  tamperedCrop.refresh.qualification_time = "2026-09-10T03:20:57.329Z";
  writeJson(tamperedCropPath, tamperedCrop);
  const badArmPath = path.join(OUT_DIR, "MCFT_CAP_09_TEST_ROLLING_REFRESH_BAD_QUALIFICATION_TIME_ARM_V1.json");
  const badOutPath = path.join(OUT_DIR, "MCFT_CAP_09_TEST_ROLLING_REFRESH_BAD_QUALIFICATION_TIME_AUTHORITY_V1.json");
  writeJson(badArmPath, {
    ...arm,
    authority_ref: rel(badArmPath),
    current_crop_authority_ref: rel(tamperedCropPath),
    current_crop_authority_sha256: digest(tamperedCropPath),
  });
  fs.rmSync(badOutPath, { force: true });
  const badQualification = runBuilder(badArmPath, badOutPath);
  assert.notEqual(badQualification.status, 0);
  assert.match(badQualification.stderr, /RUNTIME_START_CURRENT_CROP_REFRESH_GRADUATION_TIME_MISMATCH/);
  assert.equal(fs.existsSync(badOutPath), false);

  const tamperedSincePath = path.join(OUT_DIR, "MCFT_CAP_09_TEST_ROLLING_REFRESH_BAD_ARCHITECTURE_EFFECTIVE_SINCE_V1.json");
  const tamperedSince = JSON.parse(JSON.stringify(currentCrop));
  tamperedSince.graduation.architecture_effective_since = "2026-09-03T15:23:01.000Z";
  writeJson(tamperedSincePath, tamperedSince);
  const badSinceArmPath = path.join(OUT_DIR, "MCFT_CAP_09_TEST_ROLLING_REFRESH_BAD_ARCHITECTURE_EFFECTIVE_SINCE_ARM_V1.json");
  const badSinceOutPath = path.join(OUT_DIR, "MCFT_CAP_09_TEST_ROLLING_REFRESH_BAD_ARCHITECTURE_EFFECTIVE_SINCE_AUTHORITY_V1.json");
  writeJson(badSinceArmPath, {
    ...arm,
    authority_ref: rel(badSinceArmPath),
    current_crop_authority_ref: rel(tamperedSincePath),
    current_crop_authority_sha256: digest(tamperedSincePath),
  });
  fs.rmSync(badSinceOutPath, { force: true });
  const badSince = runBuilder(badSinceArmPath, badSinceOutPath);
  assert.notEqual(badSince.status, 0);
  assert.match(badSince.stderr, /RUNTIME_START_CURRENT_CROP_ARCHITECTURE_EFFECTIVE_SINCE_MISMATCH/);
  assert.equal(fs.existsSync(badSinceOutPath), false);

  writeJson(RESULT, {
    schema_version: "geox_mcft_cap09_runtime_start_rolling_refresh_time_semantics_acceptance_v1",
    status: "PASS",
    real_rolling_refresh_artifact_accepted: true,
    architecture_effective_since_bound_to_certificate_issued_at: true,
    graduated_at_bound_to_refresh_qualification_time: true,
    mismatched_refresh_qualification_time_rejected: true,
    mismatched_architecture_effective_since_rejected: true,
    runtime_process_started: false,
    database_connection_attempted: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_started: false,
    o00_started: false,
  });
  process.stdout.write(fs.readFileSync(RESULT, "utf8"));
} catch (error) {
  writeJson(RESULT, {
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    runtime_process_started: false,
    database_connection_attempted: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_started: false,
    o00_started: false,
  });
  throw error;
}
