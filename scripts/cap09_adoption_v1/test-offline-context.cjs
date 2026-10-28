'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const c=require('./contract.cjs'),m=require('./installed-material.cjs'),v=require('./offline-context.cjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cap09-offline-context-'));let checks=0;
const WINDOWS_INJECTED_ENV=new Set(['SYSTEMROOT','HOMEDRIVE','HOMEPATH','LOGONSERVER','PATH','SYSTEMDRIVE','TEMP','USERDOMAIN','USERNAME','USERPROFILE','WINDIR']);
let cachedSyntheticChildEnvironment=null;
function syntheticChildEnvironment(node){
 if(process.platform!=='win32')return {MCFT_PYTHON_EXECUTABLE:node};
 if(cachedSyntheticChildEnvironment)return {...cachedSyntheticChildEnvironment};
 const requested={MCFT_PYTHON_EXECUTABLE:node};
 const root=process.env.SystemRoot||process.env.SYSTEMROOT;
 assert(typeof root==='string'&&root.length>0,'WINDOWS_SYSTEMROOT_REQUIRED');
 requested.SystemRoot=root;
 const child=cp.spawnSync(node,['-e','process.stdout.write(JSON.stringify(process.env))'],{env:requested,encoding:'utf8',windowsHide:true});
 assert(!child.error&&child.status===0,'WINDOWS_CHILD_ENV_PROBE_FAILED');
 const actual=JSON.parse(child.stdout);
 const expected=new Set(['MCFT_PYTHON_EXECUTABLE',...WINDOWS_INJECTED_ENV]);
 for(const k of Object.keys(actual))assert(expected.has(k.toUpperCase()),'UNEXPECTED_WINDOWS_CHILD_ENV_NAME:'+k);
 assert.equal(actual.MCFT_PYTHON_EXECUTABLE,node,'SYNTHETIC_CHILD_PYTHON_ENV_DRIFT');
 cachedSyntheticChildEnvironment=actual;
 return {...actual};
}
function fixture(){
 const dir=fs.mkdtempSync(path.join(tmp,'case-')),root=path.join(dir,'payload'),evidence=path.join(dir,'evidence');fs.mkdirSync(root);fs.mkdirSync(evidence);fs.writeFileSync(path.join(root,'entry.cjs'),'// fixture; not executed\n');
 const now=Date.now(),iso=x=>new Date(x).toISOString(),pair=crypto.generateKeyPairSync('ed25519');
 const node=fs.realpathSync(process.execPath),tool={path:node,sha256:c.sha(fs.readFileSync(node))};
 // Windows creates a documented fixed set of additional child variables even when
 // spawnSync(env) provides a minimal environment. Observe the *actual* child
 // environment once, reject unfamiliar names, and bind only permitted public
 // values. This is a SYNTHETIC FIXTURE, not a real Host allowlist change.
 const environment=syntheticChildEnvironment(node);
 const publicKeys=new Set(['PATH','PATHEXT','SYSTEMROOT','WINDIR','MCFT_PYTHON_EXECUTABLE']);
 const publicValues=Object.fromEntries(Object.entries(environment).filter(([k])=>publicKeys.has(k.toUpperCase())));
 const material={schema:'CAP09_INSTALLED_MATERIAL_V1',root,files:m.inventory(root),tools:{node:tool,python:tool,powershell:tool},environment:{allowed_names:Object.keys(environment),public_values:publicValues}};
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

function formalFixture(){
 const base=fixture(),qcpPath=path.resolve(__dirname,'../../docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json');
 // The formal fixture must install the real QCP definition inside its immutable material root.
 // Replay the immutable 55-check V1 adoption fixture. The live QCP grows
 // independently (e.g. CE94 review-only), and must never silently become
 // a 54-check historical signed-adoption policy or change this V1 assertion.
 const historicalSubject='12dcbba6750879f0349c5730f477cb04cd23b560';
 const qcpRelative='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json';
 const historicalBlob=cp.execFileSync('git',['rev-parse',historicalSubject+':'+qcpRelative],{encoding:'utf8'}).trim();
 assert.equal(historicalBlob,'7e132ec2d40bc6ae16b68adf701701c84715cf9a','HISTORICAL_A44_QCP_BLOB_CHANGED');
 const qcpBytes=cp.execFileSync('git',['show',historicalSubject+':'+qcpRelative],{maxBuffer:8*1024*1024});
 const installedQcpPath=path.join(base.root,...v.QCP_REL.split('/'));
 fs.mkdirSync(path.dirname(installedQcpPath),{recursive:true});
 fs.writeFileSync(installedQcpPath,qcpBytes,{flag:'wx'});
 // An adopted release must bind at least the frozen 108-path scope.
 // Add inert source files to this synthetic fixture; real source hashes stay Git-derived.
 const frozenDir=path.join(base.root,'scripts','frozen');fs.mkdirSync(frozenDir,{recursive:true});
 for(let i=0;i<106;i++)fs.writeFileSync(path.join(frozenDir,'f'+String(i).padStart(3,'0')+'.cjs'),'// frozen synthetic test only\n');
 for(const rel of v.REQUIRED_STAGE_MATERIAL){const file=path.join(base.root,...rel.split('/'));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'// synthetic controller material; never executed\n');}
 base.request.material.files=m.inventory(base.root);
 const qcp=JSON.parse(qcpBytes.toString('utf8'));
 const engineering='A44_ADOPTION_QUALIFICATION_LOCAL_EXECUTION_ADMISSION_ENGINEERING_ONLY';
 const definitions=qcp.checks.filter(x=>x.check_id!==engineering);assert.equal(definitions.length,54);
 const allowedNA=new Set(['V13_PRODUCER_DRIVEN_QUALIFICATION','END_TO_END_EVIDENCE_SUPPLY_DEADLINE','EXACT_ONE_PRODUCTION_OWNER','FORMAL_V5_ACTIVATION','V13_RUNTIME_HARNESS_RESOLVER_MIGRATION']);
 const pair=crypto.generateKeyPairSync('ed25519'),now=base.now,iso=x=>new Date(x).toISOString();
 const policy={schema:'CAP09_OFFLINE_ADOPTION_TRUST_V1',activation_mode:'SIGNED_ADOPTION_REQUIRED',adopted:false,subject_sha:null,
  host_id:'fixture-host',operator_id:'fixture-operator',valid_until:iso(now+600000),
  checks:definitions.map(x=>({check_id:x.check_id,check_revision:'LOCAL_QCP_DEFINITION_SHA256',allow_not_applicable:allowedNA.has(x.check_id)})),
  allowed_not_applicable_ids:[...allowedNA],
  issuers:[{issuer_id:'fixture-independent-governance',key_id:'fixture-adoption-key',purpose:'ADOPTION',role:'INDEPENDENT_GOVERNANCE',revoked:false,
   not_before:iso(now-60000),not_after:iso(now+600000),public_key_pem:pair.publicKey.export({type:'spki',format:'pem'}),
   spki_sha256:c.sha(pair.publicKey.export({type:'spki',format:'der'}))}]};
 const evidence=base.request.evidence_root,subject='b'.repeat(40);
 const rows=definitions.map(definition=>{
  const revision=c.digest(definition),evidence_ref='formal-'+c.sha(definition.check_id).slice(0,24)+'.json';
  const row={schema:'MCFT_CAP09_ADOPTION_CHECK_EVIDENCE_V1',subject_sha:subject,check_id:definition.check_id,revision,result:'PASS',reason:'formal fixture'};
  const bytes=JSON.stringify(row);fs.writeFileSync(path.join(evidence,evidence_ref),bytes);
  return {check_id:definition.check_id,revision,result:'PASS',reason:'formal fixture',evidence_ref,sha256:c.sha(bytes)};
 });
 const qcpProof={schema:'MCFT_CAP09_FINAL_QCP_ADOPTION_PROOF_V1',subject_sha:subject,status:'PASS',total_checks:55,adoption_checks:54,blocker_count:0};
 const qcpRef='formal-qcp-proof.json',qcpProofBytes=JSON.stringify(qcpProof);fs.writeFileSync(path.join(evidence,qcpRef),qcpProofBytes);
 const releaseFiles=m.inventory(base.root).map(row=>({...row,size_bytes:fs.statSync(path.join(base.root,...row.path.split('/'))).size,mode:'100644',category:'synthetic-fixture'}));
 const release={schema_version:'MCFT_CAP09_RELEASE_MATERIAL_BINDING_V1',subject_commit_sha:subject,files:releaseFiles,content_inventory_sha256:c.digest(releaseFiles)};
 const releaseRef='formal-release-binding.json',releaseBytes=JSON.stringify(release);fs.writeFileSync(path.join(evidence,releaseRef),releaseBytes);
 const q={qualification_id:'formal_fixture_v1',schema:'MCFT_CAP09_ADOPTION_QUALIFICATION_V1',subject_sha:subject,scope:'TEST_ONLY',
  issued_at:iso(now-1000),expires_at:iso(now+60000),issuer_id:'fixture-independent-governance',key_id:'fixture-adoption-key',
  policy_digest:c.digest(policy),material_digest:c.digest(base.request.material),checks:rows,frozen_paths:108,first_parent_proven:true,
  host_id:policy.host_id,operator_id:policy.operator_id,qcp_proof_ref:qcpRef,qcp_proof_sha256:c.sha(qcpProofBytes),
  release_binding_ref:releaseRef,release_binding_sha256:c.sha(releaseBytes)};
 const envelope={payload:q,signature_base64:crypto.sign(null,Buffer.from(v.ADOPTION_DOMAIN+c.canonical(q)),pair.privateKey).toString('base64')};
 return {...base,request:{qualification:envelope,material:base.request.material,evidence_root:evidence},policy,pair,q,sign(){
  q.policy_digest=c.digest(policy);q.material_digest=c.digest(base.request.material);
  envelope.signature_base64=crypto.sign(null,Buffer.from(v.ADOPTION_DOMAIN+c.canonical(q)),pair.privateKey).toString('base64');
 }};
}
function mergedFormalFixture(observedMain=null){
 const f=formalFixture(),subject=f.q.subject_sha,source='a'.repeat(40),base='c'.repeat(40),tree='d'.repeat(40),e=f.request.evidence_root;
 const archive=Buffer.from('synthetic-QCP-ZIP-bytes-only');fs.writeFileSync(path.join(e,'source-qcp-artifact.zip'),archive);
 const sourceArtifactSha=c.sha(archive);
 const metadata={schema:'MCFT_CAP09_MERGED_QCP_SOURCE_V1',repository:'liyongshang44-max/GEOX',observed_main_sha:observedMain||subject,
  pull_request:{merged:true,base_ref:'main',base_sha:base,head_sha:source,merge_commit_sha:subject},
  workflow_run:{id:17,head_sha:source,status:'completed',conclusion:'success',path:'.github/workflows/mcft-cap-09-qualification-control-plane-v1.yml'},
  artifact:{id:19,digest:'sha256:'+sourceArtifactSha,expired:false}};
 fs.writeFileSync(path.join(e,'source-metadata.json'),c.canonical(metadata)+'\n');
 const merge={schema:'MCFT_CAP09_ZERO_DELTA_MERGE_QCP_DERIVATION_V1',subject_sha:subject,source_subject_sha:source,base_sha:base,observed_main_sha:observedMain||subject,source_and_subject_tree:tree,
  parents:[base,source],source_artifact_id:19,source_workflow_run_id:17,source_artifact_sha256:sourceArtifactSha,source_metadata_sha256:c.digest(metadata),
  generator_sources_sha256:{'build_evidence.py':'f'.repeat(64),'material_binding.py':'e'.repeat(64)},
  method:'EXACT_TWO_PARENT_ZERO_TREE_DELTA_WITH_VALIDATED_SOURCE_QCP',qcp_executed_at_subject:false,raw_reports_rewritten:false,
  additional_first_parent_hops:1,execution_authorized:false,production_authorized:false};
 const mergeBytes=c.canonical(merge)+'\n';fs.writeFileSync(path.join(e,'merge-derivation.json'),mergeBytes);
 const extra={qualification_method:'ZERO_DELTA_MERGE_DERIVATION',qcp_execution_subject_sha:source,merge_derivation_ref:'merge-derivation.json',
  merge_derivation_sha256:c.sha(mergeBytes),qcp_executed_at_subject:false,raw_reports_rewritten:false};
 const proofFile=path.join(e,f.q.qcp_proof_ref),proof=c.read(proofFile);
 Object.assign(proof,extra,{qcp_artifact_sha256:sourceArtifactSha,first_parent_hop_count:2});
 fs.writeFileSync(proofFile,JSON.stringify(proof));f.q.qcp_proof_sha256=c.sha(fs.readFileSync(proofFile));
 for(const row of f.q.checks){
  const checkFile=path.join(e,row.evidence_ref),data=c.read(checkFile);Object.assign(data,extra,{qcp_artifact_sha256:sourceArtifactSha});
  fs.writeFileSync(checkFile,JSON.stringify(data));row.sha256=c.sha(fs.readFileSync(checkFile));
 }
 f.sign();return {f,extra,proofFile,e};
}
test('merged_formal_sign_verify_roundtrip',()=>{
 const {f,extra,proofFile,e}=mergedFormalFixture();
 const candidate={subject_sha:f.q.subject_sha,...extra};
 assert.equal(v.validateMergedDerivation(f.q.subject_sha,c.read(proofFile),f.q.checks,e,candidate),true);
 const result=v.verifyFormal(f.request,f.policy,f.root,{now:f.now,host:'fixture-host',environment:f.environment});
 assert.equal(result.production_authorized,false);assert.equal(v.isFormalVerified(result),true);
});
test('merged_formal_accepts_successor_observed_main_distinct_from_subject',()=>{
 const {f,proofFile,e}=mergedFormalFixture('f'.repeat(40));
 const proof=c.read(proofFile);
 assert.equal(v.validateMergedDerivation(f.q.subject_sha,proof,f.q.checks,e),true);
 const result=v.verifyFormal(f.request,f.policy,f.root,{now:f.now,host:'fixture-host',environment:f.environment});
 assert.equal(v.isFormalVerified(result),true);
});
test('merged_formal_accepts_real_historical_first_parent_hops',()=>{
 const {f,proofFile}=mergedFormalFixture(),proof=c.read(proofFile);
 // The real source QCP reports hop_count=92, and merged proof increments by one.
 proof.first_parent_hop_count=93;fs.writeFileSync(proofFile,JSON.stringify(proof));
 f.q.qcp_proof_sha256=c.sha(fs.readFileSync(proofFile));f.sign();
 const result=v.verifyFormal(f.request,f.policy,f.root,{now:f.now,host:'fixture-host',environment:f.environment});
 assert.equal(v.isFormalVerified(result),true);
});
test('merged_formal_rejects_source_zip_tamper',()=>{
 const {f,e}=mergedFormalFixture();fs.appendFileSync(path.join(e,'source-qcp-artifact.zip'),'tamper');
 assert.throws(()=>v.verifyFormal(f.request,f.policy,f.root,{now:f.now,host:'fixture-host',environment:f.environment}),/OFFLINE_MERGE_SOURCE_ARTIFACT_DRIFT/);
});
test('merged_formal_rejects_derived_check_tamper_even_with_resigned_row',()=>{
 const {f,e}=mergedFormalFixture(),row=f.q.checks[0],file=path.join(e,row.evidence_ref),data=c.read(file);
 data.qcp_execution_subject_sha='9'.repeat(40);fs.writeFileSync(file,JSON.stringify(data));row.sha256=c.sha(fs.readFileSync(file));f.sign();
 assert.throws(()=>v.verifyFormal(f.request,f.policy,f.root,{now:f.now,host:'fixture-host',environment:f.environment}),/OFFLINE_MERGE_CHECK_NOT_BOUND/);
});
test('merged_formal_rejects_forged_first_parent_even_with_resigned_proof',()=>{
 const {f,proofFile,e}=mergedFormalFixture(),file=path.join(e,'merge-derivation.json'),merge=c.read(file),proof=c.read(proofFile);
 merge.parents.reverse();fs.writeFileSync(file,c.canonical(merge)+'\n');proof.merge_derivation_sha256=c.sha(fs.readFileSync(file));
 fs.writeFileSync(proofFile,JSON.stringify(proof));f.q.qcp_proof_sha256=c.sha(fs.readFileSync(proofFile));
 for(const row of f.q.checks){const p=path.join(e,row.evidence_ref),ev=c.read(p);ev.merge_derivation_sha256=proof.merge_derivation_sha256;fs.writeFileSync(p,JSON.stringify(ev));row.sha256=c.sha(fs.readFileSync(p));}
 f.sign();
 assert.throws(()=>v.verifyFormal(f.request,f.policy,f.root,{now:f.now,host:'fixture-host',environment:f.environment}));
});
test('formal_signed_adoption_activates_test_only_without_repo_boolean',()=>{
 const f=formalFixture(),r=v.verifyFormal(f.request,f.policy,f.root,{now:f.now,host:'fixture-host',environment:f.environment});
 assert.equal(v.isFormalVerified(r),true);assert.equal(r.scope,'TEST_ONLY');assert.equal(r.execution_authorized,true);assert.equal(r.production_authorized,false);
});
function scopedOperatorFixture(){
 const f=formalFixture(),i=f.policy.issuers[0];i.role='ACCOUNTABLE_SINGLE_OPERATOR';i.issuer_id=f.policy.operator_id;f.q.issuer_id=i.issuer_id;
 i.formal_adoption_scope=Object.fromEntries(['subject_sha','material_digest','host_id','operator_id','scope'].map(k=>[k,f.q[k]]));f.sign();return f;
}
test('scoped_operator_formal_signature_roundtrip',()=>{const f=scopedOperatorFixture();v.assertFormalIssuer(f.policy.issuers[0],f.policy,f.q);assert.equal(v.isFormalVerified(verify(f)),true);});
for(const field of ['subject_sha','material_digest','host_id','operator_id','scope'])test('operator_scope_rejects_'+field,()=>{
 const f=scopedOperatorFixture();f.policy.issuers[0].formal_adoption_scope[field]='wrong';f.sign();
 assert.throws(()=>v.assertFormalIssuer(f.policy.issuers[0],f.policy,f.q));assert.throws(()=>verify(f));
});
test('formal_signer_to_offline_verifier_scoped_operator',()=>{
 const f=scopedOperatorFixture(),dir=fs.mkdtempSync(path.join(tmp,'signer-')),toolRoot=path.join(dir,'tooling','scripts','cap09_adoption_v1');fs.mkdirSync(toolRoot,{recursive:true});
 // Copy tools into an isolated synthetic repository; never edit the real trust file.
 for(const name of ['signer.cjs','offline-context.cjs','installed-material.cjs','contract.cjs'])fs.copyFileSync(path.join(__dirname,name),path.join(toolRoot,name));
 f.policy.host_id=os.hostname();f.q.host_id=os.hostname();f.policy.issuers[0].formal_adoption_scope.host_id=os.hostname();f.sign();
 fs.writeFileSync(path.join(toolRoot,'offline-trust.json'),JSON.stringify(f.policy));
 const q=f.q,candidate={schema:'MCFT_CAP09_ADOPTION_CANDIDATE_V1',subject_sha:q.subject_sha,scope:q.scope,checks:q.checks,frozen_paths:108,first_parent_proven:true,qcp_proof_ref:q.qcp_proof_ref,qcp_proof_sha256:q.qcp_proof_sha256,qcp_artifact_sha256:'a'.repeat(64),engineering_check_id:'A44_ADOPTION_QUALIFICATION_LOCAL_EXECUTION_ADMISSION_ENGINEERING_ONLY',release_binding_ref:q.release_binding_ref,release_binding_sha256:q.release_binding_sha256,installed_material_required:true,signature_required:true,execution_authorized:false,production_authorized:false};
 const candidatePath=path.join(f.request.evidence_root,'candidate.json'),materialPath=path.join(dir,'material.json'),keyPath=path.join(dir,'synthetic-key.pem'),out=path.join(dir,'signed.json');
 fs.writeFileSync(candidatePath,JSON.stringify(candidate));fs.writeFileSync(materialPath,JSON.stringify(f.request.material));fs.writeFileSync(keyPath,f.pair.privateKey.export({type:'pkcs8',format:'pem'}));
 const child=path.join(dir,'sign.cjs');fs.writeFileSync(child,`const s=require(${JSON.stringify(path.join(toolRoot,'signer.cjs'))});s.formalAdoption(...JSON.parse(process.argv[2]));`);
 const result=cp.spawnSync(process.execPath,[child,JSON.stringify([candidatePath,materialPath,f.root,keyPath,1,out,f.now])],{encoding:'utf8',env:f.environment});assert.equal(result.status,0,result.stderr);
 const verified=v.verifyFormal(c.read(out),f.policy,f.root,{now:f.now,host:os.hostname(),environment:f.environment});assert.equal(v.isFormalVerified(verified),true);assert.equal(verified.production_authorized,false);
 for(const field of ['subject_sha','material_digest','host_id','operator_id','scope']){
  const changed=structuredClone(f.policy);changed.issuers[0].formal_adoption_scope[field]='wrong';fs.writeFileSync(path.join(toolRoot,'offline-trust.json'),JSON.stringify(changed));
  const deniedOut=path.join(dir,'denied-'+field+'.json');
  const denied=cp.spawnSync(process.execPath,[child,JSON.stringify([candidatePath,materialPath,f.root,keyPath,1,deniedOut,f.now])],{encoding:'utf8',env:f.environment});
  assert.notEqual(denied.status,0,field);assert.equal(fs.existsSync(deniedOut),false,field);
 }
 // Genuine signer module + verifier roundtrip with scope DETACHED from the
 // immutable policy; no unreviewed production or Host authority is created.
 delete f.policy.issuers[0].formal_adoption_scope;
 f.sign();
 fs.writeFileSync(path.join(toolRoot,'offline-trust.json'),JSON.stringify(f.policy));
 const g={schema:'MCFT_CAP09_OPERATOR_ADOPTION_SCOPE_GRANT_V1',issuer_id:f.q.issuer_id,key_id:f.policy.issuers[0].key_id,
  subject_sha:f.q.subject_sha,material_digest:f.q.material_digest,host_id:f.q.host_id,operator_id:f.q.operator_id,
  scope:'TEST_ONLY',policy_digest:c.digest(f.policy),not_before:new Date(f.now-1000).toISOString(),
  not_after:new Date(f.now+120000).toISOString(),production_authorized:false,authority_ref:'fixture-review-verified-operator-authority'};
 const grant={payload:g,signature_base64:crypto.sign(null,Buffer.from(v.SCOPE_GRANT_DOMAIN+c.canonical(g)),f.pair.privateKey).toString('base64')};
 const grantFile=path.join(dir,'synthetic-scope-grant.json'),detachedOut=path.join(dir,'detached-adoption.json');
 fs.writeFileSync(grantFile,JSON.stringify(grant));
 const detached=cp.spawnSync(process.execPath,[child,JSON.stringify([candidatePath,materialPath,f.root,keyPath,1,detachedOut,f.now,grantFile])],{encoding:'utf8',env:f.environment});
 assert.equal(detached.status,0,detached.stderr);
 const adopted=c.read(detachedOut);
 assert.deepEqual(adopted.operator_scope_grant,grant);
 const actual=v.verifyFormal(adopted,f.policy,f.root,{now:f.now,host:os.hostname(),environment:f.environment});
 assert.equal(v.isFormalVerified(actual),true);
 const absentOut=path.join(dir,'no-grant-adoption.json');
 const absent=cp.spawnSync(process.execPath,[child,JSON.stringify([candidatePath,materialPath,f.root,keyPath,1,absentOut,f.now])],{encoding:'utf8',env:f.environment});
 assert.notEqual(absent.status,0);assert.equal(fs.existsSync(absentOut),false);
});
// Exact signed scope is detached from the immutable policy, so the frozen
// release need not hash its own post-qualification material digest recursively.
function detachedOperatorFixture(){
 const f=scopedOperatorFixture(),issuer=f.policy.issuers[0];
 delete issuer.formal_adoption_scope;
 f.sign();
 const g={schema:'MCFT_CAP09_OPERATOR_ADOPTION_SCOPE_GRANT_V1',
  issuer_id:issuer.issuer_id,key_id:issuer.key_id,subject_sha:f.q.subject_sha,
  material_digest:f.q.material_digest,host_id:f.q.host_id,
  operator_id:f.q.operator_id,scope:'TEST_ONLY',policy_digest:c.digest(f.policy),
  not_before:new Date(f.now-1000).toISOString(),not_after:new Date(f.now+120000).toISOString(),
  production_authorized:false,authority_ref:'fixture-reviewed-single-operator-exact-scope'};
 f.request.operator_scope_grant={payload:g,signature_base64:crypto.sign(null,Buffer.from(v.SCOPE_GRANT_DOMAIN+c.canonical(g)),f.pair.privateKey).toString('base64')};
 return f;
}
test('detached_scope_signed_operator_verified_without_modifying_policy',()=>{
 const f=detachedOperatorFixture(),r=verify(f);
 assert.equal(f.policy.issuers[0].formal_adoption_scope,undefined);
 assert.equal(v.isFormalVerified(r),true);
 assert.equal(r.production_authorized,false);
});
test('detached_scope_missing_grant_rejected',()=>{
 const f=detachedOperatorFixture();delete f.request.operator_scope_grant;assert.throws(()=>verify(f),/SCOPE_GRANT_REQUIRED/);
});
test('detached_scope_unsigned_payload_rejected',()=>{
 const f=detachedOperatorFixture();f.request.operator_scope_grant.signature_base64='';assert.throws(()=>verify(f));
});
for(const field of ['subject_sha','material_digest','host_id','operator_id','scope','policy_digest','issuer_id','key_id','authority_ref'])
 test('detached_scope_tamper_'+field,()=>{
  const f=detachedOperatorFixture();f.request.operator_scope_grant.payload[field]='corrupted';
  assert.throws(()=>verify(f));
 });
