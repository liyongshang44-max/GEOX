#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),CAP='docs/digital_twin/mcft/cap_08';
const B=`${CAP}/GEOX-MCFT-CAP-08-S6-SINGLE-RUN-DATABASE-EXECUTION-WORKFLOW-EFFECTIVENESS-BOUNDARY-V1.json`;
const E=`${CAP}/GEOX-MCFT-CAP-08-S6-SINGLE-RUN-DATABASE-EXECUTION-WORKFLOW-EFFECTIVENESS-AUTHORITY-V1.json`;
const N=`${CAP}/GEOX-MCFT-CAP-08-S6-EXACT-DATABASE-PORT-BUNDLE-IMPLEMENTATION-AUTHORITY-V1.json`;
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_08_S6_SINGLE_RUN_DATABASE_EXECUTION_WORKFLOW_EFFECTIVENESS_RESULT.json');
function read(p){return JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));}
function git(...a){return cp.execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();}
function canonical(v){if(Array.isArray(v))return`[${v.map(canonical).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;return JSON.stringify(v);}
function sd(v){const x=structuredClone(v);delete x.semantic_digest;return`sha256:${crypto.createHash('sha256').update(canonical(x)).digest('hex')}`;}
function write(v){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+'\n');}
try{
 const b=read(B),e=read(E),n=read(N),base=String(process.env.MCFT_BASE_SHA||b.base_main_sha).trim();
 assert.equal(base,b.base_main_sha,'BASE_SHA_DRIFT');
 assert.equal(git('merge-base',base,'HEAD'),base,'BASE_NOT_ANCESTOR');
 assert.equal(git('diff','--check',`${base}...HEAD`),'','DIFF_CHECK_FAILED');
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
 assert.deepEqual(changed,[...b.changed_files].sort(),'CHANGED_FILE_BOUNDARY');
 assert.equal(changed.length,5);
 for(const prefix of ['apps/','packages/','db/','migrations/','scripts/runtime_acceptance/'])assert.equal(changed.some(f=>f.startsWith(prefix)),false,`FORBIDDEN_PREFIX:${prefix}`);
 for(const value of [b,e,n])assert.equal(value.semantic_digest,sd(value));
 assert.equal(e.record_status,'SINGLE_RUN_DATABASE_EXECUTION_WORKFLOW_CONTROL_PLANE_IMPLEMENTED_EFFECTIVE');
 assert.equal(n.record_status,'EXACT_DATABASE_PORT_BUNDLE_IMPLEMENTATION_AUTHORIZED');
 const s=e.implementation_subject;
 assert.equal(git('diff','--name-only',s.candidate_head_sha,s.merge_commit_sha),'','CANDIDATE_MERGE_DELTA');
 assert.equal(git('rev-parse',`${s.candidate_head_sha}^{tree}`),s.candidate_tree_sha);
 assert.equal(git('rev-parse',`${s.merge_commit_sha}^{tree}`),s.merge_tree_sha);
 const exact={
  [`${CAP}/GEOX-MCFT-CAP-08-S6-SINGLE-RUN-DATABASE-EXECUTION-WORKFLOW-IMPLEMENTATION-AUTHORITY-V1.json`]:e.authority_consumed.workflow_implementation_authority_blob,
  [`${CAP}/GEOX-MCFT-CAP-08-S6-SINGLE-RUN-DATABASE-EXECUTION-HARNESS-EFFECTIVENESS-AUTHORITY-V1.json`]:e.authority_consumed.predecessor_harness_effectiveness_blob,
  [`${CAP}/GEOX-MCFT-CAP-08-S6-SINGLE-RUN-DATABASE-EXECUTION-WORKFLOW-IMPLEMENTATION-V1.json`]:e.authority_consumed.implementation_record_blob,
  [`${CAP}/GEOX-MCFT-CAP-08-S6-SINGLE-RUN-DATABASE-EXECUTION-WORKFLOW-BOUNDARY-V1.json`]:e.authority_consumed.implementation_boundary_blob,
  ['.github/workflows/mcft-cap-08-s6-single-run-database-execution.yml']:e.authority_consumed.runtime_workflow_blob,
  ['.github/workflows/mcft-cap-08-s6-single-run-database-execution-workflow-implementation.yml']:e.authority_consumed.focused_workflow_blob,
  ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_SINGLE_RUN_DATABASE_EXECUTION_WORKFLOW_IMPLEMENTATION.cjs']:e.authority_consumed.focused_acceptance_blob,
  ['scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/execution_authority_gate_v1.cjs']:e.authority_consumed.authority_gate_blob,
  ['scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/workflow_entrypoint_v1.ts']:e.authority_consumed.workflow_entrypoint_blob,
  ['scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/workflow_port_bundle_contract_v1.cjs']:e.authority_consumed.port_bundle_contract_blob
 };
 for(const [p,blob] of Object.entries(exact))assert.equal(git('rev-parse',`${s.merge_commit_sha}:${p}`),blob,`IMPLEMENTATION_BLOB_DRIFT:${p}`);
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mcft-cap08-workflow-effect-'));
 let replay;
 try{
  cp.execFileSync('git',['worktree','add','--detach',tmp,s.merge_commit_sha],{cwd:ROOT,stdio:'pipe'});
  cp.execFileSync('node',['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_SINGLE_RUN_DATABASE_EXECUTION_WORKFLOW_IMPLEMENTATION.cjs'],{cwd:tmp,env:{...process.env,MCFT_BASE_SHA:'3d398859c1fb7957aa84c11c04e8be5a7b193494'},stdio:'pipe'});
  replay=JSON.parse(fs.readFileSync(path.join(tmp,'acceptance-output/MCFT_CAP_08_S6_SINGLE_RUN_DATABASE_EXECUTION_WORKFLOW_IMPLEMENTATION_RESULT.json'),'utf8'));
 }finally{
  try{cp.execFileSync('git',['worktree','remove','--force',tmp],{cwd:ROOT,stdio:'pipe'});}catch{}
  fs.rmSync(tmp,{recursive:true,force:true});
 }
 assert.equal(replay.status,'PASS');
 for(const [k,v] of Object.entries(e.verified_result))assert.deepEqual(replay[k],v,`REPLAY_RESULT:${k}`);
 assert.equal(e.integration_remediation.historical_harness_workflow_triggered_on_final_head,false);
 assert.equal(e.effect.workflow_control_plane_effective,true);
 assert.equal(e.effect.real_database_port_bundle_implemented,false);
 for(const key of ['single_run_database_execution_authorized','run_a_execution_authorized','run_b_execution_authorized','database_execution_workflow_authorized','workflow_dispatch_execution_authorized','dual_run_ci_authorized','cross_run_comparator_implementation_authorized','final_ledger_settlement_authorized'])assert.equal(n.execution_constraints[key],false,`EXECUTION_CONSTRAINT:${key}`);
 assert.equal(n.implementation_constraints.s5_slice_helper_import_forbidden,true);
 assert.equal(n.implementation_constraints.hard_coded_ha_item_or_requirement_forbidden,true);
 const result={schema_version:'geox_mcft_cap08_s6_single_run_database_execution_workflow_effectiveness_result_v1',status:'PASS',subject_sha:git('rev-parse','HEAD'),base_sha:base,changed_file_count:changed.length,implementation_candidate_head:s.candidate_head_sha,implementation_merge_commit:s.merge_commit_sha,candidate_merge_file_delta:0,merge_replay_status:replay.status,workflow_control_plane_effective:true,exact_database_port_bundle_implementation_authorized:true,real_database_port_bundle_implemented:false,database_execution_authorized:false,run_a_executed:false,run_b_executed:false,workflow_dispatch_execution_authorized:false,dual_run_ci_authorized:false,cross_run_comparator_implemented:false,finalizer_present:false,s6_candidate_implemented:false,mcft_cap_08_complete:false,mcft_cap_09_authorized:false};
 write(result);console.log(JSON.stringify(result,null,2));
}catch(e){write({schema_version:'geox_mcft_cap08_s6_single_run_database_execution_workflow_effectiveness_result_v1',status:'FAIL',error:e instanceof Error?e.message:String(e)});console.error(e);process.exitCode=1;}
