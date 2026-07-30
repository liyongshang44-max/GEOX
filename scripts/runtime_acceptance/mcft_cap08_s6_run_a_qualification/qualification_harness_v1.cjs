'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {fileURLToPath}=require('node:url');
const {loadSingleRunHarnessContractsV1}=require('../mcft_cap08_s6_single_run_db/contract_loader_v1.cjs');
const {buildSingleRunExecutionSpecV1}=require('../mcft_cap08_s6_single_run_db/execution_spec_v1.cjs');
const {invokeDirectMaterializerV1}=require('./qualification_materializer_adapter_v1.cjs');
const {buildCanonicalReceiptManifestV1}=require('../mcft_cap08_s6_single_run_db/receipt_manifest_v1.cjs');
const {readExactReceiptObjectsV1}=require('../mcft_cap08_s6_single_run_db/closure_readback_adapter_v1.cjs');
const {executeRecoveryVectorsV1}=require('./qualification_recovery_execution_adapter_v1.cjs');
const {executeCompleteCap07ReadbackV1}=require('./qualification_cap07_readback_execution_adapter_v1.cjs');
const {validatePortBundleV1}=require('./qualification_port_contract_v1.cjs');
async function executeRunAQualificationHarnessV1({input,ports,executionAuthority}){
 validatePortBundleV1(ports);
 assert.equal(input.runLabel,'RUN_A','QUALIFICATION_RUN_LABEL');
 assert.equal(executionAuthority?.record_status,'SINGLE_DEVELOPMENT_QUALIFICATION_RUN_DATABASE_EXECUTION_AUTHORIZED','QUALIFICATION_EXECUTION_AUTHORITY_REQUIRED');
 assert.equal(executionAuthority.authority_class,'DEVELOPMENT_QUALIFICATION_ONLY');
 assert.equal(executionAuthority.final_closure_eligible,false);
 assert.equal(executionAuthority.hard_acceptance_eligible,false);
 const contracts=loadSingleRunHarnessContractsV1();
 const unboundSpec=buildSingleRunExecutionSpecV1({contracts,...input});
 assert.equal(executionAuthority.exact_subject_sha,unboundSpec.exact_subject_sha,'QUALIFICATION_AUTHORITY_SUBJECT');
 await ports.freshDatabase.assertFreshDisposable({spec:unboundSpec});
 const materialized=await invokeDirectMaterializerV1(ports.materializer,unboundSpec,executionAuthority);
 const spec=materialized.bound_spec;
 const receiptManifest=buildCanonicalReceiptManifestV1(spec,materialized.result.canonical_receipts);
 assert.equal(receiptManifest.receipt_count,153);
 const readback=await readExactReceiptObjectsV1(ports.closureReader,spec,receiptManifest);
 assert.equal(readback.object_count,153);
 const recovery=await executeRecoveryVectorsV1(ports.recovery,spec,executionAuthority);
 assert.equal(recovery.results.length,7);
 const cap07=await executeCompleteCap07ReadbackV1(ports.cap07Reader,spec,executionAuthority);
 assert.equal(cap07.product_read_write_delta,0);
 assert.equal(cap07.surface_definition_count,10);
 const probe=await ports.artifactWriter.writeBundle({spec,materializer_plan:materialized.plan,materialization:materialized.result,receipt_manifest:receiptManifest,readback,recovery,cap07,qualification_transport_probe:true});
 const probePath=fileURLToPath(probe.transport_file);
 assert.equal(fs.existsSync(probePath),true,'QUALIFICATION_ARTIFACT_WRITER_PROBE_MISSING');
 fs.rmSync(probePath);
 assert.equal(fs.existsSync(probePath),false,'QUALIFICATION_ARTIFACT_WRITER_PROBE_NOT_QUARANTINED');
 return{
  schema_version:'geox_mcft_cap08_s6_run_a_database_qualification_result_v1',
  status:'PASS',authority_class:'DEVELOPMENT_QUALIFICATION_ONLY',evidence_class:'DEVELOPMENT_QUALIFICATION_ONLY',
  exact_subject_sha:spec.exact_subject_sha,run_label:'RUN_A',formal_run_id:spec.formal_run_id,
  operational_run_instance_id:spec.operational_run_instance_id,lineage_id:spec.lineage_id,revision_id:spec.revision_id,
  canonical_identity_binding:spec.canonical_identity_binding,database_instance_digest:materialized.result.database_instance_digest,
  canonical_receipt_count:153,recovery_vector_count:7,cap07_surface_count:10,
  artifact_writer_port_probe_executed:true,artifact_writer_port_probe_quarantined:true,
  product_artifact_ref:materialized.result.artifact_ref,product_artifact_digest:materialized.result.artifact_digest,
  ha_witness_count:0,final_closure_source_generated:false,hard_acceptance_eligible:false,
  final_closure_eligible:false,s6_candidate_evidence_eligible:false,cross_run_comparison_eligible:false,ledger_settlement_eligible:false
 };
}
module.exports={executeRunAQualificationHarnessV1};
