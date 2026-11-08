"use strict";
// Isolated test keys only. No Windows session, real account, signer or network.
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),cp=require("node:child_process"),vm=require("node:vm"),Module=require("node:module");
const s=require("./MCFT_CAP09_R4285_SCOPE_V3.cjs"),c=require("../cap09_adoption_v1/contract.cjs");
const permit=require("./MCFT_CAP09_R4285_PERMIT_EXEC_V3.cjs"),admission=require("./MCFT_CAP09_R4285_ADMISSION_EXEC_V3.cjs");
const host=require("./MCFT_CAP09_R4285_WINDOWS_HOST_EXEC_V3.cjs"),native=require("../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V3.cjs");
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
function permitFixture(executionRun=s.RUN){const eid=require("./MCFT_CAP09_R4285_EXECUTION_IDENTITY_V3.cjs").get(executionRun);const p=Object.fromEntries(permit.FIELDS.map(k=>[k,H]));Object.assign(p,{schema_version:"MCFT_CAP09_R4285_SIGNED_EXECUTION_PERMIT_V3",issuer_id:issuer.issuer_id,key_id:issuer.key_id,...id,run_id:executionRun,parent_run_id:eid.parent_run_id,failed_predecessor_run_id:eid.failed_predecessor_run_id,attempt_ordinal:eid.attempt_ordinal,scope:"ISOLATED_QUALIFICATION_TEST_ONLY",purpose:"ORIGINAL_SIX_STAGE_PHYSICAL_EXECUTION_TEST_ONLY",decision:"APPROVE_R4285_V3_ONE_PHYSICAL_TEST_ONLY_PERMIT",issued_at:iso(NOW-1000),expires_at:iso(NOW+15000000),production_authorized:false});
 const ctx={...p,protected_main_sha:SUBJECT,source_clean:true,adoption_expires_at:iso(NOW+20000000),resource_owner_expires_at:iso(NOW+19000000),total_stage_budget_ms:10800000};return {p,ctx};}
function isolated(filename,mocks,clock=Date,processValue=process){const module={exports:{}},local=Module.createRequire(filename);
 const request=name=>Object.hasOwn(mocks,name)?mocks[name]:local(name);request.resolve=mocks.__resolve||local.resolve;
 vm.runInThisContext("(function(exports,require,module,__filename,__dirname,process,Date){"+fs.readFileSync(filename,"utf8")+"\n})",{filename})(module.exports,request,module,filename,path.dirname(filename),processValue,clock);return module.exports;}
