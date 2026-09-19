#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"../..");
const HOUR=3_600_000;
const DAY=24*HOUR;
const CROP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json";
const CURRENT="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-09-18T04Z-V1.json";
const ARM="scripts/runtime_acceptance/ASSEMBLE_MCFT_CAP_09_FORMAL_V5_ARM_V1.cjs";
const MANIFEST="scripts/runtime_acceptance/mcft_cap09_formal_v5_manifest_from_stage_authority_v1.ts";
const A18="apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v4.ts";
const H6="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-V5-PRODUCTION-ACTIVATION-SEAM-V1.json";
const AMENDMENT21="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-21-FORMAL-V5-EPOCH-STAGE-AUTHORITY-HANDOFF.md";
const INCIDENT_ARM_TIME="2026-09-19T04:43:45.612Z";

function readJson(rel){return JSON.parse(fs.readFileSync(path.join(ROOT,rel),"utf8"));}
function read(rel){return fs.readFileSync(path.join(ROOT,rel),"utf8");}
function ceilHour(ms){return Math.ceil(ms/HOUR)*HOUR;}
function iso(ms){return new Date(ms).toISOString();}

function stageAt(ageDays,lengths){
  if(!Array.isArray(lengths)||lengths.length!==4)return null;
  const [a,b,c,d]=lengths.map(Number);
  const b1=a,b2=a+b,b3=a+b+c,b4=a+b+c+d;
  if(!Number.isFinite(ageDays)||ageDays<0||ageDays>=b4)return null;
  if(ageDays<b1)return "INITIAL";
  if(ageDays<b2)return "DEVELOPMENT";
  if(ageDays<b3)return "MID";
  return "LATE";
}

function historicalEvaluateSlot(targetMs,crop){
  const variants=crop.model_stage_prior?.variant_stage_lengths_days;
  const window=crop.planting_authority?.possible_event_window_utc;
  const policy=crop.as_of_derivation_policy;
  assert.equal(Array.isArray(variants),true,"AM21_REGRESSION_VARIANTS_REQUIRED");
  assert.equal(variants.length,6,"AM21_REGRESSION_EXACT_SIX_VARIANTS_REQUIRED");
  assert.equal(policy?.backward_stability_hours,6,"AM21_REGRESSION_BACKWARD_GUARD_REQUIRED");
  assert.equal(policy?.forward_transition_guard_hours,30,"AM21_REGRESSION_FORWARD_GUARD_REQUIRED");
  const start=Date.parse(window?.start_inclusive);
  const end=Date.parse(window?.end_exclusive);
  assert.equal(Number.isFinite(start)&&Number.isFinite(end)&&start<end,true,"AM21_REGRESSION_PLANTING_WINDOW_REQUIRED");
  const stages=new Set();
  for(const variant of variants){
    for(const planting of [start,end-1]){
      for(const time of [targetMs-6*HOUR,targetMs,targetMs+30*HOUR]){
        const stage=stageAt((time-planting)/DAY,variant);
        if(!stage)return {stage:null,stages:["OUTSIDE_MODEL_WINDOW"]};
        stages.add(stage);
      }
    }
  }
  const stage=stages.size===1?[...stages][0]:null;
  return {stage,stages:[...stages].sort()};
}

function historicalWindowEligible(o00,crop,currentStage){
  for(let i=0;i<24;i+=1){
    const e=historicalEvaluateSlot(o00+i*HOUR,crop);
    if(!e.stage||e.stage!==currentStage)return false;
  }
  return true;
}

const crop=readJson(CROP);
const current=readJson(CURRENT);
const arm=read(ARM);
const manifest=read(MANIFEST);
const a18=read(A18);
const h6=readJson(H6);
const amendment21=read(AMENDMENT21);

