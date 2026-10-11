"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {validatePlan,makeGate,verifyEvidence}=require("../runtime_acceptance/MCFT_CAP09_REAL_PIPELINE_DELAY_V1.cjs");
const start=new Date(Date.now()+3600000);start.setUTCMinutes(0,0,0);
const first=start.toISOString(),run="abcdef123456",head="c".repeat(40);
const plan={schema_version:"geox_mcft_cap09_real_pipeline_delay_v1",mode:"REAL_ISOLATED_PROMOTION_AND_PHYSICAL_READBACK",
 run_id:run,subject_sha:head,first_base:first,expected_distinct_bases:3,promotion_queue_delay_ms:26,post_commit_readback_delay_ms:27};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"mcft-real-pipeline-delay-"));let checks=0,called=0;
(async()=>{try{
 const p=validatePlan(plan,{runId:run,subjectSha:head,firstBase:first,responseDelayMs:25,producerStageTimeoutMs:11000});
 assert.equal(p.run_id,run);checks++;
 for(const mutate of [x=>x.run_id="no",x=>x.subject_sha="bad",x=>x.first_base="bogus",x=>x.mode="BYPASS",
   x=>x.extra=true,x=>x.expected_distinct_bases=2,x=>x.promotion_queue_delay_ms=0,x=>x.post_commit_readback_delay_ms=15001]){
  const bad={...plan};mutate(bad);assert.throws(()=>validatePlan(bad));checks++;
 }
 assert.throws(()=>validatePlan(plan,{responseDelayMs:25,producerStageTimeoutMs:500}),/BUDGET/);checks++;
 const gate=makeGate({plan,outputDir:dir});
 let bypass=false;
 await assert.rejects(gate.attest(first,async()=>{bypass=true;return null;}),/PHASE_ORDER/);checks++;
 const next=new Date(Date.parse(first)+3600000).toISOString();
 await assert.rejects(gate.promote(next,async()=>{bypass=true;return null;}),/BASE_ORDER/);checks++;
 assert.equal(bypass,false);checks++;
 for(let i=0;i<3;i++){
  const base=new Date(Date.parse(first)+i*3600000).toISOString();
  const promoted=await gate.promote(base,async()=>{called++;return {database_fence_commit_succeeded:true,formal_fact_present_count:3,facts:[1,2,3]};});
  assert.equal(promoted.database_fence_commit_succeeded,true);checks++;
  const visible=await gate.attest(base,async()=>{called++;return {status:"PASS",base_target_t:base,physical_visibility_before_base:true,cursor_advanced:true};});
  assert.equal(visible.physical_visibility_before_base,true);checks++;
 }
 assert.equal(called,6);checks++;
 const proof=gate.seal();assert.equal(proof.operation_event_count,6);checks++;
 const file=path.join(dir,"MCFT_CAP09_REAL_PIPELINE_DELAY_V1_RESULT.json");
 assert.equal(verifyEvidence(file,{runId:run,subjectSha:head,firstBase:first}).count,6);checks++;
 assert.throws(()=>gate.seal());checks++;
 assert.throws(()=>makeGate({plan,outputDir:dir}),/EVIDENCE_PREEXISTS/);checks++;
 await assert.rejects(gate.promote(first,()=>{throw Error("duplicate");}),/ALREADY_SEALED/);checks++;
 const event=path.join(dir,"MCFT_CAP09_PIPELINE_DELAY_PHYSICAL_READBACK_2.json");
 fs.appendFileSync(event,"\n");assert.throws(()=>verifyEvidence(file,{runId:run,subjectSha:head,firstBase:first}),/HASH_CHANGED/);checks++;
 const failDir=path.join(dir,"failed");fs.mkdirSync(failDir);
 const badReadback=makeGate({plan,outputDir:failDir});
 await badReadback.promote(first,async()=>({database_fence_commit_succeeded:true,formal_fact_present_count:3,facts:[1,2,3]}));checks++;
 await assert.rejects(badReadback.attest(first,async()=>({status:"FAIL",base_target_t:first,physical_visibility_before_base:false,cursor_advanced:false})),/PHYSICAL_READBACK_REQUIRED/);checks++;
 assert.throws(()=>badReadback.seal(),/EXACT_SIX_EVENTS/);checks++;
 assert(!fs.existsSync(path.join(failDir,"MCFT_CAP09_REAL_PIPELINE_DELAY_V1_RESULT.json")));checks++;
 const noCommitDir=path.join(dir,"no-commit");fs.mkdirSync(noCommitDir);
 const badPromotion=makeGate({plan,outputDir:noCommitDir});
 await assert.rejects(badPromotion.promote(first,async()=>({database_fence_commit_succeeded:false,formal_fact_present_count:0,facts:[]})),/FENCED_PROMOTION_REQUIRED/);checks++;
 assert(!fs.existsSync(path.join(noCommitDir,"MCFT_CAP09_REAL_PIPELINE_DELAY_V1_RESULT.json")));checks++;
 console.log(JSON.stringify({status:"PASS",checks,real_monotonic_waits:6,callback_invocations:called,
  external_provider_calls:0,database_connections:0,execute_authorized:false}));
}finally{fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
