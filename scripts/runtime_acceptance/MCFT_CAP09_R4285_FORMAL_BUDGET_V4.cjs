"use strict";
// Signed Plan selects an exact closed budget revision; no caller-supplied budget.
// Historical 180-minute vector remains available only through its original contract.
const assert=require("node:assert/strict");
const scheduler=require("./MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs");
const identity=require("./MCFT_CAP09_R4285_EXECUTION_IDENTITY_V3.cjs");
const LEGACY=Object.freeze({id:"V3_180",timeouts:Object.freeze([3600000,1800000,1800000,1800000,1200000,600000]),total:10800000,caseLimit:120000,delayScript:"MCFT_CAP09_R4285_CONTROLLED_DELAY_V1.cjs"});
const SUCCESSOR=Object.freeze({id:"V4_205",timeouts:Object.freeze([3600000,1800000,1800000,1800000,2700000,600000]),total:12300000,caseLimit:1800000,delayScript:"MCFT_CAP09_R4285_CONTROLLED_DELAY_V2.cjs"});
const equal=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
function select(plan,run){
 scheduler.validateStagePlan(plan);
 const vector=plan.stages.map(x=>x.timeout_ms);
 if(equal(vector,LEGACY.timeouts))return LEGACY;
 assert(run===identity.SUCCESSOR&&equal(vector,SUCCESSOR.timeouts),"V4_FORMAL_BUDGET_VECTOR_OR_RUN_INVALID");
 return SUCCESSOR;
}
function byId(id){assert([LEGACY.id,SUCCESSOR.id].includes(id),"V4_FORMAL_BUDGET_VERSION_INVALID");return id===SUCCESSOR.id?SUCCESSOR:LEGACY;}
function minimumRemaining(version){return byId(version).total+60000;}
function requireSuccessorDelay(run,timeout){assert(run===identity.SUCCESSOR&&timeout===String(SUCCESSOR.timeouts[4]),"V4_DELAY_ROUTE_OR_TIMEOUT_INVALID");return SUCCESSOR;}
function delayThreshold(plan){const requested=plan.cases.reduce((n,row)=>n+row.delay_ms,0);return requested+Math.max(1000,Math.ceil(requested*.2));}
module.exports=Object.freeze({LEGACY,SUCCESSOR,select,byId,minimumRemaining,requireSuccessorDelay,delayThreshold});
