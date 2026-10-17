'use strict';
// Offline, exact-two-object DA9 MinIO source-disposition signer/verifier.
// No network, subprocess, MinIO mutation, Permit issuance, Runtime or Production authority.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const c=require('./contract.cjs');

const RUN='da9db7129607';
const SOURCE_ENDPOINT='http://127.0.0.1:59005';
const SOURCE_BUCKET='mcft-cap09-requal-da9db7129607';
const DOMAIN='GEOX_MCFT_CAP09_DA9_MINIO_EVIDENCE_DISPOSITION_V1\n';
const TRUST_PATH=path.resolve(__dirname,'../runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json');
const MAX_FRESH_MS=300000;
const CAPTURE_SHA='8bbbd5685780e01efa94e20ecf523fc1b882bc843c0c6ab62719198179cc1a9b';
const RECHECK_SHA='6a26a91fe10d0a67bcbdf0509261101dfeae3c7bbef22292f6d3f43b85694d81';
const WORM=Object.freeze({
 bucket:'mcft-cap09-da9-evidence-worm-v1',
 key:'MCFT-CAP09-DA9-PROBE-EVIDENCE-20261016T170707Z.zip',
 version_id:'f7dda227-652e-4dc7-ab97-c9d70874731d',
 archive_sha256:'6dbb1ffe417174dfc45450e695d0fd28cd2eacce0b85523a7a6c71d5f44ee62e',
 retention_mode:'COMPLIANCE',
 retain_until_utc:'2027-10-16T17:29:54.041Z'
});
const OBJECTS=Object.freeze([
 Object.freeze({key:'negative/qualification/iam-probe-da9db7129607-v1.txt',size_bytes:27,content_sha256:'9644be2c235939884b2d12dace3c455ea26f6e4ab78fb8f9316da33bf3671a95',archive_entry_name:'negative-probe.bin'}),
 Object.freeze({key:'positive/qualification/iam-probe-da9db7129607-v1.txt',size_bytes:27,content_sha256:'96b91f40a611b726561cff9e81a7ea60bb8cbc363f75f9e60aad6598ac53a7d8',archive_entry_name:'positive-probe.bin'})
]);

