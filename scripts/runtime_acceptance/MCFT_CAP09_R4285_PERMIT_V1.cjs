"use strict";
/*
 * R4285 independent TEST_ONLY Permit signature consumer.
 * Cryptography is a necessary condition, never an execution authorization.
 * No private key, signing, issuance, ledger write, child dispatch or Stage-3
 * Permit V2 import is allowed in this module.
 */
const assert=require("node:assert/strict"),crypto=require("node:crypto");
const lineage=require("../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs");
const DOMAIN="GEOX_MCFT_CAP09_R4285_ISOLATED_TEST_PERMIT_V1\n";
const RUN=lineage.RUN,PARENT=lineage.ORIGINAL_PARENT,FAILED_PREDECESSOR=lineage.PREV,HOST=lineage.HOST;
const SHA=/^[a-f0-9]{64}$/,HEAD=/^[a-f0-9]{40}$/;
const valid=new WeakSet();
const BINDINGS=Object.freeze([
 "inventory_sha256","authority_registry_sha256","owner_envelope_sha256",
 "lineage_envelope_sha256","adoption_envelope_sha256","qcp71_raw_sha256",
 "installed_material_digest","release_binding_sha256","resource_owner_envelope_sha256",
 "resource_readback_sha256","historic_fullchain_attestation_sha256",
 "plan_sha256","observations_sha256"
]);
const FIELDS=Object.freeze([
 "schema_version","issuer_id","key_id","run_id","nonce","parent_run_id",
 "failed_predecessor_run_id","attempt_ordinal","subject_sha","host_id",
 "scope","purpose","decision","issued_at","expires_at","production_authorized",
 ...BINDINGS
]);
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
function exact(x,fields,code){
 assert(x&&typeof x==="object"&&!Array.isArray(x),code);
 assert.deepEqual(Object.keys(x).sort(),[...fields].sort(),code);
}
function utc(s){
 assert(typeof s==="string"&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s,
  "R4285_PERMIT_NONCANONICAL_UTC");
 return Date.parse(s);
}
function verifyReadOnly(envelope,trust,ctx,{now=Date.now()}={}){
 exact(envelope,["payload","signature_base64"],"R4285_PERMIT_ENVELOPE_FIELDS");
 const p=envelope.payload;
 exact(p,FIELDS,"R4285_PERMIT_PAYLOAD_FIELDS");
 assert.equal(p.schema_version,"MCFT_CAP09_R4285_SIGNED_ISOLATED_TEST_PERMIT_V1");
 assert.equal(p.run_id,RUN,"R4285_PERMIT_RUN_MISMATCH");
 assert.equal(p.parent_run_id,PARENT,"R4285_PERMIT_PARENT_MISMATCH");
 assert.equal(p.failed_predecessor_run_id,FAILED_PREDECESSOR,"R4285_PERMIT_FAILED_PREDECESSOR_MISMATCH");
 assert.equal(p.attempt_ordinal,4,"R4285_PERMIT_ATTEMPT_ORDINAL");
 assert.equal(p.host_id,HOST,"R4285_PERMIT_HOST_MISMATCH");
 assert.equal(p.scope,"ISOLATED_QUALIFICATION_TEST_ONLY","R4285_PERMIT_SCOPE");
 assert.equal(p.purpose,"ORIGINAL_SIX_STAGE_SINGLE_ATTEMPT","R4285_PERMIT_PURPOSE");
 assert.equal(p.decision,"APPROVE_R4285_TEST_ONLY_PERMIT_NOT_PRODUCTION","R4285_PERMIT_DECISION");
 assert.equal(p.production_authorized,false,"R4285_PERMIT_PRODUCTION_FORBIDDEN");
 assert(SHA.test(p.nonce),"R4285_PERMIT_NONCE_REQUIRED");
 assert(![
  "c8f4bd197ef422f3694f39adc6fcb8a3b67af06a897fe75c219728e40fb13bc0",
  "b3a312063716dce0f59b145c7d89fc1e3fb1aa53dc23d17e59934ba873ff6d93"
 ].includes(p.nonce),"R4285_PERMIT_HISTORICAL_NONCE_REUSE");
 assert(HEAD.test(p.subject_sha)&&p.subject_sha===ctx?.subject_sha,
  "R4285_PERMIT_SUBJECT_MISMATCH");
 assert.equal(ctx.protected_main_sha,p.subject_sha,"R4285_PERMIT_MAIN_MISMATCH");
 assert.equal(ctx.source_clean,true,"R4285_PERMIT_WORKTREE_DIRTY");
 assert.equal(ctx.host_id,HOST,"R4285_PERMIT_CONTEXT_HOST_MISMATCH");
 for(const f of BINDINGS){
  assert(SHA.test(ctx[f]),"R4285_PERMIT_REQUIRED_BINDING:"+f);
  assert.equal(p[f],ctx[f],"R4285_PERMIT_BINDING_MISMATCH:"+f);
 }
 const begin=utc(p.issued_at),end=utc(p.expires_at);
 assert(begin<=now&&now<end&&end-begin<=86_400_000,"R4285_PERMIT_WINDOW_INVALID");
 for(const field of ["adoption_expires_at","resource_owner_expires_at"]){
  assert(Number.isFinite(utc(ctx[field]))&&end<=utc(ctx[field]),
   "R4285_PERMIT_OUTLIVES_UPSTREAM:"+field);
 }
 assert(Number.isSafeInteger(ctx.total_stage_budget_ms)&&ctx.total_stage_budget_ms>0,
  "R4285_PERMIT_STAGE_BUDGET_REQUIRED");
 assert(now+ctx.total_stage_budget_ms+60_000<end,"R4285_PERMIT_INSUFFICIENT_REMAINING_BUDGET");
 assert(trust&&trust.schema_version==="geox_mcft_cap09_retry_trust_v1",
  "R4285_PERMIT_TRUST_SCHEMA");
 assert.equal(trust.host_id,HOST,"R4285_PERMIT_TRUST_HOST");
 const matches=trust.issuers?.filter(i=>i.issuer_id===p.issuer_id&&i.key_id===p.key_id);
 assert.equal(matches?.length,1,"R4285_PERMIT_ISSUER_UNIQUE");
 const issuer=matches[0];
 assert.equal(issuer.revoked,false,"R4285_PERMIT_SIGNER_REVOKED");
 // Current formally registered accountable Operator. An additional permit
 // issuer role would require an explicit, separately versioned authorization.
 assert.equal(issuer.role,"ACCOUNTABLE_SINGLE_OPERATOR","R4285_PERMIT_SIGNER_ROLE");
 assert.equal(issuer.issuer_id,trust.operator_id,"R4285_PERMIT_OPERATOR_IDENTITY");
 assert(utc(issuer.not_before)<=begin&&end<=utc(issuer.not_after),
  "R4285_PERMIT_SIGNER_VALIDITY");
 const pub=crypto.createPublicKey(issuer.public_key_pem);
 assert.equal(pub.asymmetricKeyType,"ed25519","R4285_PERMIT_ED25519_REQUIRED");
 assert.equal(sha(pub.export({format:"der",type:"spki"})),issuer.spki_sha256,
  "R4285_PERMIT_KEY_FINGERPRINT");
 const sig=Buffer.from(envelope.signature_base64,"base64");
 assert(sig.length===64&&sig.toString("base64")===envelope.signature_base64,
  "R4285_PERMIT_SIGNATURE_FORMAT");
 assert(crypto.verify(null,Buffer.from(DOMAIN+lineage.canonical(p)),pub,sig),
  "R4285_PERMIT_SIGNATURE_INVALID");
 const proof=Object.freeze({status:"R4285_TEST_ONLY_PERMIT_VERIFIED_NOT_CONSUMED_NOT_EXECUTED",
  run_id:RUN,subject_sha:p.subject_sha,nonce:p.nonce,expires_at:p.expires_at,
  envelope_sha256:sha(Buffer.from(lineage.canonical(envelope))),
  adoption_envelope_sha256:p.adoption_envelope_sha256,
  lineage_envelope_sha256:p.lineage_envelope_sha256,
  resource_owner_envelope_sha256:p.resource_owner_envelope_sha256,
  release_binding_sha256:p.release_binding_sha256,
  production_authorized:false,permit_consumed:false,execute_authorized:false});
 valid.add(proof);
 return proof;
}
function isVerified(proof){return !!proof&&valid.has(proof);}
module.exports={DOMAIN,FIELDS,BINDINGS,RUN,PARENT,FAILED_PREDECESSOR,HOST,
 verifyReadOnly,isVerified};
