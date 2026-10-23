"use strict";
// Isolated TEST-ONLY structural parent contract exercise. The in-memory loader
// maps two unavailable operator-host historical hashes onto synthetic JSON.
// It NEVER represents Windows official Host Preflight or adopted authority.
const assert=require("node:assert/strict"),crypto=require("node:crypto");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),Module=require("node:module");
const ROOT=path.resolve(__dirname,"../.."),tmp=fs.mkdtempSync(path.join(os.tmpdir(),"da9-v3-parent-fixture-"));
const history=require("./MCFT_CAP09_RETRY_HISTORICAL_EVIDENCE_V1.cjs");
const anchors=require("./MCFT_CAP_09_ISOLATED_RETRY_AUTHORITY_POLICY_V1.cjs").ANCHORS;
const permit=require("../runtime_acceptance/MCFT_CAP09_RETRY_PERMIT_V1.cjs");
const originalLoad=Module._load,syntheticHistoricalHashes=new Map();
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const json=(file,value)=>{fs.writeFileSync(file,JSON.stringify(value)+"\n");return file;};
const now="2026-10-23T12:00:00.000Z",first="2026-10-23T18:00:00.000Z";
const issued="2026-10-23T11:59:00.000Z",expires="2026-10-23T18:10:00.000Z";
const adoptionExpiry="2026-10-23T18:20:00.000Z";
const run="da9db7129607",subject="5526d93f5822c2f333ba997009e9d6605b8959e2";
const reviewer="fixture_operator",key=crypto.generateKeyPairSync("ed25519");
const stageCaps=[3600000,1800000,1800000,1800000,1200000,600000];
const plan={schema_version:"geox_mcft_cap09_retry_stage_plan_v2",
 stages:["PRODUCER","TIMING_1","TIMING_2","TIMING_3","CONTROLLED_DELAY","AGGREGATE"]
 .map((id,i)=>({id,timeout_ms:stageCaps[i]}))};
const gfsFile=json(path.join(tmp,"synthetic-gfs.json"),{status:"PASS",provider_request_count:220,raw_provider_object_count:220});
const kbsFile=json(path.join(tmp,"synthetic-kbs.json"),{status:"DYNAMIC_ADMISSION_HOLD",source:"TEST_FIXTURE_ONLY"});
const reviewFile=json(path.join(tmp,"synthetic-cap-review.json"),{
 schema_version:"geox_mcft_cap09_engineering_stage_cap_review_v1",run_id:run,subject_sha:subject,
 first_base:first,reviewed_stage_timeout_ms:stageCaps,reviewed_safety_margin_ms:900000,
 reviewer_id:reviewer,review_basis:"TEST FIXTURE ONLY: This is a deliberately synthetic engineering upper-cap rationale, not a real operator's review, signature, or authority. The parent verifier must check exact run and subject identity, six ordered upper ceilings, positive safety margin, the future first base, Adoption and Permit lifetimes, and byte-level evidence integrity. No Provider reliability promise or actual stage execution is represented by this fixture."
});
const sourcePaths=[gfsFile,kbsFile,reviewFile],sourceTypes=[
 "HISTORIC_REAL_GFS_ACQUISITION","HISTORIC_REAL_KBS_CONTINUITY","OPERATOR_REVIEWED_STAGE_CAPS"];
