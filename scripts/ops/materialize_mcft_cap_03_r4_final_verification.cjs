'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const mainVerificationPath = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-MAIN-VERIFICATION.json';
const finalVerificationPath = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-FINAL-VERIFICATION.json';
const acceptancePath = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_R4_FINAL_VERIFICATION.cjs';
const deliveryPath = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json';
const amendmentPath = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-VERSIONED-CONTRACT-AMENDMENT-01.md';
const r4aPath = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-A-EVIDENCE-CLASSIFICATION-STATUS.json';
const r4bPath = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-B-RUNTIME-CONFIG-PIN-STATUS.json';
const r4cPath = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-C-SSOT-RECONCILIATION-STATUS.json';

const absolute = (relativePath) => path.join(root, relativePath);
const readJson = (relativePath) => JSON.parse(fs.readFileSync(absolute(relativePath), 'utf8'));

const delivery = readJson(deliveryPath);
const r4a = readJson(r4aPath);
const r4b = readJson(r4bPath);
const r4c = readJson(r4cPath);
const amendment = fs.readFileSync(absolute(amendmentPath), 'utf8');

if (delivery.active_delivery_slice_id !== null) throw new Error('R4_FINAL_ACTIVE_SLICE_NOT_NULL');
if (!Array.isArray(delivery.pending_completion_claims) || delivery.pending_completion_claims.length !== 0) {
  throw new Error('R4_FINAL_PENDING_COMPLETION_CLAIMS_NOT_EMPTY');
}
if (!Array.isArray(delivery.effective_completion_claims) || delivery.effective_completion_claims.length !== 15) {
  throw new Error('R4_FINAL_EFFECTIVE_COMPLETION_CLAIM_COUNT_MISMATCH');
}
if (delivery.versioned_contract_authority?.amendment_status !== 'EFFECTIVE') {
  throw new Error('R4_FINAL_VERSIONED_AMENDMENT_NOT_EFFECTIVE');
}
if (r4a.status !== 'MERGED_EFFECTIVE' || r4b.status !== 'MERGED_EFFECTIVE' || r4c.status !== 'MERGED_EFFECTIVE') {
  throw new Error('R4_FINAL_REMEDIATION_PREDECESSOR_NOT_EFFECTIVE');
}
if (!amendment.includes('`EFFECTIVE`')) throw new Error('R4_FINAL_AMENDMENT_STATUS_NOT_EFFECTIVE');

const finalVerification = {
  schema_version: 'geox_mcft_cap_03_r4_final_verification_v1',
  verification_identity: 'GEOX-MCFT-CAP-03-R4-FINAL-VERIFICATION-V1',
  capability_line_id: 'MCFT-CAP-03',
  display_alias: 'MCFT-3',
  name: 'Observation Assimilation and State Innovation',
  runtime_mode: 'REPLAY',
  target_completion_level: 'Level A',
  baseline_main_commit: '852ec425ed97007b82de05dd57bd32d3de0a039f',
  branch: 'mcft-cap-03-r4-final-verification-v1',
  status: 'CANDIDATE_VALIDATED_NOT_EFFECTIVE',
  audit_issue_number: 2368,
  corrected_findings: {
    selected_only_evaluated_observation_refs: true,
    multiple_usable_observation_full_tick: true,
    rejected_only_candidate_sets_commit_no_usable_tick: true,
    actual_quantity_and_unit_rejection_trace: true,
    explicit_runtime_config_ref_hash_pin: true,
    delivery_ssot_terminal_state: true,
    additive_v2_contract_authority_formalized: true
  },
  remediation_evidence: {
    r4_a: {
      implementation_pr_number: 2369,
      implementation_exact_head_ci: 'CI_4779',
      implementation_merge_commit: '733ad3362338a3b6aac170a5a102f4c4ae1758cc',
      effectiveness_pr_number: 2370,
      effectiveness_merge_commit: '5d19ea4d70bd1143b77c102847278853e4f75b36',
      runtime_acceptance: 'PASS_8_OF_8',
      status: r4a.status
    },
    r4_b: {
      implementation_pr_number: 2371,
      implementation_exact_head_ci: 'CI_4785',
      implementation_merge_commit: '518a4beb600a90a01be5f06ec848b8d31bb2950e',
      effectiveness_pr_number: 2372,
      effectiveness_merge_commit: 'f4b3c0d297d213660ed492029db49f9c5688fa91',
      runtime_acceptance: 'PASS_5_OF_5',
      status: r4b.status
    },
    r4_c: {
      implementation_pr_number: 2373,
      implementation_exact_head_ci: 'CI_4791',
      implementation_merge_commit: '8317ee3380a27a27d1eb9038a6470866d694e691',
      effectiveness_pr_number: 2374,
      effectiveness_exact_head_ci: 'CI_4797',
      effectiveness_merge_commit: '852ec425ed97007b82de05dd57bd32d3de0a039f',
      governance_acceptance: 'PASS_4_OF_4',
      status: r4c.status
    }
  },
  active_contract_authority: {
    historical_record_set_contract_id: 'MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1',
    active_record_set_contract_id: 'MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2',
    active_evidence_window_contract_id: 'MCFT_CAP_03_ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_V2',
    active_observation_selector_id: 'LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V2',
    assimilation_method_id: 'SCALAR_GAUSSIAN_ASSIMILATION_V1',
    amendment_ref: amendmentPath,
    amendment_status: 'EFFECTIVE',
    historical_v1_immutable: true,
    explicit_version_dispatch: true
  },
  task_conformance: {
    status: 'VERIFIED_AFTER_R4_REMEDIATION',
    original_audit_hard_acceptance_count: 123,
    originally_fully_conformant_count: 114,
    originally_nonconformant_count: 6,
    originally_contract_deviation_count: 3,
    remaining_nonconformant_count: 0,
    remaining_unadjudicated_contract_deviation_count: 0
  },
  delivery_ssot: {
    active_delivery_slice_id: null,
    pending_completion_claim_count: 0,
    effective_completion_claim_count: 15,
    capability_status: delivery.capability_status,
    successor_capability_line_id: delivery.successor_capability_line_id,
    successor_authorized: false
  },
  preserved_nonclaims: [...delivery.preserved_nonclaims],
  exact_changed_file_boundary: [
    mainVerificationPath,
    finalVerificationPath,
    acceptancePath
  ],
  candidate_validation: {
    governance_acceptance: 'REQUIRED',
    historical_r4_a_acceptance: 'REQUIRED',
    historical_r4_b_acceptance: 'REQUIRED'
  },
  effectiveness_condition: 'R4_FINAL_VERIFICATION_PR_MERGED_TO_MAIN_AND_EXACT_HEAD_CI_PASS_AND_MERGE_TREE_EQUIVALENCE_PASS',
  effectiveness_condition_satisfied: false,
  successor_capability_line_id: 'MCFT-CAP-04',
  successor_authorized: false
};
fs.writeFileSync(absolute(finalVerificationPath), `${JSON.stringify(finalVerification, null, 2)}\n`, 'utf8');

