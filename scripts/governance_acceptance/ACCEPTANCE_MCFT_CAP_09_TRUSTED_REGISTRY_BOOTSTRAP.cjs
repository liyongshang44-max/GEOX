#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),p=require('node:path'),{execFileSync:x}=require('node:child_process'),assert=require('node:assert/strict');
const R=process.cwd(),OUT=p.join(R,'acceptance-output/MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP_RESULT.json');
const REPAIR_BASE='0c49f5282c3c05c33caf06da93862afaecda760c';
const BOOTSTRAP_BASE='7e8563c13305a551e819d1b8e7ac5f01f9d3764f';
const ORIGINAL_REGISTRY_BLOB='e92a5af9e422812b76b6b689b4a2d1b0263a41ab';
const REG='docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json';
const WORKFLOW='.github/workflows/mcft-cap-09-trusted-registry-bootstrap.yml';
const VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP.cjs';
const CORRECTION='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TRUSTED-REGISTRY-EXISTING-PATHS-CORRECTION-V1.json';
const CORRECTION_BOUNDARY='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TRUSTED-REGISTRY-EXISTING-PATHS-CORRECTION-BOUNDARY-V1.json';
const CURRENT='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json';
const S0_STATUS='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-DELIVERY-STATUS-V1.json';
const REPAIR=[WORKFLOW,VALIDATOR].sort();
const CORRECTION_FILES=[REG,CORRECTION,CORRECTION_BOUNDARY].sort();
const CANDIDATE_RECORD='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-AUTHORIZATION-CANDIDATE-V1.json';
const CANDIDATE_BOUNDARY='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-AUTHORIZATION-CANDIDATE-BOUNDARY-V1.json';
const CANDIDATE_FILES=['.github/workflows/mcft-cap-09-s0-authorization.yml',CURRENT,CANDIDATE_BOUNDARY,CANDIDATE_RECORD,S0_STATUS,'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S0_AUTHORIZATION.cjs'].sort();
const BOOTSTRAP=[WORKFLOW,REG,CURRENT,S0_STATUS,'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TRUSTED-REGISTRY-BOOTSTRAP-V1.json','docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TRUSTED-REGISTRY-BOUNDARY-V1.json',VALIDATOR].sort();
const rd=f=>fs.readFileSync(p.join(R,f),'utf8'),js=f=>JSON.parse(rd(f)),sh=(...a)=>x('git',a,{encoding:'utf8'}).trim();
const ok=(v,c)=>{if(!v)throw Error(c)},same=(a,b)=>{try{assert.deepEqual(a,b);return true}catch{return false}};
const write=v=>{fs.mkdirSync(p.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+'\n')};
const changed=base=>sh('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
const marker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
function cap(reg,id){return reg.capabilities.filter(v=>v.capability_line===id)}
function safe(files){for(const f of files){const t=rd(f);ok(!t.includes(marker),'CANDIDATE_DECLARATION:'+f);ok(!/^(apps|packages|migrations)\//.test(f),'RUNTIME_PATH:'+f)}}
function authorityFalse(entry){for(const k of ['implementation_authorized','runtime_source_authorized','canonical_write_authorized','live_ingestion_authorized','background_scheduler_authorized','public_http_writer_authorized','model_activation_authorized','controlled_action_authorized'])ok(entry[k]===false,'AUTH_'+k)}
function validateCorrectedCap09(entry){
 ok(entry.registry_bootstrap_kind==='S0_PRE_CANDIDATE_GOVERNANCE_THEN_TRUSTED_REGISTRY','BOOTSTRAP_KIND');
 ok(entry.registration_mode==='APPEND_STATUS_PATH_WHEN_FILE_EXISTS_ON_PROTECTED_MAIN','REGISTRATION_MODE');
 ok(entry.current_candidate_authority===false&&entry.candidate_declaration_enabled===true,'CANDIDATE_GATE');
 ok(same(entry.authoritative_candidate_status_paths,[CURRENT,S0_STATUS]),'EXISTING_STATUS_PATHS_ONLY');
 ok(entry.candidate_transition_fields.length===1,'TRANSITION_RULE_COUNT');
 const rule=entry.candidate_transition_fields[0];
 ok(rule.status_file===CURRENT&&rule.field_path==='status','S0_RULE_IDENTITY');
 ok(same(rule.allowed_candidate_values,['AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE']),'S0_RULE_VALUE');
 ok(rule.focused_workflow==='mcft-cap-09-s0-authorization'&&rule.standard_workflow==='ci','S0_RULE_WORKFLOW');
 ok(rule.predecessor_effective_evidence_required===true,'S0_RULE_PREDECESSOR');
 ok(same(entry.deferred_status_paths,['docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-DELIVERY-STATUS-V1.json','docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json','docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-DELIVERY-STATUS-V1.json','docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-DELIVERY-STATUS-V1.json','docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-DELIVERY-STATUS-V1.json','docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-DELIVERY-STATUS-V1.json']),'DEFERRED_PATHS');
 ok(entry.deferred_transition_registration_required===true,'DEFERRED_RULE');
 authorityFalse(entry);
}
function workflowRepair(base,head){
 ok(base===REPAIR_BASE,'REPAIR_BASE:'+base);
 const files=changed(base);ok(same(files,REPAIR),'REPAIR_BOUNDARY:'+JSON.stringify(files));safe(files);
 const w=rd(WORKFLOW);
 for(const token of ["mode='workflow-repair'","mode='registry-existing-paths-correction'","mode='candidate-signal'","mode='bootstrap'","mode='unsupported'","if: steps.lifecycle.outputs.mode == 'bootstrap'","--registry-existing-paths-correction","--candidate-signal"])ok(w.includes(token),'WORKFLOW_TOKEN:'+token);
 ok(!w.includes("if: steps.lifecycle.outputs.mode == 'registry-existing-paths-correction'\n        uses: actions/download-artifact"),'CORRECTION_DOWNLOADS_S0_ARTIFACT');
 ok(!w.includes("if: steps.lifecycle.outputs.mode == 'candidate-signal'\n        uses: actions/download-artifact"),'CANDIDATE_DOWNLOADS_S0_ARTIFACT');
 const result={status:'PASS',change_class:'MCFT_CAP_09_TRUSTED_REGISTRY_LIFECYCLE_REPAIR',base_sha:base,head_sha:head,changed_files:files,lifecycle_modes:['workflow-repair','registry-existing-paths-correction','candidate-signal','bootstrap','unsupported'],s0_artifact_download_mode:'bootstrap',candidate_signal_reexecutes_bootstrap:false,registry_delta:0,candidate_transition:false,implementation_authorized:false,runtime_source_delta:0,first_legal_next_action:'MCFT_CAP_09_TRUSTED_REGISTRY_EXISTING_PATHS_CORRECTION'};
 write(result);console.log(JSON.stringify(result,null,2));
}
function registryCorrection(base,head){
 const files=changed(base);ok(same(files,CORRECTION_FILES),'CORRECTION_BOUNDARY:'+JSON.stringify(files));safe(files);
 ok(sh('rev-parse',`${base}:${REG}`)===ORIGINAL_REGISTRY_BLOB,'BASE_REGISTRY_BLOB');
 const baseReg=JSON.parse(sh('show',`${base}:${REG}`)),reg=js(REG);
 ok(baseReg.authority_set_revision==='1.6'&&baseReg.authority_set_change_id==='MCFT-CAP-09.S0-TRUSTED-REGISTRY-BOOTSTRAP','BASE_REGISTRY_HEADER');
 ok(reg.registry_id==='MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1'&&reg.registry_revision==='1.1','REGISTRY_ID');
 ok(reg.authority_set_revision==='1.7'&&reg.authority_set_change_id==='MCFT-CAP-09.S0-EXISTING-STATUS-PATHS-CORRECTION','CORRECTED_HEADER');
 for(const id of ['MCFT-CAP-06','MCFT-CAP-07','MCFT-CAP-08'])ok(same(cap(baseReg,id)[0],cap(reg,id)[0]),'PREDECESSOR_ENTRY_DRIFT:'+id);
 ok(cap(baseReg,'MCFT-CAP-09').length===1&&cap(reg,'MCFT-CAP-09').length===1,'CAP09_CARDINALITY');
 validateCorrectedCap09(cap(reg,'MCFT-CAP-09')[0]);
 const rec=js(CORRECTION),bd=js(CORRECTION_BOUNDARY);
 ok(rec.record_status==='TRUSTED_REGISTRY_EXISTING_PATHS_CORRECTION_CANDIDATE_NOT_EFFECTIVE','CORRECTION_STATUS');
 ok(rec.base_main_sha===base&&rec.base_registry_blob_sha===ORIGINAL_REGISTRY_BLOB,'CORRECTION_BASE');
 ok(rec.removed_nonexistent_status_path_count===6&&rec.removed_nonexistent_transition_rule_count===6,'CORRECTION_COUNTS');
 ok(rec.global_applicability_resolver_delta===0&&rec.candidate_transition===false&&rec.runtime_source_delta===0,'CORRECTION_ZERO_DELTA');
 ok(rec.first_legal_next_action==='PROTECTED_MERGE_THEN_REBUILD_MCFT_CAP_09_S0_AUTHORIZATION_CANDIDATE','CORRECTION_NEXT');
 ok(bd.base_main_sha===base&&bd.changed_file_count===3&&same(bd.changed_files,CORRECTION_FILES),'BOUNDARY_RECORD');
 ok(bd.registry_delta===1&&bd.candidate_transition===false&&bd.runtime_source_delta===0&&bd.global_applicability_resolver_delta===0,'BOUNDARY_ZERO_DELTA');
 const result={status:'PASS',change_class:'MCFT_CAP_09_TRUSTED_REGISTRY_EXISTING_PATHS_CORRECTION',base_sha:base,head_sha:head,changed_files:files,authority_set_revision:'1.7',registered_existing_status_path_count:2,deferred_status_path_count:6,registered_transition_rule_count:1,global_applicability_resolver_delta:0,candidate_transition:false,implementation_authorized:false,runtime_source_delta:0,first_legal_next_action:'PROTECTED_MERGE_THEN_REBUILD_MCFT_CAP_09_S0_AUTHORIZATION_CANDIDATE'};
 write(result);console.log(JSON.stringify(result,null,2));
}
function candidateSignal(base,head){
 const files=changed(base);ok(same(files,CANDIDATE_FILES),'CANDIDATE_BOUNDARY:'+JSON.stringify(files));safe(files);
 const baseReg=JSON.parse(sh('show',`${base}:${REG}`)),reg=js(REG);
 ok(same(baseReg,reg),'CANDIDATE_REGISTRY_DRIFT');
 ok(sh('rev-parse',`${base}:${REG}`)===sh('rev-parse',`HEAD:${REG}`),'CANDIDATE_REGISTRY_BLOB_DRIFT');
 ok(cap(reg,'MCFT-CAP-09').length===1,'CANDIDATE_CAP09_CARDINALITY');
 validateCorrectedCap09(cap(reg,'MCFT-CAP-09')[0]);
 const cur=js(CURRENT),ds=js(S0_STATUS),rec=js(CANDIDATE_RECORD),bd=js(CANDIDATE_BOUNDARY);
 ok(cur.record_status==='S0_AUTHORIZATION_CANDIDATE'&&cur.status==='AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE','CANDIDATE_CURRENT_STATUS');
 ok(cur.candidate_head_binding_mode==='PR_DECLARATION_V2_AND_GITHUB_EVENT'&&cur.candidate_head_embedded===false&&!Object.hasOwn(cur,'candidate_head_sha'),'CANDIDATE_CURRENT_HEAD_BINDING');
 for(const k of ['implementation_authorized','runtime_source_authorized','live_ingestion_authorized','background_scheduler_authorized','canonical_write_authorized','public_http_writer_authorized','candidate_declaration_authorized','model_activation_authorized','controlled_action_authorized'])ok(cur[k]===false,'CANDIDATE_CURRENT_AUTH_'+k);
 ok(ds.status==='AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE'&&ds.s0_candidate_implemented===true&&ds.externally_effective===false,'CANDIDATE_STATUS');
 for(const k of ['runtime_source_delta','migration_delta','canonical_runtime_data_delta','database_acl_delta','registry_delta','taskbook_delta','navigation_ssot_delta'])ok(ds[k]===0,'CANDIDATE_STATUS_DELTA_'+k);
 for(const v of [rec,bd]){ok(v.candidate_head_binding_mode==='PR_DECLARATION_V2_AND_GITHUB_EVENT','CANDIDATE_HEAD_BINDING_MODE');ok(v.candidate_head_embedded===false,'CANDIDATE_HEAD_EMBEDDED');ok(!Object.hasOwn(v,'candidate_head_sha'),'CANDIDATE_SELF_REFERENCE')}
 ok(rec.candidate_transition_performed===true&&rec.external_effectiveness===false&&rec.registry_delta===0&&rec.runtime_source_delta===0,'CANDIDATE_RECORD');
 ok(bd.changed_file_count===6&&same(bd.changed_files,CANDIDATE_FILES)&&bd.candidate_transition===true&&bd.registry_delta===0&&bd.runtime_source_delta===0,'CANDIDATE_BOUNDARY_RECORD');
 const result={status:'PASS',change_class:'MCFT_CAP_09_TRUSTED_REGISTRY_CANDIDATE_SIGNAL_COMPATIBILITY',base_sha:base,head_sha:head,changed_files:files,registry_corrected_existing_paths_only:true,registry_blob_unchanged:true,bootstrap_reexecution:false,candidate_transition:true,external_effectiveness:false,implementation_authorized:false,runtime_source_delta:0,first_legal_next_action:'PROTECTED_MERGE_THEN_EXACT_SHA_R2_ATTESTATION'};
 write(result);console.log(JSON.stringify(result,null,2));
}
function bootstrap(base,head){
 ok(base===BOOTSTRAP_BASE,'BOOTSTRAP_BASE:'+base);
 const files=changed(base);ok(same(files,BOOTSTRAP),'BOOTSTRAP_BOUNDARY:'+JSON.stringify(files));safe(files);
 const reg=js(REG);ok(reg.authority_set_revision==='1.6','BOOTSTRAP_REVISION');ok(cap(reg,'MCFT-CAP-09').length===1,'BOOTSTRAP_CAP09');
 const result={status:'PASS',change_class:'MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP_HISTORICAL_COMPATIBILITY',base_sha:base,head_sha:head,changed_files:files,candidate_transition:false,implementation_authorized:false,runtime_source_delta:0};write(result);console.log(JSON.stringify(result,null,2));
}
const base=process.env.MCFT_BASE_SHA,head=sh('rev-parse','HEAD'),mode=process.argv[2]||'--bootstrap';
try{if(mode==='--workflow-repair')workflowRepair(base,head);else if(mode==='--registry-existing-paths-correction')registryCorrection(base,head);else if(mode==='--candidate-signal')candidateSignal(base,head);else if(mode==='--bootstrap')bootstrap(base,head);else throw Error('UNKNOWN_MODE:'+mode)}catch(e){const result={status:'FAIL',base_sha:base||null,head_sha:head,error:e.message};write(result);console.error(JSON.stringify(result,null,2));process.exitCode=1}
