"use strict";
/**
 * CAP-09 / 6ff9 Attempt-3 V2 engineering eligibility gate.
 * NO signing, permit issuance/consumption, stage launch, DB, S3 or Provider I/O.
 * Intentionally not wired to the legacy Host: an engineering PASS is NEVER Adoption.
 * All live execution remains HOLD until separate, source-qualified Host/Permit V2.
 */
const assert=require("node:assert/strict");
const crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path");
const BASELINE="e7a8f30ffb60cb4c2bc6bd83d7bbe487eb708cc9";
const PARENT="72dc0304a21a", SECOND="da9db7129607", RUN="6ff9b41f6f7f";
const HISTORIC_SUBJECT="2b63652297bb285f21c4d4c63c37d247d009142c";
const HISTORIC_CONSUMED_SHA="f8c55961e2b4972e8e2b92ad0d788b6030240f97e2bc274edf206fb5833ea21a";
const SUCCESSOR_ID="CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_TEST_ONLY";
const ENGINEERING_IDS=Object.freeze([
 "A44_ADOPTION_QUALIFICATION_LOCAL_EXECUTION_ADMISSION_ENGINEERING_ONLY",
 "STAGE3_20261025_NONAUTHORIZING_EXACT_PATH_REQUALIFICATION",
 "DA9_SIGNED_COMPOSER_V2_PHASE3_FROZEN_RUNTIME_REVIEW_ONLY",
 "DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_PENDING",
 "DA9_POSTMERGE_WINDOWS_PHYSICAL_READONLY_PRE_ADMISSION_V1",
 "CE94_REAL_STAGE3_PHYSICAL_EVIDENCE_V2_ENGINEERING_REVIEW_ONLY",
 "CAP09_3740_3744_OWNER_DIRECTED_SOURCE_REVIEW_TECHNICAL_V1",
 "FROZEN108_CURRENT_RUNTIME_SUCCESSOR_TEST_ONLY_QCP_ENROLLMENT_V1",
 "DA9_CURRENT_COMPOSER_PHASE3_SIGNATURE_SUCCESSOR_QCP_TEST_ONLY_V1",
 "STAGE3_20261026_DUAL_HEARTBEAT_ENGINEERING_ONLY"
]);
const DOMAIN="GEOX_MCFT_CAP09_ATTEMPT3_LINEAGE_ADJUDICATION_V1\n";
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const isSha=x=>typeof x==="string"&&/^[0-9a-f]{64}$/.test(x);
const isSubject=x=>typeof x==="string"&&/^[0-9a-f]{40}$/.test(x);
function canonical(x){
 if(x===null||typeof x==="boolean"||typeof x==="string")return JSON.stringify(x);
 if(typeof x==="number"){assert(Number.isSafeInteger(x),"A3_INTEGER");return String(x);}
 if(Array.isArray(x))return "["+x.map(canonical).join(",")+"]";
 assert(x&&typeof x==="object"&&Object.getPrototypeOf(x)===Object.prototype,"A3_JSON_OBJECT");
 return "{"+Object.keys(x).sort().map(k=>JSON.stringify(k)+":"+canonical(x[k])).join(",")+"}";
}
function exact(x,keys,token){
 assert(x&&typeof x==="object"&&!Array.isArray(x),token);
 assert.deepEqual(Object.keys(x).sort(),keys.slice().sort(),token);
}
function time(t){assert(typeof t==="string"&&Number.isFinite(Date.parse(t))&&new Date(t).toISOString()===t,"A3_TIME");return Date.parse(t);}
function mapAdoptionV2(qcp,policy){
 assert(qcp&&Array.isArray(qcp.checks)&&[64,65].includes(qcp.checks.length),"A3_QCP64_OR_65_REQUIRED");
 assert(policy&&policy.schema==="CAP09_OFFLINE_ADOPTION_TRUST_V1"&&Array.isArray(policy.checks)&&policy.checks.length===54,"A3_FORMAL54_REQUIRED");
 const ids=qcp.checks.map(x=>x.check_id), formal=policy.checks.map(x=>x.check_id);
 assert.equal(new Set(ids).size,ids.length,"A3_QCP_DUPLICATE");
 assert.equal(new Set(formal).size,54,"A3_FORMAL_DUPLICATE");
 const formalSet=new Set(formal);
 assert(formal.every(x=>ids.includes(x)),"A3_FORMAL_DEFINITION_MISSING");
 const extras=ids.filter(x=>!formalSet.has(x));
 const expected=ids.length===65?[...ENGINEERING_IDS,SUCCESSOR_ID]:ENGINEERING_IDS.slice();
 assert.deepEqual(extras.slice().sort(),expected.slice().sort(),"A3_TECHNICAL_EXTRA_IDENTITY_CHANGED");
 assert(policy.checks.every(x=>x.check_revision==="LOCAL_QCP_DEFINITION_SHA256"),"A3_FORMAL_REVISION_POLICY_CHANGED");
 assert.deepEqual(policy.allowed_not_applicable_ids.slice().sort(),[
  "V13_PRODUCER_DRIVEN_QUALIFICATION","END_TO_END_EVIDENCE_SUPPLY_DEADLINE",
  "EXACT_ONE_PRODUCTION_OWNER","FORMAL_V5_ACTIVATION",
  "V13_RUNTIME_HARNESS_RESOLVER_MIGRATION"].sort(),"A3_NA_POLICY_CHANGED");
 const definitions=new Map(qcp.checks.map(x=>[x.check_id,x]));
 const revisions=Object.fromEntries(formal.map(id=>[id,sha(canonical(definitions.get(id)))]));
 return Object.freeze({schema_version:"MCFT_CAP09_ADOPTION_V2_TECHNICAL_MAP_V1",
  total_checks:ids.length,formal_checks:54,technical_only_checks:expected.length,
  formal_revisions_sha256:sha(canonical(revisions)),
  technical_ids_sha256:sha(canonical(extras.slice().sort())),
  status:"DEFINITIONS_ONLY_NOT_ADOPTION",adoption_authorized:false,permit_authorized:false});
}
function safeFile(file){
 assert(typeof file==="string"&&path.isAbsolute(file),"A3_ABSOLUTE_LEDGER_PATH_REQUIRED");
 let p=path.resolve(file);
 for(;;){const stat=fs.lstatSync(p);assert(!stat.isSymbolicLink(),"A3_LEDGER_SYMLINK_FORBIDDEN");if(p===file)assert(stat.isFile(),"A3_LEDGER_FILE_REQUIRED");const par=path.dirname(p);if(par===p)break;p=par;}
 return fs.readFileSync(file);
}
function verifyConsumedTwins(runFile,nonceFile,expectedSha=HISTORIC_CONSUMED_SHA){
 const runBytes=safeFile(runFile),nonceBytes=safeFile(nonceFile);
 assert(isSha(expectedSha),"A3_RECEIPT_DIGEST_INVALID");
 assert.equal(sha(runBytes),expectedSha,"A3_RUN_RECEIPT_CHANGED");
 assert.equal(sha(nonceBytes),expectedSha,"A3_NONCE_RECEIPT_CHANGED");
 assert(runBytes.equals(nonceBytes),"A3_CONSUMED_TWINS_DIFFER");
 const r=JSON.parse(runBytes.toString("utf8").replace(/^\uFEFF/,""));
 assert.equal(r.schema_version,"geox_mcft_cap09_consumed_permit_v1");
 assert.equal(r.status,"CONSUMED_NO_AUTOMATIC_RETRY");
 assert.equal(r.execute_authorized,false);
 assert.equal(r.payload?.run_id,SECOND);
 assert.equal(r.payload?.parent_run_id,PARENT);
 assert.equal(r.payload?.attempt_ordinal,2);
 assert.equal(r.payload?.subject_sha,HISTORIC_SUBJECT);
 assert.equal(r.payload?.host_id,"LAPTOP-STN2A2P1");
 assert(isSha(r.envelope_sha256)&&isSha(r.trust_sha256),"A3_HISTORIC_VERIFIED_DIGEST_MISSING");
 assert(!Object.hasOwn(r,"signature_base64"),"A3_HISTORIC_VERIFIED_RECEIPT_SCHEMA_CHANGED");
 assert(time(r.payload.issued_at)<=time(r.consumed_at)&&time(r.consumed_at)<time(r.payload.expires_at),"A3_HISTORIC_WINDOW_INVALID");
 assert.equal(path.basename(path.dirname(runFile)),"run-"+SECOND,"A3_RUN_LEDGER_DIRECTORY");
 assert.equal(path.basename(path.dirname(nonceFile)),"nonce-"+r.payload.nonce,"A3_NONCE_LEDGER_DIRECTORY");
 return Object.freeze({run_id:SECOND,attempt_ordinal:2,receipt_sha256:expectedSha,
  host_id:r.payload.host_id,consumed_at:r.consumed_at,cryptographic_signature_reverified:false,
  status:"VERIFIED_TWIN_BYTES_NOT_CRYPTOGRAPHIC_REPLAY"});
}
function verifyLineageReview(envelope,trust,{subjectSha,hostId,now=Date.now(),sealedFailureSha,attemptsInventorySha}){
 exact(envelope,["payload","signature_base64"],"A3_REVIEW_ENVELOPE");
 const p=envelope.payload;
 exact(p,["schema_version","issuer_id","key_id","run_id","parent_run_id","attempt_ordinal",
 "baseline_main_sha","subject_sha","host_id","scope","production_authorized","historical_consumed_receipt_sha256",
 "sealed_failure_sha256","all_attempts_inventory_sha256","all_attempts_reviewed",
 "issued_at","expires_at","decision"],"A3_REVIEW_PAYLOAD");
 assert.equal(p.schema_version,"MCFT_CAP09_ATTEMPT3_LINEAGE_REVIEW_V1");
 assert.equal(p.baseline_main_sha,BASELINE);
 assert.equal(p.run_id,RUN);assert.equal(p.parent_run_id,PARENT);assert.equal(p.attempt_ordinal,3);
 assert(isSubject(subjectSha)&&subjectSha!==BASELINE,"A3_NEW_EXACT_SUBJECT_REQUIRED");
 assert.equal(p.subject_sha,subjectSha);assert.equal(p.host_id,hostId);
 assert.equal(p.scope,"TEST_ONLY");assert.equal(p.production_authorized,false);
 assert.equal(p.historical_consumed_receipt_sha256,HISTORIC_CONSUMED_SHA);
 assert(isSha(sealedFailureSha)&&p.sealed_failure_sha256===sealedFailureSha,"A3_SEALED_FAILURE_NOT_BOUND");
 assert(isSha(attemptsInventorySha)&&p.all_attempts_inventory_sha256===attemptsInventorySha,"A3_ALL_ATTEMPTS_NOT_BOUND");
 assert.equal(p.all_attempts_reviewed,true,"A3_ATTEMPTS_NOT_REVIEWED");
 assert.equal(p.decision,"APPROVED_TEST_ONLY_LINEAGE_NOT_PERMIT");
 const start=time(p.issued_at),end=time(p.expires_at);
 assert(start<=now&&now<end&&end-start<=86400000,"A3_REVIEW_TIME_INVALID");
 assert(trust?.schema_version==="geox_mcft_cap09_retry_trust_v1"&&Array.isArray(trust.issuers),"A3_RETRY_TRUST_REQUIRED");
 assert.equal(hostId,trust.host_id,"A3_HOST_TRUST_MISMATCH");
 const issuers=trust.issuers.filter(x=>x.issuer_id===p.issuer_id&&x.key_id===p.key_id);
 assert.equal(issuers.length,1,"A3_REVIEW_ISSUER_UNKNOWN");
 const issuer=issuers[0];assert.equal(issuer.revoked,false,"A3_REVIEW_ISSUER_REVOKED");
 assert(["ACCOUNTABLE_SINGLE_OPERATOR","INDEPENDENT_RETRY_GOVERNANCE"].includes(issuer.role),"A3_ROLE_INVALID");
 if(issuer.role==="ACCOUNTABLE_SINGLE_OPERATOR")assert.equal(issuer.issuer_id,trust.operator_id,"A3_OPERATOR_MISMATCH");
 else assert.notEqual(issuer.issuer_id,trust.operator_id,"A3_INDEPENDENCE_MISMATCH");
 assert(time(issuer.not_before)<=start&&end<=time(issuer.not_after),"A3_KEY_WINDOW_INVALID");
 const key=crypto.createPublicKey(issuer.public_key_pem);
 assert.equal(key.asymmetricKeyType,"ed25519","A3_ED25519_REQUIRED");
 assert.equal(sha(key.export({type:"spki",format:"der"})),issuer.spki_sha256,"A3_KEY_FINGERPRINT_INVALID");
 const signature=Buffer.from(envelope.signature_base64,"base64");
 assert(signature.length===64&&signature.toString("base64")===envelope.signature_base64,"A3_SIGNATURE_FORMAT");
 assert(crypto.verify(null,Buffer.from(DOMAIN+canonical(p)),key,signature),"A3_REVIEW_SIGNATURE_INVALID");
 return Object.freeze({status:"SIGNED_ATTEMPT3_LINEAGE_VERIFIED_NOT_ADOPTION_OR_PERMIT",run_id:RUN,subject_sha:subjectSha,production_authorized:false});
}
function assessEngineeringGate({qcp,policy,review,trust,runReceiptFile,nonceReceiptFile,
 subjectSha,hostId,sealedFailureSha,attemptsInventorySha,now=Date.now()}){
 const map=mapAdoptionV2(qcp,policy);
 const historical=verifyConsumedTwins(runReceiptFile,nonceReceiptFile);
 const lineage=verifyLineageReview(review,trust,{subjectSha,hostId,sealedFailureSha,attemptsInventorySha,now});
 assert.equal(historical.host_id,hostId,"A3_WINDOWS_HOST_MISMATCH");
 assert.equal(lineage.subject_sha,subjectSha);
 return {schema_version:"MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1",
  baseline_main_sha:BASELINE,current_subject_sha:subjectSha,run_id:RUN,parent_run_id:PARENT,
  attempt_ordinal:3,adoption_mapping:map,historical_consumption:historical,lineage_review:lineage,
  status:"ENGINEERING_LINEAGE_VERIFIED_EXECUTION_HOLD",
  blocked_by:["CURRENT_SUBJECT_QCP_ARTIFACT_ADOPTION_V2_SIGNED_QUALIFICATION",
   "VERSIONED_HOST_PERMIT_V2_NONREPLAY_CONSUMPTION",
   "NEW_RUN_PG_S3_ACTUAL_RESOURCE_OWNER_READBACK",
   "CURRENT_SUBJECT_DISTINCT_SIGNED_NONAUTHORIZED_PHYSICAL_FULL_CHAIN",
   "LIVE_STAGE_BUDGET_AND_ONE_SHOT_PERMIT_PREFLIGHT"],
  adoption_authorized:false,permit_issued:false,permit_consumed:false,
  six_stage_executed:false,production_authorized:false};
}
module.exports={BASELINE,RUN,PARENT,SECOND,HISTORIC_CONSUMED_SHA,ENGINEERING_IDS,SUCCESSOR_ID,DOMAIN,
 canonical,mapAdoptionV2,verifyConsumedTwins,verifyLineageReview,assessEngineeringGate};
