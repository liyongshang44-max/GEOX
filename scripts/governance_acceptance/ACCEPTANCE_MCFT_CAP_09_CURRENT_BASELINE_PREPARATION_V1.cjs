#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const cp = require("node:child_process");
const path = require("node:path");
const p = require("./PREPARE_MCFT_CAP_09_CURRENT_BASELINE_V1.cjs");
const adoption={anchor:"a".repeat(40),head:"b".repeat(40),main:"b".repeat(40),parents:["a".repeat(40),"c".repeat(40)],candidate_tree:"d".repeat(40),main_tree:"d".repeat(40)};
assert.equal(p.validateMainAdoption(adoption),"PROTECTED_MAIN_EXACT_MERGE_TREE_ADOPTION");
assert.equal(p.validateMainAdoption({...adoption,main:adoption.anchor}),"PRE_MERGE_ANCHOR");
// A descendant PR may be evaluated only as an engineering-only candidate.
// It must retain the already-adopted zero-delta merge and exact four paths.
const scopedPaths = [
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_BASELINE_PREPARATION_V1.cjs",
  "scripts/governance_acceptance/PREPARE_MCFT_CAP_09_CURRENT_BASELINE_V1.cjs",
  "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_SUCCESSOR_V1.cjs",
  "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_20261010_CROP_ADOPTION_SUCCESSOR_V1.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs",
  "scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs",
].sort();
const descendant = {...adoption, head:"e".repeat(40),
  head_descends_from_main:true, successor_paths:scopedPaths};
assert.equal(p.validateMainAdoption(descendant), "PROTECTED_MAIN_DESCENDANT_ENGINEERING_ONLY_CANDIDATE");
for (const mutated of [
  {head_descends_from_main:false},
  {successor_paths:scopedPaths.slice(1)},
  {successor_paths:[...scopedPaths,"scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_ARM_V1.json"]},
  {main_tree:"f".repeat(40)},
  {parents:["e".repeat(40),"c".repeat(40)]},
]) assert.throws(() => p.validateMainAdoption({...descendant,...mutated}));
// The merged successor is a *different* protected-main subject. It is valid
// only for the exact five file changes and zero-delta candidate merge tree.
const adoptedGuard = {...adoption, anchor:adoption.anchor,
  main:"f".repeat(40), head:"f".repeat(40),
  parents:["9625680d4bec137956d79960e0f9feaad4ebf6ab","e".repeat(40)],
  successor_paths:scopedPaths};
assert.equal(p.validateMainAdoption(adoptedGuard),
  "POST_MERGE_SOURCE_GUARD_ZERO_DELTA_ADOPTION");
for(const mutated of [
  {successor_paths:[]},
  {successor_paths:scopedPaths.slice(1)},
  {successor_paths:[...scopedPaths,"scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_ARM_V1.json"]},
  {candidate_tree:"a".repeat(40)},
  {head:"e".repeat(40)},
  {parents:["f".repeat(40),"e".repeat(40)]},
]) assert.throws(() => p.validateMainAdoption({...adoptedGuard,...mutated}));

// Exact nine-file successor on newly adopted PR3686 main.
// This tests only governance ancestry and path lists, never live Provider access.
const isoBase = "6c6f2d77301a852dbb2f52538df89e3098b5aee5";
const isoPaths = [
"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",
"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-ISOLATED-QUALIFICATION-ARM-AUTHORIZATION-20261010-V1.md",
"scripts/governance_acceptance/PREPARE_MCFT_CAP_09_CURRENT_BASELINE_V1.cjs",
"scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_BASELINE_PREPARATION_V1.cjs",
"scripts/governance_acceptance/VERIFY_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_SUCCESSOR_V1.cjs",
"scripts/governance_acceptance/VERIFY_MCFT_CAP_09_ISOLATED_QUALIFICATION_AUTHORIZATION_SUCCESSOR_V1.cjs",
"scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs",
"scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs",
"scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_ISOLATED_QUALIFICATION_ARM_20261010_V1.json",
].sort();
const isoCandidate = {...adoption, main:isoBase,head:"e".repeat(40),
  parents:["9625680d4bec137956d79960e0f9feaad4ebf6ab","d".repeat(40)],
  head_descends_from_main:true,successor_paths:isoPaths};
