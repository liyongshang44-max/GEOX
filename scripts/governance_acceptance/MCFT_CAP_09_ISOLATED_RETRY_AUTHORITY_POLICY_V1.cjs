"use strict";
// Read-only policy assessment. This module cannot grant or perform Execute.
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const ARM_PATH = "scripts/runtime_acceptance/MCFT_CAP_09_ISOLATED_RETRY_ARM_20261011_V1.json";
const PARENT_RUN = "72dc0304a21a";
const OLD_BASE = "2026-10-11T00:00:00.000Z";
const ANCHORS = {
  first_failed_receipt: "00a5eb698fcd9ed0d18689fdd6e25df9e4b2e321e412d8565fec12a04b39b9c8",
  first_started: "5b6ab70a869002f3b9841acf9e55231315b35144979f252b6ad2a4623fb4ec19",
  audit_v1: "47553066e96e8b259f4a7c0d9d91b8531109184011d2a68b6fb6ef0c19526a05",
};
const DEFAULT_ARM = {
  schema_version: "geox_mcft_cap09_isolated_retry_arm_v1",
  armed: false, mode: "DISABLED", parent_run_id: PARENT_RUN,
  run_id: null, attempt_ordinal: null, protected_main_sha: null,
  authorized_at: null, qualification_first_base: null, expires_at: null,
  retry_adjudication: null, resources: null, output_directory: null,
  evidence_sha256: {...ANCHORS, audit_v2: null, audit_v6: null},
  first_execution_provider_calls: null,
  execute_authorized: false, retry_authorized: false,
  production_recovery_authorized: false, owner_cutover_authorized: false,
  formal_v5_authorized: false, a0_authorized: false, o00_o23_authorized: false,
  automatic_retry_authorized: false, historical_reset_authorized: false,
};
function validateDisabledArm(arm) {
  assert.deepEqual(arm, DEFAULT_ARM, "DISABLED_RETRY_ARM_CHANGED_ACTIVATION_REQUIRES_SUCCESSOR");
  return {status: "EXECUTE_HOLD", armed: false, execute_authorized: false, retry_authorized: false};
}
const sha = value => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
function instant(value, code) {
  assert(typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value), code);
  const n = Date.parse(value);
  assert(Number.isFinite(n) && new Date(n).toISOString() === value, code);
  return n;
}
// Pure, synthetic-testable prerequisites for a FUTURE reviewed activation.
// Even a successful assessment returns execute_authorized=false. No caller in
// the qualification runner is wired to this function by this implementation.
function assessActivationProposal(arm, observed) {
  assert.deepEqual(Object.keys(arm).sort(), Object.keys(DEFAULT_ARM).sort(), "RETRY_ARM_FIELDS_CHANGED");
  assert.equal(arm.schema_version, DEFAULT_ARM.schema_version);
  assert.equal(arm.armed, true, "RETRY_ARM_NOT_ARMED");
  assert.equal(arm.mode, "ISOLATED_QUALIFICATION", "RETRY_MODE_FORBIDDEN");
  for (const key of ["production_recovery_authorized", "owner_cutover_authorized", "formal_v5_authorized",
    "a0_authorized", "o00_o23_authorized", "automatic_retry_authorized", "historical_reset_authorized"])
    assert.equal(arm[key], false, "RETRY_EFFECT_FORBIDDEN:" + key);
  assert.equal(arm.execute_authorized, true, "EXPLICIT_EXECUTE_DECISION_MISSING");
  assert.equal(arm.retry_authorized, true, "EXPLICIT_RETRY_DECISION_MISSING");
  assert.equal(arm.parent_run_id, PARENT_RUN, "RETRY_LINEAGE_CHANGED");
  assert.match(arm.run_id, /^[a-f0-9]{12}$/);
  assert.notEqual(arm.run_id, PARENT_RUN, "NEW_RUN_ID_REQUIRED");
  assert.equal(arm.attempt_ordinal, 2, "RETRY_ORDINAL_CHANGED");
  assert.equal(arm.first_execution_provider_calls, null, "UNKNOWN_PROVIDER_COUNT_MUST_REMAIN_UNKNOWN");
  assert(sha(arm.protected_main_sha), "EXACT_MAIN_BINDING_REQUIRED");
  assert.equal(observed.head, arm.protected_main_sha, "RETRY_STALE_HEAD");
  assert.equal(observed.protected_main, arm.protected_main_sha, "RETRY_STALE_MAIN");
  assert.equal(observed.clean_source, true, "RETRY_DIRTY_SOURCE");
  assert.equal(observed.windows_postmerge_verified, true, "WINDOWS_POSTMERGE_PROOF_REQUIRED");
  assert.equal(observed.qcp_blocker_count, 0, "RETRY_QCP_NOT_CLEAR");
  assert.equal(observed.inherited_qcp_check_count, 51, "PRIOR_51_CHECKS_REQUIRED");
  assert.equal(observed.frozen_runtime_paths_verified, 108, "FROZEN_RUNTIME_PROOF_REQUIRED");
  const now = instant(observed.now, "RETRY_CLOCK_INVALID");
  const authorized = instant(arm.authorized_at, "RETRY_AUTHORIZATION_CLOCK_INVALID");
  const base = instant(arm.qualification_first_base, "RETRY_BASE_INVALID");
  const expiry = instant(arm.expires_at, "RETRY_EXPIRY_INVALID");
  assert.notEqual(arm.qualification_first_base, OLD_BASE, "OLD_BASE_REUSE_FORBIDDEN");
  assert(authorized <= now, "AUTHORIZATION_FROM_FUTURE");
  assert(base - authorized > 6 * 3600000 && base - now > 6 * 3600000, "STRICT_SIX_HOUR_LEAD_REQUIRED");
  assert(expiry > now && expiry > base && expiry - authorized <= 24 * 3600000, "SHORT_LIVED_ARM_REQUIRED");
  const decision = arm.retry_adjudication;
  assert(decision && typeof decision.decision_id === "string" && decision.decision_id.trim(), "RETRY_ADJUDICATION_MISSING");
  assert.equal(decision.retry_admissible, true, "RETRY_NOT_ADJUDICATED");
  assert.equal(decision.prior_denial_explicitly_superseded, true, "PRIOR_RETRY_DENIAL_NOT_SUPERSEDED");
  assert.equal(decision.unknown_provider_count_acknowledged, true, "UNKNOWN_PROVIDER_COUNT_NOT_ADJUDICATED");
  assert.equal(decision.protected_main_sha, arm.protected_main_sha, "ADJUDICATION_STALE_MAIN");
  assert.equal(decision.run_id, arm.run_id, "ADJUDICATION_WRONG_RUN");
  assert.equal(decision.authorized_at, arm.authorized_at, "ADJUDICATION_WRONG_CLOCK");
  assert.equal(decision.first_failure_phase, "UNKNOWN", "UNPROVEN_ERROR_PHASE_RECLASSIFICATION");
  const expectedResources = {
    database_host: "127.0.0.1", database_port: arm.run_id==="800c023cf337"?55434:55432,
    audit_user: arm.run_id==="800c023cf337"?"qual_dedicated_admin":"qual_admin",
    negative_database: "mcft_cap09_requal_" + arm.run_id + "_negative",
    positive_database: "mcft_cap09_requal_" + arm.run_id + "_positive",
    bucket_endpoint: "http://127.0.0.1:59000", bucket: "mcft-cap09-requal-" + arm.run_id,
  };
  assert.deepEqual(arm.resources, expectedResources, "EXACT_ISOLATED_RESOURCES_REQUIRED");
  assert.deepEqual(observed.resources, expectedResources, "READBACK_RESOURCE_IDENTITY_MISMATCH");
  assert.deepEqual(Object.keys(arm.evidence_sha256).sort(), Object.keys(DEFAULT_ARM.evidence_sha256).sort(), "EVIDENCE_SET_CHANGED");
  for (const [key, value] of Object.entries(arm.evidence_sha256)) {
    assert(digest(value), "REVIEWED_EVIDENCE_HASH_MISSING:" + key);
    if (Object.hasOwn(ANCHORS, key)) assert.equal(value, ANCHORS[key], "FIRST_EVIDENCE_ANCHOR_CHANGED:" + key);
    assert.equal(observed.evidence_sha256?.[key], value, "EVIDENCE_HASH_MISMATCH:" + key);
  }
  const readback = observed.fresh_readback;
  assert(readback && readback.source_head === arm.protected_main_sha, "FRESH_READBACK_SUBJECT_REQUIRED");
  const started = instant(readback.started_at, "READBACK_START_INVALID");
  const completed = instant(readback.completed_at, "READBACK_COMPLETION_INVALID");
  // Proposed five-minute freshness ceiling; this candidate grants no live authority.
  assert(started >= authorized && completed >= started && completed <= now && now - started <= 300000,
    "FRESH_IMMEDIATE_READBACK_REQUIRED");
  assert.equal(readback.owner_isolation_verified, true, "OWNER_ISOLATION_REQUIRED");
  assert.equal(readback.production_bindings_present, false, "PRODUCTION_BINDING_FORBIDDEN");
  assert.equal(readback.databases?.length, 2, "BOTH_DATABASES_REQUIRED");
  for (const name of [expectedResources.negative_database, expectedResources.positive_database]) {
    const rows = readback.databases.filter(x => x.database === name);
    assert.equal(rows.length, 1, "DATABASE_IDENTITY_MISMATCH");
    assert.equal(rows[0].status, "READBACK_PASS", "DATABASE_READBACK_FAILED");
    assert.equal(rows[0].username, expectedResources.audit_user, "AUDIT_USER_MISMATCH");
    assert.equal(rows[0].table_count, 29, "DATABASE_TABLE_SET_CHANGED");
    assert.equal(rows[0].all_rows_zero, true, "DATABASE_NOT_EMPTY");
  }
  for (const key of ["current", "versions", "delete_markers", "multipart"]) {
    const item = readback.bucket?.[key];
    assert(item && item.status === "READBACK_PASS" && item.count === 0 && item.truncated === false,
      "BUCKET_READBACK_NOT_EMPTY_OR_INCOMPLETE:" + key);
  }
  assert(typeof arm.output_directory === "string" && path.win32.isAbsolute(arm.output_directory), "ABSOLUTE_NEW_OUTPUT_REQUIRED");
  assert(path.win32.basename(arm.output_directory).includes(arm.run_id), "OUTPUT_RUN_BINDING_REQUIRED");
  assert.equal(observed.output_directory, arm.output_directory, "OUTPUT_PATH_MISMATCH");
  assert.equal(observed.output_exists, false, "OUTPUT_REUSE_FORBIDDEN");
  assert.equal(observed.output_seen_in_attempt_ledger, false, "PREVIOUS_OUTPUT_REUSE_FORBIDDEN");
  assert.equal(observed.original_evidence_preserved, true, "ORIGINAL_EVIDENCE_NOT_PRESERVED");
  return {status: "PROPOSAL_PRECONDITIONS_PASS_NOT_EXECUTION_AUTHORITY", execute_authorized: false,
    retry_authorized: false, activation_implemented: false};
}
module.exports = {ARM_PATH, DEFAULT_ARM, ANCHORS, validateDisabledArm, assessActivationProposal};
if (require.main === module) {
  try {
    assert.equal(process.argv.length, 2, "NO_OPERATOR_OVERRIDE_ARGUMENTS_ALLOWED");
    const arm = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../..", ARM_PATH), "utf8"));
    console.log(JSON.stringify(validateDisabledArm(arm), null, 2));
    process.exitCode = 2;
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
