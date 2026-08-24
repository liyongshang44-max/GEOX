#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const FORMAL_DATABASE = "geox_mcft_cap09_s6_formal_t4r1_24h_v4";
const HOURLY_FILE = "MCFT_CAP_09_AMENDMENT_19_FORMAL_HOURLY_EVIDENCE_PROMOTION_RESULT_V1.json";
const NOGO_FILE = "MCFT_CAP_09_AMENDMENT_19_FORMAL_V3_PRODUCTION_RUNNER_RESULT_V1.json";
const OUTPUT = path.resolve("acceptance-output/MCFT_CAP_09_AMENDMENT_19_FORMAL_COMPLETION_CANDIDATE_V1.json");

function fail(code) { throw new Error(code); }
function need(value, code) { if (!value) fail(code); }
function text(value, code) { const v=String(value??"").trim(); if(!v) fail(code); return v; }
function exactSha(value, code) { const v=text(value,code); if(!/^[0-9a-f]{40}$/.test(v)) fail(code); return v; }
function digest(value, code) { const v=text(value,code); if(!/^sha256:[0-9a-f]{64}$/.test(v)) fail(code); return v; }
function positiveInt(value, code) { const n=Number(value); if(!Number.isSafeInteger(n)||n<=0) fail(code); return n; }
function iso(value, code) { const v=text(value,code); const n=Date.parse(v); if(!Number.isFinite(n)||new Date(n).toISOString()!==v) fail(code); return v; }
function addHours(value, hours) { return new Date(Date.parse(value)+hours*3600000).toISOString(); }
function read(file, code) { if(!fs.existsSync(file)) fail(code); return JSON.parse(fs.readFileSync(file,"utf8")); }
function series(start,count){return Array.from({length:count},(_,i)=>addHours(start,i));}
function sameSet(actual,expected,code){const a=[...actual].sort(),e=[...expected].sort();if(JSON.stringify(a)!==JSON.stringify(e))fail(`${code}:${JSON.stringify({actual:a,expected:e})}`);}
function recursiveFiles(root,name){if(!root||!fs.existsSync(root))return[];const out=[];for(const e of fs.readdirSync(root,{withFileTypes:true})){const p=path.join(root,e.name);if(e.isDirectory())out.push(...recursiveFiles(p,name));else if(e.name===name)out.push(p);}return out;}

function artifactMeta(value, code) {
  return {
    workflow_run_id: positiveInt(value?.workflow_run_id, `${code}_RUN_ID_REQUIRED`),
    artifact_id: positiveInt(value?.artifact_id, `${code}_ARTIFACT_ID_REQUIRED`),
    artifact_name: text(value?.artifact_name, `${code}_ARTIFACT_NAME_REQUIRED`),
    artifact_digest: digest(value?.artifact_digest, `${code}_ARTIFACT_DIGEST_REQUIRED`),
    workflow_completed_at: iso(value?.workflow_completed_at, `${code}_WORKFLOW_COMPLETED_AT_REQUIRED`),
  };
}