assert.equal(p.validateMainAdoption(isoCandidate),"PRE_MERGE_ISOLATED_QUALIFICATION_AUTHORIZATION");
for(const bad of [
  {head_descends_from_main:false},
  {successor_paths:isoPaths.slice(1)},
  {successor_paths:[...isoPaths,"apps/server/src/frozen-runtime.ts"]},
  {candidate_tree:"f".repeat(40)},
]) assert.throws(()=>p.validateMainAdoption({...isoCandidate,...bad}));
const isoMerged={...isoCandidate, main:"f".repeat(40),head:"f".repeat(40),
  parents:[isoBase,"e".repeat(40)],head_descends_from_main:false};
assert.equal(p.validateMainAdoption(isoMerged),"POST_MERGE_ISOLATED_QUALIFICATION_AUTHORIZATION");
for(const bad of [
  {head:"e".repeat(40)},
  {parents:["a".repeat(40),"e".repeat(40)]},
  {successor_paths:isoPaths.slice(1)},
  {main_tree:"e".repeat(40)},
]) assert.throws(()=>p.validateMainAdoption({...isoMerged,...bad}));

// Branch proof above is never provider, producer, timing or Formal authority.

for(const change of [{head:"e".repeat(40)},{parents:[adoption.anchor]},{parents:["e".repeat(40),"c".repeat(40)]},{main_tree:"f".repeat(40)},{candidate_tree:null}])assert.throws(()=>p.validateMainAdoption({...adoption,...change}));
// After adopted PR3687, allow only this exact nine-file *engineering* repair.
const bucketBase="2e4c3e7ac0b0e300b15b26b2f6111e7d39de328b";
const bucketPaths=[
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-ISOLATED-PRODUCER-BUCKET-SEAM-20261010-V1.md",
 "scripts/governance_acceptance/PREPARE_MCFT_CAP_09_CURRENT_BASELINE_V1.cjs",
 "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_BASELINE_PREPARATION_V1.cjs",
 "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_ISOLATED_QUALIFICATION_AUTHORIZATION_SUCCESSOR_V1.cjs",
 "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_ISOLATED_PRODUCER_BUCKET_SEAM_SUCCESSOR_V1.cjs",
 "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs",
 "scripts/runtime_acceptance/RUN_MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2.ts",
 "scripts/runtime_acceptance/MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.ts",
].sort();
const bucketCandidate={...adoption,main:bucketBase,head:"e".repeat(40),
 parents:["6c6f2d77301a852dbb2f52538df89e3098b5aee5","d".repeat(40)],
 head_descends_from_main:true,successor_paths:bucketPaths};
assert.equal(p.validateMainAdoption(bucketCandidate),"PRE_MERGE_ISOLATED_BUCKET_SEAM_ENGINEERING_ONLY");
for(const bad of [
 {head_descends_from_main:false},
 {successor_paths:bucketPaths.slice(1)},
 {successor_paths:[...bucketPaths,"apps/server/src/external_evidence/mcft_cap09_v13_forcing_production_composition_v1.ts"]},
 {candidate_tree:"f".repeat(40)},
])assert.throws(()=>p.validateMainAdoption({...bucketCandidate,...bad}));
const bucketMerged={...bucketCandidate,main:"f".repeat(40),head:"f".repeat(40),
 parents:[bucketBase,"e".repeat(40)],head_descends_from_main:false};
assert.equal(p.validateMainAdoption(bucketMerged),"POST_MERGE_ISOLATED_BUCKET_SEAM_ENGINEERING_ONLY");
for(const bad of [
 {head:"e".repeat(40)},
 {parents:["f".repeat(40),"e".repeat(40)]},
 {successor_paths:bucketPaths.slice(1)},
 {main_tree:"e".repeat(40)},
])assert.throws(()=>p.validateMainAdoption({...bucketMerged,...bad}));


// Windows replay successor: exact scope and a single bounded process budget.
const history = require("./VERIFY_MCFT_CAP_09_HISTORY_REPLAY_BUDGET_SUCCESSOR_V1.cjs");
const budget = require("./MCFT_CAP_09_HISTORY_REPLAY_BUDGET_V1.cjs");
const historyCandidate = {...adoption, main:history.BASE, head:"e".repeat(40),
  parents:[bucketBase,"d".repeat(40)], head_descends_from_main:true,
  successor_paths:history.PATHS};
assert.equal(p.validateMainAdoption(historyCandidate), "PRE_MERGE_HISTORY_REPLAY_BUDGET_ENGINEERING_ONLY");
const historyMerged = {...historyCandidate, main:"f".repeat(40), head:"f".repeat(40),
  parents:[history.BASE,"e".repeat(40)], head_descends_from_main:false};
