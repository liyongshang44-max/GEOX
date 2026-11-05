"use strict";
// One non-consuming receiver. Shared frozen helpers may load original Host
// definitions; no consumption/dispatch call can bypass this preparation factory.
const fs=require("node:fs"),path=require("node:path");
const {setTimeout:delay}=require("node:timers/promises");
const s=require("./MCFT_CAP09_R4285_SCOPE_V3.cjs"),c=require("../cap09_adoption_v1/contract.cjs");
const factory=require("./MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs");
const resource=require("../governance_acceptance/MCFT_CAP09_R4285_RESOURCE_OWNER_V3.cjs");
const build=require("./MCFT_CAP09_R4285_BUILD_ADMISSION_V3.cjs");
const admission=require("./MCFT_CAP09_R4285_ADMISSION_V3.cjs"),host=require("./MCFT_CAP09_R4285_HOST_ADMISSION_V3.cjs");
const accepted=new WeakMap();
function rawOwnerGate(file,state){
 factory.requireReceiver(state);const raw=s.bytes(file,1048575),readback=resource.verifyReadbackFile(file,s.sha(raw)),p=readback.facts;
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
async function acceptPreparedState(state){factory.requireReceiver(state);const i=state.i;
 console.log(JSON.stringify({schema_version:"MCFT_CAP09_R4285_LIVE_SESSION_GATE_V3",status:"WAIT_REAL_WINDOWS_OWNER_PRODUCER_NOT_PREFLIGHT",scope_id:state.scope.scope_id,
  owner_not_before_utc:new Date(state.owner_not_before).toISOString(),owner_readback_path:i.resource_readback_file,
  required_signed_files:factory.FUTURE.slice(1).map(k=>i[k]),permit_consumed:false,execute_authorized:false,stage_count:0}));
 const original=await wait(state);factory.requireReceiver(state);
 const base=Object.fromEntries(require("./MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs").INPUTS.map(k=>[k,i[k]]));
 const built=build.buildAdmissionV3(base,state.environment,{verifiedNativeAdoption:state.adoption});
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
 // Resource authority refresh happened BEFORE final CTO Intent recheck. No
 // subsequent network request is inserted into the final 15-second interval.
 const final=host.requireVerifiedFinal(report),now=Date.now();
 admission.assertFinal(final,{nonce:ctx.nonce,permit_envelope_sha256:built.permitProof.envelope_sha256,resource_readback_sha256:built.readback.sha256,intent_sha256:state.intent.sha256},{now});
 admission.checkActualPermit(built.permitProof,built.permitEnv,built.resEnv,built.readback,built.observed,ctx,{now});
 checkResourceScope(state,built);rawOwnerGate(i.resource_readback_file,state);
 const result=Object.freeze({...report,schema_version:"MCFT_CAP09_R4285_SIGNED_PREFLIGHT_V3",status:"V3_SIGNED_PREFLIGHT_PASS_NO_PERMIT_CONSUMED_NO_EXECUTION",scope_id:state.scope.scope_id,
  owner_age_ms:Date.now()-s.utc(built.readback.facts.observed_at),permit_consumed:false,execute_authorized:false,production_authorized:false,stage_count:0});
 accepted.set(result,{state,final,built,ctx});return result;
}
function finishAtAcceptance(result,state){const bound=accepted.get(result);s.check(bound?.state===state,"V3_REAL_PREFLIGHT_RESULT_REQUIRED");factory.requireReceiver(state);
 const {final,built,ctx}=bound,now=Date.now();admission.assertFinal(final,{nonce:ctx.nonce,permit_envelope_sha256:built.permitProof.envelope_sha256,resource_readback_sha256:built.readback.sha256,intent_sha256:state.intent.sha256},{now});
 admission.checkActualPermit(built.permitProof,built.permitEnv,built.resEnv,built.readback,built.observed,ctx,{now});accepted.delete(result);return result;}
function parse(argv){s.check(Array.isArray(argv)&&argv.length===3&&argv[0]==="--session-preflight-only"&&argv[1]==="--input"&&path.isAbsolute(argv[2]),"V3_ONLY_SESSION_PREFLIGHT_ALLOWED");return argv[2];}
async function run(argv=process.argv.slice(2)){const i=s.readJson(parse(argv));const capability=await factory.prepare(i);return factory.consume(capability);}
function safeReason(error){if(["ENOENT","EEXIST","EACCES","EPERM","ENOTDIR","EISDIR","EMFILE","ENFILE"].includes(error?.code))return "V3_IO_"+error.code;
 return /^(?:V3|R4285|OWNER|HOLD|V2|MATERIAL|INSTALLED|TOOL|NODE|UNDECLARED|SEARCH|EXECUTION|LOADER|PYTHON|CAP09|SYMLINK|INPUT)_[A-Z0-9_]+/.exec(error?.message||"")?.[0]||"V3_UNCLASSIFIED_RUNTIME_FAILURE";}
if(require.main===module)run().then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(JSON.stringify({status:"HOLD_R4285_V3_SESSION",reason_code:safeReason(error),permit_consumed:false,execute_authorized:false,stage_count:0}));process.exitCode=2;});
module.exports={parse,run,acceptPreparedState,finishAtAcceptance,safeReason};
