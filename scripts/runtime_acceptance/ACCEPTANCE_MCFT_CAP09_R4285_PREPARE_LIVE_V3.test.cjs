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
test("public receiver rejects JSON/serialized capabilities and has no execute entrypoint",async()=>{
 assert.throws(()=>host.parse(["--execute","--input","/unit.json"]),/ONLY_SESSION/);
 assert.throws(()=>factory.requireReceiver({phase:"LIVE",adoption:{status:"PASS"}}),/FACTORY_RECEIVER/);
 await assert.rejects(factory.consume({}),/FACTORY_CAPABILITY/);assert.throws(()=>factory.revoke({}),/FACTORY_CAPABILITY/);
 await assert.rejects(host.acceptPreparedState({}),/FACTORY_RECEIVER/);
 assert.throws(()=>admission.stableNative({adoption:{status:"PASS"},nativeInput:{},intent:{},ctx:{}}),/REAL_NATIVE/);
});
test("actual Node CJS and ESM loading uses pinned native module objects; reachable disk drift rejects",()=>{
 for(const drift of [false,true]){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"r4285-pinned-")),profileFile=root+"-profile.json";
  try{
   for(const rel of ["scripts/runtime_acceptance/MCFT_CAP09_R4285_SCOPE_V3.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_PINNED_LOADING_V3.cjs","scripts/cap09_adoption_v1/contract.cjs"]){const out=path.join(root,rel);fs.mkdirSync(path.dirname(out),{recursive:true});fs.copyFileSync(path.join(ROOT,rel),out);}
   for(const [name,main,body] of [["pg","index.cjs","module.exports={Pool:class Pool{},tag:'original'};"],["@aws-sdk/client-s3","index.cjs","module.exports={S3Client:class S3Client{}};"],["tsx","loader.mjs","export const loader='original';"]]){
    const dir=path.join(root,"node_modules",name);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,"package.json"),JSON.stringify({name,main}));fs.writeFileSync(path.join(dir,main),body);
   }
   const runner=`const fs=require('node:fs');const loader=require('./scripts/runtime_acceptance/MCFT_CAP09_R4285_PINNED_LOADING_V3.cjs');const profile=JSON.parse(fs.readFileSync(process.argv[2]));const gate=loader.install(profile,__dirname);${drift?"fs.writeFileSync(__dirname+'/node_modules/pg/index.cjs',\"module.exports={tag:'changed'}\");":""}gate.preload().then(()=>{const pg=require('pg');if(pg.tag!=='original'||typeof pg.Pool!=='function')throw Error('WRONG_MODULE_OBJECT');gate.close();console.log('PINNED_NATIVE_MODULES');}).catch(e=>{gate.close();console.error(e.message);process.exitCode=2;});`;
   fs.writeFileSync(path.join(root,"runner.cjs"),runner);const files=[];
   function walk(dir,prefix=""){for(const item of fs.readdirSync(dir).sort()){const file=path.join(dir,item),rel=prefix+item;if(fs.statSync(file).isDirectory())walk(file,rel+"/");else files.push({path:rel,sha256:s.sha(fs.readFileSync(file))});}}walk(root);
   fs.writeFileSync(profileFile,JSON.stringify({root,files}));const child=cp.spawnSync(process.execPath,[path.join(root,"runner.cjs"),profileFile],{encoding:"utf8",timeout:15000});
   assert.equal(child.status,drift?2:0,child.stderr);assert.match(drift?child.stderr:child.stdout,drift?/V3_MODULE_DISK_DRIFT/:/PINNED_NATIVE_MODULES/);
  }finally{fs.rmSync(root,{recursive:true,force:true});fs.rmSync(profileFile,{force:true});}
 }
});
// The mechanism is exercised with isolated authority/I/O doubles. Those
// doubles are loader-local to this test; production exposes no injection hook.
function mechanismFixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),"r4285-factory-")),events=[],future=["resource_readback_file","resource_envelope_file","permit_envelope_file","final_execution_approval_file"];
 const p=scopePayload(),envScope=s.verifyScope(sign(s.DOMAIN,p),trust,id),i=Object.fromEntries(factory.INPUTS.map(k=>[k,path.join(root,k+".json")]));
 Object.assign(i,{source_root:root,release_root:root,nonce:NONCE,first_base:"2027-01-01T00:00:00.000Z",cto_intent_comment_id:1,source_approval_comment_id:2,launch_authorization_comment_id:3});
 const ni={source_root:root,release_root:root,trust_file:path.join(root,"trust"),material_file:path.join(root,"material"),release_binding_file:path.join(root,"release"),adoption_envelope_file:path.join(root,"adoption")};
 function put(file,obj){fs.writeFileSync(file,c.canonical(obj));}
 put(i.native_adoption_input_file,ni);put(ni.trust_file,{...trust,ledger_root:root});put(ni.material_file,{root,files:[]});put(ni.release_binding_file,{});put(ni.adoption_envelope_file,{payload:{expires_at:iso(NOW+16000000)}});
 put(i.plan_file,{stages:[{timeout_ms:10800000}]});put(i.observations_file,{});put(i.scope_envelope_file,sign(s.DOMAIN,p));fs.writeFileSync(i.source_policy_file,"unit policy");fs.writeFileSync(i.source_approval_file,"unit approval");fs.writeFileSync(i.cto_intent_file,"unit intent");fs.writeFileSync(i.launch_authorization_file,c.canonical({schema_version:"MCFT_CAP09_R4285_SESSION_LAUNCH_V3",...id,scope_id:envScope.scope_id,valid_from:iso(NOW-1000),expires_at:iso(NOW+16000000),decision:"AUTHORIZE_ONE_V3_SESSION_PREFLIGHT_ONLY",production_authorized:false}));
 const cleanScope=structuredClone(envScope);cleanScope.payload.source.policy_sha256=s.sha("unit policy");
 const brand=new WeakSet(),nativeDouble={checkNativeAdoption(){events.push("native");const proof={...id,material_digest:H};brand.add(proof);return proof;},isNativeVerified:x=>brand.has(x)};
 const actualHistorical=require("./MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs"),mockScope={...s,verifyScope(){events.push("scope");return cleanScope;},liveApproval(){events.push("source authority");return {sha256:H,expires_at:iso(NOW+16000000)};},requireApproval(){return true;}};
 let finalChecks=0,environment;
 const mockHost={async acceptPreparedState(state){events.push("live");environment=state.environment;await new Promise(resolve=>setTimeout(resolve,5));return {permit_consumed:false,stage_count:0};},finishAtAcceptance(result){finalChecks++;return result;}};
 const mocks={"./MCFT_CAP09_R4285_SCOPE_V3.cjs":mockScope,"../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V3.cjs":nativeDouble,
  "./MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs":{...actualHistorical,hostOnly(){},checkInput(){}},
  "./MCFT_CAP09_R4285_ADMISSION_V3.cjs":{frozenBudget(){},liveIntent(){events.push("intent");return {expires_at:iso(NOW+16000000)};},stableNative(){return {minted_at:iso(Date.now())};},requireStable(){}},
  "../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs":{verifyExactMain(){}},
  "./MCFT_CAP09_R4285_PINNED_LOADING_V3.cjs":{install(){return {async preload(){events.push("actual loading");},close(){events.push("close");}}; }},
  "./MCFT_CAP09_R4285_CREDENTIAL_DELIVERY_V3.cjs":{parentClean(){},async readFrameFd3(){events.push("FD3");return Buffer.from("unit frame");},parse(){return {environment:{DATABASE_URL:"unit only"},expires_at:iso(NOW+16000000)};},clear:require("./MCFT_CAP09_R4285_CREDENTIAL_DELIVERY_V3.cjs").clear},
  "./MCFT_CAP09_R4285_WINDOWS_HOST_V3.cjs":mockHost,
  "node:child_process":{execFileSync(){const body=fs.readFileSync(i.launch_authorization_file,"utf8");return JSON.stringify({id:3,url:"https://api.github.com/repos/liyongshang44-max/GEOX/issues/comments/3",issue_url:"https://api.github.com/repos/liyongshang44-max/GEOX/issues/3757",user:{login:"liyongshang44-max"},author_association:"OWNER",created_at:iso(NOW-2000),updated_at:iso(NOW-2000),body});}}
 };
 const localRequire=name=>Object.hasOwn(mocks,name)?mocks[name]:Module.createRequire(__filename)(name);
 const filename=path.join(__dirname,"MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs"),module={exports:{}};
 vm.runInThisContext("(function(exports,require,module,__filename,__dirname,console){"+fs.readFileSync(filename,"utf8")+"\n})",{filename})(module.exports,localRequire,module,filename,__dirname,{log(){},error(){}});
 return {i,events,root,factory:module.exports,get environment(){return environment;},get finalChecks(){return finalChecks;},future,cleanup(){fs.rmSync(root,{recursive:true,force:true});}};
}
test("factory orders qualified loading before FD3; concurrent reuse rejects; final transition clears explicit secrets",async()=>{
 const f=mechanismFixture();try{const cap=await f.factory.prepare(f.i);assert.equal(JSON.stringify(cap),"{}");assert(f.events.indexOf("actual loading")<f.events.indexOf("FD3"));
  const first=f.factory.consume(cap);await assert.rejects(f.factory.consume(cap),/ALREADY_USED/);assert.deepEqual(await first,{permit_consumed:false,stage_count:0});assert.equal(f.environment.DATABASE_URL,undefined);assert.equal(f.finalChecks,1);await assert.rejects(f.factory.consume(cap),/ALREADY_USED/);
 }finally{f.cleanup();}
});
test("factory revocation, drift, preexisting future files and cross-process attempt reuse reject",async()=>{
 for(const mode of ["revoke","drift","future","attempt"]){const f=mechanismFixture();try{const cap=await f.factory.prepare(f.i);
  if(mode==="revoke")f.factory.revoke(cap);if(mode==="drift")fs.writeFileSync(f.i.source_policy_file,"changed");if(mode==="future")fs.writeFileSync(f.i.resource_readback_file,"old");
  if(mode==="attempt"){await f.factory.consume(cap);const next=await f.factory.prepare(f.i);await assert.rejects(f.factory.consume(next),error=>error.code==="EEXIST");}
  else await assert.rejects(f.factory.consume(cap));assert.equal(f.environment?.DATABASE_URL,undefined);
 }finally{f.cleanup();}}
});
function isolated(filename,mocks,clock=Date,processValue=process){const module={exports:{}},local=Module.createRequire(filename);
 vm.runInThisContext("(function(exports,require,module,__filename,__dirname,process,Date){"+fs.readFileSync(filename,"utf8")+"\n})",{filename})(module.exports,name=>Object.hasOwn(mocks,name)?mocks[name]:local(name),module,filename,path.dirname(filename),processValue,clock);return module.exports;}
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
  "node:child_process":{execFileSync(){events.push("FINAL_CTO_NATIVE");return JSON.stringify({id:42,url:"https://api.github.com/repos/liyongshang44-max/GEOX/issues/comments/42",issue_url:"https://api.github.com/repos/liyongshang44-max/GEOX/issues/3757",user:{login:"liyongshang44-max"},author_association:"OWNER",created_at:iso(NOW-4000),updated_at:iso(NOW-4000),body:raw.toString()});}}
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
 const prepared={},receiverBrand=new WeakSet([prepared]);
 const module=isolated(path.join(__dirname,"MCFT_CAP09_R4285_HOST_ADMISSION_V3.cjs"),{
  "./MCFT_CAP09_R4285_ADMISSION_V3.cjs":live,
  "./MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs":{requireReceiver:x=>s.check(receiverBrand.has(x),"V3_FACTORY_RECEIVER_REQUIRED"),refreshAuthority(){events.push("SOURCE_AUTHORITY_NATIVE");}},
  "./MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs":{hostOnly(){},verifyBoundHostSources(){},checkResourceEnv(){},async probeS3ReadOnly(){events.push("S3");return {status:"UNIT_READONLY"};}},
  "./MCFT_CAP09_R4285_PG_READONLY_V1.cjs":{async probePreconsumePostgres(){events.push("PG");}},
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
