import fs from "node:fs";
import path from "node:path";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  buildExternalFormalPrewindowAuthorityBundleV2,
  MCFT_CAP09_A18_CONFIG_AUTHORITY_CREATED_AT_V2,
  MCFT_CAP09_A18_PREWINDOW_A0_LOGICAL_TIME_V2,
} from "../../apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v2.js";
import {
  MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V2,
  materializeExternalFormalA18CropContextV2,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v2.js";
import type { ExternalFormalV3A18WindowManifestV1 } from "../../apps/server/src/runtime/twin_runtime/external_formal_v3_amendment11_runner_v1.js";

const MANIFEST_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A18C-REPLACEMENT-FORMAL-WINDOW-INPUT-MANIFEST-V3.json");
const A18B_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A18B-PREWINDOW-A0-AND-REPLACEMENT-RUNTIME-CONFIG-CHAIN-V1.json");
const SELECTION_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-EPOCH-SELECTION-V2.json");
const CROP_AUTHORITY_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json");
const MATRIX_PATH = path.resolve("docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json");

export const MCFT_CAP09_A18C_FORMAL_DATABASE_V1 = "geox_mcft_cap09_s6_formal_t3r1_24h_v2" as const;
export const MCFT_CAP09_A18C_FORMAL_EPOCH_V1 = "mcft_cap09_external_formal_window_epoch_20260817t200000z_v2" as const;
export const MCFT_CAP09_A18C_O00_V1 = "2026-08-17T20:00:00.000Z" as const;
export const MCFT_CAP09_A18C_O23_V1 = "2026-08-18T19:00:00.000Z" as const;
export const MCFT_CAP09_A18C_MANIFEST_HASH_V1 = "sha256:af017d2ec76143472c38ab4277c66ac9d66d9b59d02ac8a609e1faef927bd612" as const;

type SelectedSlot = {
  slot_id: string;
  logical_time: string;
  crop_stage_code: "MID";
  crop_stage_context_hash: string;
};

type ManifestDoc = {
  schema_version: string;
  authority: string;
  manifest_ref: string;
  manifest_hash_profile: string;
  manifest_hash: string;
  formal_store: { database_name: string };
  scope: Record<string, string>;
  epoch: { epoch_id: string; prewindow_a0: string; o00: string; o23: string };
  slot_context_materialization_hashes: Array<[string, string]>;
};

export type ExactA18CLiveManifestBuildResultV1 = {
  manifest: ExternalFormalV3A18WindowManifestV1;
  crop_authority: Record<string, unknown>;
  configuration_matrix: Record<string, unknown>;
  exact_slot_count: 24;
  exact_manifest_hash: typeof MCFT_CAP09_A18C_MANIFEST_HASH_V1;
};

function materializationHash(contextRef: string, identityHash: string, context: unknown): string {
  return semanticHashV1({
    materialization_profile: MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V2,
    context_ref: contextRef,
    context_identity_hash: identityHash,
    materialized_context: context,
  });
}

export function buildExactA18CLiveManifestV1(): ExactA18CLiveManifestBuildResultV1 {
  const manifestDoc = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as ManifestDoc;
  const a18b = JSON.parse(fs.readFileSync(A18B_PATH, "utf8"));
  const selection = JSON.parse(fs.readFileSync(SELECTION_PATH, "utf8"));
  const cropAuthority = JSON.parse(fs.readFileSync(CROP_AUTHORITY_PATH, "utf8")) as Record<string, unknown>;
  const matrix = JSON.parse(fs.readFileSync(MATRIX_PATH, "utf8")) as Record<string, unknown>;
  const selectedSlots = selection.slot_contexts as SelectedSlot[];

  if (manifestDoc.schema_version !== "geox_mcft_cap09_a18c_replacement_formal_window_input_manifest_v3") throw new Error("A18C_LIVE_MANIFEST_SCHEMA_REQUIRED");
  if (manifestDoc.authority !== "A18C_REPLACEMENT_IMMUTABLE_FORMAL_WINDOW_INPUT_MANIFEST_AND_RUNNER_EXACT_BINDING") throw new Error("A18C_LIVE_MANIFEST_AUTHORITY_REQUIRED");
  if (manifestDoc.manifest_hash_profile !== "SEMANTIC_HASH_V1_WITH_MANIFEST_HASH_BLANK") throw new Error("A18C_LIVE_MANIFEST_HASH_PROFILE_REQUIRED");
  const hashSeed = structuredClone(manifestDoc);
  hashSeed.manifest_hash = "";
  if (semanticHashV1(hashSeed) !== manifestDoc.manifest_hash || manifestDoc.manifest_hash !== MCFT_CAP09_A18C_MANIFEST_HASH_V1) throw new Error("A18C_LIVE_MANIFEST_SEMANTIC_HASH_DRIFT");
  if (manifestDoc.formal_store.database_name !== MCFT_CAP09_A18C_FORMAL_DATABASE_V1) throw new Error("A18C_LIVE_FORMAL_DATABASE_DRIFT");
  if (manifestDoc.epoch.epoch_id !== MCFT_CAP09_A18C_FORMAL_EPOCH_V1 || manifestDoc.epoch.prewindow_a0 !== MCFT_CAP09_A18_PREWINDOW_A0_LOGICAL_TIME_V2 || manifestDoc.epoch.o00 !== MCFT_CAP09_A18C_O00_V1 || manifestDoc.epoch.o23 !== MCFT_CAP09_A18C_O23_V1) throw new Error("A18C_LIVE_EPOCH_DRIFT");
  if (!Array.isArray(selectedSlots) || selectedSlots.length !== 24 || !Array.isArray(manifestDoc.slot_context_materialization_hashes) || manifestDoc.slot_context_materialization_hashes.length !== 24) throw new Error("A18C_LIVE_EXACT_24_SLOTS_REQUIRED");
  if (a18b.authority !== "A18B_PREWINDOW_A0_AND_REPLACEMENT_RUNTIME_CONFIG_CHAIN") throw new Error("A18C_LIVE_A18B_AUTHORITY_REQUIRED");

  const bundle = buildExternalFormalPrewindowAuthorityBundleV2({
    bootstrap_logical_time: MCFT_CAP09_A18_PREWINDOW_A0_LOGICAL_TIME_V2,
    created_at: MCFT_CAP09_A18_CONFIG_AUTHORITY_CREATED_AT_V2,
    bootstrap_crop_stage_code: "MID",
    hourly_crop_pins: selectedSlots,
  });
  if (bundle.runtime_configs.length !== 24) throw new Error("A18C_LIVE_COMPILED_CONFIG_COUNT_REQUIRED");

  const materializationBySlot = new Map(manifestDoc.slot_context_materialization_hashes);
  if (materializationBySlot.size !== 24) throw new Error("A18C_LIVE_MATERIALIZATION_SLOT_CARDINALITY_REQUIRED");

  const runtimeSlots = bundle.runtime_configs.map((config, index) => {
    const source = selectedSlots[index]!;
    const expectedSlot = `O${String(index).padStart(2, "0")}`;
    const expectedLogicalTime = new Date(Date.parse(MCFT_CAP09_A18C_O00_V1) + index * 3_600_000).toISOString();
    if (source.slot_id !== expectedSlot || source.logical_time !== expectedLogicalTime || source.crop_stage_code !== "MID") throw new Error(`A18C_LIVE_SLOT_SEQUENCE_DRIFT:${expectedSlot}`);
    const pin = a18b.hourly_runtime_config_pins[index] as [string, string, string, string];
    if (pin[0] !== source.slot_id || pin[1] !== source.logical_time || pin[2] !== config.object_id || pin[3] !== config.determinism_hash) throw new Error(`A18C_LIVE_A18B_CONFIG_PIN_DRIFT:${source.slot_id}`);
    const payload = config.payload as Record<string, any>;
    const materialized = materializeExternalFormalA18CropContextV2({
      logical_time: source.logical_time,
      expected_identity_hash: source.crop_stage_context_hash,
      crop_authority: cropAuthority,
      configuration_matrix: matrix,
    });
    const expectedMaterialization = materializationBySlot.get(source.slot_id);
    if (materialized.context_identity_hash !== source.crop_stage_context_hash || materialized.context_materialization_hash !== expectedMaterialization || materializationHash(materialized.context_ref, materialized.context_identity_hash, materialized.context) !== expectedMaterialization) throw new Error(`A18C_LIVE_CONTEXT_MATERIALIZATION_DRIFT:${source.slot_id}`);
    return {
      manifest_ref: manifestDoc.manifest_ref,
      manifest_hash: manifestDoc.manifest_hash,
      epoch_id: manifestDoc.epoch.epoch_id,
      slot_id: source.slot_id,
      logical_time: source.logical_time,
      runtime_config_ref: config.object_id,
      runtime_config_hash: config.determinism_hash,
      parent_runtime_config_ref: String(payload.parent_runtime_config_ref),
      parent_runtime_config_hash: String(payload.parent_runtime_config_hash),
      crop_stage_context_ref: String(payload.crop_stage_context_authority.context_ref),
      crop_stage_context_hash: source.crop_stage_context_hash,
      crop_stage_context_materialization_hash: materialized.context_materialization_hash,
    };
  });

  if (runtimeSlots[0]!.parent_runtime_config_ref !== a18b.prewindow_a0.runtime_config_ref || runtimeSlots[0]!.parent_runtime_config_hash !== a18b.prewindow_a0.runtime_config_hash) throw new Error("A18C_LIVE_O00_PARENT_MUST_BE_A0");
  for (let index = 1; index < runtimeSlots.length; index += 1) {
    if (runtimeSlots[index]!.parent_runtime_config_ref !== runtimeSlots[index - 1]!.runtime_config_ref || runtimeSlots[index]!.parent_runtime_config_hash !== runtimeSlots[index - 1]!.runtime_config_hash) throw new Error(`A18C_LIVE_PARENT_CHAIN_DRIFT:${runtimeSlots[index]!.slot_id}`);
  }

  const manifest: ExternalFormalV3A18WindowManifestV1 = {
    manifest_ref: manifestDoc.manifest_ref,
    manifest_hash: manifestDoc.manifest_hash,
    epoch_id: manifestDoc.epoch.epoch_id,
    database_name: manifestDoc.formal_store.database_name,
    scope: bundle.scope,
    o00_logical_time: manifestDoc.epoch.o00,
    o23_logical_time: manifestDoc.epoch.o23,
    slots: runtimeSlots as ExternalFormalV3A18WindowManifestV1["slots"],
  };

  return {
    manifest,
    crop_authority: cropAuthority,
    configuration_matrix: matrix,
    exact_slot_count: 24,
    exact_manifest_hash: MCFT_CAP09_A18C_MANIFEST_HASH_V1,
  };
}
