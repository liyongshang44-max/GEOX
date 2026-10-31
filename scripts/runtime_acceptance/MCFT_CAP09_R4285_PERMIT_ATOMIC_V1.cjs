"use strict";
/* R4285 dedicated one-shot run/nonce consumption. This module never signs,
 * accepts old Attempt-3 Permit V2, launches a child or implies production.
 *
 * A crash after the first exclusive reservation permanently burns this
 * attempt. No rollback/retry/cleanup mechanism is exported.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const permit=require("./MCFT_CAP09_R4285_PERMIT_V1.cjs");
const native=require("../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V1.cjs");
const lineage=require("../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs");
const RUN="4285c3ce342c";
const accepted=new WeakSet(),consumed=new WeakSet();
const HEX64=/^[0-9a-f]{64}$/;
function noLinks(dir){
 assert(typeof dir==="string"&&path.isAbsolute(dir),"R4285_ATOMIC_ROOT_ABSOLUTE");
 let current=path.resolve(dir);
 for(;;){
  const s=fs.lstatSync(current);
  assert(s.isDirectory()&&!s.isSymbolicLink(),"R4285_ATOMIC_LEDGER_ROOT_UNSAFE");
  const parent=path.dirname(current);if(parent===current)break;current=parent;
 }
}
function slotPaths(root,nonce){
 assert(HEX64.test(nonce),"R4285_ATOMIC_NONCE_REQUIRED");
 return Object.freeze({run:path.join(root,"run-"+RUN),nonce:path.join(root,"nonce-"+nonce)});
}
function assertUnreserved(root,nonce){
 noLinks(root);
 const dirs=slotPaths(root,nonce);
 assert(!fs.existsSync(dirs.run)&&!fs.existsSync(dirs.nonce),
  "R4285_ATOMIC_RUN_OR_NONCE_ALREADY_RESERVED");
 return dirs;
}
function writeOnce(file,bytes){
 const fd=fs.openSync(file,"wx",0o600);
 try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}
 finally{fs.closeSync(fd);}
}
function readExact(file){
 const st=fs.lstatSync(file);
 assert(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=16384,
  "R4285_ATOMIC_RECEIPT_UNSAFE");
 return fs.readFileSync(file);
}
/* Called only after Native Adoption performs its actual Windows/GitHub/
 * installed-release/source-tree checks and Permit verifies its own signature.
 * Both capabilities are unforgeable in this process, not caller status strings.
 */
