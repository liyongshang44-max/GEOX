"use strict";
// Same four actual read-only operations; session cancellation is mandatory.
const s=require("./MCFT_CAP09_R4285_SCOPE_V3.cjs");
async function probe(releaseRoot,p,env,signal){
 s.check(signal&&typeof signal.throwIfAborted==="function","V3_SESSION_SIGNAL_REQUIRED");signal.throwIfAborted();
 const sdk=require(require.resolve("@aws-sdk/client-s3",{paths:[releaseRoot]}));
 const client=new sdk.S3Client({endpoint:p.bucket_endpoint,region:env.MCFT_CAP09_FORMAL_RAW_REGION,forcePathStyle:true,
  credentials:{accessKeyId:env.MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID,secretAccessKey:env.MCFT_CAP09_FORMAL_RAW_SECRET_ACCESS_KEY},maxAttempts:1});
 const send=Command=>{signal.throwIfAborted();return client.send(new Command({Bucket:p.bucket,...(Command===sdk.ListMultipartUploadsCommand?{MaxUploads:2}:Command===sdk.HeadBucketCommand?{}:{MaxKeys:2})}),{abortSignal:signal});};
 try{await send(sdk.HeadBucketCommand);const objects=await send(sdk.ListObjectsV2Command),versions=await send(sdk.ListObjectVersionsCommand),uploads=await send(sdk.ListMultipartUploadsCommand);
  signal.throwIfAborted();s.check(!objects.IsTruncated&&!(objects.Contents||[]).length&&!versions.IsTruncated&&!(versions.Versions||[]).length&&!(versions.DeleteMarkers||[]).length&&!uploads.IsTruncated&&!(uploads.Uploads||[]).length,"V3_S3_BUCKET_NOT_EMPTY");
  return Object.freeze({status:"R4285_REAL_S3_EMPTY_PRIVATE_SCOPED_READONLY",operations:4,no_write:true});
 }catch(error){signal.throwIfAborted();if(/^V3_[A-Z0-9_]+$/.test(error?.message||""))throw error;
  const known=["AccessDenied","NoSuchBucket","InvalidAccessKeyId","SignatureDoesNotMatch","ExpiredToken","RequestTimeTooSkewed"];
  throw Error("V3_S3_"+(known.includes(error?.name)?error.name.toUpperCase():"READONLY_REQUEST_FAILED"));
 }finally{client.destroy();}
}
module.exports={probe};
