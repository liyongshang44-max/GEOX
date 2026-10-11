"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const permitApi=require("./MCFT_CAP09_RETRY_PERMIT_V1.cjs");
const {admitProposedRetry}=require("../governance_acceptance/MCFT_CAP09_ISOLATED_RETRY_ADMISSION_BRIDGE_V1.cjs");
const {hashFile}=require("./MCFT_CAP09_STAGE_RECEIPTS_V1.cjs");
const ROOT=path.resolve(__dirname,"../..");
const STAGES=Object.freeze([
 ["PRODUCER","RUN_MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2.ts","MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2_RESULT.json"],
 ...[1,2,3].map(i=>["TIMING_"+i,"RUN_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_V2.ts",`MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE${i}_V2_RESULT.json`]),
 ["AGGREGATE","AGGREGATE_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V2.ts","MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V2_RESULT.json"]
]);
const digest=value=>permitApi.sha(permitApi.canonical(value));
function readJson(file){return JSON.parse(fs.readFileSync(file,"utf8").replace(/^\uFEFF/,""));}
function validatePlan(plan){
 assert.deepEqual(Object.keys(plan).sort(),["schema_version","stages"],"RETRY_PLAN_KEYS_INVALID");
 assert.equal(plan.schema_version,"geox_mcft_cap09_retry_stage_plan_v1");
 assert.equal(plan.stages.length,STAGES.length,"RETRY_STAGE_COUNT_INVALID");
 for(let i=0;i<STAGES.length;i++) {
  const stage=plan.stages[i];assert.deepEqual(Object.keys(stage).sort(),["id","timeout_ms"]);
  assert.equal(stage.id,STAGES[i][0],"RETRY_STAGE_ORDER_INVALID");
  assert(Number.isSafeInteger(stage.timeout_ms)&&stage.timeout_ms>0&&stage.timeout_ms<=3600000,"RETRY_STAGE_TIMEOUT_INVALID");
 }
}
function validateBundle(bundle,trust,context){
 assert.equal(trust.adopted,true,"EXECUTE_HOLD: GOVERNED_RETRY_ACTIVATION_NOT_ADOPTED");
 assert.equal(trust.execution_enabled,true,"EXECUTE_HOLD: GOVERNED_RETRY_EXECUTION_DISABLED");
 assert.deepEqual(Object.keys(bundle).sort(),["arm","files","observed","permit","plan"],"RETRY_BUNDLE_KEYS_INVALID");
 validatePlan(bundle.plan);
 const {arm,observed,permit,plan}=bundle;
 const verified=permitApi.verifyPermit(permit,trust,{...context,arm_sha256:digest(arm),observations_sha256:digest(observed),plan_sha256:digest(plan)});
 assert.equal(verified.payload.run_id,arm.run_id,"PERMIT_ARM_RUN_MISMATCH");
 assert.equal(verified.payload.subject_sha,arm.protected_main_sha,"PERMIT_ARM_HEAD_MISMATCH");
 assert.equal(verified.payload.issued_at,arm.authorized_at,"PERMIT_ARM_ISSUED_MISMATCH");
 assert.equal(verified.payload.expires_at,arm.expires_at,"PERMIT_ARM_EXPIRY_MISMATCH");
 assert.equal(arm.armed,true,"RETRY_ARM_DISABLED");
 assert.equal(arm.execute_authorized,true,"RETRY_EXECUTE_NOT_APPROVED");
 assert.equal(arm.retry_authorized,true,"RETRY_NOT_APPROVED");
 const observation={...observed,head:context.head,protected_main:context.main,source_clean:context.clean,now_utc:context.now};
 admitProposedRetry(arm,observation);
 const base=Date.parse(arm.qualification_first_base);
 assert(Number.isFinite(base)&&new Date(base).toISOString()===arm.qualification_first_base&&arm.qualification_first_base.endsWith(":00:00.000Z"),"RETRY_BASE_INVALID");
 assert(base>Date.parse(context.now),"RETRY_BASE_MUST_BE_FUTURE");
 const budget=plan.stages.reduce((n,s)=>n+s.timeout_ms,0);
 assert(budget<=observed.measured_worst_case_ms,"RETRY_PLAN_EXCEEDS_REVIEWED_BUDGET");
 assert(Date.parse(arm.expires_at)>Date.parse(context.now)+budget+observed.deadline_safety_margin_ms,"RETRY_PERMIT_LIFETIME_INSUFFICIENT");
 assert.deepEqual(Object.keys(bundle.files).sort(),Object.keys(arm.evidence_sha256).sort(),"RETRY_LOCAL_EVIDENCE_SET_MISMATCH");
 for(const [key,expected] of Object.entries(arm.evidence_sha256)) {
  assert(path.isAbsolute(bundle.files[key]),"RETRY_EVIDENCE_ABSOLUTE_PATH_REQUIRED");
  assert.equal(hashFile(bundle.files[key]),expected,"RETRY_LOCAL_EVIDENCE_CHANGED:"+key);
 }
 const decision=readJson(bundle.files.retry_adjudication);
 assert.deepEqual(decision,arm.retry_adjudication,"RETRY_DECISION_CONTENT_MISMATCH");
 return {verified,arm,plan};
}
function hostBundle(file){
 // Keep the adopted gate first: candidate code cannot invoke Git/DB/Provider.
 const trust=readJson(permitApi.TRUST_PATH);
 assert.equal(trust.adopted,true,"EXECUTE_HOLD: GOVERNED_RETRY_ACTIVATION_NOT_ADOPTED");
 assert.equal(trust.execution_enabled,true,"EXECUTE_HOLD: GOVERNED_RETRY_EXECUTION_DISABLED");
 assert(process.platform==="win32"&&!process.env.CI&&!process.env.GITHUB_ACTIONS,"RETRY_WINDOWS_LOCAL_ONLY");
 assert(!process.env.NODE_OPTIONS&&!process.env.NODE_PATH,"RETRY_NODE_INJECTION_FORBIDDEN");
 const execution=require("./MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs");
 const context=execution.sourceContext();
 assert.equal(context.frozen_runtime_identical,true,"RETRY_FROZEN_RUNTIME_CHANGED");
 assert.equal(context.base_ancestor,true,"RETRY_BASE_ANCESTRY_MISSING");
 context.host_id=os.hostname();
 const size=fs.statSync(file).size;assert(size>0&&size<=4*1024*1024,"RETRY_BUNDLE_SIZE_INVALID");
 const bundle=readJson(file),valid=validateBundle(bundle,trust,context);
 const env={...process.env,MCFT_QUALIFICATION_FIRST_BASE:valid.arm.qualification_first_base,
  MCFT_CURRENT_QUALIFICATION_OUTPUT_DIR:valid.arm.output_directory};
 for(const [key,name] of [["DATABASE_URL",valid.arm.resources.positive_database],["BLOCKED_DATABASE_URL",valid.arm.resources.negative_database]]) {
  const u=new URL(env[key]);
  assert.equal(u.hostname,"127.0.0.1");assert.equal(u.port,"55432");assert.equal(u.search,"");assert.equal(u.hash,"");
  assert.equal(decodeURIComponent(u.pathname.slice(1)),name);
 }
 assert.equal(env.MCFT_CAP09_FORMAL_RAW_ENDPOINT,valid.arm.resources.bucket_endpoint);
 const targets=execution.isolatedTargets({isolated_run_id:valid.arm.run_id,qualification_first_base:valid.arm.qualification_first_base},env);
 return {...valid,bundle,trust,targets,env,context};
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
  MCFT_TIMING_WAKE_DELAY_MS:"0",MCFT_TIMING_JOB_START_SETUP_MS:"0",MCFT_TIMING_LOCAL_LAUNCH_AT_MS:String(Date.now())};
 if(id.startsWith("TIMING_")){const n=Number(id.slice(-1));env.MCFT_TIMING_SAMPLE_ID="sample"+n;env.MCFT_TIMING_BASE_TARGET=new Date(Date.parse(h.arm.qualification_first_base)+(n-1)*3600000).toISOString();}
 return env;
}
async function main(args){
 const options=parseArgs(args),h=hostBundle(options.file);
 assert(!fs.existsSync(h.targets.out),"RETRY_NEW_OUTPUT_REQUIRED");
 const observedAt=Date.parse(h.bundle.observed.fresh_readback.completed_at);
 assert(Number.isFinite(observedAt)&&observedAt<=Date.now()&&Date.now()-observedAt<=300000,"RETRY_READBACK_STALE");
 if(!options.execute)return {status:"SIGNED_RETRY_PREFLIGHT_PASS_NOT_EXECUTED",execute_authorized:false};
 // Until a separately implemented real-delay plan is adopted, never run a
 // partial Producer sequence and pretend that it covers the requested matrix.
 assert.equal(h.trust.real_delay_controller_adopted,true,"EXECUTE_HOLD: REAL_DELAY_CONTROLLER_NOT_ADOPTED");
 throw new Error("EXECUTE_HOLD: REAL_DELAY_STAGE_IMPLEMENTATION_REQUIRED");
}
// Separate child validation: no implicit legacy ARM fallback when marker exists.
function childTargets(){
 const file=process.env.MCFT_GOVERNED_RETRY_BUNDLE,id=process.env.MCFT_GOVERNED_RETRY_STAGE;
 assert(file&&id,"RETRY_CHILD_CONTEXT_REQUIRED");
 const h=hostBundle(file);
 const stage=STAGES.find(s=>s[0]===id);assert(stage,"RETRY_CHILD_UNKNOWN_STAGE");
 assert.equal(path.resolve(process.argv[1]),path.join(__dirname,stage[1]),"RETRY_CHILD_WRONG_SCRIPT");
 // Parent launch and per-stage consumption are deliberately unavailable until
 // the full real-delay controller is present. Signature PASS alone never launches.
 throw new Error("EXECUTE_HOLD: RETRY_PARENT_STAGE_AUTHORITY_NOT_IMPLEMENTED");
}
module.exports={STAGES,validatePlan,validateBundle,parseArgs,hostBundle,stageEnvironment,main,childTargets};
