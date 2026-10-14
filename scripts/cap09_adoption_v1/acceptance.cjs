'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const {performance}=require('node:perf_hooks');
const c=require('./contract.cjs');
const signer=require('./signer.cjs');
const verifier=require('./verifier.cjs');
const launcher=require('./synthetic-launcher.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'cap09-adoption-synthetic-'));
const checks=[]; const started=performance.now();
function test(name, fn){fn();checks.push({name,result:'PASS'});}
function fixture(output){
  const dir=output ? path.resolve(output) : fs.mkdtempSync(path.join(root,'case-'));
  if(output){c.noLinks(path.dirname(dir));fs.mkdirSync(dir);} const materials=path.join(dir,'materials'),evidence=path.join(dir,'evidence'),ledger=path.join(dir,'ledger');
  for(const p of [materials,evidence,ledger])fs.mkdirSync(p);
  for(const k of c.MATERIALS){fs.mkdirSync(path.join(materials,k));fs.writeFileSync(path.join(materials,k,'fixture.txt'),'synthetic '+k+'\n');}
  const now=Date.now(),iso=n=>new Date(n).toISOString(),pair=crypto.generateKeyPairSync('ed25519');
  const privateKey=pair.privateKey.export({type:'pkcs8',format:'pem'});
  const issuer={issuer_identity:'synthetic_operator',signer_key_id:'synthetic_key',role:'ACCOUNTABLE_SINGLE_OPERATOR',test_key:true,revoked:false,
    not_before:iso(now-60000),not_after:iso(now+3600000),public_key_pem:pair.publicKey.export({type:'spki',format:'pem'}),spki_sha256:c.sha(pair.publicKey.export({type:'spki',format:'der'}))};
  const policy={schema_version:c.VERSION,mode:'SYNTHETIC_ONLY',enabled:true,subject_commit_sha:'a'.repeat(40),contract_version:c.VERSION,
    checks:['AM19','Phase5','frozen_108','historic_first_parent','QCP_52_65'].map(check_id=>({check_id,check_revision:'synthetic_v1',allow_not_applicable:false})),
    issuers:['qualification','permit'].map(purpose=>({...issuer,purpose})),host_id:'synthetic_host',operator_id:'synthetic_operator',ledger_root:ledger,
    max_qualification_ms:3600000,max_permit_ms:300000,max_readback_ms:300000,valid_until:iso(now+3600000),revocation_epoch:'synthetic_epoch_1'};
  const manifest=policy.checks.map(x=>{
    const ref=x.check_id+'.json', bytes=JSON.stringify({check_id:x.check_id,result:'PASS',subject_commit_sha:policy.subject_commit_sha,synthetic:true});fs.writeFileSync(path.join(evidence,ref),bytes);
    return {...x,policy:'REQUIRED',applicability:'APPLICABLE',result:'PASS',reason:'Synthetic fixture only; not historical proof',scope:'SYNTHETIC_ONLY',evidence_ref:ref,evidence_digest:c.sha(bytes)};
  }).map(({allow_not_applicable,...x})=>x);
  const report={qualification_id:'synthetic_qualification',schema_version:c.VERSION,qualification_contract_version:c.VERSION,subject_commit_sha:policy.subject_commit_sha,
    ...c.materialSet(materials),check_manifest:manifest,valid_for:['SYNTHETIC_ONLY'],issued_at:iso(now-1000),expires_at:iso(now+600000),material_invalidation_policy:'EXACT_MATERIAL_AND_POLICY_V1',
    issuer_identity:issuer.issuer_identity,signature_algorithm:'Ed25519',signer_key_id:issuer.signer_key_id,policy_digest:c.digest(policy)};
  const qualification=signer.qualification(report,materials,evidence,privateKey,policy,now);
  const context={host_id:policy.host_id,operator_id:policy.operator_id,run_id:'synthetic_run',stage:'NO_EFFECT',mode:'SYNTHETIC_ONLY',
    config:{principal:'synthetic_login',database_endpoint:'not-a-network-endpoint',bucket:'synthetic_bucket',acl_digest:c.sha('acl'),environment_digest:c.sha('env')},observed_at:iso(now),plan_digest:c.sha('NO_EFFECT')};
  const payload={schema_version:c.VERSION,qualification_id:report.qualification_id,qualification_digest:c.digest(qualification),subject_commit_sha:report.subject_commit_sha,policy_digest:c.digest(policy),
    ...Object.fromEntries(['host_id','operator_id','run_id','stage','mode','plan_digest'].map(k=>[k,context[k]])),config_digest:c.digest(context.config),observations_digest:c.digest(context),nonce:crypto.randomBytes(32).toString('hex'),
    issued_at:iso(now-1000),expires_at:iso(now+240000),issuer_identity:issuer.issuer_identity,signer_key_id:issuer.signer_key_id,signature_algorithm:'Ed25519'};
  const permit=signer.permit(payload,qualification,materials,evidence,context,privateKey,policy,now);
  return {dir,privateKey,report,policy,materials,evidence,context,qualification,permit,now};
}
function reject(name,change){test(name,()=>{const f=fixture();change(f);assert.throws(()=>verifier.admit(f));assert.deepEqual(fs.readdirSync(f.policy.ledger_root),[]);});}
function cli(file,args){const r=cp.spawnSync(process.execPath,[path.join(__dirname,file),...args],{encoding:'utf8',timeout:10000,env:{...process.env,NODE_OPTIONS:''}});assert(!r.error,r.error?.message);return r;}
function requestFiles(f){const r=Object.fromEntries(['qualification','permit','materials','evidence','context'].map(k=>[k,f[k]]));const req=path.join(f.dir,'request.json'),pol=path.join(f.dir,'policy.json');c.writeOnce(req,r);c.writeOnce(pol,f.policy);return [req,pol];}
async function main(){
  const argv=process.argv.slice(2);
  assert(argv.length===0 || (argv.length===2 && argv[0]==='--bundle'), 'USAGE: acceptance [--bundle new-directory]');
  test('complete_chain_and_replay',()=>{const f=fixture(),r=launcher.launch(f);assert.equal(r.status,'EXECUTION_RECEIPT_RECORDED');assert.equal(r.execution_authorized,false);assert.throws(()=>launcher.launch(f),/PERMIT_REPLAY/);assert(fs.existsSync(path.join(f.policy.ledger_root,'run-synthetic_run','SYNTHETIC-RESULT.json')));});
  for(const result of ['FAIL','BLOCKED','NOT_APPLICABLE'])test('signer_rejects_'+result,()=>{const f=fixture();f.report.check_manifest[0].result=result;assert.throws(()=>signer.qualification(f.report,f.materials,f.evidence,f.privateKey,f.policy,f.now));});
  test('missing_required_check',()=>{const f=fixture();f.report.check_manifest.pop();assert.throws(()=>signer.qualification(f.report,f.materials,f.evidence,f.privateKey,f.policy));});
  test('duplicate_required_check',()=>{const f=fixture();f.report.check_manifest[1]=f.report.check_manifest[0];assert.throws(()=>signer.qualification(f.report,f.materials,f.evidence,f.privateKey,f.policy));});
  reject('false_subject',f=>f.qualification.payload.subject_commit_sha='b'.repeat(40));
  reject('qualification_signature',f=>f.qualification.signature_base64=Buffer.alloc(64).toString('base64'));
  reject('permit_signature',f=>f.permit.signature_base64=Buffer.alloc(64).toString('base64'));
  reject('permit_payload_tamper',f=>f.permit.payload.nonce='c'.repeat(64));
  reject('qualification_expired',f=>f.now+=700000);
  reject('permit_expired',f=>f.now+=250000);
  reject('future_readback',f=>f.context.observed_at=new Date(f.now+1000).toISOString());
  reject('stale_readback',f=>f.context.observed_at=new Date(f.now-300001).toISOString());
  reject('disabled_trust',f=>f.policy.enabled=false);
  reject('policy_expired',f=>f.policy.valid_until=new Date(f.now-1).toISOString());
  reject('revocation_epoch_changed',f=>f.policy.revocation_epoch='new_epoch');
  reject('revoked_signer',f=>f.policy.issuers[0].revoked=true);
  reject('unknown_signer',f=>f.policy.issuers=[]);
  reject('untrusted_bundle_key',f=>f.qualification.public_key_pem=f.policy.issuers[0].public_key_pem);
  reject('real_mode',f=>f.context.mode='TEST_ONLY');
  reject('production_mode',f=>f.context.mode='PRODUCTION');
  reject('real_stage',f=>f.context.stage='Producer');
  for(const key of ['host_id','operator_id','run_id','plan_digest'])reject('wrong_'+key,f=>f.context[key]='wrong');
  for(const key of ['principal','database_endpoint','bucket','acl_digest','environment_digest'])reject('drift_'+key,f=>f.context.config[key]='wrong');
  for(const category of c.MATERIALS)reject('material_drift_'+category,f=>fs.appendFileSync(path.join(f.materials,category,'fixture.txt'),'changed'));
  reject('extra_material_file',f=>fs.writeFileSync(path.join(f.materials,'runtime_code','extra.txt'),'extra'));
  reject('missing_material_file',f=>fs.unlinkSync(path.join(f.materials,'runtime_code','fixture.txt')));
  reject('evidence_bytes_tamper',f=>fs.appendFileSync(path.join(f.evidence,'AM19.json'),' '));
  test('fake_admission_cannot_consume',()=>assert.throws(()=>launcher.consume({status:'LOCAL_ADMISSION_PASS'}),/VERIFICATION_REQUIRED/));
  test('qualification_cannot_be_permit',()=>{const f=fixture();assert.throws(()=>verifier.admit({...f,permit:f.qualification}));});
  test('no_output_overwrite',()=>{const p=path.join(root,'once.json');c.writeOnce(p,{x:1});assert.throws(()=>c.writeOnce(p,{x:2}));assert.equal(c.read(p).x,1);});
  test('partial_reservation_burns_attempt',()=>{const f=fixture();fs.mkdirSync(path.join(f.policy.ledger_root,'run-'+f.context.run_id));assert.throws(()=>launcher.launch(f),/PERMIT_REPLAY/);assert(fs.existsSync(path.join(f.policy.ledger_root,'nonce-'+f.permit.payload.nonce)));});
  test('offline_cli_and_no_self_issuance',()=>{
    const f=fixture(),args=requestFiles(f); const preload=path.join(f.dir,'deny-remote.cjs');
    fs.writeFileSync(preload,`const M=require('module'),old=M._load;M._load=function(id,...a){if(/^(node:)?(child_process|http|https|http2|net|tls|dns|dgram)$/.test(id)||/signer/.test(id))throw Error('FORBIDDEN_IMPORT');return old.call(this,id,...a)};const c=require('crypto');c.sign=()=>{throw Error('SIGN_FORBIDDEN')};const fs=require('fs');for(const k of ['writeFileSync','mkdirSync','openSync']){if(k==='openSync'){const o=fs[k];fs[k]=function(p,flags,...a){if(flags!=='r')throw Error('WRITE_FORBIDDEN');return o.call(this,p,flags,...a)}}else fs[k]=()=>{throw Error('WRITE_FORBIDDEN')}};`);
    const r=cp.spawnSync(process.execPath,['--require',preload,path.join(__dirname,'verifier.cjs'),...args],{encoding:'utf8',timeout:10000});assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).status,'LOCAL_ADMISSION_PASS');assert.deepEqual(fs.readdirSync(f.policy.ledger_root),[]);
  });
  test('separate_signer_cli_and_immutable_output',()=>{
    const f=fixture(),req=path.join(f.dir,'sign-request.json'),pol=path.join(f.dir,'sign-policy.json'),key=path.join(f.dir,'private.pem'),out=path.join(f.dir,'proof.json');
    c.writeOnce(req,{report:f.report,materials:f.materials,evidence:f.evidence});c.writeOnce(pol,f.policy);fs.writeFileSync(key,f.privateKey);
    assert.equal(cli('signer.cjs',['qualification',req,pol,key,out]).status,0);assert.equal(cli('signer.cjs',['qualification',req,pol,key,out]).status,1);
  });
  test('same_run_new_nonce_rejected',()=>{const f=fixture();launcher.launch(f);const payload={...f.permit.payload,nonce:crypto.randomBytes(32).toString('hex')};f.permit=signer.permit(payload,f.qualification,f.materials,f.evidence,f.context,f.privateKey,f.policy);assert.throws(()=>launcher.launch(f),/PERMIT_REPLAY/);});
  test('permit_signer_cli',()=>{const f=fixture(),req=path.join(f.dir,'permit-request.json'),pol=path.join(f.dir,'p.json'),key=path.join(f.dir,'key.pem'),out=path.join(f.dir,'permit-out.json');c.writeOnce(req,{payload:f.permit.payload,qualification:f.qualification,materials:f.materials,evidence:f.evidence,context:f.context});c.writeOnce(pol,f.policy);fs.writeFileSync(key,f.privateKey);assert.equal(cli('signer.cjs',['permit',req,pol,key,out]).status,0);assert.equal(verifier.admit({...f,permit:c.read(out)}).status,'LOCAL_ADMISSION_PASS');});
  test('purpose_key_separation',()=>{const f=fixture();f.policy.issuers=f.policy.issuers.filter(i=>i.purpose!=='permit');assert.throws(()=>signer.permit(f.permit.payload,f.qualification,f.materials,f.evidence,f.context,f.privateKey,f.policy));});
  test('material_directory_link_rejected',()=>{const f=fixture(),dest=path.join(f.dir,'linked'),original=path.join(f.materials,'runtime_code');fs.renameSync(original,dest);fs.symlinkSync(dest,original,process.platform==='win32'?'junction':'dir');assert.throws(()=>verifier.admit(f));});
  test('ledger_link_rejected',()=>{const f=fixture(),dest=path.join(f.dir,'linked-ledger');fs.renameSync(f.policy.ledger_root,dest);fs.symlinkSync(dest,f.policy.ledger_root,process.platform==='win32'?'junction':'dir');assert.throws(()=>launcher.launch(f));});
  // QCP diagnostics are read-only: keep synthetic proof bytes out of the checkout.
  // The separate synthetic workflow still retains its explicitly requested bundle.
  const qcpDiagnostic=process.env.GITHUB_WORKFLOW==='mcft-cap-09-qualification-control-plane-v1'
    && argv[1]==='synthetic-proof-bundle';
  const bundleDir=qcpDiagnostic?path.join(root,'qcp-synthetic-proof-bundle'):argv[1];
  const f=fixture(bundleDir),args=requestFiles(f);
  const processStart=performance.now();
  const outputs=await Promise.all(Array.from({length:4},()=>new Promise((resolve,reject)=>{
    const p=cp.spawn(process.execPath,[path.join(__dirname,'synthetic-launcher.cjs'),...args],{stdio:['ignore','pipe','pipe']});let out='',err='';const timer=setTimeout(()=>{p.kill();reject(Error('CONCURRENCY_TIMEOUT'));},10000);
    p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>{clearTimeout(timer);resolve({code,out,err});});
  })));
  test('four_processes_exactly_one_consumer',()=>{assert.equal(outputs.filter(r=>r.code===0).length,1);assert.equal(outputs.filter(r=>r.code===1&&JSON.parse(r.err).status==='PERMIT_REPLAY').length,3);});
  const elapsed=Math.ceil(performance.now()-started);assert(elapsed<60000,'SYNTHETIC_SUITE_BUDGET_EXCEEDED');
  const summary={status:'SYNTHETIC_CLOSURE_PASS',checks:checks.length,results:checks,elapsed_ms:elapsed,concurrent_processes_ms:Math.ceil(performance.now()-processStart),real_adoption_qualified:false,execution_authorized:false,production_authorized:false};
  if(argv[1]){c.writeOnce(path.join(f.dir,'acceptance-result.json'),summary);c.writeOnce(path.join(f.dir,'tool-source-manifest.json'),fs.readdirSync(__dirname).filter(n=>n.endsWith('.cjs')).sort().map(n=>({path:n,sha256:c.sha(fs.readFileSync(path.join(__dirname,n)))})));}
  console.log(JSON.stringify(summary));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fs.rmSync(root,{recursive:true,force:true}));
