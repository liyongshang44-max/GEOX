#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),C=require('node:crypto'),P=require('node:child_process'),F=require('node:fs'),O=require('node:os'),X=require('node:path');
const R=X.resolve(__dirname,'../..'),D='docs/digital_twin/mcft/cap_08';
const AP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-COMPOSITE-RANGE-CORRECTION-EFFECTIVENESS-AUTHORITY-V1.json`;
const BP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-COMPOSITE-RANGE-CORRECTION-EFFECTIVENESS-BOUNDARY-V1.json`;
const GP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-COMPOSITE-RANGE-REPLACEMENT-AUTHORITY-ISSUANCE-GATE-V1.json`;
const ORIGINAL='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_RUN_A_QUALIFICATION_COMPOSITE_RANGE_CORRECTION.cjs';
const W='.github/workflows/mcft-cap-08-s6-run-a-qualification-composite-range-correction-effectiveness.yml';
const Q=X.join(R,'acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_COMPOSITE_RANGE_CORRECTION_EFFECTIVENESS_RESULT.json');
const read=p=>JSON.parse(F.readFileSync(X.join(R,p),'utf8')),text=p=>F.readFileSync(X.join(R,p),'utf8'),git=(cwd,...a)=>P.execFileSync('git',a,{cwd,encoding:'utf8'}).trim();
const canon=v=>Array.isArray(v)?`[${v.map(canon).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`:JSON.stringify(v);
const sd=v=>{const x=structuredClone(v);delete x.semantic_digest;return`sha256:${C.createHash('sha256').update(canon(x)).digest('hex')}`};
const out=v=>{F.mkdirSync(X.dirname(Q),{recursive:true});F.writeFileSync(Q,JSON.stringify(v,null,2)+'\n')};
let worktree=null;
try{
  const a=read(AP),b=read(BP),g=read(GP),base=String(process.env.MCFT_BASE_SHA||b.base_main_sha).trim();
  A.equal(base,b.base_main_sha);
  A.equal(git(R,'merge-base',base,'HEAD'),base);
  A.equal(git(R,'diff','--check',`${base}...HEAD`),'');
  const changed=git(R,'diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  A.deepEqual(changed,[...b.changed_files].sort());
  A.equal(changed.length,5);
  for(const v of[a,b,g])A.equal(v.semantic_digest,sd(v),'SEMANTIC_DIGEST');

  const s=a.implementation_subject;
  A.equal(s.pull_request_number,2731);
  A.equal(s.merge_commit_sha,base);
  A.equal(git(R,'rev-parse',`${s.candidate_head_sha}^{tree}`),s.candidate_tree_sha);
  A.equal(git(R,'rev-parse',`${s.merge_commit_sha}^{tree}`),s.merge_tree_sha);
  A.equal(s.candidate_tree_sha,s.merge_tree_sha);
  A.equal(git(R,'diff','--name-only',s.candidate_head_sha,s.merge_commit_sha),'');
  for(const [p,h] of Object.entries(a.implementation_object_set)){
    A.equal(git(R,'rev-parse',`${base}:${p}`),h,`IMPLEMENTATION_BLOB_DRIFT:${p}`);
  }

  A.equal(a.exact_head_evidence.focused_workflow_run_id,30652562020);
  A.equal(a.exact_head_evidence.focused_artifact_id,8801959404);
  A.equal(a.exact_head_evidence.historical_port_bundle_workflow_run_id,30652562051);
  A.equal(a.exact_head_evidence.reality_binding_successor_workflow_run_id,30652562043);
  A.equal(a.exact_head_evidence.standard_ci_run_id,30652562002);
  A.equal(a.exact_head_evidence.standard_ci_status,'PASS');
  A.equal(a.exact_head_evidence.required_status_check_count,8);
  A.equal(a.exact_head_evidence.required_status_check_success_count,8);

  A.equal(g.record_status,'RUN_A_QUALIFICATION_REPLACEMENT_AUTHORITY_V7_ISSUANCE_AUTHORIZED');
  A.equal(g.effectiveness_authority_semantic_digest,a.semantic_digest);
  A.equal(g.issuance_constraints.execution_subject_selector,'THIS_EFFECTIVENESS_MERGE_SHA');
  A.equal(g.issuance_constraints.authority_version,'V7');
  A.equal(g.issuance_constraints.qualification_product_chain_blob_sha,'79c4b0bc081cf74749ee2f38ec3b6ae51e271cc3');
  A.equal(g.issuance_constraints.qualification_product_loader_blob_sha,'283b157a65fc36bfc00f4b89c3971a586a965872');
  A.equal(g.issuance_constraints.retired_operational_run_instance_ids.at(-1),'MCFT-CAP-08-S6-RUN-A-QUAL-20260731-007');
  A.equal(g.issuance_constraints.retired_database_names.at(-1),'geox_mcft_cap08_s6_run_a_qual_007');

  worktree=F.mkdtempSync(X.join(O.tmpdir(),'mcft-cap08-composite-effectiveness-'));
  P.execFileSync('git',['worktree','add','--detach',worktree,s.merge_commit_sha],{cwd:R,stdio:'pipe'});
  P.execFileSync(process.execPath,[ORIGINAL],{
    cwd:worktree,
    env:{...process.env,MCFT_BASE_SHA:'43a76627e222f2b16c60029fc84bb8cc2a5c6fff'},
    stdio:'pipe',
  });
  const replay=JSON.parse(F.readFileSync(X.join(worktree,'acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_COMPOSITE_RANGE_CORRECTION_RESULT.json'),'utf8'));
  A.equal(replay.status,'PASS');
  A.equal(replay.subject_sha,s.merge_commit_sha);
  A.equal(replay.changed_file_count,9);
  A.equal(replay.failed_workflow_run_id,30644371587);
  A.equal(replay.retired_operational_instance,'MCFT-CAP-08-S6-RUN-A-QUAL-20260731-007');
  A.equal(replay.composite_range_positive_vector_count,1);
  A.equal(replay.composite_range_negative_vector_count,1);
  A.equal(replay.t00_t16_binding_count,17);
  A.equal(replay.s3_slice_orchestrator_reuse_count,0);
  A.equal(replay.corrected_product_chain_blob_sha,'79c4b0bc081cf74749ee2f38ec3b6ae51e271cc3');
  A.equal(replay.corrected_product_loader_blob_sha,'283b157a65fc36bfc00f4b89c3971a586a965872');
  A.equal(replay.database_execution_performed,false);
  A.equal(replay.workflow_dispatch_performed,false);
  A.equal(replay.new_execution_authority_issued,false);

  const wf=text(W);
  A.match(wf,/pull_request:/);
  for(const x of[/workflow_dispatch:/,/services:\s*\n\s*postgres:/,/DATABASE_URL/])A.doesNotMatch(wf,x);
  A.equal(b.runtime_acceptance_file_count,0);
  A.equal(b.database_execution_performed,false);
  A.equal(b.workflow_dispatch_performed,false);
  A.equal(b.execution_authority_issued,false);

  const z={
    schema_version:'geox_mcft_cap08_s6_run_a_qualification_composite_range_correction_effectiveness_result_v1',
    status:'PASS',
    subject_sha:git(R,'rev-parse','HEAD'),
    base_sha:base,
    changed_file_count:5,
    implementation_merge_sha:s.merge_commit_sha,
    candidate_to_merge_file_delta:0,
    detached_merge_replay_pass:true,
    composite_range_positive_vector_count:1,
    composite_range_negative_vector_count:1,
    t00_t16_binding_count:17,
    s3_slice_orchestrator_reuse_count:0,
    corrected_product_chain_blob_sha:g.issuance_constraints.qualification_product_chain_blob_sha,
    corrected_product_loader_blob_sha:g.issuance_constraints.qualification_product_loader_blob_sha,
    replacement_authority_v7_issuance_authorized:true,
    database_execution_performed:false,
    workflow_dispatch_performed:false,
    execution_authority_issued:false,
    run_a_qualification_completed:false,
    run_b_executed:false,
    s6_candidate_implemented:false,
    mcft_cap_08_complete:false,
    mcft_cap_09_authorized:false,
  };
  out(z);
  console.log(JSON.stringify(z,null,2));
}catch(e){
  out({
    schema_version:'geox_mcft_cap08_s6_run_a_qualification_composite_range_correction_effectiveness_result_v1',
    status:'FAIL',
    error:e instanceof Error?e.stack||e.message:String(e),
  });
  console.error(e);
  process.exitCode=1;
}finally{
  if(worktree){
    try{P.execFileSync('git',['worktree','remove','--force',worktree],{cwd:R,stdio:'pipe'})}catch{}
    try{F.rmSync(worktree,{recursive:true,force:true})}catch{}
  }
}
