#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");

const FORMAL_DB="geox_mcft_cap09_s6_formal_t4r1_24h_v5";
const DEFAULT_OUT=path.resolve("acceptance-output/MCFT_CAP_09_FORMAL_V5_COMPLETION_CANDIDATE_V1.json");

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
function digest(value,code){
  const text=required(value,code);
  if(!/^sha256:[0-9a-f]{64}$/.test(text))throw new Error(code);
  return text;
}
function iso(value,code){
  const text=required(value,code),ms=Date.parse(text);
  if(!Number.isFinite(ms)||new Date(ms).toISOString()!==text)throw new Error(code);
  return text;
}
function read(file,code){
  const p=path.resolve(required(file,code));
  if(!fs.existsSync(p))throw new Error(code+"_MISSING:"+p);
  return {path:p,value:JSON.parse(fs.readFileSync(p,"utf8"))};
}
function sha256File(file){
  return "sha256:"+crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function same(actual,expected,code){assert.equal(actual,expected,code);}
function bool(actual,expected,code){assert.equal(actual,expected,code);}
function validate(inputs){
  const {arm,promotion,bootstrap,activation,cutover,readback,downstream}=inputs;
  same(arm.schema_version,"geox_mcft_cap09_formal_v5_arm_v1","G13_ARM_SCHEMA");
  same(arm.status,"PASS","G13_ARM_PASS");
  const subject=sha(arm.subject_sha,"G13_ARM_SUBJECT");
  same(arm.formal_database_name,FORMAL_DB,"G13_ARM_DATABASE");
  const armIdentity=digest(arm.arm_identity_hash,"G13_ARM_IDENTITY");
  const epoch=required(arm.epoch_id,"G13_ARM_EPOCH");
  const a0=iso(arm.a0,"G13_ARM_A0"),o00=iso(arm.o00,"G13_ARM_O00"),o23=iso(arm.o23,"G13_ARM_O23");
  assert.equal(Date.parse(o00)-Date.parse(a0),3_600_000,"G13_A0_O00_OFFSET");
  assert.equal(Date.parse(o23)-Date.parse(o00),23*3_600_000,"G13_O00_O23_SPAN");

  same(promotion.schema_version,"geox_mcft_cap09_formal_v5_a0_production_replay_promotion_v1","G13_PROMOTION_SCHEMA");
  same(promotion.status,"PASS","G13_PROMOTION_PASS");
  same(promotion.subject_sha,subject,"G13_PROMOTION_SUBJECT");
  const continuityHead=sha(promotion.authority_continuity_head_sha,"G13_PROMOTION_CONTINUITY_HEAD");
  same(promotion.arm_identity_hash,armIdentity,"G13_PROMOTION_ARM");
  same(promotion.epoch_id,epoch,"G13_PROMOTION_EPOCH");
  same(promotion.formal_database_name,FORMAL_DB,"G13_PROMOTION_DB");
  same(promotion.a0,a0,"G13_PROMOTION_A0");
  same(promotion.o00,o00,"G13_PROMOTION_O00");
  same(Number(promotion.formal_fact_count),3,"G13_PROMOTION_EXACT_3_FACTS");
  bool(promotion.a0_evidence_promoted,true,"G13_PROMOTION_A0_EVIDENCE");
  bool(promotion.exact_a0_same_cycle_gfs_pair,true,"G13_PROMOTION_GFS_PAIR");
  bool(promotion.a0_gfs_pair_causal_at_a0,true,"G13_PROMOTION_GFS_CAUSAL");
  bool(promotion.a0_base_supports_o00_warm_start,true,"G13_PROMOTION_O00_SUPPORT");
  same(Number(promotion.provider_request_count),0,"G13_PROMOTION_PROVIDER_REQUEST_ZERO");
  same(Number(promotion.source_operational_database_write_count),0,"G13_PROMOTION_SOURCE_DB_WRITE_ZERO");
  same(Number(promotion.scheduler_slot_write_count),0,"G13_PROMOTION_SCHEDULER_WRITE_ZERO");
  same(Number(promotion.runtime_tick_cursor_write_count),0,"G13_PROMOTION_RUNTIME_WRITE_ZERO");

  same(bootstrap.schema_version,"geox_mcft_cap09_formal_v5_a0_bootstrap_result_v1","G13_BOOTSTRAP_SCHEMA");
  same(bootstrap.status,"PASS","G13_BOOTSTRAP_PASS");
  same(bootstrap.arm_runtime_semantic_subject_sha,subject,"G13_BOOTSTRAP_SUBJECT");
  same(bootstrap.authority_continuity_head_sha,continuityHead,"G13_BOOTSTRAP_CONTINUITY");
  same(bootstrap.arm_identity_hash,armIdentity,"G13_BOOTSTRAP_ARM");
  same(bootstrap.epoch_id,epoch,"G13_BOOTSTRAP_EPOCH");
  same(bootstrap.formal_database_name,FORMAL_DB,"G13_BOOTSTRAP_DB");
  same(bootstrap.a0,a0,"G13_BOOTSTRAP_A0");
  same(bootstrap.o00,o00,"G13_BOOTSTRAP_O00");
  same(bootstrap.o23,o23,"G13_BOOTSTRAP_O23");
  const manifestHash=digest(bootstrap.manifest_hash,"G13_BOOTSTRAP_MANIFEST");
  bool(bootstrap.formal_a0_bootstrapped,true,"G13_BOOTSTRAP_A0_DONE");
  bool(bootstrap.formal_o00_started,false,"G13_BOOTSTRAP_PRE_O00");
  same(Number(bootstrap.scheduler_slot_count),0,"G13_BOOTSTRAP_ZERO_SLOTS");
  same(bootstrap.next_tick_logical_time,o00,"G13_BOOTSTRAP_NEXT_TICK");
  bool(bootstrap.lease_expiry_lte_o00,true,"G13_BOOTSTRAP_LEASE_EXPIRY");
  same(Number(bootstrap.provider_request_count),0,"G13_BOOTSTRAP_PROVIDER_ZERO");

  same(activation.schema_version,"geox_mcft_cap09_formal_v5_active_activation_authority_v1","G13_ACTIVATION_SCHEMA");
  same(activation.status,"PASS","G13_ACTIVATION_PASS");
  same(activation.subject_sha,subject,"G13_ACTIVATION_SUBJECT");
  same(activation.authority_continuity_head_sha,continuityHead,"G13_ACTIVATION_CONTINUITY");
  same(activation.epoch_id,epoch,"G13_ACTIVATION_EPOCH");
  same(activation.manifest_hash,manifestHash,"G13_ACTIVATION_MANIFEST");
  bool(activation.twin_activation_authorized,true,"G13_ACTIVATION_TWIN");
  bool(activation.forcing_activation_authorized,true,"G13_ACTIVATION_FORCING");

  same(cutover.schema_version,"geox_mcft_cap09_formal_v5_active_cutover_result_v1","G13_CUTOVER_SCHEMA");
  same(cutover.status,"PASS","G13_CUTOVER_PASS");
  same(cutover.subject_sha,subject,"G13_CUTOVER_SUBJECT");
  same(cutover.authority_continuity_head_sha,continuityHead,"G13_CUTOVER_CONTINUITY");
  same(cutover.epoch_id,epoch,"G13_CUTOVER_EPOCH");
  same(cutover.formal_database_name,FORMAL_DB,"G13_CUTOVER_DB");
  bool(cutover.formal_v5_active,true,"G13_CUTOVER_ACTIVE");
  bool(cutover.v13_forcing_process_active,true,"G13_CUTOVER_FORCING");
  bool(cutover.no_cross_store_double_twin_owner_window,true,"G13_CUTOVER_DOUBLE_OWNER");
  bool(cutover.new_fencing_token_strictly_greater_than_a0_bootstrap,true,"G13_CUTOVER_FENCE");

  same(readback.schema_version,"geox_mcft_cap09_formal_v5_final_readback_v1","G13_READBACK_SCHEMA");
  same(readback.status,"PASS","G13_READBACK_PASS");
  same(readback.runtime_semantic_subject_sha,subject,"G13_READBACK_SUBJECT");
  same(readback.authority_continuity_head_sha,continuityHead,"G13_READBACK_CONTINUITY");
  same(readback.arm_identity_hash,armIdentity,"G13_READBACK_ARM");
  same(readback.epoch_id,epoch,"G13_READBACK_EPOCH");
  same(readback.manifest_hash,manifestHash,"G13_READBACK_MANIFEST");
  same(readback.formal_database_name,FORMAL_DB,"G13_READBACK_DB");
  same(readback.a0,a0,"G13_READBACK_A0");
  same(readback.o00,o00,"G13_READBACK_O00");
  same(readback.o23,o23,"G13_READBACK_O23");
  same(Number(readback.scheduler_slot_count),24,"G13_READBACK_24_SLOTS");
  same(Number(readback.terminal_tick_count),24,"G13_READBACK_24_TICKS");
  same(Number(readback.runtime_config_count),25,"G13_READBACK_25_CONFIGS");
  same(Number(readback.exact_base_fact_count_per_type),24,"G13_READBACK_24_BASE_FACTS");
  same(Number(readback.evidence_window_count),24,"G13_READBACK_24_WINDOWS");
  same(Number(readback.forcing_receipt_count),23,"G13_READBACK_23_RECEIPTS");
  bool(readback.forcing_cursor_completed,true,"G13_READBACK_FORCING_CURSOR");
  bool(readback.forcing_all_physical_visibility_before_deadline,true,"G13_READBACK_PHYSICAL_VISIBILITY");
  bool(readback.twin_live_lease,false,"G13_READBACK_TWIN_LEASE");
  bool(readback.forcing_controller_live_lease,false,"G13_READBACK_FORCING_LEASE");
  const databaseReadbackAt=iso(readback.database_readback_at,"G13_READBACK_AT");
  bool(readback.database_readback_pass,true,"G13_READBACK_DB_PASS");
  bool(readback.final_actual_24h_still_required,false,"G13_READBACK_24H_COMPLETE");
  bool(readback.completion_adjudication_required,true,"G13_READBACK_ADJUDICATION_REQUIRED");
  bool(readback.mcft_cap09_completed,false,"G13_READBACK_NO_PREMATURE_COMPLETION");

  same(downstream.schema_version,"geox_mcft_cap09_formal_v5_downstream_zero_v1","G13_DOWNSTREAM_SCHEMA");
  same(downstream.status,"PASS","G13_DOWNSTREAM_PASS");
  same(downstream.runtime_semantic_subject_sha,subject,"G13_DOWNSTREAM_SUBJECT");
  same(downstream.formal_database_name,FORMAL_DB,"G13_DOWNSTREAM_DB");
  bool(downstream.downstream_zero_pass,true,"G13_DOWNSTREAM_ZERO");
  for(const key of ["decision_records","approved_plans","action_feedback_rows","downstream_named_facts"]){
    same(Number(downstream[key]),0,"G13_DOWNSTREAM_NONZERO:"+key);
  }
  bool(downstream.mcft_cap09_completed,false,"G13_DOWNSTREAM_NO_COMPLETION");

  return {subject,continuityHead,armIdentity,epoch,manifestHash,a0,o00,o23,databaseReadbackAt};
}
function assemble(files){
  const values=Object.fromEntries(Object.entries(files).map(([key,row])=>[key,row.value]));
  const id=validate(values);
  return {
    schema_version:"geox_mcft_cap09_formal_v5_completion_candidate_v1",
    status:"PASS",
    runtime_semantic_subject_sha:id.subject,
    authority_continuity_head_sha:id.continuityHead,
    arm_identity_hash:id.armIdentity,
    epoch_id:id.epoch,
    manifest_hash:id.manifestHash,
    formal_database_name:FORMAL_DB,
    a0:id.a0,o00:id.o00,o23:id.o23,
    final_database_readback_at:id.databaseReadbackAt,
    evidence_sha256:Object.fromEntries(Object.entries(files).map(([key,row])=>[key,sha256File(row.path)])),
    a0_base_promotion_count:1,
    v13_post_a0_forcing_receipt_count:23,
    scheduler_terminal_slot_count:24,
    terminal_tick_count:24,
    runtime_config_count:25,
    evidence_window_count:24,
    actual_wall_clock_o00_o23_completed:true,
    database_readback_pass:true,
    downstream_zero_pass:true,
    twin_lease_inactive:true,
    forcing_controller_lease_inactive:true,
    legacy_github_hourly_artifact_dependency:false,
    github_production_clock_dependency:false,
    formal_completion_candidate:true,
    final_actual_24h_still_required:false,
    final_adjudication_required:true,
    human_override_used:false,
    mcft_cap09_completed:false,
  };
}
function run(){
  const files={
    arm:read(arg("--arm"),"G13_ARM_PATH_REQUIRED"),
    promotion:read(arg("--promotion"),"G13_PROMOTION_PATH_REQUIRED"),
    bootstrap:read(arg("--bootstrap"),"G13_BOOTSTRAP_PATH_REQUIRED"),
    activation:read(arg("--activation"),"G13_ACTIVATION_PATH_REQUIRED"),
    cutover:read(arg("--cutover"),"G13_CUTOVER_PATH_REQUIRED"),
    readback:read(arg("--readback"),"G13_READBACK_PATH_REQUIRED"),
    downstream:read(arg("--downstream"),"G13_DOWNSTREAM_PATH_REQUIRED"),
  };
  const result=assemble(files);
  const out=path.resolve(arg("--out")||DEFAULT_OUT);
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,JSON.stringify(result,null,2)+"\n");
  process.stdout.write(JSON.stringify(result,null,2)+"\n");
}
function selftest(){
  const subject="1".repeat(40),head="2".repeat(40),armId="sha256:"+"a".repeat(64),manifest="sha256:"+"b".repeat(64);
  const a0="2099-01-01T00:00:00.000Z",o00="2099-01-01T01:00:00.000Z",o23="2099-01-02T00:00:00.000Z",epoch="epoch-v5";
  const arm={schema_version:"geox_mcft_cap09_formal_v5_arm_v1",status:"PASS",subject_sha:subject,formal_database_name:FORMAL_DB,arm_identity_hash:armId,epoch_id:epoch,a0,o00,o23};
  const promotion={schema_version:"geox_mcft_cap09_formal_v5_a0_production_replay_promotion_v1",status:"PASS",subject_sha:subject,authority_continuity_head_sha:head,arm_identity_hash:armId,epoch_id:epoch,formal_database_name:FORMAL_DB,a0,o00,formal_fact_count:3,a0_evidence_promoted:true,exact_a0_same_cycle_gfs_pair:true,a0_gfs_pair_causal_at_a0:true,a0_base_supports_o00_warm_start:true,provider_request_count:0,source_operational_database_write_count:0,scheduler_slot_write_count:0,runtime_tick_cursor_write_count:0};
  const bootstrap={schema_version:"geox_mcft_cap09_formal_v5_a0_bootstrap_result_v1",status:"PASS",arm_runtime_semantic_subject_sha:subject,authority_continuity_head_sha:head,arm_identity_hash:armId,epoch_id:epoch,manifest_hash:manifest,formal_database_name:FORMAL_DB,a0,o00,o23,formal_a0_bootstrapped:true,formal_o00_started:false,scheduler_slot_count:0,next_tick_logical_time:o00,lease_expiry_lte_o00:true,provider_request_count:0};
  const activation={schema_version:"geox_mcft_cap09_formal_v5_active_activation_authority_v1",status:"PASS",subject_sha:subject,authority_continuity_head_sha:head,epoch_id:epoch,manifest_hash:manifest,twin_activation_authorized:true,forcing_activation_authorized:true};
  const cutover={schema_version:"geox_mcft_cap09_formal_v5_active_cutover_result_v1",status:"PASS",subject_sha:subject,authority_continuity_head_sha:head,epoch_id:epoch,formal_database_name:FORMAL_DB,formal_v5_active:true,v13_forcing_process_active:true,no_cross_store_double_twin_owner_window:true,new_fencing_token_strictly_greater_than_a0_bootstrap:true};
  const readback={schema_version:"geox_mcft_cap09_formal_v5_final_readback_v1",status:"PASS",database_readback_at:"2099-01-02T00:05:00.000Z",runtime_semantic_subject_sha:subject,authority_continuity_head_sha:head,arm_identity_hash:armId,epoch_id:epoch,manifest_hash:manifest,formal_database_name:FORMAL_DB,a0,o00,o23,scheduler_slot_count:24,terminal_tick_count:24,runtime_config_count:25,exact_base_fact_count_per_type:24,evidence_window_count:24,forcing_receipt_count:23,forcing_cursor_completed:true,forcing_all_physical_visibility_before_deadline:true,twin_live_lease:false,forcing_controller_live_lease:false,database_readback_pass:true,final_actual_24h_still_required:false,completion_adjudication_required:true,mcft_cap09_completed:false};
  const downstream={schema_version:"geox_mcft_cap09_formal_v5_downstream_zero_v1",status:"PASS",runtime_semantic_subject_sha:subject,formal_database_name:FORMAL_DB,downstream_zero_pass:true,decision_records:0,approved_plans:0,action_feedback_rows:0,downstream_named_facts:0,mcft_cap09_completed:false};
  const id=validate({arm,promotion,bootstrap,activation,cutover,readback,downstream});
  assert.equal(id.subject,subject);
  process.stdout.write(JSON.stringify({schema_version:"geox_mcft_cap09_formal_v5_completion_candidate_selftest_v1",status:"PASS",formal_completion_candidate:true,final_adjudication_required:true,mcft_cap09_completed:false},null,2)+"\n");
}
if(process.argv.includes("--selftest"))selftest();else run();
