"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),cp=require("node:child_process"),crypto=require("node:crypto");
const {STAGES,validateStagePlan,executeSixStages}=require("../runtime_acceptance/MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs");
const delay=require("../runtime_acceptance/MCFT_CAP09_REAL_CONTROLLED_DELAY_V1.cjs");
const hash=b=>crypto.createHash("sha256").update(b).digest("hex");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"mcft-six-stage-e2e-"));const run="abcdef123456",head="b".repeat(40);let tests=0;
const plan={schema_version:"geox_mcft_cap09_retry_stage_plan_v2",stages:STAGES.map(id=>({id,timeout_ms:10000}))};
function newRun(name){const root=path.join(dir,name),ledger=path.join(root,"ledger"),out=path.join(root,"out");fs.mkdirSync(root);fs.mkdirSync(ledger);fs.mkdirSync(out);fs.writeFileSync(path.join(ledger,"CONSUMED.json"),'{"status":"CONSUMED_NO_AUTOMATIC_RETRY"}\n');return{root,ledger,out};}
function makeSteps(runDir){const child=path.join(runDir.root,"synthetic-child.cjs");const adapter=path.resolve(__dirname,"../runtime_acceptance/MCFT_CAP09_REAL_CONTROLLED_DELAY_V1.cjs");
 const source=`"use strict";const fs=require('node:fs'),path=require('node:path');const delay=require(${JSON.stringify(adapter)});(async()=>{const e=process.env;const output=e.SYNTH_OUTPUT,stage=e.SYNTH_STAGE;if(e.SYNTH_FAIL===stage)throw Error('TEST_INJECTED_FAILURE');if(stage==='CONTROLLED_DELAY'){const plan=delay.deriveDelayPlan({sampleFiles:[1,2,3].map(i=>path.join(e.SYNTH_OUTDIR,'MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE'+i+'_V2_RESULT.json')),runId:e.SYNTH_RUN,subjectSha:e.SYNTH_HEAD});await delay.executeRealDelay({plan,scratchParent:e.SYNTH_OUTDIR,outputFile:output,stageTimeoutMs:10000});}else{if(stage.startsWith('TIMING_')){const i=stage.slice(-1);fs.writeFileSync(path.join(e.SYNTH_OUTDIR,'MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE'+i+'_V2_RESULT.json'),JSON.stringify({schema_version:'geox_mcft_cap09_v13_exact_head_timing_sample_v2',status:'PASS',subject_sha:e.SYNTH_HEAD,measurement_only:true,sample_id:'sample'+i,timing_phases:{wake_delay_ms:12,job_start_setup_ms:12,provider_capture_ms:12,retained_raw_and_candidate_ms:12,promotion_queue_and_setup_ms:12,rehydration_promotion_commit_readback_ms:12}}));}fs.writeFileSync(output,JSON.stringify({status:'PASS',stage}));}console.log('FINISHED',stage);})().catch(e=>{console.error(e.stack);process.exitCode=1;});`;
 fs.writeFileSync(child,source);
 return STAGES.map(id=>({id,script:child,cwd:runDir.root,executable:process.execPath,args:[child],env:{...process.env,SYNTH_STAGE:id,SYNTH_OUTDIR:runDir.out,SYNTH_RUN:run,SYNTH_HEAD:head,SYNTH_OUTPUT:path.join(runDir.out,id+".json")},artifact:path.join(runDir.out,id+".json")}));}
