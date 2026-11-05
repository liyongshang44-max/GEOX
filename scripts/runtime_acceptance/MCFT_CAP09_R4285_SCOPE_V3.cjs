"use strict";
// Session-stable authority. Fresh observations are deliberately NOT Scope fields.
// Verification only: no private key, signing, account creation or authority issuance.
const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const c=require("../cap09_adoption_v1/contract.cjs");
const RUN="4285c3ce342c",HOST="LAPTOP-STN2A2P1",REPO="liyongshang44-max/GEOX";
const DOMAIN="GEOX_MCFT_CAP09_R4285_SESSION_RESOURCE_SCOPE_V3\n";
const OBS_DOMAIN="GEOX_MCFT_CAP09_R4285_SOURCE_OBSERVATION_V3\n";
const FRAME_DOMAIN="GEOX_MCFT_CAP09_R4285_CREDENTIAL_DELIVERY_V3\n";
const SCOPE_FIELDS=["schema_version","issuer_id","key_id","run_id","subject_sha","host_id","nonce","scope","issued_at","expires_at","resources","source","production_authorized"];
const RESOURCE_FIELDS=["database_host","database_port","positive_database","negative_database","positive_role","negative_role","pg_owner_id","pg_permission_sha256","positive_expires_at","negative_expires_at","bucket_endpoint","bucket","s3_account_sha256","parent_principal_sha256","policy_sha256","raw_prefix_arn","candidate_prefix_arn","minio_deployment_id","s3_expires_at"];
const SOURCE_FIELDS=["source_id","issuer_id","key_id","spki_sha256","policy_sha256","delivery_source_id"];
const OBS_FIELDS=["schema_version","issuer_id","key_id","run_id","subject_sha","host_id","nonce","scope_id","kind","raw_sha256","observed_at","issued_at","expires_at","production_authorized"];
const APPROVAL_FIELDS=["schema_version","run_id","subject_sha","host_id","nonce","scope_id","scope_envelope_sha256","source_policy_sha256","source_spki_sha256","delivery_source_id","valid_from","expires_at","decision","production_authorized"];
const liveApprovals=new WeakSet();
const fail=code=>{throw Error(code);};
function check(ok,code){if(!ok)fail(code);}
function exact(x,keys,code="V3_EXACT_FIELDS"){check(x&&Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).sort().join("\0")===keys.slice().sort().join("\0"),code);}
function hash(v){check(typeof v==="string"&&/^[a-f0-9]{64}$/.test(v),"V3_HASH");return v;}
function utc(v){check(typeof v==="string"&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v,"V3_UTC");return Date.parse(v);}
function sha(v){return crypto.createHash("sha256").update(v).digest("hex");}
// Byte-canonical wire JSON rejects duplicate keys, invalid UTF-8 and spelling
// ambiguities. Historical pretty-printed input is handled by readJson below.
function wire(raw){check(Buffer.isBuffer(raw)&&raw.length>0&&raw.length<=16*1024*1024,"V3_JSON_SIZE");
 let value;try{const text=new TextDecoder("utf-8",{fatal:true}).decode(raw);value=JSON.parse(text);check(c.canonical(value)===text,"V3_JSON_NOT_CANONICAL");}catch{fail("V3_JSON_NOT_CANONICAL");}return value;}
function bytes(file,max=16*1024*1024){check(typeof file==="string"&&path.isAbsolute(file),"V3_ABSOLUTE_FILE");c.noLinks(file);const st=fs.statSync(file);check(st.isFile()&&st.nlink===1&&st.size>0&&st.size<=max,"V3_REGULAR_FILE");return fs.readFileSync(file);}
function readJson(file){return wire(bytes(file));}
function identity(p,ctx){check(p.run_id===RUN&&p.host_id===HOST&&/^[a-f0-9]{40}$/.test(p.subject_sha),"V3_IDENTITY");hash(p.nonce);
 for(const key of ["run_id","subject_sha","host_id","nonce"])if(ctx)check(p[key]===ctx[key],"V3_IDENTITY_DRIFT_"+key);}
