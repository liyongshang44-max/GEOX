import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildMcftCap09FormalV5ManifestFromStageAuthorityV1,
  MCFT_CAP09_FORMAL_V5_DATABASE_V1,
} from "./mcft_cap09_formal_v5_manifest_from_stage_authority_v1.js";
import {
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V5,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V5,
} from "../../apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v5.js";

const ROOT=process.cwd();
const CROP=JSON.parse(fs.readFileSync(path.join(
  ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json",
),"utf8"));
const MATRIX=JSON.parse(fs.readFileSync(path.join(
  ROOT,"docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json",
),"utf8"));
const SUBJECT="a".repeat(40);
const A0="2099-09-03T05:00:00.000Z";
const O00="2099-09-03T06:00:00.000Z";
const O23="2099-09-04T05:00:00.000Z";
const EPOCH="mcft_cap09_external_formal_window_epoch_20990903t060000000z_v5";

function arm(overrides:Record<string,unknown>={}){
  return {
    schema_version:"geox_mcft_cap09_formal_v5_arm_v1",
    status:"PASS",
    subject_sha:SUBJECT,
    formal_database_name:MCFT_CAP09_FORMAL_V5_DATABASE_V1,
    arm_time_database_utc:"2099-09-01T17:00:00.000Z",
    epoch_id:EPOCH,
    manifest_ref:`formal-arm://mcft-cap09/formal-v5/${EPOCH}/${MCFT_CAP09_FORMAL_V5_DATABASE_V1}`,
    a0:A0,o00:O00,o23:O23,
    readiness_deadline:"2099-09-02T18:00:00.000Z",
    arm_identity_hash:"sha256:"+"b".repeat(64),
    formal_v5_arm:true,
    formal_v5_epoch_selected:true,
    formal_database_mutation:false,
    schema_materialization:false,
    a0_bootstrap:false,
    o00_started:false,
    provider_request_count:0,
    final_actual_24h_still_required:true,
    mcft_cap09_completed:false,
    ...overrides,
  };
}
function currentCrop(overrides:Record<string,unknown>={}){
  const authorityAsOf="2099-09-03T04:00:00.000Z";
  return {
    schema_version:"geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1",
    status:"PASS",
    qualification_outcome:"CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED",
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
      horizon_end_utc:"2099-11-24T03:59:59.999Z",
    },
    biological_stage:{
      epistemic_class:"THERMAL_MODEL_DERIVED",
      resolved_biological_stage:"R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE",
      observed_biological_stage_claimed:false,
      authority_as_of:authorityAsOf,
      forward_stability_hours:30,
      authority_valid_until:"2099-09-04T10:00:00.000Z",
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
    evidence_digest:"sha256:"+"c".repeat(64),
    architecture_effective:true,
    runtime_consumption_authorized:true,
    runtime_config_write_authorized:false,
    database_write_authorized:false,
    scheduler_write_authorized:false,
    formal_evidence_write_authorized:false,
    production_runtime_start_authorized:false,
    production_owner_activation_authorized:false,
    formal_v5_authorized:false,
    a0_authorized:false,
    o00_o23_authorized:false,
    mcft_cap09_completed:false,
    graduation:{
      status:"EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH",
      graduated_at:"2099-09-03T04:30:00.000Z",
    },
    ...overrides,
  };
}
const architecture={
  schema_version:"geox_dt02_biological_stage_authority_effectiveness_v1",
  amendment_id:"DT02-AMENDMENT-03",
  status:"EFFECTIVE",
  effective:true,
};

test("H6 builds exact V5 A0 + O00-O23 manifest from A0-effective stage authority",()=>{
  const built=buildMcftCap09FormalV5ManifestFromStageAuthorityV1({
    arm:arm(),
    crop_authority:CROP,
    configuration_matrix:MATRIX,
    current_crop_authority:currentCrop(),
    biological_stage_architecture_effectiveness:architecture,
    expected_subject_sha:SUBJECT,
  });
  assert.equal(built.manifest.database_name,MCFT_CAP09_FORMAL_V5_DATABASE_V1);
  assert.equal(built.manifest.slots.length,24);
  assert.equal(built.manifest.slots[0]!.slot_id,"O00");
  assert.equal(built.manifest.slots[0]!.logical_time,O00);
  assert.equal(built.manifest.slots[23]!.slot_id,"O23");
  assert.equal(built.manifest.slots[23]!.logical_time,O23);
  assert.equal(built.prewindow_a0_materialization.logical_time,A0);
  assert.equal(built.prewindow_a0_materialization.stage_code,"LATE");
  assert.equal(built.prewindow_a0_materialization.production_effective,true);
  assert.equal(built.slot_materializations.length,24);
  assert.equal(built.current_crop_graduated_at,"2099-09-03T04:30:00.000Z");

  const configs=[
    built.bundle.persistence_bundle.bootstrap_runtime_config,
    ...built.bundle.persistence_bundle.runtime_configs,
  ];
  assert.equal(configs.length,25);
  for(const config of configs){
    const payload=config.payload as any;
    assert.equal(payload.formal_authorities.fresh_database.ref,MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V5);
    assert.equal(payload.formal_authorities.fresh_database.hash,MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V5);
  }
});

test("H6 rejects stage authority graduated after A0",()=>{
  const bad=currentCrop({
    graduation:{
      status:"EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH",
      graduated_at:"2099-09-03T05:00:01.000Z",
    },
  });
  assert.throws(
    ()=>buildMcftCap09FormalV5ManifestFromStageAuthorityV1({
      arm:arm(),crop_authority:CROP,configuration_matrix:MATRIX,
      current_crop_authority:bad,biological_stage_architecture_effectiveness:architecture,
    }),
    /FORMAL_V5_MANIFEST_CURRENT_CROP_GRADUATED_AFTER_A0/,
  );
});

test("H6 rejects stage validity that cannot cover O23",()=>{
  const bad=currentCrop({
    biological_stage:{
      epistemic_class:"THERMAL_MODEL_DERIVED",
      resolved_biological_stage:"R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE",
      observed_biological_stage_claimed:false,
      authority_as_of:"2099-09-03T04:00:00.000Z",
      forward_stability_hours:24,
      authority_valid_until:"2099-09-04T04:00:00.000Z",
    },
  });
  assert.throws(
    ()=>buildMcftCap09FormalV5ManifestFromStageAuthorityV1({
      arm:arm(),crop_authority:CROP,configuration_matrix:MATRIX,
      current_crop_authority:bad,biological_stage_architecture_effectiveness:architecture,
    }),
    /FORMAL_V5_MANIFEST_STAGE_AUTHORITY_DOES_NOT_COVER_O23/,
  );
});

test("H6 rejects manifest ref not frozen by V5 arm identity",()=>{
  assert.throws(
    ()=>buildMcftCap09FormalV5ManifestFromStageAuthorityV1({
      arm:arm({manifest_ref:"formal-arm://mcft-cap09/amendment19/legacy/v4"}),
      crop_authority:CROP,configuration_matrix:MATRIX,
      current_crop_authority:currentCrop(),biological_stage_architecture_effectiveness:architecture,
    }),
    /FORMAL_V5_MANIFEST_ARM_REF_INVALID/,
  );
});
