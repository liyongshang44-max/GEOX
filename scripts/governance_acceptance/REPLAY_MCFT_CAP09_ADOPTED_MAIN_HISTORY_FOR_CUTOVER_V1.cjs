"use strict";
// Distinct successor-only historical replay. Historical verifiers are never
// invoked on a candidate tree whose QCP has additional entries.
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),cp=require("node:child_process");
const ROOT=path.resolve(__dirname,"../..");
const BASE="0d62e7fa4f0905151b38c25964b48d672187e6d3";
const CURRENT_BASE="5945e459edb212da39b9fe107f87cc07782dd93c";
const PARSER_PATH="scripts/governance_acceptance/ACCEPTANCE_MCFT_CANDIDATE_DECLARATION_INTEGRITY_V2.cjs";
const MANIFEST="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-LOCAL-CUTOVER-EXACT-SCOPE-CANDIDATE-20261011-V1.json";
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const CHECK="LOCAL_CUTOVER_EXACT_SCOPE_20261011_ENGINEERING_ONLY";
function git(...args){return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8",timeout:120000,maxBuffer:16*1024*1024}).trim();}
function historicalCheckout(checkout, ref=BASE){
 cp.execFileSync("git",["clone","--shared","--no-checkout",ROOT,checkout],{stdio:"pipe",timeout:120000});
 const run=(...args)=>cp.execFileSync("git",args,{cwd:checkout,stdio:"pipe",timeout:120000});
 run("checkout","--detach",ref);
 // Clone-local ref: historic verifiers retain their adopted-main context.
 // Never change the caller's origin/main or replay old assertions on a new tree.
 run("update-ref","refs/remotes/origin/main",BASE);
}
const ADOPTED_LOCAL_CUTOVER_SUBJECT="3857b91b8ab2b4eddff9e7b1b0b30f9bc37d7358";
function isAncestor(ancestor, descendant) {
 return cp.spawnSync("git",["merge-base","--is-ancestor",ancestor,descendant],{cwd:ROOT}).status===0;
}
function verifyCandidateBoundary(){
 const currentHead=git("rev-parse","HEAD"),currentMain=git("rev-parse","origin/main");
 // The original candidate lives at the 2026-10-11 #3692 adoption commit.
 // Never reinterpret a later scientific fix as part of the historical candidate.
 const adopted=isAncestor(ADOPTED_LOCAL_CUTOVER_SUBJECT,currentMain);
 if(!adopted){
  assert.equal(currentMain,CURRENT_BASE,"HISTORY_MAIN_MOVED_REBIND_REQUIRED");
 }
 const candidateHead=adopted?ADOPTED_LOCAL_CUTOVER_SUBJECT:currentHead;
 assert.equal(git("show","-s","--format=%P",CURRENT_BASE),
   BASE+" b6b444cb00b6f4db35e772cbbac72c44f6978e75","PARSER_SUCCESSOR_PARENTS_CHANGED");
 assert.deepEqual(git("diff","--name-only",BASE,CURRENT_BASE).split(/\r?\n/),
   [PARSER_PATH],"PARSER_SUCCESSOR_SCOPE_CHANGED");
 assert.notEqual(candidateHead,CURRENT_BASE,"REQUIRES_DISTINCT_CANDIDATE_SUBJECT");
 assert.equal(isAncestor(CURRENT_BASE,candidateHead),true,"ORIGINAL_CANDIDATE_BASE_ANCESTRY_REQUIRED");
 assert.equal(isAncestor(candidateHead,currentHead),true,"FROZEN_CANDIDATE_NOT_ANCESTOR_OF_HEAD");
 assert.equal(isAncestor(candidateHead,currentMain),true,"FROZEN_CANDIDATE_NOT_ADOPTED_MAIN_ANCESTOR");
 assert.deepEqual(git("status","--porcelain").split(/\r?\n/)
    .filter(v=>v&&!v.startsWith("?? acceptance-output/")),[],"CANDIDATE_DIRTY");
 const manifest=JSON.parse(git("show",candidateHead+":"+MANIFEST));
 assert.equal(manifest.base_sha,CURRENT_BASE,"ORIGINAL_CANDIDATE_BASE_BINDING_MISMATCH");
 assert.equal(manifest.governance_adopted,false,"CANDIDATE_SELF_ADOPTION_FORBIDDEN");
 assert.equal(manifest.execution_authorized,false,"CANDIDATE_EFFECT_FORBIDDEN");
 // The later workspace may not silently rewrite the historical #3692 manifest.
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(ROOT,MANIFEST),"utf8")),
   manifest,"ORIGINAL_CANDIDATE_MANIFEST_MUTATED");
 const changed=git("diff","--name-only",CURRENT_BASE,candidateHead)
   .split(/\r?\n/).filter(Boolean).sort();
 assert.deepEqual(changed,manifest.paths,"UNREGISTERED_CANDIDATE_DELTA_FORBIDDEN");
 const prior=JSON.parse(git("show",CURRENT_BASE+":"+QCP));
 const candidate=JSON.parse(git("show",candidateHead+":"+QCP));
 assert.equal(prior.checks.length,52,"HISTORICAL_QCP_COUNT_CHANGED");
 assert.equal(candidate.checks.length,53,"SUCCESSOR_CHECK_COUNT_CHANGED");
 assert.deepEqual(candidate.checks.slice(0,52),prior.checks,"HISTORICAL_CHECKS_MUTATED");
 assert.equal(candidate.checks[52].check_id,CHECK,"SUCCESSOR_CHECK_ID_MISSING");
 const rid="LOCAL_CUTOVER_EXACT_SCOPE_20261011_V1";
 assert.deepEqual(candidate.dependency_resolvers[rid],{kind:"EXACT_PATH_SET",paths:manifest.paths},"EXACT_RESOLVER_MISMATCH");
 const stripped=structuredClone(candidate);stripped.checks.pop();delete stripped.dependency_resolvers[rid];
 assert.deepEqual(stripped,prior,"HISTORICAL_QCP_DIFF_NOT_APPEND_ONLY");
 return {head:candidateHead,main:currentMain,candidate_base_sha:CURRENT_BASE,changed,
   historical_candidate_adopted:adopted};
}

