"use strict";
// Aggregate four ACTUAL isolated physical primitive runs ONLY. This is not
// V13 original Timing science or a six-stage Host Aggregate qualification.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const runner=require("./RUN_MCFT_CAP09_STAGE3_FOUR_PHYSICAL_PRIMITIVE_BODIES_V1.cjs");
const sha=x=>crypto.createHash("sha256").update(x).digest("hex");
const IDS=[
 ["PRODUCER","112233aabbcc"],
 ["TIMING_1","112233aabbcd"],
 ["TIMING_2","112233aabbce"],
 ["TIMING_3","112233aabbcf"]
];
function aggregate(root){
 assert(path.isAbsolute(root)&&fs.existsSync(root),"FOUR_ROLE_ARTIFACT_ROOT_MISSING");
 const records=[],runs=new Set(),digestSet=new Set();
 let predecessor="0".repeat(64),sum=0;
 for(const [id,runId] of IDS){
  const dir=path.join(root,"cap09-stage3-real-physical-primitives-"+id+"-"+runId);
  const out=runner.verify(dir,id,runId);
  assert.equal(out.status,"REAL_PHYSICAL_PRIMITIVES_VERIFIED_NOT_ORIGINAL_STAGE_BODIES");
  const full=fs.readFileSync(path.join(dir,"STAGE3_"+id+"_PUBLIC_RECEIPT.json"));
  const rcpt=JSON.parse(full);
  assert.equal(rcpt.producer_or_timing_synthetic,false);
  assert.equal(rcpt.original_producer_timing_entrypoint_executed,false);
  assert.equal(rcpt.permit_consumed,false);
  assert.equal(rcpt.production_authorized,false);
  assert(Number.isSafeInteger(rcpt.wall_clock_business_elapsed_ms)&&rcpt.wall_clock_business_elapsed_ms>=0);
  assert(!runs.has(runId),"FOUR_ROLE_RUN_ID_REUSED");runs.add(runId);
  assert(!digestSet.has(rcpt.physical_body_sha256),"PHYSICAL_RECEIPT_REUSED");digestSet.add(rcpt.physical_body_sha256);
  const hash=sha(full);
  records.push({stage_role:id,test_run_id:runId,source_sha:rcpt.subject_sha,
   physical_body_sha256:rcpt.physical_body_sha256,process_completed_sha256:rcpt.stage_process_completion_sha256,
   public_receipt_sha256:hash,chain_previous_sha256:predecessor,
   measured_real_subprocess_ms:rcpt.wall_clock_business_elapsed_ms,
   physical_business_primitive_exercised:true,governed_original_stage_executed:false});
  predecessor=hash;sum+=rcpt.wall_clock_business_elapsed_ms;
 }
 const elapsed=records.map(x=>x.measured_real_subprocess_ms);
 return {schema_version:"geox_mcft_cap09_stage3_four_physical_primitive_roles_aggregate_v1",
  status:"PASS_FOUR_ACTUAL_PHYSICAL_PRIMITIVE_ROLES_NOT_V13_TIMING_OR_SIX_STAGE",
  frozen_subject_sha:runner.SUBJECT,source_of_truth:"FOUR_GITHUB_ACTIONS_REAL_EPHEMERAL_PG_MINIO_WORKFLOW_ARTIFACTS",
  mode:"PARALLEL_ROLE_OBSERVATIONS_NOT_SEQUENTIAL_HOST_STAGE_CHAIN",
  roles:records,role_count:4,observed_subprocess_elapsed_ms:elapsed,
  observed_subprocess_elapsed_sum_ms:sum,observed_subprocess_elapsed_max_ms:Math.max(...elapsed),
  final_public_receipt_chain_sha256:predecessor,raw_s3_pg_real_physical:true,
  original_governed_stage_entries_executed:false,
  exact_original_v13_timing_phase_samples_collected:false,
  scratch_delay_physical_proven:false,provider_slow_path_proven:false,
  real_provider_capture_executed:false,formal_budget_qualified:false,
  controlled_delay_executed:false,original_v13_aggregate_body_executed:false,
  real_six_stage_count:0,qualified:false,
  operator_attestation_signed:false,permit_signed:false,permit_consumed:false,
  production_authorized:false,formal_v5_armed:false,o00_started:false};
}
function main(){
 assert.equal(process.argv.length,4,"USAGE: node AGGREGATE...cjs ABS_ARTIFACT_ROOT ABS_NEW_OUTPUT_JSON");
 const root=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);
 assert(!fs.existsSync(out),"AGGREGATE_OUTPUT_ALREADY_EXISTS");
 assert(path.isAbsolute(out)&&path.relative(root,out).startsWith(".."+path.sep),"AGGREGATE_OUTPUT_MUST_BE_OUTSIDE_ARTIFACT_ROOT");
 const r=aggregate(root);
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(r,null,2)+"\n",{flag:"wx",mode:0o600});
 console.log(JSON.stringify({status:r.status,role_count:r.role_count,sha256:sha(fs.readFileSync(out)),
   output:out,original_stage_entries_executed:false,permit_consumed:false,qualification:false}));
}
if(require.main===module){try{main()}catch(e){console.error("STAGE3_AGGREGATE_HOLD:"+String(e.stack||e));process.exitCode=1;}}
module.exports={aggregate,IDS};
