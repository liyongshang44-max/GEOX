#!/usr/bin/env node
"use strict";
// Validate a pre-physical Windows admission plan, with deliberate HOLD status.
// No physical resources, Provider, Permit, PG/S3 writes, or implicit promotion.
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const assert=require("node:assert/strict"),crypto=require("node:crypto");
const ROOT=path.resolve(__dirname,"../..");
const CONTRACT="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-POSTMERGE-WINDOWS-PHYSICAL-READONLY-GATE-V1.json";
const TRUST="scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json";
const SOURCE="6d8fb108655d9ada4b44cc7e4709a1c2ac5832b0";
const MAIN="b2e846d4b10a5d124d6060998ef1c9a2895391e4";
const bundle="docs/digital_twin/mcft/cap_09/evidence/MCFT-CAP09-DA9-SIGNED-V2-SIX-OPERATOR-REVIEW-20261025.json";
const composer="scripts/runtime_acceptance/MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.ts";
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),"utf8"));
const git=(...args)=>cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8",timeout:20000,maxBuffer:5_000_000}).trim();
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
function validate(d,trust,sourceFacts){
 assert.equal(d.schema_version,"geox_mcft_cap09_postmerge_windows_physical_readonly_gate_v1");
 assert.equal(d.status,"HOLD_PENDING_FRESH_WINDOWS_PHYSICAL_READBACK_NOT_EXECUTION_AUTHORITY");
 assert.equal(d.source_main_sha,MAIN);assert.equal(d.source_first_parent_signed_head,SOURCE);
 assert.equal(d.source_governance_head,"bc367f2ead25b9f28dfd61b1aed394fd864d73b2");
 assert.equal(d.source_integration_merge,"876cdcff39fe9c252b591236afd3b9bcdf27a4f4");
 assert.equal(d.source_public_six_signed_sha256,"sha256:a98f40c3ed017b017a8459d02655b9f206f6716d1402abcc0e579487c63901df");
 assert.equal(d.source_public_six_signed_git_blob,sourceFacts.bundle_blob);
 assert.equal(sourceFacts.main_sha,MAIN);assert.equal(sourceFacts.composer_source_blob,sourceFacts.composer_main_blob);
 assert.equal(sourceFacts.composer_source_blob,"2d1f72d92c05093537774285bda5b7200845344d");
 assert.equal(sourceFacts.six_bundle_hash,d.source_public_six_signed_sha256);
 assert.equal(sourceFacts.source_ancestor,true);assert.equal(sourceFacts.gov_ancestor,true);
 assert.equal(d.main_ci_workflow_run,40253987206);
 assert.equal(d.main_ci_build_result,"PASS");assert.equal(d.main_ci_acceptance_result,"PASS");
 assert.equal(d.required_windows_runtime.platform,"win32");
 assert.equal(d.required_windows_runtime.node_version,"v24.19.0");
 assert.equal(d.required_windows_runtime.github_actions_runtime_allowed,false);
 assert.equal(d.required_windows_runtime.exact_main_git_checkout,true);
 assert.equal(d.new_isolation.run_id_pattern,"^[0-9a-f]{12}$");
 assert(d.new_isolation.forbidden_prior_run_ids.includes("da9db7129607"));
 assert.deepEqual(d.new_isolation.minio_four_zero_fields,["current","versions","delete_markers","multipart"]);
 assert.equal(d.new_isolation.pg_public_table_count,29);
 assert.equal(d.new_isolation.pg_total_rows_required,0);
 assert.equal(d.new_isolation.pg_actual_login_matrix_required,true);
 assert.equal(d.new_isolation.minio_four_zero_required,true);
 assert.deepEqual(d.pg_acl_matrices.evidence,{role:"geox_mcft_cap09_evidence_runtime_v1",select:4,insert:3,update:3,delete:0,direct_public_facts_insert:false,fenced_append_execute:true});
 assert.deepEqual(d.pg_acl_matrices.twin,{role:"geox_mcft_cap09_twin_runtime_v1",select:20,insert:19,update:19,delete:5});
 assert.equal(d.provider_source_at_use.kbs_source,"lter.kbs.msu.edu/weather/variates/25");
 assert.equal(d.provider_source_at_use.kbs_age_max_minutes_at_actual_retrieval,30);
 assert.deepEqual(d.provider_source_at_use.gfs_cycle_hours_utc,[0,6,12,18]);
 assert.equal(d.provider_source_at_use.gfs_same_cycle_complete_72h_required,true);
 assert.equal(d.provider_source_at_use.external_future_provider_deadline_assumed,false);
 assert.equal(d.permit_preconditions.legacy_permit_reusable,false);
 assert.equal(d.permit_preconditions.old_contract_hardcodes_run,"da9db7129607");
 assert.equal(d.permit_preconditions.old_attempt_ordinal,2);
 assert.equal(trust.adopted,false);assert.equal(trust.execution_enabled,false);
 assert.equal(d.permit_preconditions.trust_current_adopted,trust.adopted);
 assert.equal(d.permit_preconditions.trust_current_execution_enabled,trust.execution_enabled);
 for(const [key,v] of Object.entries(d.authorization)){
   if(["source_premerge_qcp_pass","postmerge_code_integrated"].includes(key))assert.equal(v,true);
   else assert.equal(v,false,"HOLD_UNVERIFIED_ADMISSION_MUST_NOT_PASS:"+key);
 }
 for(const [key,value] of Object.entries(d.non_effects))assert.equal(value,false,"HOLD_NO_PHYSICAL_EFFECTS:"+key);
 assert.equal(d.permit_preconditions.permit_signed,false);
 assert.equal(d.permit_preconditions.permit_consumed,false);
 assert.equal(d.new_evidence_requires_local_physical_run,true);
 assert.equal(d.scope,"LOCAL_HOST_READONLY_PHYSICAL_ELIGIBILITY_EVIDENCE_ONLY_TEST_ONLY_NO_PRODUCTION");
 return {status:"PASS_NONAUTHORIZING_POSTMERGE_WINDOWS_PHYSICAL_GATE_CONTRACT_ONLY",
   source_main_sha:MAIN,main_ci_pass:true,physical_pg_verified:false,
   physical_s3_verified:false,provider_at_use_verified:false,
   permit_eligible:false,production:false};
}
function negative(d,t,s){
 let n=0;function bad(f){const D=structuredClone(d),T=structuredClone(t),S=structuredClone(s);f(D,T,S);assert.throws(()=>validate(D,T,S));n++;}
 bad(x=>x.authorization.physical_host_static_qualified=true);
 bad(x=>x.authorization.positive_negative_pg_physical_readback=true);
 bad(x=>x.authorization.provider_actual_source_use_verified=true);
 bad(x=>x.authorization.permit_eligible=true);
 bad(x=>x.permit_preconditions.legacy_permit_reusable=true);
 bad(x=>x.provider_source_at_use.external_future_provider_deadline_assumed=true);
 bad(x=>x.new_isolation.minio_four_zero_fields.pop());
 bad((x,t)=>t.adopted=true);
 bad((x,t,s)=>s.composer_main_blob="0".repeat(40));
 bad(x=>x.new_isolation.pg_total_rows_required=1);
 bad(x=>x.non_effects.minio_written=true);
 bad(x=>x.source_main_sha="0".repeat(40));
 return n;
}
function main(){
 const d=read(CONTRACT),trust=read(TRUST);
 const main=git("rev-parse",MAIN+"^{commit}");
 const source=git("rev-parse",SOURCE+":"+composer),current=git("rev-parse",MAIN+":"+composer);
 const content=cp.execFileSync("git",["show",MAIN+":"+bundle],{cwd:ROOT,timeout:20000,maxBuffer:500_000});
 const sourceFacts={main_sha:main,composer_source_blob:source,composer_main_blob:current,
   bundle_blob:git("rev-parse",MAIN+":"+bundle),six_bundle_hash:"sha256:"+sha(content),
   source_ancestor:cp.spawnSync("git",["merge-base","--is-ancestor",SOURCE,MAIN],{cwd:ROOT}).status===0,
   gov_ancestor:cp.spawnSync("git",["merge-base","--is-ancestor",d.source_governance_head,MAIN],{cwd:ROOT}).status===0};
 const result=validate(d,trust,sourceFacts),tests=negative(d,trust,sourceFacts);
 assert.equal(tests,12);
 console.log(JSON.stringify({...result,negative_tests_pass:tests,
  original_signed_operator_package_preserved:true,live_host_run_performed:false,
  permit:false,physical_execution_authorized:false}));
}
try{main()}catch(e){console.error("HOLD_CAP09_POSTMERGE_WINDOWS_STATIC_CONTRACT:"+String(e.stack||e));process.exitCode=1;}
