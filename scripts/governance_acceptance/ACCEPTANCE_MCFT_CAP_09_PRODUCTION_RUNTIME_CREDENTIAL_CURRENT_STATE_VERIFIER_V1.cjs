#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const VERIFIER = path.join(
  ROOT,
  "scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_PRODUCTION_RUNTIME_CREDENTIAL_READINESS_V1.cjs",
);
const AUTHORITY = path.join(
  ROOT,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-RUNTIME-PRIVATE-STORE-BINDING-V1.json",
);
const OUT = path.join(
  ROOT,
  "acceptance-output/MCFT_CAP_09_PRODUCTION_RUNTIME_CREDENTIAL_CURRENT_STATE_VERIFIER_V1_RESULT.json",
);

function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value, null, 2));
}

function requireMarker(source, marker, code) {
  assert.equal(source.includes(marker), true, code + ":" + marker);
}

function forbidMarker(source, marker, code) {
  assert.equal(source.includes(marker), false, code + ":" + marker);
}

function main() {
  const source = fs.readFileSync(VERIFIER, "utf8");
  const authority = JSON.parse(fs.readFileSync(AUTHORITY, "utf8"));
  const readiness = authority.credential_rematerialization_readiness_contract;

  assert.equal(readiness.new_current_state_verifier_required, true, "CURRENT_STATE_VERIFIER_AUTHORITY_REQUIRED");
  assert.equal(readiness.historical_zero_row_provisioning_verifier_reuse_forbidden, true, "HISTORICAL_ZERO_ROW_REUSE_MUST_BE_FORBIDDEN");
  assert.equal(readiness.exact_table_count, 41, "CURRENT_STATE_EXACT_41_TABLE_CONTRACT_REQUIRED");
  assert.equal(readiness.non_lease_production_state_rows_must_be_zero, true, "CURRENT_STATE_NON_LEASE_ZERO_CONTRACT_REQUIRED");
  assert.equal(readiness.historical_expired_evidence_lease_residue_allowed, true, "CURRENT_STATE_EVIDENCE_RESIDUE_CONTRACT_REQUIRED");
  assert.equal(readiness.historical_expired_twin_lease_residue_allowed, true, "CURRENT_STATE_TWIN_RESIDUE_CONTRACT_REQUIRED");
  assert.equal(readiness.current_live_evidence_owner_count_required, 0, "CURRENT_STATE_EVIDENCE_LIVE_ZERO_CONTRACT_REQUIRED");
  assert.equal(readiness.current_live_twin_owner_count_required, 0, "CURRENT_STATE_TWIN_LIVE_ZERO_CONTRACT_REQUIRED");
  assert.equal(readiness.login_role_recreation_allowed, false, "CURRENT_STATE_LOGIN_RECREATE_FORBIDDEN");
  assert.equal(readiness.password_rotation_only, true, "CURRENT_STATE_PASSWORD_ROTATION_ONLY_REQUIRED");

  for (const marker of [
    'const EVIDENCE_LEASE = "external_evidence_producer_lease_v1"',
    'const TWIN_LEASE = "twin_runtime_lease_v1"',
    'tableNames.length, 41',
    'if (LEASE_TABLES.has(table)) continue',
    'SELECT count(*)::int FROM public.',
    'nonLeaseRows, 0',
    'expires_at > clock_timestamp()',
    'expires_at <= clock_timestamp()',
    'row[1], 0',
    'row[2], row[0]',
    'RUNTIME_CREDENTIAL_EXISTING_LOGIN_PRINCIPALS_REQUIRED',
    'RUNTIME_CREDENTIAL_EXACT_ONE_MEMBERSHIP',
    'RUNTIME_CREDENTIAL_OPPOSITE_PRIVILEGE_FORBIDDEN',
    'historical_zero_row_provisioning_verifier_reused: false',
    'credential_rematerialization_pre_rotation_ready: true',
    'runtime_process_start: false',
    'production_owner_activation: false',
    'formal_v5_arm: false',
    'a0_bootstrap: false',
    'o00_started: false',
  ]) {
    requireMarker(source, marker, "CURRENT_STATE_VERIFIER_MARKER_REQUIRED");
  }

  for (const forbidden of [
    "VERIFY_MCFT_CAP_09_PRODUCTION_SERVICE_LOGIN_READINESS_V1.cjs",
    "MCFT_CAP_09_PRODUCTION_SERVICE_LOGIN_READINESS_V1_RESULT.json",
    "SERVICE_LOGIN_READINESS_NONZERO_TABLE",
  ]) {
    forbidMarker(source, forbidden, "HISTORICAL_ZERO_ROW_VERIFIER_REUSE_FORBIDDEN");
  }

  const sqlMutationPattern = /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE\s+(?:ROLE|TABLE|SCHEMA)|ALTER\s+ROLE|DROP\s+(?:ROLE|TABLE|SCHEMA)|GRANT|REVOKE)\b/i;
  assert.equal(sqlMutationPattern.test(source), false, "CURRENT_STATE_VERIFIER_MUST_REMAIN_READ_ONLY");

  write({
    schema_version: "geox_mcft_cap09_production_runtime_credential_current_state_verifier_qualification_v1",
    status: "PASS",
    verifier_ref: "scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_PRODUCTION_RUNTIME_CREDENTIAL_READINESS_V1.cjs",
    verifier_semantics: "RESIDUE_AWARE_CURRENT_STATE_PRE_ROTATION_V1",
    exact_table_count: 41,
    non_lease_table_count: 39,
    allowed_residue_tables: [
      "external_evidence_producer_lease_v1",
      "twin_runtime_lease_v1"
    ],
    historical_zero_row_verifier_reused: false,
    live_owner_count_required: {
      evidence: 0,
      twin: 0
    },
    read_only_verifier: true,
    database_password_rotated: false,
    login_role_recreated: false,
    runtime_process_start: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false
  });
}

try {
  main();
} catch (error) {
  write({
    schema_version: "geox_mcft_cap09_production_runtime_credential_current_state_verifier_qualification_v1",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    database_password_rotated: false,
    login_role_recreated: false,
    runtime_process_start: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false
  });
  console.error(error);
  process.exitCode = 1;
}
