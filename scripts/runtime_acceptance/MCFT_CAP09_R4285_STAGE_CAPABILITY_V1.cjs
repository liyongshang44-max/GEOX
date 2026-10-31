"use strict";
/**
 * Parent-issued, child-consumed, one-stage-only host capabilities.
 * A capability is NOT a governance signature and cannot grant an ARM.
 * Only a previously atomically consumed, independently signed permit can
 * initialize the capability root. Stage activation remains separately gated.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const permits=require("./MCFT_CAP09_R4285_PERMIT_ATOMIC_V1.cjs");
const canonical=require("../governance_acceptance/MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1.cjs").canonical;
const STAGE_DOMAIN="GEOX_MCFT_CAP09_HOST_STAGE_R4285_V1\n";
const privateStageKeys=new WeakMap();
const {hashFile}=require("./MCFT_CAP09_R4285_STAGE_RECEIPTS_V1.cjs");
// V2 parent/child separation: never imports or consumes a legacy V1 Permit.
const STAGES=Object.freeze(["PRODUCER","TIMING_1","TIMING_2","TIMING_3","CONTROLLED_DELAY","AGGREGATE"]);
const HEX40=/^[a-f0-9]{40}$/,HEX64=/^[a-f0-9]{64}$/,RUN=/^[a-f0-9]{12}$/;
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
function fileRegular(file) {
 const s=fs.lstatSync(file);
 assert(s.isFile()&&!s.isSymbolicLink(),"CAP_REGULAR_FILE_REQUIRED");
}
function directoryNoLink(dir) {
 assert(path.isAbsolute(dir),"CAP_ABSOLUTE_DIRECTORY_REQUIRED");
 let cursor=path.resolve(dir);
 while(true) {
  const s=fs.lstatSync(cursor);
  assert(s.isDirectory()&&!s.isSymbolicLink(),"CAP_DIRECTORY_LINK_FORBIDDEN");
  const parent=path.dirname(cursor);if(parent===cursor)break;cursor=parent;
 }
}
function writeOnce(file,bytes) {
 const fd=fs.openSync(file,"wx",0o600);
 try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function initializeStageAuthority(consumed,permitPayload,expectedEnvelopeSha) {
 permits.assertConsumed(consumed);
 assert(RUN.test(permitPayload.run_id)&&HEX64.test(permitPayload.nonce),"CAP_PERMIT_ID_REQUIRED");
 const receipt=JSON.parse(fs.readFileSync(path.join(consumed.run_directory,"CONSUMED.json"),"utf8"));
 assert.equal(receipt.schema_version,"geox_mcft_cap09_consumed_permit_r4285_v1","CAP_R4285_CONSUMPTION_SCHEMA_REQUIRED");
 assert.equal(receipt.subject_sha,permitPayload.subject_sha,"CAP_R4285_SUBJECT_CHANGED");
 assert.equal(receipt.run_id,permitPayload.run_id,"CAP_RUN_MISMATCH");
 assert.equal(receipt.nonce,permitPayload.nonce,"CAP_NONCE_MISMATCH");
 assert.equal(receipt.status,"CONSUMED_NO_AUTOMATIC_RETRY","CAP_CONSUMPTION_STATUS_INVALID");
 assert(HEX64.test(expectedEnvelopeSha),"CAP_R4285_EXPECTED_ENVELOPE_SHA_REQUIRED");
 assert.equal(receipt.permit_envelope_sha256,expectedEnvelopeSha,"CAP_R4285_CONSUMPTION_IDENTITY");
 assert.equal(path.basename(consumed.run_directory),"run-"+permitPayload.run_id,"CAP_RUN_DIRECTORY_MISMATCH");
 directoryNoLink(consumed.run_directory);
 // Store only the child-verifiable public key; keep private signing
 // capability exclusively in the parent process memory.
 const {privateKey,publicKey}=crypto.generateKeyPairSync("ed25519");
 writeOnce(path.join(consumed.run_directory,"STAGE_R4285_PUBLIC_KEY.pem"),
   Buffer.from(publicKey.export({type:"spki",format:"pem"})));
 const authority=Object.freeze({consumed,run_id:permitPayload.run_id,nonce:permitPayload.nonce,
   subject_sha:permitPayload.subject_sha,envelope_sha256:receipt.permit_envelope_sha256,
   parent_pid:process.pid,expires_at:permitPayload.expires_at});
 privateStageKeys.set(authority,privateKey);
 return authority;
}
function issueStageCapability(authority,{id,script,previous_sha256}) {
 permits.assertConsumed(authority.consumed);
 const signingKey=privateStageKeys.get(authority);
 assert(signingKey&&signingKey.asymmetricKeyType==="ed25519","CAP_PARENT_PRIVATE_KEY_REQUIRED");
 assert(STAGES.includes(id),"CAP_UNKNOWN_STAGE");
 assert(HEX64.test(previous_sha256),"CAP_PREVIOUS_RECEIPT_REQUIRED");
 assert(path.isAbsolute(script),"CAP_ABSOLUTE_SCRIPT_REQUIRED");
 fileRegular(script);
 const base=authority.consumed.run_directory;
 directoryNoLink(base);
 const prior=STAGES.indexOf(id);
 const source=prior===0?path.join(base,"CONSUMED.json"):path.join(base,STAGES[prior-1],"COMPLETED.json");
 fileRegular(source);
 assert.equal(hashFile(source),previous_sha256,"CAP_CHAIN_BROKEN");
 if(prior>0){const priorRecord=JSON.parse(fs.readFileSync(source,"utf8"));
  assert.equal(priorRecord.id,STAGES[prior-1],"CAP_PREVIOUS_STAGE_WRONG");
  assert.equal(priorRecord.status,"PASS","CAP_PREVIOUS_STAGE_FAILED");
 }
 const issued=Date.now();
 const until=Math.min(issued+120000,Date.parse(authority.expires_at));
 assert(issued<until,"CAP_PERMIT_EXPIRED");
 const payload={schema_version:"geox_mcft_cap09_host_stage_capability_r4285_v1",id,
   ordinal:prior,run_id:authority.run_id,nonce:authority.nonce,
   subject_sha:authority.subject_sha,envelope_sha256:authority.envelope_sha256,
   parent_pid:authority.parent_pid,script_sha256:hashFile(script),previous_sha256,
   issued_at:new Date(issued).toISOString(),expires_at:new Date(until).toISOString()};
 const publicKeyFile=path.join(base,"STAGE_R4285_PUBLIC_KEY.pem");fileRegular(publicKeyFile);
 const publicKey=crypto.createPublicKey(fs.readFileSync(publicKeyFile));
 assert.equal(publicKey.asymmetricKeyType,"ed25519","CAP_ED25519_REQUIRED");
 assert.equal(crypto.createPublicKey(signingKey).export({type:"spki",format:"pem"}).toString(),
  publicKey.export({type:"spki",format:"pem"}).toString(),"CAP_PUBLIC_KEY_CHANGED");
 const signature=crypto.sign(null,Buffer.from(STAGE_DOMAIN+canonical(payload)),signingKey).toString("base64");
 const ticket=path.join(base,"STAGE_TICKET_R4285_"+id+".json");
 writeOnce(ticket,Buffer.from(JSON.stringify({payload,signature_base64:signature},null,2)+"\n"));
 return Object.freeze({ticket,id,previous_sha256});
}
function consumeStageCapability({ticket,run_directory,id,run_id,nonce,subject_sha,envelope_sha256,script,previous_sha256}) {
 assert(STAGES.includes(id),"CAP_UNKNOWN_STAGE");
 assert(path.isAbsolute(run_directory),"CAP_RUN_DIRECTORY_REQUIRED");
 directoryNoLink(run_directory);
 assert.equal(path.resolve(ticket),path.join(run_directory,"STAGE_TICKET_R4285_"+id+".json"),"CAP_TICKET_PATH_MISMATCH");
 fileRegular(ticket);
 const envelope=JSON.parse(fs.readFileSync(ticket,"utf8"));
 assert.deepEqual(Object.keys(envelope).sort(),["signature_base64","payload"].sort(),"CAP_TICKET_FIELDS_INVALID");
 const p=envelope.payload;
 assert.deepEqual(Object.keys(p).sort(),["schema_version","id","ordinal","run_id","nonce","subject_sha","envelope_sha256","parent_pid","script_sha256","previous_sha256","issued_at","expires_at"].sort(),"CAP_FIELDS_INVALID");
 assert.equal(p.schema_version,"geox_mcft_cap09_host_stage_capability_r4285_v1");
 assert.equal(p.id,id,"CAP_STAGE_MISMATCH");
 assert.equal(p.ordinal,STAGES.indexOf(id),"CAP_STAGE_ORDINAL_MISMATCH");
 for(const [k,value] of Object.entries({run_id,nonce,subject_sha,envelope_sha256,previous_sha256}))
  assert.equal(p[k],value,"CAP_BINDING_MISMATCH:"+k);
 assert.equal(p.parent_pid,process.ppid,"CAP_PARENT_PROCESS_REQUIRED");
 assert(path.isAbsolute(script),"CAP_ABSOLUTE_SCRIPT_REQUIRED");
 assert.equal(p.script_sha256,hashFile(script),"CAP_EXECUTABLE_HASH_CHANGED");
 const now=Date.now(),begin=Date.parse(p.issued_at),end=Date.parse(p.expires_at);
 assert(Number.isFinite(begin)&&Number.isFinite(end)&&begin<=now&&now<end&&end-begin<=120000,"CAP_STAGE_EXPIRED");
 const publicKeyFile=path.join(run_directory,"STAGE_R4285_PUBLIC_KEY.pem");fileRegular(publicKeyFile);
 const publicKey=crypto.createPublicKey(fs.readFileSync(publicKeyFile));
 assert.equal(publicKey.asymmetricKeyType,"ed25519","CAP_ED25519_REQUIRED");
 assert(typeof envelope.signature_base64==="string","CAP_SIGNATURE_FORMAT");
 const signature=Buffer.from(envelope.signature_base64,"base64");
 assert(signature.length===64&&signature.toString("base64")===envelope.signature_base64,"CAP_SIGNATURE_FORMAT");
 assert(crypto.verify(null,Buffer.from(STAGE_DOMAIN+canonical(p)),publicKey,signature),"CAP_BAD_SIGNATURE");
 const consumedReceipt=path.join(run_directory,"CONSUMED.json");fileRegular(consumedReceipt);
 const receipt=JSON.parse(fs.readFileSync(consumedReceipt,"utf8"));
 assert.equal(receipt.run_id,run_id,"CAP_CONSUMED_RUN_MISMATCH");
 assert.equal(receipt.nonce,nonce,"CAP_CONSUMED_NONCE_MISMATCH");
 assert.equal(receipt.permit_envelope_sha256,envelope_sha256,"CAP_CONSUMED_PERMIT_MISMATCH");
 assert.equal(receipt.status,"CONSUMED_NO_AUTOMATIC_RETRY","CAP_CONSUMED_STATUS_REQUIRED");
 assert.equal(receipt.schema_version,"geox_mcft_cap09_consumed_permit_r4285_v1","CAP_R4285_NOT_ATOMIC_PERMIT");
 assert.equal(receipt.subject_sha,subject_sha,"CAP_R4285_SUBJECT_CHANGED");
 const index=STAGES.indexOf(id);
 const source=index===0?consumedReceipt:path.join(run_directory,STAGES[index-1],"COMPLETED.json");
 fileRegular(source);
 assert.equal(hashFile(source),previous_sha256,"CAP_PREVIOUS_RECEIPT_CHANGED");
 if(index>0){
  const previous=JSON.parse(fs.readFileSync(source,"utf8"));
  assert.equal(previous.id,STAGES[index-1],"CAP_PREVIOUS_STAGE_WRONG");
  assert.equal(previous.status,"PASS","CAP_PREVIOUS_STAGE_FAILED");
 }
 // Atomic, durable burn BEFORE any Producer/DB/output effects, fail closed on
 // duplicate, interrupted writes or a parallel child racing with the same stage.
 const spent=path.join(run_directory,"SPENT_R4285_"+id);
 fs.mkdirSync(spent,{mode:0o700});
 writeOnce(path.join(spent,"CLAIMED.json"),Buffer.from(JSON.stringify({
  schema_version:"geox_mcft_cap09_child_stage_claim_r4285_v1",id,run_id,nonce,
  ticket_sha256:hashFile(ticket),claimed_at:new Date().toISOString(),parent_pid:p.parent_pid
 },null,2)+"\n"));
 return Object.freeze({status:"STAGE_CAPABILITY_CONSUMED_NO_RETRY",run_id,id,previous_sha256,
   claim_file:path.join(spent,"CLAIMED.json")});
}
module.exports={STAGES,initializeStageAuthority,issueStageCapability,consumeStageCapability};
