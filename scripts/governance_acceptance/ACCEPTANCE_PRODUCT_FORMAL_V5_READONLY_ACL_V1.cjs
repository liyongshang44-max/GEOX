#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const runner = read("scripts/runtime_acceptance/RUN_PRODUCT_FORMAL_V5_READONLY_ACL_PROVISIONING_V1.ts");
const verifier = read("scripts/runtime_acceptance/VERIFY_PRODUCT_FORMAL_V5_READONLY_ACL_V1.ts");

const requiredTables = [
  "facts",
  "twin_active_lineage_index_v1",
  "twin_state_latest_index_v1",
  "twin_state_history_projection_v1",
];
const requiredPrincipals = [
  "geox_product_readonly_login_v1",
  "geox_product_readonly_v1",
];

assert.match(runner, /--operator-authorized/);
assert.match(runner, /PRODUCT_FORMAL_V5_ACL_EXPLICIT_OPERATOR_AUTHORIZATION_REQUIRED/);
assert.match(runner, /GRANT SELECT ON TABLE/);
assert.match(runner, /grant_option:\s*false/);
assert.match(runner, /role_creation:\s*false/);
assert.match(runner, /role_membership_change:\s*false/);
assert.match(runner, /schema_change:\s*false/);
assert.match(runner, /default_privilege_change:\s*false/);
assert.match(runner, /revoke_operation:\s*false/);
assert.match(runner, /a0_execution:\s*false/);
assert.match(runner, /o00_execution:\s*false/);

for (const table of requiredTables) {
  assert.ok(runner.includes(`"${table}"`), table);
  assert.ok(verifier.includes(`"${table}"`), table);
}
for (const principal of requiredPrincipals) {
  assert.ok(runner.includes(`"${principal}"`), principal);
  assert.ok(verifier.includes(`"${principal}"`), principal);
}

for (const forbidden of [
  /CREATE\s+ROLE/i,
  /ALTER\s+ROLE/i,
  /GRANT\s+[^\n]*\s+TO\s+[^\n]*WITH\s+GRANT\s+OPTION/i,
  /GRANT\s+[^\n]*ROLE/i,
  /REVOKE\b/i,
  /ALTER\s+DEFAULT\s+PRIVILEGES/i,
  /CREATE\s+TABLE/i,
  /ALTER\s+TABLE/i,
  /DROP\s+TABLE/i,
  /INSERT\s+INTO/i,
  /UPDATE\s+public\./i,
  /DELETE\s+FROM/i,
]) {
  assert.doesNotMatch(runner, forbidden);
}

assert.match(verifier, /PRODUCT_FORMAL_V5_ACL_EFFECTIVE_SET_SIZE_MISMATCH/);
assert.match(verifier, /PRODUCT_FORMAL_V5_ACL_EXPECTED_GRANT_MISSING/);
assert.match(verifier, /PRODUCT_FORMAL_V5_ACL_MEMBERSHIP_FORBIDDEN/);
assert.match(verifier, /default_transaction_read_only=on/);
assert.match(verifier, /broader_table_privilege_count:\s*0/);
assert.match(verifier, /database_write:\s*false/);

console.log(JSON.stringify({
  schema_version: "geox_product_formal_v5_readonly_acl_acceptance_v1",
  status: "PASS",
  target_database: "geox_mcft_cap09_s6_formal_t4r1_24h_v5",
  principals: requiredPrincipals,
  table_select_surface: requiredTables,
  exact_grant_count: requiredPrincipals.length * requiredTables.length,
  operator_authorization_required: true,
  schema_change: false,
  role_creation: false,
  membership_change: false,
  default_privilege_change: false,
  revoke_operation: false,
  mcft_runtime_change: false,
  a0_execution: false,
  o00_execution: false,
}, null, 2));