function replayAdoptedHistoryForCutoverCandidate(){
 const {head,main,changed}=verifyCandidateBoundary();
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),"mcft-cap09-historical-replay-"));
 const checkout=path.join(temp,"adopted-main");let attached=false;
 try{
  historicalCheckout(checkout);attached=true;
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
  return {...result,status:"PASS",historical_subject_sha:BASE,candidate_base_sha:main,candidate_subject_sha:head,
   historical_replay_at_exact_main:true,changed_path_count:changed.length,
   adopted_history_not_rewritten:true,execute_authorized:false};
 }finally{fs.rmSync(temp,{recursive:true,force:true});assert.equal(git("rev-parse","origin/main"),main,"LIVE_MAIN_REF_CHANGED");}
}
function runHistoricalDiagnosticForCutoverCandidate(command, extraEnv={}) {
 const crop=require("./VERIFY_MCFT_CAP_09_20261010_CROP_ADOPTION_SUCCESSOR_V1.cjs");
 assert.equal(crop.isFrozenDiagnosticCommand(command),true,"UNREGISTERED_HISTORIC_DIAGNOSTIC");
 const {main}=verifyCandidateBoundary();
 const historicalBase="962fde08f5415909e21ab3812754f0bb711b8b69";
 assert.equal(git("merge-base",main,historicalBase),historicalBase,"HISTORICAL_BASE_NOT_ANCESTOR");
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),"mcft-cap09-historic-diagnostic-"));
 const checkout=path.join(temp,"historic");let attached=false;
 try {
  historicalCheckout(checkout,historicalBase);attached=true;
  const out=cp.spawnSync(command,{cwd:checkout,encoding:"utf8",shell:true,
    timeout:240000,env:{...process.env,...extraEnv,MCFT_CAP09_ALL_BLOCKERS_CHILD:"1"}});
  return {status:out.status===0?"PASS":"FAIL",exit_code:out.status,signal:out.signal||null,
   stdout_tail:String(out.stdout||"").slice(-4000),stderr_tail:String(out.stderr||"").slice(-4000),
   historical_subject_sha:historicalBase,adopted_main_sha:main,candidate_proven:true};
 }finally{
  fs.rmSync(temp,{recursive:true,force:true});
  assert.equal(git("rev-parse","origin/main"),main,"LIVE_MAIN_REF_CHANGED");
 }
}
const LEGACY_SUCCESSOR_CHECK_IDS=Object.freeze([
 "CURRENT_CROP_20261010_ADOPTION_SUCCESSOR_ENGINEERING_ONLY",
 "CURRENT_BASELINE_EXECUTION_SUCCESSOR_ENGINEERING_ONLY",
 "ISOLATED_QUALIFICATION_AUTHORIZATION_20261010_ENGINEERING_GOVERNANCE",
 "ISOLATED_PRODUCER_BUCKET_SEAM_20261010_ENGINEERING_ONLY",
 "HISTORY_REPLAY_BUDGET_20261010_ENGINEERING_ONLY",
 "DISABLED_RETRY_IMPLEMENTATION_20261011_ENGINEERING_ONLY"
]);
function isAdoptedMainLegacyDiagnostic(command){
 const before=JSON.parse(git("show",BASE+":"+QCP));
 const allowed=before.checks.filter(x=>LEGACY_SUCCESSOR_CHECK_IDS.includes(x.check_id));
 assert.equal(allowed.length,LEGACY_SUCCESSOR_CHECK_IDS.length,"LEGACY_DIAGNOSTIC_REGISTRY_CHANGED");
 return allowed.some(x=>x.diagnostic_command===command);
}
function runAdoptedMainLegacyDiagnostic(command,extraEnv={}) {
 assert.equal(isAdoptedMainLegacyDiagnostic(command),true,"UNREGISTERED_LEGACY_SUCCESSOR_DIAGNOSTIC");
 const {main}=verifyCandidateBoundary();
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),"mcft-cap09-adopted-successor-diagnostic-"));
 const checkout=path.join(temp,"main");let attached=false;
 try {
  historicalCheckout(checkout);attached=true;
  const out=cp.spawnSync(command,{cwd:checkout,encoding:"utf8",shell:true,timeout:360000,
    env:{...process.env,...extraEnv,MCFT_CAP09_ALL_BLOCKERS_CHILD:"1"}});
  return {status:out.status===0?"PASS":"FAIL",exit_code:out.status,signal:out.signal||null,
   stdout_tail:String(out.stdout||"").slice(-4000),stderr_tail:String(out.stderr||"").slice(-4000),
   historical_subject_sha:BASE,candidate_base_sha:main,candidate_subject_separate:true};
 }finally{
  fs.rmSync(temp,{recursive:true,force:true});
  assert.equal(git("rev-parse","origin/main"),main,"LIVE_MAIN_REF_CHANGED");
 }
}

