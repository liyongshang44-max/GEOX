#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { loadCatalog, materialize } = require('./mcft_cap08_s6_materialize_ha_mapping_review.cjs');
function range(prefix, a, b) { return Array.from({ length: b - a + 1 }, (_, i) => `${prefix}${String(a + i).padStart(2, '0')}`); }
function validateMapping(options = {}) {
  const c = loadCatalog(options); const review = materialize(options);
  assert.equal(c.ledger.item_count, 24); assert.equal(c.ledger.items.length, 24);
  assert.equal(c.mapping.rule_count, 24); assert.equal(c.rules.length, 24);
  assert.deepEqual(c.rules.map((r) => r.ledger_index).sort((a,b)=>a-b), Array.from({length:24},(_,i)=>i));
  for (const rule of c.rules) { assert.equal(Object.hasOwn(rule, 'item_id'), false); assert.equal(Object.hasOwn(rule, 'requirement'), false); }
  assert.equal(c.mapping.rule_shards.length, 3); assert.equal(c.mapping.proof_contract_shards.length, 3);
  assert.equal(Object.keys(c.proofContracts).length, 25); assert.equal(review.expected_phase_witness_instance_count, 47);
  assert.equal(c.rules[0].finalization_profile, 'EXACT_CROSS_RUN_PAIR'); assert.deepEqual(c.rules[0].proof_contract_refs, ['PC-00']);
  for (let i=1;i<=22;i++) { assert.equal(c.rules[i].finalization_profile, 'BOTH_FORMAL_RUN_INSTANCES'); assert.equal(c.rules[i].proof_contract_refs.length, 1); assert.equal(c.proofContracts[c.rules[i].proof_contract_refs[0]].phase, 'PER_RUN'); }
  assert.equal(c.rules[23].finalization_profile, 'ALL_REQUIRED_PHASES'); assert.deepEqual(c.rules[23].proof_contract_refs, ['PC-23-1','PC-23-2']);
  assert.equal(c.proofContracts['PC-23-1'].phase, 'MERGE_SHA'); assert.equal(c.proofContracts['PC-23-2'].phase, 'RETENTION_ATTESTATION');
  assert.notEqual(c.proofContracts['PC-23-1'].producer_id, c.proofContracts['PC-23-2'].producer_id);
  assert.notEqual(c.proofContracts['PC-23-1'].selector_id, c.proofContracts['PC-23-2'].selector_id);
  assert.notEqual(c.proofContracts['PC-23-1'].object_set_id, c.proofContracts['PC-23-2'].object_set_id);
  assert.notEqual(c.proofContracts['PC-23-1'].counting_domain, c.proofContracts['PC-23-2'].counting_domain);
  const assim = ['T02','T03','T04','T10','T22']; const ticks = range('T',0,23); const dyn=ticks.filter((t)=>!assim.includes(t));
  assert.deepEqual(c.proofContracts['PC-04'].expected_contract.ordinary_assimilation_ticks, assim);
  assert.deepEqual(c.proofContracts['PC-03'].expected_contract.dynamics_only_ticks, dyn); assert.equal(dyn.length,19);
  assert.equal(c.proofContracts['PC-07'].expected_contract.total_forecast_point_count,1728);
  assert.equal(c.proofContracts['PC-08'].expected_contract.total_scenario_option_count,72); assert.equal(c.proofContracts['PC-08'].expected_contract.trajectory_point_count,5184);
  assert.deepEqual(c.proofContracts['PC-18'].expected_contract.residual_ids, range('R-',1,24));
  assert.deepEqual(c.proofContracts['PC-19'].expected_contract.calibration_ids, range('R-',1,16));
  assert.deepEqual(c.proofContracts['PC-19'].expected_contract.holdout_ids, range('R-',17,24));
  assert.equal(c.proofContracts['PC-19'].expected_contract.diagnostic_only_residual_id,'R-10');
  assert.equal(c.proofContracts['PC-20'].expected_contract.candidate_parameter_value,'0.034000');
  assert.equal(c.proofContracts['PC-22'].expected_contract.get_surface_count,10); assert.equal(c.proofContracts['PC-22'].expected_contract.timeline_pagination_until_cursor_null,true);
  for (const pc of Object.values(c.proofContracts)) { assert.ok(c.mapping.allowed_counting_domains.includes(pc.counting_domain)); assert.ok(c.mapping.selector_profiles[pc.selector_profile]); assert.ok(c.mapping.artifact_contract_profiles[pc.artifact_contract_profile]); assert.equal(Object.hasOwn(pc,'item_id'),false); assert.equal(Object.hasOwn(pc,'requirement'),false); }
  return { item_count:24, rule_count:24, proof_contract_count:25, phase_witness_instance_count:47, ordinary_assimilation_tick_count:5, dynamics_only_tick_count:19, ha24_split:true };
}
if (require.main === module) console.log(JSON.stringify({status:'PASS',...validateMapping()},null,2));
module.exports={validateMapping};
