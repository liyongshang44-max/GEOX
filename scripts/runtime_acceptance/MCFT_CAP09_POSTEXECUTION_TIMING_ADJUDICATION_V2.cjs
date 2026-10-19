"use strict";
// Post-Permit source verifier. Complete receipts are measurement evidence, not
// an automatic real full-pipeline six-case qualification or new Permit authority.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const STAGES=["PRODUCER","TIMING_1","TIMING_2","TIMING_3","CONTROLLED_DELAY","AGGREGATE"];
const DIGEST=/^[a-f0-9]{64}$/;
const sha=x=>crypto.createHash("sha256").update(x).digest("hex");
function read(file,max=8_000_000){const s=fs.lstatSync(file);assert(s.isFile()&&!s.isSymbolicLink()&&s.size>0&&s.size<=max,"POSTEXEC_SOURCE_NOT_REGULAR");const bytes=fs.readFileSync(file);return {bytes,sha256:sha(bytes),json:JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/,""))};}
function adjudicatePostExecutionTimingV2({runDirectory,artifactDirectory,runId,subjectSha}){
 assert(path.isAbsolute(runDirectory)&&path.isAbsolute(artifactDirectory),"POSTEXEC_ABSOLUTE_ROOTS_REQUIRED");
 assert(/^[a-f0-9]{12}$/.test(runId)&&/^[a-f0-9]{40}$/.test(subjectSha),"POSTEXEC_IDENTITY_INVALID");
 const original=read(path.join(runDirectory,"CONSUMED.json"));
 // Genuine consumed authority is a prerequisite. This verifier cannot create it.
 assert(original.json&&original.json.payload?.run_id===runId,"POSTEXEC_CONSUMED_RUN_REQUIRED");
 const audit=read(path.join(runDirectory,"SIX_STAGE_AUDIT.json"));
 assert.equal(audit.json.status,"SIX_STAGE_EVIDENCE_SEALED_NOT_AUTHORITY","POSTEXEC_SIX_STAGE_AUDIT_STATUS_INVALID");
 assert.equal(audit.json.stage_count,6,"POSTEXEC_ALL_SIX_REQUIRED");
 assert(Array.isArray(audit.json.stages)&&audit.json.stages.length===6,"POSTEXEC_SIX_STAGE_CHAIN_REQUIRED");
 assert.equal(audit.json.qualified,false,"POSTEXEC_MUST_NOT_PREQUALIFY");
 let previous=original.sha256,total=0;
 const records=[];
 for(let i=0;i<6;i++){
  const stage=STAGES[i],item=audit.json.stages[i];
  assert.equal(item.id,stage,"POSTEXEC_ORDER_INVALID");
  const completed=read(path.join(runDirectory,stage,"COMPLETED.json"));
  assert.equal(item.receipt_sha256,completed.sha256,"POSTEXEC_STAGE_RECEIPT_HASH_CHANGED");
  const r=completed.json;
  assert.equal(r.id,stage);assert.equal(r.status,"PASS","POSTEXEC_STAGE_FAILED");
  assert.equal(r.previous_sha256,previous,"POSTEXEC_CHAIN_BROKEN");
  assert.equal(r.claim_valid,true,"POSTEXEC_CHILD_CLAIM_MISSING");
  assert.equal(r.artifact_present,true,"POSTEXEC_STAGE_ARTIFACT_MISSING");
  assert(Number.isSafeInteger(r.elapsed_ms)&&r.elapsed_ms>=0,"POSTEXEC_DURATION_INVALID");
  assert(DIGEST.test(r.artifact_sha256)&&DIGEST.test(r.claim_sha256),"POSTEXEC_DIGEST_MISSING");
  const prefix=path.relative(artifactDirectory,r.expected_artifact);
  assert(prefix!==""&&prefix!==".."&&!prefix.startsWith(".."+path.sep)&&!path.isAbsolute(prefix),"POSTEXEC_ARTIFACT_OUTSIDE_ISOLATED_RUN");
  const artifact=read(r.expected_artifact);
  assert.equal(artifact.sha256,r.artifact_sha256,"POSTEXEC_ARTIFACT_BYTES_CHANGED");
  assert.equal(item.artifact_sha256,artifact.sha256,"POSTEXEC_AUDIT_ARTIFACT_CHANGED");
  if(i>0 && i<4){
   assert.equal(artifact.json.sample_id,"sample"+i,"POSTEXEC_TIMING_SAMPLE_ID_MISMATCH");
   assert.equal(artifact.json.subject_sha,subjectSha,"POSTEXEC_TIMING_SUBJECT_MISMATCH");
   assert.equal(artifact.json.status,"PASS","POSTEXEC_TIMING_SAMPLE_NOT_PASS");
   assert.equal(artifact.json.measurement_only,true,"POSTEXEC_TIMING_IS_NOT_MEASUREMENT_ONLY");
   assert.equal(artifact.json.timing_budget_qualified,false,"POSTEXEC_TIMING_FALSE_AUTHORITY");
  }
  if(i===4){
   assert.equal(artifact.json.status,"PASS");
   assert.equal(artifact.json.subject_sha,subjectSha);
   assert.equal(artifact.json.physical_delay_cases_executed,true);
   assert.equal(artifact.json.provider_pipeline_injected,false,"POSTEXEC_SCRATCH_NOT_FULL_PIPELINE");
  }
  if(i===5){
   assert.equal(artifact.json.status,"PASS");
   assert.equal(artifact.json.subject_sha,subjectSha);
   assert.equal(artifact.json.timing_budget_qualified,false,"POSTEXEC_AGGREGATE_FALSE_QUALIFICATION");
   assert.equal(artifact.json.full_six_case_pipeline_delay_qualified,false,"POSTEXEC_AGGREGATE_FALSE_PIPELINE_QUALIFICATION");
  }
  records.push({stage,elapsed_ms:r.elapsed_ms,receipt_sha256:completed.sha256,artifact_sha256:artifact.sha256});
  previous=completed.sha256;total+=r.elapsed_ms;
 }
 assert.equal(audit.json.final_receipt_sha256,previous,"POSTEXEC_FINAL_CHAIN_MISMATCH");
 const response=read(path.join(artifactDirectory,"MCFT_CAP09_REAL_PROVIDER_RESPONSE_DELAY_V1_RESULT.json"));
 const pipeline=read(path.join(artifactDirectory,"MCFT_CAP09_REAL_PIPELINE_DELAY_V1_RESULT.json"));
 assert.equal(response.json.status,"PASS","POSTEXEC_REAL_PROVIDER_DELAY_MISSING");
 assert.equal(pipeline.json.status,"PASS","POSTEXEC_REAL_PIPELINE_DELAY_MISSING");
 assert.equal(response.json.run_id,runId);assert.equal(pipeline.json.run_id,runId);
 assert.equal(response.json.subject_sha,subjectSha);assert.equal(pipeline.json.subject_sha,subjectSha);
 // The original Controller's verifyEvidence() is still required for individual
 // event hashes/signed plans. Do not silently promote this structural proof.
 return Object.freeze({schema_version:"geox_mcft_cap09_post_execution_timing_review_v2",
  status:"REAL_STAGE_RECEIPTS_STRUCTURALLY_VERIFIED_PENDING_INDEPENDENT_ADJUDICATION",
  run_id:runId,subject_sha:subjectSha,real_stage_count:6,
  stage_receipts:records,total_monotonic_stage_elapsed_ms:total,
  source_digest:{permit_consumption_sha256:original.sha256,six_stage_audit_sha256:audit.sha256,
   provider_delay_sha256:response.sha256,pipeline_delay_sha256:pipeline.sha256},
  six_case_full_pipeline_proven:false,timing_budget_qualified:false,post_execution_measurement_adopted:false,
  no_new_run_created:true,no_permit_issued:true,no_permit_consumed_by_verifier:true,
  execute_authorized:false,production_authorized:false});
}
module.exports={adjudicatePostExecutionTimingV2};
