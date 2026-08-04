#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),p=require('node:path'),{execFileSync:x}=require('node:child_process');
const R=process.cwd(),O=p.join(R,'acceptance-output/MCFT_CAP_09_S0_PRE_CANDIDATE_GOVERNANCE_RESULT.json');
const BASE='4784aeed9cfe6183f8acef4dd03cea939d24e6ef',S='67bd71560268046a7fa9a9433ee074ad3999cb71',RUN=30908130962,ART=8891897316;
const EXPECT=[".github/workflows/mcft-cap-09-s0-pre-candidate-governance.yml", "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json", "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PREDECESSOR-LOCK-V1.json", "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-CHANGED-FILE-BOUNDARY-V1.json", "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-DELIVERY-STATUS-V1.json", "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json", "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md", "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S0_PRE_CANDIDATE_GOVERNANCE.cjs"];
const rd=f=>fs.readFileSync(p.join(R,f),'utf8'),js=f=>JSON.parse(rd(f)),ok=(v,c)=>{if(!v)throw Error(c)},eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sh=(...a)=>x('git',a,{encoding:'utf8'}).trim(),wr=v=>{fs.mkdirSync(p.dirname(O),{recursive:true});fs.writeFileSync(O,JSON.stringify(v,null,2)+'\n')};
const marker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
function artifact(n){const b=p.resolve(process.env.MCFT_CAP08_ARTIFACT_DIR||'acceptance-input/cap08-exact-sha'),q=[b];while(q.length){const d=q.pop();if(!fs.existsSync(d))continue;for(const e of fs.readdirSync(d,{withFileTypes:true})){const z=p.join(d,e.name);if(e.isDirectory())q.push(z);else if(e.name===n)return z}}throw Error('ARTIFACT_MISSING:'+n)}
async function api(u){const t=process.env.GITHUB_TOKEN;ok(t,'TOKEN_REQUIRED');const r=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${u}`,{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${t}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'cap09-s0'}}),b=await r.text();ok(r.ok,`API_${r.status}:${u}:${b.slice(0,160)}`);return b?JSON.parse(b):null}
(async()=>{const base=process.env.MCFT_BASE_SHA,head=sh('rev-parse','HEAD');try{
ok(base===BASE,'BASE_SHA:'+base);
const ch=sh('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
ok(eq(ch,EXPECT),'BOUNDARY:'+JSON.stringify(ch));
for(const f of ch){const z=rd(f);ok(!z.includes(marker),'CANDIDATE_DECLARATION:'+f);ok(!/^(apps|packages|migrations)\//.test(f),'RUNTIME_SOURCE:'+f)}
const a=JSON.parse(fs.readFileSync(artifact('MCFT_CAP_08_S6_EXACT_SHA_ATTESTATION.json')));
const l=JSON.parse(fs.readFileSync(artifact('MCFT_CAP_08_S6_ATTESTATION_RETENTION_LOCATOR.json')));
ok(a.status==='PASS'&&a.subject_sha===S&&a.capability_complete===true,'CAP08_ATTEST');
ok(a.completion_level==='STAGE_1A_REPLAY_BACKED_CLOSURE_COMPLETE','CAP08_LEVEL');
ok(a.hard_acceptance_resolution?.effective_resolved_item_count===24&&a.hard_acceptance_resolution?.failed_item_count===0,'CAP08_HA');
ok(l.retention_level==='R2'&&l.readback_verified===true&&l.locked_version_delete_denied===true&&l.retain_until==='2028-08-03T12:13:37.980Z','CAP08_R2');
const run=await api(`/actions/runs/${RUN}`);ok(run.head_sha===S&&run.run_attempt===1&&run.status==='completed'&&run.conclusion==='success','RUN');
const ar=(await api(`/actions/runs/${RUN}/artifacts?per_page=100`)).artifacts.find(v=>v.id===ART);ok(ar&&!ar.expired&&ar.digest==='sha256:ceb2dc797d6a9a3c54a6476435f9b1cc5f7dd0f08993af3d8ced424c65afe497','ARTIFACT');
const st=(await api(`/commits/${S}/status`)).statuses.find(v=>v.context==='mcft-cap-08/s6-exact-sha-attestation');ok(st?.state==='success','STATUS');
const scope=js('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json');
const lock=js('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PREDECESSOR-LOCK-V1.json');
const cur=js('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json');
const ds=js('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-DELIVERY-STATUS-V1.json');
const b=js('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-CHANGED-FILE-BOUNDARY-V1.json');
const t=rd('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md');
const taskbookText=t.replace(/\s+/g,' ');
ok(scope.formal_closure.slot_count===24&&scope.formal_closure.slot_ids[0]==='O00'&&scope.formal_closure.slot_ids[23]==='O23','SLOTS');
ok(scope.formal_closure.clock_source==='SCHEDULER_PROVIDED_UTC_WALL_CLOCK'&&scope.formal_closure.accelerated_clock_allowed===false,'CLOCK');
ok(scope.shared_core_immutable.includes('resolve_E_H_A_B_G_C_barrier_order'),'CORE');
ok(lock.subject_sha===S&&lock.github_artifact_id===ART&&lock.semantic_artifact_digest==='sha256:7e9d713631443641f17c06f71c494319c5f442424ba9ec9f426731940d2700f9','LOCK');
ok(lock.retention_level==='R2'&&lock.authorizes_cap09_implementation===false&&lock.authorizes_candidate_declaration===false,'LOCK_BOUNDARY');
for(const v of [cur,ds]){ok(v.implementation_authorized===false&&v.runtime_source_authorized===false&&v.candidate_declaration_authorized===false,'AUTH');}
ok(cur.status==='PRE_CANDIDATE_GOVERNANCE_FOUNDATION'&&cur.registry_rule_present===false,'CURRENT');
ok(ds.s0_candidate_implemented===false&&ds.registry_rule_present===false&&ds.runtime_source_delta===0,'STATUS_SEED');
ok(eq(b.changed_files,EXPECT)&&b.changed_file_count===8&&b.registry_delta===0&&b.navigation_ssot_delta===0,'BOUNDARY_FILE');
for(const token of ['STAGE_1B_SHADOW_ONLINE_CLOSURE','24 actual hourly UTC scheduler boundaries','PersistentSequentialSchedulerAdapter','NO_CAP09_IMPLEMENTATION_AUTHORITY','MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP'])ok(taskbookText.includes(token),'TASKBOOK:'+token);
const r={status:'PASS',change_class:'MCFT_CAP_09_S0_PRE_CANDIDATE_GOVERNANCE_FOUNDATION',base_sha:base,head_sha:head,changed_files:ch,predecessor_subject_sha:S,predecessor_workflow_run_id:RUN,predecessor_artifact_id:ART,predecessor_semantic_digest:a.semantic_artifact_digest,retention_level:l.retention_level,retain_until:l.retain_until,taskbook_present:true,machine_scope_contract_present:true,status_seed_present:true,registry_rule_present:false,implementation_authorized:false,runtime_source_delta:0,canonical_runtime_data_delta:0,database_acl_delta:0,candidate_declaration:false,first_legal_next_action:'MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP'};
wr(r);console.log(JSON.stringify(r,null,2));
}catch(e){const r={status:'FAIL',base_sha:base||null,head_sha:head,error:e.message};wr(r);console.error(JSON.stringify(r,null,2));process.exitCode=1}})();
