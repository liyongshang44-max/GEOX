"use strict";
// Isolated cryptographic signer/Host contract integration test; deliberately
// ticketed child mode. NOT full parent admission, not evidence for Windows execute.
const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const ROOT=path.resolve(__dirname,"../..");
const v3=require("./MCFT_CAP09_DA9_PREPERMIT_SOURCE_USE_BUDGET_V3.cjs");
const sourceTime=require("./MCFT_CAP09_DA9_SOURCE_TIME_CONTRACT_V3.cjs");
const permitApi=require("../runtime_acceptance/MCFT_CAP09_RETRY_PERMIT_V1.cjs");
const host=require("../runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs");
const sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");
const temp=fs.mkdtempSync(path.join(os.tmpdir(),"mcft-cap09-v3-crypto-host-"));
const subject="5526d93f5822c2f333ba997009e9d6605b8959e2";
const run="da9db7129607",first="2026-10-23T07:00:00.000Z";
const now="2026-10-22T18:00:00.000Z",issued="2026-10-22T17:59:00.000Z",expires="2026-10-23T08:00:00.000Z";
const plan={schema_version:"geox_mcft_cap09_retry_stage_plan_v2",
 stages:v3.STAGES.map((id,i)=>({id,timeout_ms:[3600000,1800000,1800000,1800000,1200000,600000][i]}))};
const key=crypto.generateKeyPairSync("ed25519");
const publicDer=key.publicKey.export({type:"spki",format:"der"});
const trust={schema_version:"geox_mcft_cap09_retry_trust_v1",adopted:true,execution_enabled:true,
 operator_id:"test_da9_operator",host_id:"TEST_DA9_HOST",
 issuers:[{issuer_id:"test_da9_operator",key_id:"test_key",role:"ACCOUNTABLE_SINGLE_OPERATOR",revoked:false,
   not_before:"2026-10-22T00:00:00.000Z",not_after:"2026-10-24T00:00:00.000Z",
   public_key_pem:key.publicKey.export({type:"spki",format:"pem"}),spki_sha256:sha(publicDer)}],
 ledger_root:path.join(temp,"ledger")};
const reviewDecision={review_contract_version:2,run_id:run,protected_main_sha:subject,
 review_status:"APPROVED",test_only_fixture:true,production_authorized:false};
const decisionFile=path.join(temp,"synthetic-review.json");
fs.writeFileSync(decisionFile,JSON.stringify(reviewDecision)+"\n");
const budget={
 schema_version:v3.CONTRACT,classification:v3.CLASSIFICATION,scope:"TEST_ONLY",
 run_id:run,subject_sha:subject,first_base:first,stage_timeout_sum_ms:10800000,
 safety_margin_ms:900000,source_use_mode:"LIVE_AT_EACH_REAL_CAPTURE_NO_PROVIDER_SLA",
 source_code_sha256:v3.pinnedSourceCode(ROOT),sources:[],review_authority_ref:"TEST_ONLY_SYNTHETIC_REVIEW_NOT_REAL_SIGNER"
};
const observed={
 pre_permit_safety_budget:budget,deadline_safety_margin_ms:900000,
 real_provider_response_delay_plan:{schema_version:"geox_mcft_cap09_real_provider_response_delay_v1",
  run_id:run,subject_sha:subject,first_base:first,response_delay_ms:30,expected_distinct_bases:3,
  mode:"REAL_HTTPS_RESPONSE_BEFORE_CANONICAL_DECODER"},
 real_pipeline_delay_plan:{schema_version:"geox_mcft_cap09_real_pipeline_delay_v1",
  run_id:run,subject_sha:subject,first_base:first,expected_distinct_bases:3,
  promotion_queue_delay_ms:30,post_commit_readback_delay_ms:30,
  mode:"REAL_ISOLATED_PROMOTION_AND_PHYSICAL_READBACK"},
};
const arm={run_id:run,protected_main_sha:subject,qualification_first_base:first,
 authorized_at:issued,expires_at:expires,armed:true,execute_authorized:true,retry_authorized:true,
 evidence_sha256:{retry_adjudication:sha(fs.readFileSync(decisionFile))},
 retry_adjudication:reviewDecision};
