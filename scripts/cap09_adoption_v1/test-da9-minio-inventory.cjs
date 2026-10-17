'use strict';
const assert=require('node:assert/strict');
const inv=require('./da9-minio-readonly-inventory.cjs');
let n=0;
function check(name,fn){fn();n++;console.log('PASS '+name);}
const bucket='<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>probe&#x2F;a</Key><Size>3</Size><ETag>"abc"</ETag><LastModified>2026-10-16T00:00:00Z</LastModified></Contents><Contents><Key>probe-b</Key><Size>5</Size></Contents></ListBucketResult>';
const versions='<ListVersionsResult><IsTruncated>false</IsTruncated><Version><Key>probe/a</Key><VersionId>01</VersionId><IsLatest>true</IsLatest></Version><DeleteMarker><Key>probe-b</Key><VersionId>02</VersionId></DeleteMarker></ListVersionsResult>';
const uploads='<ListMultipartUploadsResult><IsTruncated>false</IsTruncated><Upload><Key>probe/a</Key><UploadId>upload-xyz</UploadId></Upload></ListMultipartUploadsResult>';
check('current_parsed',()=>{const p=inv.parsePage('current',bucket);assert.equal(p.items.length,2);assert.equal(p.items[0].Key,'probe/a');assert.equal(p.truncated,false);});
check('version_delete_marker_parsed',()=>{const p=inv.parsePage('versions',versions);assert.equal(p.items.length,2);assert.equal(p.items[1].delete_marker,true);});
check('multipart_upload_parsed',()=>assert.equal(inv.parsePage('multipart',uploads).items.length,1));
check('nonempty_bucket_hold',()=>{const info=inv.classify({current:inv.parsePage('current',bucket).items,versions:inv.parsePage('versions',versions).items,multipart:inv.parsePage('multipart',uploads).items});assert.deepEqual([info.current,info.versions,info.delete_markers,info.multipart],[2,1,1,1]);assert.equal(info.status,'BUCKET_NOT_EMPTY_HOLD');});
check('zero_every_category_does_not_authorize',()=>{const r=inv.classify({current:[],versions:[],multipart:[]});assert.equal(r.status,'EMPTY_READBACK_CANDIDATE_ONLY');assert.equal(r.test_only_admission,'HOLD');});
check('incomplete_inventory_rejected',()=>assert.throws(()=>inv.classify({current:[],versions:[]}),/INVENTORY_INCOMPLETE/));
check('missing_pagination_marker_rejected',()=>assert.throws(()=>inv.parsePage('current','<ListBucketResult><IsTruncated>true</IsTruncated></ListBucketResult>'),/INVENTORY_PAGINATION_MARKER_REQUIRED/));
check('truncated_continuation_token',()=>{const p=inv.parsePage('current','<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>one&amp;two</NextContinuationToken></ListBucketResult>');assert.equal(p.next['continuation-token'],'one&two');});
check('wrong_s3_response_rejected',()=>assert.throws(()=>inv.parsePage('versions',bucket),/INVENTORY_S3_LIST_DOCUMENT_INCOMPLETE|INVENTORY_WRONG_LIST_KIND/));
check('s3_error_rejected',()=>assert.throws(()=>inv.parsePage('current','<Error><Code>AccessDenied</Code></Error>')));
check('canonical_sigv4_query',()=>assert.equal(inv.encodeQuery({'versions':'','key-marker':'a b'}),'key-marker=a%20b&versions='));
check('signed_get_host_scope',()=>{const h=inv.signHeaders('list-type=2&max-keys=1000',{access:'EXAMPLEACCESSKEY',secret:'test-example-secret-long',region:'us-east-1'},new Date('2026-10-16T12:00:00.000Z'));assert.equal(h.host,'127.0.0.1:59005');assert.equal(h['x-amz-date'],'20261016T120000Z');assert(h.authorization.startsWith('AWS4-HMAC-SHA256 Credential=EXAMPLEACCESSKEY/20261016/us-east-1/s3/aws4_request'));});
check('incomplete_truncation_value_rejected',()=>assert.throws(()=>inv.parsePage('current','<ListBucketResult></ListBucketResult>'),/INVENTORY_TRUNCATION_UNKNOWN/));

check('xml_missing_root_close_rejected',()=>assert.throws(()=>inv.parsePage('current','<ListBucketResult><IsTruncated>false</IsTruncated>'),/INVENTORY_S3_LIST_DOCUMENT_INCOMPLETE/));
check('xml_wrong_root_close_rejected',()=>assert.throws(()=>inv.parsePage('versions','<ListVersionsResult><IsTruncated>false</IsTruncated></ListBucketResult>'),/INVENTORY_S3_LIST_DOCUMENT_INCOMPLETE/));
check('xml_doctype_rejected',()=>assert.throws(()=>inv.parsePage('current','<!DOCTYPE ListBucketResult><ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>')));
check('version_id_absent_rejected',()=>assert.throws(()=>inv.parsePage('versions','<ListVersionsResult><IsTruncated>false</IsTruncated><Version><Key>retained</Key></Version></ListVersionsResult>'),/INVENTORY_VERSION_ID_REQUIRED/));
check('upload_id_absent_rejected',()=>assert.throws(()=>inv.parsePage('multipart','<ListMultipartUploadsResult><IsTruncated>false</IsTruncated><Upload><Key>retained</Key></Upload></ListMultipartUploadsResult>'),/INVENTORY_UPLOAD_ID_REQUIRED/));

