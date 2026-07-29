#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),C=require('node:crypto'),P=require('node:child_process'),F=require('node:fs'),X=require('node:path');
const R=X.resolve(__dirname,'../..'),D='docs/digital_twin/mcft/cap_08';
const AP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-REPLACEMENT-EXECUTION-AUTHORITY-V1.json`;
const BP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-REPLACEMENT-EXECUTION-AUTHORITY-BOUNDARY-V1.json`;
const GP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-REPLACEMENT-AUTHORITY-ISSUANCE-GATE-V1.json`;
const W='.github/workflows/mcft-cap-08-s6-run-a-qualification-replacement-execution-authority.yml';
const Q=X.join(R,'acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_REPLACEMENT_EXECUTION_AUTHORITY_RESULT.json');
const read=p=>JSON.parse(F.readFileSync(X.join(R,p),'utf8')),text=p=>F.readFileSync(X.join(R,p),'utf8'),git=(...a)=>P.execFileSync('git',a,{cwd:R,encoding:'utf8'}).trim();
const canon=v=>Array.isArray(v)?`[${v.map(canon).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`:JSON.stringify(v);
function sd(v){const x=structuredClone(v);delete x.semantic_digest;return`sha256:${C.createHash('sha256').update(canon(x)).digest('hex')}`;}
function out(v){F.mkdirSync(X.dirname(Q),{recursive:true});F.writeFileSync(Q,JSON.stringify(v,null,2)+'\n');}
try{
 const a=read(AP),b=read(BP),g=read(GP),base=String(process.env.MCFT_BASE_SHA||b.base_main_sha).trim();
 A.equal(base,b.base_main_sha);A.equal(git('merge-base',base,'HEAD'),base);A.equal(git('diff','--check',`${base}...HEAD`),'');
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();A.deepEqual(changed,[...b.changed_files].sort());A.equal(changed.length,4);
 for(const v of[a,b])A.equal(v.semantic_digest,sd(v),'SEMANTIC_DIGEST');
 A.equal(g.semantic_digest,'sha256:b090870123b459df164085f330436453dd8e36ee4ac41520063865734a13201f');A.equal(g.record_status,'RUN_A_QUALIFICATION_REPLACEMENT_AUTHORITY_ISSUANCE_AUTHORIZED');
 A.equal(git('rev-parse',`${base}:${GP}`),'0f0756e6bdbd75857ee95bb47603c8742ef88fb4');
 A.equal(a.record_status,'SINGLE_DEVELOPMENT_QUALIFICATION_RUN_DATABASE_EXECUTION_AUTHORIZED');A.equal(a.authority_class,'DEVELOPMENT_QUALIFICATION_ONLY');A.equal(a.evidence_class,'DEVELOPMENT_QUALIFICATION_ONLY');
 A.equal(a.exact_subject_sha,base);A.equal(a.authorized_run_label,'RUN_A');A.equal(a.operational_run_instance_id,'MCFT-CAP-08-S6-RUN-A-QUAL-20260729-002');A.notEqual(a.operational_run_instance_id,a.replacement_context.retired_operational_run_instance_id);
 A.deepEqual(a.database_identity,{database_name:'geox_mcft_cap08_s6_run_a_qual_002',fresh_disposable_required:true,drop_after_run_required:true,identity_frozen:true});A.notEqual(a.database_identity.database_name,a.replacement_context.retired_database_name);
 const issued=Date.parse(a.issued_at),expires=Date.parse(a.expires_at);A.ok(Number.isFinite(issued)&&Number.isFinite(expires)&&expires>issued&&expires-issued<=86400000&&expires>Date.now(),'REPLACEMENT_AUTHORITY_TIME_INVALID');
 for(const k of['single_run_database_execution_authorized','database_execution_workflow_authorized','workflow_dispatch_execution_authorized'])A.equal(a[k],true,k);
 for(const k of['final_formal_run_execution_authorized','final_closure_eligible','hard_acceptance_eligible','s6_candidate_evidence_eligible','cross_run_comparison_eligible','ledger_settlement_eligible','dual_run_ci_authorized','cross_run_comparator_authorized','final_ledger_settlement_authorized'])A.equal(a[k],false,k);
 A.equal(a.replacement_context.effectiveness_merge_sha,base);A.equal(a.replacement_context.failed_workflow_run_id,30437329843);A.equal(a.replacement_context.failed_execution_job_id,90528078435);A.equal(a.replacement_context.retired_instance_reusable,false);A.equal(a.replacement_context.retired_database_identity_reusable,false);A.equal(a.replacement_context.replacement_instance_differs,true);A.equal(a.replacement_context.replacement_database_identity_differs,true);
 for(const [p,h] of[[a.port_bundle_path,a.port_bundle_blob_sha],[a.qualification_workflow_path,a.qualification_workflow_blob_sha],[a.qualification_gate_path,a.qualification_gate_blob_sha],[a.corrected_entrypoint_path,a.corrected_entrypoint_blob_sha],[a.issuance_gate_path,a.issuance_gate_blob_sha]])A.equal(git('rev-parse',`${base}:${p}`),h,`FROZEN_BLOB_DRIFT:${p}`);
 const validated=require(X.join(R,a.qualification_gate_path)).validateQualificationAuthorityV1(a,{exactSubjectSha:base,runLabel:'RUN_A',operationalRunInstanceId:a.operational_run_instance_id});A.equal(validated.module_path,a.port_bundle_path);A.equal(validated.database_name,a.database_identity.database_name);
 const workflow=text(W);A.match(workflow,/pull_request:/);for(const x of[/workflow_dispatch:/,/services:\s*\n\s*postgres:/,/DATABASE_URL/])A.doesNotMatch(workflow,x);
 A.equal(b.product_runtime_source_file_count,0);A.equal(b.runtime_acceptance_file_count,0);A.equal(b.database_execution_workflow_file_count,0);A.equal(b.database_execution_performed,false);A.equal(b.workflow_dispatch_performed,false);
 const z={schema_version:'geox_mcft_cap08_s6_run_a_qualification_replacement_execution_authority_result_v1',status:'PASS',subject_sha:git('rev-parse','HEAD'),base_sha:base,changed_file_count:4,authority_status:a.record_status,authority_class:a.authority_class,evidence_class:a.evidence_class,exact_subject_sha:a.exact_subject_sha,run_label:a.authorized_run_label,operational_run_instance_id:a.operational_run_instance_id,database_name:a.database_identity.database_name,retired_operational_run_instance_id:a.replacement_context.retired_operational_run_instance_id,retired_database_name:a.replacement_context.retired_database_name,corrected_entrypoint_blob_sha:a.corrected_entrypoint_blob_sha,expires_at:a.expires_at,database_execution_performed:false,workflow_dispatch_performed:false,run_a_qualification_completed:false,run_b_executed:false,hard_acceptance_eligible:false,s6_candidate_implemented:false,mcft_cap_08_complete:false,mcft_cap_09_authorized:false};
 out(z);console.log(JSON.stringify(z,null,2));
}catch(error){out({schema_version:'geox_mcft_cap08_s6_run_a_qualification_replacement_execution_authority_result_v1',status:'FAIL',error:error instanceof Error?error.message:String(error)});console.error(error);process.exitCode=1;}
