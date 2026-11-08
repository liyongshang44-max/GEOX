"use strict";
// Physical TEST_ONLY receiver. Only the genuine factory and independent
// execution-purpose signatures may reach atomic consumption and the original scheduler.
const fs=require("node:fs"),path=require("node:path");
const {setTimeout:delay}=require("node:timers/promises");
const s=require("./MCFT_CAP09_R4285_SCOPE_V3.cjs"),c=require("../cap09_adoption_v1/contract.cjs");
const factory=require("./MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs");
const resource=require("../governance_acceptance/MCFT_CAP09_R4285_RESOURCE_OWNER_V3.cjs");
const build=require("./MCFT_CAP09_R4285_BUILD_ADMISSION_EXEC_V3.cjs");
const admission=require("./MCFT_CAP09_R4285_ADMISSION_EXEC_V3.cjs"),host=require("./MCFT_CAP09_R4285_HOST_ADMISSION_EXEC_V3.cjs");
const accepted=new WeakMap();
const atomic=require("./MCFT_CAP09_R4285_PERMIT_ATOMIC_EXEC_V3.cjs");
const stage=require("./MCFT_CAP09_R4285_STAGE_CAPABILITY_EXEC_V3.cjs");
const dispatch=require("./MCFT_CAP09_R4285_PARENT_STAGE_DISPATCH_EXEC_V3.cjs");
const scheduler=require("./MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs");
const historical=require("./MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs");
const {freshStageLaunch}=require("./MCFT_CAP09_STAGE_START_CLOCK_V1.cjs");
let outcome={permit_consumed:false,consumption_attempted:false,stage_count:0,production_authorized:false};
function rawOwnerGate(file,state){
 factory.requireReceiver(state);const raw=s.bytes(file,1048575),readback=resource.verifyReadbackFile(file,s.sha(raw),{run_id:state.ctx.run_id}),p=readback.facts;
 s.identity(p,state.ctx);s.check(p.scope_id===state.scope.scope_id&&p.source_approval_sha256===state.approval.sha256,"V3_OWNER_SCOPE_OR_SOURCE_DRIFT");
 const at=s.utc(p.observed_at),now=Date.now();s.check(at>=state.owner_not_before&&at<=now&&now-at<=120000,"V3_OWNER_NOT_FRESH_AFTER_WAIT");return readback;
}
async function wait(state){const i=state.i;let original=null,firstAt=null;
 for(;;){factory.requireReceiver(state);
  if(fs.existsSync(i.resource_readback_file)){
   const r=rawOwnerGate(i.resource_readback_file,state);if(original===null){original=r.sha256;firstAt=s.utc(r.facts.observed_at);factory.setObservationDeadline(state,r.facts.observed_at);}
   s.check(r.sha256===original,"V3_OWNER_RAW_REPLACED");s.check(Date.now()-firstAt<=120000,"V3_OWNER_WINDOW_EXHAUSTED");
   if(factory.FUTURE.every(k=>fs.existsSync(i[k]))){state.future_pins=factory.FUTURE.map(k=>({file:i[k],sha256:s.sha(s.bytes(i[k]))}));return original;}
  }else s.check(original===null,"V3_OWNER_RAW_REMOVED");
  await delay(100);
 }
}
function checkResourceScope(state,built){const p=built.resEnv.payload,r=state.scope.payload.resources;
 s.identity(p,state.ctx);s.check(p.scope_id===state.scope.scope_id&&p.source_approval_sha256===state.approval.sha256,"V3_OWNER_AUTHORITY_BINDING");
 for(const key of ["database_host","database_port","positive_database","negative_database","pg_owner_id","bucket_endpoint","bucket"])s.check(p[key]===r[key],"V3_OWNER_RESOURCE_DRIFT");
 s.check(p.audit_user===r.positive_role&&p.s3_owner_id==="r4285scope:"+state.scope.scope_id.slice(0,40),"V3_OWNER_STABLE_IDENTITY");
 s.check(s.utc(p.expires_at)<=s.utc(state.scope.payload.expires_at),"V3_OWNER_OUTLIVES_SCOPE");
 // Only signed observation envelopes are public. Original MinIO/Docker raw
 // bytes stay protected at the independent Producer; never publish Config.Env
 // or disguise sensitive source bytes as harmless base64 in an Owner receipt.
 const facts=built.readback.facts;
 for(const kind of ["CONTROL","INVENTORY"]){const envelope=facts.source_observations?.[kind.toLowerCase()];
  s.verifyObservationSignature(envelope,kind,state.scope,state.trust,{notBefore:state.owner_not_before});
  factory.setObservationDeadline(state,envelope.payload.observed_at);
  s.check(s.sha(c.canonical(envelope))===p[kind.toLowerCase()+"_observation_sha256"],"V3_OWNER_SIGNED_OBSERVATION_DRIFT");
 }
 return true;
}
async function acceptPreparedState(state){factory.requireReceiver(state);s.check(state.execution===true,"V3_EXECUTION_FACTORY_REQUIRED");const i=state.i;
 console.log(JSON.stringify({schema_version:"MCFT_CAP09_R4285_LIVE_SESSION_GATE_V3",status:"WAIT_REAL_WINDOWS_OWNER_PRODUCER_NOT_PREFLIGHT",scope_id:state.scope.scope_id,
  owner_not_before_utc:new Date(state.owner_not_before).toISOString(),owner_readback_path:i.resource_readback_file,
  required_signed_files:factory.FUTURE.slice(1).map(k=>i[k]),permit_consumed:false,execute_authorized:false,stage_count:0}));
 const original=await wait(state);factory.requireReceiver(state);
 const base=Object.fromEntries(require("./MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs").INPUTS.map(k=>[k,i[k]]));
 const built=build.buildAdmissionV3(base,state.environment,{verifiedNativeAdoption:state.adoption,executionRun:state.ctx.run_id});
 s.check(built.readback.sha256===original,"V3_OWNER_BYTES_CHANGED_DURING_BINDING");checkResourceScope(state,built);
 s.check(s.utc(built.readback.facts.observed_at)>=state.owner_not_before,"V3_OWNER_PREPARED_EPOCH");
 const ctx={...state.ctx,intent_raw_bytes:state.intentRaw,
  control_observation_sha256:built.resEnv.payload.control_observation_sha256,
  inventory_observation_sha256:built.resEnv.payload.inventory_observation_sha256};
 for(const k of ["plan_sha256","observations_sha256","installed_material_digest","release_binding_sha256","scope_id","source_approval_sha256"]){
  const expected=k==="installed_material_digest"?ctx.material_digest:ctx[k];s.check(built.permitEnv.payload[k]===expected,"V3_PREPARED_PERMIT_CONTEXT_DRIFT");}
 admission.checkActualPermit(built.permitProof,built.permitEnv,built.resEnv,built.readback,built.observed,ctx);
 const report=await host.verifyDynamicReadOnly({preparedState:state,stable:state.stable,intent:state.intent,ctx,nativeInput:state.ni,
  sourceRoot:i.source_root,releaseRoot:i.release_root,environment:state.environment,
  resourceScope:state.scope.payload.resources,resourceEnvelope:built.resEnv,resourceReadbackFile:i.resource_readback_file,readback:built.readback,
  permitEnvelope:built.permitEnv,permitProof:built.permitProof,finalEnvelope:s.readJson(i.final_execution_approval_file),
  trust:state.trust,plan:built.plan,observations:built.observed,profile:state.profile,releaseBinding:JSON.parse(s.bytes(state.ni.release_binding_file).toString("utf8").replace(/^\uFEFF/,""))});
 factory.requireReceiver(state);
 // Resource authority refresh precedes final CTO Intent recheck. The atomic
 // bridge rechecks protected main and then asserts the 15-second window again.
 const final=host.requireVerifiedFinal(report),now=Date.now();
 admission.assertFinal(final,{nonce:ctx.nonce,permit_envelope_sha256:built.permitProof.envelope_sha256,resource_readback_sha256:built.readback.sha256,intent_sha256:state.intent.sha256},{now});
 admission.checkActualPermit(built.permitProof,built.permitEnv,built.resEnv,built.readback,built.observed,ctx,{now});
 checkResourceScope(state,built);rawOwnerGate(i.resource_readback_file,state);
 const result=Object.freeze({...report,schema_version:"MCFT_CAP09_R4285_PHYSICAL_ADMISSION_V3",status:"V3_PHYSICAL_ADMISSION_READY_NOT_YET_CONSUMED",scope_id:state.scope.scope_id,
  owner_age_ms:Date.now()-s.utc(built.readback.facts.observed_at),permit_consumed:false,execute_authorized:false,production_authorized:false,stage_count:0});
 accepted.set(result,{state,final,built,ctx});return result;
}
async function finishAtAcceptance(result,state){
 const bound=accepted.get(result);s.check(bound?.state===state&&state.execution===true,"V3_REAL_EXECUTION_ADMISSION_REQUIRED");
 factory.requireReceiver(state);accepted.delete(result);
 const {final,built,ctx}=bound,i=state.i;
 let steps=[],consumed;
 try{
 // Resolve only the frozen original six scripts, from this installed release.
 steps=historical.resolveStages({input:i,profile:state.profile,permitPayload:built.permitEnv.payload,
  trust:state.trust,plan:built.plan,observed:built.observed,env:state.environment,executionRun:ctx.run_id});
 const prepared=atomic.prepare({nativeAdoption:state.adoption,permitProof:built.permitProof,
  trust:state.trust,sourceRoot:i.source_root,stable:state.stable,intent:state.intent,ctx,
  resourceEnvelope:built.resEnv,readback:built.readback,plan:built.plan,observed:built.observed,
  permitEnvelope:built.permitEnv,releaseRoot:i.release_root,profile:state.profile,environment:state.environment});
 // The atomic bridge rechecks protected main and final freshness before the burn.
 outcome={...outcome,consumption_attempted:true,permit_consumed:null};
  consumed=atomic.consumeForQualifiedHost(prepared,final);
  outcome={...outcome,permit_consumed:true};factory.beginExecution(state,consumed);
  const authority=stage.initializeStageAuthority(consumed,built.permitEnv.payload,built.permitProof.envelope_sha256);
  fs.mkdirSync(i.output_root,{mode:0o700});
  c.writeOnce(path.join(i.output_root,"SIGNED_OBSERVED_R4285.json"),built.observed);
  c.writeOnce(path.join(i.output_root,"STARTED_R4285.json"),{schema_version:"MCFT_CAP09_R4285_RUN_STARTED_EXEC_V3",
   run_id:ctx.run_id,subject_sha:ctx.subject_sha,started_at:new Date().toISOString(),...outcome});
  const physicalSteps=steps.map(step=>Object.freeze({...step,env:{...step.env,
   MCFT_R4285_PERMIT_ENVELOPE_SHA256:built.permitProof.envelope_sha256}}));
  try{
   const sealed=await scheduler.executeSixStages({authority,plan:built.plan,steps:physicalSteps,
    dispatch:async(a,step)=>dispatch.dispatchConsumedStageR4285(a,freshStageLaunch(step)),assertConsumed:atomic.assertConsumed});
   outcome={...outcome,stage_count:sealed.stage_count};
   return Object.freeze({schema_version:"MCFT_CAP09_R4285_EXECUTION_RESULT_V3",
    status:"V3_SIX_PHYSICAL_STAGES_SEALED_TEST_ONLY",run_id:ctx.run_id,subject_sha:ctx.subject_sha,
    nonce:ctx.nonce,...outcome,final_receipt_sha256:sealed.final_receipt_sha256,
    qualified:false,formal_v5_arm:false,retry_automatically:false});
  }finally{for(const step of physicalSteps)for(const k of Object.keys(step.env))delete step.env[k];}
 }catch(error){
  if(consumed)outcome={...outcome,stage_count:scheduler.STAGES.filter(id=>{
   try{return JSON.parse(fs.readFileSync(path.join(consumed.run_directory,id,"COMPLETED.json"),"utf8")).status==="PASS";}catch{return false;}
  }).length};
  throw error;
 }finally{for(const step of steps)for(const k of Object.keys(step.env))delete step.env[k];}
}
function parse(argv){s.check(Array.isArray(argv)&&argv.length===3&&argv[0]==="--session-execute-test-only"&&argv[1]==="--input"&&path.isAbsolute(argv[2]),"V3_ONLY_PHYSICAL_TEST_ONLY_SESSION_ALLOWED");return argv[2];}
async function run(argv=process.argv.slice(2)){const i=s.readJson(parse(argv));const capability=await factory.prepareExecution(i);return factory.consume(capability);}
function safeReason(error){if(["ENOENT","EEXIST","EACCES","EPERM","ENOTDIR","EISDIR","EMFILE","ENFILE"].includes(error?.code))return "V3_IO_"+error.code;
 return /^(?:V3|R4285|OWNER|HOLD|V2|MATERIAL|INSTALLED|TOOL|NODE|UNDECLARED|SEARCH|EXECUTION|LOADER|PYTHON|CAP09|SYMLINK|INPUT)_[A-Z0-9_]+/.exec(error?.message||"")?.[0]||"V3_UNCLASSIFIED_RUNTIME_FAILURE";}
if(require.main===module)run().then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(JSON.stringify({status:"HOLD_R4285_V3_PHYSICAL_EXECUTION_NO_RETRY",reason_code:safeReason(error),...outcome,retry_automatically:false}));process.exitCode=2;});
module.exports={parse,run,acceptPreparedState,finishAtAcceptance,safeReason};
