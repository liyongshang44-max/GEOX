"use strict";
// Real elapsed-time probes, exclusively on fresh disposable filesystem scratch.
// These DO NOT inject latency into the real Provider/promotion pipeline.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {setTimeout:wait}=require("node:timers/promises");
const ID=/^[a-f0-9]{12}$/,SHA=/^[a-f0-9]{40}$/;
const PHASES=Object.freeze([
 ["WAKE_DELAY",["wake_delay_ms"]],
 ["JOB_START_SETUP_DELAY",["job_start_setup_ms"]],
 ["PROVIDER_SLOW_PATH",["provider_capture_ms"]],
 ["PROMOTION_QUEUE_SETUP_DELAY",["promotion_queue_and_setup_ms"]],
 ["REHYDRATION_COMMIT_READBACK_DELAY",["rehydration_promotion_commit_readback_ms"]],
 ["CROSS_WAKE_CAPTURE_OVERLAP",["provider_capture_ms","retained_raw_and_candidate_ms"]]
]);
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const DATA_KEYS=["wake_delay_ms","job_start_setup_ms","provider_capture_ms","retained_raw_and_candidate_ms","promotion_queue_and_setup_ms","rehydration_promotion_commit_readback_ms"];
function regular(file){const s=fs.lstatSync(file);assert(s.isFile()&&!s.isSymbolicLink(),"DELAY_INPUT_NOT_REGULAR");}
function deriveDelayPlan({sampleFiles,runId,subjectSha,maximumCaseMs=120000}){
 assert(ID.test(runId)&&SHA.test(subjectSha),"DELAY_RUN_OR_SUBJECT_INVALID");
 assert(Array.isArray(sampleFiles)&&sampleFiles.length===3,"DELAY_EXACT_THREE_SAMPLES_REQUIRED");
 assert(Number.isSafeInteger(maximumCaseMs)&&maximumCaseMs>0&&maximumCaseMs<=3600000,"DELAY_LIMIT_INVALID");
 const values=[],sources=[];
 for(let i=0;i<3;i++){
  const file=sampleFiles[i];assert(path.isAbsolute(file),"DELAY_ABSOLUTE_SAMPLE_REQUIRED");regular(file);
  assert.equal(path.basename(file),`MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE${i+1}_V2_RESULT.json`,"DELAY_SAMPLE_FILENAME_MISMATCH");
  const bytes=fs.readFileSync(file);assert(bytes.length>0&&bytes.length<=1048576,"DELAY_SAMPLE_SIZE_INVALID");
  const row=JSON.parse(bytes);
  assert.equal(row.schema_version,"geox_mcft_cap09_v13_exact_head_timing_sample_v2","DELAY_SAMPLE_SCHEMA_INVALID");
  assert.equal(row.status,"PASS","DELAY_SAMPLE_MUST_PASS");
  assert.equal(row.subject_sha,subjectSha,"DELAY_SAMPLE_SUBJECT_MISMATCH");
  assert.equal(row.sample_id,`sample${i+1}`,"DELAY_SAMPLE_ORDER_INVALID");
  assert.equal(row.measurement_only,true,"DELAY_SAMPLE_MODE_INVALID");
  const phases=row.timing_phases;assert(phases&&typeof phases==="object","DELAY_PHASES_MISSING");
  for(const k of DATA_KEYS)assert(Number.isSafeInteger(phases[k])&&phases[k]>=0,"DELAY_PHASE_VALUE_INVALID:"+k);
  values.push(phases);sources.push({filename:path.basename(file),sha256:sha(bytes)});
 }
 const maxima=Object.fromEntries(DATA_KEYS.map(k=>[k,Math.max(...values.map(v=>v[k]))]));
 const cases=PHASES.map(([id,keys])=>({id,delay_ms:Math.max(1,keys.reduce((n,k)=>n+maxima[k],0))}));
 for(const entry of cases)assert(entry.delay_ms>0&&entry.delay_ms<=maximumCaseMs,"DELAY_REAL_CASE_BUDGET_INVALID:"+entry.id);
 return {schema_version:"geox_mcft_cap09_real_scratch_delay_plan_v1",run_id:runId,subject_sha:subjectSha,
   target:{kind:"DISPOSABLE_ISOLATED_TEST_FIXTURE",name:"mcft_cap09_delay_scratch_"+runId},
   timing_sources:sources,cases};
}
function validateRealDelayPlan(plan){
 assert.deepEqual(Object.keys(plan).sort(),["schema_version","run_id","subject_sha","target","timing_sources","cases"].sort(),"DELAY_PLAN_FIELDS_INVALID");
 assert.equal(plan.schema_version,"geox_mcft_cap09_real_scratch_delay_plan_v1");
 assert(ID.test(plan.run_id)&&SHA.test(plan.subject_sha),"DELAY_IDENTITIES_INVALID");
 assert.deepEqual(plan.target,{kind:"DISPOSABLE_ISOLATED_TEST_FIXTURE",name:"mcft_cap09_delay_scratch_"+plan.run_id},"DELAY_SCRATCH_TARGET_INVALID");
 assert(Array.isArray(plan.timing_sources)&&plan.timing_sources.length===3,"DELAY_TIMING_SOURCE_COUNT_INVALID");
 for(let i=0;i<3;i++){
  const source=plan.timing_sources[i];assert.equal(source.filename,`MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE${i+1}_V2_RESULT.json`);
  assert(/^[a-f0-9]{64}$/.test(source.sha256),"DELAY_SOURCE_HASH_INVALID");
 }
 assert(Array.isArray(plan.cases)&&plan.cases.length===PHASES.length,"DELAY_CASE_COUNT_INVALID");
 for(let i=0;i<PHASES.length;i++){
  const row=plan.cases[i];assert.deepEqual(Object.keys(row).sort(),["delay_ms","id"],"DELAY_CASE_UNKNOWN_FIELDS");
  assert.equal(row.id,PHASES[i][0],"DELAY_CASE_ORDER_INVALID");
  assert(Number.isSafeInteger(row.delay_ms)&&row.delay_ms>0&&row.delay_ms<=3600000,"DELAY_CASE_DURATION_INVALID");
 }
}
async function executeRealDelay({plan,scratchParent,outputFile,stageTimeoutMs}){
 validateRealDelayPlan(plan);
 assert(path.isAbsolute(scratchParent)&&path.isAbsolute(outputFile),"DELAY_ABSOLUTE_TARGET_REQUIRED");
 assert(path.dirname(outputFile)===scratchParent,"DELAY_RESULT_OUTSIDE_ISOLATED_OUTPUT");
 assert(Number.isSafeInteger(stageTimeoutMs)&&stageTimeoutMs>0,"DELAY_STAGE_BUDGET_REQUIRED");
 const stat=fs.lstatSync(scratchParent);assert(stat.isDirectory()&&!stat.isSymbolicLink(),"DELAY_SCRATCH_PARENT_UNSAFE");
 assert(!fs.existsSync(outputFile),"DELAY_OUTPUT_EXISTS");
 const inputFile=(i)=>path.join(scratchParent,plan.timing_sources[i].filename);
 for(let i=0;i<3;i++){regular(inputFile(i));assert.equal(sha(fs.readFileSync(inputFile(i))),plan.timing_sources[i].sha256,"DELAY_TIMING_INPUT_CHANGED");}
 const scratch=path.join(scratchParent,plan.target.name);
 const requested=plan.cases.reduce((sum,x)=>sum+x.delay_ms,0);
 assert(requested+Math.max(1000,Math.ceil(requested*0.2))<stageTimeoutMs,"DELAY_TOTAL_EXCEEDS_SIGNED_STAGE_TIMEOUT");
 fs.mkdirSync(scratch,{mode:0o700}); // Exclusive: no DROP, DELETE, overwrite or cleanup of earlier state.
 const proof=[];
 for(const row of plan.cases){
  const begun=process.hrtime.bigint(),wallStart=new Date().toISOString();
  while(Number(process.hrtime.bigint()-begun)/1e6 <row.delay_ms){
   const remaining=row.delay_ms-Number(process.hrtime.bigint()-begun)/1e6;
   await wait(Math.max(1,Math.min(250,Math.ceil(remaining))));
  }
  const actual=Number(process.hrtime.bigint()-begun)/1e6;
  assert(actual>=row.delay_ms,"DELAY_MONOTONIC_UNDERFLOW");
  const evidence={id:row.id,requested_delay_ms:row.delay_ms,measured_elapsed_ms:Number(actual.toFixed(3)),started_at:wallStart,
    completed_at:new Date().toISOString(),physical_clock_wait_executed:true,provider_pipeline_injected:false};
  fs.writeFileSync(path.join(scratch,row.id+".json"),JSON.stringify(evidence,null,2)+"\n",{flag:"wx",mode:0o600});
  proof.push({...evidence,receipt_sha256:sha(fs.readFileSync(path.join(scratch,row.id+".json")))});
 }
 for(let i=0;i<3;i++){regular(inputFile(i));assert.equal(sha(fs.readFileSync(inputFile(i))),plan.timing_sources[i].sha256,"DELAY_TIMING_INPUT_CHANGED_DURING_WAIT");}
 const result={schema_version:"geox_mcft_cap09_real_controlled_delay_scratch_evidence_v1",status:"PASS",
   run_id:plan.run_id,subject_sha:plan.subject_sha,operation:"REAL_MONOTONIC_CLOCK_DELAY_DISPOSABLE_SCRATCH",
   retained_qualification_database_touched:false,destructive_sql_executed:false,provider_pipeline_injected:false,
   physical_delay_cases_executed:true,formal_timing_qualified:false,production_execution_authorized:false,
   timing_sources:plan.timing_sources,scratch_path:scratch,cases:proof};
 fs.writeFileSync(outputFile,JSON.stringify(result,null,2)+"\n",{flag:"wx",mode:0o600});
 return result;
}
module.exports={PHASES,deriveDelayPlan,validateRealDelayPlan,executeRealDelay};
if(require.main===module){
 (async()=>{
  // Entry is always real-host gated; synthetic E2E tests import pure exports.
  const r4285=process.env.MCFT_R4285_CHILD === "1";
  const v2=process.env.MCFT_ATTEMPT3_V2_CHILD === "1";
  assert(!(r4285&&v2),"R4285_DELAY_LEGACY_CHILD_FLAGS_FORBIDDEN");
  const host=r4285?require("./MCFT_CAP09_R4285_CHILD_STAGE_V1.cjs"):
    v2?require("./MCFT_CAP09_ATTEMPT3_CHILD_STAGE_V2.cjs"):
    require("./MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs");
  const targets=host.childTargets();
  const runId=process.env.MCFT_GOVERNED_RETRY_RUN_ID,subjectSha=process.env.MCFT_SUBJECT_SHA;
  const signedObserved=(r4285||v2)?host.observed():
    host.hostBundle(process.env.MCFT_GOVERNED_RETRY_BUNDLE).bundle.observed;
  const samples=[1,2,3].map(i=>path.join(targets.out,`MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE${i}_V2_RESULT.json`));
  const providerReceipt=require("./MCFT_CAP09_REAL_PROVIDER_RESPONSE_DELAY_V1.cjs").verifyEvidence(
   path.join(targets.out,"MCFT_CAP09_REAL_PROVIDER_RESPONSE_DELAY_V1_RESULT.json"),
   {runId,subjectSha,plan:signedObserved.real_provider_response_delay_plan});
  assert.equal(providerReceipt.count,3,"DELAY_REQUIRES_THREE_REAL_PROVIDER_RESPONSE_EVENTS");
  const pipelineProof=require("./MCFT_CAP09_REAL_PIPELINE_DELAY_V1.cjs").verifyEvidence(
    path.join(targets.out,"MCFT_CAP09_REAL_PIPELINE_DELAY_V1_RESULT.json"),
    {runId,subjectSha,firstBase:process.env.MCFT_QUALIFICATION_FIRST_BASE,plan:signedObserved.real_pipeline_delay_plan});
  assert.equal(pipelineProof.count,6,"DELAY_REQUIRES_SIX_PROMOTION_AND_READBACK_EVENTS");
  const plan=deriveDelayPlan({sampleFiles:samples,runId,subjectSha});
  const limit=Number(process.env.MCFT_GOVERNED_RETRY_DELAY_TIMEOUT_MS);
  const result=await executeRealDelay({plan,scratchParent:targets.out,
   outputFile:path.join(targets.out,"MCFT_CAP09_REAL_CONTROLLED_DELAY_V1_RESULT.json"),stageTimeoutMs:limit});
  console.log(JSON.stringify({status:result.status,physical_delay_cases_executed:true,provider_pipeline_injected:false}));
 })().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
}
