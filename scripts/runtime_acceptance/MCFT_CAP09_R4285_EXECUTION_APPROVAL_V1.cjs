"use strict";
/*
 * Independent R4285 TEST_ONLY physical-execution authorization verifier.
 * This does not create approval, Permit, a signature or a process. In
 * particular, successful Owner/Lineage/Adoption/Permit reviews do not imply
 * a matching execution decision. This requires a separate, real Ed25519
 * authorization and explicit CTO decision material.
 */
const assert=require("node:assert/strict"),crypto=require("node:crypto");
const lineage=require("../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs");
const DOMAIN="GEOX_MCFT_CAP09_R4285_PHYSICAL_EXECUTION_APPROVAL_V1\n";
const FIELDS=Object.freeze(["schema_version","issuer_id","key_id","run_id",
 "parent_run_id","failed_predecessor_run_id","attempt_ordinal","subject_sha",
 "host_id","nonce","permit_envelope_sha256","adoption_envelope_sha256",
 "cto_decision_sha256","issued_at","expires_at","scope","decision",
 "production_authorized"]);
const verified=new WeakSet(),verifiedCto=new WeakSet(),HEX64=/^[0-9a-f]{64}$/;
const REPO="liyongshang44-max/GEOX",PR=3756,CTO_OWNER="liyongshang44-max";
const COMMENT_PREFIX="https://api.github.com/repos/"+REPO+"/issues/comments/";
const ISSUE_URL="https://api.github.com/repos/"+REPO+"/issues/"+PR;
const CTO_FIELDS=Object.freeze(["schema_version","run_id","parent_run_id",
 "failed_predecessor_run_id","attempt_ordinal","host_id","subject_sha",
 "nonce","permit_envelope_sha256","scope","decision","production_authorized",
 "valid_from","expires_at"]);
