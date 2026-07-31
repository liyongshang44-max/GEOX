#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),C=require('node:crypto'),P=require('node:child_process'),F=require('node:fs'),O=require('node:os'),X=require('node:path');
const R=X.resolve(__dirname,'../..'),D='docs/digital_twin/mcft/cap_08';
const AP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-PORT-BINDING-CORRECTION-EFFECTIVENESS-AUTHORITY-V1.json`;
const BP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-PORT-BINDING-CORRECTION-EFFECTIVENESS-BOUNDARY-V1.json`;
const GP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-PORT-BINDING-REPLACEMENT-AUTHORITY-ISSUANCE-GATE-V1.json`;
const W='.github/workflows/mcft-cap-08-s6-run-a-qualification-port-binding-correction-effectiveness.yml';
const ORIGINAL='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_RUN_A_QUALIFICATION_PORT_BINDING_CORRECTION.cjs';
const Q=X.join(R,'acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_PORT_BINDING_CORRECTION_EFFECTIVENESS_RESULT.json');
const read=p=>JSON.parse(F.readFileSync(X.join(R,p),'utf8')),text=p=>F.readFileSync(X.join(R,p),'utf8'),git=(...a)=>P.execFileSync('git',a,{cwd:R,encoding:'utf8'}).trim();
const canon=v=>Array.isArray(v)?`[${v.map(canon).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`:JSON.stringify(v);
function sd(v){const x=structuredClone(v);delete x.semantic_digest;return`sha256:${C.createHash('sha256').update(canon(x)).digest('hex')}`;}
function out(v){F.mkdirSync(X.dirname(Q),{recursive:true});F.writeFileSync(Q,JSON.stringify(v,null,2)+'\n');}
try{
 const a=read(AP),b=read(BP),g=read(GP),base=String(process.env.MCFT_BASE_SHA||b.base_main_sha).trim();
 A.equal(base,b.base_main_sha);A.equal(git('merge-base',base,'HEAD'),base);A.equal(git('diff','--check',`${base}...HEAD`),'');
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();A.deepEqual(changed,[...b.changed_files].sort());A.equal(changed.length,5);
 for(const v of[a,b,g])A.equal(v.semantic_digest,sd(v),'SEMANTIC_DIGEST');
 const s=a.implementation_subject;
 A.equal(s.pull_request_number,2722);A.equal(s.candidate_head_sha,'399aa923d6739be65cc71d598b9fd89574f72987');A.equal(s.candidate_tree_sha,'c0b320c5e7fa1e4781f6d6cfd44f4ccfeba31c69');
 A.equal(s.merge_commit_sha,'96be095c0dc4ee197251dc454e63dc1d5d790478');A.equal(s.merge_tree_sha,'c0b320c5e7fa1e4781f6d6cfd44f4ccfeba31c69');A.equal(s.candidate_to_merge_file_delta,0);A.equal(s.candidate_to_merge_tree_equal,true);
 A.equal(git('rev-parse','399aa923d6739be65cc71d598b9fd89574f72987^{tree}'),'c0b320c5e7fa1e4781f6d6cfd44f4ccfeba31c69');
 A.equal(git('rev-parse','96be095c0dc4ee197251dc454e63dc1d5d790478^{tree}'),'c0b320c5e7fa1e4781f6d6cfd44f4ccfeba31c69');
 A.equal(git('diff','--name-only','399aa923d6739be65cc71d598b9fd89574f72987','96be095c0dc4ee197251dc454e63dc1d5d790478'),'');
 for(const [p,h] of Object.entries(a.implementation_object_set))A.equal(git('rev-parse',`96be095c0dc4ee197251dc454e63dc1d5d790478:${p}`),h,`IMPLEMENTATION_BLOB_DRIFT:${p}`);
 const e=a.exact_head_evidence;A.equal(e.focused_workflow_run_id,30602010062);A.equal(e.focused_artifact_id,8782241155);A.equal(e.focused_artifact_digest,'sha256:4942140db845f3f37928aca1aa36492fdc4a11ce0bfaf4f4af4e79cf993e2d4e');
 A.equal(e.standard_ci_run_id,30602010035);A.equal(e.standard_ci_status,'PASS');A.equal(e.required_workflow_count,8);A.equal(e.required_workflow_success_count,8);
 const v=a.verified_result;A.equal(v.v3_operational_run_instance_id,'MCFT-CAP-08-S6-RUN-A-QUAL-20260730-004');A.equal(v.v3_database_name,'geox_mcft_cap08_s6_run_a_qual_004');
 A.equal(v.v3_workflow_dispatch_authorized,false);A.equal(v.v3_operational_instance_reusable,false);A.equal(v.v3_database_identity_reusable,false);
 A.equal(v.port_binding_mock_contract_pass,true);A.equal(v.development_qualification_authority_accepted,true);A.equal(v.final_formal_authority_rejected,true);
 A.equal(v.product_chain_call_count,1);A.equal(v.materialization_output_call_count,1);
 A.equal(v.qualification_port_bundle_blob_sha,'7ba2cfaec2b95700d604cd8e94bdd9b52bbb5f59');A.equal(v.qualification_direct_materializer_blob_sha,'a49213fce84b8a0da1f8677998967d8997afc009');
 const ef=a.effect;A.equal(ef.qualification_port_binding_correction_effective,true);A.equal(ef.v3_operational_instance_reusable,false);A.equal(ef.v3_database_identity_reusable,false);
 A.equal(ef.replacement_authority_may_be_issued_separately,true);A.equal(ef.replacement_authority_subject_must_equal_this_effectiveness_merge_sha,true);A.equal(ef.replacement_authority_must_bind_qualification_port_bundle,true);
 A.equal(ef.actual_execution_authority_present,false);A.equal(ef.database_execution_authorized,false);A.equal(ef.workflow_dispatch_authorized,false);A.equal(ef.run_a_qualification_completed,false);
 A.equal(g.record_status,'RUN_A_QUALIFICATION_REPLACEMENT_AUTHORITY_V4_ISSUANCE_AUTHORIZED');
 const ic=g.issuance_constraints;A.equal(ic.execution_subject_selector,'THIS_EFFECTIVENESS_MERGE_SHA');A.equal(ic.qualification_port_bundle_blob_sha,'7ba2cfaec2b95700d604cd8e94bdd9b52bbb5f59');
 A.equal(ic.qualification_direct_materializer_blob_sha,'a49213fce84b8a0da1f8677998967d8997afc009');A.deepEqual(ic.retired_operational_run_instance_ids,['MCFT-CAP-08-S6-RUN-A-QUAL-20260729-001','MCFT-CAP-08-S6-RUN-A-QUAL-20260729-002','MCFT-CAP-08-S6-RUN-A-QUAL-20260730-003','MCFT-CAP-08-S6-RUN-A-QUAL-20260730-004']);
 A.equal(g.execution_constraints.actual_execution_authority_present,false);A.equal(g.execution_constraints.workflow_dispatch_execution_authorized,false);A.equal(g.execution_constraints.database_execution_performed,false);
 const workflow=text(W);A.match(workflow,/pull_request:/);for(const x of[/workflow_dispatch:/,/services:\s*\n\s*postgres:/,/DATABASE_URL/])A.doesNotMatch(workflow,x);
 const tmp=F.mkdtempSync(X.join(O.tmpdir(),'mcft-cap08-port-binding-effect-'));
 try{
  git('worktree','add','--detach',tmp,'96be095c0dc4ee197251dc454e63dc1d5d790478');
  P.execFileSync(process.execPath,[ORIGINAL],{cwd:tmp,env:{...process.env,MCFT_BASE_SHA:'dbbe1f7dabc728ee453c2174d98152051b2ddc22',GITHUB_EVENT_PATH:''},stdio:'pipe'});
 }finally{try{git('worktree','remove','--force',tmp)}catch{}}
 const z={schema_version:'geox_mcft_cap08_s6_run_a_qualification_port_binding_correction_effectiveness_result_v1',status:'PASS',subject_sha:git('rev-parse','HEAD'),base_sha:base,changed_file_count:5,implementation_subject_sha:'96be095c0dc4ee197251dc454e63dc1d5d790478',implementation_candidate_sha:'399aa923d6739be65cc71d598b9fd89574f72987',implementation_tree_sha:'c0b320c5e7fa1e4781f6d6cfd44f4ccfeba31c69',implementation_blob_count:7,focused_workflow_run_id:30602010062,focused_artifact_id:8782241155,standard_ci_run_id:30602010035,v3_operational_instance_id:'MCFT-CAP-08-S6-RUN-A-QUAL-20260730-004',v3_instance_reusable:false,qualification_port_binding_correction_effective:true,qualification_port_bundle_blob_sha:'7ba2cfaec2b95700d604cd8e94bdd9b52bbb5f59',detached_replay_pass:true,replacement_authority_may_be_issued_separately:true,actual_execution_authority_present:false,database_execution_performed:false,run_a_qualification_completed:false,run_b_executed:false,s6_candidate_implemented:false,mcft_cap_08_complete:false,mcft_cap_09_authorized:false};out(z);console.log(JSON.stringify(z,null,2));
}catch(error){out({schema_version:'geox_mcft_cap08_s6_run_a_qualification_port_binding_correction_effectiveness_result_v1',status:'FAIL',error:error instanceof Error?error.stack||error.message:String(error)});console.error(error);process.exitCode=1;}
