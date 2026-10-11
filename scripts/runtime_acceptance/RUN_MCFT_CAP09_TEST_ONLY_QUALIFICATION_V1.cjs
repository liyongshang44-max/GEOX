#!/usr/bin/env node
"use strict";
// Separate owner-approved NONPRODUCTION TEST_ONLY entry.
// It never consumes or mutates production retry trust/permits.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const binding=require("./MCFT_CAP09_TEST_ONLY_BINDING_V1.cjs");

function parseArgs(args){
  assert(args.includes("--operator-authorized")&&args.includes("--test-only"),
    "TEST_ONLY_EXPLICIT_OPERATOR_AND_MODE_REQUIRED");
  assert(args.includes("--execute")!==args.includes("--preflight-only"),
    "TEST_ONLY_SELECT_ONE_EXECUTION_MODE");
  assert(args.includes("--producer"),"TEST_ONLY_PRODUCER_TASK_REQUIRED");
  assert(args.every(x=>["--operator-authorized","--test-only","--execute","--preflight-only","--producer"].includes(x)),
    "TEST_ONLY_UNKNOWN_ARGUMENT");
  assert.equal(new Set(args).size,args.length,"TEST_ONLY_DUPLICATE_ARGUMENT");
  return {execute:args.includes("--execute"),task:"--producer"};
}
function scientificSelftest(){
  const r=cp.spawnSync(process.env.MCFT_PYTHON_EXECUTABLE||"python",[
    path.join(binding.ROOT,"apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_scientific_core_v1.py"),"selftest"
  ],{cwd:binding.ROOT,stdio:"inherit",timeout:60000,windowsHide:true});
  assert.equal(r.status,0,"TEST_ONLY_SCIENTIFIC_SELFTEST_REQUIRED");
}
function runProducer(env){
  const file=path.join("scripts","runtime_acceptance","RUN_MCFT_CAP09_TEST_ONLY_PRODUCER_C1F7DCC6D04D_V1.ts");
  const r=cp.spawnSync(process.execPath,["--import","tsx",file],{
    cwd:binding.ROOT,env,stdio:"inherit",windowsHide:true
  });
  assert.equal(r.status,0,"TEST_ONLY_PRODUCER_CHILD_FAILED");
}
async function main(args=process.argv.slice(2)){
  const options=parseArgs(args);
  const context=binding.sourceContext();
  const targets=binding.validateBinding({env:process.env,context,root:binding.ROOT});

  // Dependency check is deliberately before the attempt-burn. It performs no
  // Provider/DB/S3 operation and prevents a missing local dependency from
  // consuming the one permitted test attempt.
  scientificSelftest();

  if(!options.execute){
    return {
      status:"TEST_ONLY_PRODUCER_PREFLIGHT_PASS_NO_EXTERNAL_EFFECTS",
      run_id:targets.run_id,subject_sha:context.head,task:options.task,
      provider_requests:0,database_writes:0,s3_writes:0,
      production_authorized:false,formal_v5_arm:false,a0:false,o00:false
    };
  }

  assert(!fs.existsSync(targets.ledger),"TEST_ONLY_RUN_ALREADY_STARTED_NO_RETRY");
  assert(!fs.existsSync(targets.out),"TEST_ONLY_NEW_OUTPUT_REQUIRED");

  // Burn before the child can open PG/S3/Provider connections. Any subsequent
  // failure preserves this marker and requires explicit new-run adjudication.
  fs.mkdirSync(targets.ledger,{recursive:false,mode:0o700});
  fs.writeFileSync(path.join(targets.ledger,"STARTED.json"),JSON.stringify({
    schema_version:"geox_mcft_cap09_test_only_started_v1",
    run_id:targets.run_id,subject_sha:context.head,task:options.task,
    started_at:new Date().toISOString(),single_attempt_burned:true,
    production_authorized:false,formal_v5_arm:false,a0:false,o00:false
  },null,2)+"\n",{flag:"wx",mode:0o600});

  fs.mkdirSync(targets.out,{recursive:false,mode:0o700});
  fs.writeFileSync(path.join(targets.out,"STARTED_TEST_ONLY.json"),JSON.stringify({
    schema_version:"geox_mcft_cap09_test_only_execution_v1",
    run_id:targets.run_id,subject_sha:context.head,
    evidence_login_role:targets.evidence_login_role,s3_principal:targets.s3_principal,
    task:options.task,production_authorized:false,formal_v5_arm:false,
    started_at:new Date().toISOString()
  },null,2)+"\n",{flag:"wx",mode:0o600});

  const env={
    ...process.env,
    MCFT_CAP09_TEST_ONLY_BINDING:"1",
    MCFT_CAP09_TEST_ONLY_RUN_ID:targets.run_id,
    MCFT_CAP09_TEST_ONLY_PRODUCER:"1",
    MCFT_SUBJECT_SHA:context.head,
    MCFT_QUALIFICATION_FIRST_BASE:targets.qualification_first_base
  };
  runProducer(env);

  return {
    status:"TEST_ONLY_PRODUCER_COMPLETED_REQUIRES_EVIDENCE_ADJUDICATION",
    run_id:targets.run_id,subject_sha:context.head,output:targets.out,ledger:targets.ledger,
    timing_started:false,controlled_delay_started:false,
    production_authorized:false,formal_v5_arm:false,a0:false,o00:false
  };
}
if(require.main===module){
  main().then(x=>console.log(JSON.stringify(x))).catch(e=>{
    console.error(JSON.stringify({
      status:"TEST_ONLY_PRODUCER_STOPPED_NO_AUTOMATIC_RETRY",
      reason:e instanceof Error?e.message:String(e),
      production_authorized:false,formal_v5_arm:false
    }));
    process.exitCode=1;
  });
}
module.exports={parseArgs,main,scientificSelftest};