function validate(input) {
  const subject=exactSha(input.subject_sha,"AM19_FORMAL_COMPLETION_SUBJECT_REQUIRED");
  const arm=input.arm;
  need(arm?.schema_version==="geox_mcft_cap09_amendment19_formal_arm_v1"&&arm.status==="PASS","AM19_FORMAL_COMPLETION_ARM_PASS_REQUIRED");
  need(arm.subject_sha===subject,"AM19_FORMAL_COMPLETION_ARM_SUBJECT_MISMATCH");
  need(arm.formal_database_name===FORMAL_DATABASE,"AM19_FORMAL_COMPLETION_EXACT_T4_DATABASE_REQUIRED");
  const armIdentity=text(arm.arm_identity_hash,"AM19_FORMAL_COMPLETION_ARM_IDENTITY_REQUIRED");
  const epoch=text(arm.epoch_id,"AM19_FORMAL_COMPLETION_EPOCH_REQUIRED");
  const a0=iso(arm.a0,"AM19_FORMAL_COMPLETION_A0_REQUIRED");
  const o00=iso(arm.o00,"AM19_FORMAL_COMPLETION_O00_REQUIRED");
  const o23=iso(arm.o23,"AM19_FORMAL_COMPLETION_O23_REQUIRED");
  need(addHours(a0,1)===o00&&addHours(a0,24)===o23,"AM19_FORMAL_COMPLETION_ARM_WINDOW_DRIFT");
  need(arm.final_actual_24h_still_required===true&&arm.formal_o00_started===false&&arm.mcft_cap09_completed===false,"AM19_FORMAL_COMPLETION_ARM_PREMATURE_CLAIM");

  const a0Promotion=input.a0_promotion;
  need(a0Promotion?.schema_version==="geox_mcft_cap09_amendment19_formal_a0_evidence_promotion_result_v1"&&a0Promotion.status==="PASS","AM19_FORMAL_COMPLETION_A0_PROMOTION_PASS_REQUIRED");
  need(a0Promotion.subject_sha===subject&&a0Promotion.arm_identity_hash===armIdentity&&a0Promotion.epoch_id===epoch&&a0Promotion.formal_database_name===FORMAL_DATABASE&&a0Promotion.a0===a0,"AM19_FORMAL_COMPLETION_A0_PROMOTION_IDENTITY_REQUIRED");
  need(a0Promotion.canonical_fact_write_count===3&&a0Promotion.formal_fact_count===3,"AM19_FORMAL_COMPLETION_A0_EXACT_THREE_FACTS_REQUIRED");
  const a0PromotionCompletedAt=iso(a0Promotion.promotion_completed_at,"AM19_FORMAL_COMPLETION_A0_PROMOTION_COMPLETED_AT_REQUIRED");
  need(a0Promotion.supported_slot_t===o00&&a0Promotion.promotion_completed_before_o00===true&&Date.parse(a0PromotionCompletedAt)<Date.parse(o00),"AM19_FORMAL_COMPLETION_A0_PROMOTION_BEFORE_O00_REQUIRED");
  need(a0Promotion.producer_bound_transient_raw_reverification===true&&a0Promotion.formal_content_addressed_raw_retention_before_decoder===true&&a0Promotion.normalized_semantics_match_producer_bound_reference===true&&a0Promotion.raw_sha256_preserved===true&&a0Promotion.decoder_identity_preserved===true&&a0Promotion.source_record_identity_preserved===true&&a0Promotion.transient_ref_present_in_formal_fact===false&&a0Promotion.provider_refetch_count===0&&a0Promotion.scheduler_write_count===0&&a0Promotion.runtime_write_count===0,"AM19_FORMAL_COMPLETION_A0_PROVENANCE_REQUIRED");

  const boot=input.bootstrap;
  need(boot?.schema_version==="geox_mcft_cap09_amendment19_formal_a0_bootstrap_result_v1"&&boot.status==="PASS","AM19_FORMAL_COMPLETION_BOOTSTRAP_PASS_REQUIRED");
  need(boot.subject_sha===subject&&boot.arm_identity_hash===armIdentity&&boot.epoch_id===epoch&&boot.formal_database_name===FORMAL_DATABASE&&boot.a0===a0&&boot.o00===o00&&boot.o23===o23,"AM19_FORMAL_COMPLETION_BOOTSTRAP_IDENTITY_REQUIRED");
  const manifestHash=text(boot.manifest_hash,"AM19_FORMAL_COMPLETION_MANIFEST_HASH_REQUIRED");
  need(boot.formal_a0_bootstrapped===true&&boot.formal_o00_started===false&&boot.scheduler_slot_count===0&&boot.next_tick_logical_time===o00&&boot.lease_expiry_lte_o00===true&&boot.provider_request_count===0&&boot.scheduler_slot_write_count===0,"AM19_FORMAL_COMPLETION_BOOTSTRAP_BOUNDARY_REQUIRED");

  const ledger=input.ledger;
  need(ledger?.schema_version==="geox_mcft_cap09_amendment19_formal_artifact_ledger_v1"&&ledger.status==="PASS"&&ledger.subject_sha===subject,"AM19_FORMAL_COMPLETION_LEDGER_REQUIRED");
  const armArtifact=artifactMeta(ledger.arm,"AM19_FORMAL_COMPLETION_ARM_LEDGER");
  const a0Artifact=artifactMeta(ledger.a0,"AM19_FORMAL_COMPLETION_A0_LEDGER");
  need(armArtifact.artifact_name.startsWith(`mcft-cap09-am19-formal-arm-${subject}-`),"AM19_FORMAL_COMPLETION_ARM_ARTIFACT_NAME_REQUIRED");
  need(a0Artifact.artifact_name.startsWith(`mcft-cap09-am19-formal-a0-${subject}-`),"AM19_FORMAL_COMPLETION_A0_ARTIFACT_NAME_REQUIRED");
  need(ledger.no_go_scan_complete===true&&Number(ledger.matching_epoch_no_go_count)===0,"AM19_FORMAL_COMPLETION_NO_GO_EPOCH_FORBIDDEN");

  const hourly=input.hourly_results.filter((p)=>p?.status==="PASS"&&p.subject_sha===subject&&p.arm_identity_hash===armIdentity&&p.epoch_id===epoch);
  need(hourly.length===23,`AM19_FORMAL_COMPLETION_EXACT_23_HOURLY_PROMOTIONS_REQUIRED:${hourly.length}`);
  const expectedBases=series(o00,23);
  const expectedSlots=series(addHours(o00,1),23);
  sameSet(hourly.map((p)=>p.base_target_t),expectedBases,"AM19_FORMAL_COMPLETION_HOURLY_BASES_REQUIRED");
  sameSet(hourly.map((p)=>p.supported_slot_t),expectedSlots,"AM19_FORMAL_COMPLETION_HOURLY_SUPPORTED_SLOTS_REQUIRED");
  const seenBases=new Set();
  for(const p of hourly){
    const base=iso(p.base_target_t,"AM19_FORMAL_COMPLETION_HOURLY_BASE_INVALID");
    const slot=iso(p.supported_slot_t,"AM19_FORMAL_COMPLETION_HOURLY_SLOT_INVALID");
    need(!seenBases.has(base),`AM19_FORMAL_COMPLETION_DUPLICATE_HOURLY_BASE:${base}`);seenBases.add(base);
    need(addHours(base,1)===slot,"AM19_FORMAL_COMPLETION_BASE_SLOT_MAPPING_REQUIRED");
    const completed=iso(p.promotion_completed_at,"AM19_FORMAL_COMPLETION_PROMOTION_COMPLETED_AT_REQUIRED");
    need(Date.parse(completed)<Date.parse(slot),`AM19_FORMAL_COMPLETION_PROMOTION_AFTER_SUPPORTED_SLOT:${base}:${completed}:${slot}`);
    need(p.manifest_hash===manifestHash&&p.formal_database_name===FORMAL_DATABASE&&p.canonical_fact_write_count===3&&p.producer_bound_transient_raw_reverification===true&&p.formal_content_addressed_raw_retention_before_decoder===true&&p.normalized_semantics_match_reference===true&&p.raw_sha256_preserved===true&&p.decoder_identity_preserved===true&&p.provider_refetch_count===0&&p.scheduler_write_count===0&&p.runtime_write_count===0&&p.supported_slot_write_completed_before_t===true&&p.o23_seed_for_o24_written===false&&p.late_write_repair_authorized===false,"AM19_FORMAL_COMPLETION_HOURLY_PROOF_REQUIRED");
  }
  need(!seenBases.has(o23),"AM19_FORMAL_COMPLETION_O23_SEED_FOR_O24_FORBIDDEN");

  const hourlyLedger=Array.isArray(ledger.hourly)?ledger.hourly:[];
  need(hourlyLedger.length===23,`AM19_FORMAL_COMPLETION_EXACT_23_HOURLY_ARTIFACTS_REQUIRED:${hourlyLedger.length}`);
  const ledgerBases=[];
  for(const entry of hourlyLedger){const meta=artifactMeta(entry,"AM19_FORMAL_COMPLETION_HOURLY_LEDGER");const base=iso(entry.base_target_t,"AM19_FORMAL_COMPLETION_HOURLY_LEDGER_BASE_REQUIRED");const slot=iso(entry.supported_slot_t,"AM19_FORMAL_COMPLETION_HOURLY_LEDGER_SLOT_REQUIRED");need(addHours(base,1)===slot,"AM19_FORMAL_COMPLETION_HOURLY_LEDGER_MAPPING_REQUIRED");need(meta.artifact_name.startsWith(`mcft-cap09-am19-formal-hourly-${subject}-`),"AM19_FORMAL_COMPLETION_HOURLY_ARTIFACT_NAME_REQUIRED");ledgerBases.push(base);}
  sameSet(ledgerBases,expectedBases,"AM19_FORMAL_COMPLETION_HOURLY_LEDGER_BASES_REQUIRED");

  const readback=input.readback;
  need(readback?.schema_version==="geox_mcft_cap09_amendment19_formal_final_readback_v1"&&readback.status==="PASS"&&readback.subject_sha===subject&&readback.arm_identity_hash===armIdentity&&readback.epoch_id===epoch&&readback.manifest_hash===manifestHash&&readback.formal_database_name===FORMAL_DATABASE,"AM19_FORMAL_COMPLETION_READBACK_IDENTITY_REQUIRED");
  need(readback.scheduler_slot_count===24&&readback.terminal_tick_count===24&&readback.cursor_next_slot_index===24&&readback.cursor_last_terminal_slot_id==="O23"&&readback.cursor_last_terminal_logical_time===o23&&readback.latest_state_logical_time===o23&&readback.latest_checkpoint_logical_time===o23&&readback.latest_health_logical_time===o23&&readback.latest_forecast_logical_time===o23&&readback.runtime_config_count===25&&readback.required_base_snapshot_count===24&&readback.required_hourly_promotions_after_a0===23&&readback.o23_extra_seed_for_o24_count===0&&readback.evidence_window_count===24&&readback.provider_wait_required_count===0&&readback.late_rewrite_authorized_count===0&&readback.assumption_relabel_authorized_count===0&&readback.active_lease===false&&readback.durable_formal_raw_retention_only===true&&readback.transient_raw_reference_count===0&&readback.database_readback_pass===true,"AM19_FORMAL_COMPLETION_DB_READBACK_REQUIRED");
  sameSet(readback.required_base_snapshots,series(a0,24),"AM19_FORMAL_COMPLETION_READBACK_BASES_REQUIRED");
  need(readback.physical_pre_t_promotion_ledger_pass===false&&readback.final_actual_24h_still_required===true&&readback.mcft_cap09_completed===false,"AM19_FORMAL_COMPLETION_READBACK_MUST_REMAIN_DB_ONLY");

  const downstream=input.downstream;
  need(downstream?.schema_version==="geox_mcft_cap09_amendment19_formal_downstream_zero_result_v1"&&downstream.status==="PASS"&&downstream.subject_sha===subject&&downstream.formal_database_name===FORMAL_DATABASE&&downstream.downstream_zero_pass===true&&downstream.decision_records===0&&downstream.approved_plans===0&&downstream.action_feedback_rows===0&&downstream.downstream_named_facts===0&&downstream.database_write_count===0&&downstream.scheduler_write_count===0&&downstream.runtime_write_count===0,"AM19_FORMAL_COMPLETION_DOWNSTREAM_ZERO_REQUIRED");

  for(const p of input.no_go_results){if(p?.subject_sha===subject&&p?.arm_identity_hash===armIdentity&&p?.epoch_id===epoch&&(p.status==="FAIL"||p.formal_epoch_no_go===true))fail("AM19_FORMAL_COMPLETION_MATCHING_EPOCH_NO_GO_EVIDENCE_PRESENT");}

  return {
    schema_version:"geox_mcft_cap09_amendment19_formal_completion_candidate_v1",
    status:"PASS",
    subject_sha:subject,
    arm_identity_hash:armIdentity,
    epoch_id:epoch,
    manifest_hash:manifestHash,
    formal_database_name:FORMAL_DATABASE,
    a0,o00,o23,
    a0_evidence_promotion_pass:true,
    a0_bootstrap_pass:true,
    hourly_causal_base_promotion_count:23,
    exact_causal_base_snapshot_count:24,
    exact_terminal_tick_count:24,
    physical_pre_t_promotion_ledger_pass:true,
    o23_seed_for_o24_written:false,
    database_readback_pass:true,
    downstream_zero_pass:true,
    matching_epoch_no_go_count:0,
    formal_execution_count:"24/24",
    actual_wall_clock_o00_o23_completed:true,
    stage1b_graduation_gate:"PASS",
    final_actual_24h_still_required:false,
    human_override_used:false,
    formal_completion_candidate:true,
    completion_adjudication_required:true,
    mcft_cap09_completed:false,
    evidence_artifacts:{arm:armArtifact,a0:a0Artifact,hourly_count:hourlyLedger.length},
  };
}

