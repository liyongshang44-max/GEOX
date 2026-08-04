#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const https=require('node:https');
const cp=require('node:child_process');
const SUBJECT='ce9d6b4df8c708c0d4a99bb24846e1bc44b3cf59';
const RUNS={run_a:{run_id:30845476698,artifact_id:8868535301},run_b:{run_id:30877450717,artifact_id:8880057024}};
const gitBlob=p=>cp.execFileSync('git',['rev-parse',`HEAD:${p}`],{encoding:'utf8'}).trim();
function gate(){
 assert.equal(process.env.GITHUB_EVENT_NAME,'workflow_dispatch');
 assert.equal(Number(process.env.GITHUB_RUN_ATTEMPT),1);
 const p=String(process.env.MCFT_EXECUTION_AUTHORITY_PATH||'').trim();assert.ok(p);
 const a=JSON.parse(fs.readFileSync(p,'utf8'));
 assert.equal(a.schema_version,'geox_mcft_cap08_s6_formal_cross_run_comparator_authority_v1');
 assert.equal(a.record_status,'FORMAL_CROSS_RUN_COMPARATOR_AUTHORIZED');
 for(const [k,v] of Object.entries({authority_effective:true,comparator_execution_authorized:true,maximum_execution_count:1,required_execution_attempt:1,rerun_authorized:false,duplicate_execution_authorized:false,authority_reuse_authorized:false}))assert.equal(a[k],v,k);
 assert.equal(a.exact_subject_sha,process.env.MCFT_EXACT_SUBJECT_SHA);assert.equal(a.exact_subject_sha,SUBJECT);
 assert.equal(a.comparator_execution_id,process.env.MCFT_COMPARATOR_EXECUTION_ID);
 for(const x of [a.execution_workflow,a.execution_control,a.implementation,{path:a.implementation.normalization_path,blob_sha:a.implementation.normalization_blob_sha}])assert.equal(gitBlob(x.path),x.blob_sha,x.path);
 console.log(`MCFT_CAP08_FORMAL_COMPARATOR_AUTHORITY=${p}`);
 console.log(`MCFT_CAP08_FORMAL_RUN_A_BUNDLE_FILE=${a.inputs.run_a.bundle_file}`);
 console.log(`MCFT_CAP08_FORMAL_RUN_B_BUNDLE_FILE=${a.inputs.run_b.bundle_file}`);
}
function get(path){
 const token=process.env.GH_TOKEN;assert.ok(token);
 return new Promise((resolve,reject)=>{const req=https.request({hostname:'api.github.com',path:`/repos/${process.env.GITHUB_REPOSITORY}${path}`,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'mcft-cap08-formal-comparator'}},res=>{let s='';res.on('data',d=>s+=d);res.on('end',()=>res.statusCode>=200&&res.statusCode<300?resolve(JSON.parse(s)):reject(new Error(`HTTP_${res.statusCode}:${s}`)))});req.on('error',reject);req.end()});
}
async function audit(){
 const out={schema_version:'geox_mcft_cap08_s6_formal_cross_run_comparator_input_audit_v1',status:'PASS',exact_subject_sha:SUBJECT};
 for(const [key,spec] of Object.entries(RUNS)){
   const run=await get(`/actions/runs/${spec.run_id}`);const artifacts=(await get(`/actions/runs/${spec.run_id}/artifacts?per_page=100`)).artifacts||[];const item=artifacts.find(x=>x.id===spec.artifact_id);assert.ok(item);
   assert.equal(run.event,'workflow_dispatch');assert.equal(run.conclusion,'success');assert.equal(run.run_attempt,1);assert.equal(run.head_sha,SUBJECT);
   out[key]={workflow_run_id:spec.run_id,workflow_run_attempt:1,event:run.event,conclusion:run.conclusion,head_sha:run.head_sha,artifact_id:spec.artifact_id,artifact_digest:item.digest};
 }
 const p=String(process.env.MCFT_COMPARATOR_INPUT_AUDIT_OUTPUT||'').trim();assert.ok(p);fs.mkdirSync(require('node:path').dirname(p),{recursive:true});fs.writeFileSync(p,`${JSON.stringify(out,null,2)}\n`);console.log(JSON.stringify(out,null,2));
}
const mode=process.argv[2];if(mode==='gate')gate();else if(mode==='audit')audit().catch(e=>{console.error(e);process.exitCode=1});else throw new Error('MODE_REQUIRED');
