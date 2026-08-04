#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),p=require('node:path'),{execFileSync:x}=require('node:child_process'),assert=require('node:assert/strict');
const R=process.cwd(),O=p.join(R,'acceptance-output/MCFT_CAP_09_S0_PRE_CANDIDATE_GOVERNANCE_RESULT.json');
const FOUNDATION_BASE='4784aeed9cfe6183f8acef4dd03cea939d24e6ef';
const REPAIR_BASES=new Set(['abadd19b2bd7460b397acbac6181253732b49fae','fa26f024a1847f49545d18bcda3ecd0b9d81bf06','f238d9f0a6e1c361e31e5952b8c037b292c59554']);
const S='67bd71560268046a7fa9a9433ee074ad3999cb71',RUN=30908130962,ART=8891897316;
const WORKFLOW='.github/workflows/mcft-cap-09-s0-pre-candidate-governance.yml';
const VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S0_PRE_CANDIDATE_GOVERNANCE.cjs';
const CURRENT='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json';
const STATUS='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-DELIVERY-STATUS-V1.json';
const TASK='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md';
const SCOPE='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json';
const LOCK='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PREDECESSOR-LOCK-V1.json';
const REGISTRY_PATH='docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json';
const FOUNDATION=[WORKFLOW,CURRENT,LOCK,'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-CHANGED-FILE-BOUNDARY-V1.json',STATUS,SCOPE,TASK,VALIDATOR].sort();
const REGISTRY=['.github/workflows/mcft-cap-09-trusted-registry-bootstrap.yml',REGISTRY_PATH,CURRENT,STATUS,'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TRUSTED-REGISTRY-BOOTSTRAP-V1.json','docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TRUSTED-REGISTRY-BOUNDARY-V1.json','scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP.cjs'].sort();
const REPAIR=[WORKFLOW,VALIDATOR].sort();
const CANDIDATE=['.github/workflows/mcft-cap-09-s0-authorization.yml',CURRENT,'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-AUTHORIZATION-CANDIDATE-BOUNDARY-V1.json','docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-AUTHORIZATION-CANDIDATE-V1.json',STATUS,'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S0_AUTHORIZATION.cjs'].sort();
const rd=f=>fs.readFileSync(p.join(R,f),'utf8'),js=f=>JSON.parse(rd(f)),sh=(...a)=>x('git',a,{encoding:'utf8'}).trim();
const ok=(v,c)=>{if(!v)throw Error(c)},same=(a,b)=>{try{assert.deepEqual(a,b);return true}catch{return false}};
const write=v=>{fs.mkdirSync(p.dirname(O),{recursive:true});fs.writeFileSync(O,JSON.stringify(v,null,2)+'\n')};
const marker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
const changed=base=>sh('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
const safeFiles=files=>{for(const f of files){const z=rd(f);ok(!z.includes(marker),'CANDIDATE_DECLARATION_IN_REPOSITORY:'+f);ok(!/^(apps|packages|migrations)\//.test(f),'RUNTIME_SOURCE:'+f)}};
const unchanged=(base,files)=>{for(const f of files)ok(sh('diff','--quiet',`${base}...HEAD`,'--',f)==='',`FROZEN_FILE_DRIFT:${f}`)};
function artifact(n){const b=p.resolve(process.env.MCFT_CAP08_ARTIFACT_DIR||'acceptance-input/cap08-exact-sha'),q=[b];while(q.length){const d=q.pop();if(!fs.existsSync(d))continue;for(const e of fs.readdirSync(d,{withFileTypes:true})){const z=p.join(d,e.name);if(e.isDirectory())q.push(z);else if(e.name===n)return z}}throw Error('ARTIFACT_MISSING:'+n)}
async function api(u){const t=process.env.GITHUB_TOKEN;ok(t,'TOKEN_REQUIRED');const r=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${u}`,{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${t}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'cap09-s0'}}),b=await r.text();ok(r.ok,`API_${r.status}:${u}:${b.slice(0,160)}`);return b?JSON.parse(b):null}
function workflowRepair(base,head){
 ok(REPAIR_BASES.has(base),'REPAIR_BASE:'+base);
 const files=changed(base);ok(same(files,REPAIR),'REPAIR_BOUNDARY:'+JSON.stringify(files));safeFiles(files);
 const w=rd(WORKFLOW);
 for(const token of ["mode='workflow-repair'","mode='registry-bootstrap'","mode='candidate-signal'","mode='s0-foundation'","mode='unsupported'","PR_DECLARATION_V2_AND_GITHUB_EVENT","if: steps.lifecycle.outputs.mode == 's0-foundation'","--candidate-signal"])ok(w.includes(token),'WORKFLOW_TOKEN:'+token);
 ok(!w.includes("if: steps.lifecycle.outputs.mode == 'candidate-signal'\n        uses: actions/download-artifact"),'CANDIDATE_ARTIFACT_DOWNLOAD');
 const result={status:'PASS',change_class:base==='f238d9f0a6e1c361e31e5952b8c037b292c59554'?'MCFT_CAP_09_S0_NON_SELF_REFERENTIAL_CANDIDATE_BINDING_REPAIR':'MCFT_CAP_09_S0_WORKFLOW_LIFECYCLE_REPAIR',base_sha:base,head_sha:head,changed_files:files,lifecycle_modes:['workflow-repair','registry-bootstrap','candidate-signal','s0-foundation','unsupported'],candidate_head_binding_mode:'PR_DECLARATION_V2_AND_GITHUB_EVENT',candidate_head_embedded_in_candidate_blob:false,cap08_artifact_download_mode:'s0-foundation',candidate_signal_reexecutes_foundation:false,implementation_authorized:false,runtime_source_delta:0,candidate_declaration:false,first_legal_next_action:'MCFT_CAP_09_S0_AUTHORIZATION_CANDIDATE'};
 write(result);console.log(JSON.stringify(result,null,2));
}
function registryBootstrap(base,head){
 const files=changed(base);ok(same(files,REGISTRY),'REGISTRY_BOUNDARY:'+JSON.stringify(files));safeFiles(files);unchanged(base,[TASK,SCOPE,LOCK]);
 const cur=js(CURRENT),ds=js(STATUS),reg=js(REGISTRY_PATH),entry=reg.capabilities.find(v=>v.capability_line==='MCFT-CAP-09');
 ok(cur.status==='PRE_CANDIDATE_GOVERNANCE_FOUNDATION'&&ds.status==='PRE_CANDIDATE_GOVERNANCE_FOUNDATION','STATUS_DRIFT');
 ok(cur.registry_rule_present===true&&ds.registry_rule_present===true,'REGISTRY_FLAG');
 ok(entry&&entry.current_candidate_authority===false&&entry.candidate_declaration_enabled===true,'REGISTRY_ENTRY');
 for(const v of [cur,ds,entry])for(const k of ['implementation_authorized','runtime_source_authorized'])ok(v[k]===false,'AUTH_'+k);
 const result={status:'PASS',change_class:'MCFT_CAP_09_S0_SUCCESSOR_REGISTRY_BOOTSTRAP_LIFECYCLE',base_sha:base,head_sha:head,changed_files:files,foundation_reexecution:false,candidate_transition:false,implementation_authorized:false,runtime_source_delta:0,first_legal_next_action:'MCFT_CAP_09_S0_AUTHORIZATION_CANDIDATE'};write(result);console.log(JSON.stringify(result,null,2));
}
function candidateSignal(base,head){
 const files=changed(base);ok(same(files,CANDIDATE),'CANDIDATE_BOUNDARY:'+JSON.stringify(files));safeFiles(files);unchanged(base,[TASK,SCOPE,LOCK,REGISTRY_PATH]);
 const cur=js(CURRENT),ds=js(STATUS),rec=js('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-AUTHORIZATION-CANDIDATE-V1.json'),b=js('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-AUTHORIZATION-CANDIDATE-BOUNDARY-V1.json');
 ok(cur.record_status==='S0_AUTHORIZATION_CANDIDATE'&&cur.status==='AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE','CURRENT_CANDIDATE_STATUS');
 ok(cur.registry_rule_present===true&&cur.effectiveness_condition==='PRESENT_ON_PROTECTED_MAIN_AND_EXACT_SHA_R2_ATTESTATION_PASS'&&cur.effective_status_when_attested==='IN_PROGRESS'&&cur.effective_next_slice_when_attested==='S1','CURRENT_EFFECTIVENESS');
 for(const k of ['implementation_authorized','runtime_source_authorized','live_ingestion_authorized','background_scheduler_authorized','canonical_write_authorized','public_http_writer_authorized','model_activation_authorized','controlled_action_authorized'])ok(cur[k]===false,'CURRENT_AUTH_'+k);
 ok(ds.status==='AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE'&&ds.s0_candidate_implemented===true&&ds.externally_effective===false&&ds.candidate_declaration_present===true,'DELIVERY_CANDIDATE');
 ok(ds.implementation_authorized===false&&ds.runtime_source_authorized===false&&ds.runtime_source_delta===0&&ds.canonical_runtime_data_delta===0&&ds.database_acl_delta===0&&ds.registry_delta===0,'DELIVERY_BOUNDARY');
 for(const v of [rec,b]){ok(v.base_main_sha===base,'BASE_BINDING');ok(v.candidate_head_binding_mode==='PR_DECLARATION_V2_AND_GITHUB_EVENT','HEAD_BINDING_MODE');ok(v.candidate_head_embedded===false,'HEAD_EMBEDDED');ok(!Object.hasOwn(v,'candidate_head_sha'),'SELF_REFERENTIAL_HEAD_FIELD')}
 ok(rec.record_status==='S0_AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE'&&rec.candidate_transition_performed===true&&rec.external_effectiveness===false,'CANDIDATE_RECORD');
 for(const k of ['runtime_source_delta','migration_delta','registry_delta','taskbook_delta','canonical_runtime_data_delta','database_acl_delta'])ok(rec[k]===0,'CANDIDATE_ZERO_'+k);
 ok(b.changed_file_count===6&&same(b.changed_files,CANDIDATE)&&b.candidate_transition===true&&b.runtime_source_delta===0&&b.registry_delta===0,'CANDIDATE_BOUNDARY_RECORD');
 const result={status:'PASS',change_class:'MCFT_CAP_09_S0_AUTHORIZATION_CANDIDATE_SIGNAL',base_sha:base,head_sha:head,changed_files:files,foundation_reexecution:false,registry_rewrite:false,candidate_transition:true,candidate_head_binding_mode:'PR_DECLARATION_V2_AND_GITHUB_EVENT',candidate_head_embedded_in_candidate_blob:false,candidate_declaration_expected_in_pr_body:true,implementation_authorized:false,runtime_source_delta:0,external_effectiveness:false,first_legal_next_action:'PROTECTED_MERGE_THEN_EXACT_SHA_R2_ATTESTATION'};write(result);console.log(JSON.stringify(result,null,2));
}
async function foundation(base,head){
 ok(base===FOUNDATION_BASE,'FOUNDATION_BASE:'+base);const files=changed(base);ok(same(files,FOUNDATION),'FOUNDATION_BOUNDARY:'+JSON.stringify(files));safeFiles(files);
 const a=JSON.parse(fs.readFileSync(artifact('MCFT_CAP_08_S6_EXACT_SHA_ATTESTATION.json'))),l=JSON.parse(fs.readFileSync(artifact('MCFT_CAP_08_S6_ATTESTATION_RETENTION_LOCATOR.json')));
 ok(a.status==='PASS'&&a.subject_sha===S&&a.capability_complete===true&&a.hard_acceptance_resolution?.effective_resolved_item_count===24,'CAP08_ATTEST');ok(l.retention_level==='R2'&&l.readback_verified===true&&l.locked_version_delete_denied===true,'CAP08_R2');
 const run=await api(`/actions/runs/${RUN}`);ok(run.head_sha===S&&run.run_attempt===1&&run.conclusion==='success','RUN');const ar=(await api(`/actions/runs/${RUN}/artifacts?per_page=100`)).artifacts.find(v=>v.id===ART);ok(ar&&!ar.expired,'ARTIFACT');
 const cur=js(CURRENT),ds=js(STATUS),scope=js(SCOPE),lock=js(LOCK);ok(cur.status==='PRE_CANDIDATE_GOVERNANCE_FOUNDATION'&&ds.s0_candidate_implemented===false,'FOUNDATION_STATUS');ok(scope.formal_closure.slot_count===24&&lock.subject_sha===S,'FOUNDATION_SCOPE');
 const result={status:'PASS',change_class:'MCFT_CAP_09_S0_PRE_CANDIDATE_GOVERNANCE_FOUNDATION',base_sha:base,head_sha:head,changed_files:files,predecessor_subject_sha:S,retention_level:'R2',implementation_authorized:false,runtime_source_delta:0,candidate_declaration:false,first_legal_next_action:'MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP'};write(result);console.log(JSON.stringify(result,null,2));
}
(async()=>{const base=process.env.MCFT_BASE_SHA,head=sh('rev-parse','HEAD'),arg=process.argv[2];try{if(arg==='--workflow-repair')workflowRepair(base,head);else if(arg==='--registry-bootstrap')registryBootstrap(base,head);else if(arg==='--candidate-signal')candidateSignal(base,head);else await foundation(base,head)}catch(e){const result={status:'FAIL',base_sha:base||null,head_sha:head,error:e.message};write(result);console.error(JSON.stringify(result,null,2));process.exitCode=1}})();
