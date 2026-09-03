import test from "node:test";
import assert from "node:assert/strict";

import {
  buildExternalFormalPrewindowAuthorityBundleV4,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V4,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V4,
} from "./external_formal_prewindow_authority_bundle_v4.js";

const digest="sha256:"+"a".repeat(64);

function build(overrides: Partial<Parameters<typeof buildExternalFormalPrewindowAuthorityBundleV4>[0]> = {}) {
  return buildExternalFormalPrewindowAuthorityBundleV4({
    epoch_id:"mcft_cap09_stage_authority_epoch_test_v1",
    bootstrap_logical_time:"2026-09-03T05:00:00.000Z",
    created_at:"2026-09-03T04:00:00.000Z",
    bootstrap_crop_stage_code:"LATE",
    hourly_crop_stage_codes:Array.from({length:24},()=> "LATE" as const),
    current_crop_authority_evidence_digest:digest,
    stage_authority_as_of:"2026-09-03T04:00:00.000Z",
    forward_stability_hours:30,
    fresh_database_authority_ref:MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V4,
    fresh_database_authority_blob_sha:MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V4,
    ...overrides,
  });
}

test("V4 prewindow builds exact 24 LATE pins inside stage-authority forward window", () => {
  const result=build();
  assert.equal(result.o00_logical_time,"2026-09-03T06:00:00.000Z");
  assert.equal(result.o23_logical_time,"2026-09-04T05:00:00.000Z");
  assert.equal(result.hourly_crop_pins.length,24);
  assert.equal(result.persistence_bundle.runtime_configs.length,24);
  for(const pin of result.hourly_crop_pins){
    assert.equal(pin.crop_stage_code,"LATE");
    assert.match(pin.crop_stage_context_hash,/^sha256:[0-9a-f]{64}$/);
  }
  assert.equal(
    result.persistence_bundle.runtime_configs[0]!.payload.parent_runtime_config_ref,
    result.persistence_bundle.bootstrap_runtime_config.object_id,
  );
  for(let i=1;i<24;i+=1){
    assert.equal(
      result.persistence_bundle.runtime_configs[i]!.payload.parent_runtime_config_ref,
      result.persistence_bundle.runtime_configs[i-1]!.object_id,
    );
  }
});

test("V4 prewindow rejects stage snapshot from the future", () => {
  assert.throws(()=>build({
    stage_authority_as_of:"2026-09-03T06:00:00.000Z",
  }),/EXTERNAL_FORMAL_V4_FUTURE_STAGE_EVIDENCE_FORBIDDEN/);
});

test("V4 prewindow rejects 24T beyond proven forward-stability horizon", () => {
  assert.throws(()=>build({
    stage_authority_as_of:"2026-09-03T00:00:00.000Z",
    forward_stability_hours:24,
  }),/EXTERNAL_FORMAL_V4_STAGE_AUTHORITY_FORWARD_WINDOW_EXCEEDED/);
});

test("V4 prewindow rejects invalid current-crop evidence digest", () => {
  assert.throws(()=>build({
    current_crop_authority_evidence_digest:"sha256:bad",
  }),/EXTERNAL_FORMAL_V4_CURRENT_CROP_AUTHORITY_DIGEST_INVALID/);
});
