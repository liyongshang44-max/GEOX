"use strict";
/**
 * Parent-issued, child-consumed, one-stage-only host capabilities.
 * A capability is NOT a governance signature and cannot grant an ARM.
 * Only a previously atomically consumed, independently signed permit can
 * initialize the capability root. Stage activation remains separately gated.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const permits=require("./MCFT_CAP09_RETRY_PERMIT_V1.cjs");
const {hashFile}=require("./MCFT_CAP09_STAGE_RECEIPTS_V1.cjs");
const STAGES=Object.freeze(["PRODUCER","TIMING_1","TIMING_2","TIMING_3","AGGREGATE","CONTROLLED_DELAY"]);
const HEX40=/^[a-f0-9]{40}$/,HEX64=/^[a-f0-9]{64}$/,RUN=/^[a-f0-9]{12}$/;
const sha=permits.sha;
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
function initializeStageAuthority(consumed,permitPayload) {
 permits.assertConsumed(consumed);
 assert(RUN.test(permitPayload.run_id)&&HEX64.test(permitPayload.nonce),"CAP_PERMIT_ID_REQUIRED");
 const receipt=JSON.parse(fs.readFileSync(path.join(consumed.run_directory,"CONSUMED.json"),"utf8"));
 assert.equal(receipt.payload.run_id,permitPayload.run_id,"CAP_RUN_MISMATCH");
 assert.equal(receipt.payload.nonce,permitPayload.nonce,"CAP_NONCE_MISMATCH");
 assert.equal(receipt.status,"CONSUMED_NO_AUTOMATIC_RETRY","CAP_CONSUMPTION_STATUS_INVALID");
 assert.equal(path.basename(consumed.run_directory),"run-"+permitPayload.run_id,"CAP_RUN_DIRECTORY_MISMATCH");
 directoryNoLink(consumed.run_directory);
 const key=crypto.randomBytes(32);
 writeOnce(path.join(consumed.run_directory,"STAGE_KEY.bin"),key);
 return Object.freeze({consumed,run_id:permitPayload.run_id,nonce:permitPayload.nonce,
   subject_sha:permitPayload.subject_sha,envelope_sha256:receipt.envelope_sha256,
   parent_pid:process.pid,expires_at:permitPayload.expires_at});
}
function issueStageCapability(authority,{id,script,previous_sha256}) {
 permits.assertConsumed(authority.consumed);
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
 const payload={schema_version:"geox_mcft_cap09_host_stage_capability_v1",id,
   ordinal:prior,run_id:authority.run_id,nonce:authority.nonce,
   subject_sha:authority.subject_sha,envelope_sha256:authority.envelope_sha256,
   parent_pid:authority.parent_pid,script_sha256:hashFile(script),previous_sha256,
   issued_at:new Date(issued).toISOString(),expires_at:new Date(until).toISOString()};
 const keyPath=path.join(base,"STAGE_KEY.bin");fileRegular(keyPath);
 const signature=crypto.createHmac("sha256",fs.readFileSync(keyPath)).update(permits.canonical(payload)).digest("hex");
 const ticket=path.join(base,"STAGE_TICKET_"+id+".json");
 writeOnce(ticket,Buffer.from(JSON.stringify({payload,hmac_sha256:signature},null,2)+"\n"));
 return Object.freeze({ticket,id,previous_sha256});
}
function consumeStageCapability({ticket,run_directory,id,run_id,nonce,subject_sha,envelope_sha256,script,previous_sha256}) {
 assert(STAGES.includes(id),"CAP_UNKNOWN_STAGE");
 assert(path.isAbsolute(run_directory),"CAP_RUN_DIRECTORY_REQUIRED");
 directoryNoLink(run_directory);
 assert.equal(path.resolve(ticket),path.join(run_directory,"STAGE_TICKET_"+id+".json"),"CAP_TICKET_PATH_MISMATCH");
 fileRegular(ticket);
 const envelope=JSON.parse(fs.readFileSync(ticket,"utf8"));
 assert.deepEqual(Object.keys(envelope).sort(),["hmac_sha256","payload"].sort(),"CAP_TICKET_FIELDS_INVALID");
 const p=envelope.payload;
 assert.deepEqual(Object.keys(p).sort(),["schema_version","id","ordinal","run_id","nonce","subject_sha","envelope_sha256","parent_pid","script_sha256","previous_sha256","issued_at","expires_at"].sort(),"CAP_FIELDS_INVALID");
 assert.equal(p.schema_version,"geox_mcft_cap09_host_stage_capability_v1");
 assert.equal(p.id,id,"CAP_STAGE_MISMATCH");
 assert.equal(p.ordinal,STAGES.indexOf(id),"CAP_STAGE_ORDINAL_MISMATCH");
 for(const [k,value] of Object.entries({run_id,nonce,subject_sha,envelope_sha256,previous_sha256}))
  assert.equal(p[k],value,"CAP_BINDING_MISMATCH:"+k);
 assert.equal(p.parent_pid,process.ppid,"CAP_PARENT_PROCESS_REQUIRED");
 assert(path.isAbsolute(script),"CAP_ABSOLUTE_SCRIPT_REQUIRED");
 assert.equal(p.script_sha256,hashFile(script),"CAP_EXECUTABLE_HASH_CHANGED");
 const now=Date.now(),begin=Date.parse(p.issued_at),end=Date.parse(p.expires_at);
 assert(Number.isFinite(begin)&&Number.isFinite(end)&&begin<=now&&now<end&&end-begin<=120000,"CAP_STAGE_EXPIRED");
 const key=path.join(run_directory,"STAGE_KEY.bin");fileRegular(key);
 const mac=crypto.createHmac("sha256",fs.readFileSync(key)).update(permits.canonical(p)).digest();
 assert(HEX64.test(envelope.hmac_sha256),"CAP_SIGNATURE_FORMAT");
 assert(crypto.timingSafeEqual(mac,Buffer.from(envelope.hmac_sha256,"hex")),"CAP_BAD_HMAC");
 const consumedReceipt=path.join(run_directory,"CONSUMED.json");fileRegular(consumedReceipt);
 const receipt=JSON.parse(fs.readFileSync(consumedReceipt,"utf8"));
 assert.equal(receipt.payload.run_id,run_id,"CAP_CONSUMED_RUN_MISMATCH");
 assert.equal(receipt.payload.nonce,nonce,"CAP_CONSUMED_NONCE_MISMATCH");
 assert.equal(receipt.envelope_sha256,envelope_sha256,"CAP_CONSUMED_PERMIT_MISMATCH");
 assert.equal(receipt.status,"CONSUMED_NO_AUTOMATIC_RETRY","CAP_CONSUMED_STATUS_REQUIRED");
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
 const spent=path.join(run_directory,"SPENT_"+id);
 fs.mkdirSync(spent,{mode:0o700});
 writeOnce(path.join(spent,"CLAIMED.json"),Buffer.from(JSON.stringify({
  schema_version:"geox_mcft_cap09_child_stage_claim_v1",id,run_id,nonce,
  ticket_sha256:hashFile(ticket),claimed_at:new Date().toISOString(),parent_pid:p.parent_pid
 },null,2)+"\n"));
 return Object.freeze({status:"STAGE_CAPABILITY_CONSUMED_NO_RETRY",run_id,id,previous_sha256,
   claim_file:path.join(spent,"CLAIMED.json")});
}
module.exports={STAGES,initializeStageAuthority,issueStageCapability,consumeStageCapability};