async function syntheticDispatch(authority,step){const stageRoot=path.join(authority.consumed.run_directory,step.id);fs.mkdirSync(stageRoot);
 const child=cp.spawnSync(step.executable,step.args,{cwd:step.cwd,env:step.env,encoding:"utf8",timeout:step.timeout_ms});
 const record={id:step.id,previous_sha256:step.previous_sha256,exit_code:child.status,stdout_sha256:hash(child.stdout||""),stderr_sha256:hash(child.stderr||""),claim_valid:true,artifact_present:fs.existsSync(step.artifact),artifact_sha256:fs.existsSync(step.artifact)?hash(fs.readFileSync(step.artifact)):null,status:child.status===0&&fs.existsSync(step.artifact)?"PASS":"FAIL"};
 fs.writeFileSync(path.join(stageRoot,"COMPLETED.json"),JSON.stringify(record));
 if(record.status!=="PASS")throw Error("STAGE_FAILED_NO_AUTOMATIC_RETRY:"+step.id);
 return {record,sha256:hash(fs.readFileSync(path.join(stageRoot,"COMPLETED.json")))};}
async function main(){try{
 validateStagePlan(plan);tests++;
 for(const fn of [p=>p.stages.reverse(),p=>p.stages.pop(),p=>p.stages[4].id="AGGREGATE",p=>p.stages[0].command="delete_all",p=>p.schema_version="geox_mcft_cap09_retry_stage_plan_v1"]){const x=structuredClone(plan);fn(x);assert.throws(()=>validateStagePlan(x));tests++;}
 const good=newRun("good"),goodSteps=makeSteps(good),t0=process.hrtime.bigint();
 const proof=await executeSixStages({authority:{consumed:{run_directory:good.ledger}},plan,steps:goodSteps,dispatch:syntheticDispatch,assertConsumed:c=>assert.equal(c.run_directory,good.ledger)});
 const elapsed=Number(process.hrtime.bigint()-t0)/1e6;
 assert.equal(proof.stage_count,6);tests++;
 assert.deepEqual(proof.stages.map(x=>x.id),STAGES);tests++;
 assert(elapsed>65,"Expected real monotonic delay, not constructed matrix");tests++;
 const real=JSON.parse(fs.readFileSync(goodSteps[4].artifact));assert.equal(real.cases.length,6);tests++;
 assert(real.cases.every(x=>x.measured_elapsed_ms>=x.requested_delay_ms));tests++;
 assert.equal(real.provider_pipeline_injected,false);tests++;
 assert.equal(real.retained_qualification_database_touched,false);tests++;
 assert.equal(fs.readdirSync(real.scratch_path).length,6);tests++;
 assert.throws(()=>fs.mkdirSync(real.scratch_path),/EEXIST/);tests++;
 await assert.rejects(executeSixStages({authority:{consumed:{run_directory:good.ledger}},plan,steps:goodSteps,dispatch:syntheticDispatch,assertConsumed:()=>{}}),/SIX_STAGE_ARTIFACT_PREEXISTS/);tests++;
 const failed=newRun("failed"),failedSteps=makeSteps(failed);failedSteps[2].env.SYNTH_FAIL="TIMING_2";
 await assert.rejects(executeSixStages({authority:{consumed:{run_directory:failed.ledger}},plan,steps:failedSteps,dispatch:syntheticDispatch,assertConsumed:()=>{}}),/STAGE_FAILED_NO_AUTOMATIC_RETRY/);tests++;
 assert(!fs.existsSync(failedSteps[3].artifact)&&!fs.existsSync(path.join(failed.ledger,"TIMING_3")));tests++;
 assert(!fs.existsSync(path.join(failed.ledger,"SIX_STAGE_AUDIT.json")));tests++;
 assert.throws(()=>delay.deriveDelayPlan({sampleFiles:[1,2,3].map(i=>path.join(good.out,`MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE${i}_V2_RESULT.json`)),runId:run,subjectSha:"c".repeat(40)}),/SUBJECT_MISMATCH/);tests++;
 console.log(JSON.stringify({status:"PASS",tests,real_elapsed_ms:Math.round(elapsed),stage_count:6,real_monotonic_delay:true,provider_calls:0,external_db_calls:0,fail_stop:true,live_authorized:false}));
}finally{fs.rmSync(dir,{recursive:true,force:true});}}
main().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
