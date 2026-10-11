"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {setTimeout:wait}=require("node:timers/promises");
const hash=b=>crypto.createHash("sha256").update(b).digest("hex");
const EVENT="MCFT_CAP09_REAL_PIPELINE_DELAY_V1_RESULT.json";
const kinds=["PROMOTION_QUEUE","PHYSICAL_READBACK"];
function validatePlan(p,context={}){
 assert(p&&typeof p==="object"&&!Array.isArray(p),"PIPELINE_PLAN_REQUIRED");
 assert.deepEqual(Object.keys(p).sort(),["schema_version","mode","run_id","subject_sha","first_base","expected_distinct_bases","promotion_queue_delay_ms","post_commit_readback_delay_ms"].sort(),"PIPELINE_PLAN_FIELDS_INVALID");
 assert.equal(p.schema_version,"geox_mcft_cap09_real_pipeline_delay_v1");
 assert.equal(p.mode,"REAL_ISOLATED_PROMOTION_AND_PHYSICAL_READBACK");
 assert(/^[a-f0-9]{12}$/.test(p.run_id)&&/^[a-f0-9]{40}$/.test(p.subject_sha),"PIPELINE_ID_INVALID");
 assert(Number.isFinite(Date.parse(p.first_base))&&new Date(p.first_base).toISOString()===p.first_base&&p.first_base.endsWith(":00:00.000Z"),"PIPELINE_BASE_INVALID");
 assert.equal(p.expected_distinct_bases,3,"PIPELINE_THREE_BASES_REQUIRED");
 for(const k of ["promotion_queue_delay_ms","post_commit_readback_delay_ms"])
  assert(Number.isSafeInteger(p[k])&&p[k]>=25&&p[k]<=15000,"PIPELINE_DELAY_BUDGET_INVALID:"+k);
 if(context.runId!==undefined)assert.equal(p.run_id,context.runId,"PIPELINE_RUN_MISMATCH");
 if(context.subjectSha!==undefined)assert.equal(p.subject_sha,context.subjectSha,"PIPELINE_SUBJECT_MISMATCH");
 if(context.firstBase!==undefined)assert.equal(p.first_base,context.firstBase,"PIPELINE_BASE_MISMATCH");
 if(context.producerStageTimeoutMs!==undefined){
  assert(Number.isSafeInteger(context.responseDelayMs)&&context.responseDelayMs>=25,"PIPELINE_TRANSPORT_BUDGET_REQUIRED");
  assert(context.producerStageTimeoutMs>=3*(context.responseDelayMs+p.promotion_queue_delay_ms+p.post_commit_readback_delay_ms)+10000,"PIPELINE_PRODUCER_STAGE_BUDGET_INSUFFICIENT");
 }
 return Object.freeze({...p});
}
function normal(file){const s=fs.lstatSync(file);assert(s.isFile()&&!s.isSymbolicLink(),"PIPELINE_REGULAR_FILE_REQUIRED");}
function makeGate({plan,outputDir}){
 const p=validatePlan(plan);assert(path.isAbsolute(outputDir),"PIPELINE_ABSOLUTE_OUTPUT_REQUIRED");
 const s=fs.lstatSync(outputDir);assert(s.isDirectory()&&!s.isSymbolicLink(),"PIPELINE_DIRECTORY_UNSAFE");
 const bases=[0,1,2].map(i=>new Date(Date.parse(p.first_base)+i*3600000).toISOString());
 const filename=i=>"MCFT_CAP09_PIPELINE_DELAY_"+kinds[i%2]+"_"+(Math.floor(i/2)+1)+".json";
 for(let i=0;i<6;i++)assert(!fs.existsSync(path.join(outputDir,filename(i))),"PIPELINE_EVIDENCE_PREEXISTS");
 assert(!fs.existsSync(path.join(outputDir,EVENT)),"PIPELINE_EVIDENCE_PREEXISTS");
 let index=0,sealed=false;const events=[];
 async function invoke(kind,base,operation){
  assert(!sealed,"PIPELINE_ALREADY_SEALED");
  assert(typeof operation==="function","PIPELINE_OPERATION_REQUIRED");
  assert(index<6&&kind===kinds[index%2],"PIPELINE_PHASE_ORDER");
  assert.equal(base,bases[Math.floor(index/2)],"PIPELINE_BASE_ORDER");
  const at=index++;const wanted=kind==="PROMOTION_QUEUE"?p.promotion_queue_delay_ms:p.post_commit_readback_delay_ms;
  const start=process.hrtime.bigint(),began=new Date().toISOString();
  while(Number(process.hrtime.bigint()-start)/1e6<wanted){
   const remaining=wanted-Number(process.hrtime.bigint()-start)/1e6;
   await wait(Math.max(1,Math.min(250,Math.ceil(remaining))));
  }
  const actual=Number(process.hrtime.bigint()-start)/1e6;
  assert(actual>=wanted,"PIPELINE_MONOTONIC_UNDERFLOW");
  const beginOperation=process.hrtime.bigint();
  const result=await operation();
  const operationMs=Number((process.hrtime.bigint()-beginOperation)/1000000n);
  if(kind==="PROMOTION_QUEUE")assert(result&&result.database_fence_commit_succeeded===true&&result.formal_fact_present_count===3&&Array.isArray(result.facts)&&result.facts.length===3,"PIPELINE_FENCED_PROMOTION_REQUIRED");
  else assert(result&&result.status==="PASS"&&result.base_target_t===base&&result.physical_visibility_before_base===true&&result.cursor_advanced===true,"PIPELINE_PHYSICAL_READBACK_REQUIRED");
  const record={schema_version:"geox_mcft_cap09_real_pipeline_delay_event_v1",run_id:p.run_id,subject_sha:p.subject_sha,
   base_target_t:base,kind,requested_ms:wanted,measured_ms:Number(actual.toFixed(3)),operation_ms:operationMs,started_at:began,
   callback_result_contract_verified:true,independent_operator_proof_required:true,production_owner_activation:false};
  const file=path.join(outputDir,filename(at));
  fs.writeFileSync(file,JSON.stringify(record,null,2)+"\n",{flag:"wx",mode:0o600});
  events.push({file,record});
  return result;
 }
 function seal(){
  assert(!sealed&&index===6&&events.length===6,"PIPELINE_EXACT_SIX_EVENTS_REQUIRED");
  const rows=events.map(({file,record},i)=>{
   normal(file);assert.equal(path.basename(file),filename(i),"PIPELINE_EVENT_NAME_CHANGED");
   const bytes=fs.readFileSync(file);assert.deepEqual(JSON.parse(bytes),record,"PIPELINE_EVENT_CHANGED");
   return {filename:filename(i),sha256:hash(bytes),...record};
  });
  const evidence={schema_version:"geox_mcft_cap09_real_pipeline_delay_evidence_v1",status:"PASS",
   run_id:p.run_id,subject_sha:p.subject_sha,first_base:p.first_base,mode:p.mode,operation_event_count:6,
   fenced_promotion_result_checks:3,physical_readback_result_checks:3,physical_waits_measured:true,
   full_six_case_pipeline_delay_qualified:false,formal_v5_arm:false,production_owner_activation:false,events:rows};
  fs.writeFileSync(path.join(outputDir,EVENT),JSON.stringify(evidence,null,2)+"\n",{flag:"wx",mode:0o600});
  sealed=true;return evidence;
 }
 return Object.freeze({promote:(base,fn)=>invoke("PROMOTION_QUEUE",base,fn),
  attest:(base,fn)=>invoke("PHYSICAL_READBACK",base,fn),seal});
}
function verifyEvidence(file,{runId,subjectSha,firstBase,plan}={}){
 const signed=validatePlan(plan,{runId,subjectSha,firstBase});
 normal(file);const raw=fs.readFileSync(file);assert(raw.length<1024*1024,"PIPELINE_PROOF_OVERSIZED");
 const proof=JSON.parse(raw);assert.equal(proof.schema_version,"geox_mcft_cap09_real_pipeline_delay_evidence_v1");
 assert.equal(proof.status,"PASS");assert.equal(proof.run_id,runId);assert.equal(proof.subject_sha,subjectSha);assert.equal(proof.first_base,firstBase);
 assert.equal(proof.mode,signed.mode,"PIPELINE_SIGNED_MODE_CHANGED");
 assert.equal(proof.physical_waits_measured,true,"PIPELINE_WAIT_NOT_MEASURED");
 assert.equal(proof.operation_event_count,6);assert.equal(proof.fenced_promotion_result_checks,3);
 assert.equal(proof.physical_readback_result_checks,3);assert.equal(proof.full_six_case_pipeline_delay_qualified,false);
 assert.equal(proof.production_owner_activation,false);
 assert(Array.isArray(proof.events)&&proof.events.length===6,"PIPELINE_EVENT_COUNT");
 for(let i=0;i<6;i++){
  const row=proof.events[i],kind=kinds[i%2],base=new Date(Date.parse(firstBase)+Math.floor(i/2)*3600000).toISOString();
  const name="MCFT_CAP09_PIPELINE_DELAY_"+kind+"_"+(Math.floor(i/2)+1)+".json";
  assert.equal(row.filename,name);assert.equal(row.kind,kind);assert.equal(row.base_target_t,base);
  assert.equal(row.run_id,runId);assert.equal(row.subject_sha,subjectSha);
  assert.equal(row.callback_result_contract_verified,true);assert.equal(row.production_owner_activation,false);
  const signedWait=kind==="PROMOTION_QUEUE"?signed.promotion_queue_delay_ms:signed.post_commit_readback_delay_ms;
  assert.equal(row.requested_ms,signedWait,"PIPELINE_SIGNED_WAIT_MISMATCH");
  assert(row.measured_ms>=row.requested_ms,"PIPELINE_WAIT_UNDERFLOW");
  assert(/^[a-f0-9]{64}$/.test(row.sha256),"PIPELINE_SHA_INVALID");
  const record={...row};delete record.filename;delete record.sha256;
  const source=path.join(path.dirname(file),name);normal(source);const bytes=fs.readFileSync(source);
  assert.equal(hash(bytes),row.sha256,"PIPELINE_HASH_CHANGED");
  assert.deepEqual(JSON.parse(bytes),record,"PIPELINE_RECORD_CHANGED");
 }
 return {sha256:hash(raw),count:6};
}
module.exports={validatePlan,makeGate,verifyEvidence};
