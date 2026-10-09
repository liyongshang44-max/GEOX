#!/usr/bin/env node
"use strict";
// Replay the adopted predecessor in an isolated immutable checkout. Never evaluate old proof against new files.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process");
const ROOT=path.resolve(__dirname,"../..");
const BASE="0d19c4b9f7eb9067824f68014babd757c74f1943",QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",PRIOR="scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_POST_CUTOVER_RECOVERY_SUCCESSOR_V1.cjs",RUNNER="scripts/runtime_acceptance/RUN_MCFT_CAP_09_AM22_GFS_PROGRESS_DIAGNOSTIC_V1.cjs",TEST="scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_GFS_PROGRESS_DIAGNOSTIC_V1.cjs";
const paths=[".github/workflows/mcft-cap-09-am22-gfs-progress-diagnostic-v1.yml", "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-GFS-PROGRESS-DIAGNOSTIC-V1.md", "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json", "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_GFS_DIAGNOSTIC_SUCCESSOR_V1.cjs", "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_POST_CUTOVER_RECOVERY_SUCCESSOR_V1.cjs", "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_GFS_PROGRESS_DIAGNOSTIC_V1.cjs", "scripts/runtime_acceptance/MCFT_CAP_09_AM22_GFS_PROGRESS_DIAGNOSTIC_V1.cjs", "scripts/runtime_acceptance/RUN_MCFT_CAP_09_AM22_GFS_PROGRESS_DIAGNOSTIC_V1.cjs"],resolverId="AM22_GFS_PROGRESS_DIAGNOSTIC_SUCCESSOR_V1",check={"check_id": "AM22_GFS_PROGRESS_DIAGNOSTIC_ENGINEERING_ONLY", "owner": "MCFT_CAP09_AM22_GFS_DIAGNOSTIC", "generation_scope": ["FORMAL_V5", "AM22_GFS_PROGRESS_DIAGNOSTIC_ENGINEERING_ONLY"], "authority_refs": ["docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-GFS-PROGRESS-DIAGNOSTIC-V1.md"], "resolver_ids": ["AM22_GFS_PROGRESS_DIAGNOSTIC_SUCCESSOR_V1"], "historical_evidence_policy": "IMMUTABLE_ADOPTED_RECOVERY_REPLAY_NO_LIVE_SUCCESS_REUSE", "execution_workflow": ".github/workflows/mcft-cap-09-am22-gfs-progress-diagnostic-v1.yml", "execution_workflow_status": "QUALIFICATION_ONLY_NO_PRODUCTION_CREDENTIALS", "fail_policy": "FAIL_CLOSED_EXACT_DIAGNOSTIC_PATHS_AND_READ_ONLY_EFFECTS", "carry_forward_policy": "NONE", "requalification_triggers": ["AM22_GFS_PROGRESS_DIAGNOSTIC_SUCCESSOR_V1"], "applicable_stages": ["SUCCESSOR_SUBJECT_PRE_MERGE", "POST_MERGE_V13_QUALIFICATION"], "carry_forward_evidence_id": null, "diagnostic_command": "node scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_GFS_DIAGNOSTIC_SUCCESSOR_V1.cjs"};
const ROUTE=" if(fs.existsSync(path.join(ROOT,\"scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_GFS_DIAGNOSTIC_SUCCESSOR_V1.cjs\")))return require(\"./VERIFY_MCFT_CAP_09_AM22_GFS_DIAGNOSTIC_SUCCESSOR_V1.cjs\").verifyDiagnosticSuccessor();\n";
const git=(...a)=>cp.execFileSync("git",a,{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
function verifyDiagnosticSuccessor(){
 assert.equal(git("merge-base",BASE,"HEAD"),BASE,"DIAGNOSTIC_BASE_NOT_ANCESTOR");
 assert.equal(git("merge-base",BASE,"origin/main"),BASE,"DIAGNOSTIC_BASE_NOT_ADOPTED");
 assert.deepEqual(git("status","--porcelain").split(/\r?\n/).filter(x=>x&&!x.startsWith("?? acceptance-output/")),[],"DIAGNOSTIC_DIRTY_SOURCE");
 const changes=git("diff","--name-status",BASE,"HEAD").split(/\r?\n/).filter(Boolean).map(x=>{const [status,rel]=x.split("\t");return {status,rel};});
 assert.deepEqual(changes.map(x=>x.rel).sort(),paths,"DIAGNOSTIC_EXACT_PATH_SET_REQUIRED");
 for(const x of changes)assert.equal(x.status,[QCP,PRIOR].includes(x.rel)?"M":"A","DIAGNOSTIC_DESTRUCTIVE_CHANGE");
 const original=cp.execFileSync("git",["show",BASE+":"+PRIOR],{cwd:ROOT,encoding:"utf8"});
 assert.equal(original.split("function verifyRecoverySuccessor(){").length,2);
 assert.equal(fs.readFileSync(path.join(ROOT,PRIOR),"utf8"),original.replace("function verifyRecoverySuccessor(){","function verifyRecoverySuccessor(){\n"+ROUTE),"DIAGNOSTIC_PREDECESSOR_BODY_CHANGED");
 const before=JSON.parse(cp.execFileSync("git",["show",BASE+":"+QCP],{cwd:ROOT,encoding:"utf8"}));
 const after=JSON.parse(fs.readFileSync(path.join(ROOT,QCP),"utf8"));assert.equal(before.checks.length,44);
 assert.deepEqual(after.checks.at(-1),check);assert.deepEqual(after.dependency_resolvers[resolverId],{kind:"EXACT_PATH_SET",paths});
 delete after.dependency_resolvers[resolverId];after.checks.pop();assert.deepEqual(after,before,"DIAGNOSTIC_PREDECESSOR_QCP_CHANGED");
 const runtime=fs.readFileSync(path.join(ROOT,RUNNER),"utf8");
 for(const token of ["BEGIN READ ONLY","default_transaction_read_only=on","DIAGNOSTIC_DATABASE_IDENTITY_MISMATCH","DIAGNOSTIC_NO_PRODUCTION_CREDENTIALS_IN_CI"])assert.ok(runtime.includes(token));
 for(const token of ["writeFile","execFile","spawnSync","fetch(","INSERT INTO","UPDATE public","DELETE FROM","docker"])assert.equal(runtime.includes(token),false,"DIAGNOSTIC_RUNNER_EFFECT_FORBIDDEN:"+token);
 const result=JSON.parse(cp.execFileSync(process.execPath,[TEST],{cwd:ROOT,encoding:"utf8"}));assert.equal(result.status,"PASS");assert.equal(result.production_writes,0);
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),"gfs-diagnostic-predecessor-"));const replay=path.join(temp,"checkout");let attached=false,predecessor;
 try{
 git("worktree","add","--detach",replay,BASE);attached=true;
 assert.equal(cp.execFileSync("git",["rev-parse","HEAD"],{cwd:replay,encoding:"utf8"}).trim(),BASE);
 predecessor=JSON.parse(cp.execFileSync(process.execPath,[PRIOR],{cwd:replay,encoding:"utf8",timeout:120000,maxBuffer:5*1024*1024}));
 assert.equal(predecessor.status,"PASS");assert.equal(predecessor.production_runtime_start_authorized,false);
 }finally{if(attached)git("worktree","remove","--force",replay);fs.rmSync(temp,{recursive:true,force:true});}
 return {status:"PASS",baseline:BASE,predecessor_replayed_exact_sha:BASE,changedPaths:[...new Set([...predecessor.changedPaths,...paths])],qualification_scope:"AM22_DISABLED_START_CHAIN_ENGINEERING_ONLY",current_delta_scope:"READ_ONLY_GFS_DIAGNOSTIC_ONLY",diagnostic_tests:result,production_runtime_start_authorized:false,formal_v5_arm_authorized:false,a0_authorized:false,o00_authorized:false,mcft_cap09_completed:false};
}
module.exports={BASE,paths,check,resolverId,verifyDiagnosticSuccessor};
if(require.main===module)console.log(JSON.stringify(verifyDiagnosticSuccessor(),null,2));
