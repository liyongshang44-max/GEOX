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
const FORMAL_DB="geox_mcft_cap09_s6_formal_t4r1_24h_v5";

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
function validateFreshZeroProof(proof, expectedSubject) {
  assert.equal(proof.schema_version, "geox_mcft_cap09_formal_v5_post_graduation_zero_state_proof_v1", "FORMAL_V5_ZERO_STATE_PROOF_SCHEMA_INVALID");
  assert.equal(proof.status, "PASS", "FORMAL_V5_ZERO_STATE_PROOF_PASS_REQUIRED");
  if (proof.subject_sha !== expectedSubject) fail(`FORMAL_V5_ZERO_STATE_PROOF_SUBJECT_MISMATCH:${proof.subject_sha}:${expectedSubject}`);
  assert.equal(proof.formal_database_name, FORMAL_DB, "FORMAL_V5_ZERO_STATE_DATABASE_IDENTITY_INVALID");
  assert.equal(proof.required_role, "FRESH_FORMAL_STORE_ONLY", "FORMAL_V5_ZERO_STATE_ROLE_INVALID");
  assert.equal(proof.required_pre_arm_state, "ZERO_STATE_PRE_ARM", "FORMAL_V5_ZERO_STATE_PRE_ARM_STATE_INVALID");
  assert.equal(proof.transaction_read_only, true, "FORMAL_V5_ZERO_STATE_READ_ONLY_REQUIRED");
  assert.equal(proof.public_base_table_count, 0, "FORMAL_V5_PUBLIC_BASE_TABLE_COUNT_NONZERO");
  assert.equal(proof.public_routine_count, 0, "FORMAL_V5_PUBLIC_ROUTINE_COUNT_NONZERO");
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
    assert.equal(proof[key], false, `FORMAL_V5_ZERO_STATE_PROOF_LATER_EFFECT_FORBIDDEN:${key}`);
  }
  assert.equal(proof.provider_request_count, 0, "FORMAL_V5_ZERO_STATE_PROVIDER_REQUEST_FORBIDDEN");
  return {
    readiness_mode:"FRESH_ZERO_STATE_PRE_ARM",
    proof_subject_sha:proof.subject_sha,
    public_base_table_count:0,
    public_routine_count:0,
    all_table_rows_zero:true,
    prior_arm_identity_hash:null,
    materialized_zero_rearm_eligible:false,
  };
}
function validateMaterializedZeroRearmProof(proof, expectedSubject) {
  assert.equal(proof.schema_version, "geox_mcft_cap09_formal_v5_materialized_zero_rearm_eligibility_v1", "FORMAL_V5_REARM_PROOF_SCHEMA_INVALID");
  assert.equal(proof.status, "PASS", "FORMAL_V5_REARM_PROOF_PASS_REQUIRED");
  assert.equal(proof.current_subject_sha, expectedSubject, "FORMAL_V5_REARM_PROOF_SUBJECT_MISMATCH");
  assert.equal(proof.formal_database_name, FORMAL_DB, "FORMAL_V5_REARM_PROOF_DATABASE_IDENTITY_INVALID");
  assert.equal(proof.observed_store_phase, "SCHEMA_ACL_MATERIALIZED_ZERO_ROWS_PRE_A0", "FORMAL_V5_REARM_PROOF_STORE_PHASE_INVALID");
  assert.equal(proof.transaction_read_only, true, "FORMAL_V5_REARM_PROOF_READ_ONLY_REQUIRED");
  assert.equal(proof.public_base_table_count, 29, "FORMAL_V5_REARM_PROOF_TABLE_COUNT_REQUIRED");
  assert.equal(proof.public_routine_count, 2, "FORMAL_V5_REARM_PROOF_ROUTINE_COUNT_REQUIRED");
  assert.equal(proof.all_table_rows_zero, true, "FORMAL_V5_REARM_PROOF_ZERO_ROWS_REQUIRED");
  assert.equal(proof.prior_arm_invalidated_by_non_authority_change, true, "FORMAL_V5_REARM_PROOF_PRIOR_ARM_INVALIDATION_REQUIRED");
  assert.ok(Number(proof.invalidating_change_count)>0, "FORMAL_V5_REARM_PROOF_INVALIDATING_CHANGE_REQUIRED");
  assert.match(String(proof.prior_arm_identity_hash||""), /^sha256:[0-9a-f]{64}$/, "FORMAL_V5_REARM_PROOF_PRIOR_ARM_IDENTITY_REQUIRED");
  assert.equal(proof.prior_a0_artifact_absence_proven, true, "FORMAL_V5_REARM_PROOF_A0_ABSENCE_REQUIRED");
  assert.equal(proof.rearm_eligible, true, "FORMAL_V5_REARM_PROOF_ELIGIBILITY_REQUIRED");
  assert.equal(proof.existing_arm_artifact_must_not_be_overwritten, true, "FORMAL_V5_REARM_PROOF_OLD_ARM_PRESERVATION_REQUIRED");
  assert.equal(proof.new_arm_output_must_be_distinct, true, "FORMAL_V5_REARM_PROOF_DISTINCT_OUTPUT_REQUIRED");
  assert.equal(proof.schema_acl_revalidation_required_after_rearm, true, "FORMAL_V5_REARM_PROOF_SCHEMA_REVALIDATION_REQUIRED");
  assert.equal(proof.formal_database_mutation, false, "FORMAL_V5_REARM_PROOF_DATABASE_MUTATION_FORBIDDEN");
  assert.equal(proof.production_owner_mutation, false, "FORMAL_V5_REARM_PROOF_OWNER_MUTATION_FORBIDDEN");
  assert.equal(proof.provider_request_count, 0, "FORMAL_V5_REARM_PROOF_PROVIDER_REQUEST_FORBIDDEN");
  assert.equal(proof.formal_v5_arm, false, "FORMAL_V5_REARM_PROOF_ARM_EFFECT_FORBIDDEN");
  assert.equal(proof.a0_authorized, false, "FORMAL_V5_REARM_PROOF_A0_AUTHORITY_FORBIDDEN");
  return {
    readiness_mode:"MATERIALIZED_ZERO_REARM",
    proof_subject_sha:proof.current_subject_sha,
    public_base_table_count:29,
    public_routine_count:2,
    all_table_rows_zero:true,
    prior_arm_identity_hash:proof.prior_arm_identity_hash,
    prior_arm_subject_sha:proof.prior_arm_subject_sha,
    materialized_zero_rearm_eligible:true,
  };
}