const sources=sourcePaths.map((file,i)=>({kind:sourceTypes[i],path:file,sha256:sha(fs.readFileSync(file))}));
// Production evaluator's two hard-coded, real-host provenance hashes are kept
// unchanged in the repository. Only this test-process copy is rebound.
const v3Path=require.resolve("./MCFT_CAP09_DA9_PREPERMIT_SOURCE_USE_BUDGET_V3.cjs");
const v3Real=require(v3Path);
let testSource=fs.readFileSync(v3Path,"utf8");
for(const [kind,i] of [["HISTORIC_REAL_GFS_ACQUISITION",0],["HISTORIC_REAL_KBS_CONTINUITY",1]]){
 const expected=v3Real?({"HISTORIC_REAL_GFS_ACQUISITION":"8a89e19dc06023dcc8342b68541c67c7758d0e1ef836d63d68f285a3b29d192a",
 "HISTORIC_REAL_KBS_CONTINUITY":"d813093f0321bd56d7e0a43c1dfa66964c4f4dfe8373d665a3139123d49dd86e"}[kind]):null;
 assert.equal(testSource.split(expected).length,2,"TEST_SYNTHETIC_ANCHOR_REPLACEMENT_NOT_EXACT");
 testSource=testSource.replace(expected,sources[i].sha256);
}
const isolated=new Module(v3Path,module);isolated.filename=v3Path;
isolated.paths=Module._nodeModulePaths(path.dirname(v3Path));
isolated._compile(testSource,v3Path);
const testV3=isolated.exports;
assert.equal(testV3.evaluate.toString(),v3Real.evaluate.toString(),"TEST_EVALUATOR_CHANGED");
const stagePath=require.resolve("../runtime_acceptance/MCFT_CAP09_STAGE_RECEIPTS_V1.cjs");
const realStage=require(stagePath);
Module._load=function(name,parent,isMain){
 if(parent?.filename?.endsWith("MCFT_CAP09_ISOLATED_RETRY_ADMISSION_BRIDGE_V1.cjs")&&name==="./MCFT_CAP09_DA9_PREPERMIT_SOURCE_USE_BUDGET_V3.cjs")return testV3;
 if(parent?.filename?.endsWith("MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs")){
  if(name==="../governance_acceptance/MCFT_CAP09_DA9_PREPERMIT_SOURCE_USE_BUDGET_V3.cjs")return testV3;
  if(name==="./MCFT_CAP09_STAGE_RECEIPTS_V1.cjs")return {...realStage,hashFile:file=>syntheticHistoricalHashes.get(file)??realStage.hashFile(file)};
 }
 return originalLoad.apply(this,arguments);
};
let checks=0;
const test=(name,fn)=>{fn();checks++;console.log("PASS "+name);};
const reject=(name,fn,re)=>test(name,()=>assert.throws(fn,re));
try{
 const host=require("../runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs");
 const evidence={...anchors,...history.HASHES},files={};
 for(const [key,digest] of Object.entries(evidence)){
  if(Object.hasOwn(history.FILES,key))files[key]=path.join(history.DIRECTORY,history.FILES[key]);
  else{files[key]=json(path.join(tmp,"synthetic-"+key+".json"),{fixture_key:key});syntheticHistoricalHashes.set(files[key],digest);}
 }
 const decision={
  review_contract_version:2,run_id:run,protected_main_sha:subject,decision_id:"SYNTHETIC_PARENT_REVIEW",
  retry_admissible:true,prior_denial_explicitly_superseded:true,
  unknown_provider_count_acknowledged:true,reviewer_id:reviewer
 };
 files.retry_adjudication=json(path.join(tmp,"synthetic-decision.json"),decision);
 evidence.retry_adjudication=sha(fs.readFileSync(files.retry_adjudication));
 const resources={database_host:"127.0.0.1",database_port:55445,audit_user:"qual_admin",
 positive_database:"mcft_cap09_requal_"+run+"_positive",negative_database:"mcft_cap09_requal_"+run+"_negative",
 bucket_endpoint:"http://127.0.0.1:59005",bucket:"mcft-cap09-requal-"+run};
 const out=path.join(tmp,"unused-output");
 const arm={schema_version:"geox_mcft_cap09_isolated_retry_arm_v1",mode:"ISOLATED_QUALIFICATION",
  run_id:run,parent_run_id:"72dc0304a21a",attempt_ordinal:2,protected_main_sha:subject,
  armed:true,execute_authorized:true,retry_authorized:true,authorized_at:issued,expires_at:expires,
  qualification_first_base:first,resources,output_directory:out,evidence_sha256:evidence,
  retry_adjudication:decision,first_execution_provider_calls:null,
  production_recovery_authorized:false,owner_cutover_authorized:false,formal_v5_authorized:false,
  a0_authorized:false,o00_o23_authorized:false,automatic_retry_authorized:false,
  historical_reset_authorized:false};
 const budget={schema_version:testV3.CONTRACT,classification:testV3.CLASSIFICATION,
  scope:"TEST_ONLY",run_id:run,subject_sha:subject,first_base:first,stage_timeout_sum_ms:10800000,
  safety_margin_ms:900000,source_use_mode:"LIVE_AT_EACH_REAL_CAPTURE_NO_PROVIDER_SLA",
  source_code_sha256:testV3.pinnedSourceCode(ROOT),sources,
  review_authority_ref:"SYNTHETIC_FIXTURE_NOT_OPERATOR_APPROVAL"};
 const observed={
  evidence_sha256:evidence,resources,output_directory:out,output_exists:false,
  output_seen_in_attempt_ledger:false,original_evidence_preserved:true,qcp_blocker_count:0,
  inherited_qcp_check_count:55,frozen_runtime_paths_verified:108,windows_postmerge_verified:true,
  fresh_readback:{status:"PASS",run_id:run,started_at:"2026-10-23T11:57:00.000Z",
   completed_at:"2026-10-23T11:58:00.000Z",all_rows_zero:true,
   bucket_empty_including_versions_multipart:true,production_bindings_present:false},
  fresh_readback_current:true,owner_isolation_verified:true,
  deadline_safety_margin_ms:900000,pre_permit_safety_budget:budget,
  real_provider_response_delay_plan:{schema_version:"geox_mcft_cap09_real_provider_response_delay_v1",
   run_id:run,subject_sha:subject,first_base:first,response_delay_ms:30,
   expected_distinct_bases:3,mode:"REAL_HTTPS_RESPONSE_BEFORE_CANONICAL_DECODER"},
  real_pipeline_delay_plan:{schema_version:"geox_mcft_cap09_real_pipeline_delay_v1",
   run_id:run,subject_sha:subject,first_base:first,expected_distinct_bases:3,
   promotion_queue_delay_ms:30,post_commit_readback_delay_ms:30,
   mode:"REAL_ISOLATED_PROMOTION_AND_PHYSICAL_READBACK"}
 };
 const trust={schema_version:"geox_mcft_cap09_retry_trust_v1",adopted:true,execution_enabled:true,
  operator_id:reviewer,host_id:"SYNTHETIC_HOST",
  issuers:[{issuer_id:reviewer,key_id:"fixture_key",role:"ACCOUNTABLE_SINGLE_OPERATOR",
   revoked:false,not_before:"2026-10-23T11:00:00.000Z",not_after:"2026-10-23T19:00:00.000Z",
   public_key_pem:key.publicKey.export({type:"spki",format:"pem"}),
   spki_sha256:sha(key.publicKey.export({type:"spki",format:"der"}))}],
  ledger_root:path.join(tmp,"fixture-ledger")};
 fs.mkdirSync(trust.ledger_root);
 const context={head:subject,main:subject,clean:true,now,host_id:"SYNTHETIC_HOST",
  qualification_expires_at:adoptionExpiry};
 const signature=(a,o,p)=>{
  const payload={schema_version:"geox_mcft_cap09_signed_retry_permit_v1",
   issuer_id:reviewer,key_id:"fixture_key",nonce:"f".repeat(64),run_id:run,
   parent_run_id:"72dc0304a21a",attempt_ordinal:2,subject_sha:subject,
   host_id:"SYNTHETIC_HOST",issued_at:issued,expires_at:expires,
   arm_sha256:permit.sha(permit.canonical(a)),
   observations_sha256:permit.sha(permit.canonical(o)),
   plan_sha256:permit.sha(permit.canonical(p)),
   scope:"ISOLATED_QUALIFICATION_SINGLE_ATTEMPT"};
  return {payload,signature_base64:crypto.sign(null,Buffer.from(permit.DOMAIN+permit.canonical(payload)),key.privateKey).toString("base64")};
 };
 const bundle=(a=arm,o=observed,p=plan,s=signature(a,o,p))=>({arm:a,observed:o,plan:p,files,permit:s});
 const validate=(b=bundle(),ctx=context,policy=trust)=>host.validateBundle(b,policy,ctx,{ticketedStage:false});
 const budgetContext={runId:run,subjectSha:subject,firstBase:first,nowUtc:now,
  permitExpiresAt:expires,adoptionExpiresAt:adoptionExpiry,safetyMarginMs:900000,authorizedReviewerId:reviewer};
 test("real_V3_evaluate_code_positive_using_synthetic_provenance",()=>{
  const result=testV3.evaluate({budget,stagePlan:plan,context:budgetContext,sourceRoot:ROOT});
  assert.match(result.status,/STRUCTURAL_PASS/);assert.equal(result.execute_authorized,false);
 });
 test("parent_structural_validateBundle_v3_positive_with_real_ed25519_fixture",()=>{
  const result=validate();
  assert.equal(result.verified.payload.subject_sha,subject);
  assert.equal(host.assertFreshParentReadback(observed.fresh_readback,Date.parse(now)),true);
  assert.equal(fs.readdirSync(trust.ledger_root).length,0,"PREFLIGHT_MUST_NOT_CONSUME_NONCE");
  assert(!fs.existsSync(out),"PREFLIGHT_MUST_NOT_CREATE_OUTPUT");
 });
 reject("forged_provider_deadline_forbidden",()=>{
  const obs={...observed,provider_deadline_utc:"2026-10-24T00:00:00.000Z"};
  validate(bundle(arm,obs));},/V3_SYNTHETIC_PROVIDER_DEADLINE_FORBIDDEN/);
 reject("reviewer_identity_mismatch",()=>{
  const ctx={...budgetContext,authorizedReviewerId:"not_registered"};
  testV3.evaluate({budget,stagePlan:plan,context:ctx,sourceRoot:ROOT});
 },/V3_REVIEW_NOT_REGISTERED_SIGNER/);
 reject("stale_adoption_boundary",()=>{
  const ctx={...context,qualification_expires_at:"2026-10-23T14:00:00.000Z"};validate(bundle(),ctx);
 },/V3_PERMIT_OUTLIVES_ADOPTION/);
 reject("late_preflight_budget_cannot_fit_first_base",()=>{
  validate(bundle(),{...context,now:"2026-10-23T15:00:00.000Z"});
 },/V3_HARD_DEADLINE_CAPACITY_INSUFFICIENT/);
 reject("tampered_observation_signature",()=>{
  const obs={...observed,owner_isolation_verified:false};
  validate(bundle(arm,obs,plan,signature(arm,observed,plan)));
 },/PERMIT_DIGEST_MISMATCH/);
 reject("wrong_host_identity",()=>validate(bundle(),{...context,host_id:"OTHER_HOST"}),/PERMIT_HOST_CONTEXT_MISMATCH/);
 reject("wrong_exact_subject",()=>validate(bundle(),{...context,main:"0".repeat(40)}),/PERMIT_MAIN_MOVED/);
 reject("revoked_issuer",()=>{
  validate(bundle(),context,{...trust,issuers:[{...trust.issuers[0],revoked:true}]});
 },/PERMIT_ISSUER_REVOKED/);
 reject("tampered_scientific_source_hash",()=>{
  const changed={...budget,source_code_sha256:{...budget.source_code_sha256,
   "apps/server/src/external_evidence/provider/kbs_variate25_soil_provider_v1.ts":"0".repeat(64)}};
  const obs={...observed,pre_permit_safety_budget:changed};validate(bundle(arm,obs));
 },/V3_HOST_SCIENTIFIC_SOURCE_CHANGED/);
 reject("tampered_historical_fixture_bytes",()=>{
  fs.appendFileSync(gfsFile,"TAMPER");
  try{testV3.evaluate({budget,stagePlan:plan,context:budgetContext,sourceRoot:ROOT});}
  finally{fs.writeFileSync(gfsFile,JSON.stringify({status:"PASS",provider_request_count:220,raw_provider_object_count:220})+"\n");}
 },/V3_SOURCE_BYTES_CHANGED/);
 reject("future_expired_permit",()=>validate(bundle(),{...context,now:"2026-10-23T19:00:00.000Z"}),/PERMIT_EXPIRED_OR_FUTURE/);
 reject("bad_signature",()=>{
  const b=bundle();b.permit.signature_base64=Buffer.alloc(64).toString("base64");validate(b);
 },/PERMIT_BAD_SIGNATURE/);
 test("synthetic_parent_still_has_zero_consumed_permits",()=>{
  assert.equal(fs.readdirSync(trust.ledger_root).length,0);
  assert.equal(fs.existsSync(out),false);
 });
 console.log(JSON.stringify({status:"PASS",checks,
  tested:"SYNTHETIC_PARENT_STRUCTURAL_V3_BUDGET_AND_CRYPTO_BOUNDARIES",
  official_windows_preflight:false,original_two_historical_files_used:false,
  synthetic_hash_override_process_local:true,signed_adoption_verified:false,
  provider_calls:0,sql_writes:0,minio_writes:0,permit_consumed:false,
  execution_authorized:false,production_authorized:false}));
}finally{Module._load=originalLoad;fs.rmSync(tmp,{recursive:true,force:true});}
