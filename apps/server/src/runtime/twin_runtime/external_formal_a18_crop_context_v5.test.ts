import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  deriveExternalFormalA18CropContextIdentityHashV4,
  materializeExternalFormalA18CropContextV4,
} from "./external_formal_a18_crop_context_v4.js";
import {
  materializeExternalFormalA18CropContextV5,
} from "./external_formal_a18_crop_context_v5.js";

const cropAuthority = JSON.parse(fs.readFileSync(
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json",
  "utf8",
));
const matrix = JSON.parse(fs.readFileSync(
  "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json",
  "utf8",
));

function currentCrop(stage:"R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE"|"R6_OR_LATER_MODEL_ESTIMATE"){
  return {
    schema_version:"geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1",
    status:"PASS",
    qualification_outcome:"CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED",
    architecture_effective:true,
    runtime_consumption_authorized:true,
    scope:{
      tenant_id:"tenant_mcft_external",project_id:"project_mcft_cap09",group_id:"group_public_research",
      site_id:"KBS_MCSE_T4R1",field_id:"field_kbs_mcse_t4r1",season_id:"season_2026_corn",
      zone_id:"zone_kbs_mcse_t4r1_crop_formal_v1",crop:"corn",hybrid_product_code:"43-96P"
    },
    lifecycle:{
      domain_state:"ACTIVE",authority_status:"RESOLVED",authority_validity:"VALID",
      authority_mode:"GOVERNED_PERSISTENT_STATE",active_consumable_candidate:true
    },
    biological_stage:{
      epistemic_class:"THERMAL_MODEL_DERIVED",
      resolved_biological_stage:stage,
      observed_biological_stage_claimed:false,
      authority_as_of:"2026-10-09T04:00:00.000Z",
      forward_stability_hours:30
    },
    crop_water_use_stage:"LATE",
    crop_model_parameter:{
      parameter:"Kc",stage_code:"LATE",value:0.6,
      configuration_source_id:"mcft_crop_water_use_corn_v1",
      configuration_semantic_hash:"sha256:56ac92e34148bd81fe20f2925e1079cb1a3ed647ffefd1471caf1302df70ee4c",
      production_effective:false
    },
    evidence_digest:"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  };
}

const architecture={
  schema_version:"geox_dt02_biological_stage_authority_effectiveness_v1",
  amendment_id:"DT02-AMENDMENT-03",
  status:"EFFECTIVE",
  effective:true,
};

test("historical V4 still rejects R6 authority",()=>{
  const current=currentCrop("R6_OR_LATER_MODEL_ESTIMATE");
  const logical="2026-10-09T05:00:00.000Z";
  const expected=deriveExternalFormalA18CropContextIdentityHashV4({
    logical_time:logical,
    crop_stage_code:"LATE",
    current_crop_authority_evidence_digest:current.evidence_digest,
  });
  assert.throws(()=>materializeExternalFormalA18CropContextV4({
    logical_time:logical,
    expected_identity_hash:expected,
    crop_authority:cropAuthority,
    configuration_matrix:matrix,
    current_crop_authority:current,
    biological_stage_architecture_effectiveness:architecture,
    activation_mode:"PRODUCTION_EFFECTIVE",
  }),/EXTERNAL_FORMAL_A18_V4_BIOLOGICAL_STAGE_AUTHORITY_MISMATCH/);
});

test("Formal-v5 accepts R6 as the same governed LATE water-use materialization",()=>{
  const current=currentCrop("R6_OR_LATER_MODEL_ESTIMATE");
  const logical="2026-10-09T05:00:00.000Z";
  const expected=deriveExternalFormalA18CropContextIdentityHashV4({
    logical_time:logical,
    crop_stage_code:"LATE",
    current_crop_authority_evidence_digest:current.evidence_digest,
  });
  const result=materializeExternalFormalA18CropContextV5({
    logical_time:logical,
    expected_identity_hash:expected,
    crop_authority:cropAuthority,
    configuration_matrix:matrix,
    current_crop_authority:current,
    biological_stage_architecture_effectiveness:architecture,
    activation_mode:"PRODUCTION_EFFECTIVE",
  });
  assert.equal(result.stage_code,"LATE");
  assert.equal(result.kc,0.6);
  assert.equal(result.context_identity_hash,expected);
  assert.equal(result.production_effective,true);
  assert.equal(result.materialization_profile,"T4R1_A18_BIOLOGICAL_STAGE_AUTHORITY_CONTEXT_MATERIALIZATION_V4");
  assert.equal(result.context.crop_stage_schedule[0]?.stage_code,"LATE");
});

test("Formal-v5 preserves R5 materialization semantics",()=>{
  const current=currentCrop("R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE");
  const logical="2026-10-09T05:00:00.000Z";
  const expected=deriveExternalFormalA18CropContextIdentityHashV4({
    logical_time:logical,
    crop_stage_code:"LATE",
    current_crop_authority_evidence_digest:current.evidence_digest,
  });
  const v4=materializeExternalFormalA18CropContextV4({
    logical_time:logical,expected_identity_hash:expected,crop_authority:cropAuthority,
    configuration_matrix:matrix,current_crop_authority:current,
    biological_stage_architecture_effectiveness:architecture,
    activation_mode:"PRODUCTION_EFFECTIVE",
  });
  const v5=materializeExternalFormalA18CropContextV5({
    logical_time:logical,expected_identity_hash:expected,crop_authority:cropAuthority,
    configuration_matrix:matrix,current_crop_authority:current,
    biological_stage_architecture_effectiveness:architecture,
    activation_mode:"PRODUCTION_EFFECTIVE",
  });
  assert.deepEqual(v5,v4);
});

test("Formal-v5 rejects non-derived or non-LATE authority",()=>{
  const current=currentCrop("R6_OR_LATER_MODEL_ESTIMATE");
  current.crop_water_use_stage="MID";
  const logical="2026-10-09T05:00:00.000Z";
  const expected=deriveExternalFormalA18CropContextIdentityHashV4({
    logical_time:logical,
    crop_stage_code:"LATE",
    current_crop_authority_evidence_digest:current.evidence_digest,
  });
  assert.throws(()=>materializeExternalFormalA18CropContextV5({
    logical_time:logical,expected_identity_hash:expected,crop_authority:cropAuthority,
    configuration_matrix:matrix,current_crop_authority:current,
    biological_stage_architecture_effectiveness:architecture,
    activation_mode:"PRODUCTION_EFFECTIVE",
  }),/EXTERNAL_FORMAL_A18_V5_EXACT_LATE_STAGE_REQUIRED/);
});
