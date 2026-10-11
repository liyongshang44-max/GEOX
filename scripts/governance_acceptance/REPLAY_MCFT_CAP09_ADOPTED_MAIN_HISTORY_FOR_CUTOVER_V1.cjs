"use strict";
// Distinct successor-only historical replay. Historical verifiers are never
// invoked on a candidate tree whose QCP has additional entries.
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),cp=require("node:child_process");
const ROOT=path.resolve(__dirname,"../..");
const BASE="0d62e7fa4f0905151b38c25964b48d672187e6d3";
const MANIFEST="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-LOCAL-CUTOVER-EXACT-SCOPE-CANDIDATE-20261011-V1.json";
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const CHECK="LOCAL_CUTOVER_EXACT_SCOPE_20261011_ENGINEERING_ONLY";
function git(...args){return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8",timeout:120000,maxBuffer:16*1024*1024}).trim();}
function replayAdoptedHistoryForCutoverCandidate(){
 const head=git("rev-parse","HEAD"),main=git("rev-parse","origin/main");
 assert.equal(main,BASE,"HISTORY_MAIN_MOVED_REBIND_REQUIRED");
 assert.notEqual(head,main,"REQUIRES_DISTINCT_CANDIDATE_SUBJECT");
 assert.equal(git("merge-base",head,main),main,"EXACT_MAIN_ANCESTRY_REQUIRED");
 assert.deepEqual(git("status","--porcelain").split(/\r?\n/).filter(s=>s&&!s.startsWith("?? acceptance-output/")),[],"CANDIDATE_DIRTY");
 const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,MANIFEST),"utf8"));
 assert.equal(manifest.base_sha,main,"CANDIDATE_BASE_BINDING_MISMATCH");
 assert.equal(manifest.governance_adopted,false,"CANDIDATE_SELF_ADOPTION_FORBIDDEN");
 assert.equal(manifest.execution_authorized,false,"CANDIDATE_EFFECT_FORBIDDEN");
 const changed=git("diff","--name-only",main,head).split(/\r?\n/).filter(Boolean).sort();
 assert.deepEqual(changed,manifest.paths,"UNREGISTERED_CANDIDATE_DELTA_FORBIDDEN");
 const prior=JSON.parse(git("show",main+":"+QCP));
 const candidate=JSON.parse(fs.readFileSync(path.join(ROOT,QCP),"utf8"));
 assert.equal(prior.checks.length,52,"HISTORICAL_QCP_COUNT_CHANGED");
 assert.equal(candidate.checks.length,53,"SUCCESSOR_CHECK_COUNT_CHANGED");
 assert.deepEqual(candidate.checks.slice(0,52),prior.checks,"HISTORICAL_CHECKS_MUTATED");
 assert.equal(candidate.checks[52].check_id,CHECK,"SUCCESSOR_CHECK_ID_MISSING");
 const rid="LOCAL_CUTOVER_EXACT_SCOPE_20261011_V1";
 assert.deepEqual(candidate.dependency_resolvers[rid],{kind:"EXACT_PATH_SET",paths:manifest.paths},"EXACT_RESOLVER_MISMATCH");
 const stripped=structuredClone(candidate);stripped.checks.pop();delete stripped.dependency_resolvers[rid];
 assert.deepEqual(stripped,prior,"HISTORICAL_QCP_DIFF_NOT_APPEND_ONLY");
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),"mcft-cap09-historical-replay-"));
 const checkout=path.join(temp,"adopted-main");let attached=false;
 try{
  git("worktree","add","--detach",checkout,main);attached=true;
  const child=cp.spawnSync(process.execPath,["-e",
   "const r=require('./scripts/governance_acceptance/VERIFY_MCFT_CAP_09_20261010_CROP_ADOPTION_SUCCESSOR_V1.cjs').replayHistoricalRegistration(); console.log(JSON.stringify(r));"],
   {cwd:checkout,encoding:"utf8",timeout:360000,maxBuffer:16*1024*1024,
    env:{...process.env,MCFT_CAP09_ALL_BLOCKERS_CHILD:"1"}});
  assert.equal(child.status,0,"ADOPTED_MAIN_HISTORICAL_REPLAY_FAILED:"+String(child.stderr||"").slice(-1500));
  const rows=String(child.stdout||"").trim().split(/\r?\n/);
  const result=JSON.parse(rows.at(-1));
  assert.equal(result.status,"PASS","HISTORICAL_REPLAY_NOT_PASS");
  assert.equal(result.qcp_central_ownership_registered,true,"HISTORICAL_CENTRAL_OWNERSHIP_UNPROVEN");
  assert.equal(result.legacy_registry_boundary_preserved,true,"HISTORICAL_LEGACY_BOUNDARY_UNPROVEN");
  assert.equal(result.current_successor_inserted_into_legacy_registry,false,"HISTORICAL_SUCCESSOR_REGISTRY_SCOPE_CHANGED");
  return {...result,status:"PASS",historical_subject_sha:main,candidate_subject_sha:head,
   historical_replay_at_exact_main:true,changed_path_count:changed.length,
   adopted_history_not_rewritten:true,execute_authorized:false};
 }finally{if(attached)git("worktree","remove","--force",checkout);fs.rmSync(temp,{recursive:true,force:true});}
}
module.exports={replayAdoptedHistoryForCutoverCandidate};
if(require.main===module){try{console.log(JSON.stringify(replayAdoptedHistoryForCutoverCandidate()));}catch(e){console.error(e.stack||String(e));process.exitCode=1;}}
