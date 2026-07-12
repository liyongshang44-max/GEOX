'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const amendmentPath = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-VERSIONED-CONTRACT-AMENDMENT-01.md';
const deliveryPath = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json';
const statusPath = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-C-SSOT-RECONCILIATION-STATUS.json';
const acceptancePath = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_R4_C_EFFECTIVENESS.cjs';

const absolute = (relativePath) => path.join(root, relativePath);

const amendment = fs.readFileSync(absolute(amendmentPath), 'utf8');
const candidateMarker = '`CANDIDATE_NOT_EFFECTIVE`';
if (!amendment.includes(candidateMarker)) {
  throw new Error('R4_C_EFFECTIVENESS_AMENDMENT_CANDIDATE_MARKER_NOT_FOUND');
}
fs.writeFileSync(
  absolute(amendmentPath),
  amendment.replace(candidateMarker, '`EFFECTIVE`'),
  'utf8',
);

const delivery = JSON.parse(fs.readFileSync(absolute(deliveryPath), 'utf8'));
delivery.implementation_status = 'R4_REMEDIATION_MERGED_EFFECTIVE';
delivery.versioned_contract_authority.amendment_status = 'EFFECTIVE';
delivery.post_completion_remediation.r4_c_ssot_reconciliation_status = 'MERGED_EFFECTIVE';
delivery.post_completion_remediation.r4_c_pr_number = 2373;
delivery.post_completion_remediation.r4_c_exact_head_commit = '89958abf488e7997a220d5e799804377a8166ace';
delivery.post_completion_remediation.r4_c_exact_head_ci_run = 'CI_4791';
delivery.post_completion_remediation.r4_c_merge_commit = '8317ee3380a27a27d1eb9038a6470866d694e691';
delivery.post_completion_remediation.r4_c_head_merge_file_delta_count = 0;
delivery.post_completion_remediation.r4_c_effectiveness_condition_satisfied = true;
fs.writeFileSync(absolute(deliveryPath), `${JSON.stringify(delivery, null, 2)}\n`, 'utf8');

const status = JSON.parse(fs.readFileSync(absolute(statusPath), 'utf8'));
status.exact_pr_head_commit = '89958abf488e7997a220d5e799804377a8166ace';
status.implementation_pr_number = 2373;
status.implementation_ci_run = 'CI_4791';
status.implementation_build_test = 'PASS';
status.implementation_acceptance = 'PASS';
status.implementation_merge_commit = '8317ee3380a27a27d1eb9038a6470866d694e691';
status.head_merge_file_delta_count = 0;
status.head_merge_tree_equivalence = 'PASS';
status.status = 'MERGED_EFFECTIVE';
status.effectiveness_condition_satisfied = true;
status.successor_authorized = true;
status.effectiveness_changed_file_boundary = [
  amendmentPath,
  deliveryPath,
  statusPath,
  acceptancePath,
];
fs.writeFileSync(absolute(statusPath), `${JSON.stringify(status, null, 2)}\n`, 'utf8');

const acceptance = `'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const json = (relativePath) => JSON.parse(read(relativePath));
let pass = 0;
const ok = (message) => { pass += 1; console.log('PASS ' + message); };

const amendment = read('${amendmentPath}');
assert.ok(amendment.includes('`EFFECTIVE`'));
assert.ok(!amendment.includes('`CANDIDATE_NOT_EFFECTIVE`'));
ok('versioned contract amendment is effective');

const delivery = json('${deliveryPath}');
assert.equal(delivery.implementation_status, 'R4_REMEDIATION_MERGED_EFFECTIVE');
assert.equal(delivery.active_delivery_slice_id, null);
assert.deepEqual(delivery.pending_completion_claims, []);
assert.equal(delivery.effective_completion_claims.length, 15);
assert.equal(delivery.versioned_contract_authority.amendment_status, 'EFFECTIVE');
assert.equal(delivery.post_completion_remediation.r4_c_ssot_reconciliation_status, 'MERGED_EFFECTIVE');
assert.equal(delivery.post_completion_remediation.r4_c_head_merge_file_delta_count, 0);
assert.equal(delivery.successor_authorized, false);
ok('Delivery SSOT records effective R4 remediation and preserves terminal boundaries');

const status = json('${statusPath}');
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
`;
fs.writeFileSync(absolute(acceptancePath), acceptance, 'utf8');

console.log('MCFT-CAP-03 R4-C effectiveness materialization complete');