const disp=require('./da9-minio-disposition-v1.cjs');
const cdisp=require('./contract.cjs');
const cryptodisp=require('node:crypto');
function dispositionFixture(){
 const now=Date.parse('2026-10-17T12:40:00.000Z'),iso=x=>new Date(x).toISOString();
 const {publicKey,privateKey}=cryptodisp.generateKeyPairSync('ed25519');
 const spki=publicKey.export({type:'spki',format:'der'}),issuerId='mcft_cap09_operator_mylr1',keyId='test_disposition_key';
 const trust={schema_version:'geox_mcft_cap09_retry_trust_v1',adopted:false,execution_enabled:false,host_id:'TEST-HOST',operator_id:issuerId,ledger_root:'X',issuers:[{issuer_id:issuerId,key_id:keyId,role:'ACCOUNTABLE_SINGLE_OPERATOR',revoked:false,not_before:iso(now-60000),not_after:iso(now+600000),public_key_pem:publicKey.export({type:'spki',format:'pem'}),spki_sha256:cdisp.sha(spki)}],real_delay_controller_adopted:false,stage_capability_adopted:false,real_provider_transport_delay_adopted:false,real_pipeline_delay_adopted:false};
 const current=disp.OBJECTS.map((o,j)=>({Key:o.key,Size:String(o.size_bytes),ETag:'"etag-'+j+'"',LastModified:'2026-10-16T01:36:04.00'+j+'Z'}));
 const versions=disp.OBJECTS.map(o=>({Key:o.key,VersionId:'null',IsLatest:'true'}));
 const inventory={schema_version:'MCFT_CAP09_DA9_MINIO_READONLY_INVENTORY_V1',run_id:disp.RUN,bucket:disp.SOURCE_BUCKET,endpoint:disp.SOURCE_ENDPOINT,started_at:iso(now-30000),completed_at:iso(now-20000),counts:{current:2,versions:2,delete_markers:0,multipart:0,status:'BUCKET_NOT_EMPTY_HOLD',test_only_admission:'HOLD',production_admission:'HOLD'},entries:{current,versions,multipart:[]},note:'fixture'};
 const capture={schema_version:'DA9_PROBE_CAPTURE_MANIFEST_V1',run_id:disp.RUN,bucket:disp.SOURCE_BUCKET,objects:disp.OBJECTS.map((o,j)=>({key:o.key,version_id:'null',is_latest:'true',size:o.size_bytes,etag:current[j].ETag,last_modified:current[j].LastModified,content_sha256:o.content_sha256,captured_file:'fixture'})),delete_authorized:false,execution_authorized:false,production_authorized:false};
 const recheck={schema_version:'geox_mcft_cap09_da9_worm_independent_readonly_recheck_v1',status:'WORM_REMOTE_READONLY_RECHECK_PASS',checked_at_utc:iso(now-60000),endpoint:disp.SOURCE_ENDPOINT,bucket:disp.WORM.bucket,key:disp.WORM.key,version_id:disp.WORM.version_id,retention_mode:disp.WORM.retention_mode,retain_until_utc:disp.WORM.retain_until_utc,content_length:1456,remote_readback_sha256:disp.WORM.archive_sha256,expected_archive_sha256:disp.WORM.archive_sha256,original_receipt_recovered:false,source_deletion_authorized:false,execution_authorized:false};
 const evidence={inventory,capture,recheck,wormZipSha:disp.WORM.archive_sha256,inventorySha:'a'.repeat(64),captureSha:disp.CAPTURE_SHA,recheckSha:disp.RECHECK_SHA};
 const draft=disp.buildDraft('f'.repeat(40),evidence,'da9_disposition_test',trust,now),reviewed=structuredClone(draft);
 reviewed.review_status='APPROVED';reviewed.reviewer_id=issuerId;reviewed.authority_ref='TEST_ONLY_EXACT_TWO_PROBE_OWNER_REVIEW';reviewed.reviewed_at_utc=iso(now-1000);reviewed.expires_at_utc=iso(now+120000);reviewed.source_deletion_authorized=true;
 return {now,trust,privateKey,issuerId,keyId,evidence,reviewed};
}
check('disposition_signed_exact_two_probe_positive',()=>{const f=dispositionFixture(),env=disp.signReviewed(f.reviewed,f.trust,f.privateKey,f.issuerId,f.keyId,f.evidence,f.now);const r=disp.verifySigned(env,f.trust,f.evidence,f.now);assert.equal(r.status,'VERIFIED_EXACT_SOURCE_DELETION_AUTHORITY');assert.equal(r.source_deletion_authorized,true);assert.equal(r.execution_authorized,false);});
check('disposition_third_object_rejected',()=>{const f=dispositionFixture();f.evidence.inventory.entries.current.push({Key:'other',Size:'1',ETag:'"x"',LastModified:'2026-10-16T01:36:04.999Z'});assert.throws(()=>disp.validateReviewed(f.reviewed,f.trust,f.evidence,f.now),/EXACT_TWO_OBJECTS_REQUIRED|SOURCE_INVENTORY_NOT_EXACT_TWO/);});
check('disposition_probe_hash_drift_rejected',()=>{const f=dispositionFixture();f.evidence.capture.objects[0].content_sha256='0'.repeat(64);assert.throws(()=>disp.validateReviewed(f.reviewed,f.trust,f.evidence,f.now),/CAPTURE_HASH_CHANGED/);});
check('disposition_worm_drift_rejected',()=>{const f=dispositionFixture();f.evidence.wormZipSha='0'.repeat(64);assert.throws(()=>disp.validateReviewed(f.reviewed,f.trust,f.evidence,f.now),/WORM_ARCHIVE_CHANGED/);});
check('disposition_stale_inventory_rejected',()=>{const f=dispositionFixture();f.evidence.inventory.started_at=new Date(f.now-301000).toISOString();assert.throws(()=>disp.validateReviewed(f.reviewed,f.trust,f.evidence,f.now),/SOURCE_INVENTORY_STALE_OR_FUTURE/);});
check('disposition_unsigned_review_rejected',()=>{const f=dispositionFixture();f.reviewed.review_status='REVIEW_REQUIRED';assert.throws(()=>disp.signReviewed(f.reviewed,f.trust,f.privateKey,f.issuerId,f.keyId,f.evidence,f.now),/DISPOSITION_REVIEW_NOT_APPROVED/);});
check('disposition_production_authority_rejected',()=>{const f=dispositionFixture();f.reviewed.production_authorized=true;assert.throws(()=>disp.signReviewed(f.reviewed,f.trust,f.privateKey,f.issuerId,f.keyId,f.evidence,f.now),/PRODUCTION_AUTHORITY_FORBIDDEN/);});
check('disposition_wrong_signer_rejected',()=>{const f=dispositionFixture();assert.throws(()=>disp.signReviewed(f.reviewed,f.trust,f.privateKey,'other_operator',f.keyId,f.evidence,f.now),/DISPOSITION_REVIEWER_SIGNER_MISMATCH/);});
check('disposition_signature_tamper_rejected',()=>{const f=dispositionFixture(),env=disp.signReviewed(f.reviewed,f.trust,f.privateKey,f.issuerId,f.keyId,f.evidence,f.now);env.payload.authority_ref+='x';assert.throws(()=>disp.verifySigned(env,f.trust,f.evidence,f.now),/DISPOSITION_SIGNATURE_INVALID/);});

