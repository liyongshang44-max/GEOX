#!/usr/bin/env node
'use strict';

const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

const ROOT=path.resolve(__dirname,'../..');
const BASE='7fbe6b5a49a1012ca0ecfb3dc93f269f35b984e9';
const FAILED_RUN=30756390297;
const OUTPUT=path.join(ROOT,'acceptance-output/MCFT_CAP_08_S6_RUN_A_T17_INTERLEAVE_CORRECTION_RESULT.json');
const P={
  workflow:'.github/workflows/mcft-cap-08-s6-run-a-t17-interleave-correction.yml',
  authority:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-MATERIALIZER-BOUND-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json',
  settlement:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-RUN-A-T17-INTERLEAVE-ASSEMBLY-FAILURE-SETTLEMENT-V1.json',
  boundary:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-RUN-A-T17-INTERLEAVE-CORRECTION-BOUNDARY-V1.json',
  validator:'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_RUN_A_T17_INTERLEAVE_CORRECTION_V1.cjs',
  loader:'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_loader_v1.cjs',
  chain:'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_chain_v1.cjs',
  candidate:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-MATERIALIZER-BOUND-FORMAL-RUN-A-AUTHORITY-CANDIDATE-V1.json',
  manifest:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-MATERIALIZER-BOUND-RUN-A-AUTHORITY-OBJECT-SET-V1.json',
};
const FILES=[P.workflow,P.authority,P.settlement,P.boundary,P.validator,P.loader,P.chain].sort();

function git(...args){return execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();}
function readJson(relative){return JSON.parse(fs.readFileSync(path.join(ROOT,relative),'utf8'));}
function canonical(value){
  if(Array.isArray(value))return`[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object'){
    return`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function digest(value){
  const copy=structuredClone(value);
  delete copy.semantic_digest;
  return`sha256:${crypto.createHash('sha256').update(canonical(copy)).digest('hex')}`;
}
function save(value){
  fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});
  fs.writeFileSync(OUTPUT,`${JSON.stringify(value,null,2)}\n`);
}