const testTrust=trust;
function dynamicFixture({materialDelay=0,accountFailure=false,executionRun=require("./MCFT_CAP09_R4285_EXECUTION_IDENTITY_V3.cjs").SUCCESSOR}={}){
 const identity=require("./MCFT_CAP09_R4285_EXECUTION_IDENTITY_V3.cjs"),eid=identity.get(executionRun),id={run_id:executionRun,host_id:s.HOST,subject_sha:SUBJECT,nonce:NONCE};
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"r4285-execution-")),events=[];let clock=NOW;
 const trust={...testTrust,ledger_root:root};
 if(executionRun!==s.RUN)fs.writeFileSync(path.join(root,"r4285-v3-preflight-"+identity.OLD_SCOPE+".json"),JSON.stringify({schema_version:"MCFT_CAP09_R4285_V3_EXECUTION_ATTEMPT_STARTED",scope_id:identity.OLD_SCOPE,nonce:identity.OLD_NONCE,permit_consumed:false,stage_count:0}));
 class Clock extends Date{static now(){return clock;}}
 const win={...process,platform:"win32",env:{}};
 const bindingFile=path.join(root,"binding"),trustFile=path.join(root,"trust"),readbackFile=path.join(root,"readback");
 fs.writeFileSync(bindingFile,"{}");fs.writeFileSync(trustFile,JSON.stringify(trust));
 const nativeBrand=new WeakSet(),adoption={...id,run_id:s.RUN,material_digest:H,adoption_digest:H};nativeBrand.add(adoption);
 const first_base="2027-01-01T00:00:00.000Z",plan={schema_version:"geox_mcft_cap09_retry_stage_plan_v2",stages:require("./MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs").STAGES.map((id,n)=>({id,timeout_ms:admission.FROZEN_TIMEOUTS[n]}))};
 const observed={real_provider_response_delay_plan:{response_delay_ms:1000,first_base},real_pipeline_delay_plan:{promotion_queue_delay_ms:1000,post_commit_readback_delay_ms:1000,first_base}};
 const ctx={...id,authority_pr_number:3757,first_base,plan,plan_sha256:c.digest(plan),observations_sha256:c.digest(observed),material_digest:H,release_binding_sha256:s.sha("{}"),resource_scope_sha256:H,scope_id:H,source_approval_sha256:H,control_observation_sha256:H,inventory_observation_sha256:H,adoption_expires_at:iso(NOW+20000000),total_stage_budget_ms:10800000};
 const sourceObservations=Object.fromEntries(["CONTROL","INVENTORY"].map(kind=>[kind.toLowerCase(),sign(s.OBS_DOMAIN,{
 schema_version:"MCFT_CAP09_R4285_SOURCE_OBSERVATION_V3",issuer_id:issuer.issuer_id,key_id:issuer.key_id,...id,
 scope_id:H,kind,raw_sha256:H,observed_at:iso(NOW-5000),issued_at:iso(NOW-4000),expires_at:iso(NOW+18000000),production_authorized:false})]));
 ctx.control_observation_sha256=c.digest(sourceObservations.control);ctx.inventory_observation_sha256=c.digest(sourceObservations.inventory);
 const ip={schema_version:"MCFT_CAP09_R4285_PHYSICAL_EXECUTION_INTENT_V3",...id,parent_run_id:eid.parent_run_id,failed_predecessor_run_id:eid.failed_predecessor_run_id,attempt_ordinal:eid.attempt_ordinal,authority_pr_number:3757,first_base,plan_sha256:ctx.plan_sha256,observations_sha256:ctx.observations_sha256,material_digest:H,release_binding_sha256:ctx.release_binding_sha256,resource_scope_sha256:H,valid_from:iso(NOW-3000),expires_at:iso(NOW+3600000),scope:"ISOLATED_QUALIFICATION_TEST_ONLY",decision:"AUTHORIZE_V3_ONE_PHYSICAL_TEST_ONLY_EXECUTION_INTENT",production_authorized:false,permit_authorized:true,execute_authorized:true};
 const raw=Buffer.from(c.canonical(ip));ctx.intent_raw_bytes=raw;
 const live=isolated(path.join(__dirname,"MCFT_CAP09_R4285_ADMISSION_EXEC_V3.cjs"),{
  "../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V3.cjs":{isNativeVerified:x=>nativeBrand.has(x)},
  "node:child_process":{execFileSync(){events.push("FINAL_CTO_NATIVE");return JSON.stringify({id:42,url:"https://api.github.com/repos/liyongshang44-max/GEOX/issues/comments/42",issue_url:"https://api.github.com/repos/liyongshang44-max/GEOX/issues/3757",user:{login:"liyongshang44-max"},author_association:"OWNER",created_at:iso(NOW-4000).replace(/\.\d{3}Z$/,"Z"),updated_at:iso(NOW-4000).replace(/\.\d{3}Z$/,"Z"),body:raw.toString()});}}
 },Clock,win);
 const ni={source_root:root,release_root:root,release_binding_file:bindingFile,release_binding_sha256:ctx.release_binding_sha256,trust_file:trustFile};
 const intent=live.liveIntent(42,raw,ctx),stable=live.stableNative({adoption,nativeInput:ni,intent,ctx,now:clock});events.length=0;
 const owner=require("../governance_acceptance/MCFT_CAP09_R4285_RESOURCE_OWNER_V3.cjs"),facts=Object.fromEntries(owner.FACT_BINDINGS.map(k=>[k,true]));
 Object.assign(facts,{...id,scope_id:H,control_observation_sha256:H,inventory_observation_sha256:H,source_approval_sha256:H,observed_at:iso(NOW-5000),database_host:"127.0.0.1",database_port:55492,positive_database:`mcft_cap09_requal_${s.RUN}_positive`,negative_database:`mcft_cap09_requal_${s.RUN}_negative`,audit_user:`cap09_${s.RUN}_p_evidence`,bucket_endpoint:"http://127.0.0.1:59292/",bucket:"mcft-cap09-requal-"+s.RUN,pg_owner_id:"pgdb:101:102:unit_owner",s3_owner_id:"r4285scope:"+H.slice(0,40),production_bindings_present:false});
 facts.control_observation_sha256=ctx.control_observation_sha256;facts.inventory_observation_sha256=ctx.inventory_observation_sha256;facts.source_observations=sourceObservations;
 const rb={...facts,schema_version:"MCFT_CAP09_R4285_RESOURCE_READBACK_V3",status:"PASS",probe_type:"WINDOWS_READ_ONLY_PG_S3_INDEPENDENT_HOST",probe_source_sha256:H,production_authorized:false};fs.writeFileSync(readbackFile,c.canonical(rb));
 const readback=owner.verifyReadbackFile(readbackFile,s.sha(c.canonical(rb)),{run_id:executionRun}),ownerPayload=Object.fromEntries(owner.FIELDS.map(k=>[k,facts[k]]));
 Object.assign(ownerPayload,{schema_version:"MCFT_CAP09_R4285_RESOURCE_OWNER_V3",issuer_id:issuer.issuer_id,key_id:issuer.key_id,scope:"TEST_ONLY",production_authorized:false,issued_at:iso(NOW-1000),expires_at:iso(NOW+19000000),readback_sha256:readback.sha256});
 const ownerEnv=sign(owner.DOMAIN,ownerPayload),{p,ctx:pctx}=permitFixture(executionRun);
 Object.assign(p,{scope_id:H,source_approval_sha256:H,control_observation_sha256:ctx.control_observation_sha256,inventory_observation_sha256:ctx.inventory_observation_sha256,plan_sha256:ctx.plan_sha256,observations_sha256:ctx.observations_sha256,installed_material_digest:H,release_binding_sha256:ctx.release_binding_sha256,resource_owner_envelope_sha256:s.sha(c.canonical(ownerEnv)),resource_readback_sha256:readback.sha256});
 Object.assign(pctx,p);const permitEnv=sign(permit.DOMAIN,p),permitProof=permit.verifyReadOnly(permitEnv,trust,pctx,{now:clock});
 const finalPayload=Object.fromEntries(live.FINAL_FIELDS.map(k=>[k,ctx[k]]));
 Object.assign(finalPayload,{schema_version:"MCFT_CAP09_R4285_PHYSICAL_FINAL_EXECUTION_APPROVAL_V3",issuer_id:issuer.issuer_id,key_id:issuer.key_id,permit_envelope_sha256:permitProof.envelope_sha256,resource_owner_envelope_sha256:s.sha(c.canonical(ownerEnv)),resource_readback_sha256:readback.sha256,intent_sha256:intent.sha256,issued_at:iso(NOW-1000),expires_at:iso(NOW+1800000),scope:"ISOLATED_QUALIFICATION_TEST_ONLY",decision:"APPROVE_R4285_V3_FINAL_SINGLE_PHYSICAL_TEST_ONLY_EXECUTION",production_authorized:false});
 const prepared={execution:true,controller:new AbortController()},receiverBrand=new WeakSet([prepared]);
 const module=isolated(path.join(__dirname,"MCFT_CAP09_R4285_HOST_ADMISSION_EXEC_V3.cjs"),{
  "./MCFT_CAP09_R4285_ADMISSION_EXEC_V3.cjs":live,
  "./MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs":{requireReceiver:x=>s.check(receiverBrand.has(x),"V3_FACTORY_RECEIVER_REQUIRED"),refreshAuthority(){events.push("SOURCE_AUTHORITY_NATIVE");}},
  "./MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs":{hostOnly(){},verifyBoundHostSources(){},checkResourceEnv(){},async probeS3ReadOnly(){events.push("S3");return {status:"UNIT_READONLY"};}},
  "./MCFT_CAP09_R4285_PG_READONLY_V3.cjs":{async probePreconsumePostgres(){events.push("PG");}},
  "./MCFT_CAP09_R4285_S3_READONLY_V3.cjs":{async probe(){events.push("S3");return {status:"UNIT_READONLY"};}},
  "./MCFT_CAP09_R4285_PG_ACCOUNT_BINDING_V3.cjs":{async verify(){events.push("ACCOUNT_METADATA");if(accountFailure)throw Error("V3_PG_ACCOUNT_EXPIRY_DRIFT");}},
  "./MCFT_CAP09_R4285_MATERIAL_FULL_PARALLEL_V2.cjs":{async verify(){events.push("FULL_MATERIAL");clock+=materialDelay;return {digest:H};}},
  "../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs":{verifyExactMain(){events.push("CURRENT_MAIN");}}
 },Clock,win);
 const input={preparedState:prepared,stable,intent,ctx,nativeInput:ni,sourceRoot:root,releaseRoot:root,environment:{},resourceScope:{},resourceEnvelope:ownerEnv,resourceReadbackFile:readbackFile,readback,permitEnvelope:permitEnv,permitProof,finalEnvelope:sign(live.DOMAIN,finalPayload),trust,plan,observations:observed,profile:{},releaseBinding:{}};
 return {module,input,events,live,root,adoption,nativeBrand,advance:n=>clock+=n,cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}
