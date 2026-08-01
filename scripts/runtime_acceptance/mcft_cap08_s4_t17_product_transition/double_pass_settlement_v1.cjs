#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../../..');
function read(attempt,name){return JSON.parse(fs.readFileSync(path.join(ROOT,`acceptance-output/t17-product-double-pass/attempt-${attempt}/${name}`),'utf8'));}
const results=[1,2].map(attempt=>({primary:read(attempt,'primary_result.json'),restart:read(attempt,'restart_result.json'),drop:read(attempt,'drop_result.json')}));
for(const [index,value] of results.entries()){
  assert.equal(value.primary.status,'PASS',`ATTEMPT_${index+1}_PRIMARY`);
  assert.equal(value.restart.status,'PASS',`ATTEMPT_${index+1}_RESTART`);
  assert.equal(value.restart.canonical_write_delta,0,`ATTEMPT_${index+1}_RESTART_DELTA`);
  assert.equal(value.drop.status,'PASS',`ATTEMPT_${index+1}_DROP`);
  assert.equal(value.drop.database_absent_after_drop,true,`ATTEMPT_${index+1}_DROP_ABSENCE`);
}
assert.notEqual(results[0].primary.operational_run_instance_id,results[1].primary.operational_run_instance_id,'INDEPENDENT_INSTANCE_IDS');
const output={schema_version:'geox_mcft_cap08_s4_t17_product_transition_double_pass_v1',status:'PASS',attempt_count:2,independent_fresh_database_count:2,complete_24_tick_pass_count:2,transition_guard_pass_count:2,restart_readback_pass_count:2,clean_drop_pass_count:2,formal_authority_chain_status:'PAUSED',formal_evidence_eligible:false};
const out=path.join(ROOT,'acceptance-output/MCFT_CAP_08_S4_T17_PRODUCT_TRANSITION_DOUBLE_PASS_RESULT.json');fs.writeFileSync(out,`${JSON.stringify(output,null,2)}\n`);console.log(JSON.stringify(output,null,2));
