#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const binding=require("./MCFT_CAP09_TEST_ONLY_BINDING_V1.cjs");
const current=require("./MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs");

function parseArgs(args){
  assert(args.includes("--operator-authorized")&&args.includes("--test-only"),"TEST_ONLY_EXPLICIT_OPERATOR_AND_MODE_REQUIRED");
  assert(args.includes("--execute")!==args.includes("--preflight-only"),"TEST_ONLY_SELECT_ONE_EXECUTION_MODE");
  const tasks=args.filter(x=>["--producer","--timing","--all"].includes(x));
  assert.equal(tasks.length,1,"TEST_ONLY_SELECT_ONE_TASK");
  assert(args.every(x=>["--operator-authorized","--test-only","--execute","--preflight-only","--producer","--timing","--all"].includes(x)),
    "TEST_ONLY_UNKNOWN_ARGUMENT");
  assert.equal(new Set(args).size,args.length,"TEST_ONLY_DUPLICATE_ARGUMENT");
  return {execute:args.includes("--execute"),task:tasks[0]};
}
function spawnTs(file,env){
  const r=cp.spawnSync(process.execPath,["--import","tsx",path.join("scripts","runtime_acceptance",file)],{
    cwd:current.ROOT,env,stdio:"inherit",windowsHide:true
  });
  assert.equal(r.status,0,"TEST_ONLY_CHILD_FAILED:"+file);
}
async function main(args=process.argv.slice(2)){
  const options=parseArgs(args);
  const context=current.sourceContext();
  const targets=binding.validateBinding({env:process.env,context,root:current.ROOT});
  assert.equal(process.env.MCFT_SUBJECT_SHA,context.head,"TEST_ONLY_SUBJECT_MUST_EQUAL_PROTECTED_MAIN");
  if(!options.execute){
    return {status:"TEST_ONLY_PREFLIGHT_PASS_NO_EFFECTS",run_id:targets.run_id,subject_sha:context.head,
      task:options.task,provider_requests:0,database_writes:0,s3_writes:0,production_authorized:false};
  }

  assert(!fs.existsSync(targets.ledger),"TEST_ONLY_RUN_ALREADY_STARTED_NO_RETRY");
  assert(!fs.existsSync(targets.out),"TEST_ONLY_NEW_OUTPUT_REQUIRED");
  fs.mkdirSync(targets.ledger,{recursive:false,mode:0o700});
  fs.writeFileSync(path.join(targets.ledger,"STARTED.json"),JSON.stringify({
    schema_version:"geox_mcft_cap09_test_only_started_v1",run_id:targets.run_id,subject_sha:context.head,
    task:options.task,started_at:new Date().toISOString(),single_attempt_burned:true,
    production_authorized:false,formal_v5_arm:false,a0:false,o00:false
  },null,2)+"\n",{flag:"wx",mode:0o600});

  const scientific=cp.spawnSync(process.env.MCFT_PYTHON_EXECUTABLE||"python",[
    path.join(current.ROOT,"apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_scientific_core_v1.py"),"selftest"
  ],{cwd:current.ROOT,stdio:"inherit",timeout:60000,windowsHide:true});
  assert.equal(scientific.status,0,"TEST_ONLY_SCIENTIFIC_SELFTEST_REQUIRED");

  fs.mkdirSync(targets.out,{recursive:false,mode:0o700});
  fs.writeFileSync(path.join(targets.out,"STARTED_TEST_ONLY.json"),JSON.stringify({
    schema_version:"geox_mcft_cap09_test_only_execution_v1",run_id:targets.run_id,subject_sha:context.head,
    evidence_login_role:targets.evidence_login_role,s3_principal:targets.s3_principal,task:options.task,
    production_authorized:false,formal_v5_arm:false,started_at:new Date().toISOString()
  },null,2)+"\n",{flag:"wx",mode:0o600});

  const env={...process.env,MCFT_CAP09_TEST_ONLY_BINDING:"1",MCFT_CAP09_TEST_ONLY_RUN_ID:targets.run_id,
    MCFT_SUBJECT_SHA:context.head,MCFT_QUALIFICATION_FIRST_BASE:targets.qualification_first_base};

  if(options.task!=="--timing"){
    spawnTs("RUN_MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2.ts",
      {...env,MCFT_CAP09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION:"1"});
  }
  if(options.task!=="--producer"){
    const attempt=String(Date.now());
    for(let i=0;i<3;i++){
      const began=Date.now();
      spawnTs("RUN_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_V2.ts",{
        ...env,MCFT_CAP09_V13_EXACT_HEAD_TIMING_SAMPLE:"1",MCFT_TIMING_SAMPLE_ID:"sample"+(i+1),
        MCFT_TIMING_RUN_ID:attempt,MCFT_TIMING_RUN_ATTEMPT:"1",
        MCFT_TIMING_BASE_TARGET:new Date(Date.parse(targets.qualification_first_base)+i*3600000).toISOString(),
        MCFT_TIMING_WAKE_DELAY_MS:"0",MCFT_TIMING_JOB_START_SETUP_MS:"0",MCFT_TIMING_LOCAL_LAUNCH_AT_MS:String(began)
      });
    }
    spawnTs("AGGREGATE_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V2.ts",{...env,MCFT_TIMING_SAMPLE_DIR:targets.out});
  }
  return {status:"TEST_ONLY_EXECUTION_COMPLETED_REQUIRES_ADJUDICATION",run_id:targets.run_id,subject_sha:context.head,
    task:options.task,output:targets.out,ledger:targets.ledger,production_authorized:false,formal_v5_arm:false,a0:false,o00:false};
}
if(require.main===module){
  main().then(x=>console.log(JSON.stringify(x))).catch(e=>{
    console.error(JSON.stringify({status:"TEST_ONLY_EXECUTION_STOPPED_NO_RETRY",reason:e.message,production_authorized:false}));
    process.exitCode=1;
  });
}
module.exports={parseArgs,main};
