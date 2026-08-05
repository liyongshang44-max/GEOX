#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const ROOT=process.cwd();
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_09_S1_REGISTRY_REGISTRATION_RESULT.json');
const BASE='d9339a898a8bd22bdf3dd341b73b7469faf9c9d5';
const REG='docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json';
const STATUS='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-DELIVERY-STATUS-V1.json';
const RECORD='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-REGISTRY-REGISTRATION-V1.json';
const BOUNDARY='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-REGISTRY-REGISTRATION-BOUNDARY-V1.json';
const WORKFLOW='.github/workflows/mcft-cap-09-s1-registry-registration.yml';
const VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S1_REGISTRY_REGISTRATION.cjs';
const TASK='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md';
const SCOPE='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json';
const SIGNAL='docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json';
const CURRENT='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json';
const S0='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-DELIVERY-STATUS-V1.json';
const FILES=[WORKFLOW,REG,STATUS,RECORD,BOUNDARY,VALIDATOR].sort();
const S1_RULE={status_file:STATUS,field_path:'s1_candidate_implemented',allowed_candidate_values:[true],focused_workflow:'mcft-cap-09-s1-adapter-contracts',standard_workflow:'ci',predecessor_effective_evidence_required:true};
const DEFERRED=[2,3,4,5,6].map(n=>`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S${n}-DELIVERY-STATUS-V1.json`);
const git=(...a)=>execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const json=f=>JSON.parse(read(f));
const must=(v,c)=>{if(!v)throw new Error(c);};
const eq=(a,b,c)=>{try{assert.deepEqual(a,b);}catch{throw new Error(`${c}:${JSON.stringify(a)}`);}};
const write=o=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(o,null,2)+'\n');};
const changed=base=>git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
function artifact(name){const root=path.resolve(process.env.MCFT_CAP09_S0_EFFECTIVE_ARTIFACT_DIR||'acceptance-input/cap09-s0-effective');const q=[root];while(q.length){const d=q.pop();if(!fs.existsSync(d))continue;for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())q.push(f);else if(e.name===name)return f;}}throw new Error(`ARTIFACT_MISSING:${name}`);}
function authorityFalse(o,prefix){for(const k of ['implementation_authorized','runtime_source_authorized','canonical_write_authorized','live_ingestion_authorized','background_scheduler_authorized','public_http_writer_authorized','model_activation_authorized','controlled_action_authorized'])must(o[k]===false,`${prefix}:${k}`);}
function main(){
 const base=process.env.MCFT_BASE_SHA,head=git('rev-parse','HEAD');must(base===BASE,`BASE:${base}`);eq(changed(base),FILES,'CHANGED_FILES');must(Number(git('rev-list','--count',`${base}..HEAD`))===1,'COMMIT_COUNT');
 const marker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');for(const f of FILES){const t=read(f);must(!t.includes(marker),`DECLARATION_MARKER:${f}`);must(!/^(apps|packages|migrations)\//.test(f),`RUNTIME_PATH:${f}`);}must(git('rev-parse',`${base}:${REG}`)==='e066ad7e6ec57f8dae9d0c2a41a492434deec4e0','BASE_REGISTRY_BLOB');must(git('diff','--quiet',`${base}...HEAD`,'--',TASK,SCOPE,SIGNAL,CURRENT,S0)==='','FROZEN_AUTHORITY_DRIFT');
 const a=JSON.parse(fs.readFileSync(artifact('MCFT_CAP_09_S0_EXACT_SHA_ATTESTATION.json'),'utf8'));const l=JSON.parse(fs.readFileSync(artifact('MCFT_CAP_09_S0_ATTESTATION_RETENTION_LOCATOR.json'),'utf8'));
 must(a.status==='PASS'&&a.subject_sha==='7381d0f8ac56fe9f75fd78ce189920cb9ed99bf4','S0_ATTESTATION');must(a.effective_authority?.s0_authorization_effective===true&&a.effective_authority?.effective_next_slice==='S1','S0_EFFECTIVE');must(a.effective_authority?.s1_candidate_declaration_authorized===true&&a.effective_authority?.s1_authorized_scope==='ADAPTER_CONTRACTS_AND_CONFIGURATION_FREEZE_ONLY','S1_SCOPE');must(a.effective_authority?.runtime_source_authorized===false&&a.effective_authority?.background_scheduler_authorized===false&&a.effective_authority?.canonical_write_authorized===false,'S0_RUNTIME_BOUNDARY');must(l.retention_level==='R2'&&l.readback_verified===true&&l.locked_version_delete_denied===true,'S0_R2');
 const before=JSON.parse(git('show',`${base}:${REG}`)),reg=json(REG);must(reg.authority_set_revision==='1.8'&&reg.authority_set_change_id==='MCFT-CAP-09.S1-TRANSITION-REGISTRATION','REGISTRY_HEADER');for(const id of ['MCFT-CAP-06','MCFT-CAP-07','MCFT-CAP-08'])eq(reg.capabilities.find(x=>x.capability_line===id),before.capabilities.find(x=>x.capability_line===id),`PREDECESSOR_DRIFT:${id}`);
 const oldEntry=before.capabilities.find(x=>x.capability_line==='MCFT-CAP-09'),entry=reg.capabilities.find(x=>x.capability_line==='MCFT-CAP-09');must(oldEntry&&entry,'CAP09_ENTRY');eq(entry.authoritative_candidate_status_paths,[CURRENT,S0,STATUS],'CAP09_STATUS_PATHS');must(entry.candidate_transition_fields.length===2,'CAP09_TRANSITION_COUNT');eq(entry.candidate_transition_fields[0],oldEntry.candidate_transition_fields[0],'S0_RULE_DRIFT');eq(entry.candidate_transition_fields[1],S1_RULE,'S1_RULE');eq(entry.deferred_status_paths,DEFERRED,'DEFERRED_PATHS');must(entry.deferred_transition_registration_required===true&&entry.registration_mode==='APPEND_STATUS_PATH_WHEN_FILE_EXISTS_ON_PROTECTED_MAIN','REGISTRATION_MODE');authorityFalse(entry,'REGISTRY_AUTH');
 const s=json(STATUS);must(s.record_status==='S1_PRE_CANDIDATE_REGISTRY_REGISTERED_NON_EFFECTIVE'&&s.status==='S1_PRE_CANDIDATE_REGISTRY_REGISTERED_NON_EFFECTIVE','STATUS_SEED');must(s.s1_candidate_implemented===false&&s.candidate_declaration_present===false&&s.externally_effective===false,'STATUS_NON_CANDIDATE');must(s.s0_effective_subject_sha===a.subject_sha&&s.s0_exact_sha_r2_run_id===30978738965&&s.s0_exact_sha_artifact_id===8919296741,'STATUS_S0_BINDING');must(s.authorized_s1_scope==='ADAPTER_CONTRACTS_AND_CONFIGURATION_FREEZE_ONLY'&&s.registry_rule_present===true,'STATUS_SCOPE');authorityFalse(s,'STATUS_AUTH');for(const k of ['runtime_source_delta','migration_delta','canonical_runtime_data_delta','database_acl_delta','taskbook_delta','scope_contract_delta'])must(s[k]===0,`STATUS_DELTA:${k}`);
 const r=json(RECORD),b=json(BOUNDARY);must(r.record_status==='S1_TRANSITION_REGISTRATION_CANDIDATE_NOT_EFFECTIVE'&&r.base_main_sha===BASE&&r.s0_effective_subject_sha===a.subject_sha,'RECORD');must(r.registry_base_blob_sha==='e066ad7e6ec57f8dae9d0c2a41a492434deec4e0'&&r.target_authority_set_revision==='1.8','RECORD_REGISTRY');must(r.candidate_transition_performed===false&&r.candidate_declaration_present===false&&r.same_pr_modified_registry_may_authorize_candidate===false,'RECORD_NON_CANDIDATE');authorityFalse(r,'RECORD_AUTH');must(b.base_main_sha===BASE&&b.changed_file_count===6,'BOUNDARY');eq(b.changed_files,FILES,'BOUNDARY_FILES');must(b.registry_delta===1&&b.status_seed_delta===1&&b.candidate_transition===false&&b.runtime_source_delta===0&&b.migration_delta===0,'BOUNDARY_DELTA');
 const result={status:'PASS',change_class:'MCFT_CAP_09_S1_TRUSTED_REGISTRY_TRANSITION_REGISTRATION',base_sha:base,head_sha:head,changed_files:FILES,s0_effective_subject_sha:a.subject_sha,s0_r2_verified:true,registry_authority_set_revision:'1.8',registered_status_path:STATUS,registered_transition:S1_RULE,candidate_transition:false,candidate_declaration:false,implementation_authorized:false,runtime_source_delta:0,first_legal_next_action:'MCFT_CAP_09_S1_ADAPTER_CONTRACTS_CANDIDATE'};write(result);console.log(JSON.stringify(result,null,2));
}
try{main();}catch(e){const result={status:'FAIL',base_sha:process.env.MCFT_BASE_SHA||null,error:String(e?.message||e)};write(result);console.error(JSON.stringify(result,null,2));process.exitCode=1;}
