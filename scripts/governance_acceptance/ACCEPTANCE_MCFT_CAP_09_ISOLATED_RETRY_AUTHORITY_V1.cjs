#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), cp = require("node:child_process");
const p = require("./MCFT_CAP_09_ISOLATED_RETRY_AUTHORITY_POLICY_V1.cjs");
const ROOT = path.resolve(__dirname, "../..");
let negativeCases = 0;
assert.equal(p.validateDisabledArm(JSON.parse(fs.readFileSync(path.join(ROOT,p.ARM_PATH),"utf8"))).execute_authorized,false);
for (const mutation of [{armed:true},{mode:"ISOLATED_QUALIFICATION"},{retry_authorized:true},{run_id:"abcdef123456"},{extra:true}]) {
  assert.throws(() => p.validateDisabledArm({...structuredClone(p.DEFAULT_ARM),...mutation})); negativeCases++;
}
// Synthetic fixtures only: these hashes, identities and clocks are not live proof.
function fixture() {
  const arm = {...structuredClone(p.DEFAULT_ARM), armed:true, mode:"ISOLATED_QUALIFICATION",
    run_id:"abcdef123456", attempt_ordinal:2, protected_main_sha:"a".repeat(40),
    authorized_at:"2030-01-01T00:00:00.000Z", qualification_first_base:"2030-01-01T08:00:00.000Z",
    expires_at:"2030-01-01T12:00:00.000Z", execute_authorized:true, retry_authorized:true,
    output_directory:"D:\\gptdown\\isolated-evidence-abcdef123456-attempt2",
    evidence_sha256:{...p.ANCHORS,audit_v2:"b".repeat(64),audit_v6:"c".repeat(64)},
    resources:{database_host:"127.0.0.1",database_port:55432,audit_user:"qual_admin",
      negative_database:"mcft_cap09_requal_abcdef123456_negative",positive_database:"mcft_cap09_requal_abcdef123456_positive",
      bucket_endpoint:"http://127.0.0.1:59000",bucket:"mcft-cap09-requal-abcdef123456"},
  };
  arm.retry_adjudication = {decision_id:"SYNTHETIC_TEST_ONLY",retry_admissible:true,
    prior_denial_explicitly_superseded:true,unknown_provider_count_acknowledged:true,
    protected_main_sha:arm.protected_main_sha,run_id:arm.run_id,authorized_at:arm.authorized_at,first_failure_phase:"UNKNOWN"};
  const observed = {now:"2030-01-01T00:02:00.000Z",head:arm.protected_main_sha,protected_main:arm.protected_main_sha,
    clean_source:true,windows_postmerge_verified:true,qcp_blocker_count:0,inherited_qcp_check_count:51,
    frozen_runtime_paths_verified:108,resources:structuredClone(arm.resources),evidence_sha256:structuredClone(arm.evidence_sha256),
    output_directory:arm.output_directory,output_exists:false,output_seen_in_attempt_ledger:false,original_evidence_preserved:true,
    fresh_readback:{source_head:arm.protected_main_sha,started_at:"2030-01-01T00:01:00.000Z",
      completed_at:"2030-01-01T00:01:30.000Z",owner_isolation_verified:true,production_bindings_present:false,
      databases:[arm.resources.negative_database,arm.resources.positive_database].map(database=>({database,status:"READBACK_PASS",username:"qual_admin",table_count:29,all_rows_zero:true})),
      bucket:Object.fromEntries(["current","versions","delete_markers","multipart"].map(k=>[k,{status:"READBACK_PASS",count:0,truncated:false}]))},
  };
  return {arm,observed};
}
const good = fixture();
assert.deepEqual(p.assessActivationProposal(good.arm,good.observed),{
  status:"PROPOSAL_PRECONDITIONS_PASS_NOT_EXECUTION_AUTHORITY",execute_authorized:false,retry_authorized:false,activation_implemented:false});
