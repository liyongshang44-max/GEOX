"use strict";
/**
 * Attempt-3 concrete Windows PG/S3 owner evidence, verification only.
 * This is a signed attestation OF actual host probe facts, not a provisioner.
 * Never infer resource ownership from loopback port assignment or JSON alone.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const a3=require("./MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1.cjs");
const DOMAIN="GEOX_MCFT_CAP09_ATTEMPT3_ISOLATED_RESOURCE_OWNER_ATTESTATION_V1\n";
const HASH=/^[0-9a-f]{64}$/, HEAD=/^[0-9a-f]{40}$/;
const DISCOVERED_HISTORIC_PG_PORTS=Object.freeze([55445,55446,55477,55478,55479,55480,55481,55482]);
const DISCOVERED_HISTORIC_S3_PORTS=Object.freeze([59005,59006,59277,59278,59279,59280,59281,59282]);
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const exact=(v,ks)=>{assert(v&&typeof v==="object"&&!Array.isArray(v),"A3_RESOURCE_OBJECT_REQUIRED");assert.deepEqual(Object.keys(v).sort(),ks.slice().sort(),"A3_RESOURCE_SCHEMA_CHANGED");};
const time=t=>{assert(typeof t==="string"&&Number.isFinite(Date.parse(t))&&new Date(t).toISOString()===t,"A3_RESOURCE_TIME_INVALID");return Date.parse(t);};
const FIELDS=["schema_version","issuer_id","key_id","run_id","subject_sha","host_id","scope","production_authorized",
 "observed_at","issued_at","expires_at","readback_sha256","database_host","database_port",
 "positive_database","negative_database","audit_user","positive_rows_zero","negative_rows_zero",
 "positive_database_exists","negative_database_exists","positive_login_restricted","negative_login_restricted",
 "fenced_writer_execute_allowed","direct_fact_insert_forbidden","bucket_endpoint","bucket","bucket_exists",
 "bucket_empty_including_versions_multipart","bucket_private","production_bindings_present","owner_exclusive",
 "pg_owner_id","s3_owner_id"];
function validateFacts(p,ctx){
 exact(p,FIELDS);
 assert.equal(p.schema_version,"MCFT_CAP09_ATTEMPT3_RESOURCE_OWNER_V1");
 assert.equal(p.run_id,a3.RUN);assert(HEAD.test(p.subject_sha)&&p.subject_sha===ctx.subject_sha,"A3_RESOURCE_SUBJECT_CHANGED");
 assert.equal(p.host_id,ctx.host_id);assert.equal(p.scope,"TEST_ONLY");assert.equal(p.production_authorized,false);
 assert(HASH.test(p.readback_sha256)&&p.readback_sha256===ctx.readback_sha256,"A3_RESOURCE_READBACK_UNBOUND");
 assert.equal(p.database_host,"127.0.0.1","A3_RESOURCE_PG_LOOPBACK_REQUIRED");
 assert(Number.isInteger(p.database_port)&&p.database_port>=1024&&p.database_port<=65535&&![55434,55432,5432,5433,...DISCOVERED_HISTORIC_PG_PORTS].includes(p.database_port),"A3_RESOURCE_PG_PORT_NOT_DEDICATED");
 assert.equal(p.positive_database,`mcft_cap09_requal_${a3.RUN}_positive`);
 assert.equal(p.negative_database,`mcft_cap09_requal_${a3.RUN}_negative`);
 assert(/^[a-z_][a-z0-9_]{3,62}$/.test(p.audit_user)&&!["postgres","qual_admin","qual_dedicated_admin"].includes(p.audit_user),"A3_RESOURCE_AUDIT_USER_NOT_EXCLUSIVE");
 const endpoint=new URL(p.bucket_endpoint);
 assert(endpoint.protocol==="http:"&&endpoint.hostname==="127.0.0.1"&&endpoint.username===""&&endpoint.password===""&&endpoint.pathname==="/"&&endpoint.search===""&&endpoint.hash==="","A3_RESOURCE_S3_LOOPBACK_ONLY");
 assert(Number.isInteger(Number(endpoint.port))&&Number(endpoint.port)>=1024&&Number(endpoint.port)<=65535&&![59000,9000,9001,9002,...DISCOVERED_HISTORIC_S3_PORTS].includes(Number(endpoint.port)),"A3_RESOURCE_S3_PORT_NOT_DEDICATED");
 assert.equal(p.bucket,"mcft-cap09-requal-"+a3.RUN);
 for(const k of ["positive_rows_zero","negative_rows_zero","positive_database_exists","negative_database_exists",
 "positive_login_restricted","negative_login_restricted","fenced_writer_execute_allowed","direct_fact_insert_forbidden",
 "bucket_exists","bucket_empty_including_versions_multipart","bucket_private","owner_exclusive"])assert.equal(p[k],true,"A3_RESOURCE_FACT_NOT_PROVEN:"+k);
 assert.equal(p.production_bindings_present,false,"A3_RESOURCE_PRODUCTION_BOUND");
 for(const k of ["pg_owner_id","s3_owner_id"])assert(typeof p[k]==="string"&&p[k].length>=12&&p[k].length<=128&&/^[A-Za-z0-9_.:-]+$/.test(p[k]),"A3_RESOURCE_OWNER_ID_MISSING");
 const start=time(p.issued_at),obs=time(p.observed_at),end=time(p.expires_at),now=ctx.now??Date.now();
 assert(start>=obs&&start-obs<=300000&&start<=now&&now<end&&end-start<=300000,"A3_RESOURCE_READBACK_STALE");
 return true;
}
function verify(envelope,trust,ctx){
 exact(envelope,["payload","signature_base64"]);
 const p=envelope.payload;validateFacts(p,ctx);
 assert(trust?.schema_version==="geox_mcft_cap09_retry_trust_v1"&&trust.host_id===p.host_id&&Array.isArray(trust.issuers),"A3_RESOURCE_TRUST_INVALID");
 const found=trust.issuers.filter(k=>k.issuer_id===p.issuer_id&&k.key_id===p.key_id);
 assert.equal(found.length,1,"A3_RESOURCE_SIGNER_UNKNOWN");
 const issuer=found[0];assert.equal(issuer.revoked,false);assert.equal(issuer.role,"ACCOUNTABLE_SINGLE_OPERATOR","A3_RESOURCE_OWNER_OPERATOR_REQUIRED");assert.equal(issuer.issuer_id,trust.operator_id);
 assert(time(issuer.not_before)<=time(p.issued_at)&&time(p.expires_at)<=time(issuer.not_after),"A3_RESOURCE_KEY_WINDOW");
 const key=crypto.createPublicKey(issuer.public_key_pem);
 assert.equal(key.asymmetricKeyType,"ed25519");assert.equal(sha(key.export({type:"spki",format:"der"})),issuer.spki_sha256);
 const signature=Buffer.from(envelope.signature_base64,"base64");
 assert.equal(signature.length,64);assert.equal(signature.toString("base64"),envelope.signature_base64);
 assert(crypto.verify(null,Buffer.from(DOMAIN+a3.canonical(p)),key,signature),"A3_RESOURCE_SIGNATURE_INVALID");
 return Object.freeze({status:"HOST_RESOURCE_OWNER_SIGNED_ATTESTATION_VERIFIED_NOT_INDEPENDENT_PHYSICAL_READBACK",
  run_id:a3.RUN,subject_sha:p.subject_sha,resources_sha256:sha(a3.canonical(p)),
  database_host:p.database_host,database_port:p.database_port,positive_database:p.positive_database,
  negative_database:p.negative_database,bucket_endpoint:p.bucket_endpoint,bucket:p.bucket,
  adopted:false,permit_authorized:false,production_authorized:false});
}
/**
 * The signer must pass *real* Windows readback JSON bytes; never fabricate it.
 * It must be outside the release and signed separately by operator key.
 * Not a live probe; only the readback producer on Windows can establish facts.
 */
