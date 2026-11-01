"use strict";
/*
 * R4285 Windows Host Admission V2 — independent successor CLI.
 * Real signatures, Owner, Permit, native GitHub CTO decision and PG/S3 required.
 * No signer, no Permit issuer, no offline/mock authorization and no retry.
 * The historical V1 entrypoint and child scripts are never modified.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const cp=require("node:child_process"),crypto=require("node:crypto");
const v1=require("./MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs");
const v2=require("./MCFT_CAP09_R4285_ADMISSION_V2.cjs");
const host=require("./MCFT_CAP09_R4285_HOST_ADMISSION_V2.cjs");
const atomic=require("./MCFT_CAP09_R4285_PERMIT_ATOMIC_V2.cjs");
const stage=require("./MCFT_CAP09_R4285_STAGE_CAPABILITY_V2.cjs");
const dispatch=require("./MCFT_CAP09_R4285_PARENT_STAGE_DISPATCH_V2.cjs");
const scheduler=require("./MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs");
const lineage=require("../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs");
const native=require("../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V1.cjs");
const contract=require("../cap09_adoption_v1/contract.cjs");
const {freshStageLaunch}=require("./MCFT_CAP09_STAGE_START_CLOCK_V1.cjs");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const HEX64=/^[a-f0-9]{64}$/;
const READY_KEYS=["source_root","release_root","native_adoption_input_file",
 "plan_file","observations_file","first_base","cto_intent_file",
 "cto_intent_comment_id","nonce","resource_scope_sha256"];
const FULL_KEYS=[...v1.INPUTS,"cto_intent_file","cto_intent_comment_id",
 "final_execution_approval_file"];
const EXECUTABLE_MODES=Object.freeze(["--readiness-only","--preflight-only","--execute"]);
function fileBytes(p,max=16*1024*1024){
 assert(typeof p==="string"&&path.isAbsolute(p),"V2_CLI_ABSOLUTE_FILE");
 let current=path.resolve(p);
 for(let n=0;n<100;n++){
  const st=fs.lstatSync(current);
  assert(!st.isSymbolicLink(),"V2_CLI_SYMLINK");
  if(n===0)assert(st.isFile()&&st.size>0&&st.size<=max,"V2_CLI_UNSAFE_FILE");
  const parent=path.dirname(current);if(parent===current)break;current=parent;
 }
 return fs.readFileSync(p);
}
function json(p){return JSON.parse(fileBytes(p).toString("utf8").replace(/^\uFEFF/,""));}
function keys(x,list){
 assert(x&&typeof x==="object"&&!Array.isArray(x),"V2_CLI_INPUT_OBJECT");
 assert.deepEqual(Object.keys(x).sort(),list.slice().sort(),"V2_CLI_INPUT_FIELDS");
}
function checkInputs(i,mode){
 assert(EXECUTABLE_MODES.includes(mode),"V2_CLI_UNSUPPORTED_MODE");
 keys(i,mode==="--readiness-only"?READY_KEYS:FULL_KEYS);
 for(const [k,v] of Object.entries(i)){
  if(k==="cto_intent_comment_id"){
   assert(Number.isSafeInteger(v)&&v>0,"V2_CLI_CTO_COMMENT_ID");continue;
  }
  if(k==="first_base"){
   assert(/^\d{4}-\d\d-\d\dT\d\d:00:00\.000Z$/.test(v)
    &&new Date(v).toISOString()===v,"V2_CLI_FIRST_BASE");continue;
  }
  if(k==="nonce"||k==="resource_scope_sha256"){
   assert(HEX64.test(v),"V2_CLI_CONTEXT_DIGEST:"+k);continue;
  }
  assert(typeof v==="string"&&path.isAbsolute(v),"V2_CLI_ABSOLUTE_PATH:"+k);
 }
 if(mode!=="--readiness-only")
  v1.checkInput(Object.fromEntries(v1.INPUTS.map(k=>[k,i[k]])),false);
 return i;
}
function basicContext({i,adoption,nativeInput,plan,observed,nonce,resource_scope_sha256}){
 const ctx={run_id:v2.RUN,subject_sha:adoption.subject_sha,host_id:v2.HOST,nonce,
  authority_pr_number:v2.AUTHORITY_PR,first_base:i.first_base,
  plan_sha256:contract.digest(plan),observations_sha256:contract.digest(observed),
  material_digest:adoption.material_digest,
  release_binding_sha256:sha(fileBytes(nativeInput.release_binding_file)),
  resource_scope_sha256,adoption_expires_at:json(nativeInput.adoption_envelope_file).payload.expires_at,
  total_stage_budget_ms:plan.stages.reduce((n,row)=>n+row.timeout_ms,0),
  plan};
 v2.frozenBudget(plan,observed,ctx);
 return ctx;
}
function checkScience(source,env=process.env){
 const py=env.MCFT_PYTHON_EXECUTABLE||"python";
 const script=path.join(source,"apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_scientific_core_v1.py");
 const check=cp.spawnSync(py,[script,"selftest"],{
  cwd:source,timeout:60000,encoding:"utf8",windowsHide:true,maxBuffer:1024*1024});
 assert.equal(check.status,0,"V2_SCIENCE_SELFTEST_FAILED");
 return true;
}
async function readiness(i,env=process.env){
 v1.hostOnly(env);checkInputs(i,"--readiness-only");
 const ni=json(i.native_adoption_input_file);
 assert.equal(ni.source_root,i.source_root);
 assert.equal(path.resolve(ni.release_root),path.resolve(i.release_root));
 const adoption=native.checkNativeAdoption(ni);
 assert(native.isNativeVerified(adoption),"V2_NATIVE_ADOPTION_NOT_LIVE");
 const plan=json(i.plan_file),observed=json(i.observations_file);
 const ctx=basicContext({i,adoption,nativeInput:ni,plan,observed,
  nonce:i.nonce,resource_scope_sha256:i.resource_scope_sha256});
 lineage.verifyExactMain(i.source_root,ctx.subject_sha);
 const raw=fileBytes(i.cto_intent_file,8192);
 const intent=v2.liveIntent(i.cto_intent_comment_id,raw,ctx);
 v2.stableNative({adoption,nativeInput:ni,intent,ctx});
 assert(Date.parse(i.first_base)>Date.now()+60000,"V2_READY_FIRST_BASE_TOO_SOON");
 return Object.freeze({schema_version:"MCFT_CAP09_R4285_V2_READINESS_ONLY_V1",
  status:"SOURCE_AND_CTO_INTENT_READY_NOT_PREFLIGHT_OR_EXECUTION",
  run_id:v2.RUN,subject_sha:ctx.subject_sha,first_base:i.first_base,
  plan_sha256:ctx.plan_sha256,observations_sha256:ctx.observations_sha256,
  stage_budget_ms:10800000,owner_observed:false,permit_verified:false,
  permit_consumed:false,execute_authorized:false,stage_count:0});
}
function writeOnce(file,obj){
 const fd=fs.openSync(file,"wx",0o600);
 try{fs.writeFileSync(fd,Buffer.from(JSON.stringify(obj,null,2)+"\n"));fs.fsyncSync(fd);}
 finally{fs.closeSync(fd);}
}
function prepareBoundState(i,env=process.env){
 v1.hostOnly(env);checkInputs(i,"--preflight-only");
 const base=Object.fromEntries(v1.INPUTS.map(k=>[k,i[k]]));
 // This is the *single* full Native Adoption in the V2 invocation.
 const state=v1.buildAdmission(base,env);
 const ctx=basicContext({i,adoption:state.adoption,nativeInput:state.nativeInput,
  plan:state.plan,observed:state.observed,nonce:state.permitProof.nonce,
  resource_scope_sha256:v2.scopeDigest(state.readback.facts)});
 const raw=fileBytes(i.cto_intent_file,8192);
 ctx.intent_raw_bytes=raw;
 const intent=v2.liveIntent(i.cto_intent_comment_id,raw,ctx);
 assert(Date.parse(state.readback.facts.observed_at)>=Date.parse(intent.created_at),
  "V2_OWNER_MUST_FOLLOW_CTO_PREAUTH");
 const stable=v2.stableNative({adoption:state.adoption,nativeInput:state.nativeInput,intent,ctx});
 return {state,ctx,intent,stable,base};
}
async function fullAdmission(i,env=process.env){
 const prepared=prepareBoundState(i,env),{state,ctx,intent,stable}=prepared;
 const s={
  stable,intent,ctx,nativeInput:state.nativeInput,
  sourceRoot:i.source_root,releaseRoot:i.release_root,
  environment:env,resourceEnvelope:state.resEnv,
  resourceReadbackFile:i.resource_readback_file,readback:state.readback,
  permitEnvelope:state.permitEnv,permitProof:state.permitProof,
  finalEnvelope:json(i.final_execution_approval_file),trust:state.trust,
  plan:state.plan,observations:state.observed,profile:state.profile,
  releaseBinding:json(state.nativeInput.release_binding_file)
 };
 const report=await host.verifyDynamicReadOnly(s);
 return {...prepared,report,final:host.requireVerifiedFinal(report)};
}
async function preflight(i,env=process.env){
 v1.hostOnly(env);checkInputs(i,"--preflight-only");
 const result=await fullAdmission(i,env);
 return Object.freeze({schema_version:"MCFT_CAP09_R4285_V2_SIGNED_PREFLIGHT_V1",
  status:"V2_SIGNED_PREFLIGHT_PASS_NO_PERMIT_CONSUMED_NO_EXECUTION",
  ...result.report,status:"V2_SIGNED_PREFLIGHT_PASS_NO_PERMIT_CONSUMED_NO_EXECUTION",
  permit_consumed:false,execute_authorized:false,stage_count:0});
}
async function execute(i,env=process.env){
 v1.hostOnly(env);checkInputs(i,"--execute");
 // Execute mode is explicitly selected by the human operator; no auto-chain
 // from readiness or preflight. Run science selfcheck BEFORE reading recent Owner.
 checkScience(i.release_root,env);
 const {state,ctx,stable,intent,report,final}=await fullAdmission(i,env);
 assert.equal(report.status,"R4285_V2_FINAL_READONLY_BINDING_VERIFIED_NOT_PREFLIGHT_OR_EXECUTION");
 const prepared=atomic.prepare({nativeAdoption:state.adoption,permitProof:state.permitProof,
  trust:state.trust,sourceRoot:i.source_root,stable,intent,ctx,
  resourceEnvelope:state.resEnv,readback:state.readback,plan:state.plan,
  observed:state.observed,permitEnvelope:state.permitEnv});
 // Last qualified instant before irreversible one-time ledger reservation.
 v2.assertFinal(final,{nonce:ctx.nonce,
  permit_envelope_sha256:state.permitProof.envelope_sha256,
  resource_readback_sha256:state.readback.sha256,
  intent_sha256:intent.sha256},{now:Date.now()});
 const consumed=atomic.consumeForQualifiedHost(prepared,final);
 const authority=stage.initializeStageAuthority(consumed,state.permitEnv.payload,
  state.permitProof.envelope_sha256);
 fs.mkdirSync(i.output_root,{mode:0o700});
 writeOnce(path.join(i.output_root,"SIGNED_OBSERVED_R4285.json"),state.observed);
 writeOnce(path.join(i.output_root,"STARTED_R4285.json"),{
  schema_version:"MCFT_CAP09_R4285_RUN_STARTED_V2",run_id:v2.RUN,
  subject_sha:ctx.subject_sha,started_at:new Date().toISOString(),
  stage_count:0,permit_consumed:true,production_authorized:false});
 const steps=state.steps.map(step=>Object.freeze({...step,env:{
  ...step.env,MCFT_R4285_PERMIT_ENVELOPE_SHA256:state.permitProof.envelope_sha256}}));
 const result=await scheduler.executeSixStages({authority,plan:state.plan,steps,
  dispatch:async(a,step)=>dispatch.dispatchConsumedStageR4285(a,freshStageLaunch(step)),
  assertConsumed:atomic.assertConsumed});
 return Object.freeze({schema_version:"MCFT_CAP09_R4285_V2_EXECUTION_RESULT_V1",
  status:"R4285_V2_SIX_PHYSICAL_STAGES_SEALED_TEST_ONLY",
  run_id:v2.RUN,stage_count:result.stage_count,
  final_receipt_sha256:result.final_receipt_sha256,
  permit_consumed:true,production_authorized:false});
}
function parse(argv){
 assert(Array.isArray(argv)&&argv.length===3&&EXECUTABLE_MODES.includes(argv[0])
  &&argv[1]==="--input"&&path.isAbsolute(argv[2]),"V2_CLI_MODE_INPUT_REQUIRED");
 return {mode:argv[0],input:argv[2]};
}
async function run(argv=process.argv.slice(2),env=process.env){
 const {mode,input}=parse(argv);
 const data=json(input);
 checkInputs(data,mode);
 if(mode==="--readiness-only")return readiness(data,env);
 if(mode==="--preflight-only")return preflight(data,env);
 return execute(data,env);
}
if(require.main===module)run().then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{
 console.error(JSON.stringify({status:"HOLD_R4285_V2_WINDOWS_HOST",
  reason_code:String(e.message||e).slice(0,320),run_id:v2.RUN,
  permit_consumed:"UNKNOWN_CHECK_LEDGER_BEFORE_ANY_FURTHER_ACTION",
  production_authorized:false,auto_retry:false}));
 process.exitCode=1;
});
module.exports={READY_KEYS,FULL_KEYS,checkInputs,basicContext,parse,readiness,preflight,execute,run};
