"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto"),cp=require("node:child_process");
const permit=require("../runtime_acceptance/MCFT_CAP09_RETRY_PERMIT_V1.cjs");
const cap=require("../runtime_acceptance/MCFT_CAP09_STAGE_CAPABILITY_V1.cjs");
const {hashFile}=require("../runtime_acceptance/MCFT_CAP09_STAGE_RECEIPTS_V1.cjs");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"mcft-cap-stage-"));
let count=0;
async function main(){
try{
 const {privateKey,publicKey}=crypto.generateKeyPairSync("ed25519"),now=Date.now(),iso=t=>new Date(t).toISOString();
 const payload={schema_version:"geox_mcft_cap09_signed_retry_permit_v1",issuer_id:"test-governance",key_id:"synthetic",
 nonce:"a".repeat(64),run_id:"abc123def456",parent_run_id:"72dc0304a21a",attempt_ordinal:2,
 subject_sha:"b".repeat(40),host_id:"test-host",issued_at:iso(now-2000),expires_at:iso(now+90000),
 arm_sha256:"c".repeat(64),observations_sha256:"d".repeat(64),plan_sha256:"e".repeat(64),
 scope:"ISOLATED_QUALIFICATION_SINGLE_ATTEMPT"};
 const trust={schema_version:"geox_mcft_cap09_retry_trust_v1",adopted:true,execution_enabled:false,
 host_id:"test-host",operator_id:"synthetic-operator",ledger_root:dir,
 issuers:[{issuer_id:"test-governance",key_id:"synthetic",role:"INDEPENDENT_RETRY_GOVERNANCE",revoked:false,
 not_before:iso(now-10000),not_after:iso(now+90000),public_key_pem:publicKey.export({format:"pem",type:"spki"}),
 spki_sha256:permit.sha(publicKey.export({format:"der",type:"spki"}))}]};
 const envelope={payload,signature_base64:crypto.sign(null,Buffer.from(permit.DOMAIN+permit.canonical(payload)),privateKey).toString("base64")};
 const context={host_id:payload.host_id,head:payload.subject_sha,main:payload.subject_sha,clean:true,now:iso(now),
 arm_sha256:payload.arm_sha256,observations_sha256:payload.observations_sha256,plan_sha256:payload.plan_sha256};
 const signed=permit.verifyPermit(envelope,trust,context);
 assert.throws(()=>cap.initializeStageAuthority({run_directory:dir},payload),/CONSUMPTION_REQUIRED/);count++;
 const consumed=permit.consumePermit(signed);
 const authority=cap.initializeStageAuthority(consumed,payload);assert.equal(authority.parent_pid,process.pid);count++;
 assert.throws(()=>cap.initializeStageAuthority(consumed,payload),/EEXIST/);count++;
 const consumer=path.join(dir,"stage-child.cjs");
 const source=`const cap=require(${JSON.stringify(path.resolve(__dirname,"../runtime_acceptance/MCFT_CAP09_STAGE_CAPABILITY_V1.cjs"))});const fs=require('node:fs');const data=JSON.parse(fs.readFileSync(process.argv[2]));try{cap.consumeStageCapability(data);process.exitCode=0}catch(e){process.stderr.write(String(e.code||e.message));process.exitCode=e.code==='EEXIST'?7:9;}`;
 fs.writeFileSync(consumer,source);
 const prev=hashFile(path.join(consumed.run_directory,"CONSUMED.json"));
 const ticket=cap.issueStageCapability(authority,{id:"PRODUCER",script:consumer,previous_sha256:prev});
 count++;
 const req={ticket:ticket.ticket,run_directory:consumed.run_directory,id:"PRODUCER",run_id:payload.run_id,
 nonce:payload.nonce,subject_sha:payload.subject_sha,envelope_sha256:authority.envelope_sha256,
 script:consumer,previous_sha256:prev};
 const input=path.join(dir,"stage-input.json"),write=v=>fs.writeFileSync(input,JSON.stringify(v));
 function spawn(v) {const f=path.join(dir,"case-"+crypto.randomBytes(6).toString("hex")+".json");fs.writeFileSync(f,JSON.stringify(v));
   return new Promise(resolve=>{const sub=cp.spawn(process.execPath,[consumer,f],{stdio:"ignore"});
     sub.once("close",code=>resolve(code));});}
 for(const change of [
  x=>x.run_id="ccc333ddd444",x=>x.nonce="f".repeat(64),x=>x.subject_sha="c".repeat(40),
  x=>x.previous_sha256="f".repeat(64),x=>x.id="TIMING_1",
  x=>x.envelope_sha256="f".repeat(64),x=>x.ticket=path.join(dir,"outside.json"),
  x=>x.script=path.join(dir,"wrong.js")
 ]) {const altered={...req};change(altered);assert.equal(await spawn(altered),9);count++;}
 // Parent issues a single child capability; races are resolved by atomic burn.
 const codes=await Promise.all([spawn(req),spawn(req),spawn(req)]);assert.deepEqual(codes.sort(),[0,7,7]);count++;
 assert.throws(()=>cap.issueStageCapability(authority,{id:"PRODUCER",script:consumer,previous_sha256:prev}),/EEXIST/);count++;
 assert.throws(()=>cap.issueStageCapability(authority,{id:"TIMING_1",script:consumer,previous_sha256:prev}));count++;
 const stageDir=path.join(consumed.run_directory,"PRODUCER");fs.mkdirSync(stageDir);
 const file=path.join(stageDir,"COMPLETED.json");
 fs.writeFileSync(file,JSON.stringify({schema_version:"geox_mcft_cap09_stage_completed_v1",id:"PRODUCER",status:"FAIL"}));
 const producerSha=hashFile(file),t1=cap.issueStageCapability(authority,{id:"TIMING_1",script:consumer,previous_sha256:producerSha});
 const t1req={...req,id:"TIMING_1",ticket:t1.ticket,previous_sha256:producerSha};
 assert.equal(await spawn(t1req),9);count++; // failed prior stage must not be continued
 assert.equal(fs.existsSync(path.join(consumed.run_directory,"SPENT_TIMING_1")),false);count++;
 assert.equal(fs.existsSync(path.join(consumed.run_directory,"STAGE_TICKET_TIMING_2.json")),false);count++;
 assert.equal(JSON.parse(fs.readFileSync(path.resolve(__dirname,"../runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json"))).adopted,false);count++;
 console.log(JSON.stringify({status:"PASS",tests:count,synthetic_only:true,
  duplicate_consumption_blocked:true,parent_signed_permit_consumed:true,
  failed_stage_cannot_continue:true,actual_provider_calls:0,execute_authorized:false}));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
