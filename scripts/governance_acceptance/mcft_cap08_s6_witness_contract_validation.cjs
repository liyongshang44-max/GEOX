#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { loadCatalog } = require('./mcft_cap08_s6_materialize_ha_mapping_review.cjs');
function validateWitnessContracts(options = {}) {
  const c=loadCatalog(options); const phases=c.lifecycle.phases;
  assert.deepEqual(Object.keys(phases),['PER_RUN','CROSS_RUN','MERGE_SHA','RETENTION_ATTESTATION']);
  assert.deepEqual(Object.keys(c.lifecycle.non_ledger_phases),['EXACT_CANDIDATE_HEAD','FINAL_SETTLEMENT']);
  for (const phase of Object.values(c.lifecycle.non_ledger_phases)) assert.equal(phase.wrong_phase_status,'NOT_YET_ELIGIBLE');
  assert.deepEqual(phases.PER_RUN.required_instances,['RUN_A','RUN_B']);
  for (const phase of Object.values(phases)) { assert.equal(phase.wrong_phase_status,'NOT_YET_ELIGIBLE'); assert.equal(phase.allowed_terminal_statuses.includes('PASS'),true); }
  for (const [k,v] of Object.entries(c.lifecycle.status_contract)) if (k.endsWith('_forbidden') || k.endsWith('_required')) assert.equal(v,true,`LIFECYCLE:${k}`);
  assert.equal(c.lifecycle.expected_phase_witness_instance_count,47); assert.equal(c.lifecycle.combined_ha24_witness_forbidden,true);
  const canonical=c.closureMember.canonical_member_identity; assert.equal(canonical.excluded_fields.includes('operational_run_instance_id'),true); assert.equal(canonical.required_fields.includes('operational_run_instance_id'),false);
  assert.equal(c.closureMember.operational_provenance.required_fields.includes('operational_run_instance_id'),true);
  assert.equal(c.closureMember.counting_contract.global_facts_count_forbidden,true); assert.equal(c.closureMember.counting_contract.global_object_type_count_forbidden,true); assert.equal(c.closureMember.counting_contract.unscoped_projection_count_forbidden,true);
  for (const pc of Object.values(c.proofContracts)) {
    const profile=c.mapping.selector_profiles[pc.selector_profile]; assert.equal(profile.global_table_count_forbidden,true); assert.equal(profile.global_type_count_forbidden,true);
    if (pc.phase==='PER_RUN') { assert.equal(pc.instance_policy,'BOTH_FORMAL_RUN_INSTANCES'); assert.equal(profile.operational_run_instance_id_required_in_witness_provenance,true); }
  }
  assert.equal(c.closureContract.hard_acceptance_identity_namespace_forbidden,true); assert.equal(c.closureContract.obligations.length,8);
  for (const row of c.closureContract.obligations) { assert.match(row.obligation_id,/^FC-\d{2}$/); assert.equal(Object.hasOwn(row,'item_id'),false); assert.equal(Object.hasOwn(row,'requirement'),false); }
  return { lifecycle_phase_count:4, expected_phase_witness_instance_count:47, closure_contract_obligation_count:8, canonical_operational_identity_separated:true };
}
if (require.main===module) console.log(JSON.stringify({status:'PASS',...validateWitnessContracts()},null,2));
module.exports={validateWitnessContracts};
