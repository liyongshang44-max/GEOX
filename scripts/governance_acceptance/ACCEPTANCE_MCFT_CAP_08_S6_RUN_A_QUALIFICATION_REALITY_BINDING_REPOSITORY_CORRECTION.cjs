#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict');
const P=require('node:child_process');
const F=require('node:fs');
const X=require('node:path');
const R=X.resolve(__dirname,'../..');
const D='docs/digital_twin/mcft/cap_08';
const OUT=X.join(R,'acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_REALITY_BINDING_REPOSITORY_CORRECTION_RESULT.json');
const COMPOSITE_BOUNDARY=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-COMPOSITE-RANGE-CORRECTION-BOUNDARY-V1.json`;
const COMPOSITE_VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_RUN_A_QUALIFICATION_COMPOSITE_RANGE_CORRECTION.cjs';
const COMPOSITE_RESULT='acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_COMPOSITE_RANGE_CORRECTION_RESULT.json';
const REALITY_BOUNDARY=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-REALITY-BINDING-REPOSITORY-CORRECTION-BOUNDARY-V1.json`;
const read=p=>JSON.parse(F.readFileSync(X.join(R,p),'utf8'));
const text=p=>F.readFileSync(X.join(R,p),'utf8');
const git=(...args)=>P.execFileSync('git',args,{cwd:R,encoding:'utf8'}).trim();
function write(value){F.mkdirSync(X.dirname(OUT),{recursive:true});F.writeFileSync(OUT,JSON.stringify(value,null,2)+'\n');}
function exactBoundary(boundary){
  const base=boundary.base_main_sha;
  let mergeBase;
  try{mergeBase=git('merge-base',base,'HEAD');}catch{return null;}
  if(mergeBase!==base)return null;
  const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  if(JSON.stringify(changed)!==JSON.stringify([...boundary.changed_files].sort()))return null;
  return{base,changed};
}
function compositeSuccessor(){
  if(!F.existsSync(X.join(R,COMPOSITE_BOUNDARY)))return false;
  const boundary=read(COMPOSITE_BOUNDARY);
  const exact=exactBoundary(boundary);
  if(!exact)return false;
  P.execFileSync(process.execPath,[COMPOSITE_VALIDATOR],{
    cwd:R,
    stdio:'pipe',
    env:{...process.env,MCFT_BASE_SHA:exact.base},
  });
  const focused=read(COMPOSITE_RESULT);
  A.equal(focused.status,'PASS');
  A.equal(focused.base_sha,exact.base);
  A.equal(focused.changed_file_count,9);
  const result={
    schema_version:'geox_mcft_cap08_s6_run_a_qualification_reality_binding_repository_correction_result_v1',
    status:'PASS',
    subject_sha:git('rev-parse','HEAD'),
    base_sha:exact.base,
    changed_file_count:exact.changed.length,
    successor_classification:'SUCCESSOR_RUN_A_QUALIFICATION_COMPOSITE_RANGE_CORRECTION',
    original_reality_binding_repository_correction_reopened:false,
    corrected_product_chain_blob_sha:focused.corrected_product_chain_blob_sha,
    corrected_product_loader_blob_sha:focused.corrected_product_loader_blob_sha,
    database_execution_performed:false,
    workflow_dispatch_performed:false,
    new_execution_authority_issued:false,
    run_a_qualification_completed:false,
  };
  write(result);
  console.log(JSON.stringify(result,null,2));
  return true;
}
function exactOriginalCorrection(){
  if(!F.existsSync(X.join(R,REALITY_BOUNDARY)))return false;
  const boundary=read(REALITY_BOUNDARY);
  const exact=exactBoundary(boundary);
  if(!exact)return false;
  const chain='scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_chain_v1.cjs';
  const source=text(chain);
  A.ok(source.includes('nextTickRepository.commitRealityBindingSnapshot(fixture.reality_binding_snapshot)'));
  A.equal(source.includes('runtimeRepository.commitRealityBindingSnapshot(fixture.reality_binding_snapshot)'),false);
  A.ok(source.includes('runtimeRepository.commitRuntimeConfig(config)'));
  const result={
    schema_version:'geox_mcft_cap08_s6_run_a_qualification_reality_binding_repository_correction_result_v1',
    status:'PASS',
    subject_sha:git('rev-parse','HEAD'),
    base_sha:exact.base,
    changed_file_count:exact.changed.length,
    successor_classification:'EXACT_REALITY_BINDING_REPOSITORY_CORRECTION',
    repository_binding_positive_vector_count:1,
    repository_binding_negative_vector_count:2,
    database_execution_performed:false,
    workflow_dispatch_performed:false,
    new_execution_authority_issued:false,
    run_a_qualification_completed:false,
  };
  write(result);
  console.log(JSON.stringify(result,null,2));
  return true;
}
try{
  if(compositeSuccessor())process.exit(0);
  if(exactOriginalCorrection())process.exit(0);
  throw new Error('RUN_A_QUALIFICATION_REALITY_BINDING_CORRECTION_UNCLASSIFIED_HEAD');
}catch(error){
  write({schema_version:'geox_mcft_cap08_s6_run_a_qualification_reality_binding_repository_correction_result_v1',status:'FAIL',error:error instanceof Error?error.stack||error.message:String(error)});
  console.error(error);
  process.exitCode=1;
}
