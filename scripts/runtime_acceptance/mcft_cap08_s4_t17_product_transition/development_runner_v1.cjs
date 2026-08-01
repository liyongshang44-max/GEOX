#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {Pool}=require('pg');

const ROOT=path.resolve(__dirname,'../../..');
const {loadSingleRunHarnessContractsV1}=require('../mcft_cap08_s6_single_run_db/contract_loader_v1.cjs');
const {buildSingleRunExecutionSpecV1}=require('../mcft_cap08_s6_single_run_db/execution_spec_v1.cjs');
const {invokeDirectMaterializerV1}=require('../mcft_cap08_s6_run_a_qualification/qualification_materializer_adapter_v1.cjs');
const {buildCanonicalReceiptManifestV1}=require('../mcft_cap08_s6_single_run_db/receipt_manifest_v1.cjs');
const {readExactReceiptObjectsV1}=require('../mcft_cap08_s6_single_run_db/closure_readback_adapter_v1.cjs');
const {validatePortBundleV1}=require('../mcft_cap08_s6_run_a_qualification/qualification_port_contract_v1.cjs');
const {createPortsV2}=require('../mcft_cap08_s6_run_a_qualification_ports_v2/index_v2.cjs');

function env(name){const value=String(process.env[name]??'').trim();if(!value)throw new Error(`CAP08_T17_IMPL_ENV_REQUIRED:${name}`);return value;}
function executionContext(exactSubjectSha,operationalRunInstanceId){return{
  schema_version:'geox_mcft_cap08_s4_t17_product_transition_development_context_v1',
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
  product_implementation_validation_only:true,
};}
function exactReceipt(manifest,role,phase){const matches=manifest.receipts.filter(value=>value.member_role===role&&value.phase_id===phase);assert.equal(matches.length,1,`CAP08_T17_IMPL_RECEIPT_CARDINALITY:${role}:${phase}`);return matches[0];}
function payload(recordJson){const value=typeof recordJson==='string'?JSON.parse(recordJson):recordJson;assert.ok(value&&typeof value==='object'&&value.payload&&typeof value.payload==='object');return value.payload;}

