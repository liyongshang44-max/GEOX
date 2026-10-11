"use strict";
const assert=require("node:assert/strict");
const {assessIsolatedReadiness:check}=require("./MCFT_CAP09_ISOLATED_EVIDENCE_DRIVEN_CLOCK_V1.cjs");
const good={
 now_utc:"2026-10-11T05:00:00.000Z",authorized_at_utc:"2026-10-11T04:59:00.000Z",
 expires_at_utc:"2026-10-11T06:00:00.000Z",provider_deadline_utc:"2026-10-11T05:15:00.000Z",
 source_exact_main:true,source_clean:true,retry_adjudicated:true,prior_attempt_preserved:true,
 data_available:true,provider_observation_causally_visible:true,resources_fresh:true,
 owner_isolation_verified:true,run_output_absent:true,measured_worst_case_ms:300000,
 deadline_safety_margin_ms:120000
};
let count=0;
const pass=check(good);assert.equal(pass.execute_authorized,false);count++;
// No artificial six-hour lead; real deadline headroom remains mandatory.
assert.equal(pass.remaining_ms,900000);count++;
for(const [key,value] of [
 ["source_exact_main",false],["source_clean",false],["retry_adjudicated",false],
 ["prior_attempt_preserved",false],["data_available",false],
 ["provider_observation_causally_visible",false],["resources_fresh",false],
 ["owner_isolation_verified",false],["run_output_absent",false],
 ["measured_worst_case_ms",0],["measured_worst_case_ms",-1],
 ["deadline_safety_margin_ms",0],
 ["provider_deadline_utc","2026-10-11T05:06:00.000Z"],
 ["expires_at_utc","2026-10-11T04:00:00.000Z"],
 ["authorized_at_utc","2026-10-11T06:00:00.000Z"],
 ["now_utc","bad-time"]
]) {assert.throws(()=>check({...good,[key]:value}),undefined,key);count++;}
console.log(JSON.stringify({status:"PASS",test_count:count,qualification_only:true,execute_authorized:false,production_time_contract_unchanged:true}));
