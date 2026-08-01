#!/usr/bin/env node
'use strict';
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ROOT=path.resolve(__dirname,'../..');
const BOUNDARY='docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S4-T17-PRODUCT-TRANSITION-IMPLEMENTATION-BOUNDARY-V1.json';
function git(...args){return cp.execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();}
function write(relative,value){const target=path.join(ROOT,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,`${JSON.stringify(value,null,2)}\n`);}
function exactSuccessor(config){
  const target=path.join(ROOT,BOUNDARY);
  if(!fs.existsSync(target))return false;
  const boundary=JSON.parse(fs.readFileSync(target,'utf8'));
  if(boundary.schema_version!=='geox_mcft_cap08_s4_t17_product_transition_implementation_boundary_v1'
    || boundary.record_status!=='NARROW_PRODUCT_IMPLEMENTATION_CANDIDATE'
    || boundary.base_main_sha!=='a753af5cdda8144b4ac5e140af0f41473b451513'
    || boundary.formal_authority_chain_status!=='PAUSED'
    || boundary.database_execution_authority_issued!==false
    || boundary.formal_run_execution_authorized!==false
    || boundary.qualification_v3_created!==false
    || boundary.s6_candidate_established!==false
    || boundary.mcft_cap_08_complete!==false
    || boundary.mcft_cap_09_authorized!==false)return false;
  let mergeBase;
  try{mergeBase=git('merge-base',boundary.base_main_sha,'HEAD');}catch{return false;}
  if(mergeBase!==boundary.base_main_sha)return false;
  const changed=git('diff','--name-only',`${boundary.base_main_sha}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  if(JSON.stringify(changed)!==JSON.stringify([...boundary.changed_files].sort()))return false;
  if(changed.length!==boundary.changed_file_count)return false;
  const result={
    schema_version:config.schema_version,
    status:'PASS',
    classification:'SUCCESSOR_S4_T17_PRODUCT_TRANSITION_IMPLEMENTATION',
    successor_classification:'SUCCESSOR_S4_T17_PRODUCT_TRANSITION_IMPLEMENTATION',
    subject_sha:git('rev-parse','HEAD'),
    candidate_sha:git('rev-parse','HEAD'),
    candidate_tree_sha:git('rev-parse','HEAD^{tree}'),
    base_sha:boundary.base_main_sha,
    changed_file_count:changed.length,
    changed_files:changed,
    historical_candidate_reopened:false,
    original_candidate_reopened:false,
    original_port_bundle_implementation_reopened:false,
    product_transition_focused_validation_required:true,
    formal_authority_chain_status:'PAUSED',
    database_execution_authority_issued:false,
    formal_run_execution_authorized:false,
    run_a_executed:false,
    run_b_executed:false,
    s6_candidate_implemented:false,
    mcft_cap_08_complete:false,
    mcft_cap_09_authorized:false,
  };
  write(config.output,result);
  if(process.env.GITHUB_ENV)fs.appendFileSync(process.env.GITHUB_ENV,'MCFT_CAP08_S4_T17_PRODUCT_TRANSITION_SUCCESSOR=true\n');
  console.log(JSON.stringify(result,null,2));
  return true;
}
function runFrozenOriginal(blobSha,filename){
  const source=cp.execFileSync('git',['cat-file','blob',blobSha],{cwd:ROOT,encoding:'utf8'});
  const child=new Module(filename,module.parent);
  child.filename=filename;
  child.paths=module.paths;
  child._compile(source,filename);
}
module.exports={exactSuccessor,runFrozenOriginal};
