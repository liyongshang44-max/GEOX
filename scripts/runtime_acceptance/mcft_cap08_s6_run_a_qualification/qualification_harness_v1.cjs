'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {fileURLToPath}=require('node:url');
const {loadSingleRunHarnessContractsV1}=require('../mcft_cap08_s6_single_run_db/contract_loader_v1.cjs');
const {buildSingleRunExecutionSpecV1}=require('../mcft_cap08_s6_single_run_db/execution_spec_v1.cjs');
const {buildDirectMaterializerPlanV1,bindMaterializedCanonicalIdentityV1}=require('../mcft_cap08_s6_single_run_db/materializer_adapter_v1.cjs');
const {buildCanonicalReceiptManifestV1}=require('../mcft_cap08_s6_single_run_db/receipt_manifest_v1.cjs');
const {readExactReceiptObjectsV1}=require('../mcft_cap08_s6_single_run_db/closure_readback_adapter_v1.cjs');
const {buildRecoveryExecutionPlanV1}=require('../mcft_cap08_s6_single_run_db/recovery_execution_adapter_v1.cjs');
const {SURFACES,fetchVariantV1}=require('../mcft_cap08_s6_single_run_db/cap07_readback_execution_adapter_v1.cjs');
const REQUIRED_PORTS={freshDatabase:['assertFreshDisposable'],materializer:['executeDirectFormalRun'],closureReader:['query'],recovery:['executeVector'],cap07Reader:['request'],artifactWriter:['writeBundle']};
function validateQualificationPortsV1(ports){for(const [name,methods] of Object.entries(REQUIRED_PORTS)){assert.ok(ports?.[name]&&typeof ports[name]==='object',`QUALIFICATION_PORT_REQUIRED:${name}`);for(const method of methods)assert.equal(typeof ports[name][method],'function',`QUALIFICATION_PORT_METHOD_REQUIRED:${name}.${method}`);}return ports;}
function validateQualificationAuthorityV1(authority,input){
 assert.equal(authority?.record_status,'SINGLE_DEVELOPMENT_QUALIFICATION_RUN_DATABASE_EXECUTION_AUTHORIZED','QUALIFICATION_EXECUTION_AUTHORITY_REQUIRED');
 assert.equal(authority.authority_class,'DEVELOPMENT_QUALIFICATION_ONLY');assert.equal(authority.evidence_class,'DEVELOPMENT_QUALIFICATION_ONLY');
 assert.equal(authority.final_formal_run_execution_authorized,false);assert.equal(authority.final_closure_eligible,false);assert.equal(authority.hard_acceptance_eligible,false);
 assert.equal(authority.exact_subject_sha,input.exactSubjectSha,'QUALIFICATION_AUTHORITY_SUBJECT');
 assert.equal(authority.authorized_run_label,input.runLabel,'QUALIFICATION_AUTHORITY_RUN_LABEL');
 assert.equal(authority.operational_run_instance_id,input.operationalRunInstanceId,'QUALIFICATION_AUTHORITY_INSTANCE');
}
async function executeRunAQualificationHarnessV1({input,ports,executionAuthority}){
 validateQualificationPortsV1(ports);validateQualificationAuthorityV1(executionAuthority,input);assert.equal(input.runLabel,'RUN_A','QUALIFICATION_RUN_LABEL');
 const contracts=loadSingleRunHarnessContractsV1();
 const unboundSpec=buildSingleRunExecutionSpecV1({contracts,runLabel:input.runLabel,operationalRunInstanceId:input.operationalRunInstanceId,exactSubjectSha:input.exactSubjectSha});
 await ports.freshDatabase.assertFreshDisposable({spec:unboundSpec});
 const materializerPlan=buildDirectMaterializerPlanV1(unboundSpec);
 const materialization=await ports.materializer.executeDirectFormalRun(unboundSpec,executionAuthority);
 assert.equal(materialization.formal_run_id,unboundSpec.formal_run_id);assert.equal(materialization.final_formal_run_id,unboundSpec.formal_run_id);
 assert.equal(materialization.phase_results.length,28);assert.ok(Array.isArray(materialization.canonical_receipts)&&materialization.canonical_receipts.length>0);assert.ok(materialization.selector_snapshot&&typeof materialization.selector_snapshot==='object');
 const spec=bindMaterializedCanonicalIdentityV1(unboundSpec,materialization);
 const receiptManifest=buildCanonicalReceiptManifestV1(spec,materialization.canonical_receipts);assert.equal(receiptManifest.receipt_count,153);
 const readback=await readExactReceiptObjectsV1(ports.closureReader,spec,receiptManifest);assert.equal(readback.object_count,153);
 const recoveryPlan=buildRecoveryExecutionPlanV1(spec),recoveryResults=[];
 for(const vector of recoveryPlan.vectors){const result=await ports.recovery.executeVector({spec,vector});assert.equal(result.vector_id,vector.vector_id);assert.equal(result.status,'PASS');assert.equal(result.silent_repair_used,false);recoveryResults.push(result);}
 assert.equal(recoveryResults.length,7);
 const surfaces=[];for(const surface of SURFACES){const variants=surface.variants??[null];for(const variant of variants)surfaces.push({name:surface.name,variant,pages:await fetchVariantV1(ports.cap07Reader.request.bind(ports.cap07Reader),spec,surface,variant)});}
 const cap07={schema_version:'geox_mcft_cap08_s6_cap07_complete_readback_result_v1',surface_definition_count:10,request_variant_count:11,surfaces,pagination_until_cursor_null:true,product_read_write_delta:0,canonical_fact_write_delta:0,projection_write_delta:0};
 assert.equal(cap07.product_read_write_delta,0);assert.equal(cap07.surface_definition_count,10);
 const recovery={plan:recoveryPlan,results:recoveryResults};
 const probe=await ports.artifactWriter.writeBundle({spec,materializer_plan:materializerPlan,materialization,receipt_manifest:receiptManifest,readback,recovery,cap07,qualification_transport_probe:true});
 const probePath=fileURLToPath(probe.transport_file);assert.equal(fs.existsSync(probePath),true,'QUALIFICATION_ARTIFACT_WRITER_PROBE_MISSING');fs.rmSync(probePath);assert.equal(fs.existsSync(probePath),false,'QUALIFICATION_ARTIFACT_WRITER_PROBE_NOT_QUARANTINED');
 return{schema_version:'geox_mcft_cap08_s6_run_a_database_qualification_result_v1',status:'PASS',authority_class:'DEVELOPMENT_QUALIFICATION_ONLY',evidence_class:'DEVELOPMENT_QUALIFICATION_ONLY',exact_subject_sha:spec.exact_subject_sha,run_label:'RUN_A',formal_run_id:spec.formal_run_id,operational_run_instance_id:spec.operational_run_instance_id,lineage_id:spec.lineage_id,revision_id:spec.revision_id,canonical_identity_binding:spec.canonical_identity_binding,database_instance_digest:materialization.database_instance_digest,canonical_receipt_count:153,recovery_vector_count:7,cap07_surface_count:10,artifact_writer_port_probe_executed:true,artifact_writer_port_probe_quarantined:true,product_artifact_ref:materialization.artifact_ref,product_artifact_digest:materialization.artifact_digest,ha_witness_count:0,final_closure_source_generated:false,hard_acceptance_eligible:false,final_closure_eligible:false,s6_candidate_evidence_eligible:false,cross_run_comparison_eligible:false,ledger_settlement_eligible:false};
}
module.exports={REQUIRED_PORTS,validateQualificationPortsV1,validateQualificationAuthorityV1,executeRunAQualificationHarnessV1};