const mainVerification = readJson(mainVerificationPath);
mainVerification.post_completion_remediation_verification = {
  audit_issue_number: 2368,
  verification_ref: finalVerificationPath,
  verification_status: 'CANDIDATE_VALIDATED_NOT_EFFECTIVE',
  baseline_main_commit: '852ec425ed97007b82de05dd57bd32d3de0a039f',
  r4_a_status: 'MERGED_EFFECTIVE',
  r4_b_status: 'MERGED_EFFECTIVE',
  r4_c_status: 'MERGED_EFFECTIVE',
  task_conformance_status: 'VERIFIED_AFTER_R4_REMEDIATION',
  remaining_nonconformant_hard_acceptance_count: 0,
  active_record_set_contract_id: 'MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2',
  successor_authorized: false
};
fs.writeFileSync(absolute(mainVerificationPath), `${JSON.stringify(mainVerification, null, 2)}\n`, 'utf8');

const acceptance = `'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const json = (relativePath) => JSON.parse(read(relativePath));
let pass = 0;
const ok = (message) => { pass += 1; console.log('PASS ' + message); };

const finalVerification = json('${finalVerificationPath}');
assert.equal(finalVerification.status, 'CANDIDATE_VALIDATED_NOT_EFFECTIVE');
assert.equal(finalVerification.task_conformance.remaining_nonconformant_count, 0);
assert.equal(finalVerification.task_conformance.remaining_unadjudicated_contract_deviation_count, 0);
assert.equal(finalVerification.delivery_ssot.effective_completion_claim_count, 15);
assert.equal(finalVerification.successor_authorized, false);
ok('R4 final verification candidate closes all audited conformance findings without authorizing CAP-04');

const mainVerification = json('${mainVerificationPath}');
assert.equal(mainVerification.status, 'VERIFIED_ON_MAIN');
assert.equal(mainVerification.capability_complete, true);
assert.equal(mainVerification.post_completion_remediation_verification.verification_ref, '${finalVerificationPath}');
assert.equal(mainVerification.post_completion_remediation_verification.task_conformance_status, 'VERIFIED_AFTER_R4_REMEDIATION');
assert.equal(mainVerification.post_completion_remediation_verification.remaining_nonconformant_hard_acceptance_count, 0);
assert.equal(mainVerification.successor_authorized, false);
ok('main verification references the R4 final verification and preserves capability and successor boundaries');

const delivery = json('${deliveryPath}');
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

const r4a = json('${r4aPath}');
const r4b = json('${r4bPath}');
const r4c = json('${r4cPath}');
assert.equal(r4a.status, 'MERGED_EFFECTIVE');
assert.equal(r4b.status, 'MERGED_EFFECTIVE');
assert.equal(r4c.status, 'MERGED_EFFECTIVE');
assert.equal(r4a.effectiveness_condition_satisfied, true);
assert.equal(r4b.effectiveness_condition_satisfied, true);
assert.equal(r4c.effectiveness_condition_satisfied, true);
ok('all three R4 remediation steps are merged-main effective');

console.log('MCFT-CAP-03 R4 final verification: ' + pass + ' PASS, 0 FAIL');
`;
fs.writeFileSync(absolute(acceptancePath), acceptance, 'utf8');

console.log('MCFT-CAP-03 R4 final verification materialization complete');
