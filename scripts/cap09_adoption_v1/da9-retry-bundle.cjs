'use strict';
// Offline assembler only. No network, child process, resource mutation or permit consumption.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const c=require('./contract.cjs'),offline=require('./offline-context.cjs');
const permit=require('../runtime_acceptance/MCFT_CAP09_RETRY_PERMIT_V1.cjs');
const host=require('../runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs');
const bridge=require('../governance_acceptance/MCFT_CAP09_ISOLATED_RETRY_ADMISSION_BRIDGE_V1.cjs');
const {ANCHORS}=require('../governance_acceptance/MCFT_CAP_09_ISOLATED_RETRY_AUTHORITY_POLICY_V1.cjs');
const {HASHES}=require('../governance_acceptance/MCFT_CAP09_RETRY_HISTORICAL_EVIDENCE_V1.cjs');
const RUN='da9db7129607',SUBJECT='91835fa0997730c85c5f3869dd530f4c9a3ca82d';
const HISTORY=Object.freeze({...ANCHORS,...HASHES});
const RESOURCES=Object.freeze({database_host:'127.0.0.1',database_port:55445,audit_user:'qual_admin',positive_database:'mcft_cap09_requal_'+RUN+'_positive',negative_database:'mcft_cap09_requal_'+RUN+'_negative',bucket_endpoint:'http://127.0.0.1:59005',bucket:'mcft-cap09-requal-'+RUN});
function evidence(files){
 c.exact(files,[...Object.keys(HISTORY),'retry_adjudication']);const hashes={};
 for(const [key,file] of Object.entries(files)){assert(path.isAbsolute(file),'ABSOLUTE_EVIDENCE_REQUIRED');c.noLinks(file);assert(fs.statSync(file).isFile(),'REGULAR_EVIDENCE_REQUIRED');hashes[key]=c.sha(fs.readFileSync(file));if(key!=='retry_adjudication')assert.equal(hashes[key],HISTORY[key],'HISTORICAL_BYTES_CHANGED:'+key);}
 return hashes;
}
function fresh(observed,now){
 const r=observed.fresh_readback;assert(r&&r.status==='PASS','FRESH_READBACK_REQUIRED');
 const start=c.epoch(r.started_at),end=c.epoch(r.completed_at);
 assert(start<=end&&end<=now&&now-start<=300000,'FRESH_READBACK_STALE_OR_FUTURE');
 assert.equal(r.run_id,RUN);assert.equal(r.all_rows_zero,true);assert.equal(r.bucket_empty_including_versions_multipart,true,'BUCKET_NOT_EMPTY_PRESERVE_AND_REVIEW');
 assert.equal(r.production_bindings_present,false);assert.deepEqual(observed.resources,RESOURCES);
}
function draft(decisionId){
 c.id(decisionId);
 return {decision_id:decisionId,run_id:RUN,parent_run_id:'72dc0304a21a',attempt_ordinal:2,protected_main_sha:SUBJECT,scope:'TEST_ONLY',
 first_execution_provider_calls:null,first_failure_phase:'UNKNOWN',unknown_provider_count_acknowledged:true,
 evidence_sha256:{...HISTORY},prior_denial_sha256:HISTORY.first_failed_receipt,first_failure_code:FAILURE_CODE,
 retry_admissible:false,prior_denial_explicitly_superseded:false,production_authorized:false,
 review_status:'REVIEW_REQUIRED',reviewer_id:null,review_authority_ref:null,supersession_rationale:null,
 review_policy_sha256:null,review_issued_at:null,authorized_at:null};
}
// Retry adjudication is a separately signed input, never inferred from
// review_status, role registration, or the later execution Permit signature.
const REVIEW_DOMAIN='GEOX_MCFT_CAP09_RETRY_ADJUDICATION_V1\n';
const FAILURE_CODE='POSTMERGE_V13_PRODUCER_CORE_FORMAL_RAW_BUCKET_REQUIRED';
function reviewPayload(decision) {
 const d=structuredClone(decision);delete d.review_signature;return d;
}
function verifyReviewedDecision(decision,trust,now=Date.now()){
 assert(decision&&trust&&Array.isArray(trust.issuers),'REVIEW_TRUST_REQUIRED');
 assert.equal(trust.schema_version,'geox_mcft_cap09_retry_trust_v1','REVIEW_TRUST_SCHEMA_INVALID');
 // policy_digest is a key-registry binding, without changing adopted/execution flags.
 const d=reviewPayload(decision);
 const expected=permit.sha(permit.canonical(trust));
 assert.equal(d.review_policy_sha256,expected,'REVIEW_TRUST_DIGEST_MISMATCH');
 // Validate all required fields without deriving authorization from any booleans alone.
 assert.equal(d.run_id,RUN,'REVIEW_RUN_MISMATCH');
 assert.equal(d.parent_run_id,'72dc0304a21a','REVIEW_PARENT_MISMATCH');
 assert.equal(d.attempt_ordinal,2,'REVIEW_ATTEMPT_INVALID');
 assert.equal(d.protected_main_sha,SUBJECT,'REVIEW_SUBJECT_INVALID');
 assert.equal(d.scope,'TEST_ONLY','REVIEW_SCOPE_INVALID');
 assert.equal(d.production_authorized,false,'REVIEW_PRODUCTION_FORBIDDEN');
 assert.equal(d.first_execution_provider_calls,null,'REVIEW_PROVIDER_COUNT_UNKNOWN');
 assert.equal(d.first_failure_phase,'UNKNOWN','REVIEW_FIRST_PHASE_UNKNOWN');
 assert.equal(d.first_failure_code,FAILURE_CODE,'REVIEW_ERROR_NOT_PRESERVED');
 assert.equal(d.unknown_provider_count_acknowledged,true,'REVIEW_UNKNOWN_PROVIDER_NOT_ACKNOWLEDGED');
 assert.deepEqual(d.evidence_sha256,HISTORY,'REVIEW_HISTORICAL_DIGESTS_CHANGED');
 assert.equal(d.prior_denial_sha256,HISTORY.first_failed_receipt,'REVIEW_DENIAL_ANCHOR_CHANGED');
 assert.equal(d.review_status,'APPROVED','REVIEW_NOT_APPROVED');
 assert.equal(d.retry_admissible,true,'REVIEW_RETRY_NOT_APPROVED');
 assert.equal(d.prior_denial_explicitly_superseded,true,'REVIEW_DENIAL_NOT_SUPERSEDED');
 c.id(d.reviewer_id);c.id(d.decision_id);
 assert(typeof d.review_authority_ref==='string'&&d.review_authority_ref.length>=12&&d.review_authority_ref.length<=512,'REVIEW_AUTHORITY_PROVENANCE_MISSING');
 assert(typeof d.supersession_rationale==='string'&&d.supersession_rationale.length>=100&&d.supersession_rationale.length<=4000,'REVIEW_REASON_MISSING');
 for(const x of [FAILURE_CODE,'TEST_ONLY','unknown','isolated'])assert(d.supersession_rationale.includes(x),'REVIEW_RATIONALE_INCOMPLETE:'+x);
 const issued=c.epoch(d.review_issued_at);
 assert(issued<=now&&now-issued<=86400000,'REVIEW_SIGNATURE_TIME_INVALID');
 assert.equal(d.authorized_at,d.review_issued_at,'REVIEW_AUTHORIZATION_TIME_CHANGED');
 const sig=decision.review_signature;
 c.exact(sig,['issuer_id','key_id','signature_base64']);
 assert.equal(sig.issuer_id,d.reviewer_id,'REVIEW_SIGNER_NOT_REVIEWER');
 c.id(sig.key_id);
 const issuers=trust.issuers.filter(x=>x.issuer_id===sig.issuer_id&&x.key_id===sig.key_id);
 assert.equal(issuers.length,1,'REVIEW_UNKNOWN_ISSUER');
 const issuer=issuers[0];
 assert.equal(issuer.revoked,false,'REVIEW_ISSUER_REVOKED');
 assert(['ACCOUNTABLE_SINGLE_OPERATOR','INDEPENDENT_RETRY_GOVERNANCE'].includes(issuer.role),'REVIEW_ISSUER_ROLE_FORBIDDEN');
 if(issuer.role==='ACCOUNTABLE_SINGLE_OPERATOR')assert.equal(issuer.issuer_id,trust.operator_id,'REVIEW_OPERATOR_ROLE_MISMATCH');
 else assert.notEqual(issuer.issuer_id,trust.operator_id,'REVIEW_INDEPENDENT_ROLE_MISMATCH');
 assert(c.epoch(issuer.not_before)<=issued&&issued<=c.epoch(issuer.not_after),'REVIEW_ISSUER_EXPIRED');
 const key=crypto.createPublicKey(issuer.public_key_pem);
 assert.equal(key.asymmetricKeyType,'ed25519','REVIEW_ED25519_REQUIRED');
 assert.equal(c.sha(key.export({type:'spki',format:'der'})),issuer.spki_sha256,'REVIEW_KEY_FINGERPRINT_MISMATCH');
 const bytes=Buffer.from(sig.signature_base64,'base64');
 assert.equal(bytes.length,64,'REVIEW_SIGNATURE_LENGTH_INVALID');
 assert.equal(bytes.toString('base64'),sig.signature_base64,'REVIEW_SIGNATURE_ENCODING_INVALID');
 assert(crypto.verify(null,Buffer.from(REVIEW_DOMAIN+permit.canonical(d)),key,bytes),'REVIEW_SIGNATURE_INVALID');
 return {status:'REVIEW_SIGNATURE_VERIFIED_NOT_POLICY_ADOPTION',decision_id:d.decision_id,run_id:RUN,production_authorized:false};
}
function construct(input,context,now=Date.now(),reviewTrust){
 c.exact(input,['decision_file','files','observed','plan','authorized_at','expires_at','qualification_first_base','output_directory']);
 assert.equal(offline.isFormalVerified(context),true,'VERIFIED_ADOPTION_CONTEXT_REQUIRED');
 assert.equal(context.head,SUBJECT);assert.equal(context.main,SUBJECT);assert.equal(context.scope,'TEST_ONLY');assert.equal(context.production_authorized,false);
 assert(path.isAbsolute(input.output_directory),'ABSOLUTE_NEW_OUTPUT_REQUIRED');assert(!fs.existsSync(input.output_directory),'NEW_OUTPUT_REQUIRED');
 const decision=c.read(input.decision_file);assert.equal(input.files.retry_adjudication,input.decision_file);
 verifyReviewedDecision(decision,reviewTrust,now);
 assert.equal(decision.run_id,RUN);assert.equal(decision.protected_main_sha,SUBJECT);assert.equal(decision.parent_run_id,'72dc0304a21a');assert.equal(decision.attempt_ordinal,2);
 assert.equal(decision.scope,'TEST_ONLY');assert.equal(decision.first_execution_provider_calls,null);assert.equal(decision.first_failure_phase,'UNKNOWN');
 assert.equal(decision.review_status,'APPROVED','AUTHENTICATED_REVIEW_REQUIRED');c.id(decision.reviewer_id);c.id(decision.decision_id);
 assert.equal(decision.production_authorized,false);assert.deepEqual(decision.evidence_sha256,HISTORY);assert.equal(decision.authorized_at,input.authorized_at);
 const hashes=evidence(input.files);const observed=structuredClone(input.observed);fresh(observed,now);host.validatePlan(input.plan);
 assert.deepEqual(observed.evidence_sha256,hashes,'OBSERVATION_EVIDENCE_CHANGED');assert.equal(observed.output_directory,input.output_directory);
 const arm={schema_version:'geox_mcft_cap09_isolated_retry_arm_v1',mode:'ISOLATED_QUALIFICATION',run_id:RUN,parent_run_id:'72dc0304a21a',attempt_ordinal:2,protected_main_sha:SUBJECT,
 armed:true,execute_authorized:true,retry_authorized:true,authorized_at:input.authorized_at,expires_at:input.expires_at,qualification_first_base:input.qualification_first_base,
 resources:{...RESOURCES},output_directory:input.output_directory,evidence_sha256:hashes,retry_adjudication:decision,first_execution_provider_calls:null,
 production_recovery_authorized:false,owner_cutover_authorized:false,formal_v5_authorized:false,a0_authorized:false,o00_o23_authorized:false,automatic_retry_authorized:false,historical_reset_authorized:false};
 observed.adoption_binding={qualification_digest:context.adoption_digest,material_digest:context.material_digest};
 bridge.admitProposedRetry(arm,{...observed,head:context.head,protected_main:context.main,source_clean:context.clean,now_utc:new Date(now).toISOString()});
 const budget=input.plan.stages.reduce((n,s)=>n+s.timeout_ms,0);assert(budget<=observed.measured_worst_case_ms,'MEASURED_BUDGET_TOO_SMALL');
 assert(c.epoch(input.expires_at)>now+budget+observed.deadline_safety_margin_ms,'PERMIT_WINDOW_TOO_SHORT');
 assert(c.epoch(input.expires_at)<=c.epoch(context.qualification_expires_at),'PERMIT_OUTLIVES_ADOPTION');
 assert(c.epoch(input.qualification_first_base)>now,'FIRST_BASE_NOT_FUTURE');
 return {arm,observed,plan:structuredClone(input.plan),files:structuredClone(input.files)};
}
// Safety gate: external verification is not transferable to the immutable Host's
// private WeakSet. Require identical verifier *bytes* at its resolved path before
// signing a single-use permit. This is necessary, not sufficient, for host adoption.
function assertHostVerifierMaterial(runtimeRoot){
 const rel='scripts/cap09_adoption_v1/offline-context.cjs';
 const installed=path.resolve(runtimeRoot,...rel.split('/'));
 const tool=path.resolve(__dirname,'offline-context.cjs');
 c.noLinks(installed);c.noLinks(tool);
 assert(fs.statSync(installed).isFile(),'FROZEN_HOST_VERIFIER_MISSING');
 assert.equal(c.sha(fs.readFileSync(installed)),c.sha(fs.readFileSync(tool)),'FROZEN_HOST_VERIFIER_INCOMPATIBLE_NO_PERMIT');
 const hosted=path.resolve(runtimeRoot,'scripts/runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs');
 c.noLinks(hosted);assert(fs.statSync(hosted).isFile(),'FROZEN_HOST_ENTRY_MISSING');
 const expectedHost=path.resolve(__dirname,'../runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs');
 c.noLinks(expectedHost);
 assert.equal(c.sha(fs.readFileSync(hosted)),c.sha(fs.readFileSync(expectedHost)),'FROZEN_HOST_ENTRY_INCOMPATIBLE_NO_PERMIT');
 return {host_verifier_sha256:c.sha(fs.readFileSync(installed)),host_sha256:c.sha(fs.readFileSync(hosted))};
}