function verifyReadbackFile(file,expectedSha){
 assert(path.isAbsolute(file)&&HASH.test(expectedSha),"A3_RESOURCE_READBACK_FILE_REQUIRED");
 let f=path.resolve(file);
 for(;;){const stat=fs.lstatSync(f);assert(!stat.isSymbolicLink(),"A3_RESOURCE_READBACK_SYMLINK");if(f===path.resolve(file))assert(stat.isFile()&&stat.size>0&&stat.size<1048576,"A3_RESOURCE_READBACK_REGULAR_FILE");const par=path.dirname(f);if(par===f)break;f=par;}
 const bytes=fs.readFileSync(file);assert.equal(sha(bytes),expectedSha,"A3_RESOURCE_READBACK_BYTES_CHANGED");
 const r=JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/,""));
 assert.equal(r.schema_version,"MCFT_CAP09_ATTEMPT3_RESOURCE_READBACK_V1","A3_RESOURCE_READBACK_SCHEMA");
 assert.equal(r.run_id,a3.RUN,"A3_RESOURCE_READBACK_RUN_CHANGED");
 assert.equal(r.status,"PASS","A3_RESOURCE_READBACK_NOT_PASS");
 assert.equal(r.probe_type,"WINDOWS_READ_ONLY_PG_S3_INDEPENDENT_HOST","A3_RESOURCE_READBACK_PROBE_TYPE");
 assert(HASH.test(r.probe_source_sha256),"A3_RESOURCE_READBACK_SOURCE_DIGEST_REQUIRED");
 assert.equal(r.production_authorized,false,"A3_RESOURCE_READBACK_PRODUCTION");
 return Object.freeze({sha256:sha(bytes),run_id:r.run_id,status:"RAW_READBACK_BYTES_MATCH_NOT_AUTHORITY",facts:r});
}
const FACT_BINDINGS=["subject_sha","host_id","observed_at","database_host","database_port",
 "positive_database","negative_database","audit_user","positive_rows_zero","negative_rows_zero",
 "positive_database_exists","negative_database_exists","positive_login_restricted",
 "negative_login_restricted","fenced_writer_execute_allowed","direct_fact_insert_forbidden",
 "bucket_endpoint","bucket","bucket_exists","bucket_empty_including_versions_multipart",
 "bucket_private","production_bindings_present","owner_exclusive","pg_owner_id","s3_owner_id"];
function bindSignedToReadback(signed,readback){
 assert(readback?.status==="RAW_READBACK_BYTES_MATCH_NOT_AUTHORITY"&&readback.facts,"A3_RESOURCE_RAW_READBACK_REQUIRED");
 assert.equal(readback.sha256,signed.readback_sha256,"A3_RESOURCE_ATTESTATION_RAW_BYTES_MISMATCH");
 for(const field of FACT_BINDINGS)assert.deepEqual(signed[field],readback.facts[field],"A3_RESOURCE_ATTESTATION_CONTRADICTS_RAW:"+field);
 assert.equal(signed.run_id,readback.facts.run_id,"A3_RESOURCE_RAW_RUN_DIFFERENT");
 assert.equal(readback.facts.production_authorized,false);
 return true;
}
}
module.exports={DOMAIN,FIELDS,FACT_BINDINGS,validateFacts,verify,verifyReadbackFile,bindSignedToReadback};
