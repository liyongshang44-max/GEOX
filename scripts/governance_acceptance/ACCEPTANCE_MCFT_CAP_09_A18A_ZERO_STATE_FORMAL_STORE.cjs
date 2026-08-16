const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const AUTH_PATH = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A18A-ZERO-STATE-FORMAL-STORE-IDENTITY-AND-SCHEMA-PREFLIGHT-V1.json';
const AMENDMENT_PATH = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-18-PREWINDOW-STATE-CONTINUITY-AND-FORMAL-STORE-REBASE-AUTHORITY.md';
const PREFLIGHT_PATH = 'scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_A18A_ZERO_STATE_FORMAL_STORE.ts';
const OUT = 'acceptance-output/MCFT_CAP_09_A18A_ZERO_STATE_FORMAL_STORE_GOVERNANCE_RESULT.json';
const auth = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'));
const amendment = fs.readFileSync(AMENDMENT_PATH, 'utf8');
const preflight = fs.readFileSync(PREFLIGHT_PATH, 'utf8');

assert.equal(auth.exact_base_main_sha, '799a29292b61248b9a037c9200c904f6fda7be66');
assert.equal(auth.formal_database_identity.database_name, 'geox_mcft_cap09_s6_formal_t3r1_24h_v2');
assert.equal(auth.formal_database_identity.historical_database_name_forbidden_for_execution, 'geox_mcft_cap09_s6_formal_t3r1_24h');
assert.equal(auth.formal_database_identity.creation_mode, 'CREATE_DATABASE_TEMPLATE0_NO_DATA_CLONE');
assert.equal(auth.schema_provenance.copy_mode, 'CATALOG_SHAPE_ONLY_NO_ROWS');
assert.equal(auth.schema_provenance.required_table_count, 12);
assert.equal(auth.schema_provenance.required_tables.length, 12);
assert.equal(auth.selected_epoch.prewindow_a0_logical_time, '2026-08-17T19:00:00.000Z');
assert.equal(auth.selected_epoch.o00_logical_time, '2026-08-17T20:00:00.000Z');
assert.equal(Date.parse(auth.selected_epoch.o00_logical_time) - Date.parse(auth.selected_epoch.prewindow_a0_logical_time), 3600000);
for (const value of Object.values(auth.zero_state_requirements)) assert.equal(value, 0);
assert.equal(auth.nonclaims.ea5e3_authorized, false);
assert.equal(auth.nonclaims.formal_o00_started, false);
assert.equal(auth.nonclaims.formal_execution_count, '0/24');
assert.equal(auth.next_legal_frontier_after_effectiveness, 'A18B_PREWINDOW_A0_AND_REPLACEMENT_RUNTIME_CONFIG_CHAIN');

assert(amendment.includes('A18A  zero-state Formal store identity + schema preflight'), 'AMENDMENT18_A18A_FRONTIER_REQUIRED');
assert(amendment.includes('Creating the new empty store is a store-identity rebase, not a migration of canonical facts.'), 'AMENDMENT18_NO_CANONICAL_FACT_MIGRATION_REQUIRED');
assert(amendment.includes('contain zero canonical facts, zero active lineage, zero State/latest checkpoint/latest Forecast, zero scheduler slots/cursor and zero Runtime lease before bootstrap'), 'AMENDMENT18_ZERO_STATE_STORE_REQUIRED');
assert(preflight.includes('BEGIN TRANSACTION READ ONLY'), 'A18A_READ_ONLY_PREFLIGHT_REQUIRED');
assert(preflight.includes('A18A_HISTORICAL_STORE_REUSE_FORBIDDEN'), 'A18A_OLD_STORE_FAIL_CLOSED_REQUIRED');
assert(preflight.includes('A18A_COLUMN_FINGERPRINT_DRIFT'), 'A18A_COLUMN_FINGERPRINT_REQUIRED');
assert(preflight.includes('A18A_CONSTRAINT_FINGERPRINT_DRIFT'), 'A18A_CONSTRAINT_FINGERPRINT_REQUIRED');
assert(preflight.includes('A18A_INDEX_FINGERPRINT_DRIFT'), 'A18A_INDEX_FINGERPRINT_REQUIRED');
for (const forbidden of ['freshness_is_late_authoritative_admission_gate = true', 'scheduler_eligibility_lag_hours = 7', 'T+07:12', 'T+07:17']) {
  assert(!JSON.stringify(auth).includes(forbidden), `A18A_SEMANTIC_REGRESSION_FORBIDDEN:${forbidden}`);
}

const result = {
  schema_version: 'geox_mcft_cap09_a18a_zero_state_formal_store_governance_result_v1',
  status: 'PASS',
  exact_base_main_sha: auth.exact_base_main_sha,
  database_name: auth.formal_database_identity.database_name,
  historical_store_forbidden: true,
  template0_no_data_clone: true,
  required_table_count: auth.schema_provenance.required_table_count,
  column_fingerprint_md5: auth.schema_provenance.column_fingerprint_md5,
  constraint_fingerprint_md5: auth.schema_provenance.constraint_fingerprint_md5,
  index_fingerprint_md5: auth.schema_provenance.index_fingerprint_md5,
  zero_state_required: true,
  prewindow_a0_logical_time: auth.selected_epoch.prewindow_a0_logical_time,
  o00_logical_time: auth.selected_epoch.o00_logical_time,
  canonical_pt1h_continuity_preserved: true,
  ea5e3_authorized: false,
  formal_o00_started: false,
  formal_execution_count: '0/24'
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
