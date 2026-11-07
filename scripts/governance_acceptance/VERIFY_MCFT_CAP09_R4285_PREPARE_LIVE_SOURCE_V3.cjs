"use strict";
// Source-only QCP73 extension. Does not qualify an installed release, resource
// authority or a Windows live session, and never rewrites prior QCP evidence.
const fs=require("node:fs"),cp=require("node:child_process"),assert=require("node:assert/strict");
const spec=require("../runtime_acceptance/MCFT_CAP09_R4285_V3_SOURCE_PATHS.cjs");
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
let cached=null;
function verify({ROOT,args,authority,plan,changed,stage}){
 if([SUCCESSOR_BASE,EMPTY_MODULE_BASE,RELEASE_REVIEW_BASE,NATIVE_JS_BASE,PRODUCER_WAIT_BASE,EXECUTION_BASE].includes(arguments[0].args.base))return verifySuccessor(arguments[0]);
 if(cached)return cached;
 const git=(...xs)=>cp.execFileSync("git",xs,{cwd:ROOT,encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024}).trim();
 try{
  assert.equal(stage,"SUCCESSOR_SUBJECT_PRE_MERGE");assert.equal(args.base,spec.base);
  assert.equal(git("rev-parse","HEAD"),args.head);assert.equal(git("merge-base",args.base,args.head),args.base);
  assert.equal(plan.status,"PASS");for(const key of ["unknown_changed_paths","authority_errors","resolver_errors"])assert.deepEqual(plan[key],[]);
  const before=JSON.parse(git("show",args.base+":"+QCP));assert.equal(before.checks.length,72);assert.equal(authority.checks.length,73);
  assert.deepEqual(authority.checks.slice(0,72),before.checks);assert.equal(authority.checks[72].check_id,spec.checkId);
  assert.deepEqual(authority.checks[72].resolver_ids,[spec.resolverId]);
  const retained={...authority.dependency_resolvers};delete retained[spec.resolverId];assert.deepEqual(retained,before.dependency_resolvers);
  const paths=git("diff","--name-only",args.base,args.head).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(paths,spec.changedPaths);assert.deepEqual(changed.slice().sort(),paths);
  assert.equal(authority.dependency_resolvers[spec.resolverId]?.kind,"EXACT_PATH_SET");assert.deepEqual(authority.dependency_resolvers[spec.resolverId].paths,paths);
  // Every historical source outside the explicit governance/workflow edit surfaces
  // is immutable. New code cannot hide modifications behind a V3 resolver.
  const allowed=new Set([QCP,"scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs",".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml",".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml",".github/workflows/mcft-cap09-adoption-v2-attempt3-engineering-v1.yml"]);
  for(const rel of paths)if(!allowed.has(rel))assert.equal(git("ls-tree",args.base,"--",rel),"","V3_EXISTING_SOURCE_MODIFIED");
  assert.equal(process.env.GITHUB_ACTIONS,"true");assert.equal(process.env.GITHUB_EVENT_NAME,"pull_request");
  const ev=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
  assert.equal(ev.pull_request?.number,3758);assert.equal(ev.repository?.full_name,"liyongshang44-max/GEOX");assert.equal(ev.pull_request?.base?.sha,args.base);assert.equal(ev.pull_request?.head?.sha,args.head);
  assert.equal(ev.pull_request?.head?.ref,"mcft/r4285-prepare-live-v3");assert.equal(ev.pull_request?.head?.repo?.full_name,"liyongshang44-max/GEOX");
  const comment=JSON.parse(cp.execFileSync("curl",["--fail","--silent","--show-error","--max-time","20","https://api.github.com/repos/liyongshang44-max/GEOX/issues/comments/6647496120"],{encoding:"utf8",timeout:25000,maxBuffer:524288}));
  assert.equal(comment.id,6647496120);assert.equal(comment.user?.login,"liyongshang44-max");assert.equal(comment.author_association,"OWNER");
  assert.equal(comment.created_at,"2026-11-05T01:56:32Z");assert.equal(comment.updated_at,comment.created_at);
  assert(comment.body.includes("R4285_CTO_APPROVE_SINGLE_VERSIONED_PREPARE_LIVE_IMPLEMENTATION_20261105"));assert(comment.body.includes(spec.base));
  cp.execFileSync(process.execPath,["--test","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_PREPARE_LIVE_V3.test.cjs"],{cwd:ROOT,timeout:120000,maxBuffer:4*1024*1024,stdio:["ignore","pipe","pipe"]});
  cached={status:"PASS",base_sha:args.base,source_head_sha:args.head,changed_paths:paths.length,historical_qcp72_preserved:true,source_contract_only:true,installed_release_qualified:false,windows_session_run:false,permit_consumed:false,execute_authorized:false,stage_count:0};
 }catch(error){cached={status:"FAIL",reason_code:"HOLD_V3_QCP73_SOURCE_QUALIFICATION",error_code:typeof error.code==="string"?error.code:"ASSERTION",detail:String(error.message||error).slice(0,700),permit_consumed:false,stage_count:0};}
 return cached;
}

