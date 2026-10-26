"use strict";
// Stage-3 only: invoke the unchanged original REAL monotonic scratch-delay body,
// once, on three REAL timing samples. No Provider, DB, Permit, Host, or production.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const cp=require("node:child_process"),crypto=require("node:crypto");
const gate=require("../governance_acceptance/MCFT_CAP09_STAGE3_NONAUTHORIZED_REAL_BODY_GATE_V1.cjs");
const ROOT=path.resolve(__dirname,"../..");
const sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");
const forbidden=["MCFT_GOVERNED_RETRY_STAGE","MCFT_GOVERNED_RETRY_TICKET",
 "MCFT_GOVERNED_RETRY_BUNDLE","MCFT_CAP09_ADOPTION_REQUEST","DATABASE_URL",
 "BLOCKED_DATABASE_URL","MCFT_CAP09_FORMAL_RAW_SECRET_ACCESS_KEY","PGPASSWORD"];
function safeDir(dir){assert(path.isAbsolute(dir),"STAGE3_ABSOLUTE_DIR_REQUIRED");
 assert(path.relative(ROOT,dir).startsWith(".."+path.sep),"STAGE3_DIR_OUTSIDE_SOURCE_REQUIRED");
 assert(fs.existsSync(dir)&&fs.statSync(dir).isDirectory(),"STAGE3_DIR_REQUIRED");}
async function main(args){
 assert(process.platform==="win32"&&!process.env.CI&&!process.env.GITHUB_ACTIONS,"WINDOWS_OPERATOR_ONLY");
 assert.equal(process.version,"v24.19.0","STAGE3_NODE24_REQUIRED");
 for(const name of forbidden)assert(!process.env[name],"STAGE3_FORBIDDEN_INHERITED_ENV:"+name);
 assert.equal(args.length,3,"USAGE: --real-delay /absolute/timing-samples /absolute/new-output-dir 12CHAR_NEW_RUN_ID");
 const [samples,output,runId]=args;
 assert(/^[a-f0-9]{12}$/.test(runId)&&!["da9db7129607","af64cc3aa84e","72dc0304a21a"].includes(runId),"STAGE3_NEW_RUN_REQUIRED");
 safeDir(samples);assert(!fs.existsSync(output),"STAGE3_OUTPUT_MUST_BE_NEW");
 const c=gate.verifySource(ROOT);
 const mod=require("./MCFT_CAP09_REAL_CONTROLLED_DELAY_V1.cjs");
 const files=[1,2,3].map(i=>path.join(samples,"MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE"+i+"_V2_RESULT.json"));
 for(let i=0;i<3;i++){
  const p=files[i],stat=fs.lstatSync(p);assert(stat.isFile()&&!stat.isSymbolicLink());
  const receipt=JSON.parse(fs.readFileSync(p,"utf8"));
  assert.equal(receipt.status,"PASS");assert.equal(receipt.schema_version,"geox_mcft_cap09_v13_exact_head_timing_sample_v2");
  assert.equal(receipt.subject_sha,c.frozen_pr_3730_head_sha);assert.equal(receipt.sample_id,"sample"+(i+1));
  assert.equal(receipt.measurement_only,true);assert.equal(receipt.formal_fact_present_count,3);
  assert.equal(receipt.production_owner_activation,false);
 }
 // Do not substitute forged timing metrics or a CI simulation for these real samples.
 const plan=mod.deriveDelayPlan({sampleFiles:files,runId,subjectSha:c.frozen_pr_3730_head_sha,maximumCaseMs:120000});
 assert.equal(plan.cases.length,6);assert(plan.cases.every(e=>e.delay_ms>0&&e.delay_ms<=120000));
 fs.mkdirSync(output,{recursive:false,mode:0o700});
 const planPath=path.join(output,"STAGE3_REAL_SCRATCH_DELAY_PLAN.json");
 fs.writeFileSync(planPath,JSON.stringify(plan,null,2)+"\n",{flag:"wx",mode:0o600});
 const artifact=path.join(output,"MCFT_CAP09_REAL_CONTROLLED_DELAY_V1_RESULT.json");
 const result=await mod.executeRealDelay({plan,scratchParent:output,outputFile:artifact,stageTimeoutMs:3600000});
 assert.equal(result.status,"PASS");assert.equal(result.physical_delay_cases_executed,true);
 assert.equal(result.provider_pipeline_injected,false);
 console.log(JSON.stringify({status:"REAL_ORIGINAL_DELAY_BODY_EXECUTED_ON_DISPOSABLE_SCRATCH_NOT_SIX_STAGE_QUALIFICATION",
  run_id:runId,original_delay_git_blob_sha:c.stages[4].original_entry_git_blob_sha,
  result_file:artifact,result_sha256:sha(fs.readFileSync(artifact)),
  provider_pipeline_delay_proven:false,permit_signed:false,permit_consumed:false,stage3_full_six_bodies_qualified:false}));
}
if(require.main===module){main(process.argv.slice(2)).catch(e=>{
 console.error("STAGE3_REAL_DELAY_HOLD:"+String(e.stack||e));process.exitCode=1;});}
module.exports={main};
