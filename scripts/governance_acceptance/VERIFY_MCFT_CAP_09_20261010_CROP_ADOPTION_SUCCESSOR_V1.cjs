#!/usr/bin/env node
"use strict";
// Replays the original Frozen-V13 registration at its adopted historical main,
// proving the current stage-only change independently. No new frozen allowlist.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto");
const ROOT=path.resolve(__dirname,"../.."),BASE="962fde08f5415909e21ab3812754f0bb711b8b69",FROZEN="scripts/governance_acceptance/VERIFY_MCFT_CAP_09_FROZEN_V13_REQUALIFICATION_SUCCESSOR_V1.cjs",P="scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs",W=".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml",Q="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",R="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json",S="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-10-10T04Z-V1.json";
const PATHS=[".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-10-10T04Z-V1.json","scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs","scripts/governance_acceptance/VERIFY_MCFT_CAP_09_20261010_CROP_ADOPTION_SUCCESSOR_V1.cjs"],CHECK={"check_id":"CURRENT_CROP_20261010_ADOPTION_SUCCESSOR_ENGINEERING_ONLY","owner":"MCFT_CAP09_T4R1_STAGE_ADOPTION","generation_scope":["T4R1","FORMAL_V5"],"authority_refs":["docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-10-10T04Z-V1.json","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json"],"resolver_ids":["CURRENT_CROP_20261010_ADOPTION_SUCCESSOR_V1"],"historical_evidence_policy":"IMMUTABLE_962FDE08_HISTORICAL_REGISTRATION_REPLAY_AND_REAL_STAGE_EVIDENCE","execution_workflow":".github/workflows/mcft-cap-09-t4r1-current-crop-refresh-v1.yml","execution_workflow_status":"QUALIFICATION_ONLY_NO_PRODUCTION_CREDENTIALS","fail_policy":"FAIL_CLOSED_EXACT_APPEND_ONLY_STAGE_AND_FROZEN_HISTORY","carry_forward_policy":"NONE","requalification_triggers":["CURRENT_CROP_20261010_ADOPTION_SUCCESSOR_V1"],"applicable_stages":["SUCCESSOR_SUBJECT_PRE_MERGE","POST_MERGE_V13_QUALIFICATION"],"carry_forward_evidence_id":null,"diagnostic_command":"node scripts/governance_acceptance/VERIFY_MCFT_CAP_09_20261010_CROP_ADOPTION_SUCCESSOR_V1.cjs"};
const OLD_P="require(\"./VERIFY_MCFT_CAP_09_FROZEN_V13_REQUALIFICATION_SUCCESSOR_V1.cjs\").replayHistoricalRegistration()",NEW_P="(fs.existsSync(path.join(ROOT, \"scripts/governance_acceptance/VERIFY_MCFT_CAP_09_20261010_CROP_ADOPTION_SUCCESSOR_V1.cjs\")) ? require(\"./VERIFY_MCFT_CAP_09_20261010_CROP_ADOPTION_SUCCESSOR_V1.cjs\").replayHistoricalRegistration() : require(\"./VERIFY_MCFT_CAP_09_FROZEN_V13_REQUALIFICATION_SUCCESSOR_V1.cjs\").replayHistoricalRegistration())",OLD_W="if (frozenVerifier) frozenVerifier.verifySuccessor();",NEW_W="const stageSuccessorPath = 'scripts/governance_acceptance/VERIFY_MCFT_CAP_09_20261010_CROP_ADOPTION_SUCCESSOR_V1.cjs';\n          if (fs.existsSync(stageSuccessorPath)) require(process.cwd() + '/' + stageSuccessorPath).verifyStageSuccessor();\n          else if (frozenVerifier) frozenVerifier.verifySuccessor();";
const git=(...args)=>cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8",maxBuffer:16*1024*1024}).trim();
const original=p=>git("show",BASE+":"+p)+"\n";
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),"utf8"));
const sha=b=>"sha256:"+crypto.createHash("sha256").update(b).digest("hex");
function historicalReplay(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"geox-crop-historical-")),w=path.join(dir,"checkout");let mounted=false;
 try{
  git("worktree","add","--detach",w,BASE);mounted=true;
  const entry="const x=require('./VERIFY_MCFT_CAP_09_FROZEN_V13_REQUALIFICATION_SUCCESSOR_V1.cjs').replayHistoricalRegistration();console.log(JSON.stringify(x))";
  const out=cp.execFileSync(process.execPath,["-e",entry],{cwd:path.join(w,"scripts/governance_acceptance"),encoding:"utf8",timeout:240000,maxBuffer:16*1024*1024});
  const proof=JSON.parse(out.trim());assert.equal(proof.status,"PASS","HISTORICAL_REGISTRATION_NOT_PASS");return proof;
 }finally{if(mounted)git("worktree","remove","--force",w);fs.rmSync(dir,{recursive:true,force:true});}
}
function verifyStageSuccessor(){
 assert.equal(cp.spawnSync("git",["merge-base","--is-ancestor",BASE,"HEAD"],{cwd:ROOT}).status,0,"ADOPTED_BASE_NOT_ANCESTOR");
 assert.equal(git("rev-parse","origin/main"),BASE,"PROTECTED_MAIN_REBIND_REQUIRED");
 assert.deepEqual(git("status","--porcelain").split(/\r?\n/).filter(x=>x&&!x.startsWith("?? acceptance-output/")),[],"DIRTY_SOURCE");
 const diff=git("diff","--name-status",BASE,"HEAD").split(/\r?\n/).filter(Boolean).map(line=>{const [kind,file]=line.split("\t");return {kind,file};});
 assert.deepEqual(diff.map(x=>x.file).sort(),PATHS,"CURRENT_STAGE_EXACT_PATHS_REQUIRED");
 for(const x of diff)assert.equal(x.kind,[P,W,Q,R].includes(x.file)?"M":"A","UNAUTHORIZED_STAGE_CHANGE:"+x.file);
 assert.equal(fs.readFileSync(path.join(ROOT,FROZEN),"utf8"),original(FROZEN),"FROZEN_VERIFIER_MUTATED");
 assert.equal(fs.readFileSync(path.join(ROOT,P),"utf8"),original(P).replace(OLD_P,NEW_P).replace("function runDiagnostic(command, extraEnv = {}) {\n","function runDiagnostic(command, extraEnv = {}) {\n  const stageVerifier = path.join(ROOT, \"scripts/governance_acceptance/VERIFY_MCFT_CAP_09_20261010_CROP_ADOPTION_SUCCESSOR_V1.cjs\");\n  if (fs.existsSync(stageVerifier)) {\n    const stage = require(\"./VERIFY_MCFT_CAP_09_20261010_CROP_ADOPTION_SUCCESSOR_V1.cjs\");\n    if (stage.isFrozenDiagnosticCommand(command)) return stage.runHistoricalDiagnostic(command, extraEnv);\n  }\n"),"HISTORICAL_PREFLIGHT_MUTATED");
 assert.equal(fs.readFileSync(path.join(ROOT,W),"utf8"),original(W).replace(OLD_W,NEW_W),"HISTORICAL_QCP_WORKFLOW_MUTATED");
 const before=JSON.parse(original(Q)),now=read(Q);
 assert.equal(before.checks.length,46);assert.equal(now.checks.length,47);assert.deepEqual(now.checks.slice(0,46),before.checks,"HISTORICAL_CHECKS_CHANGED");
 assert.deepEqual(now.checks.at(-1),CHECK);assert.deepEqual(now.dependency_resolvers.CURRENT_CROP_20261010_ADOPTION_SUCCESSOR_V1,{kind:"EXACT_PATH_SET",paths:PATHS});
 const stripped=structuredClone(now);stripped.checks.pop();delete stripped.dependency_resolvers.CURRENT_CROP_20261010_ADOPTION_SUCCESSOR_V1;
 assert.deepEqual(stripped,before,"HISTORICAL_QCP_RESOLVERS_CHANGED");
 const past=JSON.parse(original(R)),current=read(R);assert.equal(current.entries.length,past.entries.length+1,"NOT_SINGLE_APPEND");
 const copy=structuredClone(current);copy.entries.pop();assert.deepEqual(copy,past,"HISTORICAL_CROP_REGISTRY_CHANGED");
 const entry=current.entries.at(-1),prev=past.entries.at(-1),a=read(S);
 assert.equal(entry.authority_ref,S);assert.equal(entry.authority_sha256,sha(fs.readFileSync(path.join(ROOT,S))),"CURRENT_STAGE_DIGEST_MISMATCH");
 assert.equal(entry.authority_as_of,"2026-10-10T04:00:00.000Z");assert.equal(entry.authority_valid_until,"2026-10-11T10:00:00.000Z");
 assert.equal(entry.graduation_status,"EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH");
 assert.equal(a.status,"PASS");assert.equal(a.subject_head_sha,BASE);assert.equal(a.biological_stage.authority_as_of,entry.authority_as_of);assert.equal(a.biological_stage.authority_valid_until,entry.authority_valid_until);
 assert.equal(a.biological_stage.epistemic_class,"THERMAL_MODEL_DERIVED");assert.equal(a.biological_stage.resolved_biological_stage,"R6_OR_LATER_MODEL_ESTIMATE");assert.equal(a.biological_stage.observed_biological_stage_claimed,false);
 assert.equal(a.lifecycle.domain_state,"ACTIVE");assert.equal(a.lifecycle.authority_status,"RESOLVED");assert.equal(a.lifecycle.authority_validity,"VALID");
 assert.equal(a.crop_water_use_stage,"LATE");assert.equal(a.crop_model_parameter.value,0.6);
 assert.equal(a.refresh_request.previous_effective_current_crop_authority.ref,prev.authority_ref);
 assert.equal(a.refresh_request.previous_effective_current_crop_authority.sha256,prev.authority_sha256);
 assert.equal(a.qualification_evidence.subject_sha,BASE);assert.equal(a.qualification_evidence.run_id,38023043739);assert.equal(a.qualification_evidence.artifact_id,11658794740);
 assert.equal(sha(Buffer.from(a.qualification_evidence.archive_bytes,"base64")),a.qualification_evidence.artifact_sha256,"ARTIFACT_ARCHIVE_HASH_MISMATCH");
 for(const k of ["runtime_config_write_authorized","database_write_authorized","scheduler_write_authorized","formal_evidence_write_authorized","production_runtime_start_authorized","production_owner_activation_authorized","formal_v5_authorized","a0_authorized","o00_o23_authorized","mcft_cap09_completed"])assert.equal(a[k],false,"PRODUCTION_EFFECT_NOT_ALLOWED:"+k);
 const v=require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs").resolveDependencyResolvers(ROOT,now).resolved.V13_RUNTIME_SEMANTIC_CLOSURE.paths;
 assert.equal(v.length,108);assert.equal(git("diff","--name-only","3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a","HEAD","--",...v),"","FROZEN_RUNTIME_CHANGED");
 const historical=historicalReplay();
 return {status:"PASS",adjudication:"STAGE_SUCCESSOR_EXACT_APPEND_AND_IMMUTABLE_HISTORICAL_REPLAY",head:git("rev-parse","HEAD"),baseline:BASE,changedPaths:PATHS,historical_registration:historical.status,retained_authorities:past.entries.length,new_authority_sha256:entry.authority_sha256,real_run_id:38023043739,production_effect:false,formal_v5_arm:false,a0_execution:false,o00_started:false};
}
function replayHistoricalRegistration(){verifyStageSuccessor();return historicalReplay();}

