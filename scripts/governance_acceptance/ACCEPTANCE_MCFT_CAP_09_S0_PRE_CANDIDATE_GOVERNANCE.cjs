#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),p=require('node:path'),{execFileSync:x}=require('node:child_process'),assert=require('node:assert/strict');
const R=process.cwd(),O=p.join(R,'acceptance-output/MCFT_CAP_09_S0_PRE_CANDIDATE_GOVERNANCE_RESULT.json');
const FOUNDATION_BASE='4784aeed9cfe6183f8acef4dd03cea939d24e6ef';
const REPAIR_BASE='abadd19b2bd7460b397acbac6181253732b49fae';
const S='67bd71560268046a7fa9a9433ee074ad3999cb71',RUN=30908130962,ART=8891897316;
const WORKFLOW='.github/workflows/mcft-cap-09-s0-pre-candidate-governance.yml';
const VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S0_PRE_CANDIDATE_GOVERNANCE.cjs';
const CURRENT='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json';
const STATUS='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-DELIVERY-STATUS-V1.json';
const FOUNDATION=[WORKFLOW,CURRENT,'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PREDECESSOR-LOCK-V1.json','docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-CHANGED-FILE-BOUNDARY-V1.json',STATUS,'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json','docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md',VALIDATOR].sort();
const REGISTRY=['.github/workflows/mcft-cap-09-trusted-registry-bootstrap.yml','docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',CURRENT,STATUS,'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TRUSTED-REGISTRY-BOOTSTRAP-V1.json','docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TRUSTED-REGISTRY-BOUNDARY-V1.json','scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP.cjs'].sort();
const REPAIR=[WORKFLOW,VALIDATOR].sort();
const rd=f=>fs.readFileSync(p.join(R,f),'utf8'),js=f=>JSON.parse(rd(f)),sh=(...a)=>x('git',a,{encoding:'utf8'}).trim();
const ok=(v,c)=>{if(!v)throw Error(c)},same=(a,b)=>{try{assert.deepEqual(a,b);return true}catch{return false}};
const write=v=>{fs.mkdirSync(p.dirname(O),{recursive:true});fs.writeFileSync(O,JSON.stringify(v,null,2)+'\n')};
const marker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
const changed=base=>sh('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
const safeFiles=files=>{for(const f of files){const z=rd(f);ok(!z.includes(marker),'CANDIDATE_DECLARATION:'+f);ok(!/^(apps|packages|migrations)\//.test(f),'RUNTIME_SOURCE:'+f)}};
function artifact(n){const b=p.resolve(process.env.MCFT_CAP08_ARTIFACT_DIR||'acceptance-input/cap08-exact-sha'),q=[b];while(q.length){const d=q.pop();if(!fs.existsSync(d))continue;for(const e of fs.readdirSync(d,{withFileTypes:true})){const z=p.join(d,e.name);if(e.isDirectory())q.push(z);else if(e.name===n)return z}}throw Error('ARTIFACT_MISSING:'+n)}
async function api(u){const t=process.env.GITHUB_TOKEN;ok(t,'TOKEN_REQUIRED');const r=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${u}`,{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${t}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'cap09-s0'}}),b=await r.text();ok(r.ok,`API_${r.status}:${u}:${b.slice(0,160)}`);return b?JSON.parse(b):null}
function workflowRepair(base,head){
 ok(base===REPAIR_BASE,'REPAIR_BASE:'+base);
 const files=changed(base);ok(same(files,REPAIR),'REPAIR_BOUNDARY:'+JSON.stringify(files));safeFiles(files);
 const w=rd(WORKFLOW);
 for(const token of ["mode='workflow-repair'","mode='registry-bootstrap'","mode='s0-foundation'","mode='unsupported'","if: steps.lifecycle.outputs.mode == 's0-foundation'","--workflow-repair","--registry-bootstrap"])ok(w.includes(token),'WORKFLOW_TOKEN:'+token);
 ok(!w.includes("if: steps.lifecycle.outputs.mode == 'registry-bootstrap'\n        uses: actions/download-artifact"),'REGISTRY_DOWNLOAD');
 const result={status:'PASS',change_class:'MCFT_CAP_09_S0_WORKFLOW_LIFECYCLE_REPAIR',base_sha:base,head_sha:head,changed_files:files,lifecycle_modes:['workflow-repair','registry-bootstrap','s0-foundation','unsupported'],cap08_artifact_download_mode:'s0-foundation',registry_bootstrap_reexecutes_foundation:false,implementation_authorized:false,runtime_source_delta:0,candidate_declaration:false,first_legal_next_action:'REBUILD_MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP'};
 write(result);console.log(JSON.stringify(result,null,2));
}
function registryBootstrap(base,head){
 const files=changed(base);ok(same(files,REGISTRY),'REGISTRY_BOUNDARY:'+JSON.stringify(files));safeFiles(files);
 for(const f of ['docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md','docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json','docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PREDECESSOR-LOCK-V1.json'])ok(sh('diff','--quiet',`${base}...HEAD`,'--',f)==='',`FOUNDATION_DRIFT:${f}`);
 const cur=js(CURRENT),ds=js(STATUS),reg=js('docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json');
 ok(cur.status==='PRE_CANDIDATE_GOVERNANCE_FOUNDATION'&&ds.status==='PRE_CANDIDATE_GOVERNANCE_FOUNDATION','STATUS_DRIFT');
 for(const v of [cur,ds]){ok(v.registry_rule_present===true,'REGISTRY_FLAG');ok(v.implementation_authorized===false&&v.runtime_source_authorized===false&&v.candidate_declaration_authorized===false,'AUTH_BOUNDARY');ok(v.first_legal_next_action==='MCFT_CAP_09_S0_AUTHORIZATION_CANDIDATE','NEXT_ACTION')}
 ok(ds.s0_candidate_implemented===false&&ds.candidate_declaration_present===false&&ds.runtime_source_delta===0&&ds.canonical_runtime_data_delta===0&&ds.database_acl_delta===0,'DELIVERY_BOUNDARY');
 const entries=reg.capabilities.filter(v=>v.capability_line==='MCFT-CAP-09');ok(entries.length===1,'REGISTRY_CARDINALITY');
 const entry=entries[0];ok(entry.current_candidate_authority===false&&entry.candidate_declaration_enabled===true,'REGISTRY_CANDIDATE_GATE');
 for(const k of ['implementation_authorized','runtime_source_authorized','canonical_write_authorized','live_ingestion_authorized','background_scheduler_authorized','public_http_writer_authorized','model_activation_authorized','controlled_action_authorized'])ok(entry[k]===false,'REGISTRY_AUTH_'+k);
 const rec=js('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TRUSTED-REGISTRY-BOOTSTRAP-V1.json');ok(rec.candidate_transition_performed===false&&rec.candidate_declaration_present===false&&rec.same_pr_modified_registry_may_authorize_candidate===false,'BOOTSTRAP_BOUNDARY');
 const b=js('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TRUSTED-REGISTRY-BOUNDARY-V1.json');ok(b.changed_file_count===7&&same(b.changed_files,REGISTRY)&&b.candidate_transition===false&&b.runtime_source_delta===0,'BOUNDARY_FILE');
 const result={status:'PASS',change_class:'MCFT_CAP_09_S0_SUCCESSOR_REGISTRY_BOOTSTRAP_LIFECYCLE',base_sha:base,head_sha:head,changed_files:files,foundation_reexecution:false,registry_rule_present:true,current_candidate_authority:false,candidate_transition:false,candidate_declaration:false,implementation_authorized:false,runtime_source_delta:0,canonical_runtime_data_delta:0,database_acl_delta:0,first_legal_next_action:'MCFT_CAP_09_S0_AUTHORIZATION_CANDIDATE'};
 write(result);console.log(JSON.stringify(result,null,2));
}
async function foundation(base,head){
 ok(base===FOUNDATION_BASE,'FOUNDATION_BASE:'+base);
 const files=changed(base);ok(same(files,FOUNDATION),'FOUNDATION_BOUNDARY:'+JSON.stringify(files));safeFiles(files);
 const a=JSON.parse(fs.readFileSync(artifact('MCFT_CAP_08_S6_EXACT_SHA_ATTESTATION.json'))),l=JSON.parse(fs.readFileSync(artifact('MCFT_CAP_08_S6_ATTESTATION_RETENTION_LOCATOR.json')));
 ok(a.status==='PASS'&&a.subject_sha===S&&a.capability_complete===true,'CAP08_ATTEST');ok(a.completion_level==='STAGE_1A_REPLAY_BACKED_CLOSURE_COMPLETE','CAP08_LEVEL');ok(a.hard_acceptance_resolution?.effective_resolved_item_count===24&&a.hard_acceptance_resolution?.failed_item_count===0,'CAP08_HA');ok(l.retention_level==='R2'&&l.readback_verified===true&&l.locked_version_delete_denied===true&&l.retain_until==='2028-08-03T12:13:37.980Z','CAP08_R2');
 const run=await api(`/actions/runs/${RUN}`);ok(run.head_sha===S&&run.run_attempt===1&&run.status==='completed'&&run.conclusion==='success','RUN');const ar=(await api(`/actions/runs/${RUN}/artifacts?per_page=100`)).artifacts.find(v=>v.id===ART);ok(ar&&!ar.expired&&ar.digest==='sha256:ceb2dc797d6a9a3c54a6476435f9b1cc5f7dd0f08993af3d8ced424c65afe497','ARTIFACT');const st=(await api(`/commits/${S}/status`)).statuses.find(v=>v.context==='mcft-cap-08/s6-exact-sha-attestation');ok(st?.state==='success','STATUS');
 const scope=js('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json'),lock=js('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PREDECESSOR-LOCK-V1.json'),cur=js(CURRENT),ds=js(STATUS),b=js('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-CHANGED-FILE-BOUNDARY-V1.json'),taskbookText=rd('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md').replace(/\s+/g,' ');
 ok(scope.formal_closure.slot_count===24&&scope.formal_closure.slot_ids[0]==='O00'&&scope.formal_closure.slot_ids[23]==='O23','SLOTS');ok(scope.formal_closure.clock_source==='SCHEDULER_PROVIDED_UTC_WALL_CLOCK'&&scope.formal_closure.accelerated_clock_allowed===false,'CLOCK');ok(scope.shared_core_immutable.includes('resolve_E_H_A_B_G_C_barrier_order'),'CORE');ok(lock.subject_sha===S&&lock.github_artifact_id===ART&&lock.semantic_artifact_digest==='sha256:7e9d713631443641f17c06f71c494319c5f442424ba9ec9f426731940d2700f9','LOCK');ok(lock.retention_level==='R2'&&lock.authorizes_cap09_implementation===false&&lock.authorizes_candidate_declaration===false,'LOCK_BOUNDARY');
 for(const v of [cur,ds])ok(v.implementation_authorized===false&&v.runtime_source_authorized===false&&v.candidate_declaration_authorized===false,'AUTH');ok(cur.status==='PRE_CANDIDATE_GOVERNANCE_FOUNDATION'&&cur.registry_rule_present===false,'CURRENT');ok(cur.first_legal_next_action==='MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP'&&ds.first_legal_next_action==='MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP','NEXT_ACTION');ok(ds.s0_candidate_implemented===false&&ds.registry_rule_present===false&&ds.runtime_source_delta===0,'STATUS_SEED');ok(same(b.changed_files,FOUNDATION)&&b.changed_file_count===8&&b.registry_delta===0&&b.navigation_ssot_delta===0,'BOUNDARY_FILE');for(const token of ['STAGE_1B_SHADOW_ONLINE_CLOSURE','24 actual hourly UTC scheduler boundaries','PersistentSequentialSchedulerAdapter','NO_CAP09_IMPLEMENTATION_AUTHORITY'])ok(taskbookText.includes(token),'TASKBOOK:'+token);
 const result={status:'PASS',change_class:'MCFT_CAP_09_S0_PRE_CANDIDATE_GOVERNANCE_FOUNDATION',base_sha:base,head_sha:head,changed_files:files,predecessor_subject_sha:S,predecessor_workflow_run_id:RUN,predecessor_artifact_id:ART,predecessor_semantic_digest:a.semantic_artifact_digest,retention_level:l.retention_level,retain_until:l.retain_until,taskbook_present:true,machine_scope_contract_present:true,status_seed_present:true,registry_rule_present:false,implementation_authorized:false,runtime_source_delta:0,canonical_runtime_data_delta:0,database_acl_delta:0,candidate_declaration:false,first_legal_next_action:'MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP'};
 write(result);console.log(JSON.stringify(result,null,2));
}
(async()=>{const base=process.env.MCFT_BASE_SHA,head=sh('rev-parse','HEAD'),arg=process.argv[2];try{if(arg==='--workflow-repair')workflowRepair(base,head);else if(arg==='--registry-bootstrap')registryBootstrap(base,head);else await foundation(base,head)}catch(e){const result={status:'FAIL',base_sha:base||null,head_sha:head,error:e.message};write(result);console.error(JSON.stringify(result,null,2));process.exitCode=1}})();