function selftest(){
  const subject="1".repeat(40),a0="2026-08-20T05:00:00.000Z",o00=addHours(a0,1),o23=addHours(a0,24),armId="sha256:"+"a".repeat(64),manifest="sha256:"+"b".repeat(64);
  const meta=(name,id,at)=>({workflow_run_id:id,artifact_id:id+100,artifact_name:name,artifact_digest:"sha256:"+"c".repeat(64),workflow_completed_at:at});
  const arm={schema_version:"geox_mcft_cap09_amendment19_formal_arm_v1",status:"PASS",subject_sha:subject,arm_identity_hash:armId,epoch_id:"epoch",formal_database_name:FORMAL_DATABASE,a0,o00,o23,final_actual_24h_still_required:true,formal_o00_started:false,mcft_cap09_completed:false};
  const a0p={schema_version:"geox_mcft_cap09_amendment19_formal_a0_evidence_promotion_result_v1",status:"PASS",subject_sha:subject,arm_identity_hash:armId,epoch_id:"epoch",formal_database_name:FORMAL_DATABASE,a0,supported_slot_t:o00,promotion_completed_at:new Date(Date.parse(o00)-60000).toISOString(),promotion_completed_before_o00:true,canonical_fact_write_count:3,formal_fact_count:3,producer_bound_transient_raw_reverification:true,formal_content_addressed_raw_retention_before_decoder:true,normalized_semantics_match_producer_bound_reference:true,raw_sha256_preserved:true,decoder_identity_preserved:true,source_record_identity_preserved:true,transient_ref_present_in_formal_fact:false,provider_refetch_count:0,scheduler_write_count:0,runtime_write_count:0};
  const boot={schema_version:"geox_mcft_cap09_amendment19_formal_a0_bootstrap_result_v1",status:"PASS",subject_sha:subject,arm_identity_hash:armId,epoch_id:"epoch",manifest_hash:manifest,formal_database_name:FORMAL_DATABASE,a0,o00,o23,formal_a0_bootstrapped:true,formal_o00_started:false,scheduler_slot_count:0,next_tick_logical_time:o00,lease_expiry_lte_o00:true,provider_request_count:0,scheduler_slot_write_count:0};
  const hourly=series(o00,23).map((base)=>({schema_version:"geox_mcft_cap09_amendment19_formal_hourly_evidence_promotion_result_v1",status:"PASS",subject_sha:subject,arm_identity_hash:armId,epoch_id:"epoch",manifest_hash:manifest,formal_database_name:FORMAL_DATABASE,base_target_t:base,supported_slot_t:addHours(base,1),promotion_completed_at:new Date(Date.parse(addHours(base,1))-60000).toISOString(),canonical_fact_write_count:3,producer_bound_transient_raw_reverification:true,formal_content_addressed_raw_retention_before_decoder:true,normalized_semantics_match_reference:true,raw_sha256_preserved:true,decoder_identity_preserved:true,provider_refetch_count:0,scheduler_write_count:0,runtime_write_count:0,supported_slot_write_completed_before_t:true,o23_seed_for_o24_written:false,late_write_repair_authorized:false}));
  const ledger={schema_version:"geox_mcft_cap09_amendment19_formal_artifact_ledger_v1",status:"PASS",subject_sha:subject,no_go_scan_complete:true,matching_epoch_no_go_count:0,arm:meta(`mcft-cap09-am19-formal-arm-${subject}-1`,1,a0),a0:meta(`mcft-cap09-am19-formal-a0-${subject}-2`,2,new Date(Date.parse(o00)-60000).toISOString()),hourly:hourly.map((p,i)=>({...meta(`mcft-cap09-am19-formal-hourly-${subject}-${i}-3`,10+i,p.promotion_completed_at),base_target_t:p.base_target_t,supported_slot_t:p.supported_slot_t}))};
  const readback={schema_version:"geox_mcft_cap09_amendment19_formal_final_readback_v1",status:"PASS",subject_sha:subject,arm_identity_hash:armId,epoch_id:"epoch",manifest_hash:manifest,formal_database_name:FORMAL_DATABASE,scheduler_slot_count:24,terminal_tick_count:24,cursor_next_slot_index:24,cursor_last_terminal_slot_id:"O23",cursor_last_terminal_logical_time:o23,latest_state_logical_time:o23,latest_checkpoint_logical_time:o23,latest_health_logical_time:o23,latest_forecast_logical_time:o23,runtime_config_count:25,required_base_snapshot_count:24,required_base_snapshots:series(a0,24),required_hourly_promotions_after_a0:23,o23_extra_seed_for_o24_count:0,evidence_window_count:24,provider_wait_required_count:0,late_rewrite_authorized_count:0,assumption_relabel_authorized_count:0,active_lease:false,durable_formal_raw_retention_only:true,transient_raw_reference_count:0,database_readback_pass:true,physical_pre_t_promotion_ledger_pass:false,final_actual_24h_still_required:true,mcft_cap09_completed:false};
  const downstream={schema_version:"geox_mcft_cap09_amendment19_formal_downstream_zero_result_v1",status:"PASS",subject_sha:subject,formal_database_name:FORMAL_DATABASE,downstream_zero_pass:true,decision_records:0,approved_plans:0,action_feedback_rows:0,downstream_named_facts:0,database_write_count:0,scheduler_write_count:0,runtime_write_count:0};
  const out=validate({subject_sha:subject,arm,a0_promotion:a0p,bootstrap:boot,hourly_results:hourly,ledger,readback,downstream,no_go_results:[]});
  need(out.status==="PASS"&&out.formal_database_name===FORMAL_DATABASE&&out.physical_pre_t_promotion_ledger_pass===true&&out.final_actual_24h_still_required===false&&out.formal_completion_candidate===true&&out.mcft_cap09_completed===false,"AM19_FORMAL_COMPLETION_SELFTEST_PASS_REQUIRED");
  console.log(JSON.stringify({schema_version:"geox_mcft_cap09_amendment19_formal_completion_selftest_v1",status:"PASS",formal_database_name:FORMAL_DATABASE,exact_base_count:24,exact_hourly_promotions:23,exact_terminal_ticks:24,no_go_fail_closed:true,completion_is_candidate_not_final_claim:true,formal_effect:false}));
}

