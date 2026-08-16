import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {
  buildExternalFormalPrewindowAuthorityBundleV2,
  MCFT_CAP09_A18_CONFIG_AUTHORITY_CREATED_AT_V2,
  MCFT_CAP09_A18_PREWINDOW_A0_LOGICAL_TIME_V2,
  MCFT_CAP09_A18_O00_LOGICAL_TIME_V2,
  MCFT_CAP09_A18_O23_LOGICAL_TIME_V2,
} from "../../apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v2.js";

const SELECTION_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-EPOCH-SELECTION-V2.json");
const AUTH_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A18B-PREWINDOW-A0-AND-REPLACEMENT-RUNTIME-CONFIG-CHAIN-V1.json");
const OUT = path.resolve("acceptance-output/MCFT_CAP_09_A18B_PREWINDOW_CONFIG_CHAIN_QUALIFICATION_RESULT.json");
const selection = JSON.parse(fs.readFileSync(SELECTION_PATH, "utf8"));
const auth = JSON.parse(fs.readFileSync(AUTH_PATH, "utf8"));
const slots = selection.slot_contexts as Array<{ slot_id: string; logical_time: string; crop_stage_code: "INITIAL"|"DEVELOPMENT"|"MID"|"LATE"; crop_stage_context_hash: string }>;

assert.equal(auth.exact_base_main_sha, "6e7b1ac08ca8f79d65d5c6ec0a57e0cbabb8e5c9");
assert.equal(auth.selected_epoch_id, selection.selection_rule.selected_epoch_id);
assert.equal(auth.config_authority_created_at, MCFT_CAP09_A18_CONFIG_AUTHORITY_CREATED_AT_V2);
assert.equal(slots.length, 24);
assert.equal(auth.hourly_runtime_config_pins.length, 24);
assert.equal(slots[0]?.logical_time, MCFT_CAP09_A18_O00_LOGICAL_TIME_V2);
assert.equal(slots.at(-1)?.logical_time, MCFT_CAP09_A18_O23_LOGICAL_TIME_V2);
assert(slots.every((s) => s.crop_stage_code === "MID"), "A18B_EXPECTED_ALL_MID");

const bundle = buildExternalFormalPrewindowAuthorityBundleV2({
  bootstrap_logical_time: MCFT_CAP09_A18_PREWINDOW_A0_LOGICAL_TIME_V2,
  created_at: MCFT_CAP09_A18_CONFIG_AUTHORITY_CREATED_AT_V2,
  bootstrap_crop_stage_code: "MID",
  hourly_crop_pins: slots,
});

assert.equal(bundle.runtime_configs.length, 24);
const a0Payload = bundle.bootstrap_runtime_config.payload as Record<string, any>;
assert.equal(a0Payload.config_role, "A0_BOOTSTRAP");
assert.equal(a0Payload.effective_logical_time, MCFT_CAP09_A18_PREWINDOW_A0_LOGICAL_TIME_V2);
assert.equal(a0Payload.parent_runtime_config_ref, null);
assert.equal(a0Payload.parent_runtime_config_hash, null);
assert.equal((a0Payload.formal_authorities as any).fresh_database.ref, auth.a18a_authority_ref);
assert.equal((a0Payload.formal_authorities as any).fresh_database.hash, auth.a18a_authority_blob_sha);
assert.deepEqual(auth.prewindow_a0, {
  logical_time: bundle.bootstrap_logical_time,
  crop_stage_code: bundle.bootstrap_crop_stage_code,
  crop_stage_context_hash: bundle.bootstrap_crop_stage_context_hash,
  runtime_config_ref: bundle.bootstrap_runtime_config.object_id,
  runtime_config_hash: bundle.bootstrap_runtime_config.determinism_hash,
  parent_runtime_config_ref: null,
  parent_runtime_config_hash: null,
});

let parentRef = bundle.bootstrap_runtime_config.object_id;
let parentHash = bundle.bootstrap_runtime_config.determinism_hash;
const hourlyPins = bundle.runtime_configs.map((config, index) => {
  const payload = config.payload as Record<string, any>;
  const source = slots[index]!;
  const frozen = auth.hourly_runtime_config_pins[index] as [string,string,string,string];
  assert.deepEqual(frozen, [source.slot_id, source.logical_time, config.object_id, config.determinism_hash], `A18B_FROZEN_PIN_DRIFT:${source.slot_id}`);
  assert.equal(payload.config_role, "HOURLY_CAP04");
  assert.equal(payload.effective_logical_time, source.logical_time);
  assert.equal(payload.parent_runtime_config_ref, parentRef);
  assert.equal(payload.parent_runtime_config_hash, parentHash);
  assert.equal(payload.crop_stage_context_authority.context_hash, source.crop_stage_context_hash);
  assert.equal(payload.crop_stage_context_authority.context_ref, "GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2");
  assert.equal(payload.config_selection_mode, "EXPLICIT_REF_HASH_PIN_ONLY");
  assert.equal((payload.formal_authorities as any).fresh_database.ref, auth.a18a_authority_ref);
  assert.equal((payload.formal_authorities as any).fresh_database.hash, auth.a18a_authority_blob_sha);
  const pin = {
    slot_id: source.slot_id,
    logical_time: source.logical_time,
    crop_stage_context_hash: source.crop_stage_context_hash,
    runtime_config_ref: config.object_id,
    runtime_config_hash: config.determinism_hash,
    parent_runtime_config_ref: payload.parent_runtime_config_ref,
    parent_runtime_config_hash: payload.parent_runtime_config_hash,
  };
  parentRef = config.object_id;
  parentHash = config.determinism_hash;
  return pin;
});

assert.equal(auth.nonclaims.runtime_configs_persisted, false);
assert.equal(auth.nonclaims.prewindow_a0_persisted, false);
assert.equal(auth.nonclaims.ea5e3_authorized, false);
assert.equal(auth.nonclaims.formal_o00_started, false);
assert.equal(auth.nonclaims.formal_execution_count, "0/24");

const result = {
  schema_version: "geox_mcft_cap09_a18b_prewindow_config_chain_qualification_result_v1",
  status: "PASS",
  subject_sha: String(process.env.MCFT_SUBJECT_SHA ?? ""),
  selected_epoch_id: bundle.epoch_id,
  created_at_authority: MCFT_CAP09_A18_CONFIG_AUTHORITY_CREATED_AT_V2,
  prewindow_a0: auth.prewindow_a0,
  hourly_configs: hourlyPins,
  frozen_25_runtime_config_pins_equal_recomputation: true,
  exact_24_slot_crop_hashes_preserved: true,
  exact_parent_chain_from_fresh_a0: true,
  a18a_zero_state_store_authority_bound: true,
  provider_request_count: 0,
  database_write_count: 0,
  raw_object_write_count: 0,
  runtime_config_write_count: 0,
  scheduler_write_count: 0,
  canonical_runtime_write_count: 0,
  ea5e3_authorized: false,
  formal_o00_started: false,
  formal_execution_count: "0/24",
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
