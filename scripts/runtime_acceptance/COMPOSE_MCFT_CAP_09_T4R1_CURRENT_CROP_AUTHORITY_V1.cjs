#!/usr/bin/env node
"use strict";

const crypto=require("node:crypto");
const fs=require("node:fs");
const cp=require("node:child_process");

const AUTHORITY_PATH="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-CURRENT-CROP-AUTHORITY-COMPOSITION-V1.json";
const LIFE_PATH="acceptance-output/MCFT_CAP_09_T4R1_PERSISTENT_LIFECYCLE_QUALIFICATION_RESULT.json";
const STAGE_PATH="acceptance-output/MCFT_CAP09_T4R1_THERMAL_BIOLOGICAL_STAGE_PROBE_RESULT.json";
const OUT_PATH="acceptance-output/MCFT_CAP09_T4R1_CURRENT_CROP_AUTHORITY_COMPOSITION_RESULT.json";

function fail(code,detail){throw new Error(detail?code+":"+detail:code);}
function eq(a,b,code){if(a!==b)fail(code,"expected="+JSON.stringify(b)+" actual="+JSON.stringify(a));}
function sha256(value){return "sha256:"+crypto.createHash("sha256").update(value).digest("hex");}
function git(){return cp.execFileSync("git",Array.from(arguments),{encoding:"utf8"}).trim();}

const authority=JSON.parse(fs.readFileSync(AUTHORITY_PATH,"utf8"));
const life=JSON.parse(fs.readFileSync(LIFE_PATH,"utf8"));
const stage=JSON.parse(fs.readFileSync(STAGE_PATH,"utf8"));

eq(life.status,"PASS","CURRENT_CROP_LIFECYCLE_PROBE_NOT_PASS");
eq(life.qualification_outcome,authority.lifecycle_axis.required.qualification_outcome,"CURRENT_CROP_LIFECYCLE_OUTCOME_UNRESOLVED");
eq(life.season_lifecycle?.domain_state,authority.lifecycle_axis.required.domain_state,"CURRENT_CROP_LIFECYCLE_DOMAIN_STATE");
eq(life.season_lifecycle?.authority_status,authority.lifecycle_axis.required.authority_status,"CURRENT_CROP_LIFECYCLE_AUTHORITY_STATUS");
eq(life.season_lifecycle?.authority_validity,authority.lifecycle_axis.required.authority_validity,"CURRENT_CROP_LIFECYCLE_VALIDITY");
eq(life.season_lifecycle?.authority_mode,authority.lifecycle_axis.required.authority_mode,"CURRENT_CROP_LIFECYCLE_MODE");
eq(life.season_lifecycle?.active_consumable_candidate,true,"CURRENT_CROP_LIFECYCLE_NOT_CONSUMABLE");
eq(life.transition_sweep?.provider_silence_used_as_evidence,false,"CURRENT_CROP_LIFECYCLE_SILENCE_EVIDENCE_FORBIDDEN");
eq(life.transition_sweep?.proved_no_termination_occurred,false,"CURRENT_CROP_LIFECYCLE_OVERCLAIM_FORBIDDEN");

eq(stage.status,"PASS","CURRENT_CROP_STAGE_PROBE_NOT_PASS");
eq(stage.scope?.site_id,authority.scope.site_id,"CURRENT_CROP_STAGE_SITE_SCOPE");
eq(stage.scope?.field_id,authority.scope.field_id,"CURRENT_CROP_STAGE_FIELD_SCOPE");
eq(stage.scope?.season_id,authority.scope.season_id,"CURRENT_CROP_STAGE_SEASON_SCOPE");
eq(stage.scope?.zone_id,authority.scope.zone_id,"CURRENT_CROP_STAGE_ZONE_SCOPE");
eq(stage.scope?.crop,authority.scope.crop,"CURRENT_CROP_STAGE_CROP_SCOPE");
eq(stage.scope?.hybrid_product_code,authority.scope.hybrid_product_code,"CURRENT_CROP_STAGE_HYBRID_SCOPE");
eq(stage.epistemic_class,authority.biological_stage_axis.required_epistemic_class,"CURRENT_CROP_STAGE_EPISTEMIC_CLASS");
eq(stage.observed_biological_stage_claimed,false,"CURRENT_CROP_DERIVED_STAGE_MUST_NOT_CLAIM_OBSERVED");
eq(stage.lifecycle_authority_established_by_thermal_model,false,"CURRENT_CROP_THERMAL_LIFECYCLE_INFERENCE_FORBIDDEN");
eq(stage.resolved_biological_stage,authority.biological_stage_axis.expected_current_candidate,"CURRENT_CROP_BIOLOGICAL_STAGE_UNRESOLVED");
eq(stage.resolved_water_use_stage,authority.water_use_axis.expected_singleton_stage,"CURRENT_CROP_WATER_USE_STAGE_UNRESOLVED");

