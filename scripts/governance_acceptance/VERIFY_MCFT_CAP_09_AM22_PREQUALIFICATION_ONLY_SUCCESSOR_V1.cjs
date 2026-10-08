"use strict";
const assert=require("node:assert/strict");
const cp=require("node:child_process");
const fs=require("node:fs");
const path=require("node:path");
const ROOT=path.resolve(__dirname,"../..");
const BASE="1ffec9696db3eb598a36f0d2e1b7b9839363c320";
const POLICY="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-EFFECTIVE-START-AUTHORITY-V2.json";
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const CHAIN="scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1.cjs";
const CHECKERS=["R6_ADMISSION","FINAL_READBACK","COMPLETION_ADJUDICATION"].map(x=>"scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_"+x+"_V1.cjs");
const PATHS=[
  ".github/workflows/mcft-cap-09-am22-admission-v2-prequalification.yml",
  "apps/server/src/runtime/mcft_cap09_am22_evidence_owner_entry_v2.ts",
  "apps/server/src/runtime/mcft_cap09_am22_effective_start_guard_v2.ts",
  "apps/server/src/runtime/mcft_cap09_evidence_preformal_owner_runtime_v2.ts",
  "apps/server/src/runtime/mcft_cap09_formal_v5_evidence_runtime_handoff_authority_v2.ts",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-ADMISSION-V2-PREQUALIFICATION.md",
  POLICY,QCP,CHAIN,...CHECKERS,
  "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_PREQUALIFICATION_ONLY_SUCCESSOR_V1.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_CANDIDATE_ARTIFACT_BINDING_V2.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_EVIDENCE_CLOCK_V2.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_EVIDENCE_HANDOFF_V2.ts",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_PREQUALIFICATION_BOUNDARY_V1.cjs",
  "scripts/runtime_acceptance/MCFT_CAP_09_AM22_EVIDENCE_CLOCK_V2.cjs",
  "scripts/runtime_acceptance/MCFT_CAP_09_AM22_PREPARATION_ENVELOPE_V1.cjs",
  "scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_AM22_START_CANDIDATE_V2.cjs",
].sort();
const PRIOR_CALL='const authorityContinuity=require("./VERIFY_MCFT_CAP_09_ARM_RETIREMENT_ONLY_SUCCESSOR_V1.cjs").verifyRetirementOnlySuccessor()';
const NEW_CALL='const authorityContinuity=require("./VERIFY_MCFT_CAP_09_AM22_PREQUALIFICATION_ONLY_SUCCESSOR_V1.cjs").verifyPrequalificationOnlySuccessor()\n  ?? require("./VERIFY_MCFT_CAP_09_ARM_RETIREMENT_ONLY_SUCCESSOR_V1.cjs").verifyRetirementOnlySuccessor()';
const CHECK={check_id:"AM22_PREQUALIFICATION_ONLY",owner:"MCFT_CAP09_AM22_PREQUALIFICATION_ONLY",generation_scope:["FORMAL_V5","AM22_PREQUALIFICATION_ONLY"],authority_refs:[POLICY],resolver_ids:["AM22_PREQUALIFICATION_ONLY_V1"],historical_evidence_policy:"NO_FORMAL_START_OR_ARM_CARRY_FORWARD",execution_workflow:PATHS.find(x=>x.startsWith(".github/")),execution_workflow_status:"QUALIFICATION_ONLY_NO_PRODUCTION_CREDENTIALS",fail_policy:"FAIL_CLOSED_EXACT_PREQUALIFICATION_BOUNDARY_AND_DISABLED_PRODUCTION_REQUIRED",carry_forward_policy:"NONE",requalification_triggers:["AM22_PREQUALIFICATION_ONLY_V1"],applicable_stages:["SUCCESSOR_SUBJECT_PRE_MERGE","POST_MERGE_V13_QUALIFICATION"],carry_forward_evidence_id:null,diagnostic_command:"node scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_PREQUALIFICATION_ONLY_SUCCESSOR_V1.cjs"};
function validateBoundary(changes,policy,before,after){
  for(const {status,rel} of changes){
    assert.ok(PATHS.includes(rel)&&["A","M"].includes(status),"AM22_PREQUALIFICATION_UNKNOWN_OR_DESTRUCTIVE_PATH:"+rel);
    assert.equal(status,rel===QCP||rel===CHAIN||CHECKERS.includes(rel)?"M":"A","AM22_PREQUALIFICATION_EXISTING_SURFACE_CHANGED:"+rel);
  }
  assert.equal(policy.schema_version,"geox_mcft_cap09_am22_effective_start_authority_v2");
  assert.equal(policy.authority_id,"MCFT_CAP09_AM22_EFFECTIVE_START_AUTHORITY_V2");
  assert.equal(policy.fixed_governance_lead_retirement_target,true);
  assert.equal(policy.status,"PREQUALIFICATION_ONLY_NOT_EFFECTIVE","AM22_PREQUALIFICATION_PRODUCTION_POLICY_FORBIDDEN");
  assert.equal(policy.qualified_predecessor,BASE);
  assert.equal(policy.retired_arm_identity,"sha256:8826cccdbb9aebd8c5e563119fdd3f52772f77cd9d12c718270655c3f03e940f");
  assert.equal(policy.host_retirement_receipt_sha256,"sha256:fcd39ed82ad8d471a4348b52451d12547a5d4d8a51e39b156e69567a67032167");
  assert.deepEqual(Object.keys(policy).sort(),["schema_version","authority_id","status","qualified_predecessor","retired_arm_identity","host_retirement_receipt_sha256","fixed_governance_lead_retirement_target","complete_pre_a0_measurement_qualified","new_handoff_arm_a0_chain_qualified","isolated_postgres_v2_a0_o00_qualified","production_start_authorized","formal_v5_arm_authorized","a0_authorized","mcft_cap09_completed"].sort(),"AM22_PREQUALIFICATION_POLICY_FIELD_DRIFT");
  for(const key of ["complete_pre_a0_measurement_qualified","new_handoff_arm_a0_chain_qualified","isolated_postgres_v2_a0_o00_qualified","production_start_authorized","formal_v5_arm_authorized","a0_authorized","mcft_cap09_completed"])assert.equal(policy[key],false,"AM22_PREQUALIFICATION_AUTHORITY_ESCALATION:"+key);
  assert.equal(after.checks.length,before.checks.length+1);
  assert.deepEqual(after.checks.at(-1),CHECK,"AM22_PREQUALIFICATION_CHECK_DRIFT");
  assert.deepEqual(after.dependency_resolvers.AM22_PREQUALIFICATION_ONLY_V1,{kind:"EXACT_PATH_SET",paths:PATHS},"AM22_PREQUALIFICATION_RESOLVER_DRIFT");
  const normalized=structuredClone(after);normalized.checks.pop();delete normalized.dependency_resolvers.AM22_PREQUALIFICATION_ONLY_V1;
  assert.deepEqual(normalized,before,"AM22_PREQUALIFICATION_EXISTING_QCP_CHANGED");
}
function git(...args){return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();}
function verifyPrequalificationOnlySuccessor(){
  if(!fs.existsSync(path.join(ROOT,POLICY)))return null;
  assert.equal(git("merge-base",BASE,"HEAD"),BASE,"AM22_PREQUALIFICATION_BASE_NOT_ANCESTOR");
  assert.equal(git("merge-base",BASE,"origin/main"),BASE,"AM22_PREQUALIFICATION_BASE_NOT_ADOPTED_BY_CURRENT_MAIN");
  assert.deepEqual(git("status","--porcelain","--untracked-files=normal").split(/\r?\n/).filter(x=>x&&x!=="?? acceptance-output/"),[],"AM22_PREQUALIFICATION_DIRTY_SOURCE");
  const changes=git("diff","--name-status",BASE,"HEAD").split(/\r?\n/).filter(Boolean).map(row=>{const [status,rel]=row.split("\t");return {status,rel};});
  const read=rel=>fs.readFileSync(path.join(ROOT,rel),"utf8");
  validateBoundary(changes,JSON.parse(read(POLICY)),JSON.parse(git("show",BASE+":"+QCP)),JSON.parse(read(QCP)));
  for(const rel of CHECKERS)assert.equal(read(rel),cp.execFileSync("git",["show",BASE+":"+rel],{cwd:ROOT,encoding:"utf8"}).replace(PRIOR_CALL,NEW_CALL),"AM22_PREQUALIFICATION_EXISTING_CHECKER_REWRITE:"+rel);
  const expectedChain=cp.execFileSync("git",["show",BASE+":"+CHAIN],{cwd:ROOT,encoding:"utf8"}).replace('function verifyFormalV5AuthorityContinuity(headRef = "HEAD") {','function verifyFormalV5AuthorityContinuity(headRef = "HEAD", historicalReplay = false) {').replace('  const protectedMain = git(["rev-parse", "origin/main"]);','  const observedProtectedMain = git(["rev-parse", "origin/main"]);\n  if (historicalReplay) {\n    assert.notEqual(headRef, "HEAD", "FORMAL_V5_HISTORICAL_REPLAY_EXPLICIT_HEAD_REQUIRED");\n    assert.ok(isAncestor(head, observedProtectedMain), "FORMAL_V5_HISTORICAL_REPLAY_NOT_ADOPTED_BY_CURRENT_MAIN");\n  }\n  const protectedMain = historicalReplay ? head : observedProtectedMain;');
  assert.equal(read(CHAIN),expectedChain,"AM22_PREQUALIFICATION_CHAIN_REPLAY_REWRITE_FORBIDDEN");
  // The V2 owner changes only its names and handoff port; producer/fencing code
  // is unchanged. The process entry is separately disabled by checked-in policy.
  const ownerV1="apps/server/src/runtime/mcft_cap09_evidence_preformal_owner_runtime_v1.ts";
  const expectedOwner=read(ownerV1).replaceAll("runMcftCap09EvidenceNonOwnerStandbyV1","runMcftCap09EvidenceNonOwnerStandbyV2").replaceAll("runMcftCap09EvidencePreFormalOwnerRuntimeV1","runMcftCap09EvidencePreFormalOwnerRuntimeV2").replaceAll("loadMcftCap09FormalV5EvidenceRuntimeHandoffAuthorityV1","loadMcftCap09FormalV5EvidenceRuntimeHandoffAuthorityV2").replace("mcft_cap09_formal_v5_evidence_runtime_handoff_authority_v1.js","mcft_cap09_formal_v5_evidence_runtime_handoff_authority_v2.js").replace('import fs from "node:fs";','import fs from "node:fs";\nimport { requireEffectiveAm22StartPolicyV2 } from "./mcft_cap09_am22_effective_start_guard_v2.js";').replace('export async function runMcftCap09EvidenceNonOwnerStandbyV2():Promise<void>{','export async function runMcftCap09EvidenceNonOwnerStandbyV2():Promise<void>{\n requireEffectiveAm22StartPolicyV2();').replace('export async function runMcftCap09EvidencePreFormalOwnerRuntimeV2():Promise<void>{','export async function runMcftCap09EvidencePreFormalOwnerRuntimeV2():Promise<void>{\n requireEffectiveAm22StartPolicyV2();');
  assert.equal(read("apps/server/src/runtime/mcft_cap09_evidence_preformal_owner_runtime_v2.ts"),expectedOwner,"AM22_PREQUALIFICATION_PRODUCER_SEMANTICS_CHANGED");
  for(const file of ["ACCEPTANCE_MCFT_CAP_09_AM22_EVIDENCE_CLOCK_V2.cjs","ACCEPTANCE_MCFT_CAP_09_AM22_CANDIDATE_ARTIFACT_BINDING_V2.cjs","ACCEPTANCE_MCFT_CAP_09_AM22_PREQUALIFICATION_BOUNDARY_V1.cjs"])cp.execFileSync(process.execPath,[path.join(ROOT,"scripts/runtime_acceptance",file)],{cwd:ROOT,stdio:"pipe"});
  cp.execFileSync(process.execPath,[path.join(ROOT,"scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_ARM_RETIREMENT_V1.cjs"),"--entrypoints"],{cwd:ROOT,stdio:"pipe"});
  const historical=require("./ACCEPTANCE_MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1.cjs").verifyFormalV5AuthorityContinuity("a60aa6858662ce87b989ff752c50969f21ad4619",true);
  const retiredPaths=require("./VERIFY_MCFT_CAP_09_ARM_RETIREMENT_ONLY_SUCCESSOR_V1.cjs").PATHS;
  return {status:"PASS",baseline:BASE,changedPaths:[...new Set([...historical.changedPaths,...retiredPaths,...changes.map(x=>x.rel)])],qualification_scope:"AM22_DISABLED_COMPONENT_PREQUALIFICATION_ONLY",old_arm_carry_forward_authorized:false,production_runtime_start_authorized:false,formal_v5_arm_authorized:false,a0_authorized:false,mcft_cap09_completed:false};
}
module.exports={verifyPrequalificationOnlySuccessor,validateBoundary,PATHS,CHECK,CHECKERS,PRIOR_CALL,NEW_CALL,POLICY,QCP,CHAIN,BASE};
if(require.main===module)console.log(JSON.stringify(verifyPrequalificationOnlySuccessor(),null,2));
