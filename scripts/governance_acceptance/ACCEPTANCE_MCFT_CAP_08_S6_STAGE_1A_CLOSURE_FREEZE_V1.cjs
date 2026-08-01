#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'../..');
const D='docs/digital_twin/mcft/cap_08';
const FREEZE=`${D}/GEOX-MCFT-CAP-08-S6-STAGE-1A-END-TO-END-CLOSURE-NOT-ESTABLISHED-V1.json`;
const BOUNDARY=`${D}/GEOX-MCFT-CAP-08-S6-STAGE-1A-CLOSURE-FREEZE-BOUNDARY-V1.json`;
const WORKFLOW='.github/workflows/mcft-cap-08-s6-stage-1a-closure-freeze.yml';
const OUTPUT=path.join(ROOT,'acceptance-output/MCFT_CAP_08_S6_STAGE_1A_CLOSURE_FREEZE_RESULT.json');
const readJson=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const text=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const git=(...args)=>cp.execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
function canonical(v){
  if(Array.isArray(v))return`[${v.map(canonical).join(',')}]`;
  if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
function semanticDigest(v){
  const copy=structuredClone(v);delete copy.semantic_digest;
  return`sha256:${crypto.createHash('sha256').update(canonical(copy)).digest('hex')}`;
}
function write(v){fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});fs.writeFileSync(OUTPUT,`${JSON.stringify(v,null,2)}\n`);}
try{
  const freeze=readJson(FREEZE),boundary=readJson(BOUNDARY);
  assert.equal(freeze.semantic_digest,semanticDigest(freeze),'FREEZE_SEMANTIC_DIGEST');
  assert.equal(boundary.semantic_digest,semanticDigest(boundary),'BOUNDARY_SEMANTIC_DIGEST');
  const base=String(process.env.MCFT_BASE_SHA||boundary.base_main_sha).trim();
  assert.equal(base,boundary.base_main_sha,'FREEZE_BASE_SHA');
  assert.equal(git('merge-base',base,'HEAD'),base,'FREEZE_BASE_NOT_ANCESTOR');
  assert.equal(git('diff','--check',`${base}...HEAD`),'','FREEZE_DIFF_CHECK');
  const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed,[...boundary.changed_files].sort(),'FREEZE_CHANGED_FILES');
  assert.equal(changed.length,4,'FREEZE_CHANGED_FILE_COUNT');
  assert.equal(changed.some(p=>p.startsWith('apps/server/')),false,'PRODUCT_RUNTIME_CHANGE_FORBIDDEN');
  assert.equal(changed.some(p=>p.includes('/migrations/')),false,'MIGRATION_CHANGE_FORBIDDEN');
  assert.equal(changed.some(p=>p.includes('qualification_ports')),false,'QUALIFICATION_CHANGE_FORBIDDEN');
  assert.equal(changed.some(p=>/EXECUTION-AUTHORITY-V\d+\.json$/.test(p)),false,'AUTHORITY_CHANGE_FORBIDDEN');

  assert.equal(freeze.record_status,'STAGE_1A_END_TO_END_CLOSURE_NOT_ESTABLISHED');
  assert.equal(freeze.stage_1a_end_to_end_closure_established,false);
  assert.equal(freeze.qualification_v2_complete_postgresql_24_tick_pass_established,false);
  assert.equal(freeze.formal_authority_chain_status,'PAUSED');
  assert.equal(freeze.v10_immediate_issuance_authorized,false);
  assert.equal(freeze.final_replacement_authority_authorized,false);
  assert.equal(freeze.formal_run_a_authorized,false);
  assert.equal(freeze.run_b_authorized,false);
  assert.equal(freeze.s6_candidate_implemented,false);
  assert.equal(freeze.mcft_cap_08_complete,false);
  assert.equal(freeze.mcft_cap_09_authorized,false);
  assert.equal(freeze.v9_execution.workflow_run_id,30687691006);
  assert.equal(freeze.repeatable_development_investigation.pull_request_number,2740);
  assert.equal(freeze.repeatable_development_investigation.pull_request_state,'CLOSED_WITHOUT_MERGE');
  assert.equal(freeze.repeatable_development_investigation.development_workflow_run_id,30689417615);
  assert.equal(freeze.repeatable_development_investigation.first_failure_code,'STATE_LATEST_CAS_CONFLICT');
  assert.equal(freeze.repeatable_development_investigation.consecutive_fresh_database_pass_count,0);
  assert.equal(freeze.repeatable_development_investigation.required_pass_count,2);
  assert.equal(freeze.contradiction.dedicated_t17_persistence_bridge_present,false);
  assert.equal(freeze.contradiction.product_timeline_adjudication_required,true);
  assert.equal(freeze.required_next_action,'S4_T17_PRODUCT_TIMELINE_ARCHITECTURE_ADJUDICATION');

  for(const pin of Object.values(freeze.product_contract_pins)){
    assert.equal(git('rev-parse',`${base}:${pin.path}`),pin.blob_sha,`PRODUCT_PIN_DRIFT:${pin.path}`);
  }
  assert.equal(git('rev-parse',`${base}:${freeze.protected_seed_refs.current_frontier_path}`),freeze.protected_seed_refs.current_frontier_blob_sha,'CURRENT_FRONTIER_SEED_DRIFT');
  assert.equal(git('rev-parse',`${base}:${freeze.protected_seed_refs.s6_delivery_status_path}`),freeze.protected_seed_refs.s6_delivery_status_blob_sha,'S6_DELIVERY_STATUS_SEED_DRIFT');
  assert.equal(git('rev-parse',`HEAD:${freeze.protected_seed_refs.current_frontier_path}`),freeze.protected_seed_refs.current_frontier_blob_sha,'CURRENT_FRONTIER_MUTATED');
  assert.equal(git('rev-parse',`HEAD:${freeze.protected_seed_refs.s6_delivery_status_path}`),freeze.protected_seed_refs.s6_delivery_status_blob_sha,'S6_DELIVERY_STATUS_MUTATED');
  const current=readJson(freeze.protected_seed_refs.current_frontier_path),delivery=readJson(freeze.protected_seed_refs.s6_delivery_status_path);
  assert.equal(current.mcft_cap_08_complete,false);
  assert.equal(current.mcft_cap_09_authorized,false);
  assert.equal(delivery.s6_candidate_implemented,false);
  assert.equal(delivery.mcft_cap_08_complete,false);

  const s4Repo=text(freeze.product_contract_pins.s4_append_forward_repository.path);
  const resolver=text(freeze.product_contract_pins.s4_t17_corrected_predecessor_resolver.path);
  const tickService=text(freeze.product_contract_pins.cap04_single_tick_service.path);
  const persistence=text(freeze.product_contract_pins.cap04_forecast_persistence.path);
  assert.doesNotMatch(s4Repo,/UPDATE\s+twin_state_latest_index_v1/i,'S4_REPOSITORY_UNEXPECTED_POINTER_ADVANCE');
  assert.match(resolver,/CAP08_S4_LATEST_POINTER_REGRESSION_DETECTED/);
  assert.match(resolver,/structuredClone\(authority\.t17_predecessor\)/);
  assert.match(tickService,/previous_state_ref:\s*handoff\.previous_posterior_ref/);
  assert.match(tickService,/previous_checkpoint_ref:\s*handoff\.previous_checkpoint_ref/);
  assert.match(tickService,/previous_forecast_result_ref:\s*handoff\.previous_forecast_result_ref/);
  assert.match(persistence,/state\.rows\[0\]\.state_object_id\s*!==\s*expected\.previous_state_ref/);
  assert.match(persistence,/STATE_LATEST_CAS_CONFLICT/);
  const correctionAuthoritySources=git('grep','-l','correction_authority_hash',base,'--','apps/server').split(/\r?\n/).filter(Boolean).map(v=>v.replace(`${base}:`,'' )).sort();
  assert.deepEqual(correctionAuthoritySources,[
    'apps/server/src/domain/twin_runtime/cap08_s4_append_forward_contracts_v1.ts',
    'apps/server/src/runtime/twin_runtime/cap08_s4_t17_corrected_predecessor_resolver_v1.ts',
  ]);

  const wf=text(WORKFLOW);
  assert.match(wf,/pull_request:/);
  assert.doesNotMatch(wf,/workflow_dispatch:/);
  assert.doesNotMatch(wf,/services:\s*\n\s*postgres:/);
  assert.doesNotMatch(wf,/DATABASE_URL/);
  assert.match(wf,/ACCEPTANCE_MCFT_CAP_08_S6_STAGE_1A_CLOSURE_FREEZE_V1\.cjs/);
  assert.equal(boundary.append_forward_status_only,true);
  assert.equal(boundary.protected_seed_mutation,false);
  assert.equal(boundary.execution_authority_included,false);
  assert.equal(boundary.formal_authority_chain_paused,true);

  const result={schema_version:'geox_mcft_cap08_s6_stage_1a_closure_freeze_result_v1',status:'PASS',subject_sha:git('rev-parse','HEAD'),base_sha:base,changed_file_count:4,record_status:freeze.record_status,formal_authority_chain_status:freeze.formal_authority_chain_status,required_next_action:freeze.required_next_action,product_contract_pin_count:Object.keys(freeze.product_contract_pins).length,dedicated_t17_persistence_bridge_present:false,database_execution_performed:false,replacement_authority_included:false};
  write(result);console.log(JSON.stringify(result,null,2));
}catch(error){write({schema_version:'geox_mcft_cap08_s6_stage_1a_closure_freeze_result_v1',status:'FAIL',error:error instanceof Error?error.stack||error.message:String(error)});console.error(error);process.exitCode=1;}
