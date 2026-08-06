#!/usr/bin/env node
'use strict';
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
process.chdir(ROOT);

const ROUTING_BASE='a50bb3f0035ccf2c60415f4f5345b9ced03f3110';
const S2_SUBJECT='126257e1a08d116089f5f28bd733e6abfd92f290';
const ROUTING_FILES=[
'.github/workflows/mcft-cap-09-s2-registry-registration.yml',
'.github/workflows/mcft-cap-09-s3-registry-registration.yml',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs',
'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs',
'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs'].sort();
const EXACT_SHA_FILES=[
'.github/workflows/mcft-cap-09-s2-exact-sha-attestation.yml',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_EXACT_SHA_ATTESTATION_V1.cjs'].sort();
const S3_REGISTRATION_FILES=[
'.github/workflows/mcft-cap-09-s3-registry-registration.yml',
'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-DELIVERY-STATUS-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-REGISTRY-REGISTRATION-BOUNDARY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-REGISTRY-REGISTRATION-V1.json',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S3_REGISTRY_REGISTRATION.cjs'].sort();
const S3_CANDIDATE_FILES=[
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
const FROZEN=[
'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-DELIVERY-STATUS-V1.json',
'apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts'];
const run=(args)=>cp.execFileSync('git',args,{encoding:'utf8'}).trim();
const changed=(base)=>run(['diff','--name-only',`${base}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
const same=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const must=(value,code)=>{if(!value)throw new Error(code);};
const write=(name,value)=>{
 fs.mkdirSync('acceptance-output',{recursive:true});
 fs.writeFileSync(`acceptance-output/${name}`,JSON.stringify(value,null,2)+'\n');
 console.log(JSON.stringify(value,null,2));
};
const authorityFalse=(value,prefix)=>{
 for(const key of ['implementation_authorized','runtime_source_authorized','live_ingestion_authorized','background_scheduler_authorized','canonical_write_authorized','public_http_writer_authorized','model_activation_authorized','controlled_action_authorized']){
  must(value[key]===false,`${prefix}:${key}`);
 }
};
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
 for(const token of ['mcft-cap-09-s2-exact-sha-attestation','MCFT_SUBJECT_SHA','--attest','retention-days: 90','mcft-cap-09/s2-exact-sha-attestation']) must(workflow.includes(token),`EXACT_SHA_WORKFLOW_TOKEN_REQUIRED:${token}`);
 for(const token of [S2_SUBJECT,'correction_to_merge_tree_delta','s2_database_evidence_ingress_effective','MCFT_CAP_09_S3_REGISTRY_REGISTRATION','semantic_artifact_digest']) must(validator.includes(token),`EXACT_SHA_VALIDATOR_TOKEN_REQUIRED:${token}`);
 write('MCFT_CAP_09_S2_EXACT_SHA_LIFECYCLE_ROUTE_RESULT.json',{schema_version:'geox_mcft_cap_09_s2_exact_sha_lifecycle_route_result_v1',status:'PASS',lifecycle:'S2_EXACT_SHA_ATTESTATION_ROUTED_TO_DEDICATED_CONTROL_PLANE',base_sha:base,head_sha:run(['rev-parse','HEAD']),changed_files:files,corrected_s2_subject_sha:S2_SUBJECT,registry_transition:false,candidate_transition:false,runtime_source_delta:0,first_legal_next_action:'DEDICATED_S2_EXACT_SHA_CONTROL_PLANE'});
 process.exit(0);
}

if(process.argv.includes('--s3-registration-route-only')){
 must(same(files,S3_REGISTRATION_FILES),'EXACT_S3_REGISTRY_REGISTRATION_BOUNDARY_REQUIRED');
 must(run(['rev-list','--count',`${base}..HEAD`])==='1','ONE_COMMIT_REQUIRED');
 const diff=run(['diff','--unified=0',`${base}...HEAD`]);
 must(!diff.includes(marker),'CANDIDATE_DECLARATION_FORBIDDEN');
 const status=JSON.parse(fs.readFileSync('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-DELIVERY-STATUS-V1.json','utf8'));
 must(status.s3_candidate_implemented===false&&status.candidate_declaration_present===false&&status.externally_effective===false,'S3_STATUS_MUST_BE_NON_CANDIDATE');
 authorityFalse(status,'S3_STATUS_AUTHORITY');
 write('MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR_RESULT.json',{schema_version:'geox_mcft_cap_09_s3_registry_historical_lane_route_result_v1',status:'PASS',lifecycle:'S3_REGISTRY_REGISTRATION_ROUTED_TO_DEDICATED_WORKFLOW',base_sha:base,head_sha:run(['rev-parse','HEAD']),changed_files:files,s2_effective_subject_sha:S2_SUBJECT,registry_transition:true,candidate_transition:false,runtime_source_delta:0,first_legal_next_action:'DEDICATED_S3_REGISTRY_REGISTRATION_VALIDATION'});
 process.exit(0);
}

if(process.argv.includes('--s3-candidate-route-only')){
 must(same(files,S3_CANDIDATE_FILES),'EXACT_S3_CANDIDATE_BOUNDARY_REQUIRED');
 must(run(['rev-list','--count',`${base}..HEAD`])==='1','ONE_COMMIT_REQUIRED');
 must(run(['diff','--quiet',`${base}...HEAD`,'--','docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json'])==='','REGISTRY_DRIFT_FORBIDDEN');
 const repositoryDiff=run(['diff','--unified=0',`${base}...HEAD`]);
 must(!repositoryDiff.includes(`<!-- ${marker}`),'DECLARATION_MUST_REMAIN_PR_BODY_ONLY');
 const status=JSON.parse(fs.readFileSync('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-DELIVERY-STATUS-V1.json','utf8'));
 const boundary=JSON.parse(fs.readFileSync('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-PERSISTENT-SEQUENTIAL-SCHEDULER-CANDIDATE-BOUNDARY-V1.json','utf8'));
 const candidate=JSON.parse(fs.readFileSync('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-PERSISTENT-SEQUENTIAL-SCHEDULER-CANDIDATE-V1.json','utf8'));
 must(status.s3_candidate_implemented===true&&status.candidate_declaration_present===true&&status.externally_effective===false,'S3_CANDIDATE_STATUS_REQUIRED');
 must(status.persistent_sequential_scheduler_implemented===true&&status.production_wiring_present===false,'S3_SCHEDULER_STATUS_REQUIRED');
 authorityFalse(status,'S3_CANDIDATE_STATUS_AUTHORITY');
 must(boundary.changed_file_count===11&&same(boundary.changed_files,S3_CANDIDATE_FILES),'S3_CANDIDATE_BOUNDARY_FILES');
 must(boundary.candidate_transition===true&&boundary.candidate_declaration===true&&boundary.migration_delta===1&&boundary.runtime_source_delta===1&&boundary.operational_table_delta===2,'S3_CANDIDATE_BOUNDARY_DELTAS');
 must(candidate.record_status==='S3_CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE'&&candidate.scheduler_contract==='SCHEDULER_PORT_V1','S3_CANDIDATE_AUTHORITY');
 must(candidate.at_most_one_active_slot_per_scope===true&&candidate.oldest_due_slot_first===true&&candidate.terminal_success_implicit_retry_allowed===false,'S3_CANDIDATE_CORE_SEMANTICS');
 authorityFalse(candidate,'S3_CANDIDATE_AUTHORITY_FLAGS');
 const migration=fs.readFileSync('apps/server/db/migrations/2026_08_06_mcft_cap_09_s3_persistent_sequential_scheduler.sql','utf8');
 for(const token of ['twin_shadow_online_scheduler_cursor_v1','twin_shadow_online_scheduler_slot_v1',"WHERE state = 'RUNNING'",'UNIQUE']) must(migration.includes(token),`S3_MIGRATION_TOKEN_REQUIRED:${token}`);
 const adapter=fs.readFileSync('apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.ts','utf8');
 for(const token of ['implements SchedulerPortV1','listMissedSlots','claimDueSlot','recordTerminalResult','OLDER_MISSED_SLOT_REQUIRED','TERMINAL_SLOT_ALREADY_RECORDED','STALE_FENCING_TOKEN','FOR UPDATE']) must(adapter.includes(token),`S3_ADAPTER_TOKEN_REQUIRED:${token}`);
 const workflow=fs.readFileSync('.github/workflows/mcft-cap-09-s3-persistent-sequential-scheduler.yml','utf8');
 for(const token of ['mcft-cap-09-s3-persistent-sequential-scheduler','postgres:16','MCFT_CAP_09_S3_DESTRUCTIVE_ACCEPTANCE','MCFT_CAP_09_S3_POSTGRESQL_ACCEPTANCE_RESULT.json']) must(workflow.includes(token),`S3_WORKFLOW_TOKEN_REQUIRED:${token}`);
 write('MCFT_CAP_09_S3_CANDIDATE_LIFECYCLE_ROUTE_RESULT.json',{schema_version:'geox_mcft_cap_09_s3_candidate_lifecycle_route_result_v1',status:'PASS',lifecycle:'S3_CANDIDATE_ROUTED_TO_DEDICATED_FOCUSED_WORKFLOW',base_sha:base,head_sha:run(['rev-parse','HEAD']),changed_files:files,s2_effective_subject_sha:S2_SUBJECT,candidate_transition:true,registry_transition:false,migration_delta:1,operational_table_delta:2,runtime_source_delta:1,production_wiring_present:false,external_effectiveness:false,first_legal_next_action:'DEDICATED_S3_PERSISTENT_SEQUENTIAL_SCHEDULER_VALIDATION'});
 process.exit(0);
}

must(base===ROUTING_BASE,'EXACT_S3_CANDIDATE_ROUTING_BASE_REQUIRED');
must(same(files,ROUTING_FILES),'EXACT_S3_CANDIDATE_ROUTING_BOUNDARY_REQUIRED');
must(run(['rev-list','--count',`${base}..HEAD`])==='1','ONE_COMMIT_REQUIRED');
for(const file of FROZEN) must(run(['diff','--quiet',`${base}...HEAD`,'--',file])==='',`FROZEN_AUTHORITY_DRIFT:${file}`);
const classifier=fs.readFileSync('scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs','utf8');
const router=fs.readFileSync('scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs','utf8');
const s2Workflow=fs.readFileSync('.github/workflows/mcft-cap-09-s2-registry-registration.yml','utf8');
const s3Workflow=fs.readFileSync('.github/workflows/mcft-cap-09-s3-registry-registration.yml','utf8');
for(const token of ['s3CandidateLifecycleRepair','s3Candidate','s3-candidate-signal','s3-registry-registration']) must(classifier.includes(token),`CLASSIFIER_TOKEN_REQUIRED:${token}`);
for(const token of ['s3-candidate-signal','--s3-candidate-route-only','ACCEPTANCE_MCFT_CAP_09_S3_REGISTRY_REGISTRATION.cjs']) must(router.includes(token),`ROUTER_TOKEN_REQUIRED:${token}`);
for(const token of ['s3-candidate-signal','--s3-candidate-route-only','postgres_persistent_sequential_scheduler_adapter_v1.ts']) must(s2Workflow.includes(token),`S2_WORKFLOW_TOKEN_REQUIRED:${token}`);
for(const token of ['MCFT_REGISTRY_LANE: s3-registry-registration','MCFT_REGISTRY_MODE','mcft_cap_09_registry_lifecycle_router_v1.cjs','postgres_persistent_sequential_scheduler_adapter_v1.ts']) must(s3Workflow.includes(token),`S3_WORKFLOW_TOKEN_REQUIRED:${token}`);
write('MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR_RESULT.json',{schema_version:'geox_mcft_cap_09_s3_candidate_routing_repair_result_v1',status:'PASS',repair_generation:'S3_PERSISTENT_SEQUENTIAL_SCHEDULER_CANDIDATE_ROUTING',base_sha:base,head_sha:run(['rev-parse','HEAD']),changed_files:files,s2_effective_subject_sha:S2_SUBJECT,s3_candidate_route_ready:true,candidate_transition:false,registry_delta:0,taskbook_delta:0,status_object_delta:0,runtime_source_delta:0,next_legal_action:'MCFT_CAP_09_S3_PERSISTENT_SEQUENTIAL_SCHEDULER_CANDIDATE'});
