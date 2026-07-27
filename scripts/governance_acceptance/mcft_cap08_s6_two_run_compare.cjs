#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_08_S6_TWO_RUN_COMPARISON_RESULT.json');
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const canonical=v=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`:JSON.stringify(v);
const digest=v=>`sha256:${crypto.createHash('sha256').update(canonical(v)).digest('hex')}`;
function write(v){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,`${JSON.stringify(v,null,2)}\n`)}
try{
 const a=read('acceptance-output/MCFT_CAP_08_S6_RUN_A_RESULT.json');
 const b=read('acceptance-output/MCFT_CAP_08_S6_RUN_B_RESULT.json');
 for(const [label,value] of [['RUN_A',a],['RUN_B',b]]){
  assert.equal(value.status,'PASS',`S6_${label}_NOT_PASS`);
  assert.equal(value.run_label,label);
  assert.equal(value.hard_acceptance_item_count,24);
  assert.equal(value.operator_surface_count,10);
  assert.equal(value.product_read_write_delta,0);
  assert.equal(value.model_activation_count,0);
  assert.equal(value.active_runtime_config_switch_count,0);
  assert.equal(value.recommendation_count,0);
  assert.equal(value.ao_act_count,0);
  assert.equal(value.dispatch_count,0);
  assert.equal(value.production_runtime_source_authorized,false);
  assert.equal(value.mcft_cap_09_authorized,false);
 }
 assert.notEqual(a.operational_instance_id,b.operational_instance_id,'S6_OPERATIONAL_INSTANCE_MUST_DIFFER');
 assert.equal(a.formal_run_id,b.formal_run_id,'S6_FORMAL_RUN_ID_MISMATCH');
 assert.equal(a.semantic_digest,b.semantic_digest,'S6_SEMANTIC_DIGEST_DIVERGENCE');
 assert.equal(a.operational_invariant_digest,b.operational_invariant_digest,'S6_OPERATIONAL_DIGEST_DIVERGENCE');
 assert.equal(a.closure_digest,b.closure_digest,'S6_CLOSURE_DIGEST_DIVERGENCE');
 assert.equal(digest(a.hard_acceptance),digest(b.hard_acceptance),'S6_HARD_ACCEPTANCE_LEDGER_DIVERGENCE');
 assert.equal(digest(a.type_counts),digest(b.type_counts),'S6_TYPE_CARDINALITY_DIVERGENCE');
 const result={
  schema_version:'geox_mcft_cap08_s6_two_run_comparison_result_v1',
  status:'PASS',
  formal_run_id:a.formal_run_id,
  operational_instance_ids:[a.operational_instance_id,b.operational_instance_id],
  fresh_database_count:2,
  formal_run_count:2,
  hard_acceptance_item_count:24,
  cap07_get_surface_count:10,
  semantic_digest:a.semantic_digest,
  operational_invariant_digest:a.operational_invariant_digest,
  closure_digest:a.closure_digest,
  semantic_digest_equality:true,
  operational_invariant_digest_equality:true,
  closure_digest_equality:true,
  hard_acceptance_ledger_equality:true,
  product_read_write_delta:0,
  model_activation_count:0,
  active_runtime_config_switch_count:0,
  recommendation_count:0,
  ao_act_count:0,
  dispatch_count:0,
  production_runtime_source_authorized:false,
  mcft_cap_08_complete:false,
  mcft_cap_09_authorized:false,
 };
 write(result);console.log(JSON.stringify(result,null,2));
}catch(error){write({schema_version:'geox_mcft_cap08_s6_two_run_comparison_result_v1',status:'FAIL',error:error instanceof Error?error.message:String(error)});console.error(error);process.exitCode=1}
