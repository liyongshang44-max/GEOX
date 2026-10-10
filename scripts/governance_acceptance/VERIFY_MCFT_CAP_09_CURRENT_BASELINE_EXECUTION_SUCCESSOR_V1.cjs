#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),os=require("node:os");
const ROOT=path.resolve(__dirname,"../.."),BASE="96984439d8587f13ba57b6b0948a1c81d55da9e5",HISTORICAL_STAGE_BASE="962fde08f5415909e21ab3812754f0bb711b8b69",STAGE="scripts/governance_acceptance/VERIFY_MCFT_CAP_09_20261010_CROP_ADOPTION_SUCCESSOR_V1.cjs";
const C="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-BASELINE-PREPARATION-CONTRACT-V1.json",Q="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",OLD="scripts/governance_acceptance/VERIFY_MCFT_CAP_09_FROZEN_V13_REQUALIFICATION_SUCCESSOR_V1.cjs",AM22_TEST="scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_FRESH_AUTHORITY_REFRESH_ONLY_V1.cjs";
const PATHS=[
 ".github/workflows/mcft-cap-09-current-baseline-entry-engineering-v1.yml",
 C,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-BASELINE-EXECUTION-V1.md",Q,
 "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_FRESH_AUTHORITY_REFRESH_ONLY_V1.cjs",
 "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_BASELINE_PREPARATION_V1.cjs",
 "scripts/governance_acceptance/PREPARE_MCFT_CAP_09_CURRENT_BASELINE_V1.cjs",
 "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_SUCCESSOR_V1.cjs",OLD,STAGE,
 "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs",
 "scripts/runtime_acceptance/AGGREGATE_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V2.ts",
 "scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_ARM_V1.json",
 "scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs",
 "scripts/runtime_acceptance/RUN_MCFT_CAP_09_AM22_POST_CUTOVER_RECOVERY_V2.cjs",
 "scripts/runtime_acceptance/RUN_MCFT_CAP_09_CURRENT_BASELINE_QUALIFICATION_V1.cjs",
 "scripts/runtime_acceptance/RUN_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_V2.ts",
 "scripts/runtime_acceptance/RUN_MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2.ts"
].sort();
const CHECK={check_id:"CURRENT_BASELINE_EXECUTION_SUCCESSOR_ENGINEERING_ONLY",owner:"MCFT_CAP09_CURRENT_BASELINE_ENTRY_ENGINEERING",generation_scope:["V13","FORMAL_V5"],authority_refs:[C],resolver_ids:["CURRENT_BASELINE_EXECUTION_SUCCESSOR_V1"],historical_evidence_policy:"IMMUTABLE_ADOPTED_MAIN_REPLAY_NO_LIVE_SUCCESS_REUSE",execution_workflow:".github/workflows/mcft-cap-09-current-baseline-entry-engineering-v1.yml",execution_workflow_status:"ENGINEERING_ONLY_NO_PRODUCTION_EXECUTION",fail_policy:"FAIL_CLOSED_EXACT_PATHS_FROZEN_RUNTIME_DISABLED_ARM_AND_PRESERVED_HISTORY",carry_forward_policy:"NONE",requalification_triggers:["CURRENT_BASELINE_EXECUTION_SUCCESSOR_V1"],applicable_stages:["SUCCESSOR_SUBJECT_PRE_MERGE","POST_MERGE_V13_QUALIFICATION"],carry_forward_evidence_id:null,diagnostic_command:"node scripts/governance_acceptance/VERIFY_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_SUCCESSOR_V1.cjs"};
const git=(...args)=>cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8",maxBuffer:16*1024*1024});
function verifySuccessor(){
 assert.equal(cp.spawnSync("git",["merge-base","--is-ancestor",BASE,"origin/main"],{cwd:ROOT}).status,0,"BASE_NOT_ADOPTED");
 assert.deepEqual(git("status","--porcelain").trim().split(/\r?\n/).filter(x=>x&&!x.startsWith("?? acceptance-output/")),[],"DIRTY_SOURCE");
 const changes=git("diff","--name-status",BASE,"HEAD").trim().split(/\r?\n/).filter(Boolean).map(x=>{const [status,p]=x.split("\t");return {status,p};});
 assert.deepEqual(changes.map(x=>x.p).sort(),PATHS,"EXACT_CURRENT_ENTRY_PATHS_REQUIRED");
 for(const x of changes)assert.equal(x.status,[Q,OLD,STAGE,AM22_TEST].includes(x.p)?"M":"A","UNAUTHORIZED_CHANGE_KIND");
 const c=JSON.parse(fs.readFileSync(path.join(ROOT,C),"utf8"));assert.deepEqual(c.preparation_paths,PATHS);assert.equal(c.adopted_baseline,BASE);
 const before=JSON.parse(git("show",BASE+":"+Q)),after=JSON.parse(fs.readFileSync(path.join(ROOT,Q),"utf8"));
 assert.equal(before.checks.length,47);assert.equal(after.checks.length,48);assert.deepEqual(after.checks.at(-1),CHECK);
 assert.deepEqual(after.dependency_resolvers.CURRENT_BASELINE_EXECUTION_SUCCESSOR_V1,{kind:"EXACT_PATH_SET",paths:PATHS});
 const stripped=structuredClone(after);stripped.checks.pop();delete stripped.dependency_resolvers.CURRENT_BASELINE_EXECUTION_SUCCESSOR_V1;assert.deepEqual(stripped,before,"EXISTING_QCP_ASSERTIONS_CHANGED");
 const route=' if(fs.existsSync(path.join(ROOT,"scripts/governance_acceptance/VERIFY_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_SUCCESSOR_V1.cjs")))return require("./VERIFY_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_SUCCESSOR_V1.cjs").verifySuccessor();\n';
 assert.equal(fs.readFileSync(path.join(ROOT,OLD),"utf8"),git("show",BASE+":"+OLD).replace("function verifySuccessor(){\n","function verifySuccessor(){\n"+route),"PREDECESSOR_ASSERTIONS_CHANGED");
 const stageBefore=' const currentMain=git("rev-parse","origin/main");\n if(currentMain!==BASE){\n  const here=git("rev-parse","HEAD"),parents=git("show","-s","--format=%P",currentMain).split(" ");';
 const stageAfter=' const currentMain=git("rev-parse","origin/main"),here=git("rev-parse","HEAD");\n if(here!==currentMain&&fs.existsSync(path.join(ROOT,"scripts/governance_acceptance/VERIFY_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_SUCCESSOR_V1.cjs"))){\n  assert.equal(cp.spawnSync("git",["merge-base","--is-ancestor",currentMain,"HEAD"],{cwd:ROOT}).status,0,"CURRENT_MAIN_NOT_ANCESTOR");\n  return require("./VERIFY_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_SUCCESSOR_V1.cjs").verifySuccessor();\n }\n if(currentMain!==BASE){\n  const parents=git("show","-s","--format=%P",currentMain).split(" ");';
 const stageExpected=git("show",BASE+":"+STAGE).replace(stageBefore,stageAfter).replace(
  ' if(currentMain!==BASE){\n  const parents=',
  " // A later exact-main engineering merge must inherit the current-baseline\n // successor without reinterpreting the original crop-stage merge parents.\n // The delegated verifier proves the exact five-path merge and old history.\n if(currentMain!==BASE &&\n    currentMain!==\"9625680d4bec137956d79960e0f9feaad4ebf6ab\" &&\n    here===currentMain &&\n    fs.existsSync(path.join(ROOT,\"scripts/governance_acceptance/VERIFY_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_SUCCESSOR_V1.cjs\"))){\n  assert.equal(cp.spawnSync(\"git\",[\"merge-base\",\"--is-ancestor\",\n    \"9625680d4bec137956d79960e0f9feaad4ebf6ab\",currentMain],\n    {cwd:ROOT}).status,0,\"ENGINEERING_BASE_NOT_ANCESTOR\");\n  return require(\"./VERIFY_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_SUCCESSOR_V1.cjs\").verifySuccessor();\n }\n"+' if(currentMain!==BASE){\n  const parents=');
 assert.equal(fs.readFileSync(path.join(ROOT,STAGE),"utf8"),stageExpected,"STAGE_SUCCESSOR_INHERITANCE_CHANGED");
 const am22Before='const authority=JSON.parse(read(g.AUTHORITY)),registry=JSON.parse(read("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json"));';
 const am22After='const authority=JSON.parse(read(g.AUTHORITY)),registry=JSON.parse(cp.execFileSync("git",["show","bb0f4f351d13436a451ac085fc30eaed539dd91a:docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json"],{cwd:g.ROOT,encoding:"utf8"}));';
 assert.equal(fs.readFileSync(path.join(ROOT,AM22_TEST),"utf8"),git("show",BASE+":"+AM22_TEST).replace(am22Before,am22After),"AM22_FRESH_AUTHORITY_FIXTURE_REPLAY_CHANGED");
 const arm=JSON.parse(fs.readFileSync(path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_ARM_V1.json"),"utf8"));
 assert.deepEqual(arm,{schema_version:"geox_mcft_cap09_current_baseline_execution_arm_v1",armed:false,mode:"DISABLED",adopted_base_sha:BASE,execution_subject_binding:"EXACT_ADOPTED_PROTECTED_MAIN",expires_at:null,qualification_first_base:null,isolated_run_id:null,qualification_execution_authorized:false,production_recovery_authorized:false,new_image_build_and_two_role_cutover_authorized:false,source_failed_receipt_sha256:null,stage_ref:null,formal_v5_arm_authorized:false,a0_authorized:false,o00_authorized:false,historical_attempt_reset_authorized:false},"UNAUTHORIZED_ARM_ACTIVATION");
 require("./PREPARE_MCFT_CAP_09_CURRENT_BASELINE_V1.cjs").verifySources();
 // Reproduce the predecessor's *historical* origin/main in an isolated Git
 // clone. Worktrees share refs with the caller and cannot safely rebind
 // origin/main after protected main has advanced.
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),"current-baseline-predecessor-")),
   checkout=path.join(temp,"checkout");
 let prior;
 const currentMainBefore=git("rev-parse","origin/main").trim();
 try{
  cp.execFileSync("git",["clone","--shared","--no-checkout",ROOT,checkout],
    {cwd:ROOT,stdio:"ignore",timeout:240000});
  const historicalGit=(...args)=>cp.execFileSync("git",["-C",checkout,...args],
    {encoding:"utf8",timeout:120000}).trim();
  historicalGit("checkout","--detach",BASE);
  historicalGit("update-ref","refs/remotes/origin/main",BASE);
  assert.equal(historicalGit("rev-parse","origin/main"),BASE,"ISOLATED_HISTORICAL_REMOTE_REF_REQUIRED");
  const stage=JSON.parse(cp.execFileSync(process.execPath,
    ["scripts/governance_acceptance/VERIFY_MCFT_CAP_09_20261010_CROP_ADOPTION_SUCCESSOR_V1.cjs"],
    {cwd:checkout,encoding:"utf8",timeout:240000,maxBuffer:16*1024*1024}));
  assert.equal(stage.status,"PASS","ADOPTED_STAGE_SUCCESSOR_NOT_PROVEN");
  historicalGit("checkout","--detach",HISTORICAL_STAGE_BASE);
  prior=JSON.parse(cp.execFileSync(process.execPath,[OLD],
    {cwd:checkout,encoding:"utf8",timeout:240000,maxBuffer:16*1024*1024}));
  assert.equal(prior.status,"PASS","IMMUTABLE_PREDECESSOR_REPLAY_NOT_PASS");
  prior.stage_changed_paths=stage.changedPaths;
  prior.stage_adoption_baseline=BASE;
 }finally{
  fs.rmSync(temp,{recursive:true,force:true});
  assert.equal(git("rev-parse","origin/main").trim(),currentMainBefore,
    "LIVE_ORIGIN_MAIN_MUST_NOT_CHANGE_DURING_REPLAY");
 }
 const migration=JSON.parse(cp.execFileSync(process.execPath,[OLD,"--migration"],{cwd:ROOT,encoding:"utf8",timeout:240000,maxBuffer:16*1024*1024}));assert.equal(migration.status,"PASS");
 return {status:"PASS",baseline:BASE,changedPaths:[...new Set([...prior.changedPaths,...prior.stage_changed_paths,...PATHS])],qualification_scope:prior.qualification_scope,current_entry_scope:"ENGINEERING_ONLY_NOT_LIVE_QUALIFICATION",adopted_stage_base:BASE,historical_stage_base:HISTORICAL_STAGE_BASE,migration,production_runtime_start_authorized:false,formal_v5_arm_authorized:false,a0_authorized:false,o00_authorized:false};
}
module.exports={PATHS,CHECK,verifySuccessor};
if(require.main===module)console.log(JSON.stringify(verifySuccessor(),null,2));