assert.equal(current.crop_water_use_stage,"LATE","AM21_REGRESSION_CURRENT_LATE_STAGE_REQUIRED");
assert.equal(current.biological_stage?.epistemic_class,"THERMAL_MODEL_DERIVED","AM21_REGRESSION_THERMAL_STAGE_AUTHORITY_REQUIRED");
assert.equal(current.biological_stage?.resolved_biological_stage,"R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE","AM21_REGRESSION_BIOLOGICAL_STAGE_REQUIRED");
assert.equal(current.biological_stage?.observed_biological_stage_claimed,false,"AM21_REGRESSION_OBSERVED_STAGE_NONCLAIM_REQUIRED");

const horizon=Date.parse(current.lifecycle?.horizon_end_utc);
assert.equal(Number.isFinite(horizon),true,"AM21_REGRESSION_LIFECYCLE_HORIZON_REQUIRED");
const first=ceilHour(Date.parse(INCIDENT_ARM_TIME)+36*HOUR);
assert.equal(iso(first),"2026-09-20T17:00:00.000Z","AM21_REGRESSION_REAL_FIRST_CANDIDATE_REQUIRED");

let candidateCount=0;
let eligibleCount=0;
let firstDiagnostic=null;
for(let candidate=first;candidate+23*HOUR<=horizon;candidate+=HOUR){
  candidateCount+=1;
  if(historicalWindowEligible(candidate,crop,current.crop_water_use_stage)){
    eligibleCount+=1;
    continue;
  }
  if(!firstDiagnostic){
    const e=historicalEvaluateSlot(candidate,crop);
    firstDiagnostic={
      candidate_o00:iso(candidate),
      slot_id:"O00",
      current_stage:current.crop_water_use_stage,
      derived_stage:e.stage,
      derived_stages:e.stages,
    };
  }
}
assert.ok(candidateCount>0,"AM21_REGRESSION_CANDIDATE_SCAN_REQUIRED");
assert.equal(eligibleCount,0,"AM21_REGRESSION_HISTORICAL_SELECTOR_MUST_HAVE_ZERO_ELIGIBLE_WINDOWS");
assert.deepEqual(firstDiagnostic,{
  candidate_o00:"2026-09-20T17:00:00.000Z",
  slot_id:"O00",
  current_stage:"LATE",
  derived_stage:null,
  derived_stages:["LATE","MID"],
},"AM21_REGRESSION_FIRST_REAL_FAILURE_DIAGNOSTIC_DRIFT");

const variants=crop.model_stage_prior.variant_stage_lengths_days;
const slowestLateDay=Math.max(...variants.map((v)=>Number(v[0])+Number(v[1])+Number(v[2])));
const fastestModelEndDay=Math.min(...variants.map((v)=>v.map(Number).reduce((a,b)=>a+b,0)));
assert.equal(slowestLateDay,140,"AM21_REGRESSION_SLOWEST_LATE_DAY_REQUIRED");
assert.equal(fastestModelEndDay,125,"AM21_REGRESSION_FASTEST_MODEL_END_DAY_REQUIRED");
assert.ok(slowestLateDay>fastestModelEndDay,"AM21_REGRESSION_CALENDAR_ENVELOPE_DEADLOCK_REQUIRED");

for(const marker of [
  'CLOCK_ONLY_LIFECYCLE_BOUNDED_PENDING_POST_ARM_DT02_A18_STAGE_AUTHORITY',
  'future_stage_pins_deferred_to_post_arm_dt02_a18:true',
  'required_future_stage_authority_coverage:"A0_THROUGH_O23_INCLUSIVE"',
  'formal_stage_authority_pins_frozen:false',
  'arm_time_stage_snapshot_is_runtime_pin:false',
  'minimum_epoch_selection_governance_lead_hours:36',
]){
  assert.ok(arm.includes(marker),"AM21_REGRESSION_ARM_MARKER_REQUIRED:"+marker);
}
for(const forbidden of [
  "function evaluateSlot(",
  "variant_stage_lengths_days",
  "slot_stage_viability:",
]){
  assert.equal(arm.includes(forbidden),false,"AM21_REGRESSION_ARM_HISTORICAL_STAGE_VETO_FORBIDDEN:"+forbidden);
}