const fileSet={retry_adjudication:decisionFile};
const context={head:subject,main:subject,clean:true,host_id:"TEST_DA9_HOST",now};
function sign(a=arm,o=observed,p=plan,expiresAt=expires){
 const payload={
  schema_version:"geox_mcft_cap09_signed_retry_permit_v1",
  issuer_id:"test_da9_operator",key_id:"test_key",nonce:"f".repeat(64),
  run_id:run,parent_run_id:"72dc0304a21a",attempt_ordinal:2,
  subject_sha:subject,host_id:"TEST_DA9_HOST",issued_at:issued,expires_at:expiresAt,
  arm_sha256:permitApi.sha(permitApi.canonical(a)),
  observations_sha256:permitApi.sha(permitApi.canonical(o)),
  plan_sha256:permitApi.sha(permitApi.canonical(p)),
  scope:"ISOLATED_QUALIFICATION_SINGLE_ATTEMPT"};
 return {payload,signature_base64:crypto.sign(null,Buffer.from(permitApi.DOMAIN+permitApi.canonical(payload)),key.privateKey).toString("base64")};
}
function bundle(a=arm,o=observed,p=plan,permit=sign(a,o,p)){return {arm:a,observed:o,plan:p,files:fileSet,permit};}
let checks=0;
const pass=fn=>{fn();checks++};
const rejects=(fn,re)=>{assert.throws(fn,re);checks++};
try{
 pass(()=>assert.equal(v3.pinnedSourceCode(ROOT)["apps/server/src/external_evidence/provider/kbs_variate25_soil_provider_v1.ts"].length,64));
 pass(()=>assert.equal(sourceTime.gfsCycleCoverage("2026-10-22T23:00:00.000Z","2026-10-22T12:00:00.000Z").required_distinct_lead_count,75));
 pass(()=>assert.equal(host.validateBundle(bundle(),trust,context,{ticketedStage:true}).verified.payload.subject_sha,subject));
 rejects(()=>host.validateBundle(bundle(),trust,context,{ticketedStage:false}),/RETRY_INPUT_REQUIRED|FRESH_RESOURCE_READBACK_REQUIRED|QCP_NOT_CLOSED|undefined/);
 const tamperedObs={...observed,source_code_mutated:true};
 rejects(()=>host.validateBundle(bundle(arm,tamperedObs,plan,sign(arm,observed,plan)),trust,context,{ticketedStage:true}),/PERMIT_DIGEST_MISMATCH/);
 const drift={...observed,pre_permit_safety_budget:{...budget,source_code_sha256:{...budget.source_code_sha256,
  "apps/server/src/external_evidence/provider/kbs_variate25_soil_provider_v1.ts":"0".repeat(64)}}};
 rejects(()=>host.validateBundle(bundle(arm,drift,plan,sign(arm,drift,plan)),trust,context,{ticketedStage:true}),/V3_HOST_SCIENTIFIC_SOURCE_CHANGED/);
 const wrongMode={...observed,pre_permit_safety_budget:{...budget,source_use_mode:"UNVERIFIED_SOURCE"}};
 rejects(()=>host.validateBundle(bundle(arm,wrongMode,plan,sign(arm,wrongMode,plan)),trust,context,{ticketedStage:true}),/V3_HOST_LIVE_SOURCE_USE_REQUIRED/);
 const badTime={...context,now:"2026-10-24T01:00:00.000Z"};
 rejects(()=>host.validateBundle(bundle(),trust,badTime,{ticketedStage:true}),/PERMIT_EXPIRED_OR_FUTURE/);
 const modifiedPlan={...plan,stages:plan.stages.map((row,i)=>i?row:{...row,timeout_ms:3600000-1000})};
 rejects(()=>host.validateBundle(bundle(arm,observed,modifiedPlan,sign(arm,observed,plan)),trust,context,{ticketedStage:true}),/PERMIT_DIGEST_MISMATCH/);
 const fake={...bundle(),permit:{...sign(),signature_base64:Buffer.alloc(64).toString("base64")}};
 rejects(()=>host.validateBundle(fake,trust,context,{ticketedStage:true}),/PERMIT_BAD_SIGNATURE/);
 console.log(JSON.stringify({status:"PASS",checks,
   tested:"ED25519_PERMIT_SIGNATURE_AND_SIGNED_V3_SOURCE_CODE_HOST_CHILD_CONTRACT",
   not_tested:"FULL_PARENT_SAFETY_BUDGET_HISTORICAL_ORIGINALS_AND_REAL_STAGE_EXECUTION",
   provider_calls:0,sql_writes:0,minio_writes:0,permit_consumed:false,
   execute_authorized:false,production_authorized:false}));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