function main() {
  if (process.env.GITHUB_ACTIONS === "true" || process.env.CI === "true") {
    fail("FORMAL_V5_ARM_READINESS_LOCAL_PRODUCTION_HOST_ONLY");
  }

  const zeroStateProofPath = argValue("--zero-state-proof");
  const rearmProofPath = argValue("--materialized-zero-rearm-proof");
  if (Boolean(zeroStateProofPath) === Boolean(rearmProofPath)) {
    fail("FORMAL_V5_ARM_READINESS_EXACTLY_ONE_PRE_ARM_PROOF_REQUIRED");
  }
  const resolvedProof = path.resolve(zeroStateProofPath || rearmProofPath);
  if (!fs.existsSync(resolvedProof)) fail("FORMAL_V5_ARM_READINESS_PRE_ARM_PROOF_MISSING");

  execFileSync("git", ["fetch", "origin", "main"], { cwd: ROOT, stdio: "inherit" });
  const head = git("rev-parse", "HEAD");
  const originMain = git("rev-parse", "origin/main");
  if (head !== originMain) fail(`FORMAL_V5_ARM_READINESS_HEAD_NOT_CURRENT_PROTECTED_MAIN:${head}:${originMain}`);
  if (git("status", "--porcelain")) fail("FORMAL_V5_ARM_READINESS_WORKTREE_NOT_CLEAN");

  const expectedSubject = argValue("--expected-subject") || head;
  if (expectedSubject !== head) fail(`FORMAL_V5_ARM_READINESS_EXPECTED_SUBJECT_MISMATCH:${expectedSubject}:${head}`);

  const proof = readJson(resolvedProof);
  const preArm = zeroStateProofPath
    ? validateFreshZeroProof(proof, expectedSubject)
    : validateMaterializedZeroRearmProof(proof, expectedSubject);

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
    readiness_mode:preArm.readiness_mode,
    pre_arm_proof_subject_sha:preArm.proof_subject_sha,
    zero_state_proof_subject_sha:zeroStateProofPath?preArm.proof_subject_sha:null,
    materialized_zero_rearm_proof_subject_sha:rearmProofPath?preArm.proof_subject_sha:null,
    formal_database_name: FORMAL_DB,
    public_base_table_count: preArm.public_base_table_count,
    public_routine_count: preArm.public_routine_count,
    all_table_rows_zero:preArm.all_table_rows_zero,
    materialized_zero_rearm_eligible:preArm.materialized_zero_rearm_eligible,
    prior_arm_identity_hash:preArm.prior_arm_identity_hash,
    prior_arm_subject_sha:preArm.prior_arm_subject_sha||null,
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
