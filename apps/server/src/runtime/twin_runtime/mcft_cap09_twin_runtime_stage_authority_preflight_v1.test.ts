import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  deriveExternalFormalA18CropContextIdentityHashV4,
  materializeExternalFormalA18CropContextV4,
} from "./external_formal_a18_crop_context_v4.js";
import {
  preflightMcftCap09TwinStageAuthorityManifestV1,
  type McftCap09ProductionV4ManifestV1,
} from "./mcft_cap09_twin_runtime_stage_authority_preflight_v1.js";
import type {
  ExternalFormalV4Am19ManifestSlotPinV2,
} from "./external_formal_v4_amendment19_runner_v2.js";
import type { ShadowOnlineSlotIdV1 } from "./ports.js";

const cropAuthority = JSON.parse(fs.readFileSync(
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json",
  "utf8",
));
const matrix = JSON.parse(fs.readFileSync(
  "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json",
  "utf8",
));
const subject = "1".repeat(40);
const evidenceDigest = "sha256:" + "a".repeat(64);

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
    evidence_digest:evidenceDigest,
  };
}

const architecture = {
  schema_version:"geox_dt02_biological_stage_authority_effectiveness_v1",
  amendment_id:"DT02-AMENDMENT-03",
  status:"EFFECTIVE",
  effective:true,
};

function manifest(): McftCap09ProductionV4ManifestV1 {
  const current = currentCrop();
  const manifestRef = "MCFT_CAP09_V4_PREFLIGHT_TEST_MANIFEST_V1";
  const manifestHash = "sha256:" + "b".repeat(64);
  const slots: ExternalFormalV4Am19ManifestSlotPinV2[] = Array.from(
    { length: 24 },
    (_, index) => {
    const logicalTime = new Date(
      Date.parse("2026-09-03T05:00:00.000Z") + index * 3_600_000,
    ).toISOString();
    const identity = deriveExternalFormalA18CropContextIdentityHashV4({
      logical_time:logicalTime,
      crop_stage_code:"LATE",
      current_crop_authority_evidence_digest:evidenceDigest,
    });
    const materialized = materializeExternalFormalA18CropContextV4({
      logical_time:logicalTime,
      expected_identity_hash:identity,
      crop_authority:cropAuthority,
      configuration_matrix:matrix,
      current_crop_authority:current,
      biological_stage_architecture_effectiveness:architecture,
      activation_mode:"PRODUCTION_EFFECTIVE",
    });
    const slotId = `O${String(index).padStart(2,"0")}` as ShadowOnlineSlotIdV1;
      return {
      manifest_ref:manifestRef,
      manifest_hash:manifestHash,
      epoch_id:"mcft_cap09_v4_preflight_test_epoch_v1",
      slot_id:slotId,
      logical_time:logicalTime,
      runtime_config_ref:`runtime-config-${slotId}`,
      runtime_config_hash:"sha256:" + String(index).padStart(64,"0"),
      parent_runtime_config_ref:index === 0 ? "a0-runtime-config" : `runtime-config-O${String(index-1).padStart(2,"0")}`,
      parent_runtime_config_hash:"sha256:" + "c".repeat(64),
      crop_stage_context_ref:materialized.context_ref,
      crop_stage_context_hash:materialized.context_identity_hash,
      crop_stage_context_materialization_hash:materialized.context_materialization_hash,
      };
    },
  );
  return {
    schema_version:"geox_mcft_cap09_amendment19_window_manifest_v1",
    subject_sha:subject,
    manifest_ref:manifestRef,
    manifest_hash:manifestHash,
    epoch_id:"mcft_cap09_v4_preflight_test_epoch_v1",
    database_name:"geox_mcft_cap09_s6_formal_t4r1_24h_v5",
    scope:{
      tenant_id:"tenant_mcft_external",
      project_id:"project_mcft_cap09",
      group_id:"group_public_research",
      field_id:"field_kbs_mcse_t4r1",
      season_id:"season_2026_corn",
      zone_id:"zone_kbs_mcse_t4r1_crop_formal_v1",
    },
    o00_logical_time:"2026-09-03T05:00:00.000Z",
    o23_logical_time:"2026-09-04T04:00:00.000Z",
    slots,
  };
}

test("production preflight accepts exact V4 LATE/Kc0.6 manifest", () => {
  const result = preflightMcftCap09TwinStageAuthorityManifestV1({
    deployment_subject_sha:subject,
    manifest:manifest(),
    crop_authority:cropAuthority,
    configuration_matrix:matrix,
    current_crop_authority:currentCrop(),
    biological_stage_architecture_effectiveness:architecture,
  });
  assert.equal(result.status,"PASS");
  assert.equal(result.exact_slot_count,24);
  assert.equal(result.resolved_water_use_stage,"LATE");
  assert.equal(result.resolved_kc,0.6);
  assert.equal(result.current_crop_authority_evidence_digest,evidenceDigest);
  assert.equal(result.production_effective,true);
});

test("production preflight rejects stale or wrong deployment subject", () => {
  assert.throws(() => preflightMcftCap09TwinStageAuthorityManifestV1({
    deployment_subject_sha:"2".repeat(40),
    manifest:manifest(),
    crop_authority:cropAuthority,
    configuration_matrix:matrix,
    current_crop_authority:currentCrop(),
    biological_stage_architecture_effectiveness:architecture,
  }), /MCFT_CAP09_TWIN_V4_MANIFEST_DEPLOYMENT_SUBJECT_MISMATCH/);
});

test("production preflight rejects old or tampered crop-context pin", () => {
  const candidate = manifest();
  const slots = candidate.slots.map((slot,index) =>
    index === 0
      ? { ...slot, crop_stage_context_hash:"sha256:"+"d".repeat(64) }
      : slot
  );
  assert.throws(() => preflightMcftCap09TwinStageAuthorityManifestV1({
    deployment_subject_sha:subject,
    manifest:{...candidate,slots},
    crop_authority:cropAuthority,
    configuration_matrix:matrix,
    current_crop_authority:currentCrop(),
    biological_stage_architecture_effectiveness:architecture,
  }), /EXTERNAL_FORMAL_A18_V4_FROZEN_IDENTITY_HASH_MISMATCH/);
});

test("production preflight rejects candidate-only architecture", () => {
  assert.throws(() => preflightMcftCap09TwinStageAuthorityManifestV1({
    deployment_subject_sha:subject,
    manifest:manifest(),
    crop_authority:cropAuthority,
    configuration_matrix:matrix,
    current_crop_authority:currentCrop(),
    biological_stage_architecture_effectiveness:{
      ...architecture,status:"CANDIDATE",effective:false,
    },
  }), /EXTERNAL_FORMAL_A18_V4_ARCHITECTURE_EFFECTIVENESS_REQUIRED/);
});
