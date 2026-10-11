"use strict";
// One-shot orchestrator. Caller must provide actual consumed authority and a
// stage dispatcher which verifies the child ticket and seals stage receipts.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const STAGES=Object.freeze(["PRODUCER","TIMING_1","TIMING_2","TIMING_3","CONTROLLED_DELAY","AGGREGATE"]);
const sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");
function regular(file){const s=fs.lstatSync(file);assert(s.isFile()&&!s.isSymbolicLink(),"SIX_STAGE_RECEIPT_NOT_REGULAR");}
function validateStagePlan(plan){
 assert(plan&&typeof plan==="object","SIX_STAGE_PLAN_REQUIRED");
 assert.deepEqual(Object.keys(plan).sort(),["schema_version","stages"].sort(),"SIX_STAGE_PLAN_FIELDS_INVALID");
 assert.equal(plan.schema_version,"geox_mcft_cap09_retry_stage_plan_v2","SIX_STAGE_PLAN_VERSION_REQUIRED");
 assert(Array.isArray(plan.stages)&&plan.stages.length===STAGES.length,"SIX_STAGE_COUNT_REQUIRED");
 for(let i=0;i<STAGES.length;i++){
  const row=plan.stages[i];assert.deepEqual(Object.keys(row).sort(),["id","timeout_ms"],"SIX_STAGE_FIELDS_INVALID");
  assert.equal(row.id,STAGES[i],"SIX_STAGE_ORDER_INVALID");
  assert(Number.isSafeInteger(row.timeout_ms)&&row.timeout_ms>=1000&&row.timeout_ms<=3600000,"SIX_STAGE_TIMEOUT_INVALID");
 }
}
async function executeSixStages({authority,plan,steps,dispatch,assertConsumed}){
 validateStagePlan(plan);
 assert(authority&&authority.consumed&&typeof dispatch==="function"&&typeof assertConsumed==="function","SIX_STAGE_CONSUMED_AUTHORITY_REQUIRED");
 assertConsumed(authority.consumed);
 assert(Array.isArray(steps)&&steps.length===STAGES.length,"SIX_STAGE_STEP_SET_REQUIRED");
 const root=authority.consumed.run_directory;assert(path.isAbsolute(root),"SIX_STAGE_LEDGER_ABSOLUTE_REQUIRED");
 const consumedFile=path.join(root,"CONSUMED.json");regular(consumedFile);
 let previous=sha(fs.readFileSync(consumedFile));const receipts=[];
 for(let i=0;i<STAGES.length;i++){
  const id=STAGES[i],step=steps[i];
  assert.deepEqual(Object.keys(step).sort(),["artifact","args","cwd","env","executable","id","script"].sort(),"SIX_STAGE_STEP_FIELDS_INVALID");
  assert.equal(step.id,id,"SIX_STAGE_STEP_ORDER_INVALID");
  assert(!fs.existsSync(step.artifact),"SIX_STAGE_ARTIFACT_PREEXISTS");
  const r=await dispatch(authority,{...step,timeout_ms:plan.stages[i].timeout_ms,previous_sha256:previous});
  assert(r&&r.record&&r.record.status==="PASS"&&r.record.id===id,"SIX_STAGE_INVALID_RECEIPT");
  assert.equal(r.record.previous_sha256,previous,"SIX_STAGE_RECEIPT_CHAIN_MISMATCH");
  assert.equal(r.record.claim_valid,true,"SIX_STAGE_CHILD_CLAIM_REQUIRED");
  assert.equal(r.record.artifact_present,true,"SIX_STAGE_ARTIFACT_REQUIRED");
  assert.equal(r.record.artifact_sha256,sha(fs.readFileSync(step.artifact)),"SIX_STAGE_ARTIFACT_DIGEST_MISMATCH");
  const sealed=path.join(root,id,"COMPLETED.json");regular(sealed);
  assert.equal(r.sha256,sha(fs.readFileSync(sealed)),"SIX_STAGE_SEAL_DIGEST_MISMATCH");
  const payload=JSON.parse(fs.readFileSync(sealed,"utf8"));assert.deepEqual(payload,r.record,"SIX_STAGE_RECEIPT_CONTENT_CHANGED");
  previous=r.sha256;
  receipts.push({id,receipt_sha256:previous,artifact_sha256:r.record.artifact_sha256});
 }
 const delayFile=steps[4].artifact;const delay=JSON.parse(fs.readFileSync(delayFile,"utf8"));
 assert.equal(delay.status,"PASS","SIX_STAGE_DELAY_FAILED");
 assert.equal(delay.physical_delay_cases_executed,true,"SIX_STAGE_REAL_DELAY_REQUIRED");
 assert.equal(delay.provider_pipeline_injected,false,"SIX_STAGE_FALSE_PIPELINE_CLAIM");
 assert.equal(delay.retained_qualification_database_touched,false,"SIX_STAGE_RETAINED_DB_FORBIDDEN");
 const report={schema_version:"geox_mcft_cap09_six_stage_audit_v1",status:"SIX_STAGE_EVIDENCE_SEALED_NOT_AUTHORITY",
  stage_count:6,stages:receipts,final_receipt_sha256:previous,
  physical_delay_proven:true,provider_slow_path_proven:false,qualified:false,formal_v5_arm:false};
 fs.writeFileSync(path.join(root,"SIX_STAGE_AUDIT.json"),JSON.stringify(report,null,2)+"\n",{flag:"wx",mode:0o600});
 return report;
}
module.exports={STAGES,validateStagePlan,executeSixStages};
