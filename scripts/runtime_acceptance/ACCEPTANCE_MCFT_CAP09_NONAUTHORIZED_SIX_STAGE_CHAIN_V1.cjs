"use strict";
// Test-only SIX-STAGE RECEIPT/ORDER/FAIL-CLOSED *SEAM* simulation.
// This is NOT real Producer/Timing/Delay/Aggregate stage execution and
// is NEVER eligible to substitute for a full non-authorized host rehearsal.
// No Permit API, stage-capability API, Provider, production IAM, or DA9 resource.
const assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const crypto=require("node:crypto"),cp=require("node:child_process");
const scheduler=require("./MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs");
const receipts=require("./MCFT_CAP09_STAGE_RECEIPTS_V1.cjs");
const RUN="abcdef012345";
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
function read(f){return JSON.parse(fs.readFileSync(f,"utf8"));}
function writeOnce(f,o){fs.writeFileSync(f,JSON.stringify(o,null,2)+"\n",{flag:"wx",mode:0o600});}
function child(){
 const id=process.env.CAP09_SIX_STAGE_FIXTURE_ID;
 assert(scheduler.STAGES.includes(id),"FIXTURE_STAGE_UNRECOGNIZED");
 assert.equal(process.env.CAP09_NONAUTHORIZED_STAGE_SIMULATION,"1");
 assert.equal(process.env.MCFT_GOVERNED_RETRY_STAGE,undefined,"REAL_STAGE_ENV_FORBIDDEN");
 assert.equal(process.env.MCFT_GOVERNED_RETRY_TICKET,undefined,"REAL_TICKET_ENV_FORBIDDEN");
 const root=process.env.CAP09_SIX_STAGE_FIXTURE_ROOT;
 const out=process.env.CAP09_SIX_STAGE_FIXTURE_ARTIFACT;
 assert(path.isAbsolute(root)&&path.resolve(out).startsWith(path.resolve(root)+path.sep));
 const predecessor=scheduler.STAGES[scheduler.STAGES.indexOf(id)-1];
 if(predecessor){
  const prior=read(path.join(root,predecessor+".json"));
  assert.equal(prior.status,"PASS");assert.equal(prior.stage,predecessor);
  assert.equal(prior.subject_sha,process.env.CAP09_SIX_STAGE_FIXTURE_SUBJECT);
  assert.equal(prior.stage_receipt_chain_simulation_only,true);
 }
 const claimPath=process.env.CAP09_SIX_STAGE_FIXTURE_CLAIM;
 const claim={schema_version:"geox_mcft_cap09_child_stage_claim_v1",id,
  run_id:RUN,nonce:"f".repeat(64),
  ticket_sha256:process.env.CAP09_SIX_STAGE_FIXTURE_TICKET_SHA,
  parent_pid:process.ppid,synthetic_not_real_authority:true};
 writeOnce(claimPath,claim);
 const observed=read(process.env.CAP09_SIX_STAGE_PHYSICAL_RECEIPT);
 assert.equal(observed.status,"PASS");
 assert.equal(observed.actual_isolated_composer_exercised,true);
 assert.equal(observed.production_authorized,false);
 assert.equal(observed.permit_consumed,false);
 assert.equal(observed.real_postgres_formal_fact_present_count,3);
 assert.equal(observed.post_commit_physical_readback_verified,true);
 const payload={
  schema_version:"geox_mcft_cap09_non_authorized_six_stage_seam_fixture_v1",
  status:"PASS",stage:id,subject_sha:observed.subject_sha,
  actual_physical_s3_pg_receipt_sha256:sha(fs.readFileSync(process.env.CAP09_SIX_STAGE_PHYSICAL_RECEIPT)),
  stage_receipt_chain_simulation_only:true,
  six_actual_production_stage_bodies_executed:false,
  permit_signed:false,permit_consumed:false,production_authorized:false,
 };
 if(id==="CONTROLLED_DELAY"){
  payload.physical_delay_cases_executed=true;
  payload.provider_pipeline_injected=false;
  payload.retained_qualification_database_touched=false;
  payload.controlled_wait_mode="NONAUTHORIZED_SCRATCH_CLOCK_ONLY";
  const delays=[];
  for(let i=0;i<6;i++){
   const a=process.hrtime.bigint(),end=Date.now()+2;
   while(Date.now()<end){} // bounded < 3ms per fixture; actual monotonic read
   const ms=Number((process.hrtime.bigint()-a)/1000000n);
   delays.push({ordinal:i+1,measured_elapsed_ms:ms});
  }
  payload.scratch_wait_cases=delays;
 }
 writeOnce(out,payload);
 if(id===process.env.CAP09_SIX_STAGE_INJECT_FAILURE){
  console.error("INTENTIONAL_SYNTHETIC_STAGE_FAILURE:"+id);
  process.exitCode=23;
 }
}
function plan(){return {schema_version:"geox_mcft_cap09_retry_stage_plan_v2",
 stages:scheduler.STAGES.map(id=>({id,timeout_ms:10000}))};}