function fileSha(file){
 c.noLinks(file);const s=fs.statSync(file);assert(s.isFile()&&s.size<=32*1024*1024,'EVIDENCE_FILE_INVALID');
 return c.sha(fs.readFileSync(file));
}
function exactObjectSet(rows){
 assert(Array.isArray(rows)&&rows.length===2,'EXACT_TWO_OBJECTS_REQUIRED');
 const keys=rows.map(x=>x.key??x.Key).sort();
 assert.deepEqual(keys,OBJECTS.map(x=>x.key).sort(),'SOURCE_OBJECT_SET_CHANGED');
}
function validateEvidence(e,now=Date.now()){
 assert(e&&e.inventory&&e.capture&&e.recheck,'DISPOSITION_EVIDENCE_REQUIRED');
 for(const h of ['inventorySha','captureSha','recheckSha','wormZipSha'])c.hash(e[h]);
 assert.equal(e.captureSha,CAPTURE_SHA,'CAPTURE_MANIFEST_CHANGED');
 assert.equal(e.recheckSha,RECHECK_SHA,'WORM_RECHECK_CHANGED');
 assert.equal(e.wormZipSha,WORM.archive_sha256,'WORM_ARCHIVE_CHANGED');

 const i=e.inventory;
 assert.equal(i.schema_version,'MCFT_CAP09_DA9_MINIO_READONLY_INVENTORY_V1');
 assert.equal(i.run_id,RUN);assert.equal(i.bucket,SOURCE_BUCKET);assert.equal(i.endpoint,SOURCE_ENDPOINT);
 c.exact(i.counts,['current','versions','delete_markers','multipart','status','test_only_admission','production_admission']);
 assert.deepEqual([i.counts.current,i.counts.versions,i.counts.delete_markers,i.counts.multipart],[2,2,0,0],'SOURCE_INVENTORY_NOT_EXACT_TWO');
 assert.equal(i.counts.status,'BUCKET_NOT_EMPTY_HOLD');assert.equal(i.counts.test_only_admission,'HOLD');assert.equal(i.counts.production_admission,'HOLD');
 assert(i.entries&&Array.isArray(i.entries.current)&&Array.isArray(i.entries.versions)&&Array.isArray(i.entries.multipart),'SOURCE_INVENTORY_ENTRIES_REQUIRED');
 assert.equal(i.entries.multipart.length,0,'SOURCE_MULTIPART_PRESENT');
 exactObjectSet(i.entries.current);exactObjectSet(i.entries.versions);
 const started=c.epoch(i.started_at),completed=c.epoch(i.completed_at);
 assert(started<=completed&&completed<=now&&now-started<=MAX_FRESH_MS,'SOURCE_INVENTORY_STALE_OR_FUTURE');

 const cap=e.capture;
 assert.equal(cap.schema_version,'DA9_PROBE_CAPTURE_MANIFEST_V1');assert.equal(cap.run_id,RUN);assert.equal(cap.bucket,SOURCE_BUCKET);
 assert.equal(cap.delete_authorized,false,'CAPTURE_ALREADY_DELETE_AUTHORIZED');assert.equal(cap.execution_authorized,false);assert.equal(cap.production_authorized,false);
 exactObjectSet(cap.objects);

 const sourceRows=[];
 for(const expected of OBJECTS){
  const current=i.entries.current.find(x=>x.Key===expected.key),version=i.entries.versions.find(x=>x.Key===expected.key),captured=cap.objects.find(x=>x.key===expected.key);
  assert(current&&version&&captured,'EXACT_PROBE_EVIDENCE_MISSING');
  assert.equal(Number(current.Size),expected.size_bytes,'SOURCE_SIZE_CHANGED:'+expected.key);
  assert.equal(version.VersionId,'null','SOURCE_VERSION_NOT_LITERAL_NULL:'+expected.key);
  assert.equal(version.IsLatest,'true','SOURCE_VERSION_NOT_LATEST:'+expected.key);
  assert.equal(Boolean(version.delete_marker),false,'SOURCE_DELETE_MARKER_PRESENT:'+expected.key);
  assert.equal(String(captured.version_id),'null','CAPTURE_VERSION_CHANGED:'+expected.key);
  assert.equal(Number(captured.size),expected.size_bytes,'CAPTURE_SIZE_CHANGED:'+expected.key);
  assert.equal(captured.content_sha256,expected.content_sha256,'CAPTURE_HASH_CHANGED:'+expected.key);
  assert.equal(captured.etag,current.ETag,'SOURCE_ETAG_CHANGED:'+expected.key);
  assert.equal(captured.last_modified,current.LastModified,'SOURCE_LAST_MODIFIED_CHANGED:'+expected.key);
  sourceRows.push({key:expected.key,version_id_literal:'null',size_bytes:expected.size_bytes,etag:current.ETag,last_modified:current.LastModified,source_payload_sha256:expected.content_sha256,archive_entry_name:expected.archive_entry_name,archive_payload_sha256:expected.content_sha256});
 }

 const r=e.recheck;
 assert.equal(r.schema_version,'geox_mcft_cap09_da9_worm_independent_readonly_recheck_v1');
 assert.equal(r.status,'WORM_REMOTE_READONLY_RECHECK_PASS');assert.equal(r.endpoint,SOURCE_ENDPOINT);
 assert.equal(r.bucket,WORM.bucket);assert.equal(r.key,WORM.key);assert.equal(r.version_id,WORM.version_id);
 assert.equal(r.retention_mode,WORM.retention_mode);assert.equal(Date.parse(r.retain_until_utc),Date.parse(WORM.retain_until_utc));
 assert.equal(r.remote_readback_sha256,WORM.archive_sha256);assert.equal(r.expected_archive_sha256,WORM.archive_sha256);
 assert.equal(r.original_receipt_recovered,false);assert.equal(r.source_deletion_authorized,false);assert.equal(r.execution_authorized,false);
 assert(Date.parse(r.retain_until_utc)>now,'WORM_RETENTION_EXPIRED');
 return {inventory_started_at:i.started_at,inventory_completed_at:i.completed_at,sourceRows};
}
function buildDraft(subject,evidence,dispositionId,trust,now=Date.now()){
 assert(/^[a-f0-9]{40}$/.test(subject),'SUBJECT_INVALID');c.id(dispositionId);
 const v=validateEvidence(evidence,now);
 return {
  schema_version:'DA9_MINIO_EVIDENCE_DISPOSITION_V1',disposition_id:dispositionId,run_id:RUN,subject_sha:subject,scope:'TEST_ONLY',
  source:{endpoint:SOURCE_ENDPOINT,bucket:SOURCE_BUCKET,versioning_status:'UNVERSIONED',inventory_receipt_sha256:evidence.inventorySha,inventory_started_at:v.inventory_started_at,inventory_completed_at:v.inventory_completed_at,objects:v.sourceRows},
  preservation:{capture_manifest_sha256:CAPTURE_SHA,worm_readonly_recheck_sha256:RECHECK_SHA,worm_bucket:WORM.bucket,worm_key:WORM.key,worm_version_id:WORM.version_id,worm_archive_sha256:WORM.archive_sha256,worm_retention_mode:WORM.retention_mode,worm_retain_until_utc:WORM.retain_until_utc},
  action:'DELETE_EXACT_TWO_PRESERVED_SOURCE_PROBES_ONLY',any_other_object_forbidden:true,bucket_deletion_forbidden:true,policy_mutation_forbidden:true,database_mutation_forbidden:true,runtime_mutation_forbidden:true,
  required_postcondition:{current:0,versions:0,delete_markers:0,multipart:0,official_inventory_required:true},
  trust_digest:c.digest(trust),review_status:'REVIEW_REQUIRED',reviewer_id:null,authority_ref:null,reviewed_at_utc:null,expires_at_utc:null,
  source_deletion_authorized:false,execution_authorized:false,production_authorized:false
 };
}
function validateReviewed(p,trust,evidence,now=Date.now()){
 c.exact(p,['schema_version','disposition_id','run_id','subject_sha','scope','source','preservation','action','any_other_object_forbidden','bucket_deletion_forbidden','policy_mutation_forbidden','database_mutation_forbidden','runtime_mutation_forbidden','required_postcondition','trust_digest','review_status','reviewer_id','authority_ref','reviewed_at_utc','expires_at_utc','source_deletion_authorized','execution_authorized','production_authorized']);
 assert.equal(p.schema_version,'DA9_MINIO_EVIDENCE_DISPOSITION_V1');c.id(p.disposition_id);assert.equal(p.run_id,RUN);
 assert(/^[a-f0-9]{40}$/.test(p.subject_sha),'SUBJECT_INVALID');assert.equal(p.scope,'TEST_ONLY');
 const v=validateEvidence(evidence,now);
 c.exact(p.source,['endpoint','bucket','versioning_status','inventory_receipt_sha256','inventory_started_at','inventory_completed_at','objects']);
 assert.equal(p.source.endpoint,SOURCE_ENDPOINT);assert.equal(p.source.bucket,SOURCE_BUCKET);assert.equal(p.source.versioning_status,'UNVERSIONED');
 assert.equal(p.source.inventory_receipt_sha256,evidence.inventorySha,'SIGNED_INVENTORY_DIGEST_MISMATCH');
 assert.equal(p.source.inventory_started_at,v.inventory_started_at);assert.equal(p.source.inventory_completed_at,v.inventory_completed_at);
 assert.deepEqual(p.source.objects,v.sourceRows,'SIGNED_SOURCE_OBJECTS_MISMATCH');
 c.exact(p.preservation,['capture_manifest_sha256','worm_readonly_recheck_sha256','worm_bucket','worm_key','worm_version_id','worm_archive_sha256','worm_retention_mode','worm_retain_until_utc']);
 assert.deepEqual(p.preservation,{capture_manifest_sha256:CAPTURE_SHA,worm_readonly_recheck_sha256:RECHECK_SHA,worm_bucket:WORM.bucket,worm_key:WORM.key,worm_version_id:WORM.version_id,worm_archive_sha256:WORM.archive_sha256,worm_retention_mode:WORM.retention_mode,worm_retain_until_utc:WORM.retain_until_utc});
 assert.equal(p.action,'DELETE_EXACT_TWO_PRESERVED_SOURCE_PROBES_ONLY');
 for(const k of ['any_other_object_forbidden','bucket_deletion_forbidden','policy_mutation_forbidden','database_mutation_forbidden','runtime_mutation_forbidden'])assert.equal(p[k],true,k.toUpperCase()+'_REQUIRED');
 assert.deepEqual(p.required_postcondition,{current:0,versions:0,delete_markers:0,multipart:0,official_inventory_required:true});
 assert.equal(p.trust_digest,c.digest(trust),'DISPOSITION_TRUST_DRIFT');
 assert.equal(p.review_status,'APPROVED','DISPOSITION_REVIEW_NOT_APPROVED');c.id(p.reviewer_id);
 assert(typeof p.authority_ref==='string'&&p.authority_ref.length>=24&&p.authority_ref.length<=512,'DISPOSITION_AUTHORITY_REF_REQUIRED');
 const reviewed=c.epoch(p.reviewed_at_utc),expires=c.epoch(p.expires_at_utc);
 assert(reviewed<=now&&now<expires&&expires-reviewed<=MAX_FRESH_MS,'DISPOSITION_REVIEW_WINDOW_INVALID');
 assert(reviewed>=c.epoch(evidence.inventory.completed_at),'REVIEW_PRECEDES_FRESH_INVENTORY');
 assert.equal(p.source_deletion_authorized,true,'SOURCE_DELETION_NOT_AUTHORIZED');
 assert.equal(p.execution_authorized,false,'EXECUTION_AUTHORITY_FORBIDDEN');assert.equal(p.production_authorized,false,'PRODUCTION_AUTHORITY_FORBIDDEN');
 return p;
}
function issuerFor(trust,issuerId,keyId,when,expires){
 assert(trust&&trust.schema_version==='geox_mcft_cap09_retry_trust_v1','RETRY_TRUST_REQUIRED');
 const found=trust.issuers.filter(x=>x.issuer_id===issuerId&&x.key_id===keyId);assert.equal(found.length,1,'DISPOSITION_ISSUER_NOT_REGISTERED');
 const i=found[0];assert.equal(i.revoked,false,'DISPOSITION_ISSUER_REVOKED');
 assert.equal(i.role,'ACCOUNTABLE_SINGLE_OPERATOR','DISPOSITION_SINGLE_OPERATOR_REQUIRED');assert.equal(i.issuer_id,trust.operator_id,'DISPOSITION_OPERATOR_MISMATCH');
 assert(c.epoch(i.not_before)<=when&&expires<=c.epoch(i.not_after),'DISPOSITION_ISSUER_LIFETIME');
 const key=crypto.createPublicKey(i.public_key_pem);assert.equal(key.asymmetricKeyType,'ed25519');
 assert.equal(c.sha(key.export({type:'spki',format:'der'})),i.spki_sha256,'DISPOSITION_ISSUER_FINGERPRINT');
 return {issuer:i,key};
}
function signReviewed(payload,trust,privateKey,issuerId,keyId,evidence,now=Date.now()){
 validateReviewed(payload,trust,evidence,now);assert.equal(payload.reviewer_id,issuerId,'DISPOSITION_REVIEWER_SIGNER_MISMATCH');
 const {issuer}=issuerFor(trust,issuerId,keyId,c.epoch(payload.reviewed_at_utc),c.epoch(payload.expires_at_utc));
 assert.equal(privateKey.asymmetricKeyType,'ed25519','DISPOSITION_ED25519_REQUIRED');
 assert.equal(c.sha(crypto.createPublicKey(privateKey).export({type:'spki',format:'der'})),issuer.spki_sha256,'DISPOSITION_PRIVATE_KEY_MISMATCH');
 const signature_base64=crypto.sign(null,Buffer.from(DOMAIN+c.canonical(payload)),privateKey).toString('base64');
 const envelope={schema_version:'DA9_MINIO_EVIDENCE_DISPOSITION_SIGNATURE_V1',payload:structuredClone(payload),signature:{issuer_id:issuerId,key_id:keyId,signature_base64}};
 verifySigned(envelope,trust,evidence,now);
 return envelope;
}
function verifySigned(envelope,trust,evidence,now=Date.now()){
 c.exact(envelope,['schema_version','payload','signature']);assert.equal(envelope.schema_version,'DA9_MINIO_EVIDENCE_DISPOSITION_SIGNATURE_V1');
 const p=validateReviewed(envelope.payload,trust,evidence,now);c.exact(envelope.signature,['issuer_id','key_id','signature_base64']);
 assert.equal(envelope.signature.issuer_id,p.reviewer_id,'DISPOSITION_SIGNER_NOT_REVIEWER');
 const {key}=issuerFor(trust,envelope.signature.issuer_id,envelope.signature.key_id,c.epoch(p.reviewed_at_utc),c.epoch(p.expires_at_utc));
 const sig=Buffer.from(envelope.signature.signature_base64,'base64');assert(sig.length===64&&sig.toString('base64')===envelope.signature.signature_base64,'DISPOSITION_SIGNATURE_ENCODING');
 assert(crypto.verify(null,Buffer.from(DOMAIN+c.canonical(p)),key,sig),'DISPOSITION_SIGNATURE_INVALID');
 return {status:'VERIFIED_EXACT_SOURCE_DELETION_AUTHORITY',run_id:RUN,subject_sha:p.subject_sha,object_count:2,source_deletion_authorized:true,execution_authorized:false,production_authorized:false};
}
function loadEvidence(inventoryFile,captureFile,recheckFile,wormZipFile){
 for(const f of [inventoryFile,captureFile,recheckFile,wormZipFile]){assert(path.isAbsolute(f),'ABSOLUTE_EVIDENCE_PATH_REQUIRED');c.noLinks(f);}
 return {inventory:c.read(inventoryFile),capture:c.read(captureFile),recheck:c.read(recheckFile),wormZipSha:fileSha(wormZipFile),inventorySha:fileSha(inventoryFile),captureSha:fileSha(captureFile),recheckSha:fileSha(recheckFile)};
}
function outsideRoot(file){const root=path.resolve(__dirname,'../..'),rel=path.relative(root,path.resolve(file));return rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel);}
function cli(){
 const [mode,...a]=process.argv.slice(2),trust=c.read(TRUST_PATH),now=Date.now();
 if(mode==='draft'){
  assert.equal(a.length,7,'DRAFT_ARGS_REQUIRED');
  const [subject,inventory,capture,recheck,wormZip,dispositionId,output]=a;assert(path.isAbsolute(output)&&outsideRoot(output),'DRAFT_OUTPUT_MUST_BE_OUTSIDE_RELEASE');assert(!fs.existsSync(output),'DRAFT_OUTPUT_EXISTS');
  const e=loadEvidence(inventory,capture,recheck,wormZip),p=buildDraft(subject,e,dispositionId,trust,now);c.writeOnce(output,p);
  console.log(JSON.stringify({status:'DISPOSITION_DRAFT_REVIEW_REQUIRED',disposition_id:p.disposition_id,subject_sha:p.subject_sha,inventory_sha256:e.inventorySha,source_deletion_authorized:false,execution_authorized:false,production_authorized:false,output}));
 } else if(mode==='sign'){
  assert(process.platform==='win32'&&!process.env.CI&&!process.env.GITHUB_ACTIONS,'SIGN_WINDOWS_OPERATOR_ONLY');assert.equal(a.length,9,'SIGN_ARGS_REQUIRED');
  const [reviewed,inventory,capture,recheck,wormZip,keyFile,issuerId,keyId,output]=a;
  for(const f of [reviewed,keyFile,output])assert(path.isAbsolute(f)&&outsideRoot(f),'SIGN_INPUT_OR_OUTPUT_MUST_BE_OUTSIDE_RELEASE');
  assert(!fs.existsSync(output),'SIGNED_OUTPUT_EXISTS');c.noLinks(keyFile);
  const e=loadEvidence(inventory,capture,recheck,wormZip),p=c.read(reviewed),key=crypto.createPrivateKey(fs.readFileSync(keyFile));
  const envelope=signReviewed(p,trust,key,issuerId,keyId,e,now);c.writeOnce(output,envelope);
  console.log(JSON.stringify({...verifySigned(envelope,trust,e,now),signed_disposition_sha256:fileSha(output),output}));
 } else if(mode==='verify'){
  assert.equal(a.length,5,'VERIFY_ARGS_REQUIRED');const [signed,inventory,capture,recheck,wormZip]=a;
  const e=loadEvidence(inventory,capture,recheck,wormZip),result=verifySigned(c.read(signed),trust,e,now);
  console.log(JSON.stringify(result));
 } else throw Error('MODE_REQUIRED');
}
module.exports={RUN,SOURCE_ENDPOINT,SOURCE_BUCKET,DOMAIN,TRUST_PATH,MAX_FRESH_MS,CAPTURE_SHA,RECHECK_SHA,WORM,OBJECTS,validateEvidence,buildDraft,validateReviewed,signReviewed,verifySigned,loadEvidence};
if(require.main===module){try{cli();}catch(e){console.error(JSON.stringify({status:'DISPOSITION_HOLD',error_code:String(e.message).replace(/[^A-Za-z0-9_:-]/g,'_').slice(0,160),source_deletion_authorized:false,execution_authorized:false,production_authorized:false}));process.exitCode=1;}}
