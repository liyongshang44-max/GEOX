#!/usr/bin/env node
"use strict";
// Historic source signature validation for NEW PRs, not a formal governance admission.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),cp=require("node:child_process");
const ROOT=path.resolve(__dirname,"../.."),C="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-CURRENT-PR-HISTORIC-SIGNATURE-BOUNDARY-V1.json";
const git=(...a)=>cp.execFileSync("git",a,{cwd:ROOT,encoding:"utf8",timeout:45000,maxBuffer:16*1024*1024}).trim();
const good=s=>/^[0-9a-f]{40}$/.test(s),read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),"utf8"));
const ancestor=(a,b)=>cp.spawnSync("git",["merge-base","--is-ancestor",a,b],{cwd:ROOT}).status===0;
function verifyCurrentSuccessor({base,head}){
 try{
  const conf=read(C);
  assert.equal(base,conf.base_sha,"ONLY_PINNED_CURRENT_PROTECTED_MAIN_BASE");
  assert(good(head)&&ancestor(base,head),"CURRENT_SUCCESSOR_WRONG_BASE_OR_HEAD");
  assert.equal(conf.current_pr_formal_governance_admission_signed,false);
  assert.equal(conf.old_event_may_be_replayed,false);
  assert.equal(conf.permit,false);
  const current=git("rev-parse","HEAD");assert.equal(current,head,"MUST_AUDIT_EXACT_CURRENT_HEAD");
  for(const p of [conf.original_historical_event_verifier,conf.original_signed_registry_path,conf.original_governance_review_path,
     "scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json"])
    assert.equal(git("rev-parse",head+":"+p),git("rev-parse",base+":"+p),"HISTORIC_SIGNED_OR_EVENT_SOURCE_MUTATED:"+p);
  assert.equal(git("rev-parse",head+":scripts/runtime_acceptance/MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.ts"),conf.current_composer_git_blob);
  assert.equal(git("rev-list","--parents","-n","1",conf.historical_two_parent_merge).split(/\s+/).length,3);
  assert(ancestor(conf.historical_two_parent_merge,base),"HISTORIC_TWO_PARENT_MERGE_NOT_ADOPTED");
  assert(ancestor(conf.historical_signed_source,conf.historical_two_parent_merge),"SIGNER_SOURCE_NOT_MERGE_PARENT");
  const sha=crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT,conf.original_signed_registry_path))).digest("hex");
  assert.equal("sha256:"+sha,conf.prior_signed_bundle_sha256,"SIGNED_BUNDLE_DIGEST_CHANGED");
  const reviews=read(conf.original_governance_review_path).evidence_entries;
  assert.equal(reviews.length,6,"SIX_HISTORIC_REVIEW_ENTRIES_REQUIRED");
  const verifier=require("./VERIFY_MCFT_CAP09_DA9_V2_QCP_SIGNED_SIX_EVIDENCE_V1.cjs");
  let checked=0;
  for(const r of reviews){
    const proof=verifier.verifyRegisteredEvidence({
       decision:{check_id:r.check_id,dependency_digest:r.reviewed_dependency_digest},
       stage:"SUCCESSOR_SUBJECT_PRE_MERGE",head:conf.historical_two_parent_merge,base:conf.historical_operator_signature_base});
    assert(proof&&proof.status==="PASS"&&proof.signature_verification==="ED25519_VALID_ORIGINAL_SOURCE_ONLY",
       "HISTORIC_ED25519_PROOF_MISSING:"+r.check_id);
    assert.equal(proof.permit_authorized,false);checked++;
  }
  assert.equal(checked,6);
  return {status:"PASS_HISTORIC_DA9_SIX_ED25519_SOURCE_ONLY_CURRENT_GOVERNANCE_HOLD",
   current_head:head,current_base:base,historical_source:conf.historical_signed_source,
   exact_historical_signed_bundle_sha256:conf.prior_signed_bundle_sha256,
   historical_signatures_verified:6,original_pr_3734_event_replayed:false,
   current_pr_signed_governance_approved:false,historical_frozen108_requalified:false,
   current_head_qualification_approved:false,original_formal_six_stages:0,
   permit:false,windows_physical_admission:false,production_authorized:false,
   pg_calls:0,s3_calls:0,provider_calls:0};
 }catch(error){return {status:"FAIL_HISTORIC_DA9_SOURCE_SCOPE",
    reason:String(error.message||error).slice(0,300),current_governance_approved:false,permit:false}};
}
if(require.main===module){
 if(!process.argv.includes("--selftest"))throw Error("SELFTEST_ONLY");
 const current=git("rev-parse","HEAD"),baseline=read(C).base_sha;
 const result=verifyCurrentSuccessor({base:baseline,head:current});
 assert.equal(result.status,"PASS_HISTORIC_DA9_SIX_ED25519_SOURCE_ONLY_CURRENT_GOVERNANCE_HOLD",result.reason||"HOLD_SIGNATURE_SCOPE");
 const negative=verifyCurrentSuccessor({base:"0".repeat(40),head:current});
 assert.equal(negative.status,"FAIL_HISTORIC_DA9_SOURCE_SCOPE");
 console.log(JSON.stringify({...result,negative_wrong_base_rejected:true}));
}
module.exports={verifyCurrentSuccessor};
