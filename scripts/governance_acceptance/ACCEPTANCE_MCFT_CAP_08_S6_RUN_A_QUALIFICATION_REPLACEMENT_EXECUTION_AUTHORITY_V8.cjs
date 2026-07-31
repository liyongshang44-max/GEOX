#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),C=require('node:crypto'),P=require('node:child_process'),F=require('node:fs'),X=require('node:path');
const R=X.resolve(__dirname,'../..'),D='docs/digital_twin/mcft/cap_08';
const AP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-REPLACEMENT-EXECUTION-AUTHORITY-V8.json`;
const BP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-REPLACEMENT-EXECUTION-AUTHORITY-BOUNDARY-V8.json`;
const GP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-S4-PERSISTENCE-INTERLEAVE-REPLACEMENT-AUTHORITY-ISSUANCE-GATE-V1.json`;
const EP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-S4-PERSISTENCE-INTERLEAVE-CORRECTION-EFFECTIVENESS-AUTHORITY-V1.json`;
const W='.github/workflows/mcft-cap-08-s6-run-a-qualification-replacement-execution-authority-v8.yml',Q=X.join(R,'acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_REPLACEMENT_EXECUTION_AUTHORITY_V8_RESULT.json');
const read=p=>JSON.parse(F.readFileSync(X.join(R,p),'utf8')),text=p=>F.readFileSync(X.join(R,p),'utf8'),git=(...a)=>P.execFileSync('git',a,{cwd:R,encoding:'utf8'}).trim();
const canon=v=>Array.isArray(v)?`[${v.map(canon).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`:JSON.stringify(v);
const sd=v=>{const x=structuredClone(v);delete x.semantic_digest;return`sha256:${C.createHash('sha256').update(canon(x)).digest('hex')}`},out=v=>{F.mkdirSync(X.dirname(Q),{recursive:true});F.writeFileSync(Q,JSON.stringify(v,null,2)+'\n')};
try{
 const a=read(AP),b=read(BP),g=read(GP),e=read(EP),base=String(process.env.MCFT_BASE_SHA||b.base_main_sha).trim();
 A.equal(base,b.base_main_sha);A.equal(git('merge-base',base,'HEAD'),base);A.equal(git('diff','--check',`${base}...HEAD`),'');
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();A.deepEqual(changed,[...b.changed_files].sort());A.equal(changed.length,4);for(const v of[a,b])A.equal(v.semantic_digest,sd(v),'SEMANTIC_DIGEST');
 A.equal(a.record_status,'SINGLE_DEVELOPMENT_QUALIFICATION_RUN_DATABASE_EXECUTION_AUTHORIZED');A.equal(a.authority_class,'DEVELOPMENT_QUALIFICATION_ONLY');A.equal(a.evidence_class,'DEVELOPMENT_QUALIFICATION_ONLY');A.equal(a.exact_subject_sha,base);A.equal(a.effectiveness_merge_sha,base);
 A.equal(a.issuance_gate_blob_sha,'0ec4b580c27e7e594e9acf9d5a5eb83cd6dbe127');A.equal(a.effectiveness_authority_blob_sha,'f004cf64e8297267a39574d438fdad2049af32d5');A.equal(g.semantic_digest,sd(g));A.equal(e.semantic_digest,sd(e));A.equal(g.effectiveness_authority_semantic_digest,e.semantic_digest);A.equal(e.effect.qualification_s4_persistence_interleave_correction_effective,true);
 A.equal(a.operational_run_instance_id,'MCFT-CAP-08-S6-RUN-A-QUAL-20260801-009');A.equal(a.database_identity.database_name,'geox_mcft_cap08_s6_run_a_qual_009');A.equal(a.replacement_context.retired_operational_run_instance_ids.at(-1),'MCFT-CAP-08-S6-RUN-A-QUAL-20260801-008');A.equal(a.replacement_context.retired_database_names.at(-1),'geox_mcft_cap08_s6_run_a_qual_008');A.equal(a.replacement_context.retired_identities_reusable,false);
 const issued=Date.parse(a.issued_at),expires=Date.parse(a.expires_at);A.ok(Number.isFinite(issued)&&Number.isFinite(expires));A.ok(expires>issued);A.ok(expires-issued<=24*60*60*1000);
 const pins={
 [a.port_bundle_path]:a.port_bundle_blob_sha,[a.qualification_fresh_database_port_path]:a.qualification_fresh_database_port_blob_sha,
 [a.qualification_direct_materializer_path]:a.qualification_direct_materializer_blob_sha,[a.qualification_product_chain_path]:a.qualification_product_chain_blob_sha,
 [a.qualification_product_loader_path]:a.qualification_product_loader_blob_sha,[a.qualification_s4_persistence_adapter_path]:a.qualification_s4_persistence_adapter_blob_sha,
 [a.qualification_workflow_path]:a.qualification_workflow_blob_sha,[a.qualification_gate_path]:a.qualification_gate_blob_sha,
 [a.qualification_entrypoint_path]:a.qualification_entrypoint_blob_sha,[a.corrected_harness_path]:a.corrected_harness_blob_sha,
 [a.issuance_gate_path]:a.issuance_gate_blob_sha,[a.effectiveness_authority_path]:a.effectiveness_authority_blob_sha
 };for(const [p,h] of Object.entries(pins))A.equal(git('rev-parse',`${base}:${p}`),h,`PIN_DRIFT:${p}`);
 for(const v of Object.values(a.qualification_adapter_blobs))A.equal(git('rev-parse',`${base}:${v.path}`),v.blob_sha,`ADAPTER_DRIFT:${v.path}`);
 A.equal(a.qualification_product_chain_blob_sha,'79c4b0bc081cf74749ee2f38ec3b6ae51e271cc3');A.equal(a.qualification_product_loader_blob_sha,'ef73eccd7dec329fc00fa939d75d4f8730ed36de');A.equal(a.qualification_s4_persistence_adapter_blob_sha,'2f91751e0ad7fec9558ef0418c5941702c8a5151');
 const loader=text(a.qualification_product_loader_path),adapter=text(a.qualification_s4_persistence_adapter_path);A.match(loader,/createS6S4AtomicPersistenceRepositoryV1/);A.match(adapter,/S6_S4_INTERLEAVE_S3_COMPLETION_TUPLE_MUST_BE_ABSENT/);A.match(adapter,/BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE/);A.match(adapter,/write_delta:7/);
 A.equal(a.single_run_database_execution_authorized,true);A.equal(a.database_execution_workflow_authorized,true);A.equal(a.workflow_dispatch_execution_authorized,true);for(const k of['final_formal_run_execution_authorized','final_closure_eligible','hard_acceptance_eligible','s6_candidate_evidence_eligible','cross_run_comparison_eligible','ledger_settlement_eligible','dual_run_ci_authorized','cross_run_comparator_authorized','final_ledger_settlement_authorized'])A.equal(a[k],false,k);
 const wf=text(W);A.match(wf,/pull_request:/);for(const x of[/workflow_dispatch:/,/services:\s*\n\s*postgres:/,/DATABASE_URL/])A.doesNotMatch(wf,x);A.equal(b.database_execution_performed,false);A.equal(b.workflow_dispatch_performed,false);
 const z={schema_version:'geox_mcft_cap08_s6_run_a_qualification_replacement_execution_authority_v8_result_v1',status:'PASS',subject_sha:git('rev-parse','HEAD'),base_sha:base,changed_file_count:4,exact_subject_sha:a.exact_subject_sha,operational_run_instance_id:a.operational_run_instance_id,database_name:a.database_identity.database_name,qualification_product_loader_blob_sha:a.qualification_product_loader_blob_sha,qualification_s4_persistence_adapter_blob_sha:a.qualification_s4_persistence_adapter_blob_sha,authority_lifetime_ms:expires-issued,retired_instance_count:a.replacement_context.retired_operational_run_instance_ids.length,database_execution_performed:false,workflow_dispatch_performed:false,run_a_qualification_completed:false};out(z);console.log(JSON.stringify(z,null,2));
}catch(e){out({schema_version:'geox_mcft_cap08_s6_run_a_qualification_replacement_execution_authority_v8_result_v1',status:'FAIL',error:e instanceof Error?e.stack||e.message:String(e)});console.error(e);process.exitCode=1}