function inspectNativeCtoComment(nativeComment,rawBytes,context,{now=Date.now()}={}){
 assert(Buffer.isBuffer(rawBytes)&&rawBytes.length>0&&rawBytes.length<=8192,
  "R4285_CTO_NATIVE_BODY_BYTES_REQUIRED");
 assert(nativeComment&&typeof nativeComment==="object","R4285_CTO_NATIVE_COMMENT_REQUIRED");
 assert(Number.isSafeInteger(nativeComment.id)&&nativeComment.id>0,"R4285_CTO_NATIVE_ID");
 assert.equal(nativeComment.url,COMMENT_PREFIX+nativeComment.id,"R4285_CTO_NATIVE_SOURCE_URL");
 assert.equal(nativeComment.issue_url,ISSUE_URL,"R4285_CTO_NATIVE_WRONG_PR");
 assert.equal(nativeComment.user?.login,CTO_OWNER,"R4285_CTO_NATIVE_OWNER");
 assert.equal(nativeComment.author_association,"OWNER","R4285_CTO_NATIVE_ASSOCIATION");
 assert.equal(nativeComment.created_at,nativeComment.updated_at,"R4285_CTO_NATIVE_COMMENT_EDITED");
 assert.equal(typeof nativeComment.body,"string");
 assert(rawBytes.equals(Buffer.from(nativeComment.body,"utf8")),
  "R4285_CTO_LOCAL_BODY_NOT_GITHUB_NATIVE");
 const v=JSON.parse(nativeComment.body);
 assert.deepEqual(Object.keys(v).sort(),[...CTO_FIELDS].sort(),
  "R4285_CTO_NATIVE_DECISION_FIELDS");
 assert.equal(nativeComment.body,lineage.canonical(v),
  "R4285_CTO_NATIVE_DECISION_NOT_CANONICAL");
 assert.equal(v.schema_version,"MCFT_CAP09_R4285_CTO_NATIVE_EXECUTION_DECISION_V1");
 assert.equal(v.run_id,lineage.RUN);
 assert.equal(v.parent_run_id,lineage.ORIGINAL_PARENT);
 assert.equal(v.failed_predecessor_run_id,lineage.PREV);
 assert.equal(v.attempt_ordinal,4);
 assert.equal(v.host_id,lineage.HOST);
 for(const k of ["subject_sha","nonce","permit_envelope_sha256"])
  assert.equal(v[k],context[k],"R4285_CTO_NATIVE_BINDING:"+k);
 assert(/^[0-9a-f]{40}$/.test(v.subject_sha)&&HEX64.test(v.nonce)&&
  HEX64.test(v.permit_envelope_sha256),"R4285_CTO_NATIVE_DIGEST_FORMAT");
 assert.equal(v.scope,"ISOLATED_QUALIFICATION_TEST_ONLY");
 assert.equal(v.decision,"APPROVE_R4285_ONE_PHYSICAL_SIX_STAGE_EXECUTION");
 assert.equal(v.production_authorized,false);
 const created=Date.parse(nativeComment.created_at);
 assert(Number.isFinite(created)&&created<=now,"R4285_CTO_NATIVE_CREATION_TIME");
 const valid=time(v.valid_from),end=time(v.expires_at);
 assert(valid>=created&&valid<=now&&now<end&&end-valid<=86400000,
  "R4285_CTO_NATIVE_DECISION_WINDOW");
 const result=Object.freeze({status:"R4285_GITHUB_NATIVE_CTO_OWNER_DECISION_VERIFIED_TEST_ONLY",
  comment_id:nativeComment.id,run_id:v.run_id,subject_sha:v.subject_sha,
  nonce:v.nonce,permit_envelope_sha256:v.permit_envelope_sha256,
  created_at:nativeComment.created_at,valid_from:v.valid_from,expires_at:v.expires_at,
  cto_decision_sha256:sha(rawBytes),production_authorized:false});
 return result;
}
function fetchNativeCtoComment(commentId){
 // This function is read-only. Real Windows enforcement belongs to Host.
 assert(Number.isSafeInteger(commentId)&&commentId>0,"R4285_CTO_NATIVE_ID");
 const cp=require("node:child_process");
 const bytes=cp.execFileSync("curl.exe",[
  "--fail","--silent","--show-error","--location","--max-time","20",
  "-H","Accept: application/vnd.github+json",
  "-H","X-GitHub-Api-Version: 2022-11-28",
  COMMENT_PREFIX+commentId],{encoding:"utf8",timeout:25000,maxBuffer:524288,windowsHide:true});
 return JSON.parse(bytes);
}
function verifyLiveNativeCtoDecision(commentId,rawBytes,context,{now=Date.now()}={}){
 // The provenance capability is minted ONLY after a real native API fetch.
 // Supplying an arbitrary JSON object to inspectNativeCtoComment cannot mint it.
 const native=fetchNativeCtoComment(commentId);
 const proof=inspectNativeCtoComment(native,rawBytes,context,{now});
 verifiedCto.add(proof);
 return proof;
}
function assertNativeCtoProvenance(proof,ctx,{now=Date.now()}={}){
 assert(proof&&verifiedCto.has(proof),"R4285_CTO_REAL_NATIVE_PROVENANCE_REQUIRED");
 for(const k of ["subject_sha","nonce","permit_envelope_sha256","cto_decision_sha256"])
  assert.equal(proof[k],ctx[k],"R4285_CTO_NATIVE_PROVENANCE_BINDING:"+k);
 assert(Date.parse(proof.valid_from)<=now&&now<Date.parse(proof.expires_at),
  "R4285_CTO_NATIVE_PROVENANCE_EXPIRED");
 return proof;
}
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
function time(v){assert(typeof v==="string"&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v,
 "R4285_EXEC_APPROVAL_TIME");return Date.parse(v)}
