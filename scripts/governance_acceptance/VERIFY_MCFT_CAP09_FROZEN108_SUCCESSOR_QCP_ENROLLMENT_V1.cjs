#!/usr/bin/env node
"use strict";
/** QCP structural enrolment only: authentic CI artifact identity checked by QCP workflow. */
const assert=require("node:assert/strict"),fs=require("node:fs"),
      path=require("node:path"),cp=require("node:child_process"),crypto=require("node:crypto");
const ROOT=path.resolve(__dirname,"../..");
const BASE="63dc3382f879781c604a852c7d1b28af9b0dd9f4",SOURCE="5e81f129570d820bf50db6c1db3c6d81086687f6",FROZEN="3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a";
const Q="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",W=".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml",C="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-FROZEN108-RUNTIME-SUCCESSOR-INVENTORY-V1.json";
const ID="FROZEN108_CURRENT_RUNTIME_SUCCESSOR_TEST_ONLY_QCP_ENROLLMENT_V1",RID="FROZEN108_CURRENT_RUNTIME_SUCCESSOR_EXACT_SIX_PATHS_V1";
const PATHS=[".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml",".github/workflows/mcft-cap09-frozen108-runtime-successor-inventory-v1.yml","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-FROZEN108-RUNTIME-SUCCESSOR-INVENTORY-V1.json","scripts/governance_acceptance/VERIFY_MCFT_CAP09_FROZEN108_RUNTIME_SUCCESSOR_INVENTORY_V1.cjs","scripts/governance_acceptance/VERIFY_MCFT_CAP09_FROZEN108_SUCCESSOR_QCP_ENROLLMENT_V1.cjs"];
const ORIGINAL=[".github/workflows/mcft-cap09-frozen108-runtime-successor-inventory-v1.yml","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-FROZEN108-RUNTIME-SUCCESSOR-INVENTORY-V1.json","scripts/governance_acceptance/VERIFY_MCFT_CAP09_FROZEN108_RUNTIME_SUCCESSOR_INVENTORY_V1.cjs"];
const hash=b=>"sha256:"+crypto.createHash("sha256").update(b).digest("hex");
const git=(...a)=>cp.execFileSync("git",a,{cwd:ROOT,encoding:"utf8",maxBuffer:32*1024*1024,timeout:45000}).trim();
const get=(rev,p)=>git("rev-parse",rev+":"+p);
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),"utf8"));
function verify(){
 const head=git("rev-parse","HEAD");
 for(const x of [BASE,SOURCE,FROZEN])assert.equal(cp.spawnSync("git",["cat-file","-e",x],{cwd:ROOT}).status,0,"HISTORIC_COMMIT_NOT_FOUND");
 assert.equal(cp.spawnSync("git",["merge-base","--is-ancestor",SOURCE,head],{cwd:ROOT}).status,0,"SOURCE_HEAD_NOT_ANCESTOR");
 assert.equal(cp.spawnSync("git",["merge-base","--is-ancestor",BASE,head],{cwd:ROOT}).status,0,"PROTECTED_MAIN_NOT_ANCESTOR");
 assert.deepEqual(git("diff","--name-only",BASE,head).split(/\r?\n/).filter(Boolean).sort(),PATHS,"QCP_EXACT_SIX_FILES_ONLY");
 for(const p of ORIGINAL.filter(x=>x!=="scripts/governance_acceptance/VERIFY_MCFT_CAP09_FROZEN108_RUNTIME_SUCCESSOR_INVENTORY_V1.cjs"))
   assert.equal(get(SOURCE,p),get(head,p),"ORIGINAL_3739_CERTIFIED_BLOB_MUTATED:"+p);
 assert.equal(get(head,"scripts/governance_acceptance/VERIFY_MCFT_CAP09_FROZEN108_RUNTIME_SUCCESSOR_INVENTORY_V1.cjs"),"6aa013cf53e5f811bf83de8bd984d551d4dd26a9","INVENTORY_VERIFIER_APPROVED_QCP_DELTA_BLOB_MISMATCH");
 const q=read(Q),baseline=JSON.parse(git("show",BASE+":"+Q));
 assert.equal(q.checks.length,baseline.checks.length+1,"QCP_ONLY_ONE_NEW_CHECK");
 assert.deepEqual(q.checks.slice(0,-1),baseline.checks,"ALL_OLD_CHECKS_IMMUTABLE");
 assert.deepEqual(q.checks.at(-1),{"check_id":"FROZEN108_CURRENT_RUNTIME_SUCCESSOR_TEST_ONLY_QCP_ENROLLMENT_V1","owner":"MCFT_CAP09_FROZEN108_SEPARATE_SUCCESSOR_TECHNICAL_REVIEW","generation_scope":["V13","FORMAL_V5"],"authority_refs":["docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-FROZEN108-RUNTIME-SUCCESSOR-INVENTORY-V1.json","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json"],"resolver_ids":["FROZEN108_CURRENT_RUNTIME_SUCCESSOR_EXACT_SIX_PATHS_V1"],"historical_evidence_policy":"IMMUTABLE_OLD_FROZEN_FAILURE_PRESERVED_NEW_EXACT_108_CATALOG_AND_FOUR_ISOLATED_RECEIPTS_ONLY","execution_workflow":".github/workflows/mcft-cap09-frozen108-runtime-successor-inventory-v1.yml","execution_workflow_status":"TEST_ONLY_QCP_TECHNICAL_REGISTERED_NO_FORMAL_GOVERNANCE_OR_WINDOWS_ADMISSION","fail_policy":"FAIL_CLOSED_SIX_PATH_108_CATALOG_EXACT_FOUR_GITHUB_ARTIFACTS_OLD_FROZEN_ZERO_DRIFT_STILL_FALSE","carry_forward_policy":"NONE_NO_HISTORICAL_FROZEN_REUSE","requalification_triggers":["FROZEN108_CURRENT_RUNTIME_SUCCESSOR_EXACT_SIX_PATHS_V1"],"applicable_stages":["SUCCESSOR_SUBJECT_PRE_MERGE","POST_MERGE_V13_QUALIFICATION"],"carry_forward_evidence_id":null,"diagnostic_command":"node scripts/governance_acceptance/VERIFY_MCFT_CAP09_FROZEN108_SUCCESSOR_QCP_ENROLLMENT_V1.cjs --selftest"},"QCP_NEW_CHECK_SCOPE_INVALID");
 const current=structuredClone(q);current.checks=baseline.checks;delete current.dependency_resolvers[RID];
 assert.deepEqual(current,baseline,"QCP_OLD_AUTHORITY_OR_RESOLVER_CHANGED");
 assert.deepEqual(q.dependency_resolvers[RID],{kind:"EXACT_PATH_SET",paths:PATHS},"QCP_EXACT_PATH_SET");
 for(const p of ["scripts/governance_acceptance/VERIFY_MCFT_CAP_09_FROZEN_V13_REQUALIFICATION_SUCCESSOR_V1.cjs",
     "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FROZEN-V13-REQUALIFICATION-CONTRACT-V1.json",
     "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json",
     "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs"]){
   assert.equal(get(BASE,p),get(head,p),"HISTORICAL_OR_ADMISSION_GUARD_MUTATED:"+p);
 }
 const c=read(C);assert.equal(c.subject_base_sha,BASE);
 assert.equal(c.historical_frozen_sha,FROZEN);
 assert.equal(c.expected_path_count,108);
 assert.equal(c.entries.length,108);
 assert.equal(c.changed_path_count,2);
 assert.equal(c.frozen_digest,"sha256:13884b41d719ad88334e4fe757cd014fa670e363f92e96413ce4ef2fd7f7ba26");
 assert.equal(c.protected_main_digest,"sha256:733739cdb36b50078ce5fc7fb628d252de9b68fb6d4d5e102fbd8ff53ac39c0f");
 assert.equal(hash(Buffer.from(JSON.stringify(c.entries),"utf8")),c.entries_sha256);
 assert.equal(c.entries_sha256,"sha256:6458abd6c365c4e7c0d0e805d7d77910afdce74bc711d5f399e455d2c9f996e1");
 assert.equal(c.entries.filter(e=>e.changed).length,2);
 assert.equal(c.historical_frozen_requalified,false);
 assert.equal(c.permit_authorized,false);
 assert.equal(c.production_authorized,false);
 assert.equal(c.physical_execution_authorized,false);
 for(const p of c.entries){
   assert.equal(get(FROZEN,p.path),p.historical_git_blob);
   assert.equal(get(BASE,p.path),p.current_git_blob);
   assert.equal(get(head,p.path),p.current_git_blob);
 }
 const planner=require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs");
 const resolved=planner.resolveDependencyResolvers(ROOT,q);
 assert.deepEqual(resolved.errors,[],"QCP_RESOLVER_ERRORS");
 assert.deepEqual(resolved.resolved[RID].paths,PATHS);
 const frozen=planner.dependencyDigestForPaths(ROOT,FROZEN,c.entries.map(x=>x.path),false);
 const successor=planner.dependencyDigestForPaths(ROOT,head,c.entries.map(x=>x.path),false);
 assert.equal(frozen.digest,c.frozen_digest);assert.equal(successor.digest,c.protected_main_digest);
 assert.deepEqual(frozen.missing,[]);assert.deepEqual(successor.missing,[]);
 const result={status:"PASS",check_id:ID,source_subject:SOURCE,review_subject:head,
   old_frozen_runtime_zero_drift:false,exact_path_count:108,unchanged_paths:106,changed_paths:2,
   source_ci_run:40436862484,source_ci_success_claim_pending_native_qcp_check:true,
   historical_registry_unchanged:true,registered_technical_test_only:true,
   formal_governance_approval:false,local_windows_physical_admission:false,
   production_authorized:false,formal_six_stages:0,permit:false,old_run_replayed:false};
 return result;
}
const mode=process.argv.includes("--selftest")||process.argv.includes("--verify");
if(!mode)throw Error("EXACT_SELFTEST_OR_VERIFY_FLAG_REQUIRED");
const result=verify();
if(process.argv.includes("--negative")){
 const c=read(C);const t=structuredClone(c);t.entries[0].current_git_blob="0".repeat(40);
 assert.notDeepEqual(t.entries,c.entries);
}
console.log(JSON.stringify(result));
