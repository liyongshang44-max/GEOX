import assert from "node:assert/strict";

import {
  buildExternalFormalPrewindowAuthorityBundleV3,
  deriveExternalFormalCropStageContextHashV3,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V4,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V4,
} from "../../apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v3.js";

const A0 = "2026-08-19T00:00:00.000Z";
const O00 = "2026-08-19T01:00:00.000Z";
const O23 = "2026-08-20T00:00:00.000Z";
const CREATED_AT = "2026-08-18T06:00:00.000Z";
const EPOCH = "mcft_cap09_am19_accelerated_qualification_20260819t010000z_v1";
const FAILED_EPOCH = "mcft_cap09_external_formal_window_epoch_20260817t200000z_v2";

function main(): void {
  const stages = Array.from({ length: 24 }, () => "MID" as const);
  const result = buildExternalFormalPrewindowAuthorityBundleV3({
    epoch_id: EPOCH,
    bootstrap_logical_time: A0,
    created_at: CREATED_AT,
    bootstrap_crop_stage_code: "MID",
    hourly_crop_stage_codes: stages,
    fresh_database_authority_ref: MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V4,
    fresh_database_authority_blob_sha: MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V4,
  });

  assert.equal(result.epoch_id, EPOCH);
  assert.equal(result.o00_logical_time, O00);
  assert.equal(result.o23_logical_time, O23);
  assert.equal(result.hourly_crop_pins.length, 24);
  assert.equal(result.persistence_bundle.runtime_configs.length, 24);
  assert.equal(result.persistence_bundle.bootstrap_logical_time, A0);
  assert.equal(result.persistence_bundle.window_start_utc, O00);

  let parent = result.persistence_bundle.bootstrap_runtime_config;
  for (let index = 0; index < 24; index += 1) {
    const expectedSlot = `O${String(index).padStart(2, "0")}`;
    const expectedTime = new Date(Date.parse(O00) + index * 3_600_000).toISOString();
    const pin = result.hourly_crop_pins[index]!;
    const config = result.persistence_bundle.runtime_configs[index]!;
    assert.equal(pin.slot_id, expectedSlot);
    assert.equal(pin.logical_time, expectedTime);
    assert.equal(config.logical_time, expectedTime);
    const payload = config.payload as Record<string, any>;
    assert.equal(payload.effective_logical_time, expectedTime);
    assert.equal(payload.parent_runtime_config_ref, parent.object_id);
    assert.equal(payload.parent_runtime_config_hash, parent.determinism_hash);
    assert.equal(payload.config_selection_mode, "EXPLICIT_REF_HASH_PIN_ONLY");
    assert.equal(payload.crop_stage_context_authority.context_hash, pin.crop_stage_context_hash);
    assert.equal(
      pin.crop_stage_context_hash,
      deriveExternalFormalCropStageContextHashV3({ crop_stage_code: "MID", derivation_authority_time: expectedTime }),
    );
    assert.equal(payload.formal_authorities.fresh_database.ref, MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V4);
    assert.equal(payload.formal_authorities.fresh_database.hash, MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V4);
    assert.equal(JSON.stringify(payload).includes("geox_mcft_cap09_s6_formal_t3r1_24h_v2"), false);
    parent = config;
  }

  assert.notEqual(result.hourly_crop_pins[0]!.crop_stage_context_hash, result.hourly_crop_pins[1]!.crop_stage_context_hash);
  assert.throws(() => buildExternalFormalPrewindowAuthorityBundleV3({
    epoch_id: FAILED_EPOCH,
    bootstrap_logical_time: A0,
    created_at: CREATED_AT,
    bootstrap_crop_stage_code: "MID",
    hourly_crop_stage_codes: stages,
    fresh_database_authority_ref: MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V4,
    fresh_database_authority_blob_sha: MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V4,
  }), /EXTERNAL_FORMAL_V3_FAILED_EPOCH_REUSE_FORBIDDEN/);
  assert.throws(() => buildExternalFormalPrewindowAuthorityBundleV3({
    epoch_id: EPOCH,
    bootstrap_logical_time: A0,
    created_at: CREATED_AT,
    bootstrap_crop_stage_code: "MID",
    hourly_crop_stage_codes: stages,
    fresh_database_authority_ref: MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V4,
    fresh_database_authority_blob_sha: "deadbeef" as typeof MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V4,
  }), /EXTERNAL_FORMAL_V3_FRESH_STORE_AUTHORITY_PIN_MISMATCH/);

  console.log(JSON.stringify({
    status: "PASS",
    authority_bundle_version: "V3_PARAMETERIZED_SUCCESSOR",
    exact_24_hourly_runtime_configs: true,
    parent_linked_runtime_config_chain: true,
    per_hour_crop_context_authority: true,
    explicit_ref_hash_pin_only: true,
    fresh_store_authority_ref: MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V4,
    fresh_store_authority_blob_sha: MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V4,
    failed_v2_epoch_reuse_rejected: true,
    failed_v2_database_binding_present: false,
    database_write_count: 0,
    provider_request_count: 0,
    scheduler_write_count: 0,
    formal_effect: false,
    persistent_24t_claimed: false,
  }));
}

main();