function verify(envelope,trust,context,{now=Date.now()}={}){
 assert(envelope&&typeof envelope==="object"&&!Array.isArray(envelope));
 assert.deepEqual(Object.keys(envelope).sort(),["payload","signature_base64"],"R4285_EXEC_APPROVAL_FIELDS");
 const p=envelope.payload;
 assert(p&&typeof p==="object"&&!Array.isArray(p));
 assert.deepEqual(Object.keys(p).sort(),[...FIELDS].sort(),"R4285_EXEC_APPROVAL_PAYLOAD_FIELDS");
 assert.equal(p.schema_version,"MCFT_CAP09_R4285_PHYSICAL_EXECUTION_APPROVAL_V1");
 assert.equal(p.run_id,lineage.RUN);assert.equal(p.parent_run_id,lineage.ORIGINAL_PARENT);
 assert.equal(p.failed_predecessor_run_id,lineage.PREV);assert.equal(p.attempt_ordinal,4);
 assert.equal(p.subject_sha,context.subject_sha);assert.equal(p.host_id,lineage.HOST);
 assert.equal(context.host_id,lineage.HOST);
 assert.equal(p.nonce,context.nonce);
 assert.equal(p.permit_envelope_sha256,context.permit_envelope_sha256);
 assert.equal(p.adoption_envelope_sha256,context.adoption_envelope_sha256);
 assert(HEX64.test(p.nonce)&&HEX64.test(p.permit_envelope_sha256)&&
  HEX64.test(p.adoption_envelope_sha256)&&HEX64.test(p.cto_decision_sha256),
  "R4285_EXEC_APPROVAL_DIGEST_REQUIRED");
 assert.equal(p.cto_decision_sha256,context.cto_decision_sha256,
  "R4285_EXEC_APPROVAL_CTO_DECISION_MISSING");
 const cto=assertNativeCtoProvenance(context.cto_native_proof,{
  subject_sha:p.subject_sha,nonce:p.nonce,
  permit_envelope_sha256:p.permit_envelope_sha256,
  cto_decision_sha256:p.cto_decision_sha256},{now});
 // The independent signed approval is a necessary condition. Its CTO
 // provenance must be verified by the Host against native immutable evidence,
 // never inferred from a caller-supplied boolean or this signature alone.
 assert.equal(p.scope,"ISOLATED_QUALIFICATION_TEST_ONLY");
 assert.equal(p.decision,"APPROVE_R4285_SINGLE_PHYSICAL_SIX_STAGE_EXECUTION");
 assert.equal(p.production_authorized,false);
 const start=time(p.issued_at),end=time(p.expires_at);
 assert(start<=now&&now<end&&end-start<=86_400_000,
  "R4285_EXEC_APPROVAL_WINDOW");
 assert(start>=Date.parse(cto.created_at)&&end<=Date.parse(cto.expires_at),
  "R4285_EXEC_APPROVAL_OUTSIDE_NATIVE_CTO_WINDOW");
 assert(trust?.schema_version==="geox_mcft_cap09_retry_trust_v1");
 assert.equal(trust.host_id,lineage.HOST);
 const issuers=trust.issuers?.filter(i=>i.issuer_id===p.issuer_id&&i.key_id===p.key_id);
 assert.equal(issuers?.length,1,"R4285_EXEC_APPROVAL_SIGNER");
 const i=issuers[0];
 assert.equal(i.revoked,false);assert.equal(i.role,"ACCOUNTABLE_SINGLE_OPERATOR");
 assert.equal(i.issuer_id,trust.operator_id);
 assert(time(i.not_before)<=start&&end<=time(i.not_after));
 const key=crypto.createPublicKey(i.public_key_pem);
 assert.equal(key.asymmetricKeyType,"ed25519");
 assert.equal(sha(key.export({type:"spki",format:"der"})),i.spki_sha256);
 const sig=Buffer.from(envelope.signature_base64,"base64");
 assert(sig.length===64&&sig.toString("base64")===envelope.signature_base64);
 assert(crypto.verify(null,Buffer.from(DOMAIN+lineage.canonical(p)),key,sig),
  "R4285_EXEC_APPROVAL_BAD_SIGNATURE");
 const out=Object.freeze({status:"R4285_INDEPENDENT_PHYSICAL_EXECUTION_APPROVAL_VERIFIED_TEST_ONLY",
  run_id:lineage.RUN,subject_sha:p.subject_sha,nonce:p.nonce,
  permit_envelope_sha256:p.permit_envelope_sha256,
  adoption_envelope_sha256:p.adoption_envelope_sha256,
  cto_decision_sha256:p.cto_decision_sha256,expires_at:p.expires_at,
  production_authorized:false});
 verified.add(out);return out;
}
function assertVerified(a,prepared){
 assert(a&&verified.has(a),"R4285_EXEC_APPROVAL_VERIFIED_CAPABILITY_REQUIRED");
 assert.equal(a.run_id,prepared.run_id);
 assert.equal(a.subject_sha,prepared.subject_sha);
 assert.equal(a.nonce,prepared.nonce);
 assert.equal(a.permit_envelope_sha256,prepared.permit_envelope_sha256);
 assert.equal(a.adoption_envelope_sha256,prepared.adoption_digest);
 assert(Date.now()<Date.parse(a.expires_at),"R4285_EXEC_APPROVAL_EXPIRED");
 return true;
}
module.exports={DOMAIN,FIELDS,CTO_FIELDS,verify,assertVerified,
 inspectNativeCtoComment,verifyLiveNativeCtoDecision,assertNativeCtoProvenance};
