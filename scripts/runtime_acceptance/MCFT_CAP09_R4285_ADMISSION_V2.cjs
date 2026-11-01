"use strict";
/* Versioned R4285 Host Admission V2 boundary. Verification only.
 * Does not issue/sign/consume a Permit, mutate PG/S3, or dispatch stages.
 * V1 remains unchanged. Untrusted inspection never mints authorization.
 */
const assert=require("node:assert/strict"),crypto=require("node:crypto"),cp=require("node:child_process"),fs=require("node:fs");
const lineage=require("../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs");
const native=require("../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V1.cjs");
const permit=require("./MCFT_CAP09_R4285_PERMIT_V1.cjs");
const resource=require("../governance_acceptance/MCFT_CAP09_R4285_RESOURCE_OWNER_V1.cjs");
const RUN=permit.RUN,HOST=permit.HOST,REPO="liyongshang44-max/GEOX";
const HEX64=/^[a-f0-9]{64}$/,HEAD=/^[a-f0-9]{40}$/;
const DOMAIN="GEOX_MCFT_CAP09_R4285_FINAL_EXECUTION_APPROVAL_V2\n";
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const canonical=lineage.canonical;
const liveIntents=new WeakSet(),stableProofs=new WeakSet(),liveFinals=new WeakSet();
const INTENT_FIELDS=["schema_version","run_id","parent_run_id","failed_predecessor_run_id",
 "attempt_ordinal","authority_pr_number","subject_sha","host_id","nonce","plan_sha256",
 "observations_sha256","first_base","material_digest","release_binding_sha256",
 "resource_scope_sha256","valid_from","expires_at","scope","decision",
 "production_authorized","permit_authorized","execute_authorized"];
const FINAL_FIELDS=["schema_version","issuer_id","key_id","run_id","subject_sha","host_id",
 "nonce","permit_envelope_sha256","resource_owner_envelope_sha256","resource_readback_sha256",
 "intent_sha256","plan_sha256","observations_sha256","material_digest","release_binding_sha256",
 "issued_at","expires_at","scope","decision","production_authorized"];
const RESOURCE_FIELDS=["database_host","database_port","positive_database","negative_database",
 "audit_user","bucket_endpoint","bucket","pg_owner_id","s3_owner_id"];
function exact(x,fields,err){assert(x&&typeof x==="object"&&!Array.isArray(x),err);
 assert.deepEqual(Object.keys(x).sort(),fields.slice().sort(),err);}
function utc(x){assert(typeof x==="string"&&Number.isFinite(Date.parse(x))&&
 new Date(x).toISOString()===x,"V2_INVALID_UTC");return Date.parse(x);}
