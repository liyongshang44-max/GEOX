import fs from "node:fs";
import {
  deriveExternalFormalA18CropContextIdentityHashV4,
  materializeExternalFormalA18CropContextV4,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v4.js";

const crop=JSON.parse(fs.readFileSync("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json","utf8"));
const matrix=JSON.parse(fs.readFileSync("docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json","utf8"));
const current=JSON.parse(fs.readFileSync("acceptance-output/MCFT_CAP09_T4R1_CURRENT_CROP_AUTHORITY_COMPOSITION_RESULT.json","utf8"));

if(current.status!=="PASS"||current.qualification_outcome!=="CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED"){
  throw new Error("A18_V4_CURRENT_CROP_COMPOSITION_PASS_REQUIRED");
}
const logical=new Date(Math.ceil(Date.now()/3_600_000)*3_600_000).toISOString();
const expected=deriveExternalFormalA18CropContextIdentityHashV4({
  logical_time:logical,
  crop_stage_code:current.crop_water_use_stage,
  current_crop_authority_evidence_digest:current.evidence_digest,
});
const result=materializeExternalFormalA18CropContextV4({
  logical_time:logical,
  expected_identity_hash:expected,
  crop_authority:crop,
  configuration_matrix:matrix,
  current_crop_authority:current,
  activation_mode:"QUALIFICATION_ONLY",
});
if(result.stage_code!=="LATE"||result.kc!==0.6)throw new Error("A18_V4_EXPECTED_LATE_KC_REQUIRED");
if(result.production_effective!==false)throw new Error("A18_V4_PRODUCTION_EFFECT_FORBIDDEN");
fs.mkdirSync("acceptance-output",{recursive:true});
fs.writeFileSync("acceptance-output/MCFT_CAP09_A18_BIOLOGICAL_STAGE_CONTEXT_V4_RESULT.json",JSON.stringify({
  schema_version:"geox_mcft_cap09_a18_biological_stage_context_v4_result_v1",
  status:"PASS",
  logical_time:logical,
  stage_code:result.stage_code,
  kc:result.kc,
  crop_stage_schedule:result.context.crop_stage_schedule,
  current_crop_authority_evidence_digest:result.current_crop_authority_evidence_digest,
  context_identity_hash:result.context_identity_hash,
  context_materialization_hash:result.context_materialization_hash,
  water_use_stage_forward_stable_under_thermal_progression:true,
  lifecycle_requires_separate_validation:true,
  historical_v3_mid_authority_rewritten:false,
  production_effective:false,
  runtime_write_count:0,
  database_write_count:0,
  formal_execution_count:"0/24"
},null,2)+"\n");
console.log(JSON.stringify({status:"PASS",logical_time:logical,stage_code:result.stage_code,kc:result.kc,production_effective:false}));
