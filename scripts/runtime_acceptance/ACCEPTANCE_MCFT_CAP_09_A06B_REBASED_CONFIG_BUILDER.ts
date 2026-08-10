import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildExternalFormalBootstrapAuthorityBundleV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_bootstrap_authority_bundle_v1.js";
import {
  buildExternalFormalWindowEpochRebaseBundleV1,
  MCFT_CAP09_A06A_EFFECTIVE_AT_V1,
  MCFT_CAP09_A06A_SELECTED_EPOCH_ID_V1,
  MCFT_CAP09_A06A_SELECTED_O00_V1,
  MCFT_CAP09_A06A_SELECTED_O23_V1,
  MCFT_CAP09_EXISTING_EXTERNAL_A0_LOGICAL_TIME_V1,
  MCFT_CAP09_EXISTING_EXTERNAL_A0_RUNTIME_CONFIG_HASH_V1,
  MCFT_CAP09_EXISTING_EXTERNAL_A0_RUNTIME_CONFIG_REF_V1,
  type ExternalFormalRebaseSlotContextV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_window_epoch_rebase_bundle_v1.js";
import {
  validateCanonicalObjectV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  validateExternalFormalRuntimeConfigPayloadV1,
  type ExternalFormalRuntimeConfigPayloadV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const authorityPath = path.join(
  root,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A06A-FUTURE-FORMAL-WINDOW-EPOCH-SELECTION-V1.json",
);
const outPath = path.join(root, "acceptance-output/MCFT_CAP_09_A06B_REBASED_CONFIG_BUILDER_RESULT.json");

const authority = JSON.parse(fs.readFileSync(authorityPath, "utf8")) as {
  selection_rule: { selected_epoch_id: string; selected_o00: string; selected_o23: string };
  slot_contexts: ExternalFormalRebaseSlotContextV1[];
};

assert.equal(authority.selection_rule.selected_epoch_id, MCFT_CAP09_A06A_SELECTED_EPOCH_ID_V1);
assert.equal(authority.selection_rule.selected_o00, MCFT_CAP09_A06A_SELECTED_O00_V1);
assert.equal(authority.selection_rule.selected_o23, MCFT_CAP09_A06A_SELECTED_O23_V1);
assert.equal(authority.slot_contexts.length, 24);

const historical = buildExternalFormalBootstrapAuthorityBundleV1({
  bootstrap_logical_time: MCFT_CAP09_EXISTING_EXTERNAL_A0_LOGICAL_TIME_V1,
  created_at: MCFT_CAP09_A06A_EFFECTIVE_AT_V1,
  crop_stage_code: "MID",
  crop_stage_derivation_authority_time: MCFT_CAP09_EXISTING_EXTERNAL_A0_LOGICAL_TIME_V1,
});
const a0 = historical.bootstrap_runtime_config;
assert.equal(a0.object_id, MCFT_CAP09_EXISTING_EXTERNAL_A0_RUNTIME_CONFIG_REF_V1);
assert.equal(a0.determinism_hash, MCFT_CAP09_EXISTING_EXTERNAL_A0_RUNTIME_CONFIG_HASH_V1);
validateCanonicalObjectV1(a0);

const first = buildExternalFormalWindowEpochRebaseBundleV1({
  selected_epoch_id: authority.selection_rule.selected_epoch_id,
  slots: authority.slot_contexts,
  existing_a0_runtime_config: a0,
});
const second = buildExternalFormalWindowEpochRebaseBundleV1({
  selected_epoch_id: authority.selection_rule.selected_epoch_id,
  slots: structuredClone(authority.slot_contexts),
  existing_a0_runtime_config: structuredClone(a0),
});
assert.deepEqual(second, first, "A06B_BUILDER_MUST_BE_DETERMINISTIC");
assert.equal(first.runtime_config_count, 24);
assert.equal(first.selected_o00, MCFT_CAP09_A06A_SELECTED_O00_V1);
assert.equal(first.selected_o23, MCFT_CAP09_A06A_SELECTED_O23_V1);
assert.equal(first.existing_a0_runtime_config_ref, MCFT_CAP09_EXISTING_EXTERNAL_A0_RUNTIME_CONFIG_REF_V1);
assert.equal(first.existing_a0_runtime_config_hash, MCFT_CAP09_EXISTING_EXTERNAL_A0_RUNTIME_CONFIG_HASH_V1);
assert.equal(first.database_write_count, 0);
assert.equal(first.provider_request_count, 0);
assert.equal(first.scheduler_slot_write_count, 0);
assert.equal(first.formal_window_started, false);

const historicalHourlyRefs = new Set(historical.runtime_configs.map((config) => config.object_id));
const historicalHourlyHashes = new Set(historical.runtime_configs.map((config) => config.determinism_hash));
const newRefs = new Set<string>();
const newHashes = new Set<string>();
for (let index = 0; index < first.runtime_configs.length; index += 1) {
  const config = first.runtime_configs[index]!;
  const slot = authority.slot_contexts[index]!;
  validateCanonicalObjectV1(config);
  validateExternalFormalRuntimeConfigPayloadV1(config.payload);
  const payload = config.payload as unknown as ExternalFormalRuntimeConfigPayloadV1;
  assert.equal(config.object_type, "twin_runtime_config_v1");
  assert.equal(config.logical_time, slot.logical_time);
  assert.equal(config.as_of, slot.logical_time);
  assert.equal(payload.config_role, "HOURLY_CAP04");
  assert.equal(payload.effective_logical_time, slot.logical_time);
  assert.equal(payload.runtime_mode, "SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY");
  assert.equal(payload.config_selection_mode, "EXPLICIT_REF_HASH_PIN_ONLY");
  assert.equal(payload.crop_stage_context_authority.context_hash, slot.crop_stage_context_hash);
  assert.notEqual(payload.crop_stage_context_authority.context_hash, (a0.payload as Record<string, any>).crop_stage_context_authority.context_hash);
  if (index === 0) {
    assert.equal(payload.parent_runtime_config_ref, a0.object_id);
    assert.equal(payload.parent_runtime_config_hash, a0.determinism_hash);
  } else {
    const parent = first.runtime_configs[index - 1]!;
    assert.equal(payload.parent_runtime_config_ref, parent.object_id);
    assert.equal(payload.parent_runtime_config_hash, parent.determinism_hash);
  }
  assert.equal(historicalHourlyRefs.has(config.object_id), false, `A06B_REBASED_REF_COLLIDES_WITH_EXPIRED:${index}`);
  assert.equal(historicalHourlyHashes.has(config.determinism_hash), false, `A06B_REBASED_HASH_COLLIDES_WITH_EXPIRED:${index}`);
  newRefs.add(config.object_id);
  newHashes.add(config.determinism_hash);
}
assert.equal(newRefs.size, 24, "A06B_EXACT_24_DISTINCT_CONFIG_REFS_REQUIRED");
assert.equal(newHashes.size, 24, "A06B_EXACT_24_DISTINCT_CONFIG_HASHES_REQUIRED");
assert.deepEqual(first.slot_crop_stage_context_hashes, authority.slot_contexts.map((slot) => slot.crop_stage_context_hash));

const builderSource = fs.readFileSync(
  path.join(root, "apps/server/src/domain/twin_runtime/external_formal_window_epoch_rebase_bundle_v1.ts"),
  "utf8",
);
for (const forbidden of [
  "Date.now(",
  "new Date()",
  "process.env",
  "fetch(",
  "node:fs",
  "node:net",
  "node:http",
  "node:https",
  "pg",
  "INSERT INTO",
  "UPDATE ",
  "DELETE FROM",
  "twin_shadow_online_scheduler_slot_v1",
  "CONTROLLED_SYNTHETIC_REPLAY_PROXY",
  "field_c8_demo",
  "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1",
]) {
  assert.equal(builderSource.includes(forbidden), false, `A06B_PURE_BUILDER_FORBIDDEN_MARKER:${forbidden}`);
}

const result = {
  schema_version: "geox_mcft_cap09_a06b_rebased_config_builder_result_v1",
  status: "PASS",
  selected_epoch_id: first.selected_epoch_id,
  selected_o00: first.selected_o00,
  selected_o23: first.selected_o23,
  existing_a0_runtime_config_ref: first.existing_a0_runtime_config_ref,
  existing_a0_runtime_config_hash: first.existing_a0_runtime_config_hash,
  exact_rebased_runtime_config_count: first.runtime_config_count,
  runtime_config_refs: first.runtime_config_refs,
  runtime_config_hashes: first.runtime_config_hashes,
  slot_crop_stage_context_hashes: first.slot_crop_stage_context_hashes,
  exact_parent_chain_verified: true,
  expired_epoch_ref_hash_collision_count: 0,
  stale_a0_crop_context_reuse_count: 0,
  deterministic_double_build_verified: true,
  builder_database_write_count: 0,
  builder_provider_request_count: 0,
  builder_scheduler_slot_write_count: 0,
  formal_window_started: false,
  a06c_persistence_authorized: false,
  formal_o00_start_authorized: false,
  mcft_cap09_completed: false,
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
