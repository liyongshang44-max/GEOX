#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict');
const C=require('node:crypto');
const P=require('node:child_process');
const F=require('node:fs');
const O=require('node:os');
const X=require('node:path');

const R=X.resolve(__dirname,'../..');
const D='docs/digital_twin/mcft/cap_08';
const AP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-S4-PERSISTENCE-INTERLEAVE-CORRECTION-EFFECTIVENESS-AUTHORITY-V1.json`;
const BP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-S4-PERSISTENCE-INTERLEAVE-CORRECTION-EFFECTIVENESS-BOUNDARY-V1.json`;
const GP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-S4-PERSISTENCE-INTERLEAVE-REPLACEMENT-AUTHORITY-ISSUANCE-GATE-V1.json`;
const ORIGINAL='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_RUN_A_QUALIFICATION_S4_PERSISTENCE_INTERLEAVE_CORRECTION.cjs';
const W='.github/workflows/mcft-cap-08-s6-run-a-qualification-s4-persistence-interleave-correction-effectiveness.yml';
const Q=X.join(R,'acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_S4_PERSISTENCE_INTERLEAVE_CORRECTION_EFFECTIVENESS_RESULT.json');
const read=p=>JSON.parse(F.readFileSync(X.join(R,p),'utf8'));
const text=p=>F.readFileSync(X.join(R,p),'utf8');
const git=(cwd,...args)=>P.execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
function canonical(value){
  if(Array.isArray(value))return`[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object')return`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function semanticDigest(value){
  const copy=structuredClone(value);
  delete copy.semantic_digest;
  return`sha256:${C.createHash('sha256').update(canonical(copy)).digest('hex')}`;
}
function write(value){
  F.mkdirSync(X.dirname(Q),{recursive:true});
  F.writeFileSync(Q,JSON.stringify(value,null,2)+'\n');
}
let worktree=null;
try{
  const authority=read(AP);
  const boundary=read(BP);
  const gate=read(GP);
  const base=String(process.env.MCFT_BASE_SHA||boundary.base_main_sha).trim();
  A.equal(base,boundary.base_main_sha);
  A.equal(git(R,'merge-base',base,'HEAD'),base);
  A.equal(git(R,'diff','--check',`${base}...HEAD`),'');
  const changed=git(R,'diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  A.deepEqual(changed,[...boundary.changed_files].sort());
  A.equal(changed.length,5);
  for(const value of[authority,boundary,gate])A.equal(value.semantic_digest,semanticDigest(value),'SEMANTIC_DIGEST');

  const subject=authority.implementation_subject;
  A.equal(subject.merge_commit_sha,base);
  A.equal(git(R,'rev-parse',`${subject.candidate_head_sha}^{tree}`),subject.candidate_tree_sha);
  A.equal(git(R,'rev-parse',`${subject.merge_commit_sha}^{tree}`),subject.merge_tree_sha);
  A.equal(subject.candidate_tree_sha,subject.merge_tree_sha);
  A.equal(git(R,'diff','--name-only',subject.candidate_head_sha,subject.merge_commit_sha),'');
  for(const [path,hash] of Object.entries(authority.implementation_object_set)){
    A.equal(git(R,'rev-parse',`${base}:${path}`),hash,`IMPLEMENTATION_BLOB_DRIFT:${path}`);
  }
  A.equal(authority.exact_head_evidence.focused_workflow_run_id,30657958266);
  A.equal(authority.exact_head_evidence.focused_artifact_id,8803993487);
  A.equal(authority.exact_head_evidence.standard_ci_run_id,30657957899);
  A.equal(authority.verified_result.failed_v7_workflow_run_id,30656419611);
  A.equal(authority.verified_result.database_bootstrap_pass,true);
  A.equal(authority.verified_result.database_drop_pass,true);
  A.equal(authority.verified_result.qualification_result_generated,false);
  A.equal(authority.verified_result.atomic_write_member_count,7);

  A.equal(gate.record_status,'RUN_A_QUALIFICATION_REPLACEMENT_AUTHORITY_V8_ISSUANCE_AUTHORIZED');
  A.equal(gate.effectiveness_authority_semantic_digest,authority.semantic_digest);
  A.equal(gate.issuance_constraints.execution_subject_selector,'THIS_EFFECTIVENESS_MERGE_SHA');
  A.equal(gate.issuance_constraints.qualification_product_loader_blob_sha,'ef73eccd7dec329fc00fa939d75d4f8730ed36de');
  A.equal(gate.issuance_constraints.qualification_s4_persistence_adapter_blob_sha,'2f91751e0ad7fec9558ef0418c5941702c8a5151');
  A.equal(gate.issuance_constraints.retired_operational_run_instance_ids.at(-1),'MCFT-CAP-08-S6-RUN-A-QUAL-20260801-008');

  worktree=F.mkdtempSync(X.join(O.tmpdir(),'mcft-cap08-s4-interleave-effectiveness-'));
  P.execFileSync('git',['worktree','add','--detach',worktree,subject.merge_commit_sha],{cwd:R,stdio:'pipe'});
  P.execFileSync(process.execPath,[ORIGINAL],{
    cwd:worktree,
    env:{...process.env,MCFT_BASE_SHA:'29443d32642a01169aa69ec9dd09613fe2a18e65'},
    stdio:'pipe',
  });
  const replay=JSON.parse(F.readFileSync(X.join(worktree,'acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_S4_PERSISTENCE_INTERLEAVE_CORRECTION_RESULT.json'),'utf8'));
  A.equal(replay.status,'PASS');
  A.equal(replay.subject_sha,subject.merge_commit_sha);
  A.equal(replay.changed_file_count,10);
  A.equal(replay.prefix_positive_vector_count,1);
  A.equal(replay.prefix_negative_vector_count,1);
  A.equal(replay.completion_tuple_absence_positive_vector_count,1);
  A.equal(replay.completion_tuple_fabrication_negative_vector_count,1);
  A.equal(replay.atomic_write_member_count,7);
  A.equal(replay.database_execution_performed,false);
  A.equal(replay.workflow_dispatch_performed,false);

  const workflow=text(W);
  A.match(workflow,/pull_request:/);
  A.doesNotMatch(workflow,/workflow_dispatch:/);
  A.doesNotMatch(workflow,/services:\s*\n\s*postgres:/);
  A.doesNotMatch(workflow,/DATABASE_URL/);
  A.equal(boundary.runtime_acceptance_file_count,0);
  A.equal(boundary.database_execution_performed,false);

  const result={
    schema_version:'geox_mcft_cap08_s6_run_a_qualification_s4_persistence_interleave_correction_effectiveness_result_v1',
    status:'PASS',
    subject_sha:git(R,'rev-parse','HEAD'),
    base_sha:base,
    changed_file_count:5,
    implementation_merge_sha:subject.merge_commit_sha,
    candidate_to_merge_file_delta:0,
    detached_merge_replay_pass:true,
    prefix_positive_vector_count:1,
    prefix_negative_vector_count:1,
    completion_tuple_absence_positive_vector_count:1,
    completion_tuple_fabrication_negative_vector_count:1,
    atomic_write_member_count:7,
    corrected_product_loader_blob_sha:gate.issuance_constraints.qualification_product_loader_blob_sha,
    s6_s4_atomic_persistence_adapter_blob_sha:gate.issuance_constraints.qualification_s4_persistence_adapter_blob_sha,
    replacement_authority_v8_issuance_authorized:true,
    database_execution_performed:false,
    workflow_dispatch_performed:false,
    run_a_qualification_completed:false,
    run_b_executed:false,
  };
  write(result);
  console.log(JSON.stringify(result,null,2));
}catch(error){
  write({
    schema_version:'geox_mcft_cap08_s6_run_a_qualification_s4_persistence_interleave_correction_effectiveness_result_v1',
    status:'FAIL',
    error:error instanceof Error?error.stack||error.message:String(error),
  });
  console.error(error);
  process.exitCode=1;
}finally{
  if(worktree){
    try{P.execFileSync('git',['worktree','remove','--force',worktree],{cwd:R,stdio:'pipe'});}catch{}
    try{F.rmSync(worktree,{recursive:true,force:true});}catch{}
  }
}