function context(ctx){
 assert(ctx&&ctx.run_id===RUN&&ctx.host_id===HOST&&HEAD.test(ctx.subject_sha),"V2_IDENTITY");
 for(const k of ["nonce","plan_sha256","observations_sha256","material_digest",
  "release_binding_sha256","resource_scope_sha256"])assert(HEX64.test(ctx[k]),"V2_DIGEST:"+k);
 assert(Number.isSafeInteger(ctx.authority_pr_number)&&ctx.authority_pr_number>0,"V2_PR");
 assert(/^\d{4}-\d\d-\d\dT\d\d:00:00\.000Z$/.test(ctx.first_base)&&
  new Date(ctx.first_base).toISOString()===ctx.first_base,"V2_BASE");
 return ctx;
}
function checkIntent(p,ctx,{now=Date.now(),createdAt}={}){
 context(ctx);exact(p,INTENT_FIELDS,"V2_INTENT_SCHEMA");
 assert.equal(p.schema_version,"MCFT_CAP09_R4285_CTO_PREAUTH_INTENT_V2");
 assert.equal(p.run_id,RUN);assert.equal(p.parent_run_id,permit.PARENT);
 assert.equal(p.failed_predecessor_run_id,permit.FAILED_PREDECESSOR);
 assert.equal(p.attempt_ordinal,4);assert.equal(p.authority_pr_number,ctx.authority_pr_number);
 for(const k of ["subject_sha","host_id","nonce","plan_sha256","observations_sha256",
  "first_base","material_digest","release_binding_sha256","resource_scope_sha256"])
  assert.equal(p[k],ctx[k],"V2_INTENT_BINDING:"+k);
 assert.equal(p.scope,"ISOLATED_QUALIFICATION_TEST_ONLY");
 assert.equal(p.decision,"APPROVE_V2_TEST_INTENT_NOT_PERMIT_OR_EXECUTION");
 assert.equal(p.production_authorized,false);assert.equal(p.permit_authorized,false);
 assert.equal(p.execute_authorized,false);
 const from=utc(p.valid_from),to=utc(p.expires_at);
 assert(from<=now&&now<to&&to-from<=86400000,"V2_INTENT_EXPIRED");
 if(createdAt)assert(from>=utc(createdAt),"V2_INTENT_BEFORE_NATIVE_CREATION");
 return p;
}
function inspectNativeComment(comment,raw,ctx,{now=Date.now()}={}){
 assert(Buffer.isBuffer(raw)&&raw.length>0&&raw.length<=8192,"V2_NATIVE_RAW");
 assert(comment&&Number.isSafeInteger(comment.id)&&comment.id>0,"V2_COMMENT_ID");
 const prefix="https://api.github.com/repos/"+REPO+"/issues/";
 assert.equal(comment.url,prefix+"comments/"+comment.id,"V2_NATIVE_URL");
 assert.equal(comment.issue_url,prefix+ctx.authority_pr_number,"V2_NATIVE_PR");
 assert.equal(comment.user?.login,"liyongshang44-max","V2_NOT_CTO_OWNER");
 assert.equal(comment.author_association,"OWNER");assert.equal(comment.created_at,comment.updated_at,"V2_NATIVE_EDITED");
 assert(raw.equals(Buffer.from(comment.body,"utf8")),"V2_NATIVE_RAW_DIFFERENT");
 const p=JSON.parse(comment.body);assert.equal(comment.body,canonical(p),"V2_NATIVE_NOT_CANONICAL");
 checkIntent(p,ctx,{now,createdAt:comment.created_at});
 return Object.freeze({status:"V2_INSPECTED_ONLY_NOT_LIVE",sha256:sha(raw),id:comment.id,
  subject_sha:p.subject_sha,nonce:p.nonce,expires_at:p.expires_at});
}
function liveIntent(commentId,raw,ctx){
 assert(process.platform==="win32"&&!process.env.CI&&!process.env.GITHUB_ACTIONS,"V2_NATIVE_WINDOWS_REQUIRED");
 assert(Number.isSafeInteger(commentId)&&commentId>0,"V2_COMMENT_ID");
 const url="https://api.github.com/repos/"+REPO+"/issues/comments/"+commentId;
 const reply=cp.execFileSync("curl.exe",["--fail","--silent","--show-error","--location",
  "--max-time","20","-H","Accept: application/vnd.github+json",
  "-H","X-GitHub-Api-Version: 2022-11-28",url],
  {encoding:"utf8",timeout:25000,maxBuffer:524288,windowsHide:true});
 const measuredNow=Date.now();
 const inspected=inspectNativeComment(JSON.parse(reply),raw,ctx,{now:measuredNow});
 const proof=Object.freeze({...inspected,checked_at:new Date(measuredNow).toISOString()});
 liveIntents.add(proof);return proof;
}
function requireLiveIntent(proof,ctx,{now=Date.now()}={}){
 assert(liveIntents.has(proof),"V2_NATIVE_CTO_PROVENANCE_REQUIRED");
 context(ctx);assert.equal(proof.subject_sha,ctx.subject_sha);assert.equal(proof.nonce,ctx.nonce);
 assert(now<utc(proof.expires_at),"V2_CTO_INTENT_EXPIRED");return proof;
}
function stableNative({adoption,nativeInput,intent,ctx,now=Date.now()}){
 assert(native.isNativeVerified(adoption),"V2_REAL_NATIVE_ADOPTION_REQUIRED");
 requireLiveIntent(intent,ctx,{now});
 assert.equal(adoption.run_id,RUN);assert.equal(adoption.subject_sha,ctx.subject_sha);
 assert.equal(adoption.material_digest,ctx.material_digest,"V2_MATERIAL_DRIFT");
 assert.equal(nativeInput.release_binding_sha256,ctx.release_binding_sha256,"V2_RELEASE_BINDING");
 assert.equal(sha(fs.readFileSync(nativeInput.release_binding_file)),ctx.release_binding_sha256,
  "V2_RELEASE_RAW_DRIFT");
 const proof=Object.freeze({subject_sha:ctx.subject_sha,material_digest:ctx.material_digest,
  release_binding_sha256:ctx.release_binding_sha256,intent_sha256:intent.sha256,
  minted_at:new Date(now).toISOString(),status:"V2_TRUSTED_IN_PROCESS_STABLE_NOT_OWNER_OR_PERMIT"});
 stableProofs.add(proof);return proof;
}
function requireStable(proof,intent,ctx,{now=Date.now()}={}){
 assert(stableProofs.has(proof),"V2_STABLE_NOT_VERIFIED");
 requireLiveIntent(intent,ctx,{now});
 assert.equal(proof.subject_sha,ctx.subject_sha);
 assert.equal(proof.material_digest,ctx.material_digest);
 assert.equal(proof.release_binding_sha256,ctx.release_binding_sha256);
 assert.equal(proof.intent_sha256,intent.sha256);
 assert(now>=utc(proof.minted_at)&&now-utc(proof.minted_at)<=3600000,"V2_STABLE_EXPIRED");
 return true;
}
function scopeDigest(facts){const s=Object.fromEntries(RESOURCE_FIELDS.map(k=>[k,facts[k]]));
 assert.equal(s.bucket,"mcft-cap09-requal-"+RUN);return sha(Buffer.from(canonical(s)));}
