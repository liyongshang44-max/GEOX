"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const gate=require("./MCFT_CAP09_RETRY_TRUST_V2_SUCCESSION_V1.cjs");
const root=path.resolve(__dirname,"../..");
const old=fs.readFileSync(path.join(__dirname,"MCFT_CAP09_RETRY_TRUST_V1.json"));
const v2=fs.readFileSync(path.join(__dirname,"MCFT_CAP09_RETRY_TRUST_V2.json"));
const clone=x=>JSON.parse(JSON.stringify(x));
test("pending V2 cannot authorize or sign",()=>{
 const r=gate.candidate(old,v2,{allowFuture:true});
 assert.equal(r.authorized,false);assert.equal(r.permit_authorized,false);
 assert.match(r.status,/(HOLD|NOT_AUTHORIZED)/);
 if(process.platform!=="win32"||process.env.CI||process.env.GITHUB_ACTIONS)
  assert.throws(()=>gate.verifyEffective(),/TRUST_V2_WINDOWS_NATIVE_ONLY/);
});
test("old Trust V1 exact issuer, frozen capability and ledger must remain",()=>{
 const j=JSON.parse(v2);j.issuers[0].not_after="2099-01-01T00:00:00.000Z";
 assert.throws(()=>gate.candidate(old,Buffer.from(JSON.stringify(j))),/OLD_ISSUER_CHANGED/);
 for(const k of ["ledger_root","adopted","execution_enabled"]){
  const z=JSON.parse(v2);z[k]=k==="ledger_root"?"C:\\unsafe":true;
  assert.throws(()=>gate.candidate(old,Buffer.from(JSON.stringify(z))),/FROZEN_FIELD_DRIFT/);
 }
});
test("no synthetic self-approval can activate",()=>{
 const j=JSON.parse(v2);
 j.succession.owner_registration_approval={approved:true};
 assert.throws(()=>gate.candidate(old,Buffer.from(JSON.stringify(j))),/SELF_APPROVAL_FORBIDDEN/);
});

test("synthetic successor public key still requires independent Owner approval",()=>{
 const crypto=require("node:crypto");
 const pair=crypto.generateKeyPairSync("ed25519");
 const digest=crypto.createHash("sha256").update(pair.publicKey.export({format:"der",type:"spki"})).digest("hex");
 const j=JSON.parse(v2),now=Date.now();
 const future=d=>new Date(now+d).toISOString();
 const key={issuer_id:"mcft_cap09_operator_mylr1",key_id:"mcft_cap09_operator_v2_"+digest.slice(0,16),
  role:"ACCOUNTABLE_SINGLE_OPERATOR",revoked:false,not_before:future(-1000),
  not_after:future(86400000),public_key_pem:pair.publicKey.export({format:"pem",type:"spki"}),spki_sha256:digest};
 j.issuers[2]=key;j.succession.operator_successor_key_id=key.key_id;
 j.succession.registration_state="PENDING_INDEPENDENT_OWNER_AUTHORITY";
 assert.equal(gate.candidate(old,Buffer.from(JSON.stringify(j))).authorized,false);
 j.succession.owner_registration_approval={approved:true};
 assert.throws(()=>gate.candidate(old,Buffer.from(JSON.stringify(j))),/SELF_APPROVAL_FORBIDDEN/);
});

