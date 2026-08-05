#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

const ROOT=process.cwd();
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_09_S1_ADAPTER_CONTRACTS_RESULT.json');
const BASE='c420678f12fba8bdb7841237a5abcde6aa7c6a81';
const WORKFLOW='.github/workflows/mcft-cap-09-s1-adapter-contracts.yml';
const PORTS='apps/server/src/runtime/twin_runtime/ports.ts';
const CONFIG_TS='apps/server/src/runtime/twin_runtime/shadow_online_adapter_config_v1.ts';
const CONFIG_JSON='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-ADAPTER-CONTRACTS-CONFIG-V1.json';
const BOUNDARY='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-ADAPTER-CONTRACTS-CANDIDATE-BOUNDARY-V1.json';
const CANDIDATE='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-ADAPTER-CONTRACTS-CANDIDATE-V1.json';
const STATUS='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-DELIVERY-STATUS-V1.json';
const HARD='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-HARD-ACCEPTANCE-EVIDENCE-V1.json';
const PREDECESSOR='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json';
const VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S1_ADAPTER_CONTRACTS.cjs';
const RUNTIME_ACCEPTANCE='scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S1_ADAPTER_CONTRACTS.ts';
const REG='docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json';
const TASK='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md';
const SCOPE='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json';
const SIGNAL='docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json';
const CURRENT='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json';
const REGISTRATION='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-REGISTRY-REGISTRATION-V1.json';
const REGISTRATION_BOUNDARY='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-REGISTRY-REGISTRATION-BOUNDARY-V1.json';
const TRUSTED_WORKFLOW='.github/workflows/mcft-cap-09-trusted-registry-bootstrap.yml';
const FILES=[WORKFLOW,PORTS,CONFIG_TS,CONFIG_JSON,BOUNDARY,CANDIDATE,STATUS,HARD,PREDECESSOR,VALIDATOR,RUNTIME_ACCEPTANCE].sort();
const SNAP=FILES.filter(f=>f!==WORKFLOW).sort();
const FROZEN={
 [REG]:'0f88e2453ef697b012e98edda8635d408b21bc7c',
 [TASK]:'fc0a1fd6de55b5ca8a5b94b552553270de5c6938',
 [SCOPE]:'82320c234c663af95aaec76df213d14b3aef048e',
 [SIGNAL]:'479f258e58482f3596ef3f1b88e27ef109b99d4b',
 [CURRENT]:'1e9a33e88c4530b65ac3084e2b7de32649b920c1',
 [REGISTRATION]:'c07104564264b561b4c9c81c09d4a337e5733844',
 [REGISTRATION_BOUNDARY]:'27a648ab859c7785d97cb5a185f383cdd22ca655',
 [TRUSTED_WORKFLOW]:'e2a5710f0da961d81ab48cfb2eb07e674a87b6d5',
};
const WORKFLOW_BLOB='47feac9b5e19447aeee2da6c667f38895612ac3e';
const MARKER=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
const git=(...a)=>execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const json=f=>JSON.parse(read(f));
const must=(v,c)=>{if(!v)throw new Error(c);};
const eq=(a,b,c)=>{try{assert.deepEqual(a,b);}catch{throw new Error(`${c}:${JSON.stringify(a)}`);}};
const write=o=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(o,null,2)+'\n');};
const at=(ref,f)=>{try{return JSON.parse(git('show',`${ref}:${f}`));}catch{return {};}};
function findArtifact(name){
 const root=path.resolve(process.env.MCFT_CAP09_S0_EFFECTIVE_ARTIFACT_DIR||'acceptance-input/cap09-s0-effective');
 const stack=[root];
 while(stack.length){const dir=stack.pop();if(!fs.existsSync(dir))continue;for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())stack.push(p);else if(ent.name===name)return p;}}
 throw new Error(`ARTIFACT_MISSING:${name}`);
}
function isBoolSignal(key,contract){return contract.explicit_candidate_boolean_field_names.includes(key)||contract.explicit_candidate_boolean_field_patterns.some(p=>new RegExp(p).test(key));}
function signals(value,contract,parts=[],out=[]){
 if(Array.isArray(value)){value.forEach((v,i)=>signals(v,contract,[...parts,String(i)],out));return out;}
 if(!value||typeof value!=='object')return out;
 const statusValues=new Set(contract.explicit_candidate_status_values);
 for(const [key,v] of Object.entries(value)){
  const next=[...parts,key];
  if(v===true&&isBoolSignal(key,contract))out.push({field:next.join('.'),value:v,kind:'EXPLICIT_BOOLEAN_DELIVERY_CANDIDATE_SIGNAL'});
  if(typeof v==='string'&&statusValues.has(v))out.push({field:next.join('.'),value:v,kind:'EXACT_STATUS_DELIVERY_CANDIDATE_SIGNAL'});
  if(v&&typeof v==='object')signals(v,contract,next,out);
 }
 return out;
}
function newSignals(base,contract){
 const out=[];
 for(const f of [CONFIG_JSON,BOUNDARY,CANDIDATE,STATUS,HARD,PREDECESSOR]){
  const before=signals(at(base,f),contract);
  for(const s of signals(json(f),contract))if(!before.some(v=>v.field===s.field&&v.value===s.value&&v.kind===s.kind))out.push({file:f,...s});
 }
 return out.sort((a,b)=>`${a.file}:${a.field}`.localeCompare(`${b.file}:${b.field}`));
}
function declaration(body){
 const open=`<!-- ${MARKER}\n`,text=String(body||'');
 const start=text.indexOf(open);must(start>=0,'DECLARATION_CARDINALITY:0');must(text.indexOf(open,start+open.length)<0,'DECLARATION_CARDINALITY:2');
 const end=text.indexOf('-->',start+open.length);must(end>=0,'DECLARATION_TERMINATOR_MISSING');const result={};
 for(const raw of text.slice(start+open.length,end).split(/\r?\n/)){const line=raw.trim();if(!line)continue;const i=line.indexOf('=');must(i>0,`DECLARATION_LINE:${line}`);const k=line.slice(0,i).trim();must(!Object.hasOwn(result,k),`DECLARATION_DUPLICATE:${k}`);result[k]=line.slice(i+1).trim();}
 return result;
}
async function api(url){
 must(process.env.GITHUB_TOKEN,'GITHUB_TOKEN_REQUIRED');must(process.env.GITHUB_REPOSITORY,'GITHUB_REPOSITORY_REQUIRED');
 const response=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${url}`,{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'geox-cap09-s1-contracts'}});
 const body=await response.text();must(response.ok,`GITHUB_API_${response.status}:${body.slice(0,160)}`);return body?JSON.parse(body):null;
}
function staticCheck(){
 const base=process.env.MCFT_BASE_SHA,head=git('rev-parse','HEAD');must(base===BASE,`BASE_SHA_MISMATCH:${base}`);
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();eq(changed,FILES,'CHANGED_FILES');
 if((process.env.MCFT_EVENT_NAME||'')==='pull_request')must(Number(git('rev-list','--count',`${base}..HEAD`))===1,'COMMIT_COUNT');
 for(const file of changed){must(!read(file).includes(MARKER),`DECLARATION_IN_REPOSITORY:${file}`);must(!/^(migrations|packages)\//.test(file),`FORBIDDEN_PATH:${file}`);}
 for(const [file,blob] of Object.entries(FROZEN))must(git('rev-parse',`HEAD:${file}`)===blob,`FROZEN_BLOB:${file}`);
 must(git('rev-parse',`HEAD:${WORKFLOW}`)===WORKFLOW_BLOB,'WORKFLOW_BLOB');
 const att=JSON.parse(fs.readFileSync(findArtifact('MCFT_CAP_09_S0_EXACT_SHA_ATTESTATION.json'),'utf8'));
 const locator=JSON.parse(fs.readFileSync(findArtifact('MCFT_CAP_09_S0_ATTESTATION_RETENTION_LOCATOR.json'),'utf8'));
 must(att.status==='PASS'&&att.subject_sha==='7381d0f8ac56fe9f75fd78ce189920cb9ed99bf4','S0_ATTESTATION');
 must(att.semantic_artifact_digest==='sha256:f2706d9cf3e001a1085d1c0b7db4f4200732605f9a6bad4a80d9ba3065346228','S0_DIGEST');
 must(att.effective_authority?.s1_candidate_declaration_authorized===true&&att.effective_authority?.s1_authorized_scope==='ADAPTER_CONTRACTS_AND_CONFIGURATION_FREEZE_ONLY','S1_AUTHORITY');
 must(locator.retention_level==='R2'&&locator.readback_verified===true&&locator.locked_version_delete_denied===true,'S0_R2');
 const registry=json(REG),entry=registry.capabilities.filter(v=>v.capability_line==='MCFT-CAP-09');must(entry.length===1,'REGISTRY_ENTRY');
 const rules=entry[0].candidate_transition_fields.filter(v=>v.status_file===STATUS&&v.field_path==='s1_candidate_implemented');must(rules.length===1,'S1_RULE_COUNT');
 eq(rules[0].allowed_candidate_values,[true],'S1_RULE_VALUE');must(rules[0].focused_workflow==='mcft-cap-09-s1-adapter-contracts'&&rules[0].standard_workflow==='ci','S1_RULE_WORKFLOW');
 const contract=json(SIGNAL),newSignalList=newSignals(base,contract);eq(newSignalList,[{file:STATUS,field:'s1_candidate_implemented',value:true,kind:'EXPLICIT_BOOLEAN_DELIVERY_CANDIDATE_SIGNAL'}],'EXACTLY_ONE_SIGNAL');
 const status=json(STATUS),candidate=json(CANDIDATE),boundary=json(BOUNDARY),config=json(CONFIG_JSON),hard=json(HARD),pred=json(PREDECESSOR);
 must(status.s1_candidate_implemented===true&&status.candidate_declaration_present===true&&status.externally_effective===false,'STATUS_STATE');
 for(const k of ['implementation_authorized','runtime_source_authorized','live_ingestion_authorized','background_scheduler_authorized','canonical_write_authorized','public_http_writer_authorized','model_activation_authorized','controlled_action_authorized'])must(status[k]===false,`STATUS_AUTH:${k}`);
 must(status.contract_source_delta===2&&status.runtime_executable_delta===0&&status.migration_delta===0,'STATUS_DELTA');
 must(candidate.base_main_sha===base&&candidate.focused_workflow_blob_sha===WORKFLOW_BLOB&&candidate.candidate_transition_performed===true&&candidate.external_effectiveness===false,'CANDIDATE_STATE');
 must(candidate.s1_candidate_lifecycle_repair_merge_sha===BASE&&candidate.s1_registry_registration_merge_sha==='10bda4db86160b2fe4896f9e5d056d78eda4ca13','CANDIDATE_CHAIN');
 must(candidate.declaration_semantic_snapshot_file_count===10&&candidate.candidate_boundary_file_count===11&&candidate.runtime_executable_delta===0,'CANDIDATE_COUNTS');
 must(boundary.base_main_sha===base&&boundary.changed_file_count===11&&boundary.candidate_transition===true&&boundary.external_effectiveness===false,'BOUNDARY_STATE');eq(boundary.changed_files,FILES,'BOUNDARY_FILES');
 must(config.port_contracts.length===5&&config.immutable_configuration.slot_count===24&&config.immutable_configuration.slot_interval==='PT1H','CONFIG_INVENTORY');
 must(config.immutable_configuration.accelerated_clock_allowed===false&&config.immutable_configuration.future_evidence_leakage_allowed===false,'CONFIG_SAFETY');
 must(hard.required_check_count===10&&hard.runtime_executable_delta===0&&hard.migration_delta===0,'HARD_ACCEPTANCE');
 must(pred.subject_sha===att.subject_sha&&pred.exact_sha_r2_run_id===30978738965&&pred.artifact_id===8919296741&&pred.readback_verified===true&&pred.locked_version_delete_denied===true,'PREDECESSOR_CONSUMPTION');
 const ports=read(PORTS),configSource=read(CONFIG_TS);
 for(const name of ['ClockPortV1','EvidenceIngressPortV1','SchedulerPortV1','ExecutionFeedbackPortV1','AvailabilityPortV1'])must(ports.includes(`export interface ${name}`),`PORT:${name}`);
 for(const token of ['process.env','Date.now(','new Date(','setTimeout(','setInterval(','node:pg','fastify'])must(!configSource.includes(token),`CONFIG_FORBIDDEN:${token}`);
 return {base,head,changed,newSignalList};
}
async function prCheck(context){
 if((process.env.MCFT_EVENT_NAME||'')!=='pull_request')return{mode:'DELEGATED_TO_TRUSTED_MERGE_GROUP_POLICY'};
 const prNumber=Number(process.env.MCFT_PR_NUMBER);must(Number.isInteger(prNumber)&&prNumber>0,'PR_NUMBER');const pr=await api(`/pulls/${prNumber}`);must(pr.head.sha===context.head&&pr.base.sha===context.base,'PR_BINDING');
 const d=declaration(pr.body);eq(Object.keys(d).sort(),['base_head','candidate_field','candidate_head','candidate_value','capability_line','focused_workflow','semantic_snapshot_blobs','semantic_snapshot_files','slice_id','standard_workflow','status_file'],'DECLARATION_KEYS');
 must(d.capability_line==='MCFT-CAP-09'&&d.slice_id==='MCFT-CAP-09.S1'&&d.status_file===STATUS&&d.candidate_field==='s1_candidate_implemented'&&d.candidate_value==='true','DECLARATION_AUTHORITY');
 must(d.focused_workflow==='mcft-cap-09-s1-adapter-contracts'&&d.standard_workflow==='ci'&&d.candidate_head===context.head&&d.base_head===context.base,'DECLARATION_BINDING');
 const files=d.semantic_snapshot_files.split(',').map(v=>v.trim()).filter(Boolean),blobs=d.semantic_snapshot_blobs.split(',').map(v=>v.trim()).filter(Boolean);eq(files,SNAP,'DECLARATION_FILES');must(files.every(f=>/^(apps|docs|scripts)\//.test(f)),'DECLARATION_PATH');eq(blobs,files.map(f=>git('rev-parse',`HEAD:${f}`)),'DECLARATION_BLOBS');
 return{mode:'PR_BODY_VALIDATED',pr_number:prNumber,semantic_snapshot_count:10,workflow_blob_anchored_separately:true};
}
(async()=>{let context=null;try{context=staticCheck();const d=await prCheck(context);const result={status:'PASS',change_class:'MCFT_CAP_09_S1_ADAPTER_CONTRACTS_CANDIDATE',base_sha:context.base,candidate_head_sha:context.head,changed_files:context.changed,declaration:d,exact_new_candidate_signals:context.newSignalList,exact_new_candidate_signal_count:context.newSignalList.length,adapter_port_count:5,slot_count:24,contract_source_delta:2,runtime_executable_delta:0,migration_delta:0,database_access_performed:false,scheduler_loop_executed:false,canonical_write_performed:false,external_effectiveness:false,first_legal_next_action:'PROTECTED_MERGE_THEN_EXACT_SHA_R2_ATTESTATION'};write(result);console.log(JSON.stringify(result,null,2));}catch(error){const result={status:'FAIL',base_sha:context?.base||process.env.MCFT_BASE_SHA||null,candidate_head_sha:context?.head||null,error:String(error?.message||error)};write(result);console.error(JSON.stringify(result,null,2));process.exitCode=1;}})();
