"use strict";
// New exact physical child; preserves historical V1 derivation and real-clock loop.
const assert=require("node:assert/strict"),path=require("node:path");
const budget=require("./MCFT_CAP09_R4285_FORMAL_BUDGET_V4.cjs");
const {deriveDelayPlan,executeRealDelay}=require("./MCFT_CAP09_R4285_CONTROLLED_DELAY_V1.cjs");
if(require.main===module){
 (async()=>{
  // Entry is always real-host gated; synthetic E2E tests import pure exports.
  assert.equal(process.env.MCFT_R4285_CHILD,"1","V4_DELAY_PHYSICAL_CHILD_REQUIRED");
  assert(!process.env.MCFT_ATTEMPT3_V2_CHILD,"R4285_CHILD_MODE_AMBIGUOUS");
  const revision=budget.requireSuccessorDelay(process.env.MCFT_GOVERNED_RETRY_RUN_ID,process.env.MCFT_GOVERNED_RETRY_DELAY_TIMEOUT_MS);
  const host=require("./MCFT_CAP09_R4285_CHILD_STAGE_V1.cjs");
  const targets=host.childTargets();
  const runId=process.env.MCFT_GOVERNED_RETRY_RUN_ID,subjectSha=process.env.MCFT_SUBJECT_SHA;
  const signedObserved=host.observed();
  const samples=[1,2,3].map(i=>path.join(targets.out,`MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE${i}_V2_RESULT.json`));
  const providerReceipt=require("./MCFT_CAP09_REAL_PROVIDER_RESPONSE_DELAY_V1.cjs").verifyEvidence(
   path.join(targets.out,"MCFT_CAP09_REAL_PROVIDER_RESPONSE_DELAY_V1_RESULT.json"),
   {runId,subjectSha,plan:signedObserved.real_provider_response_delay_plan});
  assert.equal(providerReceipt.count,3,"DELAY_REQUIRES_THREE_REAL_PROVIDER_RESPONSE_EVENTS");
  const pipelineProof=require("./MCFT_CAP09_REAL_PIPELINE_DELAY_V1.cjs").verifyEvidence(
    path.join(targets.out,"MCFT_CAP09_REAL_PIPELINE_DELAY_V1_RESULT.json"),
    {runId,subjectSha,firstBase:process.env.MCFT_QUALIFICATION_FIRST_BASE,plan:signedObserved.real_pipeline_delay_plan});
  assert.equal(pipelineProof.count,6,"DELAY_REQUIRES_SIX_PROMOTION_AND_READBACK_EVENTS");
  const plan=deriveDelayPlan({sampleFiles:samples,runId,subjectSha,maximumCaseMs:revision.caseLimit});
  const limit=revision.timeouts[4];
  const result=await executeRealDelay({plan,scratchParent:targets.out,
   outputFile:path.join(targets.out,"MCFT_CAP09_REAL_CONTROLLED_DELAY_V1_RESULT.json"),stageTimeoutMs:limit});
  console.log(JSON.stringify({status:result.status,physical_delay_cases_executed:true,provider_pipeline_injected:false}));
 })().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
}