const kc=stage.candidate_crop_model_parameter_authority;
eq(kc?.status,"RESOLVED_CANDIDATE","CURRENT_CROP_KC_UNRESOLVED");
eq(kc?.parameter,authority.crop_model_parameter_axis.required_parameter,"CURRENT_CROP_KC_PARAMETER");
eq(kc?.stage_code,authority.crop_model_parameter_axis.expected_stage_code,"CURRENT_CROP_KC_STAGE");
eq(kc?.value,authority.crop_model_parameter_axis.expected_kc,"CURRENT_CROP_KC_VALUE");
eq(kc?.configuration_source_id,authority.crop_model_parameter_axis.configuration_source_id,"CURRENT_CROP_KC_CONFIG_SOURCE");
eq(kc?.configuration_semantic_hash,authority.crop_model_parameter_axis.configuration_semantic_hash,"CURRENT_CROP_KC_CONFIG_HASH");
eq(kc?.production_effective,false,"CURRENT_CROP_KC_PREMATURE_PRODUCTION_EFFECT");

const lifeBlob=git("hash-object",authority.lifecycle_axis.authority_path);
eq(lifeBlob,authority.lifecycle_axis.authority_blob_sha,"CURRENT_CROP_LIFECYCLE_AUTHORITY_BLOB_DRIFT");
const matrixBlob=git("hash-object",authority.crop_model_parameter_axis.configuration_matrix_path);
eq(matrixBlob,authority.crop_model_parameter_axis.configuration_matrix_blob_sha,"CURRENT_CROP_KC_MATRIX_BLOB_DRIFT");

const now=Date.parse(stage.as_of_logical_time);
if(!Number.isFinite(now))fail("CURRENT_CROP_STAGE_AS_OF_INVALID");
if(now>Date.parse(authority.lifecycle_axis.horizon_end_utc))fail("CURRENT_CROP_LIFECYCLE_HORIZON_EXPIRED");

const result={
  schema_version:"geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1",
  status:"PASS",
  subject_head_sha:git("rev-parse","HEAD"),
  qualification_outcome:"CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED",
  scope:authority.scope,
  lifecycle:{
    domain_state:life.season_lifecycle.domain_state,
    authority_status:life.season_lifecycle.authority_status,
    authority_validity:life.season_lifecycle.authority_validity,
    authority_mode:life.season_lifecycle.authority_mode,
    active_consumable_candidate:life.season_lifecycle.active_consumable_candidate,
    evaluated_at:life.state_evaluation_time,
    known_termination_result:life.transition_sweep.known_termination_result,
    known_contradiction_result:life.transition_sweep.known_contradiction_result,
    horizon_end_utc:life.lifecycle_horizon.horizon_end_utc
  },
  biological_stage:{
    epistemic_class:stage.epistemic_class,
    resolved_biological_stage:stage.resolved_biological_stage,
    observed_biological_stage_claimed:false,
    gdu_bounds:stage.gdu_bounds
  },
  crop_water_use_stage:stage.resolved_water_use_stage,
  crop_model_parameter:{
    parameter:"Kc",
    stage_code:kc.stage_code,
    value:kc.value,
    configuration_source_id:kc.configuration_source_id,
    configuration_semantic_hash:kc.configuration_semantic_hash,
    production_effective:false
  },
  evidence_digest:sha256(JSON.stringify({
    lifecycle_subject:life.subject_sha,
    lifecycle_evaluated_at:life.state_evaluation_time,
    lifecycle_state:life.season_lifecycle,
    stage_as_of:stage.as_of_logical_time,
    stage:stage.resolved_biological_stage,
    water_use:stage.resolved_water_use_stage,
    kc:kc
  })),
  architecture_effective:false,
  runtime_consumption_authorized:false,
  ...authority.non_effects
};
fs.mkdirSync("acceptance-output",{recursive:true});
fs.writeFileSync(OUT_PATH,JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify(result,null,2));
