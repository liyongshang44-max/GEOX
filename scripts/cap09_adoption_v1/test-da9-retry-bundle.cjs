'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const crypto=require('node:crypto');
const b=require('./da9-retry-bundle.cjs'),host=require('../runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs');
const permit=require('../runtime_acceptance/MCFT_CAP09_RETRY_PERMIT_V1.cjs');
let checks=0;function test(name,fn){fn();checks++;console.log('PASS '+name);}
const now=Date.now(),iso=n=>new Date(n).toISOString();
const observed={resources:{...b.RESOURCES},fresh_readback:{status:'PASS',run_id:b.RUN,started_at:iso(now-1000),completed_at:iso(now),all_rows_zero:true,bucket_empty_including_versions_multipart:true,production_bindings_present:false}};
test('fresh_real_contract_shape',()=>b.fresh(observed,now));
for(const [name,change] of Object.entries({stale:x=>x.fresh_readback.started_at=iso(now-300001),future:x=>x.fresh_readback.completed_at=iso(now+1),inverted:x=>x.fresh_readback.started_at=iso(now+1),nonempty:x=>x.fresh_readback.bucket_empty_including_versions_multipart=false,rows:x=>x.fresh_readback.all_rows_zero=false,wrongrun:x=>x.fresh_readback.run_id='800c023cf337',wrongport:x=>x.resources.database_port=55434,wrongbucket:x=>x.resources.bucket='geox-mcft-cap09-formal-raw-v1',wrongaudit:x=>x.resources.audit_user='postgres',production:x=>x.fresh_readback.production_bindings_present=true,failed:x=>x.fresh_readback.status='FAIL'}))test(name,()=>{const x=structuredClone(observed);change(x);assert.throws(()=>b.fresh(x,now));});
test('draft_never_approves',()=>{const d=b.draft('review_da9');assert.equal(d.retry_admissible,false);assert.equal(d.prior_denial_explicitly_superseded,false);assert.equal(d.production_authorized,false);assert.equal(d.first_execution_provider_calls,null);assert.equal(d.first_failure_phase,'UNKNOWN');assert.equal(Object.keys(d.evidence_sha256).length,6);});
test('fabricated_adoption_context_rejected',()=>assert.throws(()=>b.construct({decision_file:'x',files:{},observed,plan:{},authorized_at:iso(now),expires_at:iso(now+60000),qualification_first_base:iso(now+3600000),output_directory:'x'},{head:b.SUBJECT,scope:'TEST_ONLY',execution_authorized:true}),/VERIFIED_ADOPTION_CONTEXT_REQUIRED/));
test('official_v2_plan',()=>{const p={schema_version:'geox_mcft_cap09_retry_stage_plan_v2',stages:host.STAGES.map(x=>({id:x[0],timeout_ms:1000}))};host.validatePlan(p);p.stages.reverse();assert.throws(()=>host.validatePlan(p));});
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'da9-bundle-'));try{
 test('draft_cli_and_no_overwrite',()=>{const out=path.join(dir,'review.json'),script=path.join(__dirname,'da9-retry-bundle.cjs');const first=cp.spawnSync(process.execPath,[script,'draft','review_da9',out],{encoding:'utf8'});assert.equal(first.status,0,first.stderr);const bytes=fs.readFileSync(out);const second=cp.spawnSync(process.execPath,[script,'draft','review_da9',out],{encoding:'utf8'});assert.equal(second.status,1);assert.deepEqual(fs.readFileSync(out),bytes);assert.deepEqual(fs.readdirSync(dir),['review.json']);});
}finally{fs.rmSync(dir,{recursive:true,force:true});}
// No signing or permit consumption: reject verifier drift on immutable target.
const compatRoot=fs.mkdtempSync(path.join(os.tmpdir(),'da9-host-'));
try{
 const verifier=path.join(compatRoot,'scripts/cap09_adoption_v1/offline-context.cjs');
 const entry=path.join(compatRoot,'scripts/runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs');
 fs.mkdirSync(path.dirname(verifier),{recursive:true});fs.mkdirSync(path.dirname(entry),{recursive:true});
 fs.copyFileSync(path.join(__dirname,'offline-context.cjs'),verifier);
 fs.copyFileSync(path.join(__dirname,'../runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs'),entry);
 test('same_verifier_bytes_required',()=>assert.equal(typeof b.assertHostVerifierMaterial(compatRoot).host_verifier_sha256,'string'));
 test('frozen_verifier_drift_fails_closed',()=>{fs.appendFileSync(verifier,'// old verification rule\\n');assert.throws(()=>b.assertHostVerifierMaterial(compatRoot),/FROZEN_HOST_VERIFIER_INCOMPATIBLE_NO_PERMIT/);});
 test('host_entry_byte_drift_fails_closed',()=>{fs.copyFileSync(path.join(__dirname,'offline-context.cjs'),verifier);fs.appendFileSync(entry,'// incompatible host version\n');assert.throws(()=>b.assertHostVerifierMaterial(compatRoot),/FROZEN_HOST_ENTRY_INCOMPATIBLE_NO_PERMIT/);});
 test('missing_host_entry_rejected',()=>{fs.unlinkSync(entry);assert.throws(()=>b.assertHostVerifierMaterial(compatRoot),/ENOENT|FROZEN_HOST_ENTRY_MISSING/);});

 test('old_frozen_verifier_independent_only_precheck',()=>{
  // Read precisely one historical Git blob. No first-parent walk or remote Git.
  const frozenSha='91835fa0997730c85c5f3869dd530f4c9a3ca82d';
  const old=cp.execFileSync('git',['show',frozenSha+':scripts/cap09_adoption_v1/offline-context.cjs'],{
   cwd:path.resolve(__dirname,'../..'),maxBuffer:2*1024*1024});
  const blob=crypto.createHash('sha1').update('blob '+old.length).update(Buffer.from([0])).update(old).digest('hex');
  assert.equal(blob,'b2fb3022546f61db32615087fac95d5c9e0e7938');
  fs.copyFileSync(path.join(__dirname,'../runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs'),entry);
  fs.writeFileSync(verifier,old);
  const policyPath=path.join(compatRoot,'scripts/cap09_adoption_v1/offline-trust.json');
  fs.copyFileSync(path.join(__dirname,'offline-trust.json'),policyPath);
  const policy=JSON.parse(fs.readFileSync(policyPath,'utf8'));
  const fixturePath=path.join(compatRoot,'fixture-adoption.json');
  const issuer=policy.issuers.find(x=>x.role==='INDEPENDENT_GOVERNANCE');
  const operator=policy.issuers.find(x=>x.role==='ACCOUNTABLE_SINGLE_OPERATOR');
  assert(issuer&&operator);
  fs.writeFileSync(fixturePath,JSON.stringify({qualification:{payload:{issuer_id:issuer.issuer_id,key_id:issuer.key_id}}}));
  assert.throws(()=>b.assertHostVerifierMaterial(compatRoot),/FROZEN_HOST_VERIFIER_INCOMPATIBLE_NO_PERMIT/);
  // Positive mode is ONLY a role/key compatibility precheck, not signature or Host admission.
  const positive=b.assertHostVerifierMaterial(compatRoot,fixturePath);
  assert.equal(positive.mode,'FROZEN_91835FA0_INDEPENDENT_ONLY');
  fs.writeFileSync(fixturePath,JSON.stringify({qualification:{payload:{issuer_id:operator.issuer_id,key_id:operator.key_id}}}));
  assert.throws(()=>b.assertHostVerifierMaterial(compatRoot,fixturePath),/FROZEN_INDEPENDENT_SIGNER_REQUIRED/);
  // Do not accept caller-provided trust-file overrides to convert the frozen verifier.
  const trustModified={...policy,operator_id:'forged_operator'};
  fs.writeFileSync(policyPath,JSON.stringify(trustModified));
  assert.throws(()=>b.assertHostVerifierMaterial(compatRoot,fixturePath),/FROZEN_ADOPTION_TRUST_CHANGED/);
  fs.copyFileSync(path.join(__dirname,'offline-trust.json'),policyPath);
  fs.appendFileSync(verifier,'\n// unrecognized modified old verifier');
  assert.throws(()=>b.assertHostVerifierMaterial(compatRoot,fixturePath),/FROZEN_HOST_VERIFIER_INCOMPATIBLE_NO_PERMIT/);
 });
}finally{fs.rmSync(compatRoot,{recursive:true,force:true});}
// Real Ed25519 signing fixture: historical hashes are treated as immutable constants.
const pair=crypto.generateKeyPairSync('ed25519');
const reviewer='fixture_operator';
const pub=pair.publicKey.export({type:'spki',format:'pem'});
const trust={schema_version:'geox_mcft_cap09_retry_trust_v1',adopted:false,execution_enabled:false,
 operator_id:reviewer,issuers:[{issuer_id:reviewer,key_id:'test_review',role:'ACCOUNTABLE_SINGLE_OPERATOR',
 revoked:false,not_before:iso(now-60000),not_after:iso(now+86400000),public_key_pem:pub,
 spki_sha256:crypto.createHash('sha256').update(pair.publicKey.export({type:'spki',format:'der'})).digest('hex')}]};