const SUCCESSOR_BASE="55de110cbe2ef11edd3320bc1042e8d1098084bb";
const SUCCESSOR_BRANCH="mcft/r4285-v3-successor-qualification";
const SUCCESSOR_PATHS=Object.freeze([
 ".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml",
 ".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml",
 ".github/workflows/mcft-cap09-adoption-v2-attempt3-engineering-v1.yml",
 "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs",
 "scripts/governance_acceptance/VERIFY_MCFT_CAP09_R4285_PREPARE_LIVE_SOURCE_V3.cjs",
 "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_PREPARE_LIVE_V3.test.cjs"
]);
const EMPTY_MODULE_BASE="cf128a214fa8f929ac3c013a3ba6de58bc99be22";
const EMPTY_MODULE_BRANCH="mcft/r4285-v3-empty-module-source-fix";
const EMPTY_MODULE_RUNTIME="scripts/runtime_acceptance/MCFT_CAP09_R4285_PINNED_LOADING_V3.cjs";
const EMPTY_MODULE_PATHS=Object.freeze([...SUCCESSOR_PATHS,EMPTY_MODULE_RUNTIME].sort());
const RELEASE_REVIEW_BASE="0871514a4dd096772506282710b05f2f1ae87d07";
const RELEASE_REVIEW_BRANCH="mcft/r4285-v3-release-local-review";
const RELEASE_REVIEW_RUNTIME="scripts/governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs";
const RELEASE_REVIEW_PATHS=Object.freeze([...SUCCESSOR_PATHS,RELEASE_REVIEW_RUNTIME].sort());
const NATIVE_JS_BASE="722fbcae5a56f625065be63437530f0051c12705";
const NATIVE_JS_BRANCH="mcft/r4285-v3-native-js-format-fix";
const NATIVE_JS_PATHS=Object.freeze([...SUCCESSOR_PATHS,EMPTY_MODULE_RUNTIME].sort());
const PRODUCER_WAIT_BASE="ff8cb64d85728548c1902a3447421e15b5d4d12f";
const PRODUCER_WAIT_BRANCH="mcft/r4285-v3-producer-wait-handoff";
const PRODUCER_WAIT_RUNTIME=Object.freeze(["scripts/runtime_acceptance/MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_RESOURCE_OWNER_PRODUCER_V3.cjs"]);
const PRODUCER_WAIT_PATHS=Object.freeze([...SUCCESSOR_PATHS,...PRODUCER_WAIT_RUNTIME].sort());
const EXECUTION_BASE="8890bf950773a43a1f9238672eeb335b1526edca";
const EXECUTION_BRANCH="mcft/r4285-v3-six-stage-execution";
const EXECUTION_RESOLVER="CAP09_R4285_PHYSICAL_EXECUTION_V3_EXACT_SUCCESSOR_V1";
const EXECUTION_PATHS=Object.freeze([
  ".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml",
  ".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml",
  ".github/workflows/mcft-cap09-adoption-v2-attempt3-engineering-v1.yml",
  ".github/workflows/mcft-cap09-r4285-prepare-live-v3.yml",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-R4285-EXECUTION-V3.md",
  "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs",
  "scripts/governance_acceptance/VERIFY_MCFT_CAP09_R4285_PREPARE_LIVE_SOURCE_V3.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_EXECUTION_V3.test.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_PREPARE_LIVE_V3.test.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_R4285_ADMISSION_EXEC_V3.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_R4285_BUILD_ADMISSION_EXEC_V3.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_R4285_HOST_ADMISSION_EXEC_V3.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_R4285_PARENT_STAGE_DISPATCH_EXEC_V3.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_R4285_PERMIT_ATOMIC_EXEC_V3.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_R4285_PERMIT_EXEC_V3.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_R4285_STAGE_CAPABILITY_EXEC_V3.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_R4285_WINDOWS_HOST_EXEC_V3.cjs"
]);
function successorScope(base){return base===EXECUTION_BASE?
 {base:EXECUTION_BASE,branch:EXECUTION_BRANCH,paths:EXECUTION_PATHS,tree:"1ff7141dc3eb8798fc3a3bba22e09ed243e1e1f5",runtimeChanged:true,runtimePaths:["scripts/runtime_acceptance/MCFT_CAP09_R4285_ADMISSION_EXEC_V3.cjs", "scripts/runtime_acceptance/MCFT_CAP09_R4285_BUILD_ADMISSION_EXEC_V3.cjs", "scripts/runtime_acceptance/MCFT_CAP09_R4285_HOST_ADMISSION_EXEC_V3.cjs", "scripts/runtime_acceptance/MCFT_CAP09_R4285_PARENT_STAGE_DISPATCH_EXEC_V3.cjs", "scripts/runtime_acceptance/MCFT_CAP09_R4285_PERMIT_ATOMIC_EXEC_V3.cjs", "scripts/runtime_acceptance/MCFT_CAP09_R4285_PERMIT_EXEC_V3.cjs", "scripts/runtime_acceptance/MCFT_CAP09_R4285_STAGE_CAPABILITY_EXEC_V3.cjs", "scripts/runtime_acceptance/MCFT_CAP09_R4285_WINDOWS_HOST_EXEC_V3.cjs", "scripts/runtime_acceptance/MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs"],kind:"BOUNDED_V3_PHYSICAL_EXECUTION_SOURCE_ONLY_NOT_LIVE_ADMISSION"}:base===PRODUCER_WAIT_BASE?
 {base:PRODUCER_WAIT_BASE,branch:PRODUCER_WAIT_BRANCH,paths:PRODUCER_WAIT_PATHS,tree:"8bf77bb9c059fd4f4c58dc5025770e741ad4e9fc",runtimeChanged:true,runtimePaths:PRODUCER_WAIT_RUNTIME,kind:"BOUNDED_V3_PRODUCER_PREPARE_WAIT_SIGNED_HANDOFF_SOURCE_ONLY"}:base===NATIVE_JS_BASE?
 {base:NATIVE_JS_BASE,branch:NATIVE_JS_BRANCH,paths:NATIVE_JS_PATHS,tree:"8bf429cef1b0fad8436b6accd767c4c044040290",runtimeChanged:true,runtimePath:EMPTY_MODULE_RUNTIME,kind:"BOUNDED_V3_NATIVE_UNDETERMINED_JS_FORMAT_SOURCE_ONLY"}:base===RELEASE_REVIEW_BASE?
 {base:RELEASE_REVIEW_BASE,branch:RELEASE_REVIEW_BRANCH,paths:RELEASE_REVIEW_PATHS,tree:"8e450d03e5b92674a621ccebb4274929c7b3a551",runtimeChanged:true,runtimePath:RELEASE_REVIEW_RUNTIME,kind:"BOUNDED_V3_RELEASE_LOCAL_HISTORICAL_REVIEW_SOURCE_ONLY"}:base===EMPTY_MODULE_BASE?
 {base:EMPTY_MODULE_BASE,branch:EMPTY_MODULE_BRANCH,paths:EMPTY_MODULE_PATHS,tree:"381becbcc838631f16bde5b109f093324efeb74d",runtimeChanged:true,runtimePath:EMPTY_MODULE_RUNTIME,kind:"BOUNDED_V3_EMPTY_MODULE_LOADING_FIX_SOURCE_ONLY"}:
 {base:SUCCESSOR_BASE,branch:SUCCESSOR_BRANCH,paths:SUCCESSOR_PATHS,tree:"2df1955a834e1869fece178d233af1c14a1f48cb",runtimeChanged:false};}