function signReviewedDecision(reviewFile,keyFile,issuerId,keyId,output){
 assert(process.platform==='win32'&&!process.env.CI&&!process.env.GITHUB_ACTIONS,'REVIEW_WINDOWS_OPERATOR_ONLY');
 const releaseRoot=path.resolve(__dirname,'../..');
 for(const file of [reviewFile,keyFile,output]) {
  assert(path.isAbsolute(file),'REVIEW_ABSOLUTE_FILE_REQUIRED');
  assert(require('./installed-material.cjs').outside(releaseRoot,file),'REVIEW_INPUT_OR_OUTPUT_INSIDE_RELEASE');
 }
 assert(path.resolve(reviewFile)!==path.resolve(output),'REVIEW_OUTPUT_MUST_BE_SEPARATE');
 assert(!fs.existsSync(output),'REVIEW_OUTPUT_EXISTS');
 c.noLinks(keyFile);
 const trust=c.read(permit.TRUST_PATH),unsigned=c.read(reviewFile);
 assert(!Object.hasOwn(unsigned,'review_signature'),'REVIEW_ALREADY_SIGNED');
 assert.equal(unsigned.reviewer_id,issuerId,'REVIEW_OPERATOR_ID_MISMATCH');
 assert.equal(unsigned.review_policy_sha256,permit.sha(permit.canonical(trust)),'REVIEW_TRUST_DIGEST_MISMATCH');
 const issuers=trust.issuers.filter(x=>x.issuer_id===issuerId&&x.key_id===keyId&&x.revoked===false);
 assert.equal(issuers.length,1,'REVIEW_SIGNER_NOT_REGISTERED');
 const privateKey=crypto.createPrivateKey(fs.readFileSync(keyFile));
 assert.equal(privateKey.asymmetricKeyType,'ed25519','REVIEW_ED25519_REQUIRED');
 assert.equal(c.sha(crypto.createPublicKey(privateKey).export({type:'spki',format:'der'})),issuers[0].spki_sha256,'REVIEW_SIGNER_KEY_MISMATCH');
 const signature_base64=crypto.sign(null,Buffer.from(REVIEW_DOMAIN+permit.canonical(unsigned)),privateKey).toString('base64');
 const decision={...unsigned,review_signature:{issuer_id:issuerId,key_id:keyId,signature_base64}};
 const verified=verifyReviewedDecision(decision,trust);
 c.writeOnce(output,decision);
 return {...verified,status:'SIGNED_RETRY_REVIEW_NOT_ADOPTION_OR_PERMIT',
   decision_sha256:c.sha(fs.readFileSync(output)),retry_execution_authorized:false,production_authorized:false};
}
function sign(inputFile,adoptionFile,runtimeRoot,keyFile,issuerId,keyId,output){
 assert(process.platform==='win32'&&!process.env.CI&&!process.env.GITHUB_ACTIONS,'WINDOWS_OFFLINE_ONLY');
 assert(require('./installed-material.cjs').outside(runtimeRoot,keyFile),'PRIVATE_KEY_INSIDE_RUNTIME');
 assert(require('./installed-material.cjs').outside(runtimeRoot,output),'BUNDLE_OUTPUT_INSIDE_RUNTIME');
 assertHostVerifierMaterial(runtimeRoot);
 const context=offline.load(adoptionFile,runtimeRoot),trust=c.read(permit.TRUST_PATH),now=Date.now();
 assert.equal(context.host_id,trust.host_id);const unsigned=construct(c.read(inputFile),context,now,trust);
 const candidates=trust.issuers.filter(x=>x.issuer_id===issuerId&&x.key_id===keyId&&x.revoked===false);assert.equal(candidates.length,1,'REGISTERED_ISSUER_REQUIRED');
 const issuer=candidates[0];assert(['ACCOUNTABLE_SINGLE_OPERATOR','INDEPENDENT_RETRY_GOVERNANCE'].includes(issuer.role));
 // Explicit signing action by the registered custodian attests the supplied review; assembly itself cannot approve it.
 assert.equal(unsigned.arm.retry_adjudication.reviewer_id,issuerId,'REVIEWER_MUST_MATCH_SIGNING_ISSUER');
 c.noLinks(keyFile);const key=crypto.createPrivateKey(fs.readFileSync(keyFile));assert.equal(key.asymmetricKeyType,'ed25519');
 assert.equal(c.sha(crypto.createPublicKey(key).export({type:'spki',format:'der'})),issuer.spki_sha256,'WRONG_SIGNING_KEY');
 const payload={schema_version:'geox_mcft_cap09_signed_retry_permit_v1',issuer_id:issuerId,key_id:keyId,nonce:crypto.randomBytes(32).toString('hex'),run_id:RUN,parent_run_id:'72dc0304a21a',attempt_ordinal:2,subject_sha:SUBJECT,host_id:trust.host_id,
 issued_at:unsigned.arm.authorized_at,expires_at:unsigned.arm.expires_at,arm_sha256:c.digest(unsigned.arm),observations_sha256:c.digest(unsigned.observed),plan_sha256:c.digest(unsigned.plan),scope:'ISOLATED_QUALIFICATION_SINGLE_ATTEMPT'};
 const bundle={...unsigned,permit:{payload,signature_base64:crypto.sign(null,Buffer.from(permit.DOMAIN+permit.canonical(payload)),key).toString('base64')}};
 const effective={...trust,adopted:true,execution_enabled:true}; // Only after fixed-policy Adoption returned an authentic context.
 offline.bindObserved(context,bundle);host.validateBundle(bundle,effective,{...context,now:new Date(Date.now()).toISOString()});fresh(bundle.observed,Date.now());
 assert(!fs.existsSync(path.join(trust.ledger_root,'run-'+RUN)),'RUN_ALREADY_CONSUMED');
 c.writeOnce(output,bundle);return {status:'SIGNED_BUNDLE_READY_FOR_OFFICIAL_PREFLIGHT',run_id:RUN,bundle_sha256:c.sha(fs.readFileSync(output)),execution_authorized:false,production_authorized:false};
}
module.exports={RUN,SUBJECT,HISTORY,RESOURCES,REVIEW_DOMAIN,draft,fresh,construct,verifyReviewedDecision,signReviewedDecision,assertHostVerifierMaterial,sign};
if(require.main===module){try{const [mode,...a]=process.argv.slice(2);if(mode==='draft'){assert.equal(a.length,2);c.writeOnce(a[1],draft(a[0]));console.log(JSON.stringify({status:'REVIEW_REQUIRED',execution_authorized:false,production_authorized:false}));}else if(mode==='review-sign'){assert.equal(a.length,5);console.log(JSON.stringify(signReviewedDecision(...a)));}else if(mode==='sign'){assert.equal(a.length,7);console.log(JSON.stringify(sign(...a)));}else throw Error('MODE_REQUIRED');}catch(e){console.error(JSON.stringify({status:'EXECUTE_HOLD',code:e.code||'BUNDLE_REJECTED',execution_authorized:false,production_authorized:false}));process.exitCode=1;}}
