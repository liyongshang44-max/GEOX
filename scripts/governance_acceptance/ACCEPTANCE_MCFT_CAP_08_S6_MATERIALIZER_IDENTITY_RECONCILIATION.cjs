#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),CAP='docs/digital_twin/mcft/cap_08';
const A=`${CAP}/GEOX-MCFT-CAP-08-S6-MATERIALIZER-IDENTITY-RECONCILIATION-AUTHORITY-V1.json`;
const I=`${CAP}/GEOX-MCFT-CAP-08-S6-MATERIALIZER-IDENTITY-RECONCILIATION-IMPLEMENTATION-V1.json`;
const B=`${CAP}/GEOX-MCFT-CAP-08-S6-MATERIALIZER-IDENTITY-RECONCILIATION-BOUNDARY-V1.json`;
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_08_S6_MATERIALIZER_IDENTITY_RECONCILIATION_RESULT.json');
function read(p){return JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));}
function git(...a){return cp.execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();}
function canonical(v){if(Array.isArray(v))return`[${v.map(canonical).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;return JSON.stringify(v);}
function sd(v){const x=structuredClone(v);delete x.semantic_digest;return`sha256:${crypto.createHash('sha256').update(canonical(x)).digest('hex')}`;}
function write(v){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+'\n');}
(async()=>{try{
 const local=process.env.MCFT_ACCEPTANCE_LOCAL_REPLAY==='1',a=read(A),i=read(I),b=read(B),base=String(process.env.MCFT_BASE_SHA||b.base_main_sha).trim();
 if(!local){assert.equal(base,b.base_main_sha,'BASE_SHA_DRIFT');assert.equal(git('merge-base',base,'HEAD'),base,'BASE_NOT_ANCESTOR');assert.equal(git('diff','--check',`${base}...HEAD`),'','DIFF_CHECK_FAILED');const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();assert.deepEqual(changed,[...b.changed_files].sort(),'CHANGED_FILE_BOUNDARY');}
 assert.equal(b.changed_file_count,12);assert.equal(b.product_runtime_source_file_count,0);assert.equal(b.database_migration_file_count,0);assert.equal(b.route_or_web_file_count,0);assert.equal(b.port_bundle_implementation_file_count,0);assert.equal(b.database_execution_workflow_file_count,0);assert.equal(b.cross_run_comparator_file_count,0);assert.equal(b.finalizer_file_count,0);
 for(const v of [a,i,b])assert.equal(v.semantic_digest,sd(v),'SEMANTIC_DIGEST');assert.equal(a.record_status,'MATERIALIZER_IDENTITY_RECONCILIATION_AUTHORIZED');assert.equal(i.record_status,'IMPLEMENTED_NOT_EFFECTIVE');assert.equal(a.execution_constraints.database_execution_authorized,false);assert.equal(a.execution_constraints.port_bundle_implementation_authority_preserved,true);
 process.env.MCFT_LOCAL_REPLAY='1';const {runSyntheticDataAcceptanceV1}=require('../runtime_acceptance/mcft_cap08_s6_single_run_db/synthetic_data_acceptance_v1.cjs');const subject=local?'1'.repeat(40):git('rev-parse','HEAD');const data=await runSyntheticDataAcceptanceV1(subject);
 assert.equal(data.unbound_lineage_id,null);assert.equal(data.unbound_revision_id,null);assert.match(data.bound_lineage_id,/^lineage_[a-z0-9]{24}$/);assert.match(data.bound_revision_id,/^revision_[a-z0-9]{24}$/);assert.equal(data.canonical_identity_binding,'BOUND_TO_PRODUCT_A0_IDENTITY');assert.equal(data.canonical_receipt_count,153);assert.equal(data.per_run_witness_count,22);assert.equal(data.proof_object_set_count,22);assert.equal(data.exact_ref_query_count,1);
 const runtimeFiles=b.changed_files.filter(f=>f.startsWith('scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/'));const text=runtimeFiles.map(f=>fs.readFileSync(path.join(ROOT,f),'utf8')).join('\n');assert.equal(/twin_lineage_[a-f0-9]{24}/.test(text),false,'PRECOMPUTED_TWIN_LINEAGE_FORBIDDEN');assert.equal(/twin_revision_[a-f0-9]{24}/.test(text),false,'PRECOMPUTED_TWIN_REVISION_FORBIDDEN');assert.equal(text.includes('BOUND_TO_PRODUCT_A0_IDENTITY'),true,'PRODUCT_IDENTITY_BINDING_REQUIRED');assert.equal(text.includes('MATERIALIZER_BOUND_PRODUCT_A0_IDENTITY'),true,'MATERIALIZER_BINDING_MODE_REQUIRED');
 const forbidden=['establishCap08S5','ACCEPTANCE_MCFT_CAP_08_S5','workflow_dispatch','SINGLE_FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORIZED\":true'];for(const token of forbidden)assert.equal(text.includes(token),false,`FORBIDDEN_TOKEN:${token}`);
 const result={schema_version:'geox_mcft_cap08_s6_materializer_identity_reconciliation_result_v1',status:'PASS',subject_sha:local?'LOCAL_REPLAY':subject,base_sha:local?'LOCAL_REPLAY':base,changed_file_count:b.changed_file_count,unbound_lineage_id:null,unbound_revision_id:null,bound_lineage_profile:'lineage_<product-a0-semantic-hash>',bound_revision_profile:'revision_<product-a0-semantic-hash>',canonical_identity_binding:data.canonical_identity_binding,phase_count:data.spec.phase_count,canonical_receipt_count:data.canonical_receipt_count,per_run_witness_count:data.per_run_witness_count,proof_object_set_count:data.proof_object_set_count,exact_ref_query_count:data.exact_ref_query_count,formal_run_id_algorithm_changed:false,database_execution_authorized:false,run_a_executed:false,run_b_executed:false,real_port_bundle_implemented:false,cross_run_comparator_implemented:false,finalizer_present:false,s6_candidate_implemented:false,mcft_cap_08_complete:false,mcft_cap_09_authorized:false};delete result.spec;write(result);console.log(JSON.stringify(result,null,2));
 }catch(e){write({schema_version:'geox_mcft_cap08_s6_materializer_identity_reconciliation_result_v1',status:'FAIL',error:e instanceof Error?e.message:String(e)});console.error(e);process.exitCode=1;}})();
