'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const b=require('./da9-retry-bundle-v2.cjs'),v1=require('./da9-retry-bundle.cjs'),permit=require('../runtime_acceptance/MCFT_CAP09_RETRY_PERMIT_V1.cjs');
let checks=0;const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
const now=Date.now(),iso=n=>new Date(n).toISOString();
const binding={subject_sha:'c'.repeat(40),subject_tree_digest:'d'.repeat(40),release_inventory_sha256:'e'.repeat(64),material_digest:'f'.repeat(64),scoped_evidence_identity_sha256:'1'.repeat(64)};
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
 const d={...v1.draft('DA9_TEST_REVIEW_1'),review_contract_version:2,subject_binding:binding,protected_main_sha:binding.subject_sha};
 Object.assign(d,{review_status:'APPROVED',reviewer_id:reviewer,review_authority_ref:'fixture-authority-record-not-live',
 supersession_rationale:rationale,review_issued_at:iso(now),authorized_at:iso(now),
 retry_admissible:true,prior_denial_explicitly_superseded:true,
 review_policy_sha256:permit.sha(permit.canonical(trust))});
 return d;
}
function signedReview(input=reviewedFixture(),signerTrust=trust){
 return b.signReviewPayload(input,signerTrust,pair.privateKey,reviewer,'test_review',now,binding);
}
test('separate_adjudication_ed25519_roundtrip_no_execution_authority',()=>{
 const result=b.verifyReviewedDecision(signedReview(),trust,now,binding);
 assert.equal(result.status,'REVIEW_SIGNATURE_VERIFIED_NOT_POLICY_ADOPTION');
 assert.equal(result.production_authorized,false);
});
test('raw_approved_boolean_cannot_be_adjudication',()=>assert.throws(()=>b.verifyReviewedDecision(reviewedFixture(),trust,now,binding),/OBJECT_REQUIRED/));
test('unapproved_signed_candidate_rejected',()=>{
 const d=reviewedFixture();d.retry_admissible=false;assert.throws(()=>b.verifyReviewedDecision(signedReview(d),trust,now,binding),/REVIEW_RETRY_NOT_APPROVED/);
});
test('unsigned_decision_rationale_incomplete_rejected',()=>{
 const d=reviewedFixture();d.supersession_rationale='it is fixed';assert.throws(()=>b.verifyReviewedDecision(signedReview(d),trust,now,binding),/REVIEW_REASON_MISSING/);
});
test('wrong_trust_policy_digest_rejected',()=>{
 const d=reviewedFixture();d.review_policy_sha256='a'.repeat(64);
 assert.throws(()=>b.verifyReviewedDecision(signedReview(d),trust,now,binding),/REVIEW_TRUST_DIGEST_MISMATCH/);
});
test('tampered_denial_supersession_signing_not_transferable',()=>{
 const d=signedReview();d.prior_denial_explicitly_superseded=false;
 assert.throws(()=>b.verifyReviewedDecision(d,trust,now,binding),/REVIEW_DENIAL_NOT_SUPERSEDED/);
});
test('tampered_reason_signature_rejected',()=>{
 const d=signedReview();d.supersession_rationale+=' arbitrarily modified';
 assert.throws(()=>b.verifyReviewedDecision(d,trust,now,binding),/REVIEW_SIGNATURE_INVALID/);
});
test('tampered_subject_rejected',()=>{
 const d=signedReview();d.protected_main_sha='a'.repeat(40);
 assert.throws(()=>b.verifyReviewedDecision(d,trust,now,binding),/REVIEW_SUBJECT_INVALID/);
});
test('historical_provider_count_null_enforced',()=>{
 const d=reviewedFixture();d.first_execution_provider_calls=0;
 assert.throws(()=>b.verifyReviewedDecision(signedReview(d),trust,now,binding),/REVIEW_PROVIDER_COUNT_UNKNOWN/);
});

for(const key of Object.keys(binding))test('reject_rebound_'+key,()=>{const d=signedReview();const changed={...binding,[key]:'0'.repeat(binding[key].length)};assert.throws(()=>b.verifyReviewedDecision(d,trust,now,changed));});
test('reject_v1_signature',()=>{const d=reviewedFixture();const v1signed={...d,review_signature:{issuer_id:reviewer,key_id:'test_review',signature_base64:crypto.sign(null,Buffer.from(v1.REVIEW_DOMAIN+permit.canonical(d)),pair.privateKey).toString('base64')}};assert.throws(()=>b.verifyReviewedDecision(v1signed,trust,now,binding));});
test('reject_fabricated_context',()=>assert.throws(()=>b.subjectBinding({head:binding.subject_sha,...binding,scope:'TEST_ONLY',production_authorized:false})));
test('v1_remains_historical',()=>assert.equal(v1.SUBJECT,'91835fa0997730c85c5f3869dd530f4c9a3ca82d'));
console.log(JSON.stringify({status:'PASS',checks,provider_calls:0,permit_consumed:false,execution_authorized:false}));