async function scenario(physicalFile,{failedAt=null}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"cap09-nonauth-six-stage-"));
 const output=path.join(root,"stage-output");fs.mkdirSync(output);
 const ledger=path.join(root,"synthetic-ledger");fs.mkdirSync(ledger);
 const marker={status:"NONAUTHORIZED_SYNTHETIC_STAGE_CHAIN_MARKER_NOT_PERMIT",
  test_run_id:RUN,not_signed:true,production_authorized:false};
 writeOnce(path.join(ledger,"CONSUMED.json"),marker);
 const subject=read(physicalFile).subject_sha;
 const observedStages=[];
 const steps=scheduler.STAGES.map(id=>({
  id,script:__filename,artifact:path.join(output,id+".json"),cwd:root,
  executable:process.execPath,args:[__filename,"--fixture-child"],env:{}
 }));
 const fakeAuthority=Object.freeze({
  synthetic_only:true,
  consumed:Object.freeze({run_directory:ledger,not_actual_permit:true})
 });
 const assertSynthetic=x=>{
  assert.strictEqual(x,fakeAuthority.consumed);
  assert.equal(x.not_actual_permit,true);
  assert.equal(read(path.join(ledger,"CONSUMED.json")).status,
   "NONAUTHORIZED_SYNTHETIC_STAGE_CHAIN_MARKER_NOT_PERMIT");
 };
 const dispatch=async(authority,step)=>{
  assert.strictEqual(authority,fakeAuthority);
  const id=step.id;
  observedStages.push(id);
  const ticket=path.join(ledger,"SIMULATED_TICKET_"+id+".json");
  writeOnce(ticket,{simulation_only:true,id,run_id:RUN});
  const ticketHash=receipts.hashFile(ticket);
  const claim=path.join(ledger,"SPENT_"+id,"CLAIMED.json");
  fs.mkdirSync(path.dirname(claim));
  const env={
   PATH:process.env.PATH||"",SystemRoot:process.env.SystemRoot||"",
   CAP09_NONAUTHORIZED_STAGE_SIMULATION:"1",
   CAP09_SIX_STAGE_FIXTURE_ID:id,
   CAP09_SIX_STAGE_FIXTURE_ROOT:output,
   CAP09_SIX_STAGE_FIXTURE_ARTIFACT:step.artifact,
   CAP09_SIX_STAGE_FIXTURE_CLAIM:claim,
   CAP09_SIX_STAGE_FIXTURE_TICKET_SHA:ticketHash,
   CAP09_SIX_STAGE_FIXTURE_SUBJECT:subject,
   CAP09_SIX_STAGE_PHYSICAL_RECEIPT:physicalFile,
   CAP09_SIX_STAGE_INJECT_FAILURE:failedAt||"",
  };
  return receipts.runRecordedStage({
   id,directory:ledger,cwd:root,executable:step.executable,args:step.args,
   timeout_ms:step.timeout_ms,previous_sha256:step.previous_sha256,
   expected_artifact:step.artifact,
   expected_claim:{file:claim,id,run_id:RUN,nonce:"f".repeat(64),ticket_sha256:ticketHash},
   env,
  });
 };
 try{
  let report,error;
  try{report=await scheduler.executeSixStages({
   authority:fakeAuthority,plan:plan(),steps,dispatch,assertConsumed:assertSynthetic,
  });}catch(e){error=e;}
  if(failedAt===null){
   if(error)throw error;
   assert.equal(report.stage_count,6);
   assert.equal(report.status,"SIX_STAGE_EVIDENCE_SEALED_NOT_AUTHORITY");
   assert.equal(report.qualified,false);
   assert.deepEqual(observedStages,scheduler.STAGES);
   for(const id of scheduler.STAGES){
    const r=read(path.join(ledger,id,"COMPLETED.json"));
    assert.equal(r.status,"PASS");assert.equal(r.claim_valid,true);
    assert.equal(r.artifact_present,true);
   }
   assert.equal(read(path.join(ledger,"SIX_STAGE_AUDIT.json")).formal_v5_arm,false);
  }else{
   assert(error&&String(error.message).includes("STAGE_FAILED_NO_AUTOMATIC_RETRY:"+failedAt),
    "INJECTED_STAGE_MUST_FAIL_CLOSED:"+failedAt);
   assert.deepEqual(observedStages,scheduler.STAGES.slice(0,scheduler.STAGES.indexOf(failedAt)+1));
   assert(!fs.existsSync(path.join(ledger,"SIX_STAGE_AUDIT.json")),
    "FAILED_CHAIN_MUST_NOT_SEAL_AUDIT");
   for(const later of scheduler.STAGES.slice(scheduler.STAGES.indexOf(failedAt)+1)){
    assert(!fs.existsSync(path.join(ledger,later)),"LATER_STAGE_MUST_NOT_START:"+later);
   }
  }
  return {failed_at:failedAt,stages_launched:observedStages.length,
   stopped_on_failure:failedAt!==null};
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
async function main(){
 assert.equal(process.env.MCFT_CAP09_ADOPTION_REQUEST,undefined);
 assert.equal(process.env.MCFT_GOVERNED_RETRY_STAGE,undefined);
 assert.equal(process.env.MCFT_GOVERNED_RETRY_TICKET,undefined);
 const file=process.argv[2];
 assert(path.isAbsolute(file),"TEST_ONLY_PHYSICAL_RECEIPT_ABSOLUTE_FILE_REQUIRED");
 const r=read(file);
 assert.equal(r.status,"PASS");
 assert.equal(r.authorization,"NON_AUTHORIZED_ISOLATED_ENGINEERING_TEST_ONLY");
 assert.equal(r.actual_isolated_composer_exercised,true);
 const cases=[await scenario(file)];
 for(const failedAt of scheduler.STAGES)cases.push(await scenario(file,{failedAt}));
 console.log(JSON.stringify({schema_version:"geox_mcft_cap09_nonauthorized_six_stage_receipt_chain_seam_acceptance_v1",
  status:"PASS",cases,real_s3_pg_receipt_sha256:sha(fs.readFileSync(file)),
  original_stage_bodies_executed:false,simulated_ledger_only:true,
  real_permit_issued:false,real_permit_consumed:false,
  execution_authorized:false,production_authorized:false,
  note:"Scheduler and stage-sealing contract simulation; actual non-authorized six-stage Windows rehearsal still REQUIRED."
 }));
}
if(process.argv[2]==="--fixture-child"){try{child()}catch(e){console.error(String(e.stack||e));process.exitCode=1;}}
else main().catch(e=>{console.error("NONAUTHORIZED_STAGE_SEAM_FAIL:"+String(e.stack||e));process.exitCode=1;});
