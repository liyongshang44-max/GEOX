"use strict";
/*
 * R4285 standalone Windows Host for exact-main TEST_ONLY six-stage execution.
 * No signer, Permit issuer, provisioner or automatic retry.
 * --preflight-only makes read-only GitHub/PG/S3 checks and does not burn Permit.
 * --execute requires independent Owner/Lineage/Adoption, R4285 Permit, fresh
 * resource proof and physically authorized execution decision; absent any
 * required input it fails closed BEFORE Run/Nonce reservation.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const cp=require("node:child_process"),crypto=require("node:crypto");
const c=require("../cap09_adoption_v1/contract.cjs");
const native=require("../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V1.cjs");
const lineage=require("../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs");
const resource=require("../governance_acceptance/MCFT_CAP09_R4285_RESOURCE_OWNER_V1.cjs");
const permit=require("./MCFT_CAP09_R4285_PERMIT_V1.cjs");
const approval=require("./MCFT_CAP09_R4285_EXECUTION_APPROVAL_V1.cjs");
const atomic=require("./MCFT_CAP09_R4285_PERMIT_ATOMIC_V1.cjs");
const stages=require("./MCFT_CAP09_R4285_STAGE_CAPABILITY_V1.cjs");
const child=require("./MCFT_CAP09_R4285_CHILD_STAGE_V1.cjs");
const dispatch=require("./MCFT_CAP09_R4285_PARENT_STAGE_DISPATCH_V1.cjs");
const scheduler=require("./MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs");
const receipts=require("./MCFT_CAP09_R4285_STAGE_RECEIPTS_V1.cjs");
const pgReadOnly=require("./MCFT_CAP09_R4285_PG_READONLY_V1.cjs");
const current=require("./MCFT_CAP09_R4285_CURRENT_BASELINE_EXECUTION_V1.cjs");
const {freshStageLaunch}=require("./MCFT_CAP09_STAGE_START_CLOCK_V1.cjs");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const RUN="4285c3ce342c";
const FILES=Object.freeze({
 PRODUCER:"MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2_RESULT.json",
 TIMING_1:"MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE1_V2_RESULT.json",
 TIMING_2:"MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE2_V2_RESULT.json",
 TIMING_3:"MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE3_V2_RESULT.json",
 CONTROLLED_DELAY:"MCFT_CAP09_REAL_CONTROLLED_DELAY_V1_RESULT.json",
 AGGREGATE:"MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V2_RESULT.json"
});
const INPUTS=Object.freeze(["source_root","release_root","native_adoption_input_file",
 "permit_envelope_file","resource_envelope_file","resource_readback_file",
 "plan_file","observations_file","output_root","first_base"]);
const EXEC_INPUTS=Object.freeze([...INPUTS,"execution_approval_file","cto_decision_file"]);
function fileBytes(p,limit=16*1024*1024){
 assert(typeof p==="string"&&path.isAbsolute(p),"R4285_HOST_ABSOLUTE_FILE_REQUIRED");
 let cursor=path.resolve(p),original=cursor;
 for(;;){
  const s=fs.lstatSync(cursor);
  assert(!s.isSymbolicLink(),"R4285_HOST_REPARSE_POINT");
  if(cursor===original)assert(s.isFile()&&s.size>0&&s.size<=limit,"R4285_HOST_UNSAFE_FILE");
  const parent=path.dirname(cursor);if(parent===cursor)break;cursor=parent;
 }
 return fs.readFileSync(p);
}
function json(p){return JSON.parse(fileBytes(p).toString("utf8").replace(/^\uFEFF/,""))}
function exact(obj,fields,code){
 assert(obj&&typeof obj==="object"&&!Array.isArray(obj),code);
 assert.deepEqual(Object.keys(obj).sort(),[...fields].sort(),code);
}
function checkInput(data,execute){
 exact(data,execute?EXEC_INPUTS:INPUTS,"R4285_HOST_INPUT_EXACT");
 for(const [name,v] of Object.entries(data)){
  if(name==="first_base")continue;
  assert(typeof v==="string"&&path.isAbsolute(v),"R4285_HOST_ABSOLUTE_INPUT:"+name);
 }
 assert(/^\d{4}-\d\d-\d\dT\d\d:00:00\.000Z$/.test(data.first_base)&&
  Number.isFinite(Date.parse(data.first_base)),"R4285_HOST_CANONICAL_BASE");
 return data;
}
function hostOnly(env=process.env,platform=process.platform){
 assert(platform==="win32"&&!env.CI&&!env.GITHUB_ACTIONS,"R4285_HOST_REAL_WINDOWS_ONLY");
 for(const k of ["NODE_OPTIONS","NODE_PATH","PYTHONPATH","PYTHONHOME",
  "MCFT_R4285_CHILD","MCFT_ATTEMPT3_V2_CHILD","MCFT_GOVERNED_RETRY_TICKET"])
  assert(!env[k],"R4285_HOST_INJECTED_OR_CHILD_ENV:"+k);
}
function checkResourceEnv(p,env){
 assert.equal(p.run_id,RUN);
 const positive=new URL(env.DATABASE_URL||""),negative=new URL(env.BLOCKED_DATABASE_URL||"");
 for(const [u,db] of [[positive,p.positive_database],[negative,p.negative_database]]){
  assert(["postgres:","postgresql:"].includes(u.protocol),"R4285_HOST_POSTGRES_URL_SCHEME");
  assert.equal(u.hostname,p.database_host,"R4285_HOST_PG_HOST_MISMATCH");
  assert.equal(u.port,String(p.database_port),"R4285_HOST_PG_PORT_MISMATCH");
  assert.equal(decodeURIComponent(u.pathname.slice(1)),db,"R4285_HOST_PG_DATABASE_MISMATCH");
  assert(u.password.length>0&&!u.hash&&!u.search,"R4285_HOST_PG_URL_NOT_SCOPED");
 }
 assert.equal(env.MCFT_CAP09_FORMAL_RAW_BUCKET,p.bucket,"R4285_HOST_BUCKET_MISMATCH");
 assert.equal(env.MCFT_CAP09_FORMAL_RAW_ENDPOINT,p.bucket_endpoint,"R4285_HOST_S3_ENDPOINT_MISMATCH");
 for(const key of ["MCFT_CAP09_FORMAL_RAW_REGION","MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID",
  "MCFT_CAP09_FORMAL_RAW_SECRET_ACCESS_KEY"])
  assert(typeof env[key]==="string"&&env[key].length>0,"R4285_HOST_S3_CREDENTIAL_MISSING:"+key);
 assert(!["minioadmin","root"].includes(env.MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID),
  "R4285_HOST_S3_BOOTSTRAP_ROOT_FORBIDDEN");
}
async function probeS3ReadOnly(releaseRoot,p,env){
 const sdk=require(require.resolve("@aws-sdk/client-s3",{paths:[releaseRoot]}));
 const {S3Client,HeadBucketCommand,ListObjectsV2Command,ListObjectVersionsCommand,ListMultipartUploadsCommand}=sdk;
 for(const item of [S3Client,HeadBucketCommand,ListObjectsV2Command,ListObjectVersionsCommand,ListMultipartUploadsCommand])
  assert(typeof item==="function","R4285_HOST_S3_READONLY_CLIENT_INCOMPLETE");
 const client=new S3Client({
  endpoint:p.bucket_endpoint,region:env.MCFT_CAP09_FORMAL_RAW_REGION,forcePathStyle:true,
  credentials:{accessKeyId:env.MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID,
   secretAccessKey:env.MCFT_CAP09_FORMAL_RAW_SECRET_ACCESS_KEY},
  maxAttempts:1
 });
 try{
  await client.send(new HeadBucketCommand({Bucket:p.bucket}));
  const objects=await client.send(new ListObjectsV2Command({Bucket:p.bucket,MaxKeys:2}));
  const versions=await client.send(new ListObjectVersionsCommand({Bucket:p.bucket,MaxKeys:2}));
  const uploads=await client.send(new ListMultipartUploadsCommand({Bucket:p.bucket,MaxUploads:2}));
  assert(!objects.IsTruncated&&!(objects.Contents||[]).length,"R4285_HOST_S3_BUCKET_NONEMPTY");
  assert(!versions.IsTruncated&&!(versions.Versions||[]).length&&
   !(versions.DeleteMarkers||[]).length,"R4285_HOST_S3_VERSION_OR_DELETE_MARKER_PRESENT");
  assert(!uploads.IsTruncated&&!(uploads.Uploads||[]).length,"R4285_HOST_S3_MULTIPART_PRESENT");
  return Object.freeze({status:"R4285_REAL_S3_EMPTY_PRIVATE_SCOPED_READONLY",
   operations:4,no_write:true});
 }finally{client.destroy();}
}
function resolveStages({input,profile,permitPayload,trust,plan,observed,env}){
 scheduler.validateStagePlan(plan);
 assert.equal(permitPayload.run_id,RUN);
 assert.equal(c.digest(plan),permitPayload.plan_sha256,"R4285_HOST_UNSIGNED_PLAN");
 assert.equal(c.digest(observed),permitPayload.observations_sha256,"R4285_HOST_UNSIGNED_OBSERVATIONS");
 assert.equal(path.resolve(__dirname),path.join(input.release_root,"scripts","runtime_acceptance"),
  "R4285_HOST_NOT_FROM_INSTALLED_RELEASE");
 assert(Date.parse(input.first_base)>Date.now()+60_000,"R4285_HOST_BASE_TOO_SOON");
 assert(!fs.existsSync(input.output_root),"R4285_HOST_OUTPUT_ALREADY_EXISTS");
 assert(path.relative(input.release_root,input.output_root).startsWith(".."+path.sep),
  "R4285_HOST_OUTPUT_INSIDE_RELEASE");
 assert.equal(env.MCFT_QUALIFICATION_FIRST_BASE,input.first_base);
 const expected=current.isolatedTargets({isolated_run_id:RUN,
  qualification_first_base:input.first_base},{...env,
  MCFT_CURRENT_QUALIFICATION_OUTPUT_DIR:input.output_root,MCFT_QUALIFICATION_FIRST_BASE:input.first_base});
 assert.equal(expected.out,path.resolve(input.output_root));
 assert.equal(profile.tools?.node?.path,fs.realpathSync(process.execPath),
  "R4285_HOST_EXECUTABLE_NOT_INSTALLED");
 require.resolve("tsx",{paths:[input.release_root]});
 const index=new Map(profile.files.map(f=>[f.path,f.sha256]));
 assert.equal(index.size,profile.files.length,"R4285_HOST_DUPLICATE_MATERIAL");
 const code=path.join(input.release_root,"scripts","runtime_acceptance");
 const baseEnv={...env,MCFT_R4285_CHILD:"1",MCFT_SUBJECT_SHA:permitPayload.subject_sha,
  MCFT_GOVERNED_RETRY_RUN_ID:RUN,MCFT_R4285_LEDGER_ROOT:trust.ledger_root,
  MCFT_R4285_NONCE:permitPayload.nonce,MCFT_R4285_PERMIT_ENVELOPE_SHA256:"",
  MCFT_R4285_OBSERVED_FILE:path.join(input.output_root,"SIGNED_OBSERVED_R4285.json"),
  MCFT_R4285_OBSERVATIONS_SHA256:permitPayload.observations_sha256,
  MCFT_QUALIFICATION_FIRST_BASE:input.first_base,
  MCFT_CURRENT_QUALIFICATION_OUTPUT_DIR:input.output_root,
  MCFT_CAP09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION:"1",
  MCFT_CAP09_V13_EXACT_HEAD_TIMING_SAMPLE:"1",
  MCFT_TIMING_SAMPLE_DIR:input.output_root,MCFT_TIMING_RUN_ID:String(parseInt(RUN,16)),
  MCFT_TIMING_RUN_ATTEMPT:"1",MCFT_TIMING_WAKE_DELAY_MS:"0",
  MCFT_TIMING_JOB_START_SETUP_MS:"0",MCFT_TIMING_LOCAL_LAUNCH_AT_MS:String(Date.now()),
  MCFT_GOVERNED_RETRY_DELAY_TIMEOUT_MS:String(plan.stages[4].timeout_ms)};
 return scheduler.STAGES.map((id,i)=>{
  const script=path.join(code,child.SCRIPT[id]),rel="scripts/runtime_acceptance/"+child.SCRIPT[id];
  assert.equal(path.resolve(script),script);
  assert.equal(sha(fileBytes(script)),index.get(rel),"R4285_HOST_UNSIGNED_STAGE_SOURCE:"+id);
  const args=script.endsWith(".cjs")?[script]:["--import","tsx",script];
  const stageEnv={...baseEnv,MCFT_GOVERNED_RETRY_STAGE:id,
   ...(id.startsWith("TIMING_")?{
    MCFT_TIMING_SAMPLE_ID:"sample"+id.at(-1),
    MCFT_TIMING_BASE_TARGET:new Date(Date.parse(input.first_base)+(i-1)*3600000).toISOString()
   }:{})};
  return Object.freeze({id,script,cwd:input.release_root,
   artifact:path.join(input.output_root,FILES[id]),
   executable:profile.tools.node.path,args,env:stageEnv});
 });
}
function buildAdmission(input,env=process.env){
 hostOnly(env);
 const nativeInput=json(input.native_adoption_input_file);
 const adoption=native.checkNativeAdoption(nativeInput);
 assert(native.isNativeVerified(adoption),"R4285_HOST_NATIVE_ADOPTION_MISSING");
 assert.equal(nativeInput.source_root,input.source_root,"R4285_HOST_SOURCE_ROOT_SPLIT");
 assert.equal(path.resolve(nativeInput.release_root),path.resolve(input.release_root),
  "R4285_HOST_RELEASE_ROOT_SPLIT");
 lineage.verifyExactMain(input.source_root,adoption.subject_sha);
 const trust=json(nativeInput.trust_file),resEnv=json(input.resource_envelope_file);
 const resourceBytes=fileBytes(input.resource_readback_file);
 const resourceSha=sha(resourceBytes),readback=resource.verifyReadbackFile(input.resource_readback_file,resourceSha);
 const owner=resource.verify(resEnv,trust,{subject_sha:adoption.subject_sha,
  host_id:lineage.HOST,readback_sha256:resourceSha,now:Date.now()});
 resource.bindSignedToReadback(resEnv.payload,readback);
 assert.equal(owner.run_id,RUN);
 checkResourceEnv(resEnv.payload,env);
 const plan=json(input.plan_file),observed=json(input.observations_file);
 scheduler.validateStagePlan(plan);
 const signedInput=json(nativeInput.signed_evidence_input_file).signed_evidence;
 assert.equal(signedInput.source_root,input.source_root);
 const lineageEnv=json(signedInput.lineage_envelope_file);
 const ownerEnv=json(nativeInput.owner_envelope_file);
 const adoptionEnv=json(nativeInput.adoption_envelope_file);
 const histSha=signedInput.fullchain_attestation_sha256;
 const context={subject_sha:adoption.subject_sha,protected_main_sha:adoption.subject_sha,
  source_clean:true,host_id:lineage.HOST,
  inventory_sha256:sha(fileBytes(nativeInput.inventory_file)),
  authority_registry_sha256:sha(fileBytes(nativeInput.authority_registry_file)),
  owner_envelope_sha256:sha(Buffer.from(lineage.canonical(ownerEnv))),
  lineage_envelope_sha256:sha(Buffer.from(lineage.canonical(lineageEnv))),
  adoption_envelope_sha256:sha(Buffer.from(lineage.canonical(adoptionEnv))),
  qcp70_raw_sha256:sha(fileBytes(nativeInput.qcp_raw_file)),
  installed_material_digest:adoption.material_digest,
  release_binding_sha256:sha(fileBytes(nativeInput.release_binding_file)),
  resource_owner_envelope_sha256:sha(Buffer.from(lineage.canonical(resEnv))),
  resource_readback_sha256:resourceSha,
  historic_fullchain_attestation_sha256:histSha,
  plan_sha256:c.digest(plan),observations_sha256:c.digest(observed),
  adoption_expires_at:adoptionEnv.payload.expires_at,
  resource_owner_expires_at:resEnv.payload.expires_at,
  total_stage_budget_ms:plan.stages.reduce((n,s)=>n+s.timeout_ms,0)};
 const permitEnv=json(input.permit_envelope_file);
 const permitProof=permit.verifyReadOnly(permitEnv,trust,context);
 assert(permit.isVerified(permitProof));
 const prepared=atomic.prepare({nativeAdoption:adoption,permitProof,trust,sourceRoot:input.source_root});
 const profile=json(nativeInput.material_file);
 const steps=resolveStages({input,profile,permitPayload:permitEnv.payload,trust,plan,observed,env});
 return Object.freeze({adoption,permitProof,permitEnv,prepared,context,
  trust,resEnv,plan,observed,steps,profile,nativeInput,readback});
}
async function dynamicPreflight(input,env=process.env){
 const state=buildAdmission(input,env);
 await pgReadOnly.probePreconsumePostgres({
  admission:{resourceEnvelope:state.resEnv,permitEnvelope:state.permitEnv,
   releaseRoot:input.release_root},releaseRoot:input.release_root,environment:env});
 const storage=await probeS3ReadOnly(input.release_root,state.resEnv.payload,env);
 assert.equal(state.steps.length,6);
 return {state,storage};
}
async function preflight(input,env=process.env){
 checkInput(input,false);
 const {state,storage}=await dynamicPreflight(input,env);
 assert(atomic.isPrepared(state.prepared));
 return Object.freeze({status:"R4285_WINDOWS_REAL_PREFLIGHT_PASS_NO_PERMIT_CONSUMPTION",
  run_id:RUN,subject_sha:state.permitProof.subject_sha,
  postgres:"READONLY_AUTHENTICATED",storage:storage.status,
  six_stages:scheduler.STAGES,stage_count:0,
  permit_consumed:false,execute_authorized:false,production_authorized:false});
}
function writeOnce(file,value){
 const fd=fs.openSync(file,"wx",0o600);
 try{fs.writeFileSync(fd,Buffer.from(JSON.stringify(value,null,2)+"\n"));fs.fsyncSync(fd);}
 finally{fs.closeSync(fd);}
}
async function execute(input,env=process.env){
 checkInput(input,true);
 // All early checks are read only; they cannot be bypassed by --execute.
 await dynamicPreflight(input,env);
 const ctoBytes=fileBytes(input.cto_decision_file);
 const {state}=await dynamicPreflight(input,env); // short-window second readback
 const execEnv=json(input.execution_approval_file);
 const authorized=approval.verify(execEnv,state.trust,{
  subject_sha:state.permitProof.subject_sha,host_id:lineage.HOST,
  nonce:state.permitProof.nonce,
  permit_envelope_sha256:state.permitProof.envelope_sha256,
  adoption_envelope_sha256:state.permitProof.adoption_envelope_sha256,
  cto_decision_sha256:sha(ctoBytes)});
 const check=cp.spawnSync(env.MCFT_PYTHON_EXECUTABLE||"python",[
  path.join(input.release_root,"apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_scientific_core_v1.py"),"selftest"
 ],{cwd:input.release_root,timeout:60000,encoding:"utf8",maxBuffer:1024*1024});
 assert.equal(check.status,0,"R4285_SCIENCE_SELFTEST_FAILED");
 lineage.verifyExactMain(input.source_root,state.permitProof.subject_sha);
 assert(atomic.isPrepared(state.prepared),"R4285_HOST_PREPARE_EXPIRED");
 // Atomic burn is irreversible. Any later stage failure must stop, no retry.
 const consumed=atomic.consumeForQualifiedHost(state.prepared,authorized);
 const authority=stages.initializeStageAuthority(consumed,state.permitEnv.payload,
  state.permitProof.envelope_sha256);
 fs.mkdirSync(input.output_root,{mode:0o700});
 writeOnce(path.join(input.output_root,"SIGNED_OBSERVED_R4285.json"),state.observed);
 writeOnce(path.join(input.output_root,"STARTED_R4285.json"),{
  schema_version:"MCFT_CAP09_R4285_RUN_STARTED_V1",run_id:RUN,
  subject_sha:state.permitProof.subject_sha,started_at:new Date().toISOString(),
  stage_count:0,permit_consumed:true,production_authorized:false});
 const steps=state.steps.map(step=>Object.freeze({...step,env:{
  ...step.env,MCFT_R4285_PERMIT_ENVELOPE_SHA256:state.permitProof.envelope_sha256
 }}));
 const result=await scheduler.executeSixStages({authority,plan:state.plan,steps,
  dispatch:async(a,step)=>dispatch.dispatchConsumedStageR4285(a,freshStageLaunch(step)),
  assertConsumed:atomic.assertConsumed});
 return Object.freeze({status:"R4285_SIX_PHYSICAL_STAGES_SEALED_TEST_ONLY",
  run_id:RUN,stage_count:result.stage_count,final_receipt_sha256:result.final_receipt_sha256,
  permit_consumed:true,production_authorized:false});
}
function parse(argv){
 assert(argv.length===3&&["--preflight-only","--execute"].includes(argv[0])&&
  argv[1]==="--input"&&path.isAbsolute(argv[2]),"R4285_HOST_EXPLICIT_MODE_AND_ABSOLUTE_INPUT");
 return {mode:argv[0],input:argv[2]};
}
async function run(argv=process.argv.slice(2)){
 const {mode,input}=parse(argv);
 const source=json(input);
 return mode==="--execute"?execute(source):preflight(source);
}
if(require.main===module)run().then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{
 console.error(JSON.stringify({status:"HOLD_R4285_HOST",reason_code:String(e.message||e).slice(0,230),
  run_id:RUN,production_authorized:false,auto_retry:false}));
 process.exitCode=1;
});
module.exports={RUN,INPUTS,EXEC_INPUTS,checkInput,hostOnly,checkResourceEnv,resolveStages,
 buildAdmission,probeS3ReadOnly,preflight,execute,parse,run};