// Bound future-window registration candidate is source-qualified only, never authorized.
test("exact public key and 88-day future window stay not authorized",()=>{
 const crypto=require("node:crypto");
 const j=JSON.parse(v2),k=j.issuers[2];
 const r=gate.candidate(old,v2,{allowFuture:true});
 assert.equal(j.issuers.length,3);
 assert.equal(k.key_id,"mcft_cap09_operator_v2_0b4811f1f4bf09ec");
 assert.equal(k.spki_sha256,"0b4811f1f4bf09ec3f633c0900b405d56a8f28e55b8d6d7819d0f2295d86e6af");
 assert.equal(crypto.createHash("sha256").update(crypto.createPublicKey(k.public_key_pem).export({type:"spki",format:"der"})).digest("hex"),k.spki_sha256);
 assert.equal(k.not_before,"2026-11-20T00:00:00.000Z");
 assert.equal(k.not_after,"2027-02-16T00:00:00.000Z");
 assert.equal((Date.parse(k.not_after)-Date.parse(k.not_before))/86400000,88);
 assert(Date.parse(k.not_before)>Date.parse("2026-11-15T05:03:42.000Z"));
 assert.equal(j.succession.registration_state,"PENDING_INDEPENDENT_OWNER_AUTHORITY");
 assert.equal(r.status,"TRUST_V2_PUBLIC_KEY_CANDIDATE_ONLY_NOT_AUTHORIZED");
 assert.equal(r.registered,false);assert.equal(r.authorized,false);
 assert.equal(r.permit_authorized,false);assert.equal(j.succession.owner_registration_approval,null);
 assert.equal(j.succession.trust_successor_activated,false);
 assert.equal(j.execution_enabled,false);assert.equal(j.adopted,false);
});
test("future window never qualifies before activation or at expiry",()=>{
 const j=JSON.parse(v2),k=j.issuers[2],begin=Date.parse(k.not_before),end=Date.parse(k.not_after);
 assert.throws(()=>gate.candidate(old,v2,{now:begin-1}),/TRUST_V2_WINDOW_NOT_ELIGIBLE/);
 const during=gate.candidate(old,v2,{now:begin});
 assert.equal(during.authorized,false);assert.equal(during.registered,false);
 assert.throws(()=>gate.candidate(old,v2,{now:end}),/TRUST_V2_WINDOW_NOT_ELIGIBLE/);
});
test("partial window, invalid time, excessive duration and forged registration fail closed",()=>{
 const base=JSON.parse(v2),mutate=(fn,reason)=>{
  const j=JSON.parse(JSON.stringify(base));fn(j);
  assert.throws(()=>gate.candidate(old,Buffer.from(JSON.stringify(j)),{allowFuture:true}),reason);
 };
 mutate(j=>{j.issuers[2].not_before=null},/TRUST_V2_NEW_KEY_TIME/);
 mutate(j=>{j.issuers[2].not_after=null},/TRUST_V2_NEW_KEY_TIME/);
 mutate(j=>{j.issuers[2].not_before="2026-11-20T00:00:00Z"},/TRUST_V2_NEW_KEY_TIME/);
 mutate(j=>{j.issuers[2].not_after="2027-03-31T00:00:00.000Z"},/TRUST_V2_WINDOW_NOT_ELIGIBLE/);
 mutate(j=>{j.issuers[2].not_after=j.issuers[2].not_before},/TRUST_V2_WINDOW_NOT_ELIGIBLE/);
 mutate(j=>{j.succession.registration_state="PENDING_INDEPENDENT_OWNER_AUTHORITY_AND_EFFECTIVE_WINDOW"},/PENDING_INDEPENDENT_OWNER_AUTHORITY/);
 mutate(j=>{j.issuers[2].spki_sha256="a".repeat(64)},/TRUST_V2_SPKI_DRIFT/);
 mutate(j=>{j.issuers[2].revoked=true},/TRUST_V2_NEW_KEY_REVOKED/);
 mutate(j=>{j.issuers[2].key_id="other"},/TRUST_V2_KEY_ID_UNBOUND/);
 mutate(j=>{j.succession.owner_registration_approval={approved:true}},/TRUST_V2_SELF_APPROVAL_FORBIDDEN/);
});

