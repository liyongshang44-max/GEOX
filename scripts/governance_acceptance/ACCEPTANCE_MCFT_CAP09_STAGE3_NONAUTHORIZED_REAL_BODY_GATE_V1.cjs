"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const gate=require("./MCFT_CAP09_STAGE3_NONAUTHORIZED_REAL_BODY_GATE_V1.cjs");
const ROOT=path.resolve(__dirname,"../..");
let count=0;
const c=gate.verifySource(ROOT);assert.equal(c.stages.length,6);count++;
assert.equal(c.six_stage_original_business_bodies_verified,false);count++;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"cap09-stage3-negative-"));
try{
 let result=gate.verifyReceipt(ROOT,dir);
 assert.equal(result.status,"HOLD_UNTIL_ALL_SIX_REAL_STAGE_BODIES_AND_INDEPENDENT_REVIEW");
 assert.equal(result.stage_count,0);count++;
 assert.throws(()=>gate.verifyReceipt(ROOT,dir,{runId:"da9db7129607"}),/HISTORICAL_OR_STAGE2_RUN_REUSE_FORBIDDEN/);count++;
 assert.throws(()=>gate.verifyReceipt(ROOT,dir,{runId:"af64cc3aa84e"}),/HISTORICAL_OR_STAGE2_RUN_REUSE_FORBIDDEN/);count++;
 const p=path.join(dir,"PRODUCER.stage3.json");
 const r={schema_version:"geox_mcft_cap09_stage3_nonauthorized_stage_entry_v1",
  id:"PRODUCER",run_id:"aabbccddeeff",source_sha:c.frozen_pr_3730_head_sha,
  entry_script:c.stages[0].original_entry_script,entry_git_blob_sha:c.stages[0].original_entry_git_blob_sha,
  real_body_executed:false,permit_consumed:false,production_authorized:false,
  body_file_sha256:"0".repeat(64),stage_receipt_predecessor_sha256:null,status:"PASS"};
 fs.writeFileSync(p,JSON.stringify(r));
 fs.writeFileSync(path.join(dir,c.stages[0].expected_artifact_name),JSON.stringify({schema_version:c.stages[0].expected_artifact_schema,status:"PASS",subject_sha:c.frozen_pr_3730_head_sha}));
 assert.throws(()=>gate.verifyReceipt(ROOT,dir),/STAGE3_SYNTHETIC_SIMULATION_REJECTED/);count++;
 fs.writeFileSync(p,JSON.stringify({...r,real_body_executed:true,entry_git_blob_sha:"a".repeat(40)}));
 assert.throws(()=>gate.verifyReceipt(ROOT,dir),/AssertionError|Expected values to be strictly equal/);count++;
 console.log(JSON.stringify({status:"PASS",checks:count,original_entry_bodies_executed:false,
  forbidden_historical_reuse:true,stage3_qualification:"HOLD",permit_issued:false,permit_consumed:false}));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
