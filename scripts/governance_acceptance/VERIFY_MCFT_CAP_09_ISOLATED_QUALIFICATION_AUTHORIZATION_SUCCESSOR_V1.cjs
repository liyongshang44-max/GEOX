#!/usr/bin/env node
"use strict";
// Governance-only authorization successor. No provider request, production
// execution, database connection or mutable ARM writes are made by this proof.
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process");
const ROOT=path.resolve(__dirname,"../..");
const BASE="6c6f2d77301a852dbb2f52538df89e3098b5aee5";
const Q="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const ARM="scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_ISOLATED_QUALIFICATION_ARM_20261010_V1.json";
const OLD_ARM="scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_ARM_V1.json";
const OLD_VERIFIER="scripts/governance_acceptance/VERIFY_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_SUCCESSOR_V1.cjs";
const CURRENT_ENTRY="scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs";
const PATHS=[
  Q,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-ISOLATED-QUALIFICATION-ARM-AUTHORIZATION-20261010-V1.md",
  "scripts/governance_acceptance/PREPARE_MCFT_CAP_09_CURRENT_BASELINE_V1.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_BASELINE_PREPARATION_V1.cjs",
  OLD_VERIFIER,
  "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_ISOLATED_QUALIFICATION_AUTHORIZATION_SUCCESSOR_V1.cjs",
  CURRENT_ENTRY,
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs",
  ARM,
].sort();
const NEW_PATHS=new Set([
  ARM,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-ISOLATED-QUALIFICATION-ARM-AUTHORIZATION-20261010-V1.md",
  "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_ISOLATED_QUALIFICATION_AUTHORIZATION_SUCCESSOR_V1.cjs",
]);
const CHECK={
  check_id:"ISOLATED_QUALIFICATION_AUTHORIZATION_20261010_ENGINEERING_GOVERNANCE",
  owner:"MCFT_CAP09_ISOLATED_QUALIFICATION_AUTHORIZATION",generation_scope:["V13"],
  authority_refs:[ARM],resolver_ids:["ISOLATED_QUALIFICATION_AUTHORIZATION_20261010_V1"],
  historical_evidence_policy:"IMMUTABLE_PR3686_PROTECTED_MAIN_REPLAY_NO_HISTORICAL_PROOF_REUSE",
  execution_workflow:".github/workflows/mcft-cap-09-current-baseline-entry-engineering-v1.yml",
  execution_workflow_status:"GOVERNANCE_ONLY_NO_CI_PROVIDER_EXECUTION",
  fail_policy:"FAIL_CLOSED_EXACT_SCOPE_QUALIFICATION_RUN_72DC0304A21A_EXPIRY_NO_PRODUCTION_EFFECTS",
  carry_forward_policy:"NONE",
  requalification_triggers:["ISOLATED_QUALIFICATION_AUTHORIZATION_20261010_V1"],
  applicable_stages:["SUCCESSOR_SUBJECT_PRE_MERGE","POST_MERGE_V13_QUALIFICATION"],
  carry_forward_evidence_id:null,
  diagnostic_command:"node scripts/governance_acceptance/VERIFY_MCFT_CAP_09_ISOLATED_QUALIFICATION_AUTHORIZATION_SUCCESSOR_V1.cjs",
};
const git=(...args)=>cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8",timeout:120000,maxBuffer:16*1024*1024}).trim();
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),"utf8"));
function replayPrior() {
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"mcft-cap09-iso-pr3686-historical-")),c=path.join(tmp,"prior");
  const live=git("rev-parse","origin/main");
  try {
    cp.execFileSync("git",["clone","--shared","--no-checkout",ROOT,c],
      {cwd:ROOT,stdio:"ignore",timeout:240000});
    const hist=(...x)=>cp.execFileSync("git",["-C",c,...x],{encoding:"utf8",timeout:120000}).trim();
    hist("checkout","--detach",BASE);
    hist("update-ref","refs/remotes/origin/main",BASE);
    assert.equal(hist("rev-parse","origin/main"),BASE);
    const child=cp.execFileSync(process.execPath,[OLD_VERIFIER],
      {cwd:c,encoding:"utf8",timeout:240000,maxBuffer:16*1024*1024});
    const proof=JSON.parse(child.trim());
    assert.equal(proof.status,"PASS","PR3686_HISTORICAL_GOVERNANCE_REPLAY_REQUIRED");
    return proof.status;
  }finally {
    fs.rmSync(tmp,{recursive:true,force:true});
    assert.equal(git("rev-parse","origin/main"),live,"LIVE_ORIGIN_MAIN_MUTATED");
  }
}
function verifySuccessor() {
  const head=git("rev-parse","HEAD"),main=git("rev-parse","origin/main");
  assert.equal(cp.spawnSync("git",["merge-base","--is-ancestor",BASE,head],
    {cwd:ROOT,timeout:60000}).status,0,"AUTHORITY_BASE_NOT_ANCESTOR");
  let stage="SUCCESSOR_SUBJECT_PRE_MERGE";
  if (main===BASE) {
    assert.notEqual(head,main,"AUTHORIZATION_SUCCESSOR_MUST_BE_SEPARATE");
  }else {
    assert.equal(head,main,"AUTHORITY_POST_MERGE_EXACT_MAIN_REQUIRED");
    const parents=git("show","-s","--format=%P",main).split(" ");
    assert.equal(parents.length,2,"AUTHORITY_EXACT_TWO_PARENT_MERGE_REQUIRED");
    assert.equal(parents[0],BASE,"AUTHORITY_FIRST_PARENT_NOT_ADOPTED_MAIN");
    assert.equal(git("rev-parse",main+"^{tree}"),
      git("rev-parse",parents[1]+"^{tree}"),"AUTHORITY_ZERO_DELTA_MERGE_REQUIRED");
    stage="POST_MERGE_V13_QUALIFICATION";
  }
  const dirty=git("status","--porcelain").split(/\r?\n/)
    .filter(x=>x && !x.startsWith("?? acceptance-output/"));
  assert.deepEqual(dirty,[],"AUTHORITY_CLEAN_CHECKOUT_REQUIRED");
  const changed=git("diff","--name-status",BASE,head).split(/\r?\n/)
    .filter(Boolean).map(line=>{const [kind,file]=line.split("\t");return {kind,file};});
  assert.deepEqual(changed.map(x=>x.file).sort(),PATHS,"AUTHORITY_EXACT_NINE_PATHS_REQUIRED");
  for(const x of changed) assert.equal(x.kind,NEW_PATHS.has(x.file)?"A":"M",
    "AUTHORITY_UNAUTHORIZED_CHANGE_KIND:"+x.file);
  assert.equal(fs.readFileSync(path.join(ROOT,OLD_ARM),"utf8"),
    git("show",BASE+":"+OLD_ARM)+"\n","HISTORICAL_DISABLED_ARM_CHANGED");
  const before=JSON.parse(git("show",BASE+":"+Q)),q=read(Q);
  assert.equal(before.checks.length,48,"EXPECTED_48_BASE_CHECKS");
  assert.equal(q.checks.length,49,"AUTHORITY_QCP_49_REQUIRED");
  assert.deepEqual(q.checks.slice(0,48),before.checks,"HISTORICAL_QCP_CHECKS_CHANGED");
  assert.deepEqual(q.checks.at(-1),CHECK,"AUTHORIZATION_CHECK_CHANGED");
  assert.deepEqual(q.dependency_resolvers.ISOLATED_QUALIFICATION_AUTHORIZATION_20261010_V1,
    {kind:"EXACT_PATH_SET",paths:PATHS},"AUTHORITY_QCP_EXACT_RESOLVER");
  const old=structuredClone(q);
  old.checks.pop();delete old.dependency_resolvers.ISOLATED_QUALIFICATION_AUTHORIZATION_20261010_V1;
  assert.deepEqual(old,before,"HISTORICAL_QCP_MUTATED");
  const a=read(ARM);
  const oldArm=read(OLD_ARM);
  assert.equal(oldArm.armed,false,"RECOVERY_ARM_NOT_DISABLED");
  assert.equal(oldArm.mode,"DISABLED");
  assert.deepEqual(a,{
    schema_version:"geox_mcft_cap09_current_baseline_execution_arm_v1",
    armed:true,mode:"ISOLATED_QUALIFICATION",
    adopted_base_sha:"96984439d8587f13ba57b6b0948a1c81d55da9e5",
    execution_subject_binding:"EXACT_ADOPTED_PROTECTED_MAIN",
    expires_at:"2026-10-11T06:00:00.000Z",
    qualification_first_base:"2026-10-11T00:00:00.000Z",
    isolated_run_id:"72dc0304a21a",
    qualification_execution_authorized:true,
    production_recovery_authorized:false,
    new_image_build_and_two_role_cutover_authorized:false,
    source_failed_receipt_sha256:null,stage_ref:null,
    formal_v5_arm_authorized:false,a0_authorized:false,o00_authorized:false,
    historical_attempt_reset_authorized:false,
  },"AUTHORITY_SCOPED_ARM_CHANGED");
  assert(Date.parse(a.expires_at)>Date.parse(a.qualification_first_base));
  assert(Date.parse(a.qualification_first_base)-Date.parse("2026-10-10T09:00:00.000Z")>6*3600000);
  assert(Date.parse(a.expires_at)-Date.parse("2026-10-10T09:00:00.000Z")<24*3600000);
  const entry=require("../runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs");
  const v13=entry.frozenRuntimePaths(ROOT,q);
  assert.equal(v13.length,108,"FROZEN_RUNTIME_COUNT");
  assert.equal(git("diff","--name-only",
    "3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a","HEAD","--",...v13),"",
    "FROZEN_RUNTIME_DRIFT");
  const source=fs.readFileSync(path.join(ROOT,CURRENT_ENTRY),"utf8");
  assert(source.includes("const authorityPath = mode === \"ISOLATED_QUALIFICATION\""),
    "EXACT_ISOLATED_ARM_ROUTE_REQUIRED");
  assert(source.includes("!process.env.CI && !process.env.GITHUB_ACTIONS ? ISOLATED_ARM : ARM;"),
    "CI_AND_RECOVERY_DISABLED_ARM_REQUIRED");
  const oldSource=git("show",BASE+":"+CURRENT_ENTRY);
  const expected=oldSource.replace(
    'const ARM = "scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_ARM_V1.json";',
    'const ARM = "scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_ARM_V1.json";\n'+
    'const ISOLATED_ARM = "scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_ISOLATED_QUALIFICATION_ARM_20261010_V1.json";'
  ).replace(
    '  const a = JSON.parse(fs.readFileSync(path.join(ROOT, ARM), "utf8"));\n  assert.equal(a.armed, true, "CURRENT_EXECUTION_NOT_ARMED");',
    '  // Only a reviewed protected-main artifact may authorize the one scoped\n'+
    '  // local qualification run. Preserve the original disabled ARM for CI and\n'+
    '  // every recovery/production mode. No operator-controlled arm file path.\n'+
    '  const authorityPath = mode === "ISOLATED_QUALIFICATION" &&\n'+
    '    !process.env.CI && !process.env.GITHUB_ACTIONS ? ISOLATED_ARM : ARM;\n'+
    '  const a = JSON.parse(fs.readFileSync(path.join(ROOT, authorityPath), "utf8"));\n'+
    '  assert.equal(a.armed, true, "CURRENT_EXECUTION_NOT_ARMED");'
  );
  assert.equal(source.trim(),expected.trim(),"ENTRY_AUTHORITY_EXACT_ROUTING_ONLY");
  // Replay old adopted main outside the caller's worktree/ref namespace.
  const history=replayPrior();
  return {status:"PASS",adjudication:"ISOLATED_QUALIFICATION_ARM_GOVERNANCE_ONLY",
    subject_sha:head,protected_main:main,stage,run_id:a.isolated_run_id,
    expiry:a.expires_at,first_base:a.qualification_first_base,
    old_governance_replay:history,frozen_runtime_108:true,
    qualification_execution_eligible_only_after_post_merge:stage==="POST_MERGE_V13_QUALIFICATION",
    provider_requests:0,production_writes:0,production_recovery_authorized:false,
    formal_v5_arm:false,a0_execution:false,o00_started:false,
    actual_qualification_pass:false,controlled_delay_executed:false};
}
module.exports={CHECK,PATHS,verifySuccessor};
if(require.main===module){
  try{console.log(JSON.stringify(verifySuccessor(),null,2));}
  catch(e){console.error(e.stack||String(e));process.exitCode=1;}
}
