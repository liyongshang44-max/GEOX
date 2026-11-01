"use strict";
/* Cryptographic fixture negatives only. No native GitHub authority is minted,
 * no resources are queried, no Permit is issued or consumed in the Host. */
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const v2=require("./MCFT_CAP09_R4285_ADMISSION_V2.cjs");
const permit=require("./MCFT_CAP09_R4285_PERMIT_V2.cjs");
const resource=require("../governance_acceptance/MCFT_CAP09_R4285_RESOURCE_OWNER_V1.cjs");
const canonical=require("../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs").canonical;
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
function makeFixture(){
 const now=Date.now(),issued_at=new Date(now-1000).toISOString();
 const ownerObserved=new Date(now-5000).toISOString(),ownerExpiry=new Date(now+5*3600000).toISOString();
 const adoptionExpiry=new Date(now+5*3600000).toISOString(),permitExpiry=new Date(now+4*3600000).toISOString();
 const first_base="2026-12-01T00:00:00.000Z";
 const observed={real_provider_response_delay_plan:{
  schema_version:"geox_mcft_cap09_real_provider_response_delay_v1",
  run_id:permit.RUN,subject_sha:"a".repeat(40),first_base,
  response_delay_ms:1000,expected_distinct_bases:3,
  mode:"REAL_HTTPS_RESPONSE_BEFORE_CANONICAL_DECODER"},
 real_pipeline_delay_plan:{
  schema_version:"geox_mcft_cap09_real_pipeline_delay_v1",
  mode:"REAL_ISOLATED_PROMOTION_AND_PHYSICAL_READBACK",run_id:permit.RUN,
  subject_sha:"a".repeat(40),first_base,expected_distinct_bases:3,
  promotion_queue_delay_ms:1000,post_commit_readback_delay_ms:1000}};
 const facts=Object.fromEntries(resource.FACT_BINDINGS.map(k=>[k,true]));
 Object.assign(facts,{
  run_id:permit.RUN,subject_sha:"a".repeat(40),host_id:permit.HOST,observed_at:ownerObserved,
  database_host:"127.0.0.1",database_port:55492,
  positive_database:"mcft_cap09_requal_"+permit.RUN+"_positive",
  negative_database:"mcft_cap09_requal_"+permit.RUN+"_negative",
  audit_user:"r4285_fixture_audit",
  bucket_endpoint:"http://127.0.0.1:59292/",bucket:"mcft-cap09-requal-"+permit.RUN,
  owner_exclusive:true,production_bindings_present:false,
  pg_owner_id:"fixture-pg-owner",s3_owner_id:"fixture-s3-owner"});
 const readback={sha256:"8".repeat(64),status:"RAW_READBACK_BYTES_MATCH_NOT_AUTHORITY",
  facts:{...facts,production_authorized:false}};
 const ownerEnvelope={payload:{...facts,run_id:permit.RUN,
  readback_sha256:readback.sha256,issued_at,expires_at:ownerExpiry},signature_base64:"EXAMPLE_ONLY"};
 const keys=crypto.generateKeyPairSync("ed25519");
 const issuer={issuer_id:"FIXTURE_OPERATOR",key_id:"FIXTURE_KEY",
  role:"ACCOUNTABLE_SINGLE_OPERATOR",revoked:false,
  not_before:new Date(now-60000).toISOString(),
  not_after:new Date(now+6*3600000).toISOString(),
  public_key_pem:keys.publicKey.export({format:"pem",type:"spki"}),
  spki_sha256:sha(keys.publicKey.export({format:"der",type:"spki"}))};
 const trust={schema_version:"geox_mcft_cap09_retry_trust_v1",
  host_id:permit.HOST,operator_id:issuer.issuer_id,issuers:[issuer]};
 const plan={schema_version:"geox_mcft_cap09_retry_stage_plan_v2",
  stages:require("./MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs").STAGES.map((id,i)=>({
    id,timeout_ms:[3600000,1800000,1800000,1800000,1200000,600000][i]}))};
 const ctx={run_id:permit.RUN,host_id:permit.HOST,subject_sha:"a".repeat(40),nonce:"7".repeat(64),
  first_base,authority_pr_number:3757,
  plan,plan_sha256:sha(Buffer.from(canonical(plan))),observations_sha256:sha(Buffer.from(canonical(observed))),
  material_digest:"3".repeat(64),release_binding_sha256:"4".repeat(64),
  resource_scope_sha256:v2.scopeDigest(readback.facts),
  total_stage_budget_ms:10800000,adoption_expires_at:adoptionExpiry};
 const pctx={subject_sha:ctx.subject_sha,protected_main_sha:ctx.subject_sha,source_clean:true,
  host_id:ctx.host_id,adoption_expires_at:adoptionExpiry,
  resource_owner_expires_at:ownerExpiry,total_stage_budget_ms:ctx.total_stage_budget_ms};
 permit.BINDINGS.forEach((k,i)=>pctx[k]=(i+1).toString(16).padStart(64,"0"));
 Object.assign(pctx,{plan_sha256:ctx.plan_sha256,observations_sha256:ctx.observations_sha256,
  installed_material_digest:ctx.material_digest,release_binding_sha256:ctx.release_binding_sha256,
  resource_owner_envelope_sha256:sha(Buffer.from(canonical(ownerEnvelope))),
  resource_readback_sha256:readback.sha256});
 const payload={schema_version:"MCFT_CAP09_R4285_SIGNED_ISOLATED_TEST_PERMIT_V2",
  issuer_id:issuer.issuer_id,key_id:issuer.key_id,run_id:permit.RUN,nonce:ctx.nonce,
  parent_run_id:permit.PARENT,failed_predecessor_run_id:permit.FAILED_PREDECESSOR,
  attempt_ordinal:4,subject_sha:ctx.subject_sha,host_id:ctx.host_id,
  scope:"ISOLATED_QUALIFICATION_TEST_ONLY",purpose:"ORIGINAL_SIX_STAGE_SINGLE_ATTEMPT",
  decision:"APPROVE_R4285_TEST_ONLY_PERMIT_NOT_PRODUCTION",
  issued_at,expires_at:permitExpiry,production_authorized:false};
 for(const k of permit.BINDINGS)payload[k]=pctx[k];
 const permitEnv={payload,signature_base64:crypto.sign(null,
  Buffer.from(permit.DOMAIN+canonical(payload)),keys.privateKey).toString("base64")};
 const proof=permit.verifyReadOnly(permitEnv,trust,pctx,{now});
 return {now,ctx,observed,readback,ownerEnvelope,permitEnv,proof};
}
test("V2 bound timing accepts a cryptographically consistent V1-only fixture",()=>{
 const a=makeFixture();
 assert(v2.checkActualPermit(a.proof,a.permitEnv,a.ownerEnvelope,a.readback,a.observed,
  a.ctx,{now:a.now}));
});
test("V2 rejects readback replacement, Owner signature change and Observations drift",()=>{
 const a=makeFixture();
 assert.throws(()=>v2.checkActualPermit(a.proof,a.permitEnv,a.ownerEnvelope,
  {...a.readback,sha256:"f".repeat(64)},a.observed,a.ctx,{now:a.now}),/READBACK_SHA_DRIFT/);
 assert.throws(()=>v2.checkActualPermit(a.proof,a.permitEnv,
  {...a.ownerEnvelope,signature_base64:"CHANGED"},a.readback,a.observed,a.ctx,{now:a.now}),
  /OWNER_ENVELOPE_DRIFT/);
 assert.throws(()=>v2.checkActualPermit(a.proof,a.permitEnv,a.ownerEnvelope,
  a.readback,{...a.observed,other:true},a.ctx,{now:a.now}),/OBS_BYTES_DRIFT/);
});
test("V2 rejects expired 120s observations and stale remaining Permit budget",()=>{
 const a=makeFixture();
 assert.throws(()=>v2.checkActualPermit(a.proof,a.permitEnv,a.ownerEnvelope,
  a.readback,a.observed,a.ctx,{now:a.now+121000}),/DYNAMIC_READBACK_EXPIRED/);
 assert.throws(()=>v2.checkActualPermit(a.proof,a.permitEnv,a.ownerEnvelope,
  a.readback,a.observed,a.ctx,{now:a.now+4200000}),/V2_PERMIT_REMAINING_STAGE_BUDGET/);
});
test("V2 rejects Permit outliving Adoption and mismatched Material",()=>{
 const a=makeFixture();
 assert.throws(()=>v2.checkActualPermit(a.proof,a.permitEnv,a.ownerEnvelope,
  a.readback,a.observed,{...a.ctx,adoption_expires_at:new Date(a.now+1000000).toISOString()},
  {now:a.now}),/V2_PERMIT_OUTLIVES_ADOPTION/);
 assert.throws(()=>v2.checkActualPermit(a.proof,a.permitEnv,a.ownerEnvelope,
  a.readback,a.observed,{...a.ctx,material_digest:"f".repeat(64)},
  {now:a.now}),/V2_MATERIAL_DRIFT/);
});

