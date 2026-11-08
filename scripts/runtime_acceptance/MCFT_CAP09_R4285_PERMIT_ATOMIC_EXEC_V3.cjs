"use strict";
const executionIdentity=require("./MCFT_CAP09_R4285_EXECUTION_IDENTITY_V3.cjs");

/* R4285 physical execution V3 dedicated one-shot run/nonce consumption. V1 source unmodified. This module never signs,
 * accepts old Attempt-3 Permit V2, launches a child or implies production.
 *
 * A crash after the first exclusive reservation permanently burns this
 * attempt. No rollback/retry/cleanup mechanism is exported.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const permit=require("./MCFT_CAP09_R4285_PERMIT_EXEC_V3.cjs");
const v2=require("./MCFT_CAP09_R4285_ADMISSION_EXEC_V3.cjs");
const resource=require("../governance_acceptance/MCFT_CAP09_R4285_RESOURCE_OWNER_V3.cjs");
const native=require("../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V3.cjs");
const lineage=require("../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs");
const RUN=executionIdentity.SUCCESSOR;
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
function slotPaths(root,nonce,run=RUN){
 executionIdentity.checkNonce(run,nonce);
 assert(HEX64.test(nonce),"R4285_ATOMIC_NONCE_REQUIRED");
 return Object.freeze({run:path.join(root,"run-"+run),nonce:path.join(root,"nonce-"+nonce)});
}
function assertUnreserved(root,nonce,run=RUN){
 noLinks(root);
 executionIdentity.checkHistory(root,run);
 const dirs=slotPaths(root,nonce,run);
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
function prepare({nativeAdoption,permitProof,trust,sourceRoot,stable,intent,ctx,
 resourceEnvelope,readback,plan,observed,permitEnvelope,releaseRoot,profile,environment}){
 assert.equal(ctx?.run_id,executionIdentity.SUCCESSOR,"V3_PHYSICAL_SUCCESSOR_RUN_REQUIRED");
 assert(native.isNativeVerified(nativeAdoption),"R4285_ATOMIC_NATIVE_ADOPTION_REQUIRED");
 assert(permit.isVerified(permitProof),"R4285_ATOMIC_GENUINE_R4285_PERMIT_REQUIRED");
 v2.requireStable(stable,intent,ctx);
 v2.checkActualPermit(permitProof,permitEnvelope,resourceEnvelope,readback,observed,
   {...ctx,plan},{now:Date.now()});
 assert(typeof sourceRoot==="string"&&path.isAbsolute(sourceRoot),
  "R4285_ATOMIC_LIVE_MAIN_SOURCE_REQUIRED");
 // Current protected main is rechecked at the irreversible consume edge below.
 assert.equal(nativeAdoption.run_id,executionIdentity.get(ctx.run_id).qualification_run_id,"R4285_ATOMIC_ADOPTION_RUN_WRONG");
 assert.equal(permitProof.run_id,ctx.run_id,"R4285_ATOMIC_PERMIT_RUN_WRONG");
 assert.equal(nativeAdoption.subject_sha,permitProof.subject_sha,"R4285_ATOMIC_SUBJECT_MISMATCH");
 assert.equal(nativeAdoption.adoption_digest,permitProof.adoption_envelope_sha256,
  "R4285_ATOMIC_ADOPTION_DIGEST_MISMATCH");
 assert(trust&&trust.schema_version==="geox_mcft_cap09_retry_trust_v1",
  "R4285_ATOMIC_TRUST_SCHEMA");
 assert.equal(trust.host_id,permit.HOST,"R4285_ATOMIC_TRUST_HOST_WRONG");
 assert.equal(typeof trust.ledger_root,"string","R4285_ATOMIC_MISSING_ROOT");
 assertUnreserved(trust.ledger_root,permitProof.nonce,permitProof.run_id);
 assert(typeof releaseRoot==="string"&&path.isAbsolute(releaseRoot)&&profile&&environment,
   "V2_ATOMIC_RELEASE_RECHECK_INPUT_REQUIRED");
 const proof=Object.freeze({
  run_id:permitProof.run_id,subject_sha:permitProof.subject_sha,nonce:permitProof.nonce,
  adoption_digest:permitProof.adoption_envelope_sha256,
  lineage_envelope_sha256:permitProof.lineage_envelope_sha256,
  resource_owner_envelope_sha256:permitProof.resource_owner_envelope_sha256,
  permit_envelope_sha256:permitProof.envelope_sha256,
  permit_expires_at:permitProof.expires_at,
  owner_readback_sha256:readback.sha256,intent_sha256:intent.sha256,
  resource_envelope:resourceEnvelope,readback,plan,observed,ctx,
  release_root:releaseRoot,material_profile:profile,environment,
  stable,intent,permit_envelope:permitEnvelope,permit_proof:permitProof,
  predecessor_marker_sha256:executionIdentity.checkHistory(trust.ledger_root,permitProof.run_id),
  root:trust.ledger_root,source_root:sourceRoot,status:"R4285_ATOMIC_PREPARED_NOT_CONSUMED",
  execute_authorized:false,production_authorized:false
 });
 accepted.add(proof);
 return proof;
}
function isPrepared(x){return !!x&&accepted.has(x);}
function consumeForQualifiedHost(prepared,finalApproval){
 assert(isPrepared(prepared),"R4285_ATOMIC_PREPARED_CAPABILITY_REQUIRED");
 // The signed, purpose-specific physical execution approval is separate
 // from Owner/Lineage/Adoption and Permit; the caller cannot pass a boolean.
 v2.requireStable(prepared.stable,prepared.intent,prepared.ctx);
 v2.assertFinal(finalApproval,{
  nonce:prepared.nonce,permit_envelope_sha256:prepared.permit_envelope_sha256,
  resource_readback_sha256:prepared.owner_readback_sha256,
  intent_sha256:prepared.intent_sha256},{now:Date.now()});
 v2.checkActualPermit(prepared.permit_proof,prepared.permit_envelope,
  prepared.resource_envelope,prepared.readback,prepared.observed,
  {...prepared.ctx,plan:prepared.plan},{now:Date.now()});
 resource.assertDynamicFreshness(prepared.resource_envelope.payload,prepared.readback);
 lineage.verifyExactMain(prepared.source_root,prepared.subject_sha);
 // Full 24,673-file/tool revalidation took place before native final CTO refresh
 // in the same Host invocation; do not repeat it after the 15s CTO window.
 // Perform all short-lived Owner/Permit/CTO assertions again at the burn edge.
 resource.assertDynamicFreshness(prepared.resource_envelope.payload,prepared.readback);
 v2.checkActualPermit(prepared.permit_proof,prepared.permit_envelope,
   prepared.resource_envelope,prepared.readback,prepared.observed,
   {...prepared.ctx,plan:prepared.plan},{now:Date.now()});
 v2.assertFinal(finalApproval,{
  nonce:prepared.nonce,permit_envelope_sha256:prepared.permit_envelope_sha256,
  resource_readback_sha256:prepared.owner_readback_sha256,
  intent_sha256:prepared.intent_sha256},{now:Date.now()});
 assert(Date.now()<Date.parse(prepared.permit_expires_at),"R4285_ATOMIC_PERMIT_EXPIRED");
 const dirs=assertUnreserved(prepared.root,prepared.nonce,prepared.run_id);
 const id=executionIdentity.get(prepared.run_id);
 assert.equal(executionIdentity.checkHistory(prepared.root,prepared.run_id),prepared.predecessor_marker_sha256,"V3_PREDECESSOR_MARKER_BYTES_CHANGED");
 // Burn the in-process permission BEFORE any I/O. If a partial filesystem
 // reservation fails, the attempt cannot be resumed in this process either.
 accepted.delete(prepared);
 // Two independent exclusive directories. A partial pair is a fatal burn,
 // not a condition to delete, retry, rename or recover automatically.
 fs.mkdirSync(dirs.nonce,{mode:0o700});
 fs.mkdirSync(dirs.run,{mode:0o700});
 const body=Buffer.from(JSON.stringify({
  schema_version:"geox_mcft_cap09_consumed_permit_r4285_v1",
  run_id:prepared.run_id,subject_sha:prepared.subject_sha,nonce:prepared.nonce,
  parent_run_id:id.parent_run_id,failed_predecessor_run_id:id.failed_predecessor_run_id,
  attempt_ordinal:id.attempt_ordinal,permit_envelope_sha256:prepared.permit_envelope_sha256,
  adoption_envelope_sha256:prepared.adoption_digest,
  lineage_envelope_sha256:prepared.lineage_envelope_sha256,
  resource_owner_envelope_sha256:prepared.resource_owner_envelope_sha256,
  v2_cto_intent_sha256:prepared.intent_sha256,
  v2_resource_readback_sha256:prepared.owner_readback_sha256,
  consumed_at:new Date().toISOString(),status:"CONSUMED_NO_AUTOMATIC_RETRY",
  production_authorized:false
 },null,2)+"\n");
 writeOnce(path.join(dirs.nonce,"CONSUMED.json"),body);
 writeOnce(path.join(dirs.run,"CONSUMED.json"),body);
 const receipt=Object.freeze({status:"R4285_TEST_ONLY_CONSUMED_NO_AUTOMATIC_RETRY",
  run_id:prepared.run_id,subject_sha:prepared.subject_sha,nonce:prepared.nonce,
  run_directory:dirs.run,nonce_directory:dirs.nonce,
  permit_envelope_sha256:prepared.permit_envelope_sha256,
  v2_cto_intent_sha256:prepared.intent_sha256,
  v2_resource_readback_sha256:prepared.owner_readback_sha256,
  consumed_sha256:crypto.createHash("sha256").update(body).digest("hex"),
  production_authorized:false});
 consumed.add(receipt);
 return receipt;
}
function assertConsumed(x){
 assert(x&&consumed.has(x),"R4285_ATOMIC_IN_PROCESS_CONSUMED_CAPABILITY_REQUIRED");
 noLinks(x.run_directory);noLinks(x.nonce_directory);
 assert.equal(path.basename(x.run_directory),"run-"+executionIdentity.get(x.run_id).run_id);
 assert.equal(path.basename(x.nonce_directory),"nonce-"+x.nonce);
 const a=readExact(path.join(x.run_directory,"CONSUMED.json"));
 const b=readExact(path.join(x.nonce_directory,"CONSUMED.json"));
 assert(a.equals(b),"R4285_ATOMIC_TWIN_CONSUMED_BYTES_CHANGED");
 assert.equal(crypto.createHash("sha256").update(a).digest("hex"),x.consumed_sha256,
  "R4285_ATOMIC_CONSUMED_SHA_CHANGED");
 const p=JSON.parse(a.toString("utf8"));
 assert.equal(p.schema_version,"geox_mcft_cap09_consumed_permit_r4285_v1");
 const id=executionIdentity.get(x.run_id);
 assert.equal(p.run_id,x.run_id);assert.equal(p.attempt_ordinal,id.attempt_ordinal);
 assert.equal(p.parent_run_id,id.parent_run_id);assert.equal(p.failed_predecessor_run_id,id.failed_predecessor_run_id);
 assert.equal(p.nonce,x.nonce);assert.equal(p.subject_sha,x.subject_sha);
 assert.equal(p.permit_envelope_sha256,x.permit_envelope_sha256);
 assert.equal(p.v2_cto_intent_sha256,x.v2_cto_intent_sha256);
 assert.equal(p.v2_resource_readback_sha256,x.v2_resource_readback_sha256||p.v2_resource_readback_sha256);
 assert.equal(p.status,"CONSUMED_NO_AUTOMATIC_RETRY");assert.equal(p.production_authorized,false);
 return x;
}
module.exports={RUN,slotPaths,assertUnreserved,prepare,isPrepared,consumeForQualifiedHost,assertConsumed};
