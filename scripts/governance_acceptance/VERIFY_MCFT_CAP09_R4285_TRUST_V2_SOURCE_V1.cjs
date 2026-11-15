"use strict";
/* Strict QCP74 source-only gate for PR #3772.
 * No Trust activation, signed payloads, DB, Docker or live execution.
 */
const assert=require("node:assert/strict"),cp=require("node:child_process"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const BASE="9ed82b7c92c7e0ecaaa53a452568e7def7f8a8e6",PR=3772,CHECK="CAP09_R4285_TRUST_V2_NATIVE_ADOPTION_V4_EXACT_SOURCE_V1",RESOLVER="CAP09_R4285_TRUST_V2_NATIVE_ADOPTION_V4_EXACT_PATHS_V1";
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",TRUST="scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json";
function verify({ROOT,args,authority,plan,changed,stage}){
 const git=(...a)=>cp.execFileSync("git",a,{cwd:ROOT,encoding:"utf8",timeout:30000,maxBuffer:16*1024*1024}).trim();
 try{
  assert.equal(stage,"SUCCESSOR_SUBJECT_PRE_MERGE");
  assert.equal(args.base,BASE);assert.equal(git("rev-parse","HEAD"),args.head);
  assert.equal(git("merge-base",args.base,args.head),args.base);
  // Central QCP writes these eight machine results before invoking the source gate.
  // Permit only their untracked output paths; reject any tracked/staged change and
  // every unrecognized untracked file, including new source under any directory.
  const qcpOutputs=new Set(["acceptance-output/MCFT_CAP_09_CHECK_APPLICABILITY_V1_RESULT.json","acceptance-output/MCFT_CAP_09_CP2_GENERATION_DEPENDENCY_DIGEST_V1_RESULT.json","acceptance-output/MCFT_CAP_09_CP2_CURRENT_PLAN_DEBUG.json","acceptance-output/MCFT_CAP_09_CP2_FUTURE_PLAN_DEBUG.json","acceptance-output/MCFT_CAP_09_IMMUTABLE_EVIDENCE_REFS_V1_RESULT.json","acceptance-output/MCFT_CAP_09_CHECK_APPLICABILITY_V1_PLAN.json","acceptance-output/MCFT_CAP_09_ALL_BLOCKERS_PREFLIGHT_V1_RESULT.json","acceptance-output/MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1_RESULT.json","acceptance-output/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4.json"]);
  const dirty=git("status","--porcelain=v1","--untracked-files=all").split(/\r?\n/).filter(Boolean);
  const unexpected=dirty.filter(line=>!line.startsWith("?? ")||!qcpOutputs.has(line.slice(3)));
  assert.deepEqual(unexpected,[],"TRUST_V2_SOURCE_WORKTREE_DIRTY");
  assert.equal(plan.status,"PASS");
  assert.deepEqual(plan.unknown_changed_paths,[]);assert.deepEqual(plan.authority_errors,[]);
  const old=JSON.parse(git("show",BASE+":"+QCP));
  assert.equal(old.checks.length,73);assert.equal(authority.checks.length,74);
  assert.deepEqual(authority.checks.slice(0,73),old.checks,"TRUST_V2_PRIOR_73_CHECKS_CHANGED");
  assert.equal(authority.checks[73].check_id,CHECK);
  assert.deepEqual(authority.checks[73].resolver_ids,[RESOLVER]);
  const remaining={...authority.dependency_resolvers};delete remaining[RESOLVER];
  assert.deepEqual(remaining,old.dependency_resolvers,"TRUST_V2_PRIOR_RESOLVERS_CHANGED");
  const paths=git("diff","--name-only",BASE,args.head).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(paths,authority.dependency_resolvers[RESOLVER]?.paths,"TRUST_V2_CHANGED_PATHS_DRIFT");
  assert.deepEqual(changed.slice().sort(),paths);
  assert.deepEqual(paths,[".github/workflows/mcft-cap-09-biological-stage-post-merge-effectiveness-v1.yml",".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml",".github/workflows/mcft-cap09-adoption-v2-attempt3-engineering-v1.yml","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json","scripts/cap09_adoption_v1/ACCEPTANCE_MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.test.cjs","scripts/cap09_adoption_v1/ACCEPTANCE_SIGN_R4285_OWNER_LINEAGE_ADOPTION_V5_TRUST_V2.test.cjs","scripts/cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.cjs","scripts/cap09_adoption_v1/SIGN_R4285_OWNER_LINEAGE_ADOPTION_V5_TRUST_V2_LOCAL.cjs","scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs","scripts/governance_acceptance/SIGN_MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_ATTESTATION_V2.cjs","scripts/governance_acceptance/VERIFY_MCFT_CAP09_R4285_TRUST_V2_SOURCE_V1.cjs","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_EXECUTION_V3.test.cjs","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_PREPARE_LIVE_V3.test.cjs","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_RESTRICTED_PARENT_V3.test.cjs","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_RETRY_TRUST_V2_SUCCESSION_V1.test.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_ADMISSION_EXEC_V3.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_ADMISSION_V3.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_BUILD_ADMISSION_EXEC_V3.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_BUILD_ADMISSION_V3.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_PERMIT_ATOMIC_EXEC_V3.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_RESOURCE_OWNER_PRODUCER_V3.cjs","scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V2.json","scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V2_SUCCESSION_V1.cjs","scripts/runtime_acceptance/PREPARE_MCFT_CAP09_OPERATOR_V2_KEY_LOCAL.cjs"],"TRUST_V2_UNREVIEWED_SOURCE_PATH");
  assert.equal(git("show",BASE+":"+TRUST),git("show",args.head+":"+TRUST),"TRUST_V2_OLD_TRUST_CHANGED");
  const gate=require("./MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_PROOF_GATE_V1.cjs");
  assert.equal(gate.SOURCE_PATHS.length,23);
  for(const f of gate.SOURCE_PATHS){
   assert.equal(git("ls-tree",BASE,"--",f),git("ls-tree",args.head,"--",f),"TRUST_V2_HISTORIC_23_SOURCE_CHANGED:"+f);
  }
  for(const f of [
   "scripts/cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.cjs",
   "scripts/governance_acceptance/SIGN_MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_ATTESTATION_V2.cjs",
   "scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V2_SUCCESSION_V1.cjs",
   "scripts/cap09_adoption_v1/SIGN_R4285_OWNER_LINEAGE_ADOPTION_V5_TRUST_V2_LOCAL.cjs",
   "scripts/runtime_acceptance/PREPARE_MCFT_CAP09_OPERATOR_V2_KEY_LOCAL.cjs",
   "scripts/cap09_adoption_v1/ACCEPTANCE_MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.test.cjs"]){
   cp.execFileSync(process.execPath,["--check",f],{cwd:ROOT,timeout:30000,maxBuffer:1048576});
  }
  cp.execFileSync(process.execPath,["--test","scripts/cap09_adoption_v1/ACCEPTANCE_MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.test.cjs"],{cwd:ROOT,timeout:120000,maxBuffer:4*1024*1024});
  cp.execFileSync(process.execPath,["--test","scripts/cap09_adoption_v1/ACCEPTANCE_SIGN_R4285_OWNER_LINEAGE_ADOPTION_V5_TRUST_V2.test.cjs"],{cwd:ROOT,timeout:120000,maxBuffer:4*1024*1024});
  cp.execFileSync(process.execPath,["--test","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_RETRY_TRUST_V2_SUCCESSION_V1.test.cjs"],
   {cwd:ROOT,timeout:120000,maxBuffer:4*1024*1024});
  assert.equal(process.env.GITHUB_ACTIONS,"true","TRUST_V2_GITHUB_ACTIONS_REQUIRED");
  assert.equal(process.env.GITHUB_EVENT_NAME,"pull_request","TRUST_V2_GITHUB_EVENT");
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
  assert.equal(event.pull_request?.number,PR);assert.equal(event.repository?.full_name,"liyongshang44-max/GEOX");
  assert.equal(event.pull_request?.base?.sha,BASE);assert.equal(event.pull_request?.head?.sha,args.head);
  assert.equal(event.pull_request?.head?.ref,"mcft/r4285-trust-v2-successor-20261115");
  return {status:"PASS",base_sha:BASE,head_sha:args.head,changed_paths:paths.length,
   trust_v1_unchanged:true,historical_source_23_preserved:true,trust_v2_activated:false,
   synthetic_negative_tests:true,signatures_created:false,permit_issued:false,stages:0};
 }catch(e){
  return {status:"FAIL",reason_code:"HOLD_R4285_TRUST_V2_QCP74_SOURCE",
   failure:String(e.message||e).slice(0,450),trust_v2_activated:false,permit_issued:false,stages:0};
 }
}
module.exports={verify};
