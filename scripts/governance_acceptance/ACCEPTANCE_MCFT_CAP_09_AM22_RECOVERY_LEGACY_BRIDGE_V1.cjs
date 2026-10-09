#!/usr/bin/env node
"use strict";
// Pure static regression: does not import or execute the historical R6/G12/G13 programs.
const assert=require("node:assert/strict"),cp=require("node:child_process"),fs=require("node:fs"),path=require("node:path");
const ROOT=path.resolve(__dirname,"../.."),BASE="3b46be1dda2406ffdcc869c55758f3393d69c716";
const legacy=[
 "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_R6_ADMISSION_V1.cjs",
 "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_FINAL_READBACK_V1.cjs",
 "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_COMPLETION_ADJUDICATION_V1.cjs"
];
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const prior='const authorityContinuity=require("./VERIFY_MCFT_CAP_09_AM22_PREQUALIFICATION_ONLY_SUCCESSOR_V1.cjs").verifyPrequalificationOnlySuccessor()';
const bridge='const authorityContinuity=fs.existsSync(path.join(ROOT,"scripts/runtime_acceptance/RUN_MCFT_CAP_09_AM22_POST_CUTOVER_RECOVERY_V1.cjs"))\n  ? require("./VERIFY_MCFT_CAP_09_AM22_POST_CUTOVER_RECOVERY_SUCCESSOR_V1.cjs").verifyRecoverySuccessor()\n  : require("./VERIFY_MCFT_CAP_09_AM22_PREQUALIFICATION_ONLY_SUCCESSOR_V1.cjs").verifyPrequalificationOnlySuccessor()';
const baseline=rel=>cp.execFileSync("git",["show",BASE+":"+rel],{cwd:ROOT,encoding:"utf8"});
const read=rel=>fs.readFileSync(path.join(ROOT,rel),"utf8");
function boundLegacySource(rel){
 const original=baseline(rel),current=read(rel);
 assert.equal(original.split(prior).length,2,"RECOVERY_LEGACY_PREDECESSOR_SINGLE_BOUNDARY:"+rel);
 assert.equal(current,original.replace(prior,bridge),"RECOVERY_LEGACY_FROZEN_BODY_CHANGED:"+rel);
 assert.ok(current.includes('const FROZEN='),"RECOVERY_LEGACY_FROZEN_HASHES_REQUIRED:"+rel);
 assert.ok(current.includes("authorityContinuity?.changedPaths.includes(rel)"),"RECOVERY_LEGACY_SUCCESSOR_PATH_PROOF_REQUIRED:"+rel);
 assert.ok(current.includes("git(\"rev-parse\",\"HEAD:"+rel), "RECOVERY_LEGACY_FROZEN_BLOB_CHECK_REQUIRED:"+rel);
 // An unauthorized whitelist expansion or altered stage/readback/approval assertion changes the body.
 assert.notEqual(current,original,"RECOVERY_LEGACY_SUCCESSOR_BINDING_REQUIRED:"+rel);
}
for(const rel of legacy)boundLegacySource(rel);
const successor=read("scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_POST_CUTOVER_RECOVERY_SUCCESSOR_V1.cjs");
for(const rel of legacy)assert.equal(successor.includes('require("./'+path.basename(rel)+'")'),false,"RECOVERY_GOVERNANCE_RECURSIVE_IMPORT_FORBIDDEN:"+rel);
const before=JSON.parse(baseline(QCP)),after=JSON.parse(read(QCP));
assert.equal(after.checks.length,before.checks.length+1,"RECOVERY_QCP_SINGLE_ADD_REQUIRED");
assert.deepEqual(after.checks.slice(0,-1),before.checks,"RECOVERY_HISTORICAL_QCP_CHECKS_CHANGED");
assert.equal(after.checks.at(-1).check_id,"AM22_POST_CUTOVER_RECOVERY_ENGINEERING_ONLY");
assert.equal(after.checks.at(-1).historical_evidence_policy,"NO_REUSE_OF_FAILED_BOOTSTRAP_AS_SUCCESS");
assert.equal(after.checks.at(-1).execution_workflow_status,"QUALIFICATION_ONLY_NO_PRODUCTION_CREDENTIALS");
const id="AM22_POST_CUTOVER_RECOVERY_SUCCESSOR_V1",extra=after.dependency_resolvers[id];
assert.equal(extra.kind,"EXACT_PATH_SET");
for(const rel of legacy)assert.ok(extra.paths.includes(rel),"RECOVERY_LEGACY_CHECK_IN_SUCCESSOR_PATHS_REQUIRED:"+rel);
assert.ok(extra.paths.includes("scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_RECOVERY_LEGACY_BRIDGE_V1.cjs"),"RECOVERY_BRIDGE_TEST_MUST_BE_REGISTERED");
delete after.dependency_resolvers[id];after.checks.pop();
assert.deepEqual(after,before,"RECOVERY_HISTORICAL_QCP_RESOLVERS_CHANGED");
const bogus=baseline(legacy[0]).replace("R6_MERGED_CONSUMER_CHANGED","REMOVED_ASSERTION");
assert.notEqual(read(legacy[0]),bogus,"RECOVERY_LEGACY_NEGATIVE_NOT_REJECTED");
process.stdout.write(JSON.stringify({status:"PASS",schema_version:"geox_mcft_cap09_am22_recovery_legacy_bridge_acceptance_v1",exact_predecessor:BASE,legacy_gate_count:3,frozen_consumer_assertions_preserved:true,only_bridge_changes_allowed:true,predecessor_qcp_unchanged:true,recursive_import_forbidden:true,production_effect:false})+"\n");
