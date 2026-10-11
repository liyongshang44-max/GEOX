"use strict";
// Real response-latency injection in the isolated V13 Evidence factory fetch seam.
// No synthetic response, no Provider endpoint rewrite, no database or object-store writes.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {setTimeout:wait}=require("node:timers/promises");
const RUN=/^[a-f0-9]{12}$/,HEAD=/^[a-f0-9]{40}$/;
const digest=x=>crypto.createHash("sha256").update(x).digest("hex");
const canonicalHour=x=>typeof x==="string"&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x&&x.endsWith(":00:00.000Z");
function validatePlan(p,{runId,subjectSha,firstBase,producerStageTimeoutMs}={}){
 assert(p&&typeof p==="object"&&!Array.isArray(p),"PROVIDER_DELAY_PLAN_REQUIRED");
 assert.deepEqual(Object.keys(p).sort(),["schema_version","run_id","subject_sha","first_base","response_delay_ms","expected_distinct_bases","mode"].sort(),"PROVIDER_DELAY_EXACT_FIELDS");
 assert.equal(p.schema_version,"geox_mcft_cap09_real_provider_response_delay_v1");
 assert.equal(p.mode,"REAL_HTTPS_RESPONSE_BEFORE_CANONICAL_DECODER");
 assert(RUN.test(p.run_id)&&HEAD.test(p.subject_sha)&&canonicalHour(p.first_base),"PROVIDER_DELAY_IDENTITY_INVALID");
 assert(Number.isSafeInteger(p.response_delay_ms)&&p.response_delay_ms>=25&&p.response_delay_ms<=15000,"PROVIDER_DELAY_BUDGET_INVALID");
 assert.equal(p.expected_distinct_bases,3,"PROVIDER_DELAY_THREE_BASES_REQUIRED");
 if(runId!==undefined)assert.equal(p.run_id,runId,"PROVIDER_DELAY_RUN_MISMATCH");
 if(subjectSha!==undefined)assert.equal(p.subject_sha,subjectSha,"PROVIDER_DELAY_SUBJECT_MISMATCH");
 if(firstBase!==undefined)assert.equal(p.first_base,firstBase,"PROVIDER_DELAY_BASE_MISMATCH");
 if(producerStageTimeoutMs!==undefined){
  assert(Number.isSafeInteger(producerStageTimeoutMs),"PROVIDER_DELAY_STAGE_BUDGET_REQUIRED");
  assert(producerStageTimeoutMs>=p.response_delay_ms*3+5000,"PROVIDER_DELAY_NOT_WITHIN_STAGE_BUDGET");
 }
 return Object.freeze({...p});
}
function makeGate({plan,outputDir,realFetch,allowLoopbackTest=false}){
 const p=validatePlan(plan);
 assert(path.isAbsolute(outputDir)&&typeof realFetch==="function","PROVIDER_DELAY_OUTPUT_AND_FETCH_REQUIRED");
 const stat=fs.lstatSync(outputDir);assert(stat.isDirectory()&&!stat.isSymbolicLink(),"PROVIDER_DELAY_OUTPUT_UNSAFE");
 const targets=[0,1,2].map(i=>new Date(Date.parse(p.first_base)+i*3600000).toISOString());
 for(const file of ["MCFT_CAP09_REAL_PROVIDER_RESPONSE_DELAY_V1_RESULT.json",...([1,2,3].map(i=>"MCFT_CAP09_PROVIDER_RESPONSE_DELAY_"+i+".json"))])
  assert(!fs.existsSync(path.join(outputDir,file)),"PROVIDER_DELAY_OLD_EVIDENCE_FORBIDDEN");
 const events=new Map(),reserved=new Set();let active=null,sealed=false;
 function activateBase(base){
  assert(!sealed&&targets.includes(base)&&!reserved.has(base),"PROVIDER_DELAY_BASE_REPLAY_FORBIDDEN");
  assert(active===null,"PROVIDER_DELAY_PRIOR_BASE_UNSEALED");
  active=base;
 }
 function assertBaseCaptured(base){
  assert.equal(active,base,"PROVIDER_DELAY_ACTIVE_BASE_MISMATCH");
  assert(events.has(base),"PROVIDER_DELAY_REAL_FETCH_NOT_OBSERVED");
  active=null;
 }
 async function fetchWithDelay(input,init){
  const url=new URL(typeof input==="string"?input:input.url);
  assert(!sealed&&active!==null,"PROVIDER_DELAY_UNBOUND_TRANSPORT");
  assert(!url.username&&!url.password&&!url.hash,"PROVIDER_DELAY_UNSAFE_LOCATOR");
  if(allowLoopbackTest){assert(url.protocol==="http:"&&["127.0.0.1","localhost","[::1]"].includes(url.hostname),"PROVIDER_DELAY_TEST_LOOPBACK_ONLY");}
  else assert(url.protocol==="https:"&&!/^(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(url.hostname),"PROVIDER_DELAY_HTTPS_EXTERNAL_REQUIRED");
  const base=active;
  // The first genuine request of each base is delayed; following member requests
  // use the unmodified Provider transport and are NOT counted as delayed events.
  if(reserved.has(base))return realFetch(input,init);
  reserved.add(base);
  const start=process.hrtime.bigint();
  const response=await realFetch(input,init);
  assert(response&&typeof response.status==="number"&&typeof response.arrayBuffer==="function","PROVIDER_DELAY_REAL_RESPONSE_REQUIRED");
  assert(response.status>=200&&response.status<300,"PROVIDER_DELAY_UNSUCCESSFUL_HTTP_STATUS");
  const fetched=process.hrtime.bigint();
  while(Number(process.hrtime.bigint()-fetched)/1e6 < p.response_delay_ms){
   const remaining=p.response_delay_ms-Number(process.hrtime.bigint()-fetched)/1e6;
   await wait(Math.max(1,Math.min(250,Math.ceil(remaining))),undefined,{signal:init?.signal});
  }
  const finished=process.hrtime.bigint();
  const elapsed=Number(finished-fetched)/1e6;
  assert(elapsed>=p.response_delay_ms,"PROVIDER_DELAY_MONOTONIC_UNDERFLOW");
  const record={schema_version:"geox_mcft_cap09_real_provider_response_delay_event_v1",run_id:p.run_id,subject_sha:p.subject_sha,
   base_target_t:base,original_response_status:response.status,provider_hostname:url.hostname,
   real_fetch_returned:true,original_response_unmodified:true,
   response_wait_requested_ms:p.response_delay_ms,response_wait_observed_ms:Number(elapsed.toFixed(3)),
   fetch_plus_response_wait_ms:Number((Number(finished-start)/1e6).toFixed(3)),
   request_path_sha256:digest(url.pathname+url.search),provider_response_body_consumed_by_gate:false};
  const file=path.join(outputDir,"MCFT_CAP09_PROVIDER_RESPONSE_DELAY_"+String(targets.indexOf(base)+1)+".json");
  fs.writeFileSync(file,JSON.stringify(record,null,2)+"\n",{flag:"wx",mode:0o600});
  events.set(base,{file,record});
  return response;
 }
 function seal(){
  assert(!sealed&&active===null&&events.size===3,"PROVIDER_DELAY_EXACT_THREE_REAL_RESPONSES_REQUIRED");
  const rows=targets.map(base=>{const e=events.get(base);assert(e,"PROVIDER_DELAY_MISSING_BASE_EVENT");
   const bytes=fs.readFileSync(e.file);assert.deepEqual(JSON.parse(bytes),e.record,"PROVIDER_DELAY_EVENT_MUTATED");
   return {base_target_t:base,event_sha256:digest(bytes),...e.record};});
  const output={schema_version:"geox_mcft_cap09_real_provider_response_delay_evidence_v1",status:"PASS",
    run_id:p.run_id,subject_sha:p.subject_sha,mode:p.mode,expected_distinct_bases:3,
    actual_real_https_response_delay_events:3,provider_http_response_used:true,
    latency_injected_into_actual_provider_transport:true,formal_timing_qualified:false,
    full_six_case_pipeline_delay_qualified:false,production_owner_activation:false,events:rows};
  fs.writeFileSync(path.join(outputDir,"MCFT_CAP09_REAL_PROVIDER_RESPONSE_DELAY_V1_RESULT.json"),JSON.stringify(output,null,2)+"\n",{flag:"wx",mode:0o600});
  sealed=true;return output;
 }
 return Object.freeze({activateBase,assertBaseCaptured,fetch_impl:fetchWithDelay,seal});
}
function verifyEvidence(file,{runId,subjectSha}={}){
 const raw=fs.readFileSync(file);assert(raw.length<=1024*1024,"PROVIDER_DELAY_EVIDENCE_OVERSIZED");
 const e=JSON.parse(raw);assert.equal(e.schema_version,"geox_mcft_cap09_real_provider_response_delay_evidence_v1");
 assert.equal(e.status,"PASS");assert.equal(e.run_id,runId);assert.equal(e.subject_sha,subjectSha);
 assert.equal(e.actual_real_https_response_delay_events,3);assert.equal(e.provider_http_response_used,true);
 assert.equal(e.latency_injected_into_actual_provider_transport,true);
 assert.equal(e.full_six_case_pipeline_delay_qualified,false);
 assert(Array.isArray(e.events)&&e.events.length===3);
 for(let i=0;i<3;i++){
  const row=e.events[i];assert(row.real_fetch_returned&&row.original_response_unmodified);
  assert(row.response_wait_observed_ms>=row.response_wait_requested_ms);
  assert(Number.isSafeInteger(row.original_response_status)&&row.original_response_status>=200&&row.original_response_status<300,"PROVIDER_DELAY_UNSUCCESSFUL_STATUS_CLAIM");
  assert(typeof row.event_sha256==="string"&&/^[a-f0-9]{64}$/.test(row.event_sha256));
  const source=path.join(path.dirname(file),"MCFT_CAP09_PROVIDER_RESPONSE_DELAY_"+(i+1)+".json");
  assert.equal(digest(fs.readFileSync(source)),row.event_sha256,"PROVIDER_DELAY_EVENT_TAMPERED");
 }
 return {sha256:digest(raw),count:3};
}
module.exports={validatePlan,makeGate,verifyEvidence};
