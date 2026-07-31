#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),C=require('node:crypto'),P=require('node:child_process'),F=require('node:fs'),X=require('node:path');
const {pathToFileURL}=require('node:url');
const R=X.resolve(__dirname,'../..'),D='docs/digital_twin/mcft/cap_08';
const CP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-HARNESS-PORT-CORRECTION-V1.json`;
const BP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-HARNESS-PORT-CORRECTION-BOUNDARY-V1.json`;
const FP=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-FAILED-ATTEMPT-003-V1.json`;
const H='scripts/runtime_acceptance/mcft_cap08_s6_run_a_qualification/qualification_harness_v1.cjs';
const PI='scripts/runtime_acceptance/mcft_cap08_s6_run_a_qualification_ports/index_v1.cjs';
const PM='scripts/runtime_acceptance/mcft_cap08_s6_run_a_qualification_ports/direct_materializer_v1.cjs';
const W='.github/workflows/mcft-cap-08-s6-run-a-qualification-harness-port-correction.yml';
const Q=X.join(R,'acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_HARNESS_PORT_CORRECTION_RESULT.json');
const read=p=>JSON.parse(F.readFileSync(X.join(R,p),'utf8')),text=p=>F.readFileSync(X.join(R,p),'utf8'),git=(...a)=>P.execFileSync('git',a,{cwd:R,encoding:'utf8'}).trim();
const canon=v=>Array.isArray(v)?`[${v.map(canon).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`:JSON.stringify(v);
function sd(v){const x=structuredClone(v);delete x.semantic_digest;return`sha256:${C.createHash('sha256').update(canon(x)).digest('hex')}`;}
function out(v){F.mkdirSync(X.dirname(Q),{recursive:true});F.writeFileSync(Q,JSON.stringify(v,null,2)+'\n');}
function hash(s){return`sha256:${C.createHash('sha256').update(s).digest('hex')}`;}
function buildReceipts(spec,lineageId,revisionId){
 const counts={BOOTSTRAP_ROOT:1,POSTERIOR_STATE:25,RUNTIME_TICK:24,FORECAST_RUN:24,SCENARIO_SET:24,FORECAST_VERIFICATION_OBSERVATION:24,FORECAST_RESIDUAL:24,CALIBRATION_CANDIDATE:1,SHADOW_EVALUATION:1,DECISION_ACTION_EVIDENCE:5};
 const receipts=[];let n=0;const phase=(role,i)=>role==='BOOTSTRAP_ROOT'||(role==='POSTERIOR_STATE'&&i===0)?'B00':role==='DECISION_ACTION_EVIDENCE'?`G0${i%3}`:`T${String(i%24).padStart(2,'0')}`;
 for(const [role,count] of Object.entries(counts))for(let i=0;i<count;i++){const object_ref=`qual_mock_${String(n++).padStart(3,'0')}`,object_hash=hash(object_ref);receipts.push({member_role:role,object_type:`${role.toLowerCase()}_v1`,object_ref,object_hash,phase_id:phase(role,i),logical_time:'2026-01-01T00:00:00.000Z',formal_run_id:spec.formal_run_id,...spec.scope,lineage_id:lineageId,revision_id:revisionId});}
 A.equal(receipts.length,153);return receipts;
}
async function mockReplay(){
 process.env.MCFT_LOCAL_REPLAY='1';
 const {executeRunAQualificationHarnessV1}=require(X.join(R,H));
 const shared={receipts:[],objects:new Map()};
 const authority={record_status:'SINGLE_DEVELOPMENT_QUALIFICATION_RUN_DATABASE_EXECUTION_AUTHORIZED',authority_class:'DEVELOPMENT_QUALIFICATION_ONLY',evidence_class:'DEVELOPMENT_QUALIFICATION_ONLY',exact_subject_sha:'9b96386c137a3c5e0984525faa96480ee39f1212',authorized_run_label:'RUN_A',operational_run_instance_id:'MCFT-CAP-08-S6-RUN-A-QUAL-MOCK-004',final_formal_run_execution_authorized:false,final_closure_eligible:false,hard_acceptance_eligible:false};
 const ports={
  freshDatabase:{async assertFreshDisposable(){return{status:'PASS',fresh:true};}},
  materializer:{async executeDirectFormalRun(spec,executionAuthority){A.equal(executionAuthority,authority);const lineage_id='lineage_000000000000000000000001',revision_id='revision_000000000000000000000001';const receipts=buildReceipts(spec,lineage_id,revision_id);shared.receipts=receipts;for(const r of receipts)shared.objects.set(r.object_ref,{object_id:r.object_ref,determinism_hash:r.object_hash,...spec.scope,formal_run_id:spec.formal_run_id});return{formal_run_id:spec.formal_run_id,final_formal_run_id:spec.formal_run_id,lineage_id,revision_id,phase_results:spec.phases.map(p=>({phase_id:p.phase_id,status:'PASS'})),canonical_receipts:receipts,selector_snapshot:{mock:true},database_instance_digest:hash('db'),artifact_ref:'urn:mcft:qualification:mock',artifact_digest:hash('artifact'),operational_events:[]};}},
  closureReader:{async query(_sql,values){return{rows:values[0].map(ref=>({fact_id:`fact_${ref}`,object:shared.objects.get(ref)}))};}},
  recovery:{async executeVector({vector}){return{vector_id:vector.vector_id,status:'PASS',silent_repair_used:false,canonical_write_delta:0};}},
  cap07Reader:{async request(){return{status:200,cache_control:'no-store',content_hash:hash('content'),response_hash:hash('response'),next_cursor:null};}},
  artifactWriter:{async writeBundle(bundle){const p=X.join(R,'acceptance-output/MCFT_CAP_08_S6_QUALIFICATION_MOCK_TRANSPORT.json');F.mkdirSync(X.dirname(p),{recursive:true});F.writeFileSync(p,JSON.stringify({formal_run_id:bundle.spec.formal_run_id})+'\n');return{transport_file:pathToFileURL(p).href};}}
 };
 const result=await executeRunAQualificationHarnessV1({input:{exactSubjectSha:authority.exact_subject_sha,runLabel:'RUN_A',operationalRunInstanceId:authority.operational_run_instance_id},ports,executionAuthority:authority});
 A.equal(result.status,'PASS');A.equal(result.canonical_receipt_count,153);A.equal(result.recovery_vector_count,7);A.equal(result.cap07_surface_count,10);A.equal(result.ha_witness_count,0);A.equal(result.hard_acceptance_eligible,false);A.equal(result.final_closure_source_generated,false);return result;
}
(async()=>{try{
 const c=read(CP),b=read(BP),f=read(FP),base=String(process.env.MCFT_BASE_SHA||b.base_main_sha).trim();
 A.equal(base,b.base_main_sha);A.equal(git('merge-base',base,'HEAD'),base);A.equal(git('diff','--check',`${base}...HEAD`),'');
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();A.deepEqual(changed,[...b.changed_files].sort());A.equal(changed.length,9);
 for(const v of[c,b,f])A.equal(v.semantic_digest,sd(v),'SEMANTIC_DIGEST');
 A.equal(f.workflow_run.run_id,30559432869);A.equal(f.authority_job.job_id,90928324941);A.equal(f.execution_job.job_id,90928367259);A.equal(f.execution_job.failure_message,"Cannot find module './contract_loader_v1.cjs'");A.equal(f.step_outcomes.fresh_database_bootstrap_completed,true);A.equal(f.step_outcomes.qualification_harness_function_entered,false);A.equal(f.step_outcomes.disposable_database_drop_completed,true);A.equal(f.classification.operational_instance_reusable,false);A.equal(f.classification.rerun_jobs_authorized,false);
 A.equal(c.record_status,'RUN_A_QUALIFICATION_HARNESS_PORT_CORRECTION_IMPLEMENTED_NOT_EFFECTIVE');A.equal(c.first_legal_next_action_after_merge,'SETTLE_QUALIFICATION_HARNESS_PORT_CORRECTION_EFFECTIVENESS');
 A.equal(git('rev-parse',`${base}:${H}`),c.correction.superseded_harness_blob_sha);A.equal(git('rev-parse',`HEAD:${H}`),c.correction.corrected_harness_blob_sha);A.equal(git('rev-parse',`HEAD:${PI}`),c.correction.qualification_port_bundle_blob_sha);A.equal(git('rev-parse',`HEAD:${PM}`),c.correction.qualification_materializer_blob_sha);A.equal(git('rev-parse',`HEAD:${FP}`),c.failed_attempt_record_blob_sha);
 for(const [p,h] of Object.entries({[c.preserved_frozen_objects.final_formal_port_bundle_path]:c.preserved_frozen_objects.final_formal_port_bundle_blob_sha,[c.preserved_frozen_objects.qualification_workflow_path]:c.preserved_frozen_objects.qualification_workflow_blob_sha,[c.preserved_frozen_objects.qualification_gate_path]:c.preserved_frozen_objects.qualification_gate_blob_sha,[c.preserved_frozen_objects.qualification_entrypoint_path]:c.preserved_frozen_objects.qualification_entrypoint_blob_sha,[c.preserved_frozen_objects.workflow_port_contract_path]:c.preserved_frozen_objects.workflow_port_contract_blob_sha}))A.equal(git('rev-parse',`HEAD:${p}`),h,`FROZEN_BLOB_DRIFT:${p}`);
 const ht=text(H),pit=text(PI),pmt=text(PM),wt=text(W);A.doesNotMatch(ht,/require\('\.\/contract_loader_v1\.cjs'\)/);A.match(ht,/mcft_cap08_s6_single_run_db\/contract_loader_v1\.cjs/);A.match(ht,/executeDirectFormalRun\(unboundSpec,executionAuthority\)/);A.match(pit,/createDirectQualificationMaterializerV1/);A.match(pmt,/SINGLE_DEVELOPMENT_QUALIFICATION_RUN_DATABASE_EXECUTION_AUTHORIZED/);A.doesNotMatch(pmt,/SINGLE_FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORIZED/);A.match(wt,/pull_request:/);A.doesNotMatch(wt,/workflow_dispatch:|services:\s*\n\s*postgres:|DATABASE_URL/);
 for(const p of changed.filter(x=>x.endsWith('.cjs')))P.execFileSync(process.execPath,['--check',p],{cwd:R,stdio:'pipe'});
 const mock=await mockReplay();
 A.equal(b.product_runtime_source_file_count,0);A.equal(b.database_execution_workflow_file_count,0);A.equal(b.database_execution_performed,false);A.equal(b.workflow_dispatch_performed,false);
 const z={schema_version:'geox_mcft_cap08_s6_run_a_qualification_harness_port_correction_result_v1',status:'PASS',subject_sha:git('rev-parse','HEAD'),base_sha:base,changed_file_count:9,failed_workflow_run_id:f.workflow_run.run_id,failed_execution_job_id:f.execution_job.job_id,failed_operational_run_instance_id:f.execution_identity.operational_run_instance_id,failed_database_name:f.execution_identity.database_name,failed_database_dropped:true,corrected_harness_blob_sha:c.correction.corrected_harness_blob_sha,qualification_port_bundle_blob_sha:c.correction.qualification_port_bundle_blob_sha,qualification_materializer_blob_sha:c.correction.qualification_materializer_blob_sha,mock_qualification_replay_status:mock.status,mock_canonical_receipt_count:mock.canonical_receipt_count,mock_recovery_vector_count:mock.recovery_vector_count,mock_cap07_surface_count:mock.cap07_surface_count,database_execution_performed:false,workflow_dispatch_performed:false,run_a_qualification_completed:false,run_b_executed:false,hard_acceptance_eligible:false,s6_candidate_implemented:false,mcft_cap_08_complete:false,mcft_cap_09_authorized:false};out(z);console.log(JSON.stringify(z,null,2));
}catch(e){out({schema_version:'geox_mcft_cap08_s6_run_a_qualification_harness_port_correction_result_v1',status:'FAIL',error:e instanceof Error?e.message:String(e)});console.error(e);process.exitCode=1;}})();