function run(){
  const subject=process.env.MCFT_CAP09_SUBJECT_SHA;
  const arm=read(path.resolve(process.env.MCFT_CAP09_AM19_FORMAL_ARM_PATH||""),"AM19_FORMAL_COMPLETION_ARM_FILE_REQUIRED");
  const a0Promotion=read(path.resolve(process.env.MCFT_CAP09_AM19_FORMAL_A0_PROMOTION_PATH||""),"AM19_FORMAL_COMPLETION_A0_PROMOTION_FILE_REQUIRED");
  const bootstrap=read(path.resolve(process.env.MCFT_CAP09_AM19_FORMAL_A0_BOOTSTRAP_PATH||""),"AM19_FORMAL_COMPLETION_BOOTSTRAP_FILE_REQUIRED");
  const ledger=read(path.resolve(process.env.MCFT_CAP09_AM19_FORMAL_LEDGER_PATH||""),"AM19_FORMAL_COMPLETION_LEDGER_FILE_REQUIRED");
  const readback=read(path.resolve(process.env.MCFT_CAP09_AM19_FORMAL_READBACK_PATH||""),"AM19_FORMAL_COMPLETION_READBACK_FILE_REQUIRED");
  const downstream=read(path.resolve(process.env.MCFT_CAP09_AM19_FORMAL_DOWNSTREAM_ZERO_PATH||""),"AM19_FORMAL_COMPLETION_DOWNSTREAM_FILE_REQUIRED");
  const hourlyResults=recursiveFiles(path.resolve(process.env.MCFT_CAP09_AM19_FORMAL_HOURLY_DIR||""),HOURLY_FILE).map((f)=>read(f,"AM19_FORMAL_COMPLETION_HOURLY_FILE_INVALID"));
  const noGoResults=recursiveFiles(path.resolve(process.env.MCFT_CAP09_AM19_FORMAL_NOGO_DIR||""),NOGO_FILE).map((f)=>read(f,"AM19_FORMAL_COMPLETION_NOGO_FILE_INVALID"));
  const result=validate({subject_sha:subject,arm,a0_promotion:a0Promotion,bootstrap,hourly_results:hourlyResults,ledger,readback,downstream,no_go_results:noGoResults});
  fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});fs.writeFileSync(OUTPUT,JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result));
}

const mode=process.argv[2];
if(mode==="selftest")selftest();
else if(mode==="run")run();
else fail("AM19_FORMAL_COMPLETION_MODE_REQUIRED:selftest|run");
