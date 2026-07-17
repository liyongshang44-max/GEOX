// Legacy filename retained so existing required checks do not break during the S5-entry correction.
// Direct S5 authorization is superseded. This compatibility Gate consumes structured S4 evidence and requires S5 to remain blocked.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const S4_RESULT = path.join(ROOT, 'acceptance-output/MCFT_CAP_06_S4_GOVERNANCE_RESULT.json');
const ENTRY = path.join(ROOT, 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-ENTRY-PREREQUISITE.json');

cp.execFileSync('node', ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_STABILIZATION.cjs'], {
  cwd: ROOT,
  stdio: 'inherit'
});

const s4 = JSON.parse(fs.readFileSync(S4_RESULT, 'utf8'));
const entry = JSON.parse(fs.readFileSync(ENTRY, 'utf8'));
assert.equal(s4.schema_version, 'geox_mcft_cap_06_s4_governance_result_v1');
assert.equal(s4.status, 'PASS');
assert.equal(s4.canonical_write_count, 0);
assert.equal(s4.s5_authorized, false);
assert.equal(entry.schema_version, 'geox_mcft_cap_06_s5_entry_prerequisite_v1');
assert.equal(entry.status, 'AUTHORIZED_NOT_STARTED');
assert.equal(entry.s5_authorized, false);

console.log(JSON.stringify({
  schema_version: 'geox_mcft_cap_06_s4_effectiveness_s5_authorization_compatibility_result_v1',
  status: 'PASS',
  direct_s5_authorization_superseded: true,
  s5_entry_authorized: true,
  s5_authorized: false,
  canonical_write_count: 0
}));
