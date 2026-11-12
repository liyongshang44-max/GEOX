"use strict";
// CASE B successor-only, offline trust-boundary regression.
// No live IAM, Docker, GitHub, account creation, Permit, Host or M4 stages.
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const hash=s=>crypto.createHash("sha256").update(Buffer.from(s)).digest("hex");
const src=path.resolve(__dirname,"MCFT_CAP09_R4285_RESOURCE_OWNER_PRODUCER_V3.cjs");
const contents=fs.readFileSync(src,"utf8");
const begin=contents.indexOf("function trustedPolicyAccountSha(");
const end=contents.indexOf("function liveReachability(",begin);
assert(begin>=0&&end>begin,"EXPECTED_PATCHED_PRODUCER_FUNCTION");
const helper=contents.slice(begin,end);
const PARENT="UNIT_PARENT",ACCOUNT="UNIT_REPLACEMENT_ACCESS_ID",RUN="UNIT_RUN",SCOPE="d".repeat(64);
function fixture(){
 const env={MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID:ACCOUNT,MCFT_CAP09_R4285_PARENT_ACCESS_KEY_ID:PARENT};
 const state={scope:{scope_id:SCOPE,payload:{resources:{s3_account_sha256:hash(ACCOUNT),parent_principal_sha256:hash(PARENT)}}},ctx:{run_id:RUN},active:true};
 const producerContexts=new WeakMap();
 producerContexts.set(env,{receiver_state:state,scope_id:SCOPE,execution_run_id:RUN});
 const receiver={called:0,requireReceiver(x){this.called++;if(x!==state||!state.active)throw Error("V3_FACTORY_RECEIVER_REQUIRED");return true;}};
 const box={Buffer,producerContexts,assert,X:/^[a-f0-9]{64}$/,sha:x=>crypto.createHash("sha256").update(x).digest("hex"),require:x=>{
  assert.equal(x,"./MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs");return {requireReceiver:x=>receiver.requireReceiver(x)};
 }};
 vm.runInNewContext(helper+"\nthis.verify=trustedPolicyAccountSha;",box,{timeout:1000});
 return {env,state,producerContexts,receiver,verify:(p=PARENT,a=ACCOUNT)=>box.verify(env,p,a)};
}
test("same-live-receiver plus matching verified Scope account and Parent: compatible",()=>{
 const f=fixture();assert.equal(f.verify(),hash(ACCOUNT));assert.equal(f.receiver.called,1);
});
test("source-only caller environment without private receiver map: HOLD",()=>{
 const f=fixture();f.producerContexts.delete(f.env);assert.throws(()=>f.verify(),/PREPARE_SCOPE_REQUIRED/);
});
test("caller environment claiming signed account SHA cannot manufacture live capability",()=>{
 const f=fixture();f.producerContexts.delete(f.env);
 f.env.s3_account_sha256=hash(ACCOUNT);f.env.scope_id=SCOPE;f.env.receiver_state=f.state;
 assert.throws(()=>f.verify(),/PREPARE_SCOPE_REQUIRED/);
});
test("private context without receiver state: HOLD",()=>{
 const f=fixture();f.producerContexts.set(f.env,{scope_id:SCOPE,execution_run_id:RUN});
 assert.throws(()=>f.verify(),/PREPARE_SCOPE_REQUIRED/);
});
test("scope digest mismatch: HOLD before receiver",()=>{
 const f=fixture();f.producerContexts.set(f.env,{receiver_state:f.state,scope_id:"e".repeat(64),execution_run_id:RUN});
 assert.throws(()=>f.verify(),/PREPARE_SCOPE_REQUIRED/);assert.equal(f.receiver.called,0);
});
test("run identity mismatch: HOLD before receiver",()=>{
 const f=fixture();f.producerContexts.set(f.env,{receiver_state:f.state,scope_id:SCOPE,execution_run_id:"OTHER"});
 assert.throws(()=>f.verify(),/PREPARE_SCOPE_REQUIRED/);assert.equal(f.receiver.called,0);
});
test("revoked/nonlive receiver: HOLD",()=>{
 const f=fixture();f.state.active=false;assert.throws(()=>f.verify(),/V3_FACTORY_RECEIVER_REQUIRED/);
});
test("replacement account differs from trusted signed Scope: HOLD",()=>{
 const f=fixture();assert.throws(()=>f.verify(PARENT,"DIFFERENT_ACCOUNT"),/ACCOUNT_BINDING/);
});
test("Parent differs from trusted signed Scope: HOLD",()=>{
 const f=fixture();assert.throws(()=>f.verify("DIFFERENT_PARENT",ACCOUNT),/ACCOUNT_BINDING/);
});
test("invalid signed resource SHA: HOLD",()=>{
 const f=fixture();f.state.scope.payload.resources.s3_account_sha256="not-a-sha";
 assert.throws(()=>f.verify());
});
test("non-empty Mapping still requires exact named policy, seven-pair check and singleton",()=>{
 assert.match(contents,/restrictedParentPolicyMappings\(result\)/);
 assert.match(contents,/verifyRestrictedParentPolicyDefinition\(mc\(/);
 assert.match(contents,/f\.accounts\.length===1&&f\.accounts\[0\]===f\.account/);
 assert.match(contents,/verifyReplacementPolicyV2\(doc\)/);
});
test("untrusted direct CLI path does not become a receiver",()=>{
 assert.match(contents,/producerContexts\.set\(env,\{adoption,scope_id:scope\.scope_id,execution_run_id/);
 assert.match(contents,/receiver_state:state/);
 const f=fixture();f.producerContexts.set(f.env,{scope_id:SCOPE,execution_run_id:RUN});
 assert.throws(()=>f.verify(),/PREPARE_SCOPE_REQUIRED/);
});
