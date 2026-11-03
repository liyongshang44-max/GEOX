"use strict";
// Non-authorizing readback of the existing TEST_ONLY account through both
// original exported probes. Never invoke Host.run/preflight/execute or sign.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../..");
const bucket="mcft-cap09-requal-4285c3ce342c",endpoint="http://127.0.0.1:59292/";
const expected="d2750d767455ae4d11af9c96b10b7935c5f2f2bd7db4d032e80c1ab573352bf1";
async function main(){
 const x=JSON.parse(fs.readFileSync(0,"utf8").replace(/^\uFEFF/,""));
 assert.equal(crypto.createHash("sha256").update(x.accessKey).digest("hex"),expected,"ACCOUNT_IDENTITY");
 assert.equal(typeof x.secretKey,"string","ACCOUNT_SECRET");
 assert(x.secretKey.length>0,"ACCOUNT_SECRET");
 const expiry=Date.parse("2026-11-05T05:52:27Z");
 assert(expiry-Date.now()>120000,"ACCOUNT_EXPIRY");
 const sdk=require(require.resolve("@aws-sdk/client-s3",{paths:[root]}));
 for(const k of ["S3Client","HeadBucketCommand","ListObjectsV2Command","ListObjectVersionsCommand","ListMultipartUploadsCommand"])
  assert.equal(typeof sdk[k],"function","SDK_EXPORT");
 const env={MCFT_CAP09_FORMAL_RAW_BUCKET:bucket,MCFT_CAP09_FORMAL_RAW_ENDPOINT:endpoint,
  MCFT_CAP09_FORMAL_RAW_REGION:"us-east-1",MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID:x.accessKey,
  MCFT_CAP09_FORMAL_RAW_SECRET_ACCESS_KEY:x.secretKey};
 const host=require("./MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs");
 const producer=require("./MCFT_CAP09_R4285_RESOURCE_OWNER_PRODUCER_V2.cjs");
 const results=[];
 for(const [component,fn] of [
  ["HOST_V1_S3_PROBE",()=>host.probeS3ReadOnly(root,{bucket,bucket_endpoint:endpoint},env)],
  ["PRODUCER_V2_S3_FOUR_READS",()=>producer.probeS3({release_root:root,bucket_endpoint:endpoint},env)]]){
  const started=performance.now();
  try{const r=await fn();results.push({component,status:"PASS",operations:r.operations||r.probe_operations,
   elapsed_ms:Math.round(performance.now()-started)});}
  catch(e){
   const code=/^OWNER_PRODUCER_S3_[A-Z0-9_]+$/.test(e.message||"")?e.message:
    new Set(["AccessDenied","InvalidAccessKeyId","SignatureDoesNotMatch","ExpiredToken","NoSuchBucket","ECONNREFUSED","ETIMEDOUT"]).has(e.name)?e.name:"REDACTED_FAILURE";
   results.push({component,status:"HOLD",reason_code:code,elapsed_ms:Math.round(performance.now()-started)});
   break;
  }
 }
 const pass=results.length===2&&results.every(r=>r.status==="PASS"&&r.operations===4);
 console.log(JSON.stringify({schema_version:"R4285_S3_READBACK_V2",status:pass?"PASS":"HOLD",
  release_root:root,real_release_root_require_resolve:"PASS",account_identity_sha256:expected,
  expires_at_utc:"2026-11-05T05:52:27Z",expiry_local_time_check:"PASS",bucket,endpoint,results,
  scope:"TEST_ONLY_DATA_PLANE",independent_control_plane_verified:false,owner_verified:false,
  permit_issued:false,execution_authorized:false,original_six_stages_executed:0}));
 process.exitCode=pass?0:2;
}
if(require.main===module)main().catch(()=>{
 console.log(JSON.stringify({schema_version:"R4285_S3_READBACK_V2",status:"HOLD",reason_code:"INPUT_EXPIRY_OR_MODULE_GATE",execution_authorized:false}));process.exitCode=2;
});
