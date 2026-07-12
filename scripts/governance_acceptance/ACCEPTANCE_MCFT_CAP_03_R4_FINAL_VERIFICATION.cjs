'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const json = (relativePath) => JSON.parse(read(relativePath));
let pass = 0;
const ok = (message) => { pass += 1; console.log('PASS ' + message); };

const finalVerification = json('docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-FINAL-VERIFICATION.json');
assert.equal(finalVerification.status, 'CANDIDATE_VALIDATED_NOT_EFFECTIVE');
assert.equal(finalVerification.task_conformance.remaining_nonconformant_count, 0);
assert.equal(finalVerification.task_conformance.remaining_unadjudicated_contract_deviation_count, 0);
assert.equal(finalVerification.delivery_ssot.effective_completion_claim_count, 15);
assert.equal(finalVerification.successor_authorized, false);
ok('R4 final verification candidate closes all audited conformance findings without authorizing CAP-04');

const mainVerification = json('docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-MAIN-VERIFICATION.json');
assert.equal(mainVerification.status, 'VERIFIED_ON_MAIN');
assert.equal(mainVerification.capability_complete, true);
assert.equal(mainVerification.post_completion_remediation_verification.verification_ref, 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-FINAL-VERIFICATION.json');
assert.equal(mainVerification.post_completion_remediation_verification.task_conformance_status, 'VERIFIED_AFTER_R4_REMEDIATION');
assert.equal(mainVerification.post_completion_remediation_verification.remaining_nonconformant_hard_acceptance_count, 0);
assert.equal(mainVerification.successor_authorized, false);
ok('main verification references the R4 final verification and preserves capability and successor boundaries');

const delivery = json('docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json');
assert.equal(delivery.active_delivery_slice_id, null);
assert.deepEqual(delivery.pending_completion_claims, []);
assert.equal(delivery.effective_completion_claims.length, 15);
assert.equal(delivery.versioned_contract_authority.amendment_status, 'EFFECTIVE');
assert.equal(delivery.successor_authorized, false);
ok('Delivery SSOT remains terminal and version-authoritative');

const selector = read('apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v2.ts');
assert.ok(selector.includes('const evaluatedRefs = selectedRef === null ? [] : [selectedRef];'));
const tick = read('apps/server/src/runtime/twin_runtime/assimilated_continuation_tick_service_v2.ts');
assert.ok(tick.includes('assimilated_runtime_config_hash: string;'));
assert.ok(tick.includes('ASSIMILATED_RUNTIME_CONFIG_HASH_PIN_MISMATCH'));
ok('corrected Runtime source invariants remain present');

const r4a = json('docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-A-EVIDENCE-CLASSIFICATION-STATUS.json');
const r4b = json('docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-B-RUNTIME-CONFIG-PIN-STATUS.json');
const r4c = json('docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-C-SSOT-RECONCILIATION-STATUS.json');
assert.equal(r4a.status, 'MERGED_EFFECTIVE');
assert.equal(r4b.status, 'MERGED_EFFECTIVE');
assert.equal(r4c.status, 'MERGED_EFFECTIVE');
assert.equal(r4a.effectiveness_condition_satisfied, true);
assert.equal(r4b.effectiveness_condition_satisfied, true);
assert.equal(r4c.effectiveness_condition_satisfied, true);
ok('all three R4 remediation steps are merged-main effective');

console.log('MCFT-CAP-03 R4 final verification: ' + pass + ' PASS, 0 FAIL');
