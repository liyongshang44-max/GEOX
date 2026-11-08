"use strict";
const executionIdentity=require("./MCFT_CAP09_R4285_EXECUTION_IDENTITY_V3.cjs");

// The only factory for a V3 preparation capability. No callback, user supplied
// verifier, JSON certificate or alternate authority=PASS path is accepted.
const fs=require("node:fs"),path=require("node:path");
const s=require("./MCFT_CAP09_R4285_SCOPE_V3.cjs"),c=require("../cap09_adoption_v1/contract.cjs");
const native=require("../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V3.cjs");
const admission=require("./MCFT_CAP09_R4285_ADMISSION_V3.cjs");
const executionAdmission=require("./MCFT_CAP09_R4285_ADMISSION_EXEC_V3.cjs");
const moduleAdmission=admission;
const admissionFor=state=>state.execution?executionAdmission:admission;
const historical=require("./MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs");
const lineage=require("../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs");
const loader=require("./MCFT_CAP09_R4285_PINNED_LOADING_V3.cjs"),delivery=require("./MCFT_CAP09_R4285_CREDENTIAL_DELIVERY_V3.cjs");
// Loaded before FD3, under the same pinned Release graph as the Host.
const producer=require("./MCFT_CAP09_R4285_RESOURCE_OWNER_PRODUCER_V3.cjs");
const states=new WeakMap(),receivers=new WeakSet(),producerPreparations=new WeakSet();
const FUTURE=Object.freeze(["resource_readback_file","resource_envelope_file","permit_envelope_file","final_execution_approval_file"]);
const EXTRA=["final_execution_approval_file","nonce","scope_envelope_file","source_policy_file","source_approval_file","source_approval_comment_id","launch_authorization_file","launch_authorization_comment_id","session_revocation_file","cto_intent_file","cto_intent_comment_id"];
const INPUTS=Object.freeze([...historical.INPUTS,...EXTRA]);
function legacyJson(file){return JSON.parse(s.bytes(file).toString("utf8").replace(/^\uFEFF/,""));}
function absent(i){for(const key of FUTURE)s.check(!fs.existsSync(i[key]),"V3_FUTURE_FILE_ALREADY_EXISTS_"+key);}
function checkInput(i){s.exact(i,INPUTS,"V3_SESSION_INPUT_FIELDS");
 for(const [k,v] of Object.entries(i)){if(k.endsWith("comment_id")){s.check(Number.isSafeInteger(v)&&v>0,"V3_COMMENT_ID");continue;}
  if(k==="nonce"){s.hash(v);continue;}if(k==="first_base")continue;
  s.check(typeof v==="string"&&path.isAbsolute(v),"V3_INPUT_PATH");}
 historical.checkInput(Object.fromEntries(historical.INPUTS.map(k=>[k,i[k]])),false);
 const paths=Object.entries(i).filter(([k])=>k.endsWith("_file")).map(([,v])=>path.resolve(v).toLowerCase());
 s.check(new Set(paths).size===paths.length,"V3_INPUT_PATH_ALIAS");s.check(!fs.existsSync(i.session_revocation_file),"V3_SESSION_REVOKED");
 for(const key of [...FUTURE,"session_revocation_file","output_root"])for(const root of [i.source_root,i.release_root]){const rel=path.relative(root,i[key]);s.check(rel===".."||rel.startsWith(".."+path.sep)||path.isAbsolute(rel),"V3_OUTPUT_INSIDE_SOURCE_OR_RELEASE");}
 s.check(!fs.existsSync(i.output_root),"V3_LEGACY_OUTPUT_ALREADY_EXISTS");absent(i);return i;
}
function pin(i,ni){const files={};for(const key of ["native_adoption_input_file","plan_file","observations_file","scope_envelope_file","source_policy_file","source_approval_file","launch_authorization_file","cto_intent_file"])files[key]=i[key];
 for(const key of ["trust_file","material_file","release_binding_file","adoption_envelope_file"])files["native_"+key]=ni[key];
 return Object.freeze(Object.fromEntries(Object.entries(files).map(([k,file])=>[k,Object.freeze({file,sha256:s.sha(s.bytes(file))})])));}
