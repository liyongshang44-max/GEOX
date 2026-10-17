'use strict';
// DA9 candidate evidence guard: offline, read-only, no approval, no private keys.
// This module cannot create a deletion permit, retry decision or run admission.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');

const RUN='da9db7129607';
const SUBJECT='61ceb797721cbbe9d6a949832afd92910c351a00';
const OLD_SUBJECT='91835fa0997730c85c5f3869dd530f4c9a3ca82d';
const ZIP_SHA='6dbb1ffe417174dfc45450e695d0fd28cd2eacce0b85523a7a6c71d5f44ee62e';
const WORM={
 endpoint:'http://127.0.0.1:59005',
 bucket:'mcft-cap09-da9-evidence-worm-v1',
 key:'MCFT-CAP09-DA9-PROBE-EVIDENCE-20261016T170707Z.zip',
 version_id:'f7dda227-652e-4dc7-ab97-c9d70874731d',
 retain_until:'2027-10-16T17:29:54.041Z'
};
const SOURCE_BUCKET='mcft-cap09-requal-'+RUN;
const KEYS=[
 'negative/qualification/iam-probe-da9db7129607-v1.txt',
 'positive/qualification/iam-probe-da9db7129607-v1.txt'
];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function exactKeys(o,keys) {assert(o&&typeof o==='object'&&!Array.isArray(o),'OBJECT_REQUIRED');assert.deepEqual(Object.keys(o).sort(),keys.slice().sort(),'EXACT_KEYS_REQUIRED');}
function checkInventory(r) {
 assert.equal(r.schema_version,'MCFT_CAP09_DA9_MINIO_READONLY_INVENTORY_V1','SOURCE_INVENTORY_SCHEMA');
 assert.equal(r.run_id,RUN,'SOURCE_RUN_MISMATCH');
 assert.equal(r.bucket,SOURCE_BUCKET,'SOURCE_BUCKET_MISMATCH');
 assert.equal(r.endpoint,WORM.endpoint,'SOURCE_ENDPOINT_MISMATCH');
 assert(Number.isFinite(Date.parse(r.started_at))&&Number.isFinite(Date.parse(r.completed_at)),'INVENTORY_TIMESTAMPS_INVALID');
 assert(Date.parse(r.started_at)<=Date.parse(r.completed_at),'INVENTORY_TIMESTAMPS_REVERSED');
 const e=r.entries;exactKeys(e,['current','versions','multipart']);
 assert(Array.isArray(e.current)&&Array.isArray(e.versions)&&Array.isArray(e.multipart),'INVENTORY_ARRAYS_REQUIRED');
 assert.equal(e.current.length,2,'SOURCE_EXACTLY_TWO_CURRENT_REQUIRED');
 assert.equal(e.versions.length,2,'SOURCE_EXACTLY_TWO_VERSIONS_REQUIRED');
 assert.equal(e.multipart.length,0,'SOURCE_MULTIPART_PENDING');
 assert.deepEqual(e.current.map(x=>x.Key).sort(),KEYS,'SOURCE_KEY_MISMATCH');
 assert.deepEqual(e.versions.map(x=>x.Key).sort(),KEYS,'SOURCE_VERSION_KEY_MISMATCH');
 for(const current of e.current) {
  assert.equal(String(current.Size),'27','SOURCE_SIZE_MISMATCH');
  assert(typeof current.ETag==='string'&&current.ETag.length>0,'SOURCE_ETAG_REQUIRED');
 }
 for(const v of e.versions) {
  assert.equal(v.VersionId,'null','SOURCE_LITERAL_NULL_VERSION_REQUIRED');
  assert.equal(v.IsLatest,'true','SOURCE_NOT_LATEST');
  assert.notEqual(v.delete_marker,true,'SOURCE_DELETE_MARKER_FORBIDDEN');
 }
 assert.equal(r.counts?.current,2,'SOURCE_COUNT_MISMATCH');
 assert.equal(r.counts?.versions,2,'SOURCE_VERSION_COUNT_MISMATCH');
 assert.equal(r.counts?.delete_markers,0,'SOURCE_DELETE_MARKERS_PENDING');
 assert.equal(r.counts?.multipart,0,'SOURCE_MULTIPART_COUNT_MISMATCH');
 assert.equal(r.counts?.status,'BUCKET_NOT_EMPTY_HOLD','NONEMPTY_HOLD_REQUIRED');
 return {status:'SOURCE_PROBE_INVENTORY_SHAPE_VERIFIED_ONLY',run_id:RUN,
  source_keys:KEYS.map(key=>({key,version_id:'null'})),source_deletion_authorized:false};
}
function checkWorm(r,archiveBytes,now=Date.now()) {
 assert.equal(r.schema_version,'geox_mcft_cap09_da9_worm_independent_readonly_recheck_v1','WORM_RECEIPT_SCHEMA');
 assert.equal(r.status,'WORM_REMOTE_READONLY_RECHECK_PASS','WORM_RECEIPT_NOT_PASS');
 for(const k of ['endpoint','bucket','key','version_id'])assert.equal(r[k],WORM[k],'WORM_LOCATOR_MISMATCH:'+k);
 assert.equal(r.retention_mode,'COMPLIANCE','WORM_RETENTION_MODE_REQUIRED');
 assert.equal(r.remote_readback_sha256,ZIP_SHA,'WORM_REMOTE_HASH_MISMATCH');
 assert.equal(r.expected_archive_sha256,ZIP_SHA,'WORM_EXPECTED_HASH_MISMATCH');
 assert.equal(r.original_receipt_recovered,false,'ORIGINAL_RECEIPT_PROVENANCE_MISMATCH');
 assert.equal(r.source_deletion_authorized,false,'SOURCE_DELETE_FLAG_FORBIDDEN');
 assert.equal(r.execution_authorized,false,'EXECUTION_FLAG_FORBIDDEN');
 assert.equal(r.content_length,archiveBytes.length,'WORM_LENGTH_MISMATCH');
 assert.equal(sha(archiveBytes),ZIP_SHA,'WORM_LOCAL_ARCHIVE_CHANGED');
 assert(Number.isFinite(Date.parse(r.retain_until_utc))&&Date.parse(r.retain_until_utc)>now,'WORM_RETENTION_EXPIRED');
 assert.equal(Date.parse(r.retain_until_utc),Date.parse(WORM.retain_until),'WORM_RETENTION_BOUNDARY_CHANGED');
 assert(Number.isFinite(Date.parse(r.checked_at_utc)),'WORM_CHECK_TIME_REQUIRED');
 return {status:'WORM_LOCAL_RECEIPT_CORROBORATED_NOT_REMOTE_REQUERY',
  version_id:WORM.version_id,archive_sha256:ZIP_SHA,source_deletion_authorized:false};
}
function successorGate(input,now=Date.now()) {
 assert(input&&typeof input==='object','SUCCESSOR_INPUT_REQUIRED');
 assert.equal(input.subject_sha,SUBJECT,'NEW_SUBJECT_REQUIRED');
 assert.notEqual(input.subject_sha,OLD_SUBJECT,'OLD_SUBJECT_FORBIDDEN');
 assert.equal(input.run_id,RUN,'EXACT_RUN_REQUIRED');
 assert.equal(input.protected_main_sha,SUBJECT,'MAIN_SHA_MISMATCH');
 assert.equal(input.runtime_subject_sha,SUBJECT,'INSTALLED_RUNTIME_SUBJECT_MISMATCH');
 assert.equal(input.host_subject_sha,SUBJECT,'HOST_SUBJECT_MISMATCH');
 assert.equal(input.adoption_subject_sha,SUBJECT,'ADOPTION_SUBJECT_MISMATCH');
 assert.equal(input.retry_review_subject_sha,SUBJECT,'RETRY_REVIEW_SUBJECT_MISMATCH');
 assert.equal(input.retry_review_signature_verified,true,'RETRY_REVIEW_SIGNATURE_REQUIRED');
 assert.equal(input.adoption_signature_verified,true,'ADOPTION_SIGNATURE_REQUIRED');
 assert.equal(input.installed_host_verifier_bytes_verified,true,'ACTUAL_HOST_VERIFIER_NOT_VERIFIED');
 assert(Number.isFinite(Date.parse(input.adoption_expires_at))&&Date.parse(input.adoption_expires_at)>now,'ADOPTION_EXPIRED');
 assert.equal(input.fresh_readback?.bucket_empty_including_versions_multipart,true,'NONEMPTY_BUCKET_HOLD');
 assert.equal(input.fresh_readback?.all_rows_zero,true,'DATABASE_NOT_EMPTY_HOLD');
 assert.equal(input.fresh_readback?.scoped_acl_verified,true,'SCOPED_ACL_HOLD');
 assert.equal(input.provider_causal_visibility,true,'PROVIDER_CAUSAL_VISIBILITY_HOLD');
 assert(Number.isSafeInteger(input.measured_budget_ms)&&input.measured_budget_ms>0,'MEASURED_BUDGET_REQUIRED');
 assert(Number.isSafeInteger(input.stages_total_ms)&&input.stages_total_ms>0&&input.stages_total_ms<=input.measured_budget_ms,'BUDGET_INSUFFICIENT');
 // Deliberately does not validate Ed25519 itself or allow any execute/admit outcome.
 return {status:'SUCCESSOR_EVIDENCE_SHAPE_ONLY_NOT_CRYPTOGRAPHIC_ADMISSION',
   run_id:RUN,subject_sha:SUBJECT,permit_issued:false,execution_authorized:false,source_deletion_authorized:false};
}
function readJson(file){assert(path.isAbsolute(file),'ABSOLUTE_PATH_REQUIRED');return JSON.parse(fs.readFileSync(file,'utf8'));}
function offlineReview({wormReceiptFile,archiveFile,inventoryFile}) {
 for(const p of [wormReceiptFile,archiveFile,inventoryFile])assert(path.isAbsolute(p),'ABSOLUTE_PATH_REQUIRED');
 const worm=readJson(wormReceiptFile),source=readJson(inventoryFile);
 const archiveBytes=fs.readFileSync(archiveFile);
 return {worm:checkWorm(worm,archiveBytes),inventory:checkInventory(source),
  status:'EVIDENCE_REVIEWED_ONLY_DISPOSITION_HOLD',source_deletion_authorized:false,
  retry_authorized:false,execution_authorized:false};
}
module.exports={RUN,SUBJECT,OLD_SUBJECT,WORM,KEYS,ZIP_SHA,sha,checkWorm,checkInventory,successorGate,offlineReview};
if(require.main===module){
 try {
  assert.equal(process.argv.length,5,'THREE_INPUT_PATHS_REQUIRED');
  const result=offlineReview({wormReceiptFile:process.argv[2],archiveFile:process.argv[3],inventoryFile:process.argv[4]});
  console.log(JSON.stringify(result,null,2));
 } catch(e) {
  console.error(JSON.stringify({status:'EVIDENCE_HOLD',code:e.message,source_deletion_authorized:false,execution_authorized:false}));
  process.exitCode=1;
 }
}
