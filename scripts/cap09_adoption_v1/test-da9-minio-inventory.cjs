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
check('wrong_s3_response_rejected',()=>assert.throws(()=>inv.parsePage('versions',bucket),/INVENTORY_WRONG_LIST_KIND/));
check('s3_error_rejected',()=>assert.throws(()=>inv.parsePage('current','<Error><Code>AccessDenied</Code></Error>')));
check('canonical_sigv4_query',()=>assert.equal(inv.encodeQuery({'versions':'','key-marker':'a b'}),'key-marker=a%20b&versions='));
check('signed_get_host_scope',()=>{const h=inv.signHeaders('list-type=2&max-keys=1000',{access:'EXAMPLEACCESSKEY',secret:'test-example-secret-long',region:'us-east-1'},new Date('2026-10-16T12:00:00.000Z'));assert.equal(h.host,'127.0.0.1:59005');assert.equal(h['x-amz-date'],'20261016T120000Z');assert(h.authorization.startsWith('AWS4-HMAC-SHA256 Credential=EXAMPLEACCESSKEY/20261016/us-east-1/s3/aws4_request'));});
check('incomplete_truncation_value_rejected',()=>assert.throws(()=>inv.parsePage('current','<ListBucketResult></ListBucketResult>'),/INVENTORY_TRUNCATION_UNKNOWN/));

check('xml_missing_root_close_rejected',()=>assert.throws(()=>inv.parsePage('current','<ListBucketResult><IsTruncated>false</IsTruncated>'),/INVENTORY_S3_LIST_DOCUMENT_INCOMPLETE/));
check('xml_wrong_root_close_rejected',()=>assert.throws(()=>inv.parsePage('versions','<ListVersionsResult><IsTruncated>false</IsTruncated></ListBucketResult>'),/INVENTORY_S3_LIST_DOCUMENT_INCOMPLETE/));
check('xml_doctype_rejected',()=>assert.throws(()=>inv.parsePage('current','<!DOCTYPE ListBucketResult><ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>')));
check('version_id_absent_rejected',()=>assert.throws(()=>inv.parsePage('versions','<ListVersionsResult><IsTruncated>false</IsTruncated><Version><Key>retained</Key></Version></ListVersionsResult>'),/INVENTORY_VERSION_ID_REQUIRED/));
check('upload_id_absent_rejected',()=>assert.throws(()=>inv.parsePage('multipart','<ListMultipartUploadsResult><IsTruncated>false</IsTruncated><Upload><Key>retained</Key></Upload></ListMultipartUploadsResult>'),/INVENTORY_UPLOAD_ID_REQUIRED/));
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

