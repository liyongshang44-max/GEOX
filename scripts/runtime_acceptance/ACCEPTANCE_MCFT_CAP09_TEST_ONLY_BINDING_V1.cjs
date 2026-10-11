"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),ts=require("typescript");
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
  MCFT_QUALIFICATION_FIRST_BASE:"2026-10-12T08:00:00.000Z",
  MCFT_CURRENT_QUALIFICATION_OUTPUT_DIR:"C:\\evidence\\run-"+C.RUN_ID,
  MCFT_CAP09_TEST_ONLY_LEDGER_DIR:"C:\\ledger\\run-"+C.RUN_ID
};
const context={
  platform:"win32",ci:false,head:"a".repeat(40),main:"a".repeat(40),
  clean:true,base_ancestor:true,frozen_runtime_identical:true
};
let checks=0;
function pass(e=env,c=context){
  const r=binding.validateBinding({env:{...e},context:{...c},root,nowMs:now});
  assert.equal(r.run_id,C.RUN_ID);assert.equal(r.evidence_login_role,C.EVIDENCE_LOGIN_ROLE);
  assert.equal(r.s3_principal,C.S3_PRINCIPAL);checks++;
}
function fail(pattern,mutateEnv,mutateContext){
  const e={...env},c={...context};
  if(mutateEnv)mutateEnv(e);if(mutateContext)mutateContext(c);
  assert.throws(()=>binding.validateBinding({env:e,context:c,root,nowMs:now}),pattern);checks++;
}
pass();
fail(/EXACT_OWNER_APPROVED_RUN/,e=>e.MCFT_CAP09_TEST_ONLY_RUN_ID="72dc0304a21a");
fail(/GOVERNED_RETRY_CONTEXT_FORBIDDEN/,e=>e.MCFT_GOVERNED_RETRY_STAGE="PRODUCER");
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
fail(/FUTURE_BASE_LEAD_GT_6H_REQUIRED/,e=>e.MCFT_QUALIFICATION_FIRST_BASE="2026-10-12T05:00:00.000Z");
fail(/OUTPUT_OUTSIDE_REPO_REQUIRED/,e=>e.MCFT_CURRENT_QUALIFICATION_OUTPUT_DIR="C:\\repo\\run-"+C.RUN_ID);
fail(/LEDGER_RUN_ID_REQUIRED/,e=>e.MCFT_CAP09_TEST_ONLY_LEDGER_DIR="C:\\ledger\\other");

const outputProbe=binding.outputPath({out:path.join(__dirname,"nonexistent-output-probe")},"MCFT_CAP09_TEST_ONLY_RESULT.json");
assert.equal(path.basename(outputProbe),"MCFT_CAP09_TEST_ONLY_RESULT.json");checks++;
assert.throws(()=>binding.outputPath({out:path.join(__dirname,"nonexistent-output-probe")},"bad.json"),/TEST_ONLY_OUTPUT_FILENAME_INVALID/);checks++;

const producerPath=path.join(__dirname,"RUN_MCFT_CAP09_TEST_ONLY_PRODUCER_C1F7DCC6D04D_V1.ts");
const producerSource=fs.readFileSync(producerPath,"utf8");
const transpiled=ts.transpileModule(producerSource,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext},
  reportDiagnostics:true,fileName:producerPath
});
assert.deepEqual((transpiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error),[],"TEST_ONLY_PRODUCER_TYPESCRIPT_SYNTAX_INVALID");checks++;
assert(producerSource.includes('const testOnlyBinding = createRequire(import.meta.url)("./MCFT_CAP09_TEST_ONLY_BINDING_V1.cjs")'));checks++;
assert(producerSource.includes('const EVIDENCE_LOGIN_ROLE = currentTargets.evidence_login_role;'));checks++;
assert(producerSource.includes('MCFT_CAP09_TEST_ONLY_PRODUCER'));checks++;
assert(!producerSource.includes('const EVIDENCE_LOGIN_ROLE = "geox_mcft_cap09_evidence_runtime_login_v1"'));checks++;

const prodSource=fs.readFileSync(path.join(__dirname,"RUN_MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2.ts"),"utf8");
assert(prodSource.includes('const EVIDENCE_LOGIN_ROLE = "geox_mcft_cap09_evidence_runtime_login_v1";'));checks++;
assert(!prodSource.includes("MCFT_CAP09_TEST_ONLY_BINDING"));checks++;

const trust=JSON.parse(fs.readFileSync(path.join(__dirname,"MCFT_CAP09_RETRY_TRUST_V1.json"),"utf8"));
assert.equal(trust.adopted,false);assert.equal(trust.execution_enabled,false);checks++;

const policy=JSON.parse(fs.readFileSync(path.join(__dirname,"MCFT_CAP09_TEST_ONLY_MINIO_POLICY_C1F7DCC6D04D_V1.json"),"utf8"));
const policyText=JSON.stringify(policy);
assert(policyText.includes(C.BUCKET));assert(!policyText.includes("arn:aws:s3:::*"));checks++;
const deny=policy.Statement.find(x=>x.Effect==="Deny");
assert(deny&&deny.Action.includes("s3:DeleteObject")&&deny.Action.includes("s3:DeleteObjectVersion"));checks++;

assert.deepEqual(binding.ALLOWED_TEST_ONLY_UNTRACKED,[
  "scripts/runtime_acceptance/MCFT_CAP09_TEST_ONLY_BINDING_V1.cjs",
  "scripts/runtime_acceptance/RUN_MCFT_CAP09_TEST_ONLY_QUALIFICATION_V1.cjs",
  "scripts/runtime_acceptance/RUN_MCFT_CAP09_TEST_ONLY_PRODUCER_C1F7DCC6D04D_V1.ts",
]);checks++;
const bindingSource=fs.readFileSync(path.join(__dirname,"MCFT_CAP09_TEST_ONLY_BINDING_V1.cjs"),"utf8");
assert(bindingSource.includes("sourceWorktreeCleanAllowingTestOnly"));checks++;

const runner=require("./RUN_MCFT_CAP09_TEST_ONLY_QUALIFICATION_V1.cjs");
assert.deepEqual(runner.parseArgs(["--operator-authorized","--test-only","--preflight-only","--producer"]),
  {execute:false,task:"--producer"});checks++;
assert.throws(()=>runner.parseArgs(["--operator-authorized","--test-only","--execute","--preflight-only","--producer"]),/SELECT_ONE_EXECUTION_MODE/);checks++;
assert.throws(()=>runner.parseArgs(["--operator-authorized","--test-only","--execute","--timing"]),/PRODUCER_TASK_REQUIRED/);checks++;
assert.throws(()=>runner.parseArgs(["--operator-authorized","--test-only","--execute","--producer","--wat"]),/UNKNOWN_ARGUMENT/);checks++;

console.log("MCFT_CAP09_TEST_ONLY_BINDING_ACCEPTANCE_PASS checks:"+checks);
