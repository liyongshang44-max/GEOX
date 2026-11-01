"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const v=require("./MCFT_CAP09_R4285_ADMISSION_V2.cjs");
const canonical=require("../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs").canonical;
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const now=Date.now();
const ctx={run_id:v.RUN,host_id:v.HOST,subject_sha:"a".repeat(40),nonce:"e".repeat(64),
 plan_sha256:"1".repeat(64),observations_sha256:"2".repeat(64),material_digest:"3".repeat(64),
 release_binding_sha256:"4".repeat(64),resource_scope_sha256:"5".repeat(64),
 authority_pr_number:3756,first_base:"2026-12-01T00:00:00.000Z"};
function intent(){return {schema_version:"MCFT_CAP09_R4285_CTO_PREAUTH_INTENT_V2",
 run_id:v.RUN,parent_run_id:"72dc0304a21a",failed_predecessor_run_id:"6ff9b41f6f7f",
 attempt_ordinal:4,authority_pr_number:3756,subject_sha:ctx.subject_sha,host_id:ctx.host_id,
 nonce:ctx.nonce,plan_sha256:ctx.plan_sha256,observations_sha256:ctx.observations_sha256,
 first_base:ctx.first_base,material_digest:ctx.material_digest,
 release_binding_sha256:ctx.release_binding_sha256,resource_scope_sha256:ctx.resource_scope_sha256,
 valid_from:new Date(now-2000).toISOString(),expires_at:new Date(now+3600000).toISOString(),
 scope:"ISOLATED_QUALIFICATION_TEST_ONLY",decision:"APPROVE_V2_TEST_INTENT_NOT_PERMIT_OR_EXECUTION",
 production_authorized:false,permit_authorized:false,execute_authorized:false};}
test("intent exact Run/Subject/Nonce/Plan/Observations/Resource binding",()=>{
 const p=intent();assert(v.checkIntent(p,ctx,{now}));
 for(const k of ["run_id","subject_sha","host_id","nonce","plan_sha256","observations_sha256",
 "first_base","material_digest","release_binding_sha256","resource_scope_sha256"]){
  assert.throws(()=>v.checkIntent({...p,[k]:"WRONG"},ctx,{now}));
 }
 assert.throws(()=>v.checkIntent({...p,extra:1},ctx,{now}));
});
test("intent cannot preauthorize Permit or Execute and expiration fails",()=>{
 for(const change of [{execute_authorized:true},{permit_authorized:true},{production_authorized:true},
 {expires_at:new Date(now-1000).toISOString()},{decision:"APPROVE_EXECUTE"}])
 assert.throws(()=>v.checkIntent({...intent(),...change},ctx,{now}));
});
test("synthetic GitHub comment inspection never yields native capability",()=>{
 const body=canonical(intent()),raw=Buffer.from(body);
 const c={id:17,url:"https://api.github.com/repos/liyongshang44-max/GEOX/issues/comments/17",
 issue_url:"https://api.github.com/repos/liyongshang44-max/GEOX/issues/3756",
 user:{login:"liyongshang44-max"},author_association:"OWNER",
 created_at:new Date(now-4000).toISOString(),updated_at:new Date(now-4000).toISOString(),body};
 const p=v.inspectNativeComment(c,raw,ctx,{now});
 assert.equal(p.status,"V2_INSPECTED_ONLY_NOT_LIVE");
 assert.throws(()=>v.requireLiveIntent(p,ctx,{now}),/NATIVE_CTO_PROVENANCE_REQUIRED/);
 for(const delta of [{updated_at:new Date(now-3000).toISOString()},
  {user:{login:"OTHER"}},{issue_url:"https://api.github.com/repos/liyongshang44-max/GEOX/issues/99"}])
  assert.throws(()=>v.inspectNativeComment({...c,...delta},raw,ctx,{now}));
});
test("fake Native adoption, Permit and final capability cannot authorize",()=>{
 assert.throws(()=>v.stableNative({adoption:{status:"PASS"},nativeInput:{},intent:{},ctx,now}),
  /REAL_NATIVE_ADOPTION_REQUIRED/);
 assert.throws(()=>v.requireStable({}, {},ctx,{now}),/STABLE_NOT_VERIFIED/);
 assert.throws(()=>v.checkActualPermit({status:"PASS"},{},{},{},{},ctx,{now}),/REAL_PERMIT_REQUIRED/);
 assert.throws(()=>v.assertFinal({status:"V2_SIGNATURE_VALID_NOT_EXECUTION"},{},{now}),/FINAL_NOT_LIVE_VERIFIED/);
});
test("exact final Ed25519 signature alone cannot authorize physical consumption",()=>{
 const pair=crypto.generateKeyPairSync("ed25519");
 const issuer={issuer_id:"UNIT",key_id:"UNIT",role:"ACCOUNTABLE_SINGLE_OPERATOR",revoked:false,
 not_before:new Date(now-60000).toISOString(),not_after:new Date(now+3600000).toISOString(),
 public_key_pem:pair.publicKey.export({format:"pem",type:"spki"}),
 spki_sha256:sha(pair.publicKey.export({format:"der",type:"spki"}))};
 const trust={schema_version:"geox_mcft_cap09_retry_trust_v1",host_id:v.HOST,
  operator_id:"UNIT",issuers:[issuer]};
 const extra={permit_envelope_sha256:"6".repeat(64),resource_owner_envelope_sha256:"7".repeat(64),
 resource_readback_sha256:"8".repeat(64),intent_sha256:"9".repeat(64)};
 const p={schema_version:"MCFT_CAP09_R4285_FINAL_EXECUTION_APPROVAL_V2",
  issuer_id:"UNIT",key_id:"UNIT",run_id:v.RUN,subject_sha:ctx.subject_sha,host_id:v.HOST,
  nonce:ctx.nonce,...extra,plan_sha256:ctx.plan_sha256,
  observations_sha256:ctx.observations_sha256,material_digest:ctx.material_digest,
  release_binding_sha256:ctx.release_binding_sha256,issued_at:new Date(now-1000).toISOString(),
  expires_at:new Date(now+600000).toISOString(),scope:"ISOLATED_QUALIFICATION_TEST_ONLY",
  decision:"APPROVE_R4285_V2_FINAL_SINGLE_EXECUTION",production_authorized:false};
 const sign=(payload=p)=>({payload,signature_base64:crypto.sign(null,
  Buffer.from(v.DOMAIN+canonical(payload)),pair.privateKey).toString("base64")});
 const fctx={...ctx,...extra},proof=v.inspectFinal(sign(),trust,fctx,{now});
 assert.equal(proof.status,"V2_SIGNATURE_VALID_NOT_EXECUTION");
 assert.throws(()=>v.assertFinal(proof,{...fctx},{now}),/FINAL_NOT_LIVE_VERIFIED/);
 for(const k of Object.keys(extra))assert.throws(()=>v.inspectFinal(sign(),trust,{...fctx,[k]:"f".repeat(64)},{now}));
 const revoked=structuredClone(trust);revoked.issuers[0].revoked=true;
 assert.throws(()=>v.inspectFinal(sign(),revoked,fctx,{now}));
 const tampered=sign();tampered.signature_base64=Buffer.alloc(64).toString("base64");
 assert.throws(()=>v.inspectFinal(tampered,trust,fctx,{now}),/SIGNATURE_INVALID/);
});
test("module cannot sign, issue, consume or dispatch",()=>{
 assert(!Object.keys(v).some(x=>/^(sign|issue|consume|execute|dispatch)$/i.test(x)));
});
