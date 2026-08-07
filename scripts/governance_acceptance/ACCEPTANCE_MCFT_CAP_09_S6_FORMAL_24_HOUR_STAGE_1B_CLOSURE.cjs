#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const BASE='ac2d30df301fa882cea9b98c03944bffca58b0c8';
const S5_SUBJECT='afc882c49d6ec0a475552686200c369eb819b6cd';
const S5_RUN=31165105531;
const S5_ARTIFACT=8988635083;
const S5_DIGEST='sha256:bcb68915a3e01f5516da45d4e40271c5841eae23b3ce7c567357bed316e1ca43';
const FILES=[
  '.github/workflows/mcft-cap-09-s6-formal-24-hour-stage-1b-closure.yml',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-DELIVERY-STATUS-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-24-HOUR-CANDIDATE-BOUNDARY-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-24-HOUR-CANDIDATE-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-24-HOUR-CONFIG-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-HARD-ACCEPTANCE-LEDGER-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-S5-ATTESTATION-CONSUMPTION-V1.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S6_FORMAL_24_HOUR_STAGE_1B_CLOSURE.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S6_FORMAL_24_HOUR_STAGE_1B_CLOSURE_DB.ts',
  'scripts/runtime_acceptance/RUN_MCFT_CAP_09_S6_FORMAL_24_HOUR_STAGE_1B_WINDOW.ts',
];
const FALSE_FIELDS=['implementation_authorized','runtime_source_authorized','live_ingestion_authorized','background_scheduler_authorized','canonical_write_authorized','public_http_writer_authorized','model_activation_authorized','controlled_action_authorized'];
const git=(...args)=>cp.execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const read=(file)=>fs.readFileSync(path.join(ROOT,file),'utf8');
const json=(file)=>JSON.parse(read(file));
const same=(left,right,code)=>{try{assert.deepEqual(left,right)}catch{throw new Error(code)}};
const must=(value,code)=>{if(!value)throw new Error(code)};
const write=(value)=>{const output=path.join(ROOT,'acceptance-output/MCFT_CAP_09_S6_FORMAL_24_HOUR_CANDIDATE_RESULT.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(value,null,2)+'\n');console.log(JSON.stringify(value,null,2));};
function find(name){const root=path.resolve(process.env.MCFT_CAP09_S5_EFFECTIVE_ARTIFACT_DIR||'acceptance-input/cap09-s5-effective'),queue=[root];while(queue.length){const current=queue.pop();if(!current||!fs.existsSync(current))continue;for(const entry of fs.readdirSync(current,{withFileTypes:true})){const target=path.join(current,entry.name);if(entry.isDirectory())queue.push(target);else if(entry.name===name)return target;}}throw new Error(`ARTIFACT_MEMBER_MISSING:${name}`);}

try{
  const base=process.env.MCFT_BASE_SHA;
  must(base===BASE,'EXACT_S6_CANDIDATE_BASE_REQUIRED');
  must(git('rev-list','--count',`${base}..HEAD`)==='1','ONE_COMMIT_REQUIRED');
  const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  same(changed,[...FILES].sort(),'EXACT_TEN_FILE_S6_CANDIDATE_BOUNDARY_REQUIRED');
  must(!FILES.some((file)=>file.startsWith('apps/')||file.startsWith('packages/')||file.includes('/migrations/')),'RUNTIME_MIGRATION_BOUNDARY_FORBIDDEN');
  const marker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
  for(const file of FILES)must(!read(file).includes(marker),`DECLARATION_MARKER_FORBIDDEN_IN_FILE:${file}`);
  const att=JSON.parse(fs.readFileSync(find('MCFT_CAP_09_S5_EXACT_SHA_ATTESTATION.json'),'utf8'));
  const locator=JSON.parse(fs.readFileSync(find('MCFT_CAP_09_S5_ATTESTATION_RETENTION_LOCATOR.json'),'utf8'));
  must(att.status==='PASS'&&att.subject_sha===S5_SUBJECT&&att.semantic_artifact_digest===S5_DIGEST,'S5_EXACT_SHA_AUTHORITY_REQUIRED');
  must(att.effective_authority?.s5_shadow_online_canonical_integration_effective===true&&att.effective_authority?.effective_next_slice==='S6','S5_EFFECTIVE_NEXT_SLICE_REQUIRED');
  must(locator.retention_level==='R2'&&locator.readback_verified===true&&locator.locked_version_delete_denied===true&&Date.parse(locator.retain_until)>=Date.now()+729*86400000,'S5_R2_730_AUTHORITY_REQUIRED');
  const status=json('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-DELIVERY-STATUS-V1.json');
  must(status.status==='S6_FORMAL_24_HOUR_CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE'&&status.s6_candidate_implemented===true&&status.candidate_declaration_present===true&&status.externally_effective===false,'S6_CANDIDATE_STATUS_REQUIRED');
  must(status.formal_window_started===false&&status.formal_window_completed===false,'FORMAL_WINDOW_MUST_NOT_START_IN_CANDIDATE_PR');
  for(const field of FALSE_FIELDS)must(status[field]===false,`S6_AUTHORITY_FALSE_REQUIRED:${field}`);
  const config=json('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-24-HOUR-CONFIG-V1.json');
  same(config.slot_ids,Array.from({length:24},(_,index)=>`O${String(index).padStart(2,'0')}`),'EXACT_O00_O23_REQUIRED');
  must(config.slot_interval_seconds===3600&&config.accelerated_clock_allowed===false&&config.persistent_postgresql_store_count===1&&config.database_restore_between_slots_allowed===false&&config.existing_governed_database_evidence_only===true&&config.synthetic_sensor_truth_allowed===false,'FORMAL_CONFIG_BOUNDARY_REQUIRED');
  must(config.intentional_missed_slot==='O11'&&config.controlled_restart_recovery_slot==='O12','RESTART_BACKFILL_VECTOR_REQUIRED');
  const boundary=json('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-24-HOUR-CANDIDATE-BOUNDARY-V1.json');
  must(boundary.base_main_sha===BASE&&boundary.file_count===10&&boundary.runtime_source_delta===0&&boundary.migration_delta===0&&boundary.formal_database_execution_in_candidate_pr===false&&boundary.external_effectiveness===false,'CANDIDATE_BOUNDARY_REQUIRED');
  same([...boundary.files].sort(),[...FILES].sort(),'BOUNDARY_FILE_LIST_REQUIRED');
  const candidate=json('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-24-HOUR-CANDIDATE-V1.json');
  must(candidate.candidate_base_sha===BASE&&candidate.s5_effective_subject_sha===S5_SUBJECT&&candidate.s5_exact_sha_r2_run_id===S5_RUN&&candidate.s5_exact_sha_artifact_id===S5_ARTIFACT&&candidate.s5_semantic_artifact_digest===S5_DIGEST,'CANDIDATE_PREDECESSOR_BINDING_REQUIRED');
  must(candidate.formal_window_started===false&&candidate.hard_acceptance_effective_count===0&&candidate.completion_claim===false,'CANDIDATE_NONCLAIMS_REQUIRED');
  const ledger=json('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-HARD-ACCEPTANCE-LEDGER-V1.json');
  must(ledger.items.length===24&&ledger.effective_pass_count===0&&ledger.capability_complete===false&&ledger.items.every((item)=>item.status!=='EFFECTIVE'),'PENDING_24_ITEM_LEDGER_REQUIRED');
  const workflow=read('.github/workflows/mcft-cap-09-s6-formal-24-hour-stage-1b-closure.yml');
  for(const token of ['pull_request:','merge_group:','schedule:','workflow_dispatch:','GEOX_MCFT_CAP09_S6_FORMAL_WINDOW_ENABLED','GEOX_MCFT_CAP09_S6_DATABASE_URL','RUN_MCFT_CAP_09_S6_FORMAL_24_HOUR_STAGE_1B_WINDOW.ts','ACCEPTANCE_MCFT_CAP_09_S6_FORMAL_24_HOUR_STAGE_1B_CLOSURE_DB.ts'])must(workflow.includes(token),`WORKFLOW_TOKEN_REQUIRED:${token}`);
  must(!workflow.includes('services:\n      postgres:'),'FORMAL_PERSISTENT_DATABASE_MUST_NOT_BE_EPHEMERAL_SERVICE');
  const runner=read('scripts/runtime_acceptance/RUN_MCFT_CAP_09_S6_FORMAL_24_HOUR_STAGE_1B_WINDOW.ts');
  for(const token of ['new Date()','transaction_timestamp()','INTENTIONAL_MISSED_SLOT','O11','controlled_restart_checkpoint_readback','database_recreated: false','PostgresPersistentSequentialSchedulerAdapterV1','ShadowOnlineCanonicalIntegrationServiceV1'])must(runner.includes(token),`FORMAL_RUNNER_TOKEN_REQUIRED:${token}`);
  must(!runner.includes('MCFT_CAP09_S6_NOW_OVERRIDE'),'ACCELERATED_OR_OVERRIDDEN_FORMAL_CLOCK_FORBIDDEN');
  write({schema_version:'geox_mcft_cap09_s6_formal_24_hour_candidate_result_v1',status:'PASS',base_sha:base,head_sha:git('rev-parse','HEAD'),changed_files:changed,s5_effective_subject_sha:S5_SUBJECT,s5_exact_sha_r2_run_id:S5_RUN,s5_exact_sha_artifact_id:S5_ARTIFACT,s5_semantic_artifact_digest:S5_DIGEST,slot_count:24,slot_interval_seconds:3600,persistent_postgresql_store_required:true,formal_database_execution_in_candidate_pr:false,formal_window_started:false,runtime_source_delta:0,migration_delta:0,g_write_authorized:false,action_authorized:false,external_effectiveness:false,first_legal_next_action:'PROTECTED_MERGE_THEN_PROVISION_PERSISTENT_DATABASE_AND_START_REAL_UTC_WINDOW'});
}catch(error){write({schema_version:'geox_mcft_cap09_s6_formal_24_hour_candidate_result_v1',status:'FAIL',error:String(error instanceof Error?error.message:error)});console.error(error);process.exitCode=1;}
