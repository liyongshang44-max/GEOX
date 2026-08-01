#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

const ROOT=path.resolve(__dirname,'../../..');
const {loadSingleRunHarnessContractsV1}=require('../mcft_cap08_s6_single_run_db/contract_loader_v1.cjs');
const {buildSingleRunExecutionSpecV1}=require('../mcft_cap08_s6_single_run_db/execution_spec_v1.cjs');
const {invokeDirectMaterializerV1}=require('../mcft_cap08_s6_run_a_qualification/qualification_materializer_adapter_v1.cjs');
const {buildCanonicalReceiptManifestV1}=require('../mcft_cap08_s6_single_run_db/receipt_manifest_v1.cjs');
const {readExactReceiptObjectsV1}=require('../mcft_cap08_s6_single_run_db/closure_readback_adapter_v1.cjs');
const {executeRecoveryVectorsV1}=require('../mcft_cap08_s6_run_a_qualification/qualification_recovery_execution_adapter_v1.cjs');
const {executeCompleteCap07ReadbackV1}=require('../mcft_cap08_s6_run_a_qualification/qualification_cap07_readback_execution_adapter_v1.cjs');
const {validatePortBundleV1}=require('../mcft_cap08_s6_run_a_qualification/qualification_port_contract_v1.cjs');
const {createPortsV2}=require('../mcft_cap08_s6_run_a_qualification_ports_v2/index_v2.cjs');

function requiredEnv(name){
  const value=String(process.env[name]??'').trim();
  if(!value)throw new Error(`DEVELOPMENT_QUALIFICATION_ENV_REQUIRED:${name}`);
  return value;
}
function developmentExecutionContext({exactSubjectSha,operationalRunInstanceId}){
  return{
    schema_version:'geox_mcft_cap08_s6_repeatable_development_qualification_context_v1',
    record_status:'SINGLE_DEVELOPMENT_QUALIFICATION_RUN_DATABASE_EXECUTION_AUTHORIZED',
    authority_class:'DEVELOPMENT_QUALIFICATION_ONLY',
    evidence_class:'DEVELOPMENT_QUALIFICATION_ONLY',
    exact_subject_sha:exactSubjectSha,
    authorized_run_label:'RUN_A',
    operational_run_instance_id:operationalRunInstanceId,
    final_formal_run_execution_authorized:false,
    final_closure_eligible:false,
    hard_acceptance_eligible:false,
    s6_candidate_evidence_eligible:false,
    cross_run_comparison_eligible:false,
    ledger_settlement_eligible:false,
    governance_execution_authority_issued:false,
    repeatable_development_runner_only:true,
  };
}

async function main(){
  const exactSubjectSha=requiredEnv('MCFT_CAP08_DEV_EXACT_SUBJECT_SHA');
  const operationalRunInstanceId=requiredEnv('MCFT_CAP08_DEV_OPERATIONAL_RUN_INSTANCE_ID');
  const contextPath=path.resolve(requiredEnv('MCFT_CAP08_DEV_CONTINUITY_CONTEXT_PATH'));
  const resultPath=path.resolve(requiredEnv('MCFT_CAP08_DEV_PRIMARY_RESULT_PATH'));
  const head=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
  assert.equal(head,exactSubjectSha,'DEVELOPMENT_QUALIFICATION_SUBJECT_CHECKOUT');

  const runLabel='RUN_A';
  const executionContext=developmentExecutionContext({exactSubjectSha,operationalRunInstanceId});
  const ports=validatePortBundleV1(await createPortsV2({
    root:ROOT,
    authority:executionContext,
    exactSubjectSha,
    runLabel,
    operationalRunInstanceId,
  }));
  const contracts=loadSingleRunHarnessContractsV1();
  const unboundSpec=buildSingleRunExecutionSpecV1({
    contracts,
    exactSubjectSha,
    runLabel,
    operationalRunInstanceId,
  });

  await ports.freshDatabase.assertFreshDisposable({spec:unboundSpec});
  const materialized=await invokeDirectMaterializerV1(ports.materializer,unboundSpec,executionContext);
  const spec=materialized.bound_spec;
  const receiptManifest=buildCanonicalReceiptManifestV1(spec,materialized.result.canonical_receipts);
  assert.equal(receiptManifest.receipt_count,153,'DEVELOPMENT_QUALIFICATION_RECEIPT_COUNT');
  const readback=await readExactReceiptObjectsV1(ports.closureReader,spec,receiptManifest);
  assert.equal(readback.object_count,153,'DEVELOPMENT_QUALIFICATION_READBACK_COUNT');
  const recovery=await executeRecoveryVectorsV1(ports.recovery,spec,executionContext);
  assert.equal(recovery.results.length,7,'DEVELOPMENT_QUALIFICATION_RECOVERY_COUNT');
  const cap07=await executeCompleteCap07ReadbackV1(ports.cap07Reader,spec,executionContext);
  assert.equal(cap07.surface_definition_count,10,'DEVELOPMENT_QUALIFICATION_CAP07_SURFACE_COUNT');
  assert.equal(cap07.product_read_write_delta,0,'DEVELOPMENT_QUALIFICATION_CAP07_WRITE_DELTA');

  const continuityContext={
    schema_version:'geox_mcft_cap08_s6_development_qualification_continuity_context_v1',
    exact_subject_sha:exactSubjectSha,
    operational_run_instance_id:operationalRunInstanceId,
    spec,
    receipt_manifest:receiptManifest,
    primary_database_instance_digest:materialized.result.database_instance_digest,
    primary_product_artifact_ref:materialized.result.artifact_ref,
    primary_product_artifact_digest:materialized.result.artifact_digest,
  };
  fs.mkdirSync(path.dirname(contextPath),{recursive:true});
  fs.writeFileSync(contextPath,`${JSON.stringify(continuityContext,null,2)}\n`);

  const result={
    schema_version:'geox_mcft_cap08_s6_repeatable_development_qualification_primary_result_v1',
    status:'PASS',
    evidence_class:'DEVELOPMENT_QUALIFICATION_ONLY',
    governance_execution_authority_issued:false,
    repeatable_development_runner_only:true,
    exact_subject_sha:exactSubjectSha,
    run_label:runLabel,
    formal_run_id:spec.formal_run_id,
    operational_run_instance_id:operationalRunInstanceId,
    lineage_id:spec.lineage_id,
    revision_id:spec.revision_id,
    database_instance_digest:materialized.result.database_instance_digest,
    database_name:String(process.env.MCFT_CAP08_DB_NAME||''),
    canonical_receipt_count:153,
    primary_readback_count:153,
    recovery_vector_count:7,
    cap07_surface_count:10,
    s4_t17_interleave_required:true,
    restart_read_continuity_pending:true,
    formal_evidence_eligible:false,
    s6_candidate_evidence_eligible:false,
  };
  fs.mkdirSync(path.dirname(resultPath),{recursive:true});
  fs.writeFileSync(resultPath,`${JSON.stringify(result,null,2)}\n`);
  console.log(JSON.stringify(result,null,2));
}

main().then(()=>process.exit(0)).catch(error=>{
  console.error(error);
  process.exit(1);
});