// Successor regression fixtures are synthetic evidence only, never native PASS.
const crypto=require('node:crypto'),cp=require('node:child_process'),os=require('node:os');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function registrationFixture(){
 const registered='1f1e2704543924560139e7ec05c67a6d06f5dc45',source='e8a81fcd82c3acbbc3564b77f87c7e6e664f4d32';
 const auth={schema_version:'MCFT_CAP09_TRUST_V2_EXACT_OWNER_MERGE_PROOF_V1',pr_number:3772,
  approval_comment_id:6889774463,expected_merge_commit_sha:registered,expected_source_head_sha:source,trust_v2_sha256:hash(v2)};
 const state=gate.candidate(old,v2,{now:Date.parse('2026-11-20T00:00:00.000Z')});
 const body={decision:'APPROVE_R4285_TRUST_V2_EXACT_REGISTRATION_NOT_PERMIT',pr_number:3772,
  source_head_sha:source,trust_v2_sha256:hash(v2),spki_sha256:state.spki_sha256,key_id:state.key_id,
  registration_scope:'CAP09_ISOLATED_TEST_ONLY',production_authorized:false,permit_authorized:false};
 const live={origin:{merged:true,merged_by:{login:'liyongshang44-max'}},
  pr:{number:3772,state:'closed',merged:true,merged_by:{login:'liyongshang44-max'},merge_commit_sha:registered,
   head:{sha:source},base:{sha:'9ed82b7c92c7e0ecaaa53a452568e7def7f8a8e6'},merged_at:'2026-11-15T05:34:44Z'},
  commit:{sha:registered,parents:[{sha:'9ed82b7c92c7e0ecaaa53a452568e7def7f8a8e6'},{sha:source}],tree:{sha:'a'.repeat(40)}},
  head:{sha:source,tree:{sha:'a'.repeat(40)}},approved:{user:{login:'liyongshang44-max'},author_association:'OWNER',
   created_at:'2026-11-15T05:30:06Z',updated_at:'2026-11-15T05:30:06Z',issue_url:'https://api.github.com/repos/liyongshang44-max/GEOX/issues/3772',body:JSON.stringify(body)},
  rules:[{name:'main-strict-delivery-v1',enforcement:'active'}]};
 return {auth,state,live};
}
function storedZip(raw){
 const name=Buffer.from('MCFT_CAP_09_ALL_BLOCKERS_PREFLIGHT_V1_RESULT.json');
 // Ordinary uncompressed ZIP with CRC32, usable by the real artifact parser.
 let crc=0xffffffff;for(const b of raw){crc^=b;for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
 const local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22);
 local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt32LE(crc,14);
 local.writeUInt32LE(raw.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(name.length,26);
 central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt32LE(crc,16);
 central.writeUInt32LE(raw.length,20);central.writeUInt32LE(raw.length,24);central.writeUInt16LE(name.length,28);
 end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);
 end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(local.length+name.length+raw.length,16);
 return Buffer.concat([local,name,raw,central,name,end]);
}
function successorFixture(){
 const subject='b'.repeat(40),source='c'.repeat(40),base='d'.repeat(40),repo='liyongshang44-max/GEOX';
 const definitions=JSON.parse(fs.readFileSync(path.join(root,'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json')));
 const results=definitions.checks.map((c,i)=>i===73?{check_id:c.check_id,status:'PASS'}:{check_id:c.check_id,status:'NOT_APPLICABLE',reason_code:'SYNTHETIC_UNIT_FIXTURE'});
 const machine={status:'PASS',head_sha:source,base_sha:base,stage:'SUCCESSOR_SUBJECT_PRE_MERGE',
  counts:{total_checks:74,pass:1,not_applicable:73,fail:0,unknown:0,forbidden:0,authority_errors:0,unknown_changed_paths:0,blocker_count:0},blockers:[],results};
 const raw=Buffer.from(JSON.stringify(machine)),zip=storedZip(raw);
 const provenance={repository:repo,pr_number:4000,base_sha:base,source_head_sha:source,subject_sha:subject,
  qcp_run_id:10,qcp_run_attempt:1,qcp_job_id:11,qcp_artifact_id:12,qcp_zip_sha256:hash(zip),qcp_raw_sha256:hash(raw),ci_run_id:13,ci_run_attempt:1};
 const live={pr:{number:4000,state:'closed',merged:true,merged_by:{login:'liyongshang44-max'},base:{sha:base},head:{sha:source,repo:{full_name:repo}},merge_commit_sha:subject},
  baseCommit:{sha:base},sourceCommit:{sha:source,tree:{sha:'e'.repeat(40)}},mergeCommit:{sha:subject,parents:[{sha:base},{sha:source}],tree:{sha:'e'.repeat(40)}},main:{object:{sha:subject}},
  qcpRun:{id:10,head_sha:source,run_attempt:1,event:'pull_request',name:'mcft-cap-09-qualification-control-plane-v1',path:'.github/workflows/mcft-cap-09-qualification-control-plane-v1.yml',status:'completed',conclusion:'success',pull_requests:[{number:4000}]},
  qcpJobs:{jobs:[{id:11,name:'applicability-and-blocker-inventory',conclusion:'success',started_at:'2026-11-20T01:00:00Z',completed_at:'2026-11-20T01:10:00Z'}]},
  qcpArtifacts:{artifacts:[{id:12,expired:false,name:'mcft-cap09-qualification-control-plane-'+source,digest:'sha256:'+hash(zip),workflow_run:{id:10,head_sha:source},created_at:'2026-11-20T01:05:00Z'}]},
  ciRun:{id:13,head_sha:source,run_attempt:1,status:'completed',conclusion:'success',name:'ci',path:'.github/workflows/ci.yml',event:'pull_request'}};
 return {subject,registrationSubject:registrationFixture().auth.expected_merge_commit_sha,
  v1Raw:old,v2Raw:v2,registeredV1Raw:old,registeredV2Raw:v2,provenance,live,raw,zip,definitions};
}
test('registration remains #3772 while independently qualified successor differs',()=>{
 const r=registrationFixture();assert.equal(gate.authorityInput(r.auth),false);
 const registered=gate.verifyRegistrationProof(r.auth,r.state,v2,r.live),f=successorFixture();
 assert.notEqual(f.subject,registered.registration_subject_sha);
 assert.equal(gate.verifySubjectProof(f).subject_sha,f.subject);
 assert.equal(gate.verifySubjectProof(f).permit_authorized,false);
 assert.match(registered.status,/EVIDENCE_ONLY_NOT_EFFECTIVE/);
});
test('successor input extends proof mapping without relabelling historical approval',()=>{
 const {auth}=registrationFixture();auth.schema_version='MCFT_CAP09_TRUST_V2_REGISTERED_SUCCESSOR_PROOF_V2';
 auth.successor_proof={provenance_file:path.resolve('proof.json'),provenance_sha256:'a'.repeat(64),raw_file:path.resolve('raw.json'),zip_file:path.resolve('qcp.zip')};
 assert.equal(gate.authorityInput(auth),true);
 const bad=clone(auth);bad.successor_proof.approved=true;assert.throws(()=>gate.authorityInput(bad),/SUCCESSOR_INPUT_FIELDS/);
 const missing=clone(auth);delete missing.successor_proof;assert.throws(()=>gate.authorityInput(missing),/INPUT_SCHEMA/);
 const relative=clone(auth);relative.successor_proof.raw_file='relative.json';assert.throws(()=>gate.authorityInput(relative),/SUCCESSOR_ABSOLUTE/);
});
test('registration actor, unedited approval, scope, key, bytes, parents and rules stay mandatory',()=>{
 for(const edit of [r=>r.live.approved.user.login='other',r=>r.live.approved.updated_at='2026-11-16T00:00:00Z',
  r=>r.live.pr.merged_by.login='other',r=>r.live.origin.merged=false,r=>r.live.commit.parents.reverse(),
  r=>r.live.head.tree.sha='f'.repeat(40),r=>r.live.rules[0].enforcement='disabled',
  r=>r.auth.trust_v2_sha256='0'.repeat(64),r=>r.auth.expected_merge_commit_sha='b'.repeat(40),
  r=>{const b=JSON.parse(r.live.approved.body);b.registration_scope='PRODUCTION';r.live.approved.body=JSON.stringify(b)},
  r=>{const b=JSON.parse(r.live.approved.body);b.key_id='other';r.live.approved.body=JSON.stringify(b)}]){
  const r=registrationFixture();edit(r);assert.throws(()=>gate.verifyRegistrationProof(r.auth,r.state,v2,r.live));
 }
});
test('successor rejects changed Trust bytes, wrong Subject, Owner, merge, QCP and CI',()=>{
 for(const edit of [f=>f.registeredV2Raw=Buffer.from('{}'),f=>f.registeredV1Raw=Buffer.from('{}'),
  f=>f.provenance.subject_sha=f.registrationSubject,f=>f.live.pr.merged_by.login='other',f=>f.live.pr.merged=false,
  f=>f.live.mergeCommit.parents.reverse(),f=>f.live.mergeCommit.tree.sha='f'.repeat(40),f=>f.live.main.object.sha='f'.repeat(40),
  f=>f.live.qcpRun.conclusion='failure',f=>f.live.qcpRun.head_sha='f'.repeat(40),f=>f.live.qcpJobs.jobs[0].conclusion='failure',
  f=>f.live.qcpArtifacts.artifacts[0].expired=true,f=>f.live.ciRun.conclusion='failure',f=>f.live.ciRun.head_sha='f'.repeat(40),
  f=>f.raw=Buffer.from('{}'),f=>f.zip=Buffer.from('bad'),f=>f.provenance.qcp_raw_sha256='0'.repeat(64),
  f=>f.live.qcpArtifacts.artifacts[0].created_at='2026-11-20T02:00:00Z']){
  const f=successorFixture();edit(f);assert.throws(()=>gate.verifySubjectProof(f));
 }
});
test('raw QCP unknown paths and missing owned check cannot inherit authority',()=>{
 for(const edit of [m=>m.counts.unknown_changed_paths=1,m=>m.results[73].status='NOT_APPLICABLE']){
  const f=successorFixture(),machine=JSON.parse(f.raw);edit(machine);f.raw=Buffer.from(JSON.stringify(machine));f.zip=storedZip(f.raw);
  f.provenance.qcp_raw_sha256=hash(f.raw);f.provenance.qcp_zip_sha256=hash(f.zip);f.live.qcpArtifacts.artifacts[0].digest='sha256:'+hash(f.zip);
  assert.throws(()=>gate.verifySubjectProof(f));
 }
});
test('actual Git inheritance rejects unrelated, dirty and changed-Trust descendants',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mcft-trust-inherit-'));
 const git=(...a)=>cp.execFileSync('git',['-C',dir,...a],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const commit=()=>{git('add','.');git('-c','user.name=UnitTest','-c','user.email=unit@example.invalid','commit','-qm','fixture');return git('rev-parse','HEAD')};
 try{
  git('init','-q');git('config','core.autocrlf','false');const sub=path.join(dir,'scripts/runtime_acceptance');fs.mkdirSync(sub,{recursive:true});
  fs.writeFileSync(path.join(sub,'MCFT_CAP09_RETRY_TRUST_V1.json'),old);fs.writeFileSync(path.join(sub,'MCFT_CAP09_RETRY_TRUST_V2.json'),v2);
  const registration=commit();fs.writeFileSync(path.join(dir,'delta.txt'),'test');const successor=commit();
  assert.match(gate.verifySourceInheritance(dir,registration,successor).status,/INHERITANCE_ONLY_NOT_EFFECTIVE/);
  fs.writeFileSync(path.join(dir,'untracked.txt'),'test');assert.throws(()=>gate.verifySourceInheritance(dir,registration,successor),/WORKTREE_DIRTY/);fs.unlinkSync(path.join(dir,'untracked.txt'));
  fs.appendFileSync(path.join(sub,'MCFT_CAP09_RETRY_TRUST_V2.json'),'\n');const drift=commit();
  assert.throws(()=>gate.verifySourceInheritance(dir,registration,drift),/REGISTERED_TRUST_BYTES_CHANGED/);
  git('checkout','--orphan','unrelated');git('rm','-rf','.');fs.mkdirSync(sub,{recursive:true});
  fs.writeFileSync(path.join(sub,'MCFT_CAP09_RETRY_TRUST_V1.json'),old);fs.writeFileSync(path.join(sub,'MCFT_CAP09_RETRY_TRUST_V2.json'),v2);fs.writeFileSync(path.join(dir,'unrelated.txt'),'independent root');const unrelated=commit();
  assert.throws(()=>gate.verifySourceInheritance(dir,registration,unrelated));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

// PR3778 exact loader source qualification. Inspection never grants native PASS.
const loaderQualification=require("../governance_acceptance/VERIFY_MCFT_CAP09_R4285_TRUST_V2_SOURCE_V1.cjs");
function loaderSourceFixture(){return {base:"f74a5677b6ecd784e283c25d71e7253897df15a1",stage:"SUCCESSOR_SUBJECT_PRE_MERGE",paths:[...Object.keys(loaderQualification.LOADER_HASHES),...loaderQualification.LOADER_WIRING],hashes:{...loaderQualification.LOADER_HASHES},plan:{status:"PASS",unknown_changed_paths:[],authority_errors:[],resolver_errors:[]}};}
test("loader exact inspection binds six paths and pinned original candidate bytes without granting native qualification",()=>{
 const p=loaderSourceFixture(),result=loaderQualification.inspectLoaderDelta(p);assert.equal(result.status,"INSPECTED_EXACT_DELTA_NOT_NATIVE_QUALIFICATION");assert.equal(result.runtime_paths.length,2);assert.equal(result.qualification_wiring_paths.length,4);
});
test("loader successor rejects old base, unknown path, changed runtime and unresolved plan",()=>{
 for(const change of [p=>p.base="37dfa24ee6e60891995836f7a142a898c445d9df",p=>p.paths.push("scripts/runtime_acceptance/UNREVIEWED.cjs"),p=>p.hashes[Object.keys(p.hashes)[0]]="a".repeat(64),p=>p.plan.unknown_changed_paths.push("UNKNOWN")]){const p=loaderSourceFixture();change(p);assert.throws(()=>loaderQualification.inspectLoaderDelta(p));}
});
test("per-check source projection cannot hide changed operational dependency or missing base source",()=>{
 const base=new Map([["runtime.cjs","old"],[loaderQualification.LOADER_WIRING[0],"before"]]),head=new Map([["runtime.cjs","old"],[loaderQualification.LOADER_WIRING[0],"after"]]);
 const result=loaderQualification.loaderDependencyProjection([...base.keys()],base,head);assert.equal(result.path_count,1);assert.match(result.git_blob_catalog_sha256,/^[a-f0-9]{64}$/);
 head.set("runtime.cjs","changed");assert.throws(()=>loaderQualification.loaderDependencyProjection([...base.keys()],base,head),/LOADER_UNDECLARED_RUNTIME_QUALIFICATION_IMPACT/);
 assert.throws(()=>loaderQualification.loaderDependencyProjection(["unregistered.cjs"],base,head),/LOADER_DEPENDENCY_MISSING/);
});