assert.equal(p.validateMainAdoption(historyMerged), "POST_MERGE_HISTORY_REPLAY_BUDGET_ENGINEERING_ONLY");
for (const state of [historyCandidate, historyMerged]) {
  for (const bad of [{successor_paths:history.PATHS.slice(1)},
    {successor_paths:[...history.PATHS,"scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_ISOLATED_QUALIFICATION_ARM_20261010_V1.json"]},
    {main_tree:"e".repeat(40)}, {parents:["0".repeat(40),"e".repeat(40)]}]) {
    assert.throws(() => p.validateMainAdoption({...state,...bad}));
  }
}
assert.throws(() => p.validateMainAdoption({...historyCandidate,head_descends_from_main:false}));
assert.throws(() => p.validateMainAdoption({...historyMerged,head:"e".repeat(40)}));
const historicalScript = "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_SUCCESSOR_V1.cjs";
const opts = {timeout:240000,encoding:"utf8",env:{TEST_SENTINEL:"retained"}};
const deadline = 10000 + budget.TOTAL_MS;
const adjusted = budget.childOptions(process.execPath,[historicalScript],opts,deadline,10000);
assert.equal(adjusted.timeout,budget.TOTAL_MS-2000);
assert.equal(adjusted.env[budget.KEY],String(deadline-2000));
assert.equal(adjusted.env.TEST_SENTINEL,"retained");
assert.equal(opts.timeout,240000);
assert.equal(opts.env[budget.KEY],undefined);
assert.equal(budget.childOptions(process.execPath,[historicalScript],opts,deadline,20000).timeout,
  adjusted.timeout-10000);
assert.throws(() => budget.childOptions(process.execPath,[historicalScript],opts,10000,10000));
assert.throws(() => budget.childOptions(process.execPath,[historicalScript],opts,deadline+1,10000));
assert.throws(() => budget.childOptions(process.execPath,[historicalScript],opts,10001,10000));
for (const [command,args,options] of [
  ["git",["show","HEAD"],opts],
  [process.execPath,["scripts/runtime_acceptance/RUN_MCFT_CAP_09_CURRENT_BASELINE_QUALIFICATION_V1.cjs"],opts],
  [process.execPath,["-e","throw new Error('sentinel')"],opts],
  [process.execPath,[historicalScript,"--extra"],opts],
  [process.execPath,[historicalScript],{timeout:180000}],
]) assert.equal(budget.childOptions(command,args,options,deadline,10000),options);
assert.throws(() => budget.historicalEnvironment("/helper.cjs",10000,{NODE_OPTIONS:"--inspect"}));
assert.throws(() => budget.historicalEnvironment("/helper.cjs",10000,{[budget.KEY]:"999"}));
const fs = require("node:fs"), os = require("node:os");
const fixture = fs.mkdtempSync(path.join(os.tmpdir(),"history-budget-test-"));
try {
  const dir = path.join(fixture,"scripts/governance_acceptance");
  fs.mkdirSync(dir,{recursive:true});
  const parent = path.join(dir,"VERIFY_MCFT_CAP_09_ISOLATED_PRODUCER_BUCKET_SEAM_SUCCESSOR_V1.cjs");
  const child = path.join(dir,path.basename(historicalScript));
  fs.writeFileSync(child,'process.stdout.write("SENTINEL_STDOUT");process.exit(7);');
  fs.writeFileSync(parent, 'const cp=require("node:child_process"),assert=require("node:assert/strict");'+
    'try { cp.execFileSync(process.execPath,['+JSON.stringify(child)+'],{timeout:240000,encoding:"utf8"});process.exit(99); }'+
    'catch(e){assert.equal(e.status,7);assert.equal(e.stdout,"SENTINEL_STDOUT");console.log("ERROR_PROPAGATION_PASS");}');
  const result = cp.spawnSync(process.execPath,[parent],{encoding:"utf8",timeout:10000,
    env:budget.historicalEnvironment(path.resolve(__dirname,"MCFT_CAP_09_HISTORY_REPLAY_BUDGET_V1.cjs"))});
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.stdout.trim(),"ERROR_PROPAGATION_PASS");
} finally { fs.rmSync(fixture,{recursive:true,force:true}); }

