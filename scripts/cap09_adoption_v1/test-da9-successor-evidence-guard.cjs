'use strict';
// Pure fixtures only. No network, MinIO, Postgres, signer, deletion, or Permit.
const assert=require('node:assert/strict');
const g=require('./da9-successor-evidence-guard.cjs');
let n=0;
function test(label,fn){fn();n++;console.log('PASS '+label);}
function reject(label,obj,field,value,fn){const changed=structuredClone(obj); if(field)changed[field]=value;test(label,()=>assert.throws(()=>fn(changed)));}
const inventory={
 schema_version:'MCFT_CAP09_DA9_MINIO_READONLY_INVENTORY_V1',run_id:g.RUN,
 bucket:'mcft-cap09-requal-'+g.RUN,endpoint:g.WORM.endpoint,
 started_at:'2026-10-17T05:08:28.000Z',completed_at:'2026-10-17T05:08:29.000Z',
 counts:{current:2,versions:2,delete_markers:0,multipart:0,status:'BUCKET_NOT_EMPTY_HOLD'},
 entries:{
 current:g.KEYS.map((Key,i)=>({Key,Size:'27',ETag:'"fixture-'+i+'"'})),
 versions:g.KEYS.map(Key=>({Key,VersionId:'null',IsLatest:'true'})),multipart:[]
 }
};
test('exact_two_probe_source_inventory_is_still_HOLD',()=>{
 const r=g.checkInventory(inventory);assert.equal(r.source_deletion_authorized,false);
 assert.equal(r.source_keys.length,2);
});
reject('unexpected_current_object_refused',inventory,'entries',{...inventory.entries,current:[...inventory.entries.current,{Key:'extra'}]},g.checkInventory);
reject('missing_history_version_refused',inventory,'entries',{...inventory.entries,versions:[inventory.entries.versions[0]]},g.checkInventory);
reject('null_JSON_not_literal_null_refused',inventory,'entries',{...inventory.entries,versions:inventory.entries.versions.map(x=>({...x,VersionId:null}))},g.checkInventory);
reject('source_objects_not_empty_refused',inventory,'counts',{...inventory.counts,status:'EMPTY_READBACK_CANDIDATE_ONLY'},g.checkInventory);
reject('added_multipart_refused',inventory,'entries',{...inventory.entries,multipart:[{Key:'x',UploadId:'u'}]},g.checkInventory);
reject('wrong_source_run_refused',inventory,'run_id','73b04afb4249',g.checkInventory);
reject('wrong_source_bucket_refused',inventory,'bucket',g.WORM.bucket,g.checkInventory);
reject('new_unexpected_source_key_refused',inventory,'entries',{...inventory.entries,current:inventory.entries.current.map((x,i)=>i?{...x,Key:'other-key'}:x)},g.checkInventory);
const subject={
 run_id:g.RUN,subject_sha:g.SUBJECT,protected_main_sha:g.SUBJECT,
 runtime_subject_sha:g.SUBJECT,host_subject_sha:g.SUBJECT,
 adoption_subject_sha:g.SUBJECT,retry_review_subject_sha:g.SUBJECT,
 retry_review_signature_verified:true,adoption_signature_verified:true,
 installed_host_verifier_bytes_verified:true,
 adoption_expires_at:'2026-10-18T18:00:00.000Z',
 fresh_readback:{bucket_empty_including_versions_multipart:true,all_rows_zero:true,scoped_acl_verified:true},
 provider_causal_visibility:true,measured_budget_ms:60000,stages_total_ms:59000
};
const now=Date.parse('2026-10-17T06:00:00.000Z');
test('positive_shape_never_executes',()=>{const x=g.successorGate(subject,now);assert.equal(x.execution_authorized,false);assert.equal(x.permit_issued,false);});
for(const field of ['subject_sha','protected_main_sha','runtime_subject_sha','host_subject_sha','adoption_subject_sha','retry_review_subject_sha'])
 reject('old_subject_replay_'+field,subject,field,g.OLD_SUBJECT,x=>g.successorGate(x,now));
reject('false_review_signature_rejected',subject,'retry_review_signature_verified',false,x=>g.successorGate(x,now));
reject('false_adoption_signature_rejected',subject,'adoption_signature_verified',false,x=>g.successorGate(x,now));
reject('host_verifier_not_proven_rejected',subject,'installed_host_verifier_bytes_verified',false,x=>g.successorGate(x,now));
reject('expired_adoption_rejected',subject,'adoption_expires_at','2026-10-17T05:59:59.999Z',x=>g.successorGate(x,now));
reject('nonempty_source_bucket_rejected',subject,'fresh_readback',{...subject.fresh_readback,bucket_empty_including_versions_multipart:false},x=>g.successorGate(x,now));
reject('db_rows_nonzero_rejected',subject,'fresh_readback',{...subject.fresh_readback,all_rows_zero:false},x=>g.successorGate(x,now));
reject('scoped_acl_missing_rejected',subject,'fresh_readback',{...subject.fresh_readback,scoped_acl_verified:false},x=>g.successorGate(x,now));
reject('provider_causality_missing_rejected',subject,'provider_causal_visibility',false,x=>g.successorGate(x,now));
reject('budget_insufficient_rejected',subject,'stages_total_ms',60001,x=>g.successorGate(x,now));
const worm={
 schema_version:'geox_mcft_cap09_da9_worm_independent_readonly_recheck_v1',
 status:'WORM_REMOTE_READONLY_RECHECK_PASS',
 ...g.WORM,
 retention_mode:'COMPLIANCE',retain_until_utc:g.WORM.retain_until,
 remote_readback_sha256:g.ZIP_SHA,expected_archive_sha256:g.ZIP_SHA,
 original_receipt_recovered:false,source_deletion_authorized:false,execution_authorized:false,
 content_length:1456,checked_at_utc:'2026-10-17T06:00:00Z'
};
test('wrong_bytes_cannot_pass_even_if_receipt_claims_PASS',()=>assert.throws(()=>g.checkWorm(worm,Buffer.alloc(1456),now),/WORM_LOCAL_ARCHIVE_CHANGED/));
reject('historical_custody_prefix_wrong',worm,'key','custody/'+g.WORM.bucket+'/'+g.WORM.key,x=>g.checkWorm(x,Buffer.alloc(1456),now));
reject('wrong_version_not_transferable',worm,'version_id','null',x=>g.checkWorm(x,Buffer.alloc(1456),now));
reject('wrong_retention_mode_refused',worm,'retention_mode','GOVERNANCE',x=>g.checkWorm(x,Buffer.alloc(1456),now));
reject('false_remote_digest_refused',worm,'remote_readback_sha256','0'.repeat(64),x=>g.checkWorm(x,Buffer.alloc(1456),now));
reject('no_source_delete_flag_allowed',worm,'source_deletion_authorized',true,x=>g.checkWorm(x,Buffer.alloc(1456),now));
reject('original_receipt_cannot_be_recreated',worm,'original_receipt_recovered',true,x=>g.checkWorm(x,Buffer.alloc(1456),now));
console.log(JSON.stringify({status:'PASS',checks:n,fixture_only:true,remote_WORM_requeried:false,permit_issued:false,deletion_performed:false,execution_authorized:false}));