const oldPermit=require('./MCFT_CAP09_R4285_PERMIT_V3.cjs');
const oldAdmission=require('./MCFT_CAP09_R4285_ADMISSION_V3.cjs');
const atomicFile=path.join(__dirname,'MCFT_CAP09_R4285_PERMIT_ATOMIC_EXEC_V3.cjs');
function atomicFixture(f){return isolated(atomicFile,{
 './MCFT_CAP09_R4285_ADMISSION_EXEC_V3.cjs':f.live,
 '../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V3.cjs':{isNativeVerified:x=>f.nativeBrand.has(x)},
 '../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs':{verifyExactMain(){}}
 });}
function atomicArgs(f){const x=f.input;return {nativeAdoption:f.adoption,permitProof:x.permitProof,trust:x.trust,
 sourceRoot:f.root,stable:x.stable,intent:x.intent,ctx:x.ctx,resourceEnvelope:x.resourceEnvelope,
 readback:x.readback,plan:x.plan,observed:x.observations,permitEnvelope:x.permitEnvelope,
 releaseRoot:f.root,profile:x.profile,environment:x.environment};}
test('physical Permit verifies new domain and rejects old schema, purpose, domain and serialization',()=>{
 const {p,ctx}=permitFixture(),env=sign(permit.DOMAIN,p),proof=permit.verifyReadOnly(env,trust,ctx,{now:NOW});
 assert(permit.isVerified(proof));assert(!oldPermit.isVerified(proof));assert(!permit.isVerified(structuredClone(proof)));
 assert.throws(()=>oldPermit.verifyReadOnly(env,trust,ctx,{now:NOW}));
 for(const change of [{schema_version:'MCFT_CAP09_R4285_SIGNED_ISOLATED_TEST_PERMIT_V3'},
  {purpose:'ORIGINAL_SIX_STAGE_BUDGET_PREFLIGHT_ONLY'},{production_authorized:true},
  {nonce:'d'.repeat(64)},{qcp73_raw_sha256:'e'.repeat(64)}])
  assert.throws(()=>permit.verifyReadOnly(sign(permit.DOMAIN,{...p,...change}),trust,ctx,{now:NOW}));
 assert.throws(()=>permit.verifyReadOnly(sign(oldPermit.DOMAIN,p),trust,ctx,{now:NOW}),/SIGNATURE_INVALID/);
});
test('physical Permit cannot exceed adoption or Owner or omit the original full stage budget',()=>{
 const {p,ctx}=permitFixture();
 for(const patch of [{adoption_expires_at:iso(NOW+1000)},{resource_owner_expires_at:iso(NOW+1000)},
  {total_stage_budget_ms:15000000}])assert.throws(()=>permit.verifyReadOnly(sign(permit.DOMAIN,p),trust,{...ctx,...patch},{now:NOW}));
 const revoked=structuredClone(trust);revoked.issuers[0].revoked=true;
 assert.throws(()=>permit.verifyReadOnly(sign(permit.DOMAIN,p),revoked,ctx,{now:NOW}),/REVOKED/);
});
test('physical CLI accepts only its explicit TEST_ONLY session; fake factory and native proofs fail',async()=>{
 const input=path.join(os.tmpdir(),'input.json');assert.equal(host.parse(['--session-execute-test-only','--input',input]),input);
 for(const mode of ['--execute','--session-execute','--session-preflight-only'])assert.throws(()=>host.parse([mode,'--input',input]));
 await assert.rejects(host.acceptPreparedState({execution:true}),/FACTORY_RECEIVER/);
 assert.throws(()=>factory.beginExecution({execution:true}),/FACTORY_RECEIVER/);
 assert.throws(()=>admission.stableNative({adoption:{status:'PASS'}}),/REAL_NATIVE/);
});
test('physical admission retains native material, source authority and final CTO refresh order',async()=>{
 const f=dynamicFixture();try{
  const report=await f.module.verifyDynamicReadOnly(f.input,{now:NOW});assert.equal(report.permit_consumed,false);
  assert.deepEqual(f.events,['CURRENT_MAIN','PG','ACCOUNT_METADATA','S3','FULL_MATERIAL','SOURCE_AUTHORITY_NATIVE','FINAL_CTO_NATIVE']);
  const final=f.module.requireVerifiedFinal(report);assert.throws(()=>oldAdmission.assertFinal(final,{}),/NOT_LIVE/);
  assert.throws(()=>f.module.requireVerifiedFinal(structuredClone(report)),/CAPABILITY_REQUIRED/);
 }finally{f.cleanup();}
});
test('physical admission rejects preflight Intent and Final even under a valid signer',async()=>{
 const f=dynamicFixture();try{
  const final=structuredClone(f.input.finalEnvelope.payload);final.schema_version='MCFT_CAP09_R4285_FINAL_EXECUTION_APPROVAL_V3';
  final.decision='APPROVE_R4285_V3_FINAL_SINGLE_PREFLIGHT';f.input.finalEnvelope=sign(oldAdmission.DOMAIN,final);
  await assert.rejects(f.module.verifyDynamicReadOnly(f.input,{now:NOW}));
  const intent=JSON.parse(f.input.ctx.intent_raw_bytes);intent.schema_version='MCFT_CAP09_R4285_CTO_PREAUTH_INTENT_V3';
  intent.decision='APPROVE_V3_TEST_INTENT_NOT_PERMIT_OR_EXECUTION';intent.permit_authorized=false;intent.execute_authorized=false;
  assert.throws(()=>f.live.checkIntent(intent,f.input.ctx,{now:NOW}));
 }finally{f.cleanup();}
});
test('slow material or first real account failure cannot reach physical authorization',async()=>{
 for(const options of [{materialDelay:121000},{accountFailure:true}]){const f=dynamicFixture(options);try{
  await assert.rejects(f.module.verifyDynamicReadOnly(f.input,{now:NOW}));
 }finally{f.cleanup();}}
});
test('genuine V3 admission consumes twin ledger once; copied capabilities and repeat burn fail',async()=>{
 const f=dynamicFixture();try{
  const report=await f.module.verifyDynamicReadOnly(f.input,{now:NOW}),final=f.module.requireVerifiedFinal(report),a=atomicFixture(f);
  assert.throws(()=>a.prepare({...atomicArgs(f),nativeAdoption:structuredClone(f.adoption)}),/NATIVE_ADOPTION/);
  assert.throws(()=>a.prepare({...atomicArgs(f),permitProof:structuredClone(f.input.permitProof)}),/GENUINE/);
  const prepared=a.prepare(atomicArgs(f));assert.throws(()=>a.consumeForQualifiedHost(structuredClone(prepared),final),/CAPABILITY/);
  const consumed=a.consumeForQualifiedHost(prepared,final);assert.equal(a.assertConsumed(consumed),consumed);
  assert.throws(()=>a.assertConsumed(structuredClone(consumed)),/IN_PROCESS/);
  assert.throws(()=>a.consumeForQualifiedHost(prepared,final),/CAPABILITY/);
  assert.throws(()=>a.prepare(atomicArgs(f)),/ALREADY_RESERVED/);
  const one=fs.readFileSync(path.join(consumed.run_directory,'CONSUMED.json'));
  assert(one.equals(fs.readFileSync(path.join(consumed.nonce_directory,'CONSUMED.json'))));
  assert.equal(JSON.parse(one).production_authorized,false);
 }finally{f.cleanup();}
});
test('partial reservation burns in-process proof and nonce permanently without rollback',async()=>{
 const f=dynamicFixture();try{
  const report=await f.module.verifyDynamicReadOnly(f.input,{now:NOW}),final=f.module.requireVerifiedFinal(report);
  const stub=Object.create(fs);stub.mkdirSync=(file,options)=>{if(path.basename(file)==='run-'+f.input.ctx.run_id)throw Object.assign(Error('UNIT_DISK_FAILURE'),{code:'EIO'});return fs.mkdirSync(file,options);};
  const a=isolated(atomicFile,{'node:fs':stub,'./MCFT_CAP09_R4285_ADMISSION_EXEC_V3.cjs':f.live,
   '../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V3.cjs':{isNativeVerified:x=>f.nativeBrand.has(x)},
   '../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs':{verifyExactMain(){}}});
  const prepared=a.prepare(atomicArgs(f));assert.throws(()=>a.consumeForQualifiedHost(prepared,final),/UNIT_DISK_FAILURE/);
  assert(fs.existsSync(a.slotPaths(f.root,NONCE).nonce));assert.throws(()=>a.consumeForQualifiedHost(prepared,final),/CAPABILITY/);
  assert.throws(()=>a.prepare(atomicArgs(f)),/ALREADY_RESERVED/);
 }finally{f.cleanup();}
});
test('physical stage bridge rejects forged and old V2 consumption',()=>{
 const stage=require('./MCFT_CAP09_R4285_STAGE_CAPABILITY_EXEC_V3.cjs');
 assert.throws(()=>stage.initializeStageAuthority({status:'CONSUMED'},{},H),/IN_PROCESS/);
 assert.throws(()=>stage.issueStageCapability({consumed:{}},{id:'PRODUCER'}),/IN_PROCESS/);
});
test('no scheduling or child contract fork; only six original stages and original receipt supervisor',()=>{
 const scheduler=require('./MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs'),bridge=require('./MCFT_CAP09_R4285_STAGE_CAPABILITY_EXEC_V3.cjs');
 assert.deepEqual(bridge.STAGES,scheduler.STAGES);
 assert.equal(bridge.consumeStageCapability,require('./MCFT_CAP09_R4285_STAGE_CAPABILITY_V2.cjs').consumeStageCapability);
 const code=fs.readFileSync(path.join(__dirname,'MCFT_CAP09_R4285_WINDOWS_HOST_EXEC_V3.cjs'),'utf8');
 assert.match(code,/scheduler\.executeSixStages/);assert.match(code,/historical\.resolveStages/);
 assert.equal((code.match(/atomic\.consumeForQualifiedHost\(/g)||[]).length,1);
});
for(const executionRun of [require('./MCFT_CAP09_R4285_EXECUTION_IDENTITY_V3.cjs').SUCCESSOR])for(const failedStage of [null,'TIMING_2'])test('original scheduler with actual child claims '+executionRun+' '+(failedStage?'stops at '+failedStage:'seals all six fixture stages'),async()=>{
 const f=dynamicFixture({executionRun});try{
  const report=await f.module.verifyDynamicReadOnly(f.input,{now:NOW}),a=atomicFixture(f);
  const consumed=a.consumeForQualifiedHost(a.prepare(atomicArgs(f)),f.module.requireVerifiedFinal(report));
  const stage=isolated(path.join(__dirname,'MCFT_CAP09_R4285_STAGE_CAPABILITY_EXEC_V3.cjs'),{'./MCFT_CAP09_R4285_PERMIT_ATOMIC_EXEC_V3.cjs':a});
  const dispatch=isolated(path.join(__dirname,'MCFT_CAP09_R4285_PARENT_STAGE_DISPATCH_EXEC_V3.cjs'),{
   './MCFT_CAP09_R4285_PERMIT_ATOMIC_EXEC_V3.cjs':a,'./MCFT_CAP09_R4285_STAGE_CAPABILITY_EXEC_V3.cjs':stage});
  const authority=stage.initializeStageAuthority(consumed,f.input.permitEnvelope.payload,f.input.permitProof.envelope_sha256);
  const script=path.join(f.root,'fixture-child.cjs');fs.writeFileSync(script,`
   const fs=require('node:fs'),path=require('node:path');
   const cap=require(${JSON.stringify(require.resolve('./MCFT_CAP09_R4285_STAGE_CAPABILITY_V1.cjs'))});
   const ticket=process.env.MCFT_GOVERNED_RETRY_TICKET,p=JSON.parse(fs.readFileSync(ticket)).payload;
   cap.consumeStageCapability({ticket,run_directory:path.dirname(ticket),id:p.id,run_id:p.run_id,
    nonce:p.nonce,subject_sha:p.subject_sha,envelope_sha256:p.envelope_sha256,
    script:__filename,previous_sha256:p.previous_sha256});
   if(p.id===process.env.UNIT_FAIL_STAGE)process.exit(7);
   fs.writeFileSync(process.env.UNIT_ARTIFACT,JSON.stringify({status:'PASS',physical_delay_cases_executed:true,
    provider_pipeline_injected:false,retained_qualification_database_touched:false,fixture_only:true}));
  `);
  const scheduler=require('./MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs');
  const steps=scheduler.STAGES.map(id=>({id,script,cwd:f.root,executable:process.execPath,args:[script],
   artifact:path.join(f.root,id+'.artifact.json'),env:{...process.env,UNIT_ARTIFACT:path.join(f.root,id+'.artifact.json'),UNIT_FAIL_STAGE:failedStage||''}}));
  const operation=scheduler.executeSixStages({authority,plan:f.input.plan,steps,
   dispatch:dispatch.dispatchConsumedStageR4285,assertConsumed:a.assertConsumed});
  if(failedStage){await assert.rejects(operation);assert(!fs.existsSync(path.join(consumed.run_directory,'SPENT_R4285_TIMING_3')));
   assert(!fs.existsSync(path.join(consumed.run_directory,'SIX_STAGE_AUDIT.json')));
  }else{const result=await operation;assert.equal(result.stage_count,6);assert.equal(result.qualified,false);
   for(const id of scheduler.STAGES)assert(fs.existsSync(path.join(consumed.run_directory,'SPENT_R4285_'+id,'CLAIMED.json')));
  }
  assert.throws(()=>a.prepare(atomicArgs(f)),/ALREADY_RESERVED/);
 }finally{f.cleanup();}
});

function executionFactoryFixture({liveDelayMs=5,execution=true,executionRun=execution?require("./MCFT_CAP09_R4285_EXECUTION_IDENTITY_V3.cjs").SUCCESSOR:s.RUN}={}){const identity=require("./MCFT_CAP09_R4285_EXECUTION_IDENTITY_V3.cjs"),id={run_id:executionRun,host_id:s.HOST,subject_sha:SUBJECT,nonce:NONCE};const root=fs.mkdtempSync(path.join(os.tmpdir(),"r4285-factory-")),events=[],future=["resource_readback_file","resource_envelope_file","permit_envelope_file","final_execution_approval_file"];
 const p={...scopePayload(),run_id:executionRun},envScope=s.verifyScope(sign(s.DOMAIN,p),trust,id),i=Object.fromEntries(factory.INPUTS.map(k=>[k,path.join(root,k+".json")]));
 Object.assign(i,{source_root:path.join(root,"source"),release_root:path.join(root,"release"),nonce:NONCE,first_base:"2027-01-01T00:00:00.000Z",cto_intent_comment_id:1,source_approval_comment_id:2,launch_authorization_comment_id:3});
 fs.mkdirSync(i.source_root);fs.mkdirSync(i.release_root);
 if(executionRun!==s.RUN)fs.writeFileSync(path.join(root,"r4285-v3-preflight-"+identity.OLD_SCOPE+".json"),JSON.stringify({schema_version:"MCFT_CAP09_R4285_V3_EXECUTION_ATTEMPT_STARTED",scope_id:identity.OLD_SCOPE,nonce:identity.OLD_NONCE,permit_consumed:false,stage_count:0}));
 const ni={source_root:i.source_root,release_root:i.release_root,trust_file:path.join(root,"trust"),material_file:path.join(root,"material"),release_binding_file:path.join(root,"release-binding"),adoption_envelope_file:path.join(root,"adoption")};
 function put(file,obj){fs.writeFileSync(file,c.canonical(obj));}
 put(i.native_adoption_input_file,ni);put(ni.trust_file,{...trust,ledger_root:root});put(ni.material_file,{root:i.release_root,files:[]});put(ni.release_binding_file,{});put(ni.adoption_envelope_file,{payload:{expires_at:iso(NOW+16000000)}});
 put(i.plan_file,{stages:[{timeout_ms:10800000}]});put(i.observations_file,{});put(i.scope_envelope_file,sign(s.DOMAIN,p));fs.writeFileSync(i.source_policy_file,"unit policy");fs.writeFileSync(i.source_approval_file,"unit approval");fs.writeFileSync(i.cto_intent_file,"unit intent");fs.writeFileSync(i.launch_authorization_file,c.canonical({schema_version:"MCFT_CAP09_R4285_SESSION_LAUNCH_V3",...id,scope_id:envScope.scope_id,valid_from:iso(NOW-1000),expires_at:iso(NOW+16000000),decision:"AUTHORIZE_ONE_V3_SESSION_PREFLIGHT_ONLY",production_authorized:false}));
 if(execution){const launch=JSON.parse(fs.readFileSync(i.launch_authorization_file));launch.schema_version="MCFT_CAP09_R4285_PHYSICAL_SESSION_LAUNCH_V3";launch.decision="AUTHORIZE_ONE_V3_PHYSICAL_TEST_ONLY_SESSION";put(i.launch_authorization_file,launch);}
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
 mocks["./MCFT_CAP09_R4285_ADMISSION_EXEC_V3.cjs"]=mocks["./MCFT_CAP09_R4285_ADMISSION_V3.cjs"];
 mocks["./MCFT_CAP09_R4285_WINDOWS_HOST_EXEC_V3.cjs"]=mockHost;
 mocks["./MCFT_CAP09_R4285_BUILD_ADMISSION_EXEC_V3.cjs"]={verifyExecutionSources(){events.push("execution source bytes");}};
 const filename=path.join(__dirname,"MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs"),module={exports:{}};
 const producerFile=path.join(__dirname,"MCFT_CAP09_R4285_RESOURCE_OWNER_PRODUCER_V3.cjs");
 mocks["./MCFT_CAP09_R4285_RESOURCE_OWNER_PRODUCER_V3.cjs"]=isolated(producerFile,{
  "./MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs":new Proxy({},{get:(_,key)=>module.exports[key]}),
  "../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V3.cjs":nativeDouble,
  "node:os":{hostname:()=>s.HOST},
  "node:child_process":{spawnSync(){events.push("native source capture");return {status:1,stdout:Buffer.alloc(0)};}}
 },Date,{platform:"win32",env:{}});
 const localRequire=name=>Object.hasOwn(mocks,name)?mocks[name]:Module.createRequire(__filename)(name);
 vm.runInThisContext("(function(exports,require,module,__filename,__dirname,console,process){"+fs.readFileSync(filename,"utf8")+"\n})",{filename})(module.exports,localRequire,module,filename,__dirname,{log(){},error(){}},{...process,env:{}});
 return {i,events,root,factory:module.exports,get environment(){return environment;},get state(){return receivedState;},get finalChecks(){return finalChecks;},future,cleanup(){fs.rmSync(root,{recursive:true,force:true});}};
}

test('shared factory selects only the fixed authorized receiver and consumes a session once',async()=>{
 const f=executionFactoryFixture();try{
  const cap=await f.factory.prepareExecution(f.i);assert(f.events.indexOf('execution source bytes')<f.events.indexOf('FD3'));assert(f.events.indexOf('actual loading')<f.events.indexOf('FD3'));
  const first=f.factory.consume(cap);await assert.rejects(f.factory.consume(cap),/ALREADY_USED/);await first;
  assert.equal(f.state.execution,true);assert.equal(f.finalChecks,1);assert.equal(f.environment.DATABASE_URL,undefined);
  assert(fs.existsSync(path.join(f.root,'r4285-v3-preflight-'+f.state.scope.scope_id+'.json')));
 }finally{f.cleanup();}
});
test('cross-mode Launch cannot open FD3 or turn preflight permission into execution',async()=>{
 for(const execution of [true,false]){const f=executionFactoryFixture({execution,executionRun:require('./MCFT_CAP09_R4285_EXECUTION_IDENTITY_V3.cjs').SUCCESSOR});try{
  await assert.rejects(execution?f.factory.prepare(f.i):f.factory.prepareExecution(f.i),execution?/SUCCESSOR_EXECUTION_ONLY/:/LIVE_SESSION_NOT_AUTHORIZED/);
  assert(!f.events.includes('FD3'));
 }finally{f.cleanup();}}
});
test('execution QCP ownership is exact and preserves all prior checks and resolver definitions',()=>{
 const q=require('../governance_acceptance/VERIFY_MCFT_CAP09_R4285_PREPARE_LIVE_SOURCE_V3.cjs');
 const before=JSON.parse(cp.execFileSync('git',['show',q.EXECUTION_BASE+':'+native.QCP_PATH],{cwd:ROOT,encoding:'utf8'}));
 const authority=JSON.parse(cp.execFileSync('git',['show',q.NATIVE_TOOL_BASE+':'+native.QCP_PATH],{cwd:ROOT,encoding:'utf8'})),head='d'.repeat(40);
 const input={args:{base:q.EXECUTION_BASE,head},before,authority,plan:{status:'PASS',unknown_changed_paths:[],authority_errors:[],resolver_errors:[]},
  paths:[...q.EXECUTION_PATHS],changed:[...q.EXECUTION_PATHS],stage:'SUCCESSOR_SUBJECT_PRE_MERGE',
  event:{repository:{full_name:'liyongshang44-max/GEOX'},pull_request:{number:9999,user:{login:'liyongshang44-max'},
   base:{sha:q.EXECUTION_BASE,ref:'main'},head:{sha:head,ref:q.EXECUTION_BRANCH,repo:{full_name:'liyongshang44-max/GEOX'}}}}};
 assert(q.inspectSuccessor(input));assert.deepEqual(authority.checks.slice(0,72),before.checks.slice(0,72));
 for(const mutate of [x=>x.paths.push('unknown.cjs'),x=>x.authority.checks[0].owner='REWRITE',
  x=>x.authority.dependency_resolvers[q.EXECUTION_RESOLVER].paths.pop(),x=>x.event.pull_request.head.ref='other',
  x=>x.args.base='f'.repeat(40)]){const bad=structuredClone(input);mutate(bad);assert.throws(()=>q.inspectSuccessor(bad));}
});
test('all execution modules bind exact source, release inventory and installed material before FD3',()=>{
 const builder=require('./MCFT_CAP09_R4285_BUILD_ADMISSION_EXEC_V3.cjs'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'r4285-exec-binding-'));
 try{const source=path.join(tmp,'source'),release=path.join(tmp,'release'),bindingFile=path.join(tmp,'binding.json'),files=[];
  for(const rel of builder.EXECUTION_SOURCES){const bytes=fs.readFileSync(path.join(ROOT,rel));files.push({path:rel,sha256:s.sha(bytes)});
   for(const base of [source,release]){const file=path.join(base,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);}}
  const i={source_root:source,release_root:release,release_binding_file:bindingFile},profile={files};fs.writeFileSync(bindingFile,JSON.stringify({files}));
  assert(builder.verifyExecutionSources(i,profile));
  assert.throws(()=>builder.verifyExecutionSources(i,{files:files.slice(1)}),/MATERIAL_SOURCE_UNBOUND/);
  fs.writeFileSync(bindingFile,JSON.stringify({files:files.slice(1)}));assert.throws(()=>builder.verifyExecutionSources(i,profile),/RELEASE_SOURCE_UNBOUND/);
  fs.writeFileSync(bindingFile,JSON.stringify({files}));fs.appendFileSync(path.join(source,files[0].path),'\n// drift');
  assert.throws(()=>builder.verifyExecutionSources(i,profile),/SOURCE_BYTES_DRIFT/);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('actual execution receiver crosses genuine admission and atomic burn before scheduler; dispatch failure cleans copied secrets',async()=>{
 const f=dynamicFixture();try{
  const a=atomicFixture(f),x=f.input,state=x.preparedState,events=[];
  const i={source_root:f.root,release_root:f.root,output_root:path.join(f.root,'outputs'),resource_readback_file:x.resourceReadbackFile,
   resource_envelope_file:path.join(f.root,'owner.json'),permit_envelope_file:path.join(f.root,'permit.json'),
   final_execution_approval_file:path.join(f.root,'final.json')};
  for(const [file,value] of [[i.resource_envelope_file,x.resourceEnvelope],[i.permit_envelope_file,x.permitEnvelope],[i.final_execution_approval_file,x.finalEnvelope]])fs.writeFileSync(file,c.canonical(value));
  const resources={...x.resourceEnvelope.payload,positive_role:x.resourceEnvelope.payload.audit_user};
  Object.assign(state,{i,ctx:x.ctx,ni:x.nativeInput,trust:x.trust,adoption:f.adoption,environment:x.environment,profile:x.profile,
   intent:x.intent,intentRaw:x.ctx.intent_raw_bytes,stable:x.stable,scope:{scope_id:H,payload:{...id,run_id:x.ctx.run_id,issuer_id:issuer.issuer_id,key_id:issuer.key_id,
    expires_at:iso(NOW+20000000),resources}},approval:{sha256:H},owner_not_before:NOW-6000});
  const stepEnv={DATABASE_URL:'UNIT_SECRET_ONLY'},steps=[{env:stepEnv}];
  const receiver=isolated(path.join(__dirname,'MCFT_CAP09_R4285_WINDOWS_HOST_EXEC_V3.cjs'),{
   './MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs':{FUTURE:factory.FUTURE,requireReceiver(st){assert.equal(st,state);},setObservationDeadline(){},
    beginExecution(st,consumed){assert.equal(st,state);a.assertConsumed(consumed);events.push('burned');}},
   './MCFT_CAP09_R4285_BUILD_ADMISSION_EXEC_V3.cjs':{buildAdmissionV3(){return {resEnv:x.resourceEnvelope,readback:x.readback,permitProof:x.permitProof,permitEnv:x.permitEnvelope,observed:x.observations,plan:x.plan};}},
   './MCFT_CAP09_R4285_ADMISSION_EXEC_V3.cjs':f.live,'./MCFT_CAP09_R4285_HOST_ADMISSION_EXEC_V3.cjs':f.module,
   './MCFT_CAP09_R4285_PERMIT_ATOMIC_EXEC_V3.cjs':a,
   './MCFT_CAP09_R4285_STAGE_CAPABILITY_EXEC_V3.cjs':{initializeStageAuthority(consumed){a.assertConsumed(consumed);return {consumed};}},
   './MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs':{INPUTS:[],resolveStages(){return steps;}},
   './MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs':{STAGES:[],async executeSixStages({authority,steps}){
    a.assertConsumed(authority.consumed);assert.equal(steps[0].env.DATABASE_URL,'UNIT_SECRET_ONLY');events.push('scheduler');throw Error('UNIT_DISPATCH_FAILURE');}}
  });
  const report=await receiver.acceptPreparedState(state);assert(!fs.existsSync(a.slotPaths(f.root,NONCE).run));
  await assert.rejects(receiver.finishAtAcceptance(report,state),/UNIT_DISPATCH_FAILURE/);
  assert.deepEqual(events,['burned','scheduler']);assert.equal(stepEnv.DATABASE_URL,undefined);
  assert(fs.existsSync(path.join(a.slotPaths(f.root,NONCE).run,'CONSUMED.json')));
  await assert.rejects(receiver.finishAtAcceptance(report,state),/REAL_EXECUTION_ADMISSION/);
 }finally{f.cleanup();}
});

test('a closed preflight Scope cannot acquire execution credentials or start a new attempt',async()=>{
 const f=executionFactoryFixture();try{
  const payload=JSON.parse(fs.readFileSync(f.i.scope_envelope_file)).payload;
  const marker=path.join(f.root,'r4285-v3-preflight-'+s.scopeId(payload)+'.json');fs.writeFileSync(marker,'UNIT_CLOSED_PREFLIGHT');
  await assert.rejects(f.factory.prepareExecution(f.i),/SCOPE_ALREADY_ATTEMPTED/);assert(!f.events.includes('FD3'));
 }finally{f.cleanup();}
});


test("independent successor uses real signed Run bindings, reuses resource identity, and consumes new twin slots exactly once",async()=>{
 const identity=require("./MCFT_CAP09_R4285_EXECUTION_IDENTITY_V3.cjs"),f=dynamicFixture({executionRun:identity.SUCCESSOR});
 try{const oldMarker=path.join(f.root,"r4285-v3-preflight-"+identity.OLD_SCOPE+".json"),before=fs.readFileSync(oldMarker);
 const report=await f.module.verifyDynamicReadOnly(f.input,{now:NOW});assert.equal(report.run_id,identity.SUCCESSOR);
 const a=atomicFixture(f),prepared=a.prepare(atomicArgs(f)),consumed=a.consumeForQualifiedHost(prepared,f.module.requireVerifiedFinal(report));
 assert.equal(consumed.run_id,identity.SUCCESSOR);assert.equal(path.basename(consumed.run_directory),"run-"+identity.SUCCESSOR);a.assertConsumed(consumed);
 const receipt=JSON.parse(fs.readFileSync(path.join(consumed.run_directory,"CONSUMED.json")));assert.equal(receipt.attempt_ordinal,5);assert.equal(receipt.failed_predecessor_run_id,identity.LEGACY);
 assert(fs.readFileSync(oldMarker).equals(before));assert(!fs.existsSync(path.join(f.root,"run-"+identity.LEGACY)));
 assert.throws(()=>a.consumeForQualifiedHost(prepared,f.module.requireVerifiedFinal(report)));assert.throws(()=>a.prepare(atomicArgs(f)),/ALREADY_RESERVED/);
 }finally{f.cleanup();}
});

test("successor missing or changed predecessor history cannot reserve or burn",async()=>{
 const identity=require("./MCFT_CAP09_R4285_EXECUTION_IDENTITY_V3.cjs"),f=dynamicFixture({executionRun:identity.SUCCESSOR});
 try{const file=path.join(f.root,"r4285-v3-preflight-"+identity.OLD_SCOPE+".json"),original=fs.readFileSync(file),report=await f.module.verifyDynamicReadOnly(f.input,{now:NOW}),a=atomicFixture(f);
 fs.unlinkSync(file);assert.throws(()=>a.prepare(atomicArgs(f)),/ENOENT/);fs.writeFileSync(file,original);
 const prepared=a.prepare(atomicArgs(f));fs.writeFileSync(file,"{}");assert.throws(()=>a.consumeForQualifiedHost(prepared,f.module.requireVerifiedFinal(report)),/HISTORY_CHANGED/);
 assert(!fs.existsSync(path.join(f.root,"run-"+identity.SUCCESSOR)));assert(!fs.existsSync(path.join(f.root,"nonce-"+NONCE)));
 }finally{f.cleanup();}
});

test("successor rejects failed nonce, unregistered Run, and legacy Permit substitution",()=>{
 const identity=require("./MCFT_CAP09_R4285_EXECUTION_IDENTITY_V3.cjs");assert.throws(()=>identity.checkNonce(identity.SUCCESSOR,identity.OLD_NONCE),/NONCE_REUSE/);assert.throws(()=>identity.get("e".repeat(12)),/UNREGISTERED/);
 const {p,ctx}=permitFixture(identity.SUCCESSOR);assert(permit.isVerified(permit.verifyReadOnly(sign(permit.DOMAIN,p),trust,ctx,{now:NOW})));
 assert.throws(()=>permit.verifyReadOnly(sign(permit.DOMAIN,{...p,run_id:identity.LEGACY}),trust,ctx,{now:NOW}));
 assert.throws(()=>permit.verifyReadOnly(sign(permit.DOMAIN,{...p,attempt_ordinal:4}),trust,ctx,{now:NOW}));
 assert.throws(()=>permit.verifyReadOnly(sign(permit.DOMAIN,p),trust,{...ctx,run_id:identity.LEGACY},{now:NOW}));
});


test("successor resource mapping retains existing PG and bucket without using the execution Run as a resource name",()=>{
 const identity=require("./MCFT_CAP09_R4285_EXECUTION_IDENTITY_V3.cjs"),current=require("./MCFT_CAP09_R4285_CURRENT_BASELINE_EXECUTION_V1.cjs");
 const output=path.join(os.tmpdir(),"UNIT_ONLY_SUCCESSOR_OUTPUT"),base="2027-01-01T00:00:00.000Z",env={DATABASE_URL:`postgres://unit:unit@127.0.0.1:55492/mcft_cap09_requal_${identity.LEGACY}_positive`,BLOCKED_DATABASE_URL:`postgres://unit:unit@127.0.0.1:55492/mcft_cap09_requal_${identity.LEGACY}_negative`,MCFT_CAP09_FORMAL_RAW_ENDPOINT:"http://127.0.0.1:59292/",MCFT_CAP09_FORMAL_RAW_BUCKET:"mcft-cap09-requal-"+identity.LEGACY,MCFT_QUALIFICATION_FIRST_BASE:base,MCFT_CURRENT_QUALIFICATION_OUTPUT_DIR:output};
 const targets=current.isolatedTargets({isolated_run_id:identity.SUCCESSOR,qualification_first_base:base},env);
 assert.equal(targets.positive,`mcft_cap09_requal_${identity.LEGACY}_positive`);assert.equal(targets.bucket,"mcft-cap09-requal-"+identity.LEGACY);
 assert.throws(()=>current.isolatedTargets({isolated_run_id:identity.SUCCESSOR,qualification_first_base:base},{...env,MCFT_CAP09_FORMAL_RAW_BUCKET:"mcft-cap09-requal-"+identity.SUCCESSOR}));
 const p={...scopePayload(),run_id:identity.SUCCESSOR},ctx={...id,run_id:identity.SUCCESSOR};assert.equal(s.verifyScope(sign(s.DOMAIN,p),trust,ctx,{now:NOW}).payload.run_id,identity.SUCCESSOR);
 assert.throws(()=>s.verifyScope(sign(s.DOMAIN,p),trust,id,{now:NOW}));assert.throws(()=>s.verifyScope(sign(s.DOMAIN,{...p,resources:{...p.resources,bucket:"mcft-cap09-requal-"+identity.SUCCESSOR}}),trust,ctx,{now:NOW}));
});

test("successor partial reservation preserves fatal-burn behavior and never removes historical records",async()=>{
 const identity=require("./MCFT_CAP09_R4285_EXECUTION_IDENTITY_V3.cjs"),f=dynamicFixture({executionRun:identity.SUCCESSOR});
 try{const report=await f.module.verifyDynamicReadOnly(f.input,{now:NOW}),a=atomicFixture(f),prepared=a.prepare(atomicArgs(f)),original=fs.mkdirSync;
 fs.mkdirSync=(dir,...args)=>{if(path.basename(dir)==="run-"+identity.SUCCESSOR)throw Error("UNIT_SUCCESSOR_RUN_RESERVATION_FAILURE");return original(dir,...args);};
 try{assert.throws(()=>a.consumeForQualifiedHost(prepared,f.module.requireVerifiedFinal(report)),/RESERVATION_FAILURE/);}finally{fs.mkdirSync=original;}
 assert(fs.existsSync(path.join(f.root,"nonce-"+NONCE)));assert(!fs.existsSync(path.join(f.root,"run-"+identity.SUCCESSOR)));
 assert.throws(()=>a.consumeForQualifiedHost(prepared,f.module.requireVerifiedFinal(report)),/PREPARED_CAPABILITY_REQUIRED/);assert.throws(()=>a.prepare(atomicArgs(f)),/ALREADY_RESERVED/);
 assert(fs.existsSync(path.join(f.root,"r4285-v3-preflight-"+identity.OLD_SCOPE+".json")));
 }finally{f.cleanup();}
});

test("successor history does not silently bypass any predecessor Run or nonce reservation",()=>{
 const identity=require("./MCFT_CAP09_R4285_EXECUTION_IDENTITY_V3.cjs"),f=dynamicFixture({executionRun:identity.SUCCESSOR});
 try{for(const name of ["run-"+identity.LEGACY,"nonce-"+identity.OLD_NONCE]){const dir=path.join(f.root,name);fs.mkdirSync(dir);assert.throws(()=>identity.checkHistory(f.root,identity.SUCCESSOR),/PREDECESSOR_CONSUMPTION_REQUIRES_REVIEW/);fs.rmdirSync(dir);}}
 finally{f.cleanup();}
});


test("actual shared factory carries successor Run from signed Scope into receiver and rejects successor preflight mode before FD3",async()=>{
 const identity=require("./MCFT_CAP09_R4285_EXECUTION_IDENTITY_V3.cjs"),f=executionFactoryFixture({executionRun:identity.SUCCESSOR});
 try{const cap=await f.factory.prepareExecution(f.i);await f.factory.consume(cap);assert.equal(f.state.ctx.run_id,identity.SUCCESSOR);assert(f.events.includes("FD3"));}
 finally{f.cleanup();}
 const g=executionFactoryFixture({executionRun:identity.SUCCESSOR,execution:false});
 try{await assert.rejects(g.factory.prepare(g.i),/SUCCESSOR_EXECUTION_ONLY/);assert(!g.events.includes("FD3"));}finally{g.cleanup();}
});


test("valid-looking edits to the predecessor marker after preparation are rejected at burn",async()=>{
 const identity=require("./MCFT_CAP09_R4285_EXECUTION_IDENTITY_V3.cjs"),f=dynamicFixture({executionRun:identity.SUCCESSOR});
 try{const report=await f.module.verifyDynamicReadOnly(f.input,{now:NOW}),a=atomicFixture(f),prepared=a.prepare(atomicArgs(f)),file=path.join(f.root,"r4285-v3-preflight-"+identity.OLD_SCOPE+".json"),p=JSON.parse(fs.readFileSync(file));p.started_at="2000-01-01T00:00:00.000Z";fs.writeFileSync(file,JSON.stringify(p));
 assert.throws(()=>a.consumeForQualifiedHost(prepared,f.module.requireVerifiedFinal(report)),/MARKER_BYTES_CHANGED/);assert(!fs.existsSync(path.join(f.root,"run-"+identity.SUCCESSOR)));assert(!fs.existsSync(path.join(f.root,"nonce-"+NONCE)));
 }finally{f.cleanup();}
});


test("physical factory rejects legacy Run before loader, FD3, receiver or ledger writes; legacy read-only Scope still verifies",async()=>{
 const identity=require("./MCFT_CAP09_R4285_EXECUTION_IDENTITY_V3.cjs"),f=executionFactoryFixture({executionRun:identity.LEGACY});
 try{await assert.rejects(f.factory.prepareExecution(f.i),/PHYSICAL_SUCCESSOR_RUN_REQUIRED/);assert(!f.events.includes("FD3"));assert(!f.events.includes("actual loading"));assert(!f.events.includes("live"));assert(!fs.existsSync(path.join(f.root,"run-"+identity.LEGACY)));assert(!fs.existsSync(path.join(f.root,"nonce-"+NONCE)));}
 finally{f.cleanup();}
 assert.equal(scoped().payload.run_id,identity.LEGACY);
 const old=dynamicFixture({executionRun:identity.LEGACY});try{const a=atomicFixture(old);assert.throws(()=>a.prepare(atomicArgs(old)),/PHYSICAL_SUCCESSOR_RUN_REQUIRED/);assert(!fs.existsSync(path.join(old.root,"run-"+identity.LEGACY)));}finally{old.cleanup();}
});