test('detached_scope_resigned_wrong_material_rejected',()=>{
 const f=detachedOperatorFixture(),g=f.request.operator_scope_grant.payload;
 g.material_digest='f'.repeat(64);
 f.request.operator_scope_grant.signature_base64=crypto.sign(null,Buffer.from(v.SCOPE_GRANT_DOMAIN+c.canonical(g)),f.pair.privateKey).toString('base64');
 assert.throws(()=>verify(f),/SCOPE_GRANT_BINDING_MISMATCH/);
});
test('detached_scope_expired_rejected',()=>{
 const f=detachedOperatorFixture();f.request.operator_scope_grant.payload.not_after=new Date(f.now-1).toISOString();
 assert.throws(()=>verify(f));
});
test('detached_scope_policy_self_activation_rejected',()=>{
 const f=detachedOperatorFixture();f.policy.adopted=true;f.sign();assert.throws(()=>verify(f));
});
test('detached_scope_revoked_issuer_rejected',()=>{
 const f=detachedOperatorFixture();f.policy.issuers[0].revoked=true;f.sign();assert.throws(()=>verify(f));
});
test('detached_scope_production_grant_rejected',()=>{
 const f=detachedOperatorFixture(),g=f.request.operator_scope_grant.payload;
 g.production_authorized=true;
 f.request.operator_scope_grant.signature_base64=crypto.sign(null,Buffer.from(v.SCOPE_GRANT_DOMAIN+c.canonical(g)),f.pair.privateKey).toString('base64');
 assert.throws(()=>verify(f),/PRODUCTION_FORBIDDEN/);
});
test('detached_scope_independent_issuer_rejects_unneeded_grant',()=>{
 const f=detachedOperatorFixture();f.policy.issuers[0].role='INDEPENDENT_GOVERNANCE';f.q.issuer_id=f.policy.issuers[0].issuer_id;f.sign();assert.throws(()=>verify(f));
});
test('operator_scope_unknown_field_rejected',()=>{const f=scopedOperatorFixture();f.policy.issuers[0].formal_adoption_scope.extra=true;f.sign();assert.throws(()=>verify(f));});
test('operator_scope_policy_tamper_rejected',()=>{const f=scopedOperatorFixture();f.policy.issuers[0].formal_adoption_scope.host_id='other';assert.throws(()=>verify(f));});
test('operator_scope_revoked_rejected',()=>{const f=scopedOperatorFixture();f.policy.issuers[0].revoked=true;f.sign();assert.throws(()=>verify(f));});
test('v2_signed_subject_reaches_actual_host_review_gate',()=>{
 const f=formalFixture(),identity='scripts/runtime_acceptance/MCFT_CAP09_QUALIFICATION_EVIDENCE_IDENTITY_V1.cjs';
 fs.copyFileSync(path.join(__dirname,'../runtime_acceptance/MCFT_CAP09_QUALIFICATION_EVIDENCE_IDENTITY_V1.cjs'),path.join(f.root,identity));
 const entry='scripts/cap09_adoption_v1/da9-retry-bundle-v2.cjs';fs.mkdirSync(path.dirname(path.join(f.root,entry)),{recursive:true});fs.copyFileSync(path.join(__dirname,'da9-retry-bundle-v2.cjs'),path.join(f.root,entry));
 f.request.material.files=m.inventory(f.root);
 const releasePath=path.join(f.request.evidence_root,f.q.release_binding_ref),release=c.read(releasePath);
 release.source_tree_git_sha='d'.repeat(40);release.files.push({...f.request.material.files.find(x=>x.path===identity),mode:'100644',category:'synthetic-fixture'});
 release.files.push({...f.request.material.files.find(x=>x.path===entry),mode:'100644',category:'synthetic-fixture'});
 release.content_inventory_sha256=c.digest(release.files);fs.writeFileSync(releasePath,JSON.stringify(release));f.q.release_binding_sha256=c.sha(fs.readFileSync(releasePath));f.sign();
 const context=verify(f),v2=require('./da9-retry-bundle-v2.cjs'),host=require('../runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs');
 const binding=v2.subjectBinding(context);assert.equal(binding.subject_sha,f.q.subject_sha);assert.equal(binding.subject_tree_digest,release.source_tree_git_sha);
 const trust={schema_version:'geox_mcft_cap09_retry_trust_v1',operator_id:'fixture-operator',issuers:[{...f.policy.issuers[0],role:'INDEPENDENT_RETRY_GOVERNANCE'}]};
 const d=v2.draft('fixture_v2_review',context);Object.assign(d,{review_status:'APPROVED',reviewer_id:trust.issuers[0].issuer_id,review_authority_ref:'synthetic-review-not-live',supersession_rationale:'POSTMERGE_V13_PRODUCER_CORE_FORMAL_RAW_BUCKET_REQUIRED is preserved. The first Provider call count remains unknown. This isolated TEST_ONLY candidate does not claim absence of effects.',review_policy_sha256:c.digest(trust),review_issued_at:new Date(f.now).toISOString(),authorized_at:new Date(f.now).toISOString(),retry_admissible:true,prior_denial_explicitly_superseded:true});
 const decision=v2.signReviewPayload(d,trust,f.pair.privateKey,d.reviewer_id,trust.issuers[0].key_id,f.now,binding);
 const bundle={arm:{run_id:v2.RUN,protected_main_sha:f.q.subject_sha,retry_adjudication:decision}};
 host.validateSuccessorReview(bundle,trust,context,f.now);
 assert.throws(()=>host.validateSuccessorReview(bundle,trust,{...context},f.now),/VERIFIED_ADOPTION_CONTEXT_REQUIRED/);
 delete bundle.arm.retry_adjudication.review_contract_version;assert.throws(()=>host.validateSuccessorReview(bundle,trust,context,f.now),/DA9_SUCCESSOR_REQUIRES_V2_REVIEW/);
});
test('formal_context_cannot_be_fabricated',()=>{assert.equal(v.isFormalVerified(Object.freeze({execution_authorized:true,production_authorized:false})),false);});
test('formal_signed_adoption_rejects_policy_self_activation',()=>{const f=formalFixture();f.policy.adopted=true;f.sign();assert.throws(()=>v.verifyFormal(f.request,f.policy,f.root,{now:f.now,host:'fixture-host',environment:f.environment}));});
test('formal_signed_adoption_rejects_legacy_operator_issuer',()=>{
 const f=formalFixture();f.policy.issuers[0].role='ACCOUNTABLE_SINGLE_OPERATOR';f.sign();
 assert.throws(()=>v.verifyFormal(f.request,f.policy,f.root,{now:f.now,host:'fixture-host',environment:f.environment}),/OFFLINE_INDEPENDENT_ADOPTION_ISSUER_REQUIRED/);
});
test('formal_signed_adoption_rejects_missing_check',()=>{const f=formalFixture();f.q.checks.pop();f.sign();assert.throws(()=>v.verifyFormal(f.request,f.policy,f.root,{now:f.now,host:'fixture-host',environment:f.environment}));});
test('formal_signed_adoption_rejects_definition_revision_drift',()=>{const f=formalFixture();f.q.checks[0].revision='0'.repeat(64);f.sign();assert.throws(()=>v.verifyFormal(f.request,f.policy,f.root,{now:f.now,host:'fixture-host',environment:f.environment}));});
test('formal_signed_adoption_rejects_unapproved_not_applicable',()=>{const f=formalFixture();f.q.checks[0].result='NOT_APPLICABLE';f.q.checks[0].reason='fixture';f.sign();assert.throws(()=>v.verifyFormal(f.request,f.policy,f.root,{now:f.now,host:'fixture-host',environment:f.environment}));});
test('formal_signed_adoption_rejects_rebound_installed_source',()=>{
 const f=formalFixture(),entry=path.join(f.root,'entry.cjs');
 fs.appendFileSync(entry,'\nchanged after Git adoption');
 f.request.material.files=m.inventory(f.root);f.sign();
 assert.throws(()=>v.verifyFormal(f.request,f.policy,f.root,{now:f.now,host:'fixture-host',environment:f.environment}),/OFFLINE_RELEASE_SOURCE_DRIFT/);
});
test('formal_signed_adoption_rejects_tampered_release_inventory',()=>{
 const f=formalFixture(),file=path.join(f.request.evidence_root,f.q.release_binding_ref),release=JSON.parse(fs.readFileSync(file,'utf8'));
 release.files[0].sha256='f'.repeat(64);fs.writeFileSync(file,JSON.stringify(release));f.q.release_binding_sha256=c.sha(fs.readFileSync(file));f.sign();
 assert.throws(()=>v.verifyFormal(f.request,f.policy,f.root,{now:f.now,host:'fixture-host',environment:f.environment}),/OFFLINE_RELEASE_INVENTORY_DIGEST_CHANGED/);
});
test('formal_signed_adoption_rejects_qcp_blocker',()=>{const f=formalFixture(),file=path.join(f.request.evidence_root,f.q.qcp_proof_ref),proof=JSON.parse(fs.readFileSync(file,'utf8'));proof.blocker_count=1;fs.writeFileSync(file,JSON.stringify(proof));f.q.qcp_proof_sha256=c.sha(fs.readFileSync(file));f.sign();assert.throws(()=>v.verifyFormal(f.request,f.policy,f.root,{now:f.now,host:'fixture-host',environment:f.environment}));});