const EXACT_WORKFLOW_GATE_MODES=Object.freeze([
 "--historic-frozen","--historic-r6","--historic-g12","--historic-g13",
 "--current-baseline-preparation","--current-baseline-successor"
]);
function runAdoptedMainWorkflowGate(mode) {
 assert.equal(EXACT_WORKFLOW_GATE_MODES.includes(mode),true,"UNREGISTERED_WORKFLOW_GATE");
 const {head,main,changed}=verifyCandidateBoundary();
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),"mcft-cap09-workflow-gate-"));
 const checkout=path.join(temp,"main");let attached=false;
 try {
  historicalCheckout(checkout);attached=true;
  const historicalCrop="scripts/governance_acceptance/VERIFY_MCFT_CAP_09_20261010_CROP_ADOPTION_SUCCESSOR_V1.cjs";
  const mapped=mode==="--current-baseline-preparation"
    ? "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_BASELINE_PREPARATION_V1.cjs"
    : mode==="--current-baseline-successor"
    ? "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_SUCCESSOR_V1.cjs"
    : historicalCrop;
  const args=[path.join(checkout,mapped)];
  if(mapped===historicalCrop)args.push(mode);
  const result=cp.spawnSync(process.execPath,args,{cwd:checkout,encoding:"utf8",
   timeout:360000,maxBuffer:16*1024*1024,env:{...process.env,MCFT_CAP09_ALL_BLOCKERS_CHILD:"1"}});
  assert.equal(result.error,undefined,"ADOPTED_GATE_SPAWN_ERROR:"+String(result.error));
  assert.equal(result.signal,null,"ADOPTED_GATE_SIGNAL:"+String(result.signal));
  assert.equal(result.status,0,"ADOPTED_GATE_FAILED:"+mode+":"+String(result.stderr||"").slice(-2000));
  return {status:"PASS",stage:mode,historical_subject_sha:BASE,candidate_base_sha:main,candidate_subject_sha:head,
   exact_scope_count:changed.length,adopted_gate_exit_code:result.status,
   issuer_trust_adopted:false,execute_authorized:false};
 }finally{
  fs.rmSync(temp,{recursive:true,force:true});
  assert.equal(git("rev-parse","origin/main"),main,"LIVE_MAIN_REF_CHANGED");
 }
}
function verifyAdoptedLocalCutoverScopeDiagnostic() {
 const proof=verifyCandidateBoundary();
 return {status:"PASS",reason_code:"HISTORICAL_3692_EXACT_SCOPE_VERIFIED_AT_ADOPTED_SUBJECT",
  historical_candidate_subject_sha:proof.head,
  historical_candidate_base_sha:proof.candidate_base_sha,
  adopted_main_sha:proof.main,changed_path_count:proof.changed.length,
  production_authorized:false,execute_authorized:false,
  historical_manifest_mutated:false};
}
module.exports={verifyCandidateBoundary,replayAdoptedHistoryForCutoverCandidate,verifyAdoptedLocalCutoverScopeDiagnostic,
 runHistoricalDiagnosticForCutoverCandidate,isAdoptedMainLegacyDiagnostic,runAdoptedMainLegacyDiagnostic,runAdoptedMainWorkflowGate};
if(require.main===module){try{console.log(JSON.stringify(replayAdoptedHistoryForCutoverCandidate()));}catch(e){console.error(e.stack||String(e));process.exitCode=1;}}
