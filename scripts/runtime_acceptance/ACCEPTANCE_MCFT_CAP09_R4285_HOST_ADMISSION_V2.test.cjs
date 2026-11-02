"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const v2host=require("./MCFT_CAP09_R4285_HOST_ADMISSION_V2.cjs");
test("V2 Host exports a read-only admission boundary only",()=>{
 const exports=Object.keys(v2host);
 assert.deepEqual(exports.sort(),["noUnsafeEnvironment","verifyDynamicReadOnly","requireVerifiedFinal"].sort());
 assert(!exports.some(k=>/^(execute|consume|sign|issue|preflight)$/i.test(k)));
});
test("forged stable identity never reaches Windows PG/S3 or ordinary V1 preflight",async()=>{
 await assert.rejects(v2host.verifyDynamicReadOnly({stable:{status:"PASS"},intent:{status:"PASS"},ctx:{}}),
  /V2_STABLE_NOT_VERIFIED/);
});
test("V2 no-permit and no-Owner inputs fail closed before resource checks",async()=>{
 await assert.rejects(v2host.verifyDynamicReadOnly({}),/STABLE_INPUT_REQUIRED/);
});

test("V2 final proof cannot be fabricated from ordinary read-only status",()=>{
 assert.throws(()=>v2host.requireVerifiedFinal({
   status:"R4285_V2_FINAL_READONLY_BINDING_VERIFIED_NOT_PREFLIGHT_OR_EXECUTION"
 }),/V2_FINAL_READONLY_HOST_CAPABILITY_REQUIRED/);
});

// Exercise the same root resolution used by the frozen Host and V2 Producer.
// This is a packaging gate, with no credentials, resource requests or authority.
test("V2 candidate declares, locks and loads the real root S3 runtime",()=>{
 const fs=require("node:fs"),path=require("node:path");
 const root=path.resolve(__dirname,"../..");
 const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
 const version=pkg.dependencies["@aws-sdk/client-s3"];
 assert.match(version,/^\d+\.\d+\.\d+$/,"SDK_VERSION_MUST_BE_EXACT");
 const lock=fs.readFileSync(path.join(root,"pnpm-lock.yaml"),"utf8");
 const importer=lock.split("  .:\n")[1]?.split("    devDependencies:")[0];
 assert(importer?.includes("      '@aws-sdk/client-s3':\n        specifier: "+version+"\n        version: "+version+"\n"),"SDK_ROOT_LOCK_MISMATCH");
 assert(lock.includes("  '@aws-sdk/client-s3@"+version+"':"),"SDK_LOCK_PACKAGE_ABSENT");
 const entry=require.resolve("@aws-sdk/client-s3",{paths:[root]});
 const real=fs.realpathSync(entry);
 assert(!path.relative(root,real).startsWith(".."),"SDK_OUTSIDE_CANDIDATE_ROOT");
 const installed=require(require.resolve("@aws-sdk/client-s3/package.json",{paths:[root]}));
 assert.equal(installed.version,version,"SDK_INSTALLED_VERSION_MISMATCH");
 const sdk=require(entry);
 for(const name of ["S3Client","HeadBucketCommand","ListObjectsV2Command","ListObjectVersionsCommand","ListMultipartUploadsCommand"])
  assert.equal(typeof sdk[name],"function",name);
 for(const name of ["pg","tsx"]){
  const resolved=fs.realpathSync(require.resolve(name,{paths:[root]}));
  assert(!path.relative(root,resolved).startsWith(".."),name+"_OUTSIDE_CANDIDATE_ROOT");
  require(resolved);
 }
});
