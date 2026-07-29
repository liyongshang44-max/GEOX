#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),C=require('node:crypto'),P=require('node:child_process'),F=require('node:fs'),O=require('node:os'),X=require('node:path');
const R=X.resolve(__dirname,'../..'),D='docs/digital_twin/mcft/cap_08';
const B=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-CONTROL-PLANE-EFFECTIVENESS-BOUNDARY-V1.json`;
const E=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-CONTROL-PLANE-EFFECTIVENESS-AUTHORITY-V1.json`;
const G=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-AUTHORITY-ISSUANCE-GATE-V1.json`;
const W='.github/workflows/mcft-cap-08-s6-run-a-qualification-control-plane-effectiveness.yml';
const Q=X.join(R,'acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_CONTROL_PLANE_EFFECTIVENESS_RESULT.json');
const read=p=>JSON.parse(F.readFileSync(X.join(R,p),'utf8')),text=p=>F.readFileSync(X.join(R,p),'utf8'),git=(...a)=>P.execFileSync('git',a,{cwd:R,encoding:'utf8'}).trim();
const canon=v=>Array.isArray(v)?`[${v.map(canon).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`:JSON.stringify(v);
function sd(v){const x=structuredClone(v);delete x.semantic_digest;return`sha256:${C.createHash('sha256').update(canon(x)).digest('hex')}`}
function write(v){F.mkdirSync(X.dirname(Q),{recursive:true});F.writeFileSync(Q,JSON.stringify(v,null,2)+'\n')}
try{
 const b=read(B),e=read(E),g=read(G),base=String(process.env.MCFT_BASE_SHA||b.base_main_sha).trim();
 A.equal(base,b.base_main_sha);A.equal(git('merge-base',base,'HEAD'),base);A.equal(git('diff','--check',`${base}...HEAD`),'');
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
 A.deepEqual(changed,[...b.changed_files].sort());A.equal(changed.length,5);
 for(const v of[b,e,g])A.equal(v.semantic_digest,sd(v),'SEMANTIC_DIGEST');
 const s=e.implementation_subject;
 A.equal(s.candidate_head_sha,'e69849ddb4e98fccd52e7fc3f78b2bf0e89d7dc9');A.equal(s.candidate_tree_sha,'6f124c694ae4bbb549a76c1bb8f707c7a76f6ad0');A.equal(s.merge_commit_sha,'76413dbdea0be7e827190fa532ab5253a0d359ef');A.equal(s.merge_tree_sha,'6f124c694ae4bbb549a76c1bb8f707c7a76f6ad0');A.equal(s.candidate_to_merge_file_delta,0);A.equal(s.candidate_to_merge_tree_equal,true);
 A.equal(git('rev-parse','e69849ddb4e98fccd52e7fc3f78b2bf0e89d7dc9^{tree}'),'6f124c694ae4bbb549a76c1bb8f707c7a76f6ad0');A.equal(git('rev-parse','76413dbdea0be7e827190fa532ab5253a0d359ef^{tree}'),'6f124c694ae4bbb549a76c1bb8f707c7a76f6ad0');
 A.equal(git('diff','--name-only','e69849ddb4e98fccd52e7fc3f78b2bf0e89d7dc9','76413dbdea0be7e827190fa532ab5253a0d359ef'),'');
 for(const [p,blob] of Object.entries(e.implementation_object_set))A.equal(git('rev-parse',`76413dbdea0be7e827190fa532ab5253a0d359ef:${p}`),blob,`IMPLEMENTATION_BLOB_DRIFT:${p}`);
 A.equal(e.exact_head_evidence.focused_workflow_run_id,30419324775);A.equal(e.exact_head_evidence.focused_artifact_id,8711316415);A.equal(e.exact_head_evidence.focused_artifact_digest,'sha256:fc5bcf22fe4509be845da174c3a95358651b7e632500a44966f5f03272110289');A.equal(e.exact_head_evidence.standard_ci_run_id,30419324761);A.equal(e.exact_head_evidence.required_workflow_success_count,8);
 A.equal(e.verified_result.canonical_receipt_count,153);A.equal(e.verified_result.canonical_readback_count,153);A.equal(e.verified_result.recovery_vector_count,7);A.equal(e.verified_result.cap07_surface_count,10);A.equal(e.verified_result.ha_witness_count,0);A.equal(e.verified_result.final_closure_source_generated,false);A.equal(e.verified_result.hard_acceptance_eligible,false);
 A.equal(g.record_status,'RUN_A_QUALIFICATION_AUTHORITY_ISSUANCE_AUTHORIZED');A.equal(g.issuance_constraints.authorized_run_label,'RUN_A');A.equal(g.issuance_constraints.execution_subject_selector,'THIS_EFFECTIVENESS_MERGE_SHA');A.equal(g.issuance_constraints.exact_effective_port_bundle_blob_sha,'2f574588ba3010a94e64f965bb17fc97b3b33c72');A.equal(g.issuance_constraints.maximum_authority_lifetime_hours,24);A.equal(g.execution_constraints.actual_execution_authority_present,false);A.equal(g.execution_constraints.workflow_dispatch_execution_authorized,false);
 const workflow=text(W);A.match(workflow,/pull_request:/);A.doesNotMatch(workflow,/workflow_dispatch:/);A.doesNotMatch(workflow,/services:\s*\n\s*postgres:/);A.doesNotMatch(workflow,/DATABASE_URL/);
 const tmp=F.mkdtempSync(X.join(O.tmpdir(),'mcft-cap08-run-a-qual-effect-'));
 try{
  git('worktree','add','--detach',tmp,'76413dbdea0be7e827190fa532ab5253a0d359ef');
  P.execFileSync(process.execPath,['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_RUN_A_QUALIFICATION_CONTROL_PLANE.cjs'],{cwd:tmp,env:{...process.env,MCFT_BASE_SHA:'cc1371773bd1ed507517ac6ff3d429271bfc9973'},stdio:'pipe'});
 }finally{try{git('worktree','remove','--force',tmp)}catch{}}
 const result={schema_version:'geox_mcft_cap08_s6_run_a_qualification_control_plane_effectiveness_result_v1',status:'PASS',subject_sha:git('rev-parse','HEAD'),base_sha:base,changed_file_count:5,implementation_subject_sha:'76413dbdea0be7e827190fa532ab5253a0d359ef',implementation_candidate_sha:'e69849ddb4e98fccd52e7fc3f78b2bf0e89d7dc9',implementation_tree_sha:'6f124c694ae4bbb549a76c1bb8f707c7a76f6ad0',implementation_blob_count:9,canonical_receipt_count:153,canonical_readback_count:153,recovery_vector_count:7,cap07_surface_count:10,ha_witness_count:0,final_closure_source_generated:false,hard_acceptance_eligible:false,actual_execution_authority_present:false,database_execution_performed:false,run_a_executed:false,run_b_executed:false,s6_candidate_implemented:false,mcft_cap_08_complete:false,mcft_cap_09_authorized:false};
 write(result);console.log(JSON.stringify(result,null,2));
}catch(error){write({schema_version:'geox_mcft_cap08_s6_run_a_qualification_control_plane_effectiveness_result_v1',status:'FAIL',error:error instanceof Error?error.message:String(error)});console.error(error);process.exitCode=1}
