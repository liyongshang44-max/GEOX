'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const json = (relativePath) => JSON.parse(read(relativePath));
let pass = 0;
const ok = (message) => { pass += 1; console.log('PASS ' + message); };

const amendment = read('docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-VERSIONED-CONTRACT-AMENDMENT-01.md');
assert.ok(amendment.includes('EFFECTIVE'));
assert.ok(!amendment.includes('CANDIDATE_NOT_EFFECTIVE'));
ok('versioned contract amendment is effective');

const delivery = json('docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json');
assert.equal(delivery.implementation_status, 'R4_REMEDIATION_MERGED_EFFECTIVE');
assert.equal(delivery.active_delivery_slice_id, null);
assert.deepEqual(delivery.pending_completion_claims, []);
assert.equal(delivery.effective_completion_claims.length, 15);
assert.equal(delivery.versioned_contract_authority.amendment_status, 'EFFECTIVE');
assert.equal(delivery.post_completion_remediation.r4_c_ssot_reconciliation_status, 'MERGED_EFFECTIVE');
assert.equal(delivery.post_completion_remediation.r4_c_head_merge_file_delta_count, 0);
assert.equal(delivery.successor_authorized, false);
ok('Delivery SSOT records effective R4 remediation and preserves terminal boundaries');

const status = json('docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-C-SSOT-RECONCILIATION-STATUS.json');
assert.equal(status.status, 'MERGED_EFFECTIVE');
assert.equal(status.effectiveness_condition_satisfied, true);
assert.equal(status.implementation_pr_number, 2373);
assert.equal(status.implementation_ci_run, 'CI_4791');
assert.equal(status.implementation_build_test, 'PASS');
assert.equal(status.implementation_acceptance, 'PASS');
assert.equal(status.head_merge_file_delta_count, 0);
assert.equal(status.successor_step_id, 'R4-FINAL-VERIFICATION');
assert.equal(status.successor_authorized, true);
ok('R4-C effectiveness evidence authorizes final verification only');

assert.ok(status.preserved_nonclaims.includes('NO_MCFT_CAP_04_AUTHORIZATION'));
assert.equal(delivery.successor_capability_line_id, 'MCFT-CAP-04');
assert.equal(delivery.successor_authorized, false);
ok('MCFT-CAP-04 remains unauthorized');

console.log('MCFT-CAP-03 R4-C effectiveness: ' + pass + ' PASS, 0 FAIL');
