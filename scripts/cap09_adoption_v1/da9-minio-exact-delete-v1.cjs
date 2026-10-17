'use strict';
// Operator-only Windows source disposition. Only exact two DA9 probes; once-only,
// no recursive deletion, no retry after partial progress, no production authority.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const c=require('./contract.cjs'),d=require('./da9-minio-disposition-v1.cjs'),inv=require('./da9-minio-readonly-inventory.cjs');
const time=()=>new Date().toISOString(),sha=f=>c.sha(fs.readFileSync(f));
function cmd(client,config,args) {
 const r=cp.spawnSync(client,['--config-dir',config,...args],{shell:false,windowsHide:true,encoding:null,timeout:20000,maxBuffer:1024*1024});
 if(r.error)throw Error('DA9_MC_FAILURE:'+String(r.error.code));
 return r;
}
function checkObjectSet(live,previous) {
 assert.deepEqual([live.counts.current,live.counts.versions,live.counts.delete_markers,live.counts.multipart],[2,2,0,0],'DA9_DELETE_LIVE_SOURCE_NOT_EXACT_TWO');
 assert.deepEqual(live.entries.current,previous.entries.current,'DA9_DELETE_SOURCE_CURRENT_CHANGED');
 assert.deepEqual(live.entries.versions,previous.entries.versions,'DA9_DELETE_SOURCE_VERSION_CHANGED');
 assert.deepEqual(live.entries.multipart,[],'DA9_DELETE_MULTIPART_PRESENT');
}
async function execute(o,{command=cmd,snapshot=inv.snapshot}={}) {
 assert(process.platform==='win32'&&!process.env.CI&&!process.env.GITHUB_ACTIONS,'DA9_EXACT_DELETE_WINDOWS_ONLY');
 for(const k of ['signed','pre','capture','recheck','zip','client','config','output'])assert(path.isAbsolute(o[k]),'DA9_DELETE_ABSOLUTE_PATH_REQUIRED:'+k);
 c.id(o.alias);assert(!fs.existsSync(o.output),'DA9_DELETE_OUTPUT_ALREADY_EXISTS');
 const trust=c.read(d.TRUST_PATH),signed=c.read(o.signed),pre=c.read(o.pre),cap=c.read(o.capture),worm=c.read(o.recheck);
 const evidence={inventory:pre,capture:cap,recheck:worm,inventorySha:sha(o.pre),captureSha:sha(o.capture),recheckSha:sha(o.recheck),wormZipSha:sha(o.zip)};
 const result=d.verifySigned(signed,trust,evidence,Date.now());
 assert.equal(result.status,'VERIFIED_EXACT_SOURCE_DELETION_AUTHORITY');
 assert.equal(result.source_deletion_authorized,true);assert.equal(result.production_authorized,false);
 const bucket=o.alias+'/'+d.SOURCE_BUCKET;
 const version=command(o.client,o.config,['version','info',bucket]);
 assert.equal(version.status,0,'DA9_BUCKET_VERSION_QUERY_FAILED');
 assert(version.stdout.toString().includes('is un-versioned'),'DA9_DELETE_BUCKET_VERSIONING_CHANGED');
 const credentials={access:process.env.MCFT_CAP09_DA9_MINIO_ACCESS_KEY,secret:process.env.MCFT_CAP09_DA9_MINIO_SECRET_KEY,region:process.env.MCFT_CAP09_DA9_MINIO_REGION||'us-east-1'};
 assert(credentials.access&&credentials.secret,'DA9_READONLY_CREDENTIALS_REQUIRED');
 const live=await snapshot(credentials);checkObjectSet(live,pre);
 for(const item of d.OBJECTS){
  const got=command(o.client,o.config,['cat',bucket+'/'+item.key]);
  assert.equal(got.status,0,'DA9_SOURCE_GET_FAILED:'+item.key);
  assert.equal(got.stdout.length,item.size_bytes,'DA9_SOURCE_SIZE_CHANGED:'+item.key);
  assert.equal(c.sha(got.stdout),item.content_sha256,'DA9_SOURCE_BYTES_CHANGED:'+item.key);
 }
 const ledgerId='da9_minio_'+sha(o.signed).slice(0,32),ledger=path.join(trust.ledger_root,ledgerId);
 c.noLinks(trust.ledger_root);assert(fs.statSync(trust.ledger_root).isDirectory(),'DA9_LEDGER_ROOT_REQUIRED');
 fs.mkdirSync(ledger,{recursive:false,mode:0o700});
 fs.mkdirSync(o.output,{recursive:false,mode:0o700});
 const verifiedAt=time(),startedAt=time(),startReceipt={schema_version:'DA9_MINIO_SOURCE_DELETE_STARTED_V1',run_id:d.RUN,subject_sha:result.subject_sha,ledger_id:ledgerId,signed_disposition_sha256:sha(o.signed),verified_at_utc:verifiedAt,started_at_utc:startedAt,source_bucket:d.SOURCE_BUCKET,execution_authorized:false,production_authorized:false};
 const startFile=path.join(ledger,'STARTED.json');c.writeOnce(startFile,startReceipt);
 const operations=[];
 for(let idx=0;idx<d.OBJECTS.length;idx++){
  const object=d.OBJECTS[idx],begun=time();
  const deletion=command(o.client,o.config,['rm',bucket+'/'+object.key]);
  const finished=time(),row={key:object.key,version_id:null,content_sha256:object.content_sha256,started_at_utc:begun,finished_at_utc:finished,exit_code:deletion.status===null?-1:deletion.status,operation:'DELETE_EXACT_KEY'};
  c.writeOnce(path.join(ledger,'DELETE_'+(idx+1)+'.json'),row);
  operations.push(row);
  assert.equal(row.exit_code,0,'DA9_PARTIAL_DELETE_NO_AUTOMATIC_RETRY');
  assert(Date.now()<c.epoch(signed.payload.expires_at_utc),'DA9_AUTHORIZATION_EXPIRED_DURING_DELETE');
 }
 const finishedAt=time(),post=await snapshot(credentials);
 const log={schema_version:'DA9_MINIO_EXACT_DELETE_LOG_V1',run_id:d.RUN,subject_sha:result.subject_sha,signed_disposition_sha256:sha(o.signed),verified_at_utc:verifiedAt,started_at_utc:startedAt,finished_at_utc:finishedAt,one_shot_ledger_id:ledgerId,one_shot_started_sha256:sha(startFile),source_versioning_status:'UNVERSIONED',operations,source_only:true,execution_authorized:false,production_authorized:false};
 c.writeOnce(path.join(o.output,'DELETE_LOG.json'),log);
 c.writeOnce(path.join(o.output,'POST_INVENTORY.json'),post);
 assert.deepEqual([post.counts.current,post.counts.versions,post.counts.delete_markers,post.counts.multipart],[0,0,0,0],'DA9_POSTDELETE_FOUR_ZERO_HOLD');
 return {status:'EXACT_SOURCE_DELETION_COMPLETE_AWAITING_SIGNED_CLOSURE',delete_log_sha256:sha(path.join(o.output,'DELETE_LOG.json')),post_inventory_sha256:sha(path.join(o.output,'POST_INVENTORY.json')),started_receipt_file:startFile,execution_authorized:false,production_authorized:false};
}
async function cli(){
 const a=process.argv.slice(2);assert(a.length===10&&a[0]==='execute','DA9_DELETE_CLI_ARGUMENTS_REQUIRED');
 const [,signed,pre,capture,recheck,zip,client,config,alias,output]=a;
 console.log(JSON.stringify(await execute({signed,pre,capture,recheck,zip,client,config,alias,output})));
}
module.exports={execute,checkObjectSet};
if(require.main===module)cli().catch(e=>{console.error(JSON.stringify({status:'DA9_DELETE_HOLD',reason:String(e.message).slice(0,200),automatic_retry:false,production_authorized:false}));process.exitCode=1;});
