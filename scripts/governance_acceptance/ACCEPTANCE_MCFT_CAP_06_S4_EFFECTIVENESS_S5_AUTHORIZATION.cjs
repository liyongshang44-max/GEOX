// Legacy filename retained so existing required checks remain stable.
// Direct S5 authorization by S4 is superseded; current authority must progress monotonically through S5 entry, graph conformance, S5 effectiveness and bounded S6 authorization.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const S4_RESULT = path.join(ROOT, 'acceptance-output/MCFT_CAP_06_S4_GOVERNANCE_RESULT.json');
const ENTRY = path.join(ROOT, 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-ENTRY-PREREQUISITE.json');
const DELIVERY = path.join(ROOT, 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json');
const S6 = 'MCFT-CAP-06.MCFT-06-09-11-12.PAIRED-HISTORICAL-SHADOW-COMPUTE-V1';

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
} else if (delivery.s5.effective === true) {
  assert.equal(delivery.s5_entry.effective, true);
  assert.equal(delivery.s5.authorized, true);
  assert.equal(delivery.s5.implementation_started, true);
  assert.equal(delivery.s5.candidate_implemented, true);
  assert.equal(delivery.active_delivery_slice_id, S6);
  assert.deepEqual(delivery.authorized_not_started_slices, [S6]);
  assert.equal(delivery.s6.authorized, true);
  assert.equal(delivery.s6.implementation_started, false);
  assert.equal(delivery.s6.canonical_write_authorized, false);
  assert.equal(delivery.s6.projection_write_authorized, false);
  assert.equal(delivery.s6.shadow_evaluation_append_authorized, false);
} else if (delivery.s5.authorized === true) {
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
  s5_effective: delivery.s5.effective === true,
  s6_authorized: delivery.s6?.authorized === true,
  s6_implementation_started: delivery.s6?.implementation_started === true,
  canonical_write_count: 0
}));
