'use strict';
const assert=require('node:assert/strict');
const {buildRecoveryExecutionPlanV1}=require('../mcft_cap08_s6_single_run_db/recovery_execution_adapter_v1.cjs');
async function executeRecoveryVectorsV1(port,spec,authority){assert.equal(authority?.record_status,'SINGLE_DEVELOPMENT_QUALIFICATION_RUN_DATABASE_EXECUTION_AUTHORIZED','QUALIFICATION_DATABASE_EXECUTION_AUTHORITY_REQUIRED');assert.equal(authority.authority_class,'DEVELOPMENT_QUALIFICATION_ONLY');const plan=buildRecoveryExecutionPlanV1(spec),results=[];for(const vector of plan.vectors){const result=await port.executeVector({spec,vector});assert.equal(result.vector_id,vector.vector_id);assert.equal(result.status,'PASS');assert.equal(result.silent_repair_used,false);results.push(result);}return{plan,results};}
module.exports={executeRecoveryVectorsV1};
