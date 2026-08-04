#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),p=require('node:path'),{execFileSync:x}=require('node:child_process'),assert=require('node:assert/strict');
const R=process.cwd(),OUT=p.join(R,'acceptance-output/MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP_RESULT.json');
const BASE='abadd19b2bd7460b397acbac6181253732b49fae',S0_HEAD='8a01b0a8a9d5ceeb9082200cf32712e1480160c0',S0_TREE='04c46d73ce0fcb2b833bf2c8abb22c935e29e9c4',S0_RUN=30920841465,S0_ART=8896997027;
const REG='docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json';
const EXPECT=[
'.github/workflows/mcft-cap-09-trusted-registry-bootstrap.yml',
REG,
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-DELIVERY-STATUS-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TRUSTED-REGISTRY-BOOTSTRAP-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TRUSTED-REGISTRY-BOUNDARY-V1.json',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP.cjs'
];
const rd=f=>fs.readFileSync(p.join(R,f),'utf8'),js=f=>JSON.parse(rd(f)),sh=(...a)=>x('git',a,{encoding:'utf8'}).trim();
const ok=(v,c)=>{if(!v)throw Error(c)},same=(a,b)=>{try{assert.deepEqual(a,b);return true}catch{return false}};
const write=v=>{fs.mkdirSync(p.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+'\n')};
const marker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
function artifact(name){const root=p.resolve(process.env.MCFT_CAP09_S0_ARTIFACT_DIR||'acceptance-input/cap09-s0'),q=[root];while(q.length){const d=q.pop();if(!fs.existsSync(d))continue;for(const e of fs.readdirSync(d,{withFileTypes:true})){const z=p.join(d,e.name);if(e.isDirectory())q.push(z);else if(e.name===name)return z}}throw Error('ARTIFACT_MISSING:'+name)}
async function api(path){const t=process.env.GITHUB_TOKEN;ok(t,'TOKEN_REQUIRED');const r=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${path}`,{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${t}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'cap09-registry'}}),b=await r.text();ok(r.ok,`API_${r.status}:${path}:${b.slice(0,180)}`);return b?JSON.parse(b):null}
function cap(reg,id){return reg.capabilities.filter(v=>v.capability_line===id)}
function validateCap09(entry){
 ok(entry.registry_bootstrap_kind==='S0_PRE_CANDIDATE_GOVERNANCE_THEN_TRUSTED_REGISTRY','BOOTSTRAP_KIND');
 ok(entry.current_candidate_authority===false&&entry.candidate_declaration_enabled===true,'CANDIDATE_GATE');
 ok(entry.candidate_authority_scope==='S0_AUTHORIZATION_THROUGH_S6_FINAL_SHADOW_ONLINE_CLOSURE','SCOPE');
 const paths=entry.authoritative_candidate_status_paths;
 ok(paths.length===8&&new Set(paths).size===8,'STATUS_PATHS');
 ok(paths[0]==='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json','S0_AUTH_PATH');
 const rules=entry.candidate_transition_fields;
 ok(rules.length===7,'RULE_COUNT');
 const s0=rules.find(v=>v.status_file===paths[0]&&v.field_path==='status');
 ok(s0&&same(s0.allowed_candidate_values,['AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE'])&&s0.focused_workflow==='mcft-cap-09-s0-authorization'&&s0.standard_workflow==='ci','S0_RULE');
 for(let i=1;i<=6;i++){const q=rules.find(v=>v.field_path===`s${i}_candidate_implemented`);ok(q&&same(q.allowed_candidate_values,[true])&&q.predecessor_effective_evidence_required===true,`S${i}_RULE`)}
 for(const k of ['implementation_authorized','runtime_source_authorized','canonical_write_authorized','live_ingestion_authorized','background_scheduler_authorized','public_http_writer_authorized','model_activation_authorized','controlled_action_authorized'])ok(entry[k]===false,`AUTH_${k}`);
 return true;
}
(async()=>{const base=process.env.MCFT_BASE_SHA,head=sh('rev-parse','HEAD');try{
 ok(base===BASE,'BASE:'+base);
 const changed=sh('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
 ok(same(changed,EXPECT.slice().sort()),'BOUNDARY:'+JSON.stringify(changed));
 for(const f of changed){const text=rd(f);ok(!text.includes(marker),'CANDIDATE_DECLARATION:'+f);ok(!/^(apps|packages|migrations)\//.test(f),'RUNTIME_SOURCE:'+f)}
 const s0=JSON.parse(fs.readFileSync(artifact('MCFT_CAP_09_S0_PRE_CANDIDATE_GOVERNANCE_RESULT.json'),'utf8'));
 ok(s0.status==='PASS'&&s0.head_sha===S0_HEAD&&s0.change_class==='MCFT_CAP_09_S0_PRE_CANDIDATE_GOVERNANCE_FOUNDATION','S0_EVIDENCE');
 ok(s0.registry_rule_present===false&&s0.implementation_authorized===false&&s0.runtime_source_delta===0&&s0.candidate_declaration===false,'S0_BOUNDARY');
 const pr=await api('/pulls/2828');ok(pr.merged===true&&pr.merge_commit_sha===BASE&&pr.head.sha===S0_HEAD,'S0_PR');
 const ar=(await api(`/actions/runs/${S0_RUN}/artifacts?per_page=100`)).artifacts.find(v=>v.id===S0_ART);
 ok(ar&&!ar.expired&&ar.digest==='sha256:75975a2bd9f02d61f1f95a788b6f418b0f3a53e705fa40941fdf64e430632a54','S0_ARTIFACT');
 const baseReg=JSON.parse(sh('show',`${BASE}:${REG}`)),reg=js(REG);
 ok(baseReg.authority_set_revision==='1.5'&&baseReg.authority_set_change_id==='MCFT-CAP-08.S6-CTO-DUAL-ACCOUNT-VERIFICATION-DEFERRAL','BASE_REGISTRY');
 ok(cap(baseReg,'MCFT-CAP-09').length===0,'BASE_CAP09_PRESENT');
 ok(reg.registry_id==='MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1'&&reg.registry_revision==='1.1'&&reg.authority_set_revision==='1.6','REGISTRY_HEADER');
 ok(reg.authority_set_change_id==='MCFT-CAP-09.S0-TRUSTED-REGISTRY-BOOTSTRAP','CHANGE_ID');
 for(const id of ['MCFT-CAP-06','MCFT-CAP-07','MCFT-CAP-08'])ok(same(cap(baseReg,id)[0],cap(reg,id)[0]),`PREDECESSOR_ENTRY_DRIFT:${id}`);
 ok(cap(reg,'MCFT-CAP-09').length===1,'CAP09_CARDINALITY');
 const entry=cap(reg,'MCFT-CAP-09')[0];validateCap09(entry);
 const negMissing=structuredClone(reg);negMissing.capabilities=negMissing.capabilities.filter(v=>v.capability_line!=='MCFT-CAP-09');
 ok(cap(negMissing,'MCFT-CAP-09').length===0,'NEG_MISSING');
 for(const mutate of [
   e=>{e.candidate_declaration_enabled=false},
   e=>{e.current_candidate_authority=true},
   e=>{e.authoritative_candidate_status_paths[0]='docs/digital_twin/mcft/cap_09/WRONG.json'},
   e=>{e.candidate_transition_fields[0].allowed_candidate_values=['CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE']}
 ]){const n=structuredClone(entry);mutate(n);let failed=false;try{validateCap09(n)}catch{failed=true}ok(failed,'NEG_VECTOR_NOT_REJECTED')}
 const cur=js('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json');
 const ds=js('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-DELIVERY-STATUS-V1.json');
 for(const v of [cur,ds]){ok(v.registry_rule_present===true,'REGISTRY_FLAG');ok(v.implementation_authorized===false&&v.runtime_source_authorized===false&&v.candidate_declaration_authorized===false,'AUTH_BOUNDARY');ok(v.first_legal_next_action==='MCFT_CAP_09_S0_AUTHORIZATION_CANDIDATE','NEXT_ACTION')}
 ok(cur.status==='PRE_CANDIDATE_GOVERNANCE_FOUNDATION','CURRENT_STATUS_DRIFT');
 ok(ds.status==='PRE_CANDIDATE_GOVERNANCE_FOUNDATION'&&ds.s0_candidate_implemented===false,'DELIVERY_STATUS_DRIFT');
 const rec=js('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TRUSTED-REGISTRY-BOOTSTRAP-V1.json');
 ok(rec.base_main_sha===BASE&&rec.s0_candidate_head_sha===S0_HEAD&&rec.s0_candidate_tree_sha===S0_TREE&&rec.s0_merge_sha===BASE,'BOOTSTRAP_BINDING');
 ok(rec.cap09_entry_present===true&&rec.current_candidate_authority===false&&rec.candidate_transition_performed===false&&rec.candidate_declaration_present===false,'BOOTSTRAP_NON_CANDIDATE');
 ok(rec.same_pr_modified_registry_may_authorize_candidate===false,'SAME_PR_POLICY');
 const b=js('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TRUSTED-REGISTRY-BOUNDARY-V1.json');
 ok(b.changed_file_count===7&&same(b.changed_files,EXPECT)&&b.registry_delta===1&&b.candidate_transition===false&&b.runtime_source_delta===0,'BOUNDARY_FILE');
 const result={status:'PASS',change_class:'MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP',base_sha:base,head_sha:head,changed_files:changed,s0_merge_sha:BASE,s0_focused_workflow_run_id:S0_RUN,s0_focused_artifact_id:S0_ART,registry_revision:reg.registry_revision,authority_set_revision:reg.authority_set_revision,cap09_entry_present:true,candidate_declaration_enabled_for_future_registered_transitions:true,current_candidate_authority:false,candidate_transition:false,candidate_declaration:false,implementation_authorized:false,runtime_source_delta:0,canonical_runtime_data_delta:0,database_acl_delta:0,first_legal_next_action:'MCFT_CAP_09_S0_AUTHORIZATION_CANDIDATE'};
 write(result);console.log(JSON.stringify(result,null,2));
}catch(e){const result={status:'FAIL',base_sha:base||null,head_sha:head,error:e.message};write(result);console.error(JSON.stringify(result,null,2));process.exitCode=1}})();