test("CTO: caller cannot shrink remaining budget while signed Plan remains 180 min",()=>{
 const a=makeFixture();
 assert.throws(()=>v2.checkActualPermit(a.proof,a.permitEnv,a.ownerEnvelope,
  a.readback,a.observed,{...a.ctx,total_stage_budget_ms:1000},{now:a.now}),
  /V2_CALLER_STAGE_BUDGET_NOT_FROM_PLAN/);
});
test("CTO: signed Plan and six-stage timeout drift must fail closed",()=>{
 const a=makeFixture(),old=a.ctx.plan;
 const changed={...old,stages:old.stages.map((x,i)=>i===1?{...x,timeout_ms:1000}:x)};
 assert.throws(()=>v2.checkActualPermit(a.proof,a.permitEnv,a.ownerEnvelope,
  a.readback,a.observed,{...a.ctx,plan:changed,total_stage_budget_ms:9001000},{now:a.now}),
  /V2_PLAN_APPROVED_STAGE_TIMEOUTS_CHANGED/);
 assert.throws(()=>v2.checkActualPermit(a.proof,a.permitEnv,a.ownerEnvelope,
  a.readback,a.observed,{...a.ctx,plan_sha256:"f".repeat(64)},{now:a.now}),
  /V2_PLAN_DRIFT/);
});
test("CTO: preapproved observation delay change must fail closed",()=>{
 const a=makeFixture(),bad={...a.observed,
  real_pipeline_delay_plan:{...a.observed.real_pipeline_delay_plan,promotion_queue_delay_ms:5}};
 assert.throws(()=>v2.frozenBudget(a.ctx.plan,bad,{
  ...a.ctx,observations_sha256:sha(Buffer.from(canonical(bad)))
 }),/V2_APPROVED_PROMOTION_DELAY_CHANGED/);
});
