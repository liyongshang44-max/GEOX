#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),C=require('node:crypto'),P=require('node:child_process'),F=require('node:fs'),X=require('node:path'),O=require('node:os'),U=require('node:url');
const R=X.resolve(__dirname,'../..'),D='docs/digital_twin/mcft/cap_08';
const CP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-HARNESS-DEPENDENCY-CORRECTION-V1.json`;
const BP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-HARNESS-DEPENDENCY-CORRECTION-BOUNDARY-V1.json`;
const FP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-HARNESS-DEPENDENCY-FAILED-ATTEMPT-V1.json`;
const HP='scripts/runtime_acceptance/mcft_cap08_s6_run_a_qualification/qualification_harness_v1.cjs';
const Q=X.join(R,'acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_HARNESS_DEPENDENCY_CORRECTION_RESULT.json');
const read=p=>JSON.parse(F.readFileSync(X.join(R,p),'utf8')),text=p=>F.readFileSync(X.join(R,p),'utf8'),git=(...a)=>P.execFileSync('git',a,{cwd:R,encoding:'utf8'}).trim();
const canon=v=>Array.isArray(v)?`[${v.map(canon).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`:JSON.stringify(v);
function sd(v){const x=structuredClone(v);delete x.semantic_digest;return`sha256:${C.createHash('sha256').update(canon(x)).digest('hex')}`;}
function out(v){F.mkdirSync(X.dirname(Q),{recursive:true});F.writeFileSync(Q,JSON.stringify(v,null,2)+'\n');}
function h(i){return`sha256:${C.createHash('sha256').update(String(i)).digest('hex')}`;}
async function mockReplay(){
 const loaderPath=X.join(R,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/contract_loader_v1.cjs');
 const loader=require(loaderPath),original=loader.loadSingleRunHarnessContractsV1;
 const scope={tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',field_id:'fieldA',season_id:'seasonA',zone_id:'zoneA'};
 loader.loadSingleRunHarnessContractsV1=()=>({run:{scope,tick_ids:Array.from({length:24},(_,i)=>`T${String(i+1).padStart(2,'0')}`),post_run_phases:['G00','G01','G02']},s6:{formal_run_contract:{all_providers_enabled_from_start:['OBSERVATION','STATE','FORECAST','SCENARIO','RESIDUAL']}},dataset:{semantic_digest:h('dataset')}});
 const {ORACLE}=require(X.join(R,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/receipt_manifest_v1.cjs'));
 const {executeRunAQualificationHarnessV1}=require(X.join(R,HP));
 const byRef=new Map();
 const ports={
  freshDatabase:{assertFreshDisposable:async()=>true},
  materializer:{executeDirectFormalRun:async({spec})=>{const lineage_id='lineage_'+('a'.repeat(24)),revision_id='revision_'+('b'.repeat(24)),receipts=[];let n=0;for(const [role,count] of Object.entries(ORACLE))for(let i=0;i<count;i++){const object_ref=`obj_${String(n).padStart(4,'0')}`,object_hash=h(object_ref);receipts.push({member_role:role,object_type:role.toLowerCase(),object_ref,object_hash,phase_id:'B00',logical_time:`2026-01-01T00:${String(n%60).padStart(2,'0')}:00.000Z`,formal_run_id:spec.formal_run_id,...scope,lineage_id,revision_id});byRef.set(object_ref,{object_id:object_ref,determinism_hash:object_hash,formal_run_id:spec.formal_run_id,...scope});n++;}while(receipts.length<153){const object_ref=`extra_${String(n).padStart(4,'0')}`,object_hash=h(object_ref);receipts.push({member_role:'QUALIFICATION_AUXILIARY',object_type:'qualification_auxiliary',object_ref,object_hash,phase_id:'B00',logical_time:`2026-01-01T01:${String(n%60).padStart(2,'0')}:00.000Z`,formal_run_id:spec.formal_run_id,...scope,lineage_id,revision_id});byRef.set(object_ref,{object_id:object_ref,determinism_hash:object_hash,formal_run_id:spec.formal_run_id,...scope});n++;}return{formal_run_id:spec.formal_run_id,final_formal_run_id:spec.formal_run_id,lineage_id,revision_id,phase_results:spec.phases.map(p=>({phase_id:p.phase_id,status:'PASS'})),canonical_receipts:receipts,selector_snapshot:{status:'MOCK'},database_instance_digest:h('db'),artifact_ref:'mock://product',artifact_digest:h('product'),operational_events:[]};}},
  closureReader:{query:async(_sql,args)=>({rows:(args[0]||[]).map(ref=>({object:byRef.get(ref)}))})},
  recovery:{executeVector:async({vector})=>({vector_id:vector.vector_id,status:'PASS',silent_repair_used:false})},
  cap07Reader:{request:async()=>({status:200,cache_control:'no-store',content_hash:h('content'),response_hash:h('response'),next_cursor:null})},
  artifactWriter:{writeBundle:async()=>{const p=X.join(O.tmpdir(),`mcft-cap08-qual-probe-${process.pid}-${Date.now()}.json`);F.writeFileSync(p,'{}');return{transport_file:U.pathToFileURL(p).href};}}
 };
 const authority={record_status:'SINGLE_DEVELOPMENT_QUALIFICATION_RUN_DATABASE_EXECUTION_AUTHORIZED',authority_class:'DEVELOPMENT_QUALIFICATION_ONLY',exact_subject_sha:'9b96386c137a3c5e0984525faa96480ee39f1212',final_closure_eligible:false,hard_acceptance_eligible:false};
 try{return await executeRunAQualificationHarnessV1({input:{runLabel:'RUN_A',operationalRunInstanceId:'MCFT-CAP-08-S6-RUN-A-QUAL-MOCK-001',exactSubjectSha:authority.exact_subject_sha},ports,executionAuthority:authority});}finally{loader.loadSingleRunHarnessContractsV1=original;}
}
(async()=>{try{
 const c=read(CP),b=read(BP),f=read(FP),base=String(process.env.MCFT_BASE_SHA||b.base_main_sha).trim();
 A.equal(base,b.base_main_sha);A.equal(git('merge-base',base,'HEAD'),base);A.equal(git('diff','--check',`${base}...HEAD`),'');
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();A.deepEqual(changed,[...b.changed_files].sort());A.equal(changed.length,11);
 for(const v of[c,b,f])A.equal(v.semantic_digest,sd(v),'SEMANTIC_DIGEST');
 A.equal(f.workflow_run.run_id,30559432869);A.equal(f.authority_job.job_id,90928324941);A.equal(f.execution_job.job_id,90928367259);A.equal(f.execution_job.failure_code,'MODULE_NOT_FOUND');A.equal(f.step_outcomes.fresh_database_bootstrap_completed,true);A.equal(f.step_outcomes.qualification_harness_function_entered,false);A.equal(f.step_outcomes.disposable_database_drop_completed,true);A.equal(f.artifacts.failed_qualification.artifact_id,8766223949);A.equal(f.artifacts.failed_qualification.qualification_result_present,false);A.equal(f.classification.operational_instance_reusable,false);A.equal(f.classification.rerun_jobs_authorized,false);
 A.equal(git('rev-parse',`${base}:${HP}`),c.correction.superseded_harness_blob_sha);A.notEqual(git('rev-parse',`HEAD:${HP}`),c.correction.superseded_harness_blob_sha);
 const harness=text(HP);for(const x of['contract_loader_v1.cjs','execution_spec_v1.cjs','receipt_manifest_v1.cjs','closure_readback_adapter_v1.cjs'])A.match(harness,new RegExp(`mcft_cap08_s6_single_run_db/${x.replaceAll('.','\\.')}`));for(const x of['qualification_materializer_adapter_v1.cjs','qualification_recovery_execution_adapter_v1.cjs','qualification_cap07_readback_execution_adapter_v1.cjs','qualification_port_contract_v1.cjs'])A.match(harness,new RegExp(x.replaceAll('.','\\.')));
 for(const p of b.changed_files.filter(p=>p.endsWith('.cjs')))P.execFileSync(process.execPath,['--check',p],{cwd:R,stdio:'pipe'});
 const shared=c.correction.final_formal_shared_adapter_blobs_preserved;for(const [name,blob] of Object.entries(shared)){const p=`scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/${name}`;A.equal(git('rev-parse',`${base}:${p}`),blob);A.equal(git('rev-parse',`HEAD:${p}`),blob);}
 for(const [p,blob] of Object.entries({[c.preserved_frozen_objects.port_bundle_path]:c.preserved_frozen_objects.port_bundle_blob_sha,[c.preserved_frozen_objects.qualification_workflow_path]:c.preserved_frozen_objects.qualification_workflow_blob_sha,[c.preserved_frozen_objects.qualification_gate_path]:c.preserved_frozen_objects.qualification_gate_blob_sha,[c.preserved_frozen_objects.qualification_entrypoint_path]:c.preserved_frozen_objects.qualification_entrypoint_blob_sha}))A.equal(git('rev-parse',`HEAD:${p}`),blob,`FROZEN_BLOB_DRIFT:${p}`);
 const r=await mockReplay();A.equal(r.status,'PASS');A.equal(r.canonical_receipt_count,153);A.equal(r.recovery_vector_count,7);A.equal(r.cap07_surface_count,10);A.equal(r.artifact_writer_port_probe_quarantined,true);A.equal(r.ha_witness_count,0);A.equal(r.final_closure_source_generated,false);A.equal(r.hard_acceptance_eligible,false);
 const z={schema_version:'geox_mcft_cap08_s6_run_a_qualification_harness_dependency_correction_result_v1',status:'PASS',subject_sha:git('rev-parse','HEAD'),base_sha:base,changed_file_count:11,failed_workflow_run_id:f.workflow_run.run_id,failed_execution_job_id:f.execution_job.job_id,failed_operational_run_instance_id:f.execution_identity.operational_run_instance_id,failed_database_name:f.execution_identity.database_name,mock_qualification_replay_status:r.status,canonical_receipt_count:r.canonical_receipt_count,recovery_vector_count:r.recovery_vector_count,cap07_surface_count:r.cap07_surface_count,artifact_writer_probe_quarantined:r.artifact_writer_port_probe_quarantined,database_execution_performed:false,workflow_dispatch_performed:false,run_a_qualification_completed:false,run_b_executed:false,hard_acceptance_eligible:false,s6_candidate_implemented:false,mcft_cap_08_complete:false,mcft_cap_09_authorized:false};out(z);console.log(JSON.stringify(z,null,2));
}catch(e){out({schema_version:'geox_mcft_cap08_s6_run_a_qualification_harness_dependency_correction_result_v1',status:'FAIL',error:e instanceof Error?e.stack||e.message:String(e)});console.error(e);process.exitCode=1;}})();
