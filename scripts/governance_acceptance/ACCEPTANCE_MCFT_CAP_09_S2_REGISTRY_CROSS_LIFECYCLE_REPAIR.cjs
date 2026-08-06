#!/usr/bin/env node
'use strict';
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
process.chdir(path.resolve(__dirname,'../..'));
const BASE='15cdb24667d43cf7c21294d22b68160c6668cf73';
const S2_SUBJECT='126257e1a08d116089f5f28bd733e6abfd92f290';
const S3_SUBJECT='15cdb24667d43cf7c21294d22b68160c6668cf73';
const ROUTING_FILES=[
'.github/workflows/mcft-cap-09-s2-registry-registration.yml',
'.github/workflows/mcft-cap-09-s3-registry-registration.yml',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs',
'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs',
'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs'].sort();
const S2_EXACT=[
'.github/workflows/mcft-cap-09-s2-exact-sha-attestation.yml',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_EXACT_SHA_ATTESTATION_V1.cjs'].sort();
const S3_EXACT=[
'.github/workflows/mcft-cap-09-s3-exact-sha-attestation.yml',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S3_EXACT_SHA_ATTESTATION_V1.cjs'].sort();
const S3_REG=[
'.github/workflows/mcft-cap-09-s3-registry-registration.yml',
'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-DELIVERY-STATUS-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-REGISTRY-REGISTRATION-BOUNDARY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-REGISTRY-REGISTRATION-V1.json',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S3_REGISTRY_REGISTRATION.cjs'].sort();
const S3_CAND=[
'.github/workflows/mcft-cap-09-s3-persistent-sequential-scheduler.yml',
'apps/server/db/migrations/2026_08_06_mcft_cap_09_s3_persistent_sequential_scheduler.sql',
'apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.ts',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-DELIVERY-STATUS-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-HARD-ACCEPTANCE-EVIDENCE-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-PERSISTENT-SEQUENTIAL-SCHEDULER-CANDIDATE-BOUNDARY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-PERSISTENT-SEQUENTIAL-SCHEDULER-CANDIDATE-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-PERSISTENT-SEQUENTIAL-SCHEDULER-CONFIG-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S3_PERSISTENT_SEQUENTIAL_SCHEDULER.cjs',
'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S3_PERSISTENT_SEQUENTIAL_SCHEDULER.ts'].sort();
const run=(args)=>cp.execFileSync('git',args,{encoding:'utf8'}).trim();
const base=process.env.MCFT_BASE_SHA;
if(!base) throw new Error('MCFT_BASE_SHA_REQUIRED');
const files=run(['diff','--name-only',`${base}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
const same=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const must=(v,c)=>{if(!v)throw new Error(c);};
const write=(name,v)=>{fs.mkdirSync('acceptance-output',{recursive:true});fs.writeFileSync(`acceptance-output/${name}`,JSON.stringify(v,null,2)+'\n');console.log(JSON.stringify(v,null,2));};
const marker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
const authorityFalse=(v,p)=>{for(const k of ['implementation_authorized','runtime_source_authorized','live_ingestion_authorized','background_scheduler_authorized','canonical_write_authorized','public_http_writer_authorized','model_activation_authorized','controlled_action_authorized'])must(v[k]===false,`${p}:${k}`);};

if(process.argv.includes('--exact-sha-route-only')){
 must(same(files,S2_EXACT),'EXACT_S2_EXACT_SHA_BOUNDARY_REQUIRED');
 must(run(['rev-list','--count',`${base}..HEAD`])==='1','ONE_COMMIT_REQUIRED');
 write('MCFT_CAP_09_S2_EXACT_SHA_LIFECYCLE_ROUTE_RESULT.json',{status:'PASS',lifecycle:'S2_EXACT_SHA_ATTESTATION_ROUTED',base_sha:base,head_sha:run(['rev-parse','HEAD']),changed_files:files,candidate_transition:false,registry_transition:false});
 process.exit(0);
}
if(process.argv.includes('--s3-registration-route-only')){
 must(same(files,S3_REG),'EXACT_S3_REGISTRATION_BOUNDARY_REQUIRED');
 const status=JSON.parse(fs.readFileSync('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-DELIVERY-STATUS-V1.json','utf8'));
 must(status.s3_candidate_implemented===false&&status.externally_effective===false,'S3_REGISTRATION_NON_CANDIDATE_REQUIRED');
 authorityFalse(status,'S3_REG_STATUS');
 write('MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR_RESULT.json',{status:'PASS',lifecycle:'S3_REGISTRATION_ROUTED',base_sha:base,head_sha:run(['rev-parse','HEAD']),changed_files:files,candidate_transition:false,registry_transition:true});
 process.exit(0);
}
if(process.argv.includes('--s3-candidate-route-only')){
 must(same(files,S3_CAND),'EXACT_S3_CANDIDATE_BOUNDARY_REQUIRED');
 const status=JSON.parse(fs.readFileSync('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-DELIVERY-STATUS-V1.json','utf8'));
 must(status.s3_candidate_implemented===true&&status.externally_effective===false,'S3_CANDIDATE_STATUS_REQUIRED');
 authorityFalse(status,'S3_CAND_STATUS');
 write('MCFT_CAP_09_S3_CANDIDATE_LIFECYCLE_ROUTE_RESULT.json',{status:'PASS',lifecycle:'S3_CANDIDATE_ROUTED',base_sha:base,head_sha:run(['rev-parse','HEAD']),changed_files:files,candidate_transition:true,registry_transition:false});
 process.exit(0);
}
if(process.argv.includes('--s3-exact-sha-route-only')){
 must(same(files,S3_EXACT),'EXACT_S3_EXACT_SHA_BOUNDARY_REQUIRED');
 must(run(['rev-list','--count',`${base}..HEAD`])==='1','ONE_COMMIT_REQUIRED');
 const workflow=fs.readFileSync(S3_EXACT[0],'utf8');
 const exactValidator=fs.readFileSync(S3_EXACT[1],'utf8');
 must(!workflow.includes(marker)&&!exactValidator.includes(marker),'CANDIDATE_DECLARATION_FORBIDDEN');
 for(const token of ['mcft-cap-09-s3-exact-sha-attestation','MCFT_SUBJECT_SHA','--attest',"MCFT_RETENTION_DAYS: '730'",'mcft-cap-09/s3-exact-sha-attestation'])must(workflow.includes(token),`S3_EXACT_WORKFLOW_TOKEN:${token}`);
 for(const token of [S3_SUBJECT,'candidate_to_merge_tree_delta','s3_persistent_sequential_scheduler_effective','MCFT_CAP_09_S4_REGISTRY_REGISTRATION','semantic_artifact_digest'])must(exactValidator.includes(token),`S3_EXACT_VALIDATOR_TOKEN:${token}`);
 write('MCFT_CAP_09_S3_EXACT_SHA_LIFECYCLE_ROUTE_RESULT.json',{schema_version:'geox_mcft_cap09_s3_exact_sha_lifecycle_route_result_v1',status:'PASS',lifecycle:'S3_EXACT_SHA_ATTESTATION_ROUTED_TO_DEDICATED_CONTROL_PLANE',base_sha:base,head_sha:run(['rev-parse','HEAD']),changed_files:files,s3_subject_sha:S3_SUBJECT,candidate_transition:false,registry_transition:false,runtime_source_delta:0,first_legal_next_action:'DEDICATED_S3_EXACT_SHA_CONTROL_PLANE'});
 process.exit(0);
}

must(base===BASE,'EXACT_S3_EXACT_ROUTING_BASE_REQUIRED');
must(same(files,ROUTING_FILES),'EXACT_S3_EXACT_ROUTING_BOUNDARY_REQUIRED');
must(run(['rev-list','--count',`${base}..HEAD`])==='1','ONE_COMMIT_REQUIRED');
for(const file of [
'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-DELIVERY-STATUS-V1.json',
'apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.ts',
'apps/server/db/migrations/2026_08_06_mcft_cap_09_s3_persistent_sequential_scheduler.sql'
])must(run(['rev-parse',`${base}:${file}`])===run(['rev-parse',`HEAD:${file}`]),`FROZEN_BLOB_DRIFT:${file}`);
const classifier=fs.readFileSync('scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs','utf8');
const router=fs.readFileSync('scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs','utf8');
const s2=fs.readFileSync('.github/workflows/mcft-cap-09-s2-registry-registration.yml','utf8');
const s3=fs.readFileSync('.github/workflows/mcft-cap-09-s3-registry-registration.yml','utf8');
for(const token of ['s3ExactShaLifecycleRepair','s3ExactShaAttestation','s3-exact-sha-attestation'])must(classifier.includes(token),`CLASSIFIER_TOKEN:${token}`);
for(const token of ['s3-exact-sha-attestation','--s3-exact-sha-route-only'])must(router.includes(token),`ROUTER_TOKEN:${token}`);
for(const workflow of [s2,s3])for(const token of ['s3-exact-sha-attestation','MCFT_CAP_09_S3_EXACT_SHA_LIFECYCLE_ROUTE_RESULT.json'])must(workflow.includes(token),`WORKFLOW_TOKEN:${token}`);
write('MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR_RESULT.json',{schema_version:'geox_mcft_cap09_s3_exact_sha_routing_repair_result_v1',status:'PASS',repair_generation:'S3_EXACT_SHA_ATTESTATION_LIFECYCLE_ROUTING',base_sha:base,head_sha:run(['rev-parse','HEAD']),changed_files:files,s2_effective_subject_sha:S2_SUBJECT,s3_subject_sha:S3_SUBJECT,s3_exact_sha_route_ready:true,candidate_transition:false,registry_delta:0,status_object_delta:0,runtime_source_delta:0,next_legal_action:'MCFT_CAP_09_S3_EXACT_SHA_CONTROL_PLANE'});
