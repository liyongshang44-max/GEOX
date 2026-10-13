"use strict";
const assert=require("node:assert/strict");
const {admitProposedRetry}=require("./MCFT_CAP09_ISOLATED_RETRY_ADMISSION_BRIDGE_V1.cjs");
const {ANCHORS}=require("./MCFT_CAP_09_ISOLATED_RETRY_AUTHORITY_POLICY_V1.cjs");
const {HASHES}=require("./MCFT_CAP09_RETRY_HISTORICAL_EVIDENCE_V1.cjs");
const run="abc123def456",head="a".repeat(40),ts="2026-10-11T05:00:00.000Z";
const resources={
 database_host:"127.0.0.1",database_port:55432,audit_user:"qual_admin",
 positive_database:"mcft_cap09_requal_"+run+"_positive",negative_database:"mcft_cap09_requal_"+run+"_negative",
 bucket_endpoint:"http://127.0.0.1:59000",bucket:"mcft-cap09-requal-"+run
};
const evidence_sha256={...ANCHORS,...HASHES,retry_adjudication:"c".repeat(64)};
const arm={
 schema_version:"geox_mcft_cap09_isolated_retry_arm_v1",mode:"ISOLATED_QUALIFICATION",
 parent_run_id:"72dc0304a21a",run_id:run,attempt_ordinal:2,
 protected_main_sha:head,first_execution_provider_calls:null,
 output_directory:"D:\\gptdown\\out-"+run,
 production_recovery_authorized:false,owner_cutover_authorized:false,
 formal_v5_authorized:false,a0_authorized:false,o00_o23_authorized:false,
 automatic_retry_authorized:false,historical_reset_authorized:false,
 retry_adjudication:{decision_id:"synthetic-test-only",retry_admissible:true,
 prior_denial_explicitly_superseded:true,unknown_provider_count_acknowledged:true,
 run_id:run,protected_main_sha:head},resources,evidence_sha256,
 authorized_at:"2026-10-11T04:59:00.000Z",expires_at:"2026-10-11T06:00:00.000Z"
};
const observed={
 head,protected_main:head,source_clean:true,windows_postmerge_verified:true,
 qcp_blocker_count:0,inherited_qcp_check_count:51,frozen_runtime_paths_verified:108,
 original_evidence_preserved:true,output_exists:false,output_seen_in_attempt_ledger:false,
 output_directory:arm.output_directory,evidence_sha256,resources,
 fresh_readback:{status:"PASS",run_id:run,all_rows_zero:true,bucket_empty_including_versions_multipart:true,production_bindings_present:false},
 now_utc:ts,provider_deadline_utc:"2026-10-11T05:15:00.000Z",
 provider_data_available:true,provider_causal_visibility:true,
 fresh_readback_current:true,owner_isolation_verified:true,
 measured_worst_case_ms:300000,deadline_safety_margin_ms:120000
};
let count=0;
const result=admitProposedRetry(arm,observed);
assert.equal(result.execute_authorized,false);assert.equal(result.authority_adopted,false);count++;
for (const [key,value] of [
 ["run_id",arm.parent_run_id],["attempt_ordinal",1],["protected_main_sha","b".repeat(40)],
 ["first_execution_provider_calls",0],["formal_v5_authorized",true],
 ["automatic_retry_authorized",true],["output_directory","old"]
]) {assert.throws(()=>admitProposedRetry({...arm,[key]:value},observed));count++;}
for(const [key,value] of [
 ["head","b".repeat(40)],["source_clean",false],["qcp_blocker_count",1],
 ["frozen_runtime_paths_verified",107],["original_evidence_preserved",false],
 ["output_exists",true],["output_seen_in_attempt_ledger",true],
 ["provider_data_available",false],["provider_causal_visibility",false],
 ["fresh_readback_current",false],["owner_isolation_verified",false],
 ["measured_worst_case_ms",1000000]
]) {assert.throws(()=>admitProposedRetry(arm,{...observed,[key]:value}));count++;}
assert.throws(()=>admitProposedRetry({...arm,retry_adjudication:{...arm.retry_adjudication,prior_denial_explicitly_superseded:false}},observed));count++;
assert.throws(()=>admitProposedRetry({...arm,evidence_sha256:{...evidence_sha256,first_started:"0".repeat(64)}},observed));count++;
assert.throws(()=>admitProposedRetry({...arm,resources:{...resources,bucket:"geox-mcft-cap09-formal-raw-v1"}},observed));count++;
assert.throws(()=>admitProposedRetry(arm,{...observed,fresh_readback:{...observed.fresh_readback,bucket_empty_including_versions_multipart:false}}));count++;
for(const evidence of [
 {...evidence_sha256,retry_adjudication:HASHES.postflight_v4},
 {...evidence_sha256,retry_adjudication:HASHES.artifact_closure_v5},
 {...evidence_sha256,audit_v6:"c".repeat(64)},
 {...evidence_sha256,retry_adjudication:null},
 {...evidence_sha256,audit_v2:"f".repeat(64)}
]) {assert.throws(()=>admitProposedRetry({...arm,evidence_sha256:evidence},{...observed,evidence_sha256:evidence}));count++;}
assert.throws(()=>admitProposedRetry({...arm,resources:{...resources,audit_user:"postgres"}},{...observed,resources:{...resources,audit_user:"postgres"}}));count++;

// Dedicated run must use its authenticated principal and loopback 55434.
const dedicatedRun="800c023cf337";
const dedicatedResources={...resources,database_port:55434,audit_user:"qual_dedicated_admin",
 positive_database:"mcft_cap09_requal_"+dedicatedRun+"_positive",
 negative_database:"mcft_cap09_requal_"+dedicatedRun+"_negative",
 bucket:"mcft-cap09-requal-"+dedicatedRun};
const dedicatedArm={...arm,run_id:dedicatedRun,resources:dedicatedResources,
 retry_adjudication:{...arm.retry_adjudication,run_id:dedicatedRun}};
const dedicatedObserved={...observed,resources:dedicatedResources,
 fresh_readback:{...observed.fresh_readback,run_id:dedicatedRun}};
assert.equal(admitProposedRetry(dedicatedArm,dedicatedObserved).execute_authorized,false);count++;
for(const bad of [
 {...dedicatedResources,audit_user:"qual_admin"},
 {...dedicatedResources,database_port:55432},
 {...dedicatedResources,positive_database:resources.positive_database},
 {...dedicatedResources,bucket:resources.bucket}
]) {assert.throws(()=>admitProposedRetry({...dedicatedArm,resources:bad},{...dedicatedObserved,resources:bad}));count++;}
console.log(JSON.stringify({status:"PASS",negative_and_boundary_test_count:count,execute_authorized:false,authority_adopted:false,production_runtime_unchanged:true}));