// A valid signer and internally consistent digests must not excuse missing controllers.
for(const rel of v.REQUIRED_STAGE_MATERIAL)test('formal_rejects_omitted_stage_material:'+rel,()=>{
 const f=formalFixture(),file=path.join(f.request.evidence_root,f.q.release_binding_ref),release=c.read(file);
 release.files=release.files.filter(row=>row.path!==rel);
 release.content_inventory_sha256=c.digest(release.files);
 fs.writeFileSync(file,JSON.stringify(release));f.q.release_binding_sha256=c.sha(fs.readFileSync(file));f.sign();
 assert.throws(()=>verify(f),/OFFLINE_STAGE_MATERIAL_NOT_BOUND/);
});
for(const rel of v.REQUIRED_STAGE_MATERIAL)test('formal_rejects_changed_stage_bytes:'+rel,()=>{
 const f=formalFixture();fs.appendFileSync(path.join(f.root,...rel.split('/')),'changed');
 assert.throws(()=>verify(f));
});
test('formal_signature_alone_cannot_replace_retry_permit',()=>{
 const f=formalFixture(),context=verify(f);
 const host=require('../runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs');
 const trust={...c.read(path.resolve(__dirname,'../runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json')),adopted:true,execution_enabled:true};
 const plan={schema_version:'geox_mcft_cap09_retry_stage_plan_v2',stages:host.STAGES.map(([id])=>({id,timeout_ms:1000}))};
 assert.throws(()=>host.validateBundle({arm:{},observed:{},permit:null,plan,files:{}},trust,context));
});

