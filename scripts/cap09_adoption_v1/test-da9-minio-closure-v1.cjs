'use strict';
// Synthetic end-to-end historical approval -> exact deletion receipts -> 0/0/0/0
// -> signed closure -> later fresh Host admission. No bucket mutation.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const c=require('./contract.cjs'),d=require('./da9-minio-disposition-v1.cjs'),v=require('./da9-minio-closure-v1.cjs');
const inv=require('./da9-minio-readonly-inventory.cjs'),executor=require('./da9-minio-exact-delete-v1.cjs');
let n=0;function test(name,fn){fn();n++;console.log('PASS '+name);}
const iso=x=>new Date(x).toISOString();

test('bom_prefixed_historical_json_parses_without_changing_evidence_bytes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cap09-bom-'));
 try{
  const file=path.join(dir,'historical.json');
  const bytes=Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from('{"status":"WORM_REMOTE_READONLY_RECHECK_PASS","original_receipt_recovered":false}\n')]);
  fs.writeFileSync(file,bytes,{flag:'wx'});
  const originalDigest=c.sha(bytes);
  assert.equal(c.read(file).status,'WORM_REMOTE_READONLY_RECHECK_PASS');
  assert.equal(c.read(file).original_receipt_recovered,false);
  assert.deepEqual(fs.readFileSync(file),bytes);
  assert.equal(c.sha(fs.readFileSync(file)),originalDigest,'BOM_EVIDENCE_HASH_MUST_BE_RAW_BYTES');
  assert.notEqual(originalDigest,c.sha(bytes.subarray(3)),'NORMALIZED_FILE_MUST_NOT_REPLACE_HISTORICAL_BYTES');
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('normal_and_invalid_bom_json_parser_behavior',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cap09-bom-negative-'));
 try{
  const normal=path.join(dir,'normal.json'),invalid=path.join(dir,'invalid.json'),double=path.join(dir,'double.json');
  fs.writeFileSync(normal,'{"ok":true}');
  fs.writeFileSync(invalid,Buffer.from([0xef,0xbb,0xbf,0x7b,0x22]));
  fs.writeFileSync(double,Buffer.concat([Buffer.from([0xef,0xbb,0xbf,0xef,0xbb,0xbf]),Buffer.from('{}')]));
  assert.deepEqual(c.read(normal),{ok:true});
  assert.throws(()=>c.read(invalid),SyntaxError);
  assert.throws(()=>c.read(double),SyntaxError);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

function fixture(subject='a'.repeat(40)){
 const now=Date.now(),{publicKey,privateKey}=crypto.generateKeyPairSync('ed25519'),who='fixture_operator',keyId='fixture_key';
 const trust={schema_version:'geox_mcft_cap09_retry_trust_v1',operator_id:who,issuers:[{issuer_id:who,key_id:keyId,role:'ACCOUNTABLE_SINGLE_OPERATOR',revoked:false,not_before:iso(now-86400000),not_after:iso(now+86400000),public_key_pem:publicKey.export({type:'spki',format:'pem'}),spki_sha256:c.sha(publicKey.export({type:'spki',format:'der'}))}]};
 const current=d.OBJECTS.map((o,i)=>({Key:o.key,Size:String(o.size_bytes),ETag:'"fixture-'+i+'"',LastModified:iso(now-86400000)}));
 const versions=d.OBJECTS.map(o=>({Key:o.key,VersionId:'null',IsLatest:'true'}));
 const pre={schema_version:'MCFT_CAP09_DA9_MINIO_READONLY_INVENTORY_V1',run_id:d.RUN,bucket:d.SOURCE_BUCKET,endpoint:d.SOURCE_ENDPOINT,started_at:iso(now-45000),completed_at:iso(now-40000),counts:{current:2,versions:2,delete_markers:0,multipart:0,status:'BUCKET_NOT_EMPTY_HOLD',test_only_admission:'HOLD',production_admission:'HOLD'},entries:{current,versions,multipart:[]}};
 const capture={schema_version:'DA9_PROBE_CAPTURE_MANIFEST_V1',run_id:d.RUN,bucket:d.SOURCE_BUCKET,objects:d.OBJECTS.map((o,i)=>({key:o.key,version_id:'null',size:o.size_bytes,etag:current[i].ETag,last_modified:current[i].LastModified,content_sha256:o.content_sha256})),delete_authorized:false,execution_authorized:false,production_authorized:false};
 const worm={schema_version:'geox_mcft_cap09_da9_worm_independent_readonly_recheck_v1',status:'WORM_REMOTE_READONLY_RECHECK_PASS',endpoint:d.SOURCE_ENDPOINT,bucket:d.WORM.bucket,key:d.WORM.key,version_id:d.WORM.version_id,retention_mode:'COMPLIANCE',retain_until_utc:d.WORM.retain_until_utc,remote_readback_sha256:d.WORM.archive_sha256,expected_archive_sha256:d.WORM.archive_sha256,original_receipt_recovered:false,source_deletion_authorized:false,execution_authorized:false};
 const de={inventory:pre,capture,recheck:worm,inventorySha:c.sha(JSON.stringify(pre)),captureSha:d.CAPTURE_SHA,recheckSha:d.RECHECK_SHA,wormZipSha:d.WORM.archive_sha256};
 const payload=d.buildDraft(subject,de,'fixture_source_disposition',trust,now-35000);
 Object.assign(payload,{review_status:'APPROVED',reviewer_id:who,authority_ref:'FIXTURE_EXPLICIT_ACCOUNTABLE_EXACT_TWO',reviewed_at_utc:iso(now-30000),expires_at_utc:iso(now+30000),source_deletion_authorized:true});
 const signed=d.signReviewed(payload,trust,privateKey,who,keyId,de,now-29000);
 const signedSha=c.sha(JSON.stringify(signed)),ledgerId='da9_minio_fixture_once';
 const started={schema_version:'DA9_MINIO_SOURCE_DELETE_STARTED_V1',run_id:d.RUN,subject_sha:payload.subject_sha,ledger_id:ledgerId,signed_disposition_sha256:signedSha,verified_at_utc:iso(now-29000),started_at_utc:iso(now-28000),source_bucket:d.SOURCE_BUCKET,execution_authorized:false,production_authorized:false};
 const ops=d.OBJECTS.map((o,i)=>({key:o.key,version_id:null,content_sha256:o.content_sha256,started_at_utc:iso(now-27900+i*200),finished_at_utc:iso(now-27800+i*200),exit_code:0,operation:'DELETE_EXACT_KEY'}));
 const log={schema_version:'DA9_MINIO_EXACT_DELETE_LOG_V1',run_id:d.RUN,subject_sha:payload.subject_sha,signed_disposition_sha256:signedSha,verified_at_utc:started.verified_at_utc,started_at_utc:started.started_at_utc,finished_at_utc:iso(now-27000),one_shot_ledger_id:ledgerId,one_shot_started_sha256:c.sha(JSON.stringify(started)),source_versioning_status:'UNVERSIONED',operations:ops,source_only:true,execution_authorized:false,production_authorized:false};
 const empty=at=>({schema_version:'MCFT_CAP09_DA9_MINIO_READONLY_INVENTORY_V1',run_id:d.RUN,bucket:d.SOURCE_BUCKET,endpoint:d.SOURCE_ENDPOINT,started_at:iso(at),completed_at:iso(at+100),counts:{current:0,versions:0,delete_markers:0,multipart:0,status:'EMPTY_READBACK_CANDIDATE_ONLY',test_only_admission:'HOLD',production_admission:'HOLD'},entries:{current:[],versions:[],multipart:[]}});
 const post=empty(now-26000),fresh=empty(now-1000);
 const e={signed,pre,capture,worm,started,log,post,signed_sha:signedSha,pre_sha:de.inventorySha,capture_sha:de.captureSha,worm_sha:de.recheckSha,zip_sha:de.wormZipSha,started_sha:log.one_shot_started_sha256,log_sha:c.sha(JSON.stringify(log)),post_sha:c.sha(JSON.stringify(post))};
 const closure=v.sign(e,trust,privateKey,who,keyId,iso(now-24000));
 return {now,trust,privateKey,who,keyId,e,closure,fresh,subject:payload.subject_sha,empty};
}
test('signed_exact_disposition_historical_closure_and_fresh_admission',()=>{const f=fixture();const x=v.verifyAdmission(f.closure,f.e,f.trust,f.fresh,f.subject,f.now);assert.equal(x.status,'CLOSURE_VERIFIED_FOR_DA9_ADMISSION');assert.equal(x.test_only_admission_authorized,false);assert.equal(x.production_authorized,false);});
test('reject_child_stage_without_ticket',()=>{const h=require('../runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs');assert.throws(()=>h.stageContinuationMode('TIMING_1',undefined,undefined),/DA9_CHILD_STAGE_TICKET_REQUIRED/);});
test('ticketed_child_stage_requires_explicit_allowed_stage',()=>{const h=require('../runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs');assert.equal(h.stageContinuationMode('TIMING_1','signed-ticket','previous-receipt'),true);assert.throws(()=>h.stageContinuationMode('FRAUD','signed-ticket','previous-receipt'),/DA9_CHILD_STAGE_INVALID/);});
test('signed_child_stage_may_verify_historical_closure_after_initial_300_seconds',()=>{const f=fixture();const later=f.now+3600000;const v1=v.verifyHistorical(f.closure,f.e,f.trust,later);assert.equal(v1.status,'HISTORICAL_DISPOSITION_CLOSURE_VERIFIED');assert.equal(v1.execution_authorized,false);});
test('signed_closure_persists_after_short_disposition_authorization_expires',()=>{const f=fixture();const future=f.now+3600000,readback=f.empty(future-1000);const x=v.verifyAdmission(f.closure,f.e,f.trust,readback,f.subject,future);assert.equal(x.current_four_zero,true);});
test('require_exact_two_source_keys',()=>{const f=fixture();const mutated=structuredClone(f.e);mutated.log.operations[1].key='negative/other';assert.throws(()=>v.historical(mutated,f.trust,f.now));});
test('reject_delete_effect_after_signed_authorization_expiry',()=>{const f=fixture(),after=f.now+40000;
 f.e.log.operations[1].started_at_utc=iso(after-100);f.e.log.operations[1].finished_at_utc=iso(after-20);
 f.e.log.finished_at_utc=iso(after);f.e.post.started_at=iso(after+100);
 f.e.post.completed_at=iso(after+200);
 assert.throws(()=>v.historical(f.e,f.trust,after+500),/CLOSURE_DELETE_AFTER_AUTHORIZATION_EXPIRY/);
});
test('reject_partial_delete_result',()=>{const f=fixture();f.e.log.operations[1].exit_code=1;assert.throws(()=>v.verifyAdmission(f.closure,f.e,f.trust,f.fresh,f.subject,f.now),/CLOSURE_DELETE_FAILED/);});
test('reject_missing_one_shot_receipt',()=>{const f=fixture();delete f.e.started;assert.throws(()=>v.verifyAdmission(f.closure,f.e,f.trust,f.fresh,f.subject,f.now));});
test('reject_tampered_one_shot_started_ledger',()=>{const f=fixture();f.e.started.source_bucket='other';assert.throws(()=>v.verifyAdmission(f.closure,f.e,f.trust,f.fresh,f.subject,f.now));});
test('reject_wrong_subject_on_admission',()=>{const f=fixture();assert.throws(()=>v.verifyAdmission(f.closure,f.e,f.trust,f.fresh,'b'.repeat(40),f.now),/CLOSURE_WRONG_SUBJECT/);});

test('successor_rejects_original_historic_signature_without_verified_adoption',()=>{
 const f=fixture(v.HISTORICAL_DA9_CLOSURE_SUBJECT);
 assert.throws(()=>v.verifyAdmission(f.closure,f.e,f.trust,f.fresh,'b'.repeat(40),f.now),/CLOSURE_SUCCESSOR_SIGNED_ADOPTION_REQUIRED/);
});
test('successor_rejects_plain_object_masquerading_as_signed_adoption',()=>{
 const f=fixture(v.HISTORICAL_DA9_CLOSURE_SUBJECT);
 const fake={head:'b'.repeat(40),main:'b'.repeat(40),scope:'TEST_ONLY',execution_authorized:true,
  production_authorized:false,source:'SIGNED_ADOPTION_NOT_LIVE_REMOTE_MAIN',
  qualification_expires_at:iso(f.now+86400000)};
 assert.throws(()=>v.verifyAdmission(f.closure,f.e,f.trust,f.fresh,fake.head,f.now,fake),/CLOSURE_SUCCESSOR_SIGNED_ADOPTION_REQUIRED/);
});
test('successor_rejects_arbitrary_signer_subject_even_with_lookalike_context',()=>{
 const f=fixture(),fake={head:'b'.repeat(40),main:'b'.repeat(40),scope:'TEST_ONLY'};
 assert.throws(()=>v.verifyAdmission(f.closure,f.e,f.trust,f.fresh,fake.head,f.now,fake),/CLOSURE_WRONG_SUBJECT/);
});

test('reject_post_inventory_not_four_zero',()=>{const f=fixture();f.e.post.counts.delete_markers=1;assert.throws(()=>v.verifyAdmission(f.closure,f.e,f.trust,f.fresh,f.subject,f.now));});
test('reject_new_object_after_closure',()=>{const f=fixture();f.fresh.entries.current.push({Key:'unexpected'});assert.throws(()=>v.verifyAdmission(f.closure,f.e,f.trust,f.fresh,f.subject,f.now));});
test('reject_stale_live_admission_readback',()=>{const f=fixture(),future=f.now+600000;f.fresh=f.empty(future-400000);assert.throws(()=>v.verifyAdmission(f.closure,f.e,f.trust,f.fresh,f.subject,future),/CLOSURE_ADMISSION_READBACK_STALE/);});
test('reject_unsigned_or_tampered_closure',()=>{const f=fixture();f.closure.payload.source_bucket='other';assert.throws(()=>v.verifyAdmission(f.closure,f.e,f.trust,f.fresh,f.subject,f.now));});
test('reject_modified_signature_bytes',()=>{const f=fixture();f.closure.signature.signature_base64=Buffer.alloc(64).toString('base64');assert.throws(()=>v.verifyAdmission(f.closure,f.e,f.trust,f.fresh,f.subject,f.now),/CLOSURE_BAD_SIGNATURE/);});
test('reject_worm_archive_drift',()=>{const f=fixture();f.e.zip_sha='f'.repeat(64);assert.throws(()=>v.verifyAdmission(f.closure,f.e,f.trust,f.fresh,f.subject,f.now),/CLOSURE_WORM_BYTES_CHANGED/);});
test('reject_reused_or_extra_source_probe',()=>{const f=fixture();const later={...f.e.pre,entries:{...f.e.pre.entries,current:[...f.e.pre.entries.current,{Key:'third'}]}};assert.throws(()=>executor.checkObjectSet(later,f.e.pre));});
test('reject_nonexact_inventory_empty_assertion',()=>{const f=fixture();f.fresh.counts.current=1;assert.throws(()=>v.verifyAdmission(f.closure,f.e,f.trust,f.fresh,f.subject,f.now));});
console.log(JSON.stringify({status:'PASS',checks:n,live_minio_access:false,source_deleted:false,permit_consumed:false,production_authorized:false}));
module.exports={fixture};
