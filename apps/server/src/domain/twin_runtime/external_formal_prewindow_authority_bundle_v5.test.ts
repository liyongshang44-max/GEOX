import test from "node:test";
import assert from "node:assert/strict";

import {
  buildExternalFormalPrewindowAuthorityBundleV4,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V4,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V4,
} from "./external_formal_prewindow_authority_bundle_v4.js";
import {
  buildExternalFormalPrewindowAuthorityBundleV5,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V5,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V5,
} from "./external_formal_prewindow_authority_bundle_v5.js";
import {
  validateExternalFormalRuntimeConfigPayloadV1,
} from "./external_formal_runtime_config_v1.js";

const DIGEST="sha256:"+"a".repeat(64);
const input={
  epoch_id:"mcft_cap09_h6_v5_prewindow_test_v1",
  bootstrap_logical_time:"2026-09-03T05:00:00.000Z",
  created_at:"2026-09-03T04:00:00.000Z",
  bootstrap_crop_stage_code:"LATE" as const,
  hourly_crop_stage_codes:Array.from({length:24},()=> "LATE" as const),
  current_crop_authority_evidence_digest:DIGEST,
  stage_authority_as_of:"2026-09-03T04:00:00.000Z",
  forward_stability_hours:30,
};

test("V5 successor preserves A18 stage pins while rebinding only fresh-store authority",()=>{
  const v4=buildExternalFormalPrewindowAuthorityBundleV4({
    ...input,
    fresh_database_authority_ref:MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V4,
    fresh_database_authority_blob_sha:MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V4,
  });
  const v5=buildExternalFormalPrewindowAuthorityBundleV5(input);

  assert.equal(v5.o00_logical_time,v4.o00_logical_time);
  assert.equal(v5.o23_logical_time,v4.o23_logical_time);
  assert.deepEqual(v5.hourly_crop_pins,v4.hourly_crop_pins);
  assert.equal(v5.persistence_bundle.runtime_configs.length,24);
  assert.notEqual(
    v5.persistence_bundle.bootstrap_runtime_config.object_id,
    v4.persistence_bundle.bootstrap_runtime_config.object_id,
  );

  const all=[
    v5.persistence_bundle.bootstrap_runtime_config,
    ...v5.persistence_bundle.runtime_configs,
  ];
  const oldAll=[
    v4.persistence_bundle.bootstrap_runtime_config,
    ...v4.persistence_bundle.runtime_configs,
  ];
  assert.equal(all.length,25);
  for(let index=0;index<all.length;index+=1){
    const config=all[index]!;
    validateExternalFormalRuntimeConfigPayloadV1(config.payload);
    assert.equal(
      config.payload.formal_authorities.fresh_database.ref,
      MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V5,
    );
    assert.equal(
      config.payload.formal_authorities.fresh_database.hash,
      MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V5,
    );
    assert.notEqual(config.object_id,oldAll[index]!.object_id);
    if(index===0){
      assert.equal(config.payload.parent_runtime_config_ref,null);
      assert.equal(config.payload.parent_runtime_config_hash,null);
    }else{
      assert.equal(config.payload.parent_runtime_config_ref,all[index-1]!.object_id);
      assert.equal(config.payload.parent_runtime_config_hash,all[index-1]!.determinism_hash);
    }
  }
});

test("V5 successor inherits fail-closed A18 forward-stability boundary",()=>{
  assert.throws(
    ()=>buildExternalFormalPrewindowAuthorityBundleV5({
      ...input,
      stage_authority_as_of:"2026-09-03T00:00:00.000Z",
      forward_stability_hours:24,
    }),
    /EXTERNAL_FORMAL_V4_STAGE_AUTHORITY_FORWARD_WINDOW_EXCEEDED/,
  );
});

test("V5 successor never exposes the V4 fresh-store authority in compiled configs",()=>{
  const v5=buildExternalFormalPrewindowAuthorityBundleV5(input);
  for(const config of [
    v5.persistence_bundle.bootstrap_runtime_config,
    ...v5.persistence_bundle.runtime_configs,
  ]){
    validateExternalFormalRuntimeConfigPayloadV1(config.payload);
    assert.notEqual(
      config.payload.formal_authorities.fresh_database.ref,
      MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V4,
    );
    assert.notEqual(
      config.payload.formal_authorities.fresh_database.hash,
      MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V4,
    );
  }
});