test('signed_controller_gate_requires_verified_context_not_boolean',()=>{
 const f=formalFixture(),context=verify(f),host=require('../runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs');
 const trust={real_delay_controller_adopted:false,stage_capability_adopted:false,real_provider_transport_delay_adopted:false,real_pipeline_delay_adopted:false};
 host.assertControllerAdoption({signedActivation:true,context,trust});
 assert.throws(()=>host.assertControllerAdoption({signedActivation:true,context:{...context},trust}),/OFFLINE_ADOPTION_VERIFICATION_REQUIRED/);
 assert.throws(()=>host.assertControllerAdoption({signedActivation:false,context,trust}),/REAL_DELAY_CONTROLLER_NOT_ADOPTED/);
 const adopted=Object.fromEntries(Object.keys(trust).map(k=>[k,true]));
 host.assertControllerAdoption({signedActivation:false,trust:adopted});
 for(const key of Object.keys(adopted))assert.throws(()=>host.assertControllerAdoption({signedActivation:false,trust:{...adopted,[key]:false}}));
 const source=fs.readFileSync(path.resolve(__dirname,'../runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs'),'utf8');
 for(const [start,end] of [['async function main','function childTargets'],['function childTargets','module.exports']]){
  const body=source.slice(source.indexOf(start),source.indexOf(end));
  const gate=body.indexOf('assertControllerAdoption(h);');assert(gate>=0);
  const consumption=body.indexOf(start==='async function main'?'permitApi.consumePermit':'stageCap.consumeStageCapability');
  assert(consumption>gate,'CONTROLLER_ADOPTION_MUST_PRECEDE_CONSUMPTION');
 }
});

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

