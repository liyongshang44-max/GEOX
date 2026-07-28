#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const CAP='docs/digital_twin/mcft/cap_08';
const BOUNDARY=`${CAP}/GEOX-MCFT-CAP-08-S6-FINAL-FORMAL-RUN-ORCHESTRATOR-EFFECTIVENESS-BOUNDARY-V1.json`;
const EFFECT=`${CAP}/GEOX-MCFT-CAP-08-S6-FINAL-FORMAL-RUN-ORCHESTRATOR-EFFECTIVENESS-AUTHORITY-V1.json`;
const EXEC=`${CAP}/GEOX-MCFT-CAP-08-S6-SINGLE-RUN-DATABASE-EXECUTION-IMPLEMENTATION-AUTHORITY-V1.json`;
const OUTPUT=path.join(ROOT,'acceptance-output/MCFT_CAP_08_S6_FINAL_FORMAL_RUN_ORCHESTRATOR_EFFECTIVENESS_RESULT.json');
function read(p){return JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));}
function git(...a){return cp.execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();}
function canonical(v){if(Array.isArray(v))return`[${v.map(canonical).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;return JSON.stringify(v);}
function sd(v){const x=structuredClone(v);delete x.semantic_digest;return`sha256:${crypto.createHash('sha256').update(canonical(x)).digest('hex')}`;}
function write(v){fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});fs.writeFileSync(OUTPUT,JSON.stringify(v,null,2)+'\n');}
try{
 const boundary=read(BOUNDARY),effect=read(EFFECT),exec=read(EXEC);
 const base=String(process.env.MCFT_BASE_SHA||boundary.base_main_sha).trim();
 assert.equal(base,boundary.base_main_sha,'BASE_SHA_DRIFT');
 assert.equal(git('merge-base',base,'HEAD'),base,'BASE_NOT_ANCESTOR');
 assert.equal(git('diff','--check',`${base}...HEAD`),'','DIFF_CHECK_FAILED');
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
 assert.deepEqual(changed,[...boundary.changed_files].sort(),'CHANGED_FILE_BOUNDARY');
 assert.equal(changed.length,5);
 for(const p of ['apps/','packages/','db/','migrations/','scripts/runtime_acceptance/'])assert.equal(changed.some(f=>f.startsWith(p)),false,`FORBIDDEN_PREFIX:${p}`);
 assert.equal(boundary.semantic_digest,sd(boundary));
 assert.equal(effect.semantic_digest,sd(effect));
 assert.equal(exec.semantic_digest,sd(exec));
 assert.equal(effect.record_status,'FINAL_FORMAL_RUN_ORCHESTRATOR_IMPLEMENTED_EFFECTIVE');
 assert.equal(exec.record_status,'SINGLE_RUN_DATABASE_EXECUTION_HARNESS_IMPLEMENTATION_AUTHORIZED');
 assert.equal(effect.implementation_subject.candidate_to_merge_file_delta,0);
 assert.equal(git('diff','--name-only',effect.implementation_subject.candidate_head_sha,effect.implementation_subject.merge_commit_sha),'','CANDIDATE_MERGE_DELTA');
 assert.equal(git('rev-parse',`${effect.implementation_subject.candidate_head_sha}^{tree}`),effect.implementation_subject.candidate_tree_sha);
 assert.equal(git('rev-parse',`${effect.implementation_subject.merge_commit_sha}^{tree}`),effect.implementation_subject.merge_tree_sha);
 assert.equal(git('rev-parse',`${effect.implementation_subject.merge_commit_sha}:${CAP}/GEOX-MCFT-CAP-08-S6-FINAL-FORMAL-RUN-ORCHESTRATOR-IMPLEMENTATION-V1.json`),effect.authority_consumed.implementation_record_blob);
 assert.equal(git('rev-parse',`${effect.implementation_subject.merge_commit_sha}:${CAP}/GEOX-MCFT-CAP-08-S6-FINAL-FORMAL-RUN-ORCHESTRATOR-BOUNDARY-V1.json`),effect.authority_consumed.implementation_boundary_blob);
 assert.equal(git('rev-parse',`${effect.implementation_subject.merge_commit_sha}:scripts/runtime_acceptance/mcft_cap08_s6_final_formal_run/object_set_v1.cjs`),effect.authority_consumed.proof_object_set_builder_blob);
 assert.equal(git('rev-parse',`${effect.implementation_subject.merge_commit_sha}:scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_FINAL_FORMAL_RUN_ORCHESTRATOR.cjs`),effect.authority_consumed.focused_acceptance_blob);
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mcft-cap08-orchestrator-effect-'));
 let replay;
 try{
   cp.execFileSync('git',['worktree','add','--detach',tmp,effect.implementation_subject.merge_commit_sha],{cwd:ROOT,stdio:'pipe'});
   cp.execFileSync('node',['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_FINAL_FORMAL_RUN_ORCHESTRATOR.cjs'],{
     cwd:tmp,
     env:{...process.env,MCFT_BASE_SHA:'5c681ddedac795183274e98278bd821ec4bfa0a1'},
     stdio:'pipe'
   });
   replay=JSON.parse(fs.readFileSync(path.join(tmp,'acceptance-output/MCFT_CAP_08_S6_FINAL_FORMAL_RUN_ORCHESTRATOR_RESULT.json'),'utf8'));
 } finally {
   try{cp.execFileSync('git',['worktree','remove','--force',tmp],{cwd:ROOT,stdio:'pipe'});}catch{}
   fs.rmSync(tmp,{recursive:true,force:true});
 }
 assert.equal(replay.status,'PASS');
 for(const [k,v] of Object.entries(effect.verified_result))assert.deepEqual(replay[k],v,`REPLAY_RESULT:${k}`);
 assert.equal(effect.effect.orchestrator_effective,true);
 assert.equal(effect.effect.single_run_database_execution_authorized,false);
 assert.equal(exec.execution_constraints.single_run_database_execution_authorized,false);
 assert.equal(exec.execution_constraints.database_execution_workflow_authorized,false);
 assert.equal(exec.execution_constraints.dual_run_ci_authorized,false);
 assert.equal(exec.execution_constraints.cross_run_comparator_implementation_authorized,false);
 const result={
   schema_version:'geox_mcft_cap08_s6_final_formal_run_orchestrator_effectiveness_result_v1',
   status:'PASS',
   subject_sha:git('rev-parse','HEAD'),
   base_sha:base,
   changed_file_count:changed.length,
   implementation_candidate_head:effect.implementation_subject.candidate_head_sha,
   implementation_merge_commit:effect.implementation_subject.merge_commit_sha,
   candidate_merge_file_delta:0,
   merge_replay_status:replay.status,
   compiled_run_plan_count:replay.compiled_run_plan_count,
   proof_object_set_count:replay.proof_object_set_count,
   unique_object_set_ref_count:replay.unique_object_set_ref_count,
   orchestrator_effective:true,
   single_run_execution_harness_implementation_authorized:true,
   single_run_database_execution_authorized:false,
   run_a_executed:false,
   run_b_executed:false,
   dual_run_ci_authorized:false,
   cross_run_comparator_implemented:false,
   finalizer_present:false,
   s6_candidate_implemented:false,
   mcft_cap_08_complete:false,
   mcft_cap_09_authorized:false
 };
 write(result);console.log(JSON.stringify(result,null,2));
}catch(e){
 write({schema_version:'geox_mcft_cap08_s6_final_formal_run_orchestrator_effectiveness_result_v1',status:'FAIL',error:e instanceof Error?e.message:String(e)});
 console.error(e);process.exitCode=1;
}