function checkPinned(pins){for(const {file,sha256} of Object.values(pins))s.check(s.sha(s.bytes(file))===sha256,"V3_PREPARED_INPUT_DRIFT");}
function assertActive(state){if(state?.failure_code)throw Error(state.failure_code);s.check(state&&state.phase!=="CLOSED"&&!state.revoked,"V3_PREPARE_REVOKED_OR_ENDED");
 const now=Date.now();s.check(now<state.expires,"V3_PREPARE_EXPIRED");s.check(!fs.existsSync(state.i.session_revocation_file),"V3_SESSION_REVOKED");
 if(state.observation_deadline&&now>=state.observation_deadline){invalidate(state,"V3_OWNER_WINDOW_EXHAUSTED");throw Error("V3_OWNER_WINDOW_EXHAUSTED");}
 delivery.parentClean(process.env);admissionFor(state).requireStable(state.stable,state.intent,state.ctx,{now});s.requireApproval(state.approval,state.scope,{now});}
function closeState(state){if(!state||state.phase==="CLOSED")return;state.phase="CLOSED";
 producer.closeAttached(state.producer);state.producer=null;
 clearTimeout(state.expiry_timer);clearTimeout(state.observation_timer);clearInterval(state.revoke_timer);state.controller?.abort();
 delivery.clear(state.environment);state.environment=null;state.loading?.close();state.loading=null;state.adoption=null;state.stable=null;state.intent=null;}
