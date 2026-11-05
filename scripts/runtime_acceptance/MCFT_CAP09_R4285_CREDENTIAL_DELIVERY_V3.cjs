"use strict";
const fs=require("node:fs");
const s=require("./MCFT_CAP09_R4285_SCOPE_V3.cjs");
const KEYS=Object.freeze(["DATABASE_URL","BLOCKED_DATABASE_URL","MCFT_CAP09_FORMAL_RAW_BUCKET","MCFT_CAP09_FORMAL_RAW_ENDPOINT","MCFT_CAP09_FORMAL_RAW_REGION","MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID","MCFT_CAP09_FORMAL_RAW_SECRET_ACCESS_KEY"]);
const FIELDS=["schema_version","issuer_id","key_id","run_id","subject_sha","host_id","nonce","scope_id","delivery_source_id","issued_at","expires_at","environment"];
function parentClean(env){const keys=Object.keys(env).map(k=>k.toUpperCase());
 const publicIdentifiers=new Set(["MCFT_CAP09_R4285_PARENT_ACCESS_KEY_ID"]);
 s.check(!KEYS.some(k=>keys.includes(k))&&!keys.some(k=>["NODE_OPTIONS","NODE_PATH","PYTHONPATH","PYTHONHOME","AWS_PROFILE","AWS_CONFIG_FILE","AWS_SHARED_CREDENTIALS_FILE","PGPASSFILE","PGSERVICEFILE"].includes(k)||(!publicIdentifiers.has(k)&&/(?:PASSWORD|SECRET|TOKEN|CREDENTIAL|ACCESS_KEY|PRIVATE_KEY|DATABASE_URL)/.test(k))),"V3_PARENT_SECRET_OR_INJECTION_ENV");}
function parse(raw,scope,trust,approval,{now=Date.now()}={}){
 s.requireApproval(approval,scope,{now});const frame=s.wire(raw),p=frame.payload;s.exact(p,FIELDS,"V3_DELIVERY_FIELDS");s.identity(p,scope.payload);
 s.check(p.schema_version==="MCFT_CAP09_R4285_CREDENTIAL_DELIVERY_V3"&&p.scope_id===scope.scope_id&&p.delivery_source_id===scope.payload.source.delivery_source_id,"V3_DELIVERY_SCOPE");
 s.check(p.issuer_id===scope.payload.source.issuer_id&&p.key_id===scope.payload.source.key_id,"V3_DELIVERY_SOURCE");
 s.verifySigned(frame,trust,s.FRAME_DOMAIN,{now});s.check(s.utc(p.expires_at)<=s.utc(scope.payload.expires_at)&&s.utc(p.expires_at)<=s.utc(approval.expires_at),"V3_DELIVERY_OUTLIVES_AUTHORITY");
 s.check(s.utc(p.expires_at)>now+10860000,"V3_CREDENTIAL_REMAINING_BUDGET");s.exact(p.environment,KEYS,"V3_DELIVERY_ENVIRONMENT");
 const e=p.environment,r=scope.payload.resources;
 for(const k of KEYS)s.check(typeof e[k]==="string"&&e[k].length>0&&e[k].length<4096,"V3_DELIVERY_VALUE");
 for(const [side,key] of [["positive","DATABASE_URL"],["negative","BLOCKED_DATABASE_URL"]]){
  let u;try{u=new URL(e[key]);}catch{throw Error("V3_DELIVERY_PG_URL");}
  s.check(["postgres:","postgresql:"].includes(u.protocol)&&u.hostname===r.database_host&&u.port===String(r.database_port)&&decodeURIComponent(u.pathname.slice(1))===r[side+"_database"]&&decodeURIComponent(u.username)===r[side+"_role"]&&u.password.length>0&&!u.hash&&!u.search,"V3_DELIVERY_PG_BINDING");
 }
 s.check(e.MCFT_CAP09_FORMAL_RAW_BUCKET===r.bucket&&e.MCFT_CAP09_FORMAL_RAW_ENDPOINT===r.bucket_endpoint&&s.sha(e.MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID)===r.s3_account_sha256&&!['root','minioadmin'].includes(e.MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID),"V3_DELIVERY_S3_BINDING");
 return {environment:Object.assign(Object.create(null),e),expires_at:p.expires_at};
}
function clear(env){if(env)for(const k of KEYS)delete env[k];}
async function readFrameFd3(){
 s.check(process.platform==="win32","V3_FD3_WINDOWS_REQUIRED");
 const stream=fs.createReadStream(null,{fd:3,autoClose:true,highWaterMark:4096}),chunks=[];let size=0;
 return new Promise((resolve,reject)=>{let done=false;const timer=setTimeout(()=>finish(Error("V3_FD3_TIMEOUT")),10000);
  function finish(error,result){if(done)return;done=true;clearTimeout(timer);stream.removeAllListeners();stream.destroy();for(const raw of chunks)raw.fill(0);if(error)reject(error);else resolve(result);}
  stream.on("data",raw=>{size+=raw.length;if(size>32768){raw.fill(0);finish(Error("V3_FD3_SIZE"));}else chunks.push(raw);});
  stream.on("end",()=>finish(null,Buffer.concat(chunks)));stream.on("error",()=>finish(Error("V3_FD3_ERROR")));
 });
}
module.exports={KEYS,FIELDS,parentClean,parse,clear,readFrameFd3};
