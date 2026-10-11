"use strict";
const assert=require("node:assert/strict");
const {freshStageLaunch}=require("../runtime_acceptance/MCFT_CAP09_STAGE_START_CLOCK_V1.cjs");
let n=0;
const base="2030-10-11T18:00:00.000Z",tick=Date.parse("2030-10-11T17:59:00.000Z");
const old={id:"TIMING_1",env:{MCFT_TIMING_BASE_TARGET:base,MCFT_TIMING_LOCAL_LAUNCH_AT_MS:"100"}};
const first=freshStageLaunch(old,tick),late=freshStageLaunch(old,tick+10000);
assert.equal(first.env.MCFT_TIMING_LOCAL_LAUNCH_AT_MS,String(tick));n++;
assert.equal(late.env.MCFT_TIMING_LOCAL_LAUNCH_AT_MS,String(tick+10000));n++;
assert.equal(old.env.MCFT_TIMING_LOCAL_LAUNCH_AT_MS,"100");n++;
assert.notEqual(first.env,old.env);n++;
assert.deepEqual(["PRODUCER","CONTROLLED_DELAY","AGGREGATE"].map(id=>freshStageLaunch({id,env:{A:"B"}},tick).env.A),["B","B","B"]);n++;
for(const sampleId of ["TIMING_1","TIMING_2","TIMING_3"]){
 for(const bad of [base,base.replace("18:00","17:59"),"not a date",undefined]){
  const env={MCFT_TIMING_BASE_TARGET:bad},time=bad===base?Date.parse(base):tick;
  if(bad===base)assert.throws(()=>freshStageLaunch({id:sampleId,env},time),/STAGE_CLOCK_TARGET_ALREADY_PASSED/);
  else assert.throws(()=>freshStageLaunch({id:sampleId,env},tick),/STAGE_CLOCK_CANONICAL_BASE_REQUIRED|STAGE_CLOCK_TARGET_ALREADY_PASSED/);
  n++;
 }
}
assert.throws(()=>freshStageLaunch({id:"TIMING_4",env:{}},tick),/STAGE_CLOCK_UNKNOWN_STAGE/);n++;
assert.throws(()=>freshStageLaunch(old,Number.NaN),/STAGE_CLOCK_INVALID/);n++;
console.log(JSON.stringify({status:"PASS",assertions:n,static_plan_timestamp_bias_rejected:true,clock_bound_at_dispatch:true,production_executed:false}));
