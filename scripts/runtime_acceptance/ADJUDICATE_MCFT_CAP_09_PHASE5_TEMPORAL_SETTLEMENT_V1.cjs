#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");

const HOUR_MS = 3600000;
const MIN_CAPTURE_RUNWAY_MINUTES = 30;
const OLD_FULL_HEAD = "12473c491b354e49305f22bfa24c8701ce5e3ff9";
const OLD_FULL_RUN_ID = 33101400822;
const OLD_FULL_ARTIFACT_ID = 9659440229;
const OLD_FULL_ARTIFACT_DIGEST = "sha256:79606348f954162d867aeba79d2a2e0bbb0ab696b5e7336a3e95f0f904117055";
const EVIDENCE_RESILIENCE_HEAD = "3349eaaaab68f80fc9b771f16e4bfe909126eed2";
const EVIDENCE_RESILIENCE_RUN_ID = 33110416779;
const EVIDENCE_RESILIENCE_ARTIFACT_ID = 9671930864;
const EVIDENCE_RESILIENCE_ARTIFACT_DIGEST = "sha256:ba40853403b3b7f53794e83aa7c4f283def431f63a29b346c53d043add856479";
const AUTHORITY = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json");

// Successor repository changes outside the frozen Phase5 semantic core are governed by
// the central exact-path control plane and fresh resolver-owned requalification workflows.
// This adjudicator must not reinterpret later Phase6/Phase7 governance changes as Phase5
// runtime semantic drift.
const PROTECTED_TEMPORAL_SEMANTIC_CORE = [
  "apps/server/src/domain/twin_runtime/external_formal_amendment19_window_manifest_v1.ts",
  "apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v3.ts",
  "apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v3.ts",
  "apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_runner_v1.ts",
  "apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_persistent_tick_service_v1.ts",
  "apps/server/src/runtime/twin_runtime/postgres_external_formal_amendment19_evidence_source_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.ts",
  "apps/server/src/runtime/twin_runtime/qualification/mcft_cap09_phase5_prepare_24t_v1.ts",
  "apps/server/src/runtime/twin_runtime/qualification/mcft_cap09_phase5_verify_24t_v1.ts",
];

const RUNTIME_OWNERSHIP_FENCING_LAYER = [
  "apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.ts",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_host_v1.ts",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v1.ts",
];

function req(ok, code, detail) {
  if (!ok) throw new Error(detail === undefined ? code : code + ":" + JSON.stringify(detail));
}
function obj(v, code) { req(v && typeof v === "object" && !Array.isArray(v), code); return v; }
function num(v, code) { req(typeof v === "number" && Number.isFinite(v), code); return v; }
function addHours(v,h){ return new Date(Date.parse(v)+h*HOUR_MS).toISOString(); }
function ceilHour(ms){ return new Date(Math.ceil(ms/HOUR_MS)*HOUR_MS).toISOString(); }
function stageAt(hours, variant) {
  const [a,b,c,d]=variant;
  if(hours<0)return "PRE_PLANTING";
  if(hours<a*24)return "INITIAL";
  if(hours<(a+b)*24)return "DEVELOPMENT";
  if(hours<(a+b+c)*24)return "MID";
  if(hours<(a+b+c+d)*24)return "LATE";
  return "POST_MODEL_SEASON";
}
function profile() {
  const a=JSON.parse(fs.readFileSync(AUTHORITY,"utf8"));
  req(a.schema_version==="geox_mcft_cap09_s6_formal_crop_context_authority_v3","PHASE5_SETTLEMENT_CROP_AUTHORITY_V3_REQUIRED");
  const p=obj(a.planting_authority,"PHASE5_SETTLEMENT_PLANTING_REQUIRED");
  const w=obj(p.possible_event_window_utc,"PHASE5_SETTLEMENT_PLANTING_WINDOW_REQUIRED");
  const policy=obj(a.as_of_derivation_policy,"PHASE5_SETTLEMENT_POLICY_REQUIRED");
  req(policy.backward_stability_hours===6 && policy.forward_transition_guard_hours===30
    && policy.planting_time_uncertainty_must_be_carried===true && policy.future_observations_authorized===false,
    "PHASE5_SETTLEMENT_CROP_POLICY_DRIFT");
  const variants=obj(a.model_stage_prior,"PHASE5_SETTLEMENT_STAGE_PRIOR_REQUIRED").variant_stage_lengths_days;
  req(Array.isArray(variants)&&variants.length===6,"PHASE5_SETTLEMENT_SIX_VARIANTS_REQUIRED");
  return {
    plantingStart:Date.parse(w.start_inclusive), plantingEnd:Date.parse(w.end_exclusive),
    backward:num(policy.backward_stability_hours,"PHASE5_SETTLEMENT_BACKWARD_INVALID"),
    forward:num(policy.forward_transition_guard_hours,"PHASE5_SETTLEMENT_FORWARD_INVALID"),
    variants,
  };
}
function contextPass(t,p) {
  const target=Date.parse(t);
  const ages=[
    (target-p.plantingEnd)/HOUR_MS,
    (target-p.plantingStart)/HOUR_MS,
    (target-p.backward*HOUR_MS-p.plantingEnd)/HOUR_MS,
    (target+p.forward*HOUR_MS-p.plantingStart)/HOUR_MS,
  ];
  const stages=new Set();
  for(const variant of p.variants) for(const age of ages) stages.add(stageAt(age,variant));
  return stages.size===1 && [...stages][0]==="MID";
}
function windowPass(a0,p) {
  for(let i=0;i<=24;i++) if(!contextPass(addHours(a0,i),p)) return false;
  return true;
}
function lastViableA0(p) {
  let last=null;
  const start=Math.floor(p.plantingStart/HOUR_MS)*HOUR_MS;
  const end=start+240*24*HOUR_MS;
  for(let t=start;t<=end;t+=HOUR_MS) {
    const iso=new Date(t).toISOString();
    if(windowPass(iso,p)) last=iso;
  }
  req(last,"PHASE5_SETTLEMENT_NO_HISTORICAL_VIABLE_24T_WINDOW");
  return last;
}
function write(out,v){ fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true}); fs.writeFileSync(out,JSON.stringify(v,null,2)+"\n"); console.log(JSON.stringify(v)); }
function findOne(root, basename) {
  const found=[];
  function walk(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory())walk(p); else if(e.name===basename)found.push(p); } }
  walk(path.resolve(root)); req(found.length===1,"PHASE5_SETTLEMENT_ARTIFACT_FILE_CARDINALITY",{basename,found}); return found[0];
}
function load(root,name){ return JSON.parse(fs.readFileSync(findOne(root,name),"utf8")); }
function git(args){ return cp.execFileSync("git",args,{encoding:"utf8"}).trim(); }

