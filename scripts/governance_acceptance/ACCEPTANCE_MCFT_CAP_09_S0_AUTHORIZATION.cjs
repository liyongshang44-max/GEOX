#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const ROOT=process.cwd();
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_09_S0_AUTHORIZATION_RESULT.json');
const BASE='b4d0c21a094de1a4622755173867957ab6fcbc88';
const PRE_REPAIR_MERGE='b165c1d36732a332f70fca375893188142f5992e';
const TRUSTED_REPAIR_MERGE='b4d0c21a094de1a4622755173867957ab6fcbc88';
const MARKER=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
const W='.github/workflows/mcft-cap-09-s0-authorization.yml';
const C='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json';
const B='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-AUTHORIZATION-CANDIDATE-BOUNDARY-V1.json';
const R='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-AUTHORIZATION-CANDIDATE-V1.json';
const S='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-DELIVERY-STATUS-V1.json';
const V='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S0_AUTHORIZATION.cjs';
const T='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md';
const SC='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json';
const P='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PREDECESSOR-LOCK-V1.json';
const G='docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json';
const Q='docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json';
const PRE_W='.github/workflows/mcft-cap-09-s0-pre-candidate-governance.yml';
const PRE_V='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S0_PRE_CANDIDATE_GOVERNANCE.cjs';
const REG_W='.github/workflows/mcft-cap-09-trusted-registry-bootstrap.yml';
const REG_V='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP.cjs';
const FILES=[W,C,B,R,S,V].sort();
const SNAP=[C,B,R,S,V].sort();
const FROZEN={
 [T]:'fc0a1fd6de55b5ca8a5b94b552553270de5c6938',
 [SC]:'82320c234c663af95aaec76df213d14b3aef048e',
 [P]:'07612cc0fc4ebb3615bcb961fd4219505cc8349e',
 [G]:'e066ad7e6ec57f8dae9d0c2a41a492434deec4e0',
 [Q]:'479f258e58482f3596ef3f1b88e27ef109b99d4b',
 [PRE_W]:'b441c458e06da935f89eea5ad5addf452453c4e0',
 [PRE_V]:'cf7db1ab783662b47120353ff52e4a7bc26d1d2b',
 [REG_W]:'b3d456f2e4b7b7f38d30bc75a9f8ea183b0fb58c',
 [REG_V]:'a46f30e6695444f85628a1720f0765a3e1c99329'
};
const git=(...a)=>execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();
const text=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const json=f=>JSON.parse(text(f));
const at=(ref,f)=>{try{return JSON.parse(git('show',`${ref}:${f}`));}catch{return {};}};
const must=(v,c)=>{if(!v)throw new Error(c);};
const eq=(a,e,c)=>{try{assert.deepEqual(a,e);}catch{throw new Error(`${c}:${JSON.stringify(a)}`);}};
const zero=(o,ks,c)=>ks.forEach(k=>must(o[k]===0,`${c}:${k}`));
const falses=(o,ks,c)=>ks.forEach(k=>must(o[k]===false,`${c}:${k}`));
const write=o=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,`${JSON.stringify(o,null,2)}\n`);};
async function api(p){must(process.env.GITHUB_TOKEN,'GITHUB_TOKEN_REQUIRED');must(process.env.GITHUB_REPOSITORY,'GITHUB_REPOSITORY_REQUIRED');const r=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${p}`,{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'geox-cap09-s0-v3'}});const b=await r.text();must(r.ok,`GITHUB_API_${r.status}:${b.slice(0,180)}`);return b?JSON.parse(b):null;}
function declaration(body){const open=`<!-- ${MARKER}\n`;const t=String(body||'');const i=t.indexOf(open);must(i>=0,'DECLARATION_CARDINALITY:0');must(t.indexOf(open,i+open.length)<0,'DECLARATION_CARDINALITY:2');const e=t.indexOf('-->',i+open.length);must(e>=0,'DECLARATION_TERMINATOR_MISSING');const o={};for(const raw of t.slice(i+open.length,e).split(/\r?\n/)){const l=raw.trim();if(!l)continue;const n=l.indexOf('=');must(n>0,`DECLARATION_LINE_INVALID:${l}`);const k=l.slice(0,n).trim();must(!Object.hasOwn(o,k),`DECLARATION_DUPLICATE:${k}`);o[k]=l.slice(n+1).trim();}return o;}
function isBool(k,q){return q.explicit_candidate_boolean_field_names.includes(k)||q.explicit_candidate_boolean_field_patterns.some(p=>new RegExp(p).test(k));}
function signals(x,q,p=[],out=[]){if(Array.isArray(x)){x.forEach((v,i)=>signals(v,q,[...p,String(i)],out));return out;}if(!x||typeof x!=='object')return out;const statuses=new Set(q.explicit_candidate_status_values);for(const [k,v] of Object.entries(x)){const n=[...p,k];if(v===true&&isBool(k,q))out.push({field:n.join('.'),value:v,kind:'EXPLICIT_BOOLEAN_DELIVERY_CANDIDATE_SIGNAL'});if(typeof v==='string'&&statuses.has(v))out.push({field:n.join('.'),value:v,kind:'EXACT_STATUS_DELIVERY_CANDIDATE_SIGNAL'});if(v&&typeof v==='object')signals(v,q,n,out);}return out;}
function newSignals(base,q){const out=[];for(const f of [C,B,R,S]){const before=signals(at(base,f),q);for(const s of signals(json(f),q)){if(!before.some(v=>v.field===s.field&&v.value===s.value&&v.kind===s.kind))out.push({file:f,...s});}}return out.sort((a,b)=>`${a.file}:${a.field}`.localeCompare(`${b.file}:${b.field}`));}
function staticCheck(){
 const base=process.env.MCFT_BASE_SHA;const event=process.env.MCFT_EVENT_NAME||'unknown';const head=git('rev-parse','HEAD');must(base===BASE,`BASE_SHA_MISMATCH:${base}`);
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();eq(changed,FILES,'CHANGED_FILES_MISMATCH');changed.forEach(f=>{must(!/^(apps|packages|migrations)\//.test(f),`RUNTIME_PATH_FORBIDDEN:${f}`);must(!text(f).includes(MARKER),`DECLARATION_IN_REPOSITORY:${f}`);});if(event==='pull_request')must(Number(git('rev-list','--count',`${base}..HEAD`))===1,'CANDIDATE_COMMIT_COUNT_NOT_ONE');for(const [f,b] of Object.entries(FROZEN))must(git('rev-parse',`HEAD:${f}`)===b,`FROZEN_BLOB_MISMATCH:${f}`);
 const c=json(C),b=json(B),r=json(R),s=json(S),g=json(G),q=json(Q);
 must(c.status==='AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE','CURRENT_STATUS_INVALID');must(c.candidate_base_main_sha===BASE,'CURRENT_BASE_INVALID');must(c.candidate_head_binding_mode==='PR_DECLARATION_V2_AND_GITHUB_EVENT'&&c.candidate_head_embedded===false&&!Object.hasOwn(c,'candidate_head_sha'),'CURRENT_BINDING_INVALID');must(c.effectiveness_condition==='PRESENT_ON_PROTECTED_MAIN_AND_EXACT_SHA_R2_ATTESTATION_PASS'&&c.effective_next_slice_when_attested==='S1','CURRENT_EFFECTIVENESS_INVALID');falses(c,['implementation_authorized','runtime_source_authorized','live_ingestion_authorized','background_scheduler_authorized','canonical_write_authorized','public_http_writer_authorized','candidate_declaration_authorized','model_activation_authorized','controlled_action_authorized'],'CURRENT_AUTHORITY_TRUE');
 must(s.record_status==='S0_AUTHORIZATION_CANDIDATE_TRACKING_NON_AUTHORITY','DELIVERY_RECORD_STATUS_INVALID');must(s.status==='S0_AUTHORIZATION_CANDIDATE_TRACKED_NOT_EFFECTIVE','DELIVERY_STATUS_INVALID');must(s.s0_candidate_implemented===false&&s.candidate_transition_tracked===true&&s.candidate_declaration_present===true,'DELIVERY_TRACKING_INVALID');must(s.externally_effective===false&&s.candidate_head_embedded===false,'DELIVERY_EFFECTIVE_OR_EMBEDDED');zero(s,['runtime_source_delta','migration_delta','canonical_runtime_data_delta','database_acl_delta','registry_delta','taskbook_delta','navigation_ssot_delta'],'DELIVERY_DELTA_NONZERO');
 must(r.base_main_sha===BASE&&r.candidate_transition_performed===true&&r.external_effectiveness===false,'RECORD_STATE_INVALID');must(r.pre_candidate_tracking_compatibility_repair_merge_sha===PRE_REPAIR_MERGE&&r.trusted_registry_tracking_compatibility_repair_merge_sha===TRUSTED_REPAIR_MERGE,'REPAIR_MERGE_CHAIN_INVALID');must(r.pre_candidate_tracking_workflow_blob_sha===FROZEN[PRE_W]&&r.pre_candidate_tracking_validator_blob_sha===FROZEN[PRE_V]&&r.trusted_registry_tracking_workflow_blob_sha===FROZEN[REG_W]&&r.trusted_registry_tracking_validator_blob_sha===FROZEN[REG_V],'REPAIR_BLOB_CHAIN_INVALID');must(r.delivery_candidate_signal_contract_blob_sha===FROZEN[Q],'SIGNAL_CONTRACT_ANCHOR_INVALID');must(r.focused_workflow_ref===W&&r.focused_workflow_blob_sha==='44efb24c38f0a30ac9f99cf0a2d363498d73a465','WORKFLOW_ANCHOR_INVALID');must(r.declaration_semantic_snapshot_mode==='POLICY_ALLOWED_FIVE_FILES_PLUS_WORKFLOW_BLOB_ANCHOR'&&r.declaration_semantic_snapshot_file_count===5&&r.candidate_boundary_file_count===6,'SNAPSHOT_MODE_INVALID');must(r.trusted_registry_blob_sha===FROZEN[G]&&r.taskbook_blob_sha===FROZEN[T]&&r.scope_contract_blob_sha===FROZEN[SC]&&r.predecessor_lock_blob_sha===FROZEN[P],'RECORD_FROZEN_BLOB_INVALID');zero(r,['runtime_source_delta','migration_delta','registry_delta','taskbook_delta','canonical_runtime_data_delta','database_acl_delta','navigation_ssot_delta'],'RECORD_DELTA_NONZERO');
 must(b.base_main_sha===BASE&&b.changed_file_count===6&&b.candidate_transition===true&&b.external_effectiveness===false,'BOUNDARY_STATE_INVALID');eq(b.changed_files,FILES,'BOUNDARY_FILES_INVALID');
 const es=g.capabilities.filter(x=>x.capability_line==='MCFT-CAP-09');must(es.length===1,`REGISTRY_ENTRY_CARDINALITY:${es.length}`);const e=es[0];eq([...e.authoritative_candidate_status_paths].sort(),[C,S].sort(),'REGISTRY_STATUS_PATHS_INVALID');must(e.candidate_transition_fields.length===1,'REGISTRY_TRANSITION_CARDINALITY_INVALID');const tr=e.candidate_transition_fields[0];must(tr.status_file===C&&tr.field_path==='status'&&tr.focused_workflow==='mcft-cap-09-s0-authorization'&&tr.standard_workflow==='ci','REGISTRY_TRANSITION_INVALID');eq(tr.allowed_candidate_values,['AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE'],'REGISTRY_VALUE_INVALID');
 const ns=newSignals(base,q);eq(ns,[{file:C,field:'status',value:'AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE',kind:'EXACT_STATUS_DELIVERY_CANDIDATE_SIGNAL'}],'EXACTLY_ONE_REGISTERED_CANDIDATE_SIGNAL_REQUIRED');return{base,head,event,changed,ns};
}
async function prCheck(x){if(x.event!=='pull_request')return{mode:'DELEGATED_TO_TRUSTED_MERGE_GROUP_POLICY'};const n=Number(process.env.MCFT_PR_NUMBER);must(Number.isInteger(n)&&n>0,'PR_NUMBER_INVALID');const pr=await api(`/pulls/${n}`);must(pr.head.sha===x.head&&pr.base.sha===x.base,'PR_HEAD_OR_BASE_MISMATCH');const d=declaration(pr.body);eq(Object.keys(d).sort(),['base_head','candidate_field','candidate_head','candidate_value','capability_line','focused_workflow','semantic_snapshot_blobs','semantic_snapshot_files','slice_id','standard_workflow','status_file'],'DECLARATION_KEYS_INVALID');must(d.capability_line==='MCFT-CAP-09'&&d.slice_id==='MCFT-CAP-09.S0'&&d.status_file===C&&d.candidate_field==='status'&&d.candidate_value==='AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE','DECLARATION_AUTHORITY_INVALID');must(d.focused_workflow==='mcft-cap-09-s0-authorization'&&d.standard_workflow==='ci'&&d.candidate_head===x.head&&d.base_head===x.base,'DECLARATION_BINDING_INVALID');const files=d.semantic_snapshot_files.split(',').map(v=>v.trim()).filter(Boolean);const blobs=d.semantic_snapshot_blobs.split(',').map(v=>v.trim()).filter(Boolean);eq(files,SNAP,'DECLARATION_FILES_INVALID');must(files.every(f=>/^(docs|scripts|apps)\//.test(f)),'DECLARATION_POLICY_PATH_INVALID');eq(blobs,files.map(f=>git('rev-parse',`HEAD:${f}`)),'DECLARATION_BLOBS_INVALID');must(git('rev-parse',`HEAD:${W}`)==='44efb24c38f0a30ac9f99cf0a2d363498d73a465','WORKFLOW_BLOB_INVALID');return{mode:'PR_BODY_VALIDATED',pr_number:n,semantic_snapshot_count:5,workflow_blob_anchored_separately:true};}
(async()=>{let x=null;try{x=staticCheck();const d=await prCheck(x);const result={status:'PASS',change_class:'MCFT_CAP_09_S0_AUTHORIZATION_CANDIDATE',base_sha:x.base,candidate_head_sha:x.head,changed_files:x.changed,declaration:d,exact_new_delivery_candidate_signals:x.ns,trusted_registry_single_transition_verified:true,tracking_compatibility_repairs_frozen:true,workflow_blob_anchored_outside_policy_limited_declaration_snapshot:true,external_effectiveness:false,implementation_authorized:false,first_legal_next_action:'PROTECTED_MERGE_THEN_EXACT_SHA_R2_ATTESTATION'};write(result);console.log(JSON.stringify(result,null,2));}catch(error){const result={status:'FAIL',base_sha:x?.base||process.env.MCFT_BASE_SHA||null,candidate_head_sha:x?.head||null,error:String(error?.message||error)};write(result);console.error(JSON.stringify(result,null,2));process.exitCode=1;}})();
