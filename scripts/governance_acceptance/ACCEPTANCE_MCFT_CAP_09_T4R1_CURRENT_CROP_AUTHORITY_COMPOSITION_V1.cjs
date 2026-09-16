#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const cp=require("node:child_process");

const EXPECTED_BASE="ffc9d03533670d2f47ace71d170602d8768ec1bc";
const BASE=process.env.MCFT_CAP09_CURRENT_CROP_COMPOSITION_BASE_SHA;
const paths=[
  ".github/workflows/mcft-cap-09-t4r1-current-crop-authority-composition-v1.yml",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-CURRENT-CROP-AUTHORITY-COMPOSITION-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T4R1_CURRENT_CROP_AUTHORITY_COMPOSITION_V1.cjs",
  "scripts/runtime_acceptance/COMPOSE_MCFT_CAP_09_T4R1_CURRENT_CROP_AUTHORITY_V1.cjs"
].sort();
function fail(c,d){throw new Error(d?c+":"+d:c);}
function eq(a,b,c){if(a!==b)fail(c,"expected="+JSON.stringify(b)+" actual="+JSON.stringify(a));}
function git(){return cp.execFileSync("git",Array.from(arguments),{encoding:"utf8"}).trim();}
eq(BASE,EXPECTED_BASE,"CURRENT_CROP_COMPOSITION_EXACT_BASE_REQUIRED");
eq(git("merge-base",EXPECTED_BASE,"HEAD"),EXPECTED_BASE,"CURRENT_CROP_COMPOSITION_BASE_NOT_ANCESTOR");
const changed=git("diff","--name-only",EXPECTED_BASE+"...HEAD").split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed),JSON.stringify(paths),"CURRENT_CROP_COMPOSITION_EXACT_FOUR_FILE_BOUNDARY_REQUIRED");
const a=JSON.parse(fs.readFileSync(paths[1],"utf8"));
eq(a.record_status,"CURRENT_CROP_AUTHORITY_COMPOSITION_CANDIDATE_NO_PRODUCTION_EFFECT","CURRENT_CROP_COMPOSITION_STATUS");
eq(a.scope.site_id,"KBS_MCSE_T4R1","CURRENT_CROP_COMPOSITION_SCOPE");
eq(a.lifecycle_axis.required.domain_state,"ACTIVE","CURRENT_CROP_COMPOSITION_LIFE_STATE");
eq(a.biological_stage_axis.required_epistemic_class,"THERMAL_MODEL_DERIVED","CURRENT_CROP_COMPOSITION_EPISTEMIC");
eq(a.water_use_axis.expected_singleton_stage,"LATE","CURRENT_CROP_COMPOSITION_STAGE");
eq(a.crop_model_parameter_axis.expected_kc,0.6,"CURRENT_CROP_COMPOSITION_KC");
for(const [k,v] of Object.entries(a.non_effects))eq(v,false,"CURRENT_CROP_COMPOSITION_NON_EFFECT:"+k);
const wf=fs.readFileSync(paths[0],"utf8");
for(const forbidden of ["workflow_dispatch:","schedule:","pull_request_target","docker compose up","FORMAL_DATABASE_URL","GEOX_MCFT_CAP09_S6_DATABASE_URL"]){
  if(wf.includes(forbidden))fail("CURRENT_CROP_COMPOSITION_FORBIDDEN_WORKFLOW_CAPABILITY",forbidden);
}
console.log(JSON.stringify({status:"PASS",exact_base_sha:EXPECTED_BASE,subject_head_sha:git("rev-parse","HEAD"),exact_changed_file_count:changed.length}));
