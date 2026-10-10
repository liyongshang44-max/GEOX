import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  MCFT_CAP09_AM19_FORMAL_DATABASE_V4,
  type McftCap09Am19FormalArmV1,
} from "./mcft_cap09_amendment19_formal_manifest_from_arm_v1.js";
import {
  buildMcftCap09Am19FormalManifestFromStageAuthorityV2,
} from "./mcft_cap09_amendment19_formal_manifest_from_stage_authority_v2.js";

const cropAuthority=JSON.parse(fs.readFileSync(
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json",
  "utf8",
));
const matrix=JSON.parse(fs.readFileSync(
  "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json",
  "utf8",
));

function arm(): McftCap09Am19FormalArmV1 {
  return {
    schema_version:"geox_mcft_cap09_amendment19_formal_arm_v1",
    status:"PASS",
    subject_sha:"1".repeat(40),
    arm_identity_hash:"sha256:"+"2".repeat(64),
    epoch_id:"mcft_cap09_stage_authority_manifest_test_epoch_v1",
    formal_database_name:MCFT_CAP09_AM19_FORMAL_DATABASE_V4,
    a0:"2026-09-03T05:00:00.000Z",
    o00:"2026-09-03T06:00:00.000Z",
    o23:"2026-09-04T05:00:00.000Z",
    manifest_ref:"MCFT_CAP09_STAGE_AUTHORITY_MANIFEST_TEST_V1",
    rolling:{
      captured_at:"2026-09-03T04:30:00.000Z",
      target_t:"2026-09-03T05:00:00.000Z",
    },
    temporal_authority:"PROVIDER_AVAILABILITY_WATERMARK_V1",
    bootstrap_lease_clock_required:"REAL_DATABASE_TRANSACTION_TIMESTAMP",
    formal_clock_mode_required:"SYSTEM_DATABASE_UTC",
    accelerated_clock_authorized_for_formal:false,
    formal_database_write_count:0,
    formal_o00_started:false,
    final_actual_24h_still_required:true,
    human_override_used:false,
    mcft_cap09_completed:false,
  };
}

function currentCrop() {
  return {
    schema_version:"geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1",
    status:"PASS",
    qualification_outcome:"CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED",
    architecture_effective:true,
    runtime_consumption_authorized:true,
    scope:{
      tenant_id:"tenant_mcft_external",
      project_id:"project_mcft_cap09",
      group_id:"group_public_research",
      site_id:"KBS_MCSE_T4R1",
      field_id:"field_kbs_mcse_t4r1",
      season_id:"season_2026_corn",
      zone_id:"zone_kbs_mcse_t4r1_crop_formal_v1",
      crop:"corn",
      hybrid_product_code:"43-96P",
    },
    lifecycle:{
      domain_state:"ACTIVE",
      authority_status:"RESOLVED",
      authority_validity:"VALID",
      authority_mode:"GOVERNED_PERSISTENT_STATE",
      active_consumable_candidate:true,
    },
    biological_stage:{
      epistemic_class:"THERMAL_MODEL_DERIVED",
      resolved_biological_stage:"R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE",
      observed_biological_stage_claimed:false,
      authority_as_of:"2026-09-03T04:00:00.000Z",
      forward_stability_hours:30,
    },
    crop_water_use_stage:"LATE",
    crop_model_parameter:{
      parameter:"Kc",
      stage_code:"LATE",
      value:0.6,
      configuration_source_id:"mcft_crop_water_use_corn_v1",
      configuration_semantic_hash:"sha256:56ac92e34148bd81fe20f2925e1079cb1a3ed647ffefd1471caf1302df70ee4c",
      production_effective:false,
    },
    evidence_digest:"sha256:"+"a".repeat(64),
  };
}

const architecture={
  schema_version:"geox_dt02_biological_stage_authority_effectiveness_v1",
  amendment_id:"DT02-AMENDMENT-03",
  status:"EFFECTIVE",
  effective:true,
};

test("V4 manifest successor generates exact 24 LATE context pins", () => {
  const result=buildMcftCap09Am19FormalManifestFromStageAuthorityV2({
    arm:arm(),
    crop_authority:cropAuthority,
    configuration_matrix:matrix,
    current_crop_authority:currentCrop(),
    biological_stage_architecture_effectiveness:architecture,
    expected_subject_sha:"1".repeat(40),
  });
  assert.equal(result.bundle.hourly_crop_pins.length,24);
  assert.equal(result.manifest.slots.length,24);
  assert.equal(result.manifest.o00_logical_time,"2026-09-03T06:00:00.000Z");
  assert.equal(result.manifest.o23_logical_time,"2026-09-04T05:00:00.000Z");
  for(const pin of result.bundle.hourly_crop_pins){
    assert.equal(pin.crop_stage_code,"LATE");
    assert.match(pin.crop_stage_context_hash,/^sha256:[0-9a-f]{64}$/);
  }
  for(const slot of result.manifest.slots){
    assert.match(slot.crop_stage_context_hash,/^sha256:[0-9a-f]{64}$/);
    assert.match(slot.crop_stage_context_materialization_hash,/^sha256:[0-9a-f]{64}$/);
  }
});

test("V4 manifest successor rejects candidate-only current crop authority", () => {
  const current=currentCrop();
  current.architecture_effective=false;
  current.runtime_consumption_authorized=false;
  assert.throws(()=>buildMcftCap09Am19FormalManifestFromStageAuthorityV2({
    arm:arm(),
    crop_authority:cropAuthority,
    configuration_matrix:matrix,
    current_crop_authority:current,
    biological_stage_architecture_effectiveness:architecture,
  }),/AM19_V4_CURRENT_CROP_AUTHORITY_EFFECTIVE_REQUIRED/);
});

test("V4 manifest successor rejects ineffective architecture", () => {
  assert.throws(()=>buildMcftCap09Am19FormalManifestFromStageAuthorityV2({
    arm:arm(),
    crop_authority:cropAuthority,
    configuration_matrix:matrix,
    current_crop_authority:currentCrop(),
    biological_stage_architecture_effectiveness:{...architecture,status:"CANDIDATE",effective:false},
  }),/AM19_V4_STAGE_ARCHITECTURE_EFFECTIVENESS_REQUIRED/);
});

test("V4 manifest successor rejects a formal window beyond stage forward stability", () => {
  const current=currentCrop();
  current.biological_stage.forward_stability_hours=20;
  assert.throws(()=>buildMcftCap09Am19FormalManifestFromStageAuthorityV2({
    arm:arm(),
    crop_authority:cropAuthority,
    configuration_matrix:matrix,
    current_crop_authority:current,
    biological_stage_architecture_effectiveness:architecture,
  }),/EXTERNAL_FORMAL_V4_STAGE_AUTHORITY_FORWARD_WINDOW_EXCEEDED/);
});
