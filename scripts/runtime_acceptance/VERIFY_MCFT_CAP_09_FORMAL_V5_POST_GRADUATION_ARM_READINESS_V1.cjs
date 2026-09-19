#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync, execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../..");
const OWNER_VERIFIER = path.join(ROOT, "scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1.cjs");
const OWNER_RESULT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1_RESULT.json");
const OUTPUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_FORMAL_V5_POST_GRADUATION_ARM_READINESS_V1_RESULT.json");

function fail(message) {
  throw new Error(message);
}

function argValue(prefix) {
  const row = process.argv.slice(2).find((value) => value.startsWith(prefix + "="));
  return row ? row.slice(prefix.length + 1) : null;
}

function git(...args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function main() {
  if (process.env.GITHUB_ACTIONS === "true" || process.env.CI === "true") {
    fail("FORMAL_V5_ARM_READINESS_LOCAL_PRODUCTION_HOST_ONLY");
  }

  const zeroStateProofPath = argValue("--zero-state-proof");
  if (!zeroStateProofPath) fail("FORMAL_V5_ZERO_STATE_PROOF_PATH_REQUIRED");
  const resolvedProof = path.resolve(zeroStateProofPath);
  if (!fs.existsSync(resolvedProof)) fail("FORMAL_V5_ZERO_STATE_PROOF_MISSING");

  execFileSync("git", ["fetch", "origin", "main"], { cwd: ROOT, stdio: "inherit" });
  const head = git("rev-parse", "HEAD");
  const originMain = git("rev-parse", "origin/main");
  if (head !== originMain) fail(`FORMAL_V5_ARM_READINESS_HEAD_NOT_CURRENT_PROTECTED_MAIN:${head}:${originMain}`);
  if (git("status", "--porcelain")) fail("FORMAL_V5_ARM_READINESS_WORKTREE_NOT_CLEAN");

  const expectedSubject = argValue("--expected-subject") || head;
  if (expectedSubject !== head) fail(`FORMAL_V5_ARM_READINESS_EXPECTED_SUBJECT_MISMATCH:${expectedSubject}:${head}`);

  const zero = readJson(resolvedProof);
  assert.equal(zero.schema_version, "geox_mcft_cap09_formal_v5_post_graduation_zero_state_proof_v1", "FORMAL_V5_ZERO_STATE_PROOF_SCHEMA_INVALID");
  assert.equal(zero.status, "PASS", "FORMAL_V5_ZERO_STATE_PROOF_PASS_REQUIRED");
  if (zero.subject_sha !== expectedSubject) fail(`FORMAL_V5_ZERO_STATE_PROOF_SUBJECT_MISMATCH:${zero.subject_sha}:${expectedSubject}`);
  assert.equal(zero.formal_database_name, "geox_mcft_cap09_s6_formal_t4r1_24h_v5", "FORMAL_V5_ZERO_STATE_DATABASE_IDENTITY_INVALID");
  assert.equal(zero.required_role, "FRESH_FORMAL_STORE_ONLY", "FORMAL_V5_ZERO_STATE_ROLE_INVALID");
  assert.equal(zero.required_pre_arm_state, "ZERO_STATE_PRE_ARM", "FORMAL_V5_ZERO_STATE_PRE_ARM_STATE_INVALID");
  assert.equal(zero.transaction_read_only, true, "FORMAL_V5_ZERO_STATE_READ_ONLY_REQUIRED");
  assert.equal(zero.public_base_table_count, 0, "FORMAL_V5_PUBLIC_BASE_TABLE_COUNT_NONZERO");
  assert.equal(zero.public_routine_count, 0, "FORMAL_V5_PUBLIC_ROUTINE_COUNT_NONZERO");
  for (const key of [
    "production_owner_activation",
    "production_runtime_restart",
    "formal_database_mutation",
    "formal_v5_arm",
    "formal_v5_epoch_selected",
    "a0_bootstrap",
    "o00_started",
    "mcft_cap09_completed",
  ]) {
    assert.equal(zero[key], false, `FORMAL_V5_ZERO_STATE_PROOF_LATER_EFFECT_FORBIDDEN:${key}`);
  }
  assert.equal(zero.provider_request_count, 0, "FORMAL_V5_ZERO_STATE_PROVIDER_REQUEST_FORBIDDEN");

  const owner = spawnSync(process.execPath, [OWNER_VERIFIER, "--live"], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (owner.status !== 0) fail(`FORMAL_V5_ARM_READINESS_LIVE_OWNER_REVERIFICATION_FAILED:${owner.status}`);
  if (!fs.existsSync(OWNER_RESULT)) fail("FORMAL_V5_ARM_READINESS_LIVE_OWNER_RESULT_MISSING");
  const ownerProof = readJson(OWNER_RESULT);
  assert.equal(ownerProof.status, "PASS", "FORMAL_V5_ARM_READINESS_EXACT_ONE_OWNER_PASS_REQUIRED");
  assert.equal(
    ownerProof.adjudication,
    "EXACT_ONE_EFFECTIVE_OWNER_PER_RUNTIME_ROLE_WITH_CONTAINER_IMAGE_HOST_AND_RENEWAL_PROVEN",
    "FORMAL_V5_ARM_READINESS_OWNER_ADJUDICATION_INVALID",
  );
  assert.deepEqual(ownerProof.blockers || [], [], "FORMAL_V5_ARM_READINESS_OWNER_BLOCKERS_MUST_BE_ZERO");

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  const result = {
    schema_version: "geox_mcft_cap09_formal_v5_post_graduation_arm_readiness_v1",
    status: "PASS",
    deployment_subject_sha: expectedSubject,
    zero_state_proof_subject_sha: zero.subject_sha,
    formal_database_name: zero.formal_database_name,
    public_base_table_count: zero.public_base_table_count,
    public_routine_count: zero.public_routine_count,
    exact_one_live_fenced_owner_per_runtime_role_reverified: true,
    owner_adjudication: ownerProof.adjudication,
    formal_v5_arm_ready: true,
    separate_explicit_operator_authorization_still_required: true,
    formal_v5_arm: false,
    formal_v5_epoch_selected: false,
    formal_database_mutation: false,
    a0_bootstrap: false,
    o00_started: false,
    mcft_cap09_completed: false,
    checked_at: new Date().toISOString(),
  };
  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
  console.error("FORMAL_V5_ARM_REMAINS_UNAUTHORIZED_WITHOUT_SEPARATE_EXPLICIT_OPERATOR_AUTHORIZATION");
}

main();
