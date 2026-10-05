#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const cp=require("node:child_process");

const LEGACY_BASE="ffc9d03533670d2f47ace71d170602d8768ec1bc";
const CURRENT_MAIN_PROGRESSION_BASE="80ab7aaf7b76cf2a931c5a9e99276ce9fb1d5992";
const BASE=process.env.MCFT_CAP09_CURRENT_CROP_COMPOSITION_BASE_SHA;
const workflowPath=".github/workflows/mcft-cap-09-t4r1-current-crop-authority-composition-v1.yml";
const authorityPath="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-CURRENT-CROP-AUTHORITY-COMPOSITION-V1.json";
const acceptancePath="scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T4R1_CURRENT_CROP_AUTHORITY_COMPOSITION_V1.cjs";
const twinWorkflowPath=".github/workflows/mcft-cap-09-twin-composition-v2-stage-authority.yml";
const composerPath="scripts/runtime_acceptance/COMPOSE_MCFT_CAP_09_T4R1_CURRENT_CROP_AUTHORITY_V1.cjs";
const legacyPaths=[workflowPath,authorityPath,acceptancePath,composerPath].sort();
const progressionPaths=[workflowPath,twinWorkflowPath,authorityPath,acceptancePath,composerPath].sort();

function fail(c,d){throw new Error(d?c+":"+d:c);}
function eq(a,b,c){if(a!==b)fail(c,"expected="+JSON.stringify(b)+" actual="+JSON.stringify(a));}
function git(){return cp.execFileSync("git",Array.from(arguments),{encoding:"utf8"}).trim();}
function changedFrom(base){
  return git("diff","--name-only",base+"...HEAD").split(/\r?\n/).filter(Boolean).sort();
}

const currentMainIsAncestor=git("merge-base",CURRENT_MAIN_PROGRESSION_BASE,"HEAD")===CURRENT_MAIN_PROGRESSION_BASE;
const currentMainChanged=currentMainIsAncestor?changedFrom(CURRENT_MAIN_PROGRESSION_BASE):[];
const currentMainMode=
  currentMainIsAncestor &&
  currentMainChanged.length>0 &&
  currentMainChanged.every((p)=>progressionPaths.includes(p));

let mode;
let exactBase;
let changed;

if(currentMainMode){
  mode="CURRENT_MAIN_NATURAL_SEASON_STAGE_PROGRESSION";
  exactBase=CURRENT_MAIN_PROGRESSION_BASE;
  changed=currentMainChanged;
  eq(JSON.stringify(changed),JSON.stringify(progressionPaths),"CURRENT_CROP_PROGRESSION_EXACT_FIVE_FILE_BOUNDARY_REQUIRED");
}else{
  mode="HISTORICAL_COMPOSITION";
  exactBase=LEGACY_BASE;
  eq(BASE,LEGACY_BASE,"CURRENT_CROP_COMPOSITION_EXACT_BASE_REQUIRED");
  eq(git("merge-base",LEGACY_BASE,"HEAD"),LEGACY_BASE,"CURRENT_CROP_COMPOSITION_BASE_NOT_ANCESTOR");
  changed=changedFrom(LEGACY_BASE);
  eq(JSON.stringify(changed),JSON.stringify(legacyPaths),"CURRENT_CROP_COMPOSITION_EXACT_FOUR_FILE_BOUNDARY_REQUIRED");
}

const a=JSON.parse(fs.readFileSync(authorityPath,"utf8"));
eq(a.record_status,"CURRENT_CROP_AUTHORITY_COMPOSITION_CANDIDATE_NO_PRODUCTION_EFFECT","CURRENT_CROP_COMPOSITION_STATUS");
eq(a.scope.site_id,"KBS_MCSE_T4R1","CURRENT_CROP_COMPOSITION_SCOPE");
eq(a.lifecycle_axis.required.domain_state,"ACTIVE","CURRENT_CROP_COMPOSITION_LIFE_STATE");
eq(a.biological_stage_axis.required_epistemic_class,"THERMAL_MODEL_DERIVED","CURRENT_CROP_COMPOSITION_EPISTEMIC");
eq(a.water_use_axis.expected_singleton_stage,"LATE","CURRENT_CROP_COMPOSITION_STAGE");
eq(a.crop_model_parameter_axis.expected_kc,0.6,"CURRENT_CROP_COMPOSITION_KC");

