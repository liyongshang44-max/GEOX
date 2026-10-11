"use strict";
// Owner-approved NONPRODUCTION test-only binding for the second isolated run.
// This module is intentionally run-specific. It does not grant production
// authority, does not alter MCFT_CAP09_RETRY_TRUST_V1.json and cannot be used
// from CI/GitHub Actions.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const current=require("./MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs");
const ROOT=current.ROOT;
const BASE=current.BASE;
const ALLOWED_TEST_ONLY_UNTRACKED=Object.freeze([
  "scripts/runtime_acceptance/MCFT_CAP09_TEST_ONLY_BINDING_V1.cjs",
  "scripts/runtime_acceptance/RUN_MCFT_CAP09_TEST_ONLY_QUALIFICATION_V1.cjs",
  "scripts/runtime_acceptance/RUN_MCFT_CAP09_TEST_ONLY_PRODUCER_C1F7DCC6D04D_V1.ts",
]);

const RUN_ID="c1f7dcc6d04d";
const POSITIVE_DB="mcft_cap09_requal_"+RUN_ID+"_positive";
const NEGATIVE_DB="mcft_cap09_requal_"+RUN_ID+"_negative";
const BUCKET="mcft-cap09-requal-"+RUN_ID;
const EVIDENCE_LOGIN_ROLE="mcft_cap09_"+RUN_ID+"_evidence_login";
const TWIN_LOGIN_ROLE="mcft_cap09_"+RUN_ID+"_twin_login";
const S3_PRINCIPAL="mcftc1f7dcc6d04d";
const S3_ENDPOINT="http://127.0.0.1:59000";
const PG_PORT="55432";

