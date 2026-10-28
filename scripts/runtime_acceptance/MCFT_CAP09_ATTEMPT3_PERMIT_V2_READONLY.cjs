"use strict";
/**
 * Exact-domain Attempt-3 Permit V2 verification, READ-ONLY.
 * Deliberately has no consume/sign/Host functions. This cannot authorize execution.
 * A different V1 permit cannot pass, even if all V1 signature bytes are genuine.
 */
const assert=require("node:assert/strict"),crypto=require("node:crypto");
const a3=require("../governance_acceptance/MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1.cjs");
const DOMAIN="GEOX_MCFT_CAP09_ISOLATED_RETRY_PERMIT_ATTEMPT3_V2\n";
const keys=["schema_version","issuer_id","key_id","nonce","run_id","parent_run_id",
 "attempt_ordinal","baseline_main_sha","subject_sha","host_id","issued_at","expires_at",
 "arm_sha256","observations_sha256","plan_sha256","adoption_v2_proof_sha256",
 "lineage_review_sha256","resources_sha256","scope","production_authorized"];
const digest=v=>crypto.createHash("sha256").update(v).digest("hex");
function exact(x,fields){
 assert(x&&typeof x==="object"&&!Array.isArray(x),"A3_V2_PERMIT_OBJECT");
 assert.deepEqual(Object.keys(x).sort(),fields.slice().sort(),"A3_V2_PERMIT_FIELDS");
}
function epoch(s){
 assert(typeof s==="string"&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s,"A3_V2_PERMIT_TIME");
 return Date.parse(s);
}
function verifyReadOnly(envelope,trust,ctx){
 exact(envelope,["payload","signature_base64"]);
 const p=envelope.payload;exact(p,keys);
 assert.equal(p.schema_version,"geox_mcft_cap09_signed_retry_permit_attempt3_v2");
 assert.equal(p.baseline_main_sha,a3.BASELINE,"A3_V2_BASELINE_CHANGED");
 assert.equal(p.run_id,a3.RUN,"A3_V2_RUN_WRONG");
 assert.equal(p.parent_run_id,a3.PARENT,"A3_V2_PARENT_WRONG");
 assert.equal(p.attempt_ordinal,3,"A3_V2_ATTEMPT_WRONG");
 assert.equal(p.scope,"ISOLATED_QUALIFICATION_SINGLE_ATTEMPT_TEST_ONLY");
 assert.equal(p.production_authorized,false,"A3_V2_PRODUCTION_FORBIDDEN");
 assert(/^[0-9a-f]{64}$/.test(p.nonce),"A3_V2_NONCE_256_REQUIRED");
 assert(/^[0-9a-f]{40}$/.test(p.subject_sha)&&p.subject_sha!==a3.BASELINE,"A3_V2_NEW_SUBJECT_REQUIRED");
 assert.equal(p.subject_sha,ctx.subject_sha,"A3_V2_EXACT_SUBJECT_REQUIRED");
 assert.equal(p.subject_sha,ctx.protected_main_sha,"A3_V2_MAIN_CHANGED");
 assert.equal(ctx.source_clean,true,"A3_V2_SOURCE_NOT_CLEAN");
 assert.equal(p.host_id,ctx.host_id,"A3_V2_HOST_CHANGED");
 assert.equal(p.issued_at,ctx.authorized_at,"A3_V2_START_CHANGED");
 assert.equal(p.expires_at,ctx.expires_at,"A3_V2_EXPIRY_CHANGED");
 const now=epoch(ctx.now),start=epoch(p.issued_at),end=epoch(p.expires_at);
 assert(start<=now&&now<end&&end-start<=86400000,"A3_V2_PERMIT_WINDOW_INVALID");
 for(const x of ["arm_sha256","observations_sha256","plan_sha256","adoption_v2_proof_sha256","lineage_review_sha256","resources_sha256"]){
  assert(typeof p[x]==="string"&&/^[0-9a-f]{64}$/.test(p[x]),"A3_V2_BINDING_INVALID:"+x);
  assert.equal(p[x],ctx[x],"A3_V2_BINDING_CHANGED:"+x);
 }
 assert(trust?.schema_version==="geox_mcft_cap09_retry_trust_v1"&&Array.isArray(trust.issuers),"A3_V2_REGISTRY_INVALID");
 assert.equal(trust.host_id,p.host_id,"A3_V2_TRUST_HOST_CHANGED");
 const m=trust.issuers.filter(x=>x.issuer_id===p.issuer_id&&x.key_id===p.key_id);
 assert.equal(m.length,1,"A3_V2_UNKNOWN_ISSUER");
 const issuer=m[0];assert.equal(issuer.revoked,false,"A3_V2_ISSUER_REVOKED");
 assert(["ACCOUNTABLE_SINGLE_OPERATOR","INDEPENDENT_RETRY_GOVERNANCE"].includes(issuer.role),"A3_V2_ISSUER_ROLE");
 if(issuer.role==="ACCOUNTABLE_SINGLE_OPERATOR")assert.equal(issuer.issuer_id,trust.operator_id,"A3_V2_OPERATOR_MISMATCH");
 else assert.notEqual(issuer.issuer_id,trust.operator_id,"A3_V2_INDEPENDENCE_MISMATCH");
 assert(epoch(issuer.not_before)<=start&&end<=epoch(issuer.not_after),"A3_V2_KEY_WINDOW");
 const key=crypto.createPublicKey(issuer.public_key_pem);
 assert.equal(key.asymmetricKeyType,"ed25519","A3_V2_KEY_TYPE");
 assert.equal(digest(key.export({type:"spki",format:"der"})),issuer.spki_sha256,"A3_V2_FINGERPRINT");
 const sig=Buffer.from(envelope.signature_base64,"base64");
 assert(sig.length===64&&sig.toString("base64")===envelope.signature_base64,"A3_V2_SIGNATURE_BYTES");
 assert(crypto.verify(null,Buffer.from(DOMAIN+a3.canonical(p)),key,sig),"A3_V2_SIGNATURE_INVALID");
 return Object.freeze({status:"ATTEMPT3_V2_PERMIT_SIGNATURE_VERIFIED_NOT_ADOPTED_OR_CONSUMED",
  run_id:a3.RUN,subject_sha:p.subject_sha,signature_digest_sha256:digest(a3.canonical(envelope)),
  execute_authorized:false,adoption_authorized:false,permit_consumed:false,production_authorized:false});
}
module.exports={DOMAIN,keys,verifyReadOnly};
