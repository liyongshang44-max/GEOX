#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');

const ROOT=process.cwd();
const OUT_DIR=path.join(ROOT,'acceptance-output');
const CONTROL_OUT=path.join(OUT_DIR,'MCFT_CAP_09_S0_EXACT_SHA_CONTROL_PLANE_RESULT.json');
const ATTEST_OUT=path.join(OUT_DIR,'MCFT_CAP_09_S0_EXACT_SHA_ATTESTATION.json');
const SUBJECT='7381d0f8ac56fe9f75fd78ce189920cb9ed99bf4';
const BASE='bc6515aa1ddb93d23790664a87b4ddb44604ae1d';
const CANDIDATE='89921e290bb1dff494f02e3e2b22a5bd131a9354';
const TREE='6a96aa7bdac5619213036327c9a33726c07e753e';
const PR_NUMBER=2861;
const FOCUSED_RUN=30977201077;
const CI_RUN=30977201038;
const WORKFLOW='.github/workflows/mcft-cap-09-s0-exact-sha-attestation.yml';
const VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S0_EXACT_SHA_ATTESTATION_V1.cjs';
const CONTROL=[WORKFLOW,VALIDATOR].sort();
const AUTH_WORKFLOW='.github/workflows/mcft-cap-09-s0-authorization.yml';
const CURRENT='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json';
const BOUNDARY='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-AUTHORIZATION-CANDIDATE-BOUNDARY-V1.json';
const RECORD='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-AUTHORIZATION-CANDIDATE-V1.json';
const STATUS='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-DELIVERY-STATUS-V1.json';
const AUTH_VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S0_AUTHORIZATION.cjs';
const CANDIDATE_FILES=[AUTH_WORKFLOW,CURRENT,BOUNDARY,RECORD,STATUS,AUTH_VALIDATOR].sort();
const SNAPSHOT=[CURRENT,BOUNDARY,RECORD,STATUS,AUTH_VALIDATOR];
const BLOBS={
 [AUTH_WORKFLOW]:'44efb24c38f0a30ac9f99cf0a2d363498d73a465',
 [CURRENT]:'1e9a33e88c4530b65ac3084e2b7de32649b920c1',
 [BOUNDARY]:'872770499df5027e711466178ca280f602954ef4',
 [RECORD]:'ae5e0fbea4f677c41ee22dd8a07b4029a8ef8bd7',
 [STATUS]:'ad52cd4d09c49142cbbb412941bfba6f6e153fc9',
 [AUTH_VALIDATOR]:'cd01e965db5242973726338db4adfcc20a94e7ff'
};
const git=(...a)=>cp.execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();
const text=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const jsonAt=(ref,f)=>JSON.parse(git('show',`${ref}:${f}`));
const must=(v,c)=>{if(!v)throw new Error(c);};
const eq=(a,b,c)=>{try{assert.deepEqual(a,b);}catch{throw new Error(`${c}:${JSON.stringify(a)}`);}};
const write=(f,v)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n');};
const changed=(a,b)=>git('diff','--name-only',`${a}...${b}`).split(/\r?\n/).filter(Boolean).sort();
function canonical(v){if(Array.isArray(v))return`[${v.map(canonical).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;return JSON.stringify(v);}
const digest=v=>`sha256:${crypto.createHash('sha256').update(Buffer.from(canonical(v))).digest('hex')}`;
async function api(endpoint){const token=process.env.GITHUB_TOKEN,repo=process.env.GITHUB_REPOSITORY;must(token,'GITHUB_TOKEN_REQUIRED');must(repo,'GITHUB_REPOSITORY_REQUIRED');const r=await fetch(`https://api.github.com/repos/${repo}${endpoint}`,{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'mcft-cap09-s0-exact-sha'}});const body=await r.text();must(r.ok,`GITHUB_API_${r.status}:${endpoint}:${body.slice(0,240)}`);return body?JSON.parse(body):{};}
function declaration(body){const marker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');const open=`<!-- ${marker}\n`,t=String(body||''),i=t.indexOf(open);must(i>=0,'DECLARATION_MISSING');must(t.indexOf(open,i+open.length)<0,'DECLARATION_DUPLICATE');const e=t.indexOf('-->',i+open.length);must(e>=0,'DECLARATION_TERMINATOR');const out={};for(const raw of t.slice(i+open.length,e).split(/\r?\n/)){const line=raw.trim();if(!line)continue;const n=line.indexOf('=');must(n>0,`DECLARATION_LINE:${line}`);out[line.slice(0,n).trim()]=line.slice(n+1).trim();}return out;}
function controlCandidate(){
 const base=process.env.MCFT_BASE_SHA,head=git('rev-parse','HEAD');must(base===SUBJECT,`CONTROL_BASE:${base}`);eq(changed(base,head),CONTROL,'CONTROL_BOUNDARY');must(Number(git('rev-list','--count',`${base}..${head}`))===1,'CONTROL_COMMIT_COUNT');
 const source=text(WORKFLOW),validator=text(VALIDATOR);const marker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');must(!source.includes(marker)&&!validator.includes(marker),'DECLARATION_MARKER_LITERAL');
 for(const token of ['name: mcft-cap-09-s0-exact-sha-attestation','pull_request:','push:','branches: [main]',SUBJECT,'--control-plane-candidate','--attest','mcft_attestation_retention_store_v1.cjs --upload-readback','mcft-cap-09/s0-exact-sha-attestation'])must(source.includes(token),`WORKFLOW_TOKEN:${token}`);
 for(const f of CANDIDATE_FILES)must(git('rev-parse',`${base}:${f}`)===git('rev-parse',`${head}:${f}`),`CANDIDATE_AUTHORITY_DRIFT:${f}`);
 const current=jsonAt(base,CURRENT),status=jsonAt(base,STATUS);must(current.status==='AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE','CURRENT_STATUS');must(status.status==='S0_AUTHORIZATION_CANDIDATE_TRACKED_NOT_EFFECTIVE'&&status.externally_effective===false,'DELIVERY_STATUS');
 const result={status:'PASS',change_class:'MCFT_CAP_09_S0_EXACT_SHA_R2_CONTROL_PLANE_CANDIDATE',base_sha:base,head_sha:head,changed_files:CONTROL,attestation_subject_sha:SUBJECT,candidate_authority_files_unchanged:true,external_effectiveness:false,runtime_source_delta:0,registry_delta:0,taskbook_delta:0,first_legal_next_action:'PROTECTED_MERGE_TRIGGERS_EXACT_SHA_R2_ATTESTATION'};write(CONTROL_OUT,result);console.log(JSON.stringify(result,null,2));
}
async function attest(){
 const subject=process.env.MCFT_SUBJECT_SHA;must(subject===SUBJECT,`SUBJECT:${subject}`);const controlHead=git('rev-parse','HEAD');git('cat-file','-e',`${subject}^{commit}`);git('merge-base','--is-ancestor',subject,controlHead);
 const parents=git('rev-list','--parents','-n','1',subject).split(/\s+/);eq(parents,[subject,BASE,CANDIDATE],'MERGE_PARENTS');const candidateTree=git('rev-parse',`${CANDIDATE}^{tree}`),mergeTree=git('rev-parse',`${subject}^{tree}`);must(candidateTree===TREE&&mergeTree===TREE,'TREE_IDENTITY');eq(changed(BASE,CANDIDATE),CANDIDATE_FILES,'CANDIDATE_BOUNDARY');eq(changed(subject,controlHead),CONTROL,'POSTMERGE_CONTROL_BOUNDARY');
 for(const [f,b] of Object.entries(BLOBS)){must(git('rev-parse',`${CANDIDATE}:${f}`)===b,`CANDIDATE_BLOB:${f}`);must(git('rev-parse',`${subject}:${f}`)===b,`MERGE_BLOB:${f}`);}
 const current=jsonAt(subject,CURRENT),boundary=jsonAt(subject,BOUNDARY),record=jsonAt(subject,RECORD),status=jsonAt(subject,STATUS);must(current.status==='AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE'&&current.effectiveness_condition==='PRESENT_ON_PROTECTED_MAIN_AND_EXACT_SHA_R2_ATTESTATION_PASS','CURRENT_AUTHORITY');must(boundary.base_main_sha===BASE&&boundary.changed_file_count===6&&boundary.candidate_transition===true,'BOUNDARY_RECORD');must(record.base_main_sha===BASE&&record.candidate_transition_performed===true&&record.external_effectiveness===false,'CANDIDATE_RECORD');must(status.record_status==='S0_AUTHORIZATION_CANDIDATE_TRACKING_NON_AUTHORITY'&&status.s0_candidate_implemented===false&&status.candidate_transition_tracked===true,'TRACKING_PROJECTION');
 const pulls=await api(`/commits/${subject}/pulls`);const pr=pulls.find(x=>x.number===PR_NUMBER&&x.merge_commit_sha===subject&&x.head?.sha===CANDIDATE&&x.base?.sha===BASE);must(pr,'MERGED_PR_NOT_FOUND');const d=declaration(pr.body);must(d.capability_line==='MCFT-CAP-09'&&d.slice_id==='MCFT-CAP-09.S0'&&d.status_file===CURRENT&&d.candidate_field==='status'&&d.candidate_value==='AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE','DECLARATION_AUTHORITY');must(d.candidate_head===CANDIDATE&&d.base_head===BASE&&d.focused_workflow==='mcft-cap-09-s0-authorization'&&d.standard_workflow==='ci','DECLARATION_BINDING');eq(d.semantic_snapshot_files.split(','),SNAPSHOT,'DECLARATION_FILES');eq(d.semantic_snapshot_blobs.split(','),SNAPSHOT.map(f=>BLOBS[f]),'DECLARATION_BLOBS');
 const focused=await api(`/actions/runs/${FOCUSED_RUN}`);must(focused.head_sha===CANDIDATE&&focused.event==='pull_request'&&focused.run_attempt===1&&focused.status==='completed'&&focused.conclusion==='success','FOCUSED_RUN');const focusedJobs=await api(`/actions/runs/${FOCUSED_RUN}/jobs?per_page=100`);const candidateJobs=focusedJobs.jobs.filter(j=>j.name==='s0-authorization-candidate');must(candidateJobs.length===1&&candidateJobs[0].conclusion==='success','FOCUSED_JOB');const focusedArts=await api(`/actions/runs/${FOCUSED_RUN}/artifacts?per_page=100`);const expectedName=`mcft-cap-09-s0-authorization-${CANDIDATE}`;const arts=focusedArts.artifacts.filter(a=>a.name===expectedName&&a.expired===false);must(arts.length===1,'FOCUSED_ARTIFACT');must(/^sha256:[0-9a-f]{64}$/.test(arts[0].digest||''),'FOCUSED_ARTIFACT_DIGEST');
 const ci=await api(`/actions/runs/${CI_RUN}`);must(ci.head_sha===CANDIDATE&&ci.event==='pull_request'&&ci.run_attempt===1&&ci.status==='completed'&&ci.conclusion==='success','CI_RUN');const ciJobs=await api(`/actions/runs/${CI_RUN}/jobs?per_page=100`);for(const name of ['build-test','acceptance']){const jobs=ciJobs.jobs.filter(j=>j.name===name);must(jobs.length===1&&jobs[0].conclusion==='success',`CI_JOB:${name}`);}
 const artifact={schema_version:'geox_mcft_cap09_s0_exact_sha_r2_attestation_v1',status:'PASS',capability_line_id:'MCFT-CAP-09',slice_id:'MCFT-CAP-09.S0',subject_commit:subject,subject_sha:subject,merge_commit_sha:subject,base_main_sha:BASE,candidate_pr_number:PR_NUMBER,candidate_head_sha:CANDIDATE,candidate_tree_sha:candidateTree,merge_tree_sha:mergeTree,candidate_to_merge_tree_delta:0,control_plane_merge_sha:controlHead,control_plane_changed_files:CONTROL,candidate_focused_workflow_run_id:FOCUSED_RUN,candidate_focused_workflow_run_attempt:focused.run_attempt,candidate_focused_artifact_id:arts[0].id,candidate_focused_artifact_digest:arts[0].digest,standard_ci_run_id:CI_RUN,standard_ci_run_attempt:ci.run_attempt,s0_effectiveness_resolution:{protected_merge_verified:true,exact_merge_subject_verified:true,candidate_tree_equals_merge_tree:true,declaration_snapshot_verified:true,registered_candidate_transition_count:1,new_candidate_signal_count:1,delivery_status_non_authority_tracking_projection:true,focused_workflow_pass:true,standard_ci_build_test_pass:true,standard_ci_acceptance_pass:true},effective_authority:{s0_authorization_effective:true,effective_status:'IN_PROGRESS',effective_next_slice:'S1',s1_candidate_declaration_authorized:true,s1_authorized_scope:'ADAPTER_CONTRACTS_AND_CONFIGURATION_FREEZE_ONLY',implementation_authorized:false,runtime_source_authorized:false,live_ingestion_authorized:false,background_scheduler_authorized:false,canonical_write_authorized:false,public_http_writer_authorized:false,model_activation_authorized:false,controlled_action_authorized:false},retention_contract:{level:'R2',days:730,upload_readback_required:true,locked_version_delete_denied_required:true,retention_execution_follows_this_canonical_artifact:true},postmerge_ssot_writeback:false,nonclaims:['NO_RUNTIME_IMPLEMENTATION_AUTHORITY','NO_LIVE_INGESTION','NO_BACKGROUND_SCHEDULER','NO_CANONICAL_WRITE','NO_PUBLIC_HTTP_WRITER','NO_MODEL_ACTIVATION','NO_CONTROLLED_ACTION','NO_MCFT_CAP_09_COMPLETION']};artifact.semantic_artifact_digest=digest(artifact);write(ATTEST_OUT,artifact);console.log(JSON.stringify({status:'PASS',subject_sha:subject,candidate_to_merge_tree_delta:0,focused_run_id:FOCUSED_RUN,focused_artifact_id:arts[0].id,ci_run_id:CI_RUN,s0_authorization_effective:true},null,2));
}
(async()=>{const mode=process.argv[2];try{if(mode==='--control-plane-candidate')controlCandidate();else if(mode==='--attest')await attest();else throw new Error(`MODE_INVALID:${mode}`);}catch(error){const out={status:'FAIL',mode:mode||null,error:String(error?.message||error)};write(mode==='--attest'?ATTEST_OUT:CONTROL_OUT,out);console.error(JSON.stringify(out,null,2));process.exitCode=1;}})();
