'use strict';
// Immutable historical DA9 disposition closure + fresh dynamic-admission consumer.
// Does not delete objects, grant Retry/Permit, or change scientific Runtime.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const c=require('./contract.cjs'),d=require('./da9-minio-disposition-v1.cjs');
const DOMAIN='GEOX_MCFT_CAP09_DA9_DISPOSITION_CLOSURE_V1\n';
const PAYLOAD=['schema_version','run_id','subject_sha','scope','signed_disposition_sha256','pre_inventory_sha256','capture_sha256','worm_recheck_sha256','worm_zip_sha256','delete_log_sha256','post_inventory_sha256','closed_at_utc','exact_two_source_objects_deleted','test_only_admission_authorized','execution_authorized','production_authorized'];
const KEYS=['closure_file','closure_sha256','signed_disposition_file','pre_inventory_file','capture_file','worm_recheck_file','worm_zip_file','delete_log_file','post_inventory_file','current_inventory_file','current_inventory_sha256'];
const SHA=x=>c.sha(x), read=f=>{assert(path.isAbsolute(f),'CLOSURE_ABSOLUTE_PATH_REQUIRED');return c.read(f);};
const shaFile=f=>{assert(path.isAbsolute(f),'CLOSURE_ABSOLUTE_PATH_REQUIRED');c.noLinks(f);const s=fs.statSync(f);assert(s.isFile()&&s.size<=32*1024*1024,'CLOSURE_FILE_INVALID');return SHA(fs.readFileSync(f));};
function fourZero(i){
 assert.equal(i.schema_version,'MCFT_CAP09_DA9_MINIO_READONLY_INVENTORY_V1');
 assert.equal(i.run_id,d.RUN);assert.equal(i.bucket,d.SOURCE_BUCKET);assert.equal(i.endpoint,d.SOURCE_ENDPOINT);
 assert.deepEqual(i.counts,{current:0,versions:0,delete_markers:0,multipart:0,status:'EMPTY_READBACK_CANDIDATE_ONLY',test_only_admission:'HOLD',production_admission:'HOLD'},'CLOSURE_FOUR_ZERO_COUNTS_REQUIRED');
 assert.deepEqual(i.entries,{current:[],versions:[],multipart:[]},'CLOSURE_FOUR_ZERO_ENTRIES_REQUIRED');
 const a=c.epoch(i.started_at),b=c.epoch(i.completed_at);assert(a<=b,'CLOSURE_INVENTORY_TIME_INVALID');return {a,b};
}
function historical(e,trust,now){
 assert(e&&e.signed&&e.pre&&e.capture&&e.worm&&e.log&&e.post,'CLOSURE_HISTORY_REQUIRED');
 for(const k of ['signed_sha','pre_sha','capture_sha','worm_sha','zip_sha','log_sha','post_sha'])c.hash(e[k]);
 assert.equal(e.zip_sha,d.WORM.archive_sha256,'CLOSURE_WORM_BYTES_CHANGED');
 const log=e.log;
 c.exact(log,['schema_version','run_id','subject_sha','signed_disposition_sha256','verified_at_utc','started_at_utc','finished_at_utc','one_shot_ledger_id','one_shot_started_sha256','source_versioning_status','operations','source_only','execution_authorized','production_authorized']);
 assert.equal(log.schema_version,'DA9_MINIO_EXACT_DELETE_LOG_V1');assert.equal(log.run_id,d.RUN);
 assert.equal(log.subject_sha,e.signed.payload.subject_sha);assert.equal(log.signed_disposition_sha256,e.signed_sha);
 c.id(log.one_shot_ledger_id);c.hash(log.one_shot_started_sha256);assert.equal(log.source_versioning_status,'UNVERSIONED');
 assert.equal(log.source_only,true);assert.equal(log.execution_authorized,false);assert.equal(log.production_authorized,false);
 const v=c.epoch(log.verified_at_utc),start=c.epoch(log.started_at_utc),end=c.epoch(log.finished_at_utc);
 const preStart=c.epoch(e.pre.started_at),preEnd=c.epoch(e.pre.completed_at),post=fourZero(e.post);
 assert(preEnd<=v&&v<=start&&start<=end&&end<=post.a&&post.a<=post.b&&post.b<=now,'CLOSURE_HISTORY_TIME_ORDER');
 assert(v-preStart<=300000&&end-start<=300000&&post.a-end<=300000,'CLOSURE_HISTORY_WINDOW');
 assert(Array.isArray(log.operations)&&log.operations.length===2,'CLOSURE_EXACT_TWO_OPERATIONS');
 for(let i=0;i<2;i++){
  const row=log.operations[i],expected=d.OBJECTS[i];
  c.exact(row,['key','version_id','content_sha256','started_at_utc','finished_at_utc','exit_code','operation']);
  assert.equal(row.key,expected.key);assert.equal(row.version_id,null);assert.equal(row.content_sha256,expected.content_sha256);
  assert.equal(row.operation,'DELETE_EXACT_KEY');assert.equal(row.exit_code,0,'CLOSURE_DELETE_FAILED');
  const a=c.epoch(row.started_at_utc),b=c.epoch(row.finished_at_utc);assert(start<=a&&a<=b&&b<=end,'CLOSURE_DELETE_ORDER');
  if(i)assert(a>=c.epoch(log.operations[i-1].finished_at_utc),'CLOSURE_DELETE_OVERLAP');
 }
 const de={inventory:e.pre,capture:e.capture,recheck:e.worm,inventorySha:e.pre_sha,captureSha:e.capture_sha,recheckSha:e.worm_sha,wormZipSha:e.zip_sha};
 const permit=d.verifySigned(e.signed,trust,de,v);
 assert.equal(permit.source_deletion_authorized,true);assert.equal(permit.execution_authorized,false);assert.equal(permit.production_authorized,false);
 return {subject:permit.subject_sha,postEnded:post.b,deletedAt:end};
}
function payload(e,trust,at){
 const now=c.epoch(at),h=historical(e,trust,now);
 assert(now>=h.postEnded&&now-h.postEnded<=86400000,'CLOSURE_SIGN_TOO_LATE');
 return {schema_version:'DA9_MINIO_DISPOSITION_CLOSURE_V1',run_id:d.RUN,subject_sha:h.subject,scope:'TEST_ONLY',
 signed_disposition_sha256:e.signed_sha,pre_inventory_sha256:e.pre_sha,capture_sha256:e.capture_sha,worm_recheck_sha256:e.worm_sha,worm_zip_sha256:e.zip_sha,delete_log_sha256:e.log_sha,post_inventory_sha256:e.post_sha,closed_at_utc:at,exact_two_source_objects_deleted:true,test_only_admission_authorized:false,execution_authorized:false,production_authorized:false};
}
function keyFor(trust,id,keyId,at){
 assert.equal(trust.schema_version,'geox_mcft_cap09_retry_trust_v1');
 const rows=trust.issuers.filter(x=>x.issuer_id===id&&x.key_id===keyId);assert.equal(rows.length,1,'CLOSURE_ISSUER_NOT_REGISTERED');
 const k=rows[0];assert.equal(k.issuer_id,trust.operator_id);assert.equal(k.role,'ACCOUNTABLE_SINGLE_OPERATOR');assert.equal(k.revoked,false);
 assert(c.epoch(k.not_before)<=at&&at<=c.epoch(k.not_after),'CLOSURE_ISSUER_NOT_VALID_AT_SEAL');
 const pub=crypto.createPublicKey(k.public_key_pem);assert.equal(pub.asymmetricKeyType,'ed25519');
 assert.equal(SHA(pub.export({type:'spki',format:'der'})),k.spki_sha256,'CLOSURE_KEY_FINGERPRINT');
 return {k,pub};
}
function sign(e,trust,privateKey,id,keyId,at){
 const p=payload(e,trust,at);const {k}=keyFor(trust,id,keyId,c.epoch(at));
 assert.equal(privateKey.asymmetricKeyType,'ed25519');
 assert.equal(SHA(crypto.createPublicKey(privateKey).export({type:'spki',format:'der'})),k.spki_sha256,'CLOSURE_PRIVATE_KEY_MISMATCH');
 const result={schema_version:'DA9_MINIO_DISPOSITION_CLOSURE_SIGNATURE_V1',payload:p,signature:{issuer_id:id,key_id:keyId,signature_base64:crypto.sign(null,Buffer.from(DOMAIN+c.canonical(p)),privateKey).toString('base64')}};
 verifyHistorical(result,e,trust,Date.now());return result;
}
function verifyHistorical(envelope,e,trust,now=Date.now()){
 c.exact(envelope,['schema_version','payload','signature']);assert.equal(envelope.schema_version,'DA9_MINIO_DISPOSITION_CLOSURE_SIGNATURE_V1');
 c.exact(envelope.payload,PAYLOAD);c.exact(envelope.signature,['issuer_id','key_id','signature_base64']);
 const at=c.epoch(envelope.payload.closed_at_utc);assert(at<=now,'CLOSURE_FUTURE_SEAL');
 assert.deepEqual(envelope.payload,payload(e,trust,envelope.payload.closed_at_utc),'CLOSURE_EVIDENCE_DIGEST_MISMATCH');
 const {pub}=keyFor(trust,envelope.signature.issuer_id,envelope.signature.key_id,at);
 assert.equal(envelope.signature.issuer_id,trust.operator_id,'CLOSURE_NON_OPERATOR_SIGNATURE');
 const sig=Buffer.from(envelope.signature.signature_base64,'base64');
 assert(sig.length===64&&sig.toString('base64')===envelope.signature.signature_base64,'CLOSURE_SIGNATURE_ENCODING');
 assert(crypto.verify(null,Buffer.from(DOMAIN+c.canonical(envelope.payload)),pub,sig),'CLOSURE_BAD_SIGNATURE');
 return {status:'HISTORICAL_DISPOSITION_CLOSURE_VERIFIED',subject_sha:envelope.payload.subject_sha,execution_authorized:false,production_authorized:false};
}
function verifyAdmission(envelope,e,trust,current,subject,now=Date.now()){
 const verified=verifyHistorical(envelope,e,trust,now);
 assert.equal(verified.subject_sha,subject,'CLOSURE_WRONG_SUBJECT');
 const fresh=fourZero(current),post=c.epoch(e.post.completed_at);
 assert(fresh.a>=post,'CLOSURE_READBACK_PREDATES_DELETION');
 assert(fresh.b<=now&&now-fresh.a<=300000,'CLOSURE_ADMISSION_READBACK_STALE');
 return {...verified,status:'CLOSURE_VERIFIED_FOR_DA9_ADMISSION',current_four_zero:true,test_only_admission_authorized:false};
}
function loadRaw(paths){
 const p=paths;return {signed:read(p.signed_disposition_file),pre:read(p.pre_inventory_file),capture:read(p.capture_file),worm:read(p.worm_recheck_file),log:read(p.delete_log_file),post:read(p.post_inventory_file),signed_sha:shaFile(p.signed_disposition_file),pre_sha:shaFile(p.pre_inventory_file),capture_sha:shaFile(p.capture_file),worm_sha:shaFile(p.worm_recheck_file),zip_sha:shaFile(p.worm_zip_file),log_sha:shaFile(p.delete_log_file),post_sha:shaFile(p.post_inventory_file)};
}
function verifyReference(ref,trust,subject,now=Date.now()){
 c.exact(ref,[...KEYS,'closure_sha256','current_inventory_sha256'].filter((x,i,a)=>a.indexOf(x)===i));
 for(const x of ['closure_sha256','current_inventory_sha256'])c.hash(ref[x]);
 for(const k of KEYS.filter(x=>x.endsWith('_file')))assert(path.isAbsolute(ref[k]),'CLOSURE_REFERENCE_NOT_ABSOLUTE:'+k);
 assert.equal(shaFile(ref.closure_file),ref.closure_sha256,'CLOSURE_REFERENCED_SIGNATURE_BYTES_CHANGED');
 assert.equal(shaFile(ref.current_inventory_file),ref.current_inventory_sha256,'CLOSURE_CURRENT_INVENTORY_BYTES_CHANGED');
 const e=loadRaw(ref);
 return verifyAdmission(read(ref.closure_file),e,trust,read(ref.current_inventory_file),subject,now);
}
function cli(){
 const [mode,...args]=process.argv.slice(2),trust=c.read(d.TRUST_PATH);
 if(mode==='sign'){
  assert(process.platform==='win32'&&!process.env.CI&&!process.env.GITHUB_ACTIONS,'CLOSURE_SIGN_LOCAL_ONLY');
  assert.equal(args.length,11,'CLOSURE_SIGN_ARGS_REQUIRED');
  const [signed_disposition_file,pre_inventory_file,capture_file,worm_recheck_file,worm_zip_file,delete_log_file,post_inventory_file,keyFile,issuerId,keyId,output]=args;
  assert(path.isAbsolute(keyFile)&&path.isAbsolute(output)&&!fs.existsSync(output),'CLOSURE_OUTPUT_MUST_BE_NEW');
  c.noLinks(keyFile);const e=loadRaw({signed_disposition_file,pre_inventory_file,capture_file,worm_recheck_file,worm_zip_file,delete_log_file,post_inventory_file});
  const signature=sign(e,trust,crypto.createPrivateKey(fs.readFileSync(keyFile)),issuerId,keyId,new Date().toISOString());
  c.writeOnce(output,signature);console.log(JSON.stringify({status:'CLOSURE_SIGNED_NOT_ADMISSION',sha256:shaFile(output),execution_authorized:false,production_authorized:false}));
 }else if(mode==='verify'){
  assert.equal(args.length,8,'CLOSURE_VERIFY_ARGS_REQUIRED');
  const [closure_file,signed_disposition_file,pre_inventory_file,capture_file,worm_recheck_file,worm_zip_file,delete_log_file,post_inventory_file]=args;
  console.log(JSON.stringify(verifyHistorical(read(closure_file),loadRaw({signed_disposition_file,pre_inventory_file,capture_file,worm_recheck_file,worm_zip_file,delete_log_file,post_inventory_file}),trust)));
 }else throw Error('CLOSURE_MODE_INVALID');
}
module.exports={DOMAIN,fourZero,historical,payload,sign,verifyHistorical,verifyAdmission,verifyReference,loadRaw};
if(require.main===module){try{cli();}catch(e){console.error(JSON.stringify({status:'CLOSURE_HOLD',reason:String(e.message).slice(0,200),execution_authorized:false,production_authorized:false}));process.exitCode=1;}}
