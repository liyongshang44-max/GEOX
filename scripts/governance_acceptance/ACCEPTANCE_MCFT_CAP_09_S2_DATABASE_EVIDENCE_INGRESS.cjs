#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const ROOT=process.cwd();
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS_RESULT.json');
const BASE='508da08b2c5855e6391bc87e0d56042fc9232a97';
const WORKFLOW='.github/workflows/mcft-cap-09-s2-database-evidence-ingress.yml';
const SOURCE='apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts';
const CONFIG='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CONFIG-V1.json';
const BOUNDARY='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CANDIDATE-BOUNDARY-V1.json';
const CANDIDATE='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CANDIDATE-V1.json';
const STATUS='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json';
const HARD='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-HARD-ACCEPTANCE-EVIDENCE-V1.json';
const PREDECESSOR='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json';
const VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS.cjs';
const RUNTIME='scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS.ts';
const REG='docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json';
const TASK='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md';
const SCOPE='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json';
const SIGNAL='docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json';
const CURRENT='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json';
const S1_STATUS='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-DELIVERY-STATUS-V1.json';
const REG_RECORD='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-REGISTRY-REGISTRATION-V1.json';
const REG_BOUNDARY='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-REGISTRY-REGISTRATION-BOUNDARY-V1.json';
const REG_WORKFLOW='.github/workflows/mcft-cap-09-s2-registry-registration.yml';
const TRUSTED_WORKFLOW='.github/workflows/mcft-cap-09-trusted-registry-bootstrap.yml';
const S1_REG_WORKFLOW='.github/workflows/mcft-cap-09-s1-registry-registration.yml';
const FILES=[WORKFLOW,SOURCE,CONFIG,BOUNDARY,CANDIDATE,STATUS,HARD,PREDECESSOR,VALIDATOR,RUNTIME].sort();
const SNAP=FILES.filter(f=>f!==WORKFLOW).sort();
const FROZEN={
 [REG]:'d368a0d5a3b6189dd84ecb75a6643719cd37844e',
 [TASK]:'fc0a1fd6de55b5ca8a5b94b552553270de5c6938',
 [SCOPE]:'82320c234c663af95aaec76df213d14b3aef048e',
 [SIGNAL]:'479f258e58482f3596ef3f1b88e27ef109b99d4b',
 [CURRENT]:'1e9a33e88c4530b65ac3084e2b7de32649b920c1',
 [S1_STATUS]:'5e86f43a52e84bdf2872b0188f7f15bff306cd84',
 [REG_RECORD]:'657c4b9f08c6e494add1f340074574bb7b6208b5',
 [REG_BOUNDARY]:'28b5298f1ec70eb672244657e677d2302ca6ad74',
 [REG_WORKFLOW]:'c3c28798f7d7bd61c72790bf9b23b62ea85c6766',
 [TRUSTED_WORKFLOW]:'51961406f4fa1446f511fd9e6f700af443f9b515',
 [S1_REG_WORKFLOW]:'3ea49212d5506741f3dd2de02eb388a57e66777e',
};
const BASE_STATUS_BLOB='b0b81f4f1c1116ee0081c973181e3e2dd6b0cc36';
const WORKFLOW_BLOB='8224b5a9f5452aa8f317a180757c7c3c17aaae87';
const MARKER=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
const git=(...a)=>execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const json=f=>JSON.parse(read(f));
const must=(v,c)=>{if(!v)throw new Error(c);};
const eq=(a,b,c)=>{try{assert.deepEqual(a,b);}catch{throw new Error(`${c}:${JSON.stringify(a)}`);}};
const write=o=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(o,null,2)+'\n');};
const at=(ref,f)=>{try{return JSON.parse(git('show',`${ref}:${f}`));}catch{return {};}};
function findArtifact(name){const root=path.resolve(process.env.MCFT_CAP09_S1_EFFECTIVE_ARTIFACT_DIR||'acceptance-input/cap09-s1-effective'),stack=[root];while(stack.length){const d=stack.pop();if(!fs.existsSync(d))continue;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())stack.push(p);else if(e.name===name)return p;}}throw new Error(`ARTIFACT_MISSING:${name}`);}
function isBoolSignal(k,c){return c.explicit_candidate_boolean_field_names.includes(k)||c.explicit_candidate_boolean_field_patterns.some(p=>new RegExp(p).test(k));}
function signals(v,c,parts=[],out=[]){if(Array.isArray(v)){v.forEach((x,i)=>signals(x,c,[...parts,String(i)],out));return out;}if(!v||typeof v!=='object')return out;const statuses=new Set(c.explicit_candidate_status_values);for(const [k,x] of Object.entries(v)){const next=[...parts,k];if(x===true&&isBoolSignal(k,c))out.push({field:next.join('.'),value:x,kind:'EXPLICIT_BOOLEAN_DELIVERY_CANDIDATE_SIGNAL'});if(typeof x==='string'&&statuses.has(x))out.push({field:next.join('.'),value:x,kind:'EXACT_STATUS_DELIVERY_CANDIDATE_SIGNAL'});if(x&&typeof x==='object')signals(x,c,next,out);}return out;}
function newSignals(base,contract){const out=[];for(const f of [CONFIG,BOUNDARY,CANDIDATE,STATUS,HARD,PREDECESSOR]){const before=signals(at(base,f),contract);for(const s of signals(json(f),contract))if(!before.some(v=>v.field===s.field&&v.value===s.value&&v.kind===s.kind))out.push({file:f,...s});}return out.sort((a,b)=>`${a.file}:${a.field}`.localeCompare(`${b.file}:${b.field}`));}
function declaration(body){const open=`<!-- ${MARKER}\n`,text=String(body||''),start=text.indexOf(open);must(start>=0,'DECLARATION_CARDINALITY:0');must(text.indexOf(open,start+open.length)<0,'DECLARATION_CARDINALITY:2');const end=text.indexOf('-->',start+open.length);must(end>=0,'DECLARATION_TERMINATOR_MISSING');const result={};for(const raw of text.slice(start+open.length,end).split(/\r?\n/)){const line=raw.trim();if(!line)continue;const i=line.indexOf('=');must(i>0,`DECLARATION_LINE:${line}`);const k=line.slice(0,i).trim();must(!Object.hasOwn(result,k),`DECLARATION_DUPLICATE:${k}`);result[k]=line.slice(i+1).trim();}return result;}
async function api(url){must(process.env.GITHUB_TOKEN,'GITHUB_TOKEN_REQUIRED');must(process.env.GITHUB_REPOSITORY,'GITHUB_REPOSITORY_REQUIRED');const response=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${url}`,{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'geox-cap09-s2-evidence'}});const body=await response.text();must(response.ok,`GITHUB_API_${response.status}:${body.slice(0,160)}`);return body?JSON.parse(body):null;}
function authorityFalse(o,p){for(const k of ['implementation_authorized','runtime_source_authorized','live_ingestion_authorized','background_scheduler_authorized','canonical_write_authorized','public_http_writer_authorized','model_activation_authorized','controlled_action_authorized'])must(o[k]===false,`${p}:${k}`);}
function staticCheck(){
 const base=process.env.MCFT_BASE_SHA,head=git('rev-parse','HEAD');must(base===BASE,`BASE_SHA_MISMATCH:${base}`);const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();eq(changed,FILES,'CHANGED_FILES');if((process.env.MCFT_EVENT_NAME||'')==='pull_request')must(Number(git('rev-list','--count',`${base}..HEAD`))===1,'COMMIT_COUNT');
 for(const f of changed){must(!read(f).includes(MARKER),`DECLARATION_IN_REPOSITORY:${f}`);must(!/^(migrations|packages)\//.test(f),`FORBIDDEN_PATH:${f}`);}for(const [f,b] of Object.entries(FROZEN))must(git('rev-parse',`HEAD:${f}`)===b,`FROZEN_BLOB:${f}`);must(git('rev-parse',`${base}:${STATUS}`)===BASE_STATUS_BLOB,'BASE_STATUS_BLOB');must(git('rev-parse',`HEAD:${WORKFLOW}`)===WORKFLOW_BLOB,'WORKFLOW_BLOB');
 const att=JSON.parse(fs.readFileSync(findArtifact('MCFT_CAP_09_S1_EXACT_SHA_ATTESTATION.json'),'utf8')),locator=JSON.parse(fs.readFileSync(findArtifact('MCFT_CAP_09_S1_ATTESTATION_RETENTION_LOCATOR.json'),'utf8'));must(att.status==='PASS'&&att.subject_sha==='843ed078d6d384e43e2c6bd2568d789dcd508934','S1_ATTESTATION');must(att.semantic_artifact_digest==='sha256:0f67da5732f43a427d2518e320a617f3ad3872c6c34065060e432d92128404ef','S1_DIGEST');must(att.effective_authority?.s2_registry_registration_authorized===true&&att.effective_authority?.s2_authorized_scope==='DATABASE_EVIDENCE_INGRESS_AND_BOUNDARY_FREEZE_ONLY','S2_AUTHORITY');must(locator.retention_level==='R2'&&locator.readback_verified===true&&locator.locked_version_delete_denied===true,'S1_R2');
 const registry=json(REG),entry=registry.capabilities.filter(v=>v.capability_line==='MCFT-CAP-09');must(entry.length===1,'REGISTRY_ENTRY');const rules=entry[0].candidate_transition_fields.filter(v=>v.status_file===STATUS&&v.field_path==='s2_candidate_implemented');must(rules.length===1,'S2_RULE_COUNT');eq(rules[0].allowed_candidate_values,[true],'S2_RULE_VALUE');must(rules[0].focused_workflow==='mcft-cap-09-s2-database-evidence-ingress'&&rules[0].standard_workflow==='ci','S2_RULE_WORKFLOW');
 const newSignalList=newSignals(base,json(SIGNAL));eq(newSignalList,[{file:STATUS,field:'s2_candidate_implemented',value:true,kind:'EXPLICIT_BOOLEAN_DELIVERY_CANDIDATE_SIGNAL'}],'EXACTLY_ONE_SIGNAL');
 const status=json(STATUS),candidate=json(CANDIDATE),boundary=json(BOUNDARY),config=json(CONFIG),hard=json(HARD),pred=json(PREDECESSOR);must(status.s2_candidate_implemented===true&&status.candidate_declaration_present===true&&status.externally_effective===false,'STATUS_STATE');authorityFalse(status,'STATUS_AUTH');must(status.database_read_adapter_implemented===true&&status.production_wiring_present===false&&status.runtime_source_delta===1&&status.runtime_executable_delta===1&&status.migration_delta===0,'STATUS_DELTA');
 must(candidate.base_main_sha===base&&candidate.focused_workflow_blob_sha===WORKFLOW_BLOB&&candidate.candidate_transition_performed===true&&candidate.external_effectiveness===false,'CANDIDATE_STATE');must(candidate.s2_registry_registration_merge_sha===BASE&&candidate.trusted_registry_blob_sha===FROZEN[REG],'CANDIDATE_CHAIN');must(candidate.declaration_semantic_snapshot_file_count===9&&candidate.candidate_boundary_file_count===10&&candidate.runtime_source_delta===1&&candidate.migration_delta===0,'CANDIDATE_COUNTS');
 must(boundary.base_main_sha===base&&boundary.changed_file_count===10&&boundary.candidate_transition===true&&boundary.external_effectiveness===false,'BOUNDARY_STATE');eq(boundary.changed_files,FILES,'BOUNDARY_FILES');must(boundary.database_read_adapter_delta===1&&boundary.production_wiring_delta===0&&boundary.migration_delta===0,'BOUNDARY_DELTA');
 must(config.source_table==='facts'&&config.read_only===true&&config.boundary_fields.length===3&&config.exclusion_reasons.length===7,'CONFIG');must(config.future_evidence_leakage_allowed===false&&config.database_write_allowed===false&&config.scheduler_loop_allowed===false&&config.production_wiring_allowed===false,'CONFIG_SAFETY');
 must(hard.required_check_count===12&&hard.future_evidence_leakage===false&&hard.database_write_performed===false&&hard.scheduler_loop_executed===false&&hard.canonical_write_performed===false,'HARD');must(pred.subject_sha===att.subject_sha&&pred.exact_sha_r2_run_id===31007579256&&pred.artifact_id===8930987741&&pred.s2_registry_registration_merge_sha===BASE,'PREDECESSOR');
 const source=read(SOURCE),runtime=read(RUNTIME);for(const token of ['implements EvidenceIngressPortV1','FROM facts','observed_at','ingested_at','available_to_runtime_at','DUPLICATE_SUPERSEDED','FUTURE_EVIDENCE_LEAKAGE_DETECTED','ORDER BY occurred_at ASC, ingested_at ASC, fact_id ASC'])must(source.includes(token),`SOURCE_TOKEN:${token}`);must(!/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)\b/.test(source.match(/`SELECT[\s\S]*?LIMIT \$10`/)?.[0]||''),'SOURCE_SQL_WRITE');for(const token of ['DUPLICATE_SUPERSEDED','OBSERVED_AFTER_BOUNDARY','INGESTED_AFTER_BOUNDARY','AVAILABLE_AFTER_BOUNDARY','FUTURE_EVIDENCE','QUALITY_INELIGIBLE','SCOPE_MISMATCH','deterministic repeated freeze'])must(runtime.includes(token),`RUNTIME_TOKEN:${token}`);
 return{base,head,changed,newSignalList};
}
async function prCheck(context){if((process.env.MCFT_EVENT_NAME||'')!=='pull_request')return{mode:'DELEGATED_TO_TRUSTED_MERGE_GROUP_POLICY'};const n=Number(process.env.MCFT_PR_NUMBER);must(Number.isInteger(n)&&n>0,'PR_NUMBER');const pr=await api(`/pulls/${n}`);must(pr.head.sha===context.head&&pr.base.sha===context.base,'PR_BINDING');const d=declaration(pr.body);eq(Object.keys(d).sort(),['base_head','candidate_field','candidate_head','candidate_value','capability_line','focused_workflow','semantic_snapshot_blobs','semantic_snapshot_files','slice_id','standard_workflow','status_file'],'DECLARATION_KEYS');must(d.capability_line==='MCFT-CAP-09'&&d.slice_id==='MCFT-CAP-09.S2'&&d.status_file===STATUS&&d.candidate_field==='s2_candidate_implemented'&&d.candidate_value==='true','DECLARATION_AUTHORITY');must(d.focused_workflow==='mcft-cap-09-s2-database-evidence-ingress'&&d.standard_workflow==='ci'&&d.candidate_head===context.head&&d.base_head===context.base,'DECLARATION_BINDING');const files=d.semantic_snapshot_files.split(',').map(v=>v.trim()).filter(Boolean),blobs=d.semantic_snapshot_blobs.split(',').map(v=>v.trim()).filter(Boolean);eq(files,SNAP,'DECLARATION_FILES');must(files.every(f=>/^(apps|docs|scripts)\//.test(f)),'DECLARATION_PATH');eq(blobs,files.map(f=>git('rev-parse',`HEAD:${f}`)),'DECLARATION_BLOBS');return{mode:'PR_BODY_VALIDATED',pr_number:n,semantic_snapshot_count:9,workflow_blob_anchored_separately:true};}
(async()=>{try{const context=staticCheck(),pr=await prCheck(context);const result={status:'PASS',change_class:'MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS_CANDIDATE',base_sha:context.base,head_sha:context.head,changed_files:context.changed,exact_new_candidate_signal_count:context.newSignalList.length,database_read_adapter_implemented:true,database_write_performed:false,future_evidence_leakage_blocked:true,scheduler_loop_executed:false,canonical_write_performed:false,production_wiring_present:false,runtime_source_delta:1,runtime_executable_delta:1,migration_delta:0,external_effectiveness:false,declaration:pr,first_legal_next_action:'PROTECTED_MERGE_THEN_EXACT_SHA_R2_ATTESTATION'};write(result);console.log(JSON.stringify(result,null,2));}catch(e){const result={status:'FAIL',base_sha:process.env.MCFT_BASE_SHA||null,error:String(e?.message||e)};write(result);console.error(JSON.stringify(result,null,2));process.exitCode=1;}})();
