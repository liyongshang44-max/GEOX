"use strict";
// Bind timing clock at dispatch, never when six-stage plan is constructed.
const assert=require("node:assert/strict");
const TIMING=/^TIMING_[123]$/;
function freshStageLaunch(step,nowMs=Date.now()){
 assert(step&&typeof step==="object"&&typeof step.id==="string"&&step.env&&typeof step.env==="object","STAGE_CLOCK_STEP_REQUIRED");
 assert(Number.isSafeInteger(nowMs)&&nowMs>0,"STAGE_CLOCK_INVALID");
 const env={...step.env};
 if(TIMING.test(step.id)){
  const base=env.MCFT_TIMING_BASE_TARGET;
  const baseMs=Date.parse(base);
  assert(typeof base==="string"&&Number.isFinite(baseMs)&&new Date(baseMs).toISOString()===base&&base.endsWith(":00:00.000Z"),"STAGE_CLOCK_CANONICAL_BASE_REQUIRED");
  assert(nowMs<baseMs,"STAGE_CLOCK_TARGET_ALREADY_PASSED");
  env.MCFT_TIMING_LOCAL_LAUNCH_AT_MS=String(nowMs);
 }else assert(["PRODUCER","CONTROLLED_DELAY","AGGREGATE"].includes(step.id),"STAGE_CLOCK_UNKNOWN_STAGE");
 return {...step,env};
}
module.exports={freshStageLaunch};