const HISTORIC_DIAGNOSTIC_CHECK_IDS=[
 "FORMAL_V5_R6_STAGE_ADMISSION","FORMAL_V5_FINAL_READBACK","FORMAL_V5_COMPLETION_ADJUDICATION",
 "FORMAL_ARM_RETIREMENT_ONLY","AM22_PREQUALIFICATION_ONLY","AM22_START_CHAIN_ENGINEERING_ONLY",
 "AM22_HOST_MEASUREMENT_ONLY","AM22_FRESH_AUTHORITY_APPEND_ONLY","AM22_GFS_BOOTSTRAP_ORCHESTRATION_ONLY",
 "AM22_POST_CUTOVER_RECOVERY_ENGINEERING_ONLY","AM22_GFS_PROGRESS_DIAGNOSTIC_ENGINEERING_ONLY",
 "FROZEN_V13_REQUALIFICATION_SUCCESSOR_ENGINEERING_ONLY"
];
function isFrozenDiagnosticCommand(command) {
 const rows=JSON.parse(original(Q)).checks.filter(x=>HISTORIC_DIAGNOSTIC_CHECK_IDS.includes(x.check_id));
 assert.equal(rows.length,HISTORIC_DIAGNOSTIC_CHECK_IDS.length,"FROZEN_DIAGNOSTIC_CHECK_SET_CHANGED");
 return rows.some(r=>command===r.diagnostic_command||command===r.diagnostic_command+" --selftest");
}
function runHistoricalDiagnostic(command,extraEnv={}) {
 assert(isFrozenDiagnosticCommand(command),"UNBOUND_HISTORIC_DIAGNOSTIC_COMMAND");
 verifyStageSuccessor();
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),"mcft-stage-diagnostic-")),checkout=path.join(folder,"base");let attached=false;
 try {
  git("worktree","add","--detach",checkout,BASE);attached=true;
  const result=cp.spawnSync(command,{cwd:checkout,encoding:"utf8",shell:true,env:{...process.env,...extraEnv,MCFT_CAP09_ALL_BLOCKERS_CHILD:"1"},timeout:240000});
  return {status:result.status===0?"PASS":"FAIL",exit_code:result.status,signal:result.signal||null,stdout_tail:String(result.stdout||"").slice(-4000),stderr_tail:String(result.stderr||"").slice(-4000),historical_subject_sha:BASE,current_stage_successor_proven:true};
 }finally{if(attached)git("worktree","remove","--force",checkout);fs.rmSync(folder,{recursive:true,force:true});}
}

module.exports={verifyStageSuccessor,replayHistoricalRegistration,isFrozenDiagnosticCommand,runHistoricalDiagnostic};
if(require.main===module){try{console.log(JSON.stringify(verifyStageSuccessor(),null,2));}catch(e){console.error(e.stack||String(e));process.exitCode=1;}}
