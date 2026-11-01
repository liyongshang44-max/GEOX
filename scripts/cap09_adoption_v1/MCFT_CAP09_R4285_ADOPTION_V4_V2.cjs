"use strict";
/* Successor only: never reinterpret signed QCP71 as QCP72. */
const assert=require("node:assert/strict"),crypto=require("node:crypto");
const old=require("./MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V1.cjs");
const canonical=old.canonical,sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const DOMAIN="GEOX_MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V4\n";
const FIELDS=Object.freeze(old.ADOPTION_V3_FIELDS.map(k=>k==="native_qcp71_result_sha256"?"native_qcp72_result_sha256":k));
const H=/^[a-f0-9]{64}$/,S=/^[a-f0-9]{40}$/;
function utc(x){assert(typeof x==="string"&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x,"V4_UTC");return Date.parse(x);}
function verifySignedAdoptionV4({envelope,trust,context,now=Date.now()}){
 assert(envelope&&Object.keys(envelope).sort().join(",")==="payload,signature_base64","V4_ENVELOPE");
 const p=envelope.payload;assert(p&&typeof p==="object"&&!Array.isArray(p),"V4_PAYLOAD");
 assert.deepEqual(Object.keys(p).sort(),FIELDS.slice().sort(),"V4_FIELDS");
 assert.equal(p.schema_version,"MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V4");
 assert.equal(p.run_id,old.RUN);assert.equal(p.host_id,old.HOST);
 assert(S.test(p.subject_sha)&&p.subject_sha===context.subject_sha,"V4_SUBJECT");
 assert.equal(p.attempt_ordinal,4);assert.equal(p.scope,"ISOLATED_QUALIFICATION_TEST_ONLY");
 assert.equal(p.decision,"APPROVE_R4285_CURRENT_SUBJECT_ADOPTION_NOT_PERMIT");
 assert.equal(p.production_authorized,false);assert.equal(p.permit_authorized,false);
 for(const key of ["inventory_sha256","owner_decision_sha256","authority_registry_sha256",
 "lineage_envelope_sha256","native_qcp72_result_sha256","installed_material_digest","release_binding_sha256"]){
  assert(H.test(context[key])&&p[key]===context[key],"V4_ADOPTION_BINDING:"+key);
 }
 assert.equal(trust?.schema_version,"geox_mcft_cap09_retry_trust_v1");
 assert.equal(trust.host_id,old.HOST);
 const iss=trust.issuers?.filter(k=>k.issuer_id===p.issuer_id&&k.key_id===p.key_id);
 assert.equal(iss?.length,1,"V4_ISSUER_UNIQUE");const k=iss[0];
 assert.equal(k.revoked,false);assert.equal(k.role,"ACCOUNTABLE_SINGLE_OPERATOR");
 assert.equal(k.issuer_id,trust.operator_id);
 const from=utc(p.issued_at),to=utc(p.expires_at);
 assert(from<=now&&now<to&&to-from<=86400000,"V4_EXPIRED");
 assert(utc(k.not_before)<=from&&to<=utc(k.not_after),"V4_ISSUER_WINDOW");
 const pub=crypto.createPublicKey(k.public_key_pem);
 assert.equal(pub.asymmetricKeyType,"ed25519");
 assert.equal(sha(pub.export({type:"spki",format:"der"})),k.spki_sha256,"V4_KEY_FINGERPRINT");
 const sig=Buffer.from(envelope.signature_base64,"base64");
 assert(sig.length===64&&sig.toString("base64")===envelope.signature_base64,"V4_SIGNATURE_FORMAT");
 assert(crypto.verify(null,Buffer.from(DOMAIN+canonical(p)),pub,sig),"V4_BAD_SIGNATURE");
 return Object.freeze({status:"R4285_V4_ADOPTION_VERIFIED_NOT_PERMIT",run_id:old.RUN,
  subject_sha:p.subject_sha,adoption_digest_sha256:sha(Buffer.from(canonical(envelope))),
  permit_authorized:false,execution_authorized:false,production_authorized:false});
}
module.exports={DOMAIN,FIELDS,verifySignedAdoptionV4};
