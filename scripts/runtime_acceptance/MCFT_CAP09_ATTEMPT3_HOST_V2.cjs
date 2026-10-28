"use strict";
/*
 * Attempt-3 Windows Host V2: real six-stage dispatch. The only way into this
 * runner is a genuine signed adopted qualification and one-shot Permit V2,
 * independently rechecked by atomic.prepare(). Never share V1 permit weaksets.
 *
 * No automatic retries, no production activation, no CLI implicit execute.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),crypto=require("node:crypto");
const c=require("../cap09_adoption_v1/contract.cjs");
const atomic=require("./MCFT_CAP09_ATTEMPT3_PERMIT_V2_ATOMIC.cjs");
const stageCap=require("./MCFT_CAP09_STAGE_CAPABILITY_V2.cjs");
const child=require("./MCFT_CAP09_ATTEMPT3_CHILD_STAGE_V2.cjs");
const {dispatchConsumedStageV2}=require("./MCFT_CAP09_PARENT_STAGE_DISPATCH_V2.cjs");
const scheduler=require("./MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs");
const {freshStageLaunch}=require("./MCFT_CAP09_STAGE_START_CLOCK_V1.cjs");
const current=require("./MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const STAGES=Object.freeze([
 ["PRODUCER","MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2_RESULT.json"],
 ["TIMING_1","MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE1_V2_RESULT.json"],
 ["TIMING_2","MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE2_V2_RESULT.json"],
 ["TIMING_3","MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE3_V2_RESULT.json"],
 ["CONTROLLED_DELAY","MCFT_CAP09_REAL_CONTROLLED_DELAY_V1_RESULT.json"],
 ["AGGREGATE","MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V2_RESULT.json"]
]);
function regular(file){const s=fs.lstatSync(file);assert(s.isFile()&&!s.isSymbolicLink(),"V2_HOST_STAGE_SOURCE_UNSAFE");return sha(fs.readFileSync(file));}
function boundStages({releaseRoot,material,plan,outputRoot,firstBase,runId,subjectSha,nonce,ledgerRoot,permitSha,observationsSha,observedFile,environment}){
 scheduler.validateStagePlan(plan);
 assert.deepEqual(STAGES.map(x=>x[0]),scheduler.STAGES,"V2_STAGE_PLAN_DIFFERS_FROM_REAL_SCHEDULER");
 assert(path.isAbsolute(releaseRoot)&&path.isAbsolute(outputRoot)&&path.isAbsolute(ledgerRoot));
 assert.equal(path.resolve(__dirname),path.join(releaseRoot,"scripts","runtime_acceptance"),"V2_HOST_MUST_RUN_INSIDE_INSTALLED_RELEASE");
 assert(typeof firstBase==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:00:00\.000Z$/.test(firstBase)&&
  Number.isFinite(Date.parse(firstBase))&&Date.parse(firstBase)>Date.now(),"V2_FIRST_BASE_NOT_FUTURE");
 assert(/^[a-f0-9]{12}$/.test(runId)&&/^[a-f0-9]{40}$/.test(subjectSha)&&/^[a-f0-9]{64}$/.test(nonce));
 c.hash(permitSha);c.hash(observationsSha);
 assert(typeof material==="object"&&Array.isArray(material.files),"V2_INSTALLED_MATERIAL_REQUIRED");
 const entries=new Map(material.files.map(x=>[x.path,x.sha256]));
 assert(entries.size===material.files.length,"V2_INSTALLED_FILE_IDENTITY_DUPLICATE");
 assert(path.relative(releaseRoot,outputRoot).startsWith(".."+path.sep),"V2_OUTPUT_MUST_NOT_BE_IN_RELEASE");
 assert(!fs.existsSync(outputRoot),"V2_OUTPUT_NOT_FRESH");
 const codeRoot=path.join(releaseRoot,"scripts","runtime_acceptance");
 const expectedFile=new Set(STAGES.map(x=>x[1]));
 assert(expectedFile.size===6,"V2_ARTIFACT_SET_CHANGED");
 const targets=current.isolatedTargets({isolated_run_id:runId,qualification_first_base:firstBase},
  {...environment,MCFT_CURRENT_QUALIFICATION_OUTPUT_DIR:outputRoot,MCFT_QUALIFICATION_FIRST_BASE:firstBase});
 assert.equal(path.resolve(targets.out),path.resolve(outputRoot));
 const node=material.tools?.node?.path;
 assert.equal(fs.realpathSync(process.execPath),node,"V2_NODE_TOOL_NOT_BOUND");
 const tsx=require.resolve("tsx",{paths:[releaseRoot]});
 assert(regular(tsx),"V2_TSX_DEPENDENCY_REQUIRED");
 const envBase={...environment,MCFT_ATTEMPT3_V2_CHILD:"1",MCFT_SUBJECT_SHA:subjectSha,
  MCFT_GOVERNED_RETRY_RUN_ID:runId,
  MCFT_ATTEMPT3_V2_LEDGER_ROOT:ledgerRoot,MCFT_ATTEMPT3_V2_NONCE:nonce,
  MCFT_ATTEMPT3_V2_PERMIT_ENVELOPE_SHA256:permitSha,
  MCFT_ATTEMPT3_V2_OBSERVED_FILE:observedFile,
  MCFT_ATTEMPT3_V2_OBSERVATIONS_SHA256:observationsSha,
  MCFT_QUALIFICATION_FIRST_BASE:firstBase,
  MCFT_CURRENT_QUALIFICATION_OUTPUT_DIR:outputRoot,
  MCFT_CAP09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION:"1",
  MCFT_CAP09_V13_EXACT_HEAD_TIMING_SAMPLE:"1",
  MCFT_TIMING_SAMPLE_DIR:outputRoot,MCFT_TIMING_RUN_ID:String(parseInt(runId,16)),
  MCFT_TIMING_RUN_ATTEMPT:"1",MCFT_TIMING_WAKE_DELAY_MS:"0",
  MCFT_TIMING_JOB_START_SETUP_MS:"0",MCFT_TIMING_LOCAL_LAUNCH_AT_MS:String(Date.now()),
  MCFT_GOVERNED_RETRY_DELAY_TIMEOUT_MS:String(plan.stages[4].timeout_ms)};
 const steps=STAGES.map(([id,artifact],i)=>{
  const script=path.join(codeRoot,child.SCRIPT[id]);
  assert.equal(path.resolve(script),path.join(codeRoot,child.SCRIPT[id]));
  const sourceKey="scripts/runtime_acceptance/"+child.SCRIPT[id];
  const actualSha=regular(script);
  assert.equal(entries.get(sourceKey),actualSha,"V2_STAGE_SCRIPT_NOT_IN_SIGNED_RELEASE:"+id);
  const js=script.endsWith(".cjs");
  const args=js?[script]:["--import","tsx",script];
  const env={...envBase,MCFT_GOVERNED_RETRY_STAGE:id,
    ...(id.startsWith("TIMING_")?{
       MCFT_TIMING_SAMPLE_ID:"sample"+id.at(-1),
       MCFT_TIMING_BASE_TARGET:new Date(Date.parse(firstBase)+(i-1)*3600000).toISOString()
    }:{})};
  return {id,script,artifact:path.join(outputRoot,artifact),
   cwd:releaseRoot,executable:node,args,env};
 });
 assert(steps.length===6);
 return Object.freeze(steps);
}
function checkPreconsume({admission,plan,observed,outputRoot,firstBase,environment}){
 const {adoptionRequest,releaseRoot,permitEnvelope,context}=admission;
 assert(adoptionRequest&&permitEnvelope&&context,"V2_REAL_ADMISSION_REQUIRED");
 assert(permitEnvelope.payload?.scope==="ISOLATED_QUALIFICATION_SINGLE_ATTEMPT_TEST_ONLY","V2_SCOPE_WRONG");
 assert(permitEnvelope.payload?.production_authorized===false,"V2_PRODUCTION_FORBIDDEN");
 assert.equal(c.digest(plan),permitEnvelope.payload.plan_sha256,"V2_STAGE_PLAN_NOT_SIGNED");
 assert.equal(c.digest(observed),permitEnvelope.payload.observations_sha256,"V2_OBSERVATIONS_NOT_SIGNED");
 assert.equal(context.plan_sha256,permitEnvelope.payload.plan_sha256,"V2_CONTEXT_PLAN_NOT_SIGNED");
 assert.equal(context.observations_sha256,permitEnvelope.payload.observations_sha256);
 const root=admission.trust.ledger_root,runId=permitEnvelope.payload.run_id;
 const run=path.join(root,"run-"+runId),nonce=path.join(root,"nonce-"+permitEnvelope.payload.nonce);
 assert(!fs.existsSync(run)&&!fs.existsSync(nonce),"V2_LEDGER_ALREADY_CONSUMED");
 assert(Date.now()+plan.stages.reduce((n,x)=>n+x.timeout_ms,0)+60000 <
  Date.parse(permitEnvelope.payload.expires_at),"V2_SIGNED_PERMIT_INSUFFICIENT_REMAINING_BUDGET");
 assert(!fs.existsSync(outputRoot),"V2_OUTPUT_ALREADY_EXISTS");
 // Each child must run a fixed signed source; no caller-provided script list.
 return boundStages({releaseRoot,material:adoptionRequest.material,plan,outputRoot,firstBase,
  runId,subjectSha:permitEnvelope.payload.subject_sha,nonce:permitEnvelope.payload.nonce,
  ledgerRoot:root,permitSha:sha(require("../governance_acceptance/MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1.cjs").canonical(permitEnvelope)),
  observationsSha:permitEnvelope.payload.observations_sha256,
  observedFile:path.join(outputRoot,"SIGNED_OBSERVED_V2.json"),environment});
}
function persistOnce(file,obj){
 const fd=fs.openSync(file,"wx",0o600);
 try{fs.writeFileSync(fd,JSON.stringify(obj,null,2)+"\n");fs.fsyncSync(fd);}
 finally{fs.closeSync(fd);}
}

function preflight({admission,plan,observed,outputRoot,firstBase,environment=process.env}){
 assert(process.platform==="win32"&&!environment.CI&&!environment.GITHUB_ACTIONS,"V2_HOST_WINDOWS_ONLY");
 assert(!environment.NODE_OPTIONS&&!environment.NODE_PATH,"V2_HOST_NODE_INJECTION_FORBIDDEN");
 const steps=checkPreconsume({admission,plan,observed,outputRoot,firstBase,environment});
 const prepared=atomic.prepare(admission);
 assert.equal(steps.length,6,"V2_STAGE_DISPATCH_NOT_COMPLETE");
 assert.equal(atomic.HOST_V2_STAGE_DISPATCH_ADOPTED,true,"V2_STAGE_ROUTE_NOT_ADOPTED");
 // Read-only preflight: Permit neither consumed nor reissued, no output/DB/S3 mutation.
 return Object.freeze({status:"ATTEMPT3_V2_SIX_STAGE_WINDOWS_PREFLIGHT_PASS_NOT_EXECUTED",
  run_id:prepared.run_id,subject_sha:prepared.subject_sha,
  fixed_stages:steps.map(s=>s.id),permit_consumed:false,original_six_stages_executed:0,
  host_v2_route_implemented:true,production_authorized:false});
}

async function execute({admission,plan,observed,outputRoot,firstBase,environment=process.env}){
 assert(process.platform==="win32"&&!environment.CI&&!environment.GITHUB_ACTIONS,"V2_HOST_WINDOWS_ONLY");
 assert(!environment.NODE_OPTIONS&&!environment.NODE_PATH,"V2_HOST_NODE_INJECTION_FORBIDDEN");
 assert(!environment.MCFT_ATTEMPT3_V2_CHILD&&!environment.MCFT_GOVERNED_RETRY_TICKET,
  "V2_PARENT_CANNOT_BE_CHILD");
 // Everything that can be checked without effects MUST precede Permit burn.
 const steps=checkPreconsume({admission,plan,observed,outputRoot,firstBase,environment});
 const prepared=atomic.prepare(admission); // live main, qualified signatures, resource readback, PG/S3 full chain
 const check=cp.spawnSync(environment.MCFT_PYTHON_EXECUTABLE||"python",[
  path.join(admission.releaseRoot,"apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_scientific_core_v1.py"),"selftest"
 ],{cwd:admission.releaseRoot,timeout:60000,encoding:"utf8",maxBuffer:1024*1024});
 assert.equal(check.status,0,"V2_SCIENTIFIC_SELFTEST_FAILED:"+String(check.stderr||"").slice(-300));
 // Re-evaluate mutable slots and expiry immediately before the irreversible action.
 checkPreconsume({admission,plan,observed,outputRoot,firstBase,environment});
 const consumed=atomic.consumeForQualifiedHost(prepared);
 const authority=stageCap.initializeStageAuthority(consumed,admission.permitEnvelope.payload,
  prepared.permit_envelope_sha256);
 fs.mkdirSync(outputRoot,{mode:0o700});
 persistOnce(path.join(outputRoot,"SIGNED_OBSERVED_V2.json"),observed);
 persistOnce(path.join(outputRoot,"STARTED_ATTEMPT3_V2.json"),{
  schema_version:"MCFT_CAP09_ATTEMPT3_V2_RUN_STARTED",run_id:prepared.run_id,
  subject_sha:prepared.subject_sha,started_at:new Date().toISOString(),
  stage_count:0,permit_consumed:true,production_authorized:false});
 // Six genuine child processes; any failure retains original receipts and stops.
 const result=await scheduler.executeSixStages({authority,plan,steps,
  dispatch:async(a,step)=>dispatchConsumedStageV2(a,freshStageLaunch(step)),
  assertConsumed:atomic.assertConsumed});
 assert.equal(result.stage_count,6,"V2_ACTUAL_SIX_STAGE_COUNT_REQUIRED");
 return {status:"ATTEMPT3_V2_SIX_STAGE_PHYSICAL_RECEIPTS_PRESERVED_NOT_PRODUCTION",
  run_id:prepared.run_id,stage_count:result.stage_count,
  final_receipt_sha256:result.final_receipt_sha256,
  output:outputRoot,production_authorized:false};
}
module.exports={STAGES,boundStages,checkPreconsume,preflight,execute};
