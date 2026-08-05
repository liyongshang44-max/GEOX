#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
process.chdir(ROOT);
const ROUTING_BASE='9000c1b16c7c5c39fb4717f8002cc3b03869ea68';
const S2_SUBJECT='126257e1a08d116089f5f28bd733e6abfd92f290';
const ROUTING_FILES=[
'.github/workflows/mcft-cap-09-s2-registry-registration.yml',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs',
'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs',
'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs'].sort();
const EXACT_SHA_FILES=[
'.github/workflows/mcft-cap-09-s2-exact-sha-attestation.yml',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_EXACT_SHA_ATTESTATION_V1.cjs'].sort();
const S3_FILES=[
'.github/workflows/mcft-cap-09-s3-registry-registration.yml',
'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-DELIVERY-STATUS-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-REGISTRY-REGISTRATION-BOUNDARY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-REGISTRY-REGISTRATION-V1.json',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S3_REGISTRY_REGISTRATION.cjs'].sort();
const FROZEN=[
'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json',
'apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts'];
const run=(args)=>cp.execFileSync('git',args,{encoding:'utf8'}).trim();
const changed=(base)=>run(['diff','--name-only',`${base}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
const same=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const must=(v,c)=>{if(!v)throw new Error(c);};
const write=(name,value)=>{fs.mkdirSync('acceptance-output',{recursive:true});fs.writeFileSync(`acceptance-output/${name}`,JSON.stringify(value,null,2)+'\n');console.log(JSON.stringify(value,null,2));};
const authorityFalse=(value,prefix)=>{for(const key of ['implementation_authorized','runtime_source_authorized','live_ingestion_authorized','background_scheduler_authorized','canonical_write_authorized','public_http_writer_authorized','model_activation_authorized','controlled_action_authorized'])must(value[key]===false,`${prefix}:${key}`);};
const base=process.env.MCFT_BASE_SHA;
if(!base) throw new Error('MCFT_BASE_SHA_REQUIRED');
const files=changed(base);
const marker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');

if(process.argv.includes('--exact-sha-route-only')){
 must(same(files,EXACT_SHA_FILES),'EXACT_S2_EXACT_SHA_LIFECYCLE_BOUNDARY_REQUIRED');
 must(run(['rev-list','--count',`${base}..HEAD`])==='1','ONE_COMMIT_REQUIRED');
 const workflow=fs.readFileSync(EXACT_SHA_FILES[0],'utf8');
 const validator=fs.readFileSync(EXACT_SHA_FILES[1],'utf8');
 must(!workflow.includes(marker)&&!validator.includes(marker),'CANDIDATE_DECLARATION_FORBIDDEN');
 for(const token of ['mcft-cap-09-s2-exact-sha-attestation','MCFT_SUBJECT_SHA','--attest','retention-days: 90','mcft-cap-09/s2-exact-sha-attestation'])must(workflow.includes(token),`EXACT_SHA_WORKFLOW_TOKEN_REQUIRED:${token}`);
 for(const token of [S2_SUBJECT,'correction_to_merge_tree_delta','s2_database_evidence_ingress_effective','MCFT_CAP_09_S3_REGISTRY_REGISTRATION','semantic_artifact_digest'])must(validator.includes(token),`EXACT_SHA_VALIDATOR_TOKEN_REQUIRED:${token}`);
 write('MCFT_CAP_09_S2_EXACT_SHA_LIFECYCLE_ROUTE_RESULT.json',{schema_version:'geox_mcft_cap_09_s2_exact_sha_lifecycle_route_result_v1',status:'PASS',lifecycle:'S2_EXACT_SHA_ATTESTATION_ROUTED_TO_DEDICATED_CONTROL_PLANE',base_sha:base,head_sha:run(['rev-parse','HEAD']),changed_files:files,corrected_s2_subject_sha:S2_SUBJECT,registry_transition:false,candidate_transition:false,runtime_source_delta:0,first_legal_next_action:'DEDICATED_S2_EXACT_SHA_CONTROL_PLANE'});
 process.exit(0);
}

if(process.argv.includes('--s3-registration-route-only')){
 must(same(files,S3_FILES),'EXACT_S3_REGISTRY_REGISTRATION_BOUNDARY_REQUIRED');
 must(run(['rev-list','--count',`${base}..HEAD`])==='1','ONE_COMMIT_REQUIRED');
 const diff=run(['diff','--unified=0',`${base}...HEAD`]);
 must(!diff.includes(marker),'CANDIDATE_DECLARATION_FORBIDDEN');
 const status=JSON.parse(fs.readFileSync(S3_FILES[2],'utf8'));
 const boundary=JSON.parse(fs.readFileSync(S3_FILES[3],'utf8'));
 const record=JSON.parse(fs.readFileSync(S3_FILES[4],'utf8'));
 must(status.s3_candidate_implemented===false&&status.candidate_declaration_present===false&&status.externally_effective===false,'S3_STATUS_MUST_BE_NON_CANDIDATE');
 must(status.s2_effective_subject_sha===S2_SUBJECT&&status.s2_exact_sha_r2_run_id===31041512709&&status.s2_exact_sha_artifact_id===8944755739,'S3_STATUS_S2_AUTHORITY_BINDING');
 authorityFalse(status,'S3_STATUS_AUTHORITY');
 must(boundary.changed_file_count===6&&same(boundary.changed_files,S3_FILES)&&boundary.candidate_transition===false&&boundary.registry_delta===1,'S3_BOUNDARY');
 must(record.target_authority_set_revision==='1.10'&&record.target_authority_set_change_id==='MCFT-CAP-09.S3-TRANSITION-REGISTRATION','S3_RECORD_REGISTRY_REVISION');
 must(record.candidate_transition_performed===false&&record.candidate_declaration_present===false,'S3_RECORD_NON_CANDIDATE');
 authorityFalse(record,'S3_RECORD_AUTHORITY');
 write('MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR_RESULT.json',{schema_version:'geox_mcft_cap_09_s3_registry_historical_lane_route_result_v1',status:'PASS',lifecycle:'S3_REGISTRY_REGISTRATION_ROUTED_TO_DEDICATED_WORKFLOW',base_sha:base,head_sha:run(['rev-parse','HEAD']),changed_files:files,s2_effective_subject_sha:S2_SUBJECT,s2_exact_sha_r2_run_id:31041512709,s2_exact_sha_artifact_id:8944755739,registry_transition:true,candidate_transition:false,runtime_source_delta:0,first_legal_next_action:'DEDICATED_S3_REGISTRY_REGISTRATION_VALIDATION'});
 process.exit(0);
}

must(base===ROUTING_BASE,'EXACT_S3_REGISTRATION_ROUTING_BASE_REQUIRED');
must(same(files,ROUTING_FILES),'EXACT_S3_REGISTRATION_ROUTING_BOUNDARY_REQUIRED');
must(run(['rev-list','--count',`${base}..HEAD`])==='1','ONE_COMMIT_REQUIRED');
for(const file of FROZEN)must(run(['diff','--quiet',`${base}...HEAD`,'--',file])==='',`FROZEN_AUTHORITY_DRIFT:${file}`);
const classifier=fs.readFileSync('scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs','utf8');
const router=fs.readFileSync('scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs','utf8');
const workflow=fs.readFileSync('.github/workflows/mcft-cap-09-s2-registry-registration.yml','utf8');
for(const token of ['s3Registration','s3-registry-registration','s3RegistrationLifecycleRepair'])must(classifier.includes(token),`CLASSIFIER_TOKEN_REQUIRED:${token}`);
for(const token of ['s3-registry-registration','--s3-registration-route-only','ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs'])must(router.includes(token),`ROUTER_TOKEN_REQUIRED:${token}`);
for(const token of ['s3-registry-registration','--s3-registration-route-only','GEOX-MCFT-CAP-09-S3-*'])must(workflow.includes(token),`WORKFLOW_TOKEN_REQUIRED:${token}`);
write('MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR_RESULT.json',{schema_version:'geox_mcft_cap_09_s3_registry_routing_repair_result_v1',status:'PASS',repair_generation:'S3_REGISTRY_REGISTRATION_LIFECYCLE_ROUTING',base_sha:base,head_sha:run(['rev-parse','HEAD']),changed_files:files,corrected_s2_subject_sha:S2_SUBJECT,s3_registry_registration_route_ready:true,candidate_transition:false,registry_delta:0,taskbook_delta:0,status_object_delta:0,runtime_source_delta:0,next_legal_action:'MCFT_CAP_09_S3_REGISTRY_REGISTRATION'});