test('installed_material_collector_roundtrip',()=>{
 const dir=fs.mkdtempSync(path.join(tmp,'collector-')),root=path.join(dir,'release'),out=path.join(dir,'material.json');fs.mkdirSync(root);fs.writeFileSync(path.join(root,'entry.cjs'),'fixture');
 const node=fs.realpathSync(process.execPath),env={MCFT_PYTHON_EXECUTABLE:node,PATH:'fixture'};const r=m.collect(root,node,node,out,env),profile=c.read(out);
 assert.equal(r.status,'INSTALLED_MATERIAL_COLLECTED_AND_SELF_VERIFIED');assert.equal(m.verify(profile,root,env).digest,r.profile_sha256);assert.equal(r.execution_authorized,false);assert.equal(r.production_authorized,false);
});

test('installed_material_collector_allows_exact_signed_child_stage_names',()=>{
 const dir=fs.mkdtempSync(path.join(tmp,'child-stage-')),root=path.join(dir,'release'),out=path.join(dir,'profile.json');fs.mkdirSync(root);fs.writeFileSync(path.join(root,'one.cjs'),'fixture');
 const node=fs.realpathSync(process.execPath),env={MCFT_PYTHON_EXECUTABLE:node,PATH:'fixed'},p=m.collect(root,node,node,out,env),profile=c.read(out);
 // V1 names remain frozen; Attempt-3 adds six explicit child-only keys.
 const v2=['MCFT_ATTEMPT3_V2_CHILD','MCFT_ATTEMPT3_V2_LEDGER_ROOT',
  'MCFT_ATTEMPT3_V2_NONCE','MCFT_ATTEMPT3_V2_PERMIT_ENVELOPE_SHA256',
  'MCFT_ATTEMPT3_V2_OBSERVED_FILE','MCFT_ATTEMPT3_V2_OBSERVATIONS_SHA256'];
 assert.equal(m.CHILD_STAGE_ENVIRONMENT_NAMES.length,25);
 assert.equal(new Set(m.CHILD_STAGE_ENVIRONMENT_NAMES).size,25);
 for(const name of v2)assert(m.CHILD_STAGE_ENVIRONMENT_NAMES.includes(name),'V2_CHILD_ENV_NOT_IN_SIGNED_MATERIAL:'+name);
 const child={...env,MCFT_SUBJECT_SHA:'a'.repeat(40),MCFT_GOVERNED_RETRY_STAGE:'PRODUCER',MCFT_GOVERNED_RETRY_TICKET:'fixture-ticket'};
 assert.equal(m.verify(profile,root,child).digest,p.profile_sha256);
 child.NODE_OPTIONS='--require untrusted';assert.throws(()=>m.verify(profile,root,child));
});
test('real_formal_verified_successor_context_binds_pinned_historical_DA9_closure',()=>{
 const f=formalFixture(),context=v.verifyFormal(f.request,f.policy,f.root,{now:f.now,host:'fixture-host',environment:f.environment});
 assert.equal(v.isFormalVerified(context),true);
 const closure=require('./da9-minio-closure-v1.cjs');
 const {fixture:historicalFixture}=require('./test-da9-minio-closure-v1.cjs');
 const h=historicalFixture(closure.HISTORICAL_DA9_CLOSURE_SUBJECT);
 const accepted=closure.verifyAdmission(h.closure,h.e,h.trust,h.fresh,context.head,h.now,context);
 assert.equal(accepted.status,'CLOSURE_VERIFIED_FOR_DA9_ADMISSION');
 assert.equal(accepted.historical_carry_forward,true);
 assert.equal(accepted.subject_sha,closure.HISTORICAL_DA9_CLOSURE_SUBJECT);
 assert.equal(accepted.test_only_admission_authorized,false);
 assert.equal(accepted.production_authorized,false);
 assert.throws(()=>closure.verifyAdmission(h.closure,h.e,h.trust,h.fresh,context.head,h.now,{...context}),/CLOSURE_SUCCESSOR_SIGNED_ADOPTION_REQUIRED/);
 assert.throws(()=>closure.verifyAdmission(h.closure,h.e,h.trust,h.fresh,'c'.repeat(40),h.now,context),/CLOSURE_SUCCESSOR_ADOPTION_SUBJECT_MISMATCH/);
 assert.throws(()=>closure.verifyAdmission(h.closure,h.e,h.trust,h.fresh,context.head,h.now+70000,context),/CLOSURE_SUCCESSOR_ADOPTION_EXPIRED/);
});
test('fixed_production_policy_disabled',()=>{assert.equal(c.read(v.POLICY).adopted,false);assert.throws(()=>v.load(path.join(tmp,'missing.json'),tmp));});
console.log(JSON.stringify({status:'PASS',checks,synthetic_material_and_signer:true,real_execution_authorized:false,windows_host_attested:false}));
