"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const binding=require("./MCFT_CAP09_TEST_ONLY_BINDING_V1.cjs");
const C=binding.constants();
const root="C:\\repo";
const now=Date.parse("2026-10-12T00:00:00.000Z");
const env={
  MCFT_CAP09_TEST_ONLY_BINDING:"1",
  MCFT_CAP09_TEST_ONLY_RUN_ID:C.RUN_ID,
  DATABASE_URL:`postgres://${C.EVIDENCE_LOGIN_ROLE}:abcdefghijklmnop@127.0.0.1:55432/${C.POSITIVE_DB}`,
  BLOCKED_DATABASE_URL:`postgres://${C.EVIDENCE_LOGIN_ROLE}:abcdefghijklmnop@127.0.0.1:55432/${C.NEGATIVE_DB}`,
  MCFT_CAP09_FORMAL_RAW_ENDPOINT:C.S3_ENDPOINT,
  MCFT_CAP09_FORMAL_RAW_BUCKET:C.BUCKET,
  MCFT_CAP09_FORMAL_RAW_REGION:"us-east-1",
  MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID:C.S3_PRINCIPAL,
  MCFT_CAP09_FORMAL_RAW_SECRET_ACCESS_KEY:"0123456789abcdef0123456789abcdef",
  MCFT_CAP09_TEST_ONLY_S3_PRINCIPAL:C.S3_PRINCIPAL,
  MCFT_QUALIFICATION_FIRST_BASE:"2026-10-12T04:00:00.000Z",
  MCFT_CURRENT_QUALIFICATION_OUTPUT_DIR:"C:\\evidence\\run-"+C.RUN_ID,
  MCFT_CAP09_TEST_ONLY_LEDGER_DIR:"C:\\ledger\\run-"+C.RUN_ID,
};
const context={platform:"win32",ci:false,head:"a".repeat(40),main:"a".repeat(40),clean:true,base_ancestor:true,frozen_runtime_identical:true};
let checks=0;
function pass(e=env,c=context){
  const r=binding.validateBinding({env:{...e},context:{...c},root,nowMs:now});
  assert.equal(r.run_id,C.RUN_ID);assert.equal(r.evidence_login_role,C.EVIDENCE_LOGIN_ROLE);checks++;
}
function fail(label,mutateEnv,mutateContext){
  const e={...env},c={...context}; if(mutateEnv)mutateEnv(e);if(mutateContext)mutateContext(c);
  assert.throws(()=>binding.validateBinding({env:e,context:c,root,nowMs:now}),label);checks++;
}
pass();
fail(/EXACT_OWNER_APPROVED_RUN/,e=>e.MCFT_CAP09_TEST_ONLY_RUN_ID="72dc0304a21a");
fail(/CI_FORBIDDEN/,null,c=>c.ci=true);
fail(/WINDOWS_LOCAL_ONLY/,null,c=>c.platform="linux");
fail(/EXACT_PROTECTED_MAIN/,null,c=>c.main="b".repeat(40));
fail(/CLEAN_SOURCE/,null,c=>c.clean=false);
fail(/FROZEN_RUNTIME_DRIFT/,null,c=>c.frozen_runtime_identical=false);
fail(/DB_EVIDENCE_LOGIN_REQUIRED/,e=>e.DATABASE_URL=`postgres://qual_admin:abcdefghijklmnop@127.0.0.1:55432/${C.POSITIVE_DB}`);
fail(/DB_NAME_MISMATCH/,e=>e.BLOCKED_DATABASE_URL=`postgres://${C.EVIDENCE_LOGIN_ROLE}:abcdefghijklmnop@127.0.0.1:55432/wrong`);
fail(/S3_ENDPOINT_MISMATCH/,e=>e.MCFT_CAP09_FORMAL_RAW_ENDPOINT="http://127.0.0.1:9000");
fail(/S3_BUCKET_MISMATCH/,e=>e.MCFT_CAP09_FORMAL_RAW_BUCKET="geox-mcft-cap09-formal-raw-v1");
fail(/S3_SCOPED_PRINCIPAL_REQUIRED/,e=>e.MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID="minioadmin");
fail(/S3_PRINCIPAL_ATTESTATION_REQUIRED/,e=>e.MCFT_CAP09_TEST_ONLY_S3_PRINCIPAL="other");
fail(/FUTURE_BASE_REQUIRED/,e=>e.MCFT_QUALIFICATION_FIRST_BASE="2026-10-11T23:00:00.000Z");
fail(/OUTPUT_OUTSIDE_REPO_REQUIRED/,e=>e.MCFT_CURRENT_QUALIFICATION_OUTPUT_DIR="C:\\repo\\run-"+C.RUN_ID);
fail(/LEDGER_RUN_ID_REQUIRED/,e=>e.MCFT_CAP09_TEST_ONLY_LEDGER_DIR="C:\\ledger\\other");
const currentSource=fs.readFileSync(path.join(__dirname,"MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs"),"utf8");
const producerSource=fs.readFileSync(path.join(__dirname,"RUN_MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2.ts"),"utf8");
const timingSource=fs.readFileSync(path.join(__dirname,"RUN_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_V2.ts"),"utf8");
const trust=JSON.parse(fs.readFileSync(path.join(__dirname,"MCFT_CAP09_RETRY_TRUST_V1.json"),"utf8"));
assert(currentSource.includes('process.env.MCFT_CAP09_TEST_ONLY_BINDING === "1"'),"TEST_ONLY_TARGET_ROUTING_MISSING");checks++;
assert(producerSource.includes('currentTargets.evidence_login_role ?? "geox_mcft_cap09_evidence_runtime_login_v1"'),"PRODUCER_DEFAULT_ROLE_FALLBACK_MISSING");checks++;
assert(timingSource.includes('currentTargets.evidence_login_role ?? "geox_mcft_cap09_evidence_runtime_login_v1"'),"TIMING_DEFAULT_ROLE_FALLBACK_MISSING");checks++;
assert.equal(trust.adopted,false);assert.equal(trust.execution_enabled,false);checks++;

const runner=require("./RUN_MCFT_CAP09_TEST_ONLY_QUALIFICATION_V1.cjs");
assert.deepEqual(runner.parseArgs(["--operator-authorized","--test-only","--preflight-only","--producer"]),
  {execute:false,task:"--producer"});checks++;
assert.throws(()=>runner.parseArgs(["--operator-authorized","--test-only","--execute","--preflight-only","--producer"]),/SELECT_ONE_EXECUTION_MODE/);checks++;
assert.throws(()=>runner.parseArgs(["--operator-authorized","--test-only","--execute","--producer","--timing"]),/SELECT_ONE_TASK/);checks++;
assert.throws(()=>runner.parseArgs(["--operator-authorized","--test-only","--execute","--producer","--wat"]),/UNKNOWN_ARGUMENT/);checks++;

console.log("MCFT_CAP09_TEST_ONLY_BINDING_ACCEPTANCE_PASS checks:"+checks);
