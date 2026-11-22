"use strict";
// CTO #3780 successor QCP negative tests. This tests exact source admission,
// preserved old Stage3/DA9/Frozen108 scope, and fake/tampered applications.
// It never opens any credential, connects mc/PG/S3, signs, runs Host or Permit.
const test=require("node:test"),assert=require("node:assert/strict");
const v=require("./VERIFY_MCFT_CAP09_R4285_MC_ADMIN_SUCCESSOR_V1.cjs");
test("exact 7-file successor scope accepted; added or missing files rejected",()=>{
 assert.equal(v.EXPECTED_PATHS.length,7);
 assert(v.exactPathBoundary(v.EXPECTED_PATHS));
 for(const changed of [
  [...v.EXPECTED_PATHS,"scripts/runtime_acceptance/MCFT_CAP09_R4285_WINDOWS_HOST_EXEC_V3.cjs"],
  v.EXPECTED_PATHS.slice(1),
  [...v.EXPECTED_PATHS,v.EXPECTED_PATHS[0]],
  v.EXPECTED_PATHS.map(x=>x.includes("MCFT_CAP09_R4285_RESOURCE_OWNER_PRODUCER_V3")?"unapproved.cjs":x)
 ])assert.throws(()=>v.exactPathBoundary(changed));
});
test("A128 source pin and test pin differ from original immutable base",()=>{
 for(const x of [v.SOURCE_BASE_BLOB,v.SOURCE_HEAD_BLOB,v.TEST_BASE_BLOB,v.TEST_HEAD_BLOB])
  assert.match(x,/^[0-9a-f]{40}$/);
 assert.notEqual(v.SOURCE_BASE_BLOB,v.SOURCE_HEAD_BLOB);
 assert.notEqual(v.TEST_BASE_BLOB,v.TEST_HEAD_BLOB);
});
test("fourteen original QCP failures are enumerated exactly and not universally N/A",()=>{
 assert.equal(v.SCOPED_IDS.length,14);
 assert.equal(new Set(v.SCOPED_IDS).size,14);
 assert.equal(v.SCIENCE.size,7);
 assert(v.SCOPED_IDS.includes("STAGE3_20261025_NONAUTHORIZING_EXACT_PATH_REQUALIFICATION"));
 assert(v.SCOPED_IDS.includes("CAP09_R4285_HOST_ADMISSION_V2_EXACT_SOURCE_REVIEW_V1"));
 const plan={decisions:[...v.SCOPED_IDS,v.CURRENT].map(id=>({check_id:id,status:"REQUALIFY"}))};
 const projection=Object.fromEntries(v.SCOPED_IDS.map(id=>[id,{
  dependency_count:10,unchanged_operational_dependency_count:10,qualification_wiring_delta:[],
  proven_no_changed_operational_blobs:true,evidence_from_frozen_subject_reissued:false
 }]));
 const rows=v.rowsFor({authority:{},plan,projection,
  historical:{historical_3730_frozen_blobs_verified:6,current_baseline_drift_preserved:true},
  baseline:{qcp_run_id:44887860609},tests:[{file:"SYNTHETIC_NONLIVE",exit_code:0}],head:"a".repeat(40)});
 assert.equal(Object.keys(rows).length,15);
 assert.equal(rows.STAGE3_20261025_NONAUTHORIZING_EXACT_PATH_REQUALIFICATION.status,"PASS");
 assert.equal(rows[v.CURRENT].status,"PASS");
 assert.equal(rows.V13_AUTONOMOUS_FORCING_FOUNDATION.status,"NOT_APPLICABLE");
 assert(rows.V13_AUTONOMOUS_FORCING_FOUNDATION.old_scientific_result_requalified===false);
 assert(rows.DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_PENDING.old_historical_pr_rewritten===false);
 assert(rows[v.CURRENT].windows_native_physical_receiver_executed===false);
 assert(rows[v.CURRENT].permit_consumed===false);
});
test("source qualification cannot be invoked from unregistered authority, wrong base or forged subject",()=>{
 // All failures are before any GitHub API or physical control-plane command.
 const root=require("node:path").resolve(__dirname,"../..");
 for(const args of [
  {base:"0".repeat(40),head:"a".repeat(40)},
  {base:v.BASE,head:"x".repeat(40)},
  {base:v.BASE,head:"0".repeat(40)}
 ]) {
  const answer=v.verifyProducerAdminSuccessor({ROOT:root,args,authority:{},plan:{},changed:[],stage:"SUCCESSOR_SUBJECT_PRE_MERGE"});
  assert.equal(answer.status,"FAIL");
  assert.equal(answer.permit_consumed,false);
  assert.equal(answer.host_started,false);
  assert.equal(answer.stages,0);
 }
});
test("historical-only PR event and product source are immutable in same candidate",()=>{
 assert.equal(v.BRANCH,"fix/r4285-a128-native-mc-admin-child-only-20261122");
 assert(!v.EXPECTED_PATHS.some(x=>/TRUST_V2\.json|WINDOWS_HOST_EXEC|PERMIT_ATOMIC|FINAL/i.test(x)));
 assert(v.EXPECTED_PATHS.includes(v.CONTROL));
 assert(v.EXPECTED_PATHS.includes(v.PREFLIGHT));
 assert(v.EXPECTED_PATHS.includes(v.WORKFLOW));
 assert(v.EXPECTED_PATHS.includes(v.VERIFIER));
 assert(v.EXPECTED_PATHS.includes(v.NEGATIVE));
});
