"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const gate=require("./MCFT_CAP09_STAGE3_TIMING_ORIGINAL_EQUIVALENCE_GATE_V1.cjs");
gate.originalEntriesUnchanged();
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"cap09-stage3-equivalence-negative-"));
let passed=0;
try{
 const files=[1,2,3].map(i=>{
  const obj={schema_version:"geox_mcft_cap09_stage3_isolated_real_physical_timing_sample_v1",
   status:"PASS",sample_id:"sample"+i,subject_sha:"496951f099c5a6bf6b17e2ffd7972190faabe532",
   test_run_id:"11aaaa11aab"+i,provider_capture_mode:"CONTROLLED_IN_PROCESS_FIXTURE_NOT_LIVE_GFS_KBS",
   original_v13_timing_sample_v2_entry_executed:false,permit_consumed:false,production_authorized:false,
   timing_phases:{wake_delay_ms:0,job_start_setup_ms:100,provider_capture_ms:30,
    retained_raw_and_candidate_ms:20,promotion_queue_and_setup_ms:10,
    rehydration_promotion_commit_readback_ms:15},measured_end_to_end_ms:175};
  const file=path.join(dir,"sample"+i+".json");fs.writeFileSync(file,JSON.stringify(obj));
  return file;
 });
 const result=gate.review(files);
 assert.equal(result.status,gate.STATUS);assert.equal(result.qualified,false);
 assert.equal(result.original_v13_controlled_delay_admitted,false);
 assert.equal(result.original_v13_aggregate_admitted,false);
 assert.equal(result.samples.length,3);passed++;
 assert(result.reason_codes.some(x=>x.includes("FIXTURE_PROVIDER")));passed++;
 const first=JSON.parse(fs.readFileSync(files[0],"utf8"));
 fs.writeFileSync(files[0],JSON.stringify({...first,measured_end_to_end_ms:176}));
 assert.throws(()=>gate.review(files),/V13_FORMULA_RECONCILIATION_FAILED/);passed++;
 fs.writeFileSync(files[0],JSON.stringify({...first,original_v13_timing_sample_v2_entry_executed:true}));
 assert.throws(()=>gate.review(files),/AssertionError|Expected values/);passed++;
 fs.writeFileSync(files[0],JSON.stringify(first));
 const witness={schema_version:"geox_mcft_cap09_stage3_real_provider_readonly_transport_witness_v1",
  real_https_success_events:6,permit_consumed:false,production_authorized:false};
 const wf=path.join(dir,"real-transport.json");fs.writeFileSync(wf,JSON.stringify(witness));
 const r=gate.review(files,wf);assert.equal(r.status,gate.STATUS);
 assert.equal(r.live_https_response_count,6);assert.equal(r.provider_72h_complete_real_capture_qualified,false);passed++;
 console.log(JSON.stringify({status:"PASS",checks:passed,original_frozen_stage_blobs_unchanged:true,
  original_timing_equivalence:"HOLD",genuine_pipeline_proven:false,permit:false}));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
