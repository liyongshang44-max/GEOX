"use strict";
// Isolated test keys only. No Windows session, real account, signer or network.
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),cp=require("node:child_process"),vm=require("node:vm"),Module=require("node:module");
const s=require("./MCFT_CAP09_R4285_SCOPE_V3.cjs"),c=require("../cap09_adoption_v1/contract.cjs");
const permit=require("./MCFT_CAP09_R4285_PERMIT_V3.cjs"),admission=require("./MCFT_CAP09_R4285_ADMISSION_V3.cjs");
const host=require("./MCFT_CAP09_R4285_WINDOWS_HOST_V3.cjs"),native=require("../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V3.cjs");
const factory=require("./MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs");
const ROOT=path.resolve(__dirname,"../.."),NOW=Date.now(),iso=n=>new Date(n).toISOString(),H="a".repeat(64),SUBJECT="b".repeat(40),NONCE="c".repeat(64);
const key=crypto.generateKeyPairSync("ed25519"),issuer={issuer_id:"UNIT_ONLY",key_id:"UNIT_ONLY",role:"ACCOUNTABLE_SINGLE_OPERATOR",revoked:false,not_before:iso(NOW-86400000),not_after:iso(NOW+86400000),public_key_pem:key.publicKey.export({type:"spki",format:"pem"}),spki_sha256:s.sha(key.publicKey.export({type:"spki",format:"der"}))};
const trust={schema_version:"geox_mcft_cap09_retry_trust_v1",host_id:s.HOST,operator_id:issuer.issuer_id,issuers:[issuer]};
const sign=(domain,payload)=>({payload,signature_base64:crypto.sign(null,Buffer.from(domain+c.canonical(payload)),key.privateKey).toString("base64")});
const id={run_id:s.RUN,host_id:s.HOST,subject_sha:SUBJECT,nonce:NONCE};
function scopePayload(){const bucket="mcft-cap09-requal-"+s.RUN,arn="arn:aws:s3:::"+bucket;
 return {schema_version:"MCFT_CAP09_R4285_SESSION_RESOURCE_SCOPE_V3",issuer_id:issuer.issuer_id,key_id:issuer.key_id,...id,scope:"ISOLATED_QUALIFICATION_TEST_ONLY",issued_at:iso(NOW-10000),expires_at:iso(NOW+18000000),production_authorized:false,
  resources:{database_host:"127.0.0.1",database_port:55492,positive_database:`mcft_cap09_requal_${s.RUN}_positive`,negative_database:`mcft_cap09_requal_${s.RUN}_negative`,positive_role:`cap09_${s.RUN}_p_evidence`,negative_role:`cap09_${s.RUN}_n_evidence`,pg_owner_id:"pgdb:101:102:unit_owner",pg_permission_sha256:H,positive_expires_at:null,negative_expires_at:iso(NOW+20000000),bucket_endpoint:"http://127.0.0.1:59292/",bucket,s3_account_sha256:s.sha("UNIT_ACCESS_ONLY"),parent_principal_sha256:H,policy_sha256:H,raw_prefix_arn:arn+"/mcft-cap09-formal-raw-v1/sha256/*",candidate_prefix_arn:arn+"/mcft-cap09-formal-candidate-v1/sha256/*",minio_deployment_id:"ddbc6bb9-eb52-4b95-8324-b556697f8c0e",s3_expires_at:iso(NOW+20000000)},
  source:{source_id:"UNIT_SOURCE_ONLY",issuer_id:issuer.issuer_id,key_id:issuer.key_id,spki_sha256:issuer.spki_sha256,policy_sha256:H,delivery_source_id:"UNIT_PIPE_ONLY"}};
}
function scoped(){return s.verifyScope(sign(s.DOMAIN,scopePayload()),trust,id,{now:NOW});}
function observation(scope,kind,raw,at=NOW-2000){return sign(s.OBS_DOMAIN,{schema_version:"MCFT_CAP09_R4285_SOURCE_OBSERVATION_V3",issuer_id:issuer.issuer_id,key_id:issuer.key_id,...id,scope_id:scope.scope_id,kind,raw_sha256:s.sha(raw),observed_at:iso(at),issued_at:iso(NOW-1000),expires_at:iso(NOW+1000000),production_authorized:false});}
test("session Scope remains fixed across independently refreshed observations; nonce, resources and source change identity",()=>{
 const scope=scoped(),raw=Buffer.from("unit source original bytes");
 const a=observation(scope,"CONTROL",raw,NOW-3000),b=observation(scope,"CONTROL",raw,NOW-2000);
 assert.notEqual(c.digest(a),c.digest(b));assert.equal(a.payload.scope_id,b.payload.scope_id);assert.equal(s.scopeId(scope.payload),scope.scope_id);
 s.verifyObservation(a,raw,"CONTROL",scope,trust,{now:NOW});
 for(const change of [p=>p.nonce="e".repeat(64),p=>p.resources.parent_principal_sha256="d".repeat(64),p=>p.source.policy_sha256="f".repeat(64)]){const p=scopePayload();change(p);assert.notEqual(s.scopeId(p),scope.scope_id);}
 assert.throws(()=>{scope.payload.resources.bucket="changed";},TypeError);
});
test("new domains, exact keys, canonical wire JSON and key revocation fail closed",()=>{
 const p=scopePayload();assert.throws(()=>s.verifyScope(sign("OLD_V2_DOMAIN\n",p),trust,id,{now:NOW}),/V3_SIGNATURE/);
 const revoked=structuredClone(trust);revoked.issuers[0].revoked=true;assert.throws(()=>s.verifyScope(sign(s.DOMAIN,p),revoked,id,{now:NOW}),/REVOCATION/);
 assert.throws(()=>s.verifyScope(sign(s.DOMAIN,{...p,control_sha256:H}),trust,id,{now:NOW}),/SCOPE_FIELDS/);
 for(const raw of ['{"a":1,"a":1}','{"a":1, "b":2}','{"b":2,"a":1}'])assert.throws(()=>s.wire(Buffer.from(raw)),/NOT_CANONICAL/);
 assert.throws(()=>s.wire(Buffer.from([0xff])),/NOT_CANONICAL/);
 assert.deepEqual(s.wire(Buffer.from('{"a":1}')),{a:1});
});
test("fresh observations reject pre-WAIT capture, changed original bytes, wrong Scope and stale clocks",()=>{
 const scope=scoped(),raw=Buffer.from("unit original"),env=observation(scope,"INVENTORY",raw);
 assert.throws(()=>s.verifyObservation(env,raw,"INVENTORY",scope,trust,{now:NOW,notBefore:NOW-500}),/FRESHNESS/);
 assert.throws(()=>s.verifyObservation(env,Buffer.from("changed"),"INVENTORY",scope,trust,{now:NOW}),/BYTES/);
 const changed=structuredClone(env.payload);changed.scope_id="d".repeat(64);assert.throws(()=>s.verifyObservation(sign(s.OBS_DOMAIN,changed),raw,"INVENTORY",scope,trust,{now:NOW}),/SCOPE/);
 assert.throws(()=>s.verifyObservation(env,raw,"INVENTORY",scope,trust,{now:NOW+120001}),/FRESHNESS/);
});
test("native-looking source inspection never creates live authority or enables secret parsing",()=>{
 const scope=scoped(),p={schema_version:"MCFT_CAP09_R4285_SOURCE_AUTHORITY_APPROVAL_V3",...id,scope_id:scope.scope_id,scope_envelope_sha256:scope.envelope_sha256,source_policy_sha256:H,source_spki_sha256:issuer.spki_sha256,delivery_source_id:scope.payload.source.delivery_source_id,valid_from:iso(NOW-1000),expires_at:iso(NOW+15000000),decision:"AUTHORIZE_EXACT_TEST_ONLY_RESOURCE_SOURCE_AND_DELIVERY",production_authorized:false};
 const raw=Buffer.from(c.canonical(p)),comment={id:123,url:"https://api.github.com/repos/liyongshang44-max/GEOX/issues/comments/123",issue_url:"https://api.github.com/repos/liyongshang44-max/GEOX/issues/3757",user:{login:"liyongshang44-max"},author_association:"OWNER",created_at:iso(NOW-2000),updated_at:iso(NOW-2000),body:raw.toString()};
 const inspected=s.inspectApproval(comment,raw,scope,{now:NOW});assert.throws(()=>s.requireApproval(inspected,scope,{now:NOW}),/LIVE_RESOURCE_SOURCE/);
 const delivery=require("./MCFT_CAP09_R4285_CREDENTIAL_DELIVERY_V3.cjs");assert.throws(()=>delivery.parse(Buffer.from("{}"),scope,trust,inspected,{now:NOW}),/LIVE_RESOURCE_SOURCE/);
 assert.throws(()=>s.inspectApproval({...comment,updated_at:iso(NOW)},raw,scope,{now:NOW}),/NATIVE_IDENTITY/);
 for(const key of delivery.KEYS)assert.throws(()=>delivery.parentClean({[key.toLowerCase()]:"unit"}),/PARENT_SECRET/);
});
test("GitHub native UTC seconds parse without relaxing canonical payload timestamps",()=>{
 const stamp="2026-11-05T12:06:39Z",millis="2026-11-05T12:06:39.000Z";
 assert.equal(s.githubUtc(stamp),Date.parse(millis));assert.equal(s.githubUtc(millis),Date.parse(millis));
 assert.equal(s.githubUtc("2026-11-05T12:06:39.123Z"),Date.parse("2026-11-05T12:06:39.123Z"));
 for(const bad of [null,0,"2026-02-30T12:06:39Z","2026-11-05T12:06:39+00:00","2026-11-05T12:06:39.0Z","2026-11-05 12:06:39Z","2026-11-05T12:06:39Z\n"])
  assert.throws(()=>s.githubUtc(bad),/V3_GITHUB_UTC/);
 assert.throws(()=>s.utc(stamp),/V3_UTC/);assert.equal(s.utc(millis),Date.parse(millis));
});
test("native source approval accepts unmodified GitHub seconds and preserves identity, bytes and time bounds",()=>{
 const scope=scoped(),created=iso(NOW-2000).replace(/\.\d{3}Z$/,"Z");
 const p={schema_version:"MCFT_CAP09_R4285_SOURCE_AUTHORITY_APPROVAL_V3",...id,scope_id:scope.scope_id,scope_envelope_sha256:scope.envelope_sha256,source_policy_sha256:H,source_spki_sha256:issuer.spki_sha256,delivery_source_id:scope.payload.source.delivery_source_id,valid_from:iso(NOW-1000),expires_at:iso(NOW+15000000),decision:"AUTHORIZE_EXACT_TEST_ONLY_RESOURCE_SOURCE_AND_DELIVERY",production_authorized:false};
 const raw=Buffer.from(c.canonical(p)),comment={id:123,url:"https://api.github.com/repos/liyongshang44-max/GEOX/issues/comments/123",issue_url:"https://api.github.com/repos/liyongshang44-max/GEOX/issues/3757",user:{login:"liyongshang44-max"},author_association:"OWNER",created_at:created,updated_at:created,body:raw.toString()};
 const original=JSON.stringify(comment),proof=s.inspectApproval(comment,raw,scope,{now:NOW});
 assert.equal(JSON.stringify(comment),original);assert.throws(()=>s.requireApproval(proof,scope,{now:NOW}),/LIVE_RESOURCE_SOURCE/);
 for(const changed of [{user:{login:"other"}},{author_association:"MEMBER"},{updated_at:iso(NOW)},{body:raw.toString()+"\n"}])
  assert.throws(()=>s.inspectApproval({...comment,...changed},raw,scope,{now:NOW}),/NATIVE_IDENTITY/);
 assert.throws(()=>s.inspectApproval(comment,raw,scope,{now:Date.parse(p.valid_from)-1}),/APPROVAL_WINDOW/);
 assert.throws(()=>s.inspectApproval(comment,raw,scope,{now:Date.parse(p.expires_at)}),/APPROVAL_WINDOW/);
 const future=iso(NOW+1000).replace(/\.\d{3}Z$/,"Z");
 assert.throws(()=>s.inspectApproval({...comment,created_at:future,updated_at:future},raw,scope,{now:NOW}),/APPROVAL_WINDOW/);
 const noncanonical=Buffer.from(c.canonical({...p,valid_from:p.valid_from.replace(/\.\d{3}Z$/,"Z")}));
 assert.throws(()=>s.inspectApproval({...comment,body:noncanonical.toString()},noncanonical,scope,{now:NOW}),/V3_UTC/);
});
function permitFixture(){const p=Object.fromEntries(permit.FIELDS.map(k=>[k,H]));Object.assign(p,{schema_version:"MCFT_CAP09_R4285_SIGNED_ISOLATED_TEST_PERMIT_V3",issuer_id:issuer.issuer_id,key_id:issuer.key_id,...id,parent_run_id:permit.PARENT,failed_predecessor_run_id:permit.FAILED_PREDECESSOR,attempt_ordinal:4,scope:"ISOLATED_QUALIFICATION_TEST_ONLY",purpose:"ORIGINAL_SIX_STAGE_BUDGET_PREFLIGHT_ONLY",decision:"APPROVE_R4285_TEST_ONLY_PERMIT_NOT_PRODUCTION",issued_at:iso(NOW-1000),expires_at:iso(NOW+15000000),production_authorized:false});
 const ctx={...p,protected_main_sha:SUBJECT,source_clean:true,adoption_expires_at:iso(NOW+20000000),resource_owner_expires_at:iso(NOW+19000000),total_stage_budget_ms:10800000};return {p,ctx};}
