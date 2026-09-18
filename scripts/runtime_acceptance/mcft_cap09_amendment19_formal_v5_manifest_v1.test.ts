import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

import {
  MCFT_CAP09_AM19_FORMAL_DATABASE_V5,
  MCFT_CAP09_AM19_FORMAL_STORE_AUTHORITY_BLOB_V5,
  MCFT_CAP09_AM19_FORMAL_STORE_AUTHORITY_REF_V5,
  type McftCap09FormalV5ArmV1,
} from "./mcft_cap09_formal_v5_arm_contract_v1.js";
import { buildMcftCap09Am19FormalV5ManifestV1 } from "./mcft_cap09_amendment19_formal_v5_manifest_v1.js";

const currentPath="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-09-18T04Z-V1.json";
const currentBytes=fs.readFileSync(currentPath);
const current=JSON.parse(currentBytes.toString("utf8"));
const currentSha="sha256:"+crypto.createHash("sha256").update(currentBytes).digest("hex");
const cropAuthority=JSON.parse(fs.readFileSync("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json","utf8"));
const matrix=JSON.parse(fs.readFileSync("docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json","utf8"));
const architecture=JSON.parse(fs.readFileSync("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-ARCHITECTURE-EFFECTIVENESS-V1.json","utf8"));

function arm(): McftCap09FormalV5ArmV1 {
  return {
    schema_version:"geox_mcft_cap09_formal_v5_arm_v1",
    status:"PASS",
    subject_sha:"1".repeat(40),
    arm_identity_hash:"sha256:"+"2".repeat(64),
    epoch_id:"mcft_cap09_am19_formal_v5_test_epoch",
    formal_database_name:MCFT_CAP09_AM19_FORMAL_DATABASE_V5,
    formal_store_authority_ref:MCFT_CAP09_AM19_FORMAL_STORE_AUTHORITY_REF_V5,
    formal_store_authority_blob_sha:MCFT_CAP09_AM19_FORMAL_STORE_AUTHORITY_BLOB_V5,
    a0:"2026-09-18T05:00:00.000Z",
    o00:"2026-09-18T06:00:00.000Z",
    o23:"2026-09-19T05:00:00.000Z",
    manifest_ref:"formal-arm://mcft-cap09/amendment19/v5/test",
    arm_evaluated_at:"2026-09-18T04:10:00.000Z",
    timing_authority_ref:"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-FORCING-ACQUISITION-BUDGET-AUTHORITY-V1.json",
    timing_authority_sha256:"sha256:"+"3".repeat(64),
    selected_budget_ms:2081804,
    current_crop_authority_ref:currentPath,
    current_crop_authority_sha256:currentSha,
    current_crop_authority_evidence_digest:current.evidence_digest,
    crop_water_use_stage:"LATE",
    biological_stage:current.biological_stage.resolved_biological_stage,
    stage_authority_as_of:current.biological_stage.authority_as_of,
    stage_authority_valid_until:current.biological_stage.authority_valid_until,
    zero_state_proof_sha256:"sha256:"+"4".repeat(64),
    live_zero_state:{database_name:MCFT_CAP09_AM19_FORMAL_DATABASE_V5,public_base_table_count:0,public_routine_count:0,transaction_read_only:true},
    h5_reverified:true,
    phase6_retired_triggers_zero:true,
    formal_v5_arm:true,
    formal_v5_epoch_selected:true,
    formal_database_mutation:false,
    a0_bootstrap:false,
    o00_started:false,
    provider_request_count:0,
    mcft_cap09_completed:false,
  };
}

test("Formal-v5 manifest builds exact 24-slot chain on a valid historical current-crop window",()=>{
  const result=buildMcftCap09Am19FormalV5ManifestV1({
    arm:arm(),
    crop_authority:cropAuthority,
    configuration_matrix:matrix,
    current_crop_authority:current,
    current_crop_authority_sha256:currentSha,
    biological_stage_architecture_effectiveness:architecture,
    expected_subject_sha:"1".repeat(40),
  });
  assert.equal(result.manifest.database_name,MCFT_CAP09_AM19_FORMAL_DATABASE_V5);
  assert.equal(result.manifest.slots.length,24);
  assert.equal(result.manifest.o00_logical_time,"2026-09-18T06:00:00.000Z");
  assert.equal(result.manifest.o23_logical_time,"2026-09-19T05:00:00.000Z");
  assert.equal(result.bundle.hourly_crop_pins.length,24);
  for(const pin of result.bundle.hourly_crop_pins) assert.equal(pin.crop_stage_code,"LATE");
  const payload=result.bundle.persistence_bundle.bootstrap_runtime_config.payload as Record<string, any>;
  assert.equal(payload.formal_authorities.fresh_database.ref,MCFT_CAP09_AM19_FORMAL_STORE_AUTHORITY_REF_V5);
  assert.equal(payload.formal_authorities.fresh_database.hash,MCFT_CAP09_AM19_FORMAL_STORE_AUTHORITY_BLOB_V5);
});

test("Formal-v5 manifest rejects current-crop file digest drift",()=>{
  assert.throws(()=>buildMcftCap09Am19FormalV5ManifestV1({
    arm:arm(),
    crop_authority:cropAuthority,
    configuration_matrix:matrix,
    current_crop_authority:current,
    current_crop_authority_sha256:"sha256:"+"f".repeat(64),
    biological_stage_architecture_effectiveness:architecture,
  }),/AM19_V5_CURRENT_CROP_FILE_DIGEST_MISMATCH/);
});

test("Formal-v5 arm contract rejects a window beyond stage validity",()=>{
  const bad=arm();
  bad.stage_authority_valid_until="2026-09-19T04:00:00.000Z";
  assert.throws(()=>buildMcftCap09Am19FormalV5ManifestV1({
    arm:bad,
    crop_authority:cropAuthority,
    configuration_matrix:matrix,
    current_crop_authority:current,
    current_crop_authority_sha256:currentSha,
    biological_stage_architecture_effectiveness:architecture,
  }),/FORMAL_V5_ARM_STAGE_AUTHORITY_DOES_NOT_COVER_O23/);
});