assert.ok(manifest.includes("FORMAL_V5_MANIFEST_STAGE_AUTHORITY_DOES_NOT_COVER_O23"),"AM21_REGRESSION_MANIFEST_O23_COVERAGE_GATE_REQUIRED");
assert.ok(manifest.includes("FORMAL_V5_MANIFEST_LIFECYCLE_HORIZON_BEFORE_O23"),"AM21_REGRESSION_MANIFEST_LIFECYCLE_O23_GATE_REQUIRED");
assert.ok(manifest.includes("buildMcftCap09FormalV5ManifestFromStageAuthorityV1"),"AM21_REGRESSION_STAGE_MANIFEST_REQUIRED");
assert.ok(a18.includes("EXTERNAL_FORMAL_A18_V4_STAGE_AUTHORITY_FORWARD_WINDOW_EXCEEDED"),"AM21_REGRESSION_A18_FORWARD_VALIDITY_GATE_REQUIRED");
assert.ok(a18.includes("THERMAL_MODEL_DERIVED"),"AM21_REGRESSION_A18_THERMAL_AUTHORITY_REQUIRED");

assert.equal(h6.arm.epoch_selection.minimum_governance_lead_hours,36);
assert.equal(h6.arm.epoch_selection.whole_window_crop_context_viability_required_at_arm,false);
assert.equal(h6.arm.epoch_selection.arm_time_future_stage_pin_freeze_forbidden,true);
assert.equal(h6.arm.epoch_selection.lifecycle_horizon_must_cover_o23,true);
assert.equal(h6.arm.epoch_selection.required_stage_authority_coverage,"A0_THROUGH_O23_INCLUSIVE");
assert.equal(h6.post_arm_authority_continuity.selected_authority_must_cover_a0_through_o23_inclusive,true);

for(const marker of [
  "Amendment-06 remains authoritative for the 36-hour minimum governance lead",
  "A0 through O23 inclusive",
  "most-likely stage selection",
  "human-specified LATE",
  "synthetic arm selftest alone is insufficient",
]){
  assert.ok(amendment21.includes(marker),"AM21_REGRESSION_AMENDMENT_MARKER_REQUIRED:"+marker);
}

const proof={
  schema_version:"geox_mcft_cap09_formal_v5_amendment21_late_season_regression_v1",
  status:"PASS",
  incident_arm_time_utc:INCIDENT_ARM_TIME,
  first_historical_candidate_o00:iso(first),
  lifecycle_horizon_utc:iso(horizon),
  historical_candidate_window_count:candidateCount,
  historical_eligible_window_count:eligibleCount,
  historical_amendment06_calendar_selector_deadlocked:true,
  slowest_fao_late_start_day:slowestLateDay,
  fastest_fao_model_end_day:fastestModelEndDay,
  historical_fao_calendar_envelope_retained_as_model_prior:true,
  historical_fao_calendar_envelope_used_as_future_v5_stage_truth:false,
  v5_arm_clock_only:true,
  minimum_governance_lead_hours:36,
  lifecycle_horizon_o23_gate_preserved:true,
  future_stage_pins_frozen_at_arm:false,
  post_arm_dt02_a18_stage_authority_required:true,
  required_stage_authority_coverage:"A0_THROUGH_O23_INCLUSIVE",
  manifest_o23_stage_coverage_gate_preserved:true,
  future_observation_authorized:false,
  most_likely_stage_authorized:false,
  human_late_override_authorized:false,
  production_effect:false,
  database_write_count:0,
  formal_v5_arm:false,
  a0_started:false,
  o00_started:false,
};
fs.mkdirSync(path.join(ROOT,"acceptance-output"),{recursive:true});
fs.writeFileSync(path.join(ROOT,"acceptance-output/MCFT_CAP_09_FORMAL_V5_AMENDMENT21_LATE_SEASON_REGRESSION_V1_RESULT.json"),JSON.stringify(proof,null,2)+"\n");
console.log(JSON.stringify(proof,null,2));