async function main(){
  const exactSubjectSha=env('MCFT_CAP08_DEV_EXACT_SUBJECT_SHA');
  const operationalRunInstanceId=env('MCFT_CAP08_DEV_OPERATIONAL_RUN_INSTANCE_ID');
  assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),exactSubjectSha,'CAP08_T17_IMPL_SUBJECT_CHECKOUT');
  const context=executionContext(exactSubjectSha,operationalRunInstanceId);
  const ports=validatePortBundleV1(await createPortsV2({root:ROOT,authority:context,exactSubjectSha,runLabel:'RUN_A',operationalRunInstanceId}));
  const contracts=loadSingleRunHarnessContractsV1();
  const unboundSpec=buildSingleRunExecutionSpecV1({contracts,exactSubjectSha,runLabel:'RUN_A',operationalRunInstanceId});
  await ports.freshDatabase.assertFreshDisposable({spec:unboundSpec});
  const materialized=await invokeDirectMaterializerV1(ports.materializer,unboundSpec,context);
  const spec=materialized.bound_spec;
  const manifest=buildCanonicalReceiptManifestV1(spec,materialized.result.canonical_receipts);
  assert.equal(manifest.receipt_count,153,'CAP08_T17_IMPL_RECEIPT_COUNT');
  const readback=await readExactReceiptObjectsV1(ports.closureReader,spec,manifest);
  assert.equal(readback.object_count,153,'CAP08_T17_IMPL_READBACK_COUNT');

  const pool=new Pool({connectionString:env('MCFT_CAP08_ADMIN_DATABASE_URL'),max:2});
  try{
    const guards=await pool.query(`SELECT * FROM twin_cap08_s4_t17_transition_guard_v1
      WHERE formal_run_id=$1 AND tenant_id=$2 AND project_id=$3 AND group_id=$4 AND field_id=$5 AND season_id=$6 AND zone_id=$7`,
      [spec.formal_run_id,spec.scope.tenant_id,spec.scope.project_id,spec.scope.group_id,spec.scope.field_id,spec.scope.season_id,spec.scope.zone_id]);
    assert.equal(guards.rows.length,1,'CAP08_T17_IMPL_TRANSITION_GUARD_CARDINALITY');
    const guard=guards.rows[0];
    const witness=await pool.query('SELECT record_json FROM facts WHERE fact_id=$1',[guard.witness_fact_id]);
    assert.equal(witness.rows.length,1,'CAP08_T17_IMPL_WITNESS_FACT_CARDINALITY');
    const witnessPayload=payload(witness.rows[0].record_json);
    assert.equal(witnessPayload.transition_id,guard.transition_id,'CAP08_T17_IMPL_WITNESS_TRANSITION_ID');
    assert.equal(witnessPayload.determinism_hash,guard.witness_determinism_hash,'CAP08_T17_IMPL_WITNESS_HASH');
    assert.equal(witnessPayload.transition_semantics.latest_before,'BASE_T16');
    assert.equal(witnessPayload.transition_semantics.computation_from,'CORRECTED_T16');
    assert.equal(witnessPayload.transition_semantics.persistence_cas_from,'BASE_T16');
    assert.equal(witnessPayload.transition_semantics.latest_after,'T17');
    assert.equal(witnessPayload.transition_semantics.outcome,'A1_COMPLETED');

    const t23State=exactReceipt(manifest,'POSTERIOR_STATE','T23');
    const t23Forecast=exactReceipt(manifest,'FORECAST_RUN','T23');
    const latest=await pool.query(`SELECT
      (SELECT state_object_id FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS state_ref,
      (SELECT determinism_hash FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS state_hash,
      (SELECT checkpoint_object_id FROM twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS checkpoint_ref,
      (SELECT determinism_hash FROM twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS checkpoint_hash,
      (SELECT forecast_object_id FROM twin_forecast_result_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS forecast_ref,
      (SELECT determinism_hash FROM twin_forecast_result_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS forecast_hash,
      (SELECT forecast_object_id FROM twin_forecast_success_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS success_ref,
      (SELECT determinism_hash FROM twin_forecast_success_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS success_hash`,
      [spec.scope.tenant_id,spec.scope.project_id,spec.scope.group_id,spec.scope.field_id,spec.scope.season_id,spec.scope.zone_id]);
    const row=latest.rows[0];
    assert.equal(row.state_ref,t23State.object_ref,'CAP08_T17_IMPL_FINAL_STATE_REF');
    assert.equal(row.state_hash,t23State.object_hash,'CAP08_T17_IMPL_FINAL_STATE_HASH');
    assert.equal(row.forecast_ref,t23Forecast.object_ref,'CAP08_T17_IMPL_FINAL_FORECAST_REF');
    assert.equal(row.forecast_hash,t23Forecast.object_hash,'CAP08_T17_IMPL_FINAL_FORECAST_HASH');
    assert.equal(row.success_ref,t23Forecast.object_ref,'CAP08_T17_IMPL_FINAL_SUCCESS_REF');
    assert.equal(row.success_hash,t23Forecast.object_hash,'CAP08_T17_IMPL_FINAL_SUCCESS_HASH');
    const checkpointFact=await pool.query("SELECT record_json FROM facts WHERE record_json->'payload'->>'object_id'=$1",[row.checkpoint_ref]);
    assert.equal(checkpointFact.rows.length,1,'CAP08_T17_IMPL_FINAL_CHECKPOINT_CARDINALITY');
    const checkpoint=payload(checkpointFact.rows[0].record_json);
    assert.equal(checkpoint.determinism_hash,row.checkpoint_hash,'CAP08_T17_IMPL_FINAL_CHECKPOINT_HASH');
    assert.equal(checkpoint.logical_time,t23State.logical_time,'CAP08_T17_IMPL_FINAL_CHECKPOINT_TIME');
    assert.equal(checkpoint.payload.last_posterior_state_ref,t23State.object_ref,'CAP08_T17_IMPL_FINAL_CHECKPOINT_STATE');
    assert.equal(checkpoint.payload.forecast_result_ref,t23Forecast.object_ref,'CAP08_T17_IMPL_FINAL_CHECKPOINT_FORECAST');
    assert.equal(checkpoint.payload.successful_forecast_ref,t23Forecast.object_ref,'CAP08_T17_IMPL_FINAL_CHECKPOINT_SUCCESS');
    const finalLatest={state_ref:row.state_ref,state_hash:row.state_hash,checkpoint_ref:row.checkpoint_ref,checkpoint_hash:row.checkpoint_hash,forecast_ref:row.forecast_ref,forecast_hash:row.forecast_hash,success_ref:row.success_ref,success_hash:row.success_hash};

    const continuityPath=path.resolve(env('MCFT_CAP08_DEV_CONTINUITY_CONTEXT_PATH'));
    fs.mkdirSync(path.dirname(continuityPath),{recursive:true});
    fs.writeFileSync(continuityPath,`${JSON.stringify({exact_subject_sha:exactSubjectSha,operational_run_instance_id:operationalRunInstanceId,spec,receipt_manifest:manifest,transition_id:guard.transition_id,witness_fact_id:guard.witness_fact_id,witness_hash:guard.witness_determinism_hash,final_latest:finalLatest},null,2)}\n`);
    const result={schema_version:'geox_mcft_cap08_s4_t17_product_transition_primary_result_v1',status:'PASS',exact_subject_sha:exactSubjectSha,operational_run_instance_id:operationalRunInstanceId,formal_run_id:spec.formal_run_id,canonical_receipt_count:153,primary_readback_count:153,transition_guard_count:1,witness_fact_count:1,t17_transition_exact_readback:true,final_latest_projection_state:'EXACT_T23',formal_evidence_eligible:false,s6_candidate_evidence_eligible:false};
    const resultPath=path.resolve(env('MCFT_CAP08_DEV_PRIMARY_RESULT_PATH'));
    fs.writeFileSync(resultPath,`${JSON.stringify(result,null,2)}\n`);
    console.log(JSON.stringify(result,null,2));
  }finally{await pool.end();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