function invalidate(state,code){if(!state||state.phase==="CLOSED")return;state.failure_code=code;state.revoked=true;state.controller?.abort(Error(code));delivery.clear(state.environment);producer.closeAttached(state.producer);state.producer=null;if(state.phase==="PREPARED")closeState(state);}
// Launch permission is an independent native CTO decision. Architecture and
// purpose approvals cannot satisfy this exact decision or its signed context.
function launch(i,scope,execution){const raw=s.bytes(i.launch_authorization_file,8192),p=s.wire(raw);
 s.exact(p,["schema_version","run_id","subject_sha","host_id","nonce","scope_id","valid_from","expires_at","decision","production_authorized"],"V3_LAUNCH_FIELDS");
 if(execution===undefined)execution=p.schema_version==="MCFT_CAP09_R4285_PHYSICAL_SESSION_LAUNCH_V3";
 s.identity(p,scope.payload);s.check(p.schema_version===(execution?"MCFT_CAP09_R4285_PHYSICAL_SESSION_LAUNCH_V3":"MCFT_CAP09_R4285_SESSION_LAUNCH_V3")&&p.scope_id===scope.scope_id&&p.decision===(execution?"AUTHORIZE_ONE_V3_PHYSICAL_TEST_ONLY_SESSION":"AUTHORIZE_ONE_V3_SESSION_PREFLIGHT_ONLY")&&p.production_authorized===false,"V3_LIVE_SESSION_NOT_AUTHORIZED");
 const cp=require("node:child_process");const id=i.launch_authorization_comment_id;
 const reply=JSON.parse(cp.execFileSync("curl.exe",["--fail","--silent","--show-error","--max-time","20",`https://api.github.com/repos/liyongshang44-max/GEOX/issues/comments/${id}`],{encoding:"utf8",timeout:25000,maxBuffer:524288,windowsHide:true}));
 s.check(reply.id===id&&reply.url===`https://api.github.com/repos/liyongshang44-max/GEOX/issues/comments/${id}`&&reply.issue_url==="https://api.github.com/repos/liyongshang44-max/GEOX/issues/3757"&&reply.user?.login==="liyongshang44-max"&&reply.author_association==="OWNER"&&reply.created_at===reply.updated_at&&reply.body===raw.toString("utf8"),"V3_LAUNCH_NATIVE_IDENTITY");
 const now=Date.now();s.check(s.githubUtc(reply.created_at)<=s.utc(p.valid_from)&&s.utc(p.valid_from)<=now&&now<s.utc(p.expires_at)&&s.utc(p.expires_at)<=s.utc(scope.payload.expires_at),"V3_LAUNCH_EXPIRED");return p;
}
async function prepareInternal(i,execution){
 const admission=execution?executionAdmission:moduleAdmission;
 historical.hostOnly(process.env);delivery.parentClean(process.env);checkInput(i);
 const ni=legacyJson(i.native_adoption_input_file);s.check(ni.source_root===i.source_root&&path.resolve(ni.release_root)===path.resolve(i.release_root),"V3_PREPARE_ROOT_SPLIT");
 const pins=pin(i,ni),trust=legacyJson(ni.trust_file);
 // Native verifies registered repository trust, source QCP73, exact merge,
 // signed adoption, full installed Material/Release and actual tool bytes.
 const adoption=native.checkNativeAdoption(ni);s.check(native.isNativeVerified(adoption),"V3_NATIVE_FACTORY_REQUIRED");
 const scopeEnvelope=s.readJson(i.scope_envelope_file);
 const executionRun=executionIdentity.get(scopeEnvelope.payload.run_id).run_id;
 s.check(execution||executionRun===s.RUN,"V3_SUCCESSOR_EXECUTION_ONLY");
 if(execution)s.check(executionRun===executionIdentity.SUCCESSOR,"V3_PHYSICAL_SUCCESSOR_RUN_REQUIRED");
 const ctxIdentity={run_id:executionRun,host_id:s.HOST,subject_sha:adoption.subject_sha,nonce:i.nonce};
 const scope=s.verifyScope(scopeEnvelope,trust,ctxIdentity);
 if(execution)executionIdentity.checkHistory(trust.ledger_root,executionRun);
 if(execution)s.check(!fs.existsSync(path.join(trust.ledger_root,"r4285-v3-preflight-"+scope.scope_id+".json")),"V3_SESSION_SCOPE_ALREADY_ATTEMPTED");
 s.verifySourcePolicy(s.bytes(i.source_policy_file),scope);
 const approvalRaw=s.bytes(i.source_approval_file,8192),approval=s.liveApproval(i.source_approval_comment_id,approvalRaw,scope);
 const launchProof=launch(i,scope,execution);
 const plan=legacyJson(i.plan_file),observed=legacyJson(i.observations_file);
 const ctx={...ctxIdentity,authority_pr_number:3757,first_base:i.first_base,
  plan_sha256:c.digest(plan),observations_sha256:c.digest(observed),material_digest:adoption.material_digest,
  release_binding_sha256:s.sha(s.bytes(ni.release_binding_file)),resource_scope_sha256:scope.scope_id,
  scope_id:scope.scope_id,source_approval_sha256:approval.sha256,
  adoption_expires_at:legacyJson(ni.adoption_envelope_file).payload.expires_at,
  total_stage_budget_ms:plan.stages.reduce((n,row)=>n+row.timeout_ms,0),plan};
 admission.frozenBudget(plan,observed,ctx);lineage.verifyExactMain(i.source_root,ctx.subject_sha);
 s.check(Date.parse(ctx.adoption_expires_at)>Date.now()+10860000,"V3_ADOPTION_REMAINING_STAGE_BUDGET");
 const intentRaw=s.bytes(i.cto_intent_file,8192),intent=admission.liveIntent(i.cto_intent_comment_id,intentRaw,ctx);
 const stable=admission.stableNative({adoption,nativeInput:ni,intent,ctx});
 s.check(Date.parse(i.first_base)>Date.now()+60000,"V3_FIRST_BASE_TOO_SOON");
 const profile=legacyJson(ni.material_file);
 if(execution)require("./MCFT_CAP09_R4285_BUILD_ADMISSION_EXEC_V3.cjs").verifyExecutionSources(ni,profile);
 let loading,frame,secret,state;
 try{
  loading=loader.install(profile,i.release_root);await loading.preload();
  if(execution)require("./MCFT_CAP09_R4285_WINDOWS_HOST_EXEC_V3.cjs");
  checkPinned(pins);absent(i);
  // This is the concrete presecret release gate: no caller-provided boolean.
  s.requireApproval(approval,scope);admission.requireStable(stable,intent,ctx);
  console.log(JSON.stringify({schema_version:"MCFT_CAP09_R4285_PRESECRET_READY_V3",status:"QUALIFIED_LOADING_READY_FOR_FD3",scope_id:scope.scope_id,credentials_read:false,permit_consumed:false,stage_count:0}));
  frame=await delivery.readFrameFd3();secret=delivery.parse(frame,scope,trust,approval);
  const environment=Object.assign(Object.create(null),process.env,secret.environment);
  environment.MCFT_QUALIFICATION_FIRST_BASE=i.first_base;
  const expires=Math.min(Date.parse(scope.payload.expires_at),Date.parse(approval.expires_at),Date.parse(secret.expires_at),Date.parse(launchProof.expires_at),Date.parse(ctx.adoption_expires_at),Date.parse(intent.expires_at),Date.parse(stable.minted_at)+3600000);
  // Defensive copy isolates mutable caller objects. Pinned original files are
  // independently checked again at the transition and after dynamic work.
  state={execution,i:JSON.parse(JSON.stringify(i)),ni,trust,scope,approval,approvalRaw,intentRaw,ctx,intent,stable,adoption,profile,pins,loading,environment,expires,phase:"PREPARED",revoked:false,controller:new AbortController()};
  state.expiry_timer=setTimeout(()=>invalidate(state,"V3_PREPARE_EXPIRED"),Math.max(1,expires-Date.now()));state.expiry_timer.unref?.();
  state.revoke_timer=setInterval(()=>{if(fs.existsSync(state.i.session_revocation_file))invalidate(state,"V3_SESSION_REVOKED");},100);state.revoke_timer.unref?.();
  assertActive(state);checkPinned(pins);absent(i);
  const cap=Object.freeze(Object.create(null));states.set(cap,state);return cap;
 }catch(error){if(state)closeState(state);else loading?.close();throw error;}
 finally{frame?.fill(0);delivery.clear(secret?.environment);}
}
function revoke(cap){const state=states.get(cap);s.check(state,"V3_FACTORY_CAPABILITY_REQUIRED");invalidate(state,"V3_PREPARE_REVOKED");}
function requireProducerPreparation(state){s.check(producerPreparations.has(state)&&state.phase==="PREPARED","V3_PRODUCER_FACTORY_PREPARATION_REQUIRED");assertActive(state);return true;}
function prepareProducer(cap,options){const state=states.get(cap);s.check(state,"V3_FACTORY_CAPABILITY_REQUIRED");assertActive(state);checkPinned(state.pins);
 s.check(state.phase==="PREPARED"&&!state.producer,"V3_PRODUCER_PREPARE_ONCE");
 producerPreparations.add(state);
 try{state.producer=producer.prepareAttached(state,options);return Object.freeze({status:"V3_PRODUCER_PREPARED_SAME_PROCESS_NOT_OBSERVED",scope_id:state.scope.scope_id,credentials_reopened:false,owner_clock_started:false});}
 finally{producerPreparations.delete(state);}
}
function captureProducer(cap){const state=states.get(cap);s.check(state,"V3_FACTORY_CAPABILITY_REQUIRED");requireReceiver(state);checkPinned(state.pins);
 try{return producer.captureAttached(state.producer,state);}
 catch(error){invalidate(state,"V3_PRODUCER_SOURCE_CAPTURE_FAILED");throw error;}
}
async function completeProducer(cap,observations){const state=states.get(cap);s.check(state,"V3_FACTORY_CAPABILITY_REQUIRED");requireReceiver(state);checkPinned(state.pins);
 try{return await producer.completeAttached(state.producer,state,observations);}
 catch(error){invalidate(state,"V3_PRODUCER_FORMAL_READBACK_FAILED");throw error;}
}
async function consumeWithProducer(cap){const state=states.get(cap);s.check(state,"V3_FACTORY_CAPABILITY_REQUIRED");assertActive(state);
 s.check(state.phase==="PREPARED"&&state.producer,"V3_PRODUCER_NOT_PREPARED_BEFORE_WAIT");return consume(cap);
}
function prepare(i){return prepareInternal(i,false);}
function prepareExecution(i){return prepareInternal(i,true);}
function beginExecution(state,consumed){requireReceiver(state);
 require("./MCFT_CAP09_R4285_PERMIT_ATOMIC_EXEC_V3.cjs").assertConsumed(consumed);s.check(state.execution&&state.phase==="LIVE","V3_PHYSICAL_EXECUTION_RECEIVER_REQUIRED");
 state.phase="EXECUTING";clearTimeout(state.expiry_timer);clearTimeout(state.observation_timer);clearInterval(state.revoke_timer);
 // Admission clocks end at the irreversible burn; signed Permit expiry governs stages.
}
async function consume(cap){const state=states.get(cap);s.check(state,"V3_FACTORY_CAPABILITY_REQUIRED");
 // Synchronous state transition precedes any await, so competing consumers
 // cannot both enter. It reserves preparation, never a Permit/ledger marker.
 s.check(state.phase==="PREPARED","V3_PREPARE_ALREADY_USED");state.phase="LIVE";
 try{assertActive(state);checkPinned(state.pins);absent(state.i);
  c.noLinks(state.trust.ledger_root);
  // Retain the original exclusive slot across BOTH modes: closed preflight Scope cannot execute.
  try{c.writeOnce(path.join(state.trust.ledger_root,"r4285-v3-preflight-"+state.scope.scope_id+".json"),{
   schema_version:state.execution?"MCFT_CAP09_R4285_V3_EXECUTION_ATTEMPT_STARTED":"MCFT_CAP09_R4285_V3_PREFLIGHT_ATTEMPT_STARTED",scope_id:state.scope.scope_id,
   nonce:state.ctx.nonce,started_at:new Date().toISOString(),permit_consumed:false,stage_count:0});}
  catch(error){if(error.code==="EEXIST")throw Error("V3_SESSION_SCOPE_ALREADY_ATTEMPTED");throw error;}
  state.owner_not_before=Date.now();receivers.add(state);
  const receiver=require(state.execution?"./MCFT_CAP09_R4285_WINDOWS_HOST_EXEC_V3.cjs":"./MCFT_CAP09_R4285_WINDOWS_HOST_V3.cjs");
  const result=await receiver.acceptPreparedState(state);
  assertActive(state);checkPinned(state.pins);
  for(const pin of state.future_pins||[])s.check(s.sha(s.bytes(pin.file))===pin.sha256,"V3_PUBLISHED_FILE_DRIFT");
  return await receiver.finishAtAcceptance(result,state);
 }catch(error){if(state.failure_code)throw Error(state.failure_code);throw error;}
 finally{receivers.delete(state);closeState(state);}
}
function requireReceiver(state){s.check(receivers.has(state),"V3_FACTORY_RECEIVER_REQUIRED");assertActive(state);return true;}
function refreshAuthority(state){requireReceiver(state);const proof=s.liveApproval(state.i.source_approval_comment_id,state.approvalRaw,state.scope);
 s.check(proof.sha256===state.approval.sha256,"V3_RESOURCE_AUTHORITY_CHANGED");launch(state.i,state.scope,state.execution);requireReceiver(state);}
function setObservationDeadline(state,observedAt){requireReceiver(state);const deadline=s.utc(observedAt)+120000;
 if(state.observation_deadline&&state.observation_deadline<=deadline)return;
 state.observation_deadline=deadline;clearTimeout(state.observation_timer);state.observation_timer=setTimeout(()=>invalidate(state,"V3_OWNER_WINDOW_EXHAUSTED"),Math.max(1,deadline-Date.now()));state.observation_timer.unref?.();assertActive(state);}
module.exports={INPUTS,FUTURE,checkInput,absent,prepare,prepareExecution,beginExecution,consume,revoke,launch,requireReceiver,refreshAuthority,setObservationDeadline,prepareProducer,consumeWithProducer,captureProducer,completeProducer,requireProducerPreparation};
