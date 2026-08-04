#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),p=require('node:path'),{execFileSync:x}=require('node:child_process'),assert=require('node:assert/strict');
const R=process.cwd(),O=p.join(R,'acceptance-output/MCFT_CAP_09_S0_AUTHORIZATION_RESULT.json');
const BASE='0c49f5282c3c05c33caf06da93862afaecda760c';
const CURRENT='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json';
const STATUS='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-DELIVERY-STATUS-V1.json';
const RECORD='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-AUTHORIZATION-CANDIDATE-V1.json';
const BOUNDARY='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-AUTHORIZATION-CANDIDATE-BOUNDARY-V1.json';
const WORKFLOW='.github/workflows/mcft-cap-09-s0-authorization.yml';
const VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S0_AUTHORIZATION.cjs';
const TASK='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md';
const SCOPE='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json';
const LOCK='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PREDECESSOR-LOCK-V1.json';
const REGISTRY='docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json';
const EXPECT=[WORKFLOW,CURRENT,BOUNDARY,RECORD,STATUS,VALIDATOR].sort();
const FROZEN={
 [TASK]:'fc0a1fd6de55b5ca8a5b94b552553270de5c6938',
 [SCOPE]:'82320c234c663af95aaec76df213d14b3aef048e',
 [LOCK]:'07612cc0fc4ebb3615bcb961fd4219505cc8349e',
 [REGISTRY]:'e92a5af9e422812b76b6b689b4a2d1b0263a41ab',
};
const rd=f=>fs.readFileSync(p.join(R,f),'utf8'),js=f=>JSON.parse(rd(f)),sh=(...a)=>x('git',a,{encoding:'utf8'}).trim();
const ok=(v,c)=>{if(!v)throw Error(c)},same=(a,b)=>{try{assert.deepEqual(a,b);return true}catch{return false}};
const write=v=>{fs.mkdirSync(p.dirname(O),{recursive:true});fs.writeFileSync(O,JSON.stringify(v,null,2)+'\n')};
const marker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
const head=sh('rev-parse','HEAD'),base=process.env.MCFT_BASE_SHA,event=process.env.MCFT_EVENT_NAME||'unknown';
const changed=sh('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
async function api(u){const t=process.env.GITHUB_TOKEN;ok(t,'TOKEN_REQUIRED');const r=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${u}`,{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${t}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'cap09-s0-authorization'}}),b=await r.text();ok(r.ok,`API_${r.status}:${u}:${b.slice(0,200)}`);return b?JSON.parse(b):null}
function parseDeclaration(body){
 const re=new RegExp(`<!--\\s*${marker}\\s*\\n([\\s\\S]*?)-->`,'gm'),matches=[...String(body||'').matchAll(re)];ok(matches.length===1,'DECLARATION_CARDINALITY:'+matches.length);
 const d={};for(const raw of matches[0][1].split(/\r?\n/)){const line=raw.trim();if(!line)continue;const i=line.indexOf('=');ok(i>0,'DECLARATION_LINE:'+line);const k=line.slice(0,i).trim(),v=line.slice(i+1).trim();ok(!Object.hasOwn(d,k),'DECLARATION_DUPLICATE:'+k);d[k]=v}
 return d;
}
function validateStatic(){
 ok(base===BASE,'BASE_SHA:'+base);ok(same(changed,EXPECT),'CHANGED_FILES:'+JSON.stringify(changed));
 for(const f of changed){ok(!/^(apps|packages|migrations)\//.test(f),'RUNTIME_PATH:'+f);ok(!rd(f).includes(marker),'DECLARATION_IN_REPOSITORY:'+f)}
 if(event==='pull_request')ok(Number(sh('rev-list','--count',`${base}..HEAD`))===1,'CANDIDATE_COMMIT_COUNT');
 for(const [file,blob] of Object.entries(FROZEN))ok(sh('rev-parse',`HEAD:${file}`)===blob,'FROZEN_BLOB:'+file);
 const cur=js(CURRENT),ds=js(STATUS),rec=js(RECORD),bd=js(BOUNDARY),reg=js(REGISTRY);
 ok(cur.record_status==='S0_AUTHORIZATION_CANDIDATE'&&cur.status==='AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE','CURRENT_STATUS');
 ok(cur.candidate_base_main_sha===BASE&&cur.candidate_head_binding_mode==='PR_DECLARATION_V2_AND_GITHUB_EVENT'&&cur.candidate_head_embedded===false&&!Object.hasOwn(cur,'candidate_head_sha'),'CURRENT_HEAD_BINDING');
 ok(cur.effectiveness_condition==='PRESENT_ON_PROTECTED_MAIN_AND_EXACT_SHA_R2_ATTESTATION_PASS'&&cur.effective_status_when_attested==='IN_PROGRESS'&&cur.effective_next_slice_when_attested==='S1','CURRENT_EFFECTIVENESS');
 ok(cur.s1_candidate_declaration_authorized_when_attested===true&&cur.s1_authorized_scope_when_attested==='ADAPTER_CONTRACTS_AND_CONFIGURATION_FREEZE_ONLY','S1_BOUNDED_SUCCESSOR');
 for(const k of ['implementation_authorized','runtime_source_authorized','live_ingestion_authorized','background_scheduler_authorized','canonical_write_authorized','public_http_writer_authorized','candidate_declaration_authorized','model_activation_authorized','controlled_action_authorized'])ok(cur[k]===false,'CURRENT_AUTH_'+k);
 for(const k of ['runtime_source_authorized_when_attested','live_ingestion_authorized_when_attested','background_scheduler_authorized_when_attested','canonical_write_authorized_when_attested','public_http_writer_authorized_when_attested','model_activation_authorized_when_attested','controlled_action_authorized_when_attested'])ok(cur[k]===false,'EFFECTIVE_AUTH_'+k);
 ok(ds.status==='AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE'&&ds.s0_candidate_implemented===true&&ds.candidate_declaration_present===true&&ds.externally_effective===false,'DELIVERY_STATUS');
 ok(ds.candidate_head_binding_mode==='PR_DECLARATION_V2_AND_GITHUB_EVENT'&&ds.candidate_head_embedded===false&&!Object.hasOwn(ds,'candidate_head_sha'),'DELIVERY_HEAD_BINDING');
 for(const k of ['runtime_source_delta','migration_delta','canonical_runtime_data_delta','database_acl_delta','registry_delta','taskbook_delta','navigation_ssot_delta'])ok(ds[k]===0,'DELIVERY_DELTA_'+k);
 ok(rec.record_status==='S0_AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE'&&rec.base_main_sha===BASE&&rec.candidate_transition_performed===true&&rec.external_effectiveness===false,'CANDIDATE_RECORD');
 ok(rec.candidate_head_binding_mode==='PR_DECLARATION_V2_AND_GITHUB_EVENT'&&rec.candidate_head_embedded===false&&!Object.hasOwn(rec,'candidate_head_sha'),'RECORD_HEAD_BINDING');
 ok(rec.taskbook_blob_sha===FROZEN[TASK]&&rec.scope_contract_blob_sha===FROZEN[SCOPE]&&rec.predecessor_lock_blob_sha===FROZEN[LOCK]&&rec.trusted_registry_blob_sha===FROZEN[REGISTRY],'RECORD_FROZEN_BLOBS');
 for(const k of ['runtime_source_delta','migration_delta','registry_delta','taskbook_delta','canonical_runtime_data_delta','database_acl_delta','navigation_ssot_delta'])ok(rec[k]===0,'RECORD_DELTA_'+k);
 ok(bd.base_main_sha===BASE&&bd.changed_file_count===6&&same(bd.changed_files,EXPECT)&&bd.candidate_transition===true&&bd.external_effectiveness===false,'BOUNDARY');
 ok(bd.candidate_head_binding_mode==='PR_DECLARATION_V2_AND_GITHUB_EVENT'&&bd.candidate_head_embedded===false&&!Object.hasOwn(bd,'candidate_head_sha'),'BOUNDARY_HEAD_BINDING');
 const entries=reg.capabilities.filter(v=>v.capability_line==='MCFT-CAP-09');ok(entries.length===1,'REGISTRY_ENTRY_CARDINALITY');const entry=entries[0];
 ok(entry.candidate_declaration_enabled===true&&entry.current_candidate_authority===false,'REGISTRY_GATE');
 ok(entry.authoritative_candidate_status_paths.includes(CURRENT),'REGISTRY_STATUS_PATH');const rule=entry.candidate_transition_fields.find(v=>v.status_file===CURRENT&&v.field_path==='status');
 ok(rule&&rule.allowed_candidate_values.includes('AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE')&&rule.focused_workflow==='mcft-cap-09-s0-authorization'&&rule.standard_workflow==='ci','REGISTRY_TRANSITION');
 return {cur,ds,rec,bd};
}
async function validateDeclaration(){
 if(event!=='pull_request')return {mode:'DELEGATED_TO_CANDIDATE_INTEGRITY_FOR_MERGE_GROUP'};
 const prNumber=Number(process.env.MCFT_PR_NUMBER);ok(Number.isInteger(prNumber)&&prNumber>0,'PR_NUMBER');const pr=await api(`/pulls/${prNumber}`);ok(pr.head.sha===head&&pr.base.sha===base,'PR_HEAD_BASE');
 const d=parseDeclaration(pr.body);const required=['capability_line','slice_id','status_file','candidate_field','candidate_value','focused_workflow','standard_workflow','semantic_snapshot_files','semantic_snapshot_blobs','candidate_head','base_head'];ok(same(Object.keys(d).sort(),required.sort()),'DECLARATION_KEYS');
 ok(d.capability_line==='MCFT-CAP-09'&&d.slice_id==='MCFT-CAP-09.S0'&&d.status_file===CURRENT,'DECLARATION_IDENTITY');
 ok(d.candidate_field==='status'&&d.candidate_value==='AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE','DECLARATION_TRANSITION');
 ok(d.focused_workflow==='mcft-cap-09-s0-authorization'&&d.standard_workflow==='ci','DECLARATION_WORKFLOWS');ok(d.candidate_head===head&&d.base_head===base,'DECLARATION_HEAD_BASE');
 const files=d.semantic_snapshot_files.split(',').map(v=>v.trim()).filter(Boolean),blobs=d.semantic_snapshot_blobs.split(',').map(v=>v.trim()).filter(Boolean);ok(same(files,EXPECT),'DECLARATION_FILES');ok(blobs.length===files.length,'DECLARATION_BLOB_COUNT');
 const actual=files.map(f=>sh('rev-parse',`HEAD:${f}`));ok(same(blobs,actual),'DECLARATION_BLOBS');return {mode:'PR_BODY_VALIDATED',pr_number:prNumber,semantic_snapshot_count:files.length,semantic_snapshot_blobs:actual};
}
(async()=>{try{validateStatic();const declaration=await validateDeclaration();const result={status:'PASS',change_class:'MCFT_CAP_09_S0_AUTHORIZATION_CANDIDATE',base_sha:base,candidate_head_sha:head,changed_files:changed,candidate_head_binding_mode:'PR_DECLARATION_V2_AND_GITHUB_EVENT',candidate_head_embedded_in_candidate_blob:false,declaration,registry_rule_trusted_from_base:true,candidate_transition:true,external_effectiveness:false,implementation_authorized:false,runtime_source_delta:0,canonical_runtime_data_delta:0,database_acl_delta:0,first_legal_next_action:'PROTECTED_MERGE_THEN_EXACT_SHA_R2_ATTESTATION'};write(result);console.log(JSON.stringify(result,null,2))}catch(e){const result={status:'FAIL',base_sha:base||null,candidate_head_sha:head,error:e.message};write(result);console.error(JSON.stringify(result,null,2));process.exitCode=1}})();
