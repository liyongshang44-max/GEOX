#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),C=require('node:crypto'),P=require('node:child_process'),F=require('node:fs'),X=require('node:path');
const R=X.resolve(__dirname,'../..');
const D='docs/digital_twin/mcft/cap_08';
const I=`${D}/GEOX-MCFT-CAP-08-S6-EXACT-DATABASE-PORT-BUNDLE-IMPLEMENTATION-V1.json`;
const B=`${D}/GEOX-MCFT-CAP-08-S6-EXACT-DATABASE-PORT-BUNDLE-IMPLEMENTATION-BOUNDARY-V1.json`;
const W='.github/workflows/mcft-cap-08-s6-exact-database-port-bundle-implementation.yml';
const PORT='scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports';
const Q=X.join(R,'acceptance-output/MCFT_CAP_08_S6_EXACT_DATABASE_PORT_BUNDLE_IMPLEMENTATION_RESULT.json');
const r=p=>JSON.parse(F.readFileSync(X.join(R,p),'utf8'));
const t=p=>F.readFileSync(X.join(R,p),'utf8');
const g=(...a)=>P.execFileSync('git',a,{cwd:R,encoding:'utf8'}).trim();
function c(v){
  if(Array.isArray(v))return`[${v.map(c).join(',')}]`;
  if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${c(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
function d(v){
  v=structuredClone(v);
  delete v.semantic_digest;
  return`sha256:${C.createHash('sha256').update(c(v)).digest('hex')}`;
}
function w(v){
  F.mkdirSync(X.dirname(Q),{recursive:true});
  F.writeFileSync(Q,JSON.stringify(v,null,2)+'\n');
}
function exactSuccessorBoundaryV1(boundary){
  const base=boundary.base_main_sha;
  let mergeBase;
  try{mergeBase=g('merge-base',base,'HEAD');}catch{return null;}
  if(mergeBase!==base)return null;
  const changed=g('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  if(JSON.stringify(changed)!==JSON.stringify([...boundary.changed_files].sort()))return null;
  return{base,changed};
}
function successorS4PersistenceInterleaveCorrectionV1(){
  const SB=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-S4-PERSISTENCE-INTERLEAVE-CORRECTION-BOUNDARY-V1.json`;
  if(!F.existsSync(X.join(R,SB)))return false;
  const exact=exactSuccessorBoundaryV1(r(SB));
  if(!exact)return false;
  const validator='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_RUN_A_QUALIFICATION_S4_PERSISTENCE_INTERLEAVE_CORRECTION.cjs';
  P.execFileSync(process.execPath,[validator],{
    cwd:R,
    stdio:'pipe',
    env:{...process.env,MCFT_BASE_SHA:exact.base},
  });
  const result=r('acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_S4_PERSISTENCE_INTERLEAVE_CORRECTION_RESULT.json');
  A.equal(result.status,'PASS');
  A.equal(result.base_sha,exact.base);
  A.equal(result.changed_file_count,10);
  const q={
    schema_version:'geox_mcft_cap08_s6_exact_database_port_bundle_implementation_result_v1',
    status:'PASS',
    subject_sha:g('rev-parse','HEAD'),
    base_sha:exact.base,
    changed_file_count:exact.changed.length,
    successor_classification:'SUCCESSOR_S4_PERSISTENCE_INTERLEAVE_CORRECTION',
    original_port_bundle_implementation_reopened:false,
    corrected_product_loader_blob_sha:result.corrected_product_loader_blob_sha,
    s6_s4_atomic_persistence_adapter_blob_sha:result.s6_s4_atomic_persistence_adapter_blob_sha,
    t00_t16_binding_count:17,
    completion_tuple_fabrication_count:0,
    atomic_write_member_count:7,
    database_execution_performed:false,
    workflow_dispatch_present:false,
    single_run_database_execution_authorized:false,
    run_a_executed:false,
    run_b_executed:false,
    s6_candidate_implemented:false,
    mcft_cap_08_complete:false,
    mcft_cap_09_authorized:false,
  };
  w(q);
  console.log(JSON.stringify(q,null,2));
  return true;
}
function successorCompositeRangeCorrectionV1(){
  const SB=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-COMPOSITE-RANGE-CORRECTION-BOUNDARY-V1.json`;
  if(!F.existsSync(X.join(R,SB)))return false;
  const boundary=r(SB);
  const exact=exactSuccessorBoundaryV1(boundary);
  if(!exact)return false;
  const validator='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_RUN_A_QUALIFICATION_COMPOSITE_RANGE_CORRECTION.cjs';
  P.execFileSync(process.execPath,[validator],{
    cwd:R,
    stdio:'pipe',
    env:{...process.env,MCFT_BASE_SHA:exact.base},
  });
  const result=r('acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_COMPOSITE_RANGE_CORRECTION_RESULT.json');
  A.equal(result.status,'PASS');
  A.equal(result.base_sha,exact.base);
  A.equal(result.changed_file_count,9);
  const q={
    schema_version:'geox_mcft_cap08_s6_exact_database_port_bundle_implementation_result_v1',
    status:'PASS',
    subject_sha:g('rev-parse','HEAD'),
    base_sha:exact.base,
    changed_file_count:exact.changed.length,
    successor_classification:'SUCCESSOR_RUN_A_QUALIFICATION_COMPOSITE_RANGE_CORRECTION',
    original_port_bundle_implementation_reopened:false,
    corrected_product_chain_blob_sha:result.corrected_product_chain_blob_sha,
    corrected_product_loader_blob_sha:result.corrected_product_loader_blob_sha,
    s3_slice_orchestrator_reuse_count:0,
    t00_t16_binding_count:17,
    database_execution_performed:false,
    workflow_dispatch_present:false,
    single_run_database_execution_authorized:false,
    run_a_executed:false,
    run_b_executed:false,
    s6_candidate_implemented:false,
    mcft_cap_08_complete:false,
    mcft_cap_09_authorized:false,
  };
  w(q);
  console.log(JSON.stringify(q,null,2));
  return true;
}
function successorRealityBindingRepositoryCorrectionV1(){
  const SB=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-REALITY-BINDING-REPOSITORY-CORRECTION-BOUNDARY-V1.json`;
  if(!F.existsSync(X.join(R,SB)))return false;
  const sp=r(SB);
  const exact=exactSuccessorBoundaryV1(sp);
  if(!exact)return false;
  const SF=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-V5-REALITY-BINDING-REPOSITORY-FAILURE-V1.json`;
  const SC=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-REALITY-BINDING-REPOSITORY-CORRECTION-V1.json`;
  const sf=r(SF),sc=r(SC);
  A.equal(exact.base,'aa9c6faa8255dba6393324bff8255f6dfe0ac273');
  A.equal(g('diff','--check',`${exact.base}...HEAD`),'');
  A.equal(exact.changed.length,7);
  for(const v of[sf,sc,sp])A.equal(v.semantic_digest,d(v),'SUCCESSOR_SEMANTIC_DIGEST');
  const chain=`${PORT}/product_chain_v1.cjs`;
  A.equal(g('rev-parse',`${exact.base}:${chain}`),'82bd433b70d21d62762ba7721458fa2a53bd6f01');
  A.equal(g('rev-parse',`HEAD:${chain}`),sc.correction.corrected_product_chain_blob_sha);
  const source=t(chain);
  A.ok(source.includes('nextTickRepository.commitRealityBindingSnapshot(fixture.reality_binding_snapshot)'));
  A.equal(source.includes('runtimeRepository.commitRealityBindingSnapshot(fixture.reality_binding_snapshot)'),false);
  A.ok(source.includes('runtimeRepository.commitRuntimeConfig(config)'));
  A.equal(sf.workflow_run_id,30628008647);
  A.equal(sf.bootstrap_aware_freshness_status,'PASS');
  A.equal(sf.database_drop_status,'PASS');
  A.equal(sf.operational_instance_reusable,false);
  A.equal(sp.database_execution_performed,false);
  A.equal(sp.workflow_dispatch_performed,false);
  P.execFileSync(process.execPath,['--check',chain],{cwd:R,stdio:'pipe'});
  const q={
    schema_version:'geox_mcft_cap08_s6_exact_database_port_bundle_implementation_result_v1',
    status:'PASS',
    subject_sha:g('rev-parse','HEAD'),
    base_sha:exact.base,
    changed_file_count:7,
    successor_classification:'SUCCESSOR_REALITY_BINDING_REPOSITORY_CORRECTION',
    original_port_bundle_implementation_reopened:false,
    corrected_product_chain_blob_sha:sc.correction.corrected_product_chain_blob_sha,
    database_execution_performed:false,
    workflow_dispatch_present:false,
    single_run_database_execution_authorized:false,
    run_a_executed:false,
    run_b_executed:false,
    s6_candidate_implemented:false,
    mcft_cap_08_complete:false,
    mcft_cap_09_authorized:false,
  };
  w(q);
  console.log(JSON.stringify(q,null,2));
  return true;
}
if(successorS4PersistenceInterleaveCorrectionV1())process.exit(0);
if(successorCompositeRangeCorrectionV1())process.exit(0);
if(successorRealityBindingRepositoryCorrectionV1())process.exit(0);
try{
  const i=r(I),b=r(B),z=String(process.env.MCFT_BASE_SHA||b.base_main_sha).trim();
  A.equal(z,b.base_main_sha);
  A.equal(g('merge-base',z,'HEAD'),z);
  A.equal(g('diff','--check',`${z}...HEAD`),'');
  const changed=g('diff','--name-only',`${z}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  A.deepEqual(changed,[...b.changed_files].sort());
  A.equal(changed.length,19);
  A.equal(changed.some(f=>/^(apps|packages|db|migrations)\//.test(f)),false);
  A.equal(changed.some(f=>/^apps\/web|\/routes\//.test(f)),false);
  for(const v of[i,b])A.equal(v.semantic_digest,d(v),'SEMANTIC_DIGEST');
  A.equal(i.record_status,'IMPLEMENTED_NOT_EFFECTIVE');
  A.equal(i.authority_consumed.blob_sha,'e87e7682ae6ac3ec0119a6b851431b7913a9e557');
  const modules=b.changed_files.filter(f=>f.startsWith(`${PORT}/`));
  A.equal(modules.length,15);
  for(const file of modules)P.execFileSync(process.execPath,['--check',file],{cwd:R,stdio:'pipe'});
  const entry=t(`${PORT}/index_v1.cjs`);
  const materializer=[
    t(`${PORT}/direct_materializer_v1.cjs`),
    t(`${PORT}/product_chain_v1.cjs`),
    t(`${PORT}/product_loader_v1.cjs`),
    t(`${PORT}/persistence_authority_v1.cjs`),
    t(`${PORT}/corrected_handoff_v1.cjs`),
    t(`${PORT}/materialization_output_v1.cjs`),
  ].join('\n');
  const evidence=t(`${PORT}/final_evidence_source_v1.cjs`);
  const closure=t(`${PORT}/closure_reader_v1.cjs`);
  const recovery=t(`${PORT}/recovery_v1.cjs`);
  const cap07=t(`${PORT}/cap07_reader_v1.cjs`);
  const artifact=t(`${PORT}/artifact_writer_v1.cjs`);
  const workflow=t(W);
  A.match(entry,/module\.exports=\{createPortsV1\}/);
  for(const token of['freshDatabase','materializer','closureReader','recovery','cap07Reader','artifactWriter'])A.ok(entry.includes(token),`PORT:${token}`);
  for(const token of['A0BootstrapRuntimeServiceV1','Cap08S3FormalRuntimeServiceV1','Cap08S4AppendForwardServiceV1','Cap08S5ResidualCalibrationShadowServiceV1','PostgresCap08S5ExactSourceV1'])A.ok(materializer.includes(token),`PRODUCT_SERVICE:${token}`);
  const forbidden=['mcft_cap08_s5_v2_formal_acceptance_support_v1','mcft_cap08_s5_replay_dataset_v2_prequalification_support_v1','establishCap08S5'];
  for(const token of forbidden)A.equal(materializer.includes(token),false,`S5_HELPER:${token}`);
  A.ok(materializer.includes("assert.equal(spec.lineage_id,null,"));
  A.ok(materializer.includes("assert.equal(spec.revision_id,null,"));
  A.ok(materializer.includes('BOUND_TO_PRODUCT_A0_IDENTITY'));
  A.ok(materializer.includes('assert.equal(receipts.length,153)'));
  A.ok(materializer.includes('final_formal_run_id:spec.formal_run_id'));
  A.ok(materializer.includes('S4_MUST_EXECUTE_BETWEEN_T16_AND_T17'));
  A.ok(materializer.includes('T17_MUST_CONSUME_CORRECTED_T16_POSTERIOR'));
  A.ok(materializer.includes('correctedT17Handoff'));
  A.ok(materializer.includes("materializer_profile:'MCFT_CAP08_S6_DIRECT_PRODUCT_SERVICE_ASSEMBLY_V1'"));
  A.ok(evidence.includes('source_record_id'));
  A.ok(evidence.includes('mcft_cap08_s6_final_formal_evidence_v1'));
  A.equal(evidence.includes('object_id:record.source_record_id'),false,'PERSISTED_ALIAS_WRAPPER_FORBIDDEN');
  A.ok(closure.includes('payload.source_record_id'));
  A.ok(closure.includes('payload.scope'));
  A.ok(closure.includes('object_id:payload.source_record_id'));
  A.equal(closure.includes('INSERT INTO'),false,'CLOSURE_READER_WRITE_FORBIDDEN');
  for(const vector of['FRESH_PROCESS_RESTART','T11_PRECOMMIT_ROLLBACK','T12_POSTCOMMIT_RESPONSE_LOSS','CONCURRENCY_FENCING','EXTREME_POINTER_LOSS_REBUILD','PROJECTION_LOSS_REBUILD','RESPONSE_AND_POINTER_LOSS'])A.ok(recovery.includes(vector),`RECOVERY:${vector}`);
  A.ok(recovery.includes('silent_repair_used:false'));
  A.ok(cap07.includes('PostgresMcftFieldTwinReadApiV1'));
  for(const surface of['runtime','timeline','trace','states','forecasts','scenarios','residuals','action-lifecycle','model-governance','health'])A.ok(cap07.includes(surface),`CAP07:${surface}`);
  A.ok(artifact.includes('transport_digest'));
  A.equal(workflow.includes('workflow_dispatch'),false);
  A.equal(workflow.includes('DATABASE_URL'),false);
  A.equal(workflow.includes('postgres:'),false);
  A.equal(i.static_validation.database_execution_performed,false);
  for(const value of Object.values(i.execution_constraints))A.equal(value,false);
  const q={
    schema_version:'geox_mcft_cap08_s6_exact_database_port_bundle_implementation_result_v1',
    status:'PASS',
    subject_sha:g('rev-parse','HEAD'),
    base_sha:z,
    changed_file_count:19,
    port_module_count:15,
    required_port_count:6,
    direct_product_service_count:5,
    canonical_receipt_count:153,
    recovery_vector_count:7,
    cap07_surface_count:10,
    s5_slice_helper_import_count:0,
    alias_wrapper_persistence_count:0,
    product_runtime_source_file_count:0,
    database_migration_file_count:0,
    route_or_web_file_count:0,
    database_execution_workflow_file_count:0,
    database_execution_performed:false,
    workflow_dispatch_present:false,
    single_run_database_execution_authorized:false,
    run_a_executed:false,
    run_b_executed:false,
    cross_run_comparator_implemented:false,
    finalizer_present:false,
    s6_candidate_implemented:false,
    mcft_cap_08_complete:false,
    mcft_cap_09_authorized:false,
  };
  w(q);
  console.log(JSON.stringify(q,null,2));
}catch(e){
  w({
    schema_version:'geox_mcft_cap08_s6_exact_database_port_bundle_implementation_result_v1',
    status:'FAIL',
    error:e instanceof Error?e.message:String(e),
  });
  console.error(e);
  process.exitCode=1;
}