function canonicalFutureHour(value,nowMs){
  const parsed=Date.parse(value);
  assert(Number.isFinite(parsed)&&new Date(parsed).toISOString()===value&&value.endsWith(":00:00.000Z"),
    "TEST_ONLY_CANONICAL_FUTURE_BASE_REQUIRED");
  assert(parsed>nowMs+6*3600_000,"TEST_ONLY_FUTURE_BASE_LEAD_GT_6H_REQUIRED");
  assert(parsed<=nowMs+24*3600_000,"TEST_ONLY_FUTURE_BASE_WITHIN_24H_REQUIRED");
  return value;
}
function outsideRepo(root,value,label,pathApi){
  assert(value&&pathApi.isAbsolute(value),"TEST_ONLY_"+label+"_ABSOLUTE_REQUIRED");
  const resolved=pathApi.resolve(value),relative=pathApi.relative(root,resolved);
  assert(relative.startsWith(".."+pathApi.sep),"TEST_ONLY_"+label+"_OUTSIDE_REPO_REQUIRED");
  assert(resolved.toLowerCase().includes(RUN_ID),"TEST_ONLY_"+label+"_RUN_ID_REQUIRED");
  return resolved;
}
function validateDb(value,expectedName){
  const u=new URL(String(value||""));
  assert(["postgres:","postgresql:"].includes(u.protocol),"TEST_ONLY_DB_PROTOCOL_REQUIRED");
  assert.equal(u.hostname,"127.0.0.1","TEST_ONLY_DB_LOOPBACK_REQUIRED");
  assert.equal(u.port,PG_PORT,"TEST_ONLY_DB_PORT_REQUIRED");
  assert.equal(decodeURIComponent(u.pathname.replace(/^\/+/, "")),expectedName,"TEST_ONLY_DB_NAME_MISMATCH");
  assert.equal(decodeURIComponent(u.username),EVIDENCE_LOGIN_ROLE,"TEST_ONLY_DB_EVIDENCE_LOGIN_REQUIRED");
  assert(decodeURIComponent(u.password).length>=12,"TEST_ONLY_DB_PASSWORD_REQUIRED");
  assert.equal(u.search,"","TEST_ONLY_DB_QUERY_FORBIDDEN");
  assert.equal(u.hash,"","TEST_ONLY_DB_FRAGMENT_FORBIDDEN");
}
function gitRead(args){
  try{
    return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8",timeout:90000,maxBuffer:16*1024*1024,windowsHide:true}).trim();
  }catch(error){
    throw new Error("TEST_ONLY_GIT_READ_FAILED:"+args[0]+":"+(error.code||error.message));
  }
}
function sourceWorktreeCleanAllowingTestOnly(){
  if(gitRead(["diff","--name-only","--"])!=="") return false;
  if(gitRead(["diff","--cached","--name-only","--"])!=="") return false;
  const untracked=gitRead(["ls-files","--others","--exclude-standard"]).split(/\r?\n/).filter(Boolean).sort();
  const allowed=[...ALLOWED_TEST_ONLY_UNTRACKED].sort();
  return JSON.stringify(untracked)===JSON.stringify(allowed);
}
function sourceContext(){
  const head=gitRead(["rev-parse","HEAD"]);
  const main=gitRead(["ls-remote","origin","refs/heads/main"]).split(/\s+/)[0];
  const q=JSON.parse(fs.readFileSync(path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json"),"utf8"));
  const frozenPaths=current.frozenRuntimePaths(ROOT,q);
  const frozen=gitRead(["diff","--name-only","3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a","HEAD","--",...frozenPaths]);
  return {
    head,main,clean:sourceWorktreeCleanAllowingTestOnly(),
    base_ancestor:cp.spawnSync("git",["merge-base","--is-ancestor",BASE,head],{cwd:ROOT,timeout:90000,windowsHide:true}).status===0,
    frozen_runtime_identical:frozen==="",
    ci:Boolean(process.env.CI||process.env.GITHUB_ACTIONS),
    platform:process.platform,now:new Date().toISOString(),
  };
}

function validateBinding({env,context,root,nowMs=Date.now()}){
  assert.equal(env.MCFT_CAP09_TEST_ONLY_BINDING,"1","TEST_ONLY_BINDING_FLAG_REQUIRED");
  assert.equal(env.MCFT_CAP09_TEST_ONLY_RUN_ID,RUN_ID,"TEST_ONLY_EXACT_OWNER_APPROVED_RUN_REQUIRED");
  assert(!env.MCFT_GOVERNED_RETRY_BUNDLE&&!env.MCFT_GOVERNED_RETRY_STAGE&&!env.MCFT_GOVERNED_RETRY_RUN_ID,
    "TEST_ONLY_GOVERNED_RETRY_CONTEXT_FORBIDDEN");
  assert(context&&context.platform==="win32","TEST_ONLY_WINDOWS_LOCAL_ONLY");
  assert.equal(context.ci,false,"TEST_ONLY_CI_FORBIDDEN");
  assert.equal(context.head,context.main,"TEST_ONLY_EXACT_PROTECTED_MAIN_REQUIRED");
  assert.equal(context.clean,true,"TEST_ONLY_CLEAN_SOURCE_REQUIRED");
  assert.equal(context.base_ancestor,true,"TEST_ONLY_ADOPTED_BASE_ANCESTRY_REQUIRED");
  assert.equal(context.frozen_runtime_identical,true,"TEST_ONLY_FROZEN_RUNTIME_DRIFT");

  validateDb(env.DATABASE_URL,POSITIVE_DB);
  validateDb(env.BLOCKED_DATABASE_URL,NEGATIVE_DB);

  assert.equal(env.MCFT_CAP09_FORMAL_RAW_ENDPOINT,S3_ENDPOINT,"TEST_ONLY_S3_ENDPOINT_MISMATCH");
  assert.equal(env.MCFT_CAP09_FORMAL_RAW_BUCKET,BUCKET,"TEST_ONLY_S3_BUCKET_MISMATCH");
  assert(String(env.MCFT_CAP09_FORMAL_RAW_REGION||"").trim().length>0,"TEST_ONLY_S3_REGION_REQUIRED");
  assert.equal(env.MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID,S3_PRINCIPAL,"TEST_ONLY_S3_SCOPED_PRINCIPAL_REQUIRED");
  assert.equal(env.MCFT_CAP09_TEST_ONLY_S3_PRINCIPAL,S3_PRINCIPAL,"TEST_ONLY_S3_PRINCIPAL_ATTESTATION_REQUIRED");
  assert(String(env.MCFT_CAP09_FORMAL_RAW_SECRET_ACCESS_KEY||"").length>=16,"TEST_ONLY_S3_SECRET_REQUIRED");

  const firstBase=canonicalFutureHour(env.MCFT_QUALIFICATION_FIRST_BASE,nowMs);
  const pathApi=context.platform==="win32"?path.win32:path;
  const out=outsideRepo(root,env.MCFT_CURRENT_QUALIFICATION_OUTPUT_DIR,"OUTPUT",pathApi);
  const ledger=outsideRepo(root,env.MCFT_CAP09_TEST_ONLY_LEDGER_DIR,"LEDGER",pathApi);
  assert.notEqual(out,ledger,"TEST_ONLY_OUTPUT_LEDGER_MUST_DIFFER");

  return {
    run_id:RUN_ID,positive:POSITIVE_DB,negative:NEGATIVE_DB,bucket:BUCKET,
    evidence_login_role:EVIDENCE_LOGIN_ROLE,twin_login_role:TWIN_LOGIN_ROLE,
    s3_principal:S3_PRINCIPAL,out,ledger,qualification_first_base:firstBase,
    allow_insecure_http_for_test:true,production_authorized:false,formal_v5_arm:false,
  };
}
function childTargets(){
  const context=sourceContext();
  const result=validateBinding({env:process.env,context,root:ROOT});
  assert.equal(process.env.MCFT_SUBJECT_SHA,context.head,"TEST_ONLY_SUBJECT_MUST_EQUAL_PROTECTED_MAIN");
  return result;
}
function outputPath(targets,name){
  assert(/^[A-Z0-9_]+\.json$/.test(name),"TEST_ONLY_OUTPUT_FILENAME_INVALID");
  const file=path.join(targets.out,name);
  assert(!require("node:fs").existsSync(file),"TEST_ONLY_IMMUTABLE_OUTPUT_EXISTS");
  return file;
}
function constants(){
  return Object.freeze({RUN_ID,POSITIVE_DB,NEGATIVE_DB,BUCKET,EVIDENCE_LOGIN_ROLE,TWIN_LOGIN_ROLE,S3_PRINCIPAL,S3_ENDPOINT,PG_PORT});
}
module.exports={ROOT,ALLOWED_TEST_ONLY_UNTRACKED,sourceWorktreeCleanAllowingTestOnly,sourceContext,validateBinding,childTargets,outputPath,constants};