async function main(){
  const base=String(process.env.MCFT_BASE_SHA||BASE).trim();
  assert.equal(base,BASE,'EXACT_BASE_MAIN_REQUIRED');
  assert.equal(git('merge-base',base,'HEAD'),base,'HEAD_MUST_DESCEND_FROM_EXACT_BASE');
  assert.equal(git('diff','--check',`${base}...HEAD`),'','DIFF_CHECK');
  assert.deepEqual(
    git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort(),
    FILES,
    'EXACT_CHANGED_FILE_BOUNDARY',
  );

  const authority=readJson(P.authority);
  const settlement=readJson(P.settlement);
  const boundary=readJson(P.boundary);
  assert.equal(authority.record_status,'SINGLE_FINAL_FORMAL_RUN_AUTHORITY_CONSUMED_T17_INTERLEAVE_ASSEMBLY_FAILURE');
  assert.equal(authority.authority_consumed,true);
  assert.equal(authority.single_use_contract.dispatch_count_consumed,1);
  assert.equal(authority.workflow_dispatch_execution_authorized,false);
  assert.equal(authority.single_run_database_execution_authorized,false);
  assert.equal(authority.consumption_evidence.github_workflow_run_id,FAILED_RUN);
  assert.equal(authority.consumption_evidence.database_identity_status,'PASS');
  assert.equal(authority.consumption_evidence.database_dropped,true);
  assert.equal(authority.failure_classification.code,'CAP04_SINGLE_TICK_NEXT_HANDOFF_STATE_MISMATCH');
  assert.equal(authority.failure_classification.ordinary_cap04_contract_defect,false);
  assert.equal(authority.semantic_digest,digest(authority));

  assert.equal(settlement.record_status,'FORMAL_RUN_A_AUTHORITY_CONSUMED_T17_INTERLEAVE_ASSEMBLY_FAILURE_SETTLED');
  assert.equal(settlement.failed_dispatch.github_workflow_run_id,FAILED_RUN);
  assert.equal(settlement.failure_classification.t17_tick_entered,false);
  assert.equal(settlement.root_cause.ordinary_cap04_invariant_must_not_be_weakened,true);
  assert.equal(settlement.correction.product_runtime_modified,false);
  assert.equal(settlement.correction.database_workflow_modified,false);
  assert.equal(settlement.authority_settlement.replacement_authority_issued,false);
  assert.equal(settlement.next_legal_action_after_merge,'ISSUE_NEW_NON_EFFECTIVE_RUN_A_AUTHORITY_CANDIDATE');
  assert.equal(settlement.semantic_digest,digest(settlement));

  assert.deepEqual([...boundary.changed_files].sort(),FILES);
  assert.equal(boundary.changed_file_count,7);
  assert.equal(boundary.product_runtime_file_count,0);
  assert.equal(boundary.migration_file_count,0);
  assert.equal(boundary.database_execution_workflow_file_count,0);
  assert.equal(boundary.replacement_authority_issued,false);
  assert.equal(boundary.semantic_digest,digest(boundary));

  assert.equal(git('rev-parse',`HEAD:${P.authority}`),'df9eb95baa45328230019df012aa698312432f03');
  assert.equal(git('rev-parse',`HEAD:${P.settlement}`),'03289801e17c362e3a3c8450133a53c4fe6616b8');
  assert.equal(git('rev-parse',`HEAD:${P.boundary}`),'a27c3c462d0a64f50185d5991cc5fc37a1f8e7be');
  assert.equal(git('rev-parse',`HEAD:${P.loader}`),'9ede26f14b97677cfa926f67a18aa8b9bc1b5a29');
  assert.equal(git('rev-parse',`HEAD:${P.chain}`),'fe3472b1ac2e0f6e91800172315060d7a4456b0b');
  assert.equal(git('rev-parse',`HEAD:${P.candidate}`),'d046dcae07cc737515967e9f2960f59269bb3dde');
  assert.equal(git('rev-parse',`HEAD:${P.manifest}`),'089d07234a6948de8eca2191fbd91ebcc4ccf7f0');

  const unchangedProductObjects={
    'apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.ts':'53ba9f0b3b8f054985d51613f359ad9eb154b089',
    'apps/server/src/runtime/twin_runtime/cap08_t17_corrected_handoff_service_v1.ts':'c7ee1472daf95570163e38f3101ae7c8265c0119',
    'apps/server/src/runtime/twin_runtime/cap08_t17_transition_persistence_adapter_v1.ts':'891a7ffba8920e3c3a625a3d30c6b4f32de65fc5',
    'apps/server/src/runtime/twin_runtime/cap08_t17_transition_tick_service_v1.ts':'b9e7f748f464ce0540f0ac95fb1ee9400cfa4441',
    'apps/server/src/persistence/twin_runtime/postgres_cap08_t17_transition_repository_v1.ts':'7754cde4570b5417d8dd8ceeff82aff2322ef1d0',
  };
  for(const [file,blob] of Object.entries(unchangedProductObjects)){
    assert.equal(git('rev-parse',`HEAD:${file}`),blob,`UNCHANGED_PRODUCT_OBJECT:${file}`);
  }

  const loaderSource=fs.readFileSync(path.join(ROOT,P.loader),'utf8');
  for(const required of [
    'cap08_t17_corrected_handoff_service_v1.ts',
    'cap08_t17_transition_persistence_adapter_v1.ts',
    'cap08_t17_transition_tick_service_v1.ts',
  ]) assert.ok(loaderSource.includes(required),`PRODUCT_LOADER_MISSING:${required}`);

  const chainSource=fs.readFileSync(path.join(ROOT,P.chain),'utf8');
  assert.equal(chainSource.includes('correctedT17Handoff'),false,'LEGACY_TEMPORARY_HANDOFF_MUST_BE_REMOVED');
  for(const required of [
    'Cap08S4T17CorrectedHandoffServiceV1',
    'Cap08S4T17TransitionPersistenceAdapterV1',
    'Cap08S4T17TransitionTickServiceV1',
    'Cap08S4T17ExplicitRoutingTickServiceV1',
    'S6_T17_AUTHORITY_BOUND_TRANSITION_REQUIRED',
  ]) assert.ok(chainSource.includes(required),`T17_PRODUCT_BRIDGE_MISSING:${required}`);

  const {executeS6CompositeTickRangeV1}=require(path.join(ROOT,P.chain));
  const events=[];
  const sequence=await executeS6CompositeTickRangeV1({
    executeBeforeS4:async index=>{events.push(`T${String(index).padStart(2,'0')}`);return index;},
    executeS4:async()=>{events.push('S4');return{status:'COMPLETED'};},
    executeAfterS4:async index=>{events.push(`T${String(index).padStart(2,'0')}`);return index;},
  });
  assert.deepEqual(events,[
    ...Array.from({length:17},(_,index)=>`T${String(index).padStart(2,'0')}`),
    'S4',
    ...Array.from({length:7},(_,offset)=>`T${String(offset+17).padStart(2,'0')}`),
  ],'S4_MUST_EXECUTE_EXACTLY_BETWEEN_T16_AND_T17');
  assert.equal(sequence.results.length,24);
  assert.equal(sequence.s4.status,'COMPLETED');

  const workflowSource=fs.readFileSync(path.join(ROOT,P.workflow),'utf8');
  assert.doesNotMatch(workflowSource,/workflow_dispatch:|postgres|psql|DATABASE_URL/i);

  const result={
    schema_version:'geox_mcft_cap08_s6_run_a_t17_interleave_correction_result_v1',
    status:'PASS',
    base_main_sha:base,
    exact_head_sha:git('rev-parse','HEAD'),
    failed_workflow_run_id:FAILED_RUN,
    replacement_005_consumed:true,
    ordinary_cap04_invariant_preserved:true,
    t17_product_bridge_wired:true,
    s4_sequence:'T00_T16_THEN_S4_THEN_T17_T23',
    product_runtime_modified:false,
    migration_modified:false,
    database_execution_workflow_modified:false,
    database_execution_performed:false,
    workflow_dispatch_performed:false,
    replacement_authority_issued:false,
    run_b_authorized:false,
    next_legal_action_after_merge:'ISSUE_NEW_NON_EFFECTIVE_RUN_A_AUTHORITY_CANDIDATE',
  };
  save(result);
  console.log(JSON.stringify(result,null,2));
}
main().catch(error=>{
  save({
    schema_version:'geox_mcft_cap08_s6_run_a_t17_interleave_correction_result_v1',
    status:'FAIL',
    error:error?.message||String(error),
  });
  throw error;
});
