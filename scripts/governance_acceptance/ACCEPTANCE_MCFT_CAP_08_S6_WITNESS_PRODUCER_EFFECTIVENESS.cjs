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
const BOUNDARY=`${CAP}/GEOX-MCFT-CAP-08-S6-WITNESS-PRODUCER-EFFECTIVENESS-BOUNDARY-V1.json`;
const EFFECT=`${CAP}/GEOX-MCFT-CAP-08-S6-WITNESS-PRODUCER-EFFECTIVENESS-AUTHORITY-V1.json`;
const ORCH=`${CAP}/GEOX-MCFT-CAP-08-S6-FINAL-FORMAL-RUN-ORCHESTRATOR-IMPLEMENTATION-AUTHORITY-V1.json`;
const OUTPUT=path.join(ROOT,'acceptance-output/MCFT_CAP_08_S6_WITNESS_PRODUCER_EFFECTIVENESS_RESULT.json');
function read(p){return JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));}
function git(...a){return cp.execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();}
function canonical(v){if(Array.isArray(v))return`[${v.map(canonical).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;return JSON.stringify(v);}
function sd(v){const x=structuredClone(v);delete x.semantic_digest;return`sha256:${crypto.createHash('sha256').update(canonical(x)).digest('hex')}`;}
function write(v){fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});fs.writeFileSync(OUTPUT,JSON.stringify(v,null,2)+'\n');}
try{
 const boundary=read(BOUNDARY),effect=read(EFFECT),orch=read(ORCH);const base=String(process.env.MCFT_BASE_SHA||boundary.base_main_sha).trim();
 assert.equal(base,boundary.base_main_sha,'BASE_SHA_DRIFT');assert.equal(git('merge-base',base,'HEAD'),base,'BASE_NOT_ANCESTOR');assert.equal(git('diff','--check',`${base}...HEAD`),'','DIFF_CHECK_FAILED');
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();assert.deepEqual(changed,[...boundary.changed_files].sort(),'CHANGED_FILE_BOUNDARY');assert.equal(changed.length,5);
 for(const p of ['apps/','packages/','db/','migrations/','scripts/runtime_acceptance/'])assert.equal(changed.some(f=>f.startsWith(p)),false,`FORBIDDEN_PREFIX:${p}`);
 assert.equal(boundary.semantic_digest,sd(boundary));assert.equal(effect.semantic_digest,sd(effect));assert.equal(orch.semantic_digest,sd(orch));
 assert.equal(effect.record_status,'WITNESS_PRODUCERS_IMPLEMENTED_EFFECTIVE');assert.equal(orch.record_status,'FINAL_FORMAL_RUN_ORCHESTRATOR_IMPLEMENTATION_AUTHORIZED');
 assert.equal(effect.implementation_subject.candidate_to_merge_file_delta,0);assert.equal(git('diff','--name-only',effect.implementation_subject.candidate_head_sha,effect.implementation_subject.merge_commit_sha),'','CANDIDATE_MERGE_DELTA');
 assert.equal(git('rev-parse',`${effect.implementation_subject.candidate_head_sha}^{tree}`),effect.implementation_subject.candidate_tree_sha);assert.equal(git('rev-parse',`${effect.implementation_subject.merge_commit_sha}^{tree}`),effect.implementation_subject.merge_tree_sha);
 assert.equal(git('rev-parse',`${effect.implementation_subject.merge_commit_sha}:docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-WITNESS-PRODUCER-IMPLEMENTATION-V1.json`),effect.authority_consumed.implementation_record_blob);
 assert.equal(git('rev-parse',`${effect.implementation_subject.merge_commit_sha}:docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-WITNESS-PRODUCER-BOUNDARY-V1.json`),effect.authority_consumed.implementation_boundary_blob);
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mcft-cap08-witness-effect-'));try{cp.execFileSync('git',['worktree','add','--detach',tmp,effect.implementation_subject.merge_commit_sha],{cwd:ROOT,stdio:'pipe'});cp.execFileSync('node',['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_WITNESS_PRODUCERS.cjs'],{cwd:tmp,env:{...process.env,MCFT_BASE_SHA:'6def5a56d7af0fc769b576c4cd8c2c965862228f'},stdio:'pipe'});const r=JSON.parse(fs.readFileSync(path.join(tmp,'acceptance-output/MCFT_CAP_08_S6_WITNESS_PRODUCER_RESULT.json'),'utf8'));assert.equal(r.status,'PASS');assert.equal(r.producer_count,19);assert.equal(r.synthetic_per_run_contract_witness_count,44);assert.equal(r.finalizer_present,false);assert.equal(r.cross_run_comparator_implemented,false);}finally{try{cp.execFileSync('git',['worktree','remove','--force',tmp],{cwd:ROOT,stdio:'pipe'});}catch{}}
 assert.equal(orch.execution_constraints.single_run_database_execution_authorized,false);assert.equal(orch.execution_constraints.dual_run_ci_authorized,false);assert.equal(orch.execution_constraints.cross_run_comparator_implementation_authorized,false);
 const result={schema_version:'geox_mcft_cap08_s6_witness_producer_effectiveness_result_v1',status:'PASS',subject_sha:git('rev-parse','HEAD'),base_sha:base,candidate_head_sha:effect.implementation_subject.candidate_head_sha,merge_commit_sha:effect.implementation_subject.merge_commit_sha,candidate_merge_tree_equal:true,producer_count:19,implemented_per_run_producer_count:16,deferred_producer_count:3,synthetic_contract_witness_count:44,witness_producers_effective:true,orchestrator_implementation_authorized:true,single_run_database_execution_authorized:false,dual_run_ci_authorized:false,cross_run_comparator_authorized:false,final_ledger_settlement_authorized:false,s6_candidate_implemented:false,mcft_cap_08_complete:false,mcft_cap_09_authorized:false};write(result);console.log(JSON.stringify(result,null,2));
}catch(e){write({schema_version:'geox_mcft_cap08_s6_witness_producer_effectiveness_result_v1',status:'FAIL',error:e instanceof Error?e.message:String(e)});console.error(e);process.exitCode=1;}
