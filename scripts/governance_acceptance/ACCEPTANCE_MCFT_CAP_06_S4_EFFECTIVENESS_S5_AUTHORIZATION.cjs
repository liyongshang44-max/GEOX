// Legacy filename retained so existing required checks remain stable.
// Direct S5 authorization by S4 is superseded; current S5 authority may only follow merged-effective S5 entry controls.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const S4_RESULT = path.join(ROOT, 'acceptance-output/MCFT_CAP_06_S4_GOVERNANCE_RESULT.json');
const ENTRY = path.join(ROOT, 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-ENTRY-PREREQUISITE.json');
const DELIVERY = path.join(ROOT, 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json');

cp.execFileSync('node', ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_STABILIZATION.cjs'], {
  cwd: ROOT,
  stdio: 'inherit'
});

const s4 = JSON.parse(fs.readFileSync(S4_RESULT, 'utf8'));
const entry = JSON.parse(fs.readFileSync(ENTRY, 'utf8'));
const delivery = JSON.parse(fs.readFileSync(DELIVERY, 'utf8'));
assert.equal(s4.schema_version, 'geox_mcft_cap_06_s4_governance_result_v1');
assert.equal(s4.status, 'PASS');
assert.equal(s4.canonical_write_count, 0);
assert.equal(entry.schema_version, 'geox_mcft_cap_06_s5_entry_prerequisite_v1');
assert.equal(entry.status, 'AUTHORIZED_NOT_STARTED');
assert.equal(entry.s5_authorized, false);
assert.equal(delivery.s5_entry.authorized, true);
assert.equal(delivery.s5_entry.effective, s4.s5_entry_effective);
assert.equal(delivery.s5.authorized, s4.s5_authorized);
if (delivery.s5_predecessor_graph_conformance?.effective !== true) {
  assert.equal(delivery.s5.authorized, false);
  assert.equal(delivery.s5.implementation_started, false);
}
if (delivery.s5.authorized === true) {
  assert.equal(delivery.s5_entry.effective, true);
  assert.equal(delivery.s5_predecessor_graph_conformance?.effective ?? true, true);
  assert.equal(delivery.s5.implementation_started, false);
}

console.log(JSON.stringify({
  schema_version: 'geox_mcft_cap_06_s4_effectiveness_s5_authorization_compatibility_result_v1',
  status: 'PASS',
  direct_s5_authorization_superseded: true,
  s5_entry_effective: delivery.s5_entry.effective,
  s5_graph_prerequisite_effective: delivery.s5_predecessor_graph_conformance?.effective ?? null,
  s5_authorized: delivery.s5.authorized,
  canonical_write_count: 0
}));
