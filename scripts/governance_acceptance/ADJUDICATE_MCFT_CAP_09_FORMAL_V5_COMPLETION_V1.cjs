#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const ROOT=path.resolve(__dirname,"../..");
const DEFAULT_OUT=path.resolve("acceptance-output/MCFT_CAP_09_FORMAL_V5_COMPLETION_ADJUDICATION_V1.json");

function arg(name){
  const row=process.argv.slice(2).find((value)=>value.startsWith(name+"="));
  return row?row.slice(name.length+1):null;
}
function required(value,code){
  const text=String(value??"").trim();
  if(!text)throw new Error(code);
  return text;
}
function sha(value,code){
  const text=required(value,code);
  if(!/^[0-9a-f]{40}$/.test(text))throw new Error(code);
  return text;
}
function digestFile(file){
  return "sha256:"+crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function git(...args){return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();}
function validateCandidate(candidate){
  assert.equal(candidate.schema_version,"geox_mcft_cap09_formal_v5_completion_candidate_v1","G13_ADJUDICATION_CANDIDATE_SCHEMA");
  assert.equal(candidate.status,"PASS","G13_ADJUDICATION_CANDIDATE_PASS");
  const subject=sha(candidate.runtime_semantic_subject_sha,"G13_ADJUDICATION_RUNTIME_SUBJECT");
  const head=sha(candidate.authority_continuity_head_sha,"G13_ADJUDICATION_CONTINUITY_HEAD");
  assert.equal(candidate.formal_database_name,"geox_mcft_cap09_s6_formal_t4r1_24h_v5","G13_ADJUDICATION_DATABASE");
  assert.equal(candidate.a0_base_promotion_count,1,"G13_ADJUDICATION_A0_PROMOTION");
  assert.equal(candidate.v13_post_a0_forcing_receipt_count,23,"G13_ADJUDICATION_23_RECEIPTS");
  assert.equal(candidate.scheduler_terminal_slot_count,24,"G13_ADJUDICATION_24_SLOTS");
  assert.equal(candidate.terminal_tick_count,24,"G13_ADJUDICATION_24_TICKS");
  assert.equal(candidate.runtime_config_count,25,"G13_ADJUDICATION_25_CONFIGS");
  assert.equal(candidate.evidence_window_count,24,"G13_ADJUDICATION_24_WINDOWS");
  assert.equal(candidate.actual_wall_clock_o00_o23_completed,true,"G13_ADJUDICATION_ACTUAL_24H");
  assert.equal(candidate.database_readback_pass,true,"G13_ADJUDICATION_DB_READBACK");
  assert.equal(candidate.downstream_zero_pass,true,"G13_ADJUDICATION_DOWNSTREAM_ZERO");
  assert.equal(candidate.twin_lease_inactive,true,"G13_ADJUDICATION_TWIN_LEASE");
  assert.equal(candidate.forcing_controller_lease_inactive,true,"G13_ADJUDICATION_FORCING_LEASE");
  assert.equal(candidate.legacy_github_hourly_artifact_dependency,false,"G13_ADJUDICATION_LEGACY_ARTIFACT_FORBIDDEN");
  assert.equal(candidate.github_production_clock_dependency,false,"G13_ADJUDICATION_GITHUB_CLOCK_FORBIDDEN");
  assert.equal(candidate.formal_completion_candidate,true,"G13_ADJUDICATION_COMPLETION_CANDIDATE");
  assert.equal(candidate.final_actual_24h_still_required,false,"G13_ADJUDICATION_24H_STILL_REQUIRED");
  assert.equal(candidate.final_adjudication_required,true,"G13_ADJUDICATION_REQUIRED");
  assert.equal(candidate.human_override_used,false,"G13_ADJUDICATION_OVERRIDE_FORBIDDEN");
  assert.equal(candidate.mcft_cap09_completed,false,"G13_ADJUDICATION_PREMATURE_COMPLETION");
  required(candidate.final_database_readback_at,"G13_ADJUDICATION_READBACK_TIME");
  const evidence=candidate.evidence_sha256;
  assert.ok(evidence&&typeof evidence==="object"&&!Array.isArray(evidence),"G13_ADJUDICATION_EVIDENCE_DIGESTS_REQUIRED");
  for(const key of ["arm","promotion","bootstrap","activation","cutover","readback","downstream"]){
    const value=required(evidence[key],"G13_ADJUDICATION_EVIDENCE_DIGEST_REQUIRED:"+key);
    if(!/^sha256:[0-9a-f]{64}$/.test(value))throw new Error("G13_ADJUDICATION_EVIDENCE_DIGEST_INVALID:"+key);
  }
  return {subject,head};
}
function run(){
  if(!process.argv.includes("--operator-authorized"))throw new Error("G13_ADJUDICATION_OPERATOR_AUTHORIZATION_REQUIRED");
  const candidatePath=path.resolve(required(arg("--candidate"),"G13_ADJUDICATION_CANDIDATE_PATH_REQUIRED"));
  if(!fs.existsSync(candidatePath))throw new Error("G13_ADJUDICATION_CANDIDATE_FILE_MISSING");
  const candidate=JSON.parse(fs.readFileSync(candidatePath,"utf8"));
  const id=validateCandidate(candidate);

  git("fetch","--no-tags","origin","main");
  const currentHead=git("rev-parse","HEAD"),originMain=git("rev-parse","origin/main");
  assert.equal(currentHead,originMain,"G13_ADJUDICATION_HEAD_MUST_EQUAL_CURRENT_MAIN");
  assert.equal(git("status","--porcelain"),"","G13_ADJUDICATION_WORKTREE_MUST_BE_CLEAN");
  assert.equal(currentHead,id.head,"G13_ADJUDICATION_MAIN_DRIFT_AFTER_FINAL_READBACK");
  cp.execFileSync("git",["merge-base","--is-ancestor",id.subject,currentHead],{cwd:ROOT,stdio:"ignore"});

  const result={
    schema_version:"geox_mcft_cap09_formal_v5_completion_adjudication_v1",
    status:"PASS",
    adjudication:"CAP09_FORMAL_V5_CLOSURE_ACCEPTED",
    runtime_semantic_subject_sha:id.subject,
    authority_continuity_head_sha:id.head,
    completion_candidate_sha256:digestFile(candidatePath),
    formal_database_name:candidate.formal_database_name,
    epoch_id:candidate.epoch_id,
    a0:candidate.a0,
    o00:candidate.o00,
    o23:candidate.o23,
    final_database_readback_at:candidate.final_database_readback_at,
    actual_wall_clock_o00_o23_completed:true,
    exact_24_terminal_slots:true,
    exact_24_terminal_ticks:true,
    exact_23_post_a0_forcing_receipts:true,
    a0_replay_promotion_present:true,
    database_readback_pass:true,
    downstream_zero_pass:true,
    no_live_twin_lease:true,
    no_live_forcing_controller_lease:true,
    legacy_github_production_clock_dependency:false,
    human_override_used:false,
    database_write_count:0,
    provider_request_count:0,
    runtime_write_count:0,
    mcft_cap09_completed:true,
    adjudicated_at:new Date().toISOString(),
  };
  const out=path.resolve(arg("--out")||DEFAULT_OUT);
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,JSON.stringify(result,null,2)+"\n");
  process.stdout.write(JSON.stringify(result,null,2)+"\n");
}
function selftest(){
  const candidate={
    schema_version:"geox_mcft_cap09_formal_v5_completion_candidate_v1",status:"PASS",
    runtime_semantic_subject_sha:"1".repeat(40),authority_continuity_head_sha:"2".repeat(40),
    formal_database_name:"geox_mcft_cap09_s6_formal_t4r1_24h_v5",
    a0_base_promotion_count:1,v13_post_a0_forcing_receipt_count:23,scheduler_terminal_slot_count:24,terminal_tick_count:24,
    runtime_config_count:25,evidence_window_count:24,actual_wall_clock_o00_o23_completed:true,database_readback_pass:true,
    downstream_zero_pass:true,twin_lease_inactive:true,forcing_controller_lease_inactive:true,
    legacy_github_hourly_artifact_dependency:false,github_production_clock_dependency:false,formal_completion_candidate:true,
    final_actual_24h_still_required:false,final_adjudication_required:true,human_override_used:false,mcft_cap09_completed:false,
    final_database_readback_at:"2099-01-02T00:05:00.000Z",
    evidence_sha256:Object.fromEntries(["arm","promotion","bootstrap","activation","cutover","readback","downstream"].map((key)=>[key,"sha256:"+"a".repeat(64)])),
  };
  validateCandidate(candidate);
  process.stdout.write(JSON.stringify({
    schema_version:"geox_mcft_cap09_formal_v5_completion_adjudication_selftest_v1",
    status:"PASS",
    operator_authorization_required:true,
    exact_main_continuity_required:true,
    database_write_count:0,
    provider_request_count:0,
    production_effect:false,
  },null,2)+"\n");
}
if(process.argv.includes("--selftest"))selftest();else run();
