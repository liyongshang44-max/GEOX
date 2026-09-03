#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../..");
const BUILDER = path.join(
  ROOT,
  "scripts/runtime_acceptance/BUILD_MCFT_CAP_09_PRODUCTION_RUNTIME_START_AUTHORITY_V1.cjs",
);
const REAL_ARM = path.join(
  ROOT,
  "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_RUNTIME_START_ARM_V1.json",
);
const OUT_DIR = path.join(ROOT, "acceptance-output");
const RESULT = path.join(
  OUT_DIR,
  "MCFT_CAP_09_PRODUCTION_RUNTIME_START_AUTHORITY_BUILDER_V1_RESULT.json",
);

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
  return spawnSync(
    process.execPath,
    [BUILDER, "--arm", rel(arm), "--out", rel(out)],
    { cwd: ROOT, encoding: "utf8" },
  );
}

try {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();
  assert.match(head, /^[0-9a-f]{40}$/);

  const realArm = JSON.parse(fs.readFileSync(REAL_ARM, "utf8"));
  assert.equal(realArm.armed, false);
  assert.equal(realArm.execution_requested, false);
  const realOut = path.join(
    OUT_DIR,
    "MCFT_CAP_09_PRODUCTION_RUNTIME_START_REAL_ARM_MUST_NOT_BUILD.json",
  );
  fs.rmSync(realOut, { force: true });
  const realAttempt = runBuilder(REAL_ARM, realOut);
  assert.notEqual(realAttempt.status, 0);
  assert.match(
    realAttempt.stderr,
    /RUNTIME_START_ARM_NOT_ARMED/,
  );
  assert.equal(fs.existsSync(realOut), false);

  const liveAuthority = path.join(
    OUT_DIR,
    "MCFT_CAP_09_TEST_LIVE_ACTIVATION_AUTHORITY_V1.json",
  );
  const formalA0Authority = path.join(
    OUT_DIR,
    "MCFT_CAP_09_TEST_FORMAL_A0_AUTHORITY_V1.json",
  );
  writeJson(liveAuthority, {
    schema_version: "geox_mcft_cap09_test_live_activation_authority_v1",
    status: "QUALIFIED_TEST_FIXTURE_ONLY",
    live_activation_eligible: true,
  });
  writeJson(formalA0Authority, {
    schema_version: "geox_mcft_cap09_test_formal_a0_authority_v1",
    status: "QUALIFIED_TEST_FIXTURE_ONLY",
    formal_a0_logical_time: "2099-01-01T00:00:00.000Z",
  });

  const scope = {
    tenant_id: "tenant_mcft_external",
    project_id: "project_mcft_cap09",
    group_id: "group_public_research",
    field_id: "field_kbs_mcse_t4r1",
    season_id: "season_2026_corn",
    zone_id: "zone_kbs_mcse_t4r1_crop_formal_v1",
  };
  const tempArm = path.join(
    OUT_DIR,
    "MCFT_CAP_09_TEST_PRODUCTION_RUNTIME_START_ARM_V1.json",
  );
  const tempOut = path.join(
    OUT_DIR,
    "MCFT_CAP_09_TEST_PRODUCTION_RUNTIME_START_AUTHORITY_V1.json",
  );
  const armed = {
    schema_version: "geox_mcft_cap09_production_runtime_start_arm_v1",
    armed: true,
    activation_step:
      "MATERIAL_PROVIDER_CHANGE_REQUALIFIED_AND_VIABLE_FORMAL_A0_WINDOW_ESTABLISHED",
    exact_deployment_subject_sha: head,
    authority_ref: rel(tempArm),
    live_activation_authority_ref: rel(liveAuthority),
    live_activation_authority_sha256: digest(liveAuthority),
    formal_a0_authority_ref: rel(formalA0Authority),
    formal_a0_authority_sha256: digest(formalA0Authority),
    scope,
    activation_fence_time: "2098-12-31T23:30:00.000Z",
    formal_a0_logical_time: "2099-01-01T00:00:00.000Z",
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
  assert.equal(authority.live_activation_authority_ref, rel(liveAuthority));
  assert.equal(authority.live_activation_authority_sha256, digest(liveAuthority));
  assert.equal(authority.formal_a0_authority_ref, rel(formalA0Authority));
  assert.equal(authority.formal_a0_authority_sha256, digest(formalA0Authority));
  assert.equal(authority.activation_fence_time, "2098-12-31T23:30:00.000Z");
  assert.equal(authority.formal_a0_logical_time, "2099-01-01T00:00:00.000Z");
  assert.equal(authority.runtime_process_start_authorized, true);
  assert.equal(authority.evidence_runtime_start_authorized, true);
  assert.equal(authority.twin_runtime_start_authorized, true);
  assert.equal(authority.production_owner_activation_authorized, false);
  assert.equal(authority.formal_v5_arm_authorized, false);
  assert.equal(authority.a0_authorized, false);
  assert.equal(authority.o00_authorized, false);

  const staleHeadArm = path.join(
    OUT_DIR,
    "MCFT_CAP_09_TEST_STALE_HEAD_RUNTIME_START_ARM_V1.json",
  );
  writeJson(staleHeadArm, {
    ...armed,
    exact_deployment_subject_sha: "0".repeat(40),
  });
  const staleHeadOut = path.join(
    OUT_DIR,
    "MCFT_CAP_09_TEST_STALE_HEAD_RUNTIME_START_AUTHORITY_V1.json",
  );
  fs.rmSync(staleHeadOut, { force: true });
  const staleHeadAttempt = runBuilder(staleHeadArm, staleHeadOut);
  assert.notEqual(staleHeadAttempt.status, 0);
  assert.match(
    staleHeadAttempt.stderr,
    /RUNTIME_START_EXACT_DEPLOYMENT_SUBJECT_MISMATCH/,
  );
  assert.equal(fs.existsSync(staleHeadOut), false);

  const badDigestArm = path.join(
    OUT_DIR,
    "MCFT_CAP_09_TEST_BAD_DIGEST_RUNTIME_START_ARM_V1.json",
  );
  writeJson(badDigestArm, {
    ...armed,
    live_activation_authority_sha256:
      "sha256:" + "f".repeat(64),
  });
  const badDigestOut = path.join(
    OUT_DIR,
    "MCFT_CAP_09_TEST_BAD_DIGEST_RUNTIME_START_AUTHORITY_V1.json",
  );
  fs.rmSync(badDigestOut, { force: true });
  const badDigestAttempt = runBuilder(badDigestArm, badDigestOut);
  assert.notEqual(badDigestAttempt.status, 0);
  assert.match(
    badDigestAttempt.stderr,
    /RUNTIME_START_LIVE_ACTIVATION_AUTHORITY_SHA256_MISMATCH/,
  );
  assert.equal(fs.existsSync(badDigestOut), false);

  writeJson(RESULT, {
    schema_version:
      "geox_mcft_cap09_production_runtime_start_authority_builder_acceptance_v1",
    status: "PASS",
    exact_subject_bound: true,
    exact_scope_bound: true,
    source_authority_digest_bound: true,
    current_repository_arm_unarmed_fail_closed: true,
    stale_head_arm_rejected: true,
    bad_source_digest_rejected: true,
    runtime_process_started: false,
    database_connection_attempted: false,
    provider_request_count: 0,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
  });
  process.stdout.write(fs.readFileSync(RESULT, "utf8"));
} catch (error) {
  writeJson(RESULT, {
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    runtime_process_started: false,
    database_connection_attempted: false,
    provider_request_count: 0,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
  });
  throw error;
}
