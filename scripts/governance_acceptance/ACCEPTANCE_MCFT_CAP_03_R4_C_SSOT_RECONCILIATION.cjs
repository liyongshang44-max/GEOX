'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const json = (relativePath) => JSON.parse(read(relativePath));
let pass = 0;
const ok = (message) => { pass += 1; console.log('PASS ' + message); };

const taskPath = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-TASK.md';
const amendmentPath = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-VERSIONED-CONTRACT-AMENDMENT-01.md';
const deliveryPath = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json';
const statusPath = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-C-SSOT-RECONCILIATION-STATUS.json';

const task = read(taskPath);
assert.ok(task.includes('GEOX-MCFT-CAP-03-VERSIONED-CONTRACT-AMENDMENT-01.md'));
ok('task references the versioned contract amendment');

const amendment = read(amendmentPath);
for (const required of [
  'MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1',
  'MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2',
  'evaluated_observation_refs',
  'NOT_APPLIED / NO_USABLE_OBSERVATION',
  'Runtime Config ref and determinism hash',
  'MCFT-CAP-04',
]) assert.ok(amendment.includes(required), required);
ok('amendment freezes V1 history, V2 active authority, corrected evidence semantics, config pins, and nonclaims');

const delivery = json(deliveryPath);
assert.equal(delivery.active_delivery_slice_id, null);
assert.deepEqual(delivery.pending_completion_claims, []);
assert.equal(delivery.effective_completion_claims.length, 15);
assert.equal(delivery.versioned_contract_authority.historical_v1_immutable, true);
assert.equal(delivery.versioned_contract_authority.v1_v2_explicit_dispatch, true);
assert.equal(delivery.versioned_contract_authority.active_record_set_contract_id, 'MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2');
assert.equal(delivery.successor_authorized, false);
ok('Delivery SSOT is terminal, has fifteen effective claims, explicit V2 authority, and no successor authorization');

const r4a = json('docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-A-EVIDENCE-CLASSIFICATION-STATUS.json');
const r4b = json('docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-B-RUNTIME-CONFIG-PIN-STATUS.json');
assert.equal(r4a.status, 'MERGED_EFFECTIVE');
assert.equal(r4a.effectiveness_condition_satisfied, true);
assert.equal(r4b.status, 'MERGED_EFFECTIVE');
assert.equal(r4b.effectiveness_condition_satisfied, true);
ok('R4-A and R4-B merged-main effectiveness are prerequisites');

const status = json(statusPath);
assert.equal(status.status, 'CANDIDATE_VALIDATED_NOT_EFFECTIVE');
assert.equal(status.reconciliation_scope.active_delivery_slice_cleared, true);
assert.equal(status.reconciliation_scope.effective_completion_claim_count, 15);
assert.equal(status.successor_authorized, false);
ok('R4-C candidate remains ineffective until merge while preserving MCFT-CAP-04 boundary');

console.log('MCFT-CAP-03 R4-C SSOT reconciliation: ' + pass + ' PASS, 0 FAIL');
