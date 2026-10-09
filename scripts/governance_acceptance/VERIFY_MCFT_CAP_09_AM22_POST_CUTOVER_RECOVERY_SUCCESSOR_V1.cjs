#!/usr/bin/env node
"use strict";
// New exact-main successor boundary; does not rewrite or requalify the adopted #3678 proof.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const ROOT=path.resolve(__dirname,"../.."),BASE="3b46be1dda2406ffdcc869c55758f3393d69c716";
// Frozen protected-main ancestry supplies already adopted historical paths; new paths are separately exact-gated.
const ADOPTED_R6="dd7529ffd08bead343e312c73b72d7039a7c12e7";
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const SELF="scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_START_CHAIN_ENGINEERING_ONLY_V2.cjs";
const WORKFLOW=".github/workflows/mcft-cap-09-am22-start-chain-v2-engineering.yml";
const RUNNER="scripts/runtime_acceptance/RUN_MCFT_CAP_09_AM22_GFS_BOOTSTRAP_CUTOVER_V1.cjs";
const RECOVERY="scripts/runtime_acceptance/RUN_MCFT_CAP_09_AM22_POST_CUTOVER_RECOVERY_V1.cjs";
const POLL="scripts/runtime_acceptance/MCFT_CAP_09_AM22_GFS_READ_ONLY_POLL_V1.cjs";
const TEST1="scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_POST_CUTOVER_RECOVERY_V1.cjs";
const TEST2="scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_GFS_READ_ONLY_POLL_V1.cjs";
const LEGACY_BRIDGE_TEST="scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_RECOVERY_LEGACY_BRIDGE_V1.cjs";
const LEGACY_CHECKS=["scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_R6_ADMISSION_V1.cjs","scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_FINAL_READBACK_V1.cjs","scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_COMPLETION_ADJUDICATION_V1.cjs"];
const paths=[QCP,SELF,WORKFLOW,RUNNER,RECOVERY,POLL,TEST1,TEST2,LEGACY_BRIDGE_TEST,...LEGACY_CHECKS,"scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_POST_CUTOVER_RECOVERY_SUCCESSOR_V1.cjs"].sort();
const resolverId="AM22_POST_CUTOVER_RECOVERY_SUCCESSOR_V1";
const check={check_id:"AM22_POST_CUTOVER_RECOVERY_ENGINEERING_ONLY",owner:"MCFT_CAP09_AM22_POST_CUTOVER_RECOVERY",generation_scope:["FORMAL_V5","AM22_POST_CUTOVER_RECOVERY_ENGINEERING_ONLY"],authority_refs:["docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-RUNTIME-OWNER-CUTOVER-AUTHORITY-V1.json","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-BOOTSTRAP-A0-PLANNING-AUTHORITY-V1.json"],resolver_ids:[resolverId],historical_evidence_policy:"NO_REUSE_OF_FAILED_BOOTSTRAP_AS_SUCCESS",execution_workflow:WORKFLOW,execution_workflow_status:"QUALIFICATION_ONLY_NO_PRODUCTION_CREDENTIALS",fail_policy:"FAIL_CLOSED_EXACT_SUCCESSOR_PATHS_AND_NO_PRODUCTION_EFFECT",carry_forward_policy:"NONE",requalification_triggers:[resolverId],applicable_stages:["SUCCESSOR_SUBJECT_PRE_MERGE","POST_MERGE_V13_QUALIFICATION"],carry_forward_evidence_id:null,diagnostic_command:"node scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_POST_CUTOVER_RECOVERY_SUCCESSOR_V1.cjs"};
const git=(...args)=>cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();
function verifyRecoverySuccessor(){
 if(fs.existsSync(path.join(ROOT,"scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_GFS_DIAGNOSTIC_SUCCESSOR_V1.cjs")))return require("./VERIFY_MCFT_CAP_09_AM22_GFS_DIAGNOSTIC_SUCCESSOR_V1.cjs").verifyDiagnosticSuccessor();

 assert.equal(git("merge-base",BASE,"HEAD"),BASE,"RECOVERY_BASE_NOT_ANCESTOR");
 assert.equal(git("merge-base",BASE,"origin/main"),BASE,"RECOVERY_BASE_NOT_ADOPTED");
 assert.equal(git("merge-base",ADOPTED_R6,BASE),ADOPTED_R6,"RECOVERY_HISTORICAL_ANCHOR_NOT_ADOPTED");
 assert.deepEqual(git("status","--porcelain").split(/\r?\n/).filter(x=>x&&!x.startsWith("?? acceptance-output/")),[],"RECOVERY_DIRTY_SOURCE");
 const delta=git("diff","--name-status",BASE,"HEAD").split(/\r?\n/).filter(Boolean).map(x=>{const [status,rel]=x.split("\t");return {status,rel};});
 assert.deepEqual(delta.map(x=>x.rel).sort(),paths,"RECOVERY_SUCCESSOR_EXACT_PATH_SET_REQUIRED");
 const additions=new Set([RECOVERY,POLL,TEST1,TEST2,LEGACY_BRIDGE_TEST,"scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_POST_CUTOVER_RECOVERY_SUCCESSOR_V1.cjs"]);
 for(const x of delta)assert.equal(x.status,additions.has(x.rel)?"A":"M","RECOVERY_SUCCESSOR_PATH_STATUS_CHANGED:"+x.rel);
 const before=JSON.parse(cp.execFileSync("git",["show",BASE+":"+QCP],{cwd:ROOT,encoding:"utf8"}));
 const after=JSON.parse(fs.readFileSync(path.join(ROOT,QCP),"utf8"));
 assert.equal(after.checks.length,before.checks.length+1,"RECOVERY_SUCCESSOR_SINGLE_CHECK_REQUIRED");
 assert.deepEqual(after.checks.slice(0,-1),before.checks,"RECOVERY_PREDECESSOR_CHECKS_CHANGED");
 assert.deepEqual(after.checks.at(-1),check,"RECOVERY_SUCCESSOR_CHECK_CHANGED");
 assert.deepEqual(after.dependency_resolvers[resolverId],{kind:"EXACT_PATH_SET",paths},"RECOVERY_SUCCESSOR_RESOLVER_CHANGED");
 delete after.dependency_resolvers[resolverId];after.checks.pop();
 assert.deepEqual(after,before,"RECOVERY_PREDECESSOR_QCP_CHANGED");
 const subprocess=p=>cp.execFileSync(process.execPath,[p],{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
 const recovery=JSON.parse(subprocess(TEST1)),poll=JSON.parse(subprocess(TEST2)),bridge=JSON.parse(subprocess(LEGACY_BRIDGE_TEST));
 assert.equal(recovery.status,"PASS");assert.equal(poll.status,"PASS");
 assert.equal(recovery.no_production_effects,true);assert.equal(poll.production_writes,0);assert.equal(bridge.status,"PASS");assert.equal(bridge.legacy_gate_count,3);assert.equal(bridge.frozen_consumer_assertions_preserved,true);
 const adoptedHistoricalPaths=git("diff","--name-only",ADOPTED_R6,BASE).split(/\r?\n/).filter(Boolean);
 return {status:"PASS",baseline:BASE,adopted_historical_base:ADOPTED_R6,adopted_historical_head:BASE,adopted_historical_path_count:adoptedHistoricalPaths.length,changedPaths:[...new Set([...adoptedHistoricalPaths,...paths])],qualification_scope:"AM22_DISABLED_START_CHAIN_ENGINEERING_ONLY",current_delta_scope:"POST_CUTOVER_RECOVERY_AND_GFS_POLL_WITH_FROZEN_LEGACY_GATE_BRIDGE_ONLY",recovery_tests:recovery,poll_tests:poll,legacy_bridge_tests:bridge,production_runtime_start_authorized:false,formal_v5_arm_authorized:false,a0_authorized:false,o00_authorized:false,mcft_cap09_completed:false};
}
module.exports={BASE,QCP,paths,check,resolverId,verifyRecoverySuccessor};
if(require.main===module)console.log(JSON.stringify(verifyRecoverySuccessor(),null,2));