function prepare({nativeAdoption,permitProof,trust,sourceMainProof}){
 assert(native.isNativeVerified(nativeAdoption),"R4285_ATOMIC_NATIVE_ADOPTION_REQUIRED");
 assert(permit.isVerified(permitProof),"R4285_ATOMIC_GENUINE_R4285_PERMIT_REQUIRED");
 assert(sourceMainProof===true,"R4285_ATOMIC_LIVE_EXACT_MAIN_RECHECK_REQUIRED");
 assert.equal(nativeAdoption.run_id,RUN,"R4285_ATOMIC_ADOPTION_RUN_WRONG");
 assert.equal(permitProof.run_id,RUN,"R4285_ATOMIC_PERMIT_RUN_WRONG");
 assert.equal(nativeAdoption.subject_sha,permitProof.subject_sha,"R4285_ATOMIC_SUBJECT_MISMATCH");
 assert.equal(nativeAdoption.adoption_digest,permitProof.adoption_envelope_sha256,
  "R4285_ATOMIC_ADOPTION_DIGEST_MISMATCH");
 assert(trust&&trust.schema_version==="geox_mcft_cap09_retry_trust_v1",
  "R4285_ATOMIC_TRUST_SCHEMA");
 assert.equal(trust.host_id,permit.HOST,"R4285_ATOMIC_TRUST_HOST_WRONG");
 assert.equal(typeof trust.ledger_root,"string","R4285_ATOMIC_MISSING_ROOT");
 assertUnreserved(trust.ledger_root,permitProof.nonce);
 const proof=Object.freeze({
  run_id:RUN,subject_sha:permitProof.subject_sha,nonce:permitProof.nonce,
  adoption_digest:permitProof.adoption_envelope_sha256,
  lineage_envelope_sha256:permitProof.lineage_envelope_sha256,
  resource_owner_envelope_sha256:permitProof.resource_owner_envelope_sha256,
  permit_envelope_sha256:permitProof.envelope_sha256,
  permit_expires_at:permitProof.expires_at,
  root:trust.ledger_root,status:"R4285_ATOMIC_PREPARED_NOT_CONSUMED",
  execute_authorized:false,production_authorized:false
 });
 accepted.add(proof);
 return proof;
}
function isPrepared(x){return !!x&&accepted.has(x);}
function consumeForQualifiedHost(prepared,{executionApproval,assertExecutionApproval}){
 assert(isPrepared(prepared),"R4285_ATOMIC_PREPARED_CAPABILITY_REQUIRED");
 // The signed, purpose-specific physical execution approval is separate
 // from Owner/Lineage/Adoption and Permit; the caller cannot pass a boolean.
 assert(typeof assertExecutionApproval==="function",
  "R4285_ATOMIC_EXECUTION_APPROVAL_CONSUMER_REQUIRED");
 assertExecutionApproval(executionApproval,prepared);
 assert(Date.now()<Date.parse(prepared.permit_expires_at),"R4285_ATOMIC_PERMIT_EXPIRED");
 const dirs=assertUnreserved(prepared.root,prepared.nonce);
 // Burn the in-process permission BEFORE any I/O. If a partial filesystem
 // reservation fails, the attempt cannot be resumed in this process either.
 accepted.delete(prepared);
 // Two independent exclusive directories. A partial pair is a fatal burn,
 // not a condition to delete, retry, rename or recover automatically.
 fs.mkdirSync(dirs.nonce,{mode:0o700});
 fs.mkdirSync(dirs.run,{mode:0o700});
 const body=Buffer.from(JSON.stringify({
  schema_version:"geox_mcft_cap09_consumed_permit_r4285_v1",
  run_id:RUN,subject_sha:prepared.subject_sha,nonce:prepared.nonce,
  parent_run_id:permit.PARENT,failed_predecessor_run_id:permit.FAILED_PREDECESSOR,
  attempt_ordinal:4,permit_envelope_sha256:prepared.permit_envelope_sha256,
  adoption_envelope_sha256:prepared.adoption_digest,
  lineage_envelope_sha256:prepared.lineage_envelope_sha256,
  resource_owner_envelope_sha256:prepared.resource_owner_envelope_sha256,
  consumed_at:new Date().toISOString(),status:"CONSUMED_NO_AUTOMATIC_RETRY",
  production_authorized:false
 },null,2)+"\n");
 writeOnce(path.join(dirs.nonce,"CONSUMED.json"),body);
 writeOnce(path.join(dirs.run,"CONSUMED.json"),body);
 const receipt=Object.freeze({status:"R4285_TEST_ONLY_CONSUMED_NO_AUTOMATIC_RETRY",
  run_id:RUN,subject_sha:prepared.subject_sha,nonce:prepared.nonce,
  run_directory:dirs.run,nonce_directory:dirs.nonce,
  permit_envelope_sha256:prepared.permit_envelope_sha256,
  consumed_sha256:crypto.createHash("sha256").update(body).digest("hex"),
  production_authorized:false});
 consumed.add(receipt);
 return receipt;
}
function assertConsumed(x){
 assert(x&&consumed.has(x),"R4285_ATOMIC_IN_PROCESS_CONSUMED_CAPABILITY_REQUIRED");
 noLinks(x.run_directory);noLinks(x.nonce_directory);
 assert.equal(path.basename(x.run_directory),"run-"+RUN);
 assert.equal(path.basename(x.nonce_directory),"nonce-"+x.nonce);
 const a=readExact(path.join(x.run_directory,"CONSUMED.json"));
 const b=readExact(path.join(x.nonce_directory,"CONSUMED.json"));
 assert(a.equals(b),"R4285_ATOMIC_TWIN_CONSUMED_BYTES_CHANGED");
 assert.equal(crypto.createHash("sha256").update(a).digest("hex"),x.consumed_sha256,
  "R4285_ATOMIC_CONSUMED_SHA_CHANGED");
 const p=JSON.parse(a.toString("utf8"));
 assert.equal(p.schema_version,"geox_mcft_cap09_consumed_permit_r4285_v1");
 assert.equal(p.run_id,RUN);assert.equal(p.attempt_ordinal,4);
 assert.equal(p.parent_run_id,permit.PARENT);assert.equal(p.failed_predecessor_run_id,permit.FAILED_PREDECESSOR);
 assert.equal(p.nonce,x.nonce);assert.equal(p.subject_sha,x.subject_sha);
 assert.equal(p.permit_envelope_sha256,x.permit_envelope_sha256);
 assert.equal(p.status,"CONSUMED_NO_AUTOMATIC_RETRY");assert.equal(p.production_authorized,false);
 return x;
}
module.exports={RUN,slotPaths,assertUnreserved,prepare,isPrepared,consumeForQualifiedHost,assertConsumed};
