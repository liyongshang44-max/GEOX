#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),C=require('node:crypto'),P=require('node:child_process'),F=require('node:fs'),X=require('node:path');
const R=X.resolve(__dirname,'../..'),D='docs/digital_twin/mcft/cap_08';
const AP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-REPLACEMENT-EXECUTION-AUTHORITY-V4.json`,BP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-REPLACEMENT-EXECUTION-AUTHORITY-BOUNDARY-V4.json`;
const GP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-PORT-BINDING-REPLACEMENT-AUTHORITY-ISSUANCE-GATE-V1.json`,EP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-PORT-BINDING-CORRECTION-EFFECTIVENESS-AUTHORITY-V1.json`;
const W='.github/workflows/mcft-cap-08-s6-run-a-qualification-replacement-execution-authority-v4.yml',Q=X.join(R,'acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_REPLACEMENT_EXECUTION_AUTHORITY_V4_RESULT.json');
const read=p=>JSON.parse(F.readFileSync(X.join(R,p),'utf8')),git=(...a)=>P.execFileSync('git',a,{cwd:R,encoding:'utf8'}).trim();
const canon=v=>Array.isArray(v)?`[${v.map(canon).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`:JSON.stringify(v);
const sd=v=>{const x=structuredClone(v);delete x.semantic_digest;return`sha256:${C.createHash('sha256').update(canon(x)).digest('hex')}`};
const out=v=>{F.mkdirSync(X.dirname(Q),{recursive:true});F.writeFileSync(Q,JSON.stringify(v,null,2)+'\n')};
try{
 const a=read(AP),b=read(BP),g=read(GP),e=read(EP),base=String(process.env.MCFT_BASE_SHA||b.base_main_sha).trim();
 A.equal(base,b.base_main_sha);A.equal(git('merge-base',base,'HEAD'),base);A.equal(git('diff','--check',`${base}...HEAD`),'');
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();A.deepEqual(changed,[...b.changed_files].sort());A.equal(changed.length,4);
 for(const v of[a,b])A.equal(v.semantic_digest,sd(v),'SEMANTIC_DIGEST');
 A.equal(g.record_status,'RUN_A_QUALIFICATION_REPLACEMENT_AUTHORITY_V4_ISSUANCE_AUTHORIZED');A.equal(g.semantic_digest,'sha256:15211ccee8296e4cb4f028dbc6b56ec87733b32bae610a33aaf5b45af9452313');A.equal(git('rev-parse',`${base}:${GP}`),'81f8e8465532144ea7308190a5f261310a66bf40');
 A.equal(e.record_status,'RUN_A_QUALIFICATION_PORT_BINDING_CORRECTION_IMPLEMENTED_EFFECTIVE');A.equal(e.semantic_digest,'sha256:0e258e58a15bd3a21fbeea133111ed76f13a9aca206a19f9e86c0235138492f3');
 A.equal(a.record_status,'SINGLE_DEVELOPMENT_QUALIFICATION_RUN_DATABASE_EXECUTION_AUTHORIZED');A.equal(a.authority_class,'DEVELOPMENT_QUALIFICATION_ONLY');A.equal(a.evidence_class,'DEVELOPMENT_QUALIFICATION_ONLY');
 A.equal(a.exact_subject_sha,base);A.equal(a.effectiveness_merge_sha,base);A.equal(a.authorized_run_label,'RUN_A');A.equal(a.operational_run_instance_id,'MCFT-CAP-08-S6-RUN-A-QUAL-20260731-005');
 A.deepEqual(a.database_identity,{database_name:'geox_mcft_cap08_s6_run_a_qual_005',fresh_disposable_required:true,drop_after_run_required:true,identity_frozen:true});
 const issued=Date.parse(a.issued_at),expires=Date.parse(a.expires_at);A.ok(expires>issued&&expires-issued<=86400000&&expires>Date.now(),'REPLACEMENT_AUTHORITY_TIME_INVALID');
 for(const k of['single_run_database_execution_authorized','database_execution_workflow_authorized','workflow_dispatch_execution_authorized'])A.equal(a[k],true,k);
 for(const k of['final_formal_run_execution_authorized','final_closure_eligible','hard_acceptance_eligible','s6_candidate_evidence_eligible','cross_run_comparison_eligible','ledger_settlement_eligible'])A.equal(a[k],false,k);
 A.equal(a.port_bundle_path,g.issuance_constraints.qualification_port_bundle_path);A.equal(a.port_bundle_blob_sha,g.issuance_constraints.qualification_port_bundle_blob_sha);
 A.equal(a.qualification_direct_materializer_blob_sha,g.issuance_constraints.qualification_direct_materializer_blob_sha);
 A.deepEqual(a.replacement_context.retired_operational_run_instance_ids,g.issuance_constraints.retired_operational_run_instance_ids);A.deepEqual(a.replacement_context.retired_database_names,g.issuance_constraints.retired_database_names);A.equal(a.replacement_context.retired_identities_reusable,false);
 const frozen=[[a.port_bundle_path,a.port_bundle_blob_sha],[a.qualification_direct_materializer_path,a.qualification_direct_materializer_blob_sha],[a.qualification_workflow_path,a.qualification_workflow_blob_sha],[a.qualification_gate_path,a.qualification_gate_blob_sha],[a.qualification_entrypoint_path,a.qualification_entrypoint_blob_sha],[a.corrected_harness_path,a.corrected_harness_blob_sha],[a.issuance_gate_path,a.issuance_gate_blob_sha],[a.effectiveness_authority_path,a.effectiveness_authority_blob_sha],[a.replacement_context.superseded_v3_authority_path,a.replacement_context.superseded_v3_authority_blob_sha],[a.replacement_context.port_binding_incompatibility_path,a.replacement_context.port_binding_incompatibility_blob_sha]];
 for(const v of Object.values(a.qualification_adapter_blobs))frozen.push([v.path,v.blob_sha]);for(const [p,h] of frozen)A.equal(git('rev-parse',`${base}:${p}`),h,`FROZEN_BLOB_DRIFT:${p}`);
 const v=require(X.join(R,a.qualification_gate_path)).validateQualificationAuthorityV1(a,{exactSubjectSha:base,runLabel:'RUN_A',operationalRunInstanceId:a.operational_run_instance_id});A.equal(v.module_path,a.port_bundle_path);A.equal(v.database_name,a.database_identity.database_name);
 const wf=F.readFileSync(X.join(R,W),'utf8');A.match(wf,/pull_request:/);A.doesNotMatch(wf,/workflow_dispatch:|DATABASE_URL|services:\s*\n\s*postgres:/);
 A.equal(b.database_execution_performed,false);A.equal(b.workflow_dispatch_performed,false);A.equal(b.product_runtime_source_file_count,0);
 const z={schema_version:'geox_mcft_cap08_s6_run_a_qualification_replacement_execution_authority_v4_result_v1',status:'PASS',subject_sha:git('rev-parse','HEAD'),base_sha:base,changed_file_count:4,exact_subject_sha:a.exact_subject_sha,operational_run_instance_id:a.operational_run_instance_id,database_name:a.database_identity.database_name,port_bundle_blob_sha:a.port_bundle_blob_sha,expires_at:a.expires_at,database_execution_performed:false,workflow_dispatch_performed:false,run_a_qualification_completed:false,hard_acceptance_eligible:false,mcft_cap_08_complete:false,mcft_cap_09_authorized:false};out(z);console.log(JSON.stringify(z,null,2));
}catch(error){out({schema_version:'geox_mcft_cap08_s6_run_a_qualification_replacement_execution_authority_v4_result_v1',status:'FAIL',error:error instanceof Error?error.stack||error.message:String(error)});console.error(error);process.exitCode=1;}