test("Permit V3 binds Scope, observations, source approval, QCP73 and strict unchanged budget",()=>{
 const {p,ctx}=permitFixture(),envelope=sign(permit.DOMAIN,p),proof=permit.verifyReadOnly(envelope,trust,ctx,{now:NOW});assert(permit.isVerified(proof));assert(!permit.isVerified(JSON.parse(JSON.stringify(proof))));
 for(const key of ["scope_id","control_observation_sha256","inventory_observation_sha256","source_approval_sha256","qcp73_raw_sha256","nonce"]){assert.throws(()=>permit.verifyReadOnly(envelope,trust,{...ctx,[key]:"f".repeat(64)},{now:NOW}));}
 assert.throws(()=>permit.verifyReadOnly(sign(permit.DOMAIN,{...p,expires_at:iso(NOW+10860000)}),trust,ctx,{now:NOW}),/INSUFFICIENT_REMAINING/);
 assert.throws(()=>permit.verifyReadOnly(sign("GEOX_MCFT_CAP09_R4285_ISOLATED_TEST_PERMIT_V2\n",p),trust,ctx,{now:NOW}),/SIGNATURE_INVALID/);
});
test("QCP73 consumer rejects historical QCP72 and accepts only exact complete source result set",()=>{
 const definitions=JSON.parse(fs.readFileSync(path.join(ROOT,native.QCP_PATH))),head="d".repeat(40),base="e".repeat(40);
 const results=definitions.checks.map((row,index)=>({check_id:row.check_id,status:index===72?"PASS":"NOT_APPLICABLE",reason_code:"HISTORICAL_SOURCE_NOT_REISSUED"}));
 const machine={status:"PASS",head_sha:head,base_sha:base,stage:"SUCCESSOR_SUBJECT_PRE_MERGE",blockers:[],counts:{total_checks:73,pass:1,not_applicable:72,fail:0,unknown:0,forbidden:0,authority_errors:0,unknown_changed_paths:0,blocker_count:0},results};
 assert(native.checkQcp73(machine,definitions,head,base));
 assert.throws(()=>native.checkQcp73({...machine,counts:{...machine.counts,total_checks:72}},definitions,head,base));
 const bad=structuredClone(machine);bad.results[72].status="NOT_APPLICABLE";assert.throws(()=>native.checkQcp73(bad,definitions,head,base));
 const duplicate=structuredClone(machine);duplicate.results[0]=duplicate.results[1];assert.throws(()=>native.checkQcp73(duplicate,definitions,head,base));
});
test("Adoption V5 cryptographically binds QCP73 and cannot inherit a V4 signature",()=>{
 const v=require("../cap09_adoption_v1/MCFT_CAP09_R4285_ADOPTION_V5_V3.cjs"),payload=Object.fromEntries(v.FIELDS.map(k=>[k,H]));
 Object.assign(payload,{schema_version:"MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V5",issuer_id:issuer.issuer_id,key_id:issuer.key_id,run_id:s.RUN,host_id:s.HOST,subject_sha:SUBJECT,attempt_ordinal:4,scope:"ISOLATED_QUALIFICATION_TEST_ONLY",decision:"APPROVE_R4285_CURRENT_SUBJECT_ADOPTION_NOT_PERMIT",production_authorized:false,permit_authorized:false,issued_at:iso(NOW-1000),expires_at:iso(NOW+18000000)});
 const context={...payload},envelope=sign(v.DOMAIN,payload);assert(v.verifySignedAdoptionV5({envelope,trust,context,now:NOW}));
 assert.throws(()=>v.verifySignedAdoptionV5({envelope,trust,context:{...context,native_qcp73_result_sha256:"f".repeat(64)},now:NOW}),/BINDING/);
 assert.throws(()=>v.verifySignedAdoptionV5({envelope:sign("GEOX_MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V4\n",payload),trust,context,now:NOW}),/BAD_SIGNATURE/);
});
test("public receiver rejects JSON/serialized capabilities and has no execute entrypoint",async()=>{
 assert.throws(()=>host.parse(["--execute","--input","/unit.json"]),/ONLY_SESSION/);
 assert.throws(()=>factory.requireReceiver({phase:"LIVE",adoption:{status:"PASS"}}),/FACTORY_RECEIVER/);
 await assert.rejects(factory.consume({}),/FACTORY_CAPABILITY/);assert.throws(()=>factory.revoke({}),/FACTORY_CAPABILITY/);
 await assert.rejects(host.acceptPreparedState({}),/FACTORY_RECEIVER/);
 assert.throws(()=>admission.stableNative({adoption:{status:"PASS"},nativeInput:{},intent:{},ctx:{}}),/REAL_NATIVE/);
});
test("actual Node CJS and ESM loading uses pinned native module objects; reachable disk drift rejects",()=>{
 for(const drift of [false,true,"empty-drift","empty-hardlink","unqualified-ts"]){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"r4285-pinned-")),profileFile=root+"-profile.json";
  try{
   for(const rel of ["scripts/runtime_acceptance/MCFT_CAP09_R4285_SCOPE_V3.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_PINNED_LOADING_V3.cjs","scripts/cap09_adoption_v1/contract.cjs"]){const out=path.join(root,rel);fs.mkdirSync(path.dirname(out),{recursive:true});fs.copyFileSync(path.join(ROOT,rel),out);}
   fs.writeFileSync(path.join(root,"scripts/runtime_acceptance/MCFT_CAP09_R4285_V3_SOURCE_PATHS.cjs"),"module.exports={runtimePaths:[]};");
   for(const [name,main,body] of [["pg","index.js","module.exports={Pool:class Pool{},tag:'original'};"],["@aws-sdk/client-s3","index.js","module.exports={S3Client:class S3Client{}};"],["tsx","loader.mjs","export const loader='original';"]]){
    const dir=path.join(root,"node_modules",name);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,"package.json"),JSON.stringify({name,main}));fs.writeFileSync(path.join(dir,main),body);
   }
   // Native Node leaves format undefined for typeless .js; retain its CJS/ESM detection.
   fs.writeFileSync(path.join(root,"implicit-esm.js"),"export const marker='native-esm';");
   fs.writeFileSync(path.join(root,"implicit-empty.js"),"");
   fs.writeFileSync(path.join(root,"unqualified.ts"),"export const typed: number = 1;");
   for(const rel of ["node_modules/fast-xml-parser/src/v6/Report.js","node_modules/fast-xml-parser/src/xmlbuilder/prettifyJs2Xml.js","empty.cjs","empty.mjs"]){const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,"");}
   fs.writeFileSync(path.join(root,"node_modules/fast-xml-parser/package.json"),JSON.stringify({name:"fast-xml-parser",type:"commonjs"}));
   const emptyWire=profileFile+".empty.json";fs.writeFileSync(emptyWire,"");try{assert.throws(()=>s.bytes(emptyWire),/V3_REGULAR_FILE/);}finally{fs.rmSync(emptyWire);}
   if(drift==="empty-hardlink")fs.linkSync(path.join(root,"empty.cjs"),path.join(root,"empty-alias.cjs"));
   const mutation=drift===true?"fs.writeFileSync(__dirname+'/node_modules/pg/index.js',\"module.exports={tag:'changed'}\");":drift==="empty-drift"?"fs.writeFileSync(__dirname+'/empty.cjs',\"module.exports={changed:true};\");":"";
   const runner=`const fs=require('node:fs');const loader=require('./scripts/runtime_acceptance/MCFT_CAP09_R4285_PINNED_LOADING_V3.cjs');const profile=JSON.parse(fs.readFileSync(process.argv[2]));let gate;(async()=>{try{gate=loader.install(profile,__dirname);${mutation}await gate.preload();const pg=require('pg');if(pg.tag!=='original'||typeof pg.Pool!=='function')throw Error('WRONG_MODULE_OBJECT');if(Object.keys(require('./implicit-empty.js')).length||(await import('./implicit-esm.js')).marker!=='native-esm')throw Error('IMPLICIT_NATIVE_JS_SEMANTICS');${drift==="unqualified-ts"?"await import('./unqualified.ts');":""}if(Object.keys(require('./empty.cjs')).length||Object.keys(require('./node_modules/fast-xml-parser/src/v6/Report.js')).length||Object.keys(await import('./empty.mjs')).length)throw Error('EMPTY_MODULE_SEMANTICS');console.log('PINNED_NATIVE_MODULES');}catch(e){console.error(e.message);process.exitCode=2;}finally{gate?.close();}})();`;
   fs.writeFileSync(path.join(root,"runner.cjs"),runner);const files=[];
   function walk(dir,prefix=""){for(const item of fs.readdirSync(dir).sort()){const file=path.join(dir,item),rel=prefix+item;if(fs.statSync(file).isDirectory())walk(file,rel+"/");else files.push({path:rel,sha256:s.sha(fs.readFileSync(file))});}}walk(root);
   fs.writeFileSync(profileFile,JSON.stringify({root,files}));const child=cp.spawnSync(process.execPath,[path.join(root,"runner.cjs"),profileFile],{encoding:"utf8",timeout:15000,env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot||""}});
   assert.equal(child.status,drift?2:0,child.stderr);assert.match(drift?child.stderr:child.stdout,drift==="unqualified-ts"?/V3_REACHABLE_MODULE_FORMAT_OR_PATH_UNQUALIFIED/:drift==="empty-hardlink"?/V3_REGULAR_FILE/:drift?/V3_MODULE_DISK_DRIFT/:/PINNED_NATIVE_MODULES/);
  }finally{fs.rmSync(root,{recursive:true,force:true});fs.rmSync(profileFile,{force:true});}
 }
});
// The mechanism is exercised with isolated authority/I/O doubles. Those
// doubles are loader-local to this test; production exposes no injection hook.
function mechanismFixture({liveDelayMs=5}={}){const root=fs.mkdtempSync(path.join(os.tmpdir(),"r4285-factory-")),events=[],future=["resource_readback_file","resource_envelope_file","permit_envelope_file","final_execution_approval_file"];
 const p=scopePayload(),envScope=s.verifyScope(sign(s.DOMAIN,p),trust,id),i=Object.fromEntries(factory.INPUTS.map(k=>[k,path.join(root,k+".json")]));
 Object.assign(i,{source_root:path.join(root,"source"),release_root:path.join(root,"release"),nonce:NONCE,first_base:"2027-01-01T00:00:00.000Z",cto_intent_comment_id:1,source_approval_comment_id:2,launch_authorization_comment_id:3});
 fs.mkdirSync(i.source_root);fs.mkdirSync(i.release_root);
 const ni={source_root:i.source_root,release_root:i.release_root,trust_file:path.join(root,"trust"),material_file:path.join(root,"material"),release_binding_file:path.join(root,"release-binding"),adoption_envelope_file:path.join(root,"adoption")};
 function put(file,obj){fs.writeFileSync(file,c.canonical(obj));}
 put(i.native_adoption_input_file,ni);put(ni.trust_file,{...trust,ledger_root:root});put(ni.material_file,{root:i.release_root,files:[]});put(ni.release_binding_file,{});put(ni.adoption_envelope_file,{payload:{expires_at:iso(NOW+16000000)}});
 put(i.plan_file,{stages:[{timeout_ms:10800000}]});put(i.observations_file,{});put(i.scope_envelope_file,sign(s.DOMAIN,p));fs.writeFileSync(i.source_policy_file,"unit policy");fs.writeFileSync(i.source_approval_file,"unit approval");fs.writeFileSync(i.cto_intent_file,"unit intent");fs.writeFileSync(i.launch_authorization_file,c.canonical({schema_version:"MCFT_CAP09_R4285_SESSION_LAUNCH_V3",...id,scope_id:envScope.scope_id,valid_from:iso(NOW-1000),expires_at:iso(NOW+16000000),decision:"AUTHORIZE_ONE_V3_SESSION_PREFLIGHT_ONLY",production_authorized:false}));
 const cleanScope=structuredClone(envScope);cleanScope.payload.source.policy_sha256=s.sha("unit policy");cleanScope.payload.resources.parent_principal_sha256=s.sha("UNIT_PARENT_ONLY");
 const brand=new WeakSet(),nativeDouble={checkNativeAdoption(){events.push("native");const proof={...id,material_digest:H};brand.add(proof);return proof;},isNativeVerified:x=>brand.has(x)};
 const actualHistorical=require("./MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs"),mockScope={...s,verifyScope(){events.push("scope");return cleanScope;},liveApproval(){events.push("source authority");return {sha256:H,expires_at:iso(NOW+16000000)};},requireApproval(){return true;},verifySourcePolicy(){return true;}};
 let finalChecks=0,environment,receivedState;
 const mockHost={async acceptPreparedState(state){events.push("live");receivedState=state;environment=state.environment;await new Promise(resolve=>setTimeout(resolve,liveDelayMs));return {permit_consumed:false,stage_count:0};},finishAtAcceptance(result){finalChecks++;return result;}};
 const mocks={"./MCFT_CAP09_R4285_SCOPE_V3.cjs":mockScope,"../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V3.cjs":nativeDouble,
  "./MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs":{...actualHistorical,hostOnly(){},checkInput(){}},
  "./MCFT_CAP09_R4285_ADMISSION_V3.cjs":{frozenBudget(){},liveIntent(){events.push("intent");return {expires_at:iso(NOW+16000000)};},stableNative(){return {minted_at:iso(Date.now())};},requireStable(){}},
  "../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs":{verifyExactMain(){}},
  "./MCFT_CAP09_R4285_PINNED_LOADING_V3.cjs":{install(){return {async preload(){events.push("actual loading");},close(){events.push("close");}}; }},
  "./MCFT_CAP09_R4285_CREDENTIAL_DELIVERY_V3.cjs":{parentClean(){},async readFrameFd3(){events.push("FD3");return Buffer.from("unit frame");},parse(){return {environment:{DATABASE_URL:"unit only",MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID:"UNIT_ACCESS_ONLY"},expires_at:iso(NOW+16000000)};},clear:require("./MCFT_CAP09_R4285_CREDENTIAL_DELIVERY_V3.cjs").clear},
  "./MCFT_CAP09_R4285_WINDOWS_HOST_V3.cjs":mockHost,
  "node:child_process":{execFileSync(){const body=fs.readFileSync(i.launch_authorization_file,"utf8");return JSON.stringify({id:3,url:"https://api.github.com/repos/liyongshang44-max/GEOX/issues/comments/3",issue_url:"https://api.github.com/repos/liyongshang44-max/GEOX/issues/3757",user:{login:"liyongshang44-max"},author_association:"OWNER",created_at:iso(NOW-2000).replace(/\.\d{3}Z$/,"Z"),updated_at:iso(NOW-2000).replace(/\.\d{3}Z$/,"Z"),body});}}
 };
 const filename=path.join(__dirname,"MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs"),module={exports:{}};
 const producerFile=path.join(__dirname,"MCFT_CAP09_R4285_RESOURCE_OWNER_PRODUCER_V3.cjs");
 mocks["./MCFT_CAP09_R4285_RESOURCE_OWNER_PRODUCER_V3.cjs"]=isolated(producerFile,{
  "./MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs":new Proxy({},{get:(_,key)=>module.exports[key]}),
  "../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V3.cjs":nativeDouble,
  "node:os":{hostname:()=>s.HOST},
  "node:fs":{...fs,lstatSync(file,...args){if(String(file).endsWith(String.raw`D:\gptdown\MCFT-CAP09-TOOLS\mc.exe`))throw Object.assign(Error("fixture missing registered mc"),{code:"ENOENT"});return fs.lstatSync(file,...args);}},
  "node:child_process":{spawnSync(){events.push("native source capture");return {status:1,stdout:Buffer.alloc(0)};}}
 },Date,{platform:"win32",env:{}});
 const localRequire=name=>Object.hasOwn(mocks,name)?mocks[name]:Module.createRequire(__filename)(name);
 vm.runInThisContext("(function(exports,require,module,__filename,__dirname,console,process){"+fs.readFileSync(filename,"utf8")+"\n})",{filename})(module.exports,localRequire,module,filename,__dirname,{log(){},error(){}},{...process,env:{}});
 return {i,events,root,factory:module.exports,get environment(){return environment;},get state(){return receivedState;},get finalChecks(){return finalChecks;},future,cleanup(){fs.rmSync(root,{recursive:true,force:true});}};
}
test("factory orders qualified loading before FD3; concurrent reuse rejects; final transition clears explicit secrets",async()=>{
 const f=mechanismFixture();try{const cap=await f.factory.prepare(f.i);assert.equal(JSON.stringify(cap),"{}");assert(f.events.indexOf("actual loading")<f.events.indexOf("FD3"));
  const first=f.factory.consume(cap);await assert.rejects(f.factory.consume(cap),/ALREADY_USED/);assert.deepEqual(await first,{permit_consumed:false,stage_count:0});assert.equal(f.environment.DATABASE_URL,undefined);assert.equal(f.finalChecks,1);await assert.rejects(f.factory.consume(cap),/ALREADY_USED/);
 }finally{f.cleanup();}
});
test("factory revocation, drift, preexisting future files and cross-process attempt reuse reject",async()=>{
 for(const mode of ["revoke","drift","future","attempt"]){const f=mechanismFixture();try{const cap=await f.factory.prepare(f.i);
  if(mode==="revoke")f.factory.revoke(cap);if(mode==="drift")fs.writeFileSync(f.i.source_policy_file,"changed");if(mode==="future")fs.writeFileSync(f.i.resource_readback_file,"old");
  if(mode==="attempt"){await f.factory.consume(cap);const next=await f.factory.prepare(f.i);await assert.rejects(f.factory.consume(next),/V3_SESSION_SCOPE_ALREADY_ATTEMPTED/);}
  else await assert.rejects(f.factory.consume(cap));assert.equal(f.environment?.DATABASE_URL,undefined);
 }finally{f.cleanup();}}
});
function producerOptions(root){return {existing_mc_alias:"UNIT_ADMIN_ONLY",parent_access_key_id:"UNIT_PARENT_ONLY",protected_directory:path.join(root,"protected-new"),control_envelope_file:path.join(root,"control-signed.json"),inventory_envelope_file:path.join(root,"inventory-signed.json")};}
test("Producer reuses the genuine presecret capability before WAIT without another Native or FD3 read",async()=>{
 const f=mechanismFixture();try{
  assert.throws(()=>f.factory.prepareProducer({},producerOptions(f.root)),/FACTORY_CAPABILITY/);
  const cap=await f.factory.prepare(f.i),before=f.events.slice();
  await assert.rejects(f.factory.consumeWithProducer(cap),/NOT_PREPARED_BEFORE_WAIT/);assert(!f.events.includes("live"));
  const ready=f.factory.prepareProducer(cap,producerOptions(f.root));assert.equal(ready.status,"V3_PRODUCER_PREPARED_SAME_PROCESS_NOT_OBSERVED");
  assert.deepEqual(f.events,before);assert(!fs.existsSync(path.join(f.root,"protected-new")));
  assert.throws(()=>f.factory.captureProducer(cap),/FACTORY_RECEIVER/);
  assert.throws(()=>f.factory.prepareProducer(cap,producerOptions(f.root)),/PREPARE_ONCE/);
  f.factory.revoke(cap);assert.throws(()=>f.factory.captureProducer(cap));
 }finally{f.cleanup();}
});
test("Producer capture runs only after real factory WAIT and missing registered mc invalidates the session",async()=>{
 const f=mechanismFixture({liveDelayMs:10});try{const cap=await f.factory.prepare(f.i);f.factory.prepareProducer(cap,producerOptions(f.root));
  const pending=f.factory.consumeWithProducer(cap);const rejected=assert.rejects(pending,/V3_PRODUCER_SOURCE_CAPTURE_FAILED/);
  assert(f.events.includes("live"));assert.throws(()=>f.factory.captureProducer(cap),/HOLD_NATIVE_COMMAND_NOT_AUTHENTICATED/);
  await rejected;assert.equal(f.events.filter(x=>x==="native").length,1);assert.equal(f.events.filter(x=>x==="FD3").length,1);
  assert(!f.events.includes("native source capture"));assert.equal(f.environment.DATABASE_URL,undefined);
  await assert.rejects(f.factory.completeProducer(cap,{}));assert(!fs.existsSync(f.i.resource_readback_file));
 }finally{f.cleanup();}
});
test("Producer rejects forged prepared state, wrong Parent and output aliases before control-plane I/O",async()=>{
 const p=require("./MCFT_CAP09_R4285_RESOURCE_OWNER_PRODUCER_V3.cjs");assert.throws(()=>p.prepareAttached({phase:"PREPARED"},{}),/FACTORY_PREPARATION/);
 for(const mode of ["parent","alias","inside"]){const f=mechanismFixture();try{const cap=await f.factory.prepare(f.i),options=producerOptions(f.root);
  if(mode==="parent")options.parent_access_key_id="WRONG_PARENT";if(mode==="alias")options.inventory_envelope_file=options.control_envelope_file;if(mode==="inside")options.control_envelope_file=path.join(f.i.release_root,"public.json");
  assert.throws(()=>f.factory.prepareProducer(cap,options));assert(!f.events.includes("native source capture"));f.factory.revoke(cap);
 }finally{f.cleanup();}}
});
function isolated(filename,mocks,clock=Date,processValue=process){const module={exports:{}},local=Module.createRequire(filename);
 const request=name=>Object.hasOwn(mocks,name)?mocks[name]:local(name);request.resolve=mocks.__resolve||local.resolve;
 vm.runInThisContext("(function(exports,require,module,__filename,__dirname,process,Date){"+fs.readFileSync(filename,"utf8")+"\n})",{filename})(module.exports,request,module,filename,path.dirname(filename),processValue,clock);return module.exports;}