function checkActualPermit(proof,permitEnv,ownerEnv,readback,observed,ctx,{now=Date.now()}={}){
 assert(permit.isVerified(proof),"V2_REAL_PERMIT_REQUIRED");
 assert.equal(proof.run_id,RUN);assert.equal(proof.subject_sha,ctx.subject_sha);
 assert.equal(proof.nonce,ctx.nonce);
 assert.equal(proof.envelope_sha256,sha(Buffer.from(canonical(permitEnv))),"V2_PERMIT_ENVELOPE_DRIFT");
 assert.equal(proof.resource_owner_envelope_sha256,sha(Buffer.from(canonical(ownerEnv))),"V2_OWNER_ENVELOPE_DRIFT");
 assert.equal(permitEnv.payload.resource_readback_sha256,readback.sha256,"V2_READBACK_SHA_DRIFT");
 assert.equal(permitEnv.payload.plan_sha256,ctx.plan_sha256,"V2_PLAN_DRIFT");
 assert.equal(permitEnv.payload.observations_sha256,ctx.observations_sha256,"V2_OBS_DRIFT");
 assert.equal(permitEnv.payload.installed_material_digest,ctx.material_digest,"V2_MATERIAL_DRIFT");
 assert.equal(permitEnv.payload.release_binding_sha256,ctx.release_binding_sha256,"V2_RELEASE_DRIFT");
 assert.equal(sha(Buffer.from(canonical(observed))),ctx.observations_sha256,"V2_OBS_BYTES_DRIFT");
 assert.equal(observed.real_provider_response_delay_plan.first_base,ctx.first_base,"V2_BASE_PROVIDER");
 assert.equal(observed.real_pipeline_delay_plan.first_base,ctx.first_base,"V2_BASE_PIPELINE");
 assert.equal(scopeDigest(readback.facts),ctx.resource_scope_sha256,"V2_OWNER_SCOPE_DRIFT");
 resource.assertDynamicFreshness(ownerEnv.payload,readback,{now});return true;
}
function inspectFinal(env,trust,ctx,{now=Date.now()}={}){
 exact(env,["payload","signature_base64"],"V2_FINAL_ENVELOPE");
 const p=env.payload;exact(p,FINAL_FIELDS,"V2_FINAL_SCHEMA");
 assert.equal(p.schema_version,"MCFT_CAP09_R4285_FINAL_EXECUTION_APPROVAL_V2");
 assert.equal(p.run_id,RUN);assert.equal(p.host_id,HOST);
 for(const k of ["subject_sha","nonce","permit_envelope_sha256","resource_owner_envelope_sha256",
 "resource_readback_sha256","intent_sha256","plan_sha256","observations_sha256",
 "material_digest","release_binding_sha256"])
  assert.equal(p[k],ctx[k],"V2_FINAL_BINDING:"+k);
 assert.equal(p.scope,"ISOLATED_QUALIFICATION_TEST_ONLY");
 assert.equal(p.decision,"APPROVE_R4285_V2_FINAL_SINGLE_EXECUTION");assert.equal(p.production_authorized,false);
 const start=utc(p.issued_at),end=utc(p.expires_at);
 assert(start<=now&&now<end&&end-start<=86400000,"V2_FINAL_EXPIRED");
 assert(trust?.schema_version==="geox_mcft_cap09_retry_trust_v1"&&trust.host_id===HOST);
 const found=trust.issuers?.filter(i=>i.issuer_id===p.issuer_id&&i.key_id===p.key_id);
 assert.equal(found?.length,1,"V2_SIGNER_NOT_REGISTERED");
 const k=found[0];assert.equal(k.revoked,false);assert.equal(k.role,"ACCOUNTABLE_SINGLE_OPERATOR");
 assert.equal(k.issuer_id,trust.operator_id);
 assert(utc(k.not_before)<=start&&end<=utc(k.not_after),"V2_SIGNER_WINDOW");
 const pub=crypto.createPublicKey(k.public_key_pem);
 assert.equal(pub.asymmetricKeyType,"ed25519");
 assert.equal(sha(pub.export({type:"spki",format:"der"})),k.spki_sha256,"V2_SIGNER_FINGERPRINT");
 const sig=Buffer.from(env.signature_base64,"base64");
 assert.equal(sig.length,64);assert.equal(sig.toString("base64"),env.signature_base64);
 assert(crypto.verify(null,Buffer.from(DOMAIN+canonical(p)),pub,sig),"V2_SIGNATURE_INVALID");
 return Object.freeze({status:"V2_SIGNATURE_VALID_NOT_EXECUTION",expires_at:p.expires_at,
  nonce:p.nonce,permit_envelope_sha256:p.permit_envelope_sha256,
  resource_readback_sha256:p.resource_readback_sha256,intent_sha256:p.intent_sha256});
}
function verifyFinal(env,trust,{stable,intent,permitProof,permitEnv,ownerEnv,readback,observed,ctx},
 {now=Date.now()}={}){
 requireStable(stable,intent,ctx,{now});
 checkActualPermit(permitProof,permitEnv,ownerEnv,readback,observed,ctx,{now});
 // Do not reuse the earlier CTO intent capability: a later deletion/edit must be observed.
 assert(Buffer.isBuffer(ctx.intent_raw_bytes),"V2_CTO_INTENT_ORIGINAL_RAW_REQUIRED");
 const refreshed=liveIntent(intent.id,ctx.intent_raw_bytes,ctx);
 assert.equal(refreshed.sha256,intent.sha256,"V2_CTO_INTENT_CHANGED_AT_FINAL");
 const final=inspectFinal(env,trust,{...ctx,
  permit_envelope_sha256:permitProof.envelope_sha256,
  resource_owner_envelope_sha256:permitProof.resource_owner_envelope_sha256,
  resource_readback_sha256:readback.sha256,intent_sha256:refreshed.sha256},{now});
 assert(utc(final.expires_at)<=utc(intent.expires_at),"V2_FINAL_OUTLIVES_CTO_INTENT");
 const live=Object.freeze({...final,cto_rechecked_at:refreshed.checked_at});
 liveFinals.add(live);return live;
}
function assertFinal(final,ctx,{now=Date.now()}={}){
 assert(liveFinals.has(final),"V2_FINAL_NOT_LIVE_VERIFIED");
 assert(now<utc(final.expires_at),"V2_FINAL_EXPIRED_AT_CONSUMPTION");
 assert(now>=utc(final.cto_rechecked_at)&&now-utc(final.cto_rechecked_at)<=15000,
  "V2_CTO_NATIVE_RECHECK_TOO_OLD");
 for(const k of ["nonce","permit_envelope_sha256","resource_readback_sha256","intent_sha256"])
  assert.equal(final[k],ctx[k],"V2_FINAL_CONSUME_BINDING:"+k);
 return true;
}
module.exports={RUN,HOST,DOMAIN,INTENT_FIELDS,FINAL_FIELDS,RESOURCE_FIELDS,
 context,checkIntent,inspectNativeComment,liveIntent,requireLiveIntent,stableNative,
 requireStable,scopeDigest,checkActualPermit,inspectFinal,verifyFinal,assertFinal};
