"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const permitApi=require("./MCFT_CAP09_RETRY_PERMIT_V1.cjs");
const stageCap=require("./MCFT_CAP09_STAGE_CAPABILITY_V1.cjs");
const responseDelay=require("./MCFT_CAP09_REAL_PROVIDER_RESPONSE_DELAY_V1.cjs");
const pipelineDelay=require("./MCFT_CAP09_REAL_PIPELINE_DELAY_V1.cjs");
const {admitProposedRetry}=require("../governance_acceptance/MCFT_CAP09_ISOLATED_RETRY_ADMISSION_BRIDGE_V1.cjs");
const {hashFile}=require("./MCFT_CAP09_STAGE_RECEIPTS_V1.cjs");
const scheduler=require("./MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs");
const {assertDedicatedPgUrl}=require("../governance_acceptance/MCFT_CAP09_DEDICATED_PG_ENDPOINT_V1.cjs");
const {dispatchConsumedStage}=require("./MCFT_CAP09_PARENT_STAGE_DISPATCH_V1.cjs");
const {freshStageLaunch}=require("./MCFT_CAP09_STAGE_START_CLOCK_V1.cjs");
const cp=require("node:child_process");
const ROOT=path.resolve(__dirname,"../..");
const STAGES=Object.freeze([
 ["PRODUCER","RUN_MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2.ts","MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2_RESULT.json"],
 ...[1,2,3].map(i=>["TIMING_"+i,"RUN_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_V2.ts",`MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE${i}_V2_RESULT.json`]),
 ["CONTROLLED_DELAY","MCFT_CAP09_REAL_CONTROLLED_DELAY_V1.cjs","MCFT_CAP09_REAL_CONTROLLED_DELAY_V1_RESULT.json"],
 ["AGGREGATE","AGGREGATE_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V2.ts","MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V2_RESULT.json"]
]);
const digest=value=>permitApi.sha(permitApi.canonical(value));
function readJson(file){return JSON.parse(fs.readFileSync(file,"utf8").replace(/^\uFEFF/,""));}
function validatePlan(plan){
 scheduler.validateStagePlan(plan);
 assert.deepEqual(STAGES.map(x=>x[0]),scheduler.STAGES,"RETRY_STAGE_IMPLEMENTATION_ORDER_MISMATCH");
}
function validateBundle(bundle,trust,context,{ticketedStage=false}={}){
 assert.equal(trust.adopted,true,"EXECUTE_HOLD: GOVERNED_RETRY_ACTIVATION_NOT_ADOPTED");
 assert.equal(trust.execution_enabled,true,"EXECUTE_HOLD: GOVERNED_RETRY_EXECUTION_DISABLED");
 assert.deepEqual(Object.keys(bundle).sort(),["arm","files","observed","permit","plan"],"RETRY_BUNDLE_KEYS_INVALID");
 validatePlan(bundle.plan);
 const {arm,observed,permit,plan}=bundle;
 const verified=permitApi.verifyPermit(permit,trust,{...context,arm_sha256:digest(arm),observations_sha256:digest(observed),plan_sha256:digest(plan)});
 responseDelay.validatePlan(observed.real_provider_response_delay_plan,{runId:arm.run_id,subjectSha:arm.protected_main_sha,firstBase:arm.qualification_first_base,producerStageTimeoutMs:plan.stages[0].timeout_ms});
 pipelineDelay.validatePlan(observed.real_pipeline_delay_plan,{runId:arm.run_id,subjectSha:arm.protected_main_sha,firstBase:arm.qualification_first_base,responseDelayMs:observed.real_provider_response_delay_plan.response_delay_ms,producerStageTimeoutMs:plan.stages[0].timeout_ms});
 assert.equal(verified.payload.run_id,arm.run_id,"PERMIT_ARM_RUN_MISMATCH");
 assert.equal(verified.payload.subject_sha,arm.protected_main_sha,"PERMIT_ARM_HEAD_MISMATCH");
 assert.equal(verified.payload.issued_at,arm.authorized_at,"PERMIT_ARM_ISSUED_MISMATCH");
 assert.equal(verified.payload.expires_at,arm.expires_at,"PERMIT_ARM_EXPIRY_MISMATCH");
 assert.equal(arm.armed,true,"RETRY_ARM_DISABLED");
 assert.equal(arm.execute_authorized,true,"RETRY_EXECUTE_NOT_APPROVED");
 assert.equal(arm.retry_authorized,true,"RETRY_NOT_APPROVED");
 const observation={...observed,head:context.head,protected_main:context.main,source_clean:context.clean,now_utc:context.now};
 // Fresh admission and the full remaining budget belong to the parent only.
 // A child consumes a single-use stage capability after this signature/material
 // validation. It cannot demand the original full budget again hours later.
 if(!ticketedStage)admitProposedRetry(arm,observation,{
   stagePlan:plan,adoptionExpiresAt:context.qualification_expires_at,sourceRoot:ROOT
 });
 const base=Date.parse(arm.qualification_first_base);
 assert(Number.isFinite(base)&&new Date(base).toISOString()===arm.qualification_first_base&&arm.qualification_first_base.endsWith(":00:00.000Z"),"RETRY_BASE_INVALID");
 if(!ticketedStage)assert(base>Date.parse(context.now),"RETRY_BASE_MUST_BE_FUTURE");
 const budget=plan.stages.reduce((n,s)=>n+s.timeout_ms,0);
 const budgetV2=arm.run_id==='da9db7129607'&&arm.retry_adjudication?.review_contract_version===2;
 if(budgetV2) {
   assert(observed.pre_permit_safety_budget,"DA9_PREPERMIT_SAFETY_BUDGET_V2_REQUIRED");
   assert(!Object.hasOwn(observed,"measured_worst_case_ms"),"DA9_FAKE_EMPIRICAL_BUDGET_FORBIDDEN");
   assert.equal(budget,observed.pre_permit_safety_budget.stage_timeout_sum_ms,"DA9_SIGNED_STAGE_CAP_SUM_MISMATCH");
    if(observed.pre_permit_safety_budget.schema_version==="geox_mcft_cap09_prepermit_source_use_budget_v3"){
      // Both parent and each one-time child must use the adopted scientific code.
      const v3=require("../governance_acceptance/MCFT_CAP09_DA9_PREPERMIT_SOURCE_USE_BUDGET_V3.cjs");
      assert.deepEqual(observed.pre_permit_safety_budget.source_code_sha256,
        v3.pinnedSourceCode(ROOT),"V3_HOST_SCIENTIFIC_SOURCE_CHANGED");
      assert.equal(observed.pre_permit_safety_budget.source_use_mode,
        "LIVE_AT_EACH_REAL_CAPTURE_NO_PROVIDER_SLA","V3_HOST_LIVE_SOURCE_USE_REQUIRED");
    }
 } else {
   // Historical non-DA9 contract: never retroactively reinterpret its evidence.
   assert(budget<=observed.measured_worst_case_ms,"RETRY_PLAN_EXCEEDS_REVIEWED_BUDGET");
 }
 if(!ticketedStage)assert(Date.parse(arm.expires_at)>Date.parse(context.now)+budget+observed.deadline_safety_margin_ms,"RETRY_PERMIT_LIFETIME_INSUFFICIENT");
 assert.deepEqual(Object.keys(bundle.files).sort(),Object.keys(arm.evidence_sha256).sort(),"RETRY_LOCAL_EVIDENCE_SET_MISMATCH");
 for(const [key,expected] of Object.entries(arm.evidence_sha256)) {
  assert(path.isAbsolute(bundle.files[key]),"RETRY_EVIDENCE_ABSOLUTE_PATH_REQUIRED");
  assert.equal(hashFile(bundle.files[key]),expected,"RETRY_LOCAL_EVIDENCE_CHANGED:"+key);
 }
 const decision=readJson(bundle.files.retry_adjudication);
 assert.deepEqual(decision,arm.retry_adjudication,"RETRY_DECISION_CONTENT_MISMATCH");
 return {verified,arm,plan};
}
function validateSuccessorReview(bundle,trust,context,now=Date.now()){
 if(bundle.arm?.run_id==='da9db7129607'&&bundle.arm.protected_main_sha!=='91835fa0997730c85c5f3869dd530f4c9a3ca82d'){
  assert.equal(bundle.arm.retry_adjudication?.review_contract_version,2,'DA9_SUCCESSOR_REQUIRES_V2_REVIEW');
 }
 if(bundle.arm?.retry_adjudication?.review_contract_version===2){
  const v2=require('../cap09_adoption_v1/da9-retry-bundle-v2.cjs');
  v2.verifyReviewedDecision(bundle.arm.retry_adjudication,trust,now,v2.subjectBinding(context));
 }
}
function stageContinuationMode(stage,ticket,previous){
 if(!stage)return false;
 assert(typeof stage==='string'&&/^(PRODUCER|TIMING_[123]|CONTROLLED_DELAY|AGGREGATE)$/.test(stage),'DA9_CHILD_STAGE_INVALID');
 assert(typeof ticket==='string'&&ticket.length>0&&typeof previous==='string'&&previous.length>0,'DA9_CHILD_STAGE_TICKET_REQUIRED');
 return true;
}
function hostBundle(file){
 const trust=readJson(permitApi.TRUST_PATH);
 // Preserve the legacy no-marker fail-closed gate as the first observable decision.
 // A present Adoption Request has a distinct, Windows-only signature verification path.
 const hasAdoptionRequest=Object.hasOwn(process.env,'MCFT_CAP09_ADOPTION_REQUEST');
 if(!hasAdoptionRequest){
  assert.equal(trust.adopted,true,"EXECUTE_HOLD: GOVERNED_RETRY_ACTIVATION_NOT_ADOPTED");
  assert.equal(trust.execution_enabled,true,"EXECUTE_HOLD: GOVERNED_RETRY_EXECUTION_DISABLED");
 }
 assert(process.platform==="win32"&&!process.env.CI&&!process.env.GITHUB_ACTIONS,"RETRY_WINDOWS_LOCAL_ONLY");
 assert(!process.env.NODE_OPTIONS&&!process.env.NODE_PATH,"RETRY_NODE_INJECTION_FORBIDDEN");
 // A present Adoption Request is verified before the legacy execution module is imported.
 // The repository trust remains disabled by default; signed TEST_ONLY Adoption is the
 // activation fact, while the same static trust root still supplies permit issuer/ledger policy.
 const offlineFile=process.env.MCFT_CAP09_ADOPTION_REQUEST;
 const offline=hasAdoptionRequest?require('../cap09_adoption_v1/offline-context.cjs'):null;
 const offlineContext=offline?offline.load(offlineFile,ROOT):null;
 const signedActivation=Boolean(offlineContext);
 if(signedActivation){
  assert.equal(offline.isFormalVerified(offlineContext),true,"OFFLINE_ADOPTION_VERIFICATION_REQUIRED");
  assert.equal(offlineContext.scope,"TEST_ONLY","OFFLINE_REAL_SCOPE_FORBIDDEN");
  assert.equal(offlineContext.execution_authorized,true,"OFFLINE_TEST_ONLY_NOT_AUTHORIZED");
  assert.equal(offlineContext.production_authorized,false,"OFFLINE_PRODUCTION_AUTHORITY_FORBIDDEN");
 }else{
  assert.equal(trust.adopted,true,"EXECUTE_HOLD: GOVERNED_RETRY_ACTIVATION_NOT_ADOPTED");
  assert.equal(trust.execution_enabled,true,"EXECUTE_HOLD: GOVERNED_RETRY_EXECUTION_DISABLED");
 }
 const effectiveTrust=signedActivation?{...trust,adopted:true,execution_enabled:true}:trust;
 const execution=require("./MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs");
 const context=offlineContext||execution.sourceContext();
 assert.equal(context.frozen_runtime_identical,true,"RETRY_FROZEN_RUNTIME_CHANGED");
 assert.equal(context.base_ancestor,true,"RETRY_BASE_ANCESTRY_MISSING");
 if(offline)assert.equal(context.host_id,os.hostname(),"OFFLINE_HOST_CHANGED");
 else context.host_id=os.hostname();
 const size=fs.statSync(file).size;assert(size>0&&size<=4*1024*1024,"RETRY_BUNDLE_SIZE_INVALID");
 const bundle=readJson(file);
 if(offline)offline.bindObserved(context,bundle);
 validateSuccessorReview(bundle,trust,context);
 if(bundle.arm?.run_id==='da9db7129607'&&bundle.arm.protected_main_sha!=='91835fa0997730c85c5f3869dd530f4c9a3ca82d'){
  const closureApi=require('../cap09_adoption_v1/da9-minio-closure-v1.cjs');
  // Only signed parent dispatch children with a stage ticket may consume historical
  // closure after the initial 300s Admission clock. Parent Preflight requires fresh evidence.
  const child=stageContinuationMode(process.env.MCFT_GOVERNED_RETRY_STAGE,process.env.MCFT_GOVERNED_RETRY_TICKET,process.env.MCFT_GOVERNED_RETRY_PREVIOUS_RECEIPT_SHA256);
  const closure=child
    ?closureApi.verifyHistoricalReference(bundle.observed.da9_minio_closure,trust,bundle.arm.protected_main_sha,Date.now(),context)
    :closureApi.verifyReference(bundle.observed.da9_minio_closure,trust,bundle.arm.protected_main_sha,Date.now(),context);
  assert.equal(closure.status,child?'CLOSURE_HISTORICAL_RETAINED_FOR_CONSUMED_STAGE':'CLOSURE_VERIFIED_FOR_DA9_ADMISSION','DA9_DISPOSITION_CLOSURE_REQUIRED');
 }
 const ticketedStage=stageContinuationMode(process.env.MCFT_GOVERNED_RETRY_STAGE,process.env.MCFT_GOVERNED_RETRY_TICKET,process.env.MCFT_GOVERNED_RETRY_PREVIOUS_RECEIPT_SHA256);
 const valid=validateBundle(bundle,effectiveTrust,context,{ticketedStage});
 const env={...process.env,MCFT_QUALIFICATION_FIRST_BASE:valid.arm.qualification_first_base,
  MCFT_CURRENT_QUALIFICATION_OUTPUT_DIR:valid.arm.output_directory};
 for(const [key,name] of [["DATABASE_URL",valid.arm.resources.positive_database],["BLOCKED_DATABASE_URL",valid.arm.resources.negative_database]]) {
  assertDedicatedPgUrl(valid.arm.run_id,env[key],name);
 }
 assert.equal(env.MCFT_CAP09_FORMAL_RAW_ENDPOINT,valid.arm.resources.bucket_endpoint);
 const targets=execution.isolatedTargets({isolated_run_id:valid.arm.run_id,qualification_first_base:valid.arm.qualification_first_base},env);
 if(offline) {
  for(const mutable of [targets.out,trust.ledger_root]) {
   const relative=path.relative(ROOT,path.resolve(mutable));
   assert(relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative),'OFFLINE_MUTABLE_PATH_INSIDE_RELEASE');
  }
 }
 return {...valid,bundle,trust,effectiveTrust,targets,env,context,signedActivation};
}
// Parent-only admission freshness is measured from the START of the complete
// multi-resource readback, matching the signed DA9 bundle. A late completion
// cannot extend the original 300-second trust window.
function assertFreshParentReadback(readback,now=Date.now()){
 assert(readback&&typeof readback==="object"&&!Array.isArray(readback),"RETRY_READBACK_REQUIRED");
 assert(Number.isFinite(now),"RETRY_READBACK_NOW_INVALID");
 const canonical=s=>typeof s==="string"&&Number.isFinite(Date.parse(s))&&new Date(Date.parse(s)).toISOString()===s;
 assert(canonical(readback.started_at)&&canonical(readback.completed_at),"RETRY_READBACK_CLOCK_INVALID");
 const start=Date.parse(readback.started_at),end=Date.parse(readback.completed_at);
 assert(start<=end&&end<=now,"RETRY_READBACK_CLOCK_ORDER_INVALID");
 assert(now-start<=300000,"RETRY_READBACK_STALE");
 return true;
}
// The official parent calls this no-effects boundary AFTER hostBundle completed
// signature, historical source, Adoption and full V3 budget admission checks.
// Synthetic acceptance calls the identical boundary only with fixture state.
function assertParentPreflightNoEffects(h,now=Date.now()){
 assert(h&&h.targets&&h.bundle,"RETRY_PARENT_PREFLIGHT_CONTEXT_REQUIRED");
 assert(!fs.existsSync(h.targets.out),"RETRY_NEW_OUTPUT_REQUIRED");
 assertFreshParentReadback(h.bundle.observed.fresh_readback,now);
 return true;
}
// V3's source-at-use safety budget must still fit when the parent actually
// burns its one-shot Permit, not merely when preflight began. This is V3-only:
// legacy signed V2 semantics are unchanged.
function assertV3FinalParentClock(h,now=Date.now()){
 const b=h.bundle?.observed?.pre_permit_safety_budget;
 if(b?.schema_version!=="geox_mcft_cap09_prepermit_source_use_budget_v3")return true;
 assert(Number.isFinite(now),"V3_FINAL_PARENT_CLOCK_INVALID");
 const ceiling=h.plan.stages.reduce((sum,s)=>sum+s.timeout_ms,0);
 assert.equal(ceiling,b.stage_timeout_sum_ms,"V3_FINAL_PARENT_SIGNED_CAPS_CHANGED");
 const bound=Math.min(Date.parse(h.arm.qualification_first_base),
  Date.parse(h.arm.expires_at),Date.parse(h.context.qualification_expires_at));
 assert(Number.isFinite(bound)&&now+ceiling+b.safety_margin_ms<bound,
  "V3_FINAL_PARENT_BUDGET_EXPIRED_BEFORE_PERMIT_CONSUMPTION");
 assertFreshParentReadback(h.bundle.observed.fresh_readback,now);
 return true;
}
function parseArgs(args){
 assert(args.includes("--operator-authorized")&&args.includes("--governed-retry")&&args.includes("--all"),"RETRY_EXPLICIT_ALL_REQUIRED");
 assert(args.includes("--execute")!==args.includes("--preflight-only"),"RETRY_SELECT_ONE_MODE");
 const at=args.indexOf("--retry-bundle");assert(at>=0&&path.isAbsolute(args[at+1]||""),"RETRY_BUNDLE_REQUIRED");
 const flags=args.filter((_,i)=>i!==at+1);
 assert(new Set(flags).size===flags.length,"RETRY_DUPLICATE_ARGUMENT");
 assert(flags.every(x=>["--operator-authorized","--governed-retry","--all","--execute","--preflight-only","--retry-bundle"].includes(x)),"RETRY_UNKNOWN_ARGUMENT");
 return {file:args[at+1],execute:args.includes("--execute")};
}
function stageEnvironment(h,id,bundleFile){
 const env={...h.env,MCFT_SUBJECT_SHA:h.arm.protected_main_sha,MCFT_GOVERNED_RETRY_BUNDLE:bundleFile,MCFT_GOVERNED_RETRY_STAGE:id,
  MCFT_CAP09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION:"1",MCFT_CAP09_V13_EXACT_HEAD_TIMING_SAMPLE:"1",
  MCFT_TIMING_SAMPLE_DIR:h.targets.out,MCFT_TIMING_RUN_ID:String(parseInt(h.arm.run_id,16)),MCFT_TIMING_RUN_ATTEMPT:"1",
  MCFT_TIMING_WAKE_DELAY_MS:"0",MCFT_TIMING_JOB_START_SETUP_MS:"0",MCFT_TIMING_LOCAL_LAUNCH_AT_MS:String(Date.now()),
  MCFT_GOVERNED_RETRY_RUN_ID:h.arm.run_id,
  MCFT_GOVERNED_RETRY_DELAY_TIMEOUT_MS:String(h.plan.stages[4].timeout_ms)};
 if(id.startsWith("TIMING_")){const n=Number(id.slice(-1));env.MCFT_TIMING_SAMPLE_ID="sample"+n;env.MCFT_TIMING_BASE_TARGET=new Date(Date.parse(h.arm.qualification_first_base)+(n-1)*3600000).toISOString();}
 return env;
}
function assertControllerAdoption(h){
 if(h.signedActivation){
  assert.equal(require("../cap09_adoption_v1/offline-context.cjs").isFormalVerified(h.context),true,"OFFLINE_ADOPTION_VERIFICATION_REQUIRED");
  assert.equal(h.context.execution_authorized,true,"OFFLINE_TEST_ONLY_NOT_AUTHORIZED");
  assert.equal(h.context.production_authorized,false,"OFFLINE_PRODUCTION_AUTHORITY_FORBIDDEN");
 }else{
  assert.equal(h.trust.real_delay_controller_adopted,true,"EXECUTE_HOLD: REAL_DELAY_CONTROLLER_NOT_ADOPTED");
  assert.equal(h.trust.stage_capability_adopted,true,"EXECUTE_HOLD: STAGE_CAPABILITY_NOT_ADOPTED");
  assert.equal(h.trust.real_provider_transport_delay_adopted,true,"EXECUTE_HOLD: REAL_PROVIDER_TRANSPORT_DELAY_NOT_ADOPTED");
  assert.equal(h.trust.real_pipeline_delay_adopted,true,"EXECUTE_HOLD: REAL_PIPELINE_DELAY_NOT_ADOPTED");
 }
}
async function main(args){
 assert(!process.env.MCFT_GOVERNED_RETRY_STAGE&&!process.env.MCFT_GOVERNED_RETRY_TICKET,'DA9_PARENT_CANNOT_USE_CHILD_ADMISSION_PATH');
 const options=parseArgs(args),h=hostBundle(options.file);
 assertParentPreflightNoEffects(h);
 if(!options.execute)return {status:"SIGNED_RETRY_PREFLIGHT_PASS_NOT_EXECUTED",execute_authorized:false};
 // Preflight EVERYTHING before irreversible single-use parent permit consumption.
 // On the migrated path, these exact controller/stage bytes are covered by the signed
 // Adoption qualification; legacy execution still requires its repository adoption flags.
 assertControllerAdoption(h);
 const scripts=STAGES.map(([id,file,artifact],i)=>{
   const script=path.join(__dirname,file);
   const stat=fs.lstatSync(script);
   assert(stat.isFile()&&!stat.isSymbolicLink(),"RETRY_STAGE_SOURCE_NOT_FROZEN:"+id);
   const args=file.endsWith(".ts")?["--import","tsx",script]:[script];
   const env=stageEnvironment(h,id,options.file);
   assert.equal(path.dirname(path.join(h.targets.out,artifact)),h.targets.out,"RETRY_ARTIFACT_ISOLATION_REQUIRED");
   return {id,script,artifact:path.join(h.targets.out,artifact),cwd:ROOT,executable:process.execPath,args,env};
 });
 assert(!fs.existsSync(path.join(h.trust.ledger_root,"run-"+h.arm.run_id)),"RETRY_LEDGER_RUN_REUSE");
 assert(!fs.existsSync(h.targets.out),"RETRY_OUTPUT_REUSE");
 assert.equal(typeof require.resolve("tsx"),"string","RETRY_TSX_DEPENDENCY_REQUIRED");
 const check=cp.spawnSync(process.env.MCFT_PYTHON_EXECUTABLE||"python",
   [path.join(ROOT,"apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_scientific_core_v1.py"),"selftest"],
   {cwd:ROOT,timeout:60000,encoding:"utf8",maxBuffer:1024*1024});
 assert.equal(check.status,0,"RETRY_SCIENTIFIC_SELFTEST_REQUIRED:"+String(check.stderr||"").slice(-350));
 assertV3FinalParentClock(h);
 const consumed=permitApi.consumePermit(h.verified);
 const authority=stageCap.initializeStageAuthority(consumed,h.verified.payload);
 fs.mkdirSync(h.targets.out,{recursive:false,mode:0o700});
 fs.writeFileSync(path.join(h.targets.out,"STARTED_RETRY.json"),JSON.stringify({
  run_id:h.arm.run_id,subject_sha:h.arm.protected_main_sha,started_at:new Date().toISOString(),
  single_use_permit_consumed:true,production_owner_activation:false,formal_v5_arm:false
 },null,2)+"\n",{flag:"wx",mode:0o600});
 const audit=await scheduler.executeSixStages({authority,plan:h.plan,steps:scripts,
  dispatch:async (authority,step)=>dispatchConsumedStage(authority,freshStageLaunch(step)),
  assertConsumed:permitApi.assertConsumed});
 if(h.arm.run_id==='da9db7129607'&&h.arm.retry_adjudication?.review_contract_version===2) {
   // This sidecar is written ONLY after the genuine six-stage scheduler sealed
   // actual run-scoped receipts. It is still NOT measurement qualification.
   const verifier=require('./MCFT_CAP09_POSTEXECUTION_TIMING_ADJUDICATION_V2.cjs');
   const result=verifier.adjudicatePostExecutionTimingV2({
     runDirectory:authority.consumed.run_directory,artifactDirectory:h.targets.out,
     runId:h.arm.run_id,subjectSha:h.arm.protected_main_sha
   });
   assert.equal(result.execute_authorized,false,'POSTEXEC_MUST_NOT_GRANT_EXECUTE');
   assert.equal(result.timing_budget_qualified,false,'POSTEXEC_MUST_NOT_AUTO_QUALIFY');
   const record=path.join(authority.consumed.run_directory,'POSTEXECUTION_TIMING_REVIEW_V2.json');
   const fd=fs.openSync(record,'wx',0o600);
   try{fs.writeFileSync(fd,JSON.stringify(result,null,2)+'\n');fs.fsyncSync(fd);}
   finally{fs.closeSync(fd);}
 }
 return {status:audit.status,run_id:h.arm.run_id,stage_count:audit.stage_count,
  final_receipt_sha256:audit.final_receipt_sha256,output:h.targets.out,
  controlled_delay_scratch_only:true,provider_slow_path_proven:false,qualification_pass:false,
  production_owner_activation:false,formal_v5_arm:false};
}
// Separate child validation: no implicit legacy ARM fallback when marker exists.
function childTargets(){
 const file=process.env.MCFT_GOVERNED_RETRY_BUNDLE,id=process.env.MCFT_GOVERNED_RETRY_STAGE;
 assert(file&&id,"RETRY_CHILD_CONTEXT_REQUIRED");
 const h=hostBundle(file);
 const stage=STAGES.find(s=>s[0]===id);assert(stage,"RETRY_CHILD_UNKNOWN_STAGE");
 assert.equal(path.resolve(process.argv[1]),path.join(__dirname,stage[1]),"RETRY_CHILD_WRONG_SCRIPT");
 // Every TypeScript child and the scratch-delay child must burn the exact
 // parent-signed stage ticket before Provider, DB, or output effects.
 assertControllerAdoption(h);
 const ticket=process.env.MCFT_GOVERNED_RETRY_TICKET;
 const previous=process.env.MCFT_GOVERNED_RETRY_PREVIOUS_RECEIPT_SHA256;
 assert(ticket&&previous,"RETRY_CHILD_ONE_TIME_CAPABILITY_REQUIRED");
 const claim=stageCap.consumeStageCapability({ticket,
  run_directory:path.join(h.trust.ledger_root,"run-"+h.arm.run_id),
  id,run_id:h.arm.run_id,nonce:h.verified.payload.nonce,
  subject_sha:h.arm.protected_main_sha,envelope_sha256:h.verified.envelope_sha256,
  script:path.join(__dirname,stage[1]),previous_sha256:previous});
 assert.equal(claim.status,"STAGE_CAPABILITY_CONSUMED_NO_RETRY");
 return h.targets;
}
module.exports={stageContinuationMode,validateSuccessorReview,assertControllerAdoption,assertFreshParentReadback,assertParentPreflightNoEffects,assertV3FinalParentClock,STAGES,validatePlan,validateBundle,parseArgs,hostBundle,stageEnvironment,main,childTargets};
