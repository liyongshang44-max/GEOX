"use strict";
/* R4285 signed successor evidence verification. READ ONLY.
 * This is not Adoption, fresh Resource Owner, Permit, stage Capability, or Host execute.
 * Historical Ed25519 Full-chain evidence is checked using the original native gate.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const cp=require("node:child_process"),crypto=require("node:crypto");
const RUN="4285c3ce342c",PREV="6ff9b41f6f7f",ORIGINAL_PARENT="72dc0304a21a";
const HISTORIC_SUBJECT="5d69b8a3f254600726bc10f0404f1330de1e4562";
const HOST="LAPTOP-STN2A2P1";
const DOMAIN="GEOX_MCFT_CAP09_R4285_PURPOSE_SPECIFIC_SUCCESSOR_LINEAGE_V1\n";
const RCP=Object.freeze({
 ingress:["RECOVERY-R4285-INGRESS-RESUME-READBACK-IMMUTABLE.json","908b903ae01f0e41f9f37db87ac235a49441131e61844d1c49314b812a4c0aab"],
 s3_io:["R4285-S3-IO-READBACK-IMMUTABLE.json","365164da45d577d334696dcb8488f27de04d660d0575a695648de231fa8196e3"],
 pg_s3:["R4285-PG-S3-INPLACE-READBACK-IMMUTABLE.json","3474e446a26201518bd6de3bb609c6739c889c3b691f6e923ee5485bfa030997"]
});
const HEX64=/^[a-f0-9]{64}$/,HEX40=/^[a-f0-9]{40}$/,RUN12=/^[a-f0-9]{12}$/;
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
function canonical(x){
 if(x===null||typeof x==="boolean"||typeof x==="string")return JSON.stringify(x);
 if(typeof x==="number"){assert(Number.isSafeInteger(x),"R4285_CANONICAL_INTEGER");return String(x);}
 if(Array.isArray(x))return "["+x.map(canonical).join(",")+"]";
 assert(x&&typeof x==="object"&&Object.getPrototypeOf(x)===Object.prototype,"R4285_CANONICAL_OBJECT");
 return "{"+Object.keys(x).sort().map(k=>JSON.stringify(k)+":"+canonical(x[k])).join(",")+"}";
}
function exact(v,fields,reason){
 assert(v&&typeof v==="object"&&!Array.isArray(v),reason);
 assert.deepEqual(Object.keys(v).sort(),fields.slice().sort(),reason);
}
function iso(s){
 assert(typeof s==="string"&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s,"R4285_INVALID_UTC");
 return Date.parse(s);
}
function readFile(f){
 assert(typeof f==="string"&&path.isAbsolute(f),"R4285_ABSOLUTE_FILE_REQUIRED");
 const target=path.resolve(f);let p=target;
 while(true){
  const st=fs.lstatSync(p);
  assert(!st.isSymbolicLink(),"R4285_FILE_PATH_SYMLINK_FORBIDDEN");
  if(p===target)assert(st.isFile()&&st.size>0&&st.size<4_194_304,"R4285_INVALID_REGULAR_FILE");
  const parent=path.dirname(p);if(parent===p)break;p=parent;
 }
 return fs.readFileSync(target);
}
const readJson=f=>JSON.parse(readFile(f).toString("utf8").replace(/^\uFEFF/,""));
function verifyPredecessor(runFile,nonceFile,expectedSha){
 assert(HEX64.test(expectedSha),"R4285_PREDECESSOR_DIGEST_REQUIRED");
 const a=readFile(runFile),b=readFile(nonceFile);
 assert.equal(sha(a),expectedSha,"R4285_PREDECESSOR_RUN_BYTES_CHANGED");
 assert.equal(sha(b),expectedSha,"R4285_PREDECESSOR_NONCE_BYTES_CHANGED");
 assert(a.equals(b),"R4285_PREDECESSOR_DUAL_LEDGER_DIFFERENT");
 const x=JSON.parse(a.toString("utf8"));
 assert.equal(x.schema_version,"geox_mcft_cap09_consumed_permit_attempt3_v2","R4285_PREDECESSOR_SCHEMA_WRONG");
 assert.equal(x.run_id,PREV,"R4285_PREDECESSOR_ID_WRONG");
 assert.equal(x.subject_sha,HISTORIC_SUBJECT,"R4285_PREDECESSOR_SUBJECT_WRONG");
 assert.equal(x.status,"CONSUMED_NO_AUTOMATIC_RETRY","R4285_PREDECESSOR_NOT_CONSUMED");
 assert.equal(x.production_authorized,false,"R4285_PREDECESSOR_PRODUCTION_FORBIDDEN");
 assert.equal(path.basename(path.dirname(runFile)),"run-"+PREV,"R4285_PREDECESSOR_RUN_LEDGER_PATH");
 assert(HEX64.test(x.nonce),"R4285_PREDECESSOR_NONCE_REQUIRED");
 assert.equal(path.basename(path.dirname(nonceFile)),"nonce-"+x.nonce,"R4285_PREDECESSOR_NONCE_LEDGER_PATH");
 assert(HEX64.test(x.envelope_sha256),"R4285_PREDECESSOR_PERMIT_DIGEST_REQUIRED");
 return Object.freeze({run_id:PREV,consumed_sha256:expectedSha,nonce:x.nonce,
  status:"PREDECESSOR_CONSUMED_TWIN_BYTES_VERIFIED_NOT_NEW_AUTHORITY"});
}
function verifyBoundResources(privateDir){
 assert(path.isAbsolute(privateDir),"R4285_PRIVATE_ROOT_ABSOLUTE");
 const results={};
 for(const [key,[name,want]] of Object.entries(RCP)){
  const file=path.join(privateDir,name),bytes=readFile(file);
  assert.equal(sha(bytes),want,"R4285_RESOURCE_RECEIPT_CHANGED:"+key);
  const body=JSON.parse(bytes.toString("utf8"));
  assert.equal(body.run_id,RUN,"R4285_RESOURCE_RUN_MISMATCH:"+key);
  assert.equal(body.permit,false,"R4285_RESOURCE_RECEIPT_CANNOT_AUTHORIZE_PERMIT:"+key);
  results[key]={sha256:want,file};
 }
 return Object.freeze(results);
}
const LINEAGE_FIELDS=Object.freeze([
 "schema_version","issuer_id","key_id","run_id","failed_predecessor_run_id","parent_run_id",
 "attempt_ordinal","subject_sha","host_id","scope","production_authorized","decision",
 "prior_consumed_sha256","prior_failure_sha256","all_attempts_inventory_sha256",
 "all_attempts_reviewed","receipt_ingress_sha256","receipt_s3_io_sha256","receipt_pg_s3_sha256",
 "historical_fullchain_attestation_sha256","issued_at","expires_at"
]);
function verifySignedLineage(envelope,trust,ctx){
 exact(envelope,["payload","signature_base64"],"R4285_LINEAGE_ENVELOPE_FIELDS");
 const p=envelope.payload;exact(p,LINEAGE_FIELDS,"R4285_LINEAGE_FIELDS");
 assert.equal(p.schema_version,"MCFT_CAP09_R4285_PURPOSE_SPECIFIC_LINEAGE_V1");
 assert.equal(p.run_id,RUN);
 assert.equal(p.failed_predecessor_run_id,PREV);
 assert.equal(p.parent_run_id,ORIGINAL_PARENT,"R4285_ORIGINAL_PARENT_SEMANTICS_CHANGED");
 assert.equal(p.attempt_ordinal,4,"R4285_ATTEMPT4_ORDINAL_REQUIRED");
 assert.equal(p.subject_sha,ctx.subject_sha,"R4285_LINEAGE_SUBJECT_MISMATCH");
 assert(HEX40.test(ctx.subject_sha),"R4285_LINEAGE_SOURCE_SHA_INVALID");
 assert.equal(p.host_id,HOST);
 assert.equal(ctx.host_id,HOST);
 assert.equal(p.scope,"ISOLATED_QUALIFICATION_TEST_ONLY");
 assert.equal(p.production_authorized,false);
 assert.equal(p.decision,"APPROVE_R4285_LINEAGE_NOT_ADOPTION_OR_PERMIT");
 assert.equal(p.all_attempts_reviewed,true,"R4285_ALL_ATTEMPTS_NOT_REVIEWED");
 for(const [field,expected] of Object.entries({
  prior_consumed_sha256:ctx.predecessor_sha256,
  prior_failure_sha256:ctx.sealed_failure_sha256,
  all_attempts_inventory_sha256:ctx.attempts_inventory_sha256,
  receipt_ingress_sha256:RCP.ingress[1],
  receipt_s3_io_sha256:RCP.s3_io[1],
  receipt_pg_s3_sha256:RCP.pg_s3[1],
  historical_fullchain_attestation_sha256:ctx.fullchain_attestation_sha256
 })){
  assert(HEX64.test(expected),"R4285_LINEAGE_EXPECTED_DIGEST_MISSING:"+field);
  assert.equal(p[field],expected,"R4285_LINEAGE_BINDING_CHANGED:"+field);
 }
 const now=ctx.now??Date.now(),start=iso(p.issued_at),end=iso(p.expires_at);
 assert(start<=now&&now<end&&end-start<=86400000,"R4285_LINEAGE_TIME_INVALID");
 assert(trust&&trust.schema_version==="geox_mcft_cap09_retry_trust_v1"&&
  trust.host_id===HOST&&Array.isArray(trust.issuers),"R4285_TRUST_INVALID");
 const matches=trust.issuers.filter(i=>i.issuer_id===p.issuer_id&&i.key_id===p.key_id);
 assert.equal(matches.length,1,"R4285_LINEAGE_SIGNER_NOT_UNIQUE");
 const signer=matches[0];
 assert.equal(signer.revoked,false,"R4285_LINEAGE_SIGNER_REVOKED");
 assert.equal(signer.role,"ACCOUNTABLE_SINGLE_OPERATOR","R4285_LINEAGE_OPERATOR_REQUIRED");
 assert.equal(signer.issuer_id,trust.operator_id,"R4285_LINEAGE_OPERATOR_MISMATCH");
 assert(iso(signer.not_before)<=start&&end<=iso(signer.not_after),"R4285_LINEAGE_KEY_WINDOW");
 const key=crypto.createPublicKey(signer.public_key_pem);
 assert.equal(key.asymmetricKeyType,"ed25519","R4285_LINEAGE_ED25519_REQUIRED");
 assert.equal(sha(key.export({type:"spki",format:"der"})),signer.spki_sha256,"R4285_LINEAGE_KEY_FINGERPRINT");
 const sig=Buffer.from(envelope.signature_base64,"base64");
 assert(sig.length===64&&sig.toString("base64")===envelope.signature_base64,
  "R4285_LINEAGE_SIGNATURE_FORMAT");
 assert(crypto.verify(null,Buffer.from(DOMAIN+canonical(p)),key,sig),"R4285_LINEAGE_SIGNATURE_INVALID");
 return Object.freeze({status:"R4285_LINEAGE_SIGNED_VERIFIED_NOT_ADOPTION_NOT_PERMIT",run_id:RUN,
  subject_sha:p.subject_sha,attempt_ordinal:p.attempt_ordinal,parent_run_id:p.parent_run_id,
  lineage_envelope_sha256:sha(Buffer.from(canonical(envelope))),permit_consumed:false,execute_authorized:false});
}
function verifyFullchainCarryforward({sourceRoot,trust,attestationFile,attestationSha}){
 assert(path.isAbsolute(sourceRoot),"R4285_SOURCE_ROOT_ABSOLUTE");
 assert(HEX64.test(attestationSha),"R4285_FULLCHAIN_DIGEST_REQUIRED");
 const native=require(path.join(sourceRoot,"scripts","governance_acceptance",
  "MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_PROOF_GATE_V1.cjs"));
 assert(typeof native.verify==="function"&&native.SOURCE_PATHS.length===23,
  "R4285_NATIVE_FULLCHAIN_GATE_REQUIRED");
 // Historical signed subject is never relabelled as the new Run or new HEAD.
 const r=native.verify({
  binding:{attestation_file:attestationFile,attestation_sha256:attestationSha},
  trust,subjectSha:HISTORIC_SUBJECT,attemptRunId:RUN,sourceRoot,now:Date.now()
 });
 assert.equal(r.status,"FULL_CHAIN_PHYSICAL_INTEGRATION_SIGNED_REVIEW_VERIFIED_NOT_PERMIT_AUTHORITY");
 assert.equal(r.source_byte_count,23);
 return Object.freeze({status:"R4285_HISTORICAL_FULLCHAIN_NATIVE_ED25519_23_FILES_VERIFIED",
  historical_subject_sha:HISTORIC_SUBJECT,actual_checked_source_files:23,execute_authorized:false});
}
function verifyExactMain(sourceRoot,subjectSha){
 assert(path.isAbsolute(sourceRoot)&&HEX40.test(subjectSha),"R4285_SOURCE_ID_REQUIRED");
 const git=(...args)=>cp.execFileSync("git",["-C",sourceRoot,...args],
  {encoding:"utf8",timeout:20000,windowsHide:true,maxBuffer:1048576}).trim();
 assert.equal(git("rev-parse","HEAD"),subjectSha,"R4285_SOURCE_HEAD_CHANGED");
 assert.equal(git("status","--porcelain","--untracked-files=all"),"","R4285_SOURCE_WORKTREE_DIRTY");
 assert.equal(git("ls-remote","origin","refs/heads/main").split("\t")[0],
  subjectSha,"R4285_SOURCE_PROTECTED_MAIN_CHANGED");
 return true;
}
function review(input){
 exact(input,[
  "source_root","subject_sha","host_id","private_dir","ledger_run_file","ledger_nonce_file",
  "predecessor_consumed_sha256","sealed_failure_file","attempts_inventory_file","lineage_envelope_file",
  "trust_file","fullchain_attestation_file","fullchain_attestation_sha256"
 ],"R4285_REVIEW_INPUT_FIELDS");
 assert.equal(input.host_id,HOST);
 verifyExactMain(input.source_root,input.subject_sha);
 const resources=verifyBoundResources(input.private_dir);
 const predecessor=verifyPredecessor(input.ledger_run_file,input.ledger_nonce_file,input.predecessor_consumed_sha256);
 const failureSha=sha(readFile(input.sealed_failure_file));
 const inventorySha=sha(readFile(input.attempts_inventory_file));
 const trust=readJson(input.trust_file),envelope=readJson(input.lineage_envelope_file);
 const lineage=verifySignedLineage(envelope,trust,{
  subject_sha:input.subject_sha,host_id:input.host_id,
  predecessor_sha256:predecessor.consumed_sha256,sealed_failure_sha256:failureSha,
  attempts_inventory_sha256:inventorySha,
  fullchain_attestation_sha256:input.fullchain_attestation_sha256
 });
 const fullchain=verifyFullchainCarryforward({
  sourceRoot:input.source_root,trust,
  attestationFile:input.fullchain_attestation_file,
  attestationSha:input.fullchain_attestation_sha256
 });
 return Object.freeze({
  schema_version:"MCFT_CAP09_R4285_SUCCESSOR_SIGNED_EVIDENCE_READONLY_V1",
  status:"R4285_SIGNED_LINEAGE_AND_HISTORIC_FULLCHAIN_VERIFIED_NOT_ADOPTION_OR_PERMIT",
  run_id:RUN,subject_sha:input.subject_sha,attempt_ordinal:lineage.attempt_ordinal,
  parent_run_id:lineage.parent_run_id,predecessor,resources,fullchain,
  execution_authorized:false,permit_issued:false,permit_consumed:false,
  stage_count:0,production_authorized:false
 });
}
module.exports={RUN,PREV,ORIGINAL_PARENT,HISTORIC_SUBJECT,HOST,DOMAIN,RCP,LINEAGE_FIELDS,canonical,
 verifyPredecessor,verifyBoundResources,verifySignedLineage,
 verifyFullchainCarryforward,verifyExactMain,review};
