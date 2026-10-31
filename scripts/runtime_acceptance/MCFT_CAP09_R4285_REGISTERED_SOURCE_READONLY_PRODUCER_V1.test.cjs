'use strict';
/* Synthetic negative-contract tests only. Never a host readback or Permit. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const p=require('./MCFT_CAP09_R4285_REGISTERED_SOURCE_READONLY_PRODUCER_V1.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function temp(fn){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r4285-producer-SYNTHETIC-'));
 try{return fn(root);}finally{fs.rmSync(root,{recursive:true,force:true});}
}
const run='da9db7129607',nonce='b'.repeat(64);
function setup(root,{schema='geox_mcft_cap09_consumed_permit_v1',runId=run,nonceId=nonce}={}){
 const record=schema.endsWith('_v1')?{
  schema_version:schema,payload:{run_id:runId,nonce:nonceId},
  status:'CONSUMED_NO_AUTOMATIC_RETRY',execute_authorized:false
 }:{
  schema_version:schema,run_id:runId,nonce:nonceId,
  status:'CONSUMED_NO_AUTOMATIC_RETRY',execute_authorized:false,production_authorized:false
 };
 const r=path.join(root,'run-'+runId),n=path.join(root,'nonce-'+nonceId);
 fs.mkdirSync(r);fs.mkdirSync(n);
 const bytes=Buffer.from(JSON.stringify(record)+'\n');
 fs.writeFileSync(path.join(r,'CONSUMED.json'),bytes);fs.writeFileSync(path.join(n,'CONSUMED.json'),bytes);
 return {r,n,bytes,record,digest:sha(bytes)};
}
test('exports strictly read-only entrypoints, no signer/consumer/grant',()=>{
 for(const x of ['sign','consume','consumePermit','execute','dispatch','provision','writeOnce','approve']){
  assert.equal(p[x],undefined,x);
 }
 assert.equal(Object.isFrozen(p.SOURCE_BLOBS),true);
 assert.equal(p.MERGE,'96861b78674571adf4414b88c3a2894b61de2eb5');
 assert.equal(p.SOURCE,'3dd409810748b5ef9f361fb1b7a2003786e4475b');
 assert.equal(Object.keys(p.SOURCE_BLOBS).length,10);
 assert.equal(p.TRUST_SHA,'dce2a16f6a82779873dfe25b30194f0445f23b894f5eb41c41a7274b1eb19cf7');
});
test('CLI has only readback-only; never accepts trust/root/execute flags',()=>{
 assert.throws(()=>p.runNative(['--execute']),/READBACK_ONLY_CLI|WINDOWS_ONLY/);
 assert.throws(()=>p.runNative(['--readback-only','--ledger-root','/tmp']),/READBACK_ONLY_CLI|WINDOWS_ONLY/);
 assert.throws(()=>p.runNative(['--readback-only','--trust','fake']),/READBACK_ONLY_CLI|WINDOWS_ONLY/);
 assert.throws(()=>p.runNative([]),/READBACK_ONLY_CLI|WINDOWS_ONLY/);
});
test('Linux/CI cannot impersonate physical Windows readback',()=>{
 if(process.platform!=='win32')assert.throws(()=>p.runNative(['--readback-only']),/WINDOWS_ONLY/);
});
test('empty root is not complete source evidence',()=>temp(root=>{
 const i=p.fullIndex(root);assert.equal(i.files,0);
 assert.throws(()=>p.auditFixedLedger(root));
}));
test('valid synthetic V1 twin bytes are internally paired but cannot prove history',()=>temp(root=>{
 const a=setup(root);
 const v=p.consumedRead(root,run,a.digest,'geox_mcft_cap09_consumed_permit_v1');
 assert.equal(v.pair_bytes_equal,true);assert.equal(v.consumed_sha256,a.digest);
 assert.equal(v.production_authorized,false);
 assert.throws(()=>p.auditFixedLedger(root),/HISTORICAL_CONSUMED_DIGEST/);
}));
test('synthetic V2 pair bytes verify distinct V2 schema without authority',()=>temp(root=>{
 const a=setup(root,{schema:'geox_mcft_cap09_consumed_permit_attempt3_v2',runId:'6ff9b41f6f7f'});
 const v=p.consumedRead(root,'6ff9b41f6f7f',a.digest,'geox_mcft_cap09_consumed_permit_attempt3_v2');
 assert.equal(v.schema_version,'geox_mcft_cap09_consumed_permit_attempt3_v2');
}));
test('wrong historical receipt digest never promotes',()=>temp(root=>{
 setup(root);
 assert.throws(()=>p.consumedRead(root,run,'0'.repeat(64),'geox_mcft_cap09_consumed_permit_v1'),
  /HISTORICAL_CONSUMED_DIGEST/);
}));
test('V1/V2 schema confusion is rejected',()=>temp(root=>{
 const a=setup(root);
 assert.throws(()=>p.consumedRead(root,run,a.digest,'geox_mcft_cap09_consumed_permit_attempt3_v2'),
  /CONSUMED_SCHEMA/);
}));
test('missing matching nonce slot is rejected',()=>temp(root=>{
 const a=setup(root);fs.rmSync(a.n,{recursive:true});
 assert.throws(()=>p.consumedRead(root,run,a.digest,'geox_mcft_cap09_consumed_permit_v1'));
}));
test('twin-byte corruption is rejected even for parseable JSON',()=>temp(root=>{
 const a=setup(root);fs.appendFileSync(path.join(a.n,'CONSUMED.json'),' ');
 assert.throws(()=>p.consumedRead(root,run,a.digest,'geox_mcft_cap09_consumed_permit_v1'),
  /DUAL_LEDGER_BYTES/);
}));
test('unknown extra ledger root child fails closed before reading permits',()=>temp(root=>{
 fs.mkdirSync(path.join(root,'new-permit-writer'));
 assert.throws(()=>p.fullIndex(root),/UNREGISTERED_ROOT_CHILD/);
}));
test('extra future run slot is indexed but cannot be confused with old consumed record',()=>temp(root=>{
 setup(root);fs.mkdirSync(path.join(root,'run-123456789abc'));
 const idx=p.fullIndex(root);assert(idx.directories>=3);
 assert.throws(()=>p.auditFixedLedger(root));
}));
test('symbolic linked nonce is rejected, no traversal',()=>temp(root=>{
 const a=setup(root);fs.rmSync(a.n,{recursive:true});
 try{fs.symlinkSync(a.r,a.n,'dir');}
 catch(e){if(e.code==='EPERM')return;throw e;}
 assert.throws(()=>p.fullIndex(root),/LEDGER_SYMLINK|LEDGER_REPARSE/);
}));
test('unknown file collision and duplicate naming cannot bypass closed-world root',()=>temp(root=>{
 setup(root);fs.writeFileSync(path.join(root,'unexpected.txt'),'x');
 assert.throws(()=>p.fullIndex(root),/UNREGISTERED_ROOT_CHILD/);
}));
test('file size bounding rejects oversized raw files without truncated scan',()=>temp(root=>{
 const a=setup(root);const f=path.join(a.r,'too_large.log');fs.writeFileSync(f,Buffer.alloc(8*1024*1024+1));
 assert.throws(()=>p.fullIndex(root),/LEDGER_FILE_BOUND/);
}));
test('zero-byte existing stage log is allowed in full index',()=>temp(root=>{
 const a=setup(root);fs.writeFileSync(path.join(a.r,'stderr.log'),'');
 const i=p.fullIndex(root);assert.equal(i.files,3);
}));
test('stable full indexes bind names, identity and raw content digest',()=>temp(root=>{
 const a=setup(root);const before=p.fullIndex(root);
 assert.deepEqual(p.fullIndex(root).entries,before.entries);
 fs.appendFileSync(path.join(a.r,'CONSUMED.json'),' ');
 assert.notEqual(p.fullIndex(root).sha256,before.sha256);
}));
test('malformed consumed JSON cannot be called complete',()=>temp(root=>{
 const a=setup(root);fs.writeFileSync(path.join(a.r,'CONSUMED.json'),'{partial');
 assert.throws(()=>p.consumedRead(root,run,a.digest,'geox_mcft_cap09_consumed_permit_v1'));
}));