let successorCached=null;
// Inspection is pure and cannot mint an adoption or live-process capability.
// Production calls this only inside the central GitHub QCP artifact producer.
function inspectSuccessor({args,authority,before,plan,paths,changed,stage,event}){
 const scope=successorScope(args.base);
 assert.equal(args.base,scope.base,"V3_SUCCESSOR_EXACT_BASE");
 assert(/^[0-9a-f]{40}$/.test(args.head)&&args.head!==args.base,"V3_SUCCESSOR_HEAD");
 assert.equal(stage,"SUCCESSOR_SUBJECT_PRE_MERGE","V3_SUCCESSOR_STAGE");
 assert.equal(plan.status,"PASS","V3_SUCCESSOR_PLAN");
 for(const key of ["unknown_changed_paths","authority_errors","resolver_errors"])assert.deepEqual(plan[key],[],"V3_SUCCESSOR_PLAN_UNRESOLVED");
 assert.equal(before.checks.length,73,"V3_SUCCESSOR_EXISTING_QCP73");
 if(args.base===EXECUTION_BASE){
  const expected=structuredClone(before);
  expected.dependency_resolvers[EXECUTION_RESOLVER]={kind:"EXACT_PATH_SET",paths:[...EXECUTION_PATHS]};
  expected.checks[72].resolver_ids.push(EXECUTION_RESOLVER);
  expected.checks[72].requalification_triggers.push(EXECUTION_RESOLVER);
  assert.deepEqual(authority,expected,"V3_EXECUTION_EXACT_OWNERSHIP_EXTENSION");
 }else assert.deepEqual(authority,before,"V3_SUCCESSOR_QCP_MANIFEST_CHANGED");
 assert.equal(authority.checks[72].check_id,spec.checkId,"V3_SUCCESSOR_CHECK");
 assert.deepEqual(authority.checks[72].resolver_ids,args.base===EXECUTION_BASE?[spec.resolverId,EXECUTION_RESOLVER]:[spec.resolverId],"V3_SUCCESSOR_RESOLVER");
 const resolver=authority.dependency_resolvers[spec.resolverId];
 assert.equal(resolver.kind,"EXACT_PATH_SET");assert.deepEqual(resolver.paths,spec.changedPaths);
 assert.deepEqual(paths,scope.paths,"V3_SUCCESSOR_EXACT_CHANGED_PATHS");
 assert.deepEqual(changed.slice().sort(),paths,"V3_SUCCESSOR_PLANNER_DIFF");
 assert(event&&event.repository?.full_name==="liyongshang44-max/GEOX","V3_SUCCESSOR_REPOSITORY");
 const pr=event.pull_request;
 assert(Number.isSafeInteger(pr?.number)&&pr.number>0,"V3_SUCCESSOR_PR");
 assert.equal(pr.user?.login,"liyongshang44-max","V3_SUCCESSOR_OWNER");
 assert.equal(pr.base?.ref,"main","V3_SUCCESSOR_MAIN_BASE");
 assert.equal(pr.base?.sha,args.base,"V3_SUCCESSOR_BASE_BINDING");
 assert.equal(pr.head?.sha,args.head,"V3_SUCCESSOR_HEAD_BINDING");
 assert.equal(pr.head?.ref,scope.branch,"V3_SUCCESSOR_BRANCH");
 assert.equal(pr.head?.repo?.full_name,"liyongshang44-max/GEOX","V3_SUCCESSOR_HEAD_REPOSITORY");
 return true;
}
function verifySuccessor(input){
 if(successorCached)return successorCached;
 const {ROOT,args,authority,plan,changed,stage}=input;
 const scope=successorScope(args.base);
 const git=(...xs)=>cp.execFileSync("git",xs,{cwd:ROOT,encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024}).trim();
 try{
  assert.equal(process.env.GITHUB_ACTIONS,"true");assert.equal(process.env.GITHUB_EVENT_NAME,"pull_request");
  assert.equal(git("rev-parse","HEAD"),args.head,"V3_SUCCESSOR_WORKTREE_HEAD");
  assert.equal(git("merge-base",args.base,args.head),args.base,"V3_SUCCESSOR_ANCESTRY");
  assert.equal(git("rev-parse",args.base+"^{tree}"),scope.tree,"V3_SUCCESSOR_BASE_TREE");
  const paths=git("diff","--name-only",args.base,args.head).split(/\r?\n/).filter(Boolean).sort();
  const before=JSON.parse(git("show",args.base+":"+QCP));
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
  inspectSuccessor({args,authority,before,plan,paths,changed,stage,event});
  // Each successor has its own exact base/tree, branch and changed-path set.
  // Each repair changes only its declared runtime paths; Host receiver, Native,
  // Scope, credential delivery and all historical QCP authority stay frozen.
  cp.execFileSync(process.execPath,["--test","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_PREPARE_LIVE_V3.test.cjs"],{cwd:ROOT,timeout:120000,maxBuffer:4*1024*1024,stdio:["ignore","pipe","pipe"]});
  if(args.base===EXECUTION_BASE)cp.execFileSync(process.execPath,["--test","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_EXECUTION_V3.test.cjs"],{cwd:ROOT,timeout:120000,maxBuffer:4*1024*1024,stdio:["ignore","pipe","pipe"]});
  successorCached={status:"PASS",base_sha:args.base,source_head_sha:args.head,changed_paths:paths.length,
   qualification_kind:scope.kind||"BOUNDED_EXISTING_V3_SUCCESSOR_SOURCE_ONLY",historical_qcp72_preserved:true,
   qcp73_count_unchanged:true,runtime_source_unchanged_from_base:!scope.runtimeChanged,runtime_changed_paths:scope.runtimeChanged?(scope.runtimePaths||[scope.runtimePath]):[],source_contract_only:true,
   installed_release_qualified:false,windows_session_run:false,permit_consumed:false,execute_authorized:false,stage_count:0};
 }catch(error){successorCached={status:"FAIL",reason_code:"HOLD_V3_QCP73_SUCCESSOR_QUALIFICATION",
  error_code:typeof error.code==="string"?error.code:"ASSERTION",detail:String(error.message||error).slice(0,700),permit_consumed:false,stage_count:0};}
 return successorCached;
}
module.exports={EXECUTION_BASE,EXECUTION_BRANCH,EXECUTION_PATHS,EXECUTION_RESOLVER,verify,inspectSuccessor,SUCCESSOR_BASE,SUCCESSOR_BRANCH,SUCCESSOR_PATHS,EMPTY_MODULE_BASE,EMPTY_MODULE_BRANCH,EMPTY_MODULE_PATHS,RELEASE_REVIEW_BASE,RELEASE_REVIEW_BRANCH,RELEASE_REVIEW_PATHS,NATIVE_JS_BASE,NATIVE_JS_BRANCH,NATIVE_JS_PATHS,PRODUCER_WAIT_BASE,PRODUCER_WAIT_BRANCH,PRODUCER_WAIT_PATHS};