test("approved source Policy content/lifetime and signed FD3 parser bind exact session and account roles",()=>{
 const p=scopePayload(),policy={schema_version:"MCFT_CAP09_R4285_SOURCE_POLICY_V3",...id,source_id:p.source.source_id,issuer_id:issuer.issuer_id,key_id:issuer.key_id,spki_sha256:issuer.spki_sha256,delivery_source_id:p.source.delivery_source_id,scope:"ISOLATED_QUALIFICATION_TEST_ONLY",valid_from:iso(NOW-20000),expires_at:iso(NOW+20000000)};
 const policyRaw=Buffer.from(c.canonical(policy));p.source.policy_sha256=s.sha(policyRaw);const scope=s.verifyScope(sign(s.DOMAIN,p),trust,id,{now:NOW});s.verifySourcePolicy(policyRaw,scope,{now:NOW});
 const wrongWindow={...policy,expires_at:iso(NOW+1000)},wrongRaw=Buffer.from(c.canonical(wrongWindow)),wrongScope=structuredClone(scope);wrongScope.payload.source.policy_sha256=s.sha(wrongRaw);assert.throws(()=>s.verifySourcePolicy(wrongRaw,wrongScope,{now:NOW}),/POLICY_LIFETIME/);
 const approvalPayload={schema_version:"MCFT_CAP09_R4285_SOURCE_AUTHORITY_APPROVAL_V3",...id,scope_id:scope.scope_id,scope_envelope_sha256:scope.envelope_sha256,source_policy_sha256:p.source.policy_sha256,source_spki_sha256:issuer.spki_sha256,delivery_source_id:p.source.delivery_source_id,valid_from:iso(NOW-1000),expires_at:iso(NOW+16000000),decision:"AUTHORIZE_EXACT_TEST_ONLY_RESOURCE_SOURCE_AND_DELIVERY",production_authorized:false};
 const raw=Buffer.from(c.canonical(approvalPayload)),source=isolated(path.join(__dirname,"MCFT_CAP09_R4285_SCOPE_V3.cjs"),{"node:child_process":{execFileSync(){return JSON.stringify({id:72,url:"https://api.github.com/repos/liyongshang44-max/GEOX/issues/comments/72",issue_url:"https://api.github.com/repos/liyongshang44-max/GEOX/issues/3757",user:{login:"liyongshang44-max"},author_association:"OWNER",created_at:iso(NOW-2000),updated_at:iso(NOW-2000),body:raw.toString()});}}},Date,{platform:"win32",env:{}});
 const proof=source.liveApproval(72,raw,scope),parser=isolated(path.join(__dirname,"MCFT_CAP09_R4285_CREDENTIAL_DELIVERY_V3.cjs"),{"./MCFT_CAP09_R4285_SCOPE_V3.cjs":source});
 const environment={DATABASE_URL:`postgres://${p.resources.positive_role}:UNIT_ONLY@127.0.0.1:55492/${p.resources.positive_database}`,BLOCKED_DATABASE_URL:`postgres://${p.resources.negative_role}:UNIT_ONLY@127.0.0.1:55492/${p.resources.negative_database}`,MCFT_CAP09_FORMAL_RAW_BUCKET:p.resources.bucket,MCFT_CAP09_FORMAL_RAW_ENDPOINT:p.resources.bucket_endpoint,MCFT_CAP09_FORMAL_RAW_REGION:"us-east-1",MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID:"UNIT_ACCESS_ONLY",MCFT_CAP09_FORMAL_RAW_SECRET_ACCESS_KEY:"UNIT_ONLY"};
 const payload={schema_version:"MCFT_CAP09_R4285_CREDENTIAL_DELIVERY_V3",issuer_id:issuer.issuer_id,key_id:issuer.key_id,...id,scope_id:scope.scope_id,delivery_source_id:p.source.delivery_source_id,issued_at:iso(NOW-500),expires_at:iso(NOW+15000000),environment};
 const parse=value=>parser.parse(Buffer.from(c.canonical(sign(s.FRAME_DOMAIN,value))),scope,trust,proof,{now:NOW});
 const delivered=parse(payload);assert.equal(delivered.environment.DATABASE_URL,environment.DATABASE_URL);parser.clear(delivered.environment);assert.equal(delivered.environment.DATABASE_URL,undefined);
 assert.throws(()=>parse({...payload,nonce:"e".repeat(64)}),/IDENTITY_DRIFT/);
 assert.throws(()=>parse({...payload,expires_at:iso(NOW+10860000)}),/REMAINING_BUDGET/);
 assert.throws(()=>parse({...payload,environment:{...environment,DATABASE_URL:environment.DATABASE_URL.replace(p.resources.positive_role,"postgres")}}),/PG_BINDING/);
 assert.throws(()=>s.requireApproval(proof,scope,{now:NOW}),/LIVE_RESOURCE_SOURCE/); // different module instance is not portable
});
function dynamicFixture({materialDelay=0,accountFailure=false}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"r4285-dynamic-")),events=[];let clock=NOW;
 class Clock extends Date{static now(){return clock;}}
 const win={...process,platform:"win32",env:{}};
 const bindingFile=path.join(root,"binding"),trustFile=path.join(root,"trust"),readbackFile=path.join(root,"readback");
 fs.writeFileSync(bindingFile,"{}");fs.writeFileSync(trustFile,JSON.stringify(trust));
 const nativeBrand=new WeakSet(),adoption={...id,material_digest:H};nativeBrand.add(adoption);
 const first_base="2027-01-01T00:00:00.000Z",plan={schema_version:"geox_mcft_cap09_retry_stage_plan_v2",stages:require("./MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs").STAGES.map((id,n)=>({id,timeout_ms:admission.FROZEN_TIMEOUTS[n]}))};
 const observed={real_provider_response_delay_plan:{response_delay_ms:1000,first_base},real_pipeline_delay_plan:{promotion_queue_delay_ms:1000,post_commit_readback_delay_ms:1000,first_base}};
 const ctx={...id,authority_pr_number:3757,first_base,plan,plan_sha256:c.digest(plan),observations_sha256:c.digest(observed),material_digest:H,release_binding_sha256:s.sha("{}"),resource_scope_sha256:H,scope_id:H,source_approval_sha256:H,control_observation_sha256:H,inventory_observation_sha256:H,adoption_expires_at:iso(NOW+20000000),total_stage_budget_ms:10800000};
 const ip={schema_version:"MCFT_CAP09_R4285_CTO_PREAUTH_INTENT_V3",...id,parent_run_id:permit.PARENT,failed_predecessor_run_id:permit.FAILED_PREDECESSOR,attempt_ordinal:4,authority_pr_number:3757,first_base,plan_sha256:ctx.plan_sha256,observations_sha256:ctx.observations_sha256,material_digest:H,release_binding_sha256:ctx.release_binding_sha256,resource_scope_sha256:H,valid_from:iso(NOW-3000),expires_at:iso(NOW+3600000),scope:"ISOLATED_QUALIFICATION_TEST_ONLY",decision:"APPROVE_V3_TEST_INTENT_NOT_PERMIT_OR_EXECUTION",production_authorized:false,permit_authorized:false,execute_authorized:false};
 const raw=Buffer.from(c.canonical(ip));ctx.intent_raw_bytes=raw;
 const live=isolated(path.join(__dirname,"MCFT_CAP09_R4285_ADMISSION_V3.cjs"),{
  "../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V3.cjs":{isNativeVerified:x=>nativeBrand.has(x)},
  "node:child_process":{execFileSync(){events.push("FINAL_CTO_NATIVE");return JSON.stringify({id:42,url:"https://api.github.com/repos/liyongshang44-max/GEOX/issues/comments/42",issue_url:"https://api.github.com/repos/liyongshang44-max/GEOX/issues/3757",user:{login:"liyongshang44-max"},author_association:"OWNER",created_at:iso(NOW-4000).replace(/\.\d{3}Z$/,"Z"),updated_at:iso(NOW-4000).replace(/\.\d{3}Z$/,"Z"),body:raw.toString()});}}
 },Clock,win);
 const ni={source_root:root,release_root:root,release_binding_file:bindingFile,release_binding_sha256:ctx.release_binding_sha256,trust_file:trustFile};
 const intent=live.liveIntent(42,raw,ctx),stable=live.stableNative({adoption,nativeInput:ni,intent,ctx,now:clock});events.length=0;
 const owner=require("../governance_acceptance/MCFT_CAP09_R4285_RESOURCE_OWNER_V3.cjs"),facts=Object.fromEntries(owner.FACT_BINDINGS.map(k=>[k,true]));
 Object.assign(facts,{...id,scope_id:H,control_observation_sha256:H,inventory_observation_sha256:H,source_approval_sha256:H,observed_at:iso(NOW-5000),database_host:"127.0.0.1",database_port:55492,positive_database:`mcft_cap09_requal_${s.RUN}_positive`,negative_database:`mcft_cap09_requal_${s.RUN}_negative`,audit_user:`cap09_${s.RUN}_p_evidence`,bucket_endpoint:"http://127.0.0.1:59292/",bucket:"mcft-cap09-requal-"+s.RUN,pg_owner_id:"pgdb:101:102:unit_owner",s3_owner_id:"r4285scope:"+H.slice(0,40),production_bindings_present:false});
 const rb={...facts,schema_version:"MCFT_CAP09_R4285_RESOURCE_READBACK_V3",status:"PASS",probe_type:"WINDOWS_READ_ONLY_PG_S3_INDEPENDENT_HOST",probe_source_sha256:H,production_authorized:false};fs.writeFileSync(readbackFile,c.canonical(rb));
 const readback=owner.verifyReadbackFile(readbackFile,s.sha(c.canonical(rb))),ownerPayload=Object.fromEntries(owner.FIELDS.map(k=>[k,facts[k]]));
 Object.assign(ownerPayload,{schema_version:"MCFT_CAP09_R4285_RESOURCE_OWNER_V3",issuer_id:issuer.issuer_id,key_id:issuer.key_id,scope:"TEST_ONLY",production_authorized:false,issued_at:iso(NOW-1000),expires_at:iso(NOW+19000000),readback_sha256:readback.sha256});
 const ownerEnv=sign(owner.DOMAIN,ownerPayload),{p,ctx:pctx}=permitFixture();
 Object.assign(p,{scope_id:H,source_approval_sha256:H,control_observation_sha256:H,inventory_observation_sha256:H,plan_sha256:ctx.plan_sha256,observations_sha256:ctx.observations_sha256,installed_material_digest:H,release_binding_sha256:ctx.release_binding_sha256,resource_owner_envelope_sha256:s.sha(c.canonical(ownerEnv)),resource_readback_sha256:readback.sha256});
 Object.assign(pctx,p);const permitEnv=sign(permit.DOMAIN,p),permitProof=permit.verifyReadOnly(permitEnv,trust,pctx,{now:clock});
 const finalPayload=Object.fromEntries(live.FINAL_FIELDS.map(k=>[k,ctx[k]]));
 Object.assign(finalPayload,{schema_version:"MCFT_CAP09_R4285_FINAL_EXECUTION_APPROVAL_V3",issuer_id:issuer.issuer_id,key_id:issuer.key_id,permit_envelope_sha256:permitProof.envelope_sha256,resource_owner_envelope_sha256:s.sha(c.canonical(ownerEnv)),resource_readback_sha256:readback.sha256,intent_sha256:intent.sha256,issued_at:iso(NOW-1000),expires_at:iso(NOW+1800000),scope:"ISOLATED_QUALIFICATION_TEST_ONLY",decision:"APPROVE_R4285_V3_FINAL_SINGLE_PREFLIGHT",production_authorized:false});
 const prepared={controller:new AbortController()},receiverBrand=new WeakSet([prepared]);
 const module=isolated(path.join(__dirname,"MCFT_CAP09_R4285_HOST_ADMISSION_V3.cjs"),{
  "./MCFT_CAP09_R4285_ADMISSION_V3.cjs":live,
  "./MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs":{requireReceiver:x=>s.check(receiverBrand.has(x),"V3_FACTORY_RECEIVER_REQUIRED"),refreshAuthority(){events.push("SOURCE_AUTHORITY_NATIVE");}},
  "./MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs":{hostOnly(){},verifyBoundHostSources(){},checkResourceEnv(){},async probeS3ReadOnly(){events.push("S3");return {status:"UNIT_READONLY"};}},
  "./MCFT_CAP09_R4285_PG_READONLY_V3.cjs":{async probePreconsumePostgres(){events.push("PG");}},
  "./MCFT_CAP09_R4285_S3_READONLY_V3.cjs":{async probe(){events.push("S3");return {status:"UNIT_READONLY"};}},
  "./MCFT_CAP09_R4285_PG_ACCOUNT_BINDING_V3.cjs":{async verify(){events.push("ACCOUNT_METADATA");if(accountFailure)throw Error("V3_PG_ACCOUNT_EXPIRY_DRIFT");}},
  "./MCFT_CAP09_R4285_MATERIAL_FULL_PARALLEL_V2.cjs":{async verify(){events.push("FULL_MATERIAL");clock+=materialDelay;return {digest:H};}},
  "../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs":{verifyExactMain(){events.push("CURRENT_MAIN");}}
 },Clock,win);
 const input={preparedState:prepared,stable,intent,ctx,nativeInput:ni,sourceRoot:root,releaseRoot:root,environment:{},resourceScope:{},resourceEnvelope:ownerEnv,resourceReadbackFile:readbackFile,readback,permitEnvelope:permitEnv,permitProof,finalEnvelope:sign(live.DOMAIN,finalPayload),trust,plan,observations:observed,profile:{},releaseBinding:{}};
 return {module,input,events,live,advance:n=>clock+=n,cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test("integrated read-only admission preserves dynamic checks then source refresh then final native CTO recheck",async()=>{
 const f=dynamicFixture();try{const report=await f.module.verifyDynamicReadOnly(f.input,{now:NOW});assert.equal(report.permit_consumed,false);assert.equal(report.stage_count,0);
  assert.deepEqual(f.events,["CURRENT_MAIN","PG","ACCOUNT_METADATA","S3","FULL_MATERIAL","SOURCE_AUTHORITY_NATIVE","FINAL_CTO_NATIVE"]);
  const final=f.module.requireVerifiedFinal(report);f.advance(15001);assert.throws(()=>f.live.assertFinal(final,{},{now:NOW+15001}),/RECHECK_TOO_OLD/);
 }finally{f.cleanup();}
});
test("integrated admission never returns PASS after slow material or the first real account failure",async()=>{
 for(const option of [{materialDelay:121000},{accountFailure:true}]){const f=dynamicFixture(option);try{await assert.rejects(f.module.verifyDynamicReadOnly(f.input,{now:NOW}),option.accountFailure?/EXPIRY_DRIFT/:/DYNAMIC_READBACK_EXPIRED/);
  if(option.accountFailure)assert.deepEqual(f.events,["CURRENT_MAIN","PG","ACCOUNT_METADATA"]);
 }finally{f.cleanup();}}
});
test("in-flight revocation and Owner deadline invalidate preparation and clear secrets before completion",async()=>{
 for(const mode of ["revoke","deadline"]){const f=mechanismFixture({liveDelayMs:100});try{const cap=await f.factory.prepare(f.i),pending=f.factory.consume(cap);
  if(mode==="revoke")f.factory.revoke(cap);else f.factory.setObservationDeadline(f.state,iso(Date.now()-119980));
  await assert.rejects(pending,mode==="revoke"?/V3_PREPARE_REVOKED/:/V3_OWNER_WINDOW_EXHAUSTED/);
  assert(f.state.controller.signal.aborted);assert.equal(f.environment.DATABASE_URL,undefined);assert.equal(f.finalChecks,0);
 }finally{f.cleanup();}}
});
test("actual V3 PG/S3 boundaries propagate cancellation and close active clients without later operations",async()=>{
 const control=new AbortController();let destroyed=false,requests=0;
 class Head{}class Objects{}class Versions{}class Uploads{}
 const sdk={HeadBucketCommand:Head,ListObjectsV2Command:Objects,ListObjectVersionsCommand:Versions,ListMultipartUploadsCommand:Uploads,S3Client:class{
  send(command,{abortSignal}){requests++;assert.equal(abortSignal,control.signal);return new Promise((resolve,reject)=>abortSignal.addEventListener("abort",()=>reject(abortSignal.reason),{once:true}));}
  destroy(){destroyed=true;}
 }};
 const storage=isolated(path.join(__dirname,"MCFT_CAP09_R4285_S3_READONLY_V3.cjs"),{__resolve:()=>"UNIT_SDK",UNIT_SDK:sdk});
 const pending=storage.probe(ROOT,{bucket:"unit",bucket_endpoint:"http://127.0.0.1:59292/"},{MCFT_CAP09_FORMAL_RAW_REGION:"us-east-1",MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID:"UNIT_ONLY",MCFT_CAP09_FORMAL_RAW_SECRET_ACCESS_KEY:"UNIT_ONLY"},control.signal);
 control.abort(Error("V3_OWNER_WINDOW_EXHAUSTED"));await assert.rejects(pending,/V3_OWNER_WINDOW_EXHAUSTED/);assert(destroyed);assert.equal(requests,1);
 const pgControl=new AbortController();let released=false,ended=false,queries=0,failQuery;
 const pg={Pool:class{async connect(){return {query(){queries++;return new Promise((resolve,reject)=>{failQuery=reject;});},release(destroy){released=destroy;if(failQuery)failQuery(Error("unit connection closed"));}};}async end(){ended=true;}}};
 const reader=isolated(path.join(__dirname,"MCFT_CAP09_R4285_PG_READONLY_V3.cjs"),{__resolve:()=>"UNIT_PG",UNIT_PG:pg});
 const r=scopePayload().resources,env={DATABASE_URL:`postgres://${r.positive_role}:UNIT_ONLY@127.0.0.1:55492/${r.positive_database}`,BLOCKED_DATABASE_URL:`postgres://${r.negative_role}:UNIT_ONLY@127.0.0.1:55492/${r.negative_database}`};
 const operation=reader.probePreconsumePostgres({admission:{resourceEnvelope:{payload:{...r,run_id:s.RUN}},permitEnvelope:{payload:{run_id:s.RUN}}},releaseRoot:ROOT,environment:env,signal:pgControl.signal});
 await new Promise(resolve=>setImmediate(resolve));pgControl.abort(Error("V3_OWNER_WINDOW_EXHAUSTED"));await assert.rejects(operation,/V3_OWNER_WINDOW_EXHAUSTED/);assert(released&&ended);assert.equal(queries,1);
});

test("bounded V3 successor qualification preserves the 73-check manifest and exact current source binding",()=>{
 const q=require("../governance_acceptance/VERIFY_MCFT_CAP09_R4285_PREPARE_LIVE_SOURCE_V3.cjs");
 const authority=JSON.parse(cp.execFileSync("git",["show","8890bf950773a43a1f9238672eeb335b1526edca:"+native.QCP_PATH],{cwd:ROOT,encoding:"utf8"}));
 for(const cfg of [{base:q.SUCCESSOR_BASE,branch:q.SUCCESSOR_BRANCH,paths:q.SUCCESSOR_PATHS},{base:q.EMPTY_MODULE_BASE,branch:q.EMPTY_MODULE_BRANCH,paths:q.EMPTY_MODULE_PATHS},{base:q.RELEASE_REVIEW_BASE,branch:q.RELEASE_REVIEW_BRANCH,paths:q.RELEASE_REVIEW_PATHS},{base:q.NATIVE_JS_BASE,branch:q.NATIVE_JS_BRANCH,paths:q.NATIVE_JS_PATHS},{base:q.PRODUCER_WAIT_BASE,branch:q.PRODUCER_WAIT_BRANCH,paths:q.PRODUCER_WAIT_PATHS}]){
 const head="d".repeat(40),input={args:{base:cfg.base,head},authority,before:structuredClone(authority),
  plan:{status:"PASS",unknown_changed_paths:[],authority_errors:[],resolver_errors:[]},
  paths:[...cfg.paths],changed:[...cfg.paths],stage:"SUCCESSOR_SUBJECT_PRE_MERGE",
  event:{repository:{full_name:"liyongshang44-max/GEOX"},pull_request:{number:9999,user:{login:"liyongshang44-max"},
   base:{sha:cfg.base,ref:"main"},head:{sha:head,ref:cfg.branch,repo:{full_name:"liyongshang44-max/GEOX"}}}}};
 assert.equal(q.inspectSuccessor(input),true);
 assert.equal(authority.checks.length,73);
 assert.equal(authority.checks[72].check_id,"CAP09_R4285_PREPARE_LIVE_V3_EXACT_SOURCE_REVIEW_V1");
 for(const mutate of [
  x=>x.args.base="a".repeat(40),x=>x.args.head=x.args.base,
  x=>x.stage="POST_MERGE",x=>x.plan.unknown_changed_paths.push("unknown.cjs"),
  x=>x.paths.push("scripts/runtime_acceptance/MCFT_CAP09_R4285_SCOPE_V3.cjs"),
  x=>x.changed.pop(),x=>x.authority.checks[0].check_id="REWRITTEN_HISTORY",
  x=>x.event.pull_request.base.ref="other",x=>x.event.pull_request.head.sha="e".repeat(40),
  x=>x.event.pull_request.head.ref="other",x=>x.event.pull_request.user.login="other",
  x=>x.event.pull_request.head.repo.full_name="other/GEOX"
 ]){const bad=structuredClone(input);mutate(bad);assert.throws(()=>q.inspectSuccessor(bad));}
 }
});
test("qualification workflow and preflight route the exact successor while retaining the original V3 admission",()=>{
 const q=require("../governance_acceptance/VERIFY_MCFT_CAP09_R4285_PREPARE_LIVE_SOURCE_V3.cjs");
 const workflow=fs.readFileSync(path.join(ROOT,".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml"),"utf8");
 assert(workflow.includes("github.event.pull_request.number == 3758"));
 assert(workflow.includes("github.head_ref == '"+q.SUCCESSOR_BRANCH+"'"));
 assert(workflow.includes("github.event.pull_request.base.sha == '"+q.SUCCESSOR_BASE+"'"));
 assert(workflow.includes("github.event.pull_request.base.sha == '"+q.EMPTY_MODULE_BASE+"'"));
 assert(workflow.includes("github.head_ref == '"+q.EMPTY_MODULE_BRANCH+"'"));
 assert(workflow.includes("github.event.pull_request.base.sha == '"+q.RELEASE_REVIEW_BASE+"'"));
 assert(workflow.includes("github.head_ref == '"+q.RELEASE_REVIEW_BRANCH+"'"));
 assert(workflow.includes("github.event.pull_request.base.sha == '"+q.NATIVE_JS_BASE+"'"));
 assert(workflow.includes("github.head_ref == '"+q.NATIVE_JS_BRANCH+"'"));
 for(const p of q.NATIVE_JS_PATHS)assert(workflow.includes("      - '"+p+"'"),p);
 const preflight=fs.readFileSync(path.join(ROOT,"scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs"),"utf8");
 assert(preflight.includes('["0aaec504eeda2c3230703d4bbb44e5bafe1668f3","'+q.SUCCESSOR_BASE+'"].includes(args.base)'));
});

test("historical review from a separate source checkout stays inside the pinned Release module boundary",()=>{
 const physicalGate=require("../governance_acceptance/MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_PROOF_GATE_V1.cjs");
 for(const mode of ["valid","source-drift","expired-review","bad-signature","outside-preloaded"]){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"r4285-review-release-")),release=path.join(tmp,"release"),source=path.join(tmp,"source");
  try{
   const put=(root,rel,raw)=>{const f=path.join(root,...rel.split("/"));fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,raw);return f;};
   for(const rel of ["scripts/governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs","scripts/governance_acceptance/MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_PROOF_GATE_V1.cjs","scripts/runtime_acceptance/MCFT_CAP09_RETRY_PERMIT_V1.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_SCOPE_V3.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_PINNED_LOADING_V3.cjs","scripts/cap09_adoption_v1/contract.cjs"])
    put(release,rel,fs.readFileSync(path.join(ROOT,rel)));
   const sourceHashes={};for(const rel of physicalGate.SOURCE_PATHS){const raw=fs.readFileSync(path.join(ROOT,rel));put(source,rel,raw);sourceHashes[rel]=s.sha(raw);}
   const receipt={schema_version:"geox_mcft_cap09_isolated_non_authorized_full_chain_contract_v1",status:"PASS",subject_sha:"5d69b8a3f254600726bc10f0404f1330de1e4562",test_run_id:"802dca8d4f9c",authorization:"NON_AUTHORIZED_ISOLATED_ENGINEERING_TEST_ONLY",isolated_s3_bucket:"mcft-cap09-requal-802dca8d4f9c",pg_database:"mcft_cap09_requal_802dca8d4f9c_positive",source_files_sha256:sourceHashes,
    real_postgres_formal_fact_present_count:3,capture_raw_object_count:2,candidate_semantic_record_count:3,promotion_provider_refetch_count:0,stage_count:0};
   for(const k of ["actual_isolated_composer_exercised","real_postgres_fenced_promotion","candidate_manifest_private_readback","exact_three_facts_single_fenced_transaction","post_commit_physical_readback_verified","controller_attestation_after_promotion","cursor_advanced_only_after_attestation","private_raw_retention_real_s3_verified","evidence_login_restricted","evidence_fenced_writer_execute_allowed"])receipt[k]=true;
   for(const k of ["permit_signed","permit_consumed","production_authorized","production_owner_activation","formal_v5_armed","o00_started","evidence_direct_fact_insert_allowed"])receipt[k]=false;
   const receiptFile=put(tmp,"receipt.json",JSON.stringify(receipt)),payload={schema_version:"geox_mcft_cap09_non_authorized_full_chain_attestation_v1",issuer_id:issuer.issuer_id,key_id:issuer.key_id,subject_sha:receipt.subject_sha,test_run_id:receipt.test_run_id,receipt_file:receiptFile,receipt_sha256:s.sha(fs.readFileSync(receiptFile)),signed_at:iso(Date.now()-(mode==="expired-review"?8*86400000:1000)),non_authorized:true,production_authorized:false};
   const envelope=sign(physicalGate.DOMAIN,payload);if(mode==="bad-signature")envelope.signature_base64=Buffer.alloc(64).toString("base64");
   const attestationFile=put(tmp,"review.json",JSON.stringify(envelope)),attestationSha=s.sha(fs.readFileSync(attestationFile));
   if(mode==="source-drift")fs.appendFileSync(path.join(source,physicalGate.SOURCE_PATHS[0]),"\n// changed after signed review\n");
   put(release,"scripts/runtime_acceptance/MCFT_CAP09_R4285_V3_SOURCE_PATHS.cjs","module.exports={runtimePaths:[]};");
   for(const [name,main,raw] of [["pg","index.cjs","module.exports={};"],["@aws-sdk/client-s3","index.cjs","module.exports={};"],["tsx","loader.mjs","export const unit=true;"]]){
    put(release,"node_modules/"+name+"/package.json",JSON.stringify({name,main}));put(release,"node_modules/"+name+"/"+main,raw);
   }
   const files=[];function walk(dir,prefix=""){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const rel=prefix+e.name,f=path.join(dir,e.name);if(e.isDirectory())walk(f,rel+"/");else files.push({path:rel,sha256:s.sha(fs.readFileSync(f))});}}walk(release);
   put(tmp,"profile.json",JSON.stringify({root:release,files}));put(tmp,"trust.json",JSON.stringify(trust));put(tmp,"outside.cjs","module.exports={unitOnly:true};");
   const runner=`const fs=require('node:fs'),path=require('node:path');const root=process.argv[1],tmp=process.argv[2],mode=process.argv[3];const lineage=require(path.join(root,'scripts/governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs'));const loader=require(path.join(root,'scripts/runtime_acceptance/MCFT_CAP09_R4285_PINNED_LOADING_V3.cjs'));let loading;(async()=>{try{const proof=lineage.verifyFullchainCarryforward({sourceRoot:path.join(tmp,'source'),trust:JSON.parse(fs.readFileSync(path.join(tmp,'trust.json'))),attestationFile:${JSON.stringify(attestationFile)},attestationSha:${JSON.stringify(attestationSha)}});if(proof.actual_checked_source_files!==23)throw Error('REVIEW_SOURCE_COUNT');if(mode==='outside-preloaded')require(path.join(tmp,'outside.cjs'));loading=loader.install(JSON.parse(fs.readFileSync(path.join(tmp,'profile.json'))),root);await loading.preload();if(Object.keys(require.cache).some(f=>!f.startsWith(root+path.sep)))throw Error('OUTSIDE_CACHE');console.log('HISTORICAL_REVIEW_THEN_PINNED_PRELOAD');}catch(e){console.error(e.message);process.exitCode=2;}finally{loading?.close();}})();`;
   const child=cp.spawnSync(process.execPath,["-e",runner,release,tmp,mode],{encoding:"utf8",timeout:15000,env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot||""}});
   assert.equal(child.status,mode==="valid"?0:2,child.stderr);
   if(mode==="valid")assert.match(child.stdout,/HISTORICAL_REVIEW_THEN_PINNED_PRELOAD/);
   else assert.match(child.stderr,{"source-drift":/FULL_CHAIN_TESTED_SOURCE_CHANGED/,"expired-review":/FULL_CHAIN_ATTESTATION_OUTSIDE_REVIEW_WINDOW/,"bad-signature":/FULL_CHAIN_OPERATOR_SIGNATURE_INVALID/,"outside-preloaded":/V3_MODULE_OUTSIDE_RELEASE/}[mode]);
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
 }
});

