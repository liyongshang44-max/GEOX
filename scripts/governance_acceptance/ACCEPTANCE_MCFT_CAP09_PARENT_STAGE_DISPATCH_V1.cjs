"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto");
const permit=require("../runtime_acceptance/MCFT_CAP09_RETRY_PERMIT_V1.cjs");
const cap=require("../runtime_acceptance/MCFT_CAP09_STAGE_CAPABILITY_V1.cjs");
const {hashFile}=require("../runtime_acceptance/MCFT_CAP09_STAGE_RECEIPTS_V1.cjs");
const {dispatchConsumedStage}=require("../runtime_acceptance/MCFT_CAP09_PARENT_STAGE_DISPATCH_V1.cjs");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"mcft-stage-chain-"));
let count=0;
async function main(){
try{
 const {privateKey,publicKey}=crypto.generateKeyPairSync("ed25519"),now=Date.now(),iso=t=>new Date(t).toISOString();
 const payload={schema_version:"geox_mcft_cap09_signed_retry_permit_v1",issuer_id:"test-governance",key_id:"synthetic",
 nonce:"a".repeat(64),run_id:"abc123def456",parent_run_id:"72dc0304a21a",attempt_ordinal:2,
 subject_sha:"b".repeat(40),host_id:"test-host",issued_at:iso(now-2000),expires_at:iso(now+90000),
 arm_sha256:"c".repeat(64),observations_sha256:"d".repeat(64),plan_sha256:"e".repeat(64),
 scope:"ISOLATED_QUALIFICATION_SINGLE_ATTEMPT"};
 const trust={schema_version:"geox_mcft_cap09_retry_trust_v1",adopted:true,execution_enabled:false,host_id:"test-host",
 operator_id:"synthetic-operator",ledger_root:dir,issuers:[{issuer_id:"test-governance",key_id:"synthetic",
 role:"INDEPENDENT_RETRY_GOVERNANCE",revoked:false,not_before:iso(now-10000),not_after:iso(now+90000),
 public_key_pem:publicKey.export({format:"pem",type:"spki"}),spki_sha256:permit.sha(publicKey.export({format:"der",type:"spki"}))}]};
 const envelope={payload,signature_base64:crypto.sign(null,Buffer.from(permit.DOMAIN+permit.canonical(payload)),privateKey).toString("base64")};
 const context={host_id:payload.host_id,head:payload.subject_sha,main:payload.subject_sha,clean:true,now:iso(now),
 arm_sha256:payload.arm_sha256,observations_sha256:payload.observations_sha256,plan_sha256:payload.plan_sha256};
 const authority=cap.initializeStageAuthority(permit.consumePermit(permit.verifyPermit(envelope,trust,context)),payload);
 const script=path.join(dir,"child.cjs");
 const source=`const fs=require("node:fs"),path=require("node:path"),cap=require(${JSON.stringify(path.resolve(__dirname,"../runtime_acceptance/MCFT_CAP09_STAGE_CAPABILITY_V1.cjs"))});const e=process.env;cap.consumeStageCapability({ticket:e.MCFT_GOVERNED_RETRY_TICKET,run_directory:e.CAP_DIR,id:e.MCFT_GOVERNED_RETRY_STAGE,run_id:e.CAP_RUN,nonce:e.CAP_NONCE,subject_sha:e.CAP_HEAD,envelope_sha256:e.CAP_ENVELOPE,script:process.argv[1],previous_sha256:e.MCFT_GOVERNED_RETRY_PREVIOUS_RECEIPT_SHA256});if(e.CAP_OUTPUT!=="SKIP")fs.writeFileSync(e.CAP_OUTPUT,JSON.stringify({stage:e.MCFT_GOVERNED_RETRY_STAGE})+"\\n",{flag:"wx"});console.log("CHILD_CLAIMED_ONCE");`;
 fs.writeFileSync(script,source);
 const baseEnv={...process.env,NODE_OPTIONS:"",CAP_DIR:authority.consumed.run_directory,CAP_RUN:payload.run_id,
 CAP_NONCE:payload.nonce,CAP_HEAD:payload.subject_sha,CAP_ENVELOPE:authority.envelope_sha256};
 const base={cwd:dir,script,executable:process.execPath,args:[script],timeout_ms:10000,env:baseEnv};
 const first=await dispatchConsumedStage(authority,{...base,id:"PRODUCER",previous_sha256:hashFile(path.join(authority.consumed.run_directory,"CONSUMED.json")),
  artifact:path.join(dir,"producer.json"),env:{...baseEnv,CAP_OUTPUT:path.join(dir,"producer.json")}});
 assert.equal(first.record.status,"PASS");count++;
 assert.equal(first.record.artifact_present,true);count++;
 assert.equal(first.record.claim_present,true);count++;
 assert.equal(first.record.claim_valid,true);count++;
 assert.equal(first.record.claim_sha256,hashFile(path.join(authority.consumed.run_directory,"SPENT_PRODUCER","CLAIMED.json")));count++;
 assert.equal(first.record.artifact_sha256,hashFile(path.join(dir,"producer.json")));count++;
 assert.equal(first.record.stdout_sha256,hashFile(path.join(first.directory,"stdout.log")));count++;
 assert.equal(first.record.previous_sha256,hashFile(path.join(authority.consumed.run_directory,"CONSUMED.json")));count++;
 await assert.rejects(dispatchConsumedStage(authority,{...base,id:"PRODUCER",previous_sha256:first.record.previous_sha256,
  artifact:path.join(dir,"repeat.json")}),/EEXIST/);count++;
 const second=await dispatchConsumedStage(authority,{...base,id:"TIMING_1",previous_sha256:first.sha256,
  artifact:path.join(dir,"timing1.json"),env:{...baseEnv,CAP_OUTPUT:path.join(dir,"timing1.json")}});
 assert.equal(second.record.previous_sha256,first.sha256);count++;
 assert.equal(second.record.artifact_sha256,hashFile(path.join(dir,"timing1.json")));count++;
 assert.equal(second.record.claim_valid,true);count++;
 let failed;
 try{await dispatchConsumedStage(authority,{...base,id:"TIMING_2",previous_sha256:second.sha256,
  artifact:path.join(dir,"timing2.json"),env:{...baseEnv,CAP_OUTPUT:"SKIP"}});assert.fail("EXPECTED_FAILURE");}
 catch(e){assert.match(e.message,/STAGE_FAILED_NO_AUTOMATIC_RETRY/);failed=e.receipt;count++;}
 assert.equal(failed.record.status,"FAIL");count++;
 assert.equal(failed.record.artifact_present,false);count++;
 assert.equal(failed.record.claim_valid,true);count++;
 assert.equal(failed.record.previous_sha256,second.sha256);count++;
 assert.throws(()=>cap.issueStageCapability(authority,{id:"TIMING_3",script,previous_sha256:failed.sha256}),/PREVIOUS_STAGE_FAILED/);count++;
 assert.equal(fs.existsSync(path.join(authority.consumed.run_directory,"STAGE_TICKET_TIMING_3.json")),false);count++;
 assert.throws(()=>permit.consumePermit(permit.verifyPermit(envelope,trust,context)),/EEXIST/);count++;
 // A child can write an output and return success but is never qualified
 // unless the atomic parent-bound ticket was actually consumed.
 const {runRecordedStage}=require("../runtime_acceptance/MCFT_CAP09_STAGE_RECEIPTS_V1.cjs");
 const fakeRoot=path.join(dir,"fake-stage-records");fs.mkdirSync(fakeRoot);
 const fakeOutput=path.join(dir,"fake-output.json");
 let bypass;
 try{
  await runRecordedStage({directory:fakeRoot,cwd:dir,executable:process.execPath,
   args:["-e","require('node:fs').writeFileSync("+JSON.stringify(fakeOutput)+",'fake\\n')"],
   id:"UNCLAIMED",timeout_ms:5000,previous_sha256:"f".repeat(64),
   expected_artifact:fakeOutput,
   expected_claim:{file:path.join(dir,"missing-claim.json"),id:"UNCLAIMED",
    run_id:payload.run_id,nonce:payload.nonce,ticket_sha256:"e".repeat(64)}});
  assert.fail("UNCLAIMED_CHILD_WRONGLY_ACCEPTED");
 }catch(e){assert.match(e.message,/STAGE_FAILED_NO_AUTOMATIC_RETRY/);bypass=e.receipt;}
 assert.equal(bypass.record.exit_code,0);count++;
 assert.equal(bypass.record.artifact_present,true);count++;
 assert.equal(bypass.record.claim_valid,false);count++;
 assert.equal(bypass.record.status,"FAIL");count++;
 console.log(JSON.stringify({status:"PASS",tests:count,synthetic_only:true,
  parent_and_child_real_process_execution:true,provider_calls:0,
  stage_artifact_hashes_chained:true,duplicate_stage_and_run_burned:true,
  continuation_after_failure_blocked:true,qualification_pass:false,execute_authorized:false}));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