function verifySigned(envelope,trust,domain,{now=Date.now()}={}){
 exact(envelope,["payload","signature_base64"],"V3_ENVELOPE");const p=envelope.payload;
 check(trust?.schema_version==="geox_mcft_cap09_retry_trust_v1"&&trust.host_id===HOST,"V3_REGISTERED_TRUST");
 const matches=trust.issuers?.filter(k=>k.issuer_id===p.issuer_id&&k.key_id===p.key_id);
 check(matches?.length===1,"V3_REGISTERED_ISSUER");const k=matches[0];
 check(k.revoked===false&&k.role==="ACCOUNTABLE_SINGLE_OPERATOR"&&k.issuer_id===trust.operator_id,"V3_SIGNER_ROLE_OR_REVOCATION");
 const from=utc(p.issued_at),to=utc(p.expires_at);check(from<=now&&now<to&&to-from<=86400000,"V3_SIGNATURE_WINDOW");
 check(utc(k.not_before)<=from&&to<=utc(k.not_after),"V3_SIGNER_WINDOW");
 const pub=crypto.createPublicKey(k.public_key_pem);check(pub.asymmetricKeyType==="ed25519"&&sha(pub.export({type:"spki",format:"der"}))===k.spki_sha256,"V3_SIGNER_KEY");
 const signature=Buffer.from(envelope.signature_base64||"","base64");
 check(signature.length===64&&signature.toString("base64")===envelope.signature_base64&&crypto.verify(null,Buffer.from(domain+c.canonical(p)),pub,signature),"V3_SIGNATURE");return k;
}
function scopeId(p){return sha(DOMAIN+c.canonical(p));}
function verifyScope(envelope,trust,ctx,{now=Date.now()}={}){
 const p=envelope?.payload;exact(p,SCOPE_FIELDS,"V3_SCOPE_FIELDS");identity(p,ctx);
 check(p.schema_version==="MCFT_CAP09_R4285_SESSION_RESOURCE_SCOPE_V3"&&p.scope==="ISOLATED_QUALIFICATION_TEST_ONLY"&&p.production_authorized===false,"V3_SCOPE_SCHEMA");
 verifySigned(envelope,trust,DOMAIN,{now});exact(p.resources,RESOURCE_FIELDS,"V3_RESOURCE_FIELDS");exact(p.source,SOURCE_FIELDS,"V3_SOURCE_FIELDS");
 const r=p.resources;check(r.database_host==="127.0.0.1"&&r.database_port===55492,"V3_PG_ENDPOINT");
 for(const side of ["positive","negative"]){check(r[side+"_database"]===`mcft_cap09_requal_${RUN}_${side}`,"V3_PG_DATABASE");check(r[side+"_role"]===`cap09_${RUN}_${side[0]}_evidence`,"V3_PG_ROLE");check(r[side+"_expires_at"]===null||utc(r[side+"_expires_at"])>=utc(p.expires_at),"V3_PG_EXPIRY");}
 check(typeof r.pg_owner_id==="string"&&/^pgdb:[A-Za-z0-9_.:-]+$/.test(r.pg_owner_id),"V3_PG_OWNER");
 check(r.bucket_endpoint==="http://127.0.0.1:59292/"&&r.bucket==="mcft-cap09-requal-"+RUN,"V3_S3_ENDPOINT");
 const arn="arn:aws:s3:::"+r.bucket;check(r.raw_prefix_arn===arn+"/mcft-cap09-formal-raw-v1/sha256/*"&&r.candidate_prefix_arn===arn+"/mcft-cap09-formal-candidate-v1/sha256/*","V3_S3_PREFIX");
 for(const k of ["pg_permission_sha256","s3_account_sha256","parent_principal_sha256","policy_sha256"])hash(r[k]);
 check(r.minio_deployment_id==="ddbc6bb9-eb52-4b95-8324-b556697f8c0e"&&(r.s3_expires_at===null||utc(r.s3_expires_at)>=utc(p.expires_at)),"V3_S3_LIFETIME");
 const s=p.source;for(const k of ["source_id","delivery_source_id"])check(typeof s[k]==="string"&&/^[A-Za-z0-9_.:-]{3,128}$/.test(s[k]),"V3_SOURCE_ID");
 const issuer=trust.issuers.find(k=>k.issuer_id===s.issuer_id&&k.key_id===s.key_id);check(issuer&&!issuer.revoked&&issuer.issuer_id===trust.operator_id&&issuer.role==="ACCOUNTABLE_SINGLE_OPERATOR"&&issuer.spki_sha256===s.spki_sha256,"V3_SOURCE_KEY_REGISTRATION");hash(s.policy_sha256);hash(s.spki_sha256);
 function freeze(value){if(value&&typeof value==="object"){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
 return Object.freeze({scope_id:scopeId(p),envelope_sha256:sha(c.canonical(envelope)),payload:freeze(JSON.parse(c.canonical(p)))});
}
function inspectApproval(comment,raw,scope,{now=Date.now()}={}){
 const p=wire(raw);exact(p,APPROVAL_FIELDS,"V3_SOURCE_APPROVAL_FIELDS");identity(p,scope.payload);
 check(comment?.id>0&&Number.isSafeInteger(comment.id)&&comment.url===`https://api.github.com/repos/${REPO}/issues/comments/${comment.id}`&&comment.issue_url===`https://api.github.com/repos/${REPO}/issues/3757`,"V3_APPROVAL_LOCATION");
 check(comment.user?.login==="liyongshang44-max"&&comment.author_association==="OWNER"&&comment.created_at===comment.updated_at&&comment.body===raw.toString("utf8"),"V3_APPROVAL_NATIVE_IDENTITY");
 check(p.schema_version==="MCFT_CAP09_R4285_SOURCE_AUTHORITY_APPROVAL_V3"&&p.decision==="AUTHORIZE_EXACT_TEST_ONLY_RESOURCE_SOURCE_AND_DELIVERY"&&p.production_authorized===false,"V3_SOURCE_NOT_AUTHORIZED");
 check(p.scope_id===scope.scope_id&&p.scope_envelope_sha256===scope.envelope_sha256&&p.source_policy_sha256===scope.payload.source.policy_sha256&&p.source_spki_sha256===scope.payload.source.spki_sha256&&p.delivery_source_id===scope.payload.source.delivery_source_id,"V3_APPROVAL_SCOPE_BINDING");
 check(utc(comment.created_at)<=utc(p.valid_from)&&utc(p.valid_from)<=now&&now<utc(p.expires_at)&&utc(p.expires_at)<=utc(scope.payload.expires_at),"V3_APPROVAL_WINDOW");
 return Object.freeze({id:comment.id,sha256:sha(raw),expires_at:p.expires_at,scope_id:scope.scope_id});
}
function liveApproval(id,raw,scope){check(process.platform==="win32"&&!process.env.CI&&!process.env.GITHUB_ACTIONS,"V3_NATIVE_WINDOWS_REQUIRED");check(Number.isSafeInteger(id)&&id>0,"V3_APPROVAL_ID");
 const reply=cp.execFileSync("curl.exe",["--fail","--silent","--show-error","--max-time","20","-H","Accept: application/vnd.github+json",`https://api.github.com/repos/${REPO}/issues/comments/${id}`],{encoding:"utf8",windowsHide:true,timeout:25000,maxBuffer:524288});
 const proof=inspectApproval(JSON.parse(reply),raw,scope);check(proof.id===id,"V3_APPROVAL_ID_DRIFT");liveApprovals.add(proof);return proof;}
function requireApproval(proof,scope,{now=Date.now()}={}){check(liveApprovals.has(proof)&&proof.scope_id===scope.scope_id&&now<utc(proof.expires_at),"V3_LIVE_RESOURCE_SOURCE_AUTHORITY_REQUIRED");}
function verifyObservationSignature(envelope,kind,scope,trust,{now=Date.now(),notBefore=0}={}){
 const p=envelope?.payload;exact(p,OBS_FIELDS,"V3_OBSERVATION_FIELDS");identity(p,scope.payload);
 check(p.schema_version==="MCFT_CAP09_R4285_SOURCE_OBSERVATION_V3"&&p.production_authorized===false&&p.kind===kind&&["CONTROL","INVENTORY"].includes(kind)&&p.scope_id===scope.scope_id,"V3_OBSERVATION_SCOPE");
 check(p.issuer_id===scope.payload.issuer_id&&p.key_id===scope.payload.key_id,"V3_OBSERVATION_SIGNER");verifySigned(envelope,trust,OBS_DOMAIN,{now});
 hash(p.raw_sha256);
 check(utc(p.observed_at)>=notBefore&&utc(p.observed_at)<=utc(p.issued_at)&&now-utc(p.observed_at)<=120000&&utc(p.expires_at)<=utc(scope.payload.expires_at),"V3_OBSERVATION_FRESHNESS");return p;
}
function verifyObservation(envelope,raw,kind,scope,trust,options){const p=verifyObservationSignature(envelope,kind,scope,trust,options);
 check(Buffer.isBuffer(raw)&&raw.length>0&&raw.length<1048576&&sha(raw)===p.raw_sha256,"V3_OBSERVATION_BYTES");return p;}
module.exports={RUN,HOST,DOMAIN,OBS_DOMAIN,FRAME_DOMAIN,SCOPE_FIELDS,RESOURCE_FIELDS,SOURCE_FIELDS,OBS_FIELDS,APPROVAL_FIELDS,exact,hash,utc,sha,wire,bytes,readJson,identity,verifySigned,scopeId,verifyScope,inspectApproval,liveApproval,requireApproval,verifyObservationSignature,verifyObservation,check};
