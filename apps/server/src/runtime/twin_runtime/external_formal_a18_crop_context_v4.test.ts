import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  deriveExternalFormalA18CropContextIdentityHashV4,
  materializeExternalFormalA18CropContextV4,
} from "./external_formal_a18_crop_context_v4.js";

const cropAuthority = JSON.parse(fs.readFileSync(
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json","utf8"
));
const matrix = JSON.parse(fs.readFileSync(
  "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json","utf8"
));

function currentCrop() {
  return {
    schema_version:"geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1",
    status:"PASS",
    qualification_outcome:"CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED",
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
      resolved_biological_stage:"R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE",
      observed_biological_stage_claimed:false,
      authority_as_of:"2026-09-03T04:00:00.000Z",
      forward_stability_hours:30
    },
    crop_water_use_stage:"LATE",
    crop_model_parameter:{
      parameter:"Kc",stage_code:"LATE",value:0.6,
      configuration_source_id:"mcft_crop_water_use_corn_v1",
      configuration_semantic_hash:"sha256:56ac92e34148bd81fe20f2925e1079cb1a3ed647ffefd1471caf1302df70ee4c",
      production_effective:false
    },
    evidence_digest:"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  };
}

test("V4 materializes LATE / Kc 0.6 from biological-stage authority instead of hardcoded MID", () => {
  const current=currentCrop();
  const logical="2026-09-03T05:00:00.000Z";
  const expected=deriveExternalFormalA18CropContextIdentityHashV4({
    logical_time:logical,crop_stage_code:"LATE",
    current_crop_authority_evidence_digest:current.evidence_digest
  });
  const result=materializeExternalFormalA18CropContextV4({
    logical_time:logical,expected_identity_hash:expected,crop_authority:cropAuthority,
    configuration_matrix:matrix,current_crop_authority:current,activation_mode:"QUALIFICATION_ONLY"
  });
  assert.equal(result.stage_code,"LATE");
  assert.equal(result.kc,0.6);
  assert.equal(result.context.crop_stage_schedule[0]?.stage_code,"LATE");
  assert.equal(result.context.crop_stage_schedule[0]?.kc,0.6);
  assert.equal(result.context.crop_stage_schedule[0]?.crop_root_depth_mm,600);
  assert.equal(result.context.crop_stage_schedule[0]?.effective_model_root_depth_mm,300);
  assert.equal(result.water_use_stage_forward_stable_under_thermal_progression,true);
  assert.equal(result.lifecycle_requires_separate_validation,true);
  assert.equal(result.production_effective,false);
});

test("V4 fails closed when lifecycle is not ACTIVE/RESOLVED/VALID", () => {
  const current=currentCrop();
  current.lifecycle.authority_validity="EXPIRED";
  const logical="2026-09-03T05:00:00.000Z";
  const expected=deriveExternalFormalA18CropContextIdentityHashV4({
    logical_time:logical,crop_stage_code:"LATE",
    current_crop_authority_evidence_digest:current.evidence_digest
  });
  assert.throws(()=>materializeExternalFormalA18CropContextV4({
    logical_time:logical,expected_identity_hash:expected,crop_authority:cropAuthority,
    configuration_matrix:matrix,current_crop_authority:current,activation_mode:"QUALIFICATION_ONLY"
  }),/EXTERNAL_FORMAL_A18_V4_LIFECYCLE_NOT_CONSUMABLE/);
});

test("V4 forbids production activation before effectiveness", () => {
  const current=currentCrop();
  const logical="2026-09-03T05:00:00.000Z";
  const expected=deriveExternalFormalA18CropContextIdentityHashV4({
    logical_time:logical,crop_stage_code:"LATE",
    current_crop_authority_evidence_digest:current.evidence_digest
  });
  assert.throws(()=>materializeExternalFormalA18CropContextV4({
    logical_time:logical,expected_identity_hash:expected,crop_authority:cropAuthority,
    configuration_matrix:matrix,current_crop_authority:current,
    activation_mode:"PRODUCTION_EFFECTIVE"
  }),/EXTERNAL_FORMAL_A18_V4_CURRENT_CROP_AUTHORITY_NOT_EFFECTIVE/);
});