const mutations = [
  a=>a.armed=false, a=>a.mode="PRODUCTION_RECOVERY", a=>a.run_id="72dc0304a21a",
  a=>a.attempt_ordinal=1, a=>a.first_execution_provider_calls=0,
  a=>a.retry_adjudication=null, a=>a.retry_adjudication.retry_admissible=false,
  a=>a.retry_adjudication.prior_denial_explicitly_superseded=false,
  a=>a.retry_adjudication.unknown_provider_count_acknowledged=false,
  a=>a.retry_adjudication.protected_main_sha="b".repeat(40),
  a=>a.retry_adjudication.first_failure_phase="BEFORE_PROVIDER",
  a=>a.execute_authorized=false, a=>a.retry_authorized=false,
  a=>a.qualification_first_base="2026-10-11T00:00:00.000Z",
  a=>a.qualification_first_base="2030-01-01T06:02:00.000Z",
  a=>a.authorized_at="2030-01-01T00:03:00.000Z",
  a=>a.expires_at="2030-01-01T00:01:00.000Z",
  a=>a.expires_at="2030-01-02T00:00:00.001Z",
  a=>a.resources.bucket="geox-mcft-cap09-formal-raw-v1",
  a=>a.resources.bucket_endpoint="https://external.example.invalid",
  a=>a.resources.database_host="192.0.2.1", a=>a.resources.audit_user="postgres",
  a=>a.evidence_sha256.first_failed_receipt="d".repeat(64),
  a=>a.evidence_sha256.audit_v2=null,
  (a,o)=>o.head="b".repeat(40), (a,o)=>o.protected_main="b".repeat(40),
  (a,o)=>o.clean_source=false, (a,o)=>o.windows_postmerge_verified=false,
  (a,o)=>o.qcp_blocker_count=1, (a,o)=>o.inherited_qcp_check_count=50,
  (a,o)=>o.frozen_runtime_paths_verified=107,
  (a,o)=>o.evidence_sha256.audit_v6="d".repeat(64),
  (a,o)=>o.now="2030-01-01T00:07:00.000Z",
  (a,o)=>o.fresh_readback.started_at="2029-12-31T23:59:00.000Z",
  (a,o)=>o.fresh_readback.completed_at="2030-01-01T00:03:00.000Z",
  (a,o)=>o.fresh_readback.owner_isolation_verified=false,
  (a,o)=>o.fresh_readback.production_bindings_present=true,
  (a,o)=>o.fresh_readback.databases[0].all_rows_zero=null,
  (a,o)=>o.fresh_readback.databases[0].table_count=28,
  (a,o)=>o.fresh_readback.databases[1].database=o.fresh_readback.databases[0].database,
  (a,o)=>o.output_exists=true, (a,o)=>o.output_seen_in_attempt_ledger=true,
  (a,o)=>o.original_evidence_preserved=false,
];
for (const key of ["production_recovery_authorized","owner_cutover_authorized","formal_v5_authorized","a0_authorized",
  "o00_o23_authorized","automatic_retry_authorized","historical_reset_authorized"]) mutations.push(a=>a[key]=true);
for (const key of ["current","versions","delete_markers","multipart"]) {
  mutations.push((a,o)=>o.fresh_readback.bucket[key].count=1);
  mutations.push((a,o)=>o.fresh_readback.bucket[key].truncated=true);
}
for (const mutate of mutations) {
  const {arm,observed}=fixture();mutate(arm,observed);
  assert.throws(()=>p.assessActivationProposal(arm,observed),String(mutate));negativeCases++;
}
const cli=cp.spawnSync(process.execPath,[path.join(__dirname,"MCFT_CAP_09_ISOLATED_RETRY_AUTHORITY_POLICY_V1.cjs")],{cwd:ROOT,encoding:"utf8"});
assert.equal(cli.status,2,cli.stderr);assert.equal(JSON.parse(cli.stdout).status,"EXECUTE_HOLD");
const override=cp.spawnSync(process.execPath,[path.join(__dirname,"MCFT_CAP_09_ISOLATED_RETRY_AUTHORITY_POLICY_V1.cjs"),"--arm=other.json"],{cwd:ROOT,encoding:"utf8"});
assert.equal(override.status,1);negativeCases++;
console.log(JSON.stringify({status:"PASS",negative_cases:negativeCases,default_arm_disabled:true,execute_authorized:false,
  retry_authorized:false,provider_requests:0,database_writes:0,object_writes:0}));
