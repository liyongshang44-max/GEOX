const assert = require('node:assert/strict');
const fs = require('node:fs');

const AUTH_PATH = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FRESH-ZERO-STATE-FORMAL-STORE-REQUALIFICATION-V1.json';
const RUNTIME_AUTH_PATH = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-RUNTIME-ENV-REQUALIFICATION-AUTHORITY-V1.json';
const PREFLIGHT_PATH = 'scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_FRESH_ZERO_STATE_FORMAL_STORE_V1.ts';
const WORKFLOW_PATH = '.github/workflows/mcft-cap-09-fresh-zero-state-formal-store-requalification.yml';
const OUT = 'acceptance-output/MCFT_CAP_09_FRESH_ZERO_STATE_FORMAL_STORE_GOVERNANCE_RESULT.json';

const auth = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'));
const runtimeAuth = JSON.parse(fs.readFileSync(RUNTIME_AUTH_PATH, 'utf8'));
const preflight = fs.readFileSync(PREFLIGHT_PATH, 'utf8');
const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

assert.equal(auth.status, 'CANDIDATE');
assert.equal(auth.exact_predecessor_main_sha, '051150d1355529cc3062b6a084fc4fe46f1d9047');
assert.equal(auth.failed_epoch.epoch_id, 'mcft_cap09_external_formal_window_epoch_20260817t200000z_v2');
assert.equal(auth.failed_epoch.reuse_forbidden, true);
assert.equal(auth.failed_epoch.formal_o00_started, false);
assert.equal(auth.formal_database_identity.project_id, 'delicate-glade-62464340');
assert.equal(auth.formal_database_identity.branch_id, 'br-cold-dust-a6j6aymz');
assert.equal(auth.formal_database_identity.database_name, 'geox_mcft_cap09_s6_formal_t3r1_24h_v3');
assert.equal(auth.formal_database_identity.failed_database_reuse_forbidden, 'geox_mcft_cap09_s6_formal_t3r1_24h_v2');
assert.equal(auth.formal_database_identity.creation_mode, 'CREATE_DATABASE_TEMPLATE0_NO_DATA_CLONE');
assert.equal(auth.schema_contract.required_table_count, 26);
assert.equal(auth.schema_contract.public_table_count, 26);
assert.equal(auth.schema_contract.column_fingerprint_md5, runtimeAuth.schema_contract.column_fingerprint_md5);
assert.equal(auth.schema_contract.constraint_fingerprint_md5, runtimeAuth.schema_contract.constraint_fingerprint_md5);
assert.equal(auth.schema_contract.index_fingerprint_md5, runtimeAuth.schema_contract.index_fingerprint_md5);
assert.equal(auth.schema_contract.historical_state_copy_forbidden, true);
assert.equal(auth.schema_contract.failed_epoch_state_copy_forbidden, true);
assert.equal(auth.schema_contract.all_required_relations_zero_state_required, true);
assert.equal(auth.qualification_contract.transaction_mode, 'READ_ONLY');
assert.equal(auth.qualification_contract.runtime_environment_schema_preflight_mode, 'zero-state');
assert.equal(auth.semantic_preservation.temporal_authority, 'PROVIDER_AVAILABILITY_WATERMARK_V1');
assert.equal(auth.semantic_preservation.freshness_is_late_authoritative_admission_gate, false);
assert.equal(auth.nonclaims.future_epoch_selected, false);
assert.equal(auth.nonclaims.new_a0_persisted, false);
assert.equal(auth.nonclaims.formal_o00_started, false);
assert.equal(auth.nonclaims.formal_execution_count, '0/24');
assert.equal(auth.nonclaims.mcft_cap09_completed, false);
assert.equal(auth.next_legal_frontier_after_effectiveness, 'NEW_FUTURE_EPOCH_SELECTION_AND_REPLACEMENT_A0_CONFIG_CHAIN');

assert(preflight.includes('BEGIN TRANSACTION READ ONLY'), 'FRESH_STORE_READ_ONLY_PREFLIGHT_REQUIRED');
assert(preflight.includes('FAILED_V2_STORE_REUSE_FORBIDDEN'), 'FAILED_V2_REUSE_GUARD_REQUIRED');
assert(preflight.includes('HISTORICAL_STORE_EXECUTION_REUSE_FORBIDDEN'), 'HISTORICAL_STORE_REUSE_GUARD_REQUIRED');
assert(preflight.includes('FRESH_STORE_PUBLIC_TABLE_COUNT_DRIFT'), 'EXACT_PUBLIC_TABLE_COUNT_GUARD_REQUIRED');
assert(workflow.includes('PREFLIGHT_MCFT_CAP_09_RUNTIME_ENVIRONMENT_V1.ts zero-state'), 'FROZEN_RUNTIME_SCHEMA_PREFLIGHT_REUSE_REQUIRED');
assert(workflow.includes('geox_mcft_cap09_s6_formal_t3r1_24h_v3'), 'V3_DATABASE_BINDING_REQUIRED');
assert(!workflow.includes('EXECUTE_MCFT_CAP_09_A18D_PREWINDOW_BOOTSTRAP'), 'A18D_EXECUTION_FORBIDDEN_IN_STORE_QUALIFICATION');
assert(!workflow.includes('RUN_MCFT_CAP_09'), 'FORMAL_RUNNER_FORBIDDEN_IN_STORE_QUALIFICATION');

for (const forbidden of [
  'freshness_is_late_authoritative_admission_gate = true',
  'scheduler_eligibility_lag_hours = 7',
  'T+07:12',
  'T+07:17',
]) {
  assert(!JSON.stringify(auth).includes(forbidden), `SEMANTIC_REGRESSION_FORBIDDEN:${forbidden}`);
}

fs.mkdirSync('acceptance-output', { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify({
  schema_version: 'geox_mcft_cap09_fresh_zero_state_formal_store_governance_result_v1',
  status: 'PASS',
  exact_predecessor_main_sha: auth.exact_predecessor_main_sha,
  database_name: auth.formal_database_identity.database_name,
  required_table_count: auth.schema_contract.required_table_count,
  fingerprints_bound_to_runtime_environment_authority: true,
  failed_v2_reuse_forbidden: true,
  historical_state_copy_forbidden: true,
  live_qualification_required_for_effectiveness: true,
  future_epoch_selected: false,
  a0_started: false,
  formal_o00_started: false,
  mcft_cap09_completed: false,
}, null, 2)}\n`);
console.log(fs.readFileSync(OUT, 'utf8'));
