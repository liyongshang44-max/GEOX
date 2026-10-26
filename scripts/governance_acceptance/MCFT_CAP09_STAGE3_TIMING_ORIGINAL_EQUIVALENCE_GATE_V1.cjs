"use strict";
// Fail closed before actual Controlled Delay / original Aggregate. Do not
// promote live HTTPS directory probes or local fixture PG timings to the
// original V13 timing semantics, genuine 72h Provider, or Permit authority.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),cp=require("node:child_process");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const ORIGINAL="scripts/runtime_acceptance/RUN_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_V2.ts";
const PHASES=["wake_delay_ms","job_start_setup_ms","provider_capture_ms","retained_raw_and_candidate_ms",
"promotion_queue_and_setup_ms","rehydration_promotion_commit_readback_ms"];
const STATUS="HOLD_ORIGINAL_TIMING_AND_PROVIDER_SEMANTICS_NOT_EQUIVALENT";
function read(file){const s=fs.lstatSync(file);assert(s.isFile()&&!s.isSymbolicLink()&&s.size<2_000_000);return JSON.parse(fs.readFileSync(file,"utf8"));}
const FROZEN_SHA="12dcbba6750879f0349c5730f477cb04cd23b560";
const FROZEN_ENTRIES=[
 ["scripts/runtime_acceptance/RUN_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_V2.ts","4b30a11186b80b9d37da252b735332202ef94a9d"],
 ["scripts/runtime_acceptance/AGGREGATE_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V2.ts","830900fcca5a858cd7cc54612bdd41721d88ef55"],
 ["scripts/runtime_acceptance/MCFT_CAP09_REAL_CONTROLLED_DELAY_V1.cjs","11f57189a6d6bd236aea21f31259027bbbe095c4"]
];
function originalEntriesUnchanged(root=path.resolve(__dirname,"../..")){
 for(const [file,want] of FROZEN_ENTRIES){
  const historic=cp.execFileSync("git",["rev-parse",FROZEN_SHA+":"+file],{cwd:root,encoding:"utf8"}).trim();
  const candidate=cp.execFileSync("git",["rev-parse","HEAD:"+file],{cwd:root,encoding:"utf8"}).trim();
  const working=cp.execFileSync("git",["hash-object",file],{cwd:root,encoding:"utf8"}).trim();
  assert.equal(historic,want,"STAGE3_ORIGINAL_ENTRY_PIN_MISMATCH:"+file);
  assert.equal(candidate,want,"STAGE3_ORIGINAL_ENTRY_CANDIDATE_CHANGED:"+file);
  assert.equal(working,want,"STAGE3_ORIGINAL_ENTRY_WORKTREE_CHANGED:"+file);
 }
 return true;
}
function review(files,providerWitness=null){
 originalEntriesUnchanged();
 assert(Array.isArray(files)&&files.length===3,"THREE_TIMING_INPUTS_REQUIRED");
 const reasons=[],samples=[];
 const seen=new Set();
 for(let i=0;i<3;i++){
  const f=files[i],s=read(f);
  assert.equal(s.schema_version,"geox_mcft_cap09_stage3_isolated_real_physical_timing_sample_v1");
  assert.equal(s.status,"PASS");assert.equal(s.sample_id,"sample"+(i+1));
  assert(!seen.has(s.test_run_id),"TIMING_DISTINCT_EXECUTION_REQUIRED");seen.add(s.test_run_id);
  assert.equal(s.subject_sha,"496951f099c5a6bf6b17e2ffd7972190faabe532","TIMING_EXACT_OBSERVED_CANDIDATE_BINDING_REQUIRED");
  const total=PHASES.reduce((a,k)=>{const v=s.timing_phases[k];assert(Number.isSafeInteger(v)&&v>=0);return a+v;},0);
  assert.equal(s.measured_end_to_end_ms,total,"V13_FORMULA_RECONCILIATION_FAILED");
  assert.equal(s.permit_consumed,false);assert.equal(s.production_authorized,false);
  assert.equal(s.original_v13_timing_sample_v2_entry_executed,false);
  assert.equal(s.provider_capture_mode,"CONTROLLED_IN_PROCESS_FIXTURE_NOT_LIVE_GFS_KBS");
  reasons.push("TIMING_"+(i+1)+"_FIXTURE_PROVIDER_NOT_REAL_CAPTURE");
  reasons.push("TIMING_"+(i+1)+"_ORIGINAL_V2_ENTRY_NOT_EXECUTED");
  samples.push({sample_id:s.sample_id,run_id:s.test_run_id,local_elapsed_ms:total,physical_sha256:sha(fs.readFileSync(f))});
 }
 let live=null;
 if(providerWitness){
  live=read(providerWitness);
  assert.equal(live.schema_version,"geox_mcft_cap09_stage3_real_provider_readonly_transport_witness_v1");
  assert.equal(live.permit_consumed,false);assert.equal(live.production_authorized,false);
  reasons.push("LIVE_HTTPS_TRANSPORT_ONLY_NOT_72H_GFS_CAPTURE");
  reasons.push("LIVE_TRANSPORT_TIMES_NOT_INJECTED_IN_S3_PG_TIMING_PHASES");
 }else{reasons.push("NO_LIVE_PROVIDER_TRANSPORT_WITNESS");}
 return {schema_version:"geox_mcft_cap09_stage3_original_timing_semantic_equivalence_review_v1",status:STATUS,
  frozen_original_v13_timing_entry:ORIGINAL,
  reviewed_exactly_three_isolated_timing_samples:true,isolated_timing_execution_sha:"496951f099c5a6bf6b17e2ffd7972190faabe532",samples,
  timing_formula_reconciled:true,live_transport_witness_present:!!live,
  live_https_response_count:live?.real_https_success_events??0,
  original_v13_timing_semantic_equivalence_proven:false,
  provider_72h_complete_real_capture_qualified:false,
  original_v13_controlled_delay_admitted:false,original_v13_aggregate_admitted:false,
  formal_timing_budget_qualified:false,qualified:false,permit_signed:false,permit_consumed:false,
  production_authorized:false,reason_codes:reasons};
}
if(require.main===module){try{
 assert(process.argv.length===5||process.argv.length===6,"USAGE: node gate sample1 sample2 sample3 [provider_witness]");
 const r=review(process.argv.slice(2,5),process.argv[5]??null);
 console.log(JSON.stringify(r,null,2));
 // HOLD is the EXPECTED result, negative control must never mark graduation.
 if(r.status!==STATUS||r.qualified)process.exitCode=1;
}catch(e){console.error("TIMING_ORIGINAL_EQUIVALENCE_REVIEW_HOLD:"+String(e.message||e));process.exitCode=1;}}
module.exports={review,STATUS,PHASES,originalEntriesUnchanged};
