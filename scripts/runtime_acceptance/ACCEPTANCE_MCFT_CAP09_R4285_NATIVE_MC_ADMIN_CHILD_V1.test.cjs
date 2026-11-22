"use strict";
// A128 physical MC admin child boundary. Synthetic inputs only: no MinIO,
// Docker, production credentials, Host, signing, Permit or real file access.
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const crypto=require("node:crypto");
const {AsyncLocalStorage}=require("node:async_hooks");
const SOURCE=path.join(__dirname,"MCFT_CAP09_R4285_RESOURCE_OWNER_PRODUCER_V3.cjs");
const text=fs.readFileSync(SOURCE,"utf8");
const first=text.indexOf("// A128 physical Producer: a scoped, ephemeral MC admin connection.");
const last=text.indexOf("// End A128 physical-only MC child authentication boundary.");
assert(first>=0&&last>first,"A128_PHYSICAL_ADMIN_BOUNDARY_NOT_PRESENT");
const body=text.slice(first,last+"// End A128 physical-only MC child authentication boundary.".length);
const digest=x=>crypto.createHash("sha256").update(Buffer.from(x)).digest("hex");
function fixture(overrides={}){
 const env={
  MCFT_CAP09_R4285_EXISTING_MC_ALIAS:overrides.alias??"r4285",
  MCFT_CAP09_R4285_PARENT_ACCESS_KEY_ID:overrides.parent??"synthetic-parent",
  MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID:overrides.account??"synthetic-service-account"
 };
 const state={scope:{scope_id:"synthetic-scope",payload:{resources:{
  minio_deployment_id:overrides.deployment??"ddbc6bb9-eb52-4b95-8324-b556697f8c0e",
  bucket_endpoint:overrides.endpoint??"http://127.0.0.1:59292/",
  parent_principal_sha256:digest("synthetic-parent"),
  s3_account_sha256:digest("synthetic-service-account")
 }}},ctx:{run_id:"synthetic-physical-run"}};
 const p=new WeakMap(),calls=[];
 p.set(env,{execution:overrides.execution??true,scope_id:overrides.scopeId??"synthetic-scope",
  execution_run_id:overrides.runId??"synthetic-physical-run",receiver_state:state});
 const envParent={SYSTEMROOT:"C:\\Windows",PATH:"C:\\Windows\\System32",
   AWS_SECRET_ACCESS_KEY:"forbidden-synthetic",MC_HOST_intruder:"forbidden-synthetic"};
 const fsFake={
  lstatSync(){if(overrides.fileMissing)throw Error("SYNTHETIC_NOT_FOUND");
   return {isFile:()=>true,nlink:1,size:1024,dev:2,ino:3,mtimeMs:4,ctimeMs:5};},
  readFileSync(){calls.push("READ_PRIVATE");
   return Buffer.from("MINIO_ROOT_USER="+(overrides.rootUser??"synthetic-admin")+
     "\nMINIO_ROOT_PASSWORD="+(overrides.rootPass??"synthetic-secret")+"\n");}
 };
 const cpFake={spawnSync(binary,args,options){
  calls.push("ACL_CHECK");
  assert.equal(binary,"powershell.exe");
  assert(!Object.keys(options.env).some(k=>/SECRET|MC_HOST|AWS/i.test(k)));
  assert(!JSON.stringify(args).includes("synthetic-secret"));
  return {status:overrides.aclFailure?2:0,
   stdout:overrides.aclFailure?"":"ACL_PASS",stderr:""};
 }};
 const context={AsyncLocalStorage,assert,fs:fsFake,path,Buffer,process:{env:envParent},
   producerContexts:p,nativeEnvironment:()=>env,host:()=>{},noLinks:()=>{},
   sha:x=>crypto.createHash("sha256").update(x).digest("hex"),
   require:n=>{
    if(n==="node:child_process")return cpFake;
    if(n==="./MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs")
      return {requireReceiver:()=>{if(overrides.revoked)throw Error("REVOKED");}};
    throw Error("UNEXPECTED_MODULE");
   }};
 vm.runInNewContext(body+"\nglobalThis.mcTest={withPhysicalMcAdmin,physicalMcMinimalEnvironment,scoped:()=>physicalMcAdminContext.getStore()};",context);
 return {h:context.mcTest,calls,env,envParent};
}
test("A128 bound admin only appears in exact MC child environment",()=>{
 const f=fixture(),initial=JSON.stringify(f.envParent);
 const child=f.h.withPhysicalMcAdmin(()=>f.h.physicalMcMinimalEnvironment(f.h.scoped()));
 assert.equal(child.MC_HOST_r4285,
  "http://synthetic-admin:synthetic-secret@127.0.0.1:59292");
 assert(!Object.keys(child).some(x=>/AWS|TOKEN|DATABASE_URL|SECRET|MC_HOST_intruder/i.test(x)));
 assert.equal(JSON.stringify(f.envParent),initial);
 assert.equal(f.h.scoped(),undefined);
 assert.deepEqual(f.calls,["ACL_CHECK","READ_PRIVATE"]);
});
test("A128 negative business account cannot be used as admin principal",()=>{
 const f=fixture({rootUser:"synthetic-service-account"});
 assert.throws(()=>f.h.withPhysicalMcAdmin(()=>true),
  /HOLD_NATIVE_MC_ADMIN_ACCOUNT_NOT_ROOT/);
 assert.deepEqual(f.calls,["ACL_CHECK","READ_PRIVATE"]);
});
test("A128 temporary binding cleared even after callback failure",()=>{
 const f=fixture();
 assert.throws(()=>f.h.withPhysicalMcAdmin(()=>{
  assert.equal(f.h.physicalMcMinimalEnvironment(f.h.scoped()).MC_HOST_r4285,
   "http://synthetic-admin:synthetic-secret@127.0.0.1:59292");
  throw Error("SYNTHETIC_CALLBACK_FAILED");
 }),/SYNTHETIC_CALLBACK_FAILED/);
 assert.equal(f.h.scoped(),undefined);
});
test("A128 fail closes missing physical capability and wrong bound identities",()=>{
 const cases=[
  {execution:false},{scopeId:"wrong-scope"},{runId:"wrong-run"},
  {alias:"other-alias"},{parent:"wrong-parent"},{account:"wrong-account"},
  {deployment:"wrong-deployment"},{endpoint:"http://127.0.0.1:1/"}
 ];
 for(const input of cases){
  const f=fixture(input);
  assert.throws(()=>f.h.withPhysicalMcAdmin(()=>true),/HOLD_NATIVE_MC_ADMIN_/);
  assert(!f.calls.includes("READ_PRIVATE"),JSON.stringify(input));
 }
});
test("A128 ACL failure blocks private file read and native connection",()=>{
 const f=fixture({aclFailure:true});
 assert.throws(()=>f.h.withPhysicalMcAdmin(()=>true),/HOLD_NATIVE_MC_ADMIN_PRIVATE_ACL/);
 assert.deepEqual(f.calls,["ACL_CHECK"]);
});
test("A128 revoked receiver and missing private source fail closed",()=>{
 for(const input of [{revoked:true},{fileMissing:true}]){
  const f=fixture(input);
  assert.throws(()=>f.h.withPhysicalMcAdmin(()=>true));
  assert(!f.calls.includes("READ_PRIVATE"));
 }
});
test("A128 signed and physical gates preserve scoped exact native invocation",()=>{
 assert.match(text,/const captured=withPhysicalMcAdmin\(\(\)=>captureCurrentNativeSourceOnly/);
 assert.match(text,/preparation\.execution===true\?\s*withPhysicalMcAdmin\(\(\)=>verifyFormalEvidence/);
 assert.match(text,/env:tool==="mc"\?physicalMcMinimalEnvironment\(physicalMcAdminContext\.getStore\(\)\):nativeChildEnvironment\(\)/);
 assert.match(text,/function registeredMcExecutable\(\)/);
 assert.match(text,/c8db13ebeda31497f354c0e950809db0ae9b2a2a69b8afee68c128c37300c157/);
 assert.doesNotMatch(body,/writeFileSync|mkdirSync|createWriteStream|execSync|shell:true|Set-Acl|icacls/);
});