const rationale='The POSTMERGE_V13_PRODUCER_CORE_FORMAL_RAW_BUCKET_REQUIRED failure is explained by the frozen bucket wrapper. The isolated TEST_ONLY composition offers a narrower retry path, while original Provider calls remain unknown and may not be treated as zero.';
function reviewedFixture(){
 const d=b.draft('DA9_TEST_REVIEW_1');
 Object.assign(d,{review_status:'APPROVED',reviewer_id:reviewer,review_authority_ref:'fixture-authority-record-not-live',
 supersession_rationale:rationale,review_issued_at:iso(now),authorized_at:iso(now),
 retry_admissible:true,prior_denial_explicitly_superseded:true,
 review_policy_sha256:permit.sha(permit.canonical(trust))});
 return d;
}
function signedReview(input=reviewedFixture(),signerTrust=trust){
 return b.signReviewPayload(input,signerTrust,pair.privateKey,reviewer,'test_review',now);
}
test('separate_adjudication_ed25519_roundtrip_no_execution_authority',()=>{
 const result=b.verifyReviewedDecision(signedReview(),trust,now);
 assert.equal(result.status,'REVIEW_SIGNATURE_VERIFIED_NOT_POLICY_ADOPTION');
 assert.equal(result.production_authorized,false);
});
test('raw_approved_boolean_cannot_be_adjudication',()=>assert.throws(()=>b.verifyReviewedDecision(reviewedFixture(),trust,now),/OBJECT_REQUIRED/));
test('unapproved_signed_candidate_rejected',()=>{
 const d=reviewedFixture();d.retry_admissible=false;assert.throws(()=>b.verifyReviewedDecision(signedReview(d),trust,now),/REVIEW_RETRY_NOT_APPROVED/);
});
test('unsigned_decision_rationale_incomplete_rejected',()=>{
 const d=reviewedFixture();d.supersession_rationale='it is fixed';assert.throws(()=>b.verifyReviewedDecision(signedReview(d),trust,now),/REVIEW_REASON_MISSING/);
});
test('wrong_trust_policy_digest_rejected',()=>{
 const d=reviewedFixture();d.review_policy_sha256='a'.repeat(64);
 assert.throws(()=>b.verifyReviewedDecision(signedReview(d),trust,now),/REVIEW_TRUST_DIGEST_MISMATCH/);
});
test('tampered_denial_supersession_signing_not_transferable',()=>{
 const d=signedReview();d.prior_denial_explicitly_superseded=false;
 assert.throws(()=>b.verifyReviewedDecision(d,trust,now),/REVIEW_DENIAL_NOT_SUPERSEDED/);
});
test('tampered_reason_signature_rejected',()=>{
 const d=signedReview();d.supersession_rationale+=' arbitrarily modified';
 assert.throws(()=>b.verifyReviewedDecision(d,trust,now),/REVIEW_SIGNATURE_INVALID/);
});
test('tampered_subject_rejected',()=>{
 const d=signedReview();d.protected_main_sha='a'.repeat(40);
 assert.throws(()=>b.verifyReviewedDecision(d,trust,now),/REVIEW_SUBJECT_INVALID/);
});
test('historical_provider_count_null_enforced',()=>{
 const d=reviewedFixture();d.first_execution_provider_calls=0;
 assert.throws(()=>b.verifyReviewedDecision(signedReview(d),trust,now),/REVIEW_PROVIDER_COUNT_UNKNOWN/);
});
test('unknown_reviewer_role_rejected',()=>{
 const t=structuredClone(trust);t.issuers[0].role='ANY_ROLE';
 const d=reviewedFixture();d.review_policy_sha256=permit.sha(permit.canonical(t));
 assert.throws(()=>b.verifyReviewedDecision(signedReview(d,t),t,now),/REVIEW_ISSUER_ROLE_FORBIDDEN/);
});
test('expired_review_rejected',()=>{
 const d=reviewedFixture();d.review_issued_at=iso(now-86400001);d.authorized_at=d.review_issued_at;
 assert.throws(()=>b.verifyReviewedDecision(signedReview(d),trust,now),/REVIEW_SIGNATURE_TIME_INVALID/);
});
test('review_signer_rejects_mismatched_private_key',()=>{
 const pair2=crypto.generateKeyPairSync('ed25519');
 assert.throws(()=>b.signReviewPayload(reviewedFixture(),trust,pair2.privateKey,reviewer,'test_review',now),/REVIEW_SIGNER_KEY_MISMATCH/);
});
test('review_signer_does_not_set_approval_booleans',()=>{
 const d=b.draft('UNAPPROVED_TEST');
 assert.throws(()=>b.signReviewPayload(d,trust,pair.privateKey,reviewer,'test_review',now));
 assert.equal(d.retry_admissible,false);assert.equal(d.prior_denial_explicitly_superseded,false);
});
test('no_windows_review_signature_from_ci',()=>assert.throws(()=>b.signReviewedDecision('a','b','c','d','e'),/REVIEW_WINDOWS_OPERATOR_ONLY/));
test('host_readonly_audit_never_runs_in_ci',()=>assert.throws(()=>b.auditInstalledAdoption('a','b'),/AUDIT_WINDOWS_LOCAL_ONLY/));
console.log(JSON.stringify({status:'PASS',checks,live_signing_tested:false,provider_calls:0,database_connections:0,permit_consumed:false}));