async function asynchronousAcceptance(){
 const xmlEmpty={
  current:'<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>',
  versions:'<ListVersionsResult><IsTruncated>false</IsTruncated></ListVersionsResult>',
  multipart:'<ListMultipartUploadsResult><IsTruncated>false</IsTruncated></ListMultipartUploadsResult>'
 };
 const calls=[];
 const empty=await inv.snapshot({},async(q)=>{
  calls.push(q);return q.includes('list-type=2')?xmlEmpty.current:q.includes('versions=')?xmlEmpty.versions:xmlEmpty.multipart;
 });
 assert.equal(calls.length,3);assert.equal(empty.counts.status,'EMPTY_READBACK_CANDIDATE_ONLY');assert.equal(empty.counts.test_only_admission,'HOLD');
 console.log('PASS complete_three_list_empty_readback_not_authority');n++;
 const pages=[];
 const result=await inv.snapshot({},async(q)=>{
  pages.push(q);
  if(q.includes('list-type=2'))return q.includes('continuation-token=PAGE2')
   ?'<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>probeB</Key></Contents></ListBucketResult>'
   :'<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>PAGE2</NextContinuationToken><Contents><Key>probeA</Key></Contents></ListBucketResult>';
  return q.includes('versions=')?xmlEmpty.versions:xmlEmpty.multipart;
 });
 assert.equal(result.counts.current,2);assert.equal(result.counts.status,'BUCKET_NOT_EMPTY_HOLD');assert.equal(pages.length,4);
 console.log('PASS full_paginated_list_detects_objects');n++;
 await assert.rejects(()=>inv.snapshot({},async q=>q.includes('list-type=2')
   ?'<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>LOOP</NextContinuationToken></ListBucketResult>'
   :(q.includes('versions=')?xmlEmpty.versions:xmlEmpty.multipart)),/INVENTORY_PAGINATION_LOOP/);
 console.log('PASS pagination_loop_rejected');n++;
 await assert.rejects(()=>inv.snapshot({},async()=>{throw Error('INVENTORY_HTTP_403');}),/INVENTORY_HTTP_403/);
 console.log('PASS denied_bucket_inventory_rejected');n++;
 console.log(JSON.stringify({status:'PASS',checks:n,live_bucket_access:false,permit_consumed:false,execution_authorized:false}));
}
asynchronousAcceptance().catch(e=>{console.error(e);process.exitCode=1;});