// Exact native tool boundary: isolated fake filesystem/process, no real accounts.
{
"use strict";
// Exercise the actual native wrapper with a fake child process, never accounts or Host.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"MCFT_CAP09_R4285_RESOURCE_OWNER_PRODUCER_V3.cjs"),"utf8");
const fragment=source.slice(source.indexOf("function nativeCommandLabel("),source.indexOf("// Windows mc RELEASE.",source.indexOf("function nativeCommandLabel(")));
function harness(child,mode){const reports=[],calls=[];let clock=100;
 const registered=String.raw`D:\gptdown\MCFT-CAP09-TOOLS\mc.exe`,stat={dev:1,ino:2,size:3,mtimeMs:4,ctimeMs:5,nlink:1,isFile:()=>true,isSymbolicLink:()=>false};let reads=0,closed=false;
 const fileSystem={lstatSync(){if(mode==="missing")throw Object.assign(Error("PRIVATE_PATH"),{code:"ENOENT"});return {...stat,nlink:mode==="hardlink"?2:1};},realpathSync:()=>mode==="path"?"PRIVATE_OTHER_PATH":registered,openSync:()=>9,fstatSync:()=>({...stat,ino:mode==="drift"?99:2}),readSync(fd,b){if(reads++)return 0;b.set([1,2,3]);return 3;},closeSync(){closed=true;}};
 const box={Buffer,assert,fs:fileSystem,noLinks(){if(mode==="link")throw Error("OWNER_PRODUCER_REPARSE_FORBIDDEN");},crypto:{createHash(name){assert.equal(name,"sha256");return {update(){},digest:()=>mode==="hash"?"0".repeat(64):"c8db13ebeda31497f354c0e950809db0ae9b2a2a69b8afee68c128c37300c157"};}},performance:{now:()=>clock+=17},nativeChildEnvironment:()=>({PUBLIC:"fixture"}),console:{log:x=>reports.push(JSON.parse(x))},require:name=>{assert.equal(name,"node:child_process");return {spawnSync:(...args)=>{calls.push(args);return child;}};}};
 vm.runInNewContext(fragment+"\nthis.read=nativeRead;this.label=nativeCommandLabel;this.classify=nativeFailureClass;",box);return {...box,reports,calls,registered,get closed(){return closed;}};}
test("each native command family has a fixed label without dynamic arguments",()=>{
 const h=harness({});for(const [tool,args,label] of [
 ["mc",["--json","admin","info","PRIVATE_ALIAS"],"MC_ADMIN_INFO"],
 ["mc",["--json","admin","accesskey","info","PRIVATE_ALIAS","PRIVATE_ACCOUNT"],"MC_ACCESSKEY_INFO"],
 ["mc",["--json","admin","user","svcacct","info"],"MC_SERVICE_ACCOUNT_INFO"],
 ["mc",["--json","stat"],"MC_BUCKET_STAT"],["mc",["--json","anonymous","get"],"MC_BUCKET_ANONYMOUS"],
 ["mc",["admin","config","get"],"MC_IDENTITY_PROVIDER_CONFIG"],
 ["mc",["--json","admin","user","list"],"MC_USERS_LIST"],
 ["mc",["--json","admin","user","svcacct","ls"],"MC_SERVICE_ACCOUNTS_LIST"],
 ["mc",["--json","admin","policy","entities"],"MC_POLICY_ENTITIES"],
 ["docker",["ps","--all","--no-trunc"],"DOCKER_CONTAINERS_ALL"],
 ["docker",["inspect","--type","container"],"DOCKER_CONTAINERS_INSPECT"],
 ["docker",["volume","inspect"],"DOCKER_VOLUME_INSPECT"],
 ["powershell.exe",["-NoProfile","-NonInteractive","-EncodedCommand","PRIVATE_SCRIPT"],"WINDOWS_HOST_CENSUS"],
 ["PRIVATE_TOOL",["PRIVATE_ARGUMENT"],"UNCLASSIFIED_NATIVE_COMMAND"]])assert.equal(h.label(tool,args),label);
});
test("failure emits only audited metadata and keeps original fail-closed reason",()=>{
 for(const code of ["ENOENT","EACCES","ETIMEDOUT","ENOBUFS","SECRET_CODE",undefined]){
  const child={status:code?null:7,error:code?{code,message:"PRIVATE_ERROR",path:"PRIVATE_PATH",spawnargs:["PRIVATE_ARG"]}:undefined,stdout:Buffer.from("PRIVATE_STDOUT"),stderr:Buffer.from("PRIVATE_STDERR")};
  const h=harness(child);assert.throws(()=>h.read("mc",["--json","admin","info","PRIVATE_ALIAS"]),/HOLD_NATIVE_COMMAND_NOT_AUTHENTICATED/);
  assert.equal(h.calls.length,1);assert.equal(h.reports.length,1);const r=h.reports[0];
  assert.deepEqual(Object.keys(r),["schema_version","status","command_label","failure_class","exit_code","system_code","elapsed_ms","stdout_bytes","stderr_bytes","retry_automatically"]);
  assert.equal(r.system_code,code&&code!=="SECRET_CODE"?code:null);assert.equal(r.exit_code,code?null:7);
  assert.equal(r.command_label,"MC_ADMIN_INFO");assert.equal(r.elapsed_ms,17);assert.equal(r.stdout_bytes,14);assert.equal(r.stderr_bytes,14);assert.equal(r.retry_automatically,false);
  assert.ok(!JSON.stringify(r).includes("PRIVATE"));assert.ok(!JSON.stringify(r).includes("SECRET"));assert.ok(child.stdout.every(x=>x===0));assert.ok(child.stderr.every(x=>x===0));
 }
});
test("successful native bytes and frozen subprocess limits remain unchanged",()=>{
 const raw=Buffer.from("original native output"),h=harness({status:0,stdout:raw,stderr:Buffer.alloc(0)});
 assert.equal(h.read("docker",["ps","--all","--no-trunc"]),raw);assert.equal(raw.toString(),"original native output");assert.equal(h.reports.length,0);assert.equal(h.calls.length,1);
 const options=h.calls[0][2];assert.equal(options.timeout,15000);assert.equal(options.maxBuffer,1048576);assert.equal(options.shell,false);assert.equal(options.encoding,null);assert.equal(options.stdio.join(","),"ignore,pipe,pipe");
});
test("missing native stdout fails closed without inventing output bytes",()=>{
 const h=harness({status:0,stdout:null,stderr:null});assert.throws(()=>h.read("docker",["volume","inspect"]),/HOLD_NATIVE_COMMAND_NOT_AUTHENTICATED/);assert.equal(h.reports[0].stdout_bytes,0);assert.equal(h.reports[0].stderr_bytes,0);
});

test("registered mc is hashed before every spawn and has no PATH or CWD fallback",()=>{const h=harness({status:0,stdout:Buffer.from("native"),stderr:Buffer.alloc(0)});h.read("mc",["--json","admin","info","PRIVATE_ALIAS"]);assert.equal(h.calls[0][0],h.registered);assert.equal(h.closed,true);assert.equal(h.calls[0][1][3],"PRIVATE_ALIAS");});
test("missing, wrong digest, links, path drift and file identity drift prohibit spawning",()=>{for(const [mode,classification]of [["missing","EXECUTABLE_NOT_FOUND"],["hash","MC_SHA256_MISMATCH"],["link","MC_FILE_IDENTITY_REJECTED"],["hardlink","MC_FILE_IDENTITY_REJECTED"],["path","MC_PATH_DRIFT"],["drift","MC_FILE_IDENTITY_DRIFT"]]){const h=harness({},mode);assert.throws(()=>h.read("mc",["--json","admin","info","PRIVATE_ALIAS"]),/HOLD_NATIVE_COMMAND_NOT_AUTHENTICATED/);assert.equal(h.calls.length,0);assert.equal(h.reports.length,1);assert.equal(h.reports[0].failure_class,classification);assert.ok(!JSON.stringify(h.reports).includes("PRIVATE"));if(mode==='hash'||mode==='drift')assert.equal(h.closed,true);}});
test("native failure classes are exact and hostile error attributes cannot enter public reports",()=>{const h=harness({});for(const [error,status,label]of [[{code:'ENOENT'},null,'EXECUTABLE_NOT_FOUND'],[{code:'ETIMEDOUT'},null,'COMMAND_TIMEOUT'],[{code:'ENOBUFS'},null,'OUTPUT_LIMIT_EXCEEDED'],[undefined,7,'NONZERO_EXIT'],[{native_tool_failure:'PRIVATE_SECRET'},null,'NATIVE_SYSTEM_ERROR']])assert.equal(h.classify({error,status}),label);});

}