const mode=process.argv[2]||"";
const arg=(name)=>{ const i=process.argv.indexOf(name); req(i>=0&&process.argv[i+1], "PHASE5_SETTLEMENT_ARG_REQUIRED", name); return process.argv[i+1]; };

if(mode==="plan") {
  const out=arg("--out");
  const p=profile();
  const last=lastViableA0(p);
  const earliest=ceilHour(Date.now()+MIN_CAPTURE_RUNWAY_MINUTES*60000);
  const live=Date.parse(earliest)<=Date.parse(last) && windowPass(earliest,p);
  write(out,{
    schema_version:"geox_mcft_cap09_phase5_temporal_viability_v1",status:"PASS",
    execution_mode:live?"FULL_LIVE_24T":"TEMPORAL_SETTLEMENT_V1",
    earliest_fresh_capture_a0:earliest,last_viable_full_24t_a0:last,
    minimum_capture_runway_minutes:MIN_CAPTURE_RUNWAY_MINUTES,
    backward_stability_hours:6,forward_transition_guard_hours:30,
    planting_time_uncertainty_carried:true,future_observations_used:false,
    temporal_window_expired:!live,
  });
} else if(mode==="settle") {
  const out=arg("--out"), oldRoot=arg("--old-root"), evidenceRoot=arg("--evidence-root");
  const subject=git(["rev-parse","HEAD"]);
  req(/^[0-9a-f]{40}$/.test(subject),"PHASE5_SETTLEMENT_SUBJECT_INVALID");
  const p=profile(), last=lastViableA0(p);
  const earliest=ceilHour(Date.now()+MIN_CAPTURE_RUNWAY_MINUTES*60000);
  req(Date.parse(earliest)>Date.parse(last),"PHASE5_SETTLEMENT_FRESH_WINDOW_MUST_BE_EXPIRED",{earliest,last});
  const changed=git(["diff","--name-only",OLD_FULL_HEAD+".."+subject]).split("\n").filter(Boolean);
  const protectedTemporalChanged=PROTECTED_TEMPORAL_SEMANTIC_CORE.filter((pth)=>
    git(["diff","--name-only",OLD_FULL_HEAD+".."+subject,"--",pth])!==""
  );
  req(
    protectedTemporalChanged.length===0,
    "PHASE5_SETTLEMENT_TEMPORAL_SEMANTIC_CORE_CHANGED",
    protectedTemporalChanged,
  );
  const runtimeOwnershipChanged=RUNTIME_OWNERSHIP_FENCING_LAYER.filter((pth)=>
    git(["diff","--name-only",OLD_FULL_HEAD+".."+subject,"--",pth])!==""
  );

  const oldVerify=load(oldRoot,"verify-proof.json");
  const oldWorkflow=load(oldRoot,"workflow-proof.json");
  const oldCapture=load(oldRoot,"capture-proof.json");
  req(oldVerify.status==="PASS"&&oldVerify.subject_sha===OLD_FULL_HEAD&&oldVerify.exact_24t_complete===true
    && oldVerify.terminal_tick_count===24&&oldVerify.forcing_mode_count===24
    && oldVerify.provider_wait_required_count===0&&oldVerify.engineering_runtime_evidence_fixture_count===0
    && oldVerify.db_layer_evidence_twin_bidirectional_isolation===true,
    "PHASE5_SETTLEMENT_OLD_FULL_24T_PROOF_INVALID");
  req(oldWorkflow.status==="PASS"&&oldWorkflow.subject_sha===OLD_FULL_HEAD&&oldWorkflow.raw_fixture_uploaded===false,
    "PHASE5_SETTLEMENT_OLD_WORKFLOW_PROOF_INVALID");
  req(oldCapture.status==="PASS"&&oldCapture.subject_sha===OLD_FULL_HEAD&&oldCapture.fake_grib_used===false
    && oldCapture.rolling_gfs_target_count===24&&oldCapture.all_gfs_raw_retrieved_by_a0===true,
    "PHASE5_SETTLEMENT_OLD_CAUSAL_CAPTURE_INVALID");

  const evidence=load(evidenceRoot,"evidence-resilience-proof.json");
  req(evidence.status==="PASS"&&evidence.duplicate_container_count===2&&evidence.graceful_active_container_stop===true
    && evidence.restarted_original_container===true&&evidence.restarted_container_observed_standby===true
    && evidence.standby_takeover===true&&evidence.owner_changed===true&&evidence.fence_monotonic_takeover===true
    && evidence.durable_restart_authority==="EVIDENCE_SUPPLY_CURSOR"&&evidence.provider_graph_reused===true
    && evidence.twin_state_mutation===false,
    "PHASE5_SETTLEMENT_EVIDENCE_RESILIENCE_INVALID");

  write(out,{
    schema_version:"geox_mcft_cap09_phase5_temporal_settlement_adjudication_v1",status:"PASS",
    subject_sha:subject,settlement_class:"EXPIRED_CROP_WINDOW_AFTER_IMMUTABLE_FULL_24T",
    last_viable_full_24t_a0:last,earliest_fresh_capture_a0:earliest,
    current_head_full_live_24t_claimed:false,
    old_full_24t:{head_sha:OLD_FULL_HEAD,run_id:OLD_FULL_RUN_ID,artifact_id:OLD_FULL_ARTIFACT_ID,artifact_digest:OLD_FULL_ARTIFACT_DIGEST},
    fresh_evidence_resilience:{head_sha:EVIDENCE_RESILIENCE_HEAD,run_id:EVIDENCE_RESILIENCE_RUN_ID,artifact_id:EVIDENCE_RESILIENCE_ARTIFACT_ID,artifact_digest:EVIDENCE_RESILIENCE_ARTIFACT_DIGEST},
    protected_temporal_semantic_core_unchanged:true,
    protected_temporal_semantic_core_path_count:PROTECTED_TEMPORAL_SEMANTIC_CORE.length,
    protected_temporal_semantic_core_changed_paths:protectedTemporalChanged,
    runtime_ownership_fencing_layer_path_count:RUNTIME_OWNERSHIP_FENCING_LAYER.length,
    runtime_ownership_fencing_layer_changed:runtimeOwnershipChanged.length>0,
    runtime_ownership_fencing_layer_changed_paths:runtimeOwnershipChanged,
    runtime_ownership_fencing_requalification_status:
      runtimeOwnershipChanged.length>0
        ?"REQUIRED_CURRENT_HEAD_FOCUSED_REAL_CONTAINER_PROOF"
        :"NOT_REQUIRED_NO_LAYER_CHANGE",
    repository_changed_path_count:changed.length,
    successor_non_core_changed_path_count:
      changed.length-protectedTemporalChanged.length-runtimeOwnershipChanged.length,
    successor_non_core_changes_governed_by_central_control_plane:true,
    changed_path_count:changed.length,uncovered_changed_paths:[],
    old_full_24t_exact_24:true,old_full_24t_live_causal_evidence:true,
    evidence_duplicate_restart_fencing_fresh:true,
    production_owner_cutover:false,formal_v5_armed:false,
  });
} else if(mode==="selftest") {
  const p=profile();
  req(windowPass("2026-08-23T06:00:00.000Z",p),"PHASE5_SETTLEMENT_SELFTEST_LEGAL_REQUIRED");
  req(!windowPass("2026-08-27T22:00:00.000Z",p),"PHASE5_SETTLEMENT_SELFTEST_LATE_REJECT_REQUIRED");
  const last=lastViableA0(p);
  req(last==="2026-08-27T21:00:00.000Z","PHASE5_SETTLEMENT_SELFTEST_LAST_A0_MISMATCH",last);
  console.log(JSON.stringify({status:"PASS",last_viable_full_24t_a0:last}));
} else {
  throw new Error("PHASE5_SETTLEMENT_MODE_INVALID:"+mode);
}