const source = p.verifySources();
assert.equal(source.deployment_binding.frozen_source_runtime_matches_current_baseline, true);
assert.equal(source.deployment_binding.image_contents_attested, false);
assert.equal(source.deployment_binding.owner_qualified, false);
for (const [key, value] of [
  ["deployment_subject", source.contract.adopted_baseline],
  ["image_id", "sha256:" + "a".repeat(64)],
  ["image_tag", "geox-mcft-cap09-runtime:" + source.contract.adopted_baseline],
  ["image_contents_attested", true],
  ["qualification_subject_equals_deployment_subject_required", true],
  ["qualification_subject_retagging_allowed", true],
  ["production_recovery_authorized", true]
]) {
  const altered = structuredClone(source.contract);
  altered.deployment_observation[key] = value;
  assert.throws(() => p.verifyDeploymentBinding(altered, []));
}
const record = (role, status, age) => ({log_age_seconds: age,
  recent_health_records: [{runtime_role: role, status}]});
assert.equal(p.diagnoseHealth().status, "NOT_OBSERVED");
assert.equal(p.diagnoseHealth(record("EVIDENCE_RUNTIME", "DEGRADED", 42901)).status, "BLOCKED");
assert.equal(p.diagnoseHealth(record("EVIDENCE_RUNTIME", "HEALTHY", 181)).status, "BLOCKED");
assert.equal(p.diagnoseHealth(record("EVIDENCE_RUNTIME", "HEALTHY", -6)).status, "BLOCKED");
assert.equal(p.diagnoseHealth(record("UNKNOWN_ROLE", "HEALTHY", 0)).status, "BLOCKED");
assert.equal(p.diagnoseHealth(record("EVIDENCE_RUNTIME", "STARTING", 0)).status, "BLOCKED");
for (const [role, status] of [["EVIDENCE_RUNTIME", "HEALTHY"], ["EVIDENCE_RUNTIME", "STANDBY"],
  ["TWIN_RUNTIME", "OWNER_LEASE_HEALTHY"]]) {
  const health = p.diagnoseHealth(record(role, status, 11));
  assert.equal(health.status, "HEALTH_PRECONDITION_ONLY");
  assert.equal(health.owner_qualified, false);
}
const observed = p.prepare({source, now: new Date("2026-10-10T02:34:00.000Z"),
  evidence: record("EVIDENCE_RUNTIME", "DEGRADED", 42901),
  twin: record("TWIN_RUNTIME", "OWNER_LEASE_HEALTHY", 11)});
assert.equal(observed.recovery.evidence.status, "BLOCKED");
assert.equal(observed.recovery.twin.status, "HEALTH_PRECONDITION_ONLY");
assert.equal(observed.qualification.historical_producer_arm_currently_future, false);
assert.equal(observed.qualification.lead_applies_to, "QUALIFICATION_FIRST_BASE_TARGET_NOT_PROGRAM_START");
assert.equal(observed.qualification.first_base_must_be_after, "2026-10-10T08:34:00.000Z");
assert.equal(observed.recovery.all_25_context_coverage_verified, false);
for (const now of ["2026-10-10T02:34:00.000Z", "2026-10-10T04:00:00.000Z", "2026-10-11T04:00:00.000Z"]) {
  const plan = p.prepare({source, now: new Date(now)});
  assert.equal(plan.status, "PREPARATION_COMPLETE_EXECUTION_BLOCKED");
  assert.equal(plan.qualification_pass, false);
  assert.equal(plan.recovery.recovery_executor_authorized, false);
  assert.equal(plan.qualification.historical_producer_arm_reused, false);
  for (const allowed of Object.values(plan.effects_authorized)) assert.equal(allowed, false);
}
assert.throws(() => p.prepare({source, now: new Date("invalid")}), /PREPARATION_CLOCK_INVALID/);
const forbidden = cp.spawnSync(process.execPath,
  [path.join(__dirname, "PREPARE_MCFT_CAP_09_CURRENT_BASELINE_V1.cjs"), "--execute"], {encoding: "utf8"});
assert.equal(forbidden.status, 1);
assert.match(forbidden.stderr, /ONLY_PLAN_ONLY_SUPPORTED_NO_EXECUTION_AUTHORITY/);
console.log(JSON.stringify({status: "PASS", qualification: "READ_ONLY_PREPARATION_BOUNDARY_ONLY",
  frozen_runtime_paths_verified: source.frozen_runtime_paths_verified,
  owner_qualified: false, producer_qualified: false, timing_qualified: false,
  production_effects_authorized: false}, null, 2));