const allowed=[
  "R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE",
  "R6_OR_LATER_MODEL_ESTIMATE"
];
eq(
  JSON.stringify(a.biological_stage_axis.allowed_current_candidates),
  JSON.stringify(allowed),
  "CURRENT_CROP_COMPOSITION_ALLOWED_BIOLOGICAL_STAGES"
);
eq(
  a.biological_stage_axis.r6_or_later_requires_independent_active_lifecycle,
  true,
  "CURRENT_CROP_COMPOSITION_R6_LIFECYCLE_GUARD"
);
eq(
  a.composition_policy.lifecycle_independent_from_stage,
  true,
  "CURRENT_CROP_COMPOSITION_LIFECYCLE_INDEPENDENCE"
);
eq(
  a.composition_policy.stage_independent_from_lifecycle,
  true,
  "CURRENT_CROP_COMPOSITION_STAGE_INDEPENDENCE"
);
eq(
  a.composition_policy.natural_season_stage_progression_compatibility,
  "R5_TO_R6_OR_LATER_WITH_INDEPENDENT_ACTIVE_LIFECYCLE",
  "CURRENT_CROP_COMPOSITION_NATURAL_SEASON_PROGRESS_POLICY"
);

function policyAdmits({stage,lifecycle,water,kc}){
  return allowed.includes(stage) &&
    lifecycle==="ACTIVE" &&
    water==="LATE" &&
    kc===0.6;
}
eq(policyAdmits({stage:allowed[0],lifecycle:"ACTIVE",water:"LATE",kc:0.6}),true,"CURRENT_CROP_POLICY_R5_ACTIVE_MUST_PASS");
eq(policyAdmits({stage:allowed[1],lifecycle:"ACTIVE",water:"LATE",kc:0.6}),true,"CURRENT_CROP_POLICY_R6_ACTIVE_MUST_PASS");
eq(policyAdmits({stage:"PRE_R5_MODEL_ESTIMATE",lifecycle:"ACTIVE",water:"LATE",kc:0.6}),false,"CURRENT_CROP_POLICY_PRE_R5_MUST_FAIL");
eq(policyAdmits({stage:"UNKNOWN_STAGE",lifecycle:"ACTIVE",water:"LATE",kc:0.6}),false,"CURRENT_CROP_POLICY_UNKNOWN_STAGE_MUST_FAIL");
eq(policyAdmits({stage:allowed[1],lifecycle:"TERMINATED",water:"LATE",kc:0.6}),false,"CURRENT_CROP_POLICY_R6_TERMINATED_MUST_FAIL");
eq(policyAdmits({stage:allowed[1],lifecycle:"ACTIVE",water:"MID",kc:0.6}),false,"CURRENT_CROP_POLICY_R6_NONLATE_MUST_FAIL");
eq(policyAdmits({stage:allowed[1],lifecycle:"ACTIVE",water:"LATE",kc:0.7}),false,"CURRENT_CROP_POLICY_R6_KC_DRIFT_MUST_FAIL");

for(const [k,v] of Object.entries(a.non_effects))eq(v,false,"CURRENT_CROP_COMPOSITION_NON_EFFECT:"+k);

for(const workflow of [workflowPath,twinWorkflowPath]){
  const wf=fs.readFileSync(workflow,"utf8");
  for(const forbidden of ["workflow_dispatch:","schedule:","pull_request_target","docker compose up","FORMAL_DATABASE_URL","GEOX_MCFT_CAP09_S6_DATABASE_URL"]){
    if(wf.includes(forbidden))fail("CURRENT_CROP_COMPOSITION_FORBIDDEN_WORKFLOW_CAPABILITY",workflow+":"+forbidden);
  }
}

console.log(JSON.stringify({
  status:"PASS",
  mode,
  exact_base_sha:exactBase,
  subject_head_sha:git("rev-parse","HEAD"),
  exact_changed_file_count:changed.length,
  allowed_current_biological_stages:allowed,
  r6_requires_independent_active_lifecycle:true,
  water_use_stage:"LATE",
  kc:0.6,
  production_effect:false
}));