test("V4 production mode requires effective architecture and effective current crop authority", () => {
  const current=currentCrop();
  current.architecture_effective=true;
  current.runtime_consumption_authorized=true;
  const logical="2026-09-03T05:00:00.000Z";
  const expected=deriveExternalFormalA18CropContextIdentityHashV4({
    logical_time:logical,crop_stage_code:"LATE",
    current_crop_authority_evidence_digest:current.evidence_digest
  });
  assert.throws(()=>materializeExternalFormalA18CropContextV4({
    logical_time:logical,expected_identity_hash:expected,crop_authority:cropAuthority,
    configuration_matrix:matrix,current_crop_authority:current,
    biological_stage_architecture_effectiveness:{
      schema_version:"geox_dt02_biological_stage_authority_effectiveness_v1",
      amendment_id:"DT02-AMENDMENT-03",status:"CANDIDATE",effective:false
    },
    activation_mode:"PRODUCTION_EFFECTIVE"
  }),/EXTERNAL_FORMAL_A18_V4_ARCHITECTURE_EFFECTIVENESS_REQUIRED/);

  const result=materializeExternalFormalA18CropContextV4({
    logical_time:logical,expected_identity_hash:expected,crop_authority:cropAuthority,
    configuration_matrix:matrix,current_crop_authority:current,
    biological_stage_architecture_effectiveness:{
      schema_version:"geox_dt02_biological_stage_authority_effectiveness_v1",
      amendment_id:"DT02-AMENDMENT-03",status:"EFFECTIVE",effective:true
    },
    activation_mode:"PRODUCTION_EFFECTIVE"
  });
  assert.equal(result.stage_code,"LATE");
  assert.equal(result.kc,0.6);
  assert.equal(result.production_effective,true);
});

test("V4 fails closed if current Kc disagrees with exact frozen matrix", () => {
  const current=currentCrop();
  current.crop_model_parameter.value=0.7;
  const logical="2026-09-03T05:00:00.000Z";
  const expected=deriveExternalFormalA18CropContextIdentityHashV4({
    logical_time:logical,crop_stage_code:"LATE",
    current_crop_authority_evidence_digest:current.evidence_digest
  });
  assert.throws(()=>materializeExternalFormalA18CropContextV4({
    logical_time:logical,expected_identity_hash:expected,crop_authority:cropAuthority,
    configuration_matrix:matrix,current_crop_authority:current,activation_mode:"QUALIFICATION_ONLY"
  }),/EXTERNAL_FORMAL_A18_V4_CURRENT_KC_MATRIX_MISMATCH/);
});


test("V4 rejects logical time beyond stage authority forward window", () => {
  const current=currentCrop();
  const logical="2026-09-04T11:00:00.000Z";
  const expected=deriveExternalFormalA18CropContextIdentityHashV4({
    logical_time:logical,crop_stage_code:"LATE",
    current_crop_authority_evidence_digest:current.evidence_digest
  });
  assert.throws(()=>materializeExternalFormalA18CropContextV4({
    logical_time:logical,expected_identity_hash:expected,crop_authority:cropAuthority,
    configuration_matrix:matrix,current_crop_authority:current,activation_mode:"QUALIFICATION_ONLY"
  }),/EXTERNAL_FORMAL_A18_V4_STAGE_AUTHORITY_FORWARD_WINDOW_EXCEEDED/);
});

test("V4 rejects future stage evidence for an earlier logical time", () => {
  const current=currentCrop();
  const logical="2026-09-03T03:00:00.000Z";
  const expected=deriveExternalFormalA18CropContextIdentityHashV4({
    logical_time:logical,crop_stage_code:"LATE",
    current_crop_authority_evidence_digest:current.evidence_digest
  });
  assert.throws(()=>materializeExternalFormalA18CropContextV4({
    logical_time:logical,expected_identity_hash:expected,crop_authority:cropAuthority,
    configuration_matrix:matrix,current_crop_authority:current,activation_mode:"QUALIFICATION_ONLY"
  }),/EXTERNAL_FORMAL_A18_V4_FUTURE_STAGE_EVIDENCE_FORBIDDEN/);
});
