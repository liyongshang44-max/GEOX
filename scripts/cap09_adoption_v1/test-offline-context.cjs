'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const c=require('./contract.cjs'),m=require('./installed-material.cjs'),v=require('./offline-context.cjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cap09-offline-context-'));let checks=0;
function fixture(){
 const dir=fs.mkdtempSync(path.join(tmp,'case-')),root=path.join(dir,'payload'),evidence=path.join(dir,'evidence');fs.mkdirSync(root);fs.mkdirSync(evidence);fs.writeFileSync(path.join(root,'entry.cjs'),'// fixture; not executed\n');
 const now=Date.now(),iso=x=>new Date(x).toISOString(),pair=crypto.generateKeyPairSync('ed25519');
 const node=fs.realpathSync(process.execPath),tool={path:node,sha256:c.sha(fs.readFileSync(node))};
 const environment={MCFT_PYTHON_EXECUTABLE:node};
 const material={schema:'CAP09_INSTALLED_MATERIAL_V1',root,files:m.inventory(root),tools:{node:tool,python:tool,powershell:tool},environment:{allowed_names:Object.keys(environment),public_values:environment}};
 const policy={schema:'CAP09_OFFLINE_ADOPTION_TRUST_V1',adopted:true,subject_sha:'a'.repeat(40),host_id:'fixture-host',operator_id:'fixture-operator',valid_until:iso(now+600000),checks:Array.from({length:54},(_,i)=>({check_id:'check_'+i,revision:'fixture-v1',allow_not_applicable:false})),issuers:[{issuer_id:'fixture-operator',key_id:'fixture-key',purpose:'ADOPTION',role:'ACCOUNTABLE_SINGLE_OPERATOR',revoked:false,not_before:iso(now-60000),not_after:iso(now+600000),public_key_pem:pair.publicKey.export({type:'spki',format:'pem'}),spki_sha256:c.sha(pair.publicKey.export({type:'spki',format:'der'}))}]};
 const checkRows=policy.checks.map(x=>{const evidence_ref=x.check_id+'.json',bytes=JSON.stringify({synthetic:true,check_id:x.check_id,result:'PASS'});fs.writeFileSync(path.join(evidence,evidence_ref),bytes);return {check_id:x.check_id,revision:x.revision,result:'PASS',reason:'fixture only',evidence_ref,sha256:c.sha(bytes)};});
 const q={schema:'CAP09_ADOPTED_EXECUTION_CONTEXT_V1',subject_sha:policy.subject_sha,scope:'TEST_ONLY',issued_at:iso(now-1000),expires_at:iso(now+60000),issuer_id:'fixture-operator',key_id:'fixture-key',policy_digest:c.digest(policy),material_digest:c.digest(material),checks:checkRows,frozen_paths:108,first_parent_proven:true,host_id:policy.host_id,operator_id:policy.operator_id};
 const request={qualification:{payload:q,signature_base64:''},material,evidence_root:evidence};
 const sign=()=>{q.policy_digest=c.digest(policy);q.material_digest=c.digest(material);request.qualification.signature_base64=crypto.sign(null,Buffer.from(v.DOMAIN+c.canonical(q)),pair.privateKey).toString('base64');};sign();
 return {request,policy,root,now,environment,sign,q};
}
function verify(f){return v.verify(f.request,f.policy,f.root,{now:f.now,host:'fixture-host',environment:f.environment});}
function test(name,fn){fn();checks++;console.log('PASS '+name);}
function reject(name,change,resign=false){test(name,()=>{const f=fixture();change(f);if(resign)f.sign();assert.throws(()=>verify(f));});}
test('valid_signed_context_no_network_or_child_process',()=>{
 const f=fixture(),saved={};for(const k of ['spawn','spawnSync','exec','execSync','execFile','execFileSync']){saved[k]=cp[k];cp[k]=()=>{throw Error('FORBIDDEN_CHILD');};}
 const net=require('node:net'),old=net.connect;net.connect=()=>{throw Error('FORBIDDEN_NETWORK');};
 try{const r=verify(f);assert.equal(r.source,'SIGNED_ADOPTION_NOT_LIVE_REMOTE_MAIN');assert.equal(r.head,f.policy.subject_sha);}finally{Object.assign(cp,saved);net.connect=old;}
});
reject('disabled_policy',f=>f.policy.adopted=false);
reject('signature_corrupt',f=>f.request.qualification.signature_base64=Buffer.alloc(64).toString('base64'));
reject('expired',f=>f.now+=70000);
reject('wrong_host',f=>f.q.host_id='wrong',true);
reject('missing_check',f=>f.q.checks.pop(),true);
reject('duplicate_check',f=>f.q.checks[1]=f.q.checks[0],true);
reject('blocked_check',f=>f.q.checks[0].result='BLOCKED',true);
reject('unapproved_not_applicable',f=>f.q.checks[0].result='NOT_APPLICABLE',true);
reject('missing_policy_check',f=>f.policy.checks.pop(),true);
reject('revoked_issuer',f=>f.policy.issuers[0].revoked=true,true);
reject('second_person_role_requires_separation',f=>f.policy.issuers[0].role='INDEPENDENT_GOVERNANCE',true);
reject('evidence_bytes_changed',f=>fs.appendFileSync(path.join(f.request.evidence_root,'check_0.json'),' '));
reject('source_changed',f=>fs.appendFileSync(path.join(f.root,'entry.cjs'),'changed'));
reject('extra_file',f=>fs.writeFileSync(path.join(f.root,'extra.cjs'),'extra'));
reject('tool_changed',f=>f.request.material.tools.node.sha256='0'.repeat(64),true);
reject('unknown_env',f=>f.environment.UNBOUND='x');
reject('preload_even_if_allowlisted',f=>{f.environment.NODE_OPTIONS='--require x';f.request.material.environment.allowed_names.push('NODE_OPTIONS');},true);
reject('secrets_not_public_profile_values',f=>f.request.material.environment.public_values.PGPASSWORD='secret',true);
reject('wrong_material_root',f=>f.request.material.root=path.dirname(f.root),true);
test('permit_observation_binding',()=>{const f=fixture(),r=verify(f),bundle={observed:{adoption_binding:{qualification_digest:r.adoption_digest,material_digest:r.material_digest}},permit:{payload:{expires_at:f.q.expires_at}}};v.bindObserved(r,bundle);bundle.observed.adoption_binding.material_digest='0'.repeat(64);assert.throws(()=>v.bindObserved(r,bundle));});
test('permit_cannot_outlive_qualification',()=>{const f=fixture(),r=verify(f);assert.throws(()=>v.bindObserved(r,{observed:{adoption_binding:{qualification_digest:r.adoption_digest,material_digest:r.material_digest}},permit:{payload:{expires_at:new Date(f.now+120000).toISOString()}}}));});
test('real_dispatch_rejects_offline_marker_without_governed_retry',()=>{const runner=path.resolve(__dirname,'../runtime_acceptance/RUN_MCFT_CAP_09_CURRENT_BASELINE_QUALIFICATION_V1.cjs');const r=cp.spawnSync(process.execPath,[runner,'--operator-authorized','--preflight-only','--all'],{encoding:'utf8',env:{...process.env,MCFT_CAP09_ADOPTION_REQUEST:path.join(tmp,'missing.json')}});assert.equal(r.status,1);assert.match(r.stderr,/OFFLINE_ADOPTION_REQUIRES_GOVERNED_RETRY/);});
test('empty_offline_marker_cannot_fall_back',()=>{const runner=path.resolve(__dirname,'../runtime_acceptance/RUN_MCFT_CAP_09_CURRENT_BASELINE_QUALIFICATION_V1.cjs');const r=cp.spawnSync(process.execPath,[runner,'--operator-authorized','--preflight-only','--all'],{encoding:'utf8',env:{...process.env,MCFT_CAP09_ADOPTION_REQUEST:''}});assert.equal(r.status,1);assert.match(r.stderr,/OFFLINE_ADOPTION_REQUIRES_GOVERNED_RETRY/);});
test('real_host_offline_proof_precedes_legacy_execution_import',()=>{
 const host=fs.readFileSync(path.resolve(__dirname,'../runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs'),'utf8');
 const start=host.indexOf('function hostBundle(file)');
 const offline=host.indexOf('offline.load(offlineFile,ROOT)',start);
 const legacy=host.indexOf('const execution=require("./MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs")',start);
 assert(start>=0&&offline>start&&legacy>offline,'OFFLINE_PROOF_MUST_PRECEDE_LEGACY_EXECUTION_IMPORT');
});
test('fixed_production_policy_disabled',()=>{assert.equal(c.read(v.POLICY).adopted,false);assert.throws(()=>v.load(path.join(tmp,'missing.json'),tmp));});
console.log(JSON.stringify({status:'PASS',checks,synthetic_material_and_signer:true,real_execution_authorized:false,windows_host_attested:false}));
